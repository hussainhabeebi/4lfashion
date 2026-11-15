import {env} from 'cloudflare:workers';
import {initialSettings} from './catalog';

// The public catalog, read on the server so the first HTML already contains the
// products: phones can start downloading photos before any JavaScript has run.
// Mirrors the public part of GET /api/store?action=catalog (signed-in details stay client-side).
export type PublicCatalog = {products: Record<string, unknown>[]; variants: Record<string, unknown>[]; settings: Record<string, unknown>; seeded: boolean};
type Row = {id: string; data: string; owner: string | null; created: string};

export async function publicCatalog(): Promise<PublicCatalog | null> {
  const db = (env as unknown as {DB?: D1Database}).DB;
  if (!db) return null;
  try {
    const rows = (r: D1Result<Row>) => r.results.map(x => ({...JSON.parse(x.data), id: x.id, owner: x.owner, created: x.created}));
    const [ps, vs, st, init] = await Promise.all([
      db.prepare("SELECT * FROM records WHERE kind='product' ORDER BY created DESC").all<Row>(),
      db.prepare('SELECT * FROM variants').all<Record<string, unknown>>(),
      db.prepare("SELECT * FROM records WHERE kind='settings' ORDER BY created DESC").all<Row>(),
      db.prepare("SELECT id FROM records WHERE id='store-initialized'").first(),
    ]);
    const products = rows(ps);
    return {products, variants: vs.results, settings: rows(st)[0] || initialSettings, seeded: products.length > 0 || !!init};
  } catch { return null; }
}

// Phones (not tablets) get the lightweight mobile layout.
export const isPhone = (ua: string) => /Mobi|Android|iPhone|iPod/i.test(ua) && !/iPad|Tablet/i.test(ua);
