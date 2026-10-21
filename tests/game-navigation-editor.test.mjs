import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{loadRuntime}=require('./headless-editor.cjs');
const json=(runtime,code)=>JSON.parse(runtime.run('JSON.stringify('+code+')'));

test('game navigation editor supplies and exports the complete default tree',()=>{
  const runtime=loadRuntime(process.cwd());runtime.run('data.navigation=__EMBERWILD_NAVIGATION_EDITOR.defaults()');const defaults=json(runtime,'__EMBERWILD_NAVIGATION_EDITOR.defaults()');
  assert.deepEqual(defaults.groups.map(group=>group.label),['探索與冒險','角色與隊伍','裝備與製作','主要任務','生活技能']);
  assert.deepEqual(defaults.groups.find(group=>group.id==='missions').pages.map(page=>page.label),['主線','支線','NPC 任務','委託']);
  assert.deepEqual(defaults.groups.find(group=>group.id==='life').pages.map(page=>page.label),['採集','煉金']);
  assert.equal(defaults.groups.flatMap(group=>group.pages).length,18);
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
