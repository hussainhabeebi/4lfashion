import {env} from 'cloudflare:workers';
import {serveMedia} from '../../../../lib/media-serve';
// Normally answered earlier by the worker's fast path (worker/index.ts); kept as a fallback.
export async function GET(req: Request) {
  return serveMedia(req, (env as unknown as {BUCKET?: Parameters<typeof serveMedia>[1]}).BUCKET);
}
