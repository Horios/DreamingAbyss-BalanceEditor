// Issue #2 D09/H04/H05 in the workbench: a lost commit response is resolved by asking GitHub, the receipt is kept
// and updated by the deployment check, and a failure names its stage.
const test=require('node:test'),assert=require('node:assert/strict'),{loadRuntime}=require('./headless-editor.cjs');
const commit='c'.repeat(40),base='a'.repeat(40);
function open(routes){
 const r=loadRuntime(process.cwd()),E=r.ctx.__EMBERWILD_RELEASE_EDITOR,calls=[];let click=null;
 r.ctx.document.getElementById('releaseCommit').addEventListener=(type,fn)=>{if(type==='click')click=fn;};
 E.state.csrf='fixture';
 r.ctx.fetch=async(url,init)=>{const method=String(url).replace('/api/','');calls.push([method,init?.body?JSON.parse(init.body):null]);const out=routes[method];if(out instanceof Error)throw out;if(!out)throw Error('unexpected '+method);const [status,body]=typeof out==='function'?out():out;return {ok:status===200,status,json:async()=>body};};
 const prepare=()=>{E.state.prepared={ticket:'t',branch:'chatgpt-dev',currentVersion:base,nextVersion:'b'.repeat(12),message:'調整怪物生命',layout:'modular',modules:[{id:'world/monsters',title:'怪物'}],formatOnly:[{id:'meta/notes',title:'設計備註（僅供閱讀）'}],diff:{rows:[],total:1,added:0,modified:1,deleted:0}};r.run('currentSection="releases";render();');r.ctx.document.getElementById('releaseConfirm').checked=true;};
 return {r,E,calls,prepare,commit:()=>click(),html:()=>r.elements.get('app').innerHTML};
}
const receipt=()=>({schema:'dreaming-abyss-release-receipt-v1',commit,branch:'chatgpt-dev',stages:[{layer:'驗證',state:'通過'},{layer:'提交',state:'通過'},{layer:'CI',state:'未驗證'},{layer:'部署',state:'未驗證'},{layer:'載入',state:'未驗證'},{layer:'生效',state:'未驗證'}]});

test('the confirmation lists the modules to be written and names format-only ones',()=>{
 const w=open({});w.prepare();
 assert.match(w.html(),/寫入模組：怪物（world\/monsters）/);assert.match(w.html(),/設計備註（僅供閱讀） 沒有數值差異/);
});

test('a lost commit response asks GitHub: committed is reported as committed without sending the commit again',async()=>{
 const w=open({commit:Error('offline'),outcome:[200,{branch:'chatgpt-dev',state:'已提交',committed:true,commit,message:'線上已有這次發布的 commit，不需要重新提交。'}],snapshot:[200,{branch:'chatgpt-dev',commit,layout:'legacy',data:{}}]});
 w.prepare();await w.commit();
 assert.deepEqual(w.calls.map(c=>c[0]).filter(m=>m!=='snapshot'),['commit','outcome']);assert.deepEqual(w.calls[1][1],{branch:'chatgpt-dev',baseCommit:base,nextVersion:'b'.repeat(12)});
 assert.equal(w.E.state.lastCommit.commit,commit);assert.equal(w.E.state.feedbackKind,'success');assert.match(w.E.state.status,/已向 GitHub 查核：線上已有這次發布/);assert.equal(w.E.state.prepared,null);
});

test('a lost commit response that GitHub does not show stays a failure at the commit stage',async()=>{
 const w=open({commit:Error('offline'),outcome:[200,{branch:'chatgpt-dev',state:'未提交',committed:false,commit:null,message:'線上版本仍是發布前的 commit，本次發布沒有寫入。請重新建立摘要後再發布。'}]});
 w.prepare();await w.commit();
 assert.equal(w.E.state.feedbackKind,'error');assert.equal(w.E.state.lastCommit,undefined);
 assert.match(w.E.state.status,/操作未完成：.*已向 GitHub 查核：線上版本仍是發布前的 commit/);assert.match(w.E.state.status,/失敗層級：提交/);
 assert.equal(w.calls.filter(c=>c[0]==='commit').length,1,'never resubmitted');
});

test('a refused publish shows the stage the server named',async()=>{
 const w=open({commit:[409,{error:'線上版本已更新，請重新取得最新版並重新比較。',layer:'提交',issues:[]}]});
 w.prepare();await w.commit();
 assert.match(w.E.state.status,/操作未完成：線上版本已更新/);assert.match(w.E.state.status,/失敗層級：提交/);assert.equal(w.calls.length,1,'a real refusal is not followed by an outcome query');
});

test('the receipt is offered after a publish and the deployment check writes its layers into it',async()=>{
 const checks={expectedBlob:'e'.repeat(40),build:{state:'相符',commit,branch:'chatgpt-dev',balanceBlob:'e'.repeat(40)},data:{state:'不符',blob:'f'.repeat(40)},run:null};
 const w=open({commit:[200,{commit,branch:'chatgpt-dev',committed:true,message:'資料已提交，等待 GitHub Pages 部署。',receipt:receipt()}],snapshot:[200,{branch:'chatgpt-dev',commit,layout:'legacy',data:{}}],
  deployment:[200,{commit,branch:'chatgpt-dev',state:'部署未完成：網站的 data/balance.json 還不是這次發布的內容',layer:'載入',checks}]});
 w.prepare();await w.commit();
 assert.equal(w.E.state.receipt.commit,commit);assert.match(w.r.elements.get('releaseStatus').innerHTML,/下載發布收據|檢查部署狀態/);
 let saved=null;w.r.ctx.downloadText=(name,text)=>{saved={name,text};};
 await w.r.elements.get('releaseDeployment').onclick();
 assert.deepEqual(w.calls.at(-1),['deployment',{branch:'chatgpt-dev',commit}]);
 assert.match(w.E.state.status,/^部署未完成/);assert.match(w.E.state.status,/build\.json：相符/);assert.match(w.E.state.status,/網站 data\/balance\.json：不符/);assert.match(w.E.state.status,/尚未完成的層級：載入/);assert.match(w.E.state.status,/仍須實際開啟遊戲確認/);
 const stage=l=>w.E.state.receipt.stages.find(s=>s.layer===l);
 assert.equal(stage('部署').state,'通過');assert.equal(stage('載入').state,'不符');assert.equal(stage('CI').state,'未驗證');assert.equal(stage('生效').state,'未驗證');
 w.r.elements.get('releaseReceipt').onclick();
 if(saved){assert.match(saved.name,/^release-receipt-cccccccccccc\.json$/);assert.equal(JSON.parse(saved.text).stages.find(s=>s.layer==='載入').data.state,'不符');}
});
