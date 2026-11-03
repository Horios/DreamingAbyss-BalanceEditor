'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {loadRuntime}=require('./headless-editor.cjs');
test('context panel reuses all editor routes, tracks changes, and preserves the source document',()=>{
 const root=path.resolve(__dirname,'..'),r=loadRuntime(root),messages=[];
 r.ctx.parent={postMessage:m=>messages.push(m)};
 // This harness has no world DOM. Actual rendering is covered by v2-game.browser.cjs.
 r.run('render=()=>{}');
 r.run(fs.readFileSync(path.join(root,'scripts/v2-editor-bridge.js'),'utf8'));
 const groups=JSON.parse(JSON.stringify(r.run('__EMBERWILD_V2_BRIDGE.sections()'))),ids=groups.flatMap(g=>g.pages.map(p=>p.id));
 assert.equal(new Set(ids).size,ids.length);assert.deepEqual([...ids].sort(),[...r.run('SECTION_META.map(x=>x[0])')].sort());
 const before=JSON.stringify(r.run('__EMBERWILD_V2_BRIDGE.current()'));
 assert.equal(r.run('__EMBERWILD_V2_BRIDGE.open("world",{mapIndex:2})'),'world');
 assert.equal(r.run('selected.worldMap'),2);assert.equal(JSON.stringify(r.run('__EMBERWILD_V2_BRIDGE.current()')),before);
 assert.equal(r.run('__EMBERWILD_V2_BRIDGE.open("classes",{job:3})'),'classes');assert.equal(r.run('selected.class'),3);
 r.run('markDirty()');assert(messages.some(m=>m.kind==='dreaming-abyss-dev-change'));
 assert(messages.some(m=>m.kind==='dreaming-abyss-dev-section'&&m.section==='classes'));
 assert.equal(r.run('__EMBERWILD_V2_BRIDGE.inspect({kind:"skill",id:"class0-initial0"})'),'skillSystem');
 assert.equal(r.run('__EMBERWILD_V2_BRIDGE.inspect({kind:"monster",id:data.balanceSettings.monsters.catalog[0].id})'),'world');
 assert.equal(r.run('selected.worldMonsterSearch'),r.run('data.balanceSettings.monsters.catalog[0].id'));
 assert.equal(JSON.stringify(r.run('__EMBERWILD_V2_BRIDGE.current()')),before);
 assert.throws(()=>r.run('__EMBERWILD_V2_BRIDGE.inspect({kind:"skill",id:"missing"})'),/找不到技能/);
 assert.throws(()=>r.run('__EMBERWILD_V2_BRIDGE.open("missing")'),/找不到設定頁面/);
 r.run('__EMBERWILD_EXPERIENCE.guardRaw=()=>false');assert.throws(()=>r.run('__EMBERWILD_V2_BRIDGE.current()'),/尚未套用/);
 assert.deepEqual(r.errors,[]);
});

test('every game navigation page has editable shared data routes with existing document paths',()=>{
 const root=path.resolve(__dirname,'..'),r=loadRuntime(root),vm=require('node:vm');
 r.run(fs.readFileSync(path.join(root,'scripts/v2-page-context.js'),'utf8'));
 const contexts=r.run('DreamingAbyssPageContexts'),source=fs.readFileSync(path.join(root,'../Emberwild/js/ui/navigation-tree.js'),'utf8');
 const pages=vm.runInNewContext('('+source.match(/const PAGES=({[\s\S]*?});/)[1]+')');
 for(const id of [...Object.keys(pages),'creation'])assert(contexts[id]?.sections.length,id+' has data editing routes');
 const available=new Set(r.run('SECTION_META.map(s=>s[0])'));
 for(const [page,c] of Object.entries(contexts))for(const section of c.sections){
  assert(available.has(section.id),page+' editor exists: '+section.id);
  for(const path of section.paths)assert.notEqual(r.run('data.'+path),undefined,page+' document path: '+path);
 }
});
