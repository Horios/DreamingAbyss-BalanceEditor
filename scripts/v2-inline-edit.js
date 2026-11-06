/* Developer mode (開發者模式): add, edit and delete balance data from dialogs opened on the game screen itself.
   Record dialogs (map, monster, item, new item, skill, equipment form, companion, protagonist class, quest, shop offer,
   companion token) load one record, show its fields and save or delete through the editor's guarded APIs; list dialogs
   (maps, monsters, skills, equipment, companions, items, classes, quests, shop, tokens) switch class/map/pool, list every
   existing record and open or add records. Every successful save or delete is applied to the preview right away. */
(()=>{'use strict';
const $=id=>document.getElementById(id),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const FAMILIES=['林地／風','礦坑／物理','沼澤／暗','山脊／冰','熔火／火','星隕／暗'];
const RACES=[['beast','野獸'],['plant','植物'],['undead','不死'],['construct','構裝'],['demon','惡魔'],['spirit','精靈']];
const QUALITIES=[['0','普通'],['1','精良'],['2','稀有'],['3','傳說']];
const api=(shell,name)=>{const v=shell.editor()?.[name];if(!v)throw Error('平衡器尚未載入 '+name);return v;};
const notHidden=r=>r.mapType!=='final';
const ok=out=>{if(!out?.ok)throw Error(out?.error||'未知錯誤');return out;};
// ---------------------------------------------------------------- record dialogs
const EDITORS={
 map:{
  title:(t,r)=>t.create?'新增地圖':'編輯地圖 · '+r.name,section:'world',
  load(t,shell){
   if(t.create){const maps=shell.bridge().maps(),last=maps.filter(m=>!m.final).at(-1)||{min:1,max:5,family:0};return {mapType:'normal',name:'新地圖',min:last.max+1,max:last.max+5,family:(last.family+1)%6,icon:'',color:'#34324a',parallel:true,eliteEnabled:true,eliteChance:.12,bossEnabled:true,overlevelVoucherGold:100+300*Math.floor(last.max/5)};}
   const row=shell.bridge().maps()[t.index];if(!row)throw Error('找不到地圖 '+t.index);return row;
  },
  fields:[
   {key:'mapType',label:'地圖類型',type:'select',options:[['normal','一般地圖'],['final','終局地圖（自訂首領關卡）']],create:true,redraw:true},
   {key:'name',label:'顯示名稱',type:'text'},{key:'min',label:'最低等級',type:'number',min:1,step:1},{key:'max',label:'最高等級',type:'number',min:1,step:1},
   {key:'family',label:'區域家族',type:'select',options:FAMILIES.map((n,i)=>[String(i),i+'｜'+n]),number:true},{key:'icon',label:'圖示文字',type:'text'},{key:'color',label:'介面色碼',type:'color'},
   {key:'parallel',label:'平行／追加區域',type:'check'},{key:'eliteEnabled',label:'啟用菁英',type:'check',when:notHidden},
   {key:'eliteChance',label:'菁英遭遇率（0～1）',type:'number',min:0,max:1,step:.001,when:notHidden},{key:'bossEnabled',label:'啟用 BOSS',type:'check',when:notHidden},
   {key:'overlevelVoucherGold',label:'超等收益券金幣（每張）',type:'number',min:0,step:1,when:notHidden}
  ],
  note:(t,r)=>t.create?'新地圖會自動建立 1 隻普通怪與 BOSS。':r.core?'前 7 張核心地圖不能變更類型或刪除。':'怪物 '+r.monsters+' 隻；用「此地圖的怪物」新增、編輯或刪除怪物。',
  save(t,v,shell){const {mapType,...patch}=v;return t.create?shell.bridge().createMap(mapType,patch):shell.bridge().saveMap(t.index,patch);},
  after(t,result,shell){shell.game()?.contentWindow.__EMBERWILD_V2_GAME?.selectMap(result.index);},
  actions:[{label:'☰ 此地圖的怪物',run(t,r,shell){openList('monsters',shell,t.index);}}],
  removable:(t,r)=>!r.core,
  removeWarning:(t,r)=>'刪除地圖「'+r.name+'」與其中 '+r.monsters+' 隻怪物？後續地圖索引會前移。',
  remove(t,r,shell){return api(shell,'__EMBERWILD_WORLD_EDITOR').deleteMap(t.index);},
  afterRemove(t,result,shell){shell.game()?.contentWindow.__EMBERWILD_V2_GAME?.selectMap(result.index);},
  context:(t,result)=>({mapIndex:result?.index??t.index})
 },
 monster:{
  title:(t,r)=>t.create?'新增怪物 · '+r.mapName:'編輯怪物 · '+r.name,section:'world',
  load(t,shell){const W=api(shell,'__EMBERWILD_WORLD_EDITOR');if(t.create){const map=W.maps()[t.mapIndex];return {name:'新怪物',element:'physical',race:'beast',hpMultiplier:1,attackMultiplier:1,defenseMultiplier:1,spawnWeight:1,maxDrops:1,enabled:true,eliteEnabled:true,kind:'normal',mapIndex:t.mapIndex,mapName:map?.name||'',elements:W.elements(),'baseStats.hp':null,'baseStats.attack':null,'baseStats.defense':null};}
   const r=W.monster(t.id);return {...r,skillIds:r.skillAssignments.map(a=>a.skillId),skillPool:W.monsterSkillPool(t.id),originalSkills:r.skillAssignments.map(a=>a.skillId).join('|')};},
  fields:[
   {key:'name',label:'名稱',type:'text'},{key:'kind',label:'類型',type:'select',options:r=>r.kinds,when:r=>!!r.kinds},
   {key:'element',label:'元素',type:'select',options:r=>r.elements},{key:'race',label:'種族',type:'select',options:RACES},
   {key:'hpMultiplier',label:'生命倍率',type:'number',min:0,step:.01},{key:'attackMultiplier',label:'攻擊倍率',type:'number',min:0,step:.01},{key:'defenseMultiplier',label:'防禦倍率',type:'number',min:0,step:.01},
   {key:'baseStats.hp',label:'個別基礎生命（留空＝等級公式）',type:'number',min:1,step:1,blank:true},{key:'baseStats.attack',label:'個別基礎攻擊（留空＝等級公式）',type:'number',min:1,step:1,blank:true},{key:'baseStats.defense',label:'個別基礎防禦（留空＝等級公式）',type:'number',min:0,step:1,blank:true},
   {key:'spawnWeight',label:'出現權重',type:'number',min:0,step:.01},{key:'maxDrops',label:'最大掉落物數',type:'number',min:0,step:1},
   {key:'attackIntervalSeconds',label:'普攻間隔（秒）',type:'number',min:.1,step:.1,when:r=>r.attackIntervalSeconds!==undefined},
   {key:'enabled',label:'啟用',type:'check'},{key:'eliteEnabled',label:'可菁英化',type:'check',when:r=>!['boss','final'].includes(r.kind)},
   {key:'skillIds',label:'怪物技能（依順序自動施放）',type:'skillList',wide:true,when:r=>!!r.skillPool}
  ],
  note:(t,r)=>t.create?'新怪物加入目前地圖；儲存後可再開啟此怪物指定技能。掉落與關卡排序請在總控模式調整。':'所在地圖：'+r.mapName+(r.skillTimers?.length?'；技能冷卻：'+r.skillTimers.join('、')+'（在技能彈窗調整）':'')+'。掉落與關卡排序請在總控模式調整。',
  save(t,v,shell){const W=api(shell,'__EMBERWILD_WORLD_EDITOR'),{skillIds,...patch}=v;
   if(t.create)return W.createMonster(t.mapIndex,patch);
   // Type changes first: the allowed skills depend on it.
   const out=W.updateMonster(t.id,patch);if(!out.ok||!skillIds||skillIds.join('|')===current.record.originalSkills)return out;
   const skills=W.setMonsterSkills(t.id,skillIds);return skills.ok?out:{ok:false,error:'數值已儲存，技能未儲存：'+skills.error};},
  removeWarning:(t,r)=>'刪除怪物「'+r.name+'」？掉落與信物設定中的引用會一併移除。',
  remove(t,r,shell){return api(shell,'__EMBERWILD_WORLD_EDITOR').deleteMonster(t.id);},
  actions:[{label:'☰ 同地圖怪物',run(t,r,shell){openList('monsters',shell,r.mapIndex);}}],
  context:(t,result,r)=>({mapIndex:r?.mapIndex??t.mapIndex})
 },
 item:{
  title:(t,r)=>'編輯道具 · '+r.name,section:'inventoryIcons',
  load(t,shell){const info=api(shell,'__EMBERWILD_INVENTORY_ICON_EDITOR').info(t.kind+':'+t.key),stats=info.kind==='item'?api(shell,'__EMBERWILD_ITEM_DIALOG').stats(info.key):{};return {...info,...stats};},
  fields:[{key:'name',label:'名稱',type:'text'},{key:'sellPrice',label:'售價',type:'number',min:0,step:1},{key:'cost',label:'商店購買價',type:'number',min:0,step:1,when:r=>r.cost!==undefined},{key:'saleEnabled',label:'可販售',type:'check'},
   {key:'healAmount',label:'回復量',type:'number',min:1,step:1,when:r=>r.itemType==='potion',stat:true},{key:'cooldownSeconds',label:'冷卻（秒）',type:'number',min:0,step:.1,when:r=>r.itemType==='potion',stat:true},
   {key:'boostType',label:'增益類型',type:'select',options:r=>r.boostTypes,when:r=>r.itemType==='timed',stat:true},{key:'bonusPercent',label:'增益百分比',type:'number',min:1,step:1,when:r=>r.itemType==='timed',stat:true},{key:'durationMinutes',label:'持續分鐘',type:'number',min:1,step:1,when:r=>r.itemType==='timed',stat:true},
   {key:'description',label:'說明',type:'textarea',wide:true}],
  note:(t,r)=>r.pending?'此道具在總控模式有未儲存的修改，請先到總控模式儲存或捨棄。':r.kind==='token'?'信物的職業、品質與屬性請按「編輯信物能力」。':r.kind==='equipment'?'裝備屬性請用裝備清單編輯。':'分類、圖示、分解產物請在總控模式的全域道具管理器調整。',
  save(t,v,shell){
   const map={name:'name',description:'description',sellPrice:'sellPrice',saleEnabled:'saleEnabled',cost:'object.cost'},fields={},stats={};
   for(const f of EDITORS.item.fields)if(f.stat&&f.key in v)stats[f.key]=v[f.key];
   if(Object.keys(stats).length){const out=api(shell,'__EMBERWILD_ITEM_DIALOG').updateStats(current.record.key,stats);if(!out.ok)return out;}
   for(const [k,x] of Object.entries(v))if(map[k])fields[map[k]]=k==='name'||k==='description'?x:k==='saleEnabled'?x:Number(x);
   try{api(shell,'__EMBERWILD_INVENTORY_ICON_EDITOR').edit(t.kind+':'+t.key,fields);return {ok:true};}catch(e){return {ok:false,error:e.message};}
  },
  removable:(t,r)=>r.kind==='material'||['potion','timed'].includes(r.itemType),
  removeWarning:(t,r)=>'刪除「'+r.name+'」？'+(r.kind==='material'?'仍有來源、用途或庫存引用的素材不能刪除。':'商店中的此道具商品會一併移除；任務、掉落等其他引用會阻止刪除。'),
  remove(t,r,shell){return api(shell,'__EMBERWILD_ITEM_DIALOG').remove(r.kind,r.key);},
  actions:[{label:'編輯信物能力',when:(t,r)=>r.kind==='token',run(t,r,shell){open({kind:'companionToken',id:r.key,fromList:!!list},shell);}}],
  context:()=>({})
 },
 skill:{
  title:(t,r)=>'編輯技能 · '+r.name+'（'+r.typeName+'）',section:'skillSystem',
  load(t,shell){return api(shell,'__EMBERWILD_SKILL_DIALOG').get(t.id);},
  fields:[
   {key:'name',label:'名稱',type:'text'},{key:'enabled',label:'啟用',type:'check'},
   {key:'power',label:'威力',type:'number',min:0,step:.01,when:r=>r.power!==undefined},
   {key:'initialCooldownSeconds',label:'初始冷卻（秒；每場戰鬥開始）',type:'number',min:0,step:.1,when:r=>['active','support'].includes(r.type)},
   {key:'cooldownSeconds',label:'再使用冷卻（秒；施放後）',type:'number',min:0,step:.1,when:r=>['active','support'].includes(r.type)},
   {key:'mpCost',label:'耗魔',type:'number',min:0,step:.1,when:r=>['active','support'].includes(r.type)},
   {key:'actionCostSeconds',label:'行動成本（秒）',type:'number',min:0,step:.1,when:r=>['active','support'].includes(r.type)},
   {key:'condition',label:'自動施放條件',type:'select',options:[['always','符合目標即可'],['injured','生命低於治療門檻'],['missingEffect','缺少自身施加的效果']],when:r=>['active','support'].includes(r.type)},
   {key:'procBaseChance',label:'觸發率（0～1）',type:'number',min:0,max:1,step:.001,when:r=>r.type==='proc'},
   {key:'maxTargets',label:'目標數',type:'number',min:1,step:1,when:r=>r.maxTargets!==undefined},
   {key:'requiredLevel',label:'需求等級',type:'number',min:1,step:1,when:r=>r.requiredLevel!==undefined},
   {key:'description',label:'說明',type:'textarea',wide:true}
  ],
  note:()=>'自動施放依技能配置順序；初始冷卻每場戰鬥重新套用，再使用冷卻在施放後起算。效果機制、取得來源與狀態請在總控模式調整。',
  actions:[{label:'複製為新技能',run(t,r,shell){const out=api(shell,'__EMBERWILD_SKILL_DIALOG').duplicate(t.id);if(!out.ok)throw Error(out.error);shell.apply();open({kind:'skill',id:out.id,fromList:!!list},shell);shell.status('已複製技能，請檢查取得來源後再發布。');}}],
  removeWarning:(t,r)=>'刪除技能「'+r.name+'」？仍被技能槽、怪物、裝備或解鎖條件引用的技能不能刪除。',
  remove(t,r,shell){return api(shell,'__EMBERWILD_SKILL_DIALOG').remove(t.id);},
  save(t,v,shell){return api(shell,'__EMBERWILD_SKILL_DIALOG').update(t.id,v);},
  context:(t,result,r)=>({job:r?.jobs?.[0]})
 },
 form:{
  title:(t,r)=>t.create?'新增裝備 · '+r.slotName:'編輯裝備 · '+r.name,section:'equipment',
  load(t,shell){const E=api(shell,'__EMBERWILD_EQUIPMENT_EDITOR');const base=t.create?{name:'新裝備',fixedEffects:[{key:'flatAttack',value:0}],wearableJobs:t.slot===1?E.classes().map(c=>c.job):[t.job]}:E.form(t.job,t.slot,t.index);return {...base,slotName:E.slots[t.slot],effectDefs:E.effects(),elements:E.elements(),races:E.races(),classes:E.classes()};},
  fields:[{key:'name',label:'名稱',type:'text',wide:true},{key:'wearableJobs',label:'可穿戴職業',type:'jobs',wide:true},{key:'fixedEffects',label:'固定屬性（1～5 條）',type:'effects',wide:true}],
  note:(t,r)=>'職業 '+(r.classes[t.job]?.name||t.job)+' · '+r.slotName+(t.create?'':' · 變體 '+(t.index+1))+'。重排變體請在總控模式處理。',
  removeWarning:(t,r)=>'刪除裝備「'+r.name+'」？既有存檔的變體索引可能因此改變；仍被商店或掉落引用時不能刪除。',
  remove(t,r,shell){return api(shell,'__EMBERWILD_EQUIPMENT_EDITOR').remove(t.job,t.slot,t.index);},
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
  removeWarning:(t,r)=>'刪除夥伴「'+r.name+'」與其專屬技能？既有存檔會保留已建立的夥伴，新存檔不再顯示。',
  remove(t,r,shell){return api(shell,'__EMBERWILD_COMPANION_EDITOR').remove(t.id);},
  save(t,v,shell){const C=api(shell,'__EMBERWILD_COMPANION_EDITOR');if(t.create){const {job,...patch}=v;return C.create(job,patch);}const {job,...patch}=v;return C.update(t.id,patch);},
  context:(t,result,r)=>({job:r?.job})
 },
 quest:{
  title:(t,r)=>(t.create?'新增':'編輯')+(r.kind==='daily'?'每日委託':'支線任務')+(t.create?'':' · '+r.title),section:'dailyQuests',
  load(t,shell){const Q=api(shell,'__EMBERWILD_QUEST_DIALOG');return t.create?Q.blank(t.questKind):Q.get(t.id);},
  fields:[
   {key:'title',label:'任務名稱',type:'text',wide:true},{key:'enabled',label:'啟用',type:'check'},
   {key:'weight',label:'抽取權重',type:'number',min:0,step:.01,when:r=>r.kind==='daily'},
   {key:'minLevel',label:'最低等級',type:'number',min:1,step:1},{key:'maxLevel',label:'最高等級（0＝不限）',type:'number',min:0,step:1},
   {key:'objectives',label:'完成需求（1～16 個）',type:'objectives',wide:true},
   {key:'rewards.gold',label:'金幣獎勵',type:'number',min:0,step:1},{key:'rewards.xp',label:'主角 EXP',type:'number',min:0,step:1},
   {key:'rewards.ore',label:'鍛鐵',type:'number',min:0,step:1},{key:'rewards.dust',label:'粉塵',type:'number',min:0,step:1},{key:'rewards.randomGems',label:'隨機寶石數',type:'number',min:0,step:1},
   {key:'rewards.gemCounts.0',label:'指定赤焰石',type:'number',min:0,step:1},{key:'rewards.gemCounts.1',label:'指定疾風石',type:'number',min:0,step:1},{key:'rewards.gemCounts.2',label:'指定共鳴石',type:'number',min:0,step:1},
   {key:'rewards.choice',label:'裝備與寶石結算',type:'select',options:[['all','所有獎勵全部發放'],['gearOrGems','裝備／寶石二選一']],redraw:true},
   {key:'rewards.gearChance',label:'二選一抽中裝備機率（0～1）',type:'number',min:0,max:1,step:.01,when:r=>r['rewards.choice']==='gearOrGems'},
   {key:'rewards.gear',label:'裝備獎勵（最多 8 項）',type:'gear',wide:true},
   {key:'description',label:'任務說明',type:'textarea',wide:true}
  ],
  note:(t,r)=>(r.kind==='daily'?'每日委託抽取時依權重選出；數量上限與每地區加量沿用原設定。':'支線依前置條件開放。')+'地區限制、前置任務、道具與裝備獎勵請在總控模式調整'+(r.prerequisites||r.mapIndices?'（目前有前置 '+r.prerequisites+' 個、地區限制 '+r.mapIndices+' 個）':'')+'。',
  save(t,v,shell){const Q=api(shell,'__EMBERWILD_QUEST_DIALOG');return t.create?Q.create(t.questKind,v):Q.update(t.id,v);},
  removeWarning:(t,r)=>'刪除「'+r.title+'」？已完成紀錄會保留；仍被前置條件或技能解鎖引用時不能刪除。',
  remove(t,r,shell){return api(shell,'__EMBERWILD_QUEST_DIALOG').remove(t.id);},
  sectionFor:(t,r)=>r?.kind==='side'?'sideQuests':'dailyQuests',
  context:()=>({})
 },
 shopOffer:{
  title:(t,r)=>(t.create?'新增':'編輯')+r.poolName+(t.create?'':' · '+(r.name||r.id)),section:'shopSettings',
  load(t,shell){const S=api(shell,'__EMBERWILD_SHOP_DIALOG');return t.create?S.blank(t.pool):S.get(t.pool,t.id);},
  fields:[
   {key:'enabled',label:'上架',type:'check'},
   {key:'type',label:'商品類型',type:'select',options:r=>r.types,redraw:true,change(r){const spec=r.keyChoices[r.type];r.key=spec.mode==='select'?spec.options[0]?.[0]??'':spec.mode==='text'?spec.fallback:'';r.unitPrice=r.type==='item'?null:1;}},
   {key:'key',label:'商品內容',type:'choice',spec:r=>r.keyChoices[r.type]},
   {key:'name',label:'商店顯示名稱（留空沿用道具名稱）',type:'text'},
   {key:'unitPrice',label:'單價（道具可留空沿用基本單價）',type:'number',min:0,step:1,blank:true},
   {key:'quantity',label:'數量',type:'number',min:1,step:1,when:r=>r.pool==='fixed'},
   {key:'quantityMin',label:'最小數量',type:'number',min:1,step:1,when:r=>r.pool==='random'},{key:'quantityMax',label:'最大數量',type:'number',min:1,step:1,when:r=>r.pool==='random'},
   {key:'selection',label:'出現方式',type:'select',options:[['weighted','參與商品池權重抽選'],['extra','每批獨立機率追加']],when:r=>r.pool==='random'},
   {key:'weight',label:'出現權重',type:'number',min:0,step:.01,when:r=>r.pool==='random'},{key:'chance',label:'追加機率（0～1）',type:'number',min:0,max:1,step:.001,when:r=>r.pool==='random'}
  ],
  note:(t,r)=>r.pool==='random'?'隨機商品每批依權重抽選；「追加」商品另外依機率判定。刷新價格與每批數量請在總控模式調整。':'固定商品每次進入商店都會上架。道具本身的效果請用道具清單編輯。',
  save(t,v,shell){const S=api(shell,'__EMBERWILD_SHOP_DIALOG');return t.create?S.create(t.pool,v):S.update(t.pool,t.id,v);},
  removeWarning:(t,r)=>'從商店移除「'+(r.name||r.id)+'」？道具本身不會刪除。',
  remove(t,r,shell){return api(shell,'__EMBERWILD_SHOP_DIALOG').remove(t.pool,t.id);},
  context:()=>({})
 },
 companionToken:{
  title:(t,r)=>t.create?'新增信物':'編輯信物 · '+r.name,section:'companionTokens',
  load(t,shell){const T=api(shell,'__EMBERWILD_TOKEN_DIALOG');return t.create?T.blank():T.get(t.id);},
  fields:[
   {key:'name',label:'名稱',type:'text'},{key:'job',label:'適用職業',type:'select',options:r=>[['all','通用'],...r.classes.map(c=>[String(c.job),c.name])]},
   {key:'quality',label:'預設／固定品質',type:'select',options:QUALITIES},{key:'qualityFixed',label:'掉落時固定此品質',type:'check'},
   {key:'drop.enabled',label:'可從怪物掉落',type:'check'},{key:'drop.weight',label:'個別掉落權重',type:'number',min:0,step:.01},
   {key:'drop.minLevel',label:'最低怪物等級',type:'number',min:1,step:1},{key:'drop.maxLevel',label:'最高怪物等級',type:'number',min:1,step:1},
   {key:'fixedEffects',label:'複合屬性（百分比使用百分數，例 5＝5%）',type:'effects',wide:true},
   {key:'description',label:'說明',type:'textarea',wide:true}
  ],
  note:(t,r)=>'夥伴專用；品質與強化乘算屬性數值。'+(r.abilityText?'特殊能力：'+r.abilityText+'。':'')+'特殊能力、掉落地圖與怪物請在總控模式的夥伴信物調整。',
  actions:[{label:'複製信物',run(t,r,shell){const out=ok(api(shell,'__EMBERWILD_TOKEN_DIALOG').duplicate(t.id));shell.apply();open({kind:'companionToken',id:out.id,fromList:!!list},shell);shell.status('已複製信物。');}}],
  save(t,v,shell){const T=api(shell,'__EMBERWILD_TOKEN_DIALOG');return t.create?T.create(v):T.update(t.id,v);},
  removeWarning:(t,r)=>'刪除信物「'+r.name+'」？仍被掉落、任務或其他設定引用時不能刪除。',
  remove(t,r,shell){return api(shell,'__EMBERWILD_TOKEN_DIALOG').remove(t.id);},
  context:()=>({})
 }
};
for(const kind of ['material','equipment','gem','token'])EDITORS[kind]=EDITORS.item;
// Protagonist class (clicking the protagonist portrait, or 職業數值 on the character page). The game has a fixed set of classes.
EDITORS.hero={
 title:(t,r)=>'主角職業數值 · '+r.name,section:'classes',
 load(t,shell){return api(shell,'__EMBERWILD_CLASS_DIALOG').get(t.job);},
 fields:[{key:'name',label:'職業名稱',type:'text'},{key:'advanced',label:'二轉名稱',type:'text'},{key:'main',label:'主要屬性名稱',type:'text'},{key:'initialStats.hp',label:'初始生命',type:'number',min:0,step:1},{key:'initialStats.atk',label:'初始攻擊',type:'number',min:0,step:0.1},{key:'initialStats.def',label:'初始防禦',type:'number',min:0,step:0.1},{key:'initialStats.crit',label:'初始暴擊率（小數）',type:'number',min:0,step:0.001},{key:'initialStats.critDamage',label:'初始暴擊傷害（倍率）',type:'number',min:0,step:0.01},{key:'growthPerLevel.hp',label:'每級生命',type:'number',min:0,step:1},{key:'growthPerLevel.atk',label:'每級攻擊',type:'number',min:0,step:0.1},{key:'growthPerLevel.def',label:'每級防禦',type:'number',min:0,step:0.1},{key:'growthPerLevel.crit',label:'每級暴擊率（小數）',type:'number',min:0,step:0.001},{key:'growthPerLevel.critDamage',label:'每級暴擊傷害（倍率）',type:'number',min:0,step:0.01},{key:'baseIntervalSeconds',label:'基礎普攻間隔（秒）',type:'number',min:.1,step:.1,when:r=>r.baseIntervalSeconds!==undefined},{key:'speedBase',label:'攻速修正（職業基礎速度）',type:'number',min:1,step:1,when:r=>r.speedBase!==undefined},{key:'minimumActionIntervalSeconds',label:'最短行動間隔（秒；全職業共用）',type:'number',min:.05,step:.05,when:r=>r.minimumActionIntervalSeconds!==undefined}],
 note:()=>'自然值 = 初始值 + (等級 − 1) × 每級成長 + 階梯成長。實際普攻間隔 = 基礎普攻間隔 × 速度換算基準 ÷ 角色速度，且不低於最短行動間隔。階梯成長、二轉加成與能力點效果請在總控模式調整。職業數量由遊戲固定，不能新增或刪除。',
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
 note:(t,r)=>r.itemType==='material'?'素材名稱同時是庫存識別，建立後不能改名。來源與用途請在總控模式設定。':'新道具預設不上架；可用商店商品清單上架。',
 save(t,v,shell){const out=api(shell,'__EMBERWILD_ITEM_DIALOG').create(t.itemType,v);if(out?.ok&&out.warning)shell.status(out.warning);return out;},
 context:()=>({})
};
// ---------------------------------------------------------------- list dialogs
const classTabs=shell=>api(shell,'__EMBERWILD_EQUIPMENT_EDITOR').classes().map(c=>({value:c.job,label:c.name,job:true}));
const LISTS={
 maps:{
  title:'地圖清單',section:'world',
  rows(tab,shell){return shell.bridge().maps().map(m=>({label:m.index+'｜'+m.name,meta:'LV'+m.min+'～'+m.max+' · '+(m.final?'終局地圖':'一般地圖')+' · 怪物 '+m.monsters+' 隻'+(m.core?' · 核心':''),target:{kind:'map',index:m.index}}));},
  adds(){return [{label:'＋ 新增地圖',target:{kind:'map',create:true}}];},
  note:'點選地圖編輯數值或刪除；地圖的怪物請用「怪物清單」。前 7 張核心地圖不能刪除。'
 },
 monsters:{
  title:'怪物清單',section:'world',
  tabs:shell=>shell.bridge().maps().map(m=>({value:m.index,label:m.index+'｜'+m.name})),
  rows(tab,shell){return api(shell,'__EMBERWILD_WORLD_EDITOR').monsters(tab).map(m=>({label:m.name,meta:m.kindName+' · '+m.element+' · 生命 ×'+m.hpMultiplier+' · 攻擊 ×'+m.attackMultiplier+' · 防禦 ×'+m.defenseMultiplier+(m.skills?' · 技能 '+m.skills:'')+(m.enabled?'':' · 停用'),target:{kind:'monster',id:m.id},dim:!m.enabled}));},
  adds(tab){return [{label:'＋ 新增怪物',target:{kind:'monster',create:true,mapIndex:tab}},{label:'✎ 編輯此地圖',target:{kind:'map',index:tab}}];},
  note:'先選地圖，再點選怪物編輯數值、技能或刪除。'
 },
 items:{
  title:'道具清單',section:'inventoryIcons',
  groups(tab,shell){const D=api(shell,'__EMBERWILD_ITEM_DIALOG'),all=D.list();return [
   {title:'治療藥水與限時增益券',rows:all.map(i=>({label:i.name,meta:i.meta,target:{kind:'item',key:i.id}}))},
   {title:'素材',rows:D.materials().map(m=>({label:m.name,meta:m.meta,target:{kind:'material',key:m.key}}))}];},
  adds(tab,shell){return Object.entries(api(shell,'__EMBERWILD_ITEM_DIALOG').kinds).map(([type,label])=>({label:'＋ 新增'+label,target:{kind:'newItem',itemType:type,create:true}}));},
  note:'點選道具編輯或刪除。裝備與信物請用裝備清單與信物清單；上架請用商店商品。'
 },
 classes:{
  title:'主角職業數值',section:'classes',
  rows(tab,shell){return api(shell,'__EMBERWILD_CLASS_DIALOG').list().map(c=>({label:c.name+(c.advanced?'／'+c.advanced:''),meta:'LV1 生命 '+c.hp+' · 攻擊 '+c.atk+' · 防禦 '+c.def,target:{kind:'hero',job:c.job}}));},
  note:'點選職業編輯初始值與每級成長。職業數量由遊戲固定。'
 },
 skills:{
  title:'技能清單',section:'skillSystem',tabs:classTabs,
  rows(job,shell){return api(shell,'__EMBERWILD_SKILL_DIALOG').list(job).map(s=>({label:s.name,meta:s.typeName+' · LV'+s.requiredLevel+(s.cooldown?' · 冷卻 '+s.cooldown+' 秒':'')+(s.disabled?' · 停用':''),target:{kind:'skill',id:s.id},dim:s.disabled}));},
  adds(job,shell){const D=api(shell,'__EMBERWILD_SKILL_DIALOG');return Object.entries(D.types).map(([type,label])=>({label:'＋ 新增'+label+'技能',run(){const out=D.create(job,type);if(!out.ok)throw Error(out.error);shell.apply();open({kind:'skill',id:out.id,fromList:true},shell);shell.status('已建立空白技能（預設停用），請設定後啟用。');}}));}
 },
 equipment:{
  title:'裝備清單',section:'equipment',tabs:classTabs,
  groups(job,shell){return api(shell,'__EMBERWILD_EQUIPMENT_EDITOR').list(job).map(g=>({title:g.slotName,rows:g.forms.map(f=>({label:f.name,meta:f.effects,target:{kind:'form',job,slot:g.slot,index:f.index}})),add:{label:'＋ 新增'+g.slotName,target:{kind:'form',job,slot:g.slot,create:true}}}));}
 },
 companions:{
  title:'夥伴清單',section:'companions',tabs:classTabs,
  rows(job,shell){return api(shell,'__EMBERWILD_COMPANION_EDITOR').list().filter(p=>p.job===job).map(p=>({label:p.name,meta:p.jobName+' · '+(p.availability==='hidden'?'隱藏':'顯示'),target:{kind:'companion',id:p.id},dim:p.availability==='hidden'}));},
  adds(job){return [{label:'＋ 新增夥伴',target:{kind:'companion',create:true,job}}];}
 },
 tokens:{
  title:'信物清單',section:'companionTokens',
  rows(tab,shell){return api(shell,'__EMBERWILD_TOKEN_DIALOG').list().map(t=>({label:t.name,meta:t.meta,target:{kind:'companionToken',id:t.id}}));},
  adds(){return [{label:'＋ 新增信物',target:{kind:'companionToken',create:true}}];},
  note:'夥伴專用的信物。點選信物編輯屬性、掉落或刪除。'
 },
 quests:{
  title:'委託清單',section:'dailyQuests',
  tabs:shell=>Object.entries(api(shell,'__EMBERWILD_QUEST_DIALOG').kinds).map(([value,label])=>({value,label})),
  rows(kind,shell){return api(shell,'__EMBERWILD_QUEST_DIALOG').list(kind).map(q=>({label:q.title,meta:q.meta,target:{kind:'quest',id:q.id},dim:!q.enabled}));},
  adds(kind,shell){return [{label:'＋ 新增'+api(shell,'__EMBERWILD_QUEST_DIALOG').kinds[kind],target:{kind:'quest',create:true,questKind:kind}}];},
  note:'切換每日委託或支線，點選任務編輯需求、獎勵或刪除。主線與 NPC 劇情請在總控模式的劇情編輯器調整。'
 },
 shop:{
  title:'商店商品',section:'shopSettings',
  tabs:shell=>Object.entries(api(shell,'__EMBERWILD_SHOP_DIALOG').pools).map(([value,label])=>({value,label})),
  rows(pool,shell){return api(shell,'__EMBERWILD_SHOP_DIALOG').list(pool).map(r=>({label:r.name,meta:r.meta,target:{kind:'shopOffer',pool,id:r.id},dim:!r.enabled}));},
  adds(pool,shell){return [{label:'＋ 新增'+api(shell,'__EMBERWILD_SHOP_DIALOG').pools[pool],target:{kind:'shopOffer',create:true,pool}}];},
  note:'切換隨機或固定商品池，點選商品編輯價格、數量或移除。'
 }
};
let current=null,list=null;
function dialog(){
 let d=$('devInlineDialog');if(d)return d;
 d=document.createElement('dialog');d.id='devInlineDialog';d.className='dev-inline-dialog';d.setAttribute('aria-labelledby','devInlineTitle');
 d.innerHTML='<form method="dialog" id="devInlineForm" novalidate><h2 id="devInlineTitle"></h2><p id="devInlineNote" class="muted"></p><div id="devInlineTabs" class="dev-inline-tabs" role="group" aria-label="分類"></div><div id="devInlineFields" class="dev-inline-fields"></div><p id="devInlineError" class="dev-inline-error" role="alert"></p><div class="dev-inline-actions"><button type="button" id="devInlineBack" hidden>← 返回清單</button><button type="button" id="devInlineFull">在總控模式開啟</button><span id="devInlineExtra"></span><button type="button" id="devInlineDelete" class="danger" hidden>刪除</button><span class="spacer"></span><button type="button" id="devInlineCancel">關閉</button><button type="submit" id="devInlineSave" class="primary">儲存並套用預覽</button></div></form>';
 document.body.append(d);
 const style=document.createElement('style');style.textContent='.dev-inline-dialog{border:1px solid var(--gold);border-radius:12px;background:var(--panel);color:var(--text);padding:18px;width:min(680px,calc(100vw - 32px));max-height:calc(100dvh - 40px);overflow:auto}.dev-inline-dialog::backdrop{background:#0008}.dev-inline-dialog h2{margin:0 0 4px;font-size:17px}.dev-inline-tabs{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0}.dev-inline-tabs:empty{display:none}.dev-inline-tabs button{font-size:12px;padding:5px 10px}.dev-inline-tabs button[aria-pressed=true]{border-color:var(--gold);background:var(--selected)}.dev-inline-tabs select{width:100%;min-width:0;border:1px solid var(--line);background:var(--control);color:var(--text);border-radius:7px;padding:6px 8px}.dev-inline-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:12px 0}.dev-inline-fields .wide{grid-column:1/-1}.dev-inline-fields label{display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--muted);min-width:0}.dev-inline-fields label.check{flex-direction:row;align-items:center;gap:8px;color:var(--text)}.dev-inline-fields input:not([type=checkbox]),.dev-inline-fields select,.dev-inline-fields textarea{width:100%;min-width:0;border:1px solid var(--line);background:var(--control);color:var(--text);border-radius:7px;padding:6px 8px;font:inherit}.dev-inline-fields textarea{min-height:64px;resize:vertical}.dev-inline-fields input[type=color]{padding:2px;height:34px}.dev-inline-error{color:#e49a8a;font-size:12px;white-space:pre-wrap;min-height:1em;margin:0 0 8px}.dev-inline-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.dev-inline-actions .spacer{flex:1}#devInlineExtra{display:contents}#devInlineDelete{border-color:#a5574b;color:#f0b3a8}#devInlineDelete[data-armed=true]{background:#7d3328;color:#fff}.dev-fx-row,.dev-obj-row{display:grid;grid-template-columns:minmax(0,2fr) minmax(0,1fr) minmax(0,1fr) auto;gap:6px;align-items:center;margin-bottom:6px}.dev-gear-row{display:grid;grid-template-columns:repeat(3,minmax(0,1.3fr)) repeat(2,minmax(0,.8fr)) auto;gap:6px;align-items:center;margin-bottom:6px}.dev-skill-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px;margin-bottom:6px}.dev-jobs{display:flex;gap:10px;flex-wrap:wrap;color:var(--text)}.dev-jobs label{flex-direction:row!important;align-items:center;gap:4px;color:var(--text)!important}.dev-list-group{grid-column:1/-1}.dev-list-group h3{font-size:13px;margin:6px 0;color:var(--gold)}.dev-list-row{display:flex;justify-content:space-between;align-items:center;gap:10px;width:100%;text-align:left;margin-bottom:6px;padding:8px 10px}.dev-list-row small{color:var(--muted);font-size:11px;overflow-wrap:anywhere}.dev-list-row.dim{opacity:.65}.dev-list-adds{grid-column:1/-1;display:flex;gap:6px;flex-wrap:wrap}@media(max-width:460px){.dev-inline-fields{grid-template-columns:1fr}.dev-gear-row{grid-template-columns:1fr 1fr 1fr}.dev-fx-row,.dev-obj-row{grid-template-columns:1fr 1fr}}';
 document.head.append(style);
 $('devInlineCancel').onclick=()=>d.close();
 $('devInlineForm').onsubmit=e=>{e.preventDefault();save();};
 $('devInlineBack').onclick=()=>{if(list)openList(list.kind,list.shell,list.tab);};
 $('devInlineDelete').onclick=()=>remove();
 $('devInlineFull').onclick=()=>{const c=current||list;d.close();if(!c)return;const section=c.editor?(c.editor.sectionFor?.(c.target,c.record)||c.editor.section):LISTS[c.kind]?.section;c.shell.open(section,c.editor?c.editor.context(c.target,null,c.record):{job:typeof c.tab==='number'?c.tab:0,mapIndex:c.kind==='monsters'?c.tab:undefined});};
 return d;
}
const opts=(f,r,shell)=>typeof f.options==='function'?f.options(r,shell):f.options;
const choiceHTML=(spec,value,attrs,label)=>{
 if(!spec||spec.mode==='none')return '<span class="muted">（不需指定）</span>';
 if(spec.mode==='fixed')return `<span class="muted">${esc(spec.value)}</span>`;
 if(spec.mode==='select'){const options=spec.options.some(([k])=>String(k)===String(value))?spec.options:[...spec.options,[String(value),'無效引用 · '+value]];return `<select ${attrs} aria-label="${esc(label)}">${options.map(([k,n])=>`<option value="${esc(k)}" ${String(value)===String(k)?'selected':''}>${esc(n)}</option>`).join('')}</select>`;}
 const listId='devInlineSuggest'+Math.random().toString(36).slice(2,8);
 return `<input ${attrs} type="text" value="${esc(value)}" list="${listId}" aria-label="${esc(label)}"><datalist id="${listId}">${(spec.suggest||[]).map(x=>`<option value="${esc(x)}"></option>`).join('')}</datalist>`;
};
function effectsHTML(r,key){
 const defs=r.effectDefs,rows=r[key]||[],min=r.effectMin??1,max=r.effectMax??5;return rows.map((fx,i)=>{const def=defs.find(d=>d.key===fx.key)||defs[0];
  const target=def.target==='element'?`<select data-fx="${i}" data-part="element">${r.elements.filter(([v])=>r.effectMin===0||v!=='physical').map(([v,n])=>`<option value="${v}" ${fx.element===v?'selected':''}>${esc(n)}</option>`).join('')}</select>`:def.target==='race'?`<select data-fx="${i}" data-part="race">${r.races.map(([v,n])=>`<option value="${v}" ${fx.race===v?'selected':''}>${esc(n)}</option>`).join('')}</select>`:def.target==='skill'?`<input data-fx="${i}" data-part="skill" type="number" min="0" step="1" value="${esc(fx.skill??0)}" title="核心技能序號">`:'<span></span>';
  const value=fx.key==='basicElement'?`<select data-fx="${i}" data-part="value">${r.elements.map(([v,n])=>`<option value="${v}" ${fx.value===v?'selected':''}>${esc(n)}</option>`).join('')}</select>`:`<input data-fx="${i}" data-part="value" type="number" step="0.01" value="${esc(fx.value)}" aria-label="${esc(def.label)} 數值">`;
  return `<div class="dev-fx-row"><select data-fx="${i}" data-part="key" aria-label="屬性">${defs.map(d=>`<option value="${d.key}" ${d.key===fx.key?'selected':''}>${esc(d.label)}</option>`).join('')}</select>${target}${value}<button type="button" data-fx-del="${i}" ${rows.length<=min?'disabled':''} aria-label="刪除此屬性">×</button></div>`;}).join('')+`<button type="button" id="devFxAdd" ${rows.length>=max?'disabled':''}>＋ 新增屬性</button>`;
}
function objectivesHTML(r){
 const c=r.objectiveChoices;return r.objectives.map((o,i)=>`<div class="dev-obj-row" data-obj-row="${i}"><select data-obj="${i}" data-part="type" aria-label="需求類型">${c.types.map(([k,n])=>`<option value="${k}" ${o.type===k?'selected':''}>${esc(n)}</option>`).join('')}</select>${choiceHTML(c.keys[o.type],o.key,`data-obj="${i}" data-part="key"`,'需求內容')}<input data-obj="${i}" data-part="quantity" type="number" min="1" step="1" value="${esc(o.quantity)}" aria-label="${o.type==='level'?'目標等級':'需求數量'}"><button type="button" data-obj-del="${i}" ${r.objectives.length<=1?'disabled':''} aria-label="移除此需求">×</button></div>`).join('')+`<button type="button" id="devObjAdd" ${r.objectives.length>=16?'disabled':''}>＋ 新增需求</button>`;
}
const GEAR_SLOTS=[['-1','隨機部位'],['0','武器'],['1','防具'],['2','副手'],['3','飾品']];
function gearHTML(r){
 const sel=(i,part,value,options,label)=>`<select data-gear="${i}" data-part="${part}" aria-label="${label}">${options.map(([k,n])=>`<option value="${k}" ${String(value)===String(k)?'selected':''}>${esc(n)}</option>`).join('')}</select>`;
 const rows=r['rewards.gear'];return rows.map((g,i)=>`<div class="dev-gear-row">${sel(i,'job',g.job,[['-1','隨機職業'],...r.classes],'職業')}${sel(i,'slot',g.slot,GEAR_SLOTS,'部位')}${sel(i,'rar',g.rar,QUALITIES,'品質')}<input data-gear="${i}" data-part="quantity" type="number" min="1" max="10" step="1" value="${esc(g.quantity)}" aria-label="數量"><input data-gear="${i}" data-part="tier" type="number" min="0" max="100" step="1" value="${esc(g.tier)}" aria-label="階級（0＝當日地區）" title="階級（0＝當日地區）"><button type="button" data-gear-del="${i}" aria-label="移除此裝備">×</button></div>`).join('')+(rows.length?'<p class="muted">欄位：職業、部位、品質、數量、階級（0＝當日地區）。</p>':'<p class="muted">目前沒有裝備獎勵。</p>')+`<button type="button" id="devGearAdd" ${rows.length>=8?'disabled':''}>＋ 新增裝備獎勵</button>`;
}
function skillListHTML(r){
 const used=new Set(r.skillIds);return r.skillIds.map((id,i)=>`<div class="dev-skill-row"><select data-skill-row="${i}" aria-label="技能 ${i+1}">${(r.skillPool.some(([k])=>k===id)?r.skillPool:[...r.skillPool,[id,id+'（目前類型不可用）']]).map(([k,n])=>`<option value="${esc(k)}" ${k===id?'selected':''} ${k!==id&&used.has(k)?'disabled':''}>${esc(n)}</option>`).join('')}</select><button type="button" data-skill-del="${i}" aria-label="移除此技能">×</button></div>`).join('')+(r.skillIds.length?'':'<p class="muted">此怪物目前只使用普攻。</p>')+`<button type="button" id="devSkillAdd" ${r.skillPool.every(([k])=>used.has(k))?'disabled':''}>＋ 新增技能</button>`;
}
function input(f,v,r,shell){
 const id='devInline-'+f.key.replace(/\W/g,'_'),wide=f.wide?' wide':'';
 if(f.type==='check')return `<label class="check${wide}"><input id="${id}" type="checkbox" data-key="${f.key}" ${v?'checked':''}>${esc(f.label)}</label>`;
 if(f.type==='select')return `<label class="${wide}">${esc(f.label)}<select id="${id}" data-key="${f.key}">${opts(f,r,shell).map(([k,n])=>`<option value="${esc(k)}" ${String(v)===String(k)?'selected':''}>${esc(n)}</option>`).join('')}</select></label>`;
 if(f.type==='choice')return `<label class="${wide}">${esc(f.label)}${choiceHTML(f.spec(r),v,`id="${id}" data-key="${f.key}"`,f.label)}</label>`;
 if(f.type==='textarea')return `<label class="${wide}">${esc(f.label)}<textarea id="${id}" data-key="${f.key}">${esc(v)}</textarea></label>`;
 if(f.type==='jobs')return `<div class="${wide}"><label>${esc(f.label)}</label><div class="dev-jobs" id="${id}">${r.classes.map(c=>`<label><input type="checkbox" data-job="${c.job}" ${(v||[]).includes(c.job)?'checked':''}>${esc(c.name)}</label>`).join('')}</div></div>`;
 if(f.type==='effects')return `<div class="${wide}"><label>${esc(f.label)}</label><div id="devInlineEffects" data-effects-key="${f.key}">${effectsHTML(r,f.key)}</div></div>`;
 if(f.type==='objectives')return `<div class="${wide}"><label>${esc(f.label)}</label><div id="devInlineObjectives">${objectivesHTML(r)}</div></div>`;
 if(f.type==='gear')return `<div class="${wide}"><label>${esc(f.label)}</label><div id="devInlineGear">${gearHTML(r)}</div></div>`;
 if(f.type==='skillList')return `<div class="${wide}"><label>${esc(f.label)}</label><div id="devInlineSkills">${skillListHTML(r)}</div></div>`;
 const attrs=['min','max','step'].filter(a=>f[a]!==undefined).map(a=>`${a}="${f[a]}"`).join(' ');
 return `<label class="${wide}">${esc(f.label)}<input id="${id}" data-key="${f.key}" type="${f.type==='number'?'number':f.type==='color'?'color':'text'}" ${attrs} value="${esc(v)}" ${f.blank?'placeholder="留空"':''}></label>`;
}
function visible(f){const {target,record}=current;return (!f.create||target.create)&&(!f.when||f.when(record));}
function draw(){
 const {editor,target,record,shell}=current;
 $('devInlineTitle').textContent=editor.title(target,record);$('devInlineNote').textContent=editor.note?.(target,record)||'';$('devInlineTabs').replaceChildren();
 $('devInlineFields').innerHTML=editor.fields.filter(visible).map(f=>input(f,record[f.key],record,shell)).join('');
 $('devInlineSave').hidden=false;$('devInlineBack').hidden=!list;
 const del=$('devInlineDelete');del.hidden=!!target.create||!editor.remove||(editor.removable&&!editor.removable(target,record));del.dataset.armed='false';del.textContent='刪除';
 $('devInlineExtra').replaceChildren(...(target.create?[]:(editor.actions||[]).filter(a=>!a.when||a.when(target,record))).map(a=>{const b=document.createElement('button');b.type='button';b.textContent=a.label;b.onclick=()=>{try{a.run(target,record,shell);}catch(e){$('devInlineError').textContent=e.message;}};return b;}));
 for(const el of $('devInlineFields').querySelectorAll('[data-key]'))el.onchange=()=>{const f=editor.fields.find(x=>x.key===el.dataset.key);record[el.dataset.key]=read(el);if(f?.change)f.change(record);if(f?.redraw)draw();};
 for(const el of $('devInlineFields').querySelectorAll('[data-job]'))el.onchange=()=>{record.wearableJobs=[...$('devInlineFields').querySelectorAll('[data-job]:checked')].map(x=>Number(x.dataset.job));};
 bindEffects();bindObjectives();bindSkills();bindGear();
}
function bindEffects(){
 const host=$('devInlineEffects');if(!host)return;const r=current.record,key=host.dataset.effectsKey,rows=()=>r[key];const redraw=()=>{host.innerHTML=effectsHTML(r,key);bindEffects();};
 for(const el of host.querySelectorAll('[data-fx]'))el.onchange=()=>{const fx=rows()[Number(el.dataset.fx)],part=el.dataset.part;if(part==='key'){fx.key=el.value;fx.value=el.value==='basicElement'?'fire':0;delete fx.element;delete fx.race;delete fx.skill;const def=r.effectDefs.find(d=>d.key===fx.key);if(def?.target==='element')fx.element='fire';if(def?.target==='race')fx.race='beast';if(def?.target==='skill')fx.skill=0;redraw();return;}fx[part]=part==='value'&&fx.key!=='basicElement'||part==='skill'?Number(el.value):el.value;};
 for(const el of host.querySelectorAll('[data-fx-del]'))el.onclick=()=>{rows().splice(Number(el.dataset.fxDel),1);redraw();};
 const add=$('devFxAdd');if(add)add.onclick=()=>{rows().push({key:'flatAttack',value:0});redraw();};
}
function bindObjectives(){
 const host=$('devInlineObjectives');if(!host)return;const r=current.record,c=r.objectiveChoices;const redraw=()=>{host.innerHTML=objectivesHTML(r);bindObjectives();};
 const fallback=type=>{const s=c.keys[type];return s.mode==='select'?(s.options[0]?.[0]??''):s.mode==='text'?s.fallback:s.mode==='fixed'?s.value:'';};
 for(const el of host.querySelectorAll('[data-obj]'))el.onchange=()=>{const o=r.objectives[Number(el.dataset.obj)],part=el.dataset.part;if(part==='type'){o.type=el.value;o.key=fallback(o.type);redraw();return;}o[part]=part==='quantity'?Number(el.value):el.value;};
 for(const el of host.querySelectorAll('[data-obj-del]'))el.onclick=()=>{r.objectives.splice(Number(el.dataset.objDel),1);redraw();};
 const add=$('devObjAdd');if(add)add.onclick=()=>{const type=c.types[0][0];r.objectives.push({type,key:fallback(type),quantity:1});redraw();};
}
function bindGear(){
 const host=$('devInlineGear');if(!host)return;const r=current.record,rows=r['rewards.gear'];const redraw=()=>{host.innerHTML=gearHTML(r);bindGear();};
 for(const el of host.querySelectorAll('[data-gear]'))el.onchange=()=>{rows[Number(el.dataset.gear)][el.dataset.part]=Number(el.value);};
 for(const el of host.querySelectorAll('[data-gear-del]'))el.onclick=()=>{rows.splice(Number(el.dataset.gearDel),1);redraw();};
 const add=$('devGearAdd');if(add)add.onclick=()=>{rows.push({job:-1,slot:-1,rar:1,quantity:1,tier:0,legendaryChance:0});redraw();};
}
function bindSkills(){
 const host=$('devInlineSkills');if(!host)return;const r=current.record;const redraw=()=>{host.innerHTML=skillListHTML(r);bindSkills();};
 for(const el of host.querySelectorAll('[data-skill-row]'))el.onchange=()=>{r.skillIds[Number(el.dataset.skillRow)]=el.value;redraw();};
 for(const el of host.querySelectorAll('[data-skill-del]'))el.onclick=()=>{r.skillIds.splice(Number(el.dataset.skillDel),1);redraw();};
 const add=$('devSkillAdd');if(add)add.onclick=()=>{const used=new Set(r.skillIds),next=r.skillPool.find(([k])=>!used.has(k));if(next){r.skillIds.push(next[0]);redraw();}};
}
function read(el){const f=current.editor.fields.find(x=>x.key===el.dataset.key);if(f.type==='check')return el.checked;if(f.type==='number')return el.value===''?(f.blank?null:NaN):Number(el.value);if(f.number)return Number(el.value);return el.value;}
function values(){const out={};for(const f of current.editor.fields.filter(visible)){if(['effects','objectives','skillList','gear'].includes(f.type)||f.type==='jobs')out[f.key]=current.record[f.key==='wearableJobs'?'wearableJobs':f.key];else{const el=$('devInlineFields').querySelector(`[data-key="${f.key}"]`);if(el)out[f.key]=read(el);}}return out;}
const recordName=(v,r)=>v.name||v.title||r.name||r.title||'';
function save(){
 if(!current)return false;const {editor,target,shell}=current,v=values();let result;
 try{result=editor.save(target,v,shell);}catch(e){result={ok:false,error:e.message};}
 if(!result?.ok){$('devInlineError').textContent='無法儲存：'+(result?.error||'未知錯誤');return false;}
 shell.apply();editor.after?.(target,result,shell);
 shell.status((target.create?'已新增並套用至預覽：':'已更新並套用至預覽：')+recordName(v,current.record)+'。尚未發布。'+(result.existingIssues?.length?'\n草稿中其他既有問題（未阻擋此次儲存）：'+result.existingIssues.join('；'):''));
 if(list){openList(list.kind,list.shell,list.tab);}else dialog().close();return true;
}
// Delete asks for a second click on the same button instead of a browser confirm, so it works the same inside frames and tests.
function remove(){
 if(!current?.editor.remove)return false;const {editor,target,record,shell}=current,del=$('devInlineDelete');
 if(del.dataset.armed!=='true'){del.dataset.armed='true';del.textContent='確認刪除';$('devInlineError').textContent=editor.removeWarning?.(target,record)||'再按一次「確認刪除」即刪除。';return false;}
 let result;try{result=editor.remove(target,record,shell);}catch(e){result={ok:false,error:e.message};}
 del.dataset.armed='false';del.textContent='刪除';
 if(!result?.ok){$('devInlineError').textContent='無法刪除：'+(result?.error||'未知錯誤');return false;}
 shell.apply();editor.afterRemove?.(target,result,shell);
 shell.status('已刪除並套用至預覽：'+recordName({},record)+'。尚未發布。');
 if(list){openList(list.kind,list.shell,list.tab);}else dialog().close();return true;
}
function open(target,shell){
 const editor=EDITORS[target?.kind];if(!editor)return false;
 if(target.kind==='equipment'){const m=/^form:(\d+):(\d+):(\d+)$/.exec(String(target.key||''));if(m)return open({kind:'form',job:Number(m[1]),slot:Number(m[2]),index:Number(m[3]),fromList:target.fromList},shell);}
 try{current={editor,target,shell,record:structuredClone(editor.load(target,shell))};}catch(e){shell.status('無法開啟：'+e.message);return false;}
 if(!target.fromList)list=null;
 const d=dialog();$('devInlineError').textContent='';draw();if(!d.open)d.showModal();$('devInlineFields').querySelector('input,select,textarea')?.focus();return true;
}
function openList(kind,shell,tab){
 const def=LISTS[kind];if(!def)return false;const d=dialog();current=null;
 let tabs=[];try{tabs=def.tabs?def.tabs(shell):[];}catch(e){shell.status('無法開啟：'+e.message);return false;}
 if(tabs.length){const values=tabs.map(t=>t.value);if(!values.some(v=>String(v)===String(tab)))tab=values[0];else tab=values.find(v=>String(v)===String(tab));}
 list={kind,shell,tab,job:typeof tab==='number'?tab:0};
 const active=tabs.find(t=>t.value===tab);
 $('devInlineTitle').textContent=active?def.title+' · '+active.label:def.title;$('devInlineNote').textContent=def.note||(tabs.length?'先切換分類，再點選要編輯的項目或新增。':'點選要編輯的項目或新增。');$('devInlineError').textContent='';$('devInlineSave').hidden=true;$('devInlineBack').hidden=true;$('devInlineDelete').hidden=true;$('devInlineExtra').replaceChildren();
 // Few tabs show as buttons (class tabs keep data-list-job); many (maps) as a select.
 if(tabs.length>6)$('devInlineTabs').innerHTML=`<select id="devInlineTabSelect" aria-label="${esc(def.title)}分類">${tabs.map((t,i)=>`<option value="${i}" ${t.value===tab?'selected':''}>${esc(t.label)}</option>`).join('')}</select>`;
 else $('devInlineTabs').innerHTML=tabs.map((t,i)=>`<button type="button" data-list-tab="${i}" ${t.job?`data-list-job="${t.value}"`:''} aria-pressed="${t.value===tab}">${esc(t.label)}</button>`).join('');
 for(const b of $('devInlineTabs').querySelectorAll('[data-list-tab]'))b.onclick=()=>openList(kind,shell,tabs[Number(b.dataset.listTab)].value);
 const sel=$('devInlineTabSelect');if(sel)sel.onchange=()=>openList(kind,shell,tabs[Number(sel.value)].value);
 let groups;try{groups=def.groups?def.groups(tab,shell):[{title:'',rows:def.rows(tab,shell)}];}catch(e){$('devInlineError').textContent=e.message;groups=[];}
 let adds=[];try{adds=def.adds?def.adds(tab,shell):[];}catch(e){$('devInlineError').textContent=e.message;}
 $('devInlineFields').innerHTML=groups.map((g,gi)=>`<section class="dev-list-group">${g.title?`<h3>${esc(g.title)}</h3>`:''}${g.rows.map((r,ri)=>`<button type="button" class="dev-list-row ${r.dim?'dim':''}" data-row="${gi}:${ri}"><b>${esc(r.label)}</b><small>${esc(r.meta||'')}</small></button>`).join('')||'<p class="muted">目前沒有項目。</p>'}${g.add?`<button type="button" data-group-add="${gi}">${esc(g.add.label)}</button>`:''}</section>`).join('')+(adds.length?`<div class="dev-list-adds">${adds.map((a,i)=>`<button type="button" data-list-add="${i}">${esc(a.label)}</button>`).join('')}</div>`:'');
 for(const b of $('devInlineFields').querySelectorAll('[data-row]'))b.onclick=()=>{const [gi,ri]=b.dataset.row.split(':').map(Number);open({...groups[gi].rows[ri].target,fromList:true},shell);};
 for(const b of $('devInlineFields').querySelectorAll('[data-group-add]'))b.onclick=()=>open({...groups[Number(b.dataset.groupAdd)].add.target,fromList:true},shell);
 for(const b of $('devInlineFields').querySelectorAll('[data-list-add]'))b.onclick=()=>{const a=adds[Number(b.dataset.listAdd)];try{if(a.target)open({...a.target,fromList:true},shell);else a.run();}catch(e){$('devInlineError').textContent=e.message;}};
 if(!d.open)d.showModal();return true;
}
globalThis.DreamingAbyssInlineEdit=Object.freeze({open,openList,kinds:()=>Object.keys(EDITORS),lists:()=>Object.keys(LISTS),save,remove});
})();
