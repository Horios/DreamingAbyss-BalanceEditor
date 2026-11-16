'use strict';
// Issue #2 A03/A04/H01: the committed field-level matrix covers the game data under test, every module has a
// stated status, and every field whose edit does not survive the workbench, the validator or the game is
// acknowledged in docs/traceability-known.json with a reason. A new unexplained loss fails here.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const T=require('../scripts/traceability.cjs'),M=require('../scripts/balance-modules.cjs');
const root=path.resolve(__dirname,'..'),read=f=>JSON.parse(fs.readFileSync(path.join(root,f),'utf8'));
const matrix=read('docs/traceability-matrix.json'),known=read('docs/traceability-known.json');
const LOST=T.LOST;

test('the matrix has a row for every field pattern of the current game data, in the right module',()=>{
 const {rows}=T.skeleton(),have=new Map(matrix.rows.map(r=>[r.pattern,r]));
 const missing=rows.filter(r=>!have.has(r.pattern)).map(r=>r.pattern),moved=rows.filter(r=>have.has(r.pattern)&&have.get(r.pattern).module!==r.module).map(r=>r.pattern);
 const now=new Set(rows.map(r=>r.pattern)),stale=matrix.rows.filter(r=>!now.has(r.pattern)).map(r=>r.pattern);
 assert.deepEqual({missing,moved,stale},{missing:[],moved:[],stale:[]},'run node scripts/traceability.cjs and review the new rows');
});

test('all 36 modules are present and each has an explicit status for every row',()=>{
 const by=new Map();for(const r of matrix.rows){assert(Object.prototype.hasOwnProperty.call(T.STATUS,r.status),r.pattern+' has no known status: '+r.status);by.set(r.module,(by.get(r.module)||0)+1);}
 assert.deepEqual([...by.keys()].sort(),M.MODULES.map(m=>m.id).sort());assert.equal(M.MODULES.length,36);
 for(const r of matrix.rows.filter(x=>x.edit)){for(const k of ['editor','validator','game'])assert.match(r[k],/^(preserved|transformed|reverted|removed|rejected)$/,r.pattern+' '+k);}
});

test('every module that is not documentation has fields the whole chain keeps',()=>{
 for(const m of M.MODULES){
  const rows=matrix.rows.filter(r=>r.module===m.id);
  // Documentation modules and modules that are entirely projections of another module have no editable field.
  if(rows.every(r=>['read-only','derived','no-value'].includes(r.status))){assert(rows.some(r=>r.status!=='no-value'),m.id);continue;}
  assert(rows.some(r=>r.status==='effective'),m.id+' has no field that survives workbench, validator and game');
 }
});

test('an edit the chain loses is acknowledged with a reason; acknowledgements do not outlive the finding',()=>{
 const lost=matrix.rows.filter(r=>LOST.includes(r.status));
 const unexplained=lost.filter(r=>!(typeof known.fields[r.pattern]==='string'&&known.fields[r.pattern].length>=8)).map(r=>r.pattern+' ('+r.status+')');
 assert.deepEqual(unexplained,[],'add the reason to docs/traceability-known.json or fix the loss');
 const current=new Set(lost.map(r=>r.pattern));
 assert.deepEqual(Object.keys(known.fields).filter(p=>!current.has(p)),[],'remove acknowledgements for fields that are no longer lost');
});

test('derived and fixed fields name their reason, and derived fields their source',()=>{
 for(const r of matrix.rows.filter(x=>['derived','fixed-by-game'].includes(x.status))){assert(typeof r.note==='string'&&r.note.length>=8,r.pattern);if(r.status==='derived')assert(matrix.rows.some(x=>x.pattern.startsWith(r.source)),r.pattern+' source '+r.source);}
 const modules=id=>matrix.rows.filter(r=>r.module===id);
 assert(modules('characters/support-skills').every(r=>['derived','no-value'].includes(r.status)));assert(modules('characters/passives').every(r=>['derived','no-value'].includes(r.status)));
 // The stored classification is exactly what the rules give for the stored observations.
 const copy=JSON.parse(JSON.stringify(matrix.rows));T.classify(copy);assert.deepEqual(copy.map(r=>[r.pattern,r.status]),matrix.rows.map(r=>[r.pattern,r.status]));
});

test('probe edits are single-field and typed',()=>{
 assert.deepEqual(T.candidates(true),[false]);assert.deepEqual(T.candidates('a'),['a·測']);assert.deepEqual(T.candidates(null),[]);
 assert.deepEqual(T.candidates(3),[4,2,6,13]);assert.deepEqual(T.candidates(0),[1,-1,2,10]);assert.equal(T.candidates(0.5)[0],0.55);
 const rows=T.patterns({a:[{x:1},{x:2}],b:{c:'s',d:[]},e:null});
 assert.deepEqual(rows.map(r=>[r.pattern,r.type,r.count,r.instance.join('.')]),[['a.*.x','integer',2,'a.0.x'],['b.c','string',1,'b.c'],['b.d','empty-array',1,'b.d'],['e','null',1,'e']]);
});
