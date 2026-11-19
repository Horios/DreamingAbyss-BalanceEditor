'use strict';
// Companion skill pages edit the projected class row; the edit must be written back to the canonical skill definition
// (skill-row-sync + writeRow in the canonical skill system block), or the next render discards it.
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {loadRuntime}=require('./headless-editor.cjs'),root=path.resolve(__dirname,'..');
test('an edit on a companion skill page survives markDirty, render and export',()=>{
 const e=loadRuntime(root);
 const out=JSON.parse(e.run(`(()=>{openCompanionSkillPage(data.companions[0].id,'active');const job=selected.skillClass,idx=selected.skill,sk=data.classes[job].skills[idx],id=data.statusDefinitions[0].id;
  sk.onHitStatusId=id;sk.onHitStatusChance=0.25;markDirty('row sync test');render();currentSection='statuses';render();
  const row=data.classes[job].skills[idx],def=data.skillSystem.definitions.find(d=>d.id===row.id);
  return JSON.stringify({id,row:row.onHitStatusId,chance:row.onHitStatusChance,def:def?.onHitStatusId,api:typeof globalThis.__EMBERWILD_SKILL_ROW_SYNC?.writeRow});})()`));
 assert.equal(out.api,'function','the canonical block exposes writeRow');
 assert.equal(out.row,out.id);assert.equal(out.chance,0.25);assert.equal(out.def,out.id,'written back to the canonical definition');
 assert.deepEqual(e.errors,[]);
});
