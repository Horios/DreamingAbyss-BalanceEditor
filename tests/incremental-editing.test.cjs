'use strict';
// The editor tracks modules, records and fields per edit, validates only the change and its references,
// autosaves only changed modules and publishes only changed modules.
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {loadRuntime:load}=require('./headless-editor.cjs'),root=path.resolve(__dirname,'..');
// Values cross the vm realm as JSON so deepStrictEqual compares plain data.
const loadRuntime=(...a)=>{const r=load(...a),run=r.run;r.run=code=>{const v=run('(()=>{const __v=('+code+');return __v===undefined?undefined:JSON.stringify(__v);})()');return v===undefined?undefined:JSON.parse(v);};r.exec=run;return r;};

test('a monster HP edit marks one module and one record, checks one record and serializes only the page modules',()=>{
 const r=loadRuntime(root);
 const before=r.run('__EMBERWILD_INCREMENTAL.state()');assert.equal(before.dirty,false);
 r.exec("currentSection='world';const m=data.balanceSettings.monsters.catalog.find(x=>x.kind==='normal');globalThis.__id=m.id;m.hpMultiplier=(m.hpMultiplier||1)+0.25;markDirty('測試');");
 const s=r.run('__EMBERWILD_INCREMENTAL.refresh()');
 assert.deepEqual(s.modules.map(m=>m.id),['world/monsters']);
 assert.deepEqual(s.modules[0].records.map(x=>[x.id,x.fields,x.kinds]),[[r.run('__id'),['hpMultiplier'],['value']]]);
 assert.deepEqual(s.last.blocks,['field-rules(1)'],'only the field rules of that record run');
 assert.equal(s.last.inspected,3,'only the world page modules are serialized');assert.equal(s.issues.length,0);assert.equal(s.canPublish,true);assert.equal(s.crossModule,false);
 // Reverting the value clears the module.
 r.exec("data.balanceSettings.monsters.catalog.find(x=>x.id===__id).hpMultiplier-=0.25;markDirty('還原');");
 assert.equal(r.run('__EMBERWILD_INCREMENTAL.refresh()').dirty,false);
});

test('deleting a referenced monster runs cross-module checks and locates every broken drop by module, record and field',()=>{
 const r=loadRuntime(root);
 r.exec("currentSection='world';const c=data.balanceSettings.monsters.catalog;globalThis.__gone=c[1].id;c.splice(1,1);markDirty('刪除');");
 const s=r.run('__EMBERWILD_INCREMENTAL.refresh()');
 assert.equal(s.crossModule,true);assert.equal(s.canPublish,false);
 assert(s.last.blocks.includes('drops'),'drop references checked');
 assert(s.issues.length>0);assert(s.issues.every(x=>x.module==='world/drops'&&/^balanceSettings\.drops\.entries\.\d+\.sources$/.test(x.field)));
 // Removing the referencing drop rules fixes it; the drops module is now changed too and both pass.
 r.exec("data.balanceSettings.drops.entries=data.balanceSettings.drops.entries.map(d=>({...d,sources:d.sources.filter(id=>id!==__gone)})).filter(d=>d.sources.length);markDirty('修正');");
 const fixed=r.run('__EMBERWILD_INCREMENTAL.refresh()');
 assert.deepEqual(fixed.modules.map(m=>m.id).sort(),['world/drops','world/monsters']);assert.equal(fixed.issues.length,0);assert.equal(fixed.canPublish,true);
});

test('a write outside the page modules is still found (sweep) and an unknown page sweeps every module',()=>{
 const r=loadRuntime(root);
 r.exec("currentSection='world';data.items[0].cost+=1;markDirty('其他頁的寫入');");
 const s=r.run('__EMBERWILD_INCREMENTAL.refresh()');
 assert.deepEqual(s.modules.map(m=>m.id),['items/items']);assert.equal(s.last.sweep,true);
 assert.equal(r.run("__EMBERWILD_INCREMENTAL.sectionModules('overview')"),null);
});

test('autosave writes only changed modules and a reload restores the draft from module keys',()=>{
 const r=loadRuntime(root);
 r.exec("document.getElementById('cacheBtn')?.onclick?.()");
 const first=r.run('globalThis.__EMBERWILD_WORKSPACE_MODULES');assert(first&&first.written>0);
 r.exec("currentSection='world';data.balanceSettings.monsters.catalog[0].hpMultiplier=2.5;markDirty('改');document.getElementById('cacheBtn').onclick();");
 assert.deepEqual(r.run('globalThis.__EMBERWILD_WORKSPACE_MODULES'),{written:1,total:36});
 const saved=Object.fromEntries(r.values),box=JSON.parse(saved['emberwild-balance-workspace-v2']);
 assert.equal(box.moduleFormat,1);assert.equal(box.data,undefined,'the index no longer carries a full copy');
 const again=loadRuntime(root,'balance-editor.html',saved);
 assert.equal(again.run('data.balanceSettings.monsters.catalog[0].hpMultiplier'),2.5);
 assert.equal(again.run('__EMBERWILD_INCREMENTAL.state().dirty'),false,'the restored draft is the new session baseline');
});

test('publishing sends only the modules that differ from the online snapshot, with the hash each was based on',()=>{
 const r=loadRuntime(root);
 const out=r.run(`(()=>{const online=structuredClone(data),M=EmberwildBalanceModules,snap={commit:'a'.repeat(40),layout:'modular',data:online,modules:Object.fromEntries(M.MODULES.map(m=>[m.id,{sha256:'h-'+m.id}]))};
  const d=structuredClone(online);d.balanceSettings.monsters.catalog[0].hpMultiplier=3;return __EMBERWILD_INCREMENTAL.payload(d,snap);})()`);
 assert.deepEqual(Object.keys(out.modules),['world/monsters']);assert.deepEqual(out.baseModules,{'world/monsters':'h-world/monsters'});assert.equal(out.data,undefined);
 const legacy=r.run("__EMBERWILD_INCREMENTAL.payload({a:1},{layout:'legacy'})");assert.deepEqual(legacy,{data:{a:1}});
 const diff=r.run(`(()=>{const a=structuredClone(data),b=structuredClone(data);b.balanceSettings.monsters.catalog[0].hpMultiplier=3;return __EMBERWILD_INCREMENTAL.diff(a,b);})()`);
 assert.equal(diff.total,1);assert.equal(diff.rows[0].module,'world/monsters');
});
