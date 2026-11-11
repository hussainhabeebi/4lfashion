"use client";
// Extra homepage sections: AI stylist search, AI tools, this month in Doha, personal picks,
// product rails, shop by price / colour, offers, services and the Doha store visit.
import {useEffect, useRef, useState, type ReactNode} from 'react';
import {Sparkles, ArrowUpRight, Search, Loader2, Thermometer, CalendarHeart, Camera, MapPin, Ruler, Heart, Clock, Tag, Copy, Truck, Phone, MessageCircle, Gift, PackageSearch, HelpCircle, BookOpen, Wand2} from 'lucide-react';
import {forYou, readViewed, priceBands, colourSwatches, swatchColour, discount, type HomeProduct} from '../lib/home';

type Api = (action: string, data?: Record<string, unknown>) => Promise<any>;
type Pick = {productId: string; name: string; price: number; image?: string; colour: string; fabric: string; why: string};
const err = (e: unknown, fallback: string) => e instanceof Error && e.message ? e.message : fallback;

export function SectionHead({eyebrow, title, action, onAction}: {eyebrow: string; title: string; action?: string; onAction?: () => void}) {
  return <div className="section-heading"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2></div>
    {action && onAction && <button className="text-link" onClick={onAction}>{action} <ArrowUpRight size={17}/></button>}</div>;
}

function PickCard({p, money, onOpen}: {p: Pick; money: (n: number) => string; onOpen: (id: string) => void}) {
  return <button className="h-pick" onClick={() => onOpen(p.productId)}>
    <span className="h-pick-img">{p.image && <img src={p.image} alt={p.name} loading="lazy"/>}</span>
    <span className="h-pick-body"><b>{p.name}</b><em>{money(p.price)}</em><small><Sparkles size={11}/> {p.why}</small></span>
  </button>;
}

// ---------- 1. Ask the 4L stylist (Workers AI) ----------
const SUGGESTIONS = ['Breezy kurta for the office in the heat', 'Eid outfit in gold under QAR 400', 'Something for a Kerala wedding, no black', 'Easy everyday co-ord for the mall'];
export function AskStylist({api, money, onOpen, notify}: {api: Api; money: (n: number) => string; onOpen: (id: string) => void; notify: (m: string) => void}) {
  const [q, setQ] = useState(''), [busy, setBusy] = useState(false), [res, setRes] = useState<any>(null), [asked, setAsked] = useState('');
  async function ask(text: string) {
    const question = text.trim();
    if (question.length < 3) return notify('Tell us a little more about what you are looking for.');
    setBusy(true); setQ(question);
    try { setRes(await api('styleSearch', {question})); setAsked(question); } catch (e) { notify(err(e, 'The stylist is busy. Please try again.')); } finally { setBusy(false); }
  }
  return <section className="h-ask" id="ask-stylist">
    <div className="h-ask-head">
      <span className="h-ai-badge"><Sparkles size={13}/> AI STYLIST</span>
      <h2>Tell us what you need. We’ll find it.</h2>
      <p>Describe the moment, the weather, your colours or your budget, in your own words.</p>
    </div>
    <form className="h-ask-form" onSubmit={e => { e.preventDefault(); ask(q); }}>
      <Search size={18}/>
      <input aria-label="Ask the 4L stylist" maxLength={300} placeholder="e.g. a light ivory kurta for work under QAR 200" value={q} onChange={e => setQ(e.target.value)}/>
      <button className="primary" disabled={busy}>{busy ? <Loader2 className="spin" size={16}/> : <Wand2 size={16}/>}<span>{busy ? 'Styling…' : 'Find my look'}</span></button>
    </form>
    <div className="h-chips">{SUGGESTIONS.map(s => <button key={s} type="button" disabled={busy} onClick={() => ask(s)}>{s}</button>)}</div>
    {busy && !res && <div className="h-pick-grid">{[0, 1, 2, 3].map(i => <div key={i} className="h-pick h-skeleton"/>)}</div>}
    {res && <div className={'h-ask-result' + (busy ? ' busy' : '')}>
      <p className="h-answer"><Sparkles size={15}/> <span><b>“{asked}”</b> {res.answer}</span></p>
      {res.tips?.length > 0 && <ul className="h-tips">{res.tips.map((t: string) => <li key={t}>{t}</li>)}</ul>}
      <div className="h-pick-grid">{(res.picks || []).map((p: Pick) => <PickCard key={p.productId} p={p} money={money} onOpen={onOpen}/>)}</div>
      <small className="muted">{res.source === 'ai' ? 'Styled by AI from pieces in stock now.' : 'Matched from pieces in stock now.'} Prices in QAR.</small>
    </div>}
  </section>;
}

