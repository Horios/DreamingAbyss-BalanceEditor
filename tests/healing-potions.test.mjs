import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {createGameValidator} from '../server/online/game-validator.mjs';
const require=createRequire(import.meta.url),{loadRuntime}=require('./headless-editor.cjs'),{ReleaseService}=require('../server/release-service.cjs');
test('fixed potion editor controls, shared model, drop bounds and online validator use one document',()=>{
 const r=loadRuntime(process.cwd()),d=JSON.parse(fs.readFileSync('../DreamingAbyss/data/balance.json'));
 r.ctx.doc=d;r.run("data=__EMBERWILD_VALIDATE_DOCUMENT(doc);ensureArrays();currentSection='potions';selected.potion=1;render()");
 assert.match(r.elements.get('app').innerHTML,/固定恢復 HP/);assert.match(r.elements.get('app').innerHTML,/最低商店 VIP 等級/);assert.doesNotMatch(r.elements.get('app').innerHTML,/healFraction|恢復最大生命比例/);
 r.run("globalThis.E=__EMBERWILD_INVENTORY_ICON_EDITOR;E.open('inventoryIcons','all','item:heal_standard');E.selectTab('effects');E.stage('item:heal_standard','object.healAmount',61);E.stage('item:heal_standard','object.requiredVip',2);E.stage('item:heal_standard','object.shopAvailable',false);if(!E.save('item:heal_standard'))throw Error('save failed')");
 const exportDoc=JSON.parse(r.run('JSON.stringify(__EMBERWILD_MASTERY_EDITOR.cleanExport())')),live=createGameValidator().validate(exportDoc),p=live.items.find(x=>x.id==='heal_standard');
 assert.deepEqual([p.healAmount,p.requiredVip,p.shopAvailable],[61,2,false]);assert(live.balanceSettings.drops.entries.find(r=>r.key==='heal_supreme').independent);
 assert.deepEqual(r.errors,[]);
});
test('publishing fixed HP data requires the target branch to support the new potion rules',async()=>{
 let supported=false;const service=new ReleaseService({validate:x=>x,api:async()=>({type:'file',encoding:'base64',content:Buffer.from(supported?'const api={healingPotionVersion:1};':'const api={};').toString('base64')})});
 const doc={items:[{type:'healPotion',healAmount:20}]};for(const branch of ['main','chatgpt-dev'])await assert.rejects(service.requireLifeRuntime({branch,commit:'a'.repeat(40)},doc),/固定 HP/);
 supported=true;await service.requireLifeRuntime({branch:'chatgpt-dev',commit:'a'.repeat(40)},doc);
});

