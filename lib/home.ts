// Homepage helpers: personal "picked for you" recommendations and product rails.
// Pure functions so they run instantly in the browser and are easy to test.
import {occasionList} from './catalog';

export type HomeProduct = {id: string; name: string; category?: unknown; colour?: unknown; fabric?: unknown; occasion?: unknown; fit?: unknown; price: number; oldPrice?: number; image?: string; tag?: unknown; published?: boolean};
export type Signals = {saved?: string[]; viewed?: string[]; cart?: string[]};
export type ForYouPick = {product: HomeProduct; why: string};

const s = (v: unknown) => String(v ?? '').toLowerCase();

/** Similarity between two pieces (shared category, colour, fabric, occasion, cut and price band). */
export function similarity(a: HomeProduct, b: HomeProduct) {
  let n = 0;
  if (s(a.category) && s(a.category) === s(b.category)) n += 3;
  if (s(a.colour) && s(a.colour) === s(b.colour)) n += 2;
  if (s(a.fabric) && s(a.fabric) === s(b.fabric)) n += 2;
  const oa = occasionList(a.occasion), ob = occasionList(b.occasion);
  n += 2 * oa.filter(o => ob.includes(o)).length;
  if (s(a.fit) && s(a.fit) === s(b.fit)) n += 1;
  const pa = Number(a.price) || 0, pb = Number(b.price) || 0;
  if (pa && pb && Math.abs(pa - pb) / Math.max(pa, pb) < 0.25) n += 1;
  return n;
}

function reason(seed: HomeProduct, p: HomeProduct, verb: string) {
  const same: string[] = [];
  if (s(seed.fabric) && s(seed.fabric) === s(p.fabric)) same.push(s(p.fabric));
  if (s(seed.colour) && s(seed.colour) === s(p.colour)) same.push(s(p.colour) + ' tones');
  const occ = occasionList(seed.occasion).find(o => occasionList(p.occasion).includes(o));
  if (occ) same.push(occ + '-ready');
  if (!same.length && s(seed.category) === s(p.category)) same.push('the same ' + s(p.category).replace(/s$/, '').replace(' & set', ''));
  return `Because you ${verb} ${seed.name}${same.length ? ' · ' + same.slice(0, 2).join(', ') : ''}`;
}

/**
 * Ranks the catalogue against what the shopper saved, viewed and added to the bag.
 * Signals weigh cart > saved > viewed, and more recent views count more.
 * Returns [] when there are no signals, so the section can hide itself.
 */
export function forYou(products: HomeProduct[], sig: Signals, n = 4): ForYouPick[] {
  const live = products.filter(p => p.published !== false), byId = new Map(live.map(p => [p.id, p]));
  const seeds: {p: HomeProduct; w: number; verb: string}[] = [];
  for (const id of sig.cart || []) { const p = byId.get(id); if (p) seeds.push({p, w: 3, verb: 'added'}); }
  for (const id of sig.saved || []) { const p = byId.get(id); if (p) seeds.push({p, w: 2, verb: 'saved'}); }
  (sig.viewed || []).slice(0, 8).forEach((id, i) => { const p = byId.get(id); if (p) seeds.push({p, w: Math.max(0.5, 1.5 - i * 0.15), verb: 'viewed'}); });
  if (!seeds.length) return [];
  const exclude = new Set([...(sig.cart || []), ...(sig.saved || [])]);
  const scored = live.filter(p => !exclude.has(p.id)).map(p => {
    let score = 0, best = seeds[0], bestScore = -1;
    for (const seed of seeds) {
      if (seed.p.id === p.id) continue;
      const sc = similarity(seed.p, p) * seed.w;
      score += sc;
      if (sc > bestScore) { bestScore = sc; best = seed; }
    }
    // Pieces only viewed (not saved/added) are fine to show again, but rank them slightly lower.
    if ((sig.viewed || []).includes(p.id)) score *= 0.6;
    return {p, score, why: reason(best.p, p, best.verb)};
  }).filter(x => x.score > 0).sort((a, b) => b.score - a.score || a.p.price - b.p.price);
  return scored.slice(0, n).map(x => ({product: x.p, why: x.why}));
}

