// 教學管理: the embedded contract is the game file, edits reach the exported document, invalid settings are reported,
// published ids stay fixed, and publication needs a game that supports tutorials.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {loadRuntime}=require('./headless-editor.cjs'),root=path.resolve(__dirname,'..'),game=path.resolve(process.env.EMBERWILD_GAME_ROOT||path.join(root,'../DreamingAbyss'));
const published=JSON.parse(fs.readFileSync(path.join(game,'data/balance.json'),'utf8')),M=require(path.join(game,'js/story/tutorial-model.js'));
const plain=x=>JSON.parse(JSON.stringify(x));
function editor(doc=published){const r=loadRuntime(root);r.ctx.doc=structuredClone(doc);r.run('data=__EMBERWILD_VALIDATE_DOCUMENT(doc);ensureArrays();');r.E=r.ctx.__EMBERWILD_TUTORIAL_EDITOR;r.html=()=>r.elements.get('app').innerHTML;r.out=()=>JSON.parse(r.run('JSON.stringify(__EMBERWILD_RELEASE_EDITOR.current())'));return r;}

test('the embedded tutorial contract is the game file and the page is in the navigation',()=>{
 const html=fs.readFileSync(path.join(root,'balance-editor.html'),'utf8');
 assert.equal(html.split('<script id="tutorial-model-v1">\n')[1].split('\n</script>')[0],fs.readFileSync(path.join(game,'js/story/tutorial-model.js'),'utf8').trimEnd());
 assert.equal(html.split('<script id="tutorial-editor-v1">\n')[1].split('\n</script>')[0],fs.readFileSync(path.join(root,'scripts/tutorial-editor.js'),'utf8').trimEnd());
 const r=editor();assert(r.run("SECTION_META.some(x=>x[0]==='tutorials'&&x[1]==='教學管理')"));assert(r.run("NAV_GROUPS.some(g=>g[2].includes('tutorials'))"));
});

test('the list and the module editor show every field; only supported types can be chosen',()=>{
 const r=editor();r.E.open('explore_basics');const html=r.html();
 for(const m of published.tutorials.modules)assert(html.includes('data-tutorial-row="'+m.id+'"'),m.id);
 assert.match(html,/教學資料驗證通過/);assert.match(html,/首次進入頁面時開始：荒野探索/);
 for(const s of published.tutorials.modules[0].steps)assert(html.includes('data-tutorial-step="'+s.id+'"'),s.id);
 for(const label of Object.values(M.ADVANCE))assert(html.includes('>'+label+'</option>'),label);
 assert.match(html,/已發布的 ID 固定不變/);assert.match(html,/在遊戲預覽中測試/);assert.match(html,/從指定步驟開始/);assert.match(html,/重複目前步驟/);
 assert.doesNotMatch(html,/<option value="script"/);assert.deepEqual(r.errors,[]);
});

test('adding, editing, reordering and disabling reach the exported document and pass the game rules',()=>{
 const r=editor(),skillIndex=published.tutorials.modules.findIndex(m=>m.id==='skill_basics');r.E.open('skill_basics');
 r.E.set(['modules',skillIndex,'steps',0,'text'],'改寫的技能槽說明。');r.E.moveStep(0,1);r.E.set(['modules',skillIndex,'trigger','notify'],true);r.E.set(['modules',skillIndex,'trigger','notifyText'],'技能頁開放了。');
 const id=r.E.addModule(),index=published.tutorials.modules.length;
 for(const [key,value] of [['title','夥伴'],['category','companions']])r.E.set(['modules',index,key],value);
 r.E.set(['modules',index,'trigger','type'],'pageEnter');r.E.set(['modules',index,'trigger','page'],'partnerRoster');
 r.E.set(['modules',index,'prerequisites','conditions',0,'type'],'companions');r.E.set(['modules',index,'prerequisites','conditions',0,'count'],1);
 r.E.moveModule(index,-1);r.E.set(['modules',0,'enabled'],false);
 assert.deepEqual(plain(r.E.issues()),[]);const out=r.out(),t=out.tutorials;
 assert.deepEqual(M.issues(t,{quests:out.story.quests,items:out.items}),[]);
 const expected=[...published.tutorials.modules.map(m=>m.id),id];[expected[index],expected[index-1]]=[expected[index-1],expected[index]];
 assert.deepEqual(t.modules.map(m=>m.id),expected);assert.equal(t.modules[0].enabled,false);
 const skill=t.modules.find(m=>m.id==='skill_basics'),added=t.modules.find(m=>m.id===id);
 assert.equal(skill.steps[1].text,'改寫的技能槽說明。');assert.equal(skill.trigger.notifyText,'技能頁開放了。');
 assert.deepEqual(added.prerequisites.conditions[0],{type:'companions',key:'',count:1});assert.equal(added.implemented,false);
 assert.equal(r.run("validateData().filter(x=>x.startsWith('教學')).length"),0);
});

