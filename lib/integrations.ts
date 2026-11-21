// Platform integrations (Leadvyne, CRMs, Zapier/Make, custom apps).
//
// Two directions, both per connection:
//  - Pull: the platform calls the read-only REST API at /api/v1/... with the connection's API key
//    (Authorization: Bearer 4lf_..., or X-API-Key). Keys are shown once and stored only as SHA-256 hashes.
//  - Push: when orders or products change, the store POSTs a signed JSON event to the connection's
//    webhook URL. Signature: X-4L-Signature: sha256=HEX(HMAC_SHA256(signingSecret, timestamp + "." + body))
//    with X-4L-Timestamp. An optional custom header (e.g. the platform's own API key) is sent too.
//
// Everything lives in the existing `records` table (kinds: integration, webhookDelivery, apiRate),
// so no schema migration is needed. This module has no imports so tests can load it directly.

export type D1Like = {prepare(q: string): any; batch(stmts: any[]): Promise<any>};

export const API_SCOPES = [
  {key: 'orders:read', label: 'Read orders'},
  {key: 'products:read', label: 'Read products & stock'},
] as const;
export type ApiScope = typeof API_SCOPES[number]['key'];

export const WEBHOOK_EVENTS = [
  {key: 'order.created', label: 'New order (online or POS)'},
  {key: 'order.updated', label: 'Order updated (status, payment, tracking, refund)'},
  {key: 'order.cancelled', label: 'Order or items cancelled'},
  {key: 'order.deleted', label: 'Test order deleted'},
  {key: 'product.created', label: 'Product added'},
  {key: 'product.updated', label: 'Product edited'},
  {key: 'product.deleted', label: 'Product deleted'},
  {key: 'inventory.updated', label: 'Stock levels changed'},
] as const;
export type WebhookEvent = typeof WEBHOOK_EVENTS[number]['key'] | 'ping';

export const PLATFORMS = [
  {key: 'leadvyne', name: 'Leadvyne', note: 'Sync customers, orders and items into Leadvyne. Paste the API key and base URL into Leadvyne, and the Leadvyne webhook URL (if it gives you one) below.'},
  {key: 'zapier', name: 'Zapier / Make / n8n', note: 'Use a "Catch webhook" trigger URL as the webhook URL, or poll the REST API with the key.'},
  {key: 'custom', name: 'Other platform', note: 'Any CRM, ERP, accounting or marketing tool that can call a REST API or receive webhooks.'},
] as const;

export type Integration = {
  name: string; platform: string; keyHash: string; keyPrefix: string; scopes: string[];
  webhookUrl: string; secret: string; events: string[]; headerName: string; headerValue: string;
  active: boolean; created: string; lastUsed?: string; rotated?: string;
};

const hex = (buf: ArrayBuffer | Uint8Array) => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
const randomHex = (bytes: number) => hex(crypto.getRandomValues(new Uint8Array(bytes)));
export const newApiKey = () => '4lf_' + randomHex(20);
export const newSigningSecret = () => 'whsec_' + randomHex(24);
export const keyPrefix = (key: string) => key.slice(0, 10) + '…' + key.slice(-4);
export async function sha256Hex(s: string) { return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))); }
export async function hmacHex(secret: string, message: string) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), {name: 'HMAC', hash: 'SHA-256'}, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(message)));
}

