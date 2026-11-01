/* Edit the canonical timing objects in place; existing skill/mechanism IDs stay authoritative. */
(()=>{
 'use strict';
 const M=EmberwildCombatMigration,S=EmberwildSecondsSchema;let query='',category='skills',selection='';
 SECTION_META.push(['combatMigration','秒數／MP 戰鬥']);
 const group=NAV_GROUPS.find(g=>g[0]==='tools');if(group)group[2].push('combatMigration');
 const enabled=()=>data.balanceSettings?.meta?.combatTimingVersion===1;
 const validate=validateData;validateData=function(){try{M.assertSupported(data);return validate();}catch(e){return [e.message];}};
 const clean=__EMBERWILD_MASTERY_EDITOR.cleanExport;
 __EMBERWILD_MASTERY_EDITOR.cleanExport=function(){M.assertSupported(data);const out=clean();return enabled()?S.attach(out,data):out;};
 function rows(){
  const c=data.balanceSettings?.combat?.seconds;
  if(category==='skills')return data.skillSystem.definitions.map(s=>({id:s.id,name:s.name,type:s.type,target:s.timing}));
  if(category==='statuses')return data.statusDefinitions.map(s=>({id:s.id,name:s.name,target:s.timing}));
  if(category==='monsters')return data.balanceSettings.monsters.catalog.map(s=>({id:s.id,name:s.name,target:s.timing}));
  if(category==='tokens')return data.companionTokens.catalog.map(s=>({id:s.id,name:s.name,target:s.ability.timing}));
  if(category==='equipment')return data.equipmentForms.flatMap((group,j)=>group.flatMap((slot,k)=>slot.map((form,i)=>({id:form.id||j+':'+k+':'+i,name:form.name,form,target:form.mana||{maxMp:0,regenPerSecond:0,costReduction:0}}))));
  if(category==='items')return data.items.filter(s=>s.timing).map(s=>({id:s.id,name:s.name,target:s.timing}));
  return [{id:'combat',name:'共同時間、治療與群怪設定',target:c},{id:'finalBoss',name:'終局首領狂暴與特殊攻擊計時',target:c.finalBoss},{id:'mana',name:'魔力上限、自然恢復與消耗倍率',target:c.mana},...c.classes.map(r=>({id:'class'+r.job,name:data.classes[r.job].name+' 基礎間隔',target:r}))];
 }
 const labels={enrageAfterSeconds:'狂暴開始（秒）',specialIntervalSeconds:'特殊攻擊間隔（秒）',advanceStepSeconds:'行動提前每格秒數',bossControlDurationSeconds:'BOSS 控制持續（秒；0 為免疫）',minTargets:'最低存活敵人數',requiredTargetStatusId:'連動所需狀態',cooldownSeconds:'冷卻（秒）',mpCost:'MP 消耗',castSeconds:'施法時間（秒）',actionCostSeconds:'額外行動限制（秒）',priority:'優先級（小者先）',durationSeconds:'持續（秒；永久選空值）',bossDurationSeconds:'BOSS 控制持續（秒）',tickIntervalSeconds:'週期效果間隔（秒）',periodicIntervalSeconds:'DOT／HOT 間隔（秒）',triggerIntervalSeconds:'週期觸發間隔（秒）',firstTriggerSeconds:'首次週期觸發（秒）',condition:'自動施放條件',baseIntervalSeconds:'基礎行動／普攻間隔（秒）',referenceSpeed:'速度換算基準',minimumActionIntervalSeconds:'最短行動間隔（秒）',actionReferenceSeconds:'舊行動成本換算基準（秒）',durationReferenceSeconds:'舊持續效果換算基準（秒）',encounterDelaySeconds:'遭遇間隔（秒）',healThreshold:'治療生命門檻（0～1）',costReduction:'裝備 MP 消耗減免（0～1）',maxMp:'MP 上限／裝備額外 MP',regenPerSecond:'每秒恢復 MP',costMultiplier:'MP 消耗倍率'};
 function field(k,v,type){if(k==='requiredTargetStatusId')return `<label>${labels[k]}<select data-seconds-field="${k}"><option value="">不限制</option>${data.statusDefinitions.map(s=>`<option value="${esc(s.id)}" ${v===s.id?'selected':''}>${esc(s.name)}</option>`).join('')}</select></label>`;if(k==='condition')return `<label>${labels[k]}<select data-seconds-field="${k}">${[['always','符合目標即可'],['injured','生命低於治療門檻'],['missingEffect','缺少自身施加的效果']].map(([a,b])=>`<option value="${a}" ${v===a?'selected':''}>${b}</option>`).join('')}</select></label>`;
  return `<label>${esc(labels[k]||k)}<input data-seconds-field="${k}" type="number" step="${k==='priority'?'1':'0.000001'}" min="0" value="${v===null?'':v}" ${type==='passive'||type==='proc'?k==='mpCost'?'disabled':'':''}>${v===null?'<small>永久持續</small>':''}</label>`;}
 function update(id,patch){const list=rows(),r=list.find(x=>x.id===id);if(!r)throw Error('找不到設定');const before=structuredClone(r.target),hadMana=r.form?.mana!==undefined;if(r.form)r.form.mana=r.target;Object.assign(r.target,patch);try{S.validate(data);}catch(e){Object.keys(r.target).forEach(k=>delete r.target[k]);Object.assign(r.target,before);if(r.form&&!hadMana)delete r.form.mana;throw e;}markDirty('已更新秒數／MP 設定：'+r.name);return r.target;}
 const previous=render;
 render=function(){
  if(currentSection!=='combatMigration'){const out=previous();if(enabled()){
   const app=document.getElementById('app');if(app&&!['releases','raw'].includes(currentSection))app.insertAdjacentHTML('afterbegin','<div class="notice"><b>秒數／MP 戰鬥已啟用。</b>行動、冷卻、持續與週期以 canonical timing 欄位為準；舊回合欄位為相容投影。<button onclick="__EMBERWILD_COMBAT_MIGRATION_AUDIT.open()">編輯秒數／MP</button></div>');
   // Legacy scalar fields remain in JSON for compatibility, but cannot compete with canonical timing.
   app?.querySelectorAll('[data-path]').forEach(el=>{if(/^combat\.pacing\.|^combat\.finalBoss\.(enrageAfterTurn|specialEveryTurns)$/.test(el.dataset.path)){el.disabled=true;el.title='舊格式相容欄位；請改用秒數／MP 戰鬥頁的秒數參數';}});
   app?.querySelectorAll('label').forEach(label=>{const text=label.firstChild?.textContent||'';if(/回合/.test(text)&&!/現實/.test(text))label.querySelectorAll('input,select').forEach(el=>{el.disabled=true;el.title='請在秒數／MP 戰鬥頁編輯 canonical timing';});});
  }return out;}
  renderNav(true);const app=document.getElementById('app');
  if(!enabled()){app.innerHTML=sectionHead('秒數／MP 戰鬥','舊資料需先建立明確秒數與 MP 設計。原始冷卻與裝備保留，正式版程式未升級時會阻擋發布。')+card('一次性資料移植','<p>以既有 pacing 建立獨立行動與持續時間基準，MP 使用 100 點資源預算；所有數值可在套用後調整。這不會將一回合視為一秒，也不會移除技能冷卻。</p><button id="secondsMigrate">建立秒數／MP 設定</button>');document.getElementById('secondsMigrate').onclick=()=>{data=S.normalize(data);markDirty('已建立秒數／MP 版本 1；請檢查數值並發布至測試分支');render();};return;}
  const all=rows(),list=all.filter(r=>!query||(r.name+' '+r.id).toLowerCase().includes(query.toLowerCase())),r=all.find(x=>x.id===selection)||list[0];selection=r?.id||'';
  app.innerHTML=sectionHead('秒數／MP 戰鬥','線上與離線共用資料。主動技能保留獨立秒數冷卻並消耗 MP；被動與觸發技能維持原行動成本。')+
   card('共同規則與技能參數',`<div class="toolbar"><select id="secondsCategory">${[['combat','戰鬥與 MP'],['skills','共用技能'],['statuses','狀態／事件'],['monsters','怪物'],['tokens','信物'],['items','治療藥水／附魔'],['equipment','裝備魔力能力']].map(([k,n])=>`<option value="${k}" ${k===category?'selected':''}>${n}</option>`).join('')}</select><input id="secondsSearch" placeholder="搜尋名稱或 ID" value="${esc(query)}"></div><p>群怪為 3／4／5 隻權重；攻擊速度影響間隔。增益也占行動，已充能技能等待共同限制。</p><div class="grid2"><div class="list">${list.map(x=>`<button data-seconds-row="${esc(x.id)}" class="listitem ${x.id===selection?'active':''}">${esc(x.name)}<small>${esc(x.id)} ${esc(x.type||'')}</small></button>`).join('')}</div><div>${r?`<h2>${esc(r.name)}</h2><p>${esc(r.id)}</p><div class="grid2">${Object.entries(category==='skills'?{minTargets:1,requiredTargetStatusId:null,...r.target}:category==='monsters'?{maxMp:data.balanceSettings.combat.seconds.mana.maxMp,regenPerSecond:data.balanceSettings.combat.seconds.mana.regenPerSecond,costMultiplier:data.balanceSettings.combat.seconds.mana.costMultiplier,...r.target}:r.target).filter(([k,v])=>!['version','job'].includes(k)&&(typeof v==='number'||v===null||['condition','requiredTargetStatusId'].includes(k))).map(([k,v])=>field(k,v,r.type)).join('')}</div>${r.id==='combat'?'<label>群怪 3／4／5 隻權重（JSON）<input id="secondsWeights" value="'+esc(JSON.stringify(r.target.groupWeights))+'"></label>':''}<p class="mini-note">MP 不足會跳過技能；相同優先級依配置順序。普通攻擊固定免 MP。永久狀態的持續秒數可留空，其他欄位需為有限非負值。</p>`:''}</div></div>`);
  document.getElementById('secondsCategory').onchange=e=>{category=e.target.value;selection='';query='';render();};document.getElementById('secondsSearch').onchange=e=>{query=e.target.value;render();};
  app.querySelectorAll('[data-seconds-row]').forEach(el=>el.onclick=()=>{selection=el.dataset.secondsRow;render();});
  app.querySelectorAll('[data-seconds-field]').forEach(el=>el.onchange=()=>{try{const k=el.dataset.secondsField;update(selection,{[k]:k==='requiredTargetStatusId'?(el.value||null):k==='condition'?el.value:el.value===''&&k==='durationSeconds'?null:Number(el.value)});}catch(e){alert(e.message);}render();});
  const weights=document.getElementById('secondsWeights');if(weights)weights.onchange=()=>{try{update('combat',{groupWeights:JSON.parse(weights.value)});}catch(e){alert(e.message);}render();};
  globalThis.__EMBERWILD_EXPERIENCE?.afterPage();
 };
 globalThis.__EMBERWILD_COMBAT_MIGRATION_AUDIT={scan:()=>M.inspect(data),open(){currentSection='combatMigration';render();},update,select(kind,id){category=kind;selection=id;render();},migrate(){data=S.normalize(data);markDirty('秒數／MP 移植');}};
 requestEditorInitialRender();
})();
