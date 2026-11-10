// Server-side order notifications.
//  Email:    Resend (https://resend.com) - RESEND_API_KEY + EMAIL_FROM, e.g. "4L Fashion <orders@4lfashion.com.qa>".
//  WhatsApp: WhatsApp Business Cloud API (Meta) - WHATSAPP_TOKEN + WHATSAPP_PHONE_NUMBER_ID.
//            Messages to customers who have not written in the last 24h must use an approved
//            template: WHATSAPP_TEMPLATE (body with 3 variables: name, order id, message) and
//            optional WHATSAPP_TEMPLATE_LANG (default "en").
// Nothing is sent unless the keys are set as Cloudflare Worker secrets. Failures never block an order.
import {customerMessage, whatsappNumber, type NotifyEvent, type Order} from './orders';

export type NotifyEnv = {RESEND_API_KEY?: string; EMAIL_FROM?: string; WHATSAPP_TOKEN?: string; WHATSAPP_PHONE_NUMBER_ID?: string;
  WHATSAPP_TEMPLATE?: string; WHATSAPP_TEMPLATE_LANG?: string; APP_URL?: string};
export type NotifySettings = {email?: Partial<Record<NotifyEvent, boolean>>; whatsapp?: Partial<Record<NotifyEvent, boolean>>; storeAlerts?: boolean; storeEmail?: string};
export type SendResult = {channel: 'email' | 'whatsapp'; ok: boolean; skipped?: boolean; error?: string; to?: string};

export const DEFAULT_NOTIFY: Required<Pick<NotifySettings, 'email' | 'whatsapp' | 'storeAlerts'>> = {
  email: {confirmed: true, packing: false, shipped: true, delivered: true, cancelled: true, items_cancelled: true, refund: true},
  whatsapp: {confirmed: true, packing: false, shipped: true, delivered: true, cancelled: true, items_cancelled: true, refund: false},
  storeAlerts: true,
};

export const notifyConfig = (env: NotifyEnv) => ({email: !!(env.RESEND_API_KEY && env.EMAIL_FROM), whatsapp: !!(env.WHATSAPP_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID), whatsappTemplate: !!env.WHATSAPP_TEMPLATE});

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]!));
const qar = (fils: number) => 'QAR ' + (fils / 100).toLocaleString('en-QA', {maximumFractionDigits: 2});

function withTimeout<T>(p: Promise<T>, ms = 6000): Promise<T> {
  return Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error('Timed out')), ms))]);
}

export function orderEmailHtml(o: Order, event: NotifyEvent, store: {name?: string; email?: string; whatsapp?: string}, appUrl = '') {
  const m = customerMessage(o, event, store.name);
  const rows = o.items.map(l => {
    const left = l.qty - (l.cancelledQty || 0);
    return `<tr><td style="padding:8px 0;border-bottom:1px solid #eee">${esc(l.name)}<br><span style="color:#888;font-size:12px">${esc([l.colour, l.size].filter(Boolean).join(' / '))}${l.cancelledQty ? ` · ${l.cancelledQty} cancelled` : ''}</span></td><td style="padding:8px 0;border-bottom:1px solid #eee;text-align:center">${left}</td><td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right">${qar(l.price * left)}</td></tr>`;
  }).join('');
  const link = appUrl ? `<p style="margin:24px 0"><a href="${esc(appUrl.replace(/\/$/, ''))}/account" style="background:#651f34;color:#fff;padding:12px 20px;border-radius:999px;text-decoration:none">View your order</a></p>` : '';
  return `<!doctype html><html><body style="margin:0;background:#faf8f4;font-family:Arial,sans-serif;color:#272423">
<div style="max-width:560px;margin:0 auto;padding:28px 20px">
<h1 style="font-family:Georgia,serif;font-weight:400;color:#651f34;margin:0 0 4px">${esc(store.name || '4L Fashion')}</h1>
<p style="color:#888;margin:0 0 24px;font-size:13px">Order ${esc(o.id)}</p>
<p>${esc(m.greeting)}</p><p>${esc(m.body)}</p>${link}
<table style="width:100%;border-collapse:collapse;font-size:14px"><thead><tr><th style="text-align:left">Item</th><th>Qty</th><th style="text-align:right">Total</th></tr></thead><tbody>${rows}</tbody></table>
<p style="text-align:right;font-size:14px">Subtotal ${qar(o.subtotal)}${o.discount ? `<br>Discount −${qar(o.discount)}` : ''}<br>Delivery ${qar(o.shipping + (o.giftWrap ? 1000 : 0))}<br><b>Total ${qar(o.total)}</b></p>
${o.address ? `<p style="font-size:13px;color:#555"><b>Delivery address</b><br>${esc(o.address)}</p>` : ''}
<p style="font-size:12px;color:#888;margin-top:28px">Questions? Reply to this email${store.whatsapp ? ' or WhatsApp us on +' + esc(store.whatsapp) : ''}.</p>
</div></body></html>`;
}

