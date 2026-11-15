import {env} from 'cloudflare:workers';

// Serves store photos from R2. `?w=640` asks for the small WebP made at upload time
// (stored as `t/<key>`); until one exists the original is sent with a short cache life.
// Responses are kept in Cloudflare's edge cache so repeat views skip R2 entirely.
export async function GET(req: Request, {params}: {params: Promise<{key: string}>}) {
  const {key} = await params;
  if (!/^[a-f0-9-]{36}$/.test(key) || !env.BUCKET) return new Response('Not found', {status: 404});
  const url = new URL(req.url), small = url.searchParams.get('w') === '640';
  const edge = typeof caches !== 'undefined' ? (caches as unknown as {default: Cache}).default : null;
  const cacheKey = new Request(url.origin + url.pathname + (small ? '?w=640' : ''));
  const hit = await edge?.match(cacheKey).catch(() => undefined);
  if (hit) return new Response(hit.body, hit);
  let f = small ? await env.BUCKET.get('t/' + key) : null;
  const isThumb = !!f;
  if (!f) f = await env.BUCKET.get(key);
  if (!f) return new Response('Not found', {status: 404});
  const longLived = !small || isThumb;
  const body = await f.arrayBuffer();
  const res = new Response(body, {headers: {
    'Content-Type': f.httpMetadata?.contentType || 'application/octet-stream',
    'Cache-Control': longLived ? 'public,max-age=31536000,immutable' : 'public,max-age=600',
    'X-Content-Type-Options': 'nosniff',
    ...(small ? {'X-Thumb': isThumb ? '1' : '0'} : {}),
  }});
  if (longLived && edge) await edge.put(cacheKey, new Response(body.slice(0), res)).catch(() => {});
  return res;
}
