const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {loadRuntime}=require('./headless-editor.cjs');
const root=path.resolve(__dirname,'..');
test('permanence and finite duration round-trip together; invalid edits do not mutate the document',()=>{
 const r=loadRuntime(root);r.run(`__EMBERWILD_EVENT_STATUS_EDITOR.update('holy-prison-mark',{permanent:false})`);
 assert.equal(r.run(`data.statusDefinitions.find(s=>s.id==='holy-prison-mark').timing.durationSeconds`),594);
 r.run(`__EMBERWILD_EVENT_STATUS_EDITOR.update('holy-prison-mark',{timing:{durationSeconds:4.125}})`);
 assert.equal(r.run(`__EMBERWILD_RELEASE_EDITOR.current().statusDefinitions.find(s=>s.id==='holy-prison-mark').timing.durationSeconds`),4.125);
 r.run(`__EMBERWILD_EVENT_STATUS_EDITOR.update('holy-prison-mark',{permanent:true})`);
 assert.equal(r.run(`__EMBERWILD_RELEASE_EDITOR.current().statusDefinitions.find(s=>s.id==='holy-prison-mark').timing.durationSeconds`),null);
 const before=r.run('JSON.stringify(data)');assert.throws(()=>r.run(`__EMBERWILD_EVENT_STATUS_EDITOR.update('holy-prison-mark',{timing:{durationSeconds:-1}})`),/秒數/);assert.equal(r.run('JSON.stringify(data)'),before);
 r.run(`__EMBERWILD_COMBAT_MIGRATION_AUDIT.open();__EMBERWILD_COMBAT_MIGRATION_AUDIT.select('statuses','pain-spread');__EMBERWILD_COMBAT_MIGRATION_AUDIT.update('pain-spread',{durationSeconds:null})`);
 assert.equal(r.run(`__EMBERWILD_RELEASE_EDITOR.current().statusDefinitions.find(s=>s.id==='pain-spread').permanent`),true);
 assert.deepEqual(r.errors,[]);
});
test('legacy skill edits fail explicitly; canonical seconds and event seconds remain editable',()=>{
 const r=loadRuntime(root),before=r.run('JSON.stringify(data)');
 assert.throws(()=>r.run(`__EMBERWILD_SKILL_SYSTEM_EDITOR.updateSkill('class1-initial0',{cooldown:99})`),/唯讀相容/);assert.equal(r.run('JSON.stringify(data)'),before);
 r.run(`__EMBERWILD_COMBAT_MIGRATION_AUDIT.open();__EMBERWILD_COMBAT_MIGRATION_AUDIT.select('skills','class1-initial0');__EMBERWILD_COMBAT_MIGRATION_AUDIT.update('class1-initial0',{cooldownSeconds:4.125})`);
 assert.equal(r.run(`__EMBERWILD_RELEASE_EDITOR.current().skillSystem.definitions.find(s=>s.id==='class1-initial0').timing.cooldownSeconds`),4.125);
 r.run(`__EMBERWILD_COMBAT_MIGRATION_AUDIT.select('passiveEvents','event:mage-mana-cycle');__EMBERWILD_COMBAT_MIGRATION_AUDIT.update('event:mage-mana-cycle',{reductionSeconds:6,cooldownSeconds:9})`);
 assert.equal(r.run(`data.skillSystem.definitions.find(s=>s.id==='mage-mana-cycle').eventPassive.reduction`),2);assert.equal(r.run(`data.skillSystem.definitions.find(s=>s.id==='mage-mana-cycle').eventPassive.cooldown`),3);
 const changed=r.run('JSON.stringify(data)');assert.throws(()=>r.run(`__EMBERWILD_COMBAT_MIGRATION_AUDIT.update('event:mage-mana-cycle',{reductionSeconds:1.25})`),/步進/);assert.equal(r.run('JSON.stringify(data)'),changed);
 assert.deepEqual(r.errors,[]);
});
test('equipment seconds preserve point semantics and unused token timers are hidden',()=>{
 const r=loadRuntime(root),before=r.run('JSON.stringify(data)');r.run('EmberwildSecondsAuthoring.equipmentRows()');assert.equal(r.run('JSON.stringify(data)'),before);
 r.run(`__EMBERWILD_COMBAT_MIGRATION_AUDIT.open();__EMBERWILD_COMBAT_MIGRATION_AUDIT.select('equipmentCooldowns','affix:all:rare:1');__EMBERWILD_COMBAT_MIGRATION_AUDIT.update('affix:all:rare:1',{reductionSeconds:6})`);
 assert.equal(r.run('data.balance.affixes.extendedValues.allCooldownReduction.rare'),2);
 r.run(`__EMBERWILD_COMBAT_MIGRATION_AUDIT.select('tokens','revival')`);assert(!r.elements.get('app').innerHTML.includes('data-seconds-field="firstTriggerSeconds"'));
 r.run(`__EMBERWILD_COMBAT_MIGRATION_AUDIT.select('tokens','endurance')`);assert(r.elements.get('app').innerHTML.includes('data-seconds-field="firstTriggerSeconds"'));
 assert.deepEqual(r.errors,[]);
});

test('contradictory permanence is rejected before export and publication validation',()=>{
 const r=loadRuntime(root);r.run("data.statusDefinitions.find(s=>s.id==='holy-prison-mark').permanent=false");
 assert.throws(()=>r.run('__EMBERWILD_RELEASE_EDITOR.current()'),/永久標記/);
 assert.throws(()=>r.run('EmberwildCombatMigration.assertSupported(data)'),/永久標記/);
});
