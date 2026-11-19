// 序章劇情 editor: text edits reach the exported document, the game's own contract accepts them, and the system
// bindings cannot be edited away from this page.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {loadRuntime}=require('./headless-editor.cjs'),root=path.resolve(__dirname,'..'),game=path.resolve(process.env.EMBERWILD_GAME_ROOT||path.join(root,'../DreamingAbyss'));
const published=JSON.parse(fs.readFileSync(path.join(game,'data/balance.json'),'utf8')),M=require(path.join(game,'js/story/story-model.js'));
// Values from the editor's VM realm are compared through JSON.
const plain=x=>JSON.parse(JSON.stringify(x));
function editor(){const r=loadRuntime(root);r.ctx.doc=structuredClone(published);r.run('data=__EMBERWILD_VALIDATE_DOCUMENT(doc);ensureArrays();');r.E=r.ctx.__EMBERWILD_PROLOGUE_EDITOR;r.html=()=>r.elements.get('app').innerHTML;r.out=()=>JSON.parse(r.run('JSON.stringify(__EMBERWILD_RELEASE_EDITOR.current())'));return r;}
const stageIndex=(r,id)=>r.E.quest().stages.findIndex(s=>s.id===id);

test('the embedded story contract is the game file and the section is in the navigation',()=>{
 const html=fs.readFileSync(path.join(root,'balance-editor.html'),'utf8');
 assert.equal(html.split('<script id="story-model-v1">\n')[1].split('\n</script>')[0],fs.readFileSync(path.join(game,'js/story/story-model.js'),'utf8').trimEnd());
 assert.equal(html.split('<script id="prologue-editor-v1">\n')[1].split('\n</script>')[0],fs.readFileSync(path.join(root,'scripts/prologue-editor.js'),'utf8').trimEnd());
 assert(html.indexOf('id="prologue-editor-v1"')>html.indexOf('id="story-editor-v1"'));
 const r=editor();assert(r.run("SECTION_META.some(x=>x[0]==='prologue'&&x[1]==='序章劇情')"));assert(r.run("NAV_GROUPS.some(g=>g[2].includes('prologue'))"));
 assert.deepEqual(M.prologueIssues(M.prologueQuest(JSON.parse(r.run('JSON.stringify(STORY_SEED)'))),{}),[],'a document without a story starts from a seed that has the prologue');
});

// Game v0.167+: the onboarding (prologue version 2) runs inside the game screen. The game reads the goddess's opening
// lines, each stage's name and task-bar text, and the class option texts; the editor offers exactly those.
test('the onboarding stages render with fixed system events, the opening lines and the class options',()=>{
 const r=editor(),q=r.E.quest();assert.equal(q.prologue.version,2);r.E.open();const html=r.html();
 for(const s of q.stages)assert(html.includes('data-stage="'+s.id+'"'),s.id);
 for(const l of q.stages[0].dialogue)assert(html.includes('>'+l.text.replace(/&/g,'&amp;').replace(/</g,'&lt;')+'</textarea>'),l.text);
 for(const t of ['角色命名','選擇初始職業','發放並穿戴新手裝備','首次探索戰鬥（贏得一場戰鬥）','臨時隊友加入與上陣','降臨並結束序章'])assert(html.includes('系統事件：'+t+'（固定）'),t);
 for(const c of published.classes)assert(html.includes('<b>'+c.name+'</b>'),c.name);
 assert.match(html,/命名畫面的女神開場（4）/);assert.match(html,/暫定續寫 4 句/);assert.match(html,/prologue-line-draft/);
 assert.doesNotMatch(html,/data-pl-scene=/,'one scene: no scene navigation');assert.doesNotMatch(html,/data-pl="[^"]*&quot;(action|next|id|scene|hint|job)&quot;\]"/,'no control edits a system binding or an unused field');
 assert.equal((html.match(/data-pl-add=/g)||[]).length,1,'only the opening has editable lines');
 assert.match(html,/播放順序預覽（4 句）/);assert.match(html,/〔系統事件〕角色命名/);
 assert.deepEqual(r.errors,[]);
});

