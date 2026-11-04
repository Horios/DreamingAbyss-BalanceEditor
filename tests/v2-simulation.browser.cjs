'use strict';
// Developer-mode simulations run the draft in a hidden real game and compare it with the built-in data.
const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'playwright'));
const {createPreviewServer}=require('../scripts/serve-v2.cjs');
(async()=>{const server=await createPreviewServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
 try{
  browser=await chromium.launch({headless:true,args:['--no-sandbox'],...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})});
  const p=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto('http://127.0.0.1:'+server.address().port+'/v2');
  await p.waitForFunction(()=>/模式已就緒/.test(document.getElementById('devStatus').textContent),{},{timeout:90000});
  // The console lives in control mode (總控模式).
  await p.locator('#modeControl').click();
  const editor=p.frameLocator('#devEditor'),game=p.frameLocator('#devGame');
  const finished=()=>p.waitForFunction(()=>!document.getElementById('simRun').disabled&&!/試算中/.test(document.getElementById('simResult').textContent),{},{timeout:300000});
  const cells=async label=>p.locator('#simResult tr',{hasText:label}).first().locator('td').allInnerTexts();
  // Draft edits: shorter cooldown and a stronger fixed effect. Nothing is applied to the visible preview.
  await editor.locator('body').evaluate(()=>{
   const sk=data.skillSystem.definitions.find(s=>s.id==='job0-core0');__EMBERWILD_SKILL_SYSTEM_EDITOR.updateSkill(sk.id,{timing:{...sk.timing,cooldownSeconds:sk.timing.cooldownSeconds-3}});
   data.equipmentForms[0][0][0].fixedEffects=data.equipmentForms[0][0][0].fixedEffects.map(x=>x.key==='critDamage'?{...x,value:x.value+30}:x);markDirty('simulation test');
   __EMBERWILD_SKILL_SYSTEM_EDITOR.select('skills','job0-core0');
  });
  const cooldown=await game.locator('body').evaluate(()=>__EMBERWILD_SKILLS.byId('job0-core0').timing.cooldownSeconds);
  await p.locator('#devSim').click();
  assert.equal(await p.locator('#devSimPanel').isVisible(),true);assert.equal(await p.locator('#devEditor').isVisible(),false,'the panel takes the editor area');

  await p.locator('#simTabs [data-sim="skill"]').click();
  assert.equal(await p.locator('#simSkill').inputValue(),'job0-core0','the skill selected in the editor is preselected');
  await p.locator('#simRun').click();await finished();
  const [baseGap,draftGap]=(await cells('最短間隔')).slice(1).map(t=>parseFloat(t));
  assert(Math.abs(baseGap-cooldown)<=0.15,'built-in cooldown '+baseGap);
  assert(Math.abs(draftGap-(cooldown-3))<=0.15,'draft cooldown '+draftGap);
  const casts=(await cells('施放')).slice(1).map(Number);assert(casts[1]>casts[0],'a shorter cooldown casts more often');

  await p.locator('#simTabs [data-sim="equipment"]').click();await p.locator('#simForm1').selectOption('job0-slot0-form0');await p.locator('#simRun').click();await finished();
  const crit=(await p.locator('#simResult table').nth(1).locator('tr',{hasText:'暴擊傷害'}).first().locator('td').allInnerTexts()).slice(1);
  assert.notEqual(crit[0],crit[1],'the draft fixed effect changes worn stats: '+crit.join(' / '));

  await p.locator('#simTabs [data-sim="level"]').click();await p.locator('#simMinutes').selectOption('10');await p.locator('#simCompare').uncheck();await p.locator('#simRun').click();await finished();
  assert.match(await p.locator('#simResult').innerText(),/Lv2\s+\d+ 分 \d+ 秒/,'level pace lists the time each level is reached');

  assert.equal(await game.locator('body').evaluate(()=>__EMBERWILD_SKILLS.byId('job0-core0').timing.cooldownSeconds),cooldown,'simulating never applies the draft to the preview');
  assert.equal(await p.locator('iframe[title="模擬用遊戲"]').count(),0,'hidden simulation games are removed');
  await p.locator('#devSettings').evaluate(()=>{});await p.locator('#devAll').click();await p.locator('#devSettings').selectOption('world');
  assert.equal(await p.locator('#devEditor').isVisible(),true,'choosing a settings page returns to the editor');
  await p.setViewportSize({width:390,height:844});await p.locator('#devSim').click();
  assert(await p.locator('#devSimPanel').evaluate(e=>e.scrollWidth<=e.clientWidth+1),'simulation panel fits a phone width');
  assert.deepEqual(errors,[]);console.log('V2 simulation passed: skill trial, equipment stats and level pace compare the draft with built-in data');
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;});
