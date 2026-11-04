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
  await p.waitForFunction(()=>/模式已就緒/.test(document.getElementById('devStatus').textContent),{},{timeout:90000});
  const game=p.frameLocator('#devGame'),editor=p.frameLocator('#devEditor');
  // Developer mode is the default and never shows the control console.
  assert.equal(await p.locator('#modeDeveloper').getAttribute('aria-pressed'),'true');assert.equal(await p.locator('#devDock').isVisible(),false);assert.equal(await p.locator('#devOpen').isVisible(),false);
  // Game v0.063: the exploration map list lives in the 冒險配置 dialog.
  await game.locator('body').evaluate(()=>{selectSaveSlot(1);start(0);clearInterval(timer);closeModal();setTab('battle');openAdventureConfig();});
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
  await game.locator('body').evaluate(()=>{setTab('battle');selectExplorationMap(0);openAdventureConfig();});
  await game.locator('.dev-inline-tools').getByRole('button',{name:'✎ 編輯此地圖'}).click();await dialog.waitFor();
  assert.equal(await p.locator('#devInline-mapType').count(),0,'existing maps do not change type here');
  await p.locator('#devInline-min').fill('40');await p.locator('#devInlineSave').click();
  assert.match(await p.locator('#devInlineError').innerText(),/最低等級不可高於最高等級/);assert.equal(await dialog.evaluate(d=>d.open),true);
  assert.equal(await editor.locator('body').evaluate(()=>data.balanceSettings.maps.catalog[0].min),1,'a rejected edit changes nothing');
  await p.locator('#devInline-min').fill('1');await p.locator('#devInline-name').fill('苔光林地（測試）');await p.locator('#devInlineSave').click();
  await p.waitForFunction(()=>!document.getElementById('devInlineDialog').open);
  assert.equal(await game.locator('body').evaluate(()=>MAPS[0].name),'苔光林地（測試）');

  assert.equal(await p.locator('#devDock').isVisible(),false,'saving in developer mode keeps the console hidden');
  // 在總控模式開啟 switches to control mode and opens the same map in the console.
  await game.locator('.dev-inline-tools').getByRole('button',{name:'✎ 編輯此地圖'}).click();await p.locator('#devInlineFull').click();
  for(let i=0;i<50&&await editor.locator('body').evaluate(()=>currentSection)!=='world';i++)await p.waitForTimeout(100);
  assert.equal(await editor.locator('body').evaluate(()=>currentSection),'world');assert.equal(await p.locator('#devDock').isVisible(),true);
  assert.equal(await editor.locator('body').evaluate(()=>selected.worldMap),0);

  assert.equal(await p.locator('#modeControl').getAttribute('aria-pressed'),'true');assert.equal(await game.locator('.dev-inline-tools').count(),0,'control mode has no in-game edit buttons');
  await p.locator('#modeDeveloper').click();assert.equal(await p.locator('#devDock').isVisible(),false,'developer mode hides the console');await game.locator('.dev-inline-tools').waitFor();
  // Lists on each page: switch class, edit an existing record, add a new one.
  const listButton=name=>game.locator('.dev-page-tools [data-dev-list="'+name+'"]');
  await game.locator('body').evaluate(()=>{closeModal();setTab('skills');});await listButton('skills').click();await dialog.waitFor();
  assert.match(await p.locator('#devInlineTitle').innerText(),/技能清單 · 戰士/);
  await p.locator('#devInlineTabs [data-list-job="1"]').click();assert.match(await p.locator('#devInlineTitle').innerText(),/技能清單 · 法師/);
  const mageSkill=await editor.locator('body').evaluate(()=>data.skillSystem.definitions.find(s=>s.jobs?.includes(1)&&s.partnerId==null&&s.type==='active'&&!s.deleted&&s.timing?.cooldownSeconds>0));
  await p.locator('.dev-list-row',{hasText:mageSkill.name}).first().click();await p.locator('#devInline-cooldownSeconds').waitFor();
  await p.locator('#devInline-cooldownSeconds').fill(String(mageSkill.timing.cooldownSeconds+2));await p.locator('#devInlineSave').click();
