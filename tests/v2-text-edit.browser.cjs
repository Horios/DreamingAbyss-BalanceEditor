'use strict';
/* Developer mode (開發者模式) · 改文字: click any text on the game screen, edit it in a dialog, and the game's
   textOverrides layer applies it everywhere. Requires a game runtime with textOverridesVersion 1 (v0.119+). */
const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'playwright'));
const {createPreviewServer}=require('../scripts/serve-v2.cjs');
(async()=>{const server=await createPreviewServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
 try{
  browser=await chromium.launch({headless:true,args:['--no-sandbox'],...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})});
  const p=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto('http://127.0.0.1:'+server.address().port+'/v2');
  await p.waitForFunction(()=>!document.getElementById('devApply').disabled,{},{timeout:60000});
  const game=p.frameLocator('#devGame'),frame=p.frame({url:/\/v2-game\//});
  assert.equal(await frame.evaluate(()=>EmberwildBalanceDocument.textOverridesVersion),1,'the packaged game supports text overrides');
  await frame.evaluate(()=>{selectSaveSlot(1);start(0);clearInterval(timer);closeModal();setTab('battle');});
  const tool=game.locator('.dev-text-tool');await tool.waitFor();
  assert.equal(await tool.getAttribute('aria-pressed'),'false');
  await tool.click();assert.equal(await tool.getAttribute('aria-pressed'),'true');

  // 1. Fixed text: the tab label.
  const tabBefore=await frame.evaluate(()=>tab);
  await game.locator('[data-page="statistics"], button:has-text("戰鬥統計")').first().click();
  assert.equal(await frame.evaluate(()=>tab),tabBefore,'picking text does not run the control under it');
  const dialog=p.locator('#devInlineDialog');await dialog.waitFor({state:'visible'});
  assert.equal(await p.locator('#devInlineTitle').innerText(),'修改畫面文字');
  assert.equal(await p.locator('#devInline-source').inputValue(),'戰鬥統計');
  assert.equal(await p.locator('#devInline-source').getAttribute('readonly'),'');
  await p.locator('#devInline-text').fill('夢境統計');await p.locator('#devInlineSave').click();
  await dialog.waitFor({state:'hidden'});
  await frame.waitForFunction(()=>document.body.innerText.includes('夢境統計'));
  assert.doesNotMatch(await frame.evaluate(()=>document.body.innerText),/戰鬥統計/);

  // 2. Text with numbers becomes a {#} template and keeps the live values.
  const gold=await frame.evaluate(()=>party.members[0].gold);
  const goldText=game.getByText(/^金幣 [\d,]+$/).filter({visible:true}).first();await goldText.click();await dialog.waitFor({state:'visible'});
  assert.equal(await p.locator('#devInline-source').inputValue(),'金幣 {#}');
  assert.equal(await p.locator('#devInline-shown').inputValue(),'金幣 '+gold.toLocaleString());
  await p.locator('#devInline-text').fill('夢幣 ×{#}');await p.locator('#devInlineSave').click();await dialog.waitFor({state:'hidden'});
  await frame.waitForFunction(g=>document.body.innerText.includes('夢幣 ×'+g),gold.toLocaleString());

  // The draft carries both overrides and validates as a game document.
  const doc=await p.evaluate(()=>document.getElementById('devEditor').contentWindow.__EMBERWILD_V2_BRIDGE.current());
  assert.deepEqual(doc.textOverrides,{version:1,entries:[{source:'戰鬥統計',text:'夢境統計'},{source:'金幣 {#}',text:'夢幣 ×{#}'}]});

  // 3. Clicking overridden text edits the same original; 還原原文 removes it.
  await game.locator('button:has-text("夢境統計")').first().click();await dialog.waitFor({state:'visible'});
  assert.equal(await p.locator('#devInline-source').inputValue(),'戰鬥統計');
  assert.equal(await p.locator('#devInline-text').inputValue(),'夢境統計');
  await p.locator('#devInlineExtra button',{hasText:'還原原文'}).click();await dialog.waitFor({state:'hidden'});
  await frame.waitForFunction(()=>document.body.innerText.includes('戰鬥統計'));
  const after=await p.evaluate(()=>document.getElementById('devEditor').contentWindow.__EMBERWILD_V2_BRIDGE.current().textOverrides);
  assert.deepEqual(after,{version:1,entries:[{source:'金幣 {#}',text:'夢幣 ×{#}'}]});

  // 4. Invalid text is refused without changing the draft.
  await game.getByText(/^夢幣 ×[\d,]+$/).filter({visible:true}).first().click();await dialog.waitFor({state:'visible'});
  await p.locator('#devInline-text').fill('字'.repeat(2001));await p.locator('#devInlineSave').click();
  assert.match(await p.locator('#devInlineError').innerText(),/過長/);
  await p.locator('#devInlineCancel').click();
  assert.deepEqual(await p.evaluate(()=>document.getElementById('devEditor').contentWindow.__EMBERWILD_V2_BRIDGE.current().textOverrides),after);

  // 5. Esc leaves text picking; game controls work again.
  // Focus is on the developer page after the dialog closes; Esc there ends picking too.
  await p.keyboard.press('Escape');
  assert.equal(await tool.getAttribute('aria-pressed'),'false');
  await frame.evaluate(()=>setTab('battle'));
  await game.locator('[data-page="statistics"], button:has-text("戰鬥統計")').first().click();
  await frame.waitForFunction(()=>tab==='statistics');
  assert.equal(await dialog.isVisible(),false);

  // 6. Control mode (總控模式) shows no text tool.
  await p.locator('#modeControl').click();
  await frame.waitForFunction(()=>!document.querySelector('.dev-text-tool'));
  assert.deepEqual(errors,[]);
  console.log('v2 text edit: ok');
 }finally{await browser?.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