// ---------- Validation of admin input ----------
const HEADER_NAME = /^[A-Za-z0-9-]{1,60}$/;
const RESERVED_HEADERS = ['host', 'content-length', 'content-type', 'x-4l-event', 'x-4l-signature', 'x-4l-timestamp', 'x-4l-delivery'];
/** Webhooks must be public https URLs (no localhost / private IPs). */
export function validWebhookUrl(raw: unknown): string | null {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  let u: URL; try { u = new URL(s); } catch { return null; }
  if (u.protocol !== 'https:' || u.username || u.password || s.length > 500) return null;
  const h = u.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal') || !h.includes('.')) return null;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h) || h.includes(':')) return null; // IP literals
  return u.toString();
}
export function cleanIntegrationInput(d: any, prev?: Partial<Integration>) {
  const name = String(d?.name ?? prev?.name ?? '').trim().slice(0, 60);
  if (!name) return {error: 'Give the connection a name, e.g. "Leadvyne".'};
  const platform = PLATFORMS.some(p => p.key === d?.platform) ? d.platform : prev?.platform || 'custom';
  const webhookUrl = d?.webhookUrl === undefined ? prev?.webhookUrl || '' : validWebhookUrl(d.webhookUrl);
  if (webhookUrl === null) return {error: 'The webhook URL must be a public https:// address.'};
  const scopes = Array.isArray(d?.scopes) ? d.scopes.filter((s: string) => API_SCOPES.some(x => x.key === s)) : prev?.scopes || API_SCOPES.map(s => s.key);
  const events = Array.isArray(d?.events) ? d.events.filter((e: string) => WEBHOOK_EVENTS.some(x => x.key === e)) : prev?.events || WEBHOOK_EVENTS.map(e => e.key);
  const headerName = d?.headerName === undefined ? prev?.headerName || '' : String(d.headerName || '').trim();
  if (headerName && (!HEADER_NAME.test(headerName) || RESERVED_HEADERS.includes(headerName.toLowerCase()))) return {error: 'That custom header name is not allowed.'};
  // Header value is write-only: undefined keeps the saved one, '' clears it.
  const headerValue = !headerName ? '' : d?.headerValue === undefined ? prev?.headerValue || '' : String(d.headerValue).slice(0, 500);
  if (/[\r\n]/.test(headerValue)) return {error: 'The custom header value cannot contain line breaks.'};
  const active = d?.active === undefined ? prev?.active ?? true : !!d.active;
  return {value: {name, platform, webhookUrl, scopes, events, headerName, headerValue, active}};
}
/** What the admin screen (and its offline cache) may see: never the key hash, secret or header value. */
export const publicIntegration = (x: any, deliveries: any[] = []) => ({
  id: x.id, name: x.name, platform: x.platform, keyPrefix: x.keyPrefix, scopes: x.scopes || [], webhookUrl: x.webhookUrl || '',
  events: x.events || [], headerName: x.headerName || '', hasHeaderValue: !!x.headerValue, active: x.active !== false,
  created: x.created, lastUsed: x.lastUsed || '', rotated: x.rotated || '', deliveries,
});

// ---------- Public payloads (amounts in QAR, e.g. 249.5) ----------
const money = (fils: unknown) => Math.round(Number(fils || 0)) / 100;
export function orderUpdatedAt(o: any) {
  const times = [o.created, ...(o.timeline || []).map((e: any) => e.at)].filter(Boolean).sort();
  return times[times.length - 1] || o.created || '';
}
export function orderPayload(o: any, productOf: Record<string, string> = {}) {
  const items = (o.items || []).map((l: any) => {
    const cancelled = l.cancelledQty || 0, qty = Math.max(0, l.qty - cancelled);
    return {variant_id: l.variant, product_id: productOf[l.variant] || null, sku: l.code || '', name: l.name, size: l.size || '', colour: l.colour || '',
      quantity: l.qty, cancelled_quantity: cancelled, active_quantity: qty, unit_price: money(l.price), line_total: money(l.price * qty), image: l.image || ''};
  });
  return {
    id: o.id, number: o.id, status: o.status, source: o.source || 'Online', test: !!o.test,
    created_at: o.created || '', updated_at: orderUpdatedAt(o),
    customer: {name: o.name || '', email: o.email || '', phone: o.phone || '', deleted: !!o.customerDeleted},
    shipping_address: {text: o.address || '', ...(o.addressDetails || {})}, delivery_slot: o.slot || '',
    payment: {method: o.payment || '', paid: !!o.paid}, currency: o.currency || 'QAR',
    subtotal: money(o.subtotal), discount: money(o.discount), shipping: money(o.shipping), gift_wrap: !!o.giftWrap,
    total: money(o.total), refund_due: money(o.refundDue), refunded: money(o.refunded), cancel_reason: o.cancelReason || '',
    gift_message: o.giftMessage || '', measurements: o.measurements || '',
    fulfilment: {carrier: o.carrier || '', tracking: o.tracking || ''},
    item_count: items.reduce((n: number, l: any) => n + l.active_quantity, 0), items,
    // Customer-visible history only; staff notes stay private.
    timeline: (o.timeline || []).filter((e: any) => !e.internal).map((e: any) => ({at: e.at, type: e.type, message: e.message})),
  };
}
export function productPayload(p: any, vs: any[], appUrl = '') {
  const variants = vs.filter(v => v.product === p.id).map(v => ({id: v.id, size: v.size, colour: v.colour, stock: v.stock, price: money(v.price), barcode: v.barcode}));
  return {
    id: p.id, sku: p.code || '', name: p.name, category: p.category || '', brand: p.brand || '', tag: p.tag || '',
    price: Number(p.price || 0), compare_at_price: Number(p.oldPrice || 0) || null, currency: 'QAR', published: p.published !== false,
    colour: p.colour || '', fabric: p.fabric || '', fit: p.fit || '', occasion: p.occasion || '', description: p.description || '',
    image: p.image || '', url: appUrl ? appUrl.replace(/\/$/, '') + '/products/' + encodeURIComponent(p.id) : '',
    created_at: p.created || '', total_stock: variants.reduce((n, v) => n + Math.max(0, v.stock), 0), variants,
  };
}

