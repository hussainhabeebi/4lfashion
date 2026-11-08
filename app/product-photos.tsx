"use client";
import {useState} from 'react';
import {ArrowLeft, ArrowRight, ImagePlus, Star, X} from 'lucide-react';

// Manages a product's photos: the first is the main `image`, the rest are stored
// in `gallery` (comma-separated), which the storefront shows as thumbnails.
const MAX_PHOTOS = 12, TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export const photoList = (image: string, gallery: string) =>
  [image, ...String(gallery || '').split(',')].map(s => String(s || '').trim()).filter(Boolean)
    .filter((s, i, all) => all.indexOf(s) === i);

export async function upload(file: File) {
  const fd = new FormData(); fd.set('file', file);
  const r = await fetch('/api/media', {method: 'POST', body: fd});
  const d = (await r.json().catch(() => ({error: 'Upload failed'}))) as {url?: string; error?: string};
  if (!r.ok || !d.url) throw Error(d.error || 'Upload failed');
  return d.url;
}

export default function ProductPhotos({image, gallery, onChange, notify}: {
  image: string; gallery: string; onChange: (image: string, gallery: string) => void; notify: (m: string) => void;
}) {
  const photos = photoList(image, gallery);
  const [progress, setProgress] = useState(''), [dragging, setDragging] = useState(false), [link, setLink] = useState('');
  const save = (list: string[]) => onChange(list[0] || '', list.slice(1).join(','));
  const move = (i: number, to: number) => { const l = [...photos]; const [x] = l.splice(i, 1); l.splice(to, 0, x); save(l); };

  async function addFiles(files: File[]) {
    if (progress) return;
    const valid = files.filter(f => TYPES.includes(f.type) && f.size <= 8 * 1024 * 1024);
    if (valid.length < files.length) notify('Some files were skipped: use JPEG, PNG or WebP under 8 MB.');
    const room = MAX_PHOTOS - photos.length, chosen = valid.slice(0, Math.max(0, room));
    if (valid.length > chosen.length) notify('A product can have up to ' + MAX_PHOTOS + ' photos.');
    if (!chosen.length) return;
    const urls: string[] = new Array(chosen.length); let done = 0, failed = 0, next = 0;
    setProgress('Uploading 0 of ' + chosen.length);
    // Upload three at a time, keeping the order the files were chosen in.
    await Promise.all(Array.from({length: Math.min(3, chosen.length)}, async () => {
      while (next < chosen.length) {
        const i = next++;
        try { urls[i] = await upload(chosen[i]); } catch { failed++; }
        setProgress('Uploading ' + (++done) + ' of ' + chosen.length);
      }
    }));
    setProgress('');
    const added = urls.filter(Boolean);
    if (added.length) save([...photos, ...added]);
    notify(failed ? added.length + ' uploaded, ' + failed + ' failed. Try the failed photos again.' : added.length + (added.length === 1 ? ' photo' : ' photos') + ' uploaded');
  }

  function addLink() {
    const url = link.trim();
    if (!/^(https:\/\/|\/api\/media\/)/.test(url) || url.includes(',')) { notify('Enter an HTTPS image link'); return; }
    if (photos.length >= MAX_PHOTOS) { notify('A product can have up to ' + MAX_PHOTOS + ' photos.'); return; }
    if (!photos.includes(url)) save([...photos, url]);
    setLink('');
  }

  return <div className="product-photos">
    <div className="between"><h3>Product photos</h3><small className="muted">{photos.length}/{MAX_PHOTOS} · first photo is the main image</small></div>
    <label className={'photo-drop' + (dragging ? ' dragging' : '') + (progress ? ' busy' : '')}
      onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)}
      onDrop={e => { e.preventDefault(); setDragging(false); addFiles(Array.from(e.dataTransfer.files)); }}>
      <ImagePlus size={22}/>
      <span>{progress || <><b>Choose photos</b> or drag them here</>}</span>
      <small>Select several at once · JPEG, PNG or WebP, up to 8 MB each</small>
      <input type="file" multiple accept={TYPES.join(',')} disabled={!!progress}
        onChange={e => { const files = Array.from(e.target.files || []); e.target.value = ''; addFiles(files); }}/>
    </label>
    {photos.length > 0 && <div className="photo-grid">{photos.map((src, i) =>
      <figure key={src} className={i === 0 ? 'main' : ''}>
        <img src={src} alt={'Product photo ' + (i + 1)}/>
        {i === 0 ? <span className="photo-badge">Main</span> :
          <button type="button" className="photo-main" title="Make main photo" onClick={() => move(i, 0)}><Star size={12}/> Main</button>}
        <button type="button" className="photo-remove" title="Remove photo" aria-label={'Remove photo ' + (i + 1)} onClick={() => save(photos.filter((_, j) => j !== i))}><X size={13}/></button>
        <div className="photo-order">
          <button type="button" aria-label="Move left" disabled={i === 0} onClick={() => move(i, i - 1)}><ArrowLeft size={13}/></button>
          <button type="button" aria-label="Move right" disabled={i === photos.length - 1} onClick={() => move(i, i + 1)}><ArrowRight size={13}/></button>
        </div>
      </figure>)}</div>}
    <div className="photo-link"><input type="url" placeholder="…or paste an HTTPS image link" value={link}
      onChange={e => setLink(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addLink(); } }}/>
      <button type="button" className="text-link" onClick={addLink}>Add link</button></div>
  </div>;
}
