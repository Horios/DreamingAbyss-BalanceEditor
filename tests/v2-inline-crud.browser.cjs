'use strict';
// Developer mode: every page's lists add, edit and delete their records from dialogs on the game screen.
const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'playwright'));
const {createPreviewServer}=require('../scripts/serve-v2.cjs');
(async()=>{const server=await createPreviewServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
 try{
  browser=await chromium.launch({headless:true,args:['--no-sandbox'],...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})});
  const p=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto('http://127.0.0.1:'+server.address().port+'/v2');
  await p.waitForFunction(()=>/模式已就緒/.test(document.getElementById('devStatus').textContent),{},{timeout:90000});
  const game=p.frameLocator('#devGame'),editor=p.frameLocator('#devEditor'),dialog=p.locator('#devInlineDialog');
  const inGame=(fn,arg)=>game.locator('body').evaluate(fn,arg),inEditor=(fn,arg)=>editor.locator('body').evaluate(fn,arg);
  const listButton=name=>game.locator('.dev-page-tools [data-dev-list="'+name+'"]');
  const title=()=>p.locator('#devInlineTitle').innerText();
  const backToList=async pattern=>p.waitForFunction(source=>new RegExp(source).test(document.getElementById('devInlineTitle').textContent)&&document.getElementById('devInlineSave').hidden,pattern.source,{timeout:10000}).catch(async e=>{throw Error(e.message+'\n標題：'+await p.locator('#devInlineTitle').innerText()+'\n錯誤：'+await p.locator('#devInlineError').innerText()+'\n狀態：'+await p.locator('#devStatus').innerText());});
  // Delete needs a second click on the same button.
  const removeRecord=async()=>{await p.locator('#devInlineDelete').click();assert.equal(await p.locator('#devInlineDelete').innerText(),'確認刪除');await p.locator('#devInlineDelete').click();};
  await inGame(()=>{selectSaveSlot(1);start(0);clearInterval(timer);closeModal();setTab('battle');selectExplorationMap(0);render();});

  // Exploration: map list, monster list for the current map, monster stats and skills, delete.
  await listButton('monsters').click();await dialog.waitFor();
  assert.match(await title(),/怪物清單 · 0｜/);
  const map0=await inEditor(()=>data.balanceSettings.monsters.catalog.filter(m=>m.mapIndex===0).map(m=>m.id));
  assert.equal(await p.locator('.dev-list-row').count(),map0.length,'the list shows every monster of the map');
  const target=await inEditor(()=>data.balanceSettings.monsters.catalog.find(m=>m.mapIndex===0&&m.kind==='normal'));
  await p.locator('.dev-list-row',{hasText:target.name}).first().click();await p.locator('#devInline-hpMultiplier').waitFor();
  assert.equal(await p.locator('#devInline-kind').count(),1,'existing monsters can change type');
  await p.locator('#devInline-baseStats_hp').fill('321');await p.locator('#devInline-attackMultiplier').fill('1.7');
  const skillsBefore=await p.locator('#devInlineSkills select').count();
  await p.locator('#devSkillAdd').click();assert.equal(await p.locator('#devInlineSkills select').count(),skillsBefore+1);
  await p.locator('#devInlineSave').click();await backToList(/怪物清單/);
  const edited=await inEditor((_,id)=>data.balanceSettings.monsters.catalog.find(m=>m.id===id),target.id);
  assert.equal(edited.baseStats.hp,321);assert.equal(edited.attackMultiplier,1.7);assert.equal(edited.skillAssignments.length,skillsBefore+1,'the monster has the new skill');
  assert.equal(await inGame((_,id)=>monsterCatalog().find(m=>m.id===id).attackMultiplier,target.id),1.7,'the preview uses the edited monster');
  // Clearing a base stat returns to the level formula.
  await p.locator('.dev-list-row',{hasText:target.name}).first().click();await p.locator('#devInline-baseStats_hp').fill('');await p.locator('#devInlineSave').click();await backToList(/怪物清單/);
  assert.equal(await inEditor((_,id)=>data.balanceSettings.monsters.catalog.find(m=>m.id===id).baseStats.hp,target.id),0);
  // The only boss of a map cannot be deleted; a normal monster can.
  const boss=await inEditor(()=>data.balanceSettings.monsters.catalog.find(m=>m.mapIndex===0&&m.kind==='boss'));
  await p.locator('.dev-list-row',{hasText:boss.name}).first().click();await removeRecord();
  assert.match(await p.locator('#devInlineError').innerText(),/唯一的BOSS/);assert.equal(await inEditor((_,id)=>data.balanceSettings.monsters.catalog.some(m=>m.id===id),boss.id),true,'a rejected delete changes nothing');
  await p.locator('#devInlineBack').click();await backToList(/怪物清單/);
  // A monster named by the story is kept; one without references is deleted with its drop references.
  assert.notEqual(await inEditor((_,id)=>__EMBERWILD_FIND_REFERENCES(id,['balanceSettings','companionTokens']).length,target.id),0,'the first monster is a story target');
  await p.locator('.dev-list-row',{hasText:target.name}).first().click();await removeRecord();
  assert.match(await p.locator('#devInlineError').innerText(),/不存在的怪物/);assert.equal(await inEditor((_,id)=>data.balanceSettings.monsters.catalog.some(m=>m.id===id),target.id),true);
  await p.locator('#devInlineBack').click();await backToList(/怪物清單/);
  const spare=await inEditor(()=>data.balanceSettings.monsters.catalog.find(m=>m.mapIndex===0&&m.kind==='normal'&&!__EMBERWILD_FIND_REFERENCES(m.id,['balanceSettings','companionTokens']).length));
  await p.locator('.dev-list-row',{hasText:spare.name}).first().click();await removeRecord();await backToList(/怪物清單/);
  assert.equal(await p.locator('.dev-list-row').count(),map0.length-1);
  assert.equal(await inGame((_,id)=>monsterCatalog().some(m=>m.id===id),spare.id),false,'the preview no longer has the monster');
  assert.equal(await inEditor((_,id)=>data.balanceSettings.drops.entries.some(d=>d.sources.includes(id)),spare.id),false,'its drop references are removed');
  // Monsters of another map: switch with the map selector, add one.
  await p.locator('#devInlineTabSelect').selectOption({index:1});assert.match(await title(),/怪物清單 · 1｜/);
  const map1=await p.locator('.dev-list-row').count();
  await p.locator('.dev-list-adds button',{hasText:'新增怪物'}).click();await p.locator('#devInline-name').fill('清單新增怪');await p.locator('#devInlineSave').click();await backToList(/怪物清單 · 1｜/);
  assert.equal(await p.locator('.dev-list-row').count(),map1+1);assert.equal(await inGame(()=>monsterCatalog().some(m=>m.name==='清單新增怪'&&m.mapIndex===1)),true);
  await p.locator('#devInlineCancel').click();
  // Maps: add a map from the list, then delete it with its monsters. Core maps have no delete button.
  const maps=await inGame(()=>MAPS.length);
  await listButton('maps').click();await dialog.waitFor();assert.equal(await p.locator('.dev-list-row').count(),maps);
  await p.locator('.dev-list-row').first().click();await p.locator('#devInline-name').waitFor();assert.equal(await p.locator('#devInlineDelete').isVisible(),false,'core maps cannot be deleted');
  await p.locator('#devInlineBack').click();await p.locator('.dev-list-adds button',{hasText:'新增地圖'}).click();await p.locator('#devInline-name').fill('待刪地圖');await p.locator('#devInlineSave').click();await backToList(/地圖清單/);
  assert.equal(await inGame(()=>MAPS.length),maps+1);
  await p.locator('.dev-list-row',{hasText:'待刪地圖'}).click();await p.locator('#devInlineDelete').waitFor();await removeRecord();await backToList(/地圖清單/);
  assert.equal(await inGame(()=>MAPS.length),maps,'the map is deleted');assert.equal(await inEditor((_,n)=>data.balanceSettings.monsters.catalog.some(m=>m.mapIndex>=n),maps),false,'its monsters are deleted too');
  await p.locator('#devInlineCancel').click();
  assert.deepEqual(await inEditor(()=>validateData()),[],'exploration edits keep the draft valid');

  // Skills: add a skill, then delete it.
  await inGame(()=>{closeModal();setTab('skills');});await listButton('skills').click();await dialog.waitFor();
  const skillRows=await p.locator('.dev-list-row').count();
  await p.locator('.dev-list-adds button',{hasText:'新增主動技能'}).click();await p.locator('#devInline-name').fill('待刪技能');await p.locator('#devInlineSave').click();await backToList(/技能清單/);
  assert.equal(await p.locator('.dev-list-row').count(),skillRows+1);
  await p.locator('.dev-list-row',{hasText:'待刪技能'}).click();await removeRecord();await backToList(/技能清單/);
  assert.equal(await p.locator('.dev-list-row').count(),skillRows,'the deleted skill leaves the list');
  await p.locator('#devInlineCancel').click();

  // Equipment: add a weapon, then delete it.
  const forms=await inGame(()=>ITEM_FORMS[0][0].length);
  await inGame(()=>setTab('equipment'));await listButton('equipment').click();await dialog.waitFor();
  await p.locator('#devInlineFields button',{hasText:'＋ 新增武器'}).click();await p.locator('#devInline-name').fill('待刪劍');await p.locator('#devInlineSave').click();await backToList(/裝備清單/);
  assert.equal(await inGame(()=>ITEM_FORMS[0][0].length),forms+1);
  await p.locator('.dev-list-row',{hasText:'待刪劍'}).click();await removeRecord();await backToList(/裝備清單/);
  assert.equal(await inGame(()=>ITEM_FORMS[0][0].length),forms,'the preview no longer has the weapon');
  await p.locator('#devInlineCancel').click();

  // Items: a timed boost and a material can be deleted; the last healing potion cannot.
  await listButton('items').click();await dialog.waitFor();
  await p.locator('.dev-list-adds button',{hasText:'新增限時增益券'}).click();await p.locator('#devInline-name').fill('待刪增益券');await p.locator('#devInlineSave').click();await backToList(/道具清單/);
  await p.locator('.dev-list-row',{hasText:'待刪增益券'}).click();await p.locator('#devInline-bonusPercent').waitFor();
  await p.locator('#devInline-bonusPercent').fill('35');await p.locator('#devInlineSave').click();await backToList(/道具清單/);
  assert.equal(await inGame(()=>exportableBalance().items.find(i=>i.name==='待刪增益券').bonusPercent),35,'item effect values are editable');
  await p.locator('.dev-list-row',{hasText:'待刪增益券'}).click();await removeRecord();await backToList(/道具清單/);
  assert.equal(await inGame(()=>exportableBalance().items.some(i=>i.name==='待刪增益券')),false);
  assert.equal(await inEditor(()=>[...data.shopSettings.randomOffers.entries,...data.shopSettings.fixedOffers.entries].some(r=>r.type==='item'&&!data.items.some(i=>i.id===r.key))),false,'its shop offers are removed too');
  await p.locator('.dev-list-adds button',{hasText:'新增素材'}).click();await p.locator('#devInline-name').fill('待刪素材');await p.locator('#devInlineSave').click();await backToList(/道具清單/);
  await p.locator('.dev-list-row',{hasText:'待刪素材'}).click();await removeRecord();await backToList(/道具清單/);
  assert.equal(await inEditor(()=>data.balanceSettings.economy.materialPrices.some(r=>r.key==='待刪素材')),false);
  await p.locator('#devInlineCancel').click();

  // Tokens: add with an effect, edit, delete.
  const tokens=await inEditor(()=>data.companionTokens.catalog.length);
  await inGame(()=>setTab('worn'));await listButton('tokens').click();await dialog.waitFor();
  assert.equal(await p.locator('.dev-list-row').count(),tokens);
  await p.locator('.dev-list-adds button',{hasText:'新增信物'}).click();await p.locator('#devInline-name').fill('測試信物');await p.locator('#devInline-job').selectOption('1');
  await p.locator('#devInlineEffects [data-part="value"]').first().fill('9');await p.locator('#devInlineSave').click();await backToList(/信物清單/);
  const token=await inEditor(()=>data.companionTokens.catalog.find(t=>t.name==='測試信物'));
  assert.equal(token.job,'1');assert.equal(token.effects[0].value,9);
  assert.equal(await inGame(()=>exportableBalance().companionTokens.catalog.some(t=>t.name==='測試信物')),true,'the preview has the token');
  await p.locator('.dev-list-row',{hasText:'測試信物'}).click();await p.locator('#devInline-quality').selectOption('3');await p.locator('#devInlineSave').click();await backToList(/信物清單/);
  assert.equal(await inEditor((_,id)=>data.companionTokens.catalog.find(t=>t.id===id).quality,token.id),3);
  await p.locator('.dev-list-row',{hasText:'測試信物'}).click();await removeRecord();await backToList(/信物清單/);
  assert.equal(await inEditor(()=>data.companionTokens.catalog.length),tokens);
  await p.locator('#devInlineCancel').click();

  // Companions: add, then delete.
  const companions=await inEditor(()=>data.companions.length);
  await inGame(()=>setTab('partnerRoster'));await listButton('companions').click();await dialog.waitFor();
  await p.locator('.dev-list-adds button',{hasText:'新增夥伴'}).click();await p.locator('#devInline-name').fill('待刪夥伴');await p.locator('#devInlineSave').click();await backToList(/夥伴清單/);
  assert.equal(await inEditor(()=>data.companions.length),companions+1);
  await p.locator('.dev-list-row',{hasText:'待刪夥伴'}).click();await removeRecord();await backToList(/夥伴清單/);
  assert.equal(await inEditor(()=>data.companions.length),companions);
  assert.equal(await inGame(()=>exportableBalance().companions.some(c=>c.name==='待刪夥伴')),false);
  // An existing companion with its own skills: the skills are deleted with it and the document stays valid.
  // Story chapters borrow some companions as temporary allies; deleting those is refused, so pick one the story does not use.
  const owner=await inEditor(()=>{const allies=new Set([...JSON.stringify(data.story||{}).matchAll(/"template":(\d+)/g)].map(m=>m[1]));return data.companions.find(c=>!allies.has(String(c.id))&&data.skillSystem.definitions.some(s=>s.partnerId===c.id&&!s.deleted));});
  await p.locator('#devInlineTabs [data-list-job="'+owner.job+'"]').click();await p.locator('.dev-list-row',{hasText:owner.name}).click();await removeRecord();await backToList(/夥伴清單/);
  assert.equal(await inEditor((_,id)=>data.skillSystem.definitions.some(s=>s.partnerId===id&&!s.deleted),owner.id),false,'its skills are deleted');
  assert.equal(await inGame((_,name)=>exportableBalance().companions.some(c=>c.name===name),owner.name),false,'the preview no longer has the companion');
  await p.locator('#devInlineCancel').click();

  // Quests: add a daily commission with a material objective, edit it, delete it. Side quests are a tab of the same list.
  await inGame(()=>setTab('quests'));await listButton('quests').click();await dialog.waitFor();assert.match(await title(),/委託清單 · 每日委託/);
  const daily=await p.locator('.dev-list-row').count();
  await p.locator('.dev-list-adds button',{hasText:'新增每日委託'}).click();await p.locator('#devInline-title').fill('測試委託');
  await p.locator('#devInlineObjectives [data-part="type"]').first().selectOption('potion');
  await p.locator('#devInlineObjectives [data-part="quantity"]').first().fill('4');
  await p.locator('#devObjAdd').click();await p.locator('#devInlineObjectives [data-part="type"]').nth(1).selectOption('totalKills');
  await p.locator('#devInline-rewards_gold').fill('555');await p.locator('#devInlineSave').click();await backToList(/委託清單 · 每日委託/);
  assert.equal(await p.locator('.dev-list-row').count(),daily+1);
  const quest=await inEditor(()=>data.balanceSettings.quests.design.daily.entries.find(q=>q.title==='測試委託'));
  assert.deepEqual(quest.objectives.map(o=>[o.type,o.quantity]),[['potion',4],['totalKills',1]]);assert.equal(quest.rewards.gold,555);
  assert.equal(await inGame(()=>exportableBalance().balanceSettings.quests.design.daily.entries.some(q=>q.title==='測試委託')),true,'the preview has the quest');
  // v0.161: commissions have no level range any more.
  await p.locator('.dev-list-row',{hasText:'測試委託'}).click();assert.equal(await p.locator('#devInline-minLevel').count(),0,'no level fields');
  await p.locator('#devInline-rewards_gold').fill('600');await p.locator('#devInlineSave').click();await backToList(/委託清單/);
  assert.equal(await inEditor((_,id)=>data.balanceSettings.quests.design.daily.entries.find(q=>q.id===id).rewards.gold,quest.id),600);
  await p.locator('.dev-list-row',{hasText:'測試委託'}).click();await removeRecord();await backToList(/委託清單/);
  assert.equal(await p.locator('.dev-list-row').count(),daily);
  await p.locator('#devInlineTabs button',{hasText:'支線任務'}).click();assert.match(await title(),/委託清單 · 支線任務/);
  assert.equal(await p.locator('.dev-list-row').count(),await inEditor(()=>data.balanceSettings.quests.design.side.length));
  await p.locator('#devInlineCancel').click();

  // Shop: add a fixed offer, edit, remove.
  await inGame(()=>setTab('shop'));await listButton('shop').click();await dialog.waitFor();
  await p.locator('#devInlineTabs button',{hasText:'固定商品'}).click();const fixed=await p.locator('.dev-list-row').count();
  await p.locator('.dev-list-adds button',{hasText:'新增固定商品'}).click();await p.locator('#devInline-type').selectOption('ore');
  assert.equal(await p.locator('#devInline-key').count(),0,'ore offers have no item to choose');
  await p.locator('#devInline-name').fill('測試鍛鐵');await p.locator('#devInline-unitPrice').fill('12');await p.locator('#devInline-quantity').fill('3');await p.locator('#devInlineSave').click();await backToList(/商店商品 · 固定商品/);
  assert.equal(await p.locator('.dev-list-row').count(),fixed+1);
  const offer=await inEditor(()=>data.shopSettings.fixedOffers.entries.find(r=>r.name==='測試鍛鐵'));assert.deepEqual([offer.type,offer.unitPrice,offer.quantity],['ore',12,3]);
  await p.locator('.dev-list-row',{hasText:'測試鍛鐵'}).click();await removeRecord();await backToList(/商店商品/);
  assert.equal(await p.locator('.dev-list-row').count(),fixed);
  await p.locator('#devInlineCancel').click();

  // A draft that already has problems (daily commissions set to 裝備／寶石二選一 without both rewards) still saves other records;
  // the commission dialog names the problem and can complete or undo the settlement.
  await inEditor(()=>{for(const id of ['daily_explore','daily_herb'])data.balanceSettings.quests.design.daily.entries.find(q=>q.id===id).rewards.choice='gearOrGems';});
  assert.equal((await inEditor(()=>validateData())).filter(x=>/二選一需同時設計兩種獎勵/.test(x)).length,2);
  await inGame(()=>setTab('shop'));await listButton('shop').click();await dialog.waitFor();
  await p.locator('.dev-list-row').first().click();await p.locator('#devInline-weight').fill('2');await p.locator('#devInlineSave').click();await backToList(/商店商品/);
  // The record is saved to the draft. The preview game validates the whole draft and refuses it while those problems
  // exist, so the status says the draft was updated and not applied (it used to claim 已更新並套用至預覽).
  assert.match(await p.locator('#devStatus').innerText(),/已更新草稿，未套用至預覽[\s\S]*二選一[\s\S]*既有問題[\s\S]*二選一/,'existing problems do not block the save and are reported');
  assert.doesNotMatch(await p.locator('#devStatus').innerText(),/並套用至預覽/);
  assert.match(await p.locator('#devDraftState').innerText(),/尚未套用/,'the draft is not marked as applied');
  await p.locator('#devInlineCancel').click();
  await inGame(()=>setTab('quests'));await listButton('quests').click();await dialog.waitFor();
  const explore=await inEditor(()=>data.balanceSettings.quests.design.daily.entries.find(q=>q.id==='daily_explore').title);
  await p.locator('.dev-list-row',{hasText:explore}).click();await p.locator('#devInline-rewards_choice').waitFor();
  assert.equal(await p.locator('#devInline-rewards_choice').inputValue(),'gearOrGems');
  await p.locator('#devInline-rewards_gold').fill('10');await p.locator('#devInlineSave').click();
  assert.match(await p.locator('#devInlineError').innerText(),/需要至少 1 項裝備獎勵/,'the incomplete settlement of this quest is named');
  await p.locator('#devGearAdd').click();await p.locator('#devInline-rewards_gemCounts_0').fill('2');await p.locator('#devInlineSave').click();await backToList(/委託清單/);
  const settled=await inEditor(()=>data.balanceSettings.quests.design.daily.entries.find(q=>q.id==='daily_explore').rewards);
  assert.deepEqual([settled.choice,settled.gear.length,settled.gemCounts[0],settled.gold],['gearOrGems',1,2,10]);
  await p.locator('.dev-list-row',{hasText:await inEditor(()=>data.balanceSettings.quests.design.daily.entries.find(q=>q.id==='daily_herb').title)}).click();
  await p.locator('#devInline-rewards_choice').selectOption('all');await p.locator('#devInlineSave').click();await backToList(/委託清單/);
  await p.locator('#devInlineCancel').click();
  assert.deepEqual(await inEditor(()=>validateData()),[],'the draft stays valid after every add, edit and delete');
  assert.equal(await inEditor(()=>{__EMBERWILD_V2_BRIDGE.validate(__EMBERWILD_V2_BRIDGE.current());return true;}),true,'the game validator accepts the draft');
  assert.deepEqual(errors,[]);console.log('V2 inline CRUD passed: maps, monsters (stats, skills), skills, equipment, items, tokens, companions, quests and shop offers');
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;});