export async function sendEmail(env: NotifyEnv, to: string, subject: string, html: string, text: string, replyTo?: string): Promise<SendResult> {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) return {channel: 'email', ok: false, skipped: true, error: 'Email not configured', to};
  if (!/^\S+@\S+\.\S+$/.test(to)) return {channel: 'email', ok: false, error: 'No valid email address', to};
  try {
    const r = await withTimeout(fetch('https://api.resend.com/emails', {method: 'POST', headers: {Authorization: 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json'},
      body: JSON.stringify({from: env.EMAIL_FROM, to: [to], subject, html, text, ...(replyTo ? {reply_to: replyTo} : {})})}));
    if (!r.ok) return {channel: 'email', ok: false, error: 'Email provider ' + r.status + ': ' + (await r.text()).slice(0, 200), to};
    return {channel: 'email', ok: true, to};
  } catch (e) { return {channel: 'email', ok: false, error: e instanceof Error ? e.message : 'Email failed', to}; }
}

export async function sendWhatsApp(env: NotifyEnv, phone: string | undefined, text: string, params: string[]): Promise<SendResult> {
  const to = whatsappNumber(phone);
  if (!env.WHATSAPP_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID) return {channel: 'whatsapp', ok: false, skipped: true, error: 'WhatsApp not configured', to};
  if (to.length < 8) return {channel: 'whatsapp', ok: false, error: 'No valid phone number', to};
  const message = env.WHATSAPP_TEMPLATE
    ? {type: 'template', template: {name: env.WHATSAPP_TEMPLATE, language: {code: env.WHATSAPP_TEMPLATE_LANG || 'en'}, components: [{type: 'body', parameters: params.map(t => ({type: 'text', text: t.slice(0, 1000)}))}]}}
    : {type: 'text', text: {body: text.slice(0, 4000)}};
  try {
    const r = await withTimeout(fetch(`https://graph.facebook.com/v21.0/${encodeURIComponent(env.WHATSAPP_PHONE_NUMBER_ID)}/messages`, {method: 'POST',
      headers: {Authorization: 'Bearer ' + env.WHATSAPP_TOKEN, 'Content-Type': 'application/json'}, body: JSON.stringify({messaging_product: 'whatsapp', to, ...message})}));
    if (!r.ok) return {channel: 'whatsapp', ok: false, error: 'WhatsApp API ' + r.status + ': ' + (await r.text()).slice(0, 200), to};
    return {channel: 'whatsapp', ok: true, to};
  } catch (e) { return {channel: 'whatsapp', ok: false, error: e instanceof Error ? e.message : 'WhatsApp failed', to}; }
}

/** Send the customer notification for an event on the channels enabled in settings (or the forced ones). */
export async function notifyCustomer(env: NotifyEnv, o: Order, event: NotifyEvent, cfg: {name?: string; email?: string; whatsapp?: string; notifications?: NotifySettings}, only?: ('email' | 'whatsapp')[]) {
  const n = {...DEFAULT_NOTIFY, ...(cfg.notifications || {})};
  const m = customerMessage(o, event, cfg.name);
  const want = (ch: 'email' | 'whatsapp') => only ? only.includes(ch) : !!{...DEFAULT_NOTIFY[ch], ...(n[ch] || {})}[event];
  const jobs: Promise<SendResult>[] = [];
  if (want('email')) jobs.push(sendEmail(env, o.email, m.subject, orderEmailHtml(o, event, cfg, env.APP_URL), m.greeting + '\n\n' + m.body, cfg.email));
  if (want('whatsapp')) jobs.push(sendWhatsApp(env, o.phone, m.whatsapp, [String(o.name || '').split(' ')[0] || 'there', o.id, m.body]));
  return Promise.all(jobs);
}

/** Tell the store about a new online order. */
export async function notifyStore(env: NotifyEnv, o: Order, cfg: {name?: string; email?: string; notifications?: NotifySettings}) {
  const n = {...DEFAULT_NOTIFY, ...(cfg.notifications || {})}, to = n.storeEmail || cfg.email || '';
  if (!n.storeAlerts || !to) return [];
  const items = o.items.map(l => `${l.qty} × ${l.name} (${[l.colour, l.size].filter(Boolean).join(' / ')})`).join('\n');
  const text = `New order ${o.id}\n${o.name} · ${o.phone || ''} · ${o.email}\n${o.address || ''}\n\n${items}\n\nTotal ${qar(o.total)} · ${o.payment || ''}`;
  return [await sendEmail(env, to, `New order ${o.id} · ${qar(o.total)}`, `<pre style="font-family:Arial,sans-serif;font-size:14px">${esc(text)}</pre>`, text, o.email)];
}
