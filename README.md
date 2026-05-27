# 兩人的回憶地圖 — Project Planning v2

> 一個只有你們兩個人能看見的世界

-----

## 產品命名

|**Twogether**   |直白、品牌感|Two + Together，兩人共行|

## 一、產品定位

### 一句話

> **兩個人的回憶地圖 — 把你們存過的所有想去、和真正去過的瞬間，種成一片只屬於你們的世界。**

### 核心隱喻

地圖是土地。地點是種子。每次造訪、每張照片是養分。久了，地點會「茂盛」起來。整張地圖就是你們關係的可視化。

### 產品哲學

|我們是       |我們不是       |
|----------|-----------|
|兩人陪伴的載體   |社群平台       |
|回憶累積的地方   |內容創作工具     |
|溫柔的、慢的、私密的|焦慮的、爆款的、公開的|
|一個工具，附帶情感 |一個遊戲       |

### 目標用戶

- 主：21-35 歲情侶
- 次：好友、家人（Phase 2 後考慮）
- pilot：先 2 人（你跟伴侶），目標公開產品

-----

## 二、整體生態：兩個入口、一個資料庫

```
平日場景（滑 IG/Threads 看到想去的）
        ↓
   LIFF Web App（既有）
   截圖 → AI 萃取 → 存地點
        ↓
   ┌────────────────────┐
   │  Supabase（共用）  │
   └────────────────────┘
        ↑
   旅遊場景（在現場拍照）
        ↑
   Footnote App（新開發）
   GPS 拍照 → 地點長樹 → 回顧
```

**兩個入口、不同場景、共用資料。**

-----

## 三、完整功能清單（14 個功能）

### A. 基礎建設

|編號|名稱       |簡述                       |
|--|---------|-------------------------|
|A1|用戶系統 + 配對|註冊登入、兩人綁定為 Couple        |
|A2|地圖主頁     |全螢幕 Google Maps，所有地點 pin |
|A3|照片上傳     |拍照 → 上傳 Supabase Storage |
|A4|地點資料整合   |沿用 Pocket Map 既有 places 表|

### B. 核心記錄

|編號|名稱       |簡述                 |
|--|---------|-------------------|
|B1|GPS 拍照   |拍照當下抓座標，綁定附近地點     |
|B2|即興地點     |不在預存地點時自動建立新地點     |
|B3|配對拍照（簡化版）|兩人各自拍一張，標記為「同一刻雙視角」|

### C. 視覺化

|編號|名稱       |簡述              |
|--|---------|----------------|
|C1|回憶樹 / 茂盛度|地點根據累積資料呈現不同視覺狀態|
|C2|已造訪 / 未造訪|想去清單 vs 去過視覺區隔  |

### D. AI 智能

|編號|名稱            |簡述              |
|--|--------------|----------------|
|D1|AI Smart Nudge|在地點時偶爾建議拍什麼類型的照片|

### E. 互動巧思

|編號|名稱   |簡述                          |
|--|-----|----------------------------|
|E1|延遲投放 |留禮物（語音/照片/文字）給對方下次到此打開      |
|E2|單人模式 |一個人去時可標記「對方不在」，獨立 collection|
|E3|未探索推薦|高亮存了沒去、或附近沒踏足過的區域           |

### F. 既有入口

|編號|名稱             |簡述            |
|--|---------------|--------------|
|F1|LIFF Web App 維持|既有 IG 截圖入口繼續運作|

-----

## 四、技術架構

### 技術棧

|層級       |技術                            |備註                                    |
|---------|------------------------------|--------------------------------------|
|App      |React Native + Expo           |雲端建置 EAS，不需 Mac                       |
|狀態管理     |Zustand 或 React Query         |輕量                                    |
|後端       |Node.js + Express（沿用）         |Railway                               |
|DB       |Supabase PostgreSQL（沿用）       |加新表                                   |
|檔案儲存     |Supabase Storage（沿用）          |screenshots bucket + 新增 moments bucket|
|AI       |Gemini 2.5 Flash Vision（沿用）   |圖片分析 + Smart Nudge                    |
|地圖       |Google Maps SDK for RN        |跟 LIFF 端一致                            |
|Geocoding|Google Geocoding API（沿用）      |即興地點                                  |
|認證       |Supabase Auth                 |Apple ID + Email                      |
|即時通訊     |Supabase Realtime（Phase 2 才需要）|暫不用                                   |
|推播       |Expo Notifications            |E1 延遲投放需要                             |

### 登入方式

**Apple ID + Email**

