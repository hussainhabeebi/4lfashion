import fs from 'node:fs';import {pathToFileURL} from 'node:url';
export async function resolveTarget(env=process.env,request=fetch){
 const account=env.CLOUDFLARE_ACCOUNT_ID,token=env.CLOUDFLARE_API_TOKEN,host=env.CLOUDFLARE_STORE_HOST||'4lfashion.com.qa';
 if(!account||!token)throw Error('Cloudflare deployment secrets are required.');if(!/^[a-z0-9.-]+$/i.test(host))throw Error('CLOUDFLARE_STORE_HOST must be a hostname.');
 async function api(path){const r=await request('https://api.cloudflare.com/client/v4/accounts/'+encodeURIComponent(account)+path,{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(15000)});const d=await r.json();if(!r.ok||!d.success)throw Error('Cannot inspect live Cloudflare routing/settings. Confirm Workers Scripts Read/Edit permission for the live account.');return d.result;}
 const domains=await api('/workers/domains?hostname='+encodeURIComponent(host));const matches=domains.filter(d=>d.hostname===host&&d.enabled!==false);const services=[...new Set(matches.map(d=>d.service))];
 if(services.length>1)throw Error('Multiple Workers match the live domain. Check its Cloudflare routing.');
 if(matches.some(d=>d.environment&&d.environment!=='production'))throw Error('The domain uses a named Worker environment; configure that environment before deploying.');
 const configured=env.CLOUDFLARE_WORKER_NAME;const name=services[0]||configured;
 if(!name)throw Error('No Custom Domain mapping was found for '+host+'. Set CLOUDFLARE_WORKER_NAME to the existing live Worker, or verify the Cloudflare account.');
 if(services[0]&&configured&&configured!==name)throw Error('CLOUDFLARE_WORKER_NAME points to a different Worker than the live domain. Correct the repository variable.');
 if(!/^[a-zA-Z0-9_-]{1,63}$/.test(name))throw Error('Invalid Worker name in routing.');
 const settings=await api('/workers/scripts/'+encodeURIComponent(name)+'/settings');const bindings=settings.bindings||[];const db=env.CLOUDFLARE_D1_DATABASE_ID||bindings.find(b=>b.name==='DB'&&b.type==='d1')?.id;const bucket=env.CLOUDFLARE_R2_BUCKET||bindings.find(b=>b.name==='BUCKET'&&b.type==='r2_bucket')?.bucket_name;
 if(!db||!/^[a-f0-9-]{36}$/i.test(db))throw Error('Live Worker needs its DB binding, or CLOUDFLARE_D1_DATABASE_ID.');if(!bucket||!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(bucket))throw Error('Live Worker needs its BUCKET binding, or CLOUDFLARE_R2_BUCKET.');
 return {CLOUDFLARE_WORKER_NAME:name,CLOUDFLARE_D1_DATABASE_ID:db,CLOUDFLARE_R2_BUCKET:bucket,CLOUDFLARE_STORE_HOST:host};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){try{const target=await resolveTarget();if(!process.env.GITHUB_ENV)throw Error('Run this resolver inside GitHub Actions.');fs.appendFileSync(process.env.GITHUB_ENV,Object.entries(target).map(([k,v])=>k+'='+v+'\n').join(''));console.log('Resolved live deployment: '+target.CLOUDFLARE_STORE_HOST+' → '+target.CLOUDFLARE_WORKER_NAME);console.log('Live database and image bucket bindings retained; explicit repository overrides take priority.');}catch(e){console.error('::error::'+e.message);process.exitCode=1}}