/** Bestsellers and tagged favourites first, then the rest of the catalogue. */
export function trending(products: HomeProduct[], n = 8) {
  const rank = (p: HomeProduct) => /bestseller/i.test(s(p.tag)) ? 0 : /favourite|limited|loved/i.test(s(p.tag)) ? 1 : /new/i.test(s(p.tag)) ? 2 : 3;
  return products.filter(p => p.published !== false).map((p, i) => ({p, i})).sort((a, b) => rank(a.p) - rank(b.p) || a.i - b.i).slice(0, n).map(x => x.p);
}
export const onSale = (products: HomeProduct[], n = 8) => products.filter(p => p.published !== false && Number(p.oldPrice) > Number(p.price))
  .sort((a, b) => (Number(b.oldPrice) - b.price) / Number(b.oldPrice) - (Number(a.oldPrice) - a.price) / Number(a.oldPrice)).slice(0, n);
export const discount = (p: HomeProduct) => Number(p.oldPrice) > p.price ? Math.round((1 - p.price / Number(p.oldPrice)) * 100) : 0;

/** Price bands that actually contain pieces. */
export function priceBands(products: HomeProduct[]) {
  const live = products.filter(p => p.published !== false);
  return [{label: 'Under QAR 150', sub: 'Everyday easy', max: 150}, {label: 'Under QAR 250', sub: 'Smart & festive', max: 250}, {label: 'Under QAR 350', sub: 'Occasion ready', max: 350}, {label: 'The luxe edit', sub: 'QAR 350 and above', min: 350}]
    .map(b => ({...b, count: live.filter(p => b.max ? p.price < b.max : p.price >= (b.min || 0)).length, image: live.find(p => (b.max ? p.price < b.max : p.price >= (b.min || 0)) && p.image)?.image}))
    .filter(b => b.count > 0);
}

/** Distinct colours with a piece count, most stocked first. */
export function colourSwatches(products: HomeProduct[], n = 10) {
  const m = new Map<string, number>();
  for (const p of products) if (p.published !== false && String(p.colour || '').trim()) m.set(String(p.colour), (m.get(String(p.colour)) || 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([name, count]) => ({name, count}));
}
const SWATCH: Record<string, string> = {wine: '#6b1f35', ivory: '#f4ecd8', rose: '#d99aa5', sage: '#a3b18a', gold: '#c9a35a', blue: '#4f6d9a', black: '#1f1b1a', white: '#fbfaf6', cream: '#efe4cc', navy: '#22304f', maroon: '#5c1a23', red: '#b3302f', pink: '#e7a3b5', yellow: '#e6c84f', green: '#4f7a4a', mint: '#b6dcc6', grey: '#9a9894', beige: '#d9c6a5', peach: '#f0b9a0', purple: '#6c4a86', lilac: '#c4a8d8', orange: '#df7f3a', mustard: '#c99a2e', teal: '#2f7a78'};
export const swatchColour = (name: string) => SWATCH[s(name)] || SWATCH[Object.keys(SWATCH).find(k => s(name).includes(k)) || ''] || '#cbbfae';

/** Remembers the last pieces opened on this device (most recent first). */
export function rememberViewed(id: string, max = 12) {
  try {
    const list: string[] = JSON.parse(localStorage.getItem('4l-viewed') || '[]');
    localStorage.setItem('4l-viewed', JSON.stringify([id, ...list.filter(x => x !== id)].slice(0, max)));
  } catch { /* storage unavailable */ }
}
export function readViewed(): string[] {
  try { const v = JSON.parse(localStorage.getItem('4l-viewed') || '[]'); return Array.isArray(v) ? v.map(String) : []; } catch { return []; }
}
