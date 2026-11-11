// Order management: cancellation (whole / by item) with restock, permissions, refunds,
// staff notes, timelines and email/WhatsApp notifications (provider calls are faked).
import {DatabaseSync} from 'node:sqlite';import fs from 'node:fs';import ts from 'typescript';import assert from 'node:assert/strict';
const sql=new DatabaseSync(':memory:');
for(const f of ['drizzle/0000_sad_nitro.sql','drizzle/0001_useful_guardsmen.sql'])for(const s of fs.readFileSync(f,'utf8').split('--> statement-breakpoint'))sql.exec(s);
const db={prepare(q){return {bind(...v){return {async all(){return {results:sql.prepare(q).all(...v)}},async first(){return sql.prepare(q).get(...v)||null},async run(){return sql.prepare(q).run(...v)},q,v}},async all(){return {results:sql.prepare(q).all()}},async first(){return sql.prepare(q).get()||null},async run(){return sql.prepare(q).run()},q,v:[]}},async batch(stmts){sql.exec('BEGIN');try{const r=stmts.map(s=>sql.prepare(s.q).run(...s.v));sql.exec('COMMIT');return r}catch(e){sql.exec('ROLLBACK');throw e}}};
globalThis.__testEnv={DB:db,RESEND_API_KEY:'re_test',EMAIL_FROM:'4L Fashion <orders@example.test>',WHATSAPP_TOKEN:'wa_test',WHATSAPP_PHONE_NUMBER_ID:'123',WHATSAPP_TEMPLATE:'order_update',APP_URL:'https://shop.example.test'};
globalThis.__testUser=null;
const sent=[];globalThis.fetch=async(url,init)=>{sent.push({url:String(url),body:JSON.parse(init.body)});return new Response('{"id":"x"}',{status:200})};
const toUrl=code=>'data:text/javascript;base64,'+Buffer.from(ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64');
const catalog=ts.transpileModule(fs.readFileSync('lib/catalog.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ES2022}}).outputText;
const ordersUrl=toUrl(fs.readFileSync('lib/orders.ts','utf8'));
const notifyUrl=toUrl(fs.readFileSync('lib/notify.ts','utf8').replace("from './orders'","from '"+ordersUrl+"'"));
const fitUrl=toUrl(fs.readFileSync('lib/fit-ai.ts','utf8')),waiUrl=toUrl(fs.readFileSync('lib/workers-ai.ts','utf8')),aifUrl=toUrl(fs.readFileSync('lib/ai-features.ts','utf8').replace("from './workers-ai'","from '"+waiUrl+"'").replace("from './fit-ai'","from '"+fitUrl+"'")),qUrl=toUrl(fs.readFileSync('lib/qatar.ts','utf8')),qaiUrl=toUrl(fs.readFileSync('lib/qatar-ai.ts','utf8').replace("from './workers-ai'","from '"+waiUrl+"'").replace("from './qatar'","from '"+qUrl+"'"));
const source=fs.readFileSync('app/api/store/route.ts','utf8').replace("import { env } from 'cloudflare:workers';","const env=globalThis.__testEnv;").replace("import {getCurrentUser} from '../../auth';","const getCurrentUser=async()=>globalThis.__testUser;")
  .replace("import {products,initialSettings,SIZES,RETIRED_SIZES} from '../../../lib/catalog';",catalog.replaceAll('export ',''))
  .replace("'../../../lib/orders'","'"+ordersUrl+"'").replace("'../../../lib/notify'","'"+notifyUrl+"'").replace("'../../../lib/ai-features'","'"+aifUrl+"'").replace("'../../../lib/fit-ai'","'"+fitUrl+"'").replace("'../../../lib/qatar-ai'","'"+qaiUrl+"'").replace("'../../../lib/qatar'","'"+qUrl+"'");
const mod=await import(toUrl(source));
const post=async(action,data={})=>{const r=await mod.POST(new Request('https://test.local/api/store',{method:'POST',headers:{'Content-Type':'application/json','Origin':'https://test.local'},body:JSON.stringify({action,...data})}));return {status:r.status,data:await r.json()}};
const get=async action=>{const r=await mod.GET(new Request('https://test.local/api/store?action='+action));return {status:r.status,data:await r.json()}};
const stock=id=>sql.prepare('SELECT stock FROM variants WHERE id=?').get(id).stock;
const owner={userId:'owner',email:'owner@example.test',displayName:'Owner'},alice={userId:'alice',email:'alice@example.test',displayName:'Alice'},bob={userId:'bob',email:'bob@example.test',displayName:'Bob'};
const as=u=>{globalThis.__testUser=u};

// Store setup
as(owner);sql.prepare('INSERT INTO records(id,kind,data,owner,created) VALUES(?,?,?,?,?)').run('owner','staff',JSON.stringify({email:owner.email,role:'owner',name:'Owner'}),'owner',new Date().toISOString());
assert.equal((await post('bootstrap')).status,200);
const p1=(await get('catalog')).data.products.find(p=>p.id==='p1'),p2=(await get('catalog')).data.products.find(p=>p.id==='p2');

// Checkout by a signed-in customer: confirmation email + WhatsApp to customer, alert email to store
as(alice);sent.length=0;
const s1=stock('p1-M'),s2=stock('p2-M');
let r=await post('checkout',{requestId:crypto.randomUUID(),name:'Alice Smith',email:alice.email,phone:'55551234',address:'Building 1',items:[{variant:'p1-M',qty:2},{variant:'p2-M',qty:1}],coupon:'WELCOME10'});
assert.equal(r.status,200,JSON.stringify(r.data));const id=r.data.id;
assert.equal(r.data.subtotal,(p1.price*2+p2.price)*100);
assert.equal(sent.filter(x=>x.url.includes('resend')).length,2,'customer + store emails');
const wa=sent.find(x=>x.url.includes('graph.facebook.com'));assert.ok(wa,'WhatsApp sent');assert.equal(wa.body.to,'97455551234','Qatar number gets +974');assert.equal(wa.body.template.name,'order_update');
assert.ok(sent.some(x=>x.url.includes('resend')&&x.body.to[0]===alice.email&&/confirmed/i.test(x.body.subject)));
let order=(await get('account')).data.orders.find(o=>o.id===id);
assert.ok(order.timeline.some(e=>e.type==='created'));assert.ok(!order.timeline.some(e=>e.internal),'customers never see staff-only events');

// Permissions
as(null);assert.equal((await post('orderCancel',{id})).status,401);
as(bob);assert.equal((await post('orderCancel',{id})).status,404,'other customers cannot touch the order');
as(alice);assert.equal((await post('orderNote',{id,note:'x'})).status,403);
assert.equal((await post('orderCancel',{id,items:{'p1-M':0}})).status,400,'must choose something');

// Customer cancels one of two p1 items: stock back, totals recalculated with the same discount rate
r=await post('orderCancel',{id,items:{'p1-M':1},reason:'Ordered twice'});assert.equal(r.status,200,JSON.stringify(r.data));
assert.equal(stock('p1-M'),s1-1);assert.equal(stock('p2-M'),s2-1);
order=r.data.order;const sub=(p1.price+p2.price)*100;
assert.equal(order.items.find(l=>l.variant==='p1-M').cancelledQty,1);assert.equal(order.subtotal,sub);assert.equal(order.discount,Math.round(sub*0.1));
assert.equal(order.total,sub-Math.round(sub*0.1)+order.shipping);assert.equal(order.status,'Confirmed');assert.equal(order.originalTotal>order.total,true);
assert.ok(order.timeline.some(e=>e.type==='cancel'&&/Ordered twice/.test(e.message)));

// Staff: note (hidden from customer), payment, partial cancel of a paid order -> refund due
as(owner);assert.equal((await post('orderNote',{id,note:'Customer prefers evening delivery'})).status,200);
r=await post('orderStatus',{id,status:'Confirmed',paid:true,notify:false});assert.equal(r.status,200);assert.ok(r.data.order.timeline.some(e=>e.type==='payment'));
const before=r.data.order.total;
r=await post('orderCancel',{id,items:{'p2-M':1},notify:false});assert.equal(r.status,200,JSON.stringify(r.data));
assert.equal(stock('p2-M'),s2);assert.equal(r.data.order.refundDue,before-r.data.order.total);
as(alice);order=(await get('account')).data.orders.find(o=>o.id===id);assert.ok(!order.timeline.some(e=>/evening/.test(e.message)),'note is staff-only');
as(owner);r=await post('orderRefund',{id,method:'Cash',notify:false});assert.equal(r.status,200);assert.equal(r.data.order.refundDue,0);assert.equal(r.data.order.refunded,before-r.data.order.total);
assert.equal((await post('orderRefund',{id})).status,400,'nothing left to refund');

// Once packing starts the customer can no longer cancel; staff still can until shipped
r=await post('orderStatus',{id,status:'Packing',notify:false});assert.equal(r.status,200);
as(alice);assert.equal((await post('orderCancel',{id})).status,400);
as(owner);sent.length=0;
r=await post('orderStatus',{id,status:'Shipped',carrier:'Aramex',tracking:'AWB123'});assert.equal(r.status,200);
assert.ok(sent.some(x=>x.url.includes('resend')&&/on its way/.test(x.body.subject)),'shipped email');
assert.ok(r.data.order.timeline.some(e=>e.type==='notify'&&e.internal&&/Email sent/.test(e.message)),'send logged on timeline');
assert.equal((await post('orderCancel',{id})).status,400,'shipped orders need a return instead');

// Manual resend of a message
sent.length=0;r=await post('orderNotify',{id,event:'shipped',channels:['whatsapp']});assert.equal(r.status,200);assert.equal(sent.length,1);assert.ok(sent[0].url.includes('graph.facebook.com'));
assert.equal((await post('orderNotify',{id,event:'nope'})).status,400);

// A second order cancelled whole by the customer: everything restocked, totals zero, cancelled exactly once
as(alice);const s3=stock('p1-L');
r=await post('checkout',{requestId:crypto.randomUUID(),name:'Alice Smith',email:alice.email,phone:'+974 5555 1234',address:'Building 1',items:[{variant:'p1-L',qty:3}]});assert.equal(r.status,200);const id2=r.data.id;
assert.equal(stock('p1-L'),s3-3);
r=await post('orderCancel',{id:id2,reason:'Changed my mind'});assert.equal(r.status,200);
assert.equal(r.data.order.status,'Cancelled');assert.equal(r.data.order.total,0);assert.equal(r.data.order.shipping,0);assert.equal(stock('p1-L'),s3);
assert.equal((await post('orderCancel',{id:id2})).status,400);
as(owner);assert.equal((await post('orderStatus',{id:id2,status:'Cancelled'})).status,200);assert.equal(stock('p1-L'),s3,'no double restock');
assert.equal((await post('orderStatus',{id:id2,status:'Shipped'})).status,400,'cancelled orders stay cancelled');

// Admin payload reports which providers are configured
const admin=(await get('admin')).data;assert.deepEqual(admin.notifyConfig,{email:true,whatsapp:true,whatsappTemplate:true});

// Without provider keys nothing is sent and checkout still works
for(const k of Object.keys(globalThis.__testEnv))if(k!=='DB')delete globalThis.__testEnv[k];sent.length=0;as(alice);
r=await post('checkout',{requestId:crypto.randomUUID(),name:'Alice',email:alice.email,phone:'55551234',address:'B1',items:[{variant:'p2-L',qty:1}]});assert.equal(r.status,200);assert.equal(sent.length,0);

console.log('PASS: order cancellation (whole and by item) with restock and totals, customer/staff permissions, refunds, staff notes, timelines, email and WhatsApp notifications.');
