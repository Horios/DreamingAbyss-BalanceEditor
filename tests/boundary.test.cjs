'use strict';
// Issue #2 B02: the committed boundary report covers every numeric field the chain keeps, and its two risky
// outcomes are explained: a wrong type that every program keeps, and a value that changes without an error.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const B=require('../scripts/boundary-probe.cjs');
const root=path.resolve(__dirname,'..'),read=f=>JSON.parse(fs.readFileSync(path.join(root,f),'utf8'));
const boundary=read('docs/boundary-matrix.json'),matrix=read('docs/traceability-matrix.json'),known=read('docs/boundary-known.json');
const cases=pick=>{const out=[];for(const f of boundary.fields)for(const [kind,c] of Object.entries(f.cases))if(pick(kind,c))out.push({pattern:f.pattern,kind,c});return out;};
const explained=(rules,pattern)=>rules.some(r=>new RegExp(r.match).test(pattern)&&typeof r.note==='string'&&r.note.length>=8);

test('the report was made from the data of the traceability matrix and covers every effective numeric field',()=>{
 assert.equal(boundary.game.dataSha256,matrix.game.dataSha256);
 const expected=matrix.rows.filter(r=>r.status==='effective'&&['integer','number'].includes(r.type)).map(r=>r.pattern).sort();
 assert.deepEqual(boundary.fields.map(f=>f.pattern).sort(),expected);
 for(const f of boundary.fields){for(const kind of ['zero','negative','huge','string','null'])if(!(kind==='zero'&&f.from===0)&&!(kind==='negative'&&f.from===-1))assert(f.cases[kind],f.pattern+' '+kind);
  for(const c of Object.values(f.cases)){assert.match(c.verdict,/^(accepted|rejected|blocked|editor-stricter|changed)$/);assert.equal(c.verdict,B.verdict(c),f.pattern+': stored verdict follows the stored observations');}}
});

test('text or null that every program keeps is known and stopped by the release service',()=>{
 const leaks=cases((k,c)=>['string','null'].includes(k)&&c.verdict==='accepted');
 assert.deepEqual(leaks.filter(x=>!explained(known.typeLeaks,x.pattern)).map(x=>x.pattern+' '+x.kind),[],'explain it in docs/boundary-known.json and cover it in tests/release-audit.test.cjs');
 for(const rule of known.typeLeaks)assert(leaks.some(x=>new RegExp(rule.match).test(x.pattern)),'stale rule '+rule.match);
});

test('a value that changes without an error has a stated reason',()=>{
 const changed=cases((k,c)=>c.verdict==='changed');
 assert.deepEqual(changed.filter(x=>!explained(known.changed,x.pattern)).map(x=>x.pattern+' '+x.kind),[],'add the reason to docs/boundary-known.json');
 for(const rule of known.changed)assert(changed.some(x=>new RegExp(rule.match).test(x.pattern)),'stale rule '+rule.match);
});

test('verdicts',()=>{
 const v=B.verdict;
 assert.equal(v({rules:'rejected'}),'rejected');assert.equal(v({rules:'accepted',editor:'preserved',validator:'preserved'}),'accepted');
 assert.equal(v({rules:'accepted',editor:'preserved',validator:'rejected'}),'blocked');assert.equal(v({rules:'accepted',editor:'changed',validator:'rejected'}),'rejected');
 assert.equal(v({rules:'accepted',editor:'rejected',validator:'rejected'}),'rejected');assert.equal(v({rules:'accepted',editor:'changed',validator:'preserved'}),'editor-stricter');
 assert.equal(v({rules:'accepted',editor:'preserved',validator:'changed'}),'changed');assert.equal(v({rules:'accepted',editor:'preserved',validator:'preserved',game:'rejected'}),'blocked');
});