- iOS Expo 整合最直接
- Apple ID 是 App Store 上架要求
- Email 作為備援
- 不用 LINE Login（簡化技術複雜度）
- 既有 Pocket Map 用戶以 Email 對應綁定

-----

### Supabase 資料表（在既有基礎上擴充）

```sql
-- 既有 users 表擴充
users
  id UUID
  line_user_id text          -- 既有，仍保留
  email text                 -- 新增
  apple_user_id text         -- 新增
  display_name text          -- 新增
  avatar_url text             -- 新增
  couple_id UUID → couples.id  -- 新增

-- 新增 couples 表
couples
  id UUID
  user_a_id UUID → users.id
  user_b_id UUID → users.id
  paired_at timestamp
  status text                -- active / disconnected

-- 既有 places 表擴充
places
  ... (既有欄位保留)
  couple_id UUID → couples.id    -- 新增，地點屬於某對 couple
  is_spontaneous boolean         -- 新增，即興地點 flag
  visit_count int                -- 新增，累計造訪次數
  bloom_level int                -- 新增，茂盛度 0-5
  first_visited_at timestamp     -- 新增
  last_visited_at timestamp      -- 新增

-- 新增 moments 表（旅途中的照片）
moments
  id UUID
  place_id UUID → places.id      -- 綁定地點
  user_id UUID → users.id        -- 誰拍的
  couple_id UUID → couples.id
  image_url text
  thumbnail_url text
  lat float8                     -- 拍照當下的座標
  lng float8
  taken_at timestamp
  
  -- AI 分析（沿用 Pocket Map 的 Gemini 流程）
  ai_caption text
  ai_tags text[]
  
  -- 配對拍照
  pair_id UUID                   -- B3 用，兩張照片同一 pair_id
  
  -- 單人模式
  companion_present boolean      -- 對方是否也在
  
  created_at timestamp

-- 新增 gifts 表（延遲投放）
gifts
  id UUID
  sender_id UUID → users.id
  receiver_id UUID → users.id
  place_id UUID → places.id
  content_type text              -- voice / photo / text
  content_url text
  content_text text
  created_at timestamp
  unlocked_at timestamp          -- null 表示還沒拆
  
-- 新增 visits 表（造訪記錄）
visits
  id UUID
  place_id UUID → places.id
  user_id UUID → users.id
  couple_id UUID → couples.id
  visited_at timestamp
  duration_minutes int           -- 停留時間
```

-----

## 五、四階段執行計畫

### 🏗️ Stage 1：地基（2 週）

**目標：** 能登入、能拍照存雲端、地圖能看到地點

|#|功能          |時間 |
|-|------------|---|
|1|A1 用戶系統 + 配對|3 天|
|2|A4 地點資料整合   |1 天|
|3|A2 地圖主頁     |4 天|
|4|A3 照片上傳     |3 天|

**驗收標準：**

- 兩個帳號可各自註冊
- 透過分享連結互相配對
- 拍照能存到雲端
- 地圖能顯示既有 Pocket Map 存的地點

-----

### 🌱 Stage 2：核心循環（2 週）

**目標：** 完整體驗「去現場拍照 → 地點長樹」

|#|功能          |時間 |
|-|------------|---|
|5|B1 GPS 拍照   |3 天|
|6|B2 即興地點     |3 天|
|7|C1 回憶樹視覺化   |5 天|
|8|C2 已造訪 / 未造訪|1 天|

**🎯 Stage 2 結束 = 第一個可測試版本**

**驗收標準：**

- 跟伴侶一起出去玩一次
- 全程用 App 拍照
- 地圖上能看到地點長樹
- 旅程結束後雙方願意打開回顧

**如果這個 Milestone 沒過：** 不要往下做，回頭調整。

-----

### 🎭 Stage 3：差異化功能（2 週）

**目標：** 讓產品有獨家魅力，可開始招 beta 用戶

|# |功能      |時間 |
|--|--------|---|
|9 |E2 單人模式 |2 天|
|10|B3 配對拍照 |4 天|
|11|E3 未探索推薦|3 天|
|12|E1 延遲投放 |7 天|

**為何此排序：**

- E2 最便宜，先做
- B3 是 Threads 行銷的好素材
- E1 最貴最複雜，最後做

**🎯 Stage 3 結束 = 可以開始 Threads 行銷**

-----

### 🤖 Stage 4：AI 加分（1 週）

**目標：** 提升質感

|# |功能               |時間 |
|--|-----------------|---|
|13|D1 AI Smart Nudge|5 天|

