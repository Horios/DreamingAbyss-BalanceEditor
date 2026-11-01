import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {createGameValidator} from '../server/online/game-validator.mjs';
const require=createRequire(import.meta.url),{loadRuntime}=require('./headless-editor.cjs');
const source=JSON.parse(fs.readFileSync('../Emberwild/data/balance.json','utf8'));
const read=(r,code)=>JSON.parse(r.run('JSON.stringify('+code+')'));
function boot(){const r=loadRuntime(process.cwd());r.ctx.source=structuredClone(source);r.run('__EMBERWILD_RELEASE_EDITOR.load(source)');return r;}
test('published clearing skills load, compare without differences and retain event settings through export/reload',()=>{
 const r=boot();assert.deepEqual(read(r,'__EMBERWILD_RELEASE_EDITOR.current()'),source);
 for(const id of ['warrior-cleave-chain','mage-mana-cycle','archer-arrow-rain','priest-holy-prison'])assert(r.run(`data.skillSystem.definitions.some(s=>s.id===${JSON.stringify(id)})`));
 r.run('__EMBERWILD_STATUS_EDITOR_TEST_API.select("holy-prison-mark")');assert(r.elements.get('app').innerHTML.includes('受術者死亡'));assert(r.elements.get('app').innerHTML.includes('eventPermanent'));
 r.run(`globalThis.triggers=structuredClone(data.statusDefinitions.find(s=>s.id==='holy-prison-mark').triggers);triggers[1].power=.45;__EMBERWILD_EVENT_STATUS_EDITOR.update('holy-prison-mark',{triggers});`);
 const out=read(r,'__EMBERWILD_RELEASE_EDITOR.current()'),v=createGameValidator().validate(out);
 assert.equal(v.statusDefinitions.find(s=>s.id==='holy-prison-mark').triggers[1].power,.45);
 assert.deepEqual(read(r,'validateData()'),[]);assert.deepEqual(r.errors,[]);
});
test('individual death and turn-end mechanisms copy into independent status definitions and remain editable',()=>{
 const r=boot();r.run(`globalThis.targetId=__EMBERWILD_SKILL_SYSTEM_EDITOR.addSkill(3,'active');__EMBERWILD_SKILL_SYSTEM_EDITOR.transfer('priest-holy-prison',['statusEvent:holy-prison-mark:targetDeath'],targetId,{replace:true});`);
 const sk=read(r,'data.skillSystem.definitions.find(s=>s.id===targetId)'),state=read(r,`data.statusDefinitions.find(s=>s.id===${JSON.stringify(sk.statusId)})`);
 assert.notEqual(sk.statusId,'holy-prison-mark');assert.deepEqual(state.triggers.map(t=>t.event),['targetDeath']);
 r.run(`globalThis.mechanism=EmberwildMechanisms.instances(data.skillSystem.definitions.find(s=>s.id===targetId),data).find(s=>s.slot==='statusEvent');mechanism.parameters.trigger.power=.7;__EMBERWILD_SKILL_SYSTEM_EDITOR.editMechanism(targetId,mechanism.key,mechanism.parameters);`);
 assert.equal(r.run(`data.statusDefinitions.find(s=>s.id==='holy-prison-mark').triggers[1].power`),.3);
 r.run(`__EMBERWILD_SKILL_SYSTEM_EDITOR.updateSkill(targetId,{statusId:'holy-prison-mark'});__EMBERWILD_SKILL_SYSTEM_EDITOR.transfer('priest-holy-prison',['statusEvent:holy-prison-mark:targetTurnEnd'],targetId,{replace:true});`);
 assert.notEqual(r.run('data.skillSystem.definitions.find(s=>s.id===targetId).statusId'),'holy-prison-mark');
 assert.equal(r.run(`data.statusDefinitions.find(s=>s.id==='holy-prison-mark').triggers.length`),2);
 createGameValidator().validate(read(r,'__EMBERWILD_MASTERY_EDITOR.cleanExport()'));assert.deepEqual(r.errors,[]);
});
test('passive events copy with their parameters and invalid trigger edits fail without modifying the document',()=>{
 const r=boot();r.run(`globalThis.passiveId=__EMBERWILD_SKILL_SYSTEM_EDITOR.addSkill(1,'passive');__EMBERWILD_SKILL_SYSTEM_EDITOR.transfer('mage-mana-cycle',['eventPassive'],passiveId,{});`);
 assert.equal(r.run('data.skillSystem.definitions.find(s=>s.id===passiveId).eventPassive.cooldown'),2);
 const before=r.run('JSON.stringify(data)');assert.throws(()=>r.run(`__EMBERWILD_EVENT_STATUS_EDITOR.update('holy-prison-mark',{triggers:[{event:'unknown'}]})`));assert.equal(r.run('JSON.stringify(data)'),before);
 createGameValidator().validate(read(r,'__EMBERWILD_MASTERY_EDITOR.cleanExport()'));
});