// ---------- 2. AI studio: every AI tool in one place ----------
export function AiStudio({go, onFavourite}: {go: (p: string) => void; onFavourite: () => void}) {
  const tools: {icon: ReactNode; title: string; text: string; cta: string; run: () => void}[] = [
    {icon: <Wand2/>, title: 'Ask the stylist', text: 'Search in your own words: the occasion, the heat, your budget.', cta: 'Ask now', run: () => document.getElementById('ask-stylist')?.scrollIntoView({behavior: 'smooth', block: 'start'})},
    {icon: <CalendarHeart/>, title: 'Occasion planner', text: 'One wedding, three functions? Get a look planned for each event.', cta: 'Plan my looks', run: () => go('occasion-planner')},
    {icon: <Camera/>, title: 'Fits like my favourite', text: 'Photograph a piece that fits you well. We match your size.', cta: 'Match my size', run: onFavourite},
    {icon: <MapPin/>, title: 'Dress for Doha', text: 'Mall, office, majlis or National Day: what to wear, where.', cta: 'Ask the guide', run: () => go('qatar')},
  ];
  return <section className="h-studio">
    <SectionHead eyebrow="NEW · 4L AI STUDIO" title="Your personal stylist, always on."/>
    <div className="h-studio-grid">{tools.map(t => <button key={t.title} className="h-tool" onClick={t.run}>
      <span className="h-tool-icon">{t.icon}</span><b>{t.title}</b><p>{t.text}</p><em>{t.cta} <ArrowUpRight size={14}/></em></button>)}</div>
  </section>;
}

// ---------- 3. This month in Doha (cached Workers AI guide) ----------
export function DohaThisMonth({money, onOpen, go}: {money: (n: number) => string; onOpen: (id: string) => void; go: (p: string) => void}) {
  const [m, setM] = useState<any>(null);
  useEffect(() => { fetch('/api/store?action=qatarMonth').then(r => r.ok ? r.json() : null).then((d: any) => { if (d?.picks?.length) setM(d); }).catch(() => {}); }, []);
  if (!m) return null;
  const c = m.climate || {};
  return <section className="h-month">
    <div className="h-month-copy">
      <span className="h-ai-badge"><Sparkles size={13}/> AI EDIT · {String(c.month || '').toUpperCase()} IN DOHA</span>
      <h2>{m.headline || 'Dressed for this month.'}</h2>
      <div className="h-weather"><Thermometer size={16}/> {c.high}°C day · {c.low}°C night · {c.humidity} humidity</div>
      {m.intro && <p>{m.intro}</p>}
      {m.tips?.length > 0 && <ul className="h-tips">{m.tips.slice(0, 3).map((t: string) => <li key={t}>{t}</li>)}</ul>}
      <button className="text-link" onClick={() => go('qatar')}>More for life in Qatar <ArrowUpRight size={17}/></button>
    </div>
    <div className="h-pick-grid two">{m.picks.slice(0, 4).map((p: Pick) => <PickCard key={p.productId} p={p} money={money} onOpen={onOpen}/>)}</div>
  </section>;
}

