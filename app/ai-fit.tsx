"use client";
// Storefront UI for the Workers AI features: fit memory notes, "Fits like my favourite"
// photo matching and the occasion planner. Logic lives in lib/fit-ai.ts.
import {useState} from 'react';
import {Camera, Sparkles, Ruler, X, ArrowUpRight, CalendarHeart, CloudSun, Landmark, RotateCcw} from 'lucide-react';
import {fitAdvice, matchFavourite, sanitizeMeasure, sortSizes, type FitProfile, type GarmentMeasure, type FavouriteMatch, type PlannedLook, type OccasionBrief} from '../lib/fit-ai';
import {chartFor} from '../lib/size-charts';

type Product = {id: string; name: string; fit?: string; category?: string; price: number; image?: string; colour?: string; published?: boolean};
type Variant = {product: string; size: string; colour: string; stock: number};
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- matches the storefront's untyped api() helper
type Api = (action: string, data?: Record<string, unknown>) => Promise<any>;
const errorText = (e: unknown, fallback: string) => e instanceof Error && e.message ? e.message : fallback;

// ---------- Fit memory note on the product page ----------

export function FitNote({profile, product, sizes, size}: {profile: FitProfile | null; product: Product; sizes: string[]; size: string}) {
  const advice = fitAdvice(profile, product, sizes);
  if (!advice) return null;
  const chosen = size ? advice.bySize[size] : null;
  const text = chosen ? chosen.note : advice.recommended ? `Based on your past returns, we suggest size ${advice.recommended} in this piece.` : '';
  if (!text && !advice.lengthNote) return null;
  return <div className={'fit-note ' + (chosen?.tone || 'good')} role="status">
    <Sparkles size={16}/>
    <div>{text && <p>{text}</p>}{advice.lengthNote && <p className="muted">{advice.lengthNote}</p>}
      <small>Your fit memory · learned from {advice.basedOn} return {advice.basedOn === 1 ? 'note' : 'notes'}</small></div>
  </div>;
}

export function FitProfileCard({profile, api, notify, onReset}: {profile: FitProfile | null; api: Api; notify: (m: string) => void; onReset: () => void}) {
  const signals = profile?.signals || [];
  return <section className="fit-profile">
    <h2>Your fit memory</h2>
    {!signals.length ? <p className="muted">When you request a size exchange or return and tell us how it fitted (for example “too tight in the shoulders”), we remember it and show a personal fit note on every product.</p> : <>
      <p className="muted">Learned from your return requests. This is used only to show you fit notes.</p>
      <ul>{signals.slice(-8).reverse().map((s, i) => <li key={i}><b>{s.size}</b> {s.productName}: {s.direction} {s.area === 'overall' ? 'overall' : 'at the ' + s.area}</li>)}</ul>
      <button className="text-link" onClick={async () => { try { await api('fitProfileReset'); onReset(); notify('Fit memory cleared'); } catch (e) { notify(errorText(e, 'Could not clear')); } }}><RotateCcw size={14}/> Clear my fit memory</button>
    </>}
  </section>;
}

// ---------- "Fits like my favourite" ----------

/** Shrinks a photo in the browser so uploads stay small and fast. */
async function photoDataUrl(file: File, max = 1024) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = () => reject(new Error('That file is not a readable photo')); i.src = url; });
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement('canvas'); c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.85);
  } finally { URL.revokeObjectURL(url); }
}

const FIELDS: [keyof GarmentMeasure, string][] = [['chest', 'Chest'], ['waist', 'Waist'], ['hip', 'Hip'], ['length', 'Length']];

