// Shared order rules for the server, the admin and the customer account page.
// Money is stored in dirhams x100 (fils), like the rest of the store.

export const FULFILMENT_FLOW = ['Confirmed', 'Packing', 'Shipped', 'Delivered', 'Completed'] as const;
export const ORDER_STATUSES = [...FULFILMENT_FLOW, 'Cancelled'] as const;
export type OrderStatus = typeof ORDER_STATUSES[number];

export type OrderLine = {variant: string; qty: number; price: number; name: string; size?: string; colour?: string; image?: string; code?: string; cancelledQty?: number};
export type OrderEvent = {at: string; type: string; message: string; by?: string; internal?: boolean};
export type Order = {
  id: string; created?: string; owner?: string | null; name: string; email: string; phone?: string; address?: string;
  addressDetails?: Record<string, string>; slot?: string; items: OrderLine[];
  subtotal: number; discount: number; shipping: number; giftWrap?: boolean; giftMessage?: string; measurements?: string;
  total: number; currency?: string; source?: string; status: string; payment?: string; paid?: boolean;
  tracking?: string; carrier?: string; version?: number; timeline?: OrderEvent[];
  originalSubtotal?: number; originalDiscount?: number; originalTotal?: number;
  refundDue?: number; refunded?: number; cancelReason?: string; syncStatus?: string;
};

export const WRAP_FEE = 1000;
export const activeQty = (l: OrderLine) => Math.max(0, l.qty - (l.cancelledQty || 0));
export const itemCount = (o: Order) => o.items.reduce((n, l) => n + activeQty(l), 0);
export const isCancelled = (o: Order) => o.status === 'Cancelled';
export const isFulfilled = (o: Order) => ['Shipped', 'Delivered', 'Completed'].includes(o.status);

/** Customers may cancel (whole or items) only before the order is being packed. */
export const customerCanCancel = (o: Order) => o.status === 'Confirmed' && o.source !== 'POS';
/** Staff may cancel until it has left the store. */
export const staffCanCancel = (o: Order) => ['Confirmed', 'Packing'].includes(o.status) || (o.source === 'POS' && o.status === 'Completed');

/**
 * Apply cancellations: `cancel` maps variant -> extra quantity to cancel (omit to cancel
 * everything left). Returns the updated order and what to put back into stock.
 * The discount keeps the original rate; delivery and gift wrap are dropped only when
 * nothing is left. If the order was already paid, the difference becomes a refund due.
 */
export function applyCancellation(o: Order, cancel?: Record<string, number>) {
  const restock: {variant: string; qty: number}[] = [];
  const items = o.items.map(l => {
    const left = activeQty(l);
    const want = cancel ? Math.min(left, Math.max(0, Math.floor(Number(cancel[l.variant]) || 0))) : left;
    if (want > 0) restock.push({variant: l.variant, qty: want});
    return want > 0 ? {...l, cancelledQty: (l.cancelledQty || 0) + want} : l;
  });
  const originalSubtotal = o.originalSubtotal ?? o.subtotal, originalDiscount = o.originalDiscount ?? o.discount;
  const subtotal = items.reduce((n, l) => n + l.price * activeQty(l), 0);
  const allGone = items.every(l => activeQty(l) === 0);
  const discount = originalSubtotal ? Math.round(subtotal * originalDiscount / originalSubtotal) : 0;
  const shipping = allGone ? 0 : o.shipping, wrap = !allGone && o.giftWrap ? WRAP_FEE : 0;
  const total = subtotal - discount + shipping + wrap;
  const refundDue = (o.refundDue || 0) + (o.paid ? Math.max(0, o.total - total) : 0);
  const next: Order = {...o, items, subtotal, discount, shipping, total, refundDue,
    originalSubtotal, originalDiscount, originalTotal: o.originalTotal ?? o.total,
    status: allGone ? 'Cancelled' : o.status};
  return {order: next, restock, allGone, cancelledUnits: restock.reduce((n, r) => n + r.qty, 0)};
}

export function addEvent(o: Order, e: Omit<OrderEvent, 'at'>): Order {
  return {...o, timeline: [...(o.timeline || []), {at: new Date().toISOString(), ...e}].slice(-200)};
}

