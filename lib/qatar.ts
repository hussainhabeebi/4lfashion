// "Life in Qatar" knowledge for expat shoppers: Doha's climate by month, dress norms by
// place, festivals celebrated by expat communities, welcome kits and group orders.
// Workers AI personalises the advice; everything here is the checked ground truth and
// the fallback when the model is unavailable. Dates that move every year (Eid, Onam,
// Diwali) and local community events come from the store admin, never from the model.

// ---------- Climate: Doha monthly averages (°C, approximate) ----------

export type Climate = {month: string; high: number; low: number; humidity: 'low' | 'moderate' | 'high'; season: 'cool' | 'warm' | 'hot' | 'humid-hot'};
export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const C: [number, number, Climate['humidity'], Climate['season']][] = [
  [22, 14, 'moderate', 'cool'], [23, 15, 'moderate', 'cool'], [27, 18, 'moderate', 'warm'], [32, 22, 'low', 'warm'],
  [38, 27, 'low', 'hot'], [41, 29, 'low', 'hot'], [42, 31, 'high', 'humid-hot'], [41, 31, 'high', 'humid-hot'],
  [39, 29, 'high', 'humid-hot'], [35, 25, 'moderate', 'hot'], [29, 20, 'moderate', 'warm'], [24, 16, 'moderate', 'cool'],
];
export const climateFor = (monthIndex: number): Climate => { const m = ((monthIndex % 12) + 12) % 12, [high, low, humidity, season] = C[m]; return {month: MONTH_NAMES[m], high, low, humidity, season}; };
/** Month index (0-11) in Qatar time. */
export const qatarMonth = (now = new Date()) => Number(new Intl.DateTimeFormat('en-GB', {month: 'numeric', timeZone: 'Asia/Qatar'}).format(now)) - 1;

// ---------- Shared product helpers ----------

export type QProduct = {id: string; name: string; category?: unknown; colour?: unknown; fabric?: unknown; occasion?: unknown; fit?: unknown; price: number; image?: string};
export type Pick = {productId: string; name: string; price: number; image?: string; colour: string; fabric: string; why: string};
const txt = (p: QProduct) => [p.name, p.category, p.colour, p.fabric, p.occasion, p.fit].map(x => String(x || '')).join(' ').toLowerCase();
const AIRY = /cotton|linen|chanderi|mul|khadi|voile|rayon|viscose/i, SHEER = /georgette|chiffon|organza|net/i, HEAVY = /velvet|brocade|banarasi|raw silk|wool/i;
// Colours that hide perspiration well (deep tones, white/ivory, prints) and ones that show it.
const SWEAT_SAFE = /white|ivory|cream|black|navy|wine|maroon|print|floral|multi/i, SWEAT_SHOWS = /grey|gray|light blue|sky|silver|mint/i;