**為何最後：** 需要真實使用場景才能調 prompt，沒這個 App 也能用。

-----

### 總時程

|階段                 |內容   |累計    |
|-------------------|-----|------|
|Stage 1            |地基   |2 週   |
|Stage 2            |核心循環 |4 週   |
|Stage 3            |差異化  |6 週   |
|Stage 4            |AI 加分|7 週   |
|緩衝 + bug fix + 設計時間|     |9-10 週|

**現實估算：9-10 週**

-----

## 六、各功能執行細節

### A1. 用戶系統 + 配對

**做什麼：**

- 註冊、登入、兩人綁定

**技術細節：**

- Supabase Auth + Apple ID Sign In + Email
- 配對流程：A 註冊 → 生成 invite link → B 點開 → 自動配對
- 一個帳號只能配對一個 couple（綁定後不能再綁別人）

**坑：**

- 分手怎麼辦：保留資料但可「解除配對」，配對歷史不刪除
- 換手機：以 Apple ID / Email 為準

-----

### A2. 地圖主頁

**做什麼：**

- 全螢幕 Google Maps
- 顯示所有地點 pin（自訂樣式）
- 點 pin → 進入地點詳情頁
- 篩選器：全部 / 想去 / 去過 / 食物 / 咖啡 / 景點 / 住宿

**技術細節：**

- `react-native-maps`
- Custom marker：根據 bloom_level 顯示不同樹的圖
- 地點 > 50 個時開啟 clustering

**坑：**

- iOS 上 Custom marker 效能要小心
- Lottie 動畫 marker 100 個會卡，要降階方案

-----

### A3. 照片上傳

**做什麼：**

- 拍照 → 壓縮 → 上傳 Supabase Storage → 寫入 moments 表

**技術細節：**

- `expo-camera` 拍照
- `expo-image-manipulator` 壓縮成 1920px 寬
- Supabase Storage 直傳
- 同時上傳：原圖 + 800px 縮圖

**坑：**

- 大照片要 chunked upload
- 網路差要有重試機制
- 拍完到上傳完中間要有 UI 反饋

-----

### A4. 地點資料整合

**做什麼：**

- 既有 places 表加上 couple_id 欄位
- App 讀取資料時依 couple_id 過濾
- LIFF 端也要做對應修改

**技術細節：**

- Supabase migration script
- RLS（Row Level Security）必須開啟
- 既有資料 backfill：把現在的 places 都歸到第一對 couple

**坑：**

- Migration 要先在 staging 跑過
- RLS 策略要寫對，不然 App 看不到資料

-----

### B1. GPS 拍照

**做什麼：**

- 拍照當下抓 GPS
- 比對 places 表，半徑 100m 內視為「在地點」
- 自動把 moment 綁到該地點
- 不在 → 進入 B2 即興地點流程

**技術細節：**

- `expo-location` 抓座標（precise accuracy）
- 比對邏輯放後端，前端傳 lat/lng
- 多個地點重疊時：選最近的

**坑：**

- 室內 GPS 飄 → 給用戶手動選地點的選項
- GPS 權限被拒 → fallback 手動選

-----

### B2. 即興地點

**做什麼：**

- 不在預存地點時，自動建一個地點
- 用 Google Geocoding 反查地址當預設名稱
- 用戶可改名、可不改

**技術細節：**

- places.is_spontaneous = true
- UI：拍照後彈出輕量 sheet 讓用戶輸入名字（可跳過）
- 地圖上即興地點用不同顏色 / 圖標

**坑：**

- 兩人同地點同時拍 → 合併為一個地點（不要建兩個）
- 即興地點太多會讓地圖太雜 → 用戶可隱藏未命名地點

-----

### B3. 配對拍照（簡化版）

**做什麼：**

- 兩人面對面，A 在 App 內按「配對拍照」
- 5 分鐘配對視窗內，B 也按同個按鈕
- 兩人各自拍照，被標記為同一 pair_id
- 後期合成（並排、上下、AB切換）

**技術細節：**

- 不需要 WebSocket
- 5 分鐘內兩人都在同一地點 + 都按了配對按鈕 → pair_id 綁定
- 合成：純前端 Canvas / SVG

**坑：**

- 配對 UX：誰先按、誰後按、怎麼確認
- 一方沒按怎麼辦 → 5 分鐘後自動轉為一般拍照

-----

### C1. 回憶樹 / 茂盛度

**做什麼：**

