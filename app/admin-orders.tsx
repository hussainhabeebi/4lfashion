"use client";
import {useMemo, useState} from 'react';
import {ArrowLeft, Ban, CheckCircle2, Clock, Copy, Mail, MessageCircle, Package, Phone, Printer, Send, StickyNote, Truck, Undo2} from 'lucide-react';
import {activeQty, customerMessage, FULFILMENT_FLOW, fulfilmentState, itemCount, NOTIFY_EVENTS, paymentState, staffCanCancel, statusEvent, timelineOf, whatsappNumber, type NotifyEvent, type Order} from '../lib/orders';
import {invoiceHtml, packingHtml, printHtml} from './order-docs';

const qar = (fils: number) => 'QAR ' + (fils / 100).toLocaleString('en-QA', {maximumFractionDigits: 2});
const when = (iso?: string) => new Date(iso || Date.now()).toLocaleString('en-GB', {day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'});
type Run = (action: string, data: Record<string, unknown>) => Promise<{order?: Order; notifications?: {channel: string; ok: boolean; skipped?: boolean; error?: string}[]} | undefined>;
type Props = {orders: Order[]; products: {id: string; code?: string}[]; variants: {id: string; product: string}[]; settings: Record<string, unknown>;
  notifyConfig?: {email: boolean; whatsapp: boolean; whatsappTemplate?: boolean}; run: Run; busy: boolean; notify: (m: string) => void; query: string;
  selected: Order | null; onSelect: (o: Order | null) => void};

const TABS: {key: string; label: string; test: (o: Order) => boolean}[] = [
  {key: 'all', label: 'All', test: () => true},
  {key: 'unfulfilled', label: 'Unfulfilled', test: o => ['Confirmed', 'Packing'].includes(o.status)},
  {key: 'unpaid', label: 'Unpaid', test: o => !o.paid && o.status !== 'Cancelled'},
  {key: 'shipped', label: 'Shipped', test: o => o.status === 'Shipped'},
  {key: 'done', label: 'Delivered & completed', test: o => ['Delivered', 'Completed'].includes(o.status)},
  {key: 'refund', label: 'Refund due', test: o => !!o.refundDue},
  {key: 'cancelled', label: 'Cancelled', test: o => o.status === 'Cancelled'},
];

/** Summarise notification results for a toast. */
function sendSummary(results?: {channel: string; ok: boolean; skipped?: boolean; error?: string}[]) {
  if (!results?.length) return '';
  return results.map(r => (r.channel === 'email' ? 'Email' : 'WhatsApp') + (r.ok ? ' sent' : r.skipped ? ' not set up' : ' failed')).join(' · ');
}

export default function OrdersPage(props: Props) {
  const {orders, query, selected, onSelect} = props;
  const [tab, setTab] = useState('all');
  const list = useMemo(() => {
    const q = query.trim().toLowerCase(), t = TABS.find(x => x.key === tab)!;
    return orders.filter(o => t.test(o) && (!q || [o.id, o.name, o.email, o.phone, o.address, ...o.items.map(l => l.name)].join(' ').toLowerCase().includes(q)));
  }, [orders, tab, query]);
  const current = selected ? orders.find(o => o.id === selected.id) || selected : null;
  if (current) return <OrderDetail {...props} order={current} back={() => onSelect(null)}/>;
  return <section className="panel orders-page">
    <div className="order-tabs">{TABS.map(t => { const n = orders.filter(t.test).length; return (t.key === 'all' || t.key === tab || n > 0) &&
      <button key={t.key} className={tab === t.key ? 'on' : ''} onClick={() => setTab(t.key)}>{t.label}<span>{n}</span></button>; })}</div>
    <div className="table-scroll"><table className="orders-table"><thead><tr><th>Order</th><th>Date</th><th>Customer</th><th>Channel</th><th>Payment</th><th>Fulfilment</th><th>Items</th><th className="num">Total</th></tr></thead>
      <tbody>{list.map(o => { const pay = paymentState(o), ful = fulfilmentState(o); return <tr key={o.id} onClick={() => onSelect(o)} className="clickable">
        <td><b>{o.id}</b></td><td>{when(o.created)}</td><td>{o.name}<small className="block muted">{o.phone || o.email}</small></td><td>{o.source || 'Online'}</td>
        <td><span className={'badge ' + pay.tone}>{pay.label}</span></td><td><span className={'badge ' + ful.tone}>{o.syncStatus || ful.label}</span></td>
        <td>{itemCount(o)}</td><td className="num">{qar(o.total)}</td></tr>; })}</tbody></table>
      {!list.length && <p className="empty">{orders.length ? 'No orders match this view.' : 'No orders yet.'}</p>}</div>
  </section>;
}

function OrderDetail({order: o, back, run, busy, notify, settings, notifyConfig, products, variants, orders}: Props & {order: Order; back: () => void}) {
  const [cancelMode, setCancelMode] = useState<null | 'items' | 'all'>(null);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [reason, setReason] = useState(''), [tellCustomer, setTellCustomer] = useState(true);
  const [carrier, setCarrier] = useState(o.carrier || ''), [tracking, setTracking] = useState(o.tracking || '');
  const [note, setNote] = useState(''), [event, setEvent] = useState<NotifyEvent>(statusEvent(o.status) || 'confirmed');
  const pay = paymentState(o), ful = fulfilmentState(o), cancelled = o.status === 'Cancelled';
  const codes = useMemo(() => Object.fromEntries(variants.map(v => [v.id, products.find(p => p.id === v.product)?.code || ''])), [products, variants]);
  const step = FULFILMENT_FLOW.indexOf(o.status as typeof FULFILMENT_FLOW[number]);
  const pastOrders = orders.filter(x => x.email === o.email).length;
  const msg = customerMessage(o, event, String(settings.name || '4L Fashion'));

  async function act(action: string, data: Record<string, unknown>, done?: () => void) {
    try { const r = await run(action, {id: o.id, ...data}); const s = sendSummary(r?.notifications); if (s) notify(s); done?.(); } catch { /* run() shows the error */ }
  }
  const setStatus = (status: string, extra: Record<string, unknown> = {}) => act('orderStatus', {status, notify: tellCustomer, ...extra});
  const doc = (kind: 'invoice' | 'packing') => printHtml((kind === 'invoice' ? invoiceHtml : packingHtml)(o, settings, codes));
  const copy = (text: string) => { navigator.clipboard?.writeText(text).then(() => notify('Copied'), () => notify(text)); };
  const ad = o.addressDetails || {};
  const nextAction = !cancelled && ({
    Confirmed: {label: 'Start packing', icon: <Package size={16}/>, run: () => setStatus('Packing')},
    Packing: {label: 'Mark as shipped', icon: <Truck size={16}/>, run: () => setStatus('Shipped', {carrier, tracking})},
    Shipped: {label: 'Mark as delivered', icon: <CheckCircle2 size={16}/>, run: () => setStatus('Delivered')},
    Delivered: {label: 'Complete order', icon: <CheckCircle2 size={16}/>, run: () => setStatus('Completed')},
  } as Record<string, {label: string; icon: React.ReactNode; run: () => void}>)[o.status];

  return <div className="order-detail">
    <div className="order-head">
      <button className="text-link" onClick={back}><ArrowLeft size={15}/> Orders</button>
      <div className="order-title"><h2>{o.id}</h2><span className={'badge ' + pay.tone}>{pay.label}</span><span className={'badge ' + ful.tone}>{ful.label}</span></div>
      <p className="muted">{when(o.created)} · {o.source || 'Online'} · {o.payment}</p>
      <div className="order-actions">
        <button className="outline" onClick={() => doc('invoice')}><Printer size={15}/> Invoice</button>
        {o.source !== 'POS' && <button className="outline" onClick={() => doc('packing')}><Printer size={15}/> Packing list</button>}
        {staffCanCancel(o) && <button className="outline danger" onClick={() => { setCancelMode('all'); setReason(''); }}><Ban size={15}/> Cancel order</button>}
      </div>
    </div>

    {cancelMode === 'all' && <section className="panel cancel-box">
      <h3>Cancel the whole order?</h3><p className="muted">All {itemCount(o)} remaining item(s) go back into stock.{o.paid ? ` ${qar(o.total)} will be marked as refund due.` : ''}</p>
      <label>Reason (shown to the customer)<input value={reason} maxLength={300} onChange={e => setReason(e.target.value)} placeholder="e.g. Out of stock, customer request"/></label>
      <label className="check"><input type="checkbox" checked={tellCustomer} onChange={e => setTellCustomer(e.target.checked)}/> Notify the customer</label>
      <div className="row-actions"><button className="primary danger-fill" disabled={busy} onClick={() => act('orderCancel', {reason, notify: tellCustomer}, () => setCancelMode(null))}>Cancel order</button><button className="text-link" onClick={() => setCancelMode(null)}>Keep order</button></div>
    </section>}

    <div className="order-grid">
      <div className="order-main">
        <section className="panel">
          <div className="between"><h3>Items <span className={'badge ' + ful.tone}>{ful.label}</span></h3>
            {staffCanCancel(o) && itemCount(o) > 0 && cancelMode !== 'items' && <button className="text-link" onClick={() => { setCancelMode('items'); setQty({}); setReason(''); }}>Cancel items</button>}</div>
          {o.items.map(l => { const left = activeQty(l); return <div className={'order-line' + (left ? '' : ' gone')} key={l.variant}>
            {l.image ? <img src={l.image} alt=""/> : <span className="thumb"/>}
            <div><b>{l.name}</b><small className="block muted">{[l.colour, l.size].filter(Boolean).join(' / ')}{(l.code || codes[l.variant]) ? ' · SKU ' + (l.code || codes[l.variant]) : ''}</small>
              {l.cancelledQty ? <small className="block cancelled-note">{l.cancelledQty} cancelled</small> : null}</div>
            {cancelMode === 'items' && left > 0
              ? <label className="qty-pick">Cancel<select value={qty[l.variant] || 0} onChange={e => setQty({...qty, [l.variant]: Number(e.target.value)})}>{Array.from({length: left + 1}, (_, i) => <option key={i} value={i}>{i}</option>)}</select></label>
              : <span className="muted">{qar(l.price)} × {left}</span>}
            <b className="num">{qar(l.price * left)}</b>
          </div>; })}
          {cancelMode === 'items' && <div className="cancel-box inline">
            <label>Reason (shown to the customer)<input value={reason} maxLength={300} onChange={e => setReason(e.target.value)} placeholder="e.g. Size out of stock"/></label>
            <label className="check"><input type="checkbox" checked={tellCustomer} onChange={e => setTellCustomer(e.target.checked)}/> Notify the customer</label>
            <div className="row-actions"><button className="primary" disabled={busy || !Object.values(qty).some(Boolean)} onClick={() => act('orderCancel', {items: qty, reason, notify: tellCustomer}, () => setCancelMode(null))}>Cancel selected items</button>
              <button className="text-link" onClick={() => setCancelMode(null)}>Back</button></div>
            <p className="muted">Cancelled items go back into stock and the order total is recalculated.</p>
          </div>}
        </section>

        {!cancelled && o.source !== 'POS' && <section className="panel">
          <h3>Fulfilment</h3>
          <ol className="stepper">{FULFILMENT_FLOW.map((s, i) => <li key={s} className={i < step ? 'done' : i === step ? 'now' : ''}><span>{i < step ? '✓' : i + 1}</span>{s}</li>)}</ol>
          {['Packing', 'Shipped'].includes(o.status) && <div className="form-grid">
            <label>Courier<input value={carrier} onChange={e => setCarrier(e.target.value)} placeholder="e.g. Aramex, own driver"/></label>
            <label>Tracking number<input value={tracking} onChange={e => setTracking(e.target.value)} placeholder="Optional"/></label></div>}
          <div className="row-actions">
            {nextAction && <button className="primary" disabled={busy} onClick={nextAction.run}>{nextAction.icon} {nextAction.label}</button>}
            {o.status === 'Shipped' && (carrier !== (o.carrier || '') || tracking !== (o.tracking || '')) && <button className="outline" disabled={busy} onClick={() => act('orderStatus', {status: o.status, carrier, tracking, notify: false})}>Save tracking</button>}
            <label className="check"><input type="checkbox" checked={tellCustomer} onChange={e => setTellCustomer(e.target.checked)}/> Send update to customer</label>
          </div>
          {step > 0 && <details className="muted-details"><summary>Change status manually</summary><div className="row-actions">{FULFILMENT_FLOW.filter(s => s !== o.status).map(s =>
            <button key={s} className="text-link" disabled={busy} onClick={() => setStatus(s)}>{s}</button>)}</div></details>}
        </section>}

        <section className="panel">
          <div className="between"><h3>Payment <span className={'badge ' + pay.tone}>{pay.label}</span></h3><span className="muted">{o.payment}</span></div>
          <div className="pay-rows">
            <div><span>Subtotal · {itemCount(o)} item(s)</span><span>{qar(o.subtotal)}</span></div>
            {o.discount > 0 && <div><span>Discount</span><span>−{qar(o.discount)}</span></div>}
            <div><span>Delivery</span><span>{qar(o.shipping)}</span></div>
            {o.giftWrap && !cancelled && <div><span>Gift wrapping</span><span>{qar(1000)}</span></div>}
            <div className="total"><span>Total</span><span>{qar(o.total)}</span></div>
            {o.originalTotal !== undefined && o.originalTotal !== o.total && <div className="muted"><span>Original total</span><span>{qar(o.originalTotal)}</span></div>}
            {o.refunded ? <div className="muted"><span>Refunded</span><span>{qar(o.refunded)}</span></div> : null}
            {o.refundDue ? <div className="refund"><span>Refund due</span><span>{qar(o.refundDue)}</span></div> : null}
          </div>
          <div className="row-actions">
            {!cancelled && !o.paid && <button className="primary" disabled={busy} onClick={() => act('orderStatus', {status: o.status, paid: true, notify: false})}>Mark as paid</button>}
            {!cancelled && o.paid && <button className="text-link" disabled={busy} onClick={() => act('orderStatus', {status: o.status, paid: false, notify: false})}>Mark as unpaid</button>}
            {o.refundDue ? <button className="primary" disabled={busy} onClick={() => act('orderRefund', {method: o.payment, notify: tellCustomer})}><Undo2 size={15}/> Mark refund of {qar(o.refundDue)} as issued</button> : null}
          </div>
        </section>

        <section className="panel">
          <h3>Timeline</h3>
          <div className="note-box"><input value={note} onChange={e => setNote(e.target.value)} placeholder="Add a staff note (customers don’t see this)…" onKeyDown={e => { if (e.key === 'Enter' && note.trim()) act('orderNote', {note}, () => setNote('')); }}/>
            <button className="outline" disabled={busy || !note.trim()} onClick={() => act('orderNote', {note}, () => setNote(''))}><StickyNote size={15}/> Add note</button></div>
          <ul className="timeline">{[...timelineOf(o)].reverse().map((e, i) => <li key={i} className={e.type}>
            <span className="dot"/><div><p>{e.message}{e.internal && <span className="badge">Staff only</span>}</p><small className="muted"><Clock size={11}/> {when(e.at)}{e.by ? ' · ' + e.by : ''}</small></div></li>)}</ul>
        </section>
      </div>

      <aside className="order-side">
        <section className="panel">
          <h3>Customer</h3>
          <p><b>{o.name}</b><small className="block muted">{pastOrders} order{pastOrders === 1 ? '' : 's'}</small></p>
          <p className="contact"><Mail size={14}/> <a href={'mailto:' + o.email}>{o.email}</a></p>
          {o.phone && <p className="contact"><Phone size={14}/> <a href={'tel:' + o.phone.replace(/[^+\d]/g, '')}>{o.phone}</a> · <a href={'https://wa.me/' + whatsappNumber(o.phone)} target="_blank" rel="noreferrer">WhatsApp</a></p>}
        </section>
        {o.source !== 'POS' && <section className="panel">
          <div className="between"><h3>Delivery address</h3><button className="text-link" onClick={() => copy(o.address || '')}><Copy size={13}/> Copy</button></div>
          {ad.addrBuilding ? <dl className="addr">
            {ad.addrFlat && <><dt>Flat</dt><dd>{ad.addrFlat}</dd></>}<dt>Building</dt><dd>{ad.addrBuilding}</dd><dt>Street</dt><dd>{ad.addrStreet}</dd><dt>Zone</dt><dd>{ad.addrZone}</dd><dt>Area</dt><dd>{ad.area}</dd>
            {ad.addrLandmark && <><dt>Landmark</dt><dd>{ad.addrLandmark}</dd></>}</dl> : <p>{o.address}</p>}
          {o.slot && <p className="muted">Delivery time: {o.slot}</p>}
        </section>}
        {(o.giftMessage || o.measurements || o.giftWrap || o.cancelReason) && <section className="panel">
          <h3>Notes</h3>
          {o.giftWrap && <p><b>Gift wrap</b> requested</p>}{o.giftMessage && <p><b>Gift message:</b> {o.giftMessage}</p>}
          {o.measurements && <p><b>Custom measurements:</b> {o.measurements}</p>}{o.cancelReason && <p><b>Cancellation reason:</b> {o.cancelReason}</p>}
        </section>}
        <section className="panel notify-card">
          <h3>Message the customer</h3>
          <label>Message<select value={event} onChange={e => setEvent(e.target.value as NotifyEvent)}>{NOTIFY_EVENTS.map(x => <option key={x.key} value={x.key}>{x.label}</option>)}</select></label>
          <p className="preview">{msg.whatsapp}</p>
          <div className="notify-buttons">
            {notifyConfig?.email ? <button className="outline" disabled={busy} onClick={() => act('orderNotify', {event, channels: ['email']})}><Send size={14}/> Send email</button>
              : <a className="outline" href={'mailto:' + o.email + '?subject=' + encodeURIComponent(msg.subject) + '&body=' + encodeURIComponent(msg.greeting + '\n\n' + msg.body)}><Mail size={14}/> Open in email</a>}
            {notifyConfig?.whatsapp ? <button className="outline" disabled={busy || !o.phone} onClick={() => act('orderNotify', {event, channels: ['whatsapp']})}><Send size={14}/> Send WhatsApp</button>
              : <a className={'outline' + (o.phone ? '' : ' disabled')} href={'https://wa.me/' + whatsappNumber(o.phone) + '?text=' + encodeURIComponent(msg.whatsapp)} target="_blank" rel="noreferrer"><MessageCircle size={14}/> Open in WhatsApp</a>}
          </div>
          <p className="muted small">{notifyConfig?.email || notifyConfig?.whatsapp ? 'Automatic: ' + [notifyConfig.email && 'email', notifyConfig.whatsapp && 'WhatsApp'].filter(Boolean).join(' & ') + '. ' : ''}
            {!(notifyConfig?.email && notifyConfig?.whatsapp) && 'Set up automatic sending in Settings → Notifications.'}</p>
        </section>
      </aside>
    </div>
  </div>;
}