await p.waitForFunction(()=>/技能清單/.test(document.getElementById('devInlineTitle').textContent),{},{timeout:10000});
  assert.equal(await game.locator('body').evaluate((_,id)=>__EMBERWILD_SKILLS.byId(id).timing.cooldownSeconds,mageSkill.id),mageSkill.timing.cooldownSeconds+2,'the preview uses the edited cooldown');
  await p.locator('.dev-list-adds button',{hasText:'新增主動技能'}).click();await p.locator('#devInline-name').waitFor();
  assert.match(await p.locator('#devInlineTitle').innerText(),/編輯技能/);await p.locator('#devInlineCancel').click();
  // Equipment: add a weapon variant for the warrior.
  const forms=await game.locator('body').evaluate(()=>ITEM_FORMS[0][0].length);
  await game.locator('body').evaluate(()=>setTab('equipment'));await listButton('equipment').click();await dialog.waitFor();
  await p.locator('#devInlineFields button',{hasText:'＋ 新增武器'}).click();await p.locator('#devInline-name').fill('開發者測試劍');
  await p.locator('#devInlineEffects [data-part="value"]').first().fill('7');await p.locator('#devInlineSave').click();
  await p.waitForFunction(()=>/裝備清單/.test(document.getElementById('devInlineTitle').textContent),{},{timeout:10000});
  assert.equal(await game.locator('body').evaluate(()=>ITEM_FORMS[0][0].length),forms+1);assert.equal(await game.locator('body').evaluate(()=>ITEM_FORMS[0][0].at(-1).name),'開發者測試劍');
  await p.locator('#devInlineCancel').click();
  // Companions: add a mage companion.
  const companions=await editor.locator('body').evaluate(()=>data.companions.length);
  await game.locator('body').evaluate(()=>setTab('partnerRoster'));await listButton('companions').click();await dialog.waitFor();
  await p.locator('#devInlineTabs [data-list-job="1"]').click();await p.locator('.dev-list-adds button',{hasText:'新增夥伴'}).click();
  await p.locator('#devInline-name').fill('測試法師夥伴');await p.locator('#devInlineSave').click();
  await p.waitForFunction(()=>/夥伴清單/.test(document.getElementById('devInlineTitle').textContent),{},{timeout:10000});
  assert.equal(await editor.locator('body').evaluate(()=>data.companions.length),companions+1);
  assert.equal(await game.locator('body').evaluate(()=>exportableBalance().companions.some(c=>c.name==='測試法師夥伴'&&c.job===1)),true);
  await p.locator('#devInlineCancel').click();
  // Items: click a material slot in the bag.
  await game.locator('body').evaluate(()=>{state.materials['紅色草']=3;setTab('equipment');setInventoryCategory('materials');render();});
  const herb=game.locator('[data-item-kind="material"][data-item-key="紅色草"]').first();
  assert.equal(await herb.count(),1,'the bag lists the material');{await herb.click();await p.locator('#devInline-sellPrice').waitFor();await p.locator('#devInline-sellPrice').fill('4');await p.locator('#devInlineSave').click();
   await p.waitForFunction(()=>!document.getElementById('devInlineDialog').open);assert.equal(await game.locator('body').evaluate(()=>materialSellPrice('紅色草')),4);}
  // Monsters: add one to the current map, then edit an enemy card in battle.
  await game.locator('body').evaluate(()=>{setTab('battle');selectExplorationMap(0);openAdventureConfig();});
  await game.locator('.dev-inline-tools').getByRole('button',{name:'＋ 新增怪物'}).click();await p.locator('#devInline-name').fill('開發者測試怪');await p.locator('#devInlineSave').click();
  await p.waitForFunction(()=>!document.getElementById('devInlineDialog').open);
  assert.equal(await game.locator('body').evaluate(()=>monsterCatalog().some(m=>m.name==='開發者測試怪'&&m.mapIndex===0)),true);
  await game.locator('body').evaluate(()=>{closeModal();spawnGroup();running=true;render();});
  const enemy=game.locator('[data-enemy-id]').first();await enemy.click();await p.locator('#devInline-hpMultiplier').waitFor();
  await p.locator('#devInline-hpMultiplier').fill('2');await p.locator('#devInlineSave').click();await p.waitForFunction(()=>!document.getElementById('devInlineDialog').open);
  await game.locator('body').evaluate(()=>{running=false;});
  assert.deepEqual(await editor.locator('body').evaluate(()=>validateData()),[],'the draft stays valid after every dialog');
  // Play-test mode hides the edit entry points; editing mode restores them.
  await p.locator('#devPlay').click();assert.equal(await game.locator('.dev-inline-tools').count(),0);
  await p.locator('#devPlay').click();await game.locator('body').evaluate(()=>openAdventureConfig());await game.locator('.dev-inline-tools').waitFor();
  await p.setViewportSize({width:390,height:844});
  await game.locator('.dev-inline-tools').getByRole('button',{name:'＋ 新增地圖'}).click();await dialog.waitFor();
  assert(await dialog.evaluate(d=>{const r=d.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&d.scrollWidth<=d.clientWidth+1;}),'the dialog fits a phone');
  await p.locator('#devInlineCancel').click();
  assert.deepEqual(errors,[]);console.log('V2 inline editing passed: add and edit maps from the game screen with validation, preview apply and full settings');
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;});
