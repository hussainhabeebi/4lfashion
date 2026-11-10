// Server-side AI features for the storefront, powered by Cloudflare Workers AI.
// Each function uses the model for language/vision understanding and the deterministic
// rules in ./fit-ai for the final answer, so a missing or failing model degrades gracefully.
import {aiJson, VISION_MODEL, type AiBinding} from './workers-ai';
import {extractFitIssuesFallback, sanitizeIssues, sanitizeMeasure, sanitizeBrief, planLooks, scoreForEvent, parseBriefFallback,
  FIT_AREAS, FIT_DIRECTIONS, type FitIssue, type GarmentMeasure, type OccasionBrief, type AiPick} from './fit-ai';

// ---------- 1. Fit memory: read a return reason ----------

const ISSUE_SCHEMA = {type: 'object', properties: {issues: {type: 'array', items: {type: 'object', properties: {
  area: {type: 'string', enum: [...FIT_AREAS]}, direction: {type: 'string', enum: [...FIT_DIRECTIONS]}}, required: ['area', 'direction']}}}, required: ['issues']};

export async function readFitIssues(ai: AiBinding | undefined, reason: string, garment: string): Promise<{issues: FitIssue[]; source: 'ai' | 'rules'}> {
  const text = String(reason || '').slice(0, 800);
  if (!text.trim()) return {issues: [], source: 'rules'};
  const reply = await aiJson(ai, {
    system: 'You read clothing return reasons for a modest-fashion store (kurtas, salwar suits, occasion wear) and extract only FIT problems. '
      + `area is one of ${FIT_AREAS.join(', ')} (use "overall" when no body area is named). direction is tight, loose, short or long. `
      + '"Too small" means tight; "too big" means loose. Ignore colour, quality, delivery and change-of-mind reasons. Return {"issues": []} when there is no fit problem.',
    user: `Garment: ${garment}\nCustomer's reason: """${text}"""`, schema: ISSUE_SCHEMA, maxTokens: 200, timeoutMs: 12000});
  const fromAi = reply ? sanitizeIssues(reply.issues) : null;
  if (fromAi) return {issues: fromAi, source: 'ai'};
  return {issues: extractFitIssuesFallback(text), source: 'rules'};
}

// ---------- 2. "Fits like my favourite": measure a garment photo ----------

const MEASURE_SCHEMA = {type: 'object', properties: {
  type: {type: 'string'}, fit: {type: 'string', enum: ['Fitted', 'Regular', 'Relaxed', 'Flared', 'Oversized']},
  chest: {type: 'number'}, waist: {type: 'number'}, hip: {type: 'number'}, length: {type: 'number'},
  confidence: {type: 'string', enum: ['low', 'medium', 'high']}, note: {type: 'string'}}, required: ['type', 'fit', 'chest', 'length', 'confidence']};

const REFERENCES: Record<string, string> = {
  a4: 'an A4 sheet of paper (8.3 x 11.7 in / 21 x 29.7 cm)', card: 'a bank card (3.37 x 2.13 in / 8.56 x 5.4 cm)',
  phone: 'a typical smartphone (about 6 x 3 in)', none: 'no reference object; estimate from typical bed and garment proportions',
};

export async function measureGarmentPhoto(ai: AiBinding | undefined, image: string, reference: string): Promise<{measure: GarmentMeasure; confidence: string; note: string} | null> {
  if (!ai) return null;
  const ref = REFERENCES[reference] || REFERENCES.none;
  const reply = await aiJson(ai, {model: VISION_MODEL, maxTokens: 400, timeoutMs: 30000, schema: MEASURE_SCHEMA,
    system: 'You are a garment technologist measuring a garment laid flat in a photo. Use the reference object to set the scale. '
      + 'Report FULL circumferences in inches: chest = pit-to-pit width x 2, waist = narrowest flat width x 2, hip = flat width at the hip line x 2 (omit hip if the garment ends above the hip). '
      + 'length = shoulder seam to hem in inches. type = garment type (e.g. kurta, salwar top, anarkali, tunic, dress, shirt). fit = the cut. '
      + 'Be honest about confidence. note = one short sentence about anything that limits accuracy.',
    user: [{type: 'text', text: `The reference object in the photo is ${ref}. Measure the garment.`}, {type: 'image_url', image_url: {url: image}}]});
  if (!reply) return null;
  const measure = sanitizeMeasure(reply);
  if (!measure.chest && !measure.waist && !measure.hip) return null;
  return {measure, confidence: ['low', 'medium', 'high'].includes(String(reply.confidence)) ? String(reply.confidence) : 'low', note: String(reply.note || '').slice(0, 200)};
}

