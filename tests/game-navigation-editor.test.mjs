import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{loadRuntime}=require('./headless-editor.cjs');
const json=(runtime,code)=>JSON.parse(runtime.run('JSON.stringify('+code+')'));

test('older documents that still list the retired guide page load without a missing-page error',()=>{
  const runtime=loadRuntime(process.cwd());
  runtime.run("data.navigation=__EMBERWILD_NAVIGATION_EDITOR.defaults();data.navigation.groups[0].pages.push({id:'guide',label:'冒險指南'});ensureArrays()");
  assert(!json(runtime,'data.navigation').groups.some(group=>group.pages.some(page=>page.id==='guide')));assert.deepEqual(json(runtime,'validateData()'),[]);assert.deepEqual(runtime.errors,[]);
});
test('older documents without the wishing lake page get it right after 委託',()=>{
  const runtime=loadRuntime(process.cwd());
  runtime.run("data.navigation=__EMBERWILD_NAVIGATION_EDITOR.defaults();for(const g of data.navigation.groups)g.pages=g.pages.filter(p=>p.id!=='wishingLake');ensureArrays()");
  assert.deepEqual(json(runtime,"data.navigation.groups.find(g=>g.id==='missions').pages.map(p=>p.id)"),['story-main','story-side','story-npc','quests','wishingLake']);
  assert.deepEqual(json(runtime,'validateData()'),[]);assert.deepEqual(runtime.errors,[]);
});
test('game navigation editor supplies and exports the complete default tree',()=>{
  const runtime=loadRuntime(process.cwd());runtime.run('data.navigation=__EMBERWILD_NAVIGATION_EDITOR.defaults()');const defaults=json(runtime,'__EMBERWILD_NAVIGATION_EDITOR.defaults()');
  assert.deepEqual(defaults.groups.map(group=>group.label),['探索與冒險','角色與隊伍','裝備與製作','主要任務','生活技能']);
  assert.deepEqual(defaults.groups.find(group=>group.id==='missions').pages.map(page=>page.label),['主線','支線','NPC 任務','委託','許願湖']);
  assert.deepEqual(defaults.groups.find(group=>group.id==='life').pages.map(page=>page.label),['採集','煉金']);
  // The adventure guide is a header dialog since game v0.047 the wishing lake a 任務 page since v0.062 and 怪物圖鑑 an 探索 page since v0.185: 19 pages.
  assert.equal(defaults.groups.flatMap(group=>group.pages).length,19);assert(!defaults.groups.some(group=>group.pages.some(page=>page.id==='guide')));
  assert.deepEqual(json(runtime,'validateData()'),[]);
  assert.deepEqual(json(runtime,'__EMBERWILD_MASTERY_EDITOR.cleanExport().navigation'),defaults);
  runtime.run('__EMBERWILD_NAVIGATION_EDITOR.select()');
  assert.match(runtime.elements.get('app').innerHTML,/調整遊戲左側樹狀列表/);
  assert.deepEqual(runtime.errors,[]);
});

test('navigation labels, group assignment and order round-trip while incomplete lists fail validation',()=>{
  const runtime=loadRuntime(process.cwd());runtime.run('data.navigation=__EMBERWILD_NAVIGATION_EDITOR.defaults()');
  runtime.run(`data.navigation.groups[0].label='冒險總覽';const source=data.navigation.groups.find(group=>group.id==='life'),target=data.navigation.groups.find(group=>group.id==='adventure'),entry=source.pages.pop();target.pages.unshift(entry);data.navigation.groups.reverse();`);
  const exported=json(runtime,'__EMBERWILD_MASTERY_EDITOR.cleanExport().navigation');
  assert.equal(exported.groups.at(-1).label,'冒險總覽');
  assert.equal(exported.groups.at(-1).pages[0].id,'alchemy');
  assert.deepEqual(json(runtime,'validateData()'),[]);
  runtime.run("data.navigation.groups.at(-1).pages=data.navigation.groups.at(-1).pages.filter(page=>page.id!=='battle')");
  assert(json(runtime,'validateData()').some(issue=>issue.includes('battle')));
  assert.deepEqual(runtime.errors,[]);
});

test('older documents receive the current bestiary page after statistics',()=>{
 const r=loadRuntime(process.cwd());r.run("data.navigation=__EMBERWILD_NAVIGATION_EDITOR.defaults();for(const g of data.navigation.groups)g.pages=g.pages.filter(p=>p.id!=='bestiary');ensureArrays()");
 const pages=json(r,"data.navigation.groups.find(g=>g.pages.some(p=>p.id==='statistics')).pages.map(p=>p.id)");assert.equal(pages[pages.indexOf('statistics')+1],'bestiary');assert.deepEqual(json(r,'validateData()'),[]);
});
