// The current opening edits text while preserving the game's fixed stage bindings.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {loadRuntime}=require('./headless-editor.cjs'),root=path.resolve(__dirname,'..'),game=path.resolve(process.env.EMBERWILD_GAME_ROOT||path.join(root,'../DreamingAbyss'));
const published=JSON.parse(fs.readFileSync(path.join(game,'data/balance.json'),'utf8')),M=require(path.join(game,'js/story/story-model.js')),plain=x=>JSON.parse(JSON.stringify(x));
function editor(){const r=loadRuntime(root);r.ctx.doc=structuredClone(published);r.run('data=__EMBERWILD_VALIDATE_DOCUMENT(doc);ensureArrays()');r.E=r.ctx.__EMBERWILD_PROLOGUE_EDITOR;r.html=()=>r.elements.get('app').innerHTML;r.out=()=>plain(r.run('__EMBERWILD_RELEASE_EDITOR.current()'));return r;}
test('the embedded story contract matches the game and the current opening renders without retired chapter fields',()=>{
 const html=fs.readFileSync(path.join(root,'balance-editor.html'),'utf8');
 assert.equal(html.split('<script id="story-model-v1">\n')[1].split('\n</script>')[0],fs.readFileSync(path.join(game,'js/story/story-model.js'),'utf8').trimEnd());
 const r=editor();r.E.open(1);const q=r.E.quest();assert.equal(q.prologue.version,2);
 assert.match(r.html(),/系統事件：角色命名（固定）/);assert.match(r.html(),/系統事件：選擇初始職業（固定）/);
 assert.match(r.html(),/播放順序預覽/);assert(!r.html().includes('data-pl="[&quot;prologue&quot;,&quot;chapter&quot;'));
 for(const c of published.classes)assert(r.html().includes('<b>'+c.name+'</b>'));
 assert.equal(r.run("count('prologue')"),q.stages.reduce((n,s)=>n+s.dialogue.length+s.prologue.after.length,0));assert.deepEqual(r.errors,[]);
});
test('opening text edits and reordering round-trip through the shared game contract without changing system events',()=>{
 const r=editor(),q=r.E.quest(),creation=q.stages.findIndex(s=>s.id==='creation'),calling=q.stages.findIndex(s=>s.id==='calling'),before=plain(q.stages.map(s=>[s.id,s.next,s.prologue.action,s.prologue.scene]));
 r.E.addLine(['stages',creation,'dialogue'],{text:'測試旁白',kind:'narrator',speaker:'旁白'});
 r.E.addLine(['stages',creation,'dialogue'],{text:'第二句'});r.E.moveLine(['stages',creation,'dialogue'],q.stages[creation].dialogue.length-1,-1);
 r.E.set(['stages',creation,'dialogue',0,'text'],'修改後的旁白');r.E.removeLine(['stages',creation,'dialogue'],1);
 r.E.set(['stages',calling,'prologue','options',0,'text'],'劍士');r.E.set(['stages',calling,'prologue','hint'],'選擇力量');
 r.E.set(['prologue','scenes',0,'name'],'角色建立測試');
 assert.deepEqual(plain(r.E.issues()),[]);const out=r.out(),next=M.prologueQuest(out.story);
 assert.equal(next.stages[creation].dialogue[0].text,'修改後的旁白');assert.equal(next.stages[calling].prologue.options[0].text,'劍士');
 assert.deepEqual(next.stages.map(s=>[s.id,s.next,s.prologue.action,s.prologue.scene]),before);
 assert.deepEqual(M.issues(out.story,{maps:out.balanceSettings.maps.catalog,monsters:out.balanceSettings.monsters.catalog,items:out.items,skills:out.skillSystem.definitions,forms:out.equipmentForms,companions:out.companions,classes:out.classes}),[]);
 const again=loadRuntime(root);again.ctx.doc=out;again.run('data=__EMBERWILD_VALIDATE_DOCUMENT(doc);ensureArrays()');assert.deepEqual(plain(again.run('__EMBERWILD_RELEASE_EDITOR.current().story')),out.story);assert.deepEqual(r.errors,[]);
});
test('system bindings cannot be edited and a missing required opening stage blocks publication',()=>{
 const r=editor(),calling=r.E.quest().stages.findIndex(s=>s.id==='calling');
 for(const p of [['stages',calling,'prologue','action'],['stages',calling,'next'],['stages',calling,'id'],['stages',calling,'prologue','options',0,'job'],['prologue','version'],['stages',calling,'dialogue']])assert.throws(()=>r.E.set(p,'x'),/不能在序章劇情編輯/);
 assert.throws(()=>r.E.addLine(['stages']),/不是可編輯的對話清單/);assert.deepEqual(plain(r.E.issues()),[]);
 r.run("{const q=__EMBERWILD_PROLOGUE_EDITOR.quest();q.stages=q.stages.filter(s=>s.id!=='calling');}");assert(r.E.issues().length>0);assert(r.run('validateData()').some(x=>x.includes('序章')));r.ctx.candidate=r.out();assert.throws(()=>r.run('__EMBERWILD_VALIDATE_DOCUMENT(candidate)'));
});
