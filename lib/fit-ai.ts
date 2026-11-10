// Pure logic behind the three AI shopping features. Workers AI does the language and
// vision work (reading a return reason, measuring a photo, understanding an occasion
// brief); everything here is deterministic so results stay explainable, testable and
// still work when the AI binding is unavailable.

// ---------- Sizes and cuts ----------

const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL', '5XL'];
export const normSize = (s: unknown) => { const v = String(s ?? '').trim().toUpperCase(); return v === '2XL' ? 'XXL' : v; };
export const sizeIndex = (s: unknown) => SIZE_ORDER.indexOf(normSize(s));
export const sortSizes = (sizes: string[]) => [...new Set(sizes)].filter(s => sizeIndex(s) >= 0).sort((a, b) => sizeIndex(a) - sizeIndex(b));

/** Typical garment ease over the body at the chest, in inches, per cut. */
const EASE: Record<string, number> = {fitted: 1.5, slim: 1.5, regular: 3, flared: 3, straight: 3, relaxed: 5, loose: 6, oversized: 7};
export const easeOf = (fit: unknown) => EASE[String(fit || '').trim().toLowerCase()] ?? 3;

// ---------- 1. Fit memory from returns ----------

export const FIT_AREAS = ['shoulders', 'chest', 'waist', 'hip', 'sleeves', 'length', 'overall'] as const;
export const FIT_DIRECTIONS = ['tight', 'loose', 'short', 'long'] as const;
export type FitArea = typeof FIT_AREAS[number];
export type FitDirection = typeof FIT_DIRECTIONS[number];
export type FitIssue = {area: FitArea; direction: FitDirection};
export type FitSignal = FitIssue & {size: string; productId: string; productName: string; fit: string; category: string; at: string};
export type FitProfile = {signals: FitSignal[]; updated?: string};

