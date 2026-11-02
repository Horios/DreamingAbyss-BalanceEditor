'use strict';
const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'playwright'));
const {createPreviewServer}=require('../scripts/serve-v2.cjs');
(async()=>{const server=await createPreviewServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
 try{
  browser=await chromium.launch({headless:true,args:['--no-sandbox'],...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})});
  const p=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto('http://127.0.0.1:'+server.address().port+'/v2');
  await p.waitForFunction(()=>!document.getElementById('devOpen').disabled,{},{timeout:60000});
  const game=p.frameLocator('#devGame'),editor=p.frameLocator('#devEditor');
  await game.locator('body').evaluate(()=>{selectSaveSlot(1);start(0);clearInterval(timer);closeModal();});
  await game.locator('body').evaluate(()=>setTab('skills'));
  await p.waitForFunction(()=>document.getElementById('devContext').textContent.startsWith('技能'));
  await p.locator('#devOpen').click();assert.equal(await p.locator('#devDock').isVisible(),true);
  assert.match(await editor.locator('body').innerText(),/技能/);
  await p.locator('#devAll').click();
  await editor.locator('body').evaluate(()=>{__EMBERWILD_COMBAT_MIGRATION_AUDIT.open();__EMBERWILD_COMBAT_MIGRATION_AUDIT.select('combat','mana');});
  await editor.locator('[data-seconds-field="maxMp"]').fill('123');await editor.locator('[data-seconds-field="maxMp"]').press('Tab');
  await p.locator('#devApply').click();assert.match(await p.locator('#devStatus').innerText(),/已套用至遊戲預覽/);
  assert.equal(await game.locator('body').evaluate(()=>EmberwildSecondsCombat.config().mana.maxMp),123);
  // A simulated save stays in the game frame's memory, never parent storage.
  await game.locator('body').evaluate(()=>localStorage.setItem('v2-test-only','isolated'));
  assert.equal(await p.evaluate(()=>localStorage.getItem('v2-test-only')),null);
  await p.locator('#devPublish').click();assert.equal(await editor.locator('#releasePreview').count(),1,'existing reviewed publishing flow is reused');
  await p.locator('#devClose').click();assert.equal(await p.locator('#devDock').isVisible(),false);
  await p.setViewportSize({width:390,height:844});await p.locator('#devOpen').click();
  assert(await p.locator('#devDock').evaluate(e=>e.getBoundingClientRect().width<=innerWidth));
  assert.equal(await game.locator('body').evaluate(()=>localStorage.getItem('v2-test-only')),'isolated');
  assert.deepEqual(errors,[]);console.log('V2 game shell passed: real game UI, contextual existing editor, apply, storage isolation, publishing and mobile');
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;});
