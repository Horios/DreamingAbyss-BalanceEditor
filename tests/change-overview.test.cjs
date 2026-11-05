// 變更總覽：final differences against an explicit baseline, Chinese field names and units, jump-to-edit,
// field and record reverts that never touch other data, and a copyable summary.
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {loadRuntime}=require('./headless-editor.cjs');
const root=path.resolve(__dirname,'..'),plain=x=>JSON.parse(JSON.stringify(x));
function editor(){const e=loadRuntime(root);e.run('globalThis.CO=__EMBERWILD_CHANGE_OVERVIEW');return e;}
const state=e=>plain(e.run('(()=>{const s=CO.changes();return {stats:s.stats,records:s.records.map(r=>({path:r.path,name:r.name,kind:r.kind,category:r.category,rows:r.rows.map(x=>({path:x.path,type:x.type,before:x.before,after:x.after,label:CO.fieldLabel(x,r),from:CO.format(x.before,x,s.baseline.doc),to:CO.format(x.after,x,s.current)}))}))};})()'));
const skill="data.skillSystem.definitions.find(s=>s.id==='class1-initial0')";

test('a fresh editor has no differences, and one record with three fields counts as one item and three fields',()=>{
 const e=editor();assert.deepEqual(state(e).stats,{records:0,fields:0,added:0,deleted:0});
 e.run(`__EMBERWILD_SKILL_SYSTEM_EDITOR.updateSkill('class1-initial0',{power:${skill}.power+.1,timing:{...${skill}.timing,cooldownSeconds:13,initialCooldownSeconds:3}})`);
 const s=state(e);assert.deepEqual(s.stats,{records:1,fields:3,added:0,deleted:0});
 const r=s.records[0];assert.equal(r.category,'skills');assert.match(r.name,/^技能：魔爆/);
 const byKey=Object.fromEntries(r.rows.map(x=>[x.path.split('.').at(-1),x]));
 assert.equal(byKey.cooldownSeconds.label,'再使用冷卻（秒）');assert.equal(byKey.cooldownSeconds.to,'13 秒');assert.equal(byKey.initialCooldownSeconds.to,'3 秒');assert.equal(byKey.power.label,'威力倍率');
});

test('changing a value back to the baseline removes it from the overview',()=>{
 const e=editor(),cd=e.run(`${skill}.timing.cooldownSeconds`);
 for(const v of [cd+1,cd+2,cd])e.run(`__EMBERWILD_SKILL_SYSTEM_EDITOR.updateSkill('class1-initial0',{timing:{...${skill}.timing,cooldownSeconds:${v}}})`);
 assert.equal(state(e).stats.records,0);
});

test('added and deleted records are recognized, reordering is not a delete plus add, and units follow field definitions',()=>{
 const e=editor();
 const id=e.run("__EMBERWILD_SKILL_SYSTEM_EDITOR.addSkill(1,'active')");
 e.run("{const c=data.balanceSettings.monsters.catalog;c.push(c.splice(0,1)[0]);markDirty('test');}");
 e.run("{const m=data.balanceSettings.maps.catalog.find(m=>m.eliteChance!==undefined)||data.balanceSettings.maps.catalog[0];m.eliteChance=0.25;}");
 const s=state(e),added=s.records.find(r=>r.kind==='新增');
 assert(added&&added.path.endsWith(id),'new skill is an added record');assert.equal(s.stats.added,1);assert.equal(s.stats.deleted,0);
 assert(s.records.some(r=>r.path==='balanceSettings.monsters.catalog.order'),'monster order change');assert(!s.records.some(r=>r.kind==='刪除'),'reorder is not deletion');
 const elite=s.records.flatMap(r=>r.rows).find(x=>x.path.endsWith('.eliteChance'));assert.equal(elite.to,'25%');
 e.run("{const c=data.balanceSettings.monsters.catalog;c.unshift(c.pop());markDirty('test');}");
 // Skill deletion is a soft delete kept in the document; the overview says so, and 取消新增 removes the record.
 e.run(`__EMBERWILD_SKILL_SYSTEM_EDITOR.deleteSkill(${JSON.stringify(id)})`);
 const marked=state(e).records.find(r=>r.kind==='新增');assert.match(marked.name,/已標記刪除/);
 e.ctx.p=marked.path;e.run('CO.revert([p],"test")');
 const t=state(e);assert(!t.records.some(r=>r.kind==='新增'));assert(!t.records.some(r=>r.path.endsWith('.order')));
 assert.equal(e.run(`data.skillSystem.definitions.some(s=>s.id===${JSON.stringify(id)})`),false);
});

