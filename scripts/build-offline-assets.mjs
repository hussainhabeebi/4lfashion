import fs from 'node:fs';import path from 'node:path';
const root='dist/client';const assets=[];function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const f=path.join(dir,e.name);if(e.isDirectory())walk(f);else if(/\.(js|css|woff2?)$/.test(f))assets.push('/'+path.relative(root,f).replaceAll('\\','/'))}}walk(root);
// Keep the observed previous stylesheet URL available for already-open/cached pages.
const cssFiles=assets.filter(a=>/^\/_next\/static\/css\/index\.[^/]+\.css$/.test(a));
const legacy='/_next/static/css/index.Cg9r8Y2U.css';
const current=cssFiles.find(a=>a!==legacy)||cssFiles[0];
if(current&&current!==legacy){fs.copyFileSync(path.join(root,current),path.join(root,legacy));if(!assets.includes(legacy))assets.push(legacy)}
fs.writeFileSync(path.join(root,'offline-assets.json'),JSON.stringify(assets));console.log('PWA offline shell prepared: '+assets.length+' build assets.');

fs.writeFileSync(path.join(root,'release.json'),JSON.stringify({commit:process.env.GITHUB_SHA||null,worker:process.env.CLOUDFLARE_WORKER_NAME||'4l-fashion-commerce'}));
if(process.env.GITHUB_SHA){const sw=path.join(root,'sw.js');fs.appendFileSync(sw,'\n// Release: '+process.env.GITHUB_SHA+'\n')}
