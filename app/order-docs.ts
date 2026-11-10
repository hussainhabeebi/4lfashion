// Printable order documents (invoice and packing list), opened in a print window.
import {activeQty, paymentState, type Order} from '../lib/orders';
import {initialSettings} from '../lib/catalog';

type Store = Record<string, unknown>;
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]!));
const qar = (fils: number) => 'QAR ' + (fils / 100).toLocaleString('en-QA', {minimumFractionDigits: 2, maximumFractionDigits: 2});
const get = (cfg: Store, k: string) => String(cfg[k] ?? (initialSettings as unknown as Store)[k] ?? '');
const date = (iso?: string) => new Date(iso || Date.now()).toLocaleDateString('en-GB', {day: 'numeric', month: 'short', year: 'numeric'});

function shell(title: string, body: string) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>
*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#222;margin:0;padding:32px;font-size:13px}
h1{font-family:Georgia,serif;font-weight:400;color:#651f34;font-size:28px;margin:0}h2{font-size:15px;margin:0 0 6px;text-transform:uppercase;letter-spacing:1px}
.top{display:flex;justify-content:space-between;gap:24px;border-bottom:2px solid #651f34;padding-bottom:16px;margin-bottom:20px}
.muted{color:#777}.cols{display:flex;gap:32px;margin-bottom:20px}.cols>div{flex:1}
table{width:100%;border-collapse:collapse;margin:8px 0 16px}th{text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.6px;color:#666;border-bottom:1px solid #ccc;padding:8px 6px}
td{padding:9px 6px;border-bottom:1px solid #eee;vertical-align:top}.r{text-align:right}.c{text-align:center}
.struck td{color:#aaa;text-decoration:line-through}.totals{margin-left:auto;width:280px}.totals div{display:flex;justify-content:space-between;padding:4px 0}
.grand{border-top:2px solid #222;font-weight:700;font-size:15px;margin-top:4px;padding-top:8px!important}
.box{display:inline-block;width:16px;height:16px;border:1.5px solid #222;border-radius:3px}.badge{display:inline-block;padding:3px 10px;border:1px solid #651f34;border-radius:999px;color:#651f34;font-size:11px}
.sign{display:flex;gap:40px;margin-top:40px}.sign div{flex:1;border-top:1px solid #999;padding-top:6px;color:#777}
.note{background:#f6f2ec;padding:10px 12px;border-radius:6px;margin:10px 0}
@media print{body{padding:0}@page{margin:14mm}}</style></head><body>${body}</body></html>`;
}

function storeBlock(cfg: Store) {
  const address = get(cfg, 'footerAddress').split('\n').filter(Boolean).map(esc).join('<br>');
  const phones = get(cfg, 'footerPhones').split('\n').filter(Boolean).map(esc).join(' · ');
  return `<div><h1>${esc(get(cfg, 'name') || '4L Fashion')}</h1><div class="muted">${address}<br>${phones}<br>${esc(get(cfg, 'email'))}</div></div>`;
}
function shipTo(o: Order) {
  return `<div><h2>Ship to</h2><b>${esc(o.name)}</b><br>${esc(o.address || '')}<br>${esc(o.phone || '')}<br>${esc(o.email)}${o.slot ? `<br><span class="muted">Delivery: ${esc(o.slot)}</span>` : ''}</div>`;
}

export function invoiceHtml(o: Order, cfg: Store, codes: Record<string, string> = {}) {
  const rows = o.items.map(l => {
    const left = activeQty(l), code = l.code || codes[l.variant] || '';
    const live = left > 0 ? `<tr><td>${esc(code)}</td><td>${esc(l.name)}<br><span class="muted">${esc([l.colour, l.size].filter(Boolean).join(' / '))}</span></td><td class="c">${left}</td><td class="r">${qar(l.price)}</td><td class="r">${qar(l.price * left)}</td></tr>` : '';
    const gone = l.cancelledQty ? `<tr class="struck"><td>${esc(code)}</td><td>${esc(l.name)} (cancelled)</td><td class="c">${l.cancelledQty}</td><td class="r">${qar(l.price)}</td><td class="r">${qar(l.price * l.cancelledQty)}</td></tr>` : '';
    return live + gone;
  }).join('');
  const pay = paymentState(o);
  return shell('Invoice ' + o.id, `<div class="top">${storeBlock(cfg)}<div class="r"><h1>Invoice</h1><div><b>${esc(o.id)}</b></div><div class="muted">${date(o.created)}</div>
<div style="margin-top:8px"><span class="badge">${esc(o.status === 'Cancelled' ? 'Cancelled' : pay.label)}</span></div></div></div>
<div class="cols"><div><h2>Bill to</h2><b>${esc(o.name)}</b><br>${esc(o.email)}<br>${esc(o.phone || '')}</div>${o.source === 'POS' ? '<div><h2>Sale</h2>In-store purchase</div>' : shipTo(o)}<div><h2>Payment</h2>${esc(o.payment || '')}<br>${esc(pay.label)}</div></div>
<table><thead><tr><th>SKU</th><th>Item</th><th class="c">Qty</th><th class="r">Unit price</th><th class="r">Amount</th></tr></thead><tbody>${rows}</tbody></table>
<div class="totals"><div><span>Subtotal</span><span>${qar(o.subtotal)}</span></div>${o.discount ? `<div><span>Discount</span><span>−${qar(o.discount)}</span></div>` : ''}
<div><span>Delivery</span><span>${qar(o.shipping)}</span></div>${o.giftWrap && o.status !== 'Cancelled' ? `<div><span>Gift wrapping</span><span>${qar(1000)}</span></div>` : ''}
<div class="grand"><span>Total</span><span>${qar(o.total)}</span></div>${o.refunded ? `<div><span>Refunded</span><span>${qar(o.refunded)}</span></div>` : ''}${o.refundDue ? `<div><span>Refund due</span><span>${qar(o.refundDue)}</span></div>` : ''}</div>
<p class="muted" style="margin-top:32px">Thank you for shopping with ${esc(get(cfg, 'name') || '4L Fashion')}. Prices in Qatari riyals.</p>`);
}

export function packingHtml(o: Order, cfg: Store, codes: Record<string, string> = {}) {
  const rows = o.items.filter(l => activeQty(l) > 0).map(l => `<tr><td class="c"><span class="box"></span></td><td>${esc(l.code || codes[l.variant] || '')}</td><td><b>${esc(l.name)}</b></td><td>${esc(l.colour || '')}</td><td><b>${esc(l.size || '')}</b></td><td class="c" style="font-size:16px"><b>${activeQty(l)}</b></td></tr>`).join('');
  const units = o.items.reduce((n, l) => n + activeQty(l), 0);
  return shell('Packing list ' + o.id, `<div class="top">${storeBlock(cfg)}<div class="r"><h1>Packing list</h1><div><b>${esc(o.id)}</b></div><div class="muted">Ordered ${date(o.created)} · ${units} item${units === 1 ? '' : 's'}</div></div></div>
<div class="cols">${shipTo(o)}<div><h2>Order</h2>${esc(o.payment || '')}<br>${o.paid ? 'Paid' : '<b>Collect ' + qar(o.total) + ' on delivery</b>'}</div></div>
<table><thead><tr><th class="c">Packed</th><th>SKU</th><th>Item</th><th>Colour</th><th>Size</th><th class="c">Qty</th></tr></thead><tbody>${rows || '<tr><td colspan="6" class="muted">No items to pack (order cancelled).</td></tr>'}</tbody></table>
${o.giftWrap ? `<div class="note"><b>Gift wrap this order.</b>${o.giftMessage ? ' Message card: “' + esc(o.giftMessage) + '”' : ''}</div>` : o.giftMessage ? `<div class="note"><b>Gift message:</b> ${esc(o.giftMessage)}</div>` : ''}
${o.measurements ? `<div class="note"><b>Custom measurements:</b> ${esc(o.measurements)}</div>` : ''}
<div class="sign"><div>Packed by</div><div>Checked by</div><div>Date</div></div>`);
}

/** Open a document in a new window and show the print dialog (falls back to a hidden frame if pop-ups are blocked). */
export function printHtml(html: string) {
  const w = window.open('', '_blank', 'width=900,height=1000');
  if (w) { w.document.open(); w.document.write(html); w.document.close(); w.focus(); setTimeout(() => w.print(), 300); return; }
  const f = document.createElement('iframe');
  f.style.cssText = 'position:fixed;width:0;height:0;border:0;right:0;bottom:0';
  document.body.appendChild(f);
  const d = f.contentDocument!; d.open(); d.write(html); d.close();
  setTimeout(() => { f.contentWindow?.print(); setTimeout(() => f.remove(), 2000); }, 300);
}
