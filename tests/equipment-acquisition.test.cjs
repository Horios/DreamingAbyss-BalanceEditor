const test=require('node:test'),assert=require('node:assert/strict');
const {loadRuntime}=require('./headless-editor.cjs'),seed=require('../../DreamingAbyss/data/balance.json');
function editor(){const r=loadRuntime(process.cwd());r.ctx.seed=structuredClone(seed);r.run('data=EmberwildInventoryIcons.migrateDescriptions(structuredClone(seed),{hydrate:true});ensureArrays();');return r;}
const json=(r,code)=>JSON.parse(r.run('JSON.stringify('+code+')'));
test('equipment stages, T/boss rules and source references survive editor import/export',()=>{
 const r=editor();assert.deepEqual(json(r,'validateData()'),[]);assert.deepEqual(json(r,'__EMBERWILD_MASTERY_EDITOR.cleanExport().shopSettings.equipmentStages'),seed.shopSettings.equipmentStages);assert.deepEqual(json(r,'__EMBERWILD_MASTERY_EDITOR.cleanExport().equipmentPowerSystem.strength'),seed.equipmentPowerSystem.strength);
 assert.equal(r.run("EmberwildInventoryIcons.entries(data).find(r=>r.id==='equipment:form:0:0:0').sourceDetails.filter(s=>s.type==='shop').length"),7);
 r.run('openEquipmentShopEditor()');assert.match(r.elements.get('app').innerHTML,/通關解鎖條件/);assert.match(r.elements.get('app').innerHTML,/販售品項/);
 r.run('currentSection="equipmentPower";render()');assert.match(r.elements.get('app').innerHTML,/boss-grade-mult/);assert.match(r.elements.get('app').innerHTML,/商店標準基礎值/);assert.deepEqual(r.errors,[]);
});
test('stage controls edit the live document, support adding/removing stages and validate bad references',()=>{
 const r=editor();r.run(`globalThis.levelInput=document.createElement('input');levelInput.type='number';levelInput.dataset.stageField='level';levelInput.value='12';globalThis.priceInput=document.createElement('input');priceInput.type='number';priceInput.dataset.stageEntryField='unitPrice';priceInput.value='333';document.getElementById('app').querySelectorAll=sel=>sel==='[data-stage-field]'?[levelInput]:sel==='[data-stage-entry-field]'?[priceInput]:[];openEquipmentShopEditor();levelInput.onchange();priceInput.onchange();`);
 assert.equal(r.run('data.shopSettings.equipmentStages[0].level'),12);assert.equal(r.run('data.shopSettings.equipmentStages[0].entries[0].unitPrice'),333);
 r.run('addEquipmentShopStage()');assert.equal(r.run('data.shopSettings.equipmentStages.length'),8);r.run("document.getElementById('equipment-stage-delete').onclick()");assert.equal(r.run('data.shopSettings.equipmentStages.length'),7);
 r.run('data.shopSettings.equipmentStages[0].entries[0].formId="absent"');assert(json(r,'validateData()').some(x=>/商品引用/.test(x)));assert.deepEqual(r.errors,[]);
});
test('compiled online validator retains stages and rejects malformed weights; main publish requires the matching runtime',async()=>{
 const {createGameValidator}=await import('../server/online/game-validator.mjs');const v=createGameValidator();assert.deepEqual(v.validate(seed).shopSettings.equipmentStages,seed.shopSettings.equipmentStages);
 const bad=structuredClone(seed);bad.shopSettings.equipmentStages[1].unlockMapIds=['missing-map'];assert.throws(()=>v.validate(bad),/通關條件/);
 const {ReleaseService}=require('../server/release-service.cjs');let supported=false;const service=new ReleaseService({validate:x=>x,api:async()=>({type:'file',encoding:'base64',content:Buffer.from(supported?'const api={equipmentAcquisitionVersion:1}':'const api={}').toString('base64')})});
 const candidate={shopSettings:{equipmentStages:[seed.shopSettings.equipmentStages[0]]}};
 await assert.rejects(service.requireLifeRuntime({branch:'main',commit:'a'.repeat(40)},candidate),/裝備取得/);supported=true;await service.requireLifeRuntime({branch:'main',commit:'a'.repeat(40)},candidate);
});