// ---------- Storage helpers ----------
async function allRows(db: D1Like, kind: string) {
  const r = await db.prepare('SELECT * FROM records WHERE kind=? ORDER BY created DESC').bind(kind).all();
  return r.results.map((x: any) => ({...JSON.parse(x.data), id: x.id, owner: x.owner, created: x.created}));
}
export const listIntegrations = (db: D1Like) => allRows(db, 'integration');
export async function recentDeliveries(db: D1Like, integrationId: string, limit = 10) {
  const r = await db.prepare("SELECT data,created FROM records WHERE kind='webhookDelivery' AND owner=? ORDER BY created DESC LIMIT ?").bind(integrationId, limit).all();
  return r.results.map((x: any) => ({...JSON.parse(x.data), at: x.created}));
}
async function productIndex(db: D1Like) {
  const r = await db.prepare('SELECT id,product FROM variants').all();
  return Object.fromEntries(r.results.map((v: any) => [v.id, v.product]));
}

// ---------- REST API (pull) ----------
const apiJson = (x: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(x), {status, headers: {'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extra}});
const apiError = (status: number, code: string, message: string) => apiJson({error: {code, message}}, status);

async function authenticate(db: D1Like, req: Request) {
  const auth = req.headers.get('authorization') || '';
  const key = (/^Bearer\s+(.+)$/i.exec(auth)?.[1] || req.headers.get('x-api-key') || '').trim();
  if (!/^4lf_[a-f0-9]{40}$/.test(key)) return null;
  const hash = await sha256Hex(key);
  const r: any = await db.prepare("SELECT id,data,created FROM records WHERE kind='integration' AND json_extract(data,'$.keyHash')=?").bind(hash).first();
  if (!r) return null;
  const x = {...JSON.parse(r.data), id: r.id, created: r.created};
  const now = new Date().toISOString();
  if (!x.lastUsed || Date.now() - Date.parse(x.lastUsed) > 60_000)
    await db.prepare("UPDATE records SET data=json_set(data,'$.lastUsed',?) WHERE id=?").bind(now, r.id).run();
  return x as Integration & {id: string};
}
async function withinRate(db: D1Like, id: string, limit = 240) {
  const minute = new Date().toISOString().slice(0, 16), rid = 'api-rate:' + id + ':' + minute;
  await db.prepare("INSERT INTO records(id,kind,data,owner,created) VALUES(?,'apiRate','{\"n\":1}',NULL,?) ON CONFLICT(id) DO UPDATE SET data=json_set(data,'$.n',json_extract(data,'$.n')+1)").bind(rid, new Date().toISOString()).run();
  const r: any = await db.prepare('SELECT data FROM records WHERE id=?').bind(rid).first();
  if (Math.random() < 0.05) await db.prepare("DELETE FROM records WHERE kind='apiRate' AND created<?").bind(new Date(Date.now() - 3600e3).toISOString()).run();
  return JSON.parse(r?.data || '{"n":0}').n <= limit;
}
function paging(url: URL) {
  const limit = Math.max(1, Math.min(100, Math.floor(Number(url.searchParams.get('limit')) || 50)));
  const page = Math.max(1, Math.floor(Number(url.searchParams.get('page')) || 1));
  return {limit, page};
}
function since(url: URL, name: string) {
  const s = url.searchParams.get(name);
  if (!s) return '';
  const t = Date.parse(s);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}
function paginate<T>(all: T[], {limit, page}: {limit: number; page: number}) {
  const data = all.slice((page - 1) * limit, page * limit), more = page * limit < all.length;
  return {data, page, limit, total: all.length, has_more: more, next_page: more ? page + 1 : null};
}

export const API_INDEX = {
  name: '4L Fashion store API', version: 'v1',
  auth: 'Send your key as "Authorization: Bearer 4lf_..." or "X-API-Key: 4lf_...".',
  endpoints: {
    'GET /api/v1/ping': 'Check the key and see the connection name and scopes.',
    'GET /api/v1/orders': 'List orders, oldest change first. Query: updated_since, created_since (ISO date/time), status, source (Online|POS), include_test, limit (1-100), page.',
    'GET /api/v1/orders/{id}': 'One order with items, customer, payment and fulfilment.',
    'GET /api/v1/products': 'List products with variants and stock. Query: updated_since is not supported; use the inventory.updated webhook. Query: published, limit, page.',
    'GET /api/v1/products/{id}': 'One product with variants and stock.',
    'GET /api/v1/inventory': 'Every size/colour variant with its stock level. Query: limit, page.',
  },
  amounts: 'Money is in QAR as decimal numbers (e.g. 249.5).',
  webhooks: 'Signed with X-4L-Signature: sha256=HMAC_SHA256(signing secret, X-4L-Timestamp + "." + raw body).',
};

/** Handle /api/v1/* for an authenticated platform. `path` is the part after /api/v1. */
export async function handleApiRequest(db: D1Like | undefined, req: Request, appUrl = '') {
  if (!db) return apiError(503, 'unavailable', 'The store database is unavailable.');
  if (req.method === 'OPTIONS') return new Response(null, {status: 204, headers: {Allow: 'GET, OPTIONS'}});
  const url = new URL(req.url), path = url.pathname.replace(/^\/api\/v1\/?/, '').replace(/\/$/, '');
  if (req.method !== 'GET') return apiError(405, 'method_not_allowed', 'This API is read-only. Use GET.');
  if (path === '') return apiJson(API_INDEX);
  const conn = await authenticate(db, req);
  if (!conn) return apiError(401, 'invalid_key', 'Missing or invalid API key.');
  if (conn.active === false) return apiError(403, 'connection_paused', 'This connection is paused in the store admin.');
  if (!await withinRate(db, conn.id)) return apiError(429, 'rate_limited', 'Too many requests. Limit is 240 per minute.');
  const can = (s: ApiScope) => (conn.scopes || []).includes(s);
  const base = appUrl || url.origin;
  const [resource, id, extra] = path.split('/').map(decodeURIComponent);
  if (extra !== undefined) return apiError(404, 'not_found', 'Unknown endpoint.');

  if (resource === 'ping' && !id) return apiJson({ok: true, connection: {id: conn.id, name: conn.name, platform: conn.platform, scopes: conn.scopes}, store: base, time: new Date().toISOString()});

  if (resource === 'orders') {
    if (!can('orders:read')) return apiError(403, 'missing_scope', 'This key cannot read orders (needs orders:read).');
    const index = await productIndex(db);
    if (id) {
      const r: any = await db.prepare("SELECT * FROM records WHERE id=? AND kind='order'").bind(id).first();
      if (!r) return apiError(404, 'not_found', 'Order not found.');
      return apiJson({data: orderPayload({...JSON.parse(r.data), id: r.id, created: r.created}, index)});
    }
    const updatedSince = since(url, 'updated_since'), createdSince = since(url, 'created_since');
    if (updatedSince === null || createdSince === null) return apiError(400, 'invalid_date', 'updated_since / created_since must be ISO dates, e.g. 2026-11-01T00:00:00Z.');
    const status = url.searchParams.get('status'), source = url.searchParams.get('source'), includeTest = url.searchParams.get('include_test') === 'true';
    const all = (await allRows(db, 'order'))
      .filter((o: any) => includeTest || !o.test)
      .filter((o: any) => !status || String(o.status).toLowerCase() === status.toLowerCase())
      .filter((o: any) => !source || String(o.source || 'Online').toLowerCase() === source.toLowerCase())
      .map((o: any) => orderPayload(o, index))
      .filter((o: any) => (!updatedSince || o.updated_at > updatedSince) && (!createdSince || o.created_at >= createdSince))
      .sort((a: any, b: any) => a.updated_at.localeCompare(b.updated_at) || a.id.localeCompare(b.id));
    return apiJson(paginate(all, paging(url)));
  }

  if (resource === 'products' || resource === 'inventory') {
    if (!can('products:read')) return apiError(403, 'missing_scope', 'This key cannot read products (needs products:read).');
    const vs = (await db.prepare('SELECT * FROM variants ORDER BY product,colour,size').all()).results;
    if (resource === 'inventory') {
      if (id) return apiError(404, 'not_found', 'Unknown endpoint.');
      const names = Object.fromEntries((await allRows(db, 'product')).map((p: any) => [p.id, {name: p.name, sku: p.code || ''}]));
      return apiJson(paginate(vs.map((v: any) => ({variant_id: v.id, product_id: v.product, product_name: names[v.product]?.name || '', sku: names[v.product]?.sku || '', size: v.size, colour: v.colour, stock: v.stock, price: money(v.price), barcode: v.barcode})), paging(url)));
    }
    if (id) {
      const r: any = await db.prepare("SELECT * FROM records WHERE id=? AND kind='product'").bind(id).first();
      if (!r) return apiError(404, 'not_found', 'Product not found.');
      return apiJson({data: productPayload({...JSON.parse(r.data), id: r.id, created: r.created}, vs, base)});
    }
    const published = url.searchParams.get('published');
    const all = (await allRows(db, 'product'))
      .filter((p: any) => published === null || (published === 'true') === (p.published !== false))
      .sort((a: any, b: any) => String(a.created).localeCompare(String(b.created)) || String(a.id).localeCompare(String(b.id)))
      .map((p: any) => productPayload(p, vs, base));
    return apiJson(paginate(all, paging(url)));
  }
  return apiError(404, 'not_found', 'Unknown endpoint. GET /api/v1 lists them.');
}

// ---------- Webhooks (push) ----------
type FetchLike = (url: string, init: RequestInit) => Promise<Response>;
async function deliverOne(db: D1Like, x: any, event: WebhookEvent, data: unknown, fetchImpl: FetchLike) {
  const delivery = crypto.randomUUID(), ts = Math.floor(Date.now() / 1000).toString();
  const body = JSON.stringify({id: delivery, event, created_at: new Date().toISOString(), connection: x.name, data});
  const headers: Record<string, string> = {
    'Content-Type': 'application/json', 'User-Agent': '4LFashion-Webhooks/1.0',
    'X-4L-Event': event, 'X-4L-Delivery': delivery, 'X-4L-Timestamp': ts,
    'X-4L-Signature': 'sha256=' + await hmacHex(x.secret, ts + '.' + body),
  };
  if (x.headerName && x.headerValue) headers[x.headerName] = x.headerValue;
  const started = Date.now();
  let status = 0, error = '';
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), 8000);
      try { status = (await fetchImpl(x.webhookUrl, {method: 'POST', headers, body, signal: ctrl.signal, redirect: 'manual'})).status; }
      finally { clearTimeout(timer); }
      error = status >= 200 && status < 300 ? '' : 'HTTP ' + status;
    } catch (e: any) { status = 0; error = e?.name === 'AbortError' ? 'Timed out' : String(e?.message || e).slice(0, 200); }
    if (!error || (status >= 400 && status < 500 && status !== 429)) break; // only retry network errors, 429 and 5xx
  }
  const ok = !error;
  try {
    await db.prepare("INSERT INTO records(id,kind,data,owner,created) VALUES(?,'webhookDelivery',?,?,?)")
      .bind('delivery-' + delivery, JSON.stringify({event, ok, status, error, ms: Date.now() - started}), x.id, new Date().toISOString()).run();
    if (Math.random() < 0.1) await db.prepare("DELETE FROM records WHERE kind='webhookDelivery' AND owner=? AND id NOT IN (SELECT id FROM records WHERE kind='webhookDelivery' AND owner=? ORDER BY created DESC LIMIT 50)").bind(x.id, x.id).run();
  } catch {}
  return {integration: x.id, ok, status, error};
}

