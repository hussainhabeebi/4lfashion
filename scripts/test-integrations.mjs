// Platform integrations (Leadvyne etc.): API keys, read-only REST API, scopes, pause/rotate,
// signed webhooks for order/product/stock changes, URL validation and secret hygiene.
import {DatabaseSync} from 'node:sqlite';import fs from 'node:fs';import ts from 'typescript';import assert from 'node:assert/strict';
const sql=new DatabaseSync(':memory:');
for(const f of ['drizzle/0000_sad_nitro.sql','drizzle/0001_useful_guardsmen.sql'])for(const s of fs.readFileSync(f,'utf8').split('--> statement-breakpoint'))sql.exec(s);
const db={prepare(q){return {bind(...v){return {async all(){return {results:sql.prepare(q).all(...v)}},async first(){return sql.prepare(q).get(...v)||null},async run(){return sql.prepare(q).run(...v)},q,v}},async all(){return {results:sql.prepare(q).all()}},async first(){return sql.prepare(q).get()||null},async run(){return sql.prepare(q).run()},q,v:[]}},async batch(stmts){sql.exec('BEGIN');try{const r=stmts.map(s=>sql.prepare(s.q).run(...s.v));sql.exec('COMMIT');return r}catch(e){sql.exec('ROLLBACK');throw e}}};
globalThis.__testEnv={DB:db,RESEND_API_KEY:'re_test',EMAIL_FROM:'4L Fashion <orders@example.test>',WHATSAPP_TOKEN:'wa_test',WHATSAPP_PHONE_NUMBER_ID:'123',WHATSAPP_TEMPLATE:'order_update',APP_URL:'https://shop.example.test'};
globalThis.__testUser=null;
const hooks=[],mail=[];globalThis.fetch=async(url,init)=>{url=String(url);if(url.startsWith('https://hooks.')){hooks.push({url,headers:init.headers,body:init.body,data:JSON.parse(init.body)});return new Response('ok',{status:url.includes('fail')?500:200})}mail.push(url);return new Response('{"id":"x"}',{status:200})};
const pendingWork=[];globalThis.__waitUntil=p=>{pendingWork.push(p)};const settle=async()=>{while(pendingWork.length)await pendingWork.shift()};
const toUrl=code=>'data:text/javascript;base64,'+Buffer.from(ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64');
const catalog=ts.transpileModule(fs.readFileSync('lib/catalog.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ES2022}}).outputText;
const ordersUrl=toUrl(fs.readFileSync('lib/orders.ts','utf8'));
const notifyUrl=toUrl(fs.readFileSync('lib/notify.ts','utf8').replace("from './orders'","from '"+ordersUrl+"'"));
const fitUrl=toUrl(fs.readFileSync('lib/fit-ai.ts','utf8')),waiUrl=toUrl(fs.readFileSync('lib/workers-ai.ts','utf8')),aifUrl=toUrl(fs.readFileSync('lib/ai-features.ts','utf8').replace("from './workers-ai'","from '"+waiUrl+"'").replace("from './fit-ai'","from '"+fitUrl+"'")),qUrl=toUrl(fs.readFileSync('lib/qatar.ts','utf8')),qaiUrl=toUrl(fs.readFileSync('lib/qatar-ai.ts','utf8').replace("from './workers-ai'","from '"+waiUrl+"'").replace("from './qatar'","from '"+qUrl+"'"));
const source=fs.readFileSync('app/api/store/route.ts','utf8').replace("import { env } from 'cloudflare:workers';","const env=globalThis.__testEnv;").replace("import { waitUntil } from 'cloudflare:workers';","const waitUntil=p=>(globalThis.__waitUntil||(x=>x.catch(()=>{})))(p);").replace("'../../../lib/integrations'","'data:text/javascript;base64,"+Buffer.from(ts.transpileModule(fs.readFileSync('lib/integrations.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64')+"'").replace("import {getCurrentUser} from '../../auth';","const getCurrentUser=async()=>globalThis.__testUser;")
  .replace("import {products,initialSettings,SIZES,RETIRED_SIZES,withCurrentPolicies} from '../../../lib/catalog';",catalog.replaceAll('export ',''))
  .replace("'../../../lib/orders'","'"+ordersUrl+"'").replace("'../../../lib/notify'","'"+notifyUrl+"'").replace("'../../../lib/ai-features'","'"+aifUrl+"'").replace("'../../../lib/fit-ai'","'"+fitUrl+"'").replace("'../../../lib/qatar-ai'","'"+qaiUrl+"'").replace("'../../../lib/qatar'","'"+qUrl+"'");
const mod=await import(toUrl(source));
const intUrl=toUrl(fs.readFileSync('lib/integrations.ts','utf8'));const lib=await import(intUrl);
const post=async(action,data={})=>{const r=await mod.POST(new Request('https://test.local/api/store',{method:'POST',headers:{'Content-Type':'application/json','Origin':'https://test.local'},body:JSON.stringify({action,...data})}));const d=await r.json();await settle();return {status:r.status,data:d}};
const get=async action=>{const r=await mod.GET(new Request('https://test.local/api/store?action='+action));return {status:r.status,data:await r.json()}};
const api=async(path,key,init={})=>{const r=await lib.handleApiRequest(db,new Request('https://shop.example.test/api/v1'+path,{...init,headers:{...(key?{Authorization:'Bearer '+key}:{}),...(init.headers||{})}}),'https://shop.example.test');return {status:r.status,data:await r.json()}};
const hmac=async(secret,msg)=>[...new Uint8Array(await crypto.subtle.sign('HMAC',await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']),new TextEncoder().encode(msg)))].map(b=>b.toString(16).padStart(2,'0')).join('');
const owner={userId:'owner',email:'owner@example.test',displayName:'Owner'},manager={userId:'mgr',email:'mgr@example.test',displayName:'Manager'},alice={userId:'alice',email:'alice@example.test',displayName:'Alice'};
const as=u=>{globalThis.__testUser=u};
const now=new Date().toISOString();
sql.prepare('INSERT INTO records(id,kind,data,owner,created) VALUES(?,?,?,?,?)').run('owner','staff',JSON.stringify({email:owner.email,role:'owner',name:'Owner'}),'owner',now);
sql.prepare('INSERT INTO records(id,kind,data,owner,created) VALUES(?,?,?,?,?)').run('staff-mgr','staff',JSON.stringify({email:manager.email,role:'manager',name:'Manager'}),null,now);
as(owner);assert.equal((await post('bootstrap')).status,200);

// Who can connect platforms
as(alice);assert.equal((await post('integrationCreate',{data:{name:'Leadvyne'}})).status,403,'customers cannot');
as(manager);assert.equal((await post('integrationCreate',{data:{name:'Leadvyne'}})).status,403,'store managers cannot');
as(owner);
for(const bad of ['http://hooks.example.com/x','https://localhost/x','https://127.0.0.1/x','https://intranet/x','not a url'])
  assert.equal((await post('integrationCreate',{data:{name:'X',webhookUrl:bad}})).status,400,'rejects '+bad);
assert.equal((await post('integrationCreate',{data:{name:'X',headerName:'Content-Type',headerValue:'x'}})).status,400,'reserved header');
assert.equal((await post('integrationCreate',{data:{name:''}})).status,400,'needs a name');

// Create Leadvyne with a webhook and its own incoming key header
let r=await post('integrationCreate',{data:{name:'Leadvyne',platform:'leadvyne',webhookUrl:'https://hooks.leadvyne.example/4l',headerName:'X-Leadvyne-Key',headerValue:'lv_secret_123'}});
assert.equal(r.status,200,JSON.stringify(r.data));
const {apiKey,signingSecret}=r.data,lv=r.data.integration;
assert.match(apiKey,/^4lf_[a-f0-9]{40}$/);assert.match(signingSecret,/^whsec_/);
assert.deepEqual(lv.scopes,['orders:read','products:read']);assert.equal(lv.events.length,8);assert.equal(lv.hasHeaderValue,true);
const stored=sql.prepare("SELECT data FROM records WHERE id=?").get(lv.id).data;assert.ok(!stored.includes(apiKey),'API key is never stored in plain text');
const adminData=JSON.stringify((await get('admin')).data);
assert.ok(adminData.includes(lv.id));for(const s of [apiKey,signingSecret,'lv_secret_123',JSON.parse(stored).keyHash])assert.ok(!adminData.includes(s),'admin payload hides secrets');
assert.equal((await post('integrationReveal',{id:lv.id})).data.signingSecret,signingSecret);

// REST API authentication
assert.equal((await api('','')).status,200,'index is public');
assert.equal((await api('/orders','')).status,401);
assert.equal((await api('/orders','4lf_'+'0'.repeat(40))).status,401);
r=await api('/ping',apiKey);assert.equal(r.status,200);assert.equal(r.data.connection.name,'Leadvyne');
r=await api('/orders',null,{headers:{'X-API-Key':apiKey}});assert.equal(r.status,200,'X-API-Key header works');
assert.equal((await api('/orders',apiKey,{method:'POST',body:'{}'})).status,405,'read-only');
assert.equal((await api('/nope',apiKey)).status,404);
assert.ok(JSON.parse(sql.prepare("SELECT data FROM records WHERE id=?").get(lv.id).data).lastUsed,'last used recorded');

// A new online order is pushed (order + stock) with a valid signature and the platform's header
as(alice);hooks.length=0;
r=await post('checkout',{requestId:crypto.randomUUID(),name:'Alice Smith',email:alice.email,phone:'55551234',address:'Building 1',items:[{variant:'p1-M',qty:2}]});
assert.equal(r.status,200,JSON.stringify(r.data));const orderId=r.data.id;
const created=hooks.find(h=>h.data.event==='order.created');assert.ok(created,'order.created pushed');
assert.equal(created.url,'https://hooks.leadvyne.example/4l');assert.equal(created.headers['X-Leadvyne-Key'],'lv_secret_123');
assert.equal(created.headers['X-4L-Signature'],'sha256='+await hmac(signingSecret,created.headers['X-4L-Timestamp']+'.'+created.body),'signature verifies');
assert.equal(created.data.data.id,orderId);assert.equal(created.data.data.items[0].product_id,'p1');assert.equal(created.data.data.items[0].quantity,2);
assert.equal(created.data.data.customer.email,alice.email);assert.equal(typeof created.data.data.total,'number');
const inv=hooks.find(h=>h.data.event==='inventory.updated');assert.ok(inv,'stock change pushed');assert.equal(inv.data.data.variants[0].stock,sql.prepare("SELECT stock FROM variants WHERE id='p1-M'").get().stock);

// Pull: list, incremental sync and a single order; staff notes stay private
r=await api('/orders?limit=10',apiKey);assert.equal(r.status,200);assert.equal(r.data.data.length,1);assert.equal(r.data.data[0].id,orderId);assert.equal(r.data.has_more,false);
const firstSeen=r.data.data[0].updated_at;
assert.equal((await api('/orders?updated_since='+encodeURIComponent(firstSeen),apiKey)).data.data.length,0,'nothing new yet');
assert.equal((await api('/orders?updated_since=yesterday-ish',apiKey)).status,400);
as(owner);await new Promise(r=>setTimeout(r,5));hooks.length=0;
assert.equal((await post('orderNote',{id:orderId,note:'VIP – call before delivery'})).status,200);
assert.equal(hooks.length,0,'internal notes are not pushed');
r=await post('orderStatus',{id:orderId,status:'Shipped',carrier:'Aramex',tracking:'AR123',notify:false});assert.equal(r.status,200);
const upd=hooks.find(h=>h.data.event==='order.updated');assert.ok(upd,'status change pushed');assert.equal(upd.data.data.status,'Shipped');assert.equal(upd.data.data.fulfilment.tracking,'AR123');
r=await api('/orders?updated_since='+encodeURIComponent(firstSeen),apiKey);assert.equal(r.data.data.length,1,'changed order shows up in incremental sync');
r=await api('/orders/'+orderId,apiKey);assert.equal(r.status,200);assert.ok(!JSON.stringify(r.data).includes('VIP'),'staff notes never leave the store');
assert.equal((await api('/orders/4L-MISSING',apiKey)).status,404);
assert.equal((await api('/orders?status=cancelled',apiKey)).data.data.length,0);

// Products, inventory and paging
r=await api('/products?limit=2',apiKey);assert.equal(r.status,200);assert.equal(r.data.data.length,2);assert.ok(r.data.has_more);assert.equal(r.data.next_page,2);
assert.ok(r.data.data[0].variants.length>0);assert.match(r.data.data[0].url,/^https:\/\/shop\.example\.test\/products\//);
r=await api('/products/p1',apiKey);assert.equal(r.data.data.id,'p1');
r=await api('/inventory?limit=100',apiKey);assert.ok(r.data.data.some(v=>v.variant_id==='p1-M'&&v.product_id==='p1'));
hooks.length=0;assert.equal((await post('stock',{id:'p1-M',delta:3,operationId:crypto.randomUUID(),reason:'Delivery'})).status,200);
assert.equal(hooks.find(h=>h.data.event==='inventory.updated')?.data.data.delta,3,'manual stock change pushed');
const p1=(await get('admin')).data.product.find(p=>p.id==='p1');hooks.length=0;
assert.equal((await post('save',{kind:'product',id:'p1',data:{...p1,price:199}})).status,200);
const pu=hooks.find(h=>h.data.event==='product.updated');assert.ok(pu,'product edit pushed');assert.equal(pu.data.data.price,199);

// Scopes, pausing and only subscribed events
r=await post('integrationUpdate',{id:lv.id,data:{scopes:['products:read'],events:['order.created']}});assert.equal(r.status,200);assert.equal(r.data.integration.hasHeaderValue,true,'header value kept on edit');
assert.equal((await api('/orders',apiKey)).status,403,'scope removed');assert.equal((await api('/products',apiKey)).status,200);
hooks.length=0;await post('stock',{id:'p1-M',delta:1,operationId:crypto.randomUUID()});assert.equal(hooks.length,0,'unsubscribed events are not sent');
await post('integrationUpdate',{id:lv.id,data:{active:false}});
assert.equal((await api('/products',apiKey)).status,403,'paused key refused');
as(alice);hooks.length=0;await post('checkout',{requestId:crypto.randomUUID(),name:'Alice Smith',email:alice.email,phone:'55551234',address:'Building 1',items:[{variant:'p2-M',qty:1}]});assert.equal(hooks.length,0,'paused connection gets no pushes');
as(owner);await post('integrationUpdate',{id:lv.id,data:{active:true,scopes:['orders:read','products:read']}});

// Test event, failures are logged, key rotation, disconnect
hooks.length=0;r=await post('integrationTest',{id:lv.id});assert.equal(r.status,200,JSON.stringify(r.data));assert.equal(hooks[0].data.event,'ping');
const bad=(await post('integrationCreate',{data:{name:'Broken',webhookUrl:'https://hooks.fail.example/x'}})).data;
r=await post('integrationTest',{id:bad.integration.id});assert.equal(r.status,400);assert.match(r.data.error,/HTTP 500/);
assert.equal(hooks.filter(h=>h.url.includes('fail')).length,2,'5xx retried once');
const delivered=(await get('admin')).data.integration.find(x=>x.id===bad.integration.id).deliveries;assert.equal(delivered[0].ok,false);
const noHook=(await post('integrationCreate',{data:{name:'Pull only'}})).data;assert.equal((await post('integrationTest',{id:noHook.integration.id})).status,400);
r=await post('integrationRotate',{id:lv.id});assert.equal(r.status,200);const newKey=r.data.apiKey;
assert.equal((await api('/ping',apiKey)).status,401,'old key revoked');assert.equal((await api('/ping',newKey)).status,200,'new key works');
r=await post('integrationRotate',{id:lv.id,what:'secret'});assert.notEqual(r.data.signingSecret,signingSecret);
assert.equal((await post('integrationDelete',{id:lv.id})).status,200);assert.equal((await api('/ping',newKey)).status,401,'disconnected key refused');
assert.equal(sql.prepare("SELECT COUNT(*) n FROM records WHERE kind='webhookDelivery' AND owner=?").get(lv.id).n,0,'delivery log removed');

console.log('PASS: platform connections (Leadvyne) with owner/admin-only setup, hashed one-time API keys, read-only orders/products/inventory API with scopes, incremental updated_since sync, paging, pause/rotate/disconnect, signed webhooks with custom header for order/product/stock changes, retries, delivery log, URL validation and secret hygiene.');
