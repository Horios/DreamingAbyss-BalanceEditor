'use strict';
// Issue #2 B12/H05: the preview game refuses a new document while the team is exploring. The shell must say so
// and keep the draft marked as not applied; it must never report 已套用 while the game still runs the old values.
const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'playwright'));
const {createPreviewServer}=require('../scripts/serve-v2.cjs');
(async()=>{const server=await createPreviewServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
 try{
  browser=await chromium.launch({headless:true,args:['--no-sandbox'],...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})});
  const p=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto('http://127.0.0.1:'+server.address().port+'/v2');
  await p.waitForFunction(()=>!document.getElementById('devApply').disabled,{},{timeout:60000});
  await p.locator('#modeControl').click();
  const game=p.frameLocator('#devGame'),editor=p.frameLocator('#devEditor'),inGame=fn=>game.locator('body').evaluate(fn);
  await inGame(()=>{selectSaveSlot(1);start(0);clearInterval(timer);closeModal();});
  await p.locator('#devAll').click();await p.locator('#devSettings').selectOption('combatMigration');
  await editor.locator('body').evaluate(()=>{__EMBERWILD_COMBAT_MIGRATION_AUDIT.open();__EMBERWILD_COMBAT_MIGRATION_AUDIT.select('combat','mana');});
  const setMp=async n=>{await editor.locator('[data-seconds-field="maxMp"]').fill(String(n));await editor.locator('[data-seconds-field="maxMp"]').press('Tab');};
  const liveMp=()=>inGame(()=>EmberwildSecondsCombat.config().mana.maxMp),status=()=>p.locator('#devStatus').innerText(),draft=()=>p.locator('#devDraftState').innerText();
  // Idle team: applied, and the game holds the value.
  await setMp(123);await p.locator('#devApply').click();
  assert.match(await status(),/已套用至遊戲預覽/);assert.equal(await liveMp(),123);assert.match(await draft(),/目前草稿已套用/);
  // Exploring team: the game returns false; the shell reports the refusal and the stage of the draft.
  await inGame(()=>{setExplorationCategory('normal');selectExplorationMap(0);startSelectedExploration();clearInterval(timer);});
  assert.equal(await inGame(()=>running),true,'the preview team is exploring');
  await setMp(124);await p.waitForFunction(()=>document.getElementById('devDraftState').textContent.includes('尚未套用'));
  await p.locator('#devApply').click();
  assert.match(await status(),/無法套用：遊戲預覽正在探索或戰鬥中，沒有套用/);assert.doesNotMatch(await status(),/已套用/);
  assert.equal(await liveMp(),123,'the game still runs the previous value');assert.match(await draft(),/尚未套用/,'the draft is not marked as applied');
  assert.doesNotMatch(await status(),/重新整理/,'the modules that had already switched were put back');
  assert.equal(await inGame(()=>JSON.stringify(exportableBalance()).includes('"maxMp":124')),false,'no part of the refused document stays in the game');
  // After the exploration is stopped the same draft applies.
  await inGame(()=>{stopTeamExploration();if(typeof foes!=='undefined')foes=[];running=false;});
  await p.locator('#devApply').click();
  assert.match(await status(),/已套用至遊戲預覽/);assert.equal(await liveMp(),124);assert.match(await draft(),/目前草稿已套用/);
  assert.deepEqual(errors,[]);console.log('V2 apply refusal passed: exploring preview reports 無法套用, keeps the old value and the unapplied draft state; applies after stopping');
 }finally{await browser?.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
