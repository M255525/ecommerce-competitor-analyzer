/**
 * 商品頁讀取 Worker —— 2026-11-25 起停用。
 *
 * 原本替使用者讀 momo 商品頁的公開欄位。momo 的網站對非瀏覽器用戶端回 403，原做法要帶瀏覽器
 * User-Agent 才讀得到，且可能牽涉網站條款與商品文案著作權，因此不再讀取任何第三方網站。
 * 保留端點只為了讓舊版網頁得到清楚的訊息（網頁會改請使用者自行貼上資料）。
 * 不可恢復成以瀏覽器標頭讀取；要恢復必須先取得平台授權或改用官方 API。
 */
const ALLOWED_ORIGINS = [
  'https://m255525.github.io',
  'http://localhost:8843',
  'http://127.0.0.1:8843',
];

export default {
  async fetch(request) {
    const origin = request.headers.get('Origin') || '';
    const headers = { 'Content-Type': 'application/json; charset=utf-8', Vary: 'Origin' };
    if (ALLOWED_ORIGINS.includes(origin)) {
      headers['Access-Control-Allow-Origin'] = origin;
      headers['Access-Control-Allow-Methods'] = 'GET, OPTIONS';
    }
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    return new Response(JSON.stringify({
      ok: false,
      reason: 'disabled',
      message: '商品頁自動讀取已停用，請自行貼上商品資料',
    }), { status: 200, headers });
  },
};