// ---------- 4. Picked for you + recently viewed ----------
export function ForYou({catalog, saved, cart, card}: {catalog: HomeProduct[]; saved: string[]; cart: {product: string}[]; card: (p: any, i: number) => ReactNode}) {
  const [viewed, setViewed] = useState<string[]>([]);
  useEffect(() => setViewed(readViewed()), []);
  const picks = forYou(catalog, {saved, viewed, cart: cart.map(x => x.product)}, 4);
  const recent = viewed.map(id => catalog.find(p => p.id === id)).filter(Boolean).slice(0, 8) as HomeProduct[];
  if (!picks.length && !recent.length) return null;
  return <>
    {picks.length > 0 && <section className="h-foryou">
      <div className="section-heading"><div><span className="h-ai-badge"><Sparkles size={13}/> PICKED FOR YOU</span><h2>Chosen from what you love.</h2></div></div>
      <div className="h-rail">{picks.map((x, i) => <div className="h-rail-item" key={x.product.id}>{card(x.product, i + 4)}<small className="h-why"><Sparkles size={11}/> {x.why}</small></div>)}</div>
    </section>}
    {recent.length > 0 && <section className="h-recent">
      <SectionHead eyebrow="PICK UP WHERE YOU LEFT OFF" title="Recently viewed."/>
      <div className="h-rail">{recent.map((p, i) => <div className="h-rail-item" key={p.id}>{card(p, i + 4)}</div>)}</div>
    </section>}
  </>;
}

// ---------- 5. Product rail ----------
export function ProductRail({eyebrow, title, products, card, action, onAction, className = ''}: {eyebrow: string; title: string; products: HomeProduct[]; card: (p: any, i: number) => ReactNode; action?: string; onAction?: () => void; className?: string}) {
  const ref = useRef<HTMLDivElement>(null);
  if (!products.length) return null;
  return <section className={'h-rail-section ' + className}>
    <SectionHead eyebrow={eyebrow} title={title} action={action} onAction={onAction}/>
    <div className="h-rail" ref={ref}>{products.map((p, i) => <div className="h-rail-item" key={p.id}>{discount(p) > 0 && <span className="h-off">−{discount(p)}%</span>}{card(p, i + 4)}</div>)}</div>
  </section>;
}

// ---------- 6. Offer banner ----------
export function OfferBanner({cfg, notify, onShop}: {cfg: Record<string, any>; notify: (m: string) => void; onShop: () => void}) {
  const code = String(cfg.coupon || ''), pct = Number(cfg.couponPercent) || 0;
  if (!code || !pct) return null;
  const copy = () => { navigator.clipboard?.writeText(code).then(() => notify('Code ' + code + ' copied. Apply it at checkout.')).catch(() => notify('Use code ' + code + ' at checkout.')); };
  return <section className="h-offer">
    <div><span className="eyebrow">A LITTLE WELCOME GIFT</span><h2>{pct}% off your order.</h2><p>Use the code at checkout{Number(cfg.freeShipping) > 0 ? ` · Free delivery over QAR ${cfg.freeShipping}` : ''}. Cash on delivery across Qatar.</p></div>
    <div className="h-offer-actions"><button className="h-code" onClick={copy} aria-label={'Copy code ' + code}><Tag size={16}/> {code} <Copy size={14}/></button><button className="cream-button" onClick={onShop}>Shop now <ArrowUpRight size={17}/></button></div>
  </section>;
}

// ---------- 7. Shop by price / colour ----------
export function ShopByPrice({catalog, onShop}: {catalog: HomeProduct[]; onShop: (f: Record<string, unknown>) => void}) {
  const bands = priceBands(catalog);
  if (bands.length < 2) return null;
  return <section className="h-price">
    <SectionHead eyebrow="BEAUTIFUL AT EVERY BUDGET" title="Shop by price."/>
    <div className="h-price-grid">{bands.map(b => <button key={b.label} onClick={() => onShop(b.max ? {price: String(b.max - 1)} : {})}>
      {b.image && <img src={b.image} alt="" loading="lazy"/>}<span><small>{b.sub}</small><b>{b.label}</b><em>{b.count} {b.count === 1 ? 'piece' : 'pieces'} <ArrowUpRight size={14}/></em></span></button>)}</div>
  </section>;
}
export function ShopByColour({catalog, onShop}: {catalog: HomeProduct[]; onShop: (f: Record<string, unknown>) => void}) {
  const sw = colourSwatches(catalog);
  if (sw.length < 3) return null;
  return <section className="h-colours">
    <SectionHead eyebrow="FIND YOUR SHADE" title="Shop by colour."/>
    <div className="h-colour-row">{sw.map(c => <button key={c.name} onClick={() => onShop({colour: c.name})}>
      <span style={{background: swatchColour(c.name)}}/><b>{c.name}</b><small>{c.count}</small></button>)}</div>
  </section>;
}