test('editing, adding, deleting and reordering text exports a document the game contract accepts',()=>{
 const r=editor(),creation=stageIndex(r,'creation'),calling=stageIndex(r,'calling'),practice=stageIndex(r,'practice');r.E.open();
 r.E.set(['stages',creation,'dialogue',0,'text'],'改寫的開場。');r.E.set(['stages',creation,'dialogue',3,'speaker'],'創世女神');r.E.set(['stages',creation,'dialogue',2,'source'],'original');
 r.E.addLine(['stages',creation,'dialogue'],{text:'新增的一句。'});const n=r.E.quest().stages[creation].dialogue.length;r.E.moveLine(['stages',creation,'dialogue'],n-1,-1);r.E.removeLine(['stages',creation,'dialogue'],1);
 r.E.set(['stages',calling,'prologue','options',0,'text'],'劍士');r.E.set(['stages',calling,'prologue','options',1,'description'],'操控元素');r.E.set(['stages',practice,'name'],'第一場戰鬥');r.E.set(['stages',practice,'description'],'新的任務提示。');
 assert.deepEqual(plain(r.E.issues()),[]);assert.deepEqual(plain(r.run('validateData()')).filter(x=>x.includes('序章')||x.includes('劇情')),[]);
 const out=r.out(),q=M.prologueQuest(out.story),d=q.stages[creation].dialogue;
 assert.equal(d[0].text,'改寫的開場。');assert.equal(d.length,n-1);assert.equal(d.at(-2).text,'新增的一句。');assert.equal(d.at(-2).source,'draft');assert.equal(d.find(l=>l.speaker==='創世女神').kind,'npc');assert.equal(d.filter(l=>l.source==='original').length,1);
 assert.equal(q.stages[calling].prologue.options[0].text,'劍士');assert.equal(q.stages[calling].prologue.options[1].description,'操控元素');assert.equal(q.stages[practice].name,'第一場戰鬥');assert.equal(q.stages[practice].description,'新的任務提示。');
 assert.deepEqual(q.stages.map(s=>[s.id,s.next,s.prologue.action,s.prologue.scene]),M.prologueQuest(published.story).stages.map(s=>[s.id,s.next,s.prologue.action,s.prologue.scene]),'stage ids, order and system events are untouched');
 assert.deepEqual(M.issues(out.story,{maps:out.balanceSettings.maps.catalog,monsters:out.balanceSettings.monsters.catalog,items:out.items,skills:out.skillSystem.definitions,forms:out.equipmentForms,companions:out.companions,classes:out.classes}),[]);
 // Round trip: the exported document loads back unchanged.
 const again=loadRuntime(root);again.ctx.doc=out;again.run('data=__EMBERWILD_VALIDATE_DOCUMENT(doc);ensureArrays();');assert.deepEqual(JSON.parse(again.run('JSON.stringify(__EMBERWILD_RELEASE_EDITOR.current().story)')),out.story);
 assert.deepEqual(r.errors,[]);
});

test('system bindings and fields the game does not read cannot be changed here, and a broken prologue blocks validation',()=>{
 const r=editor(),helper=stageIndex(r,'helper'),calling=stageIndex(r,'calling');
 for(const path of [['stages',helper,'prologue','action'],['stages',helper,'next'],['stages',helper,'id'],['stages',helper,'prologue','scene'],['stages',helper,'prologue','hint'],['stages',calling,'prologue','options',0,'job'],['prologue','version'],['prologue','scenes',0,'name'],['stages',helper,'prologue'],['stages',helper,'dialogue'],['stages',helper,'speaker']])assert.throws(()=>r.E.set(path,'x'),/不能在序章劇情編輯/,path.join('.'));
 assert.throws(()=>r.E.removeLine(['stages'],helper),/不是可編輯的對話清單/);assert.throws(()=>r.E.addLine(['stages',calling,'prologue','options']),/不是可編輯的對話清單/);assert.throws(()=>r.E.addLine(['stages',helper,'dialogue']),/不是可編輯的對話清單/,'later stages show no lines in the game');
 assert.deepEqual(plain(r.E.issues()),[]);
 // The general story designer can still restructure the quest; the shared contract then reports it and validation fails.
 r.run("__EMBERWILD_STORY_EDITOR.select('prologue');const q=__EMBERWILD_STORY_EDITOR.design().quests.find(q=>q.prologue),i=q.stages.findIndex(s=>s.id==='helper');q.stages[i-1].next=q.stages[i].next;q.stages.splice(i,1);");
 assert.match(r.E.issues().join('\n'),/操作引導必須依序包含/);assert.match(r.run('validateData()').join('\n'),/序章：操作引導必須依序包含/);
 r.E.open();assert.match(r.html(),/序章資料有 \d+ 個問題，修正前無法發布/);
});
