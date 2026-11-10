"use client";
import {useState} from 'react';
import {ArrowLeft, Ban, Check, FileText, MessageCircle, Package, Truck} from 'lucide-react';
import {activeQty, customerCanCancel, itemCount, timelineOf, type Order} from '../lib/orders';
import {invoiceHtml, printHtml} from './order-docs';

const qar = (fils: number) => 'QAR ' + (fils / 100).toLocaleString('en-QA', {maximumFractionDigits: 2});
const day = (iso?: string) => new Date(iso || Date.now()).toLocaleDateString('en-GB', {day: 'numeric', month: 'short', year: 'numeric'});
const STEPS = [{key: 'Confirmed', label: 'Confirmed', icon: Check}, {key: 'Packing', label: 'Being packed', icon: Package}, {key: 'Shipped', label: 'On its way', icon: Truck}, {key: 'Delivered', label: 'Delivered', icon: Check}];
const stepOf = (s: string) => s === 'Completed' ? 3 : STEPS.findIndex(x => x.key === s);
const label = (s: string) => s === 'Cancelled' ? 'Cancelled' : STEPS[stepOf(s)]?.label || s;

type Api = (action: string, data?: Record<string, unknown>) => Promise<{order?: Order}>;
export default function AccountOrders({orders, cfg, api, toast, onUpdate}: {orders: Order[]; cfg: Record<string, unknown>; api: Api; toast: (m: string) => void; onUpdate: (o: Order) => void}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = orders.find(o => o.id === openId);
  if (open) return <OrderView o={open} cfg={cfg} api={api} toast={toast} onUpdate={onUpdate} back={() => setOpenId(null)}/>;
  if (!orders.length) return <p>No orders yet. Guest orders can be found using Track order.</p>;
  return <div className="my-orders">{orders.map(o => <button className="my-order-card" key={o.id} onClick={() => setOpenId(o.id)}>
    <div className="between"><b>{o.id}</b><span className={'badge ' + (o.status === 'Cancelled' ? 'red' : ['Delivered', 'Completed'].includes(o.status) ? 'green' : '')}>{label(o.status)}</span></div>
    <div className="thumbs">{o.items.slice(0, 4).map(l => l.image ? <img key={l.variant} src={l.image} alt=""/> : <span key={l.variant}/>)}</div>
    <div className="between muted"><span>{day(o.created)} · {itemCount(o)} item{itemCount(o) === 1 ? '' : 's'}</span><b>{qar(o.total)}</b></div>
    <span className="text-link">View order →</span>
  </button>)}</div>;
}

