// Homepage helpers: personal picks, trending/sale rails, price bands and colour swatches.
import fs from 'node:fs';import ts from 'typescript';import assert from 'node:assert/strict';
const toUrl=code=>'data:text/javascript;base64,'+Buffer.from(ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64');
const catUrl=toUrl(fs.readFileSync('lib/catalog.ts','utf8'));
const h=await import(toUrl(fs.readFileSync('lib/home.ts','utf8').replace("from './catalog'","from '"+catUrl+"'")));
const {products}=await import(catUrl);

assert.deepEqual(h.forYou(products,{}),[],'no signals, no section');
let picks=h.forYou(products,{saved:['p1']});
assert.ok(picks.length>0&&!picks.some(x=>x.product.id==='p1'),'saved pieces are not re-recommended');
assert.equal(picks[0].product.category,'Salwar suits','closest match first');assert.match(picks[0].why,/Because you saved The Gulmohar Silk Set/);
picks=h.forYou(products,{viewed:['p3']});assert.ok(['p5','p8','p1'].includes(picks[0].product.id),'viewing an occasion piece drives occasion picks');
picks=h.forYou(products,{viewed:['p3','p2']});assert.equal(picks[0].product.id,'p7','closest match to any recent view');
assert.ok(h.forYou(products.map(p=>p.id==='p5'?{...p,published:false}:p),{saved:['p3']}).every(x=>x.product.id!=='p5'),'unpublished pieces hidden');

assert.equal(h.trending(products,3)[0].id,'p1','bestsellers first');
const sale=h.onSale(products);assert.ok(sale.length&&sale.every(p=>p.oldPrice>p.price));assert.equal(h.discount({price:285,oldPrice:345}),17);
const bands=h.priceBands(products);assert.ok(bands.every(b=>b.count>0));assert.equal(bands.find(b=>b.label==='Under QAR 150').count,1);
const sw=h.colourSwatches(products);assert.equal(sw[0].name,'Ivory');assert.equal(sw[0].count,2);
assert.equal(h.swatchColour('Wine'),'#6b1f35');assert.equal(h.swatchColour('Dusty rose'),h.swatchColour('rose'));assert.equal(h.swatchColour('Unknownish'),'#cbbfae');

console.log('PASS: homepage personal picks, trending and sale rails, price bands and colour swatches.');
