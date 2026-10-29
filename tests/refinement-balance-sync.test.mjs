import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {createGameValidator} from '../server/online/game-validator.mjs';

const require=createRequire(import.meta.url);
const {loadRuntime}=require('./headless-editor.cjs');
const source=fs.readFileSync(new URL('../balance-editor.html',import.meta.url),'utf8');
const seedMatch=source.match(/const ORIGINAL_B64 = "([A-Za-z0-9+/=]+)";/);
const defaultsMatch=source.match(/^const BALANCE_SETTINGS_DEFAULTS = (.+);$/m);
assert(seedMatch&&defaultsMatch,'平衡工作台缺少內建設定來源');
const seed=JSON.parse(Buffer.from(seedMatch[1],'base64').toString('utf8'));
const defaults=JSON.parse(defaultsMatch[1]);
const flatPaths=['flatStatsPerLevel','flatStatsPerEquipmentLevel'];
const stats=['atk','hp','def'];
const validator=createGameValidator();

test('refinement and level-gap defaults match the embedded latest test document',()=>{
 assert.deepEqual(defaults.equipment.enhance,seed.balanceSettings.equipment.enhance);
 assert.deepEqual(defaults.progression.xpLevelGap,seed.balanceSettings.progression.xpLevelGap);
 assert.equal(seed.balanceSettings.meta.skillSystemVersion,1);
 for(const field of flatPaths)for(const stat of stats){
  assert.equal(typeof defaults.equipment.enhance[field][stat],'number');
  assert(source.includes('"equipment.enhance.'+field+'.'+stat+'":['),'精煉係數缺少中文編輯標籤：'+field+'.'+stat);
 }
 assert.match(source,/p==='meta\.skillSystemVersion'/);
});

test('editor imports, edits and exports all refinement growth coefficients for game validation',()=>{
 const r=loadRuntime(process.cwd());
 r.ctx.imported=structuredClone(seed);
 r.run('data=structuredClone(imported);ensureArrays();');
 r.run('currentSection="balanceSettings:equipment";render();');
 const html=r.elements.get('app').innerHTML;
 for(const field of flatPaths)for(const stat of stats)
  assert(html.includes('balanceSettings.equipment.enhance.'+field+'.'+stat),'平衡設定頁沒有輸入欄位：'+field+'.'+stat);
 r.run('data.balanceSettings.equipment.enhance.flatStatsPerLevel.atk=1.25;data.balanceSettings.equipment.enhance.flatStatsPerLevel.hp=2.5;data.balanceSettings.equipment.enhance.flatStatsPerEquipmentLevel.def=.035;markDirty();');
 const exported=JSON.parse(r.run('JSON.stringify(__EMBERWILD_MASTERY_EDITOR.cleanExport())'));
 assert.deepEqual(validator.validate(exported).balanceSettings.equipment.enhance,exported.balanceSettings.equipment.enhance);
 assert.equal(exported.balanceSettings.equipment.enhance.flatStatsPerLevel.atk,1.25);
 assert.equal(exported.balanceSettings.equipment.enhance.flatStatsPerLevel.hp,2.5);
 assert.equal(exported.balanceSettings.equipment.enhance.flatStatsPerEquipmentLevel.def,.035);
 assert.deepEqual(r.errors,[]);
});

test('game validator rejects negative refinement growth without silently coercing data',()=>{
 const doc=structuredClone(seed);
 doc.balanceSettings.equipment.enhance.flatStatsPerEquipmentLevel.hp=-0.01;
 assert.throws(()=>validator.validate(doc),/精煉|非負|不得為負值/);
});

