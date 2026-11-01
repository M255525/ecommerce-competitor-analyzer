# AI 電商競品分析系統（ecommerce-competitor-analyzer）

輸入「我的商品」＋ 1～8 個競品（品牌名、售價、評分、評論數、特色、評論摘錄；可貼商品連結自動填入）→ 六個分頁：總覽、價格分析、商品特色矩陣、競品優缺點、產品定位圖、銷售策略（含 30 天行動計畫）→ PDF／Markdown／JSON。純前端靜態網站，本機 port **8843**（`python -m http.server 8843`，已登記在工作區 `.claude/launch.json`）。2026-11-01 起有登入序號閘門（整個工具鎖住）。

## 檔案
- `index.html`：全部 UI 與邏輯（單一 IIFE：規則引擎、AI、設定、歷史、PDF、跑馬燈、PWA、關於／警語彈窗）。
- `data.js`：`window.ECA` = 品類桶 `CATEGORIES`＋`classify()`、34 類特色詞庫 `FEATURES`（含構面 `DIMS`）、評論面向 `ASPECTS`、正負詞 `POS`/`NEG`、平台 `PLATFORMS`（預設費率＋操作建議）、四象限 `QUADRANTS`（定價／促銷／評論經營／風險模板）、文案模板 `COPY_TPL`、6 組虛構範例 `SAMPLES`。**調整詞庫或文案只改這個檔**。
- `manual.html`（含完整版創作者區塊 `#creator`）、`manifest.json`、`service-worker.js`（network-first）、`icons/`（PIL 產生）、`watermark.png`（沿用 business-model-pattern-studio）。

## 登入序號閘門（2026-11-01）
比照 skill-prompt-studio：`#entryGate` 全螢幕擋住整個工具，驗證通過才加 `.hidden`；script 在 `</body>` 前獨立 IIFE（`window.__ecaGate`）。
- 序號表：共用試算表「跨境電商工具」（`1sUrMVQ7T3_JOG_vMY1peGWxxxbw8PTxbbXBhj2IPM6s`）的分頁 **「AI 電商競品分析系統」**（同試算表的「文字雲」「PPC序號」分頁屬於其他工具、各有自己的綁定腳本）。表頭比對「序號／開始日期／結束日期」，12 個月；選填「人數限制」「目前登入人數」欄（同時登入上限，只在登入當下把關，`renew:true` 背景重驗不踢人；40 分鐘逾時；pagehide sendBeacon 釋出）。
- 後端 `gas/Code.js`＋`gas/appsscript.json`（webapp ANYONE_ANONYMOUS）；`SHEET_NAME` 固定，分頁不存在回 server_error，**不退回第一個分頁**。clasp scriptId `1FiC3rmgdQLCt4m2aRUx7A9c4H_klNLlTc7lkFgTjNqJ6PUquqc8tvPAt`（`.clasp.json` 不進版控）；改後端：`cd gas && clasp push --force && clasp deploy -i AKfycbxyRpoNLkgJ1kkiEiixb_iHe4b6yCJ3vOd4HIZbAJUZwezRdjpDV-ksTLCAtRPM02VL`（更新既有部署，網址不變）。
- 前端：`LICENSE_CHECK_URL` 即上述部署；localStorage `ecaEntrySerial`／`ecaEntryClientId`（刻意不用 `ecaStudio.` 前綴，「清除本機資料」不會把人登出）；頂部 `#headcountChip`、⚙ 常用設定「🔐 登入序號」區塊（`#licBadge`／`#headcountBadge`／`#btnLogout`）。每 20 分鐘背景重驗、開 ⚙ 時重驗。
- ⚠ 純前端閘門，懂 DevTools 的人可移除遮罩；本工具邏輯全在前端，這是已知取捨。

## 規則式引擎（確定性，同輸入同輸出）
- 特色：特色欄＋商品名比對 `FEATURES.kw`；比對不到的 token 列為「其他未歸類特色」（價值分數權重 0.5）。
- 矩陣分類：市場基本要求＝競品具備率 ≥60%（只有 1 個競品時需 100%）；差異點＝只有我有；缺口＝我沒有且競品具備率 ≥50%。
- 評論：依標點切句，`polarity()` 正負詞計分（前 2 字有「不／沒／無」就反轉；「沒有X」無負面詞時判負面），`aspectOf()` 取句中**最早出現**的面向關鍵字。
- 價值分數＝特色豐富度 55%＋評分 30%（我方未填評分時用競品中位數）＋評論數 15%（log）。
- 定位：價格與價值分數各以中位數切四象限（精品型／CP 值型／入門型／高價低值）。
- 建議售價區間由象限決定，下限不低於「成本 ÷ (1－平台費－15%)」。**價格統計、毛利、座標、建議區間一律前端計算，不採用 AI 數字。**

## AI（BYOK）
`callLLM`／`extractJsonObject`／模型清單沿用 business-model-pattern-studio。兩種呼叫：
- `aiFill()`：只有品牌名時推測價格／評分／評論數／特色／評論，只填空欄，逐欄標 `comp.ai[k]`（UI 顯示「AI 推測」，使用者手改後自動移除）。
- `aiAnalyze(sections)`：sections ⊂ `summary/proscons/position/strategy`；`validatePatch()` 逐欄驗證，不合格沿用規則式並在狀態列列出；結果存成 `state.aiPatch`，重新分析時以 `applyAiPatch()` 疊回（歷史紀錄也存 patch 而非整份結果）。

