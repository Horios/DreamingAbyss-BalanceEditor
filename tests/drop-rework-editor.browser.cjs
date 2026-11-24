/* v0.206: drop pools, exclusive enhancement bindings, bag settings labels and obsolete drop types in the designer. */
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const moduleRoot=process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
const {chromium}=require(moduleRoot?path.join(moduleRoot,'playwright'):'playwright');
const root=path.resolve(__dirname,'..');
const doc=JSON.parse(fs.readFileSync(path.resolve(root,process.env.EMBERWILD_GAME_ROOT||'../DreamingAbyss','data/balance.json')));
(async()=>{
 const server=http.createServer((_req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(fs.readFileSync(path.join(root,'balance-editor.html')));});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})});
 try{
  const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));page.on('dialog',dialog=>dialog.accept());
  await page.route('**/api/**',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({csrf:'fixture',capabilities:{publishing:false},branch:'chatgpt-dev',commit:'a'.repeat(40),data:doc})}));
  await page.goto('http://127.0.0.1:'+server.address().port+'/');
  // An old document with obsolete rules loses them on import.
  const old=structuredClone(doc);old.balanceSettings.drops.entries.push({id:'gear_normal',name:'一般裝備',enabled:true,type:'gear',key:'',kinds:['normal'],chanceByDifficulty:[0.002,0.0027,0.0034],quantityMin:1,quantityMax:1,sources:['map0_mob0']});
  await page.evaluate(snapshot=>{data=__EMBERWILD_VALIDATE_DOCUMENT(snapshot);ensureArrays();},old);
  assert.equal(await page.evaluate(()=>data.balanceSettings.drops.entries.some(x=>x.type==='gear')),false);
  assert.deepEqual(await page.evaluate(()=>Object.keys(DROP_TYPE_LABELS).filter(k=>['gear','gearLegendary','dust','potion'].includes(k))),[]);
  assert(await page.evaluate(()=>'monsterGear' in DROP_TYPE_LABELS&&'gemPool' in DROP_TYPE_LABELS));
  await page.evaluate(()=>{renderBalanceSettings();});
  const html=await page.content();
  assert.match(html,/背包容量・寶石/);assert.match(html,/寶石粉塵升級倍率/);assert.match(html,/專屬素材消耗・強化至 \+12/);assert.match(html,/怪物專屬裝備強化素材/);
  assert.doesNotMatch(html,/difficulty\.modes\.0\.equipmentChance/);
  // Edit a monster's general equipment pool: add a second form, then try a third (blocked).
  const i=await page.evaluate(()=>data.balanceSettings.drops.entries.findIndex(x=>x.id==='gear_pool_map0_mob0_normal'));
  assert(i>=0);
  await page.evaluate(i=>{data.balanceSettings.drops.entries[i].pool=[data.balanceSettings.drops.entries[i].pool[0]];currentSection='balanceSettings:drops';render();},i);
  // Page through the managed drop table until the rule is shown.
  for(let k=0;k<30&&!(await page.locator('[data-drop-pool="gear_pool_map0_mob0_normal"]').count());k++)await page.evaluate(()=>document.getElementById('managedDropNext').click());
  await page.waitForSelector('[data-drop-pool="gear_pool_map0_mob0_normal"]');
  await page.locator(`[data-drop-pool="gear_pool_map0_mob0_normal"] .drop-pool-add`).click();
  assert.equal(await page.evaluate(i=>data.balanceSettings.drops.entries[i].pool.length,i),2);
  assert(await page.locator(`[data-drop-pool="gear_pool_map0_mob0_normal"] .drop-pool-add`).isDisabled());
  await page.locator(`[data-drop-pool="gear_pool_map0_mob0_normal"] .drop-pool-row[data-pool-index="1"] .drop-pool-weight`).fill('3');await page.locator(`[data-drop-pool="gear_pool_map0_mob0_normal"] .drop-pool-row[data-pool-index="1"] .drop-pool-weight`).dispatchEvent('change');
  assert.equal(await page.evaluate(i=>data.balanceSettings.drops.entries[i].pool[1].weight,i),3);
  // Exclusive bindings: add one, remove it; validation lists bad pools.
  const n=await page.evaluate(()=>data.balanceSettings.equipment.exclusiveEnhance.bindings.length);
  await page.evaluate(()=>{data.balanceSettings.equipment.exclusiveEnhance.bindings.pop();currentSection='balanceSettings:equipment';render();});
  await page.locator('#addExclusiveBinding').click();
  assert.equal(await page.evaluate(()=>data.balanceSettings.equipment.exclusiveEnhance.bindings.length),n);
  await page.evaluate(i=>{data.balanceSettings.drops.entries[i].pool.push({key:'form:0:0:0',weight:1});},i);
  assert(await page.evaluate(()=>validateData().some(x=>/1～2 種/.test(x))));
  assert.deepEqual(errors.filter(x=>!/Failed to load|net::/.test(x)),[]);
  console.log('drop rework editor browser test passed');
 }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);process.exit(1);});
