import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createGameValidator} from '../server/online/game-validator.mjs';
const require=createRequire(import.meta.url),{loadRuntime}=require('./headless-editor.cjs');
// Match the unprojected repository JSON: optional defaults absent, five legacy
// starter entries, and canonical equipment skills not yet expanded into classes.
function fixture(){
 const d=structuredClone(createGameValidator().defaults);
 delete d.timeUnits.consumableClock;delete d.starterPackItems;
 for(const [job,c] of d.classes.entries()){
  c.skills=c.skills.filter(s=>!s.id.startsWith('tutorial_echo-job'));
  const weapon=d.starterPacks[job][0];delete weapon.baseAttack;
  d.starterPacks[job]=[weapon,...[1,2,3,3].map(slot=>({...structuredClone(weapon),slot}))];
 }
 d.notes=['Original repository notes'];d.futureSetting={enabled:true,values:[3,7]};
 return d;
}
function boot(doc=fixture(),saved={}){
 const r=loadRuntime(process.cwd(),'balance-editor.html',saved);r.ctx.doc=doc;
 r.ctx.location.protocol='https:';
 r.ctx.fetch=async(url,o={})=>({ok:true,json:async()=>url==='/api/session'?{csrf:'test',capabilities:{publishing:false}}:{branch:JSON.parse(o.body).branch,commit:'a'.repeat(40),data:structuredClone(doc)}});
 return r;
}
const current=r=>JSON.parse(r.run('JSON.stringify(__EMBERWILD_RELEASE_EDITOR.current())'));
async function click(r,id){return r.ctx.document.getElementById(id).onclick();}
test('load then compare is exactly unchanged; stale comparison is cleared and source is not mutated',async()=>{
 const doc=fixture(),before=structuredClone(doc),r=boot(doc),E=r.ctx.__EMBERWILD_RELEASE_EDITOR;
 E.state.snapshots['chatgpt-dev']={branch:'chatgpt-dev',commit:'a'.repeat(40),data:doc};
 E.state.comparison={total:42,rows:[]};E.state.prepared={ticket:'stale'};
 r.run('currentSection="releases";render()');await click(r,'releaseLoad');
 assert.equal(E.state.comparison,null);assert.equal(E.state.prepared,null);
 assert.deepEqual(current(r),doc);assert.deepEqual(doc,before);
 await click(r,'releaseCompare');assert.equal(E.state.comparison.total,0);assert.deepEqual(r.errors,[]);
});
test('real item and canonical skill edits survive export and reload; other source data stays exact',()=>{
 const doc=fixture(),r=boot(doc);r.run('__EMBERWILD_RELEASE_EDITOR.load(doc)');
 r.run('data.items[0].cost+=37;const sk=data.skillSystem.definitions.find(s=>s.type==="active");__EMBERWILD_SKILL_SYSTEM_EDITOR.updateSkill(sk.id,{power:sk.power+.25});');
 const out=current(r);assert.equal(out.items[0].cost,doc.items[0].cost+37);
 assert.deepEqual(out.starterPacks,doc.starterPacks);assert.deepEqual(out.futureSetting,doc.futureSetting);
 assert.deepEqual(out.notes,doc.notes);assert.equal(out.timeUnits.consumableClock,undefined);
 const id=r.run('data.skillSystem.definitions.find(s=>s.type==="active").id');
 assert.equal(out.skillSystem.definitions.find(s=>s.id===id).power,doc.skillSystem.definitions.find(s=>s.id===id).power+.25);
 r.run('document.getElementById("cacheBtn").onclick()');const re=boot(doc,Object.fromEntries(r.values));
 assert.deepEqual(current(re),out);assert.deepEqual(re.errors,[]);
});
test('first online load and a saved unchanged source remain exact across reload',async()=>{
 const doc=fixture(),r=boot(doc);await r.run('__EMBERWILD_ONLINE_BOOT()');assert.deepEqual(current(r),doc);
 const re=boot(doc,Object.fromEntries(r.values));await re.run('__EMBERWILD_ONLINE_BOOT()');assert.deepEqual(current(re),doc);
});
test('latest remote changes still compare, cancelled load preserves edits, and another load replaces the source',async()=>{
 const doc=fixture(),r=boot(doc),E=r.ctx.__EMBERWILD_RELEASE_EDITOR;r.run('__EMBERWILD_RELEASE_EDITOR.load(doc)');
 r.run('data.items[0].cost+=5');const edited=current(r);r.ctx.confirm=()=>false;r.run('__EMBERWILD_RELEASE_EDITOR.load(doc)');assert.deepEqual(current(r),edited);
 r.ctx.confirm=()=>true;const newer=structuredClone(doc);newer.items[0].cost+=13;r.ctx.newer=newer;r.run('__EMBERWILD_RELEASE_EDITOR.load(newer)');assert.deepEqual(current(r),newer);
 r.run('currentSection="releases";render()');await click(r,'releaseCompare');assert(E.state.comparison.rows.some(x=>x.path.endsWith('.cost')));
 r.ctx.fetch=async()=>{throw Error('offline');};await click(r,'releaseCompare');assert.equal(E.state.feedbackKind,'error');assert.deepEqual(current(r),newer);
});
test('array insertions, removals and reordering are real edits rather than hidden defaults',()=>{
 const doc=fixture();doc.statusDefinitions.push({...structuredClone(doc.statusDefinitions[0]),id:'unused-roundtrip-status'});const r=boot(doc);r.run('__EMBERWILD_RELEASE_EDITOR.load(doc);data.statusDefinitions.reverse();data.statusDefinitions.splice(0,1);data.starterPacks[0][0].plus=2;');
 const out=current(r);assert.deepEqual(out.statusDefinitions,[...doc.statusDefinitions].reverse().filter((_,i)=>i!==0));
 assert.equal(out.starterPacks[0][0].plus,2);assert.deepEqual(out.starterPacks[0].slice(1),doc.starterPacks[0].slice(1));
 r.run('__EMBERWILD_SKILL_SYSTEM_EDITOR.addSkill(1,"active")');assert.equal(current(r).skillSystem.definitions.length,doc.skillSystem.definitions.length+1);
});
