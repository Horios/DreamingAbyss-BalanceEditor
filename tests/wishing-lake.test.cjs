const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {loadRuntime}=require('./headless-editor.cjs'),root=path.resolve(__dirname,'..');
test('lake CRUD, validation, future records, import/export and online comparison preserve one document',()=>{
 const r=loadRuntime(root),run=r.run;
 run('__EMBERWILD_LAKE_EDITOR.open()');assert.match(r.elements.get('app').innerHTML,/許願湖|回贈模擬器/);assert.equal(run('__EMBERWILD_LAKE_EDITOR.issues().length'),0);
 run("__EMBERWILD_LAKE_EDITOR.add('input');__EMBERWILD_LAKE_EDITOR.update('inputs.4.min',25);__EMBERWILD_LAKE_EDITOR.update('typeWeights.gold',70);");assert.equal(run('data.wishingLake.inputs[4].max'),25);assert.equal(run('data.wishingLake.typeWeights.gold'),70);
 run("__EMBERWILD_LAKE_EDITOR.add('pool');__EMBERWILD_LAKE_EDITOR.update('inputs.4.poolId','pool1');__EMBERWILD_LAKE_EDITOR.remove('inputs.4');__EMBERWILD_LAKE_EDITOR.remove('pools.1');");
 run("for(const k of ['fairyEvents','companionQuests','festivals'])__EMBERWILD_LAKE_EDITOR.add(k);");assert.equal(run('Object.values(data.wishingLake.future).filter(Array.isArray).every(rows=>rows.every(x=>x.enabled===false))'),true);
 const out=JSON.parse(run('JSON.stringify(__EMBERWILD_MASTERY_EDITOR.cleanExport())'));r.ctx.roundtrip=out;run('data=JSON.parse(JSON.stringify(roundtrip));ensureArrays();');assert.deepEqual(JSON.parse(run('JSON.stringify(__EMBERWILD_MASTERY_EDITOR.cleanExport().wishingLake)')),out.wishingLake);
 run("__EMBERWILD_LAKE_EDITOR.update('gold.max',20001)");assert.throws(()=>run('__EMBERWILD_MASTERY_EDITOR.cleanExport()'),/金幣/);run("__EMBERWILD_LAKE_EDITOR.update('gold.max',20000)");
 const sim=JSON.parse(run("JSON.stringify(__EMBERWILD_LAKE_EDITOR.simulate({mapId:'map0',inputId:'gel',quantity:50,count:10000}))"));assert.equal(sim.invalid,0);assert(sim.goldMin>=500&&sim.goldMax<=20000);assert(Object.keys(sim.levels).every(x=>+x<=6));
 run("__EMBERWILD_LAKE_EDITOR.update('future.fairyEvents.0.enabled',true)");assert(run('__EMBERWILD_LAKE_EDITOR.issues().length')>0);
 assert.deepEqual(r.errors,[]);
});
test('single-file editor embeds the exact canonical game draw',()=>{
 const html=fs.readFileSync(path.join(root,'balance-editor.html'),'utf8'),model=html.match(/<script id="wishing-lake-model">([\s\S]*?)<\/script>/)[1].trim(),compiled=fs.readFileSync(path.join(root,'server/online/game-validator.mjs'),'utf8');assert(compiled.includes(model));
});
test('online load/compare preserves lake settings and changing a weight survives source serialization',async()=>{
 const {createGameValidator}=await import('../server/online/game-validator.mjs');const source=createGameValidator().defaults,r=loadRuntime(root);r.ctx.source=source;r.run('__EMBERWILD_RELEASE_EDITOR.load(source)');
 assert.deepEqual(JSON.parse(r.run('JSON.stringify(__EMBERWILD_RELEASE_EDITOR.current())')),source);
 r.run("__EMBERWILD_LAKE_EDITOR.update('typeWeights.gold',80)");const out=JSON.parse(r.run('JSON.stringify(__EMBERWILD_RELEASE_EDITOR.current())'));assert.equal(out.wishingLake.typeWeights.gold,80);delete out.wishingLake;const expected=structuredClone(source);delete expected.wishingLake;assert.deepEqual(out,expected);
});
test('publication blocks a lake document on a runtime without the matching capability',async()=>{
 const {ReleaseService}=require('../server/release-service.cjs');let capability='';const service=new ReleaseService({validate:x=>x,api:async()=>({type:'file',encoding:'base64',content:Buffer.from(capability).toString('base64')})});
 await assert.rejects(service.requireLifeRuntime({commit:'a'.repeat(40),branch:'main'},{wishingLake:{version:1}}),/尚未支援許願湖/);capability='wishingLakeVersion:1';await service.requireLifeRuntime({commit:'a'.repeat(40),branch:'chatgpt-dev'},{wishingLake:{version:1}});
});
