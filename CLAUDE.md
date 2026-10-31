# AI 電商競品分析系統（ecommerce-competitor-analyzer）

輸入「我的商品」＋ 1～8 個競品（品牌名、售價、評分、評論數、特色、評論摘錄）→ 六個分頁：總覽、價格分析、商品特色矩陣、競品優缺點、產品定位圖、銷售策略（含 30 天行動計畫）→ PDF／Markdown／JSON。純前端靜態網站，本機 port **8843**（`python -m http.server 8843`，已登記在工作區 `.claude/launch.json`）。無序號授權。

## 檔案
- `index.html`：全部 UI 與邏輯（單一 IIFE：規則引擎、AI、設定、歷史、PDF、跑馬燈、PWA、關於／警語彈窗）。
- `data.js`：`window.ECA` = 品類桶 `CATEGORIES`＋`classify()`、34 類特色詞庫 `FEATURES`（含構面 `DIMS`）、評論面向 `ASPECTS`、正負詞 `POS`/`NEG`、平台 `PLATFORMS`（預設費率＋操作建議）、四象限 `QUADRANTS`（定價／促銷／評論經營／風險模板）、文案模板 `COPY_TPL`、6 組虛構範例 `SAMPLES`。**調整詞庫或文案只改這個檔**。
- `manual.html`（含完整版創作者區塊 `#creator`）、`manifest.json`、`service-worker.js`（network-first）、`icons/`（PIL 產生）、`watermark.png`（沿用 business-model-pattern-studio）。

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

## localStorage
前綴 `ecaStudio.`：settings／draft／history／marquee／warned（首訪警語已讀）。「清除本機資料」刪除此前綴全部 key。

## 測試
`window.__eca`：`analyze(input)`、`getState()`、`loadSample(key)`、`validatePatch()`、`applyAiPatch()`、`analyzeReviews(text)`、`buildPrintReport()`、`buildMarkdown()`。
- 用 Playwright 測時 data.js 會被瀏覽器快取，改完要用 CDP `Network.setCacheDisabled` 或清 service worker 再測。
- AI 路徑：攔截 `window.fetch` 回假的 Anthropic 回應即可驗證逐欄 fallback；PDF 用 `emulateMedia('print')`＋`page.pdf()`，不要點列印鈕。
- 測完清掉 `ecaStudio.` 開頭的 localStorage（避免假金鑰殘留）。

## 部署
尚未上線（2026-10-31 建立，待使用者確認後再建公開 repo＋GitHub Pages；`.github/workflows/deploy-pages.yml` 已備妥，分支 master）。訪客計數器 page_id：`m255525.ecommercecompetitoranalyzer`。