- 每個地點根據以下計算 bloom_level（0-5）：
  
  ```
  bloom_level = f(
    visit_count,           // 訪問次數
    photo_count,           // 累積照片數
    both_visited?,         // 兩人是否都來過
    time_span_days,        // 第一次到最後一次的天數
    has_pair_photo?        // 是否有配對拍照
  )
  ```
- 地圖上 pin 根據 bloom_level 顯示不同視覺

**茂盛度設計：**

|Level|條件示例              |視覺     |
|-----|------------------|-------|
|0    |只是想去（未訪問）         |種子 / 灰色|
|1    |一人來過 1 次          |幼苗     |
|2    |兩人來過，或一人多次        |小樹     |
|3    |多次訪問 + 多張照片       |中樹 + 葉子|
|4    |長期累積 + 配對拍照       |大樹 + 花 |
|5    |高密度回憶（>50 張、>10 次）|茂盛 + 動態|

**坑：**

- **這是視覺核心，做不好整個產品變廉價**
- 設計要早開始（你自己用 AI 工具設計，見第七節）
- 計算公式上線後會 tune，要做成可配置

-----

### C2. 已造訪 / 未造訪

**做什麼：**

- 想去清單（visited = false）vs 去過（visited = true）視覺區隔
- 跟 C1 同一套渲染邏輯

**技術細節：** 跟 C1 整合，1 天工

-----

### D1. AI Smart Nudge

**做什麼：**

- 在地點時，App 偶爾推一個建議
- 例：「這家咖啡廳的拿鐵很有特色，要不要拍一張？」

**觸發邏輯：**

- 用戶在地點停留 > 15 分鐘
- 該地點還沒拍照
- 該地點過去未被 nudge 過
- 不在不適當時機（晚上、移動中）

**內容生成：**

- 後端用 Gemini 2.5 Flash 根據地點類型 + 既有照片建議
- in-app 提示，不用 push notification

**坑：**

- **最容易讓用戶反感**，必須克制 + 可關閉
- 設定頁要有「Smart Nudge 頻率」slider
- Prompt 要迭代，初版可能很爛

-----

### E1. 延遲投放小驚喜

**做什麼：**

- A 在某地點留禮物給 B（語音/照片/文字）
- B 下次到該地點時觸發

**觸發機制：**

- App 開啟時檢查附近有沒有禮物（不用背景定位）
- 或 Geofencing API（iOS 限制 20 個 region，先用前者）

**UX：**

- 通知不顯示內容，只說「他在這裡留了東西給你」
- 點開有「拆封」動畫
- 拆完可回一句語音

**坑：**

- 背景定位耗電 → 用 App 開啟檢查
- 一個地點可放幾個：建議無限但 UI 上只顯示最新一個
- 過期機制：6 個月沒拆自動通知對方

-----

### E2. 單人模式

**做什麼：**

- 一個人拍照時可標記「對方不在」
- 累積成「只有我去過」collection

**自動判斷：**

- 對方 GPS 也在附近（500m）→ 預設「合體」
- 否則 → 預設「對方不在」
- 用戶可手動切換

**坑：**

- 對方沒開 App 怎麼判斷 → 預設「不在」+ 可手動修改
- 隱私：不主動追蹤對方 GPS，只在拍照那一刻 query 對方最近一次位置

-----

### E3. 未探索推薦

**做什麼：**

- 地圖上微微高亮：
  - 存了但沒去過的地點
  - 鄰近從沒踏足的區域

**邏輯：**

- 存了沒去：places.visited = false → 微微脈動發光
- 沒踏足區域：分析 visits 表，找出附近 5km 內從沒去過的 cluster

**坑：**

- 不要全部閃，會干擾
- 「沒踏足區域」邏輯要排除荒山野嶺
- 視覺要克制（subtle，不是 in-your-face）

-----

### F1. LIFF Web App 維持

**做什麼：** 不動，只確認資料相通

**檢查項：**

- LIFF 存的地點，App 讀得到（透過 couple_id）
- App 在 App 內標記的「已造訪」，LIFF 上也能看到
- 兩端 schema 同步

**時間：** 0.5 天

-----

## 七、設計指引（你自己用 AI 工具設計）

你選擇自己設計，這裡是給你的 AI 工具使用建議。

### 推薦 AI 設計工具組合

|用途     |工具                          |為什麼               |
|-------|----------------------------|------------------|
|UI 設計  |**Figma + Figma Make**      |業界標準 + AI 輔助生成 UI |
|圖示 / 插圖|**Midjourney / Nano Banana**|自訂風格的插圖           |
|回憶樹視覺  |**Midjourney + Photoshop**  |需要 5 個 level 的一致系列|
|快速原型   |**v0.dev**                  |文字描述生成 UI         |
|動畫     |**LottieFiles + AI 工具**     |樹生長動畫             |