/** Send an event to every active connection subscribed to it. Never throws. */
export async function dispatchEvent(db: D1Like | undefined, event: WebhookEvent, data: unknown, opts: {fetch?: FetchLike; only?: string} = {}) {
  if (!db) return [];
  try {
    const targets = (await listIntegrations(db)).filter((x: any) =>
      x.webhookUrl && x.secret && (opts.only ? x.id === opts.only : x.active !== false && (x.events || []).includes(event)));
    const f = opts.fetch || ((u: string, i: RequestInit) => fetch(u, i));
    return await Promise.all(targets.map((x: any) => deliverOne(db, x, event, data, f)));
  } catch { return []; }
}

/**
 * Work out which webhook events a successful admin/store action produced and send them.
 * `body` is the request, `result` the JSON response. Runs after the response is decided.
 */
export async function emitForAction(db: D1Like | undefined, action: string, body: any, result: any, opts: {fetch?: FetchLike; appUrl?: string} = {}) {
  if (!db) return [];
  try {
    const subscribed = new Set((await listIntegrations(db)).filter((x: any) => x.webhookUrl && x.active !== false).flatMap((x: any) => x.events || []));
    if (!subscribed.size) return [];
    const out: any[] = [];
    const send = async (e: WebhookEvent, data: () => Promise<unknown>) => { if (subscribed.has(e)) out.push(...await dispatchEvent(db, e, await data(), opts)); };
    const getOrder = async (id: string) => { const r: any = await db.prepare("SELECT * FROM records WHERE id=? AND kind='order'").bind(id).first(); return r ? {...JSON.parse(r.data), id: r.id, created: r.created} : null; };
    const variantsFor = async (ids: string[]) => {
      if (!ids.length) return [];
      const r = await db.prepare('SELECT * FROM variants WHERE id IN (' + ids.map(() => '?').join(',') + ')').bind(...ids).all();
      return r.results.map((v: any) => ({variant_id: v.id, product_id: v.product, size: v.size, colour: v.colour, stock: v.stock}));
    };
    const orderEvent = async (e: WebhookEvent, id: string, stockMoved: boolean) => {
      const o = await getOrder(id); if (!o) return;
      const index = await productIndex(db);
      await send(e, async () => orderPayload(o, index));
      if (stockMoved) await send('inventory.updated', async () => ({reason: e === 'order.created' ? 'sale' : 'restock', order_id: id, variants: await variantsFor([...new Set<string>((o.items || []).map((l: any) => l.variant))])}));
    };
    const orderId = String(body?.id || result?.order?.id || result?.id || '');
    if (action === 'checkout' || action === 'pos') { if (result?.id && !result?.duplicate) await orderEvent('order.created', result.id, true); }
    else if (action === 'orderCancel') await orderEvent('order.cancelled', orderId, true);
    else if (action === 'orderStatus') await orderEvent(body?.status === 'Cancelled' ? 'order.cancelled' : 'order.updated', orderId, body?.status === 'Cancelled');
    else if (action === 'orderRefund' || action === 'orderTest') await orderEvent('order.updated', orderId, false);
    else if (action === 'orderDelete') { await send('order.deleted', async () => ({id: orderId})); }
    else if (action === 'save' && body?.kind === 'product' && result?.id) {
      const r: any = await db.prepare("SELECT * FROM records WHERE id=? AND kind='product'").bind(result.id).first();
      if (r) {
        const vs = (await db.prepare('SELECT * FROM variants WHERE product=?').bind(r.id).all()).results;
        await send(body.id ? 'product.updated' : 'product.created', async () => productPayload({...JSON.parse(r.data), id: r.id, created: r.created}, vs, opts.appUrl));
      }
    }
    else if (action === 'deleteProduct' && result?.id) await send('product.deleted', async () => ({id: result.id}));
    else if (action === 'stock' && body?.id && !result?.duplicate) await send('inventory.updated', async () => ({reason: String(body.reason || 'Manual adjustment').slice(0, 100), delta: body.delta, variants: await variantsFor([String(body.id)])}));
    return out;
  } catch { return []; }
}