function OrderView({o, cfg, api, toast, onUpdate, back}: {o: Order; cfg: Record<string, unknown>; api: Api; toast: (m: string) => void; onUpdate: (o: Order) => void; back: () => void}) {
  const [mode, setMode] = useState<null | 'all' | 'items'>(null);
  const [qty, setQty] = useState<Record<string, number>>({}), [reason, setReason] = useState(''), [busy, setBusy] = useState(false);
  const step = stepOf(o.status), cancelled = o.status === 'Cancelled', canCancel = customerCanCancel(o);
  const wa = String(cfg.whatsapp || '').replace(/\D/g, '');
  async function cancel(items?: Record<string, number>) {
    setBusy(true);
    try { const r = await api('orderCancel', {id: o.id, items, reason}); if (r.order) onUpdate(r.order); setMode(null); toast(items ? 'Items cancelled. We have emailed you the update.' : 'Your order has been cancelled.'); }
    catch (e) { toast(e instanceof Error ? e.message : 'Could not cancel'); } finally { setBusy(false); }
  }
  return <div className="my-order">
    <button className="text-link" onClick={back}><ArrowLeft size={15}/> All orders</button>
    <div className="between"><div><h2>Order {o.id}</h2><p className="muted">Placed {day(o.created)} · {o.payment}</p></div>
      <button className="outline" onClick={() => printHtml(invoiceHtml(o, cfg))}><FileText size={15}/> Invoice</button></div>

    {cancelled ? <div className="order-banner cancelled"><Ban size={18}/><div><b>This order was cancelled.</b>{o.cancelReason && <p>Reason: {o.cancelReason}</p>}{o.refundDue ? <p>A refund of {qar(o.refundDue)} is on its way.</p> : null}</div></div>
      : <ol className="track-steps">{STEPS.map((s, i) => <li key={s.key} className={i < step ? 'done' : i === step ? 'now' : ''}><span><s.icon size={14}/></span>{s.label}</li>)}</ol>}
    {!cancelled && (o.carrier || o.tracking) && <p className="muted">Courier: {[o.carrier, o.tracking && 'tracking ' + o.tracking].filter(Boolean).join(' · ')}</p>}

    <section className="my-order-items">
      {o.items.map(l => { const left = activeQty(l); return <div key={l.variant} className={'order-line' + (left ? '' : ' gone')}>
        {l.image ? <img src={l.image} alt=""/> : <span className="thumb"/>}
        <div><b>{l.name}</b><small className="block muted">{[l.colour, l.size].filter(Boolean).join(' / ')} · Qty {left}</small>{l.cancelledQty ? <small className="block cancelled-note">{l.cancelledQty} cancelled</small> : null}</div>
        {mode === 'items' && left > 0 ? <label className="qty-pick">Cancel<select value={qty[l.variant] || 0} onChange={e => setQty({...qty, [l.variant]: Number(e.target.value)})}>{Array.from({length: left + 1}, (_, i) => <option key={i} value={i}>{i}</option>)}</select></label>
          : <b>{qar(l.price * left)}</b>}
      </div>; })}
      <div className="pay-rows">
        <div><span>Subtotal</span><span>{qar(o.subtotal)}</span></div>{o.discount > 0 && <div><span>Discount</span><span>−{qar(o.discount)}</span></div>}
        <div><span>Delivery</span><span>{qar(o.shipping)}</span></div>{o.giftWrap && !cancelled && <div><span>Gift wrapping</span><span>{qar(1000)}</span></div>}
        <div className="total"><span>Total</span><span>{qar(o.total)}</span></div>
      </div>
    </section>

    {mode && <div className="cancel-box">
      <h3>{mode === 'all' ? 'Cancel this order?' : 'Choose the items to cancel'}</h3>
      <label>Reason (optional)<input value={reason} maxLength={300} onChange={e => setReason(e.target.value)} placeholder="e.g. Ordered the wrong size"/></label>
      <div className="row-actions">
        {mode === 'all' ? <button className="primary" disabled={busy} onClick={() => cancel()}>Yes, cancel order</button>
          : <button className="primary" disabled={busy || !Object.values(qty).some(Boolean)} onClick={() => cancel(qty)}>Cancel selected items</button>}
        <button className="text-link" onClick={() => setMode(null)}>Keep my order</button></div>
    </div>}

    <div className="my-order-actions">
      {canCancel && !mode && <><button className="outline" onClick={() => { setMode('all'); setReason(''); }}>Cancel order</button>
        {itemCount(o) > 1 && <button className="outline" onClick={() => { setMode('items'); setQty({}); setReason(''); }}>Cancel some items</button>}</>}
      {wa && <a className="outline" href={'https://wa.me/' + wa + '?text=' + encodeURIComponent('Hi 4L Fashion, I have a question about my order ' + o.id)} target="_blank" rel="noreferrer"><MessageCircle size={15}/> Help with this order</a>}
    </div>
    {!cancelled && !canCancel && !['Delivered', 'Completed'].includes(o.status) && <p className="muted small">Your order is already being prepared, so it can’t be cancelled online. Message us on WhatsApp and we’ll help.</p>}

    <div className="my-order-info">
      {o.address && o.source !== 'POS' && <div><h3>Delivery address</h3><p>{o.address}</p>{o.slot && <p className="muted">{o.slot}</p>}</div>}
      <div><h3>Updates</h3><ul className="timeline">{[...timelineOf(o, false)].reverse().map((e, i) => <li key={i}><span className="dot"/><div><p>{e.message}</p><small className="muted">{day(e.at)}</small></div></li>)}</ul></div>
    </div>

    {['Delivered', 'Completed'].includes(o.status) && <details className="return-request"><summary>Request a return or size exchange</summary>
      <form onSubmit={async e => { e.preventDefault(); try { await api('return', {data: {...Object.fromEntries(new FormData(e.currentTarget)), orderId: o.id}}); toast('Request received. Our team will review it.'); } catch (err) { toast(err instanceof Error ? err.message : 'Could not send'); } }}>
        <select name="type"><option>Size exchange</option><option>Return</option></select>
        <textarea name="reason" required placeholder="Item, preferred size and reason"/><button className="outline">Submit request</button></form></details>}
  </div>;
}