const AREA_WORDS: [FitArea, RegExp][] = [
  ['shoulders', /\bshoulders?\b/], ['chest', /\b(?:chest|bust|breast)\b/], ['waist', /\b(?:waist|tummy|stomach|belly|midriff)\b/],
  ['hip', /\b(?:hips?|seat|thighs?|bottom)\b/], ['sleeves', /\b(?:sleeves?|arms?|armholes?|wrists?)\b/], ['length', /\b(?:length|hem|height)\b/],
];
const DIRECTION_WORDS: [FitDirection, RegExp][] = [
  ['tight', /\b(?:tight|snug|small|narrow|pull(?:s|ed|ing)?|restrict\w*|squeez\w*|cling\w*|too fitted)\b|could(?:n'?t| not) (?:close|button|zip)/],
  ['loose', /\b(?:loose|baggy|big|large|wide|roomy|oversized|sagg\w*|hangs?|hanging|swims?|swimming|drowns?)\b/],
  ['short', /\b(?:short|cropped|rides up)\b/], ['long', /\b(?:long|dragg\w*)\b|touch(?:es|ing)? the (?:floor|ground)/],
];

/** Keyword reader used when Workers AI is unavailable (and as a safety net). */
export function extractFitIssuesFallback(text: unknown): FitIssue[] {
  const out: FitIssue[] = [];
  for (const clause of String(text || '').toLowerCase().split(/[.,;!\n]|\bbut\b|\band\b(?= (?:the|it|too|a bit|slightly|very))/)) {
    const dir = DIRECTION_WORDS.find(([, re]) => re.test(clause))?.[0];
    if (!dir) continue;
    const areas = AREA_WORDS.filter(([, re]) => re.test(clause)).map(([a]) => a);
    const list: FitArea[] = areas.length ? areas : [dir === 'short' || dir === 'long' ? 'length' : 'overall'];
    for (const area of list) {
      // "Short"/"long" only describe length or sleeves; "tight"/"loose" never describe length.
      if ((dir === 'short' || dir === 'long') && area !== 'length' && area !== 'sleeves') continue;
      if ((dir === 'tight' || dir === 'loose') && area === 'length') continue;
      out.push({area, direction: dir});
    }
  }
  return sanitizeIssues(out);
}

/** Accepts only known areas/directions, de-duplicated. Used on AI output. */
export function sanitizeIssues(raw: unknown): FitIssue[] {
  const list = Array.isArray(raw) ? raw : [], seen = new Set<string>(), out: FitIssue[] = [];
  for (const x of list as {area?: unknown; direction?: unknown}[]) {
    let area = String(x?.area || '').toLowerCase().trim();
    const direction = String(x?.direction || '').toLowerCase().trim();
    if (area === 'bust') area = 'chest'; if (area === 'hips') area = 'hip'; if (area === 'shoulder') area = 'shoulders'; if (area === 'sleeve') area = 'sleeves';
    if (!(FIT_AREAS as readonly string[]).includes(area) || !(FIT_DIRECTIONS as readonly string[]).includes(direction)) continue;
    const key = area + ':' + direction; if (seen.has(key)) continue; seen.add(key);
    out.push({area: area as FitArea, direction: direction as FitDirection});
  }
  return out.slice(0, 6);
}

export function addSignals(profile: FitProfile | null | undefined, signals: FitSignal[], max = 40): FitProfile {
  return {signals: [...(profile?.signals || []), ...signals].slice(-max), updated: new Date().toISOString()};
}

const AREA_LABEL: Record<FitArea, string> = {shoulders: 'shoulders', chest: 'chest', waist: 'waist', hip: 'hips', sleeves: 'sleeves', length: 'length', overall: 'overall'};
const joinWords = (w: string[]) => w.length < 2 ? w.join('') : w.slice(0, -1).join(', ') + ' and ' + w[w.length - 1];

export type SizeNote = {tone: 'snug' | 'loose' | 'good'; note: string};
export type FitAdvice = {bySize: Record<string, SizeNote>; recommended: string; lengthNote: string; basedOn: number};

/**
 * Turns a customer's return history into per-size notes for one product. A "too tight
 * at the chest in M" return means M and smaller will feel snug; the threshold shifts by
 * a size when the returned piece had a looser or closer cut than this one.
 */
export function fitAdvice(profile: FitProfile | null | undefined, product: {fit?: unknown; category?: unknown}, sizes: string[]): FitAdvice | null {
  const signals = (profile?.signals || []).slice(-20).filter(s => sizeIndex(s.size) >= 0);
  const list = sortSizes(sizes);
  if (!signals.length || !list.length) return null;
  const target = easeOf(product.fit);
  const snug: Record<string, Set<string>> = {}, loose: Record<string, Set<string>> = {};
  let tightMax = -1, looseMin = 99, short = 0, long = 0;
  for (const s of signals) {
    if (s.direction === 'short' || s.direction === 'long') { if (s.area === 'length' || s.area === 'sleeves') { if (s.direction === 'short') short++; else long++; } continue; }
    // Positive when this product is cut closer than the returned one: a size behaves one size smaller.
    const shift = Math.round((easeOf(s.fit) - target) / 2.5), threshold = sizeIndex(s.size) + shift;
    for (const size of list) {
      const i = sizeIndex(size);
      if (s.direction === 'tight' && i <= threshold) (snug[size] ||= new Set()).add(AREA_LABEL[s.area]);
      if (s.direction === 'loose' && i >= threshold) (loose[size] ||= new Set()).add(AREA_LABEL[s.area]);
    }
    if (s.direction === 'tight') tightMax = Math.max(tightMax, threshold); else looseMin = Math.min(looseMin, threshold);
  }
  const area = (set: Set<string>) => { const a = [...set].filter(x => x !== 'overall'); return a.length ? 'at the ' + joinWords(a) : 'overall'; };
  // Comfortable pick: the smallest size above every "too tight" size, preferring one below every "too loose" size.
  const fits = list.filter(s => sizeIndex(s) > tightMax && sizeIndex(s) < looseMin);
  const recommended = fits[0] || list.find(s => sizeIndex(s) > tightMax) || '';
  const bySize: Record<string, SizeNote> = {};
  for (const size of list) {
    if (snug[size]) bySize[size] = {tone: 'snug', note: `In your fit, size ${size} will likely feel snug ${area(snug[size])}.`};
    else if (loose[size]) bySize[size] = {tone: 'loose', note: `In your fit, size ${size} may feel loose ${area(loose[size])}.`};
    else if (size === recommended) bySize[size] = {tone: 'good', note: `In your fit, size ${size} should feel comfortable.`};
  }
  const lengthNote = short > long ? 'Pieces have run short on you before. Check the length before ordering.'
    : long > short ? 'Pieces have run long on you before. A tailor can take up the hem if needed.' : '';
  return {bySize, recommended, lengthNote, basedOn: signals.length};
}

// ---------- 2. "Fits like my favourite" ----------

/** Garment measurements in inches. Chest/waist/hip are full circumferences (flat width x 2). */
export type GarmentMeasure = {type?: string; fit?: string; chest?: number; waist?: number; hip?: number; length?: number};
type ChartLike = {columns: string[]; rows: {size: string; values: Record<string, string>}[]};
type ProductLike = {id: string; name: string; sizeChart?: unknown; fit?: unknown; category?: unknown; price?: number; image?: string; colour?: unknown};

const num = (v: unknown, min: number, max: number) => { const n = Number(v); return Number.isFinite(n) && n >= min && n <= max ? Math.round(n * 2) / 2 : undefined; };
export function sanitizeMeasure(raw: unknown): GarmentMeasure {
  const m = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const out: GarmentMeasure = {type: String(m.type || '').slice(0, 40), fit: String(m.fit || '').slice(0, 20),
    chest: num(m.chest, 20, 80), waist: num(m.waist, 18, 80), hip: num(m.hip, 20, 90), length: num(m.length, 12, 70)};
  // Models sometimes return a flat width instead of a circumference.
  for (const k of ['chest', 'waist', 'hip'] as const) { const v = out[k]; if (v !== undefined && v < 26) out[k] = v * 2; }
  return out;
}

const columnKey = (c: string) => /bust|chest/i.test(c) ? 'chest' : /waist/i.test(c) ? 'waist' : /hip/i.test(c) ? 'hip' : '';

/** Body measurements implied by a garment that fits: garment size minus the ease of its cut. */
export function bodyFromGarment(m: GarmentMeasure) {
  const e = easeOf(m.fit);
  return {chest: m.chest && m.chest - e, waist: m.waist && m.waist - e, hip: m.hip && m.hip - (e + 1)};
}

/** Closest chart size for a body; a size that is too small counts double. */
export function sizeForBody(chart: ChartLike, body: {chest?: number; waist?: number; hip?: number}, allowed?: string[]) {
  let best: {size: string; score: number; values: Record<string, number>} | null = null;
  for (const row of chart.rows) {
    if (allowed && !allowed.map(normSize).includes(normSize(row.size))) continue;
    let score = 0, used = 0; const values: Record<string, number> = {};
    for (const col of chart.columns) {
      const k = columnKey(col) as 'chest' | 'waist' | 'hip' | ''; if (!k) continue;
      const b = body[k], v = Number(row.values[col]); if (!b || !Number.isFinite(v) || row.values[col] === '') continue;
      values[k] = v; used++; score += v >= b ? v - b : (b - v) * 2;
    }
    if (used && (!best || score / used < best.score)) best = {size: row.size, score: score / used, values};
  }
  return best;
}

const TYPE_HINTS: [RegExp, RegExp][] = [
  [/kurta|kurti|tunic|top|shirt/i, /kurta/i], [/salwar|churidar|suit|set|co-?ord/i, /salwar|set|co-?ord/i],
  [/anarkali|gown|lehenga|dress|abaya|kaftan/i, /occasion|anarkali|gown|dress/i],
];

export type FavouriteMatch = {productId: string; name: string; size: string; score: number; note: string; price?: number; image?: string};
export function matchFavourite(m: GarmentMeasure, products: ProductLike[], chartFor: (p: ProductLike) => ChartLike, sizesFor: (p: ProductLike) => string[], limit = 6): FavouriteMatch[] {
  const body = bodyFromGarment(m);
  if (!body.chest && !body.waist && !body.hip) return [];
  const out: FavouriteMatch[] = [];
  for (const p of products) {
    const sizes = sizesFor(p); if (!sizes.length) continue;
    const hit = sizeForBody(chartFor(p), body, sizes); if (!hit) continue;
    const sameCut = String(p.fit || '').toLowerCase() === String(m.fit || '').toLowerCase() && !!m.fit;
    const typeRe = TYPE_HINTS.find(([fav]) => fav.test(m.type || ''))?.[1];
    const sameType = !!typeRe && typeRe.test(String(p.category || '') + ' ' + p.name);
    // Compare the garment this size would give with the favourite garment at the chest.
    const chestThere = hit.values.chest !== undefined ? hit.values.chest + easeOf(p.fit) : undefined;
    const diff = chestThere !== undefined && m.chest ? Math.round((chestThere - m.chest) * 2) / 2 : undefined;
    const feel = diff === undefined ? '' : Math.abs(diff) <= 1 ? 'about the same at the chest' : diff > 0 ? `about ${diff} in roomier at the chest` : `about ${-diff} in closer at the chest`;
    const cut = sameCut ? `Same ${String(p.fit).toLowerCase()} cut as your favourite` : p.fit ? `${p.fit} cut` : 'Cut differs';
    out.push({productId: p.id, name: p.name, size: hit.size, price: p.price, image: p.image,
      score: hit.score + (sameCut ? 0 : 1.5) + (sameType ? 0 : 1), note: `${cut}; size ${hit.size} will feel ${feel || 'close to your favourite'}.`});
  }
  return out.sort((a, b) => a.score - b.score).slice(0, limit);
}

// ---------- 3. Occasion planner ----------

export type PlannedEvent = {name: string; setting: 'indoor' | 'outdoor' | ''; time: 'day' | 'evening' | ''; formality: 'festive' | 'formal' | 'casual'};
export type OccasionBrief = {events: PlannedEvent[]; location: string; month: string; budget: number; prefer: string[]; avoid: string[]; weather: string; culture: string};

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const words = (v: unknown, n = 8) => (Array.isArray(v) ? v : String(v || '').split(','))
  .map(x => String(x).trim().toLowerCase().slice(0, 30)).filter(Boolean).slice(0, n);
const clean = (v: unknown, n: number) => String(v || '').replace(/\s+/g, ' ').trim().slice(0, n);

const EVENT_NAMES: [RegExp, string, PlannedEvent['formality']][] = [
  [/haldi/, 'Haldi', 'festive'], [/mehendi|mehndi|henna/, 'Mehendi', 'festive'], [/sangeet/, 'Sangeet', 'festive'],
  [/engagement|nikkah|nikah/, 'Engagement', 'formal'], [/reception/, 'Reception', 'formal'], [/wedding|marriage|kalyanam/, 'Wedding ceremony', 'formal'],
  [/eid/, 'Eid gathering', 'festive'], [/onam/, 'Onam celebration', 'festive'], [/diwali|vishu|christmas|festival/, 'Festival', 'festive'],
  [/party|birthday|dinner/, 'Party', 'festive'], [/office|work|meeting/, 'Office', 'casual'],
];

/** Rule-based reading of a brief; used when Workers AI is unavailable and to fill gaps. */
export function parseBriefFallback(text: unknown): OccasionBrief {
  const t = String(text || '').toLowerCase();
  const named = EVENT_NAMES.filter(([re]) => re.test(t));
  const countWord: Record<string, number> = {one: 1, two: 2, three: 3, four: 4, five: 5, six: 6};
  const cm = t.match(/(\d+|one|two|three|four|five|six)\s*(?:events?|functions?|days?|looks?|outfits?)/);
  const count = Math.min(6, Math.max(1, cm ? Number(countWord[cm[1]] || cm[1]) : named.length || 1));
  const setting: PlannedEvent['setting'] = /outdoor|garden|beach|lawn|open.?air/.test(t) ? 'outdoor' : /indoor|hall|ballroom/.test(t) ? 'indoor' : '';
  const time: PlannedEvent['time'] = /evening|night/.test(t) ? 'evening' : /morning|day|lunch/.test(t) ? 'day' : '';
  const events: PlannedEvent[] = [];
  const isWedding = named.some(n => n[1] === 'Wedding ceremony');
  // A wedding with more events than named usually runs haldi/mehendi, ceremony, reception.
  const weddingRun = count >= 4 ? ['Haldi', 'Mehendi', 'Wedding ceremony', 'Reception', 'Family lunch', 'Send-off'] : count === 3 ? ['Mehendi', 'Wedding ceremony', 'Reception'] : ['Wedding ceremony', 'Reception'];
  const names = isWedding && named.length < count ? weddingRun.slice(0, count)
    : Array.from({length: count}, (_, i) => named[i]?.[1] || (named[0] ? `${named[0][1]} · day ${i + 1}` : count > 1 ? `Event ${i + 1}` : 'Occasion'));
  for (const name of names) {
    const n = EVENT_NAMES.find(([, label]) => label === name);
    events.push({name, setting, time: time || (/Reception|Sangeet/.test(name) ? 'evening' : /Haldi|Mehendi|lunch/.test(name) ? 'day' : ''),
      formality: n ? n[2] : named[0]?.[2] || 'festive'});
  }
  const bm = t.match(/(?:qar|qr|budget|under|upto|up to|max)\s*(?:of\s*)?(\d[\d,]*)|(\d[\d,]*)\s*(?:qar|qr|riyal)/);
  const loc = String(text || '').match(/\b(?:in|at)\s+([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)?)/);
  const avoid = [...t.matchAll(/(?:no|avoid|not|without)\s+([a-z]+)/g)].map(m => m[1]).filter(w => COLOUR_WORDS.includes(w));
  const prefer = COLOUR_WORDS.filter(c => new RegExp('\\b' + c + '\\b').test(t) && !avoid.includes(c));
  return {events, location: loc?.[1] || '', month: (m => m ? m[0].toUpperCase() + m.slice(1) : '')(MONTHS.find(m => t.includes(m) || t.includes(m.slice(0, 3) + ' '))),
    budget: bm ? Number((bm[1] || bm[2]).replaceAll(',', '')) : 0, prefer, avoid,
    weather: setting === 'outdoor' ? 'Outdoor events: breathable fabrics will keep you comfortable.' : '', culture: ''};
}

/** Validates an AI-read brief, filling anything missing from the rule-based reading. */
export function sanitizeBrief(raw: unknown, text: string): OccasionBrief {
  const fb = parseBriefFallback(text), r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const events = (Array.isArray(r.events) ? r.events : []).slice(0, 6).map((e: Record<string, unknown>) => ({
    name: clean(e?.name, 40) || 'Event',
    setting: (['indoor', 'outdoor'].includes(String(e?.setting)) ? e.setting : '') as PlannedEvent['setting'],
    time: (['day', 'evening'].includes(String(e?.time)) ? e.time : '') as PlannedEvent['time'],
    formality: (['festive', 'formal', 'casual'].includes(String(e?.formality)) ? e.formality : 'festive') as PlannedEvent['formality'],
  }));
  const budget = Number(r.budget);
  return {events: events.length ? events : fb.events, location: clean(r.location, 40) || fb.location, month: clean(r.month, 20) || fb.month,
    budget: Number.isFinite(budget) && budget > 0 ? Math.round(budget) : fb.budget,
    prefer: words(r.prefer).length ? words(r.prefer) : fb.prefer, avoid: [...new Set([...words(r.avoid), ...fb.avoid])],
    weather: clean(r.weather, 220) || fb.weather, culture: clean(r.culture, 260)};
}

const COLOUR_WORDS = ['red', 'maroon', 'wine', 'pink', 'rose', 'peach', 'orange', 'yellow', 'mustard', 'gold', 'green', 'sage', 'mint', 'teal', 'blue', 'navy', 'purple', 'lavender', 'lilac', 'ivory', 'white', 'cream', 'beige', 'black', 'grey', 'silver'];
const RICH = /wine|maroon|black|gold|navy|emerald|purple|red|plum|bottle/i, LIGHT = /ivory|white|cream|sage|mint|rose|peach|blue|yellow|lavender|pastel|pink|beige/i;
const AIRY = /cotton|linen|chanderi|mul|khadi|voile|georgette|chiffon|organza/i, HEAVY = /velvet|brocade|banarasi|raw silk/i;
const TO_OCCASION: [RegExp, string][] = [[/wedding|reception|engagement|mehendi|haldi|sangeet|nikah/i, 'Wedding'], [/eid/i, 'Eid'], [/onam|vishu|kasavu/i, 'Onam']];

type PlanProduct = ProductLike & {fabric?: unknown; occasion?: unknown; price: number};
/** How well a piece suits one event; higher is better. */
export function scoreForEvent(p: PlanProduct, e: PlannedEvent, brief: OccasionBrief, hot: boolean) {
  const colour = String(p.colour || '').toLowerCase(), fabric = String(p.fabric || ''), occ = String(p.occasion || ''), cat = String(p.category || '');
  let s = 0;
  const want = TO_OCCASION.find(([re]) => re.test(e.name))?.[1];
  if (want && occ.includes(want)) s += 4;
  if (e.formality !== 'casual' && /occasion|salwar/i.test(cat)) s += 2;
  if (e.formality === 'casual' && (/everyday/i.test(occ) || /everyday|kurta/i.test(cat))) s += 3;
  if (e.formality === 'formal' && /occasion/i.test(cat)) s += 1;
  if (brief.prefer.some(c => colour.includes(c))) s += 3;
  if (brief.avoid.some(c => colour.includes(c))) s -= 10;
  if (e.time === 'evening' && RICH.test(colour)) s += 1.5;
  if (e.time === 'day' && LIGHT.test(colour)) s += 1.5;
  if ((e.setting === 'outdoor' || hot) && AIRY.test(fabric)) s += 1.5;
  if ((e.setting === 'outdoor' || hot) && HEAVY.test(fabric)) s -= 2;
  return s;
}

export type PlannedLook = {event: PlannedEvent; productId: string; name: string; price: number; image?: string; colour: string; fabric: string; why: string; styling: string[]};
export type AiPick = {event?: unknown; productId?: unknown; why?: unknown; styling?: unknown};

/**
 * Builds one look per event: uses the AI stylist's picks when they are real, in stock,
 * unrepeated and suitable; otherwise falls back to the best-scoring piece. Keeps the plan
 * inside the budget by swapping the priciest look for cheaper alternatives.
 */
export function planLooks(brief: OccasionBrief, products: PlanProduct[], aiPicks: AiPick[] = []): {looks: PlannedLook[]; total: number} {
  const loc = brief.location.toLowerCase(), month = brief.month.toLowerCase();
  const hot = /hot|humid|warm/i.test(brief.weather) || /kochi|cochin|kerala|chennai|goa|mumbai|colombo/.test(loc)
    || (/doha|qatar|dubai|uae|abu dhabi|riyadh|muscat/.test(loc) && !!month && !/nov|dec|jan|feb|mar/.test(month));
  const byId = new Map(products.map(p => [p.id, p]));
  const used = new Set<string>(), looks: PlannedLook[] = [];
  const perLook = brief.budget ? brief.budget / Math.max(1, brief.events.length) : Infinity;
  brief.events.forEach((e, i) => {
    const pick = aiPicks.find(a => Number(a.event) === i) || aiPicks[i];
    const ranked = products.filter(p => !used.has(p.id)).map(p => ({p, s: scoreForEvent(p, e, brief, hot)})).sort((a, b) => b.s - a.s || a.p.price - b.p.price);
    const aiP = pick && byId.get(String(pick.productId));
    const aiOk = aiP && !used.has(aiP.id) && scoreForEvent(aiP, e, brief, hot) > -5 && (aiP.price <= perLook * 1.25);
    const affordable = ranked.find(r => r.p.price <= perLook) || ranked[ranked.length - 1];
    const p = aiOk ? aiP : (affordable?.p || ranked[0]?.p);
    if (!p) return;
    used.add(p.id);
    const styling = Array.isArray(pick?.styling) && aiOk ? (pick!.styling as unknown[]).map(x => clean(x, 140)).filter(Boolean).slice(0, 4) : defaultStyling(e, p);
    looks.push({event: e, productId: p.id, name: p.name, price: p.price, image: p.image, colour: String(p.colour || ''), fabric: String(p.fabric || ''),
      why: (aiOk && clean(pick?.why, 260)) || defaultWhy(e, p, brief, hot), styling: styling.length ? styling : defaultStyling(e, p)});
  });
  // Budget guard: swap the most expensive look for the best cheaper piece until within budget.
  for (let guard = 0; brief.budget && guard < 12; guard++) {
    const total = looks.reduce((n, l) => n + l.price, 0); if (total <= brief.budget) break;
    const priciest = [...looks].sort((a, b) => b.price - a.price)[0], idx = looks.indexOf(priciest);
    const alt = products.filter(p => p.price < priciest.price && !looks.some(l => l.productId === p.id))
      .map(p => ({p, s: scoreForEvent(p, priciest.event, brief, hot)})).sort((a, b) => b.s - a.s || a.p.price - b.p.price)[0];
    if (!alt) break;
    looks[idx] = {...priciest, productId: alt.p.id, name: alt.p.name, price: alt.p.price, image: alt.p.image, colour: String(alt.p.colour || ''), fabric: String(alt.p.fabric || ''),
      why: defaultWhy(priciest.event, alt.p, brief, hot) + ' Chosen to keep the plan within your budget.', styling: defaultStyling(priciest.event, alt.p)};
  }
  return {looks, total: looks.reduce((n, l) => n + l.price, 0)};
}

function defaultWhy(e: PlannedEvent, p: PlanProduct, b: OccasionBrief, hot: boolean) {
  const bits = [`${p.colour} ${String(p.fabric || '').toLowerCase()} suits a ${e.formality} ${e.name.toLowerCase()}`];
  if ((e.setting === 'outdoor' || hot) && AIRY.test(String(p.fabric))) bits.push('and stays breathable outdoors');
  if (e.time === 'evening' && RICH.test(String(p.colour))) bits.push('with a richer tone for the evening');
  if (e.time === 'day' && LIGHT.test(String(p.colour))) bits.push('in a fresh daytime shade');
  if (b.prefer.some(c => String(p.colour).toLowerCase().includes(c))) bits.push('in a colour you asked for');
  return bits.join(' ') + '.';
}
function defaultStyling(e: PlannedEvent, p: PlanProduct) {
  const rich = RICH.test(String(p.colour));
  return [e.formality === 'casual' ? 'Keep jewellery minimal: small studs and a slim bangle.' : rich ? 'Gold-toned jhumkas and stacked bangles lift the deeper colour.' : 'Pearl or kundan studs keep the light shade elegant.',
    e.setting === 'outdoor' ? 'Block heels or embellished flats work best on grass and uneven ground.' : 'Embellished juttis or mojaris complete the look.',
    e.time === 'evening' ? 'Carry a compact potli bag and a light shawl for the evening.' : 'Pin the dupatta on one shoulder so it stays in place.'];
}
