// Developer-mode dialog APIs: protagonist class stats and new items validate the whole draft, roll back on rejection
// and reach the game unchanged.
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {loadRuntime}=require('./headless-editor.cjs'),{loadRuntime:loadGame}=require('../../DreamingAbyss/tests/headless-runtime.cjs');
const root=path.resolve(__dirname,'..'),game=path.resolve(root,'../DreamingAbyss'),plain=x=>JSON.parse(JSON.stringify(x));
function editor(){const g=loadGame(game),e=loadRuntime(root);e.ctx.input=plain(g.run('exportableBalance()'));e.run('data=__EMBERWILD_VALIDATE_DOCUMENT(input);ensureArrays()');return e;}
const call=(e,code,args)=>{e.ctx.args=args;return plain(e.run(code));};
function inGame(e){const g=loadGame(game);g.ctx.input=plain(e.run('__EMBERWILD_RELEASE_EDITOR.current()'));g.run('applyBalanceConfig(input,{persist:false})');assert.deepEqual(g.errors,[]);return g;}

test('protagonist fixed class stats stay in sync and reject invalid values atomically',()=>{
 const e=editor(),before=call(e,'__EMBERWILD_CLASS_DIALOG.get(1)');
 assert.equal(before.name,plain(e.run('data.classes[1].name')));
 assert.deepEqual(call(e,'__EMBERWILD_CLASS_DIALOG.update(1,args)',{'initialStats.hp':before['initialStats.hp']+7,'initialStats.def':2}),{ok:true,job:1});
 assert.deepEqual(plain(e.run('[data.classes[1].hp,data.classes[1].initialStats.hp,data.classes[1].initialStats.def]')),[before['initialStats.hp']+7,before['initialStats.hp']+7,2]);
 const saved=plain(e.run('data.classes'));
 for(const bad of [{'initialStats.atk':-1},{name:''},{'growthPerLevel.hp':1},{advanced:'舊二轉'},{unknown:1}]){const out=call(e,'__EMBERWILD_CLASS_DIALOG.update(1,args)',bad);assert.equal(out.ok,false,JSON.stringify(bad));}
 assert.deepEqual(plain(e.run('data.classes')),saved,'rejected edits change nothing');
 assert.deepEqual(plain(e.run('validateData()')),[]);
 const g=inGame(e);assert.deepEqual(plain(g.run('[exportableBalance().classes[1].initialStats.hp,exportableBalance().classes[1].initialStats.def]')),[before['initialStats.hp']+7,2]);
});

test('new materials, healing potions and timed boost tickets pass validation and arrive in the game',()=>{
 const e=editor();
 assert.equal(call(e,'__EMBERWILD_ITEM_DIALOG.create("material",args)',{name:'測試礦石',sellPrice:7,description:'測試用'}).ok,true);
 assert.equal(call(e,'__EMBERWILD_ITEM_DIALOG.create("potion",args)',{name:'測試藥水',healAmount:80,cooldownSeconds:5,cost:30,sellPrice:6}).ok,true);
 assert.equal(call(e,'__EMBERWILD_ITEM_DIALOG.create("timed",args)',{name:'測試掉寶券',boostType:'drop',bonusPercent:40,durationMinutes:15,cost:100,sellPrice:20}).ok,true);
 const saved=plain(e.run('data.items'));
 for(const [kind,bad] of [['timed',{name:'測試掉寶券',bonusPercent:10,durationMinutes:5}],['potion',{name:'壞藥水',healAmount:0,cooldownSeconds:1}],['timed',{name:'壞券',boostType:'speed2',bonusPercent:10,durationMinutes:5}],['gem',{name:'寶石'}],['material',{name:'測試礦石'}]]){
  assert.equal(call(e,`__EMBERWILD_ITEM_DIALOG.create(${JSON.stringify(kind)},args)`,bad).ok,false,JSON.stringify(bad));
 }
 assert.deepEqual(plain(e.run('data.items')),saved,'rejected items are not added');
 assert.deepEqual(plain(e.run('validateData()')),[]);
 assert.equal(plain(e.run('__EMBERWILD_INVENTORY_ICON_EDITOR.info("material:測試礦石").description')),'測試用');
 const g=inGame(e),items=plain(g.run('exportableBalance().items'));
 const potion=items.find(i=>i.name==='測試藥水'),ticket=items.find(i=>i.name==='測試掉寶券');
 assert.deepEqual([potion.healAmount,potion.timing.cooldownSeconds,potion.cost],[80,5,30]);
 assert.deepEqual([ticket.boostType,ticket.bonusPercent,ticket.durationMinutes],['drop',40,15]);
 assert.equal(g.run('materialSellPrice("測試礦石")'),7);
});

test('the item manager 新增藥水 button creates a potion that passes validation',()=>{
 const e=editor();e.run('addHealingPotion()');
 assert.deepEqual(plain(e.run('data.items.at(-1).timing')),{cooldownSeconds:9,durationSeconds:0});
 assert.deepEqual(plain(e.run('validateData()')),[]);
});

test('the companion token page 新增信物 creates a token that passes validation',()=>{
 const e=editor();e.run('currentSection="companionTokens";render();document.getElementById("newToken").onclick()');
 const t=plain(e.run('data.companionTokens.catalog.at(-1)'));
 assert.equal(t.name,'新信物');assert.deepEqual(Object.keys(t.ability.timing).sort(),['cooldownSeconds','durationSeconds','firstTriggerSeconds','triggerIntervalSeconds']);
 assert.deepEqual(plain(e.run('validateData()')),[]);
});

