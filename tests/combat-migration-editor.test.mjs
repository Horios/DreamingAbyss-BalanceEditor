import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{loadRuntime}=require('./headless-editor.cjs');
const json=(r,s)=>JSON.parse(r.run('JSON.stringify('+s+')'));
test('audit page reads the existing shared catalog, links to skills and does not edit its document',()=>{
 const r=loadRuntime(process.cwd()),before=r.run('JSON.stringify(data)');r.run('__EMBERWILD_COMBAT_MIGRATION_AUDIT.open()');
 assert(r.elements.get('app').innerHTML.includes('秒數／MP 戰鬥移植稽核'));assert(r.elements.get('app').innerHTML.includes('尚未切換'));
 const report=json(r,'__EMBERWILD_COMBAT_MIGRATION_AUDIT.scan()');assert(report.sharedSkills>100);assert(report.rows.length>100);
 assert.equal(r.run('JSON.stringify(data)'),before);assert.equal(r.run('typeof document.getElementById("combatMigrationSkills").onclick'),'function');assert.deepEqual(r.errors,[]);
});
test('new-format import is rejected before old unit normalization and current edits remain exact',()=>{
 const r=loadRuntime(process.cwd()),before=r.run('JSON.stringify(data)');
 r.run('globalThis.futureDoc=structuredClone(data);futureDoc.timeUnits.supportDuration="battleSeconds";futureDoc.supportSkills[0][0].duration=1.25;globalThis.futureBefore=JSON.stringify(futureDoc);');
 assert.throws(()=>r.run('__EMBERWILD_VALIDATE_DOCUMENT(futureDoc)'),/秒數／MP/);
 assert.equal(r.run('JSON.stringify(data)'),before);assert.equal(r.run('JSON.stringify(futureDoc)'),r.run('futureBefore'));
 r.run('normalizeTurnUnitsInPlace(futureDoc)');assert.equal(r.run('JSON.stringify(futureDoc)'),r.run('futureBefore'));
 assert.throws(()=>r.run('__EMBERWILD_RELEASE_EDITOR.load(futureDoc)'),/秒數／MP/);assert.equal(r.run('JSON.stringify(data)'),before);
});
test('MP changes cannot be silently exported through the legacy canonical editor',()=>{
 const r=loadRuntime(process.cwd()),before=r.run('JSON.stringify(data.skillSystem)');
 assert.throws(()=>r.run('__EMBERWILD_SKILL_SYSTEM_EDITOR.updateSkill("class1-initial0",{mpCost:7})'),/秒數／MP/);assert.equal(r.run('JSON.stringify(data.skillSystem)'),before);
 r.run('data.skillSystem.definitions[0].mpCost=7');assert.throws(()=>r.run('__EMBERWILD_MASTERY_EDITOR.cleanExport()'),/秒數／MP/);
});
