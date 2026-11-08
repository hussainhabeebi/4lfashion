"use client";
import {useState} from 'react';
import {ImagePlus, RotateCcw} from 'lucide-react';
import {upload} from './product-photos';
import {products as samples} from '../lib/catalog';

// Homepage category tiles. Each category can have its own photo set here; when it
// has none, the storefront uses the main photo of the first product in that category.
export const CATEGORY_TILES = ['Salwar suits', 'Kurtas & sets', 'Occasion wear', 'Everyday essentials', 'All pieces'];
type Product = {id?: string; category?: string; image?: string};
const SAMPLE_IDS = new Set(samples.map(p => p.id));
const TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export function categoryImage(name: string, custom: Record<string, string> | undefined, products: Product[]) {
  if (custom?.[name]) return custom[name];
  const list = (name === 'All pieces' ? products : products.filter(p => p.category === name)).filter(p => p.image);
  // Prefer the store's own products over the starter samples added at setup.
  return (list.find(p => !SAMPLE_IDS.has(String(p.id))) || list[0])?.image || '';
}

export default function CategoryImages({value, products, notify}: {
  value: Record<string, string> | undefined; products: Product[]; notify: (m: string) => void;
}) {
  const [images, setImages] = useState<Record<string, string>>({...(value || {})});
  const [busy, setBusy] = useState(''), [links, setLinks] = useState<Record<string, string>>({});
  const set = (name: string, url: string) => setImages(m => { const n = {...m}; if (url) n[name] = url; else delete n[name]; return n; });

  async function choose(name: string, file?: File) {
    if (!file) return;
    if (!TYPES.includes(file.type) || file.size > 8 * 1024 * 1024) { notify('Use a JPEG, PNG or WebP under 8 MB.'); return; }
    setBusy(name);
    try { set(name, await upload(file)); notify(name + ' photo uploaded. Save storefront settings to publish it.'); }
    catch (e) { notify(e instanceof Error ? e.message : 'Upload failed'); }
    setBusy('');
  }
  function addLink(name: string) {
    const url = (links[name] || '').trim();
    if (!/^(https:\/\/|\/api\/media\/)/.test(url)) { notify('Enter an HTTPS image link'); return; }
    set(name, url); setLinks(l => ({...l, [name]: ''}));
  }

  return <div className="category-images">
    <input type="hidden" name="categoryImages" value={JSON.stringify(images)}/>
    <div className="between"><h3>Homepage category photos</h3><small className="muted">Without a custom photo, the first product in the category is used</small></div>
    <div className="category-image-grid">{CATEGORY_TILES.map(name => {
      const src = categoryImage(name, images, products), custom = !!images[name];
      return <div className="category-image-item" key={name}>
        <figure>{src ? <img src={src} alt={name}/> : <span className="muted">No photo yet</span>}
          <figcaption>{name === 'All pieces' ? 'New in' : name}{!custom && src ? <small> · from products</small> : null}</figcaption></figure>
        <div className="category-image-actions">
          <label className={'text-link' + (busy === name ? ' busy' : '')}><ImagePlus size={14}/> {busy === name ? 'Uploading…' : custom ? 'Replace' : 'Upload'}
            <input type="file" accept={TYPES.join(',')} style={{display: 'none'}} disabled={!!busy} onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; choose(name, f); }}/></label>
          {custom && <button type="button" className="text-link" onClick={() => set(name, '')}><RotateCcw size={14}/> Reset</button>}
        </div>
        <div className="photo-link"><input type="url" placeholder="…or paste an image link" value={links[name] || ''}
          onChange={e => setLinks(l => ({...l, [name]: e.target.value}))} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addLink(name); } }}/>
          <button type="button" className="text-link" onClick={() => addLink(name)}>Use</button></div>
      </div>;
    })}</div>
  </div>;
}
