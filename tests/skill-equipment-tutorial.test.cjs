const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {loadRuntime}=require('./headless-editor.cjs');
const {ReleaseService}=require('../server/release-service.cjs');
test('existing story editor edits, validates and exports the gear lessons and job rewards',()=>{
 const r=loadRuntime(path.resolve(__dirname,'..'));r.run(`__EMBERWILD_STORY_EDITOR.select('skill_equipment_intro');__EMBERWILD_STORY_EDITOR.set('stages.2.name','自訂屬性鑲嵌');__EMBERWILD_STORY_EDITOR.set('recovery.limit',1);__EMBERWILD_STORY_EDITOR.set('rewards.items.0.key','job0-support0');`);assert.deepEqual(Array.from(r.run('validateData()')),[]);const out=JSON.parse(r.run('JSON.stringify(__EMBERWILD_MASTERY_EDITOR.cleanExport())')),q=out.story.quests.find(q=>q.id==='skill_equipment_intro');assert.equal(q.stages[2].name,'自訂屬性鑲嵌');assert.equal(q.recovery.limit,1);assert.equal(out.story.gearRewards[0].socketCount,2);assert.equal(q.rewards.items.length,4);assert.equal(Object.hasOwn(out.skillSystem.gems[0],'skill'),false);assert.deepEqual(out.skillSystem.gems[0].base.values,[2,4,6]);r.run("section='story';render()");assert.match(r.elements.get('app').innerHTML,/storyGearRewards/);assert.match(r.elements.get('app').innerHTML,/獎勵適用職業/);assert.deepEqual(r.errors,[]);
});
test('publishing lessons requires both first-socket and extended story capability markers',async()=>{
 let markers='skillSystemVersion:1';const service=new ReleaseService({validate:x=>x,api:async()=>({type:'file',encoding:'base64',content:Buffer.from('const api={'+markers+'}').toString('base64')})});const doc={skillSystem:{gemSlotRuleVersion:2},story:{gearRewards:[{}]}},target={commit:'a'.repeat(40),branch:'chatgpt-dev'};await assert.rejects(service.requireLifeRuntime(target,doc),/第一孔/);markers+=',equipmentGemModeVersion:2,storyEquipmentLessonsVersion:1';await service.requireLifeRuntime(target,doc);
});

test('attribute gem documents require the attribute runtime marker on both release branches',async()=>{
 let attributes=false;const service=new ReleaseService({validate:x=>x,api:async()=>({type:'file',encoding:'base64',content:Buffer.from('const api={skillSystemVersion:1,storyEquipmentLessonsVersion:1,equipmentGemModeVersion:2,'+(attributes?'attributeGemsVersion:1':'')+'}').toString('base64')})});
 const doc={story:{gearRewards:[{}]},skillSystem:{gems:[{kind:0,base:{stat:'atk',unit:'flat',values:[2,4,6]}}]}};
 for(const branch of ['main','chatgpt-dev'])await assert.rejects(service.requireLifeRuntime({commit:'a'.repeat(40),branch},doc),/屬性寶石/);
 attributes=true;for(const branch of ['main','chatgpt-dev'])await service.requireLifeRuntime({commit:'a'.repeat(40),branch},doc);
});
