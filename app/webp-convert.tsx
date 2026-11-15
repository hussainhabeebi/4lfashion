"use client";
import {useState} from 'react';
import {upload, addThumb} from './product-photos';

// One-off tool: re-saves every photo already uploaded to the store (product photos and
// homepage category photos) as WebP, plus a small 640px copy for product cards.
// New uploads get both automatically.
type Save = (kind: string, id: string, data: Record<string, unknown>) => Promise<unknown>;
const isMedia = (u: string) => /^\/api\/media\/[a-f0-9-]{36}$/.test(u);

export default function WebpConvert({products, settings, save, notify, done}: {
  products: Record<string, unknown>[]; settings: Record<string, unknown>; save: Save; notify: (m: string) => void; done: () => Promise<unknown> | void;
}) {
  const [status, setStatus] = useState('');
  async function convert(url: string, cache: Map<string, string>) {
    if (!isMedia(url)) return url;
    if (cache.has(url)) return cache.get(url)!;
    const r = await fetch(url);
    if (!r.ok) return url;
    const blob = await r.blob();
    let next = url;
    if (blob.type !== 'image/webp') {
      const file = new File([blob], 'photo', {type: blob.type});
      next = await upload(file);
    } else {
      // Already WebP: make sure the small card-size copy exists too.
      const t = await fetch(url + '?w=640', {method: 'HEAD', cache: 'no-store'});
      if (t.headers.get('X-Thumb') === '0') await addThumb(url, blob);
    }
    cache.set(url, next);
    return next;
  }

  async function run() {
    if (status) return;
    let changed = 0, failed = 0;
    const cache = new Map<string, string>(), conv = (u: string) => convert(u, cache);
    try {
      for (const [i, p] of products.entries()) {
        setStatus('Product ' + (i + 1) + ' of ' + products.length);
        try {
          const image = await conv(String(p.image || ''));
          const gallery = (await Promise.all(String(p.gallery || '').split(',').map(s => s.trim()).filter(Boolean).map(conv))).join(',');
          if (image !== (p.image || '') || gallery !== String(p.gallery || '').split(',').map(s => s.trim()).filter(Boolean).join(',')) {
            const {id, ...data} = p;
            await save('product', String(id), {...data, image, gallery}); changed++;
          }
        } catch { failed++; }
      }
      setStatus('Homepage photos');
      const cats: Record<string, string> = {...(settings.categoryImages as Record<string, string> || {})};
      let catChanged = false;
      for (const k of Object.keys(cats)) {
        try { const n = await conv(cats[k]); if (n !== cats[k]) { cats[k] = n; catChanged = true; } } catch { failed++; }
      }
      if (catChanged) { await save('settings', 'store-settings', {...settings, categoryImages: cats}); changed++; }
      await done();
      notify(failed ? changed + ' updated, ' + failed + ' could not be converted. Try again.' : changed ? 'Photos optimised (' + changed + ' updated).' : 'All photos are already optimised.');
    } catch (e) { notify(e instanceof Error ? e.message : 'Conversion failed'); }
    setStatus('');
  }

  return <div className="between webp-convert">
    <div><h3>Faster photos</h3><small className="muted">New uploads are saved as WebP with a small phone-size copy automatically. Run this once to optimise photos uploaded earlier.</small></div>
    <button type="button" className="outline" disabled={!!status} onClick={run}>{status || 'Optimise existing photos'}</button>
  </div>;
}
