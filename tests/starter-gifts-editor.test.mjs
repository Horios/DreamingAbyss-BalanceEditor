import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createRequire} from 'node:module';import {createGameValidator} from '../server/online/game-validator.mjs';
const require=createRequire(import.meta.url),{loadRuntime}=require('./headless-editor.cjs'),published=createGameValidator().canonicalize(JSON.parse(fs.readFileSync('../DreamingAbyss/data/balance.json')));
function editor(){const r=loadRuntime(process.cwd());r.ctx.doc=published;r.run('data=__EMBERWILD_VALIDATE_DOCUMENT(doc);ensureArrays()');return r;}
test('starter configuration exposes only a weapon per class, while all inventory kinds can be added without a type limit',()=>{
 const r=editor(),E=r.ctx.__EMBERWILD_STARTER_EDITOR;
 assert.deepEqual(JSON.parse(r.run('JSON.stringify(data.starterPacks.map(row=>row.filter(Boolean).length))')),[1,1,1,1]);
 const entries=E.entries();assert(entries.every(row=>row.kind!=='skill'));for(const kind of ['equipment','material','item','gem','token'])assert(entries.some(row=>row.kind===kind));
 for(const row of entries.slice(0,30))assert.equal(E.add(0,row.id,3),true);
 assert.equal(r.run('data.starterPackItems[0].length'),30);assert.equal(E.add(0,entries[0].id,2),true);assert.equal(r.run('data.starterPackItems[0][0].quantity'),5);
 assert.equal(E.add(0,'skill:core:0:0',1),false);assert.equal(E.add(0,'item:missing',1),false);assert.equal(E.add(0,entries[0].id,1.5),false);
 assert.deepEqual(JSON.parse(r.run('JSON.stringify(validateData())')),[]);assert.match(E.itemsHTML(0),/starterGiftSearch/);assert.match(E.itemsHTML(0),/data-starter-gift-quantity/);
 const exported=r.run('__EMBERWILD_RELEASE_EDITOR.current()'),canonical=createGameValidator().canonicalize(exported);assert.deepEqual(JSON.parse(JSON.stringify(canonical.starterPackItems)),JSON.parse(JSON.stringify(exported.starterPackItems)));assert.equal(canonical.starterPacks[0][0].baseAttack,4);assert.deepEqual(r.errors,[]);
});
test('gift validation catches missing references, quantities and non-weapon starter slots',()=>{
 const r=editor();for(const change of ['data.starterPackItems[0]=[{kind:"item",key:"missing",quantity:1}]','data.starterPackItems[0]=[{kind:"material",key:"光輝碎塊",quantity:0}]','data.starterPacks[0][0].slot=1']){
  r.run('data=structuredClone(doc);ensureArrays();'+change);assert(r.run('validateData().length')>0);assert.throws(()=>createGameValidator().validate(r.run('__EMBERWILD_MASTERY_EDITOR.cleanExport()')));
 }
});

