// Workers AI layer for "Life in Qatar". The model gets the checked facts from ./qatar
// (norms, climate, festival notes, live stock) and writes personal advice and picks;
// every pick is validated and topped up from the rule-based ranking.
import {aiJson, type AiBinding} from './workers-ai';
import {PLACES, GENERAL_NORMS, findPlaces, climateFor, dressGuideFallback, monthWardrobe, festivalWant, topPicks, mergePicks, cleanList, scoreFor,
  WELCOME_SECTIONS, themePicks, type QProduct, type Pick, type Festival, type Member} from './qatar';

export type SizedProduct = QProduct & {sizes?: string[]};
const PICKS = {type: 'array', items: {type: 'object', properties: {productId: {type: 'string'}, why: {type: 'string'}}, required: ['productId', 'why']}};
const STORE = 'You are the stylist at 4L Fashion, a modest-fashion boutique in Doha, Qatar, serving expat families (Indian, Malayali, Pakistani, Sri Lankan, Filipino, Arab and more). '
  + 'Be warm, practical and respectful of Qatari culture. Never invent dates, events, prices or rules. Only recommend products from the catalogue list, by exact id.';
const catalogue = (ps: QProduct[]) => ps.map(p => `${p.id} | ${p.name} | ${p.category} | ${p.colour} | ${p.fabric} | ${p.fit || '-'} | occasions: ${p.occasion || '-'} | QAR ${p.price}`).join('\n');
const shortlist = (ps: QProduct[], score: (p: QProduct) => number, n = 40) => ps.map(p => ({p, s: score(p)})).sort((a, b) => b.s - a.s).slice(0, n).map(x => x.p);
const str = (v: unknown, n: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);

// ---------- Dress-sense guide ----------
export async function dressGuide(ai: AiBinding | undefined, question: string, products: QProduct[], month: number) {
  const base = dressGuideFallback(question, products, month), cl = climateFor(month);
  const places = findPlaces(question);
  const reply = await aiJson(ai, {maxTokens: 900, schema: {type: 'object', properties: {answer: {type: 'string'}, tips: {type: 'array', items: {type: 'string'}}, picks: PICKS}, required: ['answer', 'picks']},
    system: STORE + ' Answer a dress-code question for life in Qatar in 2-4 sentences, then up to 4 short practical tips, then pick 3-4 outfits. '
      + 'Base the etiquette ONLY on these facts:\n' + [...GENERAL_NORMS, ...PLACES.map(p => `${p.label}: ${p.norms.join(' ')}`)].join('\n'),
    user: `Question: """${question.slice(0, 400)}"""\nMonth: ${cl.month} (Doha ${cl.high}°C day / ${cl.low}°C night, humidity ${cl.humidity}).\nLikely places: ${places.map(p => p.label).join('; ')}\n\nCatalogue:\n${catalogue(shortlist(products, p => Math.max(...places.map(pl => scoreFor(p, {formality: pl.formality, modest: pl.level + 1}))) ))}`});
  return {...base, answer: str(reply?.answer, 700) || base.answer, tips: cleanList(reply?.tips, 4), picks: mergePicks(reply?.picks, products, base.picks, 4), source: reply ? 'ai' : 'rules'};
}

// ---------- This month: AC-to-heat wardrobe ----------
export async function monthGuide(ai: AiBinding | undefined, month: number, products: QProduct[]) {
  const w = monthWardrobe(month), c = w.climate;
  const fallback = topPicks(products, w.want, 4, p => `${p.fabric} in ${String(p.colour).toLowerCase()} ${w.hot ? 'breathes in the heat and hides perspiration' : 'is comfortable for ' + c.month}.`);
  const reply = await aiJson(ai, {maxTokens: 700, schema: {type: 'object', properties: {intro: {type: 'string'}, tips: {type: 'array', items: {type: 'string'}}, picks: PICKS}, required: ['intro', 'picks']},
    system: STORE + ' Write a short monthly wardrobe note for Doha: going from outdoor heat to cold air-conditioning (often 18–20°C), breathable fabrics, a light layer, and colours that hide perspiration. 1-2 sentence intro, up to 3 extra tips, and 4 picks.',
    user: `Month: ${c.month}. Doha averages ${c.high}°C by day and ${c.low}°C at night, humidity ${c.humidity}.\nFacts: ${w.tips.join(' ')}\n\nCatalogue:\n${catalogue(shortlist(products, p => scoreFor(p, w.want)))}`});
  return {climate: c, headline: w.headline, intro: str(reply?.intro, 400), tips: [...w.tips, ...cleanList(reply?.tips, 3)].slice(0, 6), picks: mergePicks(reply?.picks, products, fallback, 4), source: reply ? 'ai' : 'rules'};
}