## 商品連結自動填入（2026-11-01）
我的商品 `#mUrl`＋每個競品 `comp.url`（`data-k="url"`）各有「🔗 自動填入」（`data-urlfill="me"|索引`），另有「🔗 依連結自動填入全部」`#urlFillAllBtn`。程式在 index.html「商品連結自動填入」段：
- `parseProductUrl()`：免金鑰，只從網址辨識平台（shopee／momo／pchome／amazon）、幣別（`URL_CUR` 依網域）、商品名稱（蝦皮 `名稱-i.店.品`、Amazon `/名稱/dp/ASIN`）。
- `callLLMWeb()`：有金鑰時交給使用者的 AI 讀頁：Claude `web_fetch`（Opus/Sonnet 4.6+ 用 `web_fetch_20260209`，其他用 `web_fetch_20250910`，無 beta header，處理 `pause_turn` 續送、`web_fetch_tool_result` 錯誤物件）、Gemini `tools:[{url_context:{}}]`（看 `urlContextMetadata` 狀態）、OpenAI **Responses API** `tools:[{type:'web_search'}]`、OpenRouter `plugins:[{id:'web'}]`。**本工具自己不連線電商網站**（GitHub Pages 也做不到，CORS）。
- `applyUrlData()`：**只填空白欄位**；`readable:false` 時一律不採用頁面值；頁面幣別≠表單幣別時售價留空（不換匯）。讀不到的欄位依 `settings.urlMissing`（`#urlMissing`）：`blank` 留空（預設）／`guess` AI 推測並列入 `guessed`。
- 來源標記沿用 `comp.ai[k]`：`'url'`＝從頁面讀到（顯示 🔗 連結，結果表 `aiTag()` 不標 AI）；`1`＝AI 推測。
- 蝦皮等網站常擋機器讀取，實際能讀到多少依服務商而定；尚未用真實金鑰測過（只用攔截 fetch 的模擬回應測過四種情境）。

## 幣別
`CURRENCIES`（index.html）13 種，`dec` 決定小數位；表單 `#mCurrency` 存在 `input.me.currency`（舊紀錄沒有此欄位＝TWD），設定 `settings.currency` 只是新表單預設。`money()` 依 `activeCur` 加幣別符號；`roundPrice()` 有小數幣別取到 0.5／整數。**切換幣別只換顯示，不做匯率換算。**

## RWD
斷點 900px（平板：表單 2 欄、KPI 3 欄）與 560px（手機：表頭按鈕 3 欄格、表單 1 欄、輸入 16px 防 iOS 縮放、分頁單行可滑動、價格表 `table.cards` 轉卡片、特色矩陣第一欄 sticky、圖表 `.chart-wrap` 最小 540px 可橫滑、彈窗貼底）。分頁列 `.tabs` sticky（有跑馬燈時 top:30px）。A4 列印寬度會落在 ≤900 斷點，但列印只顯示 `#printReport`，不受影響。

## ⚙ 常用設定（收合式）
6 個 `<details class="set-sec" data-sec>`：ai／defaults／display／pdf／data／about；summary 右側 `.ssv` 由 `updateSetSummaries()` 顯示目前值（`saveSettings()` 會觸發）。展開狀態存 `ecaStudio.setOpen`；`openSettings(true, 'ai')` 可直接打開指定區塊（沒填金鑰時用）。**class 名不要用 `.st`／`.sv`，`.st` 已是銷售策略卡片樣式。**

## localStorage
前綴 `ecaStudio.`：settings（含 currency）／setOpen（設定區塊展開狀態）／draft／history／marquee／warned（首訪警語已讀）。「清除本機資料」刪除此前綴全部 key。

## 測試
`window.__eca`：`analyze(input)`、`getState()`、`loadSample(key)`、`validatePatch()`、`applyAiPatch()`、`analyzeReviews(text)`、`buildPrintReport()`、`buildMarkdown()`。
- 用 Playwright 測時 data.js 會被瀏覽器快取，改完要用 CDP `Network.setCacheDisabled` 或清 service worker 再測。
- AI 路徑：攔截 `window.fetch` 回假的 Anthropic 回應即可驗證逐欄 fallback；PDF 用 `emulateMedia('print')`＋`page.pdf()`，不要點列印鈕。
- 測完清掉 `ecaStudio.` 開頭的 localStorage（避免假金鑰殘留）。

## 部署
2026-11-01 已上線：公開 repo `M255525/ecommerce-competitor-analyzer`（建 repo 被 auto mode 擋，由使用者自己跑 `gh repo create --push`），GitHub Pages https://m255525.github.io/ecommerce-competitor-analyzer/ （Actions workflow `deploy-pages.yml`，分支 master，push 即自動部署；先 push 再開 Pages，master 分支政策正常）。訪客計數器 page_id：`m255525.ecommercecompetitoranalyzer`。已加入程式牆與 github-dashboard 的 `REPO_META`。
