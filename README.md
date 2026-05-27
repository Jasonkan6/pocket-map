# Pocket Map

A LINE chatbot that saves places from Instagram/Threads screenshots to an interactive personal map.

一個 LINE 聊天機器人，讓你把 Instagram / Threads 的地點截圖存成個人互動地圖。

---

## How It Works / 使用方式

1. Send a screenshot of a place post from Instagram or Threads to the LINE bot.
2. Gemini AI extracts the place name, category, region, address, and a brief note.
3. The place is automatically geocoded and saved to your map.
4. Open the LIFF map to browse, filter by category, and find nearby parking.

---

1. 在 LINE 傳送 Instagram 或 Threads 地點貼文的截圖給機器人。
2. Gemini AI 自動辨識地點名稱、分類、地區、地址與簡介。
3. 系統自動進行地理編碼並存入地圖。
4. 開啟 LIFF 地圖即可瀏覽、依分類篩選，並搜尋附近停車場。

---

## Tech Stack / 技術架構

| Layer | Technology |
|---|---|
| Backend | Node.js + Express |
| Bot Platform | LINE Messaging API |
| AI Vision | Google Gemini 2.5 Flash |
| Database & Storage | Supabase (PostgreSQL + Storage) |
| Maps | Google Maps API (Geocoding, Places, JS Maps) |
| Frontend | LINE LIFF + Vanilla JS |

---

## Project Structure / 專案結構

```
pocket-map/
├── index.js            # Express server, LINE webhook, image processing pipeline
├── web/
│   └── index.html      # LIFF frontend — interactive map with filters and parking finder
├── test-geocoding.js   # Standalone geocoding API tester
├── package.json
└── .env.example        # Environment variable template
```

---

## Prerequisites / 事前準備

- [LINE Developers](https://developers.line.biz/) account — Messaging API channel
- Google Cloud project with **Gemini API** and **Maps JavaScript API / Geocoding API / Places API** enabled
- [Supabase](https://supabase.com/) project with the tables below and a `screenshots` storage bucket
- Node.js 18+

---

## Database Schema / 資料庫結構

### `users`
| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| line_user_id | text | Unique, LINE user ID |

### `places`
| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| name | text | Place name (original language) |
| category | text | `food` / `cafe` / `attraction` / `accommodation` / `other` |
| region | text | `north` / `central` / `south` / `east` / `unknown` |
| address | text | Full address if available |
| note | text | Brief description |
| image_url | text | Public URL of the uploaded screenshot |
| source_type | text | e.g. `screenshot` |
| source_url | text | Original post URL (optional) |
| saved_by | uuid | FK → users.id |
| status | text | e.g. `want-to-go` |
| lat | float8 | Latitude |
| lng | float8 | Longitude |
| created_at | timestamptz | Auto-set |

---

## Environment Variables / 環境變數

Copy `.env.example` to `.env` and fill in all values.

複製 `.env.example` 為 `.env` 並填入所有值。

| Variable | Description |
|---|---|
| `LINE_CHANNEL_SECRET` | LINE channel secret |
| `LINE_CHANNEL_ACCESS_TOKEN` | LINE channel access token |
| `GEMINI_API_KEY` | Google Gemini API key |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_KEY` | Supabase service role or publishable key |
| `GOOGLE_MAPS_KEY` | Google Maps API key (Geocoding + Places) |
| `PORT` | Server port (optional, default `3000`) |

---

## Setup & Running / 安裝與執行

```bash
# 1. Install dependencies / 安裝套件
npm install

# 2. Configure environment / 設定環境變數
cp .env.example .env
# Edit .env with your keys

# 3. Start the server / 啟動伺服器
npm start
```

---

## LINE Webhook Setup / LINE Webhook 設定

1. In the LINE Developers Console, set the Webhook URL to:
   `https://<your-domain>/webhook`
2. Enable **Use webhook**.
3. Disable **Auto-reply messages** and **Greeting messages** in LINE Official Account Manager.

---

1. 在 LINE Developers Console 將 Webhook URL 設為 `https://<your-domain>/webhook`
2. 啟用「使用 Webhook」。
3. 在 LINE 官方帳號管理頁面關閉「自動回覆訊息」與「加入好友的歡迎訊息」。

---

## LIFF Frontend Setup / LIFF 前端設定

1. Create a LIFF app in the LINE Developers Console (Full screen, any URL).
2. In `web/index.html`, update the constants at the top of the `<script>` block:
   ```js
   const SUPABASE_URL = "https://your-project.supabase.co";
   const SUPABASE_KEY = "your-supabase-publishable-key";
   const LIFF_ID     = "your-liff-id";
   const MAPS_KEY    = "your-google-maps-api-key";
   ```
3. Host `web/index.html` on any static hosting (GitHub Pages, Vercel, etc.) and set that URL as the LIFF endpoint URL.

---

1. 在 LINE Developers Console 建立 LIFF 應用程式（Full screen）。
2. 在 `web/index.html` 頂部的 `<script>` 中更新四個常數。
3. 將 `web/index.html` 部署到靜態主機（GitHub Pages、Vercel 等），並將該網址設為 LIFF Endpoint URL。
