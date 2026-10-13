import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createRequire} from 'node:module';import {createGameValidator} from '../server/online/game-validator.mjs';
const require=createRequire(import.meta.url),{loadRuntime}=require('./headless-editor.cjs');
test('item, gathering output, recipe input, gem and token choices survive editor export and game validation',()=>{
 const r=loadRuntime(process.cwd()),v=createGameValidator();r.ctx.doc=v.defaults;r.run('data=structuredClone(doc);');
 const entries=JSON.parse(r.run('JSON.stringify(__EMBERWILD_INVENTORY_ICON_EDITOR.entries())'));
 for(const p of [...v.defaults.lifeSkills.gathering,...Object.values(v.defaults.lifeSkills.recipes)])for(const o of [p,...(p.bonusDrops||[])])assert(entries.some(x=>x.kind===o.outputType&&x.key===o.output));
 const pairs=[['item',v.defaults.items[0].id],['material','紅色草'],['material','紅色草泥'],['gem','0'],['token',v.defaults.companionTokens.catalog[0].id]];
 for(const [kind,key]of pairs){r.ctx.args={kind,key};r.run('__EMBERWILD_INVENTORY_ICON_EDITOR.set(args.kind,args.key,"lucide:leaf")');}
 const exported=JSON.parse(r.run('JSON.stringify(__EMBERWILD_MASTERY_EDITOR.cleanExport())'));assert.equal(exported.inventoryIcons.length,pairs.length);assert.deepEqual(v.validate(exported).inventoryIcons,exported.inventoryIcons);
 r.run('currentSection="inventoryIcons";render();');assert.match(r.elements.get('app').innerHTML,/Lucide 圖庫/);assert.match(r.elements.get('app').innerHTML,/紅色草泥/);
 r.run('currentSection="gatheringProducts";render();');assert.match(r.elements.get('app').innerHTML,/data-choose-inventory-icon="material:紅色草/);
 for(const [kind,key]of pairs){r.ctx.args={kind,key};r.run('__EMBERWILD_INVENTORY_ICON_EDITOR.set(args.kind,args.key,"auto")');}assert.equal(r.run('__EMBERWILD_MASTERY_EDITOR.cleanExport().inventoryIcons'),undefined);assert.deepEqual(r.errors,[]);
});
test('shared editor model matches the engine contract and rejects an unknown library reference',()=>{
 const r=loadRuntime(process.cwd());r.run('data.inventoryIcons=[{kind:"material",key:"紅色草",iconType:"lucide:missing-fixture"}]');assert(r.run('validateData()').some(x=>x.includes('道具圖示')));
 const html=fs.readFileSync('balance-editor.html','utf8'),source=html.match(/<script id="inventory-icon-model-v1">\s*([\s\S]*?)<\/script>/)[1].trim();assert(fs.readFileSync('server/online/game-validator.mjs','utf8').includes(source));
});