export type Want = {occasions?: string[]; formality?: 'casual' | 'smart' | 'festive' | 'formal'; prefer?: string[]; avoid?: string[]; airy?: boolean; sweatSafe?: boolean; modest?: number; budget?: number};
/** Scores a piece for a situation; higher is better. `modest` weights covered, looser cuts. */
export function scoreFor(p: QProduct, w: Want) {
  const t = txt(p), colour = String(p.colour || '').toLowerCase(), fabric = String(p.fabric || ''), cat = String(p.category || '').toLowerCase(), fit = String(p.fit || '').toLowerCase();
  let s = 0;
  for (const o of w.occasions || []) if (t.includes(o.toLowerCase())) s += 3;
  if (w.formality === 'casual' && /everyday|kurta/.test(t)) s += 2;
  if (w.formality === 'smart' && /kurta|co-ord|set/.test(cat) && !/occasion/.test(cat)) s += 2;
  if ((w.formality === 'festive' || w.formality === 'formal') && /occasion|salwar|anarkali/.test(t)) s += 2;
  if (w.formality === 'formal' && /occasion/.test(cat)) s += 1;
  if (w.prefer?.some(c => t.includes(c))) s += 3;
  if (w.avoid?.some(c => colour.includes(c) || fabric.toLowerCase().includes(c))) s -= 10;
  if (w.airy && AIRY.test(fabric)) s += 2;
  if (w.airy && HEAVY.test(fabric)) s -= 2;
  if (w.sweatSafe && SWEAT_SAFE.test(colour)) s += 1;
  if (w.sweatSafe && SWEAT_SHOWS.test(colour)) s -= 1;
  if (w.modest) { if (/relaxed|regular|flared|loose/.test(fit)) s += w.modest; if (SHEER.test(fabric)) s -= w.modest; }
  if (w.budget && p.price > w.budget) s -= 4;
  return s;
}
export function topPicks(products: QProduct[], w: Want, n: number, why: (p: QProduct) => string, exclude: string[] = []): Pick[] {
  return products.filter(p => !exclude.includes(p.id)).map(p => ({p, s: scoreFor(p, w)})).sort((a, b) => b.s - a.s || a.p.price - b.p.price)
    .slice(0, n).map(({p}) => toPick(p, why(p)));
}
export const toPick = (p: QProduct, why: string): Pick => ({productId: p.id, name: p.name, price: p.price, image: p.image, colour: String(p.colour || ''), fabric: String(p.fabric || ''), why});
const clean = (v: unknown, n: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
export const cleanList = (v: unknown, items = 5, n = 160) => (Array.isArray(v) ? v : []).map(x => clean(x, n)).filter(Boolean).slice(0, items);

/** Keeps AI picks that are real, buyable and unrepeated; tops up from the rule-based ranking. */
export function mergePicks(aiPicks: unknown, products: QProduct[], fallback: Pick[], n: number): Pick[] {
  const byId = new Map(products.map(p => [p.id, p])), out: Pick[] = [];
  for (const a of (Array.isArray(aiPicks) ? aiPicks : []) as {productId?: unknown; why?: unknown}[]) {
    const p = byId.get(String(a?.productId)); if (!p || out.some(x => x.productId === p.id)) continue;
    out.push(toPick(p, clean(a.why, 220) || fallback.find(f => f.productId === p.id)?.why || ''));
    if (out.length >= n) return out;
  }
  for (const f of fallback) { if (out.length >= n) break; if (!out.some(x => x.productId === f.productId)) out.push(f); }
  return out;
}

// ---------- 1. Qatar dress-sense guide ----------

export type Place = {id: string; label: string; match: RegExp; level: 1 | 2 | 3; formality: Want['formality']; norms: string[]};
// level: 1 = everyday public modesty, 3 = most conservative.
export const PLACES: Place[] = [
  {id: 'mall', label: 'Malls (Place Vendôme, Villaggio, Doha Festival City)', match: /mall|lusail|vendome|villaggio|festival city|mall of qatar|tawar|city center|shopping/i, level: 1, formality: 'casual',
    norms: ['Malls display “respect local culture” signs: keep shoulders and knees covered.', 'Avoid sheer, very tight or low-cut pieces; a dupatta or light shawl is handy.', 'Malls are strongly air-conditioned, so a light layer is welcome.']},
  {id: 'office', label: 'Office (West Bay, Lusail, Msheireb)', match: /office|work|west bay|msheireb|meeting|interview|corporate|bank/i, level: 2, formality: 'smart',
    norms: ['Smart and modest: sleeves to the elbow or longer, hemlines below the knee.', 'Solid or subtle prints read as professional; keep embellishment low.', 'Office AC runs cold (often 18–20°C): keep a light layer at your desk.']},
  {id: 'majlis', label: 'Majlis or Qatari home visit', match: /majlis|qatari (?:home|family|house)|local family|host/i, level: 3, formality: 'formal',
    norms: ['Dress most conservatively: loose, long sleeves, ankle length.', 'Carry a dupatta or shawl to cover your hair if your hosts are conservative.', 'Shoes usually come off at the door, so wear easy slip-ons.', 'Greet with the right hand; wait for the host to offer a handshake.']},
  {id: 'mosque', label: 'Mosque visit (State Grand Mosque, Katara Mosque)', match: /mosque|masjid|prayer|imam/i, level: 3, formality: 'formal',
    norms: ['Women cover hair, arms and legs; clothing should be loose and not sheer.', 'Some mosques lend abayas and scarves to visitors, but bring your own to be sure.', 'Shoes off before entering the prayer hall.']},
  {id: 'corniche', label: 'Corniche, Qatar National Day (18 Dec) and public events', match: /corniche|national day|qnd|darb al saai|fireworks|parade|public event|sports day/i, level: 1, formality: 'festive',
    norms: ['Maroon and white (Qatar’s national colours) are a lovely, respectful touch on National Day.', 'Public modesty applies: shoulders and knees covered.', 'Expect walking and crowds: comfortable flats and a light layer for cool evenings.']},
  {id: 'souq', label: 'Souq Waqif, Katara and Old Doha', match: /souq|souk|waqif|katara|msheireb downtown|old doha|wakra/i, level: 1, formality: 'casual',
    norms: ['Public modesty applies: shoulders and knees covered.', 'Breathable cotton and linen, and comfortable shoes for the lanes.']},
  {id: 'school', label: 'School events (annual day, parents’ meeting)', match: /school|annual day|parent|ptm|graduation|sports meet/i, level: 2, formality: 'smart',
    norms: ['Smart-modest is the norm; ethnic wear is very common at Indian and Pakistani school events.', 'Halls can be warm when crowded: choose breathable fabrics.']},
  {id: 'function', label: 'Community function or wedding hall', match: /wedding|function|association|hall|community|party|reception|engagement|nikah|church|temple/i, level: 2, formality: 'festive',
    norms: ['Festive ethnic wear is welcome; keep necklines and backs modest in shared venues.', 'Venues are air-conditioned: a dupatta doubles as a layer.']},
];
export const findPlaces = (q: string) => { const hits = PLACES.filter(p => p.match.test(q)); return hits.length ? hits : [PLACES[0]]; };
export const GENERAL_NORMS = ['In public places in Qatar, cover shoulders and knees and avoid sheer, very tight or low-cut clothing.', 'Visitors on visit visas follow the same norms as residents.', 'There is no requirement for non-Muslim women to cover their hair in everyday public places.'];

export function dressGuideFallback(question: string, products: QProduct[], month = qatarMonth()) {
  const places = findPlaces(question), cl = climateFor(month), level = Math.max(...places.map(p => p.level));
  const hot = cl.season !== 'cool', picks: Pick[] = [];
  for (const pl of places.slice(0, 3)) picks.push(...topPicks(products, {formality: pl.formality, modest: pl.level + 1, airy: hot, sweatSafe: hot}, 2,
    p => `${p.fit || 'Easy'} ${String(p.fabric || '').toLowerCase()} works for ${pl.label.split(' (')[0].toLowerCase()}${hot ? ', and stays cool in ' + cl.month : ''}.`, picks.map(x => x.productId)));
  return {places: places.map(p => ({id: p.id, label: p.label, norms: p.norms})), level, answer: `For ${places.map(p => p.label.split(' (')[0].toLowerCase()).join(' and ')}, ${level >= 3 ? 'dress at your most conservative: loose, long-sleeved and ankle-length' : level === 2 ? 'aim for smart-modest: sleeves and below-knee hemlines' : 'everyday modest is perfect: shoulders and knees covered'}. In ${cl.month}, Doha averages ${cl.high}°C by day.`, picks};
}

// ---------- 2. Month-by-month AC-to-heat wardrobe ----------

export function monthWardrobe(month: number) {
  const c = climateFor(month), hot = c.season === 'hot' || c.season === 'humid-hot';
  const tips = hot ? [
    `Outside reaches ${c.high}°C${c.humidity === 'high' ? ' with heavy humidity' : ''}: choose cotton, linen, chanderi or mul, loose and unlined.`,
    'Indoors AC is often 18–20°C: carry a light cotton dupatta, shrug or stole for malls, offices and cinemas.',
    'Hide perspiration with white, ivory, deep tones or prints; light grey and sky blue show it most.',
    c.humidity === 'high' ? 'Pack a spare dupatta: humidity makes fabric cling.' : 'Dry heat: a breathable full sleeve protects from the sun better than bare arms.',
  ] : c.season === 'warm' ? [
    `Pleasant days around ${c.high}°C and evenings near ${c.low}°C.`, 'Mid-weight cottons and silk blends work day to night.', 'Keep a light layer for air-conditioned venues and cooler evenings outdoors.',
  ] : [
    `Doha’s cool season: ${c.high}°C days, ${c.low}°C evenings, breezy by the sea.`, 'Richer fabrics like silk blends and heavier cottons are comfortable now.', 'Add a shawl or light jacket over your kurta for outdoor evenings, the Corniche and desert trips.',
  ];
  return {climate: c, hot, headline: hot ? `Beat the ${c.high}°C heat, stay comfortable in the AC` : c.season === 'warm' ? 'Easy layers for warm days and AC evenings' : 'Layer up for Doha’s cool season', tips,
    want: {airy: hot || c.season === 'warm', sweatSafe: hot, formality: 'casual', modest: 1} as Want};
}

// ---------- 3. Festival far from home ----------

export type Festival = {id: string; name: string; communities: string; months: number[]; fixed?: string; occasions: string[]; prefer: string[]; dress: string; call: string[]};
export const FESTIVALS: Festival[] = [
  {id: 'pongal', name: 'Pongal', communities: 'Tamil', months: [0], fixed: '01-14', occasions: [], prefer: ['yellow', 'gold', 'green', 'ivory'], dress: 'Bright yellows, greens and silk-blend sets.',
    call: ['Make sweet pongal together on the call; the first “pongalo pongal” as it boils over.', 'Show family your kolam at the door, even a small one.']},
  {id: 'vishu', name: 'Vishu', communities: 'Malayali', months: [3], fixed: '04-14', occasions: ['Onam'], prefer: ['ivory', 'gold', 'yellow'], dress: 'Kasavu whites and gold, or yellow inspired by kanikonna flowers.',
    call: ['Set up a small Vishukkani and show it to grandparents at sunrise.', 'Collect Vishu kaineettam blessings over video.']},
  {id: 'onam', name: 'Onam', communities: 'Malayali', months: [7, 8], occasions: ['Onam'], prefer: ['ivory', 'gold', 'cream'], dress: 'Kasavu ivory-and-gold sets; green or maroon borders for the sadya.',
    call: ['Sit down to sadya at the same time as family in Kerala, on banana leaves if you can.', 'Show your pookalam and judge each other’s.']},
  {id: 'eid-fitr', name: 'Eid al-Fitr', communities: 'Muslim', months: [1, 2, 3], occasions: ['Eid'], prefer: ['gold', 'ivory', 'pastel', 'rose', 'sage'], dress: 'Elegant modest sets in soft pastels, ivory or gold.',
    call: ['Video-call after Eid prayers for Eid Mubarak and Eidi for the little ones.', 'Share your sheer khurma or biryani and swap family recipes.']},
  {id: 'eid-adha', name: 'Eid al-Adha', communities: 'Muslim', months: [4, 5], occasions: ['Eid'], prefer: ['gold', 'ivory', 'wine', 'black'], dress: 'Richer festive sets: wine, gold or classic black-and-gold.',
    call: ['Call after Eid prayers and share the day’s plans.', 'Show off the festive table before guests arrive.']},
  {id: 'diwali', name: 'Diwali', communities: 'Hindu, Sikh and Jain', months: [9, 10], occasions: ['Wedding'], prefer: ['wine', 'gold', 'rose', 'maroon'], dress: 'Jewel tones and gold: festive silk-blend sets and anarkalis.',
    call: ['Light diyas at the same time as family back home.', 'A sweets show-and-tell: who made the best ladoo?']},
  {id: 'christmas', name: 'Christmas', communities: 'Christian', months: [11], fixed: '12-25', occasions: [], prefer: ['wine', 'red', 'ivory', 'gold', 'black'], dress: 'Wine, red or ivory for church; festive sets for the evening party.',
    call: ['Open one gift together on video after midnight mass.', 'Share the plum cake and a carol with grandparents.']},
];
export type FestivalDates = Record<string, string>; // festival id -> YYYY-MM-DD, set by the store

/** Festivals in the given month (and the next), with store-set dates where known. */
export function festivalsAround(month: number, year: number, dates: FestivalDates = {}, today = '') {
  const next = (month + 1) % 12;
  return FESTIVALS.map(f => {
    // Calendar dates only: noon UTC keeps the day the same in Qatar and UTC.
    const set = dates[f.id], d = set && /^\d{4}-\d{2}-\d{2}$/.test(set) ? new Date(set + 'T12:00:00Z') : f.fixed ? new Date(`${year}-${f.fixed}T12:00:00Z`) : null;
    const m = d ? d.getUTCMonth() : -1;
    return {...f, date: d ? d.toISOString().slice(0, 10) : '', when: d ? d.toLocaleDateString('en-GB', {day: 'numeric', month: 'long', timeZone: 'Asia/Qatar'}) : 'Usually ' + f.months.map(x => MONTH_NAMES[x]).join('–') + ' (date follows the lunar/regional calendar)', soon: d ? (m === month || m === next) && (!today || d.toISOString().slice(0, 10) >= today) : f.months.includes(month) || f.months.includes(next)};
  });
}
export const festivalWant = (f: Festival): Want => ({occasions: f.occasions, prefer: f.prefer, formality: 'festive', modest: 1});

// ---------- 4. New-to-Qatar welcome kit ----------

export type Member = {who: string; age?: number; size?: string};
export const WELCOME_SECTIONS = [
  {id: 'office', label: 'Office basics', want: {formality: 'smart', modest: 2, airy: true, sweatSafe: true} as Want, for: (m: Member) => !m.age || m.age >= 18, why: 'smart, modest and comfortable from the heat outside to office AC'},
  {id: 'school', label: 'School-event wear', want: {formality: 'festive', modest: 2, airy: true} as Want, for: () => true, why: 'festive enough for an annual day, and breathable in a crowded hall'},
  {id: 'mall', label: 'Modest mall outfit', want: {formality: 'casual', modest: 2, airy: true, sweatSafe: true} as Want, for: () => true, why: 'covered, easy and cool for weekend malls and souqs'},
];
export function sanitizeMembers(raw: unknown): Member[] {
  return (Array.isArray(raw) ? raw : []).slice(0, 6).map((m: Record<string, unknown>) => ({who: clean(m?.who, 30) || 'Me', age: Number.isFinite(Number(m?.age)) && Number(m.age) > 0 ? Math.min(99, Math.round(Number(m.age))) : undefined, size: clean(m?.size, 6) || undefined}));
}

// ---------- 5. Community group orders ----------

export type Tier = {min: number; percent: number};
export const DEFAULT_TIERS: Tier[] = [{min: 10, percent: 10}, {min: 20, percent: 15}, {min: 40, percent: 20}];
export function sanitizeTiers(raw: unknown): Tier[] {
  const list = (Array.isArray(raw) ? raw : []).map((t: Record<string, unknown>) => ({min: Math.round(Number(t?.min)), percent: Math.round(Number(t?.percent))}))
    .filter(t => t.min >= 2 && t.min <= 1000 && t.percent > 0 && t.percent <= 50).sort((a, b) => a.min - b.min);
  return list.length ? list : DEFAULT_TIERS;
}
export const tierFor = (pieces: number, tiers: Tier[]) => [...tiers].reverse().find(t => pieces >= t.min) || null;
export type GroupLine = {name: string; productId: string; size: string; colour: string; qty: number; price: number};
export function groupTotals(lines: GroupLine[], tiers: Tier[]) {
  const pieces = lines.reduce((n, l) => n + l.qty, 0), subtotal = lines.reduce((n, l) => n + l.qty * l.price, 0), tier = tierFor(pieces, tiers);
  const discount = tier ? Math.round(subtotal * tier.percent) / 100 : 0, next = tiers.find(t => t.min > pieces);
  const sizes: Record<string, Record<string, number>> = {};
  for (const l of lines) { const k = l.productId + '|' + l.colour; (sizes[k] ||= {})[l.size] = (sizes[k][l.size] || 0) + l.qty; }
  return {pieces, subtotal, percent: tier?.percent || 0, discount, total: subtotal - discount, next: next ? {min: next.min, percent: next.percent, more: next.min - pieces} : null, sizes};
}
/** Rule-based theme match: "kasavu with green borders" -> pieces whose name, colour, fabric or occasion match. */
export function themePicks(theme: string, products: QProduct[], n = 4): Pick[] {
  const words = theme.toLowerCase().split(/[^a-z]+/).filter(w => w.length > 2 && !['with', 'and', 'the', 'all', 'our', 'for', 'wants', 'want', 'ladies', 'women', 'men', 'girls', 'theme', 'matching', 'colour', 'color', 'borders', 'border'].includes(w));
  const syn: Record<string, string> = {kasavu: 'onam', kerala: 'onam', sadya: 'onam', festive: 'occasion', eid: 'eid', gold: 'gold', golden: 'gold', white: 'ivory', offwhite: 'ivory'};
  return products.map(p => { const t = txt(p); return {p, s: words.reduce((n, w) => n + (t.includes(w) ? 2 : 0) + (syn[w] && t.includes(syn[w]) ? 2 : 0), 0)}; })
    .sort((a, b) => b.s - a.s || a.p.price - b.p.price).slice(0, n).filter((x, i) => x.s > 0 || i < 2).map(({p}) => toPick(p, `${p.colour} ${String(p.fabric || '').toLowerCase()} fits the “${clean(theme, 60)}” theme.`));
}
export const groupCode = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), b => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 32]).join('');
