const CACHE='4l-fashion-shell-v8',PHOTOS='4l-photos-v1',MAX_PHOTOS=250;
self.addEventListener('install',e=>{e.waitUntil((async()=>{const c=await caches.open(CACHE);await c.addAll(['/','/admin','/manifest.webmanifest','/favicon.svg','/4l-logo-3d.webp','/4l-logo-mark.webp','/icon-192-3d.png','/icon-512-3d.png'].map(u=>new Request(u,{cache:'reload'})));const r=await fetch('/offline-assets.json',{cache:'no-store'});if(r.ok&&r.headers.get('Content-Type')?.includes('json')){const assets=await r.json();await c.addAll(assets)}await self.skipWaiting()})())});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE&&k.startsWith('4l-fashion-shell-')).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{const r=e.request,u=new URL(r.url);if(r.method!=='GET')return;if(u.origin!==location.origin){if(r.destination==='image')e.respondWith(caches.match(r).then(c=>c||fetch(r).then(resp=>{if(resp.ok||resp.type==='opaque'){const copy=resp.clone();caches.open(CACHE).then(cache=>cache.put(r,copy))}return resp})));return;}// Store photos never change at a given address: serve them from the device, fetch once.
if(/^\/api\/media\/[a-f0-9-]{36}$/.test(u.pathname)){e.respondWith(photo(r));return;}
if(u.pathname.startsWith('/api/')||u.pathname.startsWith('/admin/login')||u.pathname.includes('signin')||u.pathname.includes('signout')||u.pathname.includes('callback'))return;
if(r.mode==='navigate'){e.respondWith(fetch(r).then(resp=>{if(resp.ok&&resp.headers.get('Content-Type')?.includes('text/html')){const copy=resp.clone();caches.open(CACHE).then(c=>c.put(r,copy))}return resp}).catch(async()=>await caches.match(r)||await caches.match('/admin')||await caches.match('/')));return;}
e.respondWith(caches.match(r).then(cached=>cached||fetch(r).then(resp=>{if(resp.ok){const copy=resp.clone();caches.open(CACHE).then(c=>c.put(r,copy))}return resp})));});

async function photo(r){const c=await caches.open(PHOTOS);const hit=await c.match(r);if(hit)return hit;const resp=await fetch(r);
// Only keep final versions (a photo still waiting for its phone-size copy is short-lived).
if(resp.ok&&(resp.headers.get('Cache-Control')||'').includes('immutable')){await c.put(r,resp.clone());trim(c)}return resp}
async function trim(c){const keys=await c.keys();for(let i=0;i<keys.length-MAX_PHOTOS;i++)await c.delete(keys[i])}