### 風格定調建議

從「兩人陪伴」「回憶累積」「溫柔不焦慮」的定位推導：

|元素|建議                                        |
|--|------------------------------------------|
|色調|暖色系，避免高飽和；參考奶油白 + 木質棕 + 微淡綠               |
|字體|圓潤襯線（Noto Serif / Source Han Serif）+ 簡潔無襯線|
|風格|手繪感、紙本感，避免 SaaS 風的扁平科技感                   |
|動效|慢、緩、有呼吸感，避免快速 bounce                      |
|參考|動森、Day One、Polarsteps、Apple Memories      |

### 回憶樹的設計挑戰

這是整個產品的視覺靈魂，最值得花時間：

**5 個階段需要一致風格：**

1. 種子（未訪問）
1. 幼苗（初次）
1. 小樹
1. 開花
1. 茂盛

**建議流程：**

1. Midjourney 先生 reference：`isometric tiny tree growing through 5 stages, watercolor illustration, soft pastel, japanese aesthetic, transparent background`
1. 挑一組風格一致的
1. Photoshop / Figma 微調
1. 輸出成 SVG 或 Lottie

-----

## 八、Pocket Map（LIFF）與 Footnote（App）的關係

|維度  |LIFF Web                      |Footnote App|
|----|------------------------------|------------|
|場景  |平日滑 IG 看到想去的                  |旅途中、回家後     |
|入口  |LINE Bot 截圖                   |App 開啟      |
|主功能 |截圖 → 存地點                      |拍照 → 長樹 → 回顧|
|維護成本|低（已完成）                        |主開發         |
|用戶感知|Pocket Map 是 Footnote 的「存地點」助手|主產品         |

**未來可能：** 把 LIFF 功能整合進 App（in-app 截圖分析），廢棄 LINE 入口。但這是 Phase 3 才考慮。

-----

## 九、階段性驗證指標

每個 Stage 結束都要回答這些問題，回答不出來就不要往下做。

### Stage 2 結束（核心循環完成）

|問題        |驗證方法       |通過標準              |
|----------|-----------|------------------|
|拍照流程順暢嗎？  |真實旅行測試     |旅程中 80%+ 照片用 App 拍|
|GPS 綁定準確嗎？|抽樣 20 張    |正確綁定率 > 80%       |
|回憶樹有感染力嗎？ |給朋友看反應     |5 人裡 3 人說「想要」     |
|願意再用嗎？    |旅行後 7 天再次打開|至少 1 次            |

### Stage 3 結束（差異化完成）

|問題              |驗證方法  |通過標準         |
|----------------|------|-------------|
|配對拍照有人想用嗎？      |統計使用次數|每次旅行至少 1 次   |
|延遲投放被觸發嗎？       |統計拆禮物率|> 50% 禮物被拆   |
|內容適合發 Threads 嗎？|自己發一篇 |互動 > 一般貼文 2 倍|

### Stage 4 結束（AI 加分完成）

|問題               |驗證方法|通過標準         |
|-----------------|----|-------------|
|Smart Nudge 不煩人嗎？|用戶反饋|< 10% 用戶關閉此功能|
|建議精準嗎？           |採納率 |> 30% 建議被用戶採納|

-----

## 十、風險清單

|風險             |機率|影響   |對策              |
|---------------|--|-----|----------------|
|室內 GPS 不準      |高 |中    |Fallback 手動選地點  |
|回憶樹視覺做不好       |中 |**高**|提早設計、找參考        |
|配對拍照 UX 不直覺    |中 |中    |Stage 2 結束後使用者測試|
|延遲投放耗電         |中 |中    |改用 App 開啟時檢查    |
|Smart Nudge 被反感|高 |中    |預設保守 + 可關閉      |
|一個人做不完         |高 |高    |嚴守階段範圍，砍功能不延期   |
|伴侶測試不配合        |中 |高    |提前溝通            |

-----
## 附錄：開放議題（之後決定）

- [ ] 商業模式（免費 / 訂閱 / 一次買斷）
- [ ] App 名字最終定案
- [ ] 圖示與品牌色
- [ ] 是否上 Android（先 iOS 還是雙平台）
- [ ] Beta 測試怎麼從 2 人擴展到 20 人
- [ ] 跟 Pocket Map LIFF 是否最終合併
- [ ] 隱私政策、服務條款（上架前必做）