// ---------- 8. The 4L promise ----------
export function Promise4L({sizes}: {sizes: string[]}) {
  const items = [
    {icon: <Ruler/>, title: `Sizes ${sizes[0]}–${sizes[sizes.length - 1]}`, text: 'Every piece in an inclusive size range, with a size chart and AI fit notes.'},
    {icon: <Truck/>, title: 'Delivery across Qatar', text: 'Cash on delivery, with order tracking from the moment you checkout.'},
    {icon: <Heart/>, title: 'Size exchange support', text: 'Not quite right? Our team helps you find the fit that is.'},
    {icon: <MessageCircle/>, title: 'Real stylists on WhatsApp', text: 'Ask a person anytime about fabrics, fit or what to wear.'},
  ];
  return <section className="h-promise">{items.map(i => <div key={i.title}><span>{i.icon}</span><b>{i.title}</b><p>{i.text}</p></div>)}</section>;
}

// ---------- 9. Help & services ----------
export function HelpLinks({go}: {go: (p: string) => void}) {
  const links: {icon: ReactNode; label: string; page: string}[] = [
    {icon: <Ruler/>, label: 'Size guide', page: 'size'}, {icon: <PackageSearch/>, label: 'Track order', page: 'track'}, {icon: <Gift/>, label: 'Gifting', page: 'gift'},
    {icon: <BookOpen/>, label: 'Lookbook', page: 'lookbook'}, {icon: <HelpCircle/>, label: 'FAQs', page: 'faq'}, {icon: <Heart/>, label: 'Wishlist', page: 'wishlist'},
  ];
  return <section className="h-help">
    <SectionHead eyebrow="HERE TO HELP" title="Everything in one tap."/>
    <div className="h-help-grid">{links.map(l => <button key={l.page} onClick={() => go(l.page)}>{l.icon}<b>{l.label}</b></button>)}</div>
  </section>;
}

// ---------- 10. Visit the store ----------
export function StoreVisit({cfg}: {cfg: Record<string, any>}) {
  const address = String(cfg.address || ''), phones = String(cfg.footerPhones || '').split('\n').map(s => s.trim()).filter(Boolean);
  if (!address) return null;
  return <section className="h-visit">
    <div className="h-visit-map" aria-hidden="true"><MapPin size={42}/><span>DOHA · QATAR</span></div>
    <div className="h-visit-copy">
      <span className="eyebrow">COME SAY HELLO</span><h2>Try it on in our Doha store.</h2>
      <p><MapPin size={16}/> {address}</p>
      {phones.length > 0 && <p><Phone size={16}/> {phones.map((p, i) => <a key={p} href={'tel:' + p.replace(/\s/g, '')}>{p}{i < phones.length - 1 ? ' · ' : ''}</a>)}</p>}
      <p><Clock size={16}/> Message us on WhatsApp to check today’s opening hours.</p>
      <div className="h-visit-actions">
        <a className="primary" href={'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(address)} target="_blank" rel="noreferrer">Get directions <ArrowUpRight size={16}/></a>
        {cfg.whatsapp && <a className="outline" href={'https://wa.me/' + cfg.whatsapp} target="_blank" rel="noreferrer"><MessageCircle size={16}/> WhatsApp us</a>}
      </div>
    </div>
  </section>;
}
