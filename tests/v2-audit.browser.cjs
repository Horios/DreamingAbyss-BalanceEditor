/* Read-only developer entry; reuse the game's pinned browser/runtime harness. */
const assert=require('node:assert/strict'),path=require('node:path');
// CI installs Playwright in the adjacent game checkout, not in this repository.
process.env.NODE_PATH=process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES||path.resolve(__dirname,'../../Emberwild/node_modules');
require('node:module').Module._initPaths();
const {openRuntime}=require('../../Emberwild/tests/runtime.cjs');
(async()=>{
 const g=await openRuntime(path.resolve(__dirname,'..'),'balance-audit.html'),p=g.page;
 try{
  await p.waitForFunction(()=>document.querySelector('#rows tr'));
  assert.deepEqual(await p.evaluate(()=>['EmberwildBalanceDocument','EmberwildSkillSystem','EmberwildMechanisms','EmberwildSecondsSchema'].map(k=>typeof globalThis[k])),['object','object','object','object']);
  assert.equal(await p.locator('#rows tr').count(),60);
  await p.locator('#next').click();assert((await p.locator('#count').innerText()).includes('第 2 /'));
  await p.locator('#search').fill('timing');
  assert((await p.locator('#rows tr').allTextContents()).every(x=>x.toLowerCase().includes('timing')));
  await p.locator('#presence').selectOption('effective');
  await p.locator('#role').selectOption('compatibility-projection-or-adapter');
  assert(await p.locator('#rows tr').count()>0,'effective skill timing projections remain searchable');
  for(const row of await p.locator('#rows tr').allTextContents())assert.match(row,/compatibility-projection-or-adapter/);
  await p.setViewportSize({width:390,height:844});
  assert.equal(await p.locator('#search').isVisible(),true);
  assert.equal(await p.evaluate(()=>localStorage.length),0,'audit entry never writes a draft');
  assert.deepEqual(g.errors,[]);console.log('V2 read-only browser smoke passed');
 }finally{await g.browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
