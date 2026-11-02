import fs from 'node:fs';
const host=process.env.CLOUDFLARE_STORE_HOST||'4lfashion.com.qa',expected=process.env.GITHUB_SHA;
if(!/^[a-z0-9.-]+$/i.test(host)||!expected)throw Error('Deployment verification requires a valid hostname and GITHUB_SHA.');
const assets=JSON.parse(fs.readFileSync('dist/client/offline-assets.json','utf8'));
const currentStyles=assets.filter(p=>p.endsWith('.css')&&!p.endsWith('index.Cg9r8Y2U.css'));
let lastError='release unavailable';
async function get(path){return fetch('https://'+host+path,{headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(12000)})}
for(let attempt=0;attempt<8;attempt++){
 try{
  const r=await get('/release.json?deployment='+encodeURIComponent(expected));const d=await r.json();if(!r.ok||d.commit!==expected)throw Error('Public domain has not confirmed commit '+expected);
  for(const route of ['/','/admin/login']){
   const page=await get(route+'?release='+encodeURIComponent(expected));if(!page.ok)throw Error('Page failed: '+route);const html=(await page.text()).replaceAll('\\/','/');
   const styles=[...new Set(html.match(/\/_next\/static\/css\/[^"'<>\s\\]+\.css/g)||[])];if(!styles.length)throw Error('No stylesheet linked on '+route);
   if(currentStyles.length&&!styles.some(s=>currentStyles.includes(s)))throw Error('Stale HTML stylesheet on '+route+': '+styles.join(', '));
   const scripts=[...new Set(html.match(/\/_next\/static\/chunks\/[^"'<>\s\\]+\.js/g)||[])];
   for(const path of [...styles,...scripts]){const asset=await get(path);const type=asset.headers.get('content-type')||'';if(!asset.ok||path.endsWith('.css')&&!type.includes('text/css')||path.endsWith('.js')&&!/javascript/.test(type))throw Error('Missing or incorrectly served asset: '+path+' ('+asset.status+', '+type+')');}
   console.log('Verified HTML, stylesheet and scripts: https://'+host+route);
  }
  console.log('Verified live release on https://'+host+': '+expected);process.exit(0);
 }catch(e){lastError=e.message}if(attempt<7)await new Promise(r=>setTimeout(r,5000));
}
console.error('::error::Public release verification failed: '+lastError);process.exit(1);