export function FavouriteMatcher({products, variants, cfg, current, api, onSelect, onClose}: {products: Product[]; variants: Variant[]; cfg: Record<string, unknown>; current?: Product | null; api: Api; onSelect: (p: Product, size: string) => void; onClose: () => void}) {
  const [preview, setPreview] = useState(''), [reference, setReference] = useState('a4'), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [m, setM] = useState<GarmentMeasure>({type: 'kurta', fit: 'Regular'}), [read, setRead] = useState<{confidence: string; note: string} | null>(null);
  const [results, setResults] = useState<FavouriteMatch[] | null>(null);
  const sizesFor = (p: {id: string}) => sortSizes(variants.filter(v => v.product === p.id && v.stock > 0).map(v => v.size));
  const listed = products.filter(p => p.published !== false);
  async function measure() {
    if (!preview) return setError('Add a photo first');
    setBusy(true); setError('');
    try { const r = await api('fitPhoto', {image: preview, reference}); setM(x => ({...x, ...r.measure})); setRead({confidence: r.confidence, note: r.note}); }
    catch (e) { setError(errorText(e, 'Could not measure the photo') ); } finally { setBusy(false); }
  }
  function find() {
    const clean = sanitizeMeasure(m);
    if (!clean.chest && !clean.waist && !clean.hip) return setError('Enter at least the chest measurement');
    setError(''); setResults(matchFavourite(clean, listed, p => chartFor(cfg, p), sizesFor, 6));
  }
  const here = current && results ? matchFavourite(sanitizeMeasure(m), [current], p => chartFor(cfg, p), sizesFor, 1)[0] : null;
  return <div className="overlay" onClick={onClose}><div className="modal favourite-modal" onClick={e => e.stopPropagation()}>
    <div className="between"><h2>Fits like my favourite.</h2><button aria-label="Close" onClick={onClose}><X/></button></div>
    <p className="muted">Lay a piece you love flat on a bed, photograph it from straight above with a reference object beside it, and we’ll find the closest size and cut.</p>
    <div className="favourite-photo">
      <label className="photo-drop">{preview ? <img src={preview} alt="Your garment"/> : <span><Camera size={26}/>Add a photo</span>}
        <input type="file" accept="image/*" capture="environment" onChange={async e => { const f = e.target.files?.[0]; if (!f) return; try { setPreview(await photoDataUrl(f)); setRead(null); setError(''); } catch (err) { setError(errorText(err, 'Could not read that photo')); } }}/></label>
      <div>
        <label>Reference object in the photo<select value={reference} onChange={e => setReference(e.target.value)}>
          <option value="a4">A4 sheet of paper</option><option value="card">Bank card</option><option value="phone">Smartphone</option><option value="none">None</option></select></label>
        <button className="primary" disabled={busy || !preview} onClick={measure}><Sparkles size={16}/> {busy ? 'Measuring…' : 'Measure with AI'}</button>
        {read && <p className={'ai-read ' + read.confidence}>AI estimate · {read.confidence} confidence. {read.note} Check the numbers below with a tape if you can.</p>}
      </div>
    </div>
    <h3><Ruler size={16}/> Garment measurements (inches)</h3>
    <p className="muted small">Chest, waist and hip are all the way round: measure flat across and double it.</p>
    <div className="form-grid measure-grid">
      <label>Garment<select value={m.type} onChange={e => setM({...m, type: e.target.value})}>{['kurta', 'salwar top', 'anarkali', 'tunic', 'dress', 'co-ord top', 'shirt'].map(t => <option key={t}>{t}</option>)}</select></label>
      <label>Cut<select value={m.fit} onChange={e => setM({...m, fit: e.target.value})}>{['Fitted', 'Regular', 'Relaxed', 'Flared', 'Oversized'].map(t => <option key={t}>{t}</option>)}</select></label>
      {FIELDS.map(([k, label]) => <label key={k}>{label}<input type="number" inputMode="decimal" step="0.5" value={m[k] ?? ''} onChange={e => setM({...m, [k]: e.target.value === '' ? undefined : Number(e.target.value)})}/></label>)}
    </div>
    {error && <p className="form-error">{error}</p>}
    <button className="primary" onClick={find}>Find my matches</button>
    {here && current && <div className="fit-note good"><Sparkles size={16}/><div><p>For {current.name}: {here.note}</p><button className="outline" onClick={() => { onSelect(current, here.size); onClose(); }}>Select size {here.size}</button></div></div>}
    {results && (results.length ? <div className="favourite-results">{results.map(r => { const p = listed.find(x => x.id === r.productId)!; return <button key={r.productId} onClick={() => { onSelect(p, r.size); onClose(); }}>
      {r.image && <img src={r.image} alt=""/>}<div><b>{r.name}</b><span className="badge">Size {r.size}</span><small>{r.note}</small></div><ArrowUpRight size={16}/></button>; })}</div>
      : <p className="muted">No in-stock pieces have a size chart close to these measurements. Message us on WhatsApp and our team will help.</p>)}
  </div></div>;
}

