import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
import {createGameValidator} from '../server/online/game-validator.mjs';
const require=createRequire(import.meta.url),{loadRuntime}=require('./headless-editor.cjs');
const json=(r,s)=>JSON.parse(r.run('JSON.stringify('+s+')'));
test('canonical editor edits skills and every configuration section and exports to the actual game validator',()=>{
 const r=loadRuntime(process.cwd());r.run('__EMBERWILD_SKILL_SYSTEM_EDITOR.updateSkill("class1-initial0",{description:"新版魔爆說明",power:2.1});__EMBERWILD_SKILL_SYSTEM_EDITOR.select("skills","class1-initial0")');
 assert(r.elements.get('app').innerHTML.includes('新版魔爆說明'));const d=json(r,'__EMBERWILD_MASTERY_EDITOR.cleanExport()');assert.equal(d.classes[1].skills.find(x=>x.id==='class1-initial0').description,'新版魔爆說明');assert.equal(createGameValidator().validate(d).skillSystem.definitions.find(x=>x.id==='class1-initial0').power,2.1);
 for(const part of ['classRules','equipment','gems']){r.run(`__EMBERWILD_SKILL_SYSTEM_EDITOR.select('${part}')`);assert(r.elements.get('app').innerHTML.includes('canonicalPartJSON'));}
 assert.deepEqual(json(r,'validateData()'),[]);assert.deepEqual(r.errors,[]);
});
test('new skills have stable IDs and invalid edits or deletion of referenced skills are rejected atomically',()=>{
 const r=loadRuntime(process.cwd());const id=r.run('__EMBERWILD_SKILL_SYSTEM_EDITOR.addSkill(1,"active")');assert(id.startsWith('custom-skill-'));assert.throws(()=>r.run('__EMBERWILD_SKILL_SYSTEM_EDITOR.deleteSkill("class1-initial0")'),/仍被引用/);const before=r.run('JSON.stringify(data.skillSystem)');assert.throws(()=>r.run('__EMBERWILD_SKILL_SYSTEM_EDITOR.applyPart("gems",[])'));assert.equal(r.run('JSON.stringify(data.skillSystem)'),before);assert.equal(r.run(`__EMBERWILD_SKILL_SYSTEM_EDITOR.deleteSkill('${id}')`),true);assert.deepEqual(json(r,'validateData()'),[]);
});
