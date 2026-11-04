// Developer-mode dialog APIs: protagonist class stats and new items validate the whole draft, roll back on rejection
// and reach the game unchanged.
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {loadRuntime}=require('./headless-editor.cjs'),{loadRuntime:loadGame}=require('../../Emberwild/tests/headless-runtime.cjs');
const root=path.resolve(__dirname,'..'),game=path.resolve(root,'../Emberwild'),plain=x=>JSON.parse(JSON.stringify(x));
function editor(){const g=loadGame(game),e=loadRuntime(root);e.ctx.input=plain(g.run('exportableBalance()'));e.run('data=__EMBERWILD_VALIDATE_DOCUMENT(input);ensureArrays()');return e;}
const call=(e,code,args)=>{e.ctx.args=args;return plain(e.run(code));};
function inGame(e){const g=loadGame(game);g.ctx.input=plain(e.run('__EMBERWILD_RELEASE_EDITOR.current()'));g.run('applyBalanceConfig(input,{persist:false})');assert.deepEqual(g.errors,[]);return g;}

test('protagonist class stats keep the legacy LV1 fields in sync and reject invalid values atomically',()=>{
 const e=editor(),before=call(e,'__EMBERWILD_CLASS_DIALOG.get(1)');
 assert.equal(before.name,plain(e.run('data.classes[1].name')));
 assert.deepEqual(call(e,'__EMBERWILD_CLASS_DIALOG.update(1,args)',{'initialStats.hp':before['initialStats.hp']+7,'growthPerLevel.def':2,advanced:'測試二轉'}),{ok:true,job:1});
 assert.deepEqual(plain(e.run('[data.classes[1].hp,data.classes[1].initialStats.hp,data.classes[1].growthPerLevel.def,data.classes[1].advanced]')),[before['initialStats.hp']+7,before['initialStats.hp']+7,2,'測試二轉']);
 const saved=plain(e.run('data.classes'));
 for(const bad of [{'initialStats.atk':-1},{name:''},{'growthPerLevel.hp':'x'},{unknown:1}]){const out=call(e,'__EMBERWILD_CLASS_DIALOG.update(1,args)',bad);assert.equal(out.ok,false,JSON.stringify(bad));}
 assert.deepEqual(plain(e.run('data.classes')),saved,'rejected edits change nothing');
 assert.deepEqual(plain(e.run('validateData()')),[]);
 const g=inGame(e);assert.deepEqual(plain(g.run('[exportableBalance().classes[1].initialStats.hp,exportableBalance().classes[1].growthPerLevel.def]')),[before['initialStats.hp']+7,2]);
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
