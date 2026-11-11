// Life in Qatar: dress-sense guide, month-by-month AC-to-heat wardrobe, festival kits,
// new-to-Qatar welcome kit and community group orders. Pure rules are tested directly; the
// API runs the real route code with and without a fake Workers AI binding (no network).
import {DatabaseSync} from 'node:sqlite';import fs from 'node:fs';import ts from 'typescript';import assert from 'node:assert/strict';
const toUrl=code=>'data:text/javascript;base64,'+Buffer.from(ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64');
const fitUrl=toUrl(fs.readFileSync('lib/fit-ai.ts','utf8')),waiUrl=toUrl(fs.readFileSync('lib/workers-ai.ts','utf8'));
const aifUrl=toUrl(fs.readFileSync('lib/ai-features.ts','utf8').replace("from './workers-ai'","from '"+waiUrl+"'").replace("from './fit-ai'","from '"+fitUrl+"'"));
const qUrl=toUrl(fs.readFileSync('lib/qatar.ts','utf8')),qaiUrl=toUrl(fs.readFileSync('lib/qatar-ai.ts','utf8').replace("from './workers-ai'","from '"+waiUrl+"'").replace("from './qatar'","from '"+qUrl+"'"));
const q=await import(qUrl);const {products}=await import(toUrl(fs.readFileSync('lib/catalog.ts','utf8')));
const all=products.map(p=>({...p}));

// ---------- Rules ----------
assert.equal(q.climateFor(6).high,42);assert.equal(q.climateFor(6).season,'humid-hot');assert.equal(q.climateFor(12).month,'January','wraps around');
assert.equal(q.findPlaces('What can I wear to a mall in Lusail?')[0].id,'mall');
assert.equal(q.findPlaces('office in West Bay')[0].id,'office');
assert.equal(q.findPlaces('invited to a majlis')[0].level,3);
assert.deepEqual(q.findPlaces('Souq Waqif and the mosque').map(p=>p.id).sort(),['mosque','souq']);
assert.equal(q.findPlaces('somewhere nice').length,1,'unknown places fall back to everyday public norms');
let g=q.dressGuideFallback('We are visiting a majlis',all,6);
assert.equal(g.level,3);assert.match(g.answer,/most conservative/);assert.match(g.answer,/July/);assert.ok(g.picks.length>=1);
assert.ok(!g.picks.some(p=>/georgette/i.test(p.fabric)),'sheer fabrics are not suggested for the most conservative places');
let w=q.monthWardrobe(7);assert.ok(w.hot);assert.ok(w.tips.some(t=>/18–20°C/.test(t)),'AC layer tip');assert.ok(w.tips.some(t=>/perspiration/.test(t)),'sweat-hiding colours');
assert.ok(!q.monthWardrobe(0).hot);assert.match(q.monthWardrobe(0).headline,/cool season/);
const hotPicks=q.topPicks(all,w.want,3,()=>'');assert.ok(hotPicks.every(p=>/cotton|linen|chanderi/i.test(p.fabric)),'breathable fabrics in summer: '+hotPicks.map(p=>p.fabric));
let f=q.festivalsAround(7,2027,{onam:'2027-09-12'});
assert.equal(f.find(x=>x.id==='onam').date,'2027-09-12');assert.ok(f.find(x=>x.id==='onam').soon,'September Onam shows as coming up in August');
assert.equal(q.festivalsAround(11,2027).find(x=>x.id==='christmas').date,'2027-12-25');
assert.ok(!q.festivalsAround(11,2027,{},'2027-12-26').find(x=>x.id==='christmas').soon,'past festivals are not “coming up”');
assert.match(q.festivalsAround(0,2027).find(x=>x.id==='diwali').when,/Usually October–November/,'moving festivals without a set date show the usual months');
assert.ok(!q.festivalsAround(0,2027).find(x=>x.id==='diwali').soon);
assert.deepEqual(q.sanitizeTiers([{min:'x'},{min:1,percent:10}]),q.DEFAULT_TIERS,'bad tiers fall back to defaults');
assert.deepEqual(q.sanitizeTiers([{min:30,percent:15},{min:5,percent:5}]).map(t=>t.min),[5,30]);
const line=(qty,size='M',productId='p7')=>({name:'A',productId,size,colour:'Ivory',qty,price:245});
let t=q.groupTotals([line(4),line(5,'L')],q.DEFAULT_TIERS);assert.equal(t.pieces,9);assert.equal(t.percent,0);assert.deepEqual(t.next,{min:10,percent:10,more:1});
t=q.groupTotals([line(4),line(6,'L')],q.DEFAULT_TIERS);assert.equal(t.percent,10);assert.equal(t.total,2205);assert.deepEqual(t.sizes['p7|Ivory'],{M:4,L:6});
assert.equal(q.themePicks('All ladies in kasavu with green borders',all)[0].productId,'p7');
assert.deepEqual(q.sanitizeMembers([{who:'Daughter',age:'8',size:'M'},{who:'',age:-1}]),[{who:'Daughter',age:8,size:'M'},{who:'Me',age:undefined,size:undefined}]);
assert.deepEqual(q.mergePicks([{productId:'nope'},{productId:'p2',why:'Ivory cotton for the office.'},{productId:'p2'}],all,[q.toPick(all[0],'fallback')],2).map(p=>p.productId),['p2','p1']);
assert.match(q.groupCode(),/^[A-HJ-NP-Z2-9]{6}$/);

// ---------- API ----------
const sql=new DatabaseSync(':memory:');
for(const file of ['drizzle/0000_sad_nitro.sql','drizzle/0001_useful_guardsmen.sql'])for(const s of fs.readFileSync(file,'utf8').split('--> statement-breakpoint'))sql.exec(s);
const db={prepare(qs){return {bind(...v){return {async all(){return {results:sql.prepare(qs).all(...v)}},async first(){return sql.prepare(qs).get(...v)||null},async run(){return sql.prepare(qs).run(...v)},q:qs,v}},async all(){return {results:sql.prepare(qs).all()}},async first(){return sql.prepare(qs).get()||null},async run(){return sql.prepare(qs).run()},q:qs,v:[]}},async batch(stmts){sql.exec('BEGIN');try{const r=stmts.map(s=>sql.prepare(s.q).run(...s.v));sql.exec('COMMIT');return r}catch(e){sql.exec('ROLLBACK');throw e}}};
globalThis.__testEnv={DB:db};globalThis.__testUser=null;globalThis.fetch=async()=>new Response('{}');
const catalogSrc=ts.transpileModule(fs.readFileSync('lib/catalog.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ES2022}}).outputText;
const ordersUrl=toUrl(fs.readFileSync('lib/orders.ts','utf8')),notifyUrl=toUrl(fs.readFileSync('lib/notify.ts','utf8').replace("from './orders'","from '"+ordersUrl+"'"));
const source=fs.readFileSync('app/api/store/route.ts','utf8').replace("import { env } from 'cloudflare:workers';","const env=globalThis.__testEnv;").replace("import {getCurrentUser} from '../../auth';","const getCurrentUser=async()=>globalThis.__testUser;")
  .replace("import {products,initialSettings,SIZES,RETIRED_SIZES} from '../../../lib/catalog';",catalogSrc.replaceAll('export ',''))
  .replace("'../../../lib/orders'","'"+ordersUrl+"'").replace("'../../../lib/notify'","'"+notifyUrl+"'").replace("'../../../lib/ai-features'","'"+aifUrl+"'").replace("'../../../lib/fit-ai'","'"+fitUrl+"'")
  .replace("'../../../lib/qatar-ai'","'"+qaiUrl+"'").replace("'../../../lib/qatar'","'"+qUrl+"'");
const mod=await import(toUrl(source));
let ip=1;const post=async(action,data={},headers={})=>{const r=await mod.POST(new Request('https://test.local/api/store',{method:'POST',headers:{'Content-Type':'application/json','Origin':'https://test.local','cf-connecting-ip':'10.1.0.'+(ip++),...headers},body:JSON.stringify({action,...data})}));return {status:r.status,data:await r.json()}};
const get=async(action,extra='')=>{const r=await mod.GET(new Request('https://test.local/api/store?action='+action+extra));return {status:r.status,data:await r.json()}};
const owner={userId:'owner',email:'owner@example.test',displayName:'Owner'},priya={userId:'priya',email:'priya@example.test',displayName:'Priya Nair'},sam={userId:'sam',email:'sam@example.test',displayName:'Sam'};
const as=u=>{globalThis.__testUser=u};
as(owner);sql.prepare('INSERT INTO records(id,kind,data,owner,created) VALUES(?,?,?,?,?)').run('owner','staff',JSON.stringify({email:owner.email,role:'owner',name:'Owner'}),'owner',new Date().toISOString());
assert.equal((await post('dressGuide',{question:'mall in Lusail'})).status,409,'nothing to suggest before the store is set up');
assert.equal((await post('bootstrap')).status,200);
const day=n=>new Date(Date.now()+n*864e5).toISOString().slice(0,10);

// Admin: community events, festival dates, welcome offer, group tiers.
assert.equal((await post('save',{kind:'communityEvent',data:{name:'Onam celebration'}})).status,400,'date required');
assert.equal((await post('save',{kind:'communityEvent',data:{name:'Kerala Association Onam',date:day(10),venue:'ICC, Abu Hamour',festival:'onam',link:'javascript:alert(1)'}})).status,200);
assert.equal((await post('save',{kind:'communityEvent',data:{name:'Old event',date:day(-5)}})).status,200);
const ev=(await get('admin')).data.communityEvent;assert.equal(ev.length,2);assert.equal(ev.find(e=>e.name==='Kerala Association Onam').link,'','unsafe links dropped');
const cfg=(await get('catalog')).data.settings;
assert.equal((await post('save',{kind:'settings',id:'store-settings',data:{...cfg,festivalDates:{onam:day(12)},welcomeCoupon:'WELCOMEQA',welcomeText:'10% off your first order',groupTiers:[{min:5,percent:10},{min:10,percent:15}]}})).status,200);
as(null);

// This month (no AI): climate, live picks, festivals, real events only, welcome offer.
let r=await get('qatarMonth');assert.equal(r.status,200);
assert.ok(r.data.climate.high>0);assert.equal(r.data.picks.length,4);assert.equal(r.data.source,'rules');
assert.deepEqual(r.data.events.map(e=>e.name),['Kerala Association Onam'],'past events hidden');
assert.ok(r.data.festivals.find(x=>x.id==='onam').soon,'store-set Onam date shows as coming up');
assert.deepEqual(r.data.welcome,{code:'WELCOMEQA',text:'10% off your first order'});

// Dress guide (no AI).
r=await post('dressGuide',{question:'What can I wear to a mall in Lusail?'});assert.equal(r.status,200);assert.equal(r.data.source,'rules');assert.equal(r.data.places[0].id,'mall');assert.ok(r.data.picks.length>=1);
assert.equal((await post('dressGuide',{question:'hi'})).status,400);

// Festival kit (no AI): community events for that festival, video-call ideas.
r=await post('festivalKit',{festival:'onam'});assert.equal(r.status,200);assert.equal(r.data.festival.name,'Onam');
assert.deepEqual(r.data.events.map(e=>e.name),['Kerala Association Onam']);assert.ok(r.data.call.length>=2);assert.ok(r.data.picks.some(p=>p.productId==='p7'),'kasavu set suggested for Onam');
assert.equal((await post('festivalKit',{festival:'halloween'})).status,400);

// Welcome kit (no AI): per-member picks in stock in their size, kids note, no repeats.
sql.prepare("UPDATE variants SET stock=0 WHERE product='p2' AND size='XL'").run();
r=await post('welcomeKit',{members:[{who:'Me',size:'XL'},{who:'Daughter',age:8}],budget:900});assert.equal(r.status,200);
const items=r.data.sections.flatMap(s=>s.items);assert.equal(items.length,3,'three sections for the adult');assert.ok(items.every(i=>i.member==='Me'));
assert.ok(!items.some(i=>i.productId==='p2'),'pieces out of stock in the member’s size are skipped');assert.equal(new Set(items.map(i=>i.productId)).size,3);
assert.match(r.data.kidsNote,/Daughter/);assert.equal(r.data.welcome.code,'WELCOMEQA');
assert.equal((await post('welcomeKit',{members:[]})).status,400);

// Group orders.
r=await post('groupTheme',{theme:'All ladies in kasavu with green borders'});assert.equal(r.data.picks[0].productId,'p7');
const groupData={name:'Ladies wing',organisation:'Kerala Association',event:'Onam sadya',date:day(20),deadline:day(15),theme:'kasavu with green borders',productIds:['p7','nope'],phone:'+974 5555 1234'};
assert.equal((await post('groupCreate',{data:groupData})).status,401,'organisers sign in');
as(priya);assert.equal((await post('groupCreate',{data:{...groupData,deadline:day(25)}})).status,400,'deadline after the event');
r=await post('groupCreate',{data:groupData});assert.equal(r.status,200,JSON.stringify(r.data));const code=r.data.code;
as(null);
r=await post('groupJoin',{code,name:'Anjali Menon',phone:'55512345',productId:'p7',size:'L',colour:'Ivory',qty:2});assert.equal(r.status,200,JSON.stringify(r.data));
assert.equal((await post('groupJoin',{code,name:'X',phone:'5551',productId:'p7',size:'L',colour:'Ivory'})).status,400,'phone required');
assert.equal((await post('groupJoin',{code,name:'X',phone:'55512345',productId:'p7',size:'S',colour:'Ivory'})).status,400,'retired sizes refused');
assert.equal((await post('groupJoin',{code,name:'X',phone:'55512345',productId:'p1',size:'M',colour:'Wine'})).status,400,'only the group’s pieces');
assert.equal((await post('groupJoin',{code:'ZZZZZZ',name:'X',phone:'55512345',productId:'p7',size:'M',colour:'Ivory'})).status,404);
for(const [n,s] of [['Bindu','M'],['Celine','XL'],['Divya','M']])assert.equal((await post('groupJoin',{code,name:n+' K',phone:'5551000'+n.length,productId:'p7',size:s,colour:'Ivory'})).status,200);
let pub=(await get('group','&code='+code.toLowerCase())).data;
assert.equal(pub.isOrganiser,false);assert.equal(pub.members[0].phone,undefined,'phones hidden publicly');assert.equal(pub.members[0].name,'Anjali','first names only');
assert.deepEqual(pub.products.map(p=>p.id),['p7'],'unknown products dropped');assert.equal(pub.totals.pieces,5);assert.equal(pub.totals.percent,10);assert.deepEqual(pub.totals.sizes['p7|Ivory'],{L:2,M:2,XL:1});
assert.equal(pub.totals.next.more,5);
as(sam);assert.equal((await post('groupUpdate',{code,status:'closed'})).status,403,'only the organiser');
as(priya);let full=(await get('group','&code='+code)).data;assert.ok(full.isOrganiser);assert.equal(full.members[0].phone,'55512345');
assert.deepEqual((await get('myGroups')).data.groups.map(x=>x.code),[code]);
r=await post('groupUpdate',{code,removeMember:full.members.find(m=>m.name==='Divya K').id});assert.equal(r.data.members.length,3);
r=await post('groupUpdate',{code,status:'closed'});assert.equal(r.data.status,'closed');
as(null);assert.equal((await post('groupJoin',{code,name:'Late',phone:'55519999',productId:'p7',size:'M',colour:'Ivory'})).status,409,'closed groups refuse sizes');
as(priya);assert.equal((await post('groupUpdate',{code,status:'confirmed'})).status,400,'organisers cannot confirm');
r=await post('groupUpdate',{code,status:'submitted'});assert.equal(r.data.status,'submitted');
as(owner);r=await post('groupUpdate',{code,status:'confirmed',staffNote:'Ready on the 10th'});assert.equal(r.status,200);assert.equal(r.data.status,'confirmed');
assert.equal((await get('admin')).data.group[0].staffNote,'Ready on the 10th');
as(priya);assert.equal((await post('groupUpdate',{code,status:'open'})).status,400,'organisers cannot reopen a confirmed order');
// Concurrent joins are never lost (optimistic save with retry).
as(priya);const code2=(await post('groupCreate',{data:{...groupData,name:'Choir'}})).data.code;as(null);
const joins=await Promise.all(Array.from({length:8},(_,i)=>post('groupJoin',{code:code2,name:'M'+i,phone:'5550000'+i,productId:'p7',size:'M',colour:'Ivory'})));
assert.ok(joins.every(j=>j.status===200),JSON.stringify(joins.map(j=>j.status)));assert.equal((await get('group','&code='+code2)).data.members.length,8);

// With Workers AI: validated picks, cached shared guides.
const aiCalls=[];
globalThis.__testEnv.AI={async run(model,input){aiCalls.push(input);const sys=input.messages[0].content;
  if(sys.includes('dress-code question'))return {response:{answer:'For a majlis, wear something loose and ankle-length.',tips:['Carry a dupatta.'],picks:[{productId:'p8',why:'Black georgette.'},{productId:'p2',why:'Ivory cotton kurta, easy and modest.'},{productId:'ghost',why:'x'}]}};
  if(sys.includes('monthly wardrobe'))return {response:{intro:'November is lovely in Doha.',tips:['Evenings by the sea get breezy.'],picks:[{productId:'p4',why:'Sage linen co-ord.'}]}};
  if(sys.includes('far from family'))return {response:{intro:'Happy Onam!',call:['Share your sadya on video.'],picks:[{productId:'p7',why:'Kasavu for Onam.'}]}};
  if(sys.includes('just arrived'))return {response:{intro:'Welcome to Doha, Nair family!',tips:['Cover shoulders and knees in malls.'],why:[]}};
  throw new Error('unexpected prompt');}};
r=await post('dressGuide',{question:'We are invited to a majlis'});assert.equal(r.data.source,'ai');assert.match(r.data.answer,/ankle-length/);
assert.ok(!r.data.picks.some(p=>p.productId==='ghost'));assert.equal(r.data.picks.find(p=>p.productId==='p2').why,'Ivory cotton kurta, easy and modest.');
assert.match(aiCalls.at(-1).messages[0].content,/Majlis or Qatari home visit/,'model is grounded in the checked norms');
const before=aiCalls.length;r=await get('qatarMonth');assert.equal(r.data.source,'ai');assert.equal(r.data.intro,'November is lovely in Doha.'.replace('November',r.data.climate.month));
r=await get('qatarMonth');assert.equal(aiCalls.length,before+1,'month guide is cached for everyone');
r=await post('festivalKit',{festival:'onam'});assert.equal(r.data.intro,'Happy Onam!');assert.equal(r.data.call[0],'Share your sadya on video.');
await post('festivalKit',{festival:'onam'});assert.equal(aiCalls.filter(c=>c.messages[0].content.includes('far from family')).length,1,'festival kit cached');
r=await post('welcomeKit',{members:[{who:'Priya'}]});assert.equal(r.data.intro,'Welcome to Doha, Nair family!');
// Cached picks are re-checked against live stock.
sql.prepare("UPDATE variants SET stock=0 WHERE product='p4'").run();r=await get('qatarMonth');assert.ok(!r.data.picks.some(p=>p.productId==='p4'));
delete globalThis.__testEnv.AI;
as(owner);assert.equal((await post('deleteCommunityEvent',{id:ev[0].id})).status,200);assert.equal((await get('admin')).data.communityEvent.length,1);
as(null);assert.equal((await post('deleteCommunityEvent',{id:ev[1].id})).status,403,'admin only');

console.log('PASS: Life in Qatar dress-sense guide, monthly AC-to-heat wardrobe, festival kits with store-set dates and community events, new-to-Qatar welcome kit, community group orders (discount tiers, privacy, permissions, concurrency), AI grounding, validation and caching.');
