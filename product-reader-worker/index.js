/**
 * AI 電商競品分析系統——商品頁讀取 Worker（目前只支援 momo 購物網）。
 * 網頁在瀏覽器端受 CORS 限制無法直接讀 momo，改由這支 Worker 在伺服器端讀「使用者貼上的那一個商品頁」，
 * 解析頁面內的結構化資料（JSON-LD）後只回傳欄位，不回傳原始 HTML。
 * 刻意只允許 momoshop.com.tw／momo.dm，不是開放代理。
 *
 * GET /?url=<momo 商品頁網址>
 * 回應：{ ok, readable, source, url, name, brand, category, currency, price, rating, reviews, features, reviewsText:null, guessed:[] }
 */

const ALLOWED_ORIGINS = [
  'https://m255525.github.io',
  'http://localhost:8843',
  'http://127.0.0.1:8843',
];
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

function cors(origin) {
  const h = { 'Vary': 'Origin' };
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    h['Access-Control-Allow-Origin'] = origin;
    h['Access-Control-Allow-Methods'] = 'GET, OPTIONS';
  }
  return h;
}
function json(obj, status, origin, extra) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, cors(origin), extra || {}),
  });
}

function isMomoHost(h) { return /(^|\.)momoshop\.com\.tw$/.test(h) || /(^|\.)momo\.dm$/.test(h); }

// 各種 momo 網址 → 標準商品頁網址；短網址 momo.dm 先跟著轉址（只跟到 momo 自己的網域）
async function canonicalMomoUrl(raw) {
  let u;
  try { u = new URL(raw); } catch (e) { return null; }
  if (!/^https?:$/.test(u.protocol) || !isMomoHost(u.hostname.toLowerCase())) return null;
  for (let hop = 0; hop < 4 && /(^|\.)momo\.dm$/.test(u.hostname.toLowerCase()); hop++) {
    const r = await fetch(u.href, { redirect: 'manual', headers: { 'User-Agent': UA } });
    const loc = r.headers.get('Location');
    if (!loc) return null;
    u = new URL(loc, u.href);
    if (!isMomoHost(u.hostname.toLowerCase())) return null;
  }
  let code = u.searchParams.get('i_code') || u.searchParams.get('iCode');
  if (!code) { const m = u.pathname.match(/\/product\/(\d{5,10})/); if (m) code = m[1]; }
  if (!code || !/^\d{5,10}$/.test(code)) return null;
  return { code, url: 'https://www.momoshop.com.tw/goods/GoodsDetail.jsp?i_code=' + code };
}

function decodeEntities(s) {
  return String(s || '').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}
function meta(html, prop) {
  const re = new RegExp('<meta[^>]+(?:property|name)=["\']' + prop.replace('.', '\\.') + '["\'][^>]*content=["\']([^"\']*)', 'i');
  const m = html.match(re);
  return m ? decodeEntities(m[1]).trim() : '';
}
function num(v) { const n = parseFloat(v); return isFinite(n) ? n : null; }
function asArray(v) { return v == null ? [] : Array.isArray(v) ? v : [v]; }

function offerPrices(offers) {
  const out = [];
  asArray(offers).forEach(o => {
    if (!o) return;
    const p = num(o.price != null ? o.price : o.lowPrice);
    if (p != null && p > 0) out.push({ price: p, currency: o.priceCurrency || '' });
  });
  return out;
}