// ---------- 3. Occasion planner ----------

const BRIEF_SCHEMA = {type: 'object', properties: {
  brief: {type: 'object', properties: {
    events: {type: 'array', items: {type: 'object', properties: {name: {type: 'string'}, setting: {type: 'string', enum: ['indoor', 'outdoor', '']},
      time: {type: 'string', enum: ['day', 'evening', '']}, formality: {type: 'string', enum: ['festive', 'formal', 'casual']}}, required: ['name', 'formality']}},
    location: {type: 'string'}, month: {type: 'string'}, budget: {type: 'number'},
    prefer: {type: 'array', items: {type: 'string'}}, avoid: {type: 'array', items: {type: 'string'}},
    weather: {type: 'string'}, culture: {type: 'string'}}, required: ['events']},
  looks: {type: 'array', items: {type: 'object', properties: {event: {type: 'number'}, productId: {type: 'string'}, why: {type: 'string'},
    styling: {type: 'array', items: {type: 'string'}}}, required: ['event', 'productId', 'why']}}}, required: ['brief', 'looks']};

type PlanProduct = {id: string; name: string; category?: unknown; colour?: unknown; fabric?: unknown; occasion?: unknown; fit?: unknown; price: number; image?: string};

export async function planOccasion(ai: AiBinding | undefined, text: string, products: PlanProduct[], currency = 'QAR') {
  const brief0 = parseBriefFallback(text);
  // Shortlist so the prompt stays small: best-scoring pieces across the likely events, plus variety.
  const scored = products.map(p => ({p, s: Math.max(...brief0.events.map(e => scoreForEvent(p, e, brief0, false)))})).sort((a, b) => b.s - a.s);
  const shortlist = scored.slice(0, 60).map(x => x.p);
  const lines = shortlist.map(p => `${p.id} | ${p.name} | ${p.category} | ${p.colour} | ${p.fabric} | occasions: ${p.occasion || '-'} | ${p.fit || '-'} | ${currency} ${p.price}`).join('\n');
  const reply = await aiJson(ai, {maxTokens: 1400, timeoutMs: 30000, schema: BRIEF_SCHEMA,
    system: 'You are the senior stylist at 4L Fashion, a modest-fashion boutique in Doha (kurtas, salwar suits, Kerala and South Asian occasion wear). '
      + 'Read the customer brief, work out each event (if they give a count but no names, use the usual sequence for that occasion and culture), '
      + 'the likely weather for that place and month, and cultural colour etiquette (for example, do not upstage the bride; white/black may be avoided at some Hindu weddings; ivory and gold kasavu suits Kerala ceremonies). '
      + 'Budget is the TOTAL in the store currency unless they say per look; 0 if not given. '
      + 'Pick exactly one product per event ONLY from the catalogue list by its exact id, never repeating a product, keeping the total within budget. '
      + 'why = one or two warm sentences linking the piece to the event, weather and colour rules. styling = 2-3 short tips (jewellery, footwear, dupatta, bag) not sold here. '
      + 'weather = one sentence. culture = one or two sentences of colour/etiquette guidance.',
    user: `Customer brief: """${String(text).slice(0, 600)}"""\nCurrency: ${currency}\n\nCatalogue (id | name | category | colour | fabric | occasions | cut | price):\n${lines}`});
  const brief: OccasionBrief = sanitizeBrief(reply?.brief, text);
  const picks = (Array.isArray(reply?.looks) ? reply!.looks : []) as AiPick[];
  const {looks, total} = planLooks(brief, products, picks);
  return {brief, looks, total, source: reply ? 'ai' as const : 'rules' as const};
}
