/* Targeted item-workbench UI smoke test. No game exploration or combat loop. */
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const moduleRoot=process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
const {chromium}=require(moduleRoot?path.join(moduleRoot,'playwright'):'playwright');
const root=path.resolve(__dirname,'..');
const doc=JSON.parse(fs.readFileSync(path.resolve(root,'../DreamingAbyss/data/balance.json')));
(async()=>{
 const server=http.createServer((_req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(fs.readFileSync(path.join(root,'balance-editor.html')));});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})});
 try{
  const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));page.on('dialog',dialog=>dialog.accept());
  await page.route('**/api/**',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({csrf:'fixture',capabilities:{publishing:false},branch:'chatgpt-dev',commit:'a'.repeat(40),data:doc})}));
  await page.goto('http://127.0.0.1:'+server.address().port+'/');
  await page.evaluate(snapshot=>{data=__EMBERWILD_VALIDATE_DOCUMENT(snapshot);ensureArrays();__EMBERWILD_INVENTORY_ICON_EDITOR.open('inventoryIcons','all','item:heal_small');},doc);
  assert.equal(await page.locator('[data-inventory-icon-row]').count(),40);
  assert.equal(await page.locator('#inventoryLucideGrid').count(),0);
  const index=await page.evaluate(()=>__EMBERWILD_INVENTORY_ICON_EDITOR.diagnostics.indexBuilds);
  await page.locator('#managerName').fill('測試治療藥水');
  assert.equal(await page.evaluate(()=>data.items.find(x=>x.id==='heal_small').name),doc.items.find(x=>x.id==='heal_small').name);
  await page.locator('[data-catalogue-tab="consumable"]').click();
  await page.locator('#managerHealAmount').fill('40');await page.locator('#catalogueSave').click();
  assert.equal(await page.evaluate(()=>data.items.find(x=>x.id==='heal_small').healAmount),40);
  assert.equal(await page.evaluate(()=>data.items.find(x=>x.id==='heal_small').name),'測試治療藥水');
  assert.equal(await page.evaluate(()=>__EMBERWILD_INVENTORY_ICON_EDITOR.diagnostics.indexBuilds),index);
  await page.evaluate(()=>__EMBERWILD_INVENTORY_ICON_EDITOR.select('material:紅色草'));
  assert.equal(await page.locator('[data-catalogue-tab="equipment"]').count(),0);
  await page.locator('[data-catalogue-tab="appearance"]').click();
  assert.equal(await page.locator('[data-inventory-lucide]').count(),0);
  await page.locator('#inventoryColorEnabled').check();await page.locator('#inventoryIconColor').fill('#2244ff');await page.locator('#catalogueSave').click();
  assert.equal(await page.evaluate(()=>__EMBERWILD_INVENTORY_ICON_EDITOR.settings('material','紅色草').color),'#2244ff');
  await page.locator('[data-catalogue-tab="sources"]').click();await page.locator('[data-catalogue-reference]').first().click();await page.locator('#backToGlobalItems').click();
  assert.equal(await page.evaluate(()=>__EMBERWILD_INVENTORY_ICON_EDITOR.state.selectedId),'material:紅色草');
  await page.locator('#inventoryIconSearch').fill('material:紅色草');
  // The match count follows the current catalogue; the batch summary must agree with it.
  await page.waitForFunction(()=>document.querySelectorAll('[data-inventory-icon-row]').length===__EMBERWILD_INVENTORY_ICON_EDITOR.query().length);
  const matches=await page.evaluate(()=>__EMBERWILD_INVENTORY_ICON_EDITOR.query().length);assert(matches>=1);
  const price=await page.evaluate(()=>data.balanceSettings.economy.materialPrices.find(x=>x.key==='紅色草').sellPrice);
  await page.locator('#catalogueSelectPage').click();await page.locator('#catalogueBatch').click();
  await page.locator('#catalogueBatchOperation').selectOption('price');await page.locator('#catalogueBatchValue').fill('17');await page.locator('#catalogueBatchPreview').click();
  assert.equal(await page.evaluate(()=>data.balanceSettings.economy.materialPrices.find(x=>x.key==='紅色草').sellPrice),price);
  assert.match(await page.locator('#catalogueBatchSummary').textContent(),new RegExp(matches+' 件'));
  await page.locator('#catalogueBatchConfirm').click();assert.equal(await page.evaluate(()=>data.balanceSettings.economy.materialPrices.find(x=>x.key==='紅色草').sellPrice),17);
  await page.evaluate(()=>__EMBERWILD_INVENTORY_ICON_EDITOR.open('inventoryIcons','all','equipment:form:0:0:0'));
  assert.equal(await page.locator('#inventoryIconSearch').inputValue(),'');
  await page.locator('[data-catalogue-tab="equipment"]').click();await page.locator('#native-fixedEffects-0-key').selectOption('basicElement');
  await page.locator('#native-fixedEffects-0-value').selectOption('fire');await page.locator('#catalogueSave').click();
  assert.equal(await page.evaluate(()=>data.equipmentForms[0][0][0].fixedEffects[0].value),'fire');
  await page.locator('[data-catalogue-tab="basic"]').click();await page.locator('#managerDescription').fill('尚未套用的裝備說明');
  await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));await page.reload();
  await page.evaluate(()=>__EMBERWILD_INVENTORY_ICON_EDITOR.open('inventoryIcons','all','equipment:form:0:0:0'));await page.locator('[data-catalogue-tab="basic"]').click();
  assert.equal(await page.locator('#managerDescription').inputValue(),'尚未套用的裝備說明');await page.locator('#catalogueDiscard').click();
  await page.setViewportSize({width:390,height:844});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.equal(await page.evaluate(()=>__EMBERWILD_INVENTORY_ICON_EDITOR.diagnostics.fullValidations),0);
  assert.deepEqual(errors,[]);
  console.log('Item workbench browser smoke passed: bounded DOM, lazy tabs, drafts/reload, edits, search, source return, batch confirmation and mobile width.');
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exit(1);});

