require('dotenv').config();
const express = require('express');
const line = require('@line/bot-sdk');
const { GoogleGenAI } = require("@google/genai");
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

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
    await supabase.from('places').insert([place]);
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
    // 1. 下載 LINE 圖片
    const imageBuffer = await downloadLineImage(event.message.id);

    // 2. 上傳到 Supabase Storage
    const fileName = 'screenshot_' + userId + '_' + Date.now() + '.jpg';
    const { error: uploadError } = await supabase.storage
      .from('screenshots')
      .upload(fileName, imageBuffer, { contentType: 'image/jpeg' });

    if (uploadError) throw uploadError;

    // 3. 取得公開 URL
    const { data: urlData } = supabase.storage
      .from('screenshots')
      .getPublicUrl(fileName);
    const imageUrl = urlData.publicUrl;

    // 4. 傳給 Gemini Vision 分析
    await client.replyMessage({
      replyToken: event.replyToken,
      messages: [{ type: 'text', text: 'Analyzing screenshot... please wait.' }],
    });

    const base64Image = imageBuffer.toString('base64');

    const result = await genAI.models.generateContent({
      model: 'gemini-2.0-flash',
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
                'Extract the place information from the image.\n' +
                'Reply ONLY with this JSON format, no extra text or markdown:\n\n' +
                '{\n' +
                '  "name": "place name",\n' +
                '  "category": "food|cafe|attraction|accommodation|other",\n' +
                '  "region": "north|central|south|east|unknown",\n' +
                '  "note": "brief description of the place"\n' +
                '}',
            },
          ],
        },
      ],
    });

    const raw = result.text.trim().replace(/```json|```/g, '').trim();
    const info = JSON.parse(raw);

    // 5. 暫存待確認
    pendingPlaces[userId] = {
      name: info.name,
      category: info.category,
      region: info.region,
      note: info.note,
      image_url: imageUrl,
      source_type: 'screenshot',
      saved_by: userId,
      status: 'want-to-go',
    };

    const replyMsg =
      '📍 Place info:\n\n' +
      'Name: ' + info.name + '\n' +
      'Category: ' + info.category + '\n' +
      'Region: ' + info.region + '\n' +
      'Note: ' + info.note + '\n\n' +
      'Reply "OK" to save, or correct any info.';

    await client.pushMessage({
      to: userId,
      messages: [{ type: 'text', text: replyMsg }],
    });

  } catch (err) {
    console.error(err);
    await client.pushMessage({
      to: userId,
      messages: [{ type: 'text', text: 'Analysis failed. Please try again.' }],
    });
  }
}

async function downloadLineImage(messageId) {
  const response = await blobClient.getMessageContent(messageId);
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}


app.get('/', (req, res) => res.send('Pocket Map Bot is running!'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Server running on port ' + PORT));
