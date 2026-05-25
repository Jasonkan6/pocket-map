require('dotenv').config();
const express = require('express');
const line = require('@line/bot-sdk');
const { GoogleGenAI } = require("@google/genai");
const { createClient } = require('@supabase/supabase-js');

const app = express();

const lineConfig = {
  channelSecret: process.env.LINE_CHANNEL_SECRET,
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
};

const client = new line.messagingApi.MessagingApiClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
});

const blobClient = new line.messagingApi.MessagingApiBlobClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
});

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const pendingPlaces = {};

app.post('/webhook', line.middleware(lineConfig), async (req, res) => {
  res.sendStatus(200);
  const events = req.body.events;
  for (const event of events) {
    await handleEvent(event);
  }
});

async function getOrCreateUser(userId) {
  // upsert user by line_user_id, return their UUID
  const { data, error } = await supabase
    .from('users')
    .upsert({ line_user_id: userId }, { onConflict: 'line_user_id' })
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
}

async function handleEvent(event) {
  if (event.type !== 'message') return;

  const userId = event.source.userId;

  // 處理圖片訊息
  if (event.message.type === 'image') {
    await handleImage(event, userId);
    return;
  }

  if (event.message.type !== 'text') return;

  const text = event.message.text.trim();

  // 確認儲存
  if (text === 'OK') {
    const place = pendingPlaces[userId];
    if (!place) return;

    const { error } = await supabase.from('places').insert([place]);
    if (error) {
      await client.replyMessage({
        replyToken: event.replyToken,
        messages: [{ type: 'text', text: '❌ Save failed: ' + error.message }],
      });
      return;
    }

    delete pendingPlaces[userId];
    await client.replyMessage({
      replyToken: event.replyToken,
      messages: [{ type: 'text', text: '✅ Saved: ' + place.name + ' (' + place.category + ' / ' + place.region + ')' }],
    });
    return;
  }

  // 其他文字
  await client.replyMessage({
    replyToken: event.replyToken,
    messages: [{ type: 'text', text: 'Please send a screenshot of the place you want to save.' }],
  });
}

async function handleImage(event, userId) {
  try {
    // 1. 取得或建立 user，拿到 UUID
    const userUuid = await getOrCreateUser(userId);

    // 2. 下載 LINE 圖片
    const imageBuffer = await downloadLineImage(event.message.id);

    // 3. 上傳到 Supabase Storage
    const fileName = 'screenshot_' + userId + '_' + Date.now() + '.jpg';
    const { error: uploadError } = await supabase.storage
      .from('screenshots')
      .upload(fileName, imageBuffer, { contentType: 'image/jpeg' });

    if (uploadError) throw uploadError;

    // 4. 取得公開 URL
    const { data: urlData } = supabase.storage
      .from('screenshots')
      .getPublicUrl(fileName);
    const imageUrl = urlData.publicUrl;

    // 5. 回覆等待訊息
    await client.replyMessage({
      replyToken: event.replyToken,
      messages: [{ type: 'text', text: 'Analyzing screenshot... please wait.' }],
    });

    // 6. 傳給 Gemini Vision 分析
    const base64Image = imageBuffer.toString('base64');

    const result = await genAI.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType: 'image/jpeg',
                data: base64Image,
              },
            },
            {
              text:
                'This is a screenshot from Instagram or Threads showing a place (restaurant, cafe, attraction, etc.).\n' +
                'Extract the place information from the image. Keep the place name and address in their original language (Traditional Chinese if applicable).\n' +
                'Reply ONLY with this JSON format, no extra text or markdown:\n\n' +
                '{\n' +
                '  "name": "place name in original language",\n' +
                '  "category": "food|cafe|attraction|accommodation|other",\n' +
                '  "region": "north|central|south|east|unknown",\n' +
                '  "address": "full address if visible in the image, or empty string",\n' +
                '  "note": "brief description of the place"\n' +
                '}',
            },
          ],
        },
      ],
    });

    const raw = result.text.trim().replace(/```json|```/g, '').trim();
    const info = JSON.parse(raw);

    // 7. 暫存待確認（saved_by 用 UUID）
    // 地址轉座標
let lat = null, lng = null;
const query = info.address || info.name;
try {
  const geoRes = await fetch(
    'https://maps.googleapis.com/maps/api/geocode/json?address=' +
    encodeURIComponent(query + ' 台灣') +
    '&key=' + process.env.GOOGLE_MAPS_KEY
  );
  const geoData = await geoRes.json();
  if (geoData.results && geoData.results.length > 0) {
    lat = geoData.results[0].geometry.location.lat;
    lng = geoData.results[0].geometry.location.lng;
  }
} catch (e) {
  console.error('Geocoding failed:', e);
}

pendingPlaces[userId] = {
  name: info.name,
  category: info.category,
  region: info.region,
  note: info.note,
  address: info.address,
  image_url: imageUrl,
  source_type: 'screenshot',
  saved_by: userUuid,
  status: 'want-to-go',
  lat,
  lng,
};


    const replyMsg =
      '📍 地點資訊：\n\n' +
      '名稱：' + info.name + '\n' +
      '類型：' + info.category + '\n' +
      '地區：' + info.region + '\n' +
      '地址：' + (info.address || '—') + '\n' +
      '備註：' + info.note + '\n\n' +
      '回覆「OK」儲存，或直接告訴我要修改的資訊。';

    await client.pushMessage({
      to: userId,
      messages: [{ type: 'text', text: replyMsg }],
    });

  } catch (err) {
    console.error(err);
    await client.pushMessage({
      to: userId,
      messages: [{ type: 'text', text: '❌ Error: ' + err.message }],
    });
  }
}

async function downloadLineImage(messageId) {
  const stream = await blobClient.getMessageContent(messageId);
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

app.get('/', (req, res) => res.send('Pocket Map Bot is running!'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Server running on port ' + PORT));