// ---------- Occasion planner ----------

const EXAMPLES = ['Cousin’s wedding in Kochi, December, outdoor, 3 events, budget QAR 1000', 'Eid lunch and evening family dinner in Doha, prefer pastels', 'Onam celebration at the office, ivory and gold, under QAR 300'];

export function OccasionPlanner({api, money, onOpen, notify}: {api: Api; money: (n: number) => string; onOpen: (id: string) => void; notify: (m: string) => void}) {
  const [brief, setBrief] = useState(''), [busy, setBusy] = useState(false);
  const [plan, setPlan] = useState<{brief: OccasionBrief; looks: PlannedLook[]; total: number; source: string} | null>(null);
  async function run(text = brief) {
    if (text.trim().length < 8) return notify('Tell us a little more about your occasion');
    setBusy(true);
    try { setPlan(await api('occasionPlan', {brief: text})); } catch (e) { notify(errorText(e, 'Could not plan your looks')); } finally { setBusy(false); }
  }
  const b = plan?.brief;
  return <div className="planner">
    <span className="eyebrow">YOUR AI STYLIST</span><h1>Plan every look for your occasion.</h1>
    <p className="muted">Tell us what, where, when and your budget. We’ll plan a look for each event, with the weather, colour etiquette and your budget built in.</p>
    <form onSubmit={e => { e.preventDefault(); run(); }}>
      <textarea value={brief} maxLength={600} rows={3} onChange={e => setBrief(e.target.value)} placeholder="e.g. Cousin’s wedding in Kochi, December, outdoor, 3 events, budget QAR 1000"/>
      <button className="primary" disabled={busy}><Sparkles size={16}/> {busy ? 'Styling your looks…' : 'Plan my looks'}</button>
    </form>
    <div className="planner-examples">{EXAMPLES.map(x => <button key={x} onClick={() => { setBrief(x); run(x); }}>{x}</button>)}</div>
    {plan && b && <div className="planner-result">
      <div className="planner-brief">
        <span><CalendarHeart size={15}/> {b.events.length} {b.events.length === 1 ? 'event' : 'events'}{b.location && ' · ' + b.location}{b.month && ' · ' + b.month}</span>
        {b.budget > 0 && <span>Budget {money(b.budget)} · Planned {money(plan.total)}</span>}
        {b.avoid.length > 0 && <span>Avoiding {b.avoid.join(', ')}</span>}
      </div>
      {b.weather && <p className="planner-note"><CloudSun size={16}/> {b.weather}</p>}
      {b.culture && <p className="planner-note"><Landmark size={16}/> {b.culture}</p>}
      <div className="planner-looks">{plan.looks.map((l, i) => <article key={i} className="planner-look">
        <button className="look-image" onClick={() => onOpen(l.productId)}>{l.image && <img src={l.image} alt={l.name} loading="lazy"/>}</button>
        <div><small className="eyebrow">LOOK {i + 1} · {l.event.name}{l.event.time && ' · ' + l.event.time}{l.event.setting && ' · ' + l.event.setting}</small>
          <h3>{l.name}</h3><p className="pdp-price">{money(l.price)}</p><p>{l.why}</p>
          <ul>{l.styling.map((s, j) => <li key={j}>{s}</li>)}</ul>
          <button className="outline" onClick={() => onOpen(l.productId)}>Choose size <ArrowUpRight size={15}/></button></div>
      </article>)}</div>
      {!plan.looks.length && <p className="muted">We couldn’t find in-stock pieces for this plan. Our stylists can help on WhatsApp.</p>}
      <small className="muted">{plan.source === 'ai' ? 'Planned by our AI stylist using live stock.' : 'Planned from our styling rules using live stock.'} Weather and etiquette notes are general guidance.</small>
    </div>}
  </div>;
}