test('invalid settings are listed and block validation; published ids and modules cannot be removed',()=>{
 const r=editor();r.E.open('explore_basics');
 assert.throws(()=>r.E.set(['modules',0,'id'],'renamed'),/已發布的教學 ID 不能更改/);
 assert.throws(()=>r.E.removeModule(0),/已發布的教學不能刪除/);
 r.E.set(['modules',0,'steps',2,'advance','type'],'event');
 assert.match(r.E.issues().join('\n'),/遊戲不支援這個事件/,'an event step without an event is reported');
 r.E.set(['modules',0,'prerequisites','conditions',0,'type'],'tutorialDone');r.E.set(['modules',0,'prerequisites','conditions',0,'key'],'explore_basics');
 assert.match(r.E.issues().join('\n'),/前置條件不能是自己/);
 assert.match(r.html(),/教學資料有 \d+ 個問題/);assert(r.run("validateData().some(x=>x.startsWith('教學'))"));
 assert.match(plain(r.run('EmberwildBalanceDocument.inspect(data).filter(x=>x.system==="教學").map(x=>x.reason).join("\\n")')),/遊戲不支援這個事件/);
});

test('a document without tutorials can add the built-in ones; the preview test needs the developer shell',async()=>{
 const doc=structuredClone(published);delete doc.tutorials;const r=editor(doc);r.E.open();
 assert.match(r.html(),/加入內建教學/);assert.equal(r.E.seed(),true);assert.deepEqual(plain(r.out().tutorials),M.defaults());
 r.E.select('explore_basics');await r.E.runTest(0);assert.match(r.E.testError,/開發者模式/,'outside the shell the test explains where it works');
});

test('publishing tutorials requires a target game that advertises tutorialsVersion',async()=>{
 const {ReleaseService}=require('../server/release-service.cjs');const head='a'.repeat(40),source='b'.repeat(40);let supported=false;
 const candidate={tutorials:published.tutorials};
 const s=new ReleaseService({validate:x=>x,api:async p=>{
  if(p.includes('/git/ref/heads/'))return {object:{sha:p.endsWith('main')?head:source}};
  if(p.includes('/compare/'))return {status:'ahead'};
  if(p.includes('/contents/js/'))return {type:'file',encoding:'base64',content:Buffer.from(supported?'const api={tutorialsVersion:1,equipmentGemModeVersion:2,storyEquipmentLessonsVersion:1};':'const api={equipmentGemModeVersion:2,storyEquipmentLessonsVersion:1};').toString('base64')};
  return {type:'file',encoding:'base64',sha:head,content:Buffer.from(JSON.stringify(p.endsWith('ref='+head)?{}:candidate)).toString('base64')};
 }});
 const args={kind:'promote',sourceCommit:source,expectedCommit:head,message:'發布教學設定'};
 await assert.rejects(s.prepare(args,'s'),/尚未支援教學系統/);supported=true;assert.equal((await s.prepare(args,'s')).branch,'main');
});
