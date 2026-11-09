import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createRequire} from 'node:module';import {createGameValidator} from '../server/online/game-validator.mjs';
const require=createRequire(import.meta.url),{loadRuntime}=require('./headless-editor.cjs');const published=JSON.parse(fs.readFileSync('../DreamingAbyss/data/balance.json','utf8'));
test('manager saves descriptions to the same canonical field for every kind, including blank and reroll',()=>{
 const r=loadRuntime(process.cwd());r.ctx.doc=published;r.run('data=__EMBERWILD_VALIDATE_DOCUMENT(doc);ensureArrays();');const E=r.ctx.__EMBERWILD_INVENTORY_ICON_EDITOR;
 for(const id of ['material:紅色草','item:heal_small','item:power_tier_reroll','item:level_scroll','gem:0','token:berserk','equipment:form:0:0:0']){
  E.open('inventoryIcons','all',id);E.stage(id,'description','集中說明 '+id);E.save();let out=r.run('__EMBERWILD_RELEASE_EDITOR.current()');assert.equal(out.inventoryIcons.find(x=>x.kind+':'+x.key===id).description,'集中說明 '+id);assert.doesNotThrow(()=>createGameValidator().validate(out));
  E.stage(id,'description','');E.save();out=r.run('__EMBERWILD_RELEASE_EDITOR.current()');assert.equal(out.inventoryIcons.find(x=>x.kind+':'+x.key===id).description,'');
 }
 const out=r.run('__EMBERWILD_RELEASE_EDITOR.current()');for(const item of out.items)assert(!Object.hasOwn(item,'description'));for(const item of out.companionTokens.catalog)assert(!Object.hasOwn(item,'description'));assert(!Object.hasOwn(out.equipmentPowerSystem.rerollItem,'description'));assert.deepEqual(r.errors,[]);
});
test('specialized pages offer a manager link and no independent item description inputs',()=>{
 const r=loadRuntime(process.cwd());r.ctx.doc=published;r.run('data=__EMBERWILD_VALIDATE_DOCUMENT(doc);ensureArrays();');
 for(const section of ['items','potions','shopSettings','equipmentPower','companionTokens']){r.run(`currentSection=${JSON.stringify(section)};render();`);const html=r.elements.get('app').innerHTML;assert.match(html,/openItemDescriptions/);assert(!/textarea[^>]*(?:description|powerItemDesc)|data-boost-field="description"|data-shop-field="description"/.test(html),section);}
 assert.deepEqual(r.errors,[]);
});