// ---------- Festival far from home ----------
export async function festivalKit(ai: AiBinding | undefined, f: Festival & {when: string}, products: QProduct[], events: {name: string; date: string; venue?: string}[]) {
  const want = festivalWant(f);
  const fallback = topPicks(products, want, 4, p => `${p.colour} ${String(p.fabric || '').toLowerCase()} for ${f.name}: ${f.dress.toLowerCase()}`);
  const reply = await aiJson(ai, {maxTokens: 800, schema: {type: 'object', properties: {intro: {type: 'string'}, call: {type: 'array', items: {type: 'string'}}, picks: PICKS}, required: ['intro', 'picks']},
    system: STORE + ` Help someone celebrate ${f.name} in Doha, far from family. 1-2 warm sentences, 2-3 ideas for the family video call, and 4 outfit picks. Do not mention dates or events beyond those given.`,
    user: `Festival: ${f.name} (${f.communities}). Date: ${f.when}. Traditional dress: ${f.dress}\nVideo-call ideas to build on: ${f.call.join(' ')}\nDoha community events listed by the store: ${events.map(e => `${e.name}, ${e.date}${e.venue ? ', ' + e.venue : ''}`).join('; ') || 'none listed'}\n\nCatalogue:\n${catalogue(shortlist(products, p => scoreFor(p, want)))}`});
  return {intro: str(reply?.intro, 400), call: [...cleanList(reply?.call, 3), ...f.call].slice(0, 4), picks: mergePicks(reply?.picks, products, fallback, 4), source: reply ? 'ai' : 'rules'};
}

// ---------- New-to-Qatar welcome kit ----------
export async function welcomeKit(ai: AiBinding | undefined, members: Member[], budget: number, products: SizedProduct[], month: number) {
  const hasSize = (p: SizedProduct, m: Member) => !m.size || !p.sizes || p.sizes.map(s => s.toUpperCase()).includes(m.size.toUpperCase());
  const adults = members.filter(m => !m.age || m.age >= 13), kids = members.filter(m => m.age && m.age < 13);
  const used: string[] = [], plan: {id: string; label: string; items: (Pick & {member: string})[]}[] = [];
  const perPiece = budget > 0 ? budget / Math.max(1, adults.length * WELCOME_SECTIONS.length) : 0;
  for (const s of WELCOME_SECTIONS) {
    const items: (Pick & {member: string})[] = [];
    for (const m of adults.filter(s.for)) {
      const pool = products.filter(p => hasSize(p, m));
      const pick = topPicks(pool, {...s.want, budget: perPiece || undefined}, 1, p => `${p.colour} ${String(p.fabric || '').toLowerCase()}: ${s.why}${m.size ? '. In stock in ' + m.size : ''}.`, used)[0];
      if (pick) { used.push(pick.productId); items.push({...pick, member: m.who}); }
    }
    plan.push({id: s.id, label: s.label, items});
  }
  const cl = climateFor(month);
  const reply = await aiJson(ai, {maxTokens: 700, schema: {type: 'object', properties: {intro: {type: 'string'}, tips: {type: 'array', items: {type: 'string'}}, why: {type: 'array', items: {type: 'object', properties: {productId: {type: 'string'}, why: {type: 'string'}}}}}, required: ['intro']},
    system: STORE + ' A family has just arrived in Qatar. Welcome them in 2 sentences, give up to 4 practical dress-norm tips for settling in (school, office, malls, government offices), and one short reason per chosen piece. Use only these norms:\n' + GENERAL_NORMS.join('\n'),
    user: `Family: ${members.map(m => m.who + (m.age ? ` (${m.age})` : '') + (m.size ? ` size ${m.size}` : '')).join(', ')}. Budget: ${budget ? 'QAR ' + budget : 'not set'}. Month: ${cl.month}, ${cl.high}°C.\nChosen pieces:\n${plan.flatMap(s => s.items.map(i => `${i.productId} | ${s.label} for ${i.member} | ${i.name} | ${i.colour} ${i.fabric}`)).join('\n')}`});
  const why = new Map(((Array.isArray(reply?.why) ? reply!.why : []) as {productId?: unknown; why?: unknown}[]).map(w => [String(w?.productId), str(w?.why, 200)]));
  for (const s of plan) for (const i of s.items) if (why.get(i.productId)) i.why = why.get(i.productId)!;
  const total = plan.reduce((n, s) => n + s.items.reduce((a, i) => a + i.price, 0), 0);
  return {intro: str(reply?.intro, 400) || `Welcome to Qatar! Here’s a starter wardrobe for ${members.map(m => m.who).join(', ')}, chosen for ${cl.month} in Doha and local dress norms.`,
    tips: cleanList(reply?.tips, 4).length ? cleanList(reply?.tips, 4) : GENERAL_NORMS, sections: plan, total,
    kidsNote: kids.length ? `Our sizes start at adult M. For ${kids.map(k => k.who).join(', ')}, our team can make school-event outfits to measure. Message us on WhatsApp.` : '', source: reply ? 'ai' : 'rules'};
}

// ---------- Community group theme ----------
export async function themeMatch(ai: AiBinding | undefined, theme: string, products: QProduct[]) {
  const fallback = themePicks(theme, products, 4);
  const reply = await aiJson(ai, {maxTokens: 500, schema: {type: 'object', properties: {picks: PICKS}, required: ['picks']},
    system: STORE + ' A community group (association, church, school or mosque group) wants matching outfits. Pick up to 4 catalogue pieces that best match their theme, most suitable first, each with a one-line reason.',
    user: `Theme: """${theme.slice(0, 200)}"""\n\nCatalogue:\n${catalogue(products.slice(0, 80))}`});
  return {picks: mergePicks(reply?.picks, products, fallback, 4), source: reply ? 'ai' : 'rules'};
}
