require('dotenv').config();
const express = require('express');
const line = require('@line/bot-sdk');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { createClient } = require('@supabase/supabase-js');

const app = express();

const lineConfig = {
  channelSecret: process.env.LINE_CHANNEL_SECRET,
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
};

const client = new line.messagingApi.MessagingApiClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

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
  if (event.type !== 'message' || event.message.type !== 'text') return;

  const userId = event.source.userId;
  const text = event.message.text.trim();

  if (text === 'OK') {
    const place = pendingPlaces[userId];
    if (!place) return;
    await supabase.from('places').insert([place]);
    delete pendingPlaces[userId];
    await client.replyMessage({
      replyToken: event.replyToken,
      messages: [{ type: 'text', text: '[Saved] ' + place.name + ' (' + place.category + ' / ' + place.region + ')' }],
    });
    return;
  }

  const urlMatch = text.match(/https?:\/\/(www.)?(instagram.com|threads.net)\S+/);
  if (!urlMatch) {
    await client.replyMessage({
      replyToken: event.replyToken,
      messages: [{ type: 'text', text: 'Please send an IG or Threads link.' }],
    });
    return;
  }

  const url = urlMatch[0];

  await client.replyMessage({
    replyToken: event.replyToken,
    messages: [{ type: 'text', text: 'Analyzing… please wait.' }],
  });

  try {
    const prompt =
      'This is an IG or Threads link: ' + url + '\n\n' +
      'Based on the URL (username, keywords, etc.), guess what kind of place this might be. ' +
      'Reply ONLY with this JSON format, no extra text or markdown:\n\n' +
      '{\n' +
      '  "name": "guessed place name (use unknown if unsure)",\n' +
      '  "category": "food|cafe|attraction|accommodation|other",\n' +
      '  "region": "north|central|south|east|unknown",\n' +
      '  "note": "brief reason for this guess"\n' +
      '}';

    const result = await model.generateContent(prompt);
    const raw = result.response.text().trim().replace(/```json|```/g).trim();
    const info = JSON.parse(raw);

    pendingPlaces[userId] = {
      name: info.name,
      category: info.category,
      region: info.region,
      note: info.note,
      source_url: url,
      source_type: url.includes('instagram') ? 'IG' : 'Threads',
      saved_by: userId,
      status: 'want-to-go',
    };

    const replyMsg =
      'Place info:\n\n' +
      'Name: ' + info.name + '\n' +
      'Category: ' + info.category + '\n' +
      'Region: ' + info.region + '\n' +
      'Note: ' + info.note + '\n\n' +
      'Correct? Reply "OK" to save, or tell me the right name.';

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

app.get('/', (req, res) => res.send('Pocket Map Bot is running!'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Server running on port ' + PORT));
