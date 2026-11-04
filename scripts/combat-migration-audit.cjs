/* Shared editor/server check. Read-only: never relabel or convert balance data.
   The seconds scheduler kernel is not a runtime capability advertisement. */
(function(root){
 'use strict';
 const scoped=/^(skillSystem|classes|supportSkills|statusDefinitions|companions|companionTokens|items|balanceSettings\.(combat|monsters)|balance\.combat)(\.|$)/;
 const newKeys=new Set(['mpCost','manaCost','maxMp','baseMp','mpRegenPerSecond','mpCostMultiplier','cooldownSeconds','durationSeconds','castSeconds','castTimeSeconds','actionCostSeconds','baseIntervalSeconds','attackIntervalSeconds','tickEverySeconds','minimumActionIntervalSeconds']);
 function unsupportedPaths(doc){
  const rows=[];
  if(Number(doc?.balanceSettings?.meta?.combatTimingVersion)>0)rows.push('balanceSettings.meta.combatTimingVersion');
  if(doc?.balanceSettings?.combat?.model==='seconds'||doc?.balanceSettings?.combat?.seconds)rows.push('balanceSettings.combat');
  for(const [key,value] of Object.entries(doc?.timeUnits||{}))if(['cooldown','skillCooldown','supportDuration','statusDuration','combat'].includes(key)&&['seconds','battleSeconds'].includes(value))rows.push('timeUnits.'+key);
  function walk(value,path=''){
   if(!value||typeof value!=='object')return;
   for(const [key,item] of Object.entries(value)){
    const p=path?path+'.'+key:key;
    if(scoped.test(p)&&(newKeys.has(key)||key==='timing'&&/^skillSystem\.definitions\./.test(p)))rows.push(p);
    if(scoped.test(p)&&['durationClock','cooldownClock','timeUnit'].includes(key)&&['seconds','battleSeconds'].includes(item))rows.push(p);
    walk(item,p);
   }
  }
  walk(doc);return [...new Set(rows)];
 }
 function current(doc){const m=doc?.balanceSettings?.meta;return m?.independentActionsVersion===1&&m?.continuousExplorationVersion===1;}
 function retainContract(out,source){if(source?.balanceSettings?.meta?.combatTimingVersion!==1)return out;
  // Historical documents are compared/exported as loaded. Upgrades are explicit.
  for(const k of ['actionModel','recovery'])if(!Object.hasOwn(source.balanceSettings.combat.seconds,k))delete out.balanceSettings.combat.seconds[k];
  for(const k of ['independentActionsVersion','continuousExplorationVersion'])if(!Object.hasOwn(source.balanceSettings.meta,k))delete out.balanceSettings.meta[k];
  return out;
 }
 function attachExport(output,source){const S=root.EmberwildSecondsSchema||(typeof require==='function'?require('./seconds-schema.cjs'):null);return retainContract(S.attach(output,S.normalize(source)),source);}
 function assertSupported(doc){
  const paths=unsupportedPaths(doc);
  if(doc?.balanceSettings?.meta?.combatTimingVersion===1){const S=root.EmberwildSecondsSchema||(typeof require==='function'?require('./seconds-schema.cjs'):null);if(!S)throw Error('秒數／MP 驗證器未載入');try{S.assertJSON(doc);for(const k of ['independentActionsVersion','continuousExplorationVersion'])if(doc.balanceSettings.meta[k]!==undefined&&doc.balanceSettings.meta[k]!==1)throw Error('未知的 '+k);S.validateImport(doc);for(const state of doc.statusDefinitions||[])if(state.timing&&(state.permanent===true)!==(state.timing.durationSeconds===null))throw Error('狀態 '+state.id+' 的永久標記與 timing.durationSeconds 不一致');}catch(e){throw Error('秒數／MP：'+e.message);}return doc;}
  if(paths.length){const stale=doc?.balanceSettings?.meta?.combatTimingVersion===undefined?'這份資料含秒數／MP 欄位，但缺少 balanceSettings.meta.combatTimingVersion 標記，通常是舊版平衡器存下的工作草稿。請按「還原最初資料」改用目前遊戲資料，或從「發布管理」載入線上版本。':'';throw Error(stale+'秒數／MP 戰鬥資料尚未接通目前遊戲與平衡器，不能套用、換算或發布。請先完成戰鬥資料格式與執行器移植：'+paths.slice(0,8).join('、'));}
  return doc;
 }
 function inspect(doc){
  const rows=[],counts={},skills=doc?.skillSystem?.definitions||[];
  const group=path=>/^skillSystem/.test(path)?'共用技能':/^classes|^supportSkills/.test(path)?'技能投影':/^statusDefinitions/.test(path)?'狀態／事件':/^companions|^companionTokens/.test(path)?'夥伴／信物':/^items/.test(path)?'消耗品':/^equipment|^balance\.affixes/.test(path)?'裝備／詞綴':/^balanceSettings\.monsters/.test(path)?'怪物／BOSS':/^balanceSettings\.combat|^balance\.combat/.test(path)?'戰鬥核心':'其他';
  function walk(v,path='',owner=''){
   if(!v||typeof v!=='object')return;
   const name=v.name||v.id||owner;
   for(const [key,item] of Object.entries(v)){
    const p=path?path+'.'+key:key;
    const keyedTimed=/cooldown|mpRegen|mana|basicAdvanceNextRound|advanceNextRound/i.test(String(v.key||''));
    const timed=keyedTimed||/cooldown|duration|interval|everyTurns|afterTurn|remainingTurns|durationClock|trigger|basicAdvanceNextRound|advanceNextRound/i.test(p)||/\.combat\.speed\./.test(p)||/^(speed|speedBonus|maxMp|mpRegen|mana)/.test(key);
    if(item!==null&&typeof item==='object')walk(item,p,name);
    else if(timed&&/^(skillSystem|classes|supportSkills|statusDefinitions|companions|companionTokens|items|equipment|balance\.|balanceSettings\.(combat|monsters))/.test(p)){
     const category=group(p);counts[category]=(counts[category]||0)+1;
     const itemIndex=Number(p.match(/^items\.(\d+)\./)?.[1]);
     const real=/durationMinutes/.test(p)||/^items\./.test(p)&&['ward','elementTonic','timedBoost'].includes(doc.items?.[itemIndex]?.type);
     rows.push({path:p,category,owner:String(name||category),value:item,clock:real?'現實時間（保留）':/\.timing\.|\.combat\.seconds\./.test(p)?'正式秒數／MP 設定':/speed/.test(p)?'速度換算普攻間隔':/trigger|event/.test(p)?'事件條件需個別映射':'舊回合／未標明單位，需確認'});
    }
   }
  }
  walk(doc);
  const active=skills.filter(s=>['active','support'].includes(s.type));
  return {runtimeSwitched:doc?.balanceSettings?.meta?.combatTimingVersion===1,counts,rows,sharedSkills:skills.length,
   activeNeedingMpDesign:active.filter(s=>s.timing?.mpCost===undefined&&s.mpCost===undefined&&s.manaCost===undefined).map(s=>({id:s.id,name:s.name})),
   unsupported:unsupportedPaths(doc),
   checklist:['職業／夥伴 MP 上限、恢復、消耗減免與技能成本','技能獨立冷卻、個別施法限制、裝備順序與施放條件','瞬發增減益不重置普攻，個別動作成本與續放條件','DOT／HOT、永久／疊加狀態、控制與死亡事件','怪物獨立行動、BOSS 計數及觸發冷卻','裝備詞綴、寶石、信物的秒數冷卻及事件語意','單怪／群怪配置、跨場冷卻、脫戰恢復及下一場 HP／MP 門檻','匯入／匯出／比較／歷史還原的單位及完整資料保留','發布驗證器、能力檢查與線上／離線規則一致性'],
   note:'這是目前資料的移植清單；列出欄位不代表該機制已轉換或驗收完成。MP 與獨立冷卻並存，沒有自動把冷卻改成耗魔。'};
 }
 const api={unsupportedPaths,assertSupported,inspect,current,attachExport,retainContract};
 root.EmberwildCombatMigration=api;
 if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
