'use strict';
// Developer mode: add and edit maps from dialogs opened on the game's own exploration screen.
const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'playwright'));
const {createPreviewServer}=require('../scripts/serve-v2.cjs');
(async()=>{const server=await createPreviewServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
 try{
  browser=await chromium.launch({headless:true,args:['--no-sandbox'],...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})});
  const p=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto('http://127.0.0.1:'+server.address().port+'/v2');
  await p.waitForFunction(()=>/資料編輯已就緒/.test(document.getElementById('devStatus').textContent),{},{timeout:90000});
  const game=p.frameLocator('#devGame'),editor=p.frameLocator('#devEditor');
  await game.locator('body').evaluate(()=>{selectSaveSlot(1);start(0);clearInterval(timer);closeModal();setTab('battle');});
  const tools=game.locator('.dev-inline-tools');await tools.waitFor({timeout:10000});
  const before=await game.locator('body').evaluate(()=>MAPS.length);

  // Add a map from the game screen.
  await tools.getByRole('button',{name:'＋ 新增地圖'}).click();
  const dialog=p.locator('#devInlineDialog');await dialog.waitFor();assert.equal(await dialog.evaluate(d=>d.open),true);
  assert.match(await p.locator('#devInlineTitle').innerText(),/新增地圖/);
  await p.locator('#devInline-name').fill('開發者測試地圖');await p.locator('#devInline-min').fill('61');await p.locator('#devInline-max').fill('65');
  await p.locator('#devInlineSave').click();
  await p.waitForFunction(()=>!document.getElementById('devInlineDialog').open);
  assert.equal(await game.locator('body').evaluate(()=>MAPS.length),before+1,'the preview has the new map');
  assert.equal(await game.locator('body').evaluate((_,n)=>MAPS[n].name,before),'開發者測試地圖');
  assert.equal(await editor.locator('body').evaluate(()=>validateData().length),0,'the draft stays valid');
  assert.equal(await editor.locator('body').evaluate((_,n)=>data.balanceSettings.maps.catalog[n].min,before),61);
  assert.match(await p.locator('#devStatus').innerText(),/已新增並套用至預覽/);

  // Edit the first map; an invalid level range keeps the dialog open and changes nothing.
  await game.locator('body').evaluate(()=>{setTab('battle');selectExplorationMap(0);});
  await game.locator('.dev-inline-tools').getByRole('button',{name:'✎ 編輯此地圖'}).click();await dialog.waitFor();
  assert.equal(await p.locator('#devInline-mapType').count(),0,'existing maps do not change type here');
  await p.locator('#devInline-min').fill('40');await p.locator('#devInlineSave').click();
  assert.match(await p.locator('#devInlineError').innerText(),/最低等級不可高於最高等級/);assert.equal(await dialog.evaluate(d=>d.open),true);
  assert.equal(await editor.locator('body').evaluate(()=>data.balanceSettings.maps.catalog[0].min),1,'a rejected edit changes nothing');
  await p.locator('#devInline-min').fill('1');await p.locator('#devInline-name').fill('苔光林地（測試）');await p.locator('#devInlineSave').click();
  await p.waitForFunction(()=>!document.getElementById('devInlineDialog').open);
  assert.equal(await game.locator('body').evaluate(()=>MAPS[0].name),'苔光林地（測試）');

  // The full settings button opens the same map in the dock.
  await game.locator('.dev-inline-tools').getByRole('button',{name:'✎ 編輯此地圖'}).click();await p.locator('#devInlineFull').click();
  for(let i=0;i<50&&await editor.locator('body').evaluate(()=>currentSection)!=='world';i++)await p.waitForTimeout(100);
  assert.equal(await editor.locator('body').evaluate(()=>currentSection),'world');assert.equal(await p.locator('#devDock').isVisible(),true);
  assert.equal(await editor.locator('body').evaluate(()=>selected.worldMap),0);

  // Play-test mode hides the edit entry points; editing mode restores them.
  await p.locator('#devPlay').click();assert.equal(await game.locator('.dev-inline-tools').count(),0);
  await p.locator('#devPlay').click();await game.locator('.dev-inline-tools').waitFor();
  await p.setViewportSize({width:390,height:844});await p.locator('#devClose').click().catch(()=>{});
  await game.locator('.dev-inline-tools').getByRole('button',{name:'＋ 新增地圖'}).click();await dialog.waitFor();
  assert(await dialog.evaluate(d=>{const r=d.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&d.scrollWidth<=d.clientWidth+1;}),'the dialog fits a phone');
  await p.locator('#devInlineCancel').click();
  assert.deepEqual(errors,[]);console.log('V2 inline editing passed: add and edit maps from the game screen with validation, preview apply and full settings');
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;});
