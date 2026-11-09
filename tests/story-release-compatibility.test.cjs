const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {ReleaseService}=require('../server/release-service.cjs');
test('story publication requires target runtime and compiled validator preserves editable story',async()=>{
 const head='a'.repeat(40),source='b'.repeat(40);let supported=false;
 const data=JSON.parse(fs.readFileSync('../DreamingAbyss/data/balance.json','utf8'));
 const {createGameValidator}=await import('../server/online/game-validator.mjs');
 assert.deepEqual(createGameValidator().validate(data).story,data.story);
 const candidate={story:data.story};
 const s=new ReleaseService({validate:x=>x,api:async p=>{
  if(p.includes('/git/ref/heads/'))return {object:{sha:p.endsWith('main')?head:source}};
  if(p.includes('/compare/'))return {status:'ahead'};
  if(p.includes('/contents/js/'))return {type:'file',encoding:'base64',content:Buffer.from(supported?'const api={storyVersion:1,questEncountersVersion:1,equipmentGemModeVersion:2,storyEquipmentLessonsVersion:1};':'const api={version:1};').toString('base64')};
  return {type:'file',encoding:'base64',sha:head,content:Buffer.from(JSON.stringify(p.endsWith('ref='+head)?{}:candidate)).toString('base64')};
 }});
 const args={kind:'promote',sourceCommit:source,expectedCommit:head,message:'發布任務設定'};
 await assert.rejects(s.prepare(args,'s'),/尚未支援第一孔/);assert.equal(s.tickets.size,0);
 supported=true;assert.equal((await s.prepare(args,'s')).branch,'main');
});