// Seconds combat revision (game v0.074): initial and reuse cooldowns, action cost and auto-cast condition on skills;
// basic attack interval, class speed and shortest action interval on classes; basic attack interval on monsters.
test('seconds rhythm fields read, validate, export and reach the game',()=>{
 const e=editor();
 const id='class1-initial0',sk=call(e,'__EMBERWILD_SKILL_DIALOG.get(args)',id);
 assert.equal(sk.initialCooldownSeconds,plain(e.run(`data.skillSystem.definitions.find(s=>s.id==='${id}').timing.initialCooldownSeconds`)));
 assert(Number.isFinite(sk.cooldownSeconds)&&sk.condition&&Number.isFinite(sk.actionCostSeconds));
 assert.equal(call(e,'__EMBERWILD_SKILL_DIALOG.update(args[0],args[1])',[id,{initialCooldownSeconds:1.5,cooldownSeconds:13,condition:'always',actionCostSeconds:.2}]).ok,true);
 for(const bad of [{initialCooldownSeconds:-1},{condition:'never'},{actionCostSeconds:'x'}])assert.equal(call(e,'__EMBERWILD_SKILL_DIALOG.update(args[0],args[1])',[id,bad]).ok,false,JSON.stringify(bad));
 const cls=call(e,'__EMBERWILD_CLASS_DIALOG.get(2)');assert.equal(cls.baseIntervalSeconds,1.6);assert(cls.speedBase>0&&cls.minimumActionIntervalSeconds>0);
 assert.deepEqual(call(e,'__EMBERWILD_CLASS_DIALOG.update(2,args)',{baseIntervalSeconds:1.7,speedBase:cls.speedBase+1}),{ok:true,job:2});
 assert.equal(call(e,'__EMBERWILD_CLASS_DIALOG.update(2,args)',{baseIntervalSeconds:0}).ok,false);
 const monsterId=plain(e.run("data.balanceSettings.monsters.catalog.find(m=>m.kind==='normal').id")),mon=call(e,'__EMBERWILD_WORLD_EDITOR.monster(args)',monsterId);
 assert(mon.attackIntervalSeconds>=2.2&&mon.attackIntervalSeconds<=3.2);
 assert.notEqual(call(e,'__EMBERWILD_WORLD_EDITOR.updateMonster(args[0],args[1])',[monsterId,{attackIntervalSeconds:2.6}]).ok,false);
 assert.equal(call(e,'__EMBERWILD_WORLD_EDITOR.updateMonster(args[0],args[1])',[monsterId,{attackIntervalSeconds:-1}]).ok,false);
 assert.equal(plain(e.run(`data.balanceSettings.monsters.catalog.find(m=>m.id===${JSON.stringify(monsterId)}).timing.baseIntervalSeconds`)),2.6);
 assert.deepEqual(plain(e.run('validateData()')),[]);
 const doc=plain(e.run('__EMBERWILD_RELEASE_EDITOR.current()'));
 const t=doc.skillSystem.definitions.find(s=>s.id===id).timing;assert.deepEqual([t.initialCooldownSeconds,t.cooldownSeconds,t.actionCostSeconds],[1.5,13,.2]);
 assert.equal(doc.balanceSettings.combat.seconds.classes.find(c=>c.job===2).baseIntervalSeconds,1.7);
 assert.equal(doc.balanceSettings.monsters.catalog.find(m=>m.id===monsterId).timing.baseIntervalSeconds,2.6);
 const g=inGame(e);
 assert.equal(g.run(`EmberwildSecondsSchema.initialCooldownSeconds(__EMBERWILD_SKILLS.byId('${id}'))`),1.5);
 assert.equal(g.run('EmberwildSecondsCombat.config().classes.find(c=>c.job===2).baseIntervalSeconds'),1.7);
});

// Cooldown reduction (game v0.075): each source picks percent or fixed seconds with its value; the diminishing
// threshold, kept share and floor are editable on the seconds page and reach the game.
test('cooldown reduction rules are editable per source and reach the game',()=>{
 const e=editor();
 e.run("__EMBERWILD_COMBAT_MIGRATION_AUDIT.select('combat','cdr:affixAll')");
 e.run("__EMBERWILD_COMBAT_MIGRATION_AUDIT.update('cdr:affixAll',{mode:'percent',value:8})");
 e.run("__EMBERWILD_COMBAT_MIGRATION_AUDIT.update('cdrDiminishing',{thresholdSeconds:6,factor:.4,minimumSeconds:2.5})");
 assert.throws(()=>e.run("__EMBERWILD_COMBAT_MIGRATION_AUDIT.update('cdr:enemyDeath',{mode:'turns'})"));
 assert.throws(()=>e.run("__EMBERWILD_COMBAT_MIGRATION_AUDIT.update('cdr:enemyDeath',{mode:'percent',value:150})"));
 assert.deepEqual(plain(e.run('data.balanceSettings.combat.seconds.cooldownReduction.sources.enemyDeath')),{mode:'flat',value:3},'rejected edits roll back');
 assert.deepEqual(plain(e.run('validateData()')),[]);
 const doc=plain(e.run('__EMBERWILD_RELEASE_EDITOR.current()')),r=doc.balanceSettings.combat.seconds.cooldownReduction;
 assert.deepEqual(r.sources.affixAll,{mode:'percent',value:8});assert.deepEqual(r.diminishing,{thresholdSeconds:6,factor:.4,minimumSeconds:2.5});
 const g=inGame(e);
 assert.equal(g.run("EmberwildSecondsCombat.cooldownReductionText('affixAll',2)"),'−16%');
 assert.equal(g.run("EmberwildSecondsCombat.config().cooldownReduction.diminishing.minimumSeconds"),2.5);
});