function parseMomo(html) {
  const nodes = [];
  const re = /<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    try {
      const d = JSON.parse(m[1]);
      asArray(d).forEach(x => asArray(x['@graph'] || x).forEach(n => nodes.push(n)));
    } catch (e) { /* 忽略壞掉的區塊 */ }
  }
  const product = nodes.find(n => n && (n['@type'] === 'Product' || n['@type'] === 'ProductGroup'));
  const crumbsNode = nodes.find(n => n && n['@type'] === 'BreadcrumbList');
  const crumbs = crumbsNode ? asArray(crumbsNode.itemListElement).map(i => String((i && i.name) || '').trim()).filter(Boolean) : [];
  // 麵包屑第 2 層通常是最具體的商品分類（第 3 層之後常是「本月主打」這類活動頁）
  const category = (crumbs[1] || crumbs[0] || '').replace(/[▼▲★]/g, '').slice(0, 20);

  let name = '', brand = '', description = '', prices = [], rating = null, reviews = null, props = [];
  if (product) {
    name = String(product.name || '').trim();
    brand = String((product.brand && (product.brand.name || product.brand)) || '').trim();
    description = String(product.description || '').trim();
    prices = offerPrices(product.offers);
    asArray(product.hasVariant).forEach(v => { prices = prices.concat(offerPrices(v && v.offers)); });
    const ar = product.aggregateRating;
    if (ar) { rating = num(ar.ratingValue); reviews = num(ar.reviewCount != null ? ar.reviewCount : ar.ratingCount); }
    asArray(product.additionalProperty).forEach(p => {
      if (p && p.name && p.value && !/品牌/.test(p.name)) props.push(String(p.name).trim() + '：' + String(p.value).trim());
    });
  }
  if (!name) name = meta(html, 'og:title').replace(/\s*-\s*momo購物網[\s\S]*$/, '').trim();
  if (!description) description = meta(html, 'og:description');
  if (!name || /Mobile管理訊息/.test(name)) return null;

  const best = prices.sort((a, b) => a.price - b.price)[0] || null;
  const features = description.split(/[,，、;；\n]+/).map(s => s.trim()).filter(s => s.length >= 2)
    .concat(props).filter((s, i, a) => a.indexOf(s) === i).slice(0, 10).join(', ');
  return {
    name: name.slice(0, 120),
    brand: brand.slice(0, 40) || null,
    category: category || null,
    currency: best ? (best.currency || 'TWD') : null,
    price: best ? best.price : null,
    rating: rating != null && rating > 0 && rating <= 5 ? rating : null,
    reviews: reviews != null && reviews >= 0 ? Math.round(reviews) : null,
    features: features || null,
  };
}

export default {
  async fetch(request) {
    const origin = request.headers.get('Origin') || '';
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: Object.assign({ 'Access-Control-Max-Age': '86400' }, cors(origin)) });
    if (request.method !== 'GET') return json({ ok: false, reason: 'method_not_allowed' }, 405, origin);
    // 瀏覽器呼叫一律檢查來源網站；沒有 Origin（例如 curl 測試）才放行
    if (origin && !ALLOWED_ORIGINS.includes(origin)) return json({ ok: false, reason: 'origin_not_allowed' }, 403, origin);

    const raw = new URL(request.url).searchParams.get('url') || '';
    if (!raw) return json({ ok: true, message: '商品頁讀取服務運作中。用法：?url=<momo 商品頁網址>' }, 200, origin);

    let canon;
    try { canon = await canonicalMomoUrl(raw); } catch (e) { canon = null; }
    if (!canon) return json({ ok: false, reason: 'unsupported_url', message: '目前只支援 momo 購物網的商品頁網址' }, 400, origin);

    let resp;
    try {
      resp = await fetch(canon.url, {
        headers: { 'User-Agent': UA, 'Accept': 'text/html', 'Accept-Language': 'zh-TW,zh;q=0.9' },
        signal: AbortSignal.timeout(12000),
        cf: { cacheTtl: 600, cacheEverything: true },
      });
    } catch (e) {
      return json({ ok: false, reason: 'fetch_failed', message: '讀取 momo 頁面逾時或失敗' }, 502, origin);
    }
    if (!resp.ok) return json({ ok: false, reason: 'blocked', status: resp.status, message: 'momo 回應 ' + resp.status + '（可能暫時擋下讀取）' }, 502, origin);

    const html = await resp.text();
    const data = parseMomo(html);
    if (!data) return json({ ok: false, reason: 'not_found', message: '這個網址找不到商品資料（商品可能已下架）' }, 404, origin);

    return json(Object.assign({ ok: true, readable: true, source: 'momo', url: canon.url, reviewsText: null, guessed: [] }, data),
      200, origin, { 'Cache-Control': 'public, max-age=600' });
  },
};
