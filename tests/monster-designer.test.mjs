import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {createGameValidator} from '../server/online/game-validator.mjs';
const require=createRequire(import.meta.url),{loadRuntime}=require('./headless-editor.cjs');
const doc=JSON.parse(fs.readFileSync('../DreamingAbyss/data/balance.json'));
const plain=x=>JSON.parse(JSON.stringify(x));
function editor(){const r=loadRuntime(process.cwd());r.ctx.doc=doc;r.run('data=__EMBERWILD_VALIDATE_DOCUMENT(doc);ensureArrays();');return r;}
test('selecting existing items keeps the catalogue intact and local shared-drop edits preserve other monsters',()=>{
 const r=editor(),D=r.ctx.__EMBERWILD_MONSTER_DESIGNER,E=r.ctx.__EMBERWILD_INVENTORY_ICON_EDITOR,before=E.entries().length;
 const rule=D.attach('map0_mob0','item:heal_small');assert.equal(E.entries().length,before);assert.equal(rule.key,'heal_small');assert.equal(D.attach('map0_mob0','item:heal_small').id,rule.id);
 r.run('data.balanceSettings.drops.entries.push({id:"shared_fixture",name:"材料",enabled:true,type:"material",key:"清水",sources:["map0_mob0","map0_mob1"],kinds:["normal","elite"],chanceByDifficulty:[.2,.3,.4],quantityMin:1,quantityMax:2});markDirty();');
 const isolated=D.localRule('shared_fixture','map0_mob0');isolated.chanceByDifficulty[0]=.9;
 assert.deepEqual(plain(r.run('data.balanceSettings.drops.entries.find(d=>d.id==="shared_fixture").sources')),['map0_mob1']);assert.equal(r.run('data.balanceSettings.drops.entries.find(d=>d.id==="shared_fixture").chanceByDifficulty[0]'),.2);
 assert.throws(()=>D.attach('map0_mob0','item:nonexistent'),/不存在/);assert.deepEqual(plain(r.run('validateData()')),[]);assert.doesNotThrow(()=>createGameValidator().validate(r.run('__EMBERWILD_RELEASE_EDITOR.current()')));
});
test('explicit item creation is atomic and uses canonical material/equipment/consumable/token definitions',()=>{
 const r=editor(),D=r.ctx.__EMBERWILD_MONSTER_DESIGNER;
 const specs=[{type:'material',id:'試驗原料',name:'試驗素材',sellPrice:7},{type:'equipment',id:'fixture_sword',name:'試驗劍',job:0,slot:0,weaponType:'sword',effects:[{key:'flatAttack',value:3}]},{type:'token',id:'fixture_token',name:'試驗信物',effects:[{key:'flatHp',value:8}]},{type:'healPotion',id:'fixture_potion',name:'試驗治療',healAmount:40,cooldown:3},{type:'timedBoost',id:'fixture_exp',name:'試驗增益',boostType:'exp',bonusPercent:20,durationMinutes:5},{type:'ward',id:'fixture_ward',name:'試驗抗性',element:'fire',effectPercent:20,durationMinutes:5}];
 for(const spec of specs){const row=D.create(spec);assert(row);D.attach('map0_mob0',row.id);}
 const before=r.run('JSON.stringify(data)');assert.throws(()=>D.create({...specs[3],id:'bad_heal',healAmount:0}),/固定 HP|恢復/);assert.throws(()=>D.create(specs[0]),/已存在/);assert.equal(r.run('JSON.stringify(data)'),before);
 assert.deepEqual(plain(r.run('validateData()')),[]);assert.doesNotThrow(()=>createGameValidator().validate(r.run('__EMBERWILD_RELEASE_EDITOR.current()')));
 const sword=r.ctx.__EMBERWILD_INVENTORY_ICON_EDITOR.entries().find(x=>x.name==='試驗劍');assert(sword.sourceDetails.some(x=>x.type==='monster'));
});
test('monster roles can change; kinds split shared sources, and multiple BOSS variants validate in fixed and random stages',()=>{
 const r=editor(),D=r.ctx.__EMBERWILD_MONSTER_DESIGNER;
 r.run('const base=data.balanceSettings.monsters.catalog.find(x=>x.id==="map0_boss");data.balanceSettings.monsters.catalog.push({...structuredClone(base),id:"variant_boss",name:"變體首領",spawnWeight:3});markDirty();');
 D.changeKind('map0_mob0','elite');assert.equal(r.run('data.balanceSettings.monsters.catalog[0].kind'),'elite');
 D.changeKind('variant_boss','normal');assert.equal(r.run('data.balanceSettings.monsters.catalog.find(x=>x.id==="variant_boss").kind'),'normal');D.changeKind('variant_boss','boss');
 D.move('variant_boss',1);assert.equal(r.run('data.balanceSettings.monsters.catalog.find(x=>x.id==="variant_boss").mapIndex'),1);D.move('variant_boss',0);
 const skillId=r.run('data.classes[0].skills.find(s=>s.effect==="damage").id'),beforePower=r.run('data.classes[0].skills.find(s=>s.id==='+JSON.stringify(skillId)+').power');D.assignSkill('variant_boss',skillId);assert.equal(r.run('data.classes[0].skills.find(s=>s.id==='+JSON.stringify(skillId)+').usageScope'),'shared');assert.equal(r.run('data.classes[0].skills.find(s=>s.id==='+JSON.stringify(skillId)+').power'),beforePower);assert.throws(()=>D.assignSkill('variant_boss',skillId),/重複/);
 assert.deepEqual(plain(r.run('validateData()')),[]);const validator=createGameValidator();assert.doesNotThrow(()=>validator.validate(r.run('__EMBERWILD_RELEASE_EDITOR.current()')));
 r.run('data.balanceSettings.maps.catalog[0].bossStageMode="random";data.balanceSettings.maps.catalog[0].bossStageRandomCount=1;markDirty();');
 const normalized=validator.canonicalize(r.run('__EMBERWILD_RELEASE_EDITOR.current()'));assert.equal(normalized.balanceSettings.maps.catalog[0].bossStageMode,'random');assert.equal(normalized.balanceSettings.maps.catalog[0].bossStageRandomCount,1);
 r.run('data.balanceSettings.maps.catalog[0].bossStageRandomCount=99;');assert(r.run('validateData()').some(x=>x.includes('BOSS 出場數')));assert.throws(()=>validator.validate(r.run('__EMBERWILD_RELEASE_EDITOR.current()')),/BOSS 出場數/);
});

