'use strict';
// Issue #2 B04/B05: one value changed through two entry points of the workbench gives the same exported document.
// "In place" is what a form or dialog does (it edits the working document); "import" is what raw JSON, a loaded
// version or a restored draft does (the whole document passes the import normalization). Exporting again adds
// nothing, and against the unedited export exactly the edited field differs.
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {loadRuntime}=require('./headless-editor.cjs'),M=require('../scripts/balance-modules.cjs');
const root=path.resolve(__dirname,'..'),game=path.resolve(process.env.EMBERWILD_GAME_ROOT||path.join(root,'../DreamingAbyss'));
const seed=JSON.parse(fs.readFileSync(path.join(game,'data/balance.json'),'utf8')),clone=x=>JSON.parse(JSON.stringify(x));
const derived=new Set(JSON.parse(fs.readFileSync(path.join(root,'docs/traceability-matrix.json'),'utf8')).rows.filter(r=>r.status==='derived').map(r=>r.pattern));
const FIELDS=[
 ['balanceSettings.monsters.catalog.0.hpMultiplier',v=>(v||1)+0.25],
 ['items.0.cost',v=>v+7],
 ['classes.0.initialStats.hp',v=>v+3],
 ['balanceSettings.difficulty.modes.1.attack',v=>+(v+0.05).toFixed(2)],
 ['shopSettings.randomOffers.refreshBaseCost',v=>v+10],
 ['balanceSettings.drops.entries.0.quantityMax',v=>v+2],
 ['crafting.etherIron.dust',v=>v+1],
 ['uiText.gameTitle',v=>v+'·入口測試'],
 ['balanceSettings.maps.catalog.0.name',v=>v+'·入口測試'],
 ['wishingLake.dailyLimit',v=>v+1]
];
test('editing in place and importing the edited document export the same text; a second export changes nothing',()=>{
 const r=loadRuntime(root),open=doc=>{r.ctx.input=clone(doc);r.run('data=__EMBERWILD_VALIDATE_DOCUMENT(input);ensureArrays()');},
  // meta/reference and meta/notes are documentation the export regenerates (read-only in the traceability matrix).
  current=()=>{const d=clone(r.run('__EMBERWILD_RELEASE_EDITOR.current()'));delete d._reference;delete d.notes;return d;};
 open(seed);const base=current();
 for(const [field,next] of FIELDS){
  const p=field.split('.'),value=next(M.get(base,p));
  // In place: the working document is edited the way a control writes it.
  open(seed);r.ctx.__path=p;r.ctx.__value=value;r.run('{let x=data;for(const k of __path.slice(0,-1))x=x[k];x[__path.at(-1)]=__value;markDirty("entry-points");}');
  const inPlace=current();
  // Import: the same value arrives inside a complete document.
  const edited=clone(base);let x=edited;for(const k of p.slice(0,-1))x=x[k];x[p.at(-1)]=value;open(edited);
  const imported=current();
  assert.equal(M.serialize(imported),M.serialize(inPlace),field+': both entry points export the same document');
  assert.deepEqual(M.get(inPlace,p),value,field+' holds the edited value');
  // Fields the matrix marks as derived follow their source (classes.*.hp mirrors initialStats.hp) and are expected.
  assert.deepEqual(M.changes(base,inPlace).filter(c=>!derived.has(c.map(k=>/^\d+$/.test(k)?'*':k).join('.'))).map(c=>c.join('.')),[field],field+': nothing else differs from the unedited export');
  open(inPlace);assert.equal(M.serialize(current()),M.serialize(inPlace),field+': exporting again is a fixed point');
 }
});