/** Order timeline including the creation event for orders saved before timelines existed. */
export function timelineOf(o: Order, includeInternal = true): OrderEvent[] {
  const list = o.timeline?.length ? o.timeline : [{at: o.created || new Date().toISOString(), type: 'created', message: 'Order placed'}];
  return list.filter(e => includeInternal || !e.internal);
}

export type PaymentState = {label: string; tone: 'green' | 'amber' | 'red' | ''};
export function paymentState(o: Order): PaymentState {
  if (o.refundDue) return {label: 'Refund due', tone: 'red'};
  if (o.paid) return {label: o.refunded ? 'Partially refunded' : 'Paid', tone: 'green'};
  if (isCancelled(o)) return {label: 'Voided', tone: ''};
  return {label: 'Payment pending', tone: 'amber'};
}
export function fulfilmentState(o: Order): PaymentState {
  if (isCancelled(o)) return {label: 'Cancelled', tone: 'red'};
  if (o.status === 'Confirmed') return {label: 'Unfulfilled', tone: 'amber'};
  if (o.status === 'Packing') return {label: 'Packing', tone: 'amber'};
  return {label: o.status, tone: 'green'};
}

// ---- Customer messages (email subject/body text and WhatsApp text) ----
export type NotifyEvent = 'confirmed' | 'packing' | 'shipped' | 'delivered' | 'cancelled' | 'items_cancelled' | 'refund';
export const NOTIFY_EVENTS: {key: NotifyEvent; label: string}[] = [
  {key: 'confirmed', label: 'Order confirmation'}, {key: 'packing', label: 'Being packed'},
  {key: 'shipped', label: 'Shipped / out for delivery'}, {key: 'delivered', label: 'Delivered'},
  {key: 'cancelled', label: 'Order cancelled'}, {key: 'items_cancelled', label: 'Items cancelled'},
  {key: 'refund', label: 'Refund issued'},
];
export const statusEvent = (status: string): NotifyEvent | null =>
  ({Confirmed: 'confirmed', Packing: 'packing', Shipped: 'shipped', Delivered: 'delivered', Cancelled: 'cancelled'} as Record<string, NotifyEvent>)[status] || null;

const qar = (fils: number) => 'QAR ' + (fils / 100).toLocaleString('en-QA', {maximumFractionDigits: 2});

export function customerMessage(o: Order, event: NotifyEvent, storeName = '4L Fashion') {
  const first = String(o.name || '').split(' ')[0] || 'there';
  const lines: Record<NotifyEvent, [string, string]> = {
    confirmed: ['Your order ' + o.id + ' is confirmed', `Thank you for your order. We have received it and will let you know when it is on its way. Total: ${qar(o.total)} (${o.payment || 'Cash on delivery'}).`],
    packing: ['Your order ' + o.id + ' is being packed', 'Good news: your order is being carefully packed.'],
    shipped: ['Your order ' + o.id + ' is on its way', 'Your order has left our store and is on its way to you.' + (o.carrier || o.tracking ? ` ${o.carrier || 'Courier'}${o.tracking ? ' · tracking ' + o.tracking : ''}.` : '')],
    delivered: ['Your order ' + o.id + ' has been delivered', 'Your order has been delivered. We hope you love it. Reply to us if anything is not quite right.'],
    cancelled: ['Your order ' + o.id + ' has been cancelled', 'Your order has been cancelled.' + (o.cancelReason ? ' Reason: ' + o.cancelReason + '.' : '') + (o.refundDue ? ` A refund of ${qar(o.refundDue)} is due and our team will arrange it.` : '')],
    items_cancelled: ['Items cancelled from order ' + o.id, `Some items in your order were cancelled. Your new order total is ${qar(o.total)}.` + (o.refundDue ? ` A refund of ${qar(o.refundDue)} is due.` : '')],
    refund: ['Refund for order ' + o.id, 'Your refund has been issued. It may take a few days to appear.'],
  };
  const [subject, body] = lines[event];
  return {subject: subject + ' · ' + storeName, greeting: `Hi ${first},`, body, whatsapp: `Hi ${first}, ${body} Order ${o.id} · ${storeName}`};
}

/** International number for WhatsApp: digits only; Qatar 8-digit numbers get +974. */
export function whatsappNumber(phone?: string) {
  const d = String(phone || '').replace(/\D/g, '').replace(/^00/, '');
  return d.length === 8 ? '974' + d : d;
}
