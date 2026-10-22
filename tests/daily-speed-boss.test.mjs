import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{loadRuntime}=require('./headless-editor.cjs');
test('daily design exports five-choice objective types, random materials, two-hour ticket and effective boss level bonus',()=>{
 const r=loadRuntime(process.cwd()),d=JSON.parse(r.run('JSON.stringify(__EMBERWILD_MASTERY_EDITOR.cleanExport())'));
 assert.equal(d.balanceSettings.quests.design.daily.version,2);assert(d.balanceSettings.quests.design.daily.entries.some(q=>q.objectives[0].type==='nearKill'));assert(d.balanceSettings.quests.design.daily.entries.some(q=>q.objectives[0].type==='salvage'));assert(d.balanceSettings.quests.design.daily.entries.some(q=>q.objectives[0].type==='enhance'));assert.equal(d.items.find(i=>i.id==='speed2_120m').durationMinutes,120);assert.equal(d.items.some(i=>i.boostType==='speed4'),false);assert.equal(d.balanceSettings.equipment.boss.baseLevelBonus,7);
 r.run("currentSection='dailyQuests';render()");assert.match(r.elements.get('app').innerHTML,/五項|五選四/);assert.match(r.elements.get('app').innerHTML,/data-daily-material/);assert.deepEqual(JSON.parse(r.run('JSON.stringify(validateData())')),[]);assert.deepEqual(r.errors,[]);
});
