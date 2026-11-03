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
 assert.throws(()=>r.run('__EMBERWILD_V2_BRIDGE.open("missing")'),/找不到設定頁面/);
 r.run('__EMBERWILD_EXPERIENCE.guardRaw=()=>false');assert.throws(()=>r.run('__EMBERWILD_V2_BRIDGE.current()'),/尚未套用/);
 assert.deepEqual(r.errors,[]);
});
