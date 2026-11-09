import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs';
const require=createRequire(import.meta.url),{loadRuntime}=require('./headless-editor.cjs');
const doc=JSON.parse(fs.readFileSync('../DreamingAbyss/data/balance.json'));
function editor(saved={}){const r=loadRuntime(process.cwd(),'balance-editor.html',saved);r.ctx.doc=doc;r.run('data=__EMBERWILD_VALIDATE_DOCUMENT(doc);ensureArrays();');return r;}
function click(r,id){return r.ctx.document.getElementById(id).onclick?.({target:r.ctx.document.getElementById(id)});}
test('all original and canonical pages remain reachable; common controls do not change the exported balance',()=>{
 const r=editor(),before=r.run('JSON.stringify(__EMBERWILD_RELEASE_EDITOR.current())'),meta=r.run('SECTION_META');assert(meta.length>=45);assert.equal(new Set(meta.map(([id])=>id)).size,meta.length);
 // These two editors bind static ID selectors via app.querySelector. Supply those IDs in the minimal DOM.
 const app=r.elements.get('app');app.querySelector=s=>/^#[\w-]+$/.test(s)?r.ctx.document.getElementById(s.slice(1)):s.startsWith('[data-key=')?r.ctx.document.getElementById(s):null;
 for(const [id] of meta){r.run('currentSection='+JSON.stringify(id)+';render();');assert.match(app.innerHTML,/workbenchBack/);assert.match(app.innerHTML,/workbenchPublish/);assert(app.innerHTML.length>500,id);}
 assert.equal(r.run('JSON.stringify(__EMBERWILD_RELEASE_EDITOR.current())'),before);assert.deepEqual(r.errors,[]);
});
test('search locates pages, a specific item and skill; back restores the original class selection',()=>{
 const r=editor(),X=r.ctx.__EMBERWILD_EXPERIENCE;assert(X.search('發布').some(x=>x.section==='releases'));const item=X.search('紅色草').find(x=>x.id==='material:紅色草');assert(item);
 r.run('currentSection="classes";selected.class=2;render();');X.go(item);assert.equal(r.run('currentSection'),'inventoryIcons');assert.equal(r.ctx.__EMBERWILD_INVENTORY_ICON_EDITOR.state.selectedId,'material:紅色草');X.back();assert.equal(r.run('currentSection'),'classes');assert.equal(r.run('selected.class'),2);
 const skillName=r.run('data.classes[1].skills[1].name');const skill=X.search(skillName).find(x=>x.selection?.skillClass===1);assert(skill);X.go(skill);assert.equal(r.run('selected.skillClass'),1);assert.equal(r.run('selected.skill'),1);assert.equal(r.run('currentSection'),'skillSystem');
});
test('invalid raw text survives navigation and reload, does not change data, and blocks publishing/export',async()=>{
 const r=editor(),X=r.ctx.__EMBERWILD_EXPERIENCE;r.run('currentSection="raw";render()');const before=r.run('JSON.stringify(data)'),ta=r.ctx.document.getElementById('rawEditor');ta.value='{ invalid draft';ta.oninput();assert(X.rawPending());r.run('currentSection="classes";render()');assert.equal(r.run('JSON.stringify(data)'),before);assert.equal(X.guardRaw(),false);
 await assert.rejects(r.ctx.__EMBERWILD_RELEASE_EDITOR.api('prepare',{message:'測試文字草稿'}),/尚未套用/);
 const reload=editor(Object.fromEntries(r.values));reload.run('currentSection="raw";render()');assert.equal(reload.elements.get('rawEditor').value,'{ invalid draft');click(reload,'applyRaw');assert.equal(reload.run('JSON.stringify(data)'),before);click(reload,'rawBufferDiscard');assert.equal(reload.ctx.__EMBERWILD_EXPERIENCE.rawPending(),false);
});
test('raw apply is atomic and detects edits made after the text draft was created',()=>{
 const r=editor();r.run('currentSection="raw";render()');const ta=r.ctx.document.getElementById('rawEditor'),draft=structuredClone(doc);draft.classes[0].initialStats.hp+=5;ta.value=JSON.stringify(draft);ta.oninput();r.run('currentSection="classes";render();data.classes[1].initialStats.hp+=3;markDirty();currentSection="raw";render()');const before=r.run('JSON.stringify(data)');r.ctx.confirm=()=>false;click(r,'applyRaw');assert.equal(r.run('JSON.stringify(data)'),before);assert(r.ctx.__EMBERWILD_EXPERIENCE.rawPending());r.ctx.confirm=()=>true;click(r,'applyRaw');assert.equal(r.run('data.classes[0].initialStats.hp'),draft.classes[0].initialStats.hp);assert.equal(r.ctx.__EMBERWILD_EXPERIENCE.rawPending(),false);
});
test('confirmation stays disabled until checkbox and production phrase are valid; editing the message invalidates it',()=>{
 const r=editor(),E=r.ctx.__EMBERWILD_RELEASE_EDITOR;E.state.prepared={branch:'main',ticket:'fixture',diff:{rows:[],total:0}};E.state.capabilities={publishing:true};r.run('currentSection="releases";render()');const b=r.elements.get('releaseCommit'),c=r.elements.get('releaseConfirm'),p=r.elements.get('releaseProductionConfirm');assert(b.disabled);c.checked=true;c.onchange();assert(b.disabled);p.value='正式版';p.oninput();assert.equal(b.disabled,false);r.elements.get('releaseMessage').oninput({target:{value:'修改版次說明'}});assert.equal(E.state.prepared,null);assert(b.disabled);assert.equal(c.checked,false);
});
test('view and version message survive reload outside the game JSON; unknown page falls back safely',()=>{
 const r=editor();r.run('currentSection="equipment";selected.equipClass=2;render()');r.ctx.__EMBERWILD_EXPERIENCE.go({section:'releases'});r.elements.get('releaseMessage').oninput({target:{value:'改善設定操作'}});r.run('currentSection="equipment";render()');const reload=editor(Object.fromEntries(r.values));assert.equal(reload.run('currentSection'),'equipment');assert.equal(reload.run('selected.equipClass'),2);assert.equal(reload.ctx.__EMBERWILD_RELEASE_EDITOR.state.message,'改善設定操作');reload.run('currentSection="missing";render()');assert.equal(reload.run('currentSection'),'overview');assert(!Object.keys(reload.run('__EMBERWILD_RELEASE_EDITOR.current()')).includes('history'));
});

test('semantic diff IDs locate the intended skill and item without editing data',()=>{
 const r=editor(),X=r.ctx.__EMBERWILD_EXPERIENCE,before=r.run('JSON.stringify(data)'),id=r.run('data.classes[2].skills[1].id');X.jumpPath('classes.2.skills.'+id+'.power');assert.equal(r.run('currentSection'),'skillSystem');assert.equal(r.run('selected.skillClass'),2);assert.equal(r.run('selected.skill'),1);X.jumpPath('items.heal_supreme.cooldown');assert.equal(r.ctx.__EMBERWILD_INVENTORY_ICON_EDITOR.state.selectedId,'item:heal_supreme');assert.equal(r.run('JSON.stringify(data)'),before);
});
