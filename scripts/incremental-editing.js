/* Incremental editing: tracks which balance modules, records and fields a draft changed, validates only those
   changes (field → module → cross-module) and sends only changed modules when publishing.
   Installed last, after every markDirty wrapper. Shares EmberwildBalanceModules with the game. */
(function installIncrementalEditing(){
 'use strict';
 const M=globalThis.EmberwildBalanceModules,DOC=()=>globalThis.EmberwildBalanceDocument;
 if(!M){console.warn('EmberwildBalanceModules 未載入，增量編輯停用');return;}
 const now=()=>(globalThis.performance?.now?.()??Date.now());
 const ALL=M.MODULES.map(m=>m.id);
 // Pages edit these modules. A page not listed, or a change found outside its modules, falls back to a sweep of
 // every module (change detection only; validation still follows the actual changes).
 const SECTION_MODULES={
  world:['world/maps','world/monsters','world/drops'],items:['items/items','items/inventory-icons'],potions:['items/items','items/inventory-icons'],
  shopSettings:['systems/shop'],inventoryIcons:['items/inventory-icons','items/items','interface/presentation'],iconColors:['interface/presentation','items/inventory-icons'],iconMaker:['interface/presentation','items/inventory-icons'],
  story:['systems/story'],navigation:['interface/navigation'],wishingLake:['systems/wishing-lake'],statuses:['combat/statuses'],
  companions:['characters/companions','characters/companion-settings','combat/skills'],companionUnlocks:['characters/companions'],companionBalance:['characters/companions','characters/companion-settings'],
  companionTokens:['characters/companion-settings'],passives:['characters/passives','characters/companions'],equipmentPower:['equipment/power-system'],affixPools:['equipment/affix-pools'],
  equipment:['equipment/forms'],starterPacks:['items/starter-packs'],uiText:['interface/presentation'],textRarity:['interface/presentation'],teamSettings:['meta/document'],
  materialPrices:['systems/economy'],dailyQuests:['systems/quests'],sideQuests:['systems/quests'],gatheringProducts:['systems/life-skills'],alchemyRecipes:['systems/life-skills'],
  skillSystem:['combat/skills','combat/skill-system','characters/classes','characters/support-skills'],skills:['combat/skills','characters/classes','characters/support-skills'],classes:['characters/classes','combat/skills'],
  combatMigration:['combat/rules','combat/skills','world/monsters','combat/statuses','items/items']
 };
 const sectionModules=section=>{if(SECTION_MODULES[section])return SECTION_MODULES[section];const m=/^balanceSettings:(\w+)$/.exec(section||'');if(m){const id=M.moduleForPath('balanceSettings.'+m[1]);return Array.isArray(id)?id:[id];}return null;};

 const state={
  tracked:null,          // the data object the baseline was taken from
  base:new Map(),        // module id -> serialized text when the session started (or after loading another version)
  baseValue:new Map(),   // module id -> parsed baseline value (for change paths)
  current:new Map(),     // module id -> last serialized text seen
  candidates:new Set(),  // modules possibly written since the last refresh
  modules:new Map(),     // module id -> {changes, records, issues, ms}
  source:null,           // online snapshot this draft started from {branch, commit, modules}
  lastRefresh:null,stats:{refreshes:0,sweeps:0,serialized:0,validated:0},timer:0,sweepTimer:0
 };
 const moduleText=(doc,id)=>{const v=M.split(doc).modules[id];return v===undefined?null:M.serialize(v);};
 // Split once, then serialize only the requested modules.
 function texts(doc,ids){const parts=M.split(doc).modules,out=new Map();for(const id of ids){const v=parts[id];out.set(id,v===undefined?null:M.serialize(v));state.stats.serialized++;}return out;}
 function rebase(reason){
  state.tracked=data;state.base.clear();state.baseValue.clear();state.current.clear();state.modules.clear();state.candidates.clear();
  for(const [id,t] of texts(data,ALL)){state.base.set(id,t);state.current.set(id,t);state.baseValue.set(id,t===null?undefined:JSON.parse(t));}
  state.baseReason=reason;publishState();
 }
 // Field rules for one input, immediately: only that path is checked.
 function validateField(path){
  const D=DOC();if(!D?.inspect||!path)return [];
  try{return D.inspect(data,{scope:M.scope([M.toPath(path)])});}catch(e){return [{field:path,reason:e.message}];}
 }
 function changesFor(id){
  const before=state.baseValue.get(id),after=M.split(data).modules[id],paths=[];
  const def=M.module(id),prefix=def.container?[def.container]:[];
  if(def.key)paths.push(...M.changes(before,after,[...prefix,def.key]));
  else{const a=before||{},b=after||{};for(const k of new Set([...Object.keys(a),...Object.keys(b)]))paths.push(...M.changes(a[k],b[k],[...prefix,k]));}
  return paths;
 }
 // Module and cross-module validation for the modules that actually changed.
 function refresh({sweep=false}={}){
  clearTimeout(state.timer);state.timer=0;
  if(state.tracked!==data)rebase('載入其他版本');
  const t0=now(),ids=sweep||!state.candidates.size?ALL:[...state.candidates];state.candidates.clear();if(sweep||ids===ALL)state.stats.sweeps++;
  const seen=texts(data,ids),touched=[];
  for(const [id,t] of seen){if(t!==state.current.get(id)){state.current.set(id,t);touched.push(id);}}
  // markDirty fired but the page's modules did not change: the write went elsewhere, so look everywhere once.
  if(!touched.length&&!sweep&&ids!==ALL&&state.pendingDirty){state.pendingDirty=false;return refresh({sweep:true});}
  state.pendingDirty=false;
  const D=DOC(),paths=[];
  for(const id of touched){
   if(state.current.get(id)===state.base.get(id)){state.modules.delete(id);continue;}
   const p=changesFor(id);paths.push(...p);
   const classified=M.classify(p,{before:null,after:data});
   const records=new Map();for(const c of classified){const key=c.record?c.record.collection+'#'+(c.record.id??c.record.index):c.path;if(!records.has(key))records.set(key,{label:c.record?.label||M.module(id).title,id:c.record?.id??c.record?.index??null,fields:new Set(),kinds:new Set()});const r=records.get(key);if(c.record?.field)r.fields.add(c.record.field);r.kinds.add(c.kind);}
   state.modules.set(id,{id,title:M.module(id).title,changes:p.map(x=>x.join('.')),kinds:[...new Set(classified.map(c=>c.kind))],records:[...records.values()].map(r=>({...r,fields:[...r.fields],kinds:[...r.kinds]})),issues:[]});
  }
  // Validate every currently changed module together, so a fix in one module clears an error it caused in another.
  const changedIds=[...state.modules.keys()],allPaths=[];for(const id of changedIds)allPaths.push(...(touched.includes(id)?[]:changesFor(id)));allPaths.push(...paths);
  let issues=[],blocks=[];
  if(allPaths.length&&D?.inspect){const report={};try{issues=D.inspect(data,{scope:M.scope(allPaths),report});}catch(e){issues=[{field:'',reason:e.message}];}blocks=report.blocks||[];state.stats.validated++;}
  const keyed=new Set(changedIds.filter(id=>state.modules.get(id).kinds.some(k=>k!=='value')));
  const rules=M.REFERENCES.filter(r=>changedIds.includes(r.from)||keyed.has(r.to));
  const located=new Set(issues.map(x=>x.field));
  for(const r of rules.length?M.referenceIndex(data,{rules}).broken():[])if(!located.has(r.path)&&!located.has(r.path.replace(/\.\d+$/,'')))issues.push({system:M.module(r.module).title,object:r.owner||'',field:r.path,reason:r.label+'引用不存在的 '+r.kind+'：'+r.id});
  for(const m of state.modules.values())m.issues=[];
  const orphan=[];
  for(const x of issues){const owner=M.moduleForPath(x.field),id=Array.isArray(owner)?owner[0]:owner;(state.modules.get(id)?.issues||orphan).push({...x,module:id});}
  state.orphanIssues=orphan;state.blocks=blocks;state.references=rules.map(r=>r.id);
  state.lastRefresh={ms:+(now()-t0).toFixed(2),inspected:ids.length,changedModules:changedIds.length,paths:allPaths.length,blocks,at:new Date().toISOString(),sweep:ids===ALL};
  state.stats.refreshes++;publishState();return summary();
 }
 function summary(){
  const modules=[...state.modules.values()],issues=modules.flatMap(m=>m.issues).concat(state.orphanIssues||[]);
  return {dirty:modules.length>0,modules:modules.map(m=>({id:m.id,title:m.title,kinds:m.kinds,records:m.records,changes:m.changes.length,issues:m.issues})),issues,
   canSave:true,canPublish:modules.length>0&&issues.length===0,crossModule:modules.some(m=>m.kinds.some(k=>k!=='value')),source:state.source,base:state.baseReason,last:state.lastRefresh,stats:{...state.stats}};
 }
 function schedule(){if(state.timer)return;const run=()=>refresh();state.timer=setTimeout(()=>{if(typeof requestIdleCallback==='function')requestIdleCallback(run,{timeout:400});else run();},180);}
 // ---- chrome -------------------------------------------------------------------------------------------
 const esc=globalThis.esc||(v=>String(v??'').replace(/[&<>"']/g,s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s])));
 function ensureChip(){
  let chip=document.getElementById('moduleStateChip');if(chip)return chip;
  const top=document.querySelector('.topbar');if(!top)return null;
  chip=document.createElement('button');chip.type='button';chip.id='moduleStateChip';chip.className='workspace-chip module-state-chip';chip.onclick=()=>{const p=document.getElementById('moduleStatePanel');if(p)p.hidden=!p.hidden;};
  top.appendChild(chip);
  const panel=document.createElement('div');panel.id='moduleStatePanel';panel.className='module-state-panel';panel.hidden=true;document.body.appendChild(panel);
  return chip;
 }
 function render(){
  const s=summary(),chip=ensureChip(),panel=document.getElementById('moduleStatePanel');
  if(chip){chip.textContent=s.dirty?'已修改模組 '+s.modules.length+(s.issues.length?' · '+s.issues.length+' 個問題':' · 驗證通過'):'模組未修改';chip.classList.toggle('has-issues',s.issues.length>0);chip.classList.toggle('is-dirty',s.dirty);}
  if(panel)panel.innerHTML=panelHTML(s);
 }
 function panelHTML(s){
  const rows=s.modules.map(m=>'<details open><summary><b>'+esc(m.title)+'</b> <code>'+esc(m.id)+'</code> · '+m.records.length+' 筆 · '+(m.kinds.includes('structure')?'結構變更':m.kinds.includes('key')?'引用欄位變更（跨模組驗證）':'一般欄位')+'</summary><ul>'+
   m.records.slice(0,30).map(r=>'<li>'+esc(r.label)+(r.id!==null&&r.id!==undefined?' <code>'+esc(r.id)+'</code>':'')+(r.fields.length?'：'+r.fields.map(esc).join('、'):'')+'</li>').join('')+(m.records.length>30?'<li>…另 '+(m.records.length-30)+' 筆</li>':'')+'</ul>'+
   (m.issues.length?'<ul class="module-state-issues">'+m.issues.map(x=>'<li>'+esc(x.object?x.object+' · ':'')+'<code>'+esc(x.field)+'</code>：'+esc(x.reason)+'</li>').join('')+'</ul>':'')+'</details>').join('');
  const last=s.last?'<p class="mini-note">上次檢查：'+s.last.ms+' ms，序列化 '+s.last.inspected+' 個模組、'+s.last.paths+' 個變更路徑；規則 '+esc((s.last.blocks||[]).join('、')||'無')+(s.last.sweep?'（全模組掃描）':'')+'</p>':'';
  return '<div class="module-state-head"><strong>模組變更與驗證</strong><span>'+(s.canPublish?'可儲存、可發布':s.dirty?'可儲存；修正問題後才能發布':'沒有變更')+'</span></div>'+
   '<p class="mini-note">比較基準：'+esc(s.base||'工作階段開始時')+(s.source?' · 線上 '+esc(s.source.branch)+' '+esc(String(s.source.commit).slice(0,7)):'')+'</p>'+(rows||'<p>目前沒有已修改的模組。</p>')+
   ((s.orphanIssues||[]).length?'<ul class="module-state-issues">'+s.orphanIssues.map(x=>'<li><code>'+esc(x.field)+'</code>：'+esc(x.reason)+'</li>').join('')+'</ul>':'')+last;
 }
 function publishState(){try{render();}catch{}const s=summary();try{if(parent!==globalThis)parent.postMessage({kind:'dreaming-abyss-dev-modules',state:{dirty:s.dirty,modules:s.modules.map(m=>({id:m.id,title:m.title,records:m.records.length,issues:m.issues.length})),issues:s.issues.length,canPublish:s.canPublish,ms:s.last?.ms}},location.origin);}catch{}}
 const style=document.createElement('style');style.id='incremental-editing-style';style.textContent='.module-state-chip.is-dirty{border-color:#c49a4a;color:#f0d79c}.module-state-chip.has-issues{border-color:#b0503c;color:#ffb3a3}.module-state-panel{position:fixed;right:12px;top:52px;z-index:60;max-width:min(560px,calc(100vw - 24px));max-height:70vh;overflow:auto;background:var(--panel,#1c272a);border:1px solid var(--line,#354348);border-radius:8px;padding:10px 12px;box-shadow:0 6px 20px #0008}.module-state-panel details{margin:6px 0}.module-state-panel ul{margin:4px 0 4px 18px;padding:0}.module-state-head{display:flex;justify-content:space-between;gap:10px}.module-state-issues li{color:#ffb3a3}[data-field-invalid]{outline:2px solid #b0503c;outline-offset:1px}';
 document.head.appendChild(style);

 // ---- hooks --------------------------------------------------------------------------------------------
 const dirtyBase=globalThis.markDirty;
 globalThis.markDirty=markDirty=function(...args){
  const out=dirtyBase.apply(this,args);
  for(const id of sectionModules(currentSection)||ALL)state.candidates.add(id);
  state.pendingDirty=true;schedule();return out;
 };
 // Level 1: a field input is checked on its own as soon as it changes.
 document.addEventListener('change',ev=>{
  const el=ev.target?.closest?.('[data-path]');if(!el)return;
  const issues=validateField(el.dataset.path);
  if(issues.length){el.setAttribute('data-field-invalid','');el.title=issues.map(x=>x.reason).join('；');}else{el.removeAttribute('data-field-invalid');if(el.title&&el.hasAttribute('data-had-issue'))el.title='';}
  if(issues.length)el.setAttribute('data-had-issue','');
 },true);
 const setBase=globalThis.__EMBERWILD_SET_ONLINE_BASELINE;
 if(typeof setBase==='function')globalThis.__EMBERWILD_SET_ONLINE_BASELINE=function(snapshot,...rest){
  if(snapshot&&snapshot.commit)state.source={branch:snapshot.branch,commit:snapshot.commit,layout:snapshot.layout||'legacy',modules:snapshot.modules||null};
  const out=setBase.call(this,snapshot,...rest);publishState();return out;
 };
 // Periodic safety sweep while idle: catches writes no page announced. Detection only.
 state.sweepTimer=setInterval(()=>{if(document.visibilityState!=='hidden'&&!state.timer)refresh({sweep:true});},30000);

 // ---- publishing -----------------------------------------------------------------------------------------
 const onlineCache=new Map();
 function onlineTexts(snapshot){const key=snapshot.commit||'';if(!onlineCache.has(key)){onlineCache.clear();onlineCache.set(key,texts(snapshot.data,ALL));}return onlineCache.get(key);}
 // Only modules whose exported text differs from the online snapshot are sent, with the hash each change was based on.
 function payload(doc,snapshot){
  if(!snapshot||snapshot.layout!=='modular'||!snapshot.modules)return {data:doc};
  const base=onlineTexts(snapshot),mine=texts(doc,ALL),modules={},baseModules={};
  for(const id of ALL)if(mine.get(id)!==base.get(id)){modules[id]=mine.get(id)===null?undefined:JSON.parse(mine.get(id));baseModules[id]=snapshot.modules[id]?.sha256||null;}
  const parts=M.split(doc);if(JSON.stringify(parts.layout)!==JSON.stringify(M.split(snapshot.data).layout))return {data:doc};
  return Object.keys(modules).length?{modules,baseModules}:{data:doc};
 }
 // Differences by module: unchanged modules (identical text) are skipped instead of deep-compared.
 function diff(before,after){
  const D=globalThis.EmberwildBalanceDiff,a=texts(before,ALL),b=texts(after,ALL),rows=[];
  for(const id of ALL){if(a.get(id)===b.get(id))continue;for(const p of new Set(M.modulePaths(id,before).concat(M.modulePaths(id,after)))){const d=D.diff({[p]:M.get(before,p)},{[p]:M.get(after,p)});rows.push(...d.rows.map(r=>({...r,module:id})));}}
  return {rows,total:rows.length,added:rows.filter(r=>r.type==='新增').length,modified:rows.filter(r=>r.type==='修改').length,deleted:rows.filter(r=>r.type==='刪除').length};
 }
 globalThis.__EMBERWILD_INCREMENTAL=Object.freeze({state:summary,refresh,sweep:()=>refresh({sweep:true}),rebase,validateField,payload,diff,sectionModules,
  // For tests and the performance report.
  _internal:state});
 // The baseline is taken now, before any edit: one serialization of every module per session (or per loaded version).
 // Editor start-up finishes some migrations after the first render; until the person first touches the page the
 // baseline follows them, so start-up normalization is not reported as an edit.
 let touched=false;for(const type of ['pointerdown','keydown','input','change'])document.addEventListener(type,()=>{touched=true;},{capture:true,once:true});
 const settle=()=>{if(touched)return;try{rebase('工作階段開始時');}catch(e){console.warn('增量編輯初始化失敗',e);}};
 settle();
 const later=()=>{if(typeof requestIdleCallback==='function')requestIdleCallback(settle,{timeout:1500});else setTimeout(settle,0);};
 if(document.readyState==='complete')later();else addEventListener('load',later,{once:true});setTimeout(settle,3000);
})();
