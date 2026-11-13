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

test('all eight scenes render their lines, system events are shown as fixed, sources are marked',()=>{
 const r=editor(),q=r.E.quest();
 for(let n=1;n<=8;n++){r.E.open(n);const html=r.html();assert.match(html,new RegExp('data-pl-scene="'+n+'" class="primary"'));for(const s of q.stages.filter(s=>s.prologue.scene===n)){assert(html.includes('data-stage="'+s.id+'"'),s.id);for(const l of [...s.dialogue,...s.prologue.after])assert(html.includes('>'+l.text.replace(/&/g,'&amp;').replace(/</g,'&lt;')+'</textarea>'),l.text);}}
 r.E.open(1);let html=r.html();assert.match(html,/系統事件：角色命名（固定）/);assert.match(html,/開發者原文 3 句/);assert.match(html,/prologue-line-original/);assert.match(html,/prologue-line-draft/);
 assert.doesNotMatch(html,/data-pl="[^"]*&quot;(action|next|id|scene)&quot;\]"/,'no control edits a system binding');
 r.E.open(3);html=r.html();assert.match(html,/系統事件：選擇初始職業（固定）/);for(const c of published.classes)assert(html.includes('<b>'+c.name+'</b>'),c.name);
 r.E.open(4);assert.match(r.html(),/系統事件：發放並穿戴新手裝備（固定）/);
 r.E.open(6);assert.match(r.html(),/系統事件：訓練戰鬥（戰鬥練習，2 個訓練對象）（固定）/);
 assert.match(r.html(),/播放順序預覽（\d+ 句）/);assert.match(r.html(),/〔系統事件〕角色命名/);assert.match(r.html(),/第一章：斷絕的商路/);
 assert.deepEqual(r.errors,[]);
});

test('editing, adding, deleting and reordering text exports a document the game contract accepts',()=>{
 const r=editor(),creation=stageIndex(r,'creation'),calling=stageIndex(r,'calling'),skills=stageIndex(r,'skills');r.E.open(1);
 r.E.set(['stages',creation,'dialogue',0,'text'],'改寫的開場旁白。');r.E.set(['stages',creation,'dialogue',3,'speaker'],'創世女神');r.E.set(['stages',creation,'dialogue',4,'source'],'original');
 r.E.addLine(['stages',creation,'dialogue'],{text:'新增的一句。'});const n=r.E.quest().stages[creation].dialogue.length;r.E.moveLine(['stages',creation,'dialogue'],n-1,-1);r.E.removeLine(['stages',creation,'dialogue'],1);
 r.E.set(['stages',calling,'prologue','options',0,'text'],'劍士');r.E.set(['stages',calling,'prologue','hint'],'新的職業提示');r.E.set(['stages',skills,'prologue','steps'],['第一步','第二步']);r.E.set(['stages',skills,'name'],'技能練習');
 r.E.set(['prologue','scenes',0,'name'],'造物之初');r.E.set(['prologue','chapter','title'],'第一章：新標題');r.E.set(['prologue','helper','name'],'光之助手');r.E.set(['prologue','ui','continue'],'往下');r.E.addLine(['prologue','chapter','lines'],{kind:'narrator',speaker:'旁白',text:'多一句轉場。'});
 assert.deepEqual(plain(r.E.issues()),[]);assert.deepEqual(plain(r.run('validateData()')).filter(x=>x.includes('序章')||x.includes('劇情')),[]);
 const out=r.out(),q=M.prologueQuest(out.story),d=q.stages[creation].dialogue;
 assert.equal(d[0].text,'改寫的開場旁白。');assert.equal(d.length,n-1);assert.equal(d.at(-2).text,'新增的一句。');assert.equal(d.at(-2).source,'draft');assert.equal(d.find(l=>l.speaker==='創世女神').kind,'npc');
 assert.equal(q.stages[calling].prologue.options[0].text,'劍士');assert.equal(q.stages[calling].prologue.hint,'新的職業提示');assert.deepEqual(q.stages[skills].prologue.steps,['第一步','第二步']);assert.equal(q.stages[skills].name,'技能練習');
 assert.equal(q.prologue.scenes[0].name,'造物之初');assert.equal(q.prologue.chapter.title,'第一章：新標題');assert.equal(q.prologue.helper.name,'光之助手');assert.equal(q.prologue.ui.continue,'往下');assert.equal(q.prologue.chapter.lines.at(-1).text,'多一句轉場。');
 assert.deepEqual(q.stages.map(s=>[s.id,s.next,s.prologue.action,s.prologue.scene]),M.prologueQuest(published.story).stages.map(s=>[s.id,s.next,s.prologue.action,s.prologue.scene]),'stage ids, order and system events are untouched');
 assert.deepEqual(M.issues(out.story,{maps:out.balanceSettings.maps.catalog,monsters:out.balanceSettings.monsters.catalog,items:out.items,skills:out.skillSystem.definitions,forms:out.equipmentForms,companions:out.companions,classes:out.classes}),[]);
 // Round trip: the exported document loads back unchanged.
 const again=loadRuntime(root);again.ctx.doc=out;again.run('data=__EMBERWILD_VALIDATE_DOCUMENT(doc);ensureArrays();');assert.deepEqual(JSON.parse(again.run('JSON.stringify(__EMBERWILD_RELEASE_EDITOR.current().story)')),out.story);
 assert.deepEqual(r.errors,[]);
});

test('system bindings cannot be changed here, and a broken prologue blocks validation',()=>{
 const r=editor(),skills=stageIndex(r,'skills');
 for(const path of [['stages',skills,'prologue','action'],['stages',skills,'next'],['stages',skills,'id'],['stages',skills,'prologue','scene'],['stages',2,'prologue','options',0,'job'],['prologue','version'],['stages',skills,'prologue'],['stages',skills,'dialogue']])assert.throws(()=>r.E.set(path,'x'),/不能在序章劇情編輯/,path.join('.'));
 assert.throws(()=>r.E.removeLine(['stages'],skills),/不是可編輯的對話清單/);assert.throws(()=>r.E.addLine(['stages',2,'prologue','options']),/不是可編輯的對話清單/);
 assert.deepEqual(plain(r.E.issues()),[]);
 // The general story designer can still restructure the quest; the shared contract then reports it and validation fails.
 r.run("__EMBERWILD_STORY_EDITOR.select('prologue');const q=__EMBERWILD_STORY_EDITOR.design().quests.find(q=>q.prologue),i=q.stages.findIndex(s=>s.id==='skills');q.stages[i-1].next=q.stages[i].next;q.stages.splice(i,1);");
 assert.match(r.E.issues().join('\n'),/系統事件必須各出現一次並依序排列/);assert.match(r.run('validateData()').join('\n'),/序章：系統事件必須各出現一次/);
 r.E.open(5);assert.match(r.html(),/序章資料有 \d+ 個問題，修正前無法發布/);
});
