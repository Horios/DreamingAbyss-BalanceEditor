/* v0.204 inventory foundation: per-item stack overrides in the item workbench economy tab. */
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
  await page.evaluate(snapshot=>{data=__EMBERWILD_VALIDATE_DOCUMENT(snapshot);ensureArrays();__EMBERWILD_INVENTORY_ICON_EDITOR.open('inventoryIcons','all','material:紅色草');},doc);
  assert.deepEqual(await page.evaluate(()=>data.balanceSettings.inventory.capacities),{equipment:100,token:100,gem:100,material:100,consumable:100,special:100});
  await page.locator('[data-catalogue-tab="economy"]').click();
  assert.match(await page.locator('.catalogue-stack').innerText(),/分類預設堆疊上限 999/);
  await page.locator('#catalogueMaxStack').fill('50');await page.locator('#catalogueOccupiesSlot').uncheck();await page.locator('#catalogueSave').click();
  const s=await page.evaluate(()=>__EMBERWILD_INVENTORY_ICON_EDITOR.settings('material','紅色草'));assert.equal(s.maxStack,50);assert.equal(s.occupiesSlot,false);
  // Invalid values are rejected by the shared model validator and nothing is written.
  await page.locator('[data-catalogue-tab="economy"]').click();await page.locator('#catalogueMaxStack').fill('0');
  await page.locator('#catalogueSave').click().catch(()=>{});
  assert.equal(await page.evaluate(()=>__EMBERWILD_INVENTORY_ICON_EDITOR.settings('material','紅色草').maxStack),50);
  await page.locator('#catalogueStackReset').click();await page.locator('#catalogueSave').click();
  const r=await page.evaluate(()=>__EMBERWILD_INVENTORY_ICON_EDITOR.settings('material','紅色草'));assert.equal(r.maxStack,undefined);assert.equal(r.occupiesSlot,undefined);
  // Equipment shows the instance note instead of stack fields.
  const gearId=await page.evaluate(()=>__EMBERWILD_INVENTORY_ICON_EDITOR.query().find(x=>x.kind==='equipment').id);
  await page.evaluate(id=>__EMBERWILD_INVENTORY_ICON_EDITOR.select(id),gearId);await page.locator('[data-catalogue-tab="economy"]').click();
  assert.match(await page.locator('#catalogueTabBody').innerText(),/獨立物品，不可堆疊/);
  assert.deepEqual(errors.filter(x=>!/Failed to load|net::/.test(x)),[]);
  console.log('inventory stack fields browser test passed');
 }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);process.exit(1);});
