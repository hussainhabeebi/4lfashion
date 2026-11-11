// Workers AI features: fit memory from returns, "Fits like my favourite" matching and the
// occasion planner. Pure rules are tested directly; the API is tested with real route code,
// with and without a fake Workers AI binding (no network calls are made).
import {DatabaseSync} from 'node:sqlite';import fs from 'node:fs';import ts from 'typescript';import assert from 'node:assert/strict';
const toUrl=code=>'data:text/javascript;base64,'+Buffer.from(ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64');
const fitUrl=toUrl(fs.readFileSync('lib/fit-ai.ts','utf8')),waiUrl=toUrl(fs.readFileSync('lib/workers-ai.ts','utf8'));
const aifUrl=toUrl(fs.readFileSync('lib/ai-features.ts','utf8').replace("from './workers-ai'","from '"+waiUrl+"'").replace("from './fit-ai'","from '"+fitUrl+"'")),qUrl=toUrl(fs.readFileSync('lib/qatar.ts','utf8')),qaiUrl=toUrl(fs.readFileSync('lib/qatar-ai.ts','utf8').replace("from './workers-ai'","from '"+waiUrl+"'").replace("from './qatar'","from '"+qUrl+"'"));
const fit=await import(fitUrl),wai=await import(waiUrl);
const charts=await import(toUrl(fs.readFileSync('lib/size-charts.ts','utf8')));
const {initialSettings,products}=await import(toUrl(fs.readFileSync('lib/catalog.ts','utf8')));

// ---------- Rules: reading return reasons ----------
const issues=t=>fit.extractFitIssuesFallback(t).map(i=>i.area+':'+i.direction).sort();
assert.deepEqual(issues('Too tight in the shoulders, would like size L'),['shoulders:tight']);
assert.deepEqual(issues('Bust was snug and the sleeves too short'),['chest:tight','sleeves:short']);
assert.deepEqual(issues('Way too big overall'),['overall:loose']);
assert.deepEqual(issues('The kurta is too long'),['length:long']);
assert.deepEqual(issues('Did not like the colour'),[]);
assert.deepEqual(fit.sanitizeIssues([{area:'Bust',direction:'tight'},{area:'elbow',direction:'tight'},{area:'hips',direction:'sideways'},{area:'bust',direction:'tight'}]),[{area:'chest',direction:'tight'}],'AI output is validated and de-duplicated');

// ---------- Rules: per-size fit notes ----------
const sizes=['M','L','XL','XXL'];
const signal=(o)=>({area:'chest',direction:'tight',size:'M',productId:'p1',productName:'Set',fit:'Regular',category:'Salwar suits',at:'2026-01-01',...o});
let a=fit.fitAdvice({signals:[signal()]},{fit:'Regular'},sizes);
assert.equal(a.bySize.M.tone,'snug');assert.match(a.bySize.M.note,/size M will likely feel snug at the chest/);
assert.equal(a.recommended,'L');assert.equal(a.bySize.L.tone,'good');assert.equal(a.bySize.XL,undefined);
// A closer cut than the returned piece shifts the threshold up one size.
a=fit.fitAdvice({signals:[signal({fit:'Relaxed'})]},{fit:'Fitted'},sizes);
assert.equal(a.bySize.L.tone,'snug');assert.equal(a.recommended,'XL');
// A looser cut shifts it down.
a=fit.fitAdvice({signals:[signal({fit:'Fitted'})]},{fit:'Relaxed'},sizes);
assert.equal(a.bySize.M.tone,'good');assert.equal(a.recommended,'M');
// Loose signals cap the recommendation; length notes are general.
a=fit.fitAdvice({signals:[signal({size:'M'}),signal({size:'XXL',direction:'loose',area:'waist'}),signal({area:'length',direction:'short'})]},{fit:'Regular'},sizes);
assert.equal(a.recommended,'L');assert.equal(a.bySize.XXL.tone,'loose');assert.match(a.lengthNote,/short/);
assert.equal(fit.fitAdvice({signals:[]},{},sizes),null);

// ---------- Rules: "Fits like my favourite" ----------
const cfg=initialSettings,chart=charts.chartFor(cfg,null);
// A Regular favourite measuring 43" at the chest implies a 40" bust: size XL on the standard chart.
assert.equal(fit.sizeForBody(chart,fit.bodyFromGarment({chest:43,fit:'Regular'})).size,'XL');
assert.equal(fit.sanitizeMeasure({chest:21,waist:'x',length:500}).chest,42,'flat widths become circumferences; nonsense dropped');
const all=products.map(p=>({...p}));
let matches=fit.matchFavourite({chest:43,fit:'Relaxed',type:'kurta'},all,p=>charts.chartFor(cfg,p),()=>['M','L','XL','XXL','3XL'],3);
assert.equal(matches.length,3);assert.match(matches[0].note,/Same relaxed cut/);assert.ok(/kurta|set|co-ord/i.test(matches[0].name),matches[0].name);
assert.equal(matches[0].size,'L','43" relaxed garment = 38" bust = L');
assert.deepEqual(fit.matchFavourite({chest:43},all,p=>charts.chartFor(cfg,p),()=>[]),[],'out-of-stock pieces are never suggested');

// ---------- Rules: occasion planner ----------
const b=fit.parseBriefFallback("Cousin's wedding in Kochi, December, outdoor, 3 events, budget QAR 1000, no black");
assert.deepEqual(b.events.map(e=>e.name),['Mehendi','Wedding ceremony','Reception']);
assert.equal(b.events[0].setting,'outdoor');assert.equal(b.budget,1000);assert.equal(b.location,'Kochi');assert.equal(b.month,'December');assert.deepEqual(b.avoid,['black']);
let plan=fit.planLooks(b,all);
assert.equal(plan.looks.length,3);assert.ok(plan.total<=1000,'plan stays within budget: '+plan.total);
assert.equal(new Set(plan.looks.map(l=>l.productId)).size,3,'no piece repeated');
assert.ok(!plan.looks.some(l=>/black/i.test(l.colour)),'avoided colour never chosen');
// AI picks are used when valid and replaced when invalid, repeated or over budget.
plan=fit.planLooks(b,all,[{event:0,productId:'p4',why:'Sage linen for the haldi heat.',styling:['Silver jhumkas']},{event:1,productId:'p4'},{event:2,productId:'nope'}]);
assert.equal(plan.looks[0].productId,'p4');assert.equal(plan.looks[0].why,'Sage linen for the haldi heat.');
assert.notEqual(plan.looks[1].productId,'p4');assert.ok(all.some(p=>p.id===plan.looks[2].productId));
const tight=fit.planLooks({...b,budget:500},all);assert.ok(tight.total<=500,'budget swap: '+tight.total);
assert.equal(fit.planLooks({...b,budget:300},all).total,125+165+195,'impossible budgets get the cheapest suitable plan');
assert.deepEqual(fit.sanitizeBrief({events:[{name:'Nikah',formality:'formal',setting:'garden'}],budget:'abc'},'nikah in doha budget 600').events,[{name:'Nikah',setting:'',time:'',formality:'formal'}]);

// ---------- Workers AI wrapper ----------
assert.deepEqual(wai.parseJsonReply({response:'```json\n{"a":1}\n```'}),{a:1});
assert.deepEqual(wai.parseJsonReply({response:{a:2}}),{a:2});
assert.equal(wai.parseJsonReply({response:'no json'}),null);
let calls=[];
const flaky={async run(model,input){calls.push(input);if(input.response_format)throw new Error('response_format unsupported');return {response:'{"ok":true}'}}};
assert.deepEqual(await wai.aiJson(flaky,{system:'s',user:'u',schema:{type:'object'}}),{ok:true});assert.equal(calls.length,2,'retries without response_format');
assert.equal(await wai.aiJson(null,{system:'s',user:'u'}),null);
assert.equal(await wai.aiJson({run:async()=>{throw new Error('down')}},{system:'s',user:'u'}),null,'failures return null');

// ---------- API with real route code ----------
const sql=new DatabaseSync(':memory:');
for(const f of ['drizzle/0000_sad_nitro.sql','drizzle/0001_useful_guardsmen.sql'])for(const s of fs.readFileSync(f,'utf8').split('--> statement-breakpoint'))sql.exec(s);
const db={prepare(q){return {bind(...v){return {async all(){return {results:sql.prepare(q).all(...v)}},async first(){return sql.prepare(q).get(...v)||null},async run(){return sql.prepare(q).run(...v)},q,v}},async all(){return {results:sql.prepare(q).all()}},async first(){return sql.prepare(q).get()||null},async run(){return sql.prepare(q).run()},q,v:[]}},async batch(stmts){sql.exec('BEGIN');try{const r=stmts.map(s=>sql.prepare(s.q).run(...s.v));sql.exec('COMMIT');return r}catch(e){sql.exec('ROLLBACK');throw e}}};
globalThis.__testEnv={DB:db};globalThis.__testUser=null;globalThis.fetch=async()=>new Response('{}');
const catalogSrc=ts.transpileModule(fs.readFileSync('lib/catalog.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ES2022}}).outputText;
const ordersUrl=toUrl(fs.readFileSync('lib/orders.ts','utf8')),notifyUrl=toUrl(fs.readFileSync('lib/notify.ts','utf8').replace("from './orders'","from '"+ordersUrl+"'"));
const source=fs.readFileSync('app/api/store/route.ts','utf8').replace("import { env } from 'cloudflare:workers';","const env=globalThis.__testEnv;").replace("import {getCurrentUser} from '../../auth';","const getCurrentUser=async()=>globalThis.__testUser;")
  .replace("import {products,initialSettings,SIZES,RETIRED_SIZES} from '../../../lib/catalog';",catalogSrc.replaceAll('export ',''))
  .replace("'../../../lib/orders'","'"+ordersUrl+"'").replace("'../../../lib/notify'","'"+notifyUrl+"'").replace("'../../../lib/ai-features'","'"+aifUrl+"'").replace("'../../../lib/fit-ai'","'"+fitUrl+"'").replace("'../../../lib/qatar-ai'","'"+qaiUrl+"'").replace("'../../../lib/qatar'","'"+qUrl+"'");
const mod=await import(toUrl(source));
let ip=1;const post=async(action,data={},headers={})=>{const r=await mod.POST(new Request('https://test.local/api/store',{method:'POST',headers:{'Content-Type':'application/json','Origin':'https://test.local','cf-connecting-ip':'10.0.0.'+(ip++),...headers},body:JSON.stringify({action,...data})}));return {status:r.status,data:await r.json()}};
const get=async action=>{const r=await mod.GET(new Request('https://test.local/api/store?action='+action));return {status:r.status,data:await r.json()}};
const owner={userId:'owner',email:'owner@example.test',displayName:'Owner'},alice={userId:'alice',email:'alice@example.test',displayName:'Alice'};
const as=u=>{globalThis.__testUser=u};
as(owner);sql.prepare('INSERT INTO records(id,kind,data,owner,created) VALUES(?,?,?,?,?)').run('owner','staff',JSON.stringify({email:owner.email,role:'owner',name:'Owner'}),'owner',new Date().toISOString());
assert.equal((await post('bootstrap')).status,200);
async function deliveredOrder(items){as(alice);const r=await post('checkout',{requestId:crypto.randomUUID(),name:'Alice',email:alice.email,phone:'55551234',address:'Doha',items});assert.equal(r.status,200,JSON.stringify(r.data));
  as(owner);for(const status of ['Confirmed','Packing','Shipped','Delivered'])assert.equal((await post('orderStatus',{id:r.data.id,status,notify:false})).status,200);as(alice);return r.data.id;}

// Fit memory without Workers AI: rules read the reason and the right line is remembered.
assert.deepEqual((await get('fitProfile')).data,{signals:[]},'signed-out shoppers have no fit memory');
let orderId=await deliveredOrder([{variant:'p1-M',qty:1},{variant:'p2-L',qty:1}]);
let r=await post('return',{data:{orderId,type:'Size exchange',variant:'p1-M',reason:'Too tight in the shoulders and bust, would like L'}});
assert.equal(r.status,200);assert.deepEqual(r.data.learned.map(i=>i.area).sort(),['chest','shoulders']);
let profile=(await get('fitProfile')).data;
assert.equal(profile.signals.length,2);assert.equal(profile.signals[0].size,'M');assert.equal(profile.signals[0].productId,'p1');assert.equal(profile.signals[0].fit,'Relaxed');
const saved=sql.prepare("SELECT data FROM records WHERE kind='return'").all().map(x=>JSON.parse(x.data));assert.equal(saved[0].fitSource,'rules');
// Non-fit reasons are stored but teach nothing; another customer's order is refused.
r=await post('return',{data:{orderId,type:'Return',variant:'p2-L',reason:'Changed my mind about the colour'}});assert.equal(r.status,200);assert.equal(r.data.learned,undefined);
as({userId:'mallory',email:'m@example.test'});assert.equal((await post('return',{data:{orderId,variant:'p1-M',reason:'too tight'}})).status,404);as(alice);
assert.equal((await get('fitProfile')).data.signals.length,2);

// Fit memory with Workers AI: the model's answer is validated before it is saved.
const aiCalls=[];
globalThis.__testEnv.AI={async run(model,input){aiCalls.push({model,input});
  const sys=input.messages[0].content;
  if(sys.includes('return reasons'))return {response:{issues:[{area:'waist',direction:'loose'},{area:'knees',direction:'tight'}]}};
  if(sys.includes('garment technologist'))return {response:JSON.stringify({type:'kurta',fit:'Relaxed',chest:21.5,length:40,confidence:'medium',note:'Sleeves folded.'})};
  if(sys.includes('senior stylist'))return {response:{brief:{events:[{name:'Haldi',setting:'outdoor',time:'day',formality:'festive'},{name:'Wedding',setting:'outdoor',time:'day',formality:'formal'}],location:'Kochi',month:'December',budget:700,prefer:[],avoid:['black'],weather:'Warm and humid, around 31°C.',culture:'Avoid upstaging the bride in red.'},
    looks:[{event:0,productId:'p4',why:'Breathable sage linen for a sunny haldi.',styling:['Silver oxidised jhumkas','Kolhapuri flats']},{event:1,productId:'p8',why:'Black evening set.'}]}};
  throw new Error('unexpected prompt');}};
orderId=await deliveredOrder([{variant:'p4-XL',qty:1}]);
r=await post('return',{data:{orderId,type:'Size exchange',reason:'Swims on me at the waist'}});
assert.deepEqual(r.data.learned,[{area:'waist',direction:'loose'}],'unknown areas from the model are dropped; single-item order needs no item choice');
assert.equal(aiCalls[0].model,'@cf/meta/llama-3.3-70b-instruct-fp8-fast');assert.ok(aiCalls[0].input.response_format,'asks for schema JSON');
profile=(await get('fitProfile')).data;assert.equal(profile.signals.at(-1).size,'XL');
// The saved profile drives product-page notes.
a=fit.fitAdvice(profile,{fit:'Relaxed'},['M','L','XL','XXL']);assert.equal(a.bySize.M.tone,'snug');assert.equal(a.bySize.XL.tone,'loose');assert.equal(a.recommended,'L');
assert.equal((await post('fitProfileReset')).status,200);assert.deepEqual((await get('fitProfile')).data,{signals:[]});

// Photo measuring.
assert.equal((await post('fitPhoto',{image:'http://example.com/x.jpg'})).status,400);
assert.equal((await post('fitPhoto',{image:'data:image/jpeg;base64,'+'A'.repeat(3_000_000)})).status,400,'large uploads refused');
r=await post('fitPhoto',{image:'data:image/jpeg;base64,/9j/AAAA',reference:'a4'});
assert.equal(r.status,200,JSON.stringify(r.data));assert.equal(r.data.measure.chest,43,'flat width doubled');assert.equal(r.data.confidence,'medium');
const vision=aiCalls.at(-1);assert.equal(vision.model,'@cf/meta/llama-4-scout-17b-16e-instruct');assert.equal(vision.input.messages[1].content[1].image_url.url,'data:image/jpeg;base64,/9j/AAAA');
assert.match(vision.input.messages[1].content[0].text,/A4/);

// Occasion planner with Workers AI: valid picks kept, avoided colours replaced, budget enforced.
r=await post('occasionPlan',{brief:"Cousin's wedding in Kochi, December, outdoor, 2 events, budget QAR 700, no black"});
assert.equal(r.status,200,JSON.stringify(r.data));assert.equal(r.data.source,'ai');
assert.equal(r.data.looks[0].productId,'p4');assert.deepEqual(r.data.looks[0].styling,['Silver oxidised jhumkas','Kolhapuri flats']);
assert.notEqual(r.data.looks[1].productId,'p8','avoided colour replaced');assert.ok(r.data.total<=700);
assert.match(r.data.brief.weather,/humid/);
// Out-of-stock pieces are never planned.
sql.prepare("UPDATE variants SET stock=0 WHERE product='p4'").run();
r=await post('occasionPlan',{brief:'Haldi and wedding in Kochi, outdoor, 2 events'});assert.ok(!r.data.looks.some(l=>l.productId==='p4'));

// Without Workers AI everything still works from the rules; photo measuring asks for manual entry.
delete globalThis.__testEnv.AI;
r=await post('occasionPlan',{brief:'Eid lunch and evening dinner in Doha, 2 events, prefer gold'});
assert.equal(r.status,200);assert.equal(r.data.source,'rules');assert.equal(r.data.looks.length,2);
assert.equal((await post('fitPhoto',{image:'data:image/jpeg;base64,/9j/AAAA'})).status,503);
assert.equal((await post('occasionPlan',{brief:'hi'})).status,400);

// Per-IP rate limit on AI endpoints.
let last;for(let i=0;i<9;i++)last=await post('occasionPlan',{brief:'Eid lunch in Doha'},{'cf-connecting-ip':'10.9.9.9'});
assert.equal(last.status,429);

console.log('PASS: Workers AI fit memory from returns, per-size fit notes, photo garment measuring, favourite matching, occasion planning with weather/colour/budget rules, AI output validation, fallbacks and rate limiting.');
