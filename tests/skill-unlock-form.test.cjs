// The skill database tab edits achievement unlock conditions on the selected skill-system definition.
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {loadRuntime}=require('./headless-editor.cjs'),root=path.resolve(__dirname,'..');
test('the unlock form appears for the selected definition and its edits go through the skill system editor',()=>{
 const e=loadRuntime(root),json=c=>JSON.parse(e.run('JSON.stringify('+c+')'));
 e.run('currentSection="skills";render();__EMBERWILD_SKILL_SYSTEM_EDITOR.select("skills","job0-core1");render()');
 const html=e.elements.get('app').innerHTML;
 for(const id of ['skillUnlockForm','skillAddBossKill','skillAddEliteKill','skillAddBossEquipment'])assert(html.includes('id="'+id+'"'),id);
 e.run('__EMBERWILD_SKILL_SYSTEM_EDITOR.updateSkill("job0-core1",{unlockConditions:{classMasteryLevel:0,quests:[],materials:[],bossKills:[{mapIndex:0,count:2}],eliteKills:[],bossEquipment:[{mapIndex:1,quantity:1}]}});render()');
 assert.deepEqual(json('data.skillSystem.definitions.find(s=>s.id==="job0-core1").unlockConditions.bossKills'),[{mapIndex:0,count:2}]);
 assert.match(e.elements.get('app').innerHTML,/data-unlock-row="bossKills"[^]*data-unlock-row="bossEquipment"/,'saved rows are listed');
 assert.deepEqual(json('validateData()'),[]);
 e.run('currentSection="classes";render()');assert(!e.elements.get('app').innerHTML.includes('skillUnlockForm'),'only on the skill database');
 assert.deepEqual(e.errors,[]);
});
