'use strict';
// 教學管理 → 在遊戲預覽中測試: the shell applies the draft, runs one module in the preview frame from the chosen step,
// reports its state back, and writes no tutorial progress. A refused apply is reported as a failure.
const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES?path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'playwright'):'playwright');
const {createPreviewServer}=require('../scripts/serve-v2.cjs');
(async()=>{const server=await createPreviewServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
 try{
  browser=await chromium.launch({headless:true,args:['--no-sandbox'],...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})});
  const p=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto('http://127.0.0.1:'+server.address().port+'/v2');
  await p.waitForFunction(()=>!document.getElementById('devApply').disabled,{},{timeout:60000});
  await p.locator('#modeControl').click();
  const game=p.frameLocator('#devGame'),editor=p.frameLocator('#devEditor'),E=fn=>p.evaluate(fn);
  await game.locator('body').evaluate(()=>{selectSaveSlot(1);start(0);clearInterval(timer);closeModal();});
  await game.locator('body').evaluate(()=>{for(let i=0;i<5&&__EMBERWILD_TUTORIAL.status().active;i++)tutorialControl('skipAll');});
  const before=await game.locator('body').evaluate(()=>JSON.stringify(party.tutorials));
  await p.evaluate(()=>DreamingAbyssShell.open('tutorials'));
  await editor.locator('[data-tutorial-row="skill_basics"] [data-tu-select]').click();
  // Edit the text, then test from the second step: the preview shows the edited draft.
  await editor.locator('[data-tutorial-step="catalog"] textarea').fill('預覽中的新說明。');await editor.locator('[data-tutorial-step="catalog"] textarea').dispatchEvent('change');
  await editor.locator('#tutorialTestStep').selectOption('1');await editor.locator('[data-tu-test="start"]').click();
  await editor.locator('.tutorial-test-status').waitFor();
  assert.match(await editor.locator('.tutorial-test-status').innerText(),/技能 · 第 2 \/ 5 步「技能圖鑑」（測試）/);
  assert.match(await editor.locator('.tutorial-test-status').innerText(),/skills\.catalog · 已找到/);
  assert.match(await game.locator('#tutorial-card').innerText(),/預覽中的新說明。/);
  assert.equal(await game.locator('body').evaluate(()=>tab),'skills');
  await editor.locator('[data-tu-control="next"]').click();
  await p.waitForFunction(()=>document.getElementById('devGame').contentWindow.__EMBERWILD_TUTORIAL.status().active?.stepId==='active');
  await editor.locator('[data-tu-control="restartStep"]').click();await editor.locator('[data-tu-control="close"]').click();
  await p.waitForFunction(()=>!document.getElementById('devGame').contentWindow.__EMBERWILD_TUTORIAL.status().active);
  assert.equal(await game.locator('body').evaluate(()=>JSON.stringify(party.tutorials)),before,'testing wrote no tutorial progress');
  // Repeat the same test: still works from the first step.
  await editor.locator('[data-tu-test="first"]').click();
  await p.waitForFunction(()=>document.getElementById('devGame').contentWindow.__EMBERWILD_TUTORIAL.status().active?.stepId==='slots');
  await editor.locator('[data-tu-control="close"]').click();
  // While the team explores the game refuses new data; the shell reports that and the test does not start.
  await game.locator('body').evaluate(()=>{setTab('battle');startSelectedExploration();});
  await editor.locator('[data-tu-test="first"]').click();
  await editor.locator('.tutorial-test .notice.bad').waitFor();
  assert.match(await editor.locator('.tutorial-test .notice.bad').innerText(),/草稿無法套用到預覽：.*遊戲拒絕套用/);
  assert.equal(await game.locator('body').evaluate(()=>!!__EMBERWILD_TUTORIAL.status().active),false);
  assert.deepEqual(errors,[]);console.log('tutorial preview test passed');
 }finally{await browser?.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
