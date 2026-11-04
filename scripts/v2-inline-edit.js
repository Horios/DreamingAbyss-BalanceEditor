/* Developer mode (開發者模式): edit balance data from dialogs opened on the game screen itself.
   Record dialogs (map, item, new item, skill, monster, equipment form, companion, protagonist class) load one record, show its fields and save through
   the editor's guarded APIs; list dialogs (skills, equipment, companions, items, classes) switch class, list every existing record and
   open or add records. Every successful save is applied to the preview right away. */
(()=>{'use strict';
const $=id=>document.getElementById(id),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const FAMILIES=['林地／風','礦坑／物理','沼澤／暗','山脊／冰','熔火／火','星隕／暗'];
const RACES=[['beast','野獸'],['plant','植物'],['undead','不死'],['construct','構裝'],['demon','惡魔'],['spirit','精靈']];
const api=(shell,name)=>{const v=shell.editor()?.[name];if(!v)throw Error('平衡器尚未載入 '+name);return v;};
const notHidden=r=>r.mapType!=='final';
// ---------------------------------------------------------------- record dialogs
const EDITORS={
 map:{
  title:(t,r)=>t.create?'新增地圖':'編輯地圖 · '+r.name,section:'world',
  load(t,shell){
   if(t.create){const maps=shell.bridge().maps(),last=maps.filter(m=>!m.final).at(-1)||{min:1,max:5,family:0};return {mapType:'normal',name:'新地圖',min:last.max+1,max:last.max+5,family:(last.family+1)%6,icon:'',color:'#34324a',parallel:true,eliteEnabled:true,eliteChance:.12,bossEnabled:true,overlevelVoucherGold:100+300*Math.floor(last.max/5)};}
   const row=shell.bridge().maps()[t.index];if(!row)throw Error('找不到地圖 '+t.index);return row;
  },
  fields:[
   {key:'mapType',label:'地圖類型',type:'select',options:[['normal','一般地圖'],['final','終局地圖（自訂首領關卡）']],create:true},
   {key:'name',label:'顯示名稱',type:'text'},{key:'min',label:'最低等級',type:'number',min:1,step:1},{key:'max',label:'最高等級',type:'number',min:1,step:1},
   {key:'family',label:'區域家族',type:'select',options:FAMILIES.map((n,i)=>[String(i),i+'｜'+n]),number:true},{key:'icon',label:'圖示文字',type:'text'},{key:'color',label:'介面色碼',type:'color'},
   {key:'parallel',label:'平行／追加區域',type:'check'},{key:'eliteEnabled',label:'啟用菁英',type:'check',when:notHidden},
   {key:'eliteChance',label:'菁英遭遇率（0～1）',type:'number',min:0,max:1,step:.001,when:notHidden},{key:'bossEnabled',label:'啟用 BOSS',type:'check',when:notHidden},
   {key:'overlevelVoucherGold',label:'超等收益券金幣（每張）',type:'number',min:0,step:1,when:notHidden}
  ],
  note:(t,r)=>t.create?'新地圖會自動建立 1 隻普通怪與 BOSS。':r.core?'前 7 張核心地圖不能變更類型或刪除。':'怪物 '+r.monsters+' 隻；怪物可在戰鬥中點選敵人卡或用「新增怪物」編輯。',
  save(t,v,shell){const {mapType,...patch}=v;return t.create?shell.bridge().createMap(mapType,patch):shell.bridge().saveMap(t.index,patch);},
  after(t,result,shell){shell.game()?.contentWindow.__EMBERWILD_V2_GAME?.selectMap(result.index);},
  context:(t,result)=>({mapIndex:result?.index??t.index})
 },
 monster:{
  title:(t,r)=>t.create?'新增怪物 · '+r.mapName:'編輯怪物 · '+r.name,section:'world',
  load(t,shell){const W=api(shell,'__EMBERWILD_WORLD_EDITOR');if(t.create){const map=W.maps()[t.mapIndex];return {name:'新怪物',element:'physical',race:'beast',hpMultiplier:1,attackMultiplier:1,defenseMultiplier:1,spawnWeight:1,maxDrops:1,enabled:true,eliteEnabled:true,kind:'normal',mapIndex:t.mapIndex,mapName:map?.name||'',elements:W.elements()};}return W.monster(t.id);},
  fields:[
   {key:'name',label:'名稱',type:'text'},{key:'element',label:'元素',type:'select',options:r=>r.elements},{key:'race',label:'種族',type:'select',options:RACES},
   {key:'hpMultiplier',label:'生命倍率',type:'number',min:0,step:.01},{key:'attackMultiplier',label:'攻擊倍率',type:'number',min:0,step:.01},{key:'defenseMultiplier',label:'防禦倍率',type:'number',min:0,step:.01},
   {key:'spawnWeight',label:'出現權重',type:'number',min:0,step:.01},{key:'maxDrops',label:'最大掉落物數',type:'number',min:0,step:1},
   {key:'enabled',label:'啟用',type:'check'},{key:'eliteEnabled',label:'可菁英化',type:'check',when:r=>!['boss','final'].includes(r.kind)}
  ],
  note:(t,r)=>t.create?'新怪物加入目前地圖；技能、掉落與關卡排序請在總控模式調整。':'所在地圖：'+r.mapName+'；技能、掉落與關卡排序請在總控模式調整。',
  save(t,v,shell){const W=api(shell,'__EMBERWILD_WORLD_EDITOR');return t.create?W.createMonster(t.mapIndex,v):W.updateMonster(t.id,v);},
  context:(t,result,r)=>({mapIndex:r?.mapIndex??t.mapIndex})
 },
 item:{
  title:(t,r)=>'編輯道具 · '+r.name,section:'inventoryIcons',
  load(t,shell){return api(shell,'__EMBERWILD_INVENTORY_ICON_EDITOR').info(t.kind+':'+t.key);},
  fields:[{key:'name',label:'名稱',type:'text'},{key:'sellPrice',label:'售價',type:'number',min:0,step:1},{key:'cost',label:'商店購買價',type:'number',min:0,step:1,when:r=>r.cost!==undefined},{key:'saleEnabled',label:'可販售',type:'check'},{key:'description',label:'說明',type:'textarea',wide:true}],
  note:(t,r)=>r.pending?'此道具在總控模式有未儲存的修改，請先到總控模式儲存或捨棄。':'分類、圖示、分解產物請在總控模式的全域道具管理器調整。',
  save(t,v,shell){const map={name:'name',description:'description',sellPrice:'sellPrice',saleEnabled:'saleEnabled',cost:'object.cost'},fields={};for(const [k,x] of Object.entries(v))if(map[k])fields[map[k]]=k==='name'||k==='description'?x:k==='saleEnabled'?x:Number(x);try{api(shell,'__EMBERWILD_INVENTORY_ICON_EDITOR').edit(t.kind+':'+t.key,fields);return {ok:true};}catch(e){return {ok:false,error:e.message};}},
  context:()=>({})
 },
 skill:{
  title:(t,r)=>'編輯技能 · '+r.name+'（'+r.typeName+'）',section:'skillSystem',
  load(t,shell){return api(shell,'__EMBERWILD_SKILL_DIALOG').get(t.id);},
  fields:[
   {key:'name',label:'名稱',type:'text'},{key:'enabled',label:'啟用',type:'check'},
   {key:'power',label:'威力',type:'number',min:0,step:.01,when:r=>r.power!==undefined},
   {key:'cooldownSeconds',label:'冷卻（秒）',type:'number',min:0,step:.1,when:r=>['active','support'].includes(r.type)},
   {key:'mpCost',label:'耗魔',type:'number',min:0,step:.1,when:r=>['active','support'].includes(r.type)},
   {key:'procBaseChance',label:'觸發率（0～1）',type:'number',min:0,max:1,step:.001,when:r=>r.type==='proc'},
   {key:'maxTargets',label:'目標數',type:'number',min:1,step:1,when:r=>r.maxTargets!==undefined},
   {key:'requiredLevel',label:'需求等級',type:'number',min:1,step:1,when:r=>r.requiredLevel!==undefined},
   {key:'description',label:'說明',type:'textarea',wide:true}
  ],
  note:()=>'效果機制、取得來源與狀態請在總控模式調整。',
  actions:[{label:'複製為新技能',run(t,r,shell){const out=api(shell,'__EMBERWILD_SKILL_DIALOG').duplicate(t.id);if(!out.ok)throw Error(out.error);shell.apply();open({kind:'skill',id:out.id},shell);shell.status('已複製技能，請檢查取得來源後再發布。');}}],
  save(t,v,shell){return api(shell,'__EMBERWILD_SKILL_DIALOG').update(t.id,v);},
  context:(t,result,r)=>({job:r?.jobs?.[0]})
 },
 form:{
  title:(t,r)=>t.create?'新增裝備 · '+r.slotName:'編輯裝備 · '+r.name,section:'equipment',
  load(t,shell){const E=api(shell,'__EMBERWILD_EQUIPMENT_EDITOR');const base=t.create?{name:'新裝備',fixedEffects:[{key:'flatAttack',value:0}],wearableJobs:t.slot===1?E.classes().map(c=>c.job):[t.job]}:E.form(t.job,t.slot,t.index);return {...base,slotName:E.slots[t.slot],effectDefs:E.effects(),elements:E.elements(),races:E.races(),classes:E.classes()};},
  fields:[{key:'name',label:'名稱',type:'text',wide:true},{key:'wearableJobs',label:'可穿戴職業',type:'jobs',wide:true},{key:'fixedEffects',label:'固定屬性（1～5 條）',type:'effects',wide:true}],
  note:(t,r)=>'職業 '+(r.classes[t.job]?.name||t.job)+' · '+r.slotName+(t.create?'':' · 變體 '+(t.index+1))+'。刪除或重排變體請在總控模式處理。',
  save(t,v,shell){const E=api(shell,'__EMBERWILD_EQUIPMENT_EDITOR');return t.create?E.create(t.job,t.slot,v):E.update(t.job,t.slot,t.index,v);},
  context:(t)=>({job:t.job})
 },
 companion:{
  title:(t,r)=>t.create?'新增夥伴':'編輯夥伴 · '+r.name,section:'companions',
  load(t,shell){const C=api(shell,'__EMBERWILD_COMPANION_EDITOR');return t.create?{name:'新夥伴',job:t.job??0,availability:'hidden',description:'','initialStats.hp':40,'initialStats.atk':10,'initialStats.def':5,'growthPerLevel.hp':5,'growthPerLevel.atk':1,'growthPerLevel.def':1}:C.get(t.id);},
  fields:[
   {key:'name',label:'名稱（1～20 字）',type:'text'},{key:'job',label:'職業',type:'select',options:(r,shell)=>api(shell,'__EMBERWILD_EQUIPMENT_EDITOR').classes().map(c=>[String(c.job),c.name]),number:true,create:true},
   {key:'availability',label:'顯示狀態',type:'select',options:[['visible','顯示（出現在招募列表）'],['hidden','隱藏（遊戲中不出現）']]},
   {key:'initialStats.hp',label:'初始生命',type:'number',min:0,step:1},{key:'initialStats.atk',label:'初始攻擊',type:'number',min:0,step:.1},{key:'initialStats.def',label:'初始防禦',type:'number',min:0,step:.1},
   {key:'growthPerLevel.hp',label:'每級生命',type:'number',min:0,step:.01},{key:'growthPerLevel.atk',label:'每級攻擊',type:'number',min:0,step:.01},{key:'growthPerLevel.def',label:'每級防禦',type:'number',min:0,step:.01},
   {key:'description',label:'介紹',type:'textarea',wide:true}
  ],
  note:(t)=>t.create?'新夥伴預設隱藏、沒有技能；技能與解鎖條件請在總控模式的夥伴設計設定。':'專屬技能、解鎖條件與評級請在總控模式的夥伴設計調整。',
  save(t,v,shell){const C=api(shell,'__EMBERWILD_COMPANION_EDITOR');if(t.create){const {job,...patch}=v;return C.create(job,patch);}const {job,...patch}=v;return C.update(t.id,patch);},
  context:(t,result,r)=>({job:r?.job})
 }
};
for(const kind of ['material','equipment','gem','token'])EDITORS[kind]=EDITORS.item;
// Protagonist class (clicking the protagonist portrait, or 職業數值 on the character page).
EDITORS.hero={
 title:(t,r)=>'主角職業數值 · '+r.name,section:'classes',
 load(t,shell){return api(shell,'__EMBERWILD_CLASS_DIALOG').get(t.job);},
 fields:[{key:'name',label:'職業名稱',type:'text'},{key:'advanced',label:'二轉名稱',type:'text'},{key:'main',label:'主要屬性名稱',type:'text'},{key:'initialStats.hp',label:'初始生命',type:'number',min:0,step:1},{key:'initialStats.atk',label:'初始攻擊',type:'number',min:0,step:0.1},{key:'initialStats.def',label:'初始防禦',type:'number',min:0,step:0.1},{key:'initialStats.crit',label:'初始暴擊率（小數）',type:'number',min:0,step:0.001},{key:'initialStats.critDamage',label:'初始暴擊傷害（倍率）',type:'number',min:0,step:0.01},{key:'growthPerLevel.hp',label:'每級生命',type:'number',min:0,step:1},{key:'growthPerLevel.atk',label:'每級攻擊',type:'number',min:0,step:0.1},{key:'growthPerLevel.def',label:'每級防禦',type:'number',min:0,step:0.1},{key:'growthPerLevel.crit',label:'每級暴擊率（小數）',type:'number',min:0,step:0.001},{key:'growthPerLevel.critDamage',label:'每級暴擊傷害（倍率）',type:'number',min:0,step:0.01}],
 note:()=>'自然值 = 初始值 + (等級 − 1) × 每級成長 + 階梯成長。階梯成長、二轉加成與能力點效果請在總控模式調整。',
 save(t,v,shell){return api(shell,'__EMBERWILD_CLASS_DIALOG').update(t.job,v);},
 context:(t)=>({job:t.job})
};
// New items: materials, healing potions and timed boost tickets. Equipment and companion tokens have their own lists.
const ITEM_DEFAULTS={material:{sellPrice:1},potion:{healAmount:50,cooldownSeconds:9,cost:20,sellPrice:5},timed:{boostType:'exp',bonusPercent:50,durationMinutes:30,cost:300,sellPrice:75}};
EDITORS.newItem={
 title:(t,r)=>'新增'+r.kindName,section:'inventoryIcons',
 load(t,shell){const D=api(shell,'__EMBERWILD_ITEM_DIALOG');if(!D.kinds[t.itemType])throw Error('不支援的道具類型');return {name:'新'+D.kinds[t.itemType],description:'',...ITEM_DEFAULTS[t.itemType],itemType:t.itemType,kindName:D.kinds[t.itemType],boostTypes:D.boostTypes()};},
 fields:[
  {key:'name',label:'名稱',type:'text'},
  {key:'healAmount',label:'回復量',type:'number',min:1,step:1,when:r=>r.itemType==='potion'},{key:'cooldownSeconds',label:'冷卻（秒）',type:'number',min:0,step:.1,when:r=>r.itemType==='potion'},
  {key:'boostType',label:'增益類型',type:'select',options:r=>r.boostTypes,when:r=>r.itemType==='timed'},{key:'bonusPercent',label:'增益百分比',type:'number',min:1,step:1,when:r=>r.itemType==='timed'},{key:'durationMinutes',label:'持續分鐘',type:'number',min:1,step:1,when:r=>r.itemType==='timed'},
  {key:'cost',label:'商店購買價',type:'number',min:0,step:1,when:r=>r.itemType!=='material'},{key:'sellPrice',label:'售價',type:'number',min:0,step:1},
  {key:'description',label:'說明',type:'textarea',wide:true}
 ],
 note:(t,r)=>r.itemType==='material'?'素材名稱同時是庫存識別，建立後不能改名。來源與用途請在總控模式設定。':'新道具預設不上架；商店與掉落規則請在總控模式設定。',
 save(t,v,shell){const out=api(shell,'__EMBERWILD_ITEM_DIALOG').create(t.itemType,v);if(out?.ok&&out.warning)shell.status(out.warning);return out;},
 context:()=>({})
};
// ---------------------------------------------------------------- list dialogs
const LISTS={
 items:{
  title:'道具清單',section:'inventoryIcons',
  rows(job,shell){return api(shell,'__EMBERWILD_ITEM_DIALOG').list().map(i=>({label:i.name,meta:i.meta,target:{kind:'item',key:i.id}}));},
  adds(job,shell){return Object.entries(api(shell,'__EMBERWILD_ITEM_DIALOG').kinds).map(([type,label])=>({label:'＋ 新增'+label,target:{kind:'newItem',itemType:type,create:true}}));},
  note:'列出治療藥水與限時增益券；素材在背包點選即可編輯。裝備與信物請用裝備清單與夥伴清單。'
 },
 classes:{
  title:'主角職業數值',section:'classes',
  rows(job,shell){return api(shell,'__EMBERWILD_CLASS_DIALOG').list().map(c=>({label:c.name+(c.advanced?'／'+c.advanced:''),meta:'LV1 生命 '+c.hp+' · 攻擊 '+c.atk+' · 防禦 '+c.def,target:{kind:'hero',job:c.job}}));},
  note:'點選職業編輯初始值與每級成長。'
 },
 skills:{
  title:'技能清單',section:'skillSystem',byClass:true,
  rows(job,shell){return api(shell,'__EMBERWILD_SKILL_DIALOG').list(job).map(s=>({label:s.name,meta:s.typeName+' · LV'+s.requiredLevel+(s.cooldown?' · 冷卻 '+s.cooldown+' 秒':'')+(s.disabled?' · 停用':''),target:{kind:'skill',id:s.id},dim:s.disabled}));},
  adds(job,shell){const D=api(shell,'__EMBERWILD_SKILL_DIALOG');return Object.entries(D.types).map(([type,label])=>({label:'＋ 新增'+label+'技能',run(){const out=D.create(job,type);if(!out.ok)throw Error(out.error);shell.apply();open({kind:'skill',id:out.id},shell);shell.status('已建立空白技能（預設停用），請設定後啟用。');}}));}
 },
 equipment:{
  title:'裝備清單',section:'equipment',byClass:true,
  groups(job,shell){return api(shell,'__EMBERWILD_EQUIPMENT_EDITOR').list(job).map(g=>({title:g.slotName,rows:g.forms.map(f=>({label:f.name,meta:f.effects,target:{kind:'form',job,slot:g.slot,index:f.index}})),add:{label:'＋ 新增'+g.slotName,target:{kind:'form',job,slot:g.slot,create:true}}}));}
 },
 companions:{
  title:'夥伴清單',section:'companions',byClass:true,
  rows(job,shell){return api(shell,'__EMBERWILD_COMPANION_EDITOR').list().filter(p=>p.job===job).map(p=>({label:p.name,meta:p.jobName+' · '+(p.availability==='hidden'?'隱藏':'顯示'),target:{kind:'companion',id:p.id},dim:p.availability==='hidden'}));},
  adds(job){return [{label:'＋ 新增夥伴',target:{kind:'companion',create:true,job}}];}
 }
};
let current=null,list=null;
function dialog(){
 let d=$('devInlineDialog');if(d)return d;
 d=document.createElement('dialog');d.id='devInlineDialog';d.className='dev-inline-dialog';d.setAttribute('aria-labelledby','devInlineTitle');
 d.innerHTML='<form method="dialog" id="devInlineForm" novalidate><h2 id="devInlineTitle"></h2><p id="devInlineNote" class="muted"></p><div id="devInlineTabs" class="dev-inline-tabs" role="group" aria-label="職業"></div><div id="devInlineFields" class="dev-inline-fields"></div><p id="devInlineError" class="dev-inline-error" role="alert"></p><div class="dev-inline-actions"><button type="button" id="devInlineBack" hidden>← 返回清單</button><button type="button" id="devInlineFull">在總控模式開啟</button><span id="devInlineExtra"></span><span class="spacer"></span><button type="button" id="devInlineCancel">關閉</button><button type="submit" id="devInlineSave" class="primary">儲存並套用預覽</button></div></form>';
 document.body.append(d);
 const style=document.createElement('style');style.textContent='.dev-inline-dialog{border:1px solid var(--gold);border-radius:12px;background:var(--panel);color:var(--text);padding:18px;width:min(640px,calc(100vw - 32px));max-height:calc(100dvh - 40px);overflow:auto}.dev-inline-dialog::backdrop{background:#0008}.dev-inline-dialog h2{margin:0 0 4px;font-size:17px}.dev-inline-tabs{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0}.dev-inline-tabs:empty{display:none}.dev-inline-tabs button{font-size:12px;padding:5px 10px}.dev-inline-tabs button[aria-pressed=true]{border-color:var(--gold);background:var(--selected)}.dev-inline-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:12px 0}.dev-inline-fields .wide{grid-column:1/-1}.dev-inline-fields label{display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--muted);min-width:0}.dev-inline-fields label.check{flex-direction:row;align-items:center;gap:8px;color:var(--text)}.dev-inline-fields input:not([type=checkbox]),.dev-inline-fields select,.dev-inline-fields textarea{width:100%;min-width:0;border:1px solid var(--line);background:var(--control);color:var(--text);border-radius:7px;padding:6px 8px;font:inherit}.dev-inline-fields textarea{min-height:64px;resize:vertical}.dev-inline-fields input[type=color]{padding:2px;height:34px}.dev-inline-error{color:#e49a8a;font-size:12px;white-space:pre-wrap;min-height:1em;margin:0 0 8px}.dev-inline-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.dev-inline-actions .spacer{flex:1}.dev-fx-row{display:grid;grid-template-columns:minmax(0,2fr) minmax(0,1fr) minmax(0,1fr) auto;gap:6px;align-items:center;margin-bottom:6px}.dev-jobs{display:flex;gap:10px;flex-wrap:wrap;color:var(--text)}.dev-jobs label{flex-direction:row!important;align-items:center;gap:4px;color:var(--text)!important}.dev-list-group{grid-column:1/-1}.dev-list-group h3{font-size:13px;margin:6px 0;color:var(--gold)}.dev-list-row{display:flex;justify-content:space-between;align-items:center;gap:10px;width:100%;text-align:left;margin-bottom:6px;padding:8px 10px}.dev-list-row small{color:var(--muted);font-size:11px;overflow-wrap:anywhere}.dev-list-row.dim{opacity:.65}.dev-list-adds{grid-column:1/-1;display:flex;gap:6px;flex-wrap:wrap}@media(max-width:460px){.dev-inline-fields{grid-template-columns:1fr}.dev-fx-row{grid-template-columns:1fr 1fr}}';
 document.head.append(style);
 $('devInlineCancel').onclick=()=>d.close();
 $('devInlineForm').onsubmit=e=>{e.preventDefault();save();};
 $('devInlineBack').onclick=()=>{if(list)openList(list.kind,list.shell,list.job);};
 $('devInlineFull').onclick=()=>{const c=current||list;d.close();if(!c)return;const section=c.editor?.section||LISTS[c.kind]?.section;c.shell.open(section,c.editor?c.editor.context(c.target,null,c.record):{job:c.job});};
 return d;
}
const opts=(f,r,shell)=>typeof f.options==='function'?f.options(r,shell):f.options;
function effectsHTML(r){
 const defs=r.effectDefs;return (r.fixedEffects||[]).map((fx,i)=>{const def=defs.find(d=>d.key===fx.key)||defs[0];
  const target=def.target==='element'?`<select data-fx="${i}" data-part="element">${r.elements.filter(([v])=>v!=='physical').map(([v,n])=>`<option value="${v}" ${fx.element===v?'selected':''}>${esc(n)}</option>`).join('')}</select>`:def.target==='race'?`<select data-fx="${i}" data-part="race">${r.races.map(([v,n])=>`<option value="${v}" ${fx.race===v?'selected':''}>${esc(n)}</option>`).join('')}</select>`:def.target==='skill'?`<input data-fx="${i}" data-part="skill" type="number" min="0" step="1" value="${esc(fx.skill??0)}" title="核心技能序號">`:'<span></span>';
  const value=fx.key==='basicElement'?`<select data-fx="${i}" data-part="value">${r.elements.map(([v,n])=>`<option value="${v}" ${fx.value===v?'selected':''}>${esc(n)}</option>`).join('')}</select>`:`<input data-fx="${i}" data-part="value" type="number" step="0.01" value="${esc(fx.value)}" aria-label="${esc(def.label)} 數值">`;
  return `<div class="dev-fx-row"><select data-fx="${i}" data-part="key" aria-label="屬性">${defs.map(d=>`<option value="${d.key}" ${d.key===fx.key?'selected':''}>${esc(d.label)}</option>`).join('')}</select>${target}${value}<button type="button" data-fx-del="${i}" ${(r.fixedEffects||[]).length<=1?'disabled':''} aria-label="刪除此屬性">×</button></div>`;}).join('')+`<button type="button" id="devFxAdd" ${(r.fixedEffects||[]).length>=5?'disabled':''}>＋ 新增固定屬性</button>`;
}
function input(f,v,r,shell){
 const id='devInline-'+f.key.replace(/\W/g,'_'),wide=f.wide?' wide':'';
 if(f.type==='check')return `<label class="check${wide}"><input id="${id}" type="checkbox" data-key="${f.key}" ${v?'checked':''}>${esc(f.label)}</label>`;
 if(f.type==='select')return `<label class="${wide}">${esc(f.label)}<select id="${id}" data-key="${f.key}">${opts(f,r,shell).map(([k,n])=>`<option value="${esc(k)}" ${String(v)===String(k)?'selected':''}>${esc(n)}</option>`).join('')}</select></label>`;
 if(f.type==='textarea')return `<label class="${wide}">${esc(f.label)}<textarea id="${id}" data-key="${f.key}">${esc(v)}</textarea></label>`;
 if(f.type==='jobs')return `<div class="${wide}"><label>${esc(f.label)}</label><div class="dev-jobs" id="${id}">${r.classes.map(c=>`<label><input type="checkbox" data-job="${c.job}" ${(v||[]).includes(c.job)?'checked':''}>${esc(c.name)}</label>`).join('')}</div></div>`;
 if(f.type==='effects')return `<div class="${wide}"><label>${esc(f.label)}</label><div id="devInlineEffects">${effectsHTML(r)}</div></div>`;
 const attrs=['min','max','step'].filter(a=>f[a]!==undefined).map(a=>`${a}="${f[a]}"`).join(' ');
 return `<label class="${wide}">${esc(f.label)}<input id="${id}" data-key="${f.key}" type="${f.type==='number'?'number':f.type==='color'?'color':'text'}" ${attrs} value="${esc(v)}"></label>`;
}
function visible(f){const {target,record}=current;return (!f.create||target.create)&&(!f.when||f.when(record));}
function draw(){
 const {editor,target,record,shell}=current;
 $('devInlineTitle').textContent=editor.title(target,record);$('devInlineNote').textContent=editor.note?.(target,record)||'';$('devInlineTabs').replaceChildren();
 $('devInlineFields').innerHTML=editor.fields.filter(visible).map(f=>input(f,record[f.key],record,shell)).join('');
 $('devInlineSave').hidden=false;$('devInlineBack').hidden=!list;
 $('devInlineExtra').replaceChildren(...(target.create?[]:(editor.actions||[])).map(a=>{const b=document.createElement('button');b.type='button';b.textContent=a.label;b.onclick=()=>{try{a.run(target,record,shell);}catch(e){$('devInlineError').textContent=e.message;}};return b;}));
 for(const el of $('devInlineFields').querySelectorAll('[data-key]'))el.onchange=()=>{record[el.dataset.key]=read(el);if(['mapType'].includes(el.dataset.key))draw();};
 for(const el of $('devInlineFields').querySelectorAll('[data-job]'))el.onchange=()=>{record.wearableJobs=[...$('devInlineFields').querySelectorAll('[data-job]:checked')].map(x=>Number(x.dataset.job));};
 bindEffects();
}
function bindEffects(){
 const host=$('devInlineEffects');if(!host)return;const r=current.record;
 for(const el of host.querySelectorAll('[data-fx]'))el.onchange=()=>{const fx=r.fixedEffects[Number(el.dataset.fx)],part=el.dataset.part;if(part==='key'){fx.key=el.value;fx.value=el.value==='basicElement'?'fire':0;delete fx.element;delete fx.race;delete fx.skill;host.innerHTML=effectsHTML(r);bindEffects();return;}fx[part]=part==='value'&&fx.key!=='basicElement'||part==='skill'?Number(el.value):el.value;};
 for(const el of host.querySelectorAll('[data-fx-del]'))el.onclick=()=>{r.fixedEffects.splice(Number(el.dataset.fxDel),1);host.innerHTML=effectsHTML(r);bindEffects();};
 const add=$('devFxAdd');if(add)add.onclick=()=>{r.fixedEffects.push({key:'flatAttack',value:0});host.innerHTML=effectsHTML(r);bindEffects();};
}
function read(el){const f=current.editor.fields.find(x=>x.key===el.dataset.key);if(f.type==='check')return el.checked;if(f.type==='number')return el.value===''?NaN:Number(el.value);if(f.number)return Number(el.value);return el.value;}
function values(){const out={};for(const f of current.editor.fields.filter(visible)){if(f.type==='effects')out[f.key]=current.record.fixedEffects;else if(f.type==='jobs')out[f.key]=current.record.wearableJobs;else{const el=$('devInlineFields').querySelector(`[data-key="${f.key}"]`);if(el)out[f.key]=read(el);}}return out;}
function save(){
 if(!current)return false;const {editor,target,shell}=current,v=values();let result;
 try{result=editor.save(target,v,shell);}catch(e){result={ok:false,error:e.message};}
 if(!result?.ok){$('devInlineError').textContent='無法儲存：'+(result?.error||'未知錯誤');return false;}
 shell.apply();editor.after?.(target,result,shell);
 shell.status((target.create?'已新增並套用至預覽：':'已更新並套用至預覽：')+(v.name||current.record.name||'')+'。尚未發布。');
 if(list){openList(list.kind,list.shell,list.job);}else dialog().close();return true;
}
function open(target,shell){
 const editor=EDITORS[target?.kind];if(!editor)return false;
 if(target.kind==='equipment'){const m=/^form:(\d+):(\d+):(\d+)$/.exec(String(target.key||''));if(m)return open({kind:'form',job:Number(m[1]),slot:Number(m[2]),index:Number(m[3])},shell);}
 try{current={editor,target,shell,record:structuredClone(editor.load(target,shell))};}catch(e){shell.status('無法開啟：'+e.message);return false;}
 if(!target.fromList)list=null;
 const d=dialog();$('devInlineError').textContent='';draw();if(!d.open)d.showModal();$('devInlineFields').querySelector('input,select,textarea')?.focus();return true;
}
function openList(kind,shell,job=0){
 const def=LISTS[kind];if(!def)return false;const d=dialog();current=null;
 const classes=api(shell,'__EMBERWILD_EQUIPMENT_EDITOR').classes();job=Math.max(0,Math.min(classes.length-1,Number(job)||0));list={kind,shell,job};
 $('devInlineTitle').textContent=def.byClass?def.title+' · '+(classes[job]?.name||''):def.title;$('devInlineNote').textContent=def.note||(def.byClass?'先切換職業，再點選要編輯的項目或新增。':'點選要編輯的項目或新增。');$('devInlineError').textContent='';$('devInlineSave').hidden=true;$('devInlineBack').hidden=true;$('devInlineExtra').replaceChildren();
 $('devInlineTabs').innerHTML=def.byClass?classes.map(c=>`<button type="button" data-list-job="${c.job}" aria-pressed="${c.job===job}">${esc(c.name)}</button>`).join(''):'';
 for(const b of $('devInlineTabs').querySelectorAll('[data-list-job]'))b.onclick=()=>openList(kind,shell,Number(b.dataset.listJob));
 let groups;try{groups=def.groups?def.groups(job,shell):[{title:'',rows:def.rows(job,shell)}];}catch(e){$('devInlineError').textContent=e.message;groups=[];}
 const adds=def.adds?def.adds(job,shell):[];
 $('devInlineFields').innerHTML=groups.map((g,gi)=>`<section class="dev-list-group">${g.title?`<h3>${esc(g.title)}</h3>`:''}${g.rows.map((r,ri)=>`<button type="button" class="dev-list-row ${r.dim?'dim':''}" data-row="${gi}:${ri}"><b>${esc(r.label)}</b><small>${esc(r.meta||'')}</small></button>`).join('')||'<p class="muted">目前沒有項目。</p>'}${g.add?`<button type="button" data-group-add="${gi}">${esc(g.add.label)}</button>`:''}</section>`).join('')+(adds.length?`<div class="dev-list-adds">${adds.map((a,i)=>`<button type="button" data-list-add="${i}">${esc(a.label)}</button>`).join('')}</div>`:'');
 for(const b of $('devInlineFields').querySelectorAll('[data-row]'))b.onclick=()=>{const [gi,ri]=b.dataset.row.split(':').map(Number);open({...groups[gi].rows[ri].target,fromList:true},shell);};
 for(const b of $('devInlineFields').querySelectorAll('[data-group-add]'))b.onclick=()=>open({...groups[Number(b.dataset.groupAdd)].add.target,fromList:true},shell);
 for(const b of $('devInlineFields').querySelectorAll('[data-list-add]'))b.onclick=()=>{const a=adds[Number(b.dataset.listAdd)];try{if(a.target)open({...a.target,fromList:true},shell);else a.run();}catch(e){$('devInlineError').textContent=e.message;}};
 if(!d.open)d.showModal();return true;
}
globalThis.DreamingAbyssInlineEdit=Object.freeze({open,openList,kinds:()=>Object.keys(EDITORS),lists:()=>Object.keys(LISTS),save});
})();
