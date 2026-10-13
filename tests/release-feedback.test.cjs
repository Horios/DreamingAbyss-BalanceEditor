const test=require('node:test'),assert=require('node:assert/strict'),{loadRuntime}=require('./headless-editor.cjs');
test('release click immediately reports pending, preserves confirmation, blocks duplicates and ends with success',async()=>{
 const r=loadRuntime(process.cwd());r.run('currentSection="releases";render();');const E=r.ctx.__EMBERWILD_RELEASE_EDITOR,app=r.elements.get('app'),button=r.elements.get('releaseCommit'),confirmation=r.ctx.document.getElementById('releaseConfirm');button.tagName='BUTTON';confirmation.checked=true;app.querySelectorAll=()=>[button,confirmation];r.ctx.document.activeElement=button;
 let finish,called=0;const pending=new Promise(resolve=>finish=resolve),task=E.action(async()=>{called++;await pending;E.state.status='發布成功：fixture';});
 assert.equal(E.state.busy,true);assert.match(r.elements.get('releaseStatus').textContent,/正在提交/);assert.equal(button.disabled,true);assert.equal(confirmation.checked,true);assert.equal(app.attributes['aria-busy'],'true');await E.action(()=>called++);assert.equal(called,1);finish();await task;assert.equal(E.state.busy,false);assert.equal(E.state.feedbackKind,'success');assert.match(app.innerHTML,/發布成功：fixture/);assert.equal(app.attributes['aria-busy'],undefined);
});
test('errors remain visible and network uncertainty tells the user to verify before retrying',async()=>{
 const r=loadRuntime(process.cwd()),E=r.ctx.__EMBERWILD_RELEASE_EDITOR;r.run('currentSection="releases";render();');E.state.prepared={ticket:'fixture'};await E.action(async()=>{throw Error('版本衝突');});assert.equal(E.state.busy,false);assert.equal(E.state.prepared,null);assert.equal(E.state.feedbackKind,'error');assert.match(r.elements.get('app').innerHTML,/操作未完成：版本衝突/);
 E.state.csrf='fixture';r.ctx.fetch=async()=>{throw Error('offline');};await assert.rejects(E.api('commit',{}),/先取得線上版本核對，勿重複發布/);
 const html=r.elements.get('app').innerHTML;for(const text of ['完整發布流程','建立測試版摘要','正式版','十分鐘','還原','檢查部署狀態'])assert(html.includes(text),text);assert(html.indexOf('releaseFeedback')<html.indexOf('完整發布流程'));assert.deepEqual(r.errors,[]);
});
