const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {loadRuntime}=require('./headless-editor.cjs'),{importForAudit,differences}=require('../scripts/audit-v2.cjs');
test('audit uses the actual source-preserving import flow for the repository document and future fields',()=>{
 const root=path.resolve(__dirname,'..'),doc=JSON.parse(fs.readFileSync(path.join(root,'../Emberwild/data/balance.json')));
 doc.futureAuditSetting={enabled:true,nested:[{value:7}]};doc.notes=['Source notes must remain exact'];
 const before=structuredClone(doc),r=loadRuntime(root),out=importForAudit(r,doc);
 assert.deepEqual(differences(before,out),[]);
 assert.deepEqual(doc,before,'input is never mutated');
 r.run('data.items[0].cost+=1');
 const edited=JSON.parse(JSON.stringify(r.run('__EMBERWILD_RELEASE_EDITOR.current()')));
 assert.equal(edited.items[0].cost,before.items[0].cost+1);
 assert.deepEqual(edited.futureAuditSetting,before.futureAuditSetting);
 assert.deepEqual(edited.starterPacks,before.starterPacks);
 assert.deepEqual(r.errors,[]);
});