test('a field revert keeps the record\'s other fields, a record revert restores all, deletions come back',()=>{
 const e=editor(),cd=e.run(`${skill}.timing.cooldownSeconds`),power=e.run(`${skill}.power`);
 e.run(`__EMBERWILD_SKILL_SYSTEM_EDITOR.updateSkill('class1-initial0',{power:${power}+.2,timing:{...${skill}.timing,cooldownSeconds:${cd}+5}})`);
 const rec=state(e).records[0],cdRow=rec.rows.find(x=>x.path.endsWith('cooldownSeconds'));
 e.ctx.p=cdRow.path;e.run('CO.revert([p],"test")');
 assert.equal(e.run(`${skill}.timing.cooldownSeconds`),cd);assert.equal(e.run(`${skill}.power`),power+.2,'other field kept');
 assert.equal(state(e).stats.fields,1);
 e.ctx.p=rec.path;e.run('CO.revert(CO.changes().records.find(r=>r.path===p).rows.map(x=>x.path),"test")');
 assert.equal(state(e).stats.records,0);assert.equal(e.run(`${skill}.power`),power);
 // A deleted monster is restored at its place.
 const before=plain(e.run('data.balanceSettings.monsters.catalog.map(m=>m.id)'));
 // Delete a monster that the baseline has and nothing references: add one, take that as the baseline, delete it.
 const victim=plain(e.run("__EMBERWILD_WORLD_EDITOR.createMonster(0,{name:'測試野狼',element:'physical',race:'beast',hpMultiplier:1,attackMultiplier:1,defenseMultiplier:1,spawnWeight:1,maxDrops:1,enabled:true,eliteEnabled:true})")).id;
 assert(victim,'monster created');e.ctx.victim=victim;e.run("CO.setBaseline('含測試怪物',__EMBERWILD_RELEASE_EDITOR.current())");
 const withVictim=plain(e.run('data.balanceSettings.monsters.catalog.map(m=>m.id)'));
 e.run("data.balanceSettings.monsters.catalog=data.balanceSettings.monsters.catalog.filter(m=>m.id!==victim);markDirty('t')");
 const del=state(e).records.find(r=>r.kind==='刪除');assert(del,'deleted monster listed');assert.match(del.name,/^怪物：/);
 e.ctx.p=del.path;e.run('CO.revert([p],"test")');assert.deepEqual(plain(e.run('data.balanceSettings.monsters.catalog.map(m=>m.id)')),withVictim);assert.match(del.name,/測試野狼/);
 assert.deepEqual(plain(e.run('validateData()')),[]);
});

test('the baseline survives page changes, can be replaced explicitly, and viewing never changes the export',()=>{
 const e=editor();e.run(`__EMBERWILD_SKILL_SYSTEM_EDITOR.updateSkill('class1-initial0',{timing:{...${skill}.timing,cooldownSeconds:17}})`);
 const exported=plain(e.run('__EMBERWILD_RELEASE_EDITOR.current()'));
 for(const sec of ['changeOverview','classes','changeOverview','overview','changeOverview'])e.run(`currentSection=${JSON.stringify(sec)};render();`);
 assert.equal(state(e).stats.records,1,'page changes keep the baseline');
 assert.deepEqual(plain(e.run('__EMBERWILD_RELEASE_EDITOR.current()')),exported,'viewing does not change data');
 e.run("CO.setBaseline('目前內容',__EMBERWILD_RELEASE_EDITOR.current())");assert.equal(state(e).stats.records,0);
 e.run("CO.setBaseline('內建發布資料',ORIGINAL_DATA)");assert.equal(state(e).stats.records,1);
});

test('the summary lists the same changes and counts, and jump-to-edit opens the skill',()=>{
 const e=editor();e.run(`__EMBERWILD_SKILL_SYSTEM_EDITOR.updateSkill('class1-initial0',{timing:{...${skill}.timing,cooldownSeconds:15}})`);
 const text=e.run('CO.summary()');
 assert.match(text,/技能與技能機制：/);assert.match(text,/技能：魔爆.*再使用冷卻（秒） \d+(?:\.\d+)? 秒 → 15 秒/);assert.match(text,/共修改 1 筆資料、1 個欄位/);
 assert.equal(e.run('CO.locate(CO.changes().records[0])'),true);assert.equal(e.run('__EMBERWILD_SKILL_SYSTEM_EDITOR.selected()'),'class1-initial0');
});

test('unexported changes are tracked against the last JSON export, not browser draft saves',()=>{
 const e=editor();e.run(`__EMBERWILD_SKILL_SYSTEM_EDITOR.updateSkill('class1-initial0',{timing:{...${skill}.timing,cooldownSeconds:16}})`);
 e.run("currentSection='changeOverview';render();");assert.match(e.run("document.getElementById('app').innerHTML"),/有尚未匯出的變更/);
 e.run("markSaved('已儲存瀏覽器草稿');render();");assert.match(e.run("document.getElementById('app').innerHTML"),/有尚未匯出的變更/);
 e.run("markSaved('已匯出測試 JSON');render();");assert.match(e.run("document.getElementById('app').innerHTML"),/目前沒有尚未匯出的變更/);
 assert.equal(e.run('CO.changes().stats.records'),1,'exporting keeps the overview and its baseline');
});
