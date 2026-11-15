// Serves store photos straight from R2, before the website framework runs.
// `?w=640` asks for the small phone-size WebP (stored as `t/<key>`); until one exists
// the original is sent with a short cache life. Long-lived responses are kept in
// Cloudflare's edge cache so repeat views skip R2 entirely.
type Bucket = {get(key: string): Promise<{body: ReadableStream; httpEtag: string; httpMetadata?: {contentType?: string}} | null>};
export const MEDIA_PATH = /^\/api\/media\/([a-f0-9-]{36})$/;

export async function serveMedia(request: Request, bucket: Bucket | undefined, waitUntil?: (p: Promise<unknown>) => void) {
  const url = new URL(request.url), key = url.pathname.match(MEDIA_PATH)?.[1];
  if (!key || !bucket) return new Response('Not found', {status: 404});
  const small = url.searchParams.get('w') === '640';
  const edge = typeof caches !== 'undefined' ? (caches as unknown as {default: Cache}).default : null;
  const cacheKey = new Request(url.origin + url.pathname + (small ? '?w=640' : ''));
  const hit = await edge?.match(cacheKey).catch(() => undefined);
  if (hit) {
    const etag = hit.headers.get('ETag');
    if (etag && request.headers.get('If-None-Match') === etag) return new Response(null, {status: 304, headers: hit.headers});
    return new Response(request.method === 'HEAD' ? null : hit.body, hit);
  }
  let f = small ? await bucket.get('t/' + key) : null;
  const isThumb = !!f;
  if (!f) f = await bucket.get(key);
  if (!f) return new Response('Not found', {status: 404});
  const longLived = !small || isThumb;
  const headers = new Headers({
    'Content-Type': f.httpMetadata?.contentType || 'application/octet-stream',
    'Cache-Control': longLived ? 'public,max-age=31536000,immutable' : 'public,max-age=600',
    'ETag': f.httpEtag,
    'X-Content-Type-Options': 'nosniff',
  });
  if (small) headers.set('X-Thumb', isThumb ? '1' : '0');
  if (request.headers.get('If-None-Match') === f.httpEtag) return new Response(null, {status: 304, headers});
  if (!longLived || !edge) return new Response(request.method === 'HEAD' ? null : f.body, {headers});
  const [a, b] = f.body.tee();
  const store = edge.put(cacheKey, new Response(b, {headers})).catch(() => {});
  if (waitUntil) waitUntil(store); else await store;
  return new Response(request.method === 'HEAD' ? null : a, {headers});
}
