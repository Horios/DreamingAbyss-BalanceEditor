'use strict';
const assert=require('node:assert/strict'),path=require('node:path'),{chromium}=require(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'playwright'));
const {createPreviewServer}=require('../scripts/serve-v2.cjs');
(async()=>{const server=await createPreviewServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});const p=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto('http://127.0.0.1:'+server.address().port+'/v2');await p.waitForFunction(()=>!document.getElementById('devApply').disabled,{},{timeout:60000});await p.locator('#modeControl').click();
  await p.locator('#devAll').click();await p.locator('#devSettings').selectOption('statuses');const editor=p.frameLocator('#devEditor');
  await editor.locator('body').evaluate(()=>__EMBERWILD_STATUS_EDITOR_TEST_API.select('holy-prison-mark'));
  await editor.locator('#eventPermanent').uncheck();await p.waitForFunction(()=>document.getElementById('devEditor').contentDocument.getElementById('eventDurationSeconds').value==='594');
  await editor.locator('#eventDurationSeconds').fill('4.125');await editor.locator('#eventDurationSeconds').press('Tab');await p.locator('#devApply').click();
  assert.equal(await p.frameLocator('#devGame').locator('body').evaluate(()=>EmberwildSecondsCombat.source.statusDefinitions.find(s=>s.id==='holy-prison-mark').timing.durationSeconds),4.125);
  await editor.locator('#eventPermanent').check();await p.locator('#devApply').click();
  const status=await p.frameLocator('#devGame').locator('body').evaluate(()=>EmberwildSecondsCombat.source.statusDefinitions.find(s=>s.id==='holy-prison-mark'));assert.equal(status.permanent,true);assert.equal(status.timing.durationSeconds,null);
  assert.equal(await editor.locator('#eventDurationClock').isEnabled(),false);
  await p.locator('#devSettings').selectOption('combatMigration');await editor.locator('#secondsCategory').selectOption('passiveEvents');
  await editor.locator('[data-seconds-field="reductionSeconds"]').fill('6');await editor.locator('[data-seconds-field="reductionSeconds"]').press('Tab');
  assert.equal(await editor.locator('body').evaluate(()=>data.skillSystem.definitions.find(s=>s.id==='mage-mana-cycle').eventPassive.reduction),2);
  await editor.locator('body').evaluate(()=>__EMBERWILD_COMBAT_MIGRATION_AUDIT.select('tokens','revival'));assert.equal(await editor.locator('[data-seconds-field="firstTriggerSeconds"]').count(),0);assert.equal(await editor.locator('[data-seconds-field="durationSeconds"]').count(),0);
  // The skill form checks edits while typing and blocks applying a mana cost on a proc skill.
  await p.locator('#devSettings').selectOption('skillSystem');await editor.locator('body').evaluate(()=>__EMBERWILD_SKILL_SYSTEM_EDITOR.select('skills','job0-core2'));
  assert.match(await editor.locator('[data-skill-hint]').first().innerText(),/不使用耗魔/);
  const json=JSON.parse(await editor.locator('#canonicalSkillJSON').inputValue());json.timing.mpCost=3;
  await editor.locator('#canonicalSkillJSON').fill(JSON.stringify(json,null,2));
  await p.waitForFunction(()=>/無法套用：.*耗魔/.test(document.getElementById('devEditor').contentDocument.getElementById('canonicalSkillCheck').textContent));
  assert.equal(await editor.locator('#canonicalSkillApply').isDisabled(),true);
  json.timing.mpCost=0;json.power=Math.round((json.power+0.05)*1000)/1000;await editor.locator('#canonicalSkillJSON').fill(JSON.stringify(json,null,2));
  await p.waitForFunction(()=>/檢查通過/.test(document.getElementById('devEditor').contentDocument.getElementById('canonicalSkillCheck').textContent));
  await editor.locator('#canonicalSkillApply').click();
  assert.equal(await editor.locator('body').evaluate(()=>data.skillSystem.definitions.find(s=>s.id==='job0-core2').power),json.power);
  assert.deepEqual(errors,[]);console.log('Seconds authoring browser passed: finite/permanent round-trip, actual game apply, event seconds, compatibility clocks and conditional token fields');
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
