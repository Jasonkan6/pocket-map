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

// Batch upload 狀態管理
const batchState = {};
// 結構: { [userId]: { total, processed, success, failed, timer, batchEnded } }

function startBatchEntry(userId) {
  if (!batchState[userId]) {
    batchState[userId] = {
      total: 0,
      processed: 0,
      success: 0,
      failed: 0,
      timer: null,
      batchEnded: false,
    };
  }
  const state = batchState[userId];
  state.total += 1;
  const myIdx = state.total;

  // 每次新圖進來，重置「批次結束」計時器
  if (state.timer) clearTimeout(state.timer);
  state.timer = setTimeout(() => {
    state.batchEnded = true;
    maybeSendSummary(userId);
  }, 3000);

  return { state, idx: myIdx };
}

async function maybeSendSummary(userId) {
  const state = batchState[userId];
  if (!state) return;
  // 必須兩個條件都成立：批次結束 + 所有圖都處理完
  if (!state.batchEnded) return;
  if (state.processed < state.total) return;

  if (state.total > 1) {
    await client.pushMessage({
      to: userId,
      messages: [{
        type: 'text',
        text: '🎉 完成！成功儲存 ' + state.success + '/' + state.total + ' 個地點'
          + (state.failed > 0 ? '\n⚠️ ' + state.failed + ' 個失敗或略過' : '')
      }],
    });
  }
  delete batchState[userId];
}




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

  // 其他文字
  await client.replyMessage({
    replyToken: event.replyToken,
    messages: [{ type: 'text', text: 'Please send a screenshot of the place you want to save.' }],
  });
}

async function handleImage(event, userId) {
  // 1. 加入 batch 計數
  const { state: batch, idx } = startBatchEntry(userId);


  try {
    // 2. 取得或建立 user
    const userUuid = await getOrCreateUser(userId);

    // 3. 下載 LINE 圖片
    const imageBuffer = await downloadLineImage(event.message.id);

    // 4. 上傳到 Supabase Storage
    const fileName = 'screenshot_' + userId + '_' + Date.now() + '_' + idx + '.jpg';
    const { error: uploadError } = await supabase.storage
      .from('screenshots')
      .upload(fileName, imageBuffer, { contentType: 'image/jpeg' });
    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage
      .from('screenshots')
      .getPublicUrl(fileName);
    const imageUrl = urlData.publicUrl;

    // 5. Gemini 分析
    const base64Image = imageBuffer.toString('base64');
    const result = await genAI.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{
        role: 'user',
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
          { text:
            'This is a screenshot from Instagram or Threads showing a place (restaurant, cafe, attraction, etc.).\n' +
            'Extract the place information from the image. Keep the place name and address in their original language (Traditional Chinese if applicable).\n' +
            'Reply ONLY with this JSON format, no extra text or markdown:\n\n' +
            '{\n' +
            '  "name": "place name in original language",\n' +
            '  "category": "food|cafe|attraction|accommodation|other",\n' +
            '  "region": "north|central|south|east|unknown",\n' +
            '  "address": "full address if visible in the image, or empty string",\n' +
            '  "note": "brief description of the place"\n' +
            '}'
          },
        ],
      }],
    });

    const raw = result.text.trim().replace(/```json|```/g, '').trim();
    let info;
    try {
      info = JSON.parse(raw);
    } catch {
      throw new Error('AI 解析失敗');
    }

    // 6. Geocoding
    let lat = null, lng = null;
    async function tryGeocode(query) {
      const url =
        'https://maps.googleapis.com/maps/api/geocode/json?address=' +
        encodeURIComponent(query + ' 台灣') +
        '&key=' + process.env.GOOGLE_MAPS_KEY;
      const res = await fetch(url);
      const data = await res.json();
      const r = data.results?.[0];
      if (r && r.geometry.location_type !== 'APPROXIMATE') {
        return { lat: r.geometry.location.lat, lng: r.geometry.location.lng };
      }
      return null;
    }
    if (info.address) {
      const r1 = await tryGeocode(info.address);
      if (r1) { lat = r1.lat; lng = r1.lng; }
    }
    if (lat === null && info.name) {
      const r2 = await tryGeocode(info.name);
      if (r2) { lat = r2.lat; lng = r2.lng; }
    }

    // 7. 直接存入 Supabase（不需要 OK 確認）
    const { error: insertError } = await supabase.from('places').insert([{
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
    }]);
    if (insertError) throw insertError;

    // 8. 回報這張圖的結果
    batch.success += 1;
    batch.processed += 1;
    await client.pushMessage({
      to: userId,
      messages: [{
        type: 'text',
        text: '[' + idx + '] ✅ ' + info.name + '（' + info.category + '/' + info.region + '）'
          + (lat === null ? '\n⚠️ 找不到座標' : '')
      }],
    });
    maybeSendSummary(userId);

    } catch (err) {
    batch.failed += 1;
    batch.processed += 1;
    console.error('handleImage error:', err);
    await client.pushMessage({
      to: userId,
      messages: [{ type: 'text', text: '[' + idx + '] ❌ 失敗：' + err.message }],
    });
    maybeSendSummary(userId);
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
