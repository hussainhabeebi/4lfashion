// Thin wrapper around the Cloudflare Workers AI binding (`env.AI`).
// Every call is time-boxed and returns null on any failure so callers can fall back
// to the deterministic logic in lib/fit-ai.ts.

/** Fast, capable text model for reading return reasons and occasion briefs. */
export const TEXT_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
/** Multimodal model for reading garment photos. */
export const VISION_MODEL = '@cf/meta/llama-4-scout-17b-16e-instruct';

export type AiBinding = {run(model: string, input: Record<string, unknown>): Promise<unknown>};
type Content = string | ({type: 'text'; text: string} | {type: 'image_url'; image_url: {url: string}})[];

const withTimeout = <T,>(p: Promise<T>, ms: number) => Promise.race([p, new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Workers AI timed out')), ms))]);

/** Pulls the first JSON object out of a model reply (plain, fenced or already parsed). */
export function parseJsonReply(reply: unknown): Record<string, unknown> | null {
  const r = reply && typeof reply === 'object' && 'response' in reply ? (reply as {response: unknown}).response : reply;
  if (r && typeof r === 'object') return r as Record<string, unknown>;
  const text = String(r ?? '');
  const start = text.indexOf('{'), end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try { return JSON.parse(text.slice(start, end + 1)); } catch { return null; }
}

/**
 * Runs a chat model and returns its JSON answer. Asks for schema-constrained JSON first;
 * if the model rejects `response_format`, retries once with the schema in the prompt only.
 */
export async function aiJson(ai: AiBinding | undefined | null, opts: {model?: string; system: string; user: Content; schema?: Record<string, unknown>; maxTokens?: number; timeoutMs?: number}): Promise<Record<string, unknown> | null> {
  if (!ai) return null;
  const messages = [{role: 'system', content: opts.system + '\nReply with one JSON object only.'}, {role: 'user', content: opts.user}];
  const base = {messages, max_tokens: opts.maxTokens ?? 900, temperature: 0.2};
  const attempts = opts.schema ? [{...base, response_format: {type: 'json_schema', json_schema: opts.schema}}, base] : [base];
  for (const input of attempts) {
    try {
      const parsed = parseJsonReply(await withTimeout(ai.run(opts.model || TEXT_MODEL, input), opts.timeoutMs ?? 25000));
      if (parsed) return parsed;
    } catch (e) {
      console.warn('Workers AI call failed', opts.model || TEXT_MODEL, e instanceof Error ? e.message : e);
    }
  }
  return null;
}
