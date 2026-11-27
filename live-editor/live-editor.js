/* 夢淵 即時平衡器（Live Balance Editor）
 * 注入遊戲頁面後，在畫面右下角提供編輯面板。
 * - 點字改字：點畫面上的任何文字，寫入 textOverrides。
 * - 點選定位：點畫面上的道具、技能、夥伴、怪物等，找出對應資料並開啟編輯。
 * - 資料分類：所有平衡資料都能以欄位或 JSON 編輯，改完立即套用到遊戲。
 * - 一鍵匯出完整 balance JSON。
 * 只使用遊戲公開的 validateBalanceConfig / applyBalanceConfig / exportableBalance / EmberwildTextOverrides。
 */
(()=>{
'use strict';
if(globalThis.__DA_LIVE_EDITOR__)return;
globalThis.__DA_LIVE_EDITOR__=true;

const VERSION='2.0.0';
const DRAFT_KEY='da-live-editor-draft-v1';
const UI_KEY='da-live-editor-ui-v1';
const clone=v=>JSON.parse(JSON.stringify(v));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const store={get(k){try{return localStorage.getItem(k);}catch{return null;}},set(k,v){try{localStorage.setItem(k,v);return true;}catch{return false;}},del(k){try{localStorage.removeItem(k);}catch{}}};

// 資料分類：path 指向陣列或物件；label 決定清單顯示名稱
const CATEGORIES=[
 {sys:'道具與裝備',id:'items',name:'道具',path:['items']},
 {sys:'職業與技能',id:'skills',name:'技能',path:['skillSystem','definitions']},
 {sys:'道具與裝備',id:'gems',name:'寶石',path:['skillSystem','gems']},
 {sys:'職業與技能',id:'classRules',name:'職業技能規則',path:['skillSystem','classRules']},
 {sys:'道具與裝備',id:'skillEquip',name:'裝備技能池',path:['skillSystem','equipment']},
 {sys:'職業與技能',id:'classes',name:'職業',path:['classes']},
 {sys:'職業與技能',id:'support',name:'輔助技能',path:['supportSkills']},
 {sys:'夥伴',id:'companions',name:'夥伴',path:['companions']},
 {sys:'職業與技能',id:'passives',name:'被動',path:['passiveDefinitions']},
 {sys:'夥伴',id:'companionSettings',name:'夥伴設定',path:['companionSettings']},
 {sys:'夥伴',id:'tokens',name:'信物',path:['companionTokens','catalog']},
 {sys:'怪物與地圖',id:'monsters',name:'怪物',path:['balanceSettings','monsters','catalog']},
 {sys:'怪物與地圖',id:'monsterRules',name:'怪物規則',path:['balanceSettings','monsters']},
 {sys:'怪物與地圖',id:'maps',name:'地圖',path:['balanceSettings','maps']},
 {sys:'怪物與地圖',id:'drops',name:'掉落',path:['balanceSettings','drops']},
 {sys:'職業與技能',id:'statuses',name:'狀態',path:['statusDefinitions']},
 {sys:'道具與裝備',id:'forms',name:'裝備類型',path:['equipmentForms']},
 {sys:'道具與裝備',id:'power',name:'裝備強度',path:['equipmentPowerSystem']},
 {sys:'商店與經濟',id:'shop',name:'商店',path:['shopSettings']},
 {sys:'任務與劇情',id:'story',name:'劇情任務',path:['story','quests']},
 {sys:'任務與劇情',id:'quests',name:'委託',path:['balanceSettings','quests']},
 {sys:'任務與劇情',id:'tutorials',name:'教學',path:['tutorials','modules']},
 {sys:'商店與經濟',id:'wishing',name:'許願池',path:['wishingLake']},
 {sys:'道具與裝備',id:'crafting',name:'製作',path:['crafting']},
 {sys:'道具與裝備',id:'starter',name:'新手包',path:['starterPacks']},
 {sys:'戰鬥與系統',id:'settings',name:'遊戲設定',path:['balanceSettings']},
 {sys:'戰鬥與系統',id:'combat',name:'戰鬥公式',path:['balance']},
 {sys:'戰鬥與系統',id:'uiText',name:'介面標題',path:['uiText']},
 {sys:'戰鬥與系統',id:'navigation',name:'選單',path:['navigation']},
 {sys:'道具與裝備',id:'icons',name:'背包圖示',path:['inventoryIcons']},
 {sys:'道具與裝備',id:'skillIcons',name:'自製圖示',path:['skillIcons']},
 {sys:'戰鬥與系統',id:'root',name:'全部資料',path:[]}
];
const SYSTEMS=["職業與技能", "夥伴", "道具與裝備", "怪物與地圖", "任務與劇情", "商店與經濟", "戰鬥與系統"];
const LABEL_KEYS=['name','title','label','text','id','key','type'];

let base=null;          // 遊戲啟動時的發布資料
let draft=null;         // 目前編輯中的完整文件
let history=[],future=[];
let ui={open:false,tab:'data',cat:'items',path:null,filter:'',auto:true,x:null};
try{Object.assign(ui,JSON.parse(store.get(UI_KEY)||'{}'));}catch{}
let pickMode=null;      // 'text' | 'inspect' | null
let applyTimer=null,lastStatus={ok:true,msg:'尚未修改'};
let pendingText=null;   // {source,original,text}
let inspectResults=[];

// ---------- 路徑工具 ----------
function getAt(obj,path){let cur=obj;for(const k of path){if(cur==null)return undefined;cur=cur[k];}return cur;}
function setAt(obj,path,value){if(!path.length)return value;let cur=obj;for(let i=0;i<path.length-1;i++)cur=cur[path[i]];cur[path[path.length-1]]=value;return obj;}
function pathText(path){return path.length?path.map(k=>typeof k==='number'?'['+k+']':'.'+k).join('').replace(/^\./,''):'（根）';}
function labelOf(v,k){
 if(v&&typeof v==='object'&&!Array.isArray(v)){
  for(const key of LABEL_KEYS)if(typeof v[key]==='string'&&v[key].trim()){const id=v.id!=null&&key!=='id'?' · '+v.id:'';return v[key]+id;}
  for(const key of LABEL_KEYS)if(typeof v[key]==='number')return key+' '+v[key];
 }
 if(Array.isArray(v)){const named=v.find(x=>x&&typeof x==='object'&&typeof x.name==='string');return (typeof k==='number'?'#'+k+' ':'')+(named?named.name+' 等 ':'')+v.length+' 筆';}
 if(v===null||typeof v!=='object')return String(k)+'：'+String(v).slice(0,40);
 return String(k);
}

// ---------- 參數中文註解 ----------
// 完整欄位名稱對照；查不到時以下方單字表拆解駝峰命名組合
const KEY_ZH={
 id:'識別碼',name:'名稱',title:'標題',label:'標籤',text:'文字',description:'說明',hint:'提示',type:'類型',kind:'種類',key:'鍵值',value:'數值',values:'數值表',version:'版本',schemaVersion:'結構版本',schema:'資料格式',revision:'修訂號',enabled:'啟用',disabled:'停用',hidden:'隱藏',order:'排序',priority:'優先度',category:'分類',group:'群組',groups:'群組',tags:'標籤',icon:'圖示',iconType:'圖示類型',color:'顏色',
 hp:'生命',atk:'攻擊',def:'防禦',mp:'魔力',maxMp:'最大魔力',crit:'暴擊率',critDamage:'暴擊傷害倍率',pierce:'防禦穿透',defenseIgnore:'無視防禦比例',lifesteal:'生命竊取',evasion:'閃避率',elementBonus:'屬性增傷',bossDamage:'對首領增傷',speedBonus:'速度加成',attackSpeed:'攻擊速度',attackSpeedPct:'攻擊速度 %',
 job:'職業編號',jobs:'適用職業',main:'主屬性',advanced:'進階職業名稱',classes:'職業',skills:'技能',active:'主動技能',proc:'觸發技能',support:'輔助技能',core:'核心技能',passives:'被動技能',weapon:'武器',weaponType:'武器類型',weaponTypes:'可用武器類型',rating:'評級',
 activation:'施放方式',effect:'效果類型',element:'屬性',race:'種族',power:'技能倍率',cooldown:'冷卻（舊回合制相容值）',cooldownSeconds:'冷卻秒數',duration:'持續時間',durationSeconds:'持續秒數',durationMinutes:'持續分鐘',maxTargets:'最多目標數',hitCount:'攻擊段數',requiredLevel:'需求等級',requiresAdvanced:'需要轉職',mastery:'精通類型',requiredMastery:'需求精通類型',requiredMasteryLevel:'需求精通等級',baseCritRate:'基礎暴擊率',baseCritDamage:'基礎暴擊傷害',defensePenetration:'防禦穿透',mpCost:'魔力消耗',castSeconds:'詠唱秒數',initialCooldownSeconds:'開場冷卻秒數',timing:'時間設定',
 cost:'價格',sellPrice:'賣出價格',buyCost:'購買價格',shopPrice:'商店價格',shopEnabled:'商店販售',shopAvailable:'商店可購買',requiredVip:'需求 VIP 等級',healAmount:'治療量',healFraction:'治療生命比例',healThreshold:'治療門檻',boostType:'增益類型',bonusPercent:'加成百分點',statEffects:'能力效果',stackable:'可堆疊',quantity:'數量',
 mapIndex:'所在地圖編號',mapId:'地圖編號',material:'掉落素材',maxDrops:'最多掉落數',combatStats:'戰鬥能力',baseStats:'基礎能力',initialStats:'初始能力',spawnWeight:'出現權重',
 unlockCondition:'解鎖條件',unlockConditions:'解鎖條件',unlock:'解鎖',initial:'初始擁有',duplicateTicketGold:'重複取得換算金幣',partnerId:'夥伴編號',companionId:'夥伴編號',
 statusId:'狀態編號',dispellable:'可驅散',stackLimits:'疊加上限',target:'目標',targets:'目標',trigger:'觸發條件',triggers:'觸發條件',chance:'機率',
 reward:'獎勵',rewards:'獎勵',rewardGold:'獎勵金幣',objectives:'目標條件',prerequisites:'前置條件',nextQuests:'後續任務',repeatable:'可重複',dialogue:'對話',speaker:'說話者',scene:'場景',scenes:'場景',npc:'NPC',
 slot:'裝備欄位',slots:'欄位',quality:'品質',rarity:'稀有度',tier:'階級',level:'等級',levels:'等級',min:'最小值',max:'最大值',minLevel:'最低等級',maxLevel:'最高等級',weight:'權重',weights:'權重',multiplier:'倍率',multipliers:'倍率',
 normal:'普通',fine:'精良',rare:'稀有',legendary:'傳說',elite:'菁英',boss:'首領',finalBoss:'最終首領',awakened:'覺醒',
 physical:'無屬性',fire:'火',ice:'冰',wind:'風',light:'光',shadow:'暗',beast:'野獸',plant:'植物',undead:'不死',construct:'構裝',demon:'惡魔',spirit:'精靈',
 neutral:'無剋制',same:'同屬性',strong:'剋制',weak:'被剋制',
 gameTitle:'遊戲標題',gameSubtitle:'遊戲副標題',browserTitle:'瀏覽器分頁標題',chapterTitle:'章節標題',chapterSubtitle:'章節副標題',homeEyebrow:'首頁小標',homeTitle:'首頁標題',homeDescription:'首頁說明',homeFooter:'首頁頁尾',
 SSS:'SSS 級',requiredVip:'需求 VIP 等級',A:'A 級',B:'B 級',C:'C 級',D:'D 級',S:'S 級',SS:'SS 級',SSS:'SSS 級',x:'X 座標',y:'Y 座標'
};
const WORD_ZH={
 ability:'能力',accessory:'飾品',acquisition:'取得',action:'行動',actions:'行動',active:'主動',activation:'施放',adapter:'轉接',affix:'詞條',affixes:'詞條',after:'之後',ahead:'超前',all:'全部',allow:'允許',amount:'量',appearance:'外觀',archer:'弓手',armor:'護甲',atk:'攻擊',attack:'攻擊',attacks:'攻擊次數',auto:'自動',availability:'可用性',average:'平均',awakened:'覺醒',
 bag:'背包',balance:'平衡',band:'區間',bands:'區間',base:'基礎',basic:'普通攻擊',before:'之前',bindings:'綁定',board:'看板',bonus:'加成',boost:'增益',boss:'首領',branches:'分支',budget:'預算',buy:'購買',
 can:'可',cap:'上限',caps:'上限',capacities:'容量',capacity:'容量',cast:'詠唱',catalog:'目錄',chain:'連鎖',chance:'機率',chapter:'章節',charge:'充能',charges:'充能',choice:'選項',choices:'選項',claims:'領取',class:'職業',clock:'計時',coefficient:'係數',combat:'戰鬥',common:'通用',companion:'夥伴',companions:'夥伴',completion:'完成',completions:'完成次數',condition:'條件',conditional:'條件',conditions:'條件',consumable:'消耗品',consume:'消耗',continuous:'連續',control:'控制',cooldown:'冷卻',cost:'花費',count:'數量',counts:'數量',craft:'製作',crafting:'製作',crit:'暴擊',curve:'曲線',
 daily:'每日',damage:'傷害',death:'死亡',def:'防禦',default:'預設',defeat:'戰敗',defense:'防禦',definitions:'定義',delay:'延遲',design:'設計',difficulty:'難度',diminishing:'遞減',drop:'掉落',drops:'掉落',duplicate:'重複',duration:'持續時間',dust:'星塵',
 economy:'經濟',effect:'效果',effects:'效果',effectiveness:'效力',element:'屬性',elite:'菁英',enabled:'啟用',encounter:'遭遇',enemies:'敵人',enemy:'敵人',enhance:'強化',enhancement:'強化',enrage:'狂暴',entries:'項目',entry:'項目',equipment:'裝備',ether:'以太',event:'事件',events:'事件',every:'每',exclusive:'專屬',expanded:'擴展',extended:'擴展',extra:'額外',
 factor:'係數',failure:'失敗',fairy:'精靈',family:'家族',festival:'節慶',festivals:'節慶',final:'最終',fine:'精良',first:'首次',fixed:'固定',flat:'固定值',form:'類型',forms:'類型',fraction:'比例',fracture:'碎裂',free:'免費',
 gap:'差距',gate:'門檻',gear:'裝備',gem:'寶石',gems:'寶石',glow:'光暈',gold:'金幣',group:'群組',growth:'成長',guard:'防護',guide:'指引',guides:'指引',
 hard:'困難',heal:'治療',hell:'地獄',high:'高',hour:'小時',hp:'生命',hybrid:'混合',
 icon:'圖示',icons:'圖示',ids:'編號',id:'編號',ignore:'無視',implemented:'已實作',independent:'獨立',index:'索引',indices:'索引',initial:'初始',initially:'初始',input:'投入',inputs:'投入',internalized:'內建',interrupt:'中斷',interval:'間隔',inventory:'背包',item:'道具',items:'道具',
 job:'職業',kill:'擊殺',kills:'擊殺數',kind:'種類',kinds:'種類',
 lake:'湖',layers:'圖層',legacy:'舊版',legendary:'傳說',level:'等級',levels:'等級',lifesteal:'吸血',limit:'上限',linear:'一次項',loot:'戰利品',loss:'損失',low:'低',
 mana:'魔力',map:'地圖',maps:'地圖',market:'市場',mastery:'精通',material:'素材',materials:'素材',max:'最大',meter:'計量',mid:'中',migration:'遷移',min:'最小',minimum:'最低',minutes:'分鐘',mode:'模式',modes:'模式',modifiers:'修正',modules:'模組',monster:'怪物',monsters:'怪物',mp:'魔力',ms:'毫秒',multiplier:'倍率',multipliers:'倍率',
 next:'下一個',normal:'普通',notify:'通知',offer:'商品',offers:'商品',offhand:'副手',only:'僅限',optional:'選填',options:'選項',ore:'礦石',owner:'持有者',
 pacing:'節奏',page:'頁面',pages:'頁面',parallel:'並行',partner:'夥伴',passive:'被動',pct:'%',per:'每',percent:'百分點',periodic:'週期',permanent:'永久',plans:'方案',point:'點',pool:'池',pools:'池',post:'之後',potion:'藥水',potions:'藥水',power:'威力',price:'價格',prices:'價格',proc:'觸發',progress:'進度',progression:'成長進度',prologue:'序章',
 quadratic:'二次項',quality:'品質',quantity:'數量',quest:'任務',quests:'任務',race:'種族',radiant:'光輝',random:'隨機',range:'範圍',ranges:'範圍',rank:'階',rare:'稀有',rate:'率',ratio:'比例',reduction:'減少',reference:'參考',refresh:'刷新',regen:'回復',region:'區域',repeat:'重複',replay:'重玩',required:'需求',requirement:'需求',requires:'需要',reroll:'洗鍊',reset:'重置',resist:'抗性',resistance:'抗性',reward:'獎勵',rewards:'獎勵',roll:'抽取',rule:'規則',rules:'規則',
 salvage:'分解',sale:'販售',same:'同',scale:'比例',scales:'隨…調整',seconds:'秒數',sell:'賣出',settings:'設定',shield:'護盾',shop:'商店',size:'大小',skill:'技能',skills:'技能',skip:'跳過',slot:'欄位',slots:'欄位',socket:'孔',source:'來源',sources:'來源',special:'特殊',speed:'速度',stage:'關卡',stages:'關卡',start:'起始',starter:'新手',stat:'能力',stats:'能力',status:'狀態',step:'級距',steps:'步驟',story:'劇情',strength:'強度',stroke:'描邊',success:'成功',supply:'補給',support:'輔助',system:'系統',
 target:'目標',targets:'目標',task:'委託',team:'隊伍',template:'模板',threshold:'門檻',tick:'跳動',ticket:'券',tier:'階級',timed:'限時',token:'信物',tokens:'信物',tonic:'增幅劑',total:'總',training:'訓練',trap:'陷阱',trigger:'觸發',triggers:'觸發',turn:'回合',turns:'回合',tutorial:'教學',type:'類型',types:'類型',
 unit:'單位',unlock:'解鎖',upgrade:'升級',usage:'使用',use:'使用',uses:'使用次數',value:'數值',values:'數值',version:'版本',victory:'勝利',vouchers:'兌換券',ward:'結界',weaken:'削弱',weapon:'武器',wearable:'可穿戴',weight:'權重',weights:'權重',width:'寬度',wishing:'許願',xp:'經驗',zero:'零',by:'依',on:'於',if:'若',of:'的',with:'隨',from:'從',to:'到',in:'於',

 model:'模型',floor:'下限',adapters:'轉接設定',advance:'推進',order:'順序',timing:'時機',formula:'公式',display:'顯示',initialized:'已初始化',above:'以上',iron:'鐵',future:'未來',key:'鍵值',color:'顏色',name:'名稱',fractions:'比例',overhaul:'改版',compression:'壓縮',numeric:'數值',meta:'系統資訊',navigation:'選單',text:'文字',npc:'NPC',opacity:'不透明度',placement:'位置',plus:'加值',polarity:'極性',ratings:'評級',recommended:'建議',recovery:'回復',periods:'週期',remove:'移除',replayable:'可重玩',reprompt:'再次提示',resource:'資源',rotation:'輪替',round:'回合',sample:'取樣',selection:'選擇',side:'支線',assignments:'分配',share:'占比',skippable:'可跳過',slow:'緩速',starter:'新手',packs:'包',starting:'起始',state:'狀態',fields:'欄位',include:'包含',self:'自身',build:'編成',styles:'樣式',style:'樣式',time:'時間',units:'單位',timezone:'時區',tutorials:'教學',ui:'介面',scope:'範圍',jobs:'職業',templates:'模板',second:'秒',
 '1':'1','2':'2','3':'3'
};
const UNIT_HINT=[[/Chance$|^chance$/,'機率，0~1 小數，0.03 = 3%'],[/Seconds$/,'戰鬥秒數'],[/Minutes$/,'現實分鐘'],[/Ms$/,'毫秒'],[/(Percent|Pct)$/,'百分點，5 = 5%'],[/Multiplier$|^multiplier$/,'倍率，1.3 = 130%'],[/^power$/,'技能倍率，2.8 = 280% 攻擊'],[/Weight$|^weight$/,'相對權重，數字越大越常出現']];
function zhKey(k){
 if(typeof k==='number')return '第 '+(k+1)+' 筆';
 if(KEY_ZH[k])return KEY_ZH[k];
 const words=String(k).replace(/([a-z0-9])([A-Z])/g,'$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g,'$1 $2').split(/[\s_\-]+/).filter(Boolean);
 const out=words.map(w=>WORD_ZH[w.toLowerCase()]??null);
 if(!out.length||out.some(x=>x==null))return out.some(x=>x!=null)?words.map((w,i)=>out[i]??w).join(''):null;
 return out.join('');
}
function unitHint(k){if(typeof k!=='string')return '';for(const [re,h] of UNIT_HINT)if(re.test(k))return h;return '';}
// 依 _reference 解釋列舉值（屬性、種族、施放方式、效果、品質）
function valueHint(k,v){
 const R=base?._reference||{};if(typeof v!=='string')return '';
 const tables={element:R.elements,race:R.races,activation:R.activations,effect:R.effects,quality:R.qualities,type:R.itemTypes};
 const t=tables[k];if(t&&t[v])return t[v];
 if(k==='stat'&&{atk:1,attackSpeedPct:1,crit:1,hp:1,def:1}[v])return {atk:'攻擊',attackSpeedPct:'攻擊速度',crit:'暴擊率',hp:'生命',def:'防禦'}[v]+'（寶石可用：atk、attackSpeedPct、crit、hp、def）';
 if(k==='unit'&&{flat:1,percent:1,ratio:1}[v])return {flat:'固定值',percent:'百分比（1＝1%，攻擊速度用）',ratio:'比例（0.01＝1%）'}[v];
 for(const t2 of [R.elements,R.races,R.activations,R.effects,R.qualities])if(t2&&typeof t2[v]==='string'&&(k===undefined))return t2[v];
 if(R.equipmentExclusive?.[v])return R.equipmentExclusive[v];
 return '';
}
function pathHint(path){
 const R=base?._reference||{};const plain=path.filter(x=>typeof x!=='number').join('.');
 return R.balancePaths?.[plain]||(R.legacySettings?.[path.map(x=>typeof x==='number'?'[]':x).join('.').replace(/\.\[\]/g,'[]')]?.note)||'';
}


// ---------- 系統歸屬 ----------
function catOf(path){return CATEGORIES.filter(c=>c.id!=='root'&&startsWith(path,c.path)).sort((a,b)=>b.path.length-a.path.length)[0]||null;}
function startsWith(p,pre){return pre.length<=p.length&&pre.every((k,i)=>p[i]===k);}
const SKIP_ROOT=new Set(['_reference','notes']);

// ---------- 套用與草稿 ----------
function signature(doc){const s=JSON.stringify(doc);let h=0;for(let i=0;i<s.length;i+=7)h=(h*31+s.charCodeAt(i))|0;return s.length+':'+h;}
function saveDraft(){store.set(DRAFT_KEY,JSON.stringify({base:signature(base),draft}));}
let indexCache=null;
function commit(mutator,{label}={}){
 history.push(JSON.stringify(draft));if(history.length>80)history.shift();future=[];
 mutator();saveDraft();indexCache=null;
 if(ui.auto)scheduleApply();else setStatus(true,'已修改（尚未套用）'+(label?'：'+label:''));
 refreshBadge();
}
function scheduleApply(){clearTimeout(applyTimer);applyTimer=setTimeout(()=>{applyDraft();if(errorPaths.length||lastStatus.ok)renderPanel.keepScroll=true,renderPanel();},900);}
let errorPaths=[];
// 從遊戲錯誤訊息找出欄位路徑（例如 items[3].cost、balanceSettings.monsters.catalog.2.hp）
function extractPaths(msg){
 const out=[];const re=/[A-Za-z_][\w]*(?:(?:\[\d+\]|\.[\w]+))+/g;let m;
 while((m=re.exec(String(msg)))){
  const p=[];m[0].replace(/\[(\d+)\]|\.?([A-Za-z_]\w*|\d+)/g,(all,idx,key)=>{if(idx!=null)p.push(Number(idx));else if(/^\d+$/.test(key))p.push(Number(key));else p.push(key);return '';});
  // 取最長仍存在的前綴
  for(let n=p.length;n>0;n--){if(getAt(draft,p.slice(0,n))!==undefined){out.push(p.slice(0,n));break;}}
 }
 const seen=new Set();return out.filter(p=>{const k=JSON.stringify(p);if(seen.has(k))return false;seen.add(k);return true;});
}
function applyDraft(){
 clearTimeout(applyTimer);
 try{
  const doc=clone(draft);
  validateBalanceConfig(clone(doc));
  applyBalanceConfig(doc,{persist:false});
  globalThis.__EMBERWILD_BALANCE_SOURCE=clone(draft);
  try{if(typeof render==='function'&&globalThis.state)render();}catch(e){console.warn('[即時平衡器] 重繪失敗',e);}
  errorPaths=[];
  setStatus(true,'已套用到遊戲 · '+new Date().toLocaleTimeString());
  return true;
 }catch(e){
  console.warn('[即時平衡器] 套用失敗',e);
  errorPaths=extractPaths(e?.message||e);
  setStatus(false,'套用失敗：'+(e?.message||e));
  return false;
 }
}
function setStatus(ok,msg){lastStatus={ok,msg};const el=root?.querySelector('[data-status]');if(el){el.innerHTML=statusHTML();el.className='status '+(ok?'ok':'bad');}}
function statusHTML(){return esc(lastStatus.msg)+(lastStatus.ok?'':errorPaths.slice(0,5).map(p=>` <a class="link" data-open="${esc(JSON.stringify(p.length>1&&typeof getAt(draft,p)!=='object'?p.slice(0,-1):p))}" data-goto-data data-err="${esc(JSON.stringify(p))}">→ ${esc(pathText(p))}</a>`).join(''));}
function undo(){if(!history.length)return;future.push(JSON.stringify(draft));draft=JSON.parse(history.pop());saveDraft();indexCache=null;applyDraft();renderPanel();}
function redo(){if(!future.length)return;history.push(JSON.stringify(draft));draft=JSON.parse(future.pop());saveDraft();indexCache=null;applyDraft();renderPanel();}

function countDiff(a,b,limit=5000){
 let n=0;const walk=(x,y)=>{if(n>limit)return;
  if(x===y)return;
  if(typeof x!=='object'||typeof y!=='object'||x===null||y===null||Array.isArray(x)!==Array.isArray(y)){n++;return;}
  const keys=new Set([...Object.keys(x),...Object.keys(y)]);for(const k of keys)walk(x[k],y[k]);};
 walk(a,b);return n;
}
function diffList(a,b,limit=300){
 const out=[];const walk=(x,y,p)=>{if(out.length>=limit)return;
  if(x===y)return;
  if(typeof x!=='object'||typeof y!=='object'||x===null||y===null||Array.isArray(x)!==Array.isArray(y)){out.push({path:p,from:x,to:y});return;}
  // 陣列長度改變時整個陣列視為一處變更，避免位移造成大量假差異
  if(Array.isArray(x)&&x.length!==y.length){out.push({path:p,from:x,to:y});return;}
  const keys=new Set([...Object.keys(x),...Object.keys(y)]);for(const k of keys)walk(x[k],y[k],p.concat(Array.isArray(y)?Number(k):k));};
 walk(a,b,[]);return out;
}
function short(v){if(v===undefined)return '（無）';const s=JSON.stringify(v);return s.length>120?s.slice(0,120)+'…':s;}

// ---------- 索引：識別碼、欄位值、引用 ----------
// 依欄位名稱推斷引用的資料種類
const REF_KINDS=[
 {re:/^(skillId|skill|skills|fixedSkill|affixSkill|core|active|proc|support)$|SkillId$/,coll:['skillSystem','definitions'],name:'技能'},
 {re:/^(itemId|item|questItem|consumable)$|ItemId$/,coll:['items'],name:'道具'},
 {re:/^(companionId|partnerId|companion)$|CompanionId$/,coll:['companions'],name:'夥伴'},
 {re:/^(monsterId|monster|sources|enemies)$|MonsterId$/,coll:['balanceSettings','monsters','catalog'],name:'怪物'},
 {re:/^(statusId|status)$|StatusId$/,coll:['statusDefinitions'],name:'狀態'},
 {re:/^(formId|form)$|FormId$/,coll:['equipmentForms'],name:'裝備類型'},
 {re:/^(mapId|unlockMapIds|minMapId)$/,coll:['balanceSettings','maps','catalog'],name:'地圖'},
 {re:/^(passives)$|PassiveId$/,coll:['passiveDefinitions'],name:'被動'},
 {re:/^(questIds|nextQuests|prerequisites|quests)$|QuestId$/,coll:['story','quests'],name:'劇情任務'}
];
const FREE_TEXT=/^(name|title|label|text|description|hint|dialogue|notifyText|displayName|homeDescription|homeFooter|homeTitle|gameTitle|gameSubtitle|chapterTitle|chapterSubtitle|browserTitle|homeEyebrow|speaker|scene|completion)$/;
function buildIndex(){
 if(indexCache)return indexCache;
 const ids=new Map(),values=new Map(),leaves=[];
 const walk=(v,p)=>{
  if(v&&typeof v==='object'){
   if(!Array.isArray(v)&&(typeof v.id==='string'||typeof v.id==='number')){const nm=v.name||v.title||v.label||'';const key=String(v.id);if(!ids.has(key))ids.set(key,[]);ids.get(key).push({path:p,name:nm});}
   for(const k of Object.keys(v)){if(!p.length&&SKIP_ROOT.has(k))continue;walk(v[k],p.concat(Array.isArray(v)?Number(k):k));}
   return;
  }
  leaves.push({path:p,value:v});
  const k=[...p].reverse().find(x=>typeof x==='string');
  if(typeof v==='string'&&k&&!FREE_TEXT.test(k)&&v.length<60){if(!values.has(k))values.set(k,new Set());const s=values.get(k);if(s.size<80)s.add(v);}
 };
 walk(draft,[]);
 indexCache={ids,values,leaves};return indexCache;
}
function refKind(k){return REF_KINDS.find(r=>r.re.test(String(k)))||null;}
function idsOf(coll){const arr=getAt(draft,coll);return Array.isArray(arr)?arr.filter(x=>x&&x.id!=null).map(x=>({id:x.id,name:x.name||x.title||''})):[];}
// 找出所有引用某識別碼的欄位（排除定義本身）
function findRefs(value,selfPath){
 if(value==null||value==='')return [];
 const {leaves}=buildIndex();const out=[];
 const isStr=typeof value==='string';
 for(const l of leaves){
  // 也比對「種類:識別碼」形式的組合引用（例如 item:imbue_fire）
  const composite=isStr&&typeof l.value==='string'&&/^[a-zA-Z]{2,20}:/.test(l.value)&&l.value.slice(l.value.indexOf(':')+1)===value;
  if(l.value!==value&&!composite)continue;
  if(selfPath&&startsWith(l.path,selfPath))continue;
  const k=[...l.path].reverse().find(x=>typeof x==='string');
  if(FREE_TEXT.test(k||''))continue;
  // 數字識別碼只認明確的引用欄位，避免把一般數值當成引用
  if(!isStr&&!(refKind(k)||/Id$|Ids$|Index$|^job$|^jobs$/.test(k||'')))continue;
  if(isStr&&value.length<3)continue;
  out.push(l.path);
 }
 // 遊戲自己的引用規則（地圖索引、職業索引等位置型引用）
 const M=globalThis.EmberwildBalanceModules;
 if(M?.referenceIndex&&selfPath){
  const c=catOf(selfPath);const kind={monsters:'monster',items:'item',skills:'skill',companions:'companion',classes:'class',maps:'map'}[c?.id];
  if(kind){try{const idx=M.referenceIndex(draft);const key=kind==='map'||kind==='class'?selfPath[c.path.length]:value;
   for(const r of idx.referencesTo(kind,key)){const p=M.toPath?M.toPath(r.path):String(r.path).split('.').map(x=>/^\d+$/.test(x)?Number(x):x);if(!out.some(o=>JSON.stringify(o)===JSON.stringify(p)))out.push(p);}}catch(e){console.warn(e);}}
 }
 return out;
}

// ---------- 數值檢查 ----------
function rangeWarn(k,v){
 if(typeof v!=='number'||!Number.isFinite(v))return typeof v==='number'?'不是有效數字':'';
 const key=String(k);
 if(/Chance$|^chance$|Rate$/.test(key)&&(v<0||v>1))return '機率應在 0~1 之間（0.03 = 3%）';
 if(/(cost|Cost|price|Price|Gold|gold|weight|Weight|quantity|Quantity|count|Count|^hp$|^atk$|^def$|Hp$|max|Max|min|Min|limit|Limit)$/.test(key)&&v<0)return '不應為負數';
 if(/Seconds$/.test(key)&&v<0)return '秒數不應為負數';
 if(/^(cooldownSeconds|castSeconds|durationSeconds)$/.test(key)&&v===0&&key!=='castSeconds')return '0 秒可能造成無限觸發或立即結束，請確認';
 if(/(Percent|Pct)$/.test(key)&&Math.abs(v)>1000)return '百分點數值異常大';
 if(/Multiplier$|^multiplier$/.test(key)&&v<0)return '倍率不應為負數';
 return '';
}

// ---------- 匯出／匯入 ----------
function stamp(){const d=new Date();return d.getFullYear()+String(d.getMonth()+1).padStart(2,'0')+String(d.getDate()).padStart(2,'0')+'-'+String(d.getHours()).padStart(2,'0')+String(d.getMinutes()).padStart(2,'0');}
function download(name,data,type){const a=document.createElement('a');a.href=URL.createObjectURL(data instanceof Blob?data:new Blob([data],{type}));a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},1500);}
// 只套用勾選的變更到發布版本上（未排除任何項目時即為完整草稿）
function selectedDoc(){
 if(!ui.exclude||!ui.exclude.length)return clone(draft);
 const doc=clone(base);const ex=new Set(ui.exclude);
 for(const d of diffList(base,draft,1e9)){if(ex.has(entityKey(d.path)))continue;
  if(d.to===undefined){const par=getAt(doc,d.path.slice(0,-1));if(par&&!Array.isArray(par))delete par[d.path[d.path.length-1]];}
  else{ensureParents(doc,d.path);setAt(doc,d.path,clone(d.to));}}
 return doc;
}
function ensureParents(doc,p){let cur=doc;for(let i=0;i<p.length-1;i++){if(cur[p[i]]==null||typeof cur[p[i]]!=='object')cur[p[i]]=typeof p[i+1]==='number'?[]:{};cur=cur[p[i]];}}
function exportDocument(){
 const sel=selectedDoc();let out;
 try{
  validateBalanceConfig(clone(sel));
  if(!ui.exclude?.length&&applyDraft())out=exportableBalance();else out=clone(sel);
 }catch(e){
  if(!confirm('要匯出的內容未通過遊戲驗證：\n'+(e?.message||e)+'\n\n仍要匯出原樣嗎？'))return null;
  out=clone(sel);
 }
 if(sel.textOverrides?.entries?.length)out.textOverrides=clone(sel.textOverrides);else delete out.textOverrides;
 // 共用文件檢查（與遊戲啟動時相同）
 const D=globalThis.EmberwildBalanceDocument;
 if(D?.inspect){let issues=[];try{issues=D.inspect(clone(out))||[];}catch(e){issues=[{field:'inspect',reason:e.message}];}
  if(issues.length&&!confirm('完整檢查發現 '+issues.length+' 個問題：\n'+issues.slice(0,8).map(x=>'・'+x.field+'：'+x.reason).join('\n')+'\n\n遊戲啟動時會拒絕這份資料。仍要匯出嗎？'))return null;}
 return out;
}
function exportJSON(){
 const out=exportDocument();if(!out)return;
 const text=JSON.stringify(out,null,2)+'\n';
 download('dreaming-abyss-balance-'+stamp()+'.json',text,'application/json');
 setStatus(true,'已匯出完整 JSON（'+Math.round(text.length/1024)+' KB，'+countDiff(base,selectedDoc())+' 處變更）');
}
function importJSON(file){
 const r=new FileReader();r.onload=()=>{
  try{const doc=JSON.parse(r.result);if(doc.schema!=='emberwild-balance-v1')throw Error('schema 不是 emberwild-balance-v1');
   validateBalanceConfig(clone(doc));commit(()=>{draft=doc;});applyDraft();renderPanel();}
  catch(e){setStatus(false,'匯入失敗：'+e.message);}
 };r.readAsText(file);
}
function resetAll(){
 if(!confirm('捨棄所有修改，回到遊戲發布版本？'))return;
 commit(()=>{draft=clone(base);});ui.exclude=[];applyDraft();renderPanel();
}

// ---------- 模組檔輸出（data/balance/<模組>.json + manifest + 整合檔） ----------
// 以遊戲原始發布檔為底，只套用本次變更，避免把遊戲執行期的正規化差異寫進模組
function publishedPatched(){
 const pub=clone(globalThis.__EMBERWILD_PUBLISHED_BALANCE||base);const sel=selectedDoc();
 for(const d of diffList(base,sel,1e9)){
  if(d.to===undefined){const par=getAt(pub,d.path.slice(0,-1));if(par&&!Array.isArray(par))delete par[d.path[d.path.length-1]];else if(Array.isArray(par))par.splice(d.path[d.path.length-1],1);}
  else{ensureParents(pub,d.path);setAt(pub,d.path,clone(d.to));}
 }
 return pub;
}
async function sha256Hex(text){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');}
async function buildModuleFiles(){
 const M=globalThis.EmberwildBalanceModules;if(!M)throw Error('遊戲沒有平衡模組程式（EmberwildBalanceModules）');
 const doc=publishedPatched();
 validateBalanceConfig(clone(doc));
 const D=globalThis.EmberwildBalanceDocument;const issues=D?.inspect?D.inspect(clone(doc))||[]:[];
 if(issues.length)throw Error('完整檢查未通過：'+issues.slice(0,5).map(x=>x.field+'：'+x.reason).join('；'));
 const {layout,modules}=M.split(doc);const files={},hashes={};
 for(const m of M.MODULES){const v=modules[m.id];if(v===undefined)continue;const text=M.serialize(v);files[M.SOURCE_DIR+'/'+m.file]=text;hashes[m.id]={sha256:await sha256Hex(text),bytes:new TextEncoder().encode(text).length};}
 const integrated=M.serialize(M.assemble(modules,layout));
 if(integrated!==M.serialize(doc))throw Error('模組重新整合後與文件不一致，已停止');
 files[M.INTEGRATED_FILE]=integrated;
 let previous=null;try{const r=await fetch(M.MANIFEST_FILE+'?at='+Date.now(),{cache:'no-store'});if(r.ok)previous=await r.json();}catch{}
 const manifest=M.createManifest({layout,hashes,integrated:{sha256:await sha256Hex(integrated),bytes:new TextEncoder().encode(integrated).length},previous});
 files[M.MANIFEST_FILE]=M.serialize(manifest);
 // 只保留內容有變的檔案
 const changed={};
 for(const [f,text] of Object.entries(files)){let old=null;try{const r=await fetch(f+'?at='+Date.now(),{cache:'no-store'});if(r.ok)old=await r.text();}catch{}if(old!==text)changed[f]=text;}
 return {files,changed,manifest};
}
// 不壓縮的 ZIP（store），不需外部程式庫
const CRC_TABLE=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0;}return t;})();
function crc32(bytes){let c=0xFFFFFFFF;for(let i=0;i<bytes.length;i++)c=CRC_TABLE[(c^bytes[i])&255]^(c>>>8);return (c^0xFFFFFFFF)>>>0;}
function makeZip(files){
 const enc=new TextEncoder(),parts=[],central=[];let offset=0;
 for(const [name,text] of Object.entries(files)){
  const nb=enc.encode(name),data=enc.encode(text),crc=crc32(data);
  const lh=new DataView(new ArrayBuffer(30));lh.setUint32(0,0x04034b50,true);lh.setUint16(4,20,true);lh.setUint16(6,0x0800,true);lh.setUint16(8,0,true);lh.setUint32(14,crc,true);lh.setUint32(18,data.length,true);lh.setUint32(22,data.length,true);lh.setUint16(26,nb.length,true);
  parts.push(lh.buffer,nb,data);
  const ch=new DataView(new ArrayBuffer(46));ch.setUint32(0,0x02014b50,true);ch.setUint16(4,20,true);ch.setUint16(6,20,true);ch.setUint16(8,0x0800,true);ch.setUint32(16,crc,true);ch.setUint32(20,data.length,true);ch.setUint32(24,data.length,true);ch.setUint16(28,nb.length,true);ch.setUint32(42,offset,true);
  central.push(ch.buffer,nb);offset+=30+nb.length+data.length;
 }
 const csize=central.reduce((s,b)=>s+(b.byteLength??b.length),0);
 const end=new DataView(new ArrayBuffer(22));end.setUint32(0,0x06054b50,true);end.setUint16(8,Object.keys(files).length,true);end.setUint16(10,Object.keys(files).length,true);end.setUint32(12,csize,true);end.setUint32(16,offset,true);
 return new Blob([...parts,...central,end.buffer],{type:'application/zip'});
}
async function exportModules(onlyChanged){
 setStatus(true,'正在產生模組檔…');
 try{const {files,changed}=await buildModuleFiles();const pick=onlyChanged?changed:files;
  if(!Object.keys(pick).length){setStatus(true,'與遊戲目前的模組檔完全相同，沒有需要輸出的檔案');return;}
  download('dreaming-abyss-balance-modules-'+stamp()+'.zip',makeZip(pick));
  setStatus(true,'已輸出 '+Object.keys(pick).length+' 個檔案；解壓到遊戲 repository 根目錄即可覆蓋');}
 catch(e){setStatus(false,'模組輸出失敗：'+e.message);}
}
// 由本機伺服器寫入遊戲 repository 並建立分支提交
let serverInfo=null;
async function probeServer(){if(globalThis.__DA_BUNDLED__){serverInfo=null;return;}try{const r=await fetch('/__live-editor/status',{cache:'no-store'});serverInfo=r.ok?await r.json():null;}catch{serverInfo=null;}}
async function publishToGame(){
 if(!serverInfo?.git){setStatus(false,'本機伺服器沒有遊戲 git repository，無法直接提交');return;}
 const branch=root.querySelector('[data-pub-branch]')?.value.trim(),message=root.querySelector('[data-pub-msg]')?.value.trim(),push=root.querySelector('[data-pub-push]')?.checked;
 if(!branch){setStatus(false,'請輸入分支名稱');return;}
 setStatus(true,'正在寫入遊戲並提交…');
 try{const {changed}=await buildModuleFiles();if(!Object.keys(changed).length){setStatus(true,'沒有變更需要提交');return;}
  const r=await fetch('/__live-editor/publish',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({branch,message:message||'平衡調整（即時平衡器）',push:!!push,files:changed})});
  const j=await r.json();if(!r.ok||!j.ok)throw Error(j.error||('HTTP '+r.status));
  setStatus(true,'已提交到遊戲分支 '+j.branch+'（'+j.commit.slice(0,7)+'）'+(j.pushed?'，已推送':'')+'。'+(j.note||''));await probeServer();renderPanel();}
 catch(e){setStatus(false,'提交失敗：'+e.message);}
}

// ---------- 變更分組與報告 ----------
function entityKey(path){const c=catOf(path);const n=c?c.path.length+1:Math.min(2,path.length);return JSON.stringify(path.slice(0,Math.min(n,path.length)));}
function entityName(key){const p=JSON.parse(key);const v=getAt(draft,p)??getAt(base,p);const c=catOf(p);return (c?c.name+' › ':'')+labelOf(v,p[p.length-1]);}
function changeReport(){
 const list=diffList(base,draft,1e9);const groups=new Map();
 for(const d of list){const k=entityKey(d.path);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(d);}
 let md='# 夢淵 平衡調整報告\n\n產生時間：'+new Date().toLocaleString()+'\n\n共 '+list.length+' 處變更，'+groups.size+' 筆資料。\n';
 for(const sys of SYSTEMS.concat(['其他'])){
  const rows=[...groups].filter(([k])=>(catOf(JSON.parse(k))?.sys||'其他')===sys);if(!rows.length)continue;
  md+='\n## '+sys+'\n';
  for(const [k,ds] of rows){md+='\n### '+entityName(k)+(ui.exclude?.includes(k)?'（未納入匯出）':'')+'\n\n| 欄位 | 原值 | 新值 |\n|---|---|---|\n';
   for(const d of ds)md+='| '+d.path.slice(JSON.parse(k).length).map(x=>zhKey(x)||x).join(' › ')+' `'+pathText(d.path)+'` | '+short(d.from).replace(/\|/g,'\\|')+' | '+short(d.to).replace(/\|/g,'\\|')+' |\n';}
 }
 return md;
}

// ---------- 文字覆寫 ----------
function overrides(){if(!draft.textOverrides||typeof draft.textOverrides!=='object')draft.textOverrides={version:1,entries:[]};if(!Array.isArray(draft.textOverrides.entries))draft.textOverrides.entries=[];return draft.textOverrides.entries;}
function templateOf(s){const T=globalThis.EmberwildTextOverrides;const t=String(s).replace(/\s+/g,' ').trim();return T?.templateOf?T.templateOf(t):t.replace(/\d+(?:\.\d+)?/g,'{#}');}
function setOverride(source,text){
 source=templateOf(source);if(!source)return;
 commit(()=>{const list=overrides();const i=list.findIndex(x=>x.source===source);
  if(text==null||text===''||text===source){if(i>=0)list.splice(i,1);}
  else if(i>=0)list[i].text=text;else list.push({source,text});
  if(!list.length)delete draft.textOverrides;},{label:'文字'});
}
function textAtPoint(x,y,target){
 let node=null;
 if(document.caretPositionFromPoint){const p=document.caretPositionFromPoint(x,y);node=p?.offsetNode;}
 else if(document.caretRangeFromPoint){const r=document.caretRangeFromPoint(x,y);node=r?.startContainer;}
 if(node&&node.nodeType===3&&node.nodeValue.trim()&&target.contains(node))return {node};
 const w=document.createTreeWalker(target,NodeFilter.SHOW_TEXT,{acceptNode:n=>n.nodeValue.trim()?1:3});
 const n=w.nextNode();if(n)return {node:n};
 for(const attr of ['placeholder','title','aria-label'])if(target.getAttribute?.(attr))return {node:target,attr};
 return null;
}
function originalText(hit){const T=globalThis.EmberwildTextOverrides;
 if(hit.attr)return T?.originalOf?T.originalOf(hit.node,hit.attr):hit.node.getAttribute(hit.attr);
 return T?.originalOf?T.originalOf(hit.node):hit.node.nodeValue;}
// 畫面文字若來自資料欄位，列出該欄位（優先改資料，而不是新增文字覆寫）
function textSources(text){
 const t=String(text).trim();if(t.length<2)return [];
 const out=[];for(const l of buildIndex().leaves){if(typeof l.value!=='string'||l.value.length<2)continue;
  if(l.value===t)out.push({path:l.path,exact:true});else if(t.length>=4&&l.value.includes(t))out.push({path:l.path,exact:false});
  if(out.length>40)break;}
 return out.sort((a,b)=>(b.exact-a.exact)).slice(0,12);
}

// ---------- 多筆同步編輯 ----------
// ui.group={name,all:[完整路徑…],paths:[已勾選],rel:[子路徑]}
function groupRel(p){const g=ui.group;if(!g)return null;for(const gp of g.paths)if(startsWith(p,gp))return p.slice(gp.length);return null;}
function groupTargets(p){
 const rel=groupRel(p);if(rel==null)return [p];
 return ui.group.paths.map(gp=>gp.concat(rel)).filter(tp=>{const par=getAt(draft,tp.slice(0,-1));return tp.length===0||(par!=null&&typeof par==='object');});
}
function writeAll(p,fn){for(const tp of groupTargets(p))fn(tp);}
function groupValues(p){const rel=groupRel(p);if(rel==null)return null;return ui.group.paths.map(gp=>getAt(draft,gp.concat(rel)));}
function sameAll(list){const f=JSON.stringify(list[0]);return list.every(x=>JSON.stringify(x)===f);}
const ID_KEY=/^(id|key|job|index)$|Id$|Index$|Key$/;

// ---------- 點選定位 ----------
function inspectElement(el){
 const texts=[];let cur=el;
 for(let i=0;i<6&&cur&&cur!==document.body;i++,cur=cur.parentElement){const t=(cur.innerText||cur.textContent||'').trim();if(t)texts.push(t.slice(0,4000));if(t.length>1500)break;}
 const near=texts[0]||'',wide=texts.join('\n');
 const found=[];
 const walk=(v,p,depth)=>{
  if(depth>9||!v||typeof v!=='object')return;
  if(!Array.isArray(v)){
   for(const key of ['name','title','label']){const s=v[key];
    if(typeof s==='string'&&s.trim().length>=2){
     const inNear=near.includes(s),inWide=!inNear&&wide.includes(s);
     if(inNear||inWide)found.push({path:p,name:s,score:(inNear?1000:0)+s.length*10-p.length,key});
    }}
  }
  for(const k of Object.keys(v)){if(!p.length&&SKIP_ROOT.has(k))continue;walk(v[k],p.concat(Array.isArray(v)?Number(k):k),depth+1);}
 };
 walk(draft,[],0);
 found.sort((a,b)=>b.score-a.score);
 const seen=new Set();inspectResults=found.filter(f=>{const k=pathText(f.path);if(seen.has(k))return false;seen.add(k);return true;}).slice(0,40);
 inspectResults.clickedText=near.slice(0,300);
}
function openGroup(name){
 const all=inspectResults.filter(r=>r.name===name).map(r=>r.path);
 // 預設只合併與第一筆同一遊戲系統的資料，其餘可手動勾選
 const sys=catOf(all[0])?.sys;
 ui.group={name,all,paths:all.filter(p=>catOf(p)?.sys===sys),rel:[]};
 ui.highlight=inspectResults.clickedText||'';
}

// ---------- 攔截畫面點擊 ----------
let hoverBox=null;
function onPointerMove(e){if(!pickMode||isOurs(e.target))return hideHover();const r=e.target.getBoundingClientRect();
 hoverBox=root?.querySelector('.hover');if(!hoverBox)return;
 Object.assign(hoverBox.style,{display:'block',left:r.left+'px',top:r.top+'px',width:r.width+'px',height:r.height+'px'});}
function hideHover(){if(hoverBox)hoverBox.style.display='none';}
function isOurs(t){return t===host||host?.contains(t);}
function onClickCapture(e){
 if(!pickMode||isOurs(e.target))return;
 e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
 if(e.type!=='click')return;
 if(pickMode==='text'){
  const hit=textAtPoint(e.clientX,e.clientY,e.target);
  if(!hit){setStatus(false,'這裡沒有可改的文字');return;}
  const orig=String(originalText(hit)??'').replace(/\s+/g,' ').trim();
  const source=templateOf(orig);const existing=overrides().find(x=>x.source===source);
  pendingText={source,original:orig,text:existing?existing.text:source,sources:textSources(orig)};
  ui.tab='text';
 }else if(pickMode==='inspect'){
  inspectElement(e.target);ui.tab='inspect';
 }
 pickMode=null;hideHover();ui.open=true;renderPanel();
}
for(const type of ['pointerdown','mousedown','pointerup','mouseup','click'])document.addEventListener(type,onClickCapture,true);
document.addEventListener('pointermove',onPointerMove,true);
// 快捷鍵
document.addEventListener('keydown',e=>{
 if(!draft)return;
 if(e.key==='Escape'&&pickMode){pickMode=null;hideHover();renderPanel();return;}
 const inField=/INPUT|TEXTAREA|SELECT/.test(e.composedPath()[0]?.tagName||'');
 const mod=e.ctrlKey||e.metaKey;
 if(mod&&e.key.toLowerCase()==='z'&&isOurs(e.target)&&!inField){e.preventDefault();e.shiftKey?redo():undo();return;}
 if(mod&&e.key.toLowerCase()==='s'){e.preventDefault();applyDraft();renderPanel();return;}
 if(mod&&e.shiftKey&&e.key.toLowerCase()==='e'){e.preventDefault();exportJSON();return;}
 if(e.altKey&&!mod&&e.code==='KeyF'){e.preventDefault();pickMode='inspect';renderPanel();return;}
 if(e.altKey&&!mod&&e.code==='KeyT'){e.preventDefault();pickMode='text';renderPanel();return;}
 if(e.altKey&&!mod&&e.code==='KeyB'){e.preventDefault();ui.open=!ui.open;renderPanel();}
},true);

// ---------- 面板 ----------
let host,root;
const CSS=`
:host{all:initial}
*{box-sizing:border-box;font-family:system-ui,"Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif}
.fab{position:fixed;right:16px;bottom:16px;border:0;border-radius:24px;padding:10px 16px;background:#2b2140;color:#f5d98a;font-size:14px;font-weight:700;box-shadow:0 4px 16px rgba(0,0,0,.45);cursor:pointer}
.fab b{background:#f5b942;color:#2b2140;border-radius:10px;padding:0 6px;margin-left:6px;font-size:12px}
.panel{position:fixed;right:12px;bottom:12px;top:12px;width:min(520px,calc(100vw - 24px));background:#1b1626;color:#ece6f5;border:1px solid #4a3d66;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,.6);display:flex;flex-direction:column;font-size:13px;overflow:hidden}
.panel.wide{width:min(980px,calc(100vw - 24px))}
.panel.left{right:auto;left:12px}
.head{display:flex;align-items:center;gap:6px;padding:8px 10px;background:#2b2140;border-bottom:1px solid #4a3d66;flex-wrap:wrap}
.head h1{font-size:14px;margin:0 auto 0 0;color:#f5d98a}
button{font:inherit;color:#ece6f5;background:#3a2e55;border:1px solid #5b4b80;border-radius:6px;padding:4px 9px;cursor:pointer}
button:hover{background:#4a3b6c}button.on{background:#f5b942;color:#2b2140;border-color:#f5b942}
button.primary{background:#6b4fd8;border-color:#8a70f0}button.danger{background:#6a2a3a;border-color:#a04058}
button.mini{padding:1px 6px;font-size:11px}
button:disabled{opacity:.4;cursor:default}
.tabs{display:flex;gap:2px;padding:6px 8px 0;background:#231c33;flex-wrap:wrap}
.tabs button{border-radius:6px 6px 0 0;border-bottom:0}
.body{flex:1;overflow:auto;padding:10px}
.foot{padding:6px 10px;border-top:1px solid #4a3d66;background:#231c33;display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.status{flex:1 1 100%;font-size:12px;min-height:16px;word-break:break-all}.status.ok{color:#8fe0a8}.status.bad{color:#ff8a9a}
.keys{flex:1 1 100%;font-size:11px;color:#7f739b}
input,textarea,select{font:inherit;color:#ece6f5;background:#120e1b;border:1px solid #4a3d66;border-radius:5px;padding:4px 6px;width:100%}
input[type=checkbox]{width:auto}
textarea{resize:vertical;min-height:54px;font-family:ui-monospace,Consolas,monospace;font-size:12px}
.row{display:flex;gap:6px;align-items:center;margin-bottom:6px}.row>*{flex:1}.row>.fit{flex:0 0 auto}
.systems{margin-bottom:8px;border:1px solid #3a2e55;border-radius:8px;overflow:hidden}.sysrow{display:grid;grid-template-columns:76px 1fr;gap:6px;align-items:start;padding:5px 6px;border-bottom:1px solid #2f2644}.sysrow:last-child{border-bottom:0}.sysrow.cur{background:#2a2140}.sysname{font-size:12px;color:#f5d98a;font-weight:700;padding-top:4px}
.cats{display:flex;flex-wrap:wrap;gap:4px}.cats button{padding:3px 7px;font-size:12px}
.chips{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:6px;align-items:center}.chips .t{font-size:11px;color:#a99cc4}
.chip{font-size:11px;padding:2px 7px;border-radius:10px;background:#241d34;border:1px solid #3a2e55;cursor:pointer;color:#c7b6ff}
.list{display:flex;flex-direction:column;gap:2px}
.item{display:flex;justify-content:space-between;gap:8px;padding:5px 8px;border-radius:5px;background:#241d34;cursor:pointer;text-align:left;border:1px solid transparent}
.item:hover{border-color:#6b4fd8}.item small{color:#a99cc4;white-space:nowrap}
.crumb{font-size:12px;color:#a99cc4;margin-bottom:8px;word-break:break-all}.link{color:#c7b6ff;cursor:pointer;text-decoration:underline}.crumb a{color:#c7b6ff;cursor:pointer;text-decoration:underline}
.sec{font-size:12px;font-weight:700;color:#f5d98a;margin:10px 0 2px;border-bottom:1px solid #4a3d66;padding-bottom:2px}
.field{display:grid;grid-template-columns:minmax(90px,38%) 1fr;gap:6px;align-items:start;padding:3px 0;border-bottom:1px dashed #2f2644}
.field>label{color:#c9bfe0;word-break:break-all;padding-top:3px;font-size:12px;display:flex;flex-direction:column;gap:1px}
.zh{color:#ece6f5;font-size:13px}.en{color:#7f739b;font-size:11px;font-family:ui-monospace,Consolas,monospace}
.note{color:#a99cc4;font-size:11px;line-height:1.4;margin-top:2px}.note.was{color:#f5b942}.note.warn{color:#ff8a9a}.note.ref{color:#8fd0e0}
.field.err{background:rgba(255,80,110,.12);outline:1px solid #a04058}.field.hl{background:rgba(245,185,66,.14);outline:1px solid #f5b942}
.ui{pointer-events:none}.fab,.panel,.picking{pointer-events:auto}
.hover{position:fixed;pointer-events:none;border:2px solid #f5b942;background:rgba(245,185,66,.12);border-radius:4px;display:none}
.field.changed>label{color:#f5b942}.field.changed>label .zh::after{content:" ●";color:#f5b942}
.nest{border-left:2px solid #3a2e55;padding-left:8px;margin:2px 0 4px}
details>summary{cursor:pointer;color:#c7b6ff;padding:3px 0;font-size:12px}
.hint{color:#a99cc4;font-size:12px;line-height:1.6;margin:4px 0 8px}
.card{background:#241d34;border:1px solid #3a2e55;border-radius:8px;padding:8px;margin-bottom:8px}
.card.warn{border-color:#a04058}
.diff{font-family:ui-monospace,Consolas,monospace;font-size:11px;word-break:break-all;padding:3px 0;border-bottom:1px solid #2f2644}
.diff del{color:#ff8a9a}.diff ins{color:#8fe0a8;text-decoration:none}
.picking{position:fixed;left:50%;top:10px;transform:translateX(-50%);background:#f5b942;color:#2b2140;padding:8px 14px;border-radius:20px;font-weight:700;box-shadow:0 4px 12px rgba(0,0,0,.4);display:flex;gap:8px;align-items:center}
.picking button{background:#2b2140;color:#f5d98a}
.tablewrap{overflow:auto;max-height:60vh;border:1px solid #3a2e55;border-radius:6px}
table{border-collapse:collapse;font-size:12px;min-width:100%}
th,td{border-bottom:1px solid #2f2644;padding:2px 4px;white-space:nowrap;text-align:left}
th{position:sticky;top:0;background:#2b2140;cursor:pointer;z-index:1}th .en{display:block}
td input{min-width:70px;padding:2px 4px}td.changed input{border-color:#f5b942}td.warn input{border-color:#ff8a9a}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:6px}
`;
// 遊戲彈窗使用 <dialog>.showModal()，彈窗以外的元素會無法點選。
// 平衡器以 popover 進入頂層，並在有模態彈窗時移入該彈窗內，保持在最上層且可操作。
function topModal(){const list=[...document.querySelectorAll('dialog[open]')].filter(d=>{try{return d.matches(':modal');}catch{return false;}});return list[list.length-1]||null;}
let placing=false;
function placeHost(){
 if(!host||placing)return;placing=true;
 try{
  const parent=topModal()||document.documentElement;
  const moved=host.parentNode!==parent;
  if(moved)parent.appendChild(host);
  if(host.showPopover){
   const open=(()=>{try{return host.matches(':popover-open');}catch{return false;}})();
   if(moved||!open||placeHost.force){try{if(open)host.hidePopover();}catch{}try{host.showPopover();}catch{}}
  }
 }finally{placing=false;placeHost.force=false;}
}
function mount(){
 host=document.createElement('div');host.id='da-live-editor';host.setAttribute('data-text-override','off');
 host.setAttribute('popover','manual');
 host.style.cssText='position:fixed;inset:0;width:100vw;height:100vh;max-width:none;max-height:none;margin:0;padding:0;border:0;background:transparent;overflow:visible;pointer-events:none;z-index:2147483647;color:inherit';
 root=host.attachShadow({mode:'open'});
 root.innerHTML=`<style>${CSS}</style><div class="hover"></div><div class="ui"></div>`;
 document.documentElement.appendChild(host);placeHost();
 new MutationObserver(()=>{if(placing)return;const want=topModal()||document.documentElement;if(!host.isConnected||host.parentNode!==want){placeHost();}}).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['open']});
 // 遊戲以 innerHTML 重寫彈窗內容時，先把平衡器移出，寫完再放回
 for(const prop of ['innerHTML','textContent']){
  const desc=Object.getOwnPropertyDescriptor(Element.prototype,prop)||Object.getOwnPropertyDescriptor(Node.prototype,prop);
  if(!desc?.set)continue;
  Object.defineProperty(HTMLDialogElement.prototype,prop,{configurable:true,enumerable:desc.enumerable,get(){return desc.get.call(this);},set(v){
   const inside=host&&host.parentNode===this;
   if(inside){placing=true;try{host.remove();}finally{placing=false;}}
   desc.set.call(this,v);
   if(inside){placeHost.force=true;placeHost();}
  }});
 }
 for(const m of ['showModal','show']){const orig=HTMLDialogElement.prototype[m];HTMLDialogElement.prototype[m]=function(...a){const r=orig.apply(this,a);placeHost.force=true;placeHost();return r;};}
 addEventListener('keydown',e=>{if(e.key==='Escape'&&isOurs(e.target)){e.stopPropagation();}},true);
 root.addEventListener('click',onPanelClick);root.addEventListener('change',onPanelChange);root.addEventListener('input',onPanelInput);
 probeServer().then(()=>{if(ui.tab==='export')renderPanel();});
 renderPanel();
}
function refreshBadge(){const b=root?.querySelector('[data-badge]');if(b)b.textContent=countDiff(base,draft);}

let rendering=false,renderAgain=false;
function renderPanel(){
 if(!root)return;
 if(rendering){renderAgain=true;return;}
 rendering=true;
 try{
  try{root.activeElement?.blur?.();}catch{}
  renderAgain=false;renderPanelNow();
 }finally{rendering=false;}
 if(renderAgain){renderAgain=false;renderPanel();}
}
function saveUI(){store.set(UI_KEY,JSON.stringify({open:ui.open,tab:ui.tab,cat:ui.cat,auto:ui.auto,left:ui.left,recent:ui.recent,pins:ui.pins,table:ui.table}));}
function renderPanelNow(){
 saveUI();
 const diff=countDiff(base,draft);
 let html='';const box=root.querySelector('.ui');
 if(pickMode)html+=`<div class="picking">${pickMode==='text'?'點選畫面上要修改的文字':'點選畫面上的道具、技能、夥伴、怪物等'}<button data-act="cancel-pick">取消（Esc）</button></div>`;
 if(!ui.open){box.innerHTML=html+`<button class="fab" data-act="open" title="Alt+B">平衡器<b data-badge>${diff}</b></button>`;return;}
 const tabs=[['data','資料'],['inspect','點選定位'],['text','文字'],['changes','變更 '+diff],['test','測試'],['icons','圖示'],['export','匯出']];
 const wide=ui.tab==='icons'||ui.tab==='data'&&ui.table&&!ui.path&&!ui.group;
 html+=`<section class="panel${ui.left?' left':''}${wide?' wide':''}">
 <div class="head"><h1>夢淵 即時平衡器</h1>
  <button data-act="pick-inspect" title="點畫面元素找出資料（Alt+F）">🎯 定位</button>
  <button data-act="pick-text" title="點畫面文字直接改字（Alt+T）">✎ 改字</button>
  <button data-act="side" title="切換左右">⇆</button>
  <button data-act="close" title="Alt+B">收起</button></div>
 <div class="tabs">${tabs.map(([id,n])=>`<button class="${ui.tab===id?'on':''}" data-tab="${id}">${n}</button>`).join('')}</div>
 <div class="body">${renderTab()}</div>
 <div class="foot">
  <button data-act="undo" ${history.length?'':'disabled'} title="Ctrl+Z">↶ 復原</button>
  <button data-act="redo" ${future.length?'':'disabled'} title="Ctrl+Shift+Z">↷ 重做</button>
  <label style="display:flex;gap:4px;align-items:center;font-size:12px"><input type="checkbox" data-act="auto" ${ui.auto?'checked':''}>自動套用</label>
  <button data-act="apply" title="Ctrl+S">套用到遊戲</button>
  <button class="primary" data-act="export" title="Ctrl+Shift+E">⬇ 匯出 JSON</button>
  <div class="status ${lastStatus.ok?'ok':'bad'}" data-status>${statusHTML()}</div>
  <div class="keys">Alt+F 定位 · Alt+T 改字 · Alt+B 開關 · Ctrl+S 套用 · Ctrl+Shift+E 匯出 · Ctrl+Z 復原</div>
 </div></section>`;
 const body=root.querySelector('.body'),scroll=body?.scrollTop||0;
 box.innerHTML=html;
 const nb=root.querySelector('.body');
 if(nb&&renderPanel.keepScroll)nb.scrollTop=scroll;
 else if(nb&&renderPanel.scrollTo){const el=root.querySelector(renderPanel.scrollTo);if(el)el.scrollIntoView({block:'center'});}
 renderPanel.keepScroll=false;renderPanel.scrollTo=null;
 if(ui.tab==='icons'){try{imBind();}catch(e){console.warn('[即時平衡器] 圖示製作器',e);}}
 const f=root.querySelector('[data-autofocus]');if(f){f.focus();f.select?.();}
}
function renderTab(){
 switch(ui.tab){
  case 'data':return renderData();
  case 'inspect':return renderInspect();
  case 'text':return renderText();
  case 'changes':return renderChanges();
  case 'test':return renderTest();
  case 'icons':return renderIcons();
  case 'export':return renderExport();
 }return '';
}
function openPath(p,{highlight=null}={}){
 ui.group=null;ui.raw=null;ui.confirmDel=null;ui.rename=null;
 const cat=CATEGORIES.slice().reverse().find(c=>startsWith(p,c.path));if(cat)ui.cat=cat.id;
 ui.path=p;ui.tab='data';ui.highlight=highlight;
 ui.recent=[JSON.stringify(p)].concat((ui.recent||[]).filter(x=>x!==JSON.stringify(p))).slice(0,10);
 renderPanel.scrollTo='.field.err,.field.hl';
}

// ---------- 資料頁 ----------
function renderData(){
 const cat=CATEGORIES.find(c=>c.id===ui.cat)||CATEGORIES[0];
 let h='<div class="systems">'+SYSTEMS.map(sys=>{const list=CATEGORIES.filter(c=>c.sys===sys&&getAt(draft,c.path)!==undefined);if(!list.length)return '';
  return `<div class="sysrow${list.some(c=>c.id===cat.id)?' cur':''}"><span class="sysname">${sys}</span><div class="cats">${list.map(c=>`<button class="${c.id===cat.id&&!ui.path&&!ui.group?'on':''}" data-cat="${c.id}">${c.name}</button>`).join('')}</div></div>`;}).join('')+'</div>';
 h+=quickLinks();
 if(ui.confirmDel)return h+renderConfirmDel();
 if(ui.rename)return h+renderRename();
 if(ui.group)return h+renderGroup();
 if(ui.path)return h+renderEditor(ui.path);
 // 全域搜尋
 h+=`<div class="row"><input data-gsearch placeholder="全域搜尋：所有分類的名稱、識別碼" value="${esc(ui.gsearch||'')}"></div>`;
 if(ui.gsearch&&ui.gsearch.trim().length>=1)return h+renderGlobalSearch(ui.gsearch.trim());
 const coll=getAt(draft,cat.path);
 const tableable=Array.isArray(coll)&&coll.length&&coll.every(x=>x&&typeof x==='object'&&!Array.isArray(x));
 h+=`<div class="row"><input data-filter placeholder="篩選${cat.name}（名稱、識別碼、任何文字）" value="${esc(ui.filter)}">${tableable?`<button class="fit ${ui.table?'on':''}" data-act="toggle-table">表格</button>`:''}<button class="fit" data-open="${esc(JSON.stringify(cat.path))}">整組編輯</button></div>`;
 if(!coll||typeof coll!=='object')return h+`<p class="hint">此分類目前沒有資料。</p>`;
 const entries=Array.isArray(coll)?coll.map((v,i)=>[i,v]):Object.entries(coll);
 const q=ui.filter.trim().toLowerCase();
 const rows=entries.filter(([k,v])=>!q||(String(k)+JSON.stringify(v)).toLowerCase().includes(q));
 if(tableable&&ui.table)return h+renderTable(cat,rows);
 h+=`<div class="hint">${rows.length}／${entries.length} 筆 · 點選開啟編輯</div><div class="list">`;
 for(const [k,v] of rows.slice(0,400)){const p=cat.path.concat(k);const changed=JSON.stringify(getAt(base,p))!==JSON.stringify(v);
  h+=`<div class="item" data-open="${esc(JSON.stringify(p))}"><span>${changed?'<b style="color:#f5b942">● </b>':''}${esc(friendlyLabel(p,v)||labelOf(v,k))}</span><small>${esc(Array.isArray(coll)?'#'+k:k)}</small></div>`;}
 h+='</div>';
 if(rows.length>400)h+=`<p class="hint">僅顯示前 400 筆，請用篩選縮小範圍。</p>`;
 if(tableable)h+=`<div class="row" style="margin-top:8px"><button data-act="dup-last" data-path="${esc(JSON.stringify(cat.path))}">＋ 複製最後一筆新增</button></div>`;
 return h;
}
function quickLinks(){
 const pins=(ui.pins||[]).filter(s=>getAt(draft,JSON.parse(s))!==undefined),recent=(ui.recent||[]).filter(s=>!pins.includes(s)&&getAt(draft,JSON.parse(s))!==undefined).slice(0,8);
 if(!pins.length&&!recent.length)return '';
 const chip=s=>{const p=JSON.parse(s);return `<span class="chip" data-open="${esc(s)}" title="${esc(pathText(p))}">${esc(labelOf(getAt(draft,p),p[p.length-1]).slice(0,20))}</span>`;};
 return (pins.length?`<div class="chips"><span class="t">📌 釘選</span>${pins.map(chip).join('')}</div>`:'')+(recent.length?`<div class="chips"><span class="t">最近</span>${recent.map(chip).join('')}</div>`:'');
}
function renderGlobalSearch(q){
 const ql=q.toLowerCase(),out=[];
 const walk=(v,p,d)=>{if(out.length>=80||d>8||!v||typeof v!=='object')return;
  if(!Array.isArray(v)){const nm=v.name||v.title||v.label;const id=v.id;
   if((typeof nm==='string'&&nm.toLowerCase().includes(ql))||(id!=null&&String(id).toLowerCase()===ql)||(typeof id==='string'&&id.toLowerCase().includes(ql)))out.push(p);}
  for(const k of Object.keys(v)){if(!p.length&&SKIP_ROOT.has(k))continue;walk(v[k],p.concat(Array.isArray(v)?Number(k):k),d+1);}};
 walk(draft,[],0);
 if(!out.length)return '<p class="hint">找不到符合的資料。</p>';
 return `<div class="hint">${out.length>=80?'超過 80 筆，只列前 80 筆':out.length+' 筆'}</div><div class="list">`+out.map(p=>{const c=catOf(p);return `<div class="item" data-open="${esc(JSON.stringify(p))}"><span>${esc(labelOf(getAt(draft,p),p[p.length-1]))}</span><small>${esc(c?c.sys+' › '+c.name:'')} ${esc(pathText(p)).slice(0,40)}</small></div>`;}).join('')+'</div>';
}
// 表格檢視與批次調整
function tableColumns(rows){
 const count=new Map();
 for(const [,v] of rows)for(const [k,x] of Object.entries(v))if(x===null||typeof x!=='object')count.set(k,(count.get(k)||0)+1);
 const keys=[...count].filter(([,n])=>n>=rows.length*0.5).map(([k])=>k);
 const first=['id','name','title'].filter(k=>keys.includes(k));
 const nums=keys.filter(k=>!first.includes(k)&&rows.some(([,v])=>typeof v[k]==='number'));
 const rest=keys.filter(k=>!first.includes(k)&&!nums.includes(k)&&!FREE_TEXT.test(k));
 return first.concat(nums,rest).slice(0,24);
}
function renderTable(cat,rows){
 const cols=tableColumns(rows);
 if(ui.sort&&cols.includes(ui.sort.key)){const {key,dir}=ui.sort;rows=rows.slice().sort((a,b)=>{const x=a[1][key],y=b[1][key];return (typeof x==='number'&&typeof y==='number'?x-y:String(x??'').localeCompare(String(y??'')))*dir;});}
 const numCols=cols.filter(k=>rows.some(([,v])=>typeof v[k]==='number'));
 let h=`<div class="card"><b>批次調整</b>（套用到目前篩選的 ${rows.length} 筆）<div class="row" style="margin-top:6px">
  <select data-batch-col>${numCols.map(k=>`<option value="${esc(k)}">${esc(zhKey(k)||k)}（${esc(k)}）</option>`).join('')}</select>
  <select data-batch-op class="fit" style="width:auto"><option value="mul">× 乘以</option><option value="add">＋ 加上</option><option value="set">＝ 設為</option><option value="pct">％ 增減百分比</option></select>
  <input data-batch-val type="number" step="any" placeholder="數值" style="max-width:90px">
  <label class="fit" style="font-size:11px;display:flex;gap:3px;align-items:center"><input type="checkbox" data-batch-round>取整數</label>
  <button class="fit primary" data-act="batch" data-path="${esc(JSON.stringify(cat.path))}" data-rows="${esc(JSON.stringify(rows.map(r=>r[0])))}">套用</button></div></div>`;
 h+=`<div class="hint">${rows.length} 筆 · 點欄位標題排序 · 點識別碼開啟完整編輯</div><div class="tablewrap"><table><thead><tr>${cols.map(k=>`<th data-sort="${esc(k)}">${esc(zhKey(k)||k)}${ui.sort?.key===k?(ui.sort.dir>0?' ▲':' ▼'):''}<span class="en">${esc(k)}</span></th>`).join('')}</tr></thead><tbody>`;
 for(const [i,v] of rows.slice(0,500)){
  h+='<tr>'+cols.map(k=>{const p=cat.path.concat(i,k);const x=v[k];const ps=esc(JSON.stringify(p));
   const changed=getAt(base,p)!==x,warn=rangeWarn(k,x);
   if(k==='id')return `<td><a class="link" data-open="${esc(JSON.stringify(cat.path.concat(i)))}">${esc(x)}</a></td>`;
   let cell;
   if(typeof x==='boolean')cell=`<input type="checkbox" data-field="${ps}" data-type="boolean" ${x?'checked':''}>`;
   else if(typeof x==='number')cell=`<input type="number" step="any" data-field="${ps}" data-type="number" value="${x}" title="${esc(warn)}">`;
   else if(x===undefined)cell='';
   else cell=`<input data-field="${ps}" data-type="${x===null?'json':'string'}" value="${esc(x===null?'null':x)}">`;
   return `<td class="${changed?'changed':''} ${warn?'warn':''}">${cell}</td>`;}).join('')+'</tr>';
 }
 h+='</tbody></table></div>';
 if(rows.length>500)h+='<p class="hint">只顯示前 500 筆。</p>';
 return h;
}
function crumbs(path){
 let h='<div class="crumb">';
 h+=`<a data-act="back">← 返回清單</a> · `;
 for(let i=0;i<=path.length;i++){const p=path.slice(0,i);const name=i===0?'根':(zhKey(path[i-1])&&typeof path[i-1]==='string'?zhKey(path[i-1]):String(path[i-1]));h+=(i?' › ':'')+(i===path.length?`<b>${esc(name)}</b>`:`<a data-open="${esc(JSON.stringify(p))}">${esc(name)}</a>`);}
 return h+'</div>';
}
function renderGroup(){
 const g=ui.group,path=g.paths[0]?g.paths[0].concat(g.rel):null;
 let h=`<div class="crumb"><a data-act="group-exit">← 離開同步編輯</a> · `+(g.rel.length?`<a data-act="group-rel" data-rel="[]">${esc(g.name)}</a>`:`<b>${esc(g.name)}</b>`)+g.rel.map((k,i)=>' › '+(i===g.rel.length-1?`<b>${esc(zhKey(k)||k)}</b>`:`<a data-act="group-rel" data-rel="${esc(JSON.stringify(g.rel.slice(0,i+1)))}">${esc(zhKey(k)||k)}</a>`)).join('')+'</div>';
 h+=`<div class="card"><b>同步編輯「${esc(g.name)}」：已選 ${g.paths.length}／${g.all.length} 筆</b><p class="hint">修改任一欄位會同時寫入勾選的每一筆。預設只勾選同一遊戲系統的資料；名稱相同但其實是不同東西時，請取消勾選。</p>`;
 h+=g.all.map((gp,i)=>{const c=catOf(gp);const on=g.paths.some(p=>JSON.stringify(p)===JSON.stringify(gp));return `<div class="hint" style="margin:0;display:flex;gap:6px;align-items:center"><input type="checkbox" data-group-pick="${i}" ${on?'checked':''}>${esc(c?c.sys+' › '+c.name:'其他')} <a class="link" data-act="group-single" data-path="${esc(JSON.stringify(gp))}">${esc(pathText(gp))}</a></div>`;}).join('');
 if(!path)return h+'</div><p class="hint">請至少勾選一筆。</p>';
 const v=getAt(draft,path);
 h+=`<div class="row" style="margin-top:6px"><button data-act="raw" data-path="${esc(JSON.stringify(path))}">以 JSON 編輯（套用到全部）</button><button data-act="revert" data-path="${esc(JSON.stringify(path))}">全部還原</button></div></div>`;
 if(v===undefined)return h+'<p class="hint">第一筆沒有此欄位。</p>';
 if(ui.raw===pathText(path))return h+`<textarea data-raw style="min-height:50vh">${esc(JSON.stringify(v,null,2))}</textarea><div class="row" style="margin-top:6px"><button class="primary" data-act="raw-save" data-path="${esc(JSON.stringify(path))}">儲存到全部 ${g.paths.length} 筆</button><button data-act="raw-cancel">取消</button></div>`;
 return h+renderFields(v,path,0);
}
function renderEditor(path){
 const v=getAt(draft,path);
 let h=crumbs(path);
 if(v===undefined)return h+'<p class="hint">此路徑已不存在。</p>';
 const ps=esc(JSON.stringify(path)),pinned=(ui.pins||[]).includes(JSON.stringify(path));
 h+=`<div class="card"><b>${esc(friendlyLabel(path,v)||labelOf(v,path[path.length-1]))}</b><div class="hint">${esc(pathText(path))}</div>`;
 const iconFocus=imFocusFor(path);
 h+=`<div class="row"><button data-act="pin" data-path="${ps}">${pinned?'取消釘選':'📌 釘選'}</button>${iconFocus?`<button data-act="icon-design" data-focus="${esc(JSON.stringify(iconFocus))}">🎨 設計圖示</button>`:''}<button data-act="raw" data-path="${ps}">以 JSON 編輯</button>`;
 const parent=getAt(draft,path.slice(0,-1));
 if(Array.isArray(parent)){h+=`<button data-act="dup" data-path="${ps}">複製一筆</button><button class="danger" data-act="del" data-path="${ps}">刪除</button>`;}
 if(JSON.stringify(getAt(base,path))!==JSON.stringify(v)&&getAt(base,path)!==undefined)h+=`<button data-act="revert" data-path="${ps}">還原此項</button>`;
 h+='</div>'+preview(v,path)+'</div>';
 if(ui.raw===pathText(path))return h+`<textarea data-raw style="min-height:50vh">${esc(JSON.stringify(v,null,2))}</textarea><div class="row" style="margin-top:6px"><button class="primary" data-act="raw-save" data-path="${ps}">儲存 JSON</button><button data-act="raw-cancel">取消</button></div>`;
 const isGem=path.length===3&&path[0]==='skillSystem'&&path[1]==='gems';
 return h+(isGem?gemCard(path):'')+renderFields(v,path,0);
}
// 戰鬥數值預覽
function preview(v,path){
 if(!v||typeof v!=='object'||Array.isArray(v))return '';
 let s=null;try{if(globalThis.state&&typeof stats==='function')s=stats(globalThis.state);}catch{}
 const out=[];
 if(typeof v.power==='number'){
  const cd=v.timing?.cooldownSeconds??v.cooldownSeconds??null,hits=v.hitCount||1,targets=v.maxTargets||1;
  out.push('技能倍率 '+Math.round(v.power*100)+'%'+(hits>1?' × '+hits+' 段':'')+(targets>1?'，最多 '+targets+' 個目標':''));
  if(s?.atk){const one=v.power*s.atk*hits;out.push('以目前角色攻擊 '+Math.round(s.atk)+' 計：單次約 '+Math.round(one)+(cd?'，每秒約 '+(one/cd).toFixed(1)+'（冷卻 '+cd+' 秒）':''));}
  else if(cd)out.push('每秒倍率約 '+(v.power*hits/cd*100).toFixed(0)+'%（冷卻 '+cd+' 秒）；進入遊戲後可依角色攻擊換算');
 }
 const bs=v.baseStats||v.initialStats;
 if(bs&&typeof bs.hp==='number'){
  if(s?.atk)out.push('目前角色攻擊 '+Math.round(s.atk)+'，約 '+Math.ceil(bs.hp/Math.max(1,s.atk-(bs.def||0)*0.5))+' 次普通攻擊擊倒（未計技能與屬性，僅供參考）');
  if(s?.hp&&typeof bs.atk==='number')out.push('對目前角色每次約造成 '+Math.max(1,Math.round(bs.atk-(s.def||0)*0.5))+' 傷害，約 '+Math.ceil(s.hp/Math.max(1,bs.atk-(s.def||0)*0.5))+' 次擊倒角色（僅供參考）');
 }
 if(typeof v.cost==='number'&&typeof v.sellPrice==='number'&&v.cost>0)out.push('賣出價為購買價的 '+Math.round(v.sellPrice/v.cost*100)+'%');
 return out.length?`<div class="note ref" style="margin-top:4px">${out.map(esc).join('<br>')}</div>`:'';
}
// 欄位依意義分組
const SECTION_OF=k=>{
 if(/^(id|name|title|label|description|text|hint|type|kind|category|icon|iconType|color|rating|rarity|quality|element|race|activation|effect|job|jobs|weapon|weaponType|main|advanced|displayName)$/.test(k))return '基本資料';
 if(/(unlock|Unlock|required|Required|requires|prerequisite|Condition|condition|initial)/.test(k))return '取得與解鎖';
 if(/(cost|Cost|price|Price|sell|Sell|shop|Shop|gold|Gold|reward|Reward|drop|Drop)/.test(k))return '價格與獎勵';
 return null;
};
function renderFields(v,path,depth){
 if(v===null||typeof v!=='object')return fieldRow(path[path.length-1],v,path);
 const entries=Array.isArray(v)?v.map((x,i)=>[i,x]):Object.entries(v);
 let h='';
 const one=([k,x])=>{
  const p=path.concat(k);
  if(x!==null&&typeof x==='object'){
   const big=JSON.stringify(x).length>2500||depth>=3;
   const changed=JSON.stringify(getAt(base,p))!==JSON.stringify(x);
   if(big)return `<div class="field${changed?' changed':''}">${keyLabel(k,p,x)}<div><a class="item" data-open="${esc(JSON.stringify(p))}" style="display:block">${esc(labelOf(x,k))} ›</a></div></div>`;
   return `<details ${depth<1?'open':''}><summary>${changed?'<b style="color:#f5b942">● </b>':''}${esc(typeof k==='number'?zhKey(k):(zhKey(k)||k))} <span class="en">${esc(k)}</span> · ${esc(labelOf(x,k))} <a data-open="${esc(JSON.stringify(p))}" style="color:#a99cc4">開啟</a></summary><div class="nest">${(Array.isArray(x)?x.length:Object.keys(x).length)===0?'<span class="hint">（空）</span>':renderFields(x,p,depth+1)}</div>${Array.isArray(x)&&x.length===0?`<button class="mini" data-act="push" data-path="${esc(JSON.stringify(p))}">＋ 新增一項</button>`:''}</details>`;
  }
  return fieldRow(k,x,p);
 };
 if(depth===0&&!Array.isArray(v)&&entries.length>6){
  // 物件第一層：基本資料、數值、開關、取得與解鎖、價格與獎勵、其他、子項目
  const sec=new Map([['基本資料',[]],['數值',[]],['開關',[]],['取得與解鎖',[]],['價格與獎勵',[]],['其他文字',[]],['子項目',[]]]);
  for(const e of entries){const [k,x]=e;const s=SECTION_OF(k)||(x!==null&&typeof x==='object'?'子項目':typeof x==='number'?'數值':typeof x==='boolean'?'開關':'其他文字');sec.get(s).push(e);}
  for(const [name,list] of sec)if(list.length)h+=`<div class="sec">${name}</div>`+list.map(one).join('');
 }else h+=entries.slice(0,300).map(one).join('');
 if(entries.length>300&&!(depth===0&&!Array.isArray(v)))h+=`<p class="hint">還有 ${entries.length-300} 項，請用「以 JSON 編輯」。</p>`;
 if(Array.isArray(v)&&v.length&&v.every(x=>x===null||typeof x!=='object'))h+=`<button class="mini" data-act="push" data-path="${esc(JSON.stringify(path))}" style="margin:4px 0">＋ 新增一項</button>`;
 return h;
}
function keyLabel(k,p,v){
 const zh=zhKey(k),hint=[unitHint(k),pathHint(p)].filter(Boolean).join('；');
 return `<label title="${esc(pathText(p)+(hint?'\n'+hint:''))}">${zh?`<span class="zh">${esc(zh)}</span><span class="en">${esc(k)}</span>`:`<span class="zh">${esc(k)}</span>`}${hint?`<span class="note">${esc(hint)}</span>`:''}</label>`;
}
// 代碼欄位的選項（取自遊戲 _reference）
function enumTable(k){const R=base?._reference||{};return {element:R.elements,race:R.races,activation:R.activations,quality:R.qualities}[k]||null;}
function fieldRow(k,x,p){
 const gv=groupValues(p);const differs=gv&&!sameAll(gv);
 const changed=gv?gv.some((y,i)=>JSON.stringify(y)!==JSON.stringify(getAt(base,ui.group.paths[i].concat(groupRel(p))))):getAt(base,p)!==x;const ps=esc(JSON.stringify(p));const vh=valueHint(k,x);
 const kname=typeof k==='number'?[...p].reverse().find(y=>typeof y==='string'):k;
 const notes=[];let input;
 const table=typeof x==='string'?enumTable(kname):null;
 const rk=refKind(kname);
 if(typeof x==='boolean')input=`<input type="checkbox" data-field="${ps}" data-type="boolean" ${x?'checked':''}>`;
 else if(typeof x==='number')input=`<input type="number" step="any" data-field="${ps}" data-type="number" value="${x}">`;
 else if(x===null)input=`<input data-field="${ps}" data-type="json" value="null" title="以 JSON 輸入，例如 0、&quot;文字&quot;、null">`;
 else if(table&&Object.prototype.hasOwnProperty.call(table,x))input=`<select data-field="${ps}" data-type="string">${Object.entries(table).map(([val,desc])=>`<option value="${esc(val)}" ${val===x?'selected':''}>${esc(val)} · ${esc(String(desc).split('；')[0].slice(0,16))}</option>`).join('')}</select>`;
 else if(String(x).length>60||String(x).includes('\n'))input=`<textarea data-field="${ps}" data-type="string">${esc(x)}</textarea>`;
 else{
  // 引用欄位與常見代碼：提供既有值選單
  let options=[];
  if(rk&&k!=='id')options=idsOf(rk.coll).map(o=>[String(o.id),o.name]);
  else if(!FREE_TEXT.test(String(kname))&&k!=='id'){const s=buildIndex().values.get(kname);if(s&&s.size>=2&&s.size<=60)options=[...s].map(v=>[v,'']);}
  const lid='dl'+Math.abs(hashStr(ps));
  input=`<input data-field="${ps}" data-type="string" value="${esc(x)}" ${options.length?`list="${lid}"`:''}>`+(options.length?`<datalist id="${lid}">${options.slice(0,400).map(([val,nm])=>`<option value="${esc(val)}">${esc(nm)}</option>`).join('')}</datalist>`:'');
 }
 // 引用解析：顯示被引用資料名稱，或找不到時警告
 if(rk&&k!=='id'&&(typeof x==='string'||typeof x==='number')&&x!==''){
  const hit=idsOf(rk.coll).find(o=>String(o.id)===String(x));
  if(hit)notes.push(`<div class="note ref">→ ${esc(rk.name)}：${esc(hit.name||hit.id)} <a class="link" data-act="goto-ref" data-coll="${esc(JSON.stringify(rk.coll))}" data-id="${esc(String(x))}">開啟</a></div>`);
  else if(idsOf(rk.coll).length&&/Id$|^skillId$|^itemId$/.test(String(k)))notes.push(`<div class="note warn">找不到此${esc(rk.name)}識別碼</div>`);
 }
 // 同步編輯時，識別欄位不可統一
 if(gv&&differs&&ID_KEY.test(String(k)))input=`<input value="${esc(String(x))}" disabled title="各筆識別碼不同，同步編輯時不可修改">`;
 const warn=rangeWarn(kname,x);if(warn)notes.push(`<div class="note warn">⚠ ${esc(warn)}</div>`);
 // 識別碼改名（同時更新引用）
 let extra='';
 if(k==='id'&&!gv&&typeof x==='string'&&p.length>=2)extra=`<button class="fit mini" data-act="rename" data-path="${ps}" title="改識別碼並更新所有引用">改名</button>`;
 const delBtn=typeof p[p.length-1]==='number'?`<button class="fit mini" data-act="del" data-path="${ps}" title="刪除">✕</button>`:'';
 const isErr=errorPaths.some(e=>JSON.stringify(e)===JSON.stringify(p));
 const isHl=!isErr&&ui.highlight&&hlMatch(x);
 return `<div class="field${changed?' changed':''}${isErr?' err':''}${isHl?' hl':''}">${keyLabel(k,p,x)}<div><div class="row" style="margin:0">${input}${extra}${delBtn}</div>${vh?`<div class="note">${esc(vh)}</div>`:''}${notes.join('')}${differs?`<div class="note was">${ID_KEY.test(String(k))?'識別欄位，各筆保留原值：':'各筆不同：'}${esc(gv.map(short).join('／'))}</div>`:''}${changed&&!gv?`<div class="note was">原值：${esc(short(getAt(base,p)))}</div>`:''}</div></div>`;
}
function hashStr(s){let h=0;for(let i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))|0;return h;}
// 定位時點到的文字中出現的數值或文字，標示對應欄位
function hlMatch(x){
 const t=ui.highlight;if(x==null||typeof x==='boolean')return false;
 if(typeof x==='number'){if(x===0||x===1)return false;const shown=[String(x),String(Math.round(x*100)),String(Math.round(x*1000)/10)];return shown.some(s=>new RegExp('(^|[^\\d.])'+s.replace('.','\\.')+'($|[^\\d])').test(t));}
 return typeof x==='string'&&x.length>=2&&t.includes(x);
}
// 刪除確認：列出引用與存檔相容性提醒
function renderConfirmDel(){
 const {path,refs}=ui.confirmDel;const v=getAt(draft,path);
 let h=`<div class="card warn"><b>刪除「${esc(labelOf(v,path[path.length-1]))}」？</b><div class="hint">${esc(pathText(path))}</div>`;
 if(refs.length)h+=`<p class="hint" style="color:#ff8a9a">有 ${refs.length} 處資料引用這一筆，刪除後遊戲驗證可能拒絕套用：</p><div class="list">${refs.slice(0,40).map(r=>`<div class="item" data-open="${esc(JSON.stringify(r.length>1?r.slice(0,-1):r))}" data-err-path="${esc(JSON.stringify(r))}"><span>${esc(catOf(r)?.name||'')} ${esc(labelOf(getAt(draft,r.slice(0,-1)),r[r.length-2]))}</span><small>${esc(pathText(r)).slice(0,50)}</small></div>`).join('')}</div>`;
 else h+='<p class="hint">沒有找到其他資料引用這一筆。</p>';
 h+=`<p class="hint">提醒：玩家存檔若已擁有或正在使用這一筆（裝備、技能、道具、夥伴等），刪除後該存檔可能無法讀取。測試時建議先改為停用或不販售。</p>`;
 h+=`<div class="row"><button class="danger" data-act="del-confirm">確認刪除</button><button data-act="del-cancel">取消</button></div></div>`;
 return h;
}
function renderRename(){
 const {path,old}=ui.rename;const refs=findRefs(old,path.slice(0,-1));
 return `<div class="card"><b>識別碼改名</b><p class="hint">把「${esc(old)}」改成新的識別碼，並同時更新 ${refs.length} 處引用。</p>
 <div class="row"><input data-rename value="${esc(old)}" data-autofocus></div>
 ${refs.length?`<div class="list" style="max-height:30vh;overflow:auto">${refs.slice(0,60).map(r=>`<div class="item"><span>${esc(catOf(r)?.name||'')}</span><small>${esc(pathText(r)).slice(0,60)}</small></div>`).join('')}</div>`:''}
 <div class="row" style="margin-top:6px"><button class="primary" data-act="rename-confirm">改名並更新引用</button><button data-act="rename-cancel">取消</button></div></div>`;
}

// ---------- 點選定位頁 ----------
function renderInspect(){
 let h=`<p class="hint">按「🎯 定位」（Alt+F）後點選遊戲畫面上的道具、技能、夥伴、怪物、任務等。平衡器依畫面文字找出對應資料，並標示畫面上出現的數值欄位。</p><button class="primary" data-act="pick-inspect">🎯 開始點選</button>`;
 if(inspectResults.clickedText!=null){
  h+=`<div class="card" style="margin-top:8px"><div class="hint">點到的文字：</div>${esc(inspectResults.clickedText.slice(0,160))}</div>`;
  if(!inspectResults.length)h+='<p class="hint">找不到對應資料，可改用「✎ 改字」修改這段畫面文字。</p>';
  h+='<div class="list">';
  const byName=new Map();for(const r of inspectResults){if(!byName.has(r.name))byName.set(r.name,[]);byName.get(r.name).push(r);}
  for(const [name,list] of byName)if(list.length>1){
   const names=[...new Set(list.map(r=>catOf(r.path)?.name||'其他'))].join('、');
   h+=`<div class="item" data-act="group-open" data-name="${esc(name)}" style="border-color:#f5b942"><span><b>${esc(name)}</b> ×${list.length} · 全部一起改</span><small>${esc(names)}</small></div>`;
  }
  for(const r of inspectResults){const c=catOf(r.path);
   h+=`<div class="item" data-act="inspect-open" data-path="${esc(JSON.stringify(r.path))}"><span>${esc(r.name)}</span><small>${esc(c?c.sys+' › '+c.name:'')} ${esc(pathText(r.path)).slice(0,40)}</small></div>`;}
  h+='</div>';
 }
 return h;
}

// ---------- 文字頁 ----------
function renderText(){
 let h=`<p class="hint">按「✎ 改字」（Alt+T）後點選遊戲畫面上的任何文字即可修改。數字會自動視為 {#}，同一句原文全遊戲一起修改。</p><button class="primary" data-act="pick-text">✎ 開始點選文字</button>`;
 if(pendingText){
  h+=`<div class="card" style="margin-top:8px">`;
  if(pendingText.sources?.length){
   h+=`<div class="note ref" style="margin-bottom:6px">這段文字來自資料欄位，建議直接改資料（會連同其他使用處一起更新）：</div><div class="list" style="margin-bottom:8px">${pendingText.sources.map(s=>{const c=catOf(s.path);const own=getAt(draft,s.path.slice(0,-1));return `<div class="item" data-act="text-src" data-path="${esc(JSON.stringify(s.path))}"><span>${esc(c?c.name+' › ':'')}${esc(labelOf(own,s.path[s.path.length-2]))} › ${esc(zhKey(s.path[s.path.length-1])||s.path[s.path.length-1])}${s.exact?'':'（包含）'}</span><small>改資料</small></div>`;}).join('')}</div><div class="hint">或只改畫面顯示（文字覆寫）：</div>`;
  }
  h+=`<div class="hint">原文（比對用）</div><div style="margin-bottom:6px">${esc(pendingText.source)}</div>
  <textarea data-pending data-autofocus>${esc(pendingText.text)}</textarea>
  <div class="row" style="margin-top:6px"><button class="primary" data-act="text-save">儲存</button><button data-act="text-restore">還原原文</button><button data-act="text-cancel">取消</button></div></div>`;
 }
 const list=draft.textOverrides?.entries||[];
 h+=`<h3 style="font-size:13px;margin:12px 0 6px">已修改的文字（${list.length}）</h3><input data-tfilter placeholder="搜尋" value="${esc(ui.tfilter||'')}" style="margin-bottom:6px">`;
 const q=(ui.tfilter||'').toLowerCase();
 h+='<div class="list">'+list.map((x,i)=>[x,i]).filter(([x])=>!q||(x.source+x.text).toLowerCase().includes(q)).slice(0,300).map(([x,i])=>`<div class="field"><label title="${esc(x.source)}">${esc(x.source)}</label><div class="row" style="margin:0"><input data-otext="${i}" value="${esc(x.text)}"><button class="fit mini" data-act="text-del" data-i="${i}">✕</button></div></div>`).join('')+'</div>';
 const ut=draft.uiText;
 if(ut&&typeof ut==='object')h+=`<h3 style="font-size:13px;margin:12px 0 6px">介面標題（uiText）</h3>`+renderFields(ut,['uiText'],1);
 return h;
}

// ---------- 變更頁 ----------
function renderChanges(){
 const list=diffList(base,draft,1e9);
 if(!list.length)return '<p class="hint">與遊戲發布版本相同，沒有變更。</p>';
 const groups=new Map();for(const d of list){const k=entityKey(d.path);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(d);}
 const ex=new Set(ui.exclude||[]);
 let h=`<p class="hint">共 ${list.length} 處變更、${groups.size} 筆資料。取消勾選的資料不會納入匯出與提交（草稿仍保留）。</p>
 <div class="row"><button data-act="report">⬇ 下載變更報告（Markdown）</button><button data-act="ex-all">全選</button><button data-act="ex-none">全不選</button></div>`;
 for(const sys of SYSTEMS.concat(['其他'])){
  const rows=[...groups].filter(([k])=>(catOf(JSON.parse(k))?.sys||'其他')===sys);if(!rows.length)continue;
  h+=`<div class="sec">${sys}（${rows.length}）</div>`;
  for(const [k,ds] of rows){
   h+=`<details ${rows.length<=6?'open':''}><summary><input type="checkbox" data-exclude="${esc(k)}" ${ex.has(k)?'':'checked'}> ${esc(entityName(k))} · ${ds.length} 處 <a data-open="${esc(k)}" data-goto-data style="color:#a99cc4">開啟</a></summary><div class="nest">`;
   for(const d of ds.slice(0,60))h+=`<div class="diff">${esc(d.path.slice(JSON.parse(k).length).map(x=>zhKey(x)||x).join(' › ')||'（整筆）')} <span class="en">${esc(pathText(d.path))}</span><br><del>${esc(short(d.from))}</del> → <ins>${esc(short(d.to))}</ins> <button class="mini" data-act="revert" data-path="${esc(JSON.stringify(d.path))}">還原</button></div>`;
   h+='</div></details>';
  }
 }
 return h;
}

// ---------- 測試頁（只改目前存檔，不寫入平衡資料） ----------
function renderTest(){
 const st=globalThis.state;
 if(!st)return '<p class="hint">請先進入遊戲（讀取或建立角色）後再使用測試工具。</p>';
 const items=(draft.items||[]).map(x=>`<option value="${esc(x.id)}">${esc(x.name||x.id)}</option>`).join('');
 const mats=[...new Set(Object.keys(st.materials||{}).concat((draft.balanceSettings?.monsters?.catalog||[]).map(m=>m.material).filter(Boolean)))].map(m=>`<option value="${esc(m)}">`).join('');
 let s=null;try{s=stats(st);}catch{}
 return `<div class="card warn"><b>測試工具</b><p class="hint">這些操作直接修改目前遊戲存檔，用來快速測試平衡，不會寫入匯出的平衡 JSON。正式存檔請先匯出備份。</p></div>
 <div class="card"><b>目前狀態</b><div class="hint">金幣 ${esc(st.gold??'—')}${s?` · 生命 ${Math.round(st.hp??0)}／${Math.round(s.hp)} · 攻擊 ${Math.round(s.atk)} · 防禦 ${Math.round(s.def)}`:''}</div></div>
 <div class="card"><b>金幣</b><div class="row"><input type="number" data-t-gold value="10000"><button class="fit" data-act="t-gold">增加</button></div></div>
 <div class="card"><b>道具</b><div class="row"><select data-t-item>${items}</select><input type="number" data-t-item-n value="5" style="max-width:80px"><button class="fit" data-act="t-item">給予</button></div></div>
 <div class="card"><b>素材</b><div class="row"><input data-t-mat list="dl-mats" placeholder="素材名稱"><datalist id="dl-mats">${mats}</datalist><input type="number" data-t-mat-n value="20" style="max-width:80px"><button class="fit" data-act="t-mat">給予</button></div></div>
 <div class="card"><b>生命</b><div class="row"><button data-act="t-heal">回滿生命</button></div></div>`;
}
function testAction(act){
 const st=globalThis.state;if(!st)return;
 const num=sel=>Number(root.querySelector(sel)?.value)||0;
 try{
  if(act==='t-gold')st.gold=(Number(st.gold)||0)+num('[data-t-gold]');
  if(act==='t-item'){const id=root.querySelector('[data-t-item]').value;st.consumables=st.consumables||{};st.consumables[id]=(st.consumables[id]||0)+num('[data-t-item-n]');}
  if(act==='t-mat'){const m=root.querySelector('[data-t-mat]').value.trim();if(!m)return setStatus(false,'請輸入素材名稱');st.materials=st.materials||{};st.materials[m]=(st.materials[m]||0)+num('[data-t-mat-n]');}
  if(act==='t-heal'){const s=stats(st);st.hp=s.hp;}
  try{globalThis.save?.();}catch{}try{render();}catch{}
  setStatus(true,'測試操作完成');
 }catch(e){setStatus(false,'測試操作失敗：'+e.message);}
}

// ---------- 匯出頁 ----------
function renderExport(){
 const n=countDiff(base,selectedDoc()),ex=(ui.exclude||[]).length;
 const sv=serverInfo;
 return `<div class="card"><b>一鍵匯出完整 JSON</b><p class="hint">以遊戲驗證並執行完整檢查後，輸出整份平衡資料（含文字覆寫）。本次包含 ${n} 處變更${ex?`（已排除 ${ex} 筆資料，可在「變更」頁調整）`:''}。可在遊戲內「匯入平衡資料」載入。</p><button class="primary" data-act="export">⬇ 匯出完整 JSON</button> <button data-act="copy">複製到剪貼簿</button></div>
 <div class="card"><b>輸出遊戲模組檔</b><p class="hint">遊戲實際的資料來源是 data/balance/ 下的模組檔，data/balance.json 與 manifest 由它們產生。這裡直接產生三者（以遊戲原始發布檔為底，只套用本次變更），解壓到遊戲 repository 根目錄即可，不需再手動拆分。</p><button class="primary" data-act="modules-changed">⬇ 只輸出有變更的檔案（ZIP）</button> <button data-act="modules-all">輸出全部模組（ZIP）</button></div>
 <div class="card"><b>直接提交到遊戲分支</b>${sv?.git?`<p class="hint">遊戲資料夾：${esc(sv.game)}<br>目前分支：${esc(sv.branch)}${sv.dirty?'<br><span style="color:#ff8a9a">遊戲資料夾有未提交的修改，提交前請先處理。</span>':''}</p>
  <div class="row"><input data-pub-branch value="balance/${stamp()}" placeholder="新分支名稱"></div>
  <div class="row"><input data-pub-msg placeholder="提交說明" value="平衡調整（即時平衡器）"></div>
  <label class="hint" style="display:flex;gap:6px;align-items:center"><input type="checkbox" data-pub-push>提交後推送到遠端（需本機已有推送權限）</label>
  <button class="primary" data-act="publish" ${sv.dirty?'disabled':''}>建立分支並提交</button>`:`<p class="hint">需要用 <code>npm run live</code> 啟動本機伺服器，且遊戲資料夾是 git repository。${sv?'目前遊戲資料夾不是 git repository。':'目前沒有連到本機伺服器（單檔 HTML 模式請改用上方「輸出遊戲模組檔」）。'}</p>`}</div>
 <div class="card"><b>匯入</b><p class="hint">讀入先前匯出的 JSON 繼續編輯。</p><input type="file" accept=".json,application/json" data-import></div>
 <div class="card"><b>重設</b><p class="hint">捨棄所有修改，回到遊戲目前發布的版本。草稿自動保存在此瀏覽器，重新整理後會自動套用。</p><button class="danger" data-act="reset">回到發布版本</button></div>
 <p class="hint">即時平衡器 v${VERSION} · 遊戲資料修訂 ${esc(globalThis.__EMBERWILD_BALANCE_MODULES?.dataRevision??'—')}</p>`;
}

// ---------- 事件 ----------
function pathAttr(el,name='data-path'){return JSON.parse(el.getAttribute(name));}
function onPanelClick(e){
 const t=e.target.closest('[data-act],[data-tab],[data-cat],[data-open],[data-sort]');if(!t)return;
 if(t.matches('input[type=checkbox]'))return;
 if(t.dataset.act==='icon-design'){try{openIconMaker(JSON.parse(t.dataset.focus||'null'));}catch{openIconMaker(null);}return;}
 if(t.dataset.tab){ui.tab=t.dataset.tab;if(ui.tab==='export')probeServer().then(()=>renderPanel());return renderPanel();}
 if(t.dataset.cat){ui.cat=t.dataset.cat;ui.path=null;ui.group=null;ui.filter='';ui.raw=null;ui.confirmDel=null;ui.rename=null;ui.gsearch='';ui.sort=null;return renderPanel();}
 if(t.dataset.sort){const k=t.dataset.sort;ui.sort={key:k,dir:ui.sort?.key===k?-ui.sort.dir:1};renderPanel.keepScroll=true;return renderPanel();}
 if(t.dataset.open&&!t.dataset.act){
  const p=pathAttr(t,'data-open');ui.raw=null;
  if(t.dataset.err)errorPaths=[JSON.parse(t.dataset.err)].concat(errorPaths);
  if(t.dataset.errPath)errorPaths=[JSON.parse(t.dataset.errPath)];
  if(ui.group&&!t.hasAttribute('data-goto-data')){const rel=groupRel(p);if(rel!=null){ui.group.rel=rel;return renderPanel();}}
  const cat=CATEGORIES.slice().reverse().find(c=>startsWith(p,c.path));
  if(cat&&JSON.stringify(cat.path)===JSON.stringify(p)&&p.length&&t.closest('.crumb')){ui.cat=cat.id;ui.path=null;ui.group=null;ui.tab='data';return renderPanel();}
  openPath(p);return renderPanel();
 }
 const act=t.dataset.act;
 switch(act){
  case 'open':ui.open=true;break;
  case 'close':ui.open=false;break;
  case 'side':ui.left=!ui.left;break;
  case 'pick-text':pickMode='text';break;
  case 'pick-inspect':pickMode='inspect';break;
  case 'cancel-pick':pickMode=null;hideHover();break;
  case 'undo':return undo();
  case 'redo':return redo();
  case 'apply':applyDraft();break;
  case 'export':return exportJSON();
  case 'copy':{const out=exportDocument();if(!out)return;navigator.clipboard?.writeText(JSON.stringify(out,null,2)).then(()=>setStatus(true,'已複製完整 JSON'),()=>setStatus(false,'無法寫入剪貼簿'));return;}
  case 'modules-changed':return exportModules(true);
  case 'modules-all':return exportModules(false);
  case 'publish':return publishToGame();
  case 'report':download('dreaming-abyss-balance-changes-'+stamp()+'.md',changeReport(),'text/markdown');return;
  case 'ex-all':ui.exclude=[];break;
  case 'ex-none':ui.exclude=[...new Set(diffList(base,draft,1e9).map(d=>entityKey(d.path)))];break;
  case 'reset':return resetAll();
  case 'back':ui.path=null;ui.group=null;ui.raw=null;break;
  case 'pin':{const s=JSON.stringify(pathAttr(t));ui.pins=(ui.pins||[]).includes(s)?ui.pins.filter(x=>x!==s):[s].concat(ui.pins||[]).slice(0,20);break;}
  case 'toggle-table':ui.table=!ui.table;break;
  case 'batch':return batchApply(t);
  case 'raw':ui.raw=pathText(pathAttr(t));break;
  case 'raw-cancel':ui.raw=null;break;
  case 'inspect-open':openPath(pathAttr(t),{highlight:inspectResults.clickedText||''});break;
  case 'group-open':openGroup(t.dataset.name);ui.tab='data';ui.raw=null;ui.path=null;renderPanel.scrollTo='.field.hl';break;
  case 'group-exit':ui.group=null;ui.raw=null;break;
  case 'group-rel':ui.group.rel=JSON.parse(t.dataset.rel);ui.raw=null;break;
  case 'group-single':openPath(pathAttr(t));break;
  case 'goto-ref':{const coll=JSON.parse(t.dataset.coll);const arr=getAt(draft,coll)||[];const i=arr.findIndex(o=>String(o?.id)===t.dataset.id);if(i>=0)openPath(coll.concat(i));break;}
  case 'raw-save':{const p=pathAttr(t);try{const v=JSON.parse(root.querySelector('[data-raw]').value);commit(()=>{writeAll(p,tp=>{draft=setAt(draft,tp,clone(v));});});ui.raw=null;}catch(err){setStatus(false,'JSON 格式錯誤：'+err.message);return;}break;}
  case 'dup':{const p=pathAttr(t);const arr=getAt(draft,p.slice(0,-1));const i=p[p.length-1];commit(()=>{const c=clone(arr[i]);bumpId(c,arr);arr.splice(i+1,0,c);});openPath(p.slice(0,-1).concat(i+1));break;}
  case 'dup-last':{const p=pathAttr(t);const arr=getAt(draft,p);commit(()=>{const c=clone(arr[arr.length-1]);bumpId(c,arr);arr.push(c);});openPath(p.concat(arr.length-1));break;}
  case 'del':{const p=pathAttr(t);const v=getAt(draft,p);
   // 整筆資料：先列出引用再確認；陣列中的單一值直接刪
   if(v&&typeof v==='object'){const id=v.id;ui.confirmDel={path:p,refs:id!=null?findRefs(id,p):[]};ui.tab='data';break;}
   commit(()=>{writeAll(p,tp=>{const a=getAt(draft,tp.slice(0,-1));if(Array.isArray(a))a.splice(tp[tp.length-1],1);});});renderPanel.keepScroll=true;break;}
  case 'del-confirm':{const p=ui.confirmDel.path;commit(()=>{writeAll(p,tp=>{const a=getAt(draft,tp.slice(0,-1));if(Array.isArray(a))a.splice(tp[tp.length-1],1);});});ui.confirmDel=null;if(ui.path&&startsWith(ui.path,p))ui.path=null;break;}
  case 'del-cancel':ui.confirmDel=null;break;
  case 'rename':{const p=pathAttr(t);ui.rename={path:p,old:getAt(draft,p)};break;}
  case 'rename-cancel':ui.rename=null;break;
  case 'rename-confirm':{const {path,old}=ui.rename;const nv=root.querySelector('[data-rename]').value.trim();
   if(!nv||nv===old){ui.rename=null;break;}
   if(buildIndex().ids.has(nv)&&!confirm('識別碼「'+nv+'」已被其他資料使用，仍要改名嗎？'))return;
   const refs=findRefs(old,path.slice(0,-1));
   commit(()=>{draft=setAt(draft,path,nv);for(const r of refs){const cur=getAt(draft,r);if(cur===old)draft=setAt(draft,r,nv);else if(typeof cur==='string'&&cur.endsWith(':'+old))draft=setAt(draft,r,cur.slice(0,cur.length-old.length)+nv);}},{label:'改名'});
   setStatus(true,'已把「'+old+'」改為「'+nv+'」，並更新 '+refs.length+' 處引用');ui.rename=null;break;}
  case 'push':{const p=pathAttr(t);const arr=getAt(draft,p);const sample=arr[arr.length-1];const nv=typeof sample==='number'?0:typeof sample==='boolean'?false:'';commit(()=>writeAll(p,tp=>{const a=getAt(draft,tp);if(Array.isArray(a))a.push(nv);}));renderPanel.keepScroll=true;break;}
  case 'revert':{const p0=pathAttr(t);const targets=groupTargets(p0).sort((a,b)=>(b[b.length-1]>a[a.length-1])?1:-1);commit(()=>{for(const p of targets){const orig=getAt(base,p);if(orig===undefined){const par=getAt(draft,p.slice(0,-1));if(Array.isArray(par))par.splice(p[p.length-1],1);else if(par)delete par[p[p.length-1]];}else draft=setAt(draft,p,clone(orig));}});renderPanel.keepScroll=true;break;}
  case 'text-save':{const v=root.querySelector('[data-pending]').value;setOverride(pendingText.source,v);pendingText=null;break;}
  case 'text-restore':setOverride(pendingText.source,null);pendingText=null;break;
  case 'text-cancel':pendingText=null;try{globalThis.EmberwildTextOverrides?.preview({version:1,entries:overrides()});}catch{}break;
  case 'text-src':{const p=pathAttr(t);const own=p.slice(0,-1);pendingText=null;try{globalThis.EmberwildTextOverrides?.preview({version:1,entries:draft.textOverrides?.entries||[]});}catch{}openPath(own);errorPaths=[];ui.highlight=String(getAt(draft,p));break;}
  case 'text-del':{const i=Number(t.dataset.i);const s=overrides()[i]?.source;if(s)setOverride(s,null);renderPanel.keepScroll=true;break;}
  case 't-gold':case 't-item':case 't-mat':case 't-heal':testAction(act);break;
 }
 renderPanel();
}
function batchApply(t){
 const coll=pathAttr(t),rows=JSON.parse(t.dataset.rows);
 const key=root.querySelector('[data-batch-col]')?.value,op=root.querySelector('[data-batch-op]')?.value,val=Number(root.querySelector('[data-batch-val]')?.value),round=root.querySelector('[data-batch-round]')?.checked;
 if(!key||!Number.isFinite(val)){setStatus(false,'請選擇欄位並輸入數值');return;}
 let n=0;
 commit(()=>{const arr=getAt(draft,coll);for(const i of rows){const o=arr[i];if(!o||typeof o[key]!=='number')continue;let x=o[key];
  x=op==='mul'?x*val:op==='add'?x+val:op==='pct'?x*(1+val/100):val;
  if(round)x=Math.round(x);else x=Math.round(x*1e6)/1e6;o[key]=x;n++;}},{label:'批次調整'});
 setStatus(true,'已批次調整 '+n+' 筆的「'+(zhKey(key)||key)+'」');renderPanel.keepScroll=true;renderPanel();
}
function bumpId(obj,arr){
 if(!obj||typeof obj!=='object')return;
 if(typeof obj.id==='string'){let n=2,id;do{id=obj.id.replace(/(-copy\d*)?$/,'')+'-copy'+n++;}while(arr.some(x=>x?.id===id));obj.id=id;}
 else if(typeof obj.id==='number'){obj.id=Math.max(...arr.map(x=>Number(x?.id)||0))+1;}
 if(typeof obj.name==='string')obj.name+='（複製）';
}
function onPanelChange(e){
 const t=e.target;
 if(t.matches('[data-act=auto]')){ui.auto=t.checked;if(ui.auto)applyDraft();return renderPanel();}
 if(t.matches('[data-import]')&&t.files[0])return importJSON(t.files[0]);
 if(t.matches('[data-exclude]')){const k=t.dataset.exclude;const s=new Set(ui.exclude||[]);t.checked?s.delete(k):s.add(k);ui.exclude=[...s];renderPanel.keepScroll=true;return renderPanel();}
 if(t.matches('[data-group-pick]')){const gp=ui.group.all[Number(t.dataset.groupPick)];const key=JSON.stringify(gp);
  ui.group.paths=t.checked?ui.group.all.filter(p=>ui.group.paths.some(x=>JSON.stringify(x)===JSON.stringify(p))||JSON.stringify(p)===key):ui.group.paths.filter(p=>JSON.stringify(p)!==key);
  renderPanel.keepScroll=true;return renderPanel();}
 if(t.matches('[data-field]')){
  const p=pathAttr(t,'data-field');let v;
  switch(t.dataset.type){
   case 'boolean':v=t.checked;break;
   case 'number':if(t.value===''){setStatus(false,'數字不可空白');return;}v=Number(t.value);break;
   case 'json':try{v=JSON.parse(t.value);}catch{v=t.value;}break;
   default:v=t.value;
  }
  errorPaths=errorPaths.filter(x=>JSON.stringify(x)!==JSON.stringify(p));
  commit(()=>{writeAll(p,tp=>{draft=setAt(draft,tp,clone(v));});},{label:pathText(p)});
  renderPanel.keepScroll=true;renderPanel();
 }
 if(t.matches('[data-otext]')){const i=Number(t.dataset.otext);const s=overrides()[i]?.source;if(s)setOverride(s,t.value);renderPanel.keepScroll=true;renderPanel();}
}
function keepFocusRender(sel,t){const pos=t.selectionStart;renderPanel();const n=root.querySelector(sel);if(n){n.focus();try{n.setSelectionRange(pos,pos);}catch{}}}
function onPanelInput(e){
 const t=e.target;
 if(t.matches('[data-filter]')){ui.filter=t.value;keepFocusRender('[data-filter]',t);}
 if(t.matches('[data-gsearch]')){ui.gsearch=t.value;keepFocusRender('[data-gsearch]',t);}
 if(t.matches('[data-tfilter]')){ui.tfilter=t.value;keepFocusRender('[data-tfilter]',t);}
 if(t.matches('[data-pending]')&&pendingText){pendingText.text=t.value;
  const T=globalThis.EmberwildTextOverrides;if(T?.preview){const list=overrides().filter(x=>x.source!==pendingText.source);if(t.value&&t.value!==pendingText.source)list.push({source:pendingText.source,text:t.value});try{T.preview({version:1,entries:list});}catch{}}}
}

// ---------- 清單標示 ----------
// 以索引或代碼為鍵的資料（依職業分組的陣列、設定物件、背包圖示）改用職業名稱、中文鍵名或物品名稱顯示。
const SLOT_ZH=['武器','防具','副手','飾品'];
const KIND_ZH={equipment:'裝備',item:'道具',material:'素材',gem:'寶石',token:'信物',skill:'技能'};
function jobName(j){const c=draft.classes?.[j];return c?.name||('第 '+j+' 組');}
let itemNameCache=null;
function itemName(kind,key){
 if(!itemNameCache||itemNameCache.doc!==draft){itemNameCache={doc:draft,map:new Map()};try{for(const r of globalThis.EmberwildInventoryIcons.entries(draft))itemNameCache.map.set(r.kind+':'+r.key,r.baseName||r.name);}catch{}}
 return itemNameCache.map.get(kind+':'+key)||'';
}
function friendlyLabel(path,v){
 const k=path[path.length-1],parent=path.slice(0,-1),at=(...p)=>parent.length===p.length&&p.every((x,i)=>parent[i]===x);
 const n=a=>Array.isArray(a)?a.length:0;
 if(at('skillSystem','gems'))return gemLabel(v);
 if(at('skillSystem','classRules')&&v&&typeof v==='object')return jobName(v.job)+' · 技能規則（初始 '+n(v.initial)+'、進階 '+n(v.advanced)+'）';
 if(at('supportSkills'))return jobName(k)+' · 輔助技能 '+n(v)+' 筆';
 if(at('starterPacks'))return jobName(k)+' · 新手包 '+n(v)+' 件';
 if(at('equipmentForms')){const names=(v||[]).map((s,i)=>(SLOT_ZH[i]||'部位'+i)+' '+n(s));return (draft.classes?.[k]?jobName(k):'第 '+k+' 組（特殊／掉落）')+' · 裝備類型 '+names.join('、');}
 if(parent.length===2&&parent[0]==='equipmentForms')return jobName(parent[1])+' · '+(SLOT_ZH[k]||'部位 '+k)+' '+n(v)+' 種';
 if(at('inventoryIcons')&&v&&typeof v==='object'){const name=v.displayName||itemName(v.kind,String(v.key))||String(v.key);return (KIND_ZH[v.kind]||v.kind)+' · '+name+(v.displayName?'':' · '+v.key);}
 if(typeof k==='string'&&v&&typeof v==='object'){const zh=zhKey(k);if(zh&&zh!==k){const inner=labelOf(v,k);return zh+' · '+k+(inner&&inner!==k?' · '+inner:'');}}
 if(typeof k==='string'&&(v===null||typeof v!=='object')){const zh=zhKey(k);if(zh&&zh!==k)return zh+'：'+String(v).slice(0,40);}
 return '';
}
// ---------- 寶石 ----------
// skillSystem.gems 只有 5 種效果（kind 0～4），各 3 階數值；名稱、說明、顏色、圖示在 inventoryIcons 的 gem 列，
// 識別碼 = (階級-1)×5 + kind（與遊戲 GEMS 編號相同）。
const GEM_STAT={atk:'攻擊',attackSpeedPct:'攻擊速度',crit:'暴擊率',hp:'生命',def:'防禦'};
const GEM_UNIT={flat:'固定值',percent:'百分比（1＝1%）',ratio:'比例（0.01＝1%）'};
function gemRows(kind){const rows=Array.isArray(draft.inventoryIcons)?draft.inventoryIcons:[];return [0,1,2].map(t=>{const key=String(t*5+kind),i=rows.findIndex(r=>r.kind==='gem'&&String(r.key)===key);return {tier:t+1,key,index:i,row:rows[i]};});}
function gemValue(g,v){return g.base?.unit==='ratio'?Math.round(v*1000)/10+'%':g.base?.unit==='percent'?v+'%':String(v);}
function gemLabel(g){if(!g||typeof g!=='object')return '';const n=gemRows(g.kind)[0].row?.displayName||'';return (n?n.replace(/・?1階$/,'')+' · ':'')+(GEM_STAT[g.base?.stat]||g.base?.stat||'')+' '+(g.base?.values||[]).map(v=>'+'+gemValue(g,v)).join('／');}
function gemCard(path){
 const g=getAt(draft,path);if(!g||typeof g!=='object')return '';
 let h=`<div class="card"><b>寶石名稱與說明（3 階）</b><div class="hint">這是第 ${esc(g.kind)} 種寶石效果：${esc(GEM_STAT[g.base?.stat]||g.base?.stat)}，單位為${esc(GEM_UNIT[g.base?.unit]||g.base?.unit)}。下方「數值表」依序是 1、2、3 階的加成。名稱與說明存在「背包圖示」的寶石資料；改數值後說明不會自動更新，請一併修改。</div>`;
 for(const r of gemRows(g.kind)){
  const v=g.base?.values?.[r.tier-1];
  if(r.index<0){h+=`<div class="hint">${r.tier} 階（寶石 ${r.key}）：背包圖示中沒有這筆資料。</div>`;continue;}
  const fp=k=>esc(JSON.stringify(['inventoryIcons',r.index,k]));
  h+=`<div class="field"><label><span class="zh">${r.tier} 階名稱</span><span class="en">寶石 ${r.key} · 加成 +${esc(gemValue(g,v))}</span></label><input data-field="${fp('displayName')}" value="${esc(r.row.displayName||'')}"></div>`;
  h+=`<div class="field"><label><span class="zh">${r.tier} 階說明</span><span class="en">description</span></label><input data-field="${fp('description')}" value="${esc(r.row.description||'')}"></div>`;
  h+=`<div class="row" style="margin:2px 0 6px"><button class="fit mini" data-open="${esc(JSON.stringify(['inventoryIcons',r.index]))}">顏色、售價等完整資料</button><button class="fit mini" data-act="icon-design" data-focus="${esc(JSON.stringify({type:'item',kind:'gem',key:r.key}))}">🎨 設計圖示</button></div>`;
 }
 return h+'</div>';
}
// ---------- 圖示製作器 ----------
// 自製 SVG 圖示存在 draft.skillIcons；技能以 skillSystem.definitions[].iconType（及舊版 classes／supportSkills 對應列）、
// 道具與裝備以 inventoryIcons[].iconType 引用 'custom:<id>'。繪製一律使用遊戲的 __EMBERWILD_SKILL_ICONS，畫布與遊戲顯示相同。
const IM={id:'',layer:0,tool:'move',tone:'neutral',width:3,target:null,tsearch:'',lsearch:'',lcat:'all',lpage:0,error:''};
const IM_KIND={icon:'圖標',line:'直線',rect:'矩形',ellipse:'橢圓',arc:'圓弧',polygon:'多邊形',curve:'曲線'};
const IM_TONE={steel:'金屬',ember:'火',blood:'血液',frost:'冰',wind:'風',light:'光',shadow:'暗',arcane:'魔法',aim:'弓箭',neutral:'中性'};
const IM_CAT={all:'全部圖標',combat:'戰鬥與武器',defense:'防禦與護盾',magic:'魔法與元素',healing:'治療與輔助',characters:'角色與職業',equipment:'裝備與道具',status:'狀態效果',exploration:'地圖與探索',system:'系統與介面'};
const IM_TOOLS=[['move','移動'],['rotate','旋轉'],['fill','填色'],['erase','橡皮擦'],['line','畫直線'],['curve','畫曲線']];
const IM_GROUP={equipment:'裝備',item:'道具',material:'素材',gem:'寶石',token:'信物'};
const imLib=()=>globalThis.__EMBERWILD_SKILL_ICONS;
const imClamp=(n,a,b,f=0)=>Number.isFinite(n)?Math.max(a,Math.min(b,n)):f;
const imRound=n=>Math.round(n*2)/2;
const imIcons=()=>Array.isArray(draft.skillIcons)?draft.skillIcons:[];
const imCur=()=>imIcons().find(x=>x.id===IM.id);
function imNorm(l){const n=imLib().normalizeLayer(l);return n&&Object.fromEntries(Object.entries(n).filter(([,v])=>v!==undefined));}
function imLayer(kind,seed={}){
 const b={icon:{kind:'icon',icon:'sword',x:0,y:0,scale:1,rotation:0},line:{kind:'line',x:0,y:0,length:18,rotation:0,strokeWidth:2.7,tone:'neutral'},
  curve:{kind:'curve',x:0,y:0,x1:-12,y1:0,cx:0,cy:-16,x2:12,y2:0,rotation:0,strokeWidth:2.7,tone:'neutral'},
  rect:{kind:'rect',x:0,y:0,w:16,h:16,radius:2,rotation:0,strokeWidth:2.4,strokeTone:'neutral',filled:false,fillTone:'neutral'},
  ellipse:{kind:'ellipse',x:0,y:0,rx:8,ry:8,rotation:0,strokeWidth:2.4,strokeTone:'neutral',filled:false,fillTone:'neutral'},
  arc:{kind:'arc',x:0,y:0,r:10,start:-120,end:120,rotation:0,strokeWidth:2.4,tone:'neutral'},
  polygon:{kind:'polygon',x:0,y:0,points:'-6,-10 8,0 -6,10',scale:1,rotation:0,strokeWidth:2.4,strokeTone:'neutral',filled:true,fillTone:'neutral'}};
 return imNorm({...b[kind],...seed});
}
function imPreset(key){
 const E=imLayer,name=(imLib().labels[key]||key)+' 範本';
 if(key==='sword')return {name,layers:[E('polygon',{points:'0,-18 4,-13 2,9 0,18 -2,9 -4,-13',y:-2,rotation:-25,strokeTone:'steel',fillTone:'steel',strokeWidth:1.3}),E('line',{y:12,length:10,rotation:65,strokeWidth:2.5,tone:'steel'}),E('line',{x:-4,y:17,length:7,rotation:-25,strokeWidth:2.3,tone:'steel'})]};
 if(key==='axe')return {name,layers:[E('line',{x:-1,y:2,length:30,rotation:18,strokeWidth:3.1,tone:'steel'}),E('polygon',{points:'-8,-8 4,-11 9,-4 8,3 2,8 -6,7 -10,0',x:7,y:-8,rotation:16,strokeTone:'steel',fillTone:'steel',strokeWidth:1.4}),E('line',{x:-7,y:16,length:6,rotation:18,strokeWidth:2.2,tone:'steel'})]};
 if(key==='hammer')return {name,layers:[E('rect',{y:-10,w:25,h:12,radius:1,strokeTone:'steel'}),E('line',{y:10,length:24,rotation:90,strokeWidth:3,tone:'steel'}),E('line',{y:20,length:7,strokeWidth:2.2,tone:'steel'})]};
 if(key==='fire')return {name,layers:[E('polygon',{points:'0,-18 7,-8 10,1 7,11 0,18 -6,11 -10,2 -6,-8',strokeTone:'ember',fillTone:'ember',strokeWidth:1.4}),E('polygon',{points:'0,-10 5,-3 4,5 0,11 -4,5 -5,-3',x:2,y:6,rotation:-10,strokeTone:'ember',filled:false,fillTone:'ember',strokeWidth:1.5})]};
 return null;
}
function imCheck(list){
 const L=imLib(),kinds=new Set(L.shapeKinds||Object.keys(IM_KIND)),seen=new Set();
 if(list.length>100)return '自訂圖示最多 100 個';
 for(const ic of list){
  if(!/^[-_a-z0-9]{1,40}$/.test(ic.id||'')||seen.has(ic.id))return '圖示 ID 無效或重複：'+ic.id;seen.add(ic.id);
  if(!String(ic.name||'').trim()||ic.name.length>40)return '圖示名稱需為 1～40 字';
  if(!Array.isArray(ic.layers)||!ic.layers.length||ic.layers.length>8)return '「'+ic.name+'」圖層需為 1～8 層';
  for(const [j,l] of ic.layers.entries())if(!L.normalizeLayer(l)||!kinds.has(l.kind)||!L.validEditing(l))return '「'+ic.name+'」第 '+(j+1)+' 層無效';
  if(ic.appearance!==undefined&&!L.validAppearance(ic.appearance))return '「'+ic.name+'」外觀無效';
 }
 return '';
}
// 所有圖示修改都經過 commit：進入復原歷史、草稿與變更清單，並立即套用到遊戲。
function imEdit(mutator,label){
 const before=JSON.stringify(draft.skillIcons);
 const trial=clone(imIcons());mutator(trial);
 const err=imCheck(trial);if(err){IM.error='無法儲存：'+err;renderPanel.keepScroll=true;renderPanel();return false;}
 if(JSON.stringify(trial)===before){renderPanel.keepScroll=true;renderPanel();return true;}
 IM.error='';commit(()=>{draft.skillIcons=trial;},{label});
 if(ui.auto)applyDraft();renderPanel.keepScroll=true;renderPanel();return true;
}
function imNextId(list=imIcons()){let n=1;while(list.some(x=>x.id==='icon_'+n))n++;return 'icon_'+n;}
function imCreate(seed){
 if(imIcons().length>=100){IM.error='最多可建立 100 個自訂圖示。';renderPanel();return;}
 const id=imNextId();
 if(imEdit(list=>list.push({id,name:seed?.name||'新圖示',layers:seed?.layers||[imLayer('icon',{icon:'sword'})],...(seed?.appearance?{appearance:seed.appearance}:{})}),'新增圖示')){IM.id=id;IM.layer=0;renderPanel();}
}
function imEditCur(fn,label){const id=IM.id;return imEdit(list=>{const ic=list.find(x=>x.id===id);if(ic)fn(ic);},label);}
function imTargets(){
 const skills=(draft.skillSystem?.definitions||[]).map((s,i)=>s&&!s.deleted?{type:'skill',id:s.id,index:i,name:s.name||s.id,group:'技能',iconType:s.iconType||'auto',fallback:'magic'}:null).filter(Boolean);
 let items=[];try{const M=globalThis.EmberwildInventoryIcons,rows=Array.isArray(draft.inventoryIcons)?draft.inventoryIcons:[];
  items=M.entries(draft).filter(r=>r.kind!=='skill').map(r=>({type:'item',kind:r.kind,key:String(r.key),name:r.name||r.key,group:IM_GROUP[r.kind]||r.kind,fallback:r.fallback||'magic',iconType:rows.find(x=>x.kind===r.kind&&String(x.key)===String(r.key))?.iconType||'auto'}));}catch(e){console.warn('[即時平衡器] 無法列出道具',e);}
 return skills.concat(items);
}
const imSame=(a,b)=>!!a&&!!b&&a.type===b.type&&(a.type==='skill'?a.id===b.id:a.kind===b.kind&&String(a.key)===String(b.key));
function imAssign(t,type){
 const L=imLib();
 if(!(type==='auto'||L.validReference(type)||type.startsWith('custom:')&&imIcons().some(x=>x.id===type.slice(7)))){IM.error='圖示不存在：'+type;return renderPanel();}
 commit(()=>imWrite(draft,t,type),{label:'套用圖示'});
 IM.target={...t,iconType:type};IM.error='';if(ui.auto)applyDraft();
 setStatus(lastStatus.ok,(type==='auto'?'已改回自動圖示：':'已套用圖示至 ')+t.name+(lastStatus.ok?'，已套用到遊戲':''));renderPanel.keepScroll=true;renderPanel();
}
function imWrite(doc,t,type){
 if(t.type==='skill'){
  const s=(doc.skillSystem?.definitions||[]).find(x=>x.id===t.id);if(!s)return;s.iconType=type;
  const a=s.adapter,row=a?.kind==='core'?doc.classes?.[a.job]?.skills?.[a.index]:a?.kind==='support'?doc.supportSkills?.[a.job]?.[a.index]:null;if(row)row.iconType=type;
 }else{
  if(!Array.isArray(doc.inventoryIcons))doc.inventoryIcons=[];
  const row=doc.inventoryIcons.find(x=>x.kind===t.kind&&String(x.key)===String(t.key));
  if(row)row.iconType=type;else doc.inventoryIcons.push({kind:t.kind,key:t.kind==='gem'?Number(t.key):t.key,iconType:type});
 }
}
function imDelete(){
 const ic=imCur();if(!ic)return;const type='custom:'+ic.id,users=imTargets().filter(t=>t.iconType===type);
 commit(()=>{for(const t of users)imWrite(draft,t,'auto');for(const cls of draft.classes||[])for(const sk of cls.skills||[])if(sk.iconType===type)sk.iconType='auto';for(const g of draft.supportSkills||[])for(const sk of g||[])if(sk.iconType===type)sk.iconType='auto';draft.skillIcons=imIcons().filter(x=>x.id!==ic.id);},{label:'刪除圖示'});
 IM.id=imIcons()[0]?.id||'';IM.layer=0;IM.confirm=false;if(IM.target)IM.target=imTargets().find(t=>imSame(t,IM.target))||null;
 if(ui.auto)applyDraft();setStatus(lastStatus.ok,'已刪除圖示「'+ic.name+'」'+(users.length?'，'+users.length+' 個項目改回自動圖示':''));renderPanel();
}
// 從資料頁或外部開啟：focus 為 {type:'skill',id} 或 {type:'item',kind,key}
// 資料頁目前開啟的資料若有圖示，回傳圖示製作器的對象
function imFocusFor(path){
 if(!Array.isArray(path)||path.length!==3)return null;
 if(path[0]==='skillSystem'&&path[1]==='definitions'){const s=getAt(draft,path);return s?.id?{type:'skill',id:s.id}:null;}
 if(path[0]==='inventoryIcons'){const r=getAt(draft,path);return r?.kind&&r.kind!=='skill'?{type:'item',kind:r.kind,key:String(r.key)}:null;}
 return null;
}
function openIconMaker(focus){
 ui.open=true;ui.tab='icons';IM.error='';
 if(focus){IM.target=imTargets().find(t=>imSame(t,focus))||null;const cur=IM.target?.iconType;if(cur?.startsWith('custom:')&&imIcons().some(x=>x.id===cur.slice(7)))IM.id=cur.slice(7);}
 renderPanel();
}
const imTones=(sel,blank)=>[...(blank?[['','預設']]:[]),...Object.keys(imLib().colors).map(k=>[k,IM_TONE[k]||k])].map(([v,n])=>`<option value="${v}" ${sel===v?'selected':''}>${esc(n)}</option>`).join('');
const imNum=(k,label,min,max,step,v)=>`<label>${label}<input type="number" data-im-lf="${k}" min="${min}" max="${max}" step="${step}" value="${esc(v)}"></label>`;
function imLayerFields(l){
 const L=imLib(),pos=imNum('x','水平 X',-24,24,.5,l.x)+imNum('y','垂直 Y',-24,24,.5,l.y),rot=imNum('rotation','旋轉',-180,180,1,l.rotation||0),sw=imNum('strokeWidth','線粗',.4,10,.1,l.strokeWidth);
 const head=`<label>類型<select data-im-lf="kind">${Object.entries(IM_KIND).map(([v,n])=>`<option value="${v}" ${l.kind===v?'selected':''}>${n}</option>`).join('')}</select></label>`;
 const closed=`<label>描邊色<select data-im-lf="strokeTone">${imTones(l.strokeTone||'neutral')}</select></label><label class="ck"><input type="checkbox" data-im-lf="filled" ${l.filled?'checked':''}>填色</label><label>填滿色<select data-im-lf="fillTone">${imTones(l.fillTone||l.strokeTone||'neutral')}</select></label>`;
 const tone=`<label>色調<select data-im-lf="tone">${imTones(l.tone||'neutral')}</select></label>`;
 if(l.kind==='icon')return head+`<label>圖案<select data-im-lf="icon"><option value="none" ${l.icon==='none'?'selected':''}>未選擇</option>${L.keys.map(k=>`<option value="${k}" ${l.icon===k?'selected':''}>${esc(L.labels[k]||k)}</option>`).join('')}${L.isLucideReference(l.icon)?`<option selected value="${esc(l.icon)}">${esc(l.icon)}</option>`:''}</select></label>`+pos+imNum('scale','比例',.25,2.5,.05,l.scale)+rot+`<label>色調<select data-im-lf="tone">${imTones(l.tone||'',true)}</select></label>`;
 if(l.kind==='line')return head+pos+imNum('length','長度',2,64,.5,l.length)+rot+sw+tone;
 if(l.kind==='curve')return head+pos+imNum('x1','起點 X',-48,48,.5,l.x1)+imNum('y1','起點 Y',-48,48,.5,l.y1)+imNum('cx','控制點 X',-48,48,.5,l.cx)+imNum('cy','控制點 Y',-48,48,.5,l.cy)+imNum('x2','終點 X',-48,48,.5,l.x2)+imNum('y2','終點 Y',-48,48,.5,l.y2)+rot+sw+tone;
 if(l.kind==='rect')return head+pos+imNum('w','寬度',1,64,.5,l.w)+imNum('h','高度',1,64,.5,l.h)+imNum('radius','圓角',0,24,.5,l.radius)+rot+sw+closed;
 if(l.kind==='ellipse')return head+pos+imNum('rx','半徑 X',.5,32,.5,l.rx)+imNum('ry','半徑 Y',.5,32,.5,l.ry)+rot+sw+closed;
 if(l.kind==='arc')return head+pos+imNum('r','半徑',.5,32,.5,l.r)+imNum('start','起始角',-360,360,1,l.start)+imNum('end','結束角',-360,360,1,l.end)+rot+sw+tone;
 return head+pos+imNum('scale','比例',.2,4,.05,l.scale)+rot+sw+closed+`<label class="wide">點位（x,y 以空白分隔）<input type="text" data-im-lf="points" value="${esc(l.points)}"></label>`;
}
function imAppearance(ic){
 const L=imLib(),a=L.normalizeAppearance(ic.appearance??{}),n=(k,label,min,max,step)=>`<label>${label}<input type="number" data-im-ap="${k}" min="${min}" max="${max}" step="${step}" value="${a[k]}"></label>`;
 return `<label class="ck"><input type="checkbox" data-im-coloron ${a.color?'checked':''}>自訂圖標顏色</label><label>圖標顏色<input type="color" data-im-ap="color" value="${a.color||'#d8ded5'}" ${a.color?'':'disabled'}></label>${n('size','尺寸（px）',8,128,1)}${n('strokeWidth','線條粗細',.4,10,.1)}${n('rotation','整體旋轉',-180,180,1)}${n('opacity','透明度',0,1,.05)}<label>發光顏色<input type="color" data-im-ap="glowColor" value="${a.glowColor}"></label>${n('glowStrength','發光強度',0,24,.5)}<label>動畫<select data-im-ap="effect">${Object.entries(L.effects).map(([k,e])=>`<option value="${k}" ${a.effect===k?'selected':''}>${esc(e.label)}</option>`).join('')}</select></label>${n('effectDuration','動畫週期（秒）',.15,30,.05)}<label>節奏<select data-im-ap="effectTiming">${[['linear','等速'],['ease','緩動'],['ease-in-out','平滑'],['steps(1,end)','分段']].map(([k,t])=>`<option value="${k}" ${a.effectTiming===k?'selected':''} ${k==='steps(1,end)'&&['spin','hue'].includes(a.effect)?'disabled':''}>${t}</option>`).join('')}</select></label>`;
}
function imToCanvas(l,px,py){const r=(l.rotation||0)*Math.PI/180,c=Math.cos(r),s=Math.sin(r);return [24+l.x+px*c-py*s,24+l.y+px*s+py*c];}
function imToLocal(l,x,y){const dx=x-24-l.x,dy=y-24-l.y,r=-(l.rotation||0)*Math.PI/180,c=Math.cos(r),s=Math.sin(r),k=l.scale||1;return [(dx*c-dy*s)/k,(dx*s+dy*c)/k];}
function imCanvas(ic){
 const L=imLib(),l=imNorm(ic.layers[IM.layer]);
 const layers=ic.layers.map((x,i)=>`<g data-im-cl="${i}" opacity="${i===IM.layer?1:.55}">${L.layerMarkup(x)}</g>`).join('');
 let box='';try{const b=L.layerBounds(l);if(b)box=`<rect x="${b.x-1}" y="${b.y-1}" width="${b.w+2}" height="${b.h+2}" fill="none" stroke="#58a6ff" stroke-width=".35" stroke-dasharray="1 1" pointer-events="none"/>`;}catch{}
 let handle='';if(l?.kind==='curve'){const p=imToCanvas(l,l.cx,l.cy),s=imToCanvas(l,l.x1,l.y1);handle=`<line x1="${s[0]}" y1="${s[1]}" x2="${p[0]}" y2="${p[1]}" stroke="#58a6ff" stroke-width=".3" pointer-events="none"/><circle data-im-handle cx="${p[0]}" cy="${p[1]}" r="1.6" fill="#58a6ff"/>`;}
 const grid=Array.from({length:7},(_,i)=>`<line x1="${i*8}" y1="0" x2="${i*8}" y2="48"/><line x1="0" y1="${i*8}" x2="48" y2="${i*8}"/>`).join('');
 return `<svg data-im-canvas viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.7" stroke-linecap="round" stroke-linejoin="round"><g stroke="#ffffff14" stroke-width=".15">${grid}</g><g>${layers}</g>${box}${handle}<g data-im-draft></g></svg>`;
}
function imTargetList(){
 const all=imTargets(),q=IM.tsearch.trim().toLowerCase(),hits=all.filter(r=>!q||String(r.name).toLowerCase().includes(q)||r.group.includes(q)).slice(0,40);
 IM.hits=hits;const using=all.filter(r=>r.iconType==='custom:'+IM.id),t=IM.target&&all.find(r=>imSame(r,IM.target));IM.target=t||null;
 const svg=r=>imLib().svgFor(!r.iconType||r.iconType==='auto'?r.fallback:r.iconType,imIcons(),{size:20,animate:false});
 return `<div class="hint" style="margin:0">目前對象：<b data-im-target-label>${t?esc(t.group+' · '+t.name):'未選擇'}</b> ${t?`<span class="im-mini">${svg(t)}</span>`:''}</div>
 <div class="row"><button class="fit primary" data-im-act="assign" ${t&&imCur()?'':'disabled'}>套用目前圖示</button><button class="fit" data-im-act="unassign" ${t&&t.iconType!=='auto'?'':'disabled'}>改回自動圖示</button></div>
 <input data-im-tsearch placeholder="搜尋技能、裝備或道具（名稱或分類）" value="${esc(IM.tsearch)}">
 <div class="im-targets">${hits.map((r,i)=>`<button data-im-target="${i}" class="${t&&imSame(r,t)?'on':''}"><span class="im-mini">${svg(r)}</span>${esc(r.group)} · ${esc(r.name)}</button>`).join('')||'<div class="hint">沒有符合的項目。</div>'}</div>
 ${imCur()?`<div class="hint">使用此圖示：${using.length?using.map(r=>esc(r.group+' · '+r.name)).join('、'):'無'}</div>`:''}`;
}
function imLucide(){
 const lib=globalThis.__EMBERWILD_LUCIDE;if(!lib)return '<div class="hint">Lucide 圖庫尚未載入。</div>';
 const names=(IM.lcat==='all'?lib.names:lib.categories?.[IM.lcat]||[]).filter(n=>n.includes(IM.lsearch.trim().toLowerCase())),pages=Math.max(1,Math.ceil(names.length/40));IM.lpage=imClamp(IM.lpage,0,pages-1);
 const sel=imCur()?.layers[IM.layer]?.icon;
 return `<div class="row"><input data-im-lsearch placeholder="英文名稱：flame, shield…" value="${esc(IM.lsearch)}"><select class="fit" style="width:auto" data-im-lcat>${Object.entries(IM_CAT).map(([k,n])=>`<option value="${k}" ${IM.lcat===k?'selected':''}>${n}</option>`).join('')}</select></div>
 <div class="im-lucide">${names.slice(IM.lpage*40,IM.lpage*40+40).map(n=>`<button data-im-lucide="${n}" title="${n}" class="${sel==='lucide:'+n?'on':''}">${imLib().svgFor('lucide:'+n,[],{size:22,animate:false})}<span>${n}</span></button>`).join('')||'<div class="hint">找不到圖標。</div>'}</div>
 <div class="row"><button class="fit" data-im-act="lprev" ${IM.lpage?'':'disabled'}>上一頁</button><span class="hint" style="margin:0">${names.length} 個 · 第 ${IM.lpage+1}／${pages} 頁</span><button class="fit" data-im-act="lnext" ${IM.lpage>=pages-1?'disabled':''}>下一頁</button></div>`;
}
function renderIcons(){
 const L=imLib();if(!L)return '<div class="hint">遊戲的圖示程式庫尚未載入。</div>';
 const list=imIcons();if(!list.some(x=>x.id===IM.id))IM.id=list[0]?.id||'';
 const ic=imCur();if(ic)IM.layer=imClamp(IM.layer,0,ic.layers.length-1);
 let h=`<div class="hint">繪製技能、裝備、道具的 SVG 圖示。修改會寫入草稿、列入變更並立即套用到遊戲，匯出 JSON／模組檔時一併輸出（<code>skillIcons</code>）。</div>`;
 if(IM.error)h+=`<div class="card warn" data-im-error>${esc(IM.error)}</div>`;
 h+=`<div class="im-layout"><div class="im-side"><div class="sec" style="margin-top:0">自製圖示 ${list.length}/100</div>
 <div class="row"><button data-im-act="new">新增空白</button><button data-im-act="example">範例：劍＋血滴</button></div>
 <div class="row"><select data-im-seed>${L.keys.map(k=>`<option value="${k}">${esc(L.labels[k]||k)}</option>`).join('')}</select></div>
 <div class="row"><button data-im-act="copy-builtin">複製內建</button><button data-im-act="preset">可編輯範本</button></div>
 <div class="im-list">${list.map(x=>`<button data-im-icon="${esc(x.id)}" class="${x.id===IM.id?'on':''}">${L.svgFor('custom:'+x.id,list,{size:28,animate:false})}<span>${esc(x.name)}<small>${esc(x.id)}</small></span></button>`).join('')||'<div class="hint">尚未製作圖示。</div>'}</div></div><div class="im-main">`;
 if(ic){
  h+=`<div class="row"><input data-im-name maxlength="40" value="${esc(ic.name)}" aria-label="圖示名稱"><button class="fit" data-im-act="dup">複製圖示</button><button class="fit danger" data-im-act="delete">${IM.confirm?'確認刪除':'刪除圖示'}</button></div>`;
  if(IM.confirm)h+=`<div class="card warn">刪除「${esc(ic.name)}」？使用此圖示的技能與道具會改回自動圖示。再按一次「確認刪除」。</div>`;
  h+=`<div class="im-tools">${IM_TOOLS.map(([k,n])=>`<button data-im-tool="${k}" class="${IM.tool===k?'on':''}">${n}</button>`).join('')}<label>筆刷色調<select data-im-brushtone>${imTones(IM.tone)}</select></label><label>筆寬<input type="number" data-im-brushwidth min="0.4" max="10" step="0.2" value="${IM.width}"></label></div>
  <div class="im-work"><div><div class="im-canvas">${imCanvas(ic)}</div><div class="hint">移動：拖曳選取圖層，點其他圖層可切換。旋轉：繞中心拖曳。填色：封閉圖形填滿、線條改色。橡皮擦：只擦選取圖層。畫直線／曲線：拖出起終點，曲線可再拖藍點調整彎曲。復原用下方 ↶。</div>
  <div class="im-preview">${[96,48,24].map(s=>`<div>${L.svgFor('custom:'+ic.id,list,{size:s})}<small>${s}px</small></div>`).join('')}</div></div>
  <div><div class="hint" style="margin-top:0">圖層 ${ic.layers.length}/8，由後到前繪製。</div>${ic.layers.map((raw,i)=>{const l=imNorm(raw);return `<div class="im-layer ${i===IM.layer?'on':''}" data-im-layer="${i}"><div class="im-lh"><b>第 ${i+1} 層 · ${IM_KIND[l.kind]||l.kind}${l.kind==='icon'?' / '+esc(L.labels[l.icon]||l.icon):''}${l.eraseStrokes?.length?' · 擦除 '+l.eraseStrokes.length:''}</b><button class="mini" data-im-move="-1" data-i="${i}" ${i?'':'disabled'}>↑</button><button class="mini" data-im-move="1" data-i="${i}" ${i<ic.layers.length-1?'':'disabled'}>↓</button><button class="mini" data-im-dupl="${i}" ${ic.layers.length>=8?'disabled':''}>複製</button><button class="mini danger" data-im-dell="${i}" ${ic.layers.length>1?'':'disabled'}>刪</button></div>${i===IM.layer?`<div class="im-fields">${imLayerFields(l)}${l.eraseStrokes?.length?'<button class="mini" data-im-act="clear-erase">清除擦除</button>':''}</div>`:''}</div>`;}).join('')}
  <div class="im-pal">${['line','curve','rect','ellipse','arc','polygon'].map(k=>`<button class="mini" data-im-add="${k}" ${ic.layers.length>=8?'disabled':''}>＋${IM_KIND[k]}</button>`).join('')}<select data-im-addicon ${ic.layers.length>=8?'disabled':''}><option value="">＋內建圖示…</option>${L.keys.map(k=>`<option value="${k}">${esc(L.labels[k]||k)}</option>`).join('')}</select></div></div></div>
  <details><summary>整體外觀與動畫</summary><div class="im-fields">${imAppearance(ic)}</div></details>`;
 }else h+=`<div class="card">請新增圖示，或在下方 Lucide 圖庫點選圖標建立。</div>`;
 h+=`<div class="sec">套用至技能／裝備／道具</div>${imTargetList()}<div class="sec">Lucide SVG 圖庫</div><div class="hint" style="margin:0 0 4px">點選即套用至目前圖層；尚無圖示時自動建立。</div>${imLucide()}</div></div>`;
 return h;
}
const IM_CSS=`.im-layout{display:grid;grid-template-columns:190px minmax(0,1fr);gap:10px}.im-list{display:flex;flex-direction:column;gap:3px;max-height:60vh;overflow:auto}.im-list button,.im-targets button{display:flex;gap:6px;align-items:center;text-align:left}.im-list span{display:flex;flex-direction:column;font-size:12px}.im-list small{color:#a99cc4;font-size:10px}.im-list svg{color:#e3d9bd}
.im-tools{display:flex;flex-wrap:wrap;gap:4px;align-items:end;margin-bottom:6px}.im-tools label{display:flex;flex-direction:column;font-size:11px;color:#a99cc4}.im-tools input{width:64px}.im-tools select{width:auto}
.im-work{display:grid;grid-template-columns:minmax(200px,290px) minmax(0,1fr);gap:10px}.im-canvas svg{width:100%;aspect-ratio:1;display:block;background:repeating-conic-gradient(#ffffff08 0 25%,transparent 0 50%) 0 0/12.5% 12.5%,#120e1b;border:1px solid #4a3d66;border-radius:8px;color:#e3d9bd;touch-action:none;cursor:crosshair}
.im-preview{display:flex;gap:12px;align-items:flex-end;color:#e3d9bd}.im-preview div{display:flex;flex-direction:column;align-items:center}.im-preview small{color:#a99cc4;font-size:10px}
.im-layer{border:1px solid #3a2e55;border-radius:6px;padding:4px 6px;margin-bottom:4px;cursor:pointer}.im-layer.on{border-color:#f5b942}.im-lh{display:flex;gap:3px;align-items:center}.im-lh b{flex:1;font-size:12px;font-weight:600}
.im-fields{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px 6px;margin-top:4px}.im-fields label{display:flex;flex-direction:column;font-size:11px;color:#a99cc4}.im-fields label.ck{flex-direction:row;align-items:center;gap:4px}.im-fields .wide{grid-column:1/-1}.im-fields input[type=color]{height:28px;padding:1px}
.im-pal{display:flex;flex-wrap:wrap;gap:3px;margin-top:4px}.im-pal select{width:auto;font-size:11px;padding:1px 4px}
.im-targets{display:flex;flex-direction:column;gap:2px;max-height:180px;overflow:auto;margin:4px 0}.im-targets button{font-size:12px;padding:2px 6px}.im-mini{color:#e3d9bd;display:inline-flex;vertical-align:middle}
.im-lucide{display:grid;grid-template-columns:repeat(auto-fill,minmax(64px,1fr));gap:3px;max-height:260px;overflow:auto}.im-lucide button{display:flex;flex-direction:column;align-items:center;gap:2px;font-size:9px;padding:4px 2px;overflow-wrap:anywhere;color:#dde6ef}
@media(max-width:760px){.im-layout,.im-work{grid-template-columns:1fr}.im-list{max-height:160px}.im-fields{grid-template-columns:repeat(2,minmax(0,1fr))}}`;
// 動畫關鍵影格來自遊戲頁面的樣式表；shadow DOM 內需另外複製一份。
function imKeyframes(){
 if(imKeyframes.css!=null)return imKeyframes.css;let css='';
 for(const sheet of document.styleSheets){let rules;try{rules=sheet.cssRules;}catch{continue;}for(const r of rules||[]){if(r.type===CSSRule.KEYFRAMES_RULE&&/^(tr-|ew-icon)/.test(r.name))css+=r.cssText+'\n';else if(r.selectorText&&/emberwild-icon|ew-icon-/.test(r.selectorText))css+=r.cssText+'\n';}}
 return imKeyframes.css=css;
}
function imBind(){
 const q=s=>root.querySelector(s),all=s=>[...root.querySelectorAll(s)],ic=imCur();
 if(!q('style[data-im]')){const st=document.createElement('style');st.dataset.im='';st.textContent=IM_CSS+imKeyframes();root.prepend(st);}
 const act=(name,fn)=>{for(const b of all(`[data-im-act="${name}"]`))b.onclick=fn;};
 act('new',()=>imCreate(null));
 act('example',()=>imCreate({name:'劍與血滴',layers:[imLayer('icon',{icon:'sword',x:-5,y:-4,scale:.8}),imLayer('icon',{icon:'blood',x:14,y:13,scale:.48,tone:'blood'})]}));
 act('copy-builtin',()=>{const k=q('[data-im-seed]').value;imCreate({name:(imLib().labels[k]||k)+' 副本',layers:[imLayer('icon',{icon:k})]});});
 act('preset',()=>{const k=q('[data-im-seed]').value,p=imPreset(k);if(p)return imCreate(p);imCreate({name:(imLib().labels[k]||k)+' 副本',layers:[imLayer('icon',{icon:k})]});IM.error='「'+(imLib().labels[k]||k)+'」沒有可編輯範本（劍、斧、槌、火有範本），已改為複製內建圖示。';renderPanel();});
 act('lprev',()=>{IM.lpage--;renderPanel.keepScroll=true;renderPanel();});act('lnext',()=>{IM.lpage++;renderPanel.keepScroll=true;renderPanel();});
 act('assign',()=>IM.target&&imAssign(IM.target,'custom:'+IM.id));act('unassign',()=>IM.target&&imAssign(IM.target,'auto'));
 for(const b of all('[data-im-icon]'))b.onclick=()=>{IM.id=b.dataset.imIcon;IM.layer=0;IM.confirm=false;renderPanel.keepScroll=true;renderPanel();};
 for(const b of all('[data-im-target]'))b.onclick=()=>{IM.target=IM.hits[Number(b.dataset.imTarget)];renderPanel.keepScroll=true;renderPanel();};
 const live=(sel,key,after)=>{const el=q(sel);if(el)el.oninput=()=>{IM[key]=el.value;if(key==='lsearch')IM.lpage=0;const pos=el.selectionStart;renderPanel.keepScroll=true;renderPanel();const n=q(sel);if(n){n.focus();n.setSelectionRange(pos,pos);}};};
 live('[data-im-tsearch]','tsearch');live('[data-im-lsearch]','lsearch');
 const lc=q('[data-im-lcat]');if(lc)lc.onchange=()=>{IM.lcat=lc.value;IM.lpage=0;renderPanel.keepScroll=true;renderPanel();};
 for(const b of all('[data-im-lucide]'))b.onclick=()=>{const name='lucide:'+b.dataset.imLucide;
  if(!imCur())return imCreate({name:b.dataset.imLucide,layers:[imLayer('icon',{icon:name})],appearance:imLib().normalizeAppearance()});
  const i=IM.layer;imEditCur(c=>{const l=imNorm(c.layers[i]);c.layers[i]=imLayer('icon',{x:l.x,y:l.y,scale:l.scale??1,rotation:l.rotation||0,icon:name});c.appearance??=imLib().normalizeAppearance();},'套用 Lucide 圖標');};
 if(!ic)return;
 const name=q('[data-im-name]');name.onchange=()=>{const v=name.value.trim();if(!v){IM.error='圖示名稱不可空白';return renderPanel();}imEditCur(c=>{c.name=v.slice(0,40);},'圖示名稱');};
 act('dup',()=>{if(imIcons().length>=100){IM.error='最多可建立 100 個自訂圖示。';return renderPanel();}const id=imNextId(),src=ic;if(imEdit(list=>{const c=clone(src);c.id=id;c.name=(src.name+' 複製').slice(0,40);list.push(c);},'複製圖示')){IM.id=id;renderPanel();}});
 act('delete',()=>{if(!IM.confirm){IM.confirm=true;return renderPanel();}imDelete();});
 act('clear-erase',()=>{const i=IM.layer;imEditCur(c=>{const l=imNorm(c.layers[i]);delete l.eraseStrokes;c.layers[i]=imNorm(l);},'清除擦除');});
 for(const b of all('[data-im-tool]'))b.onclick=()=>{IM.tool=b.dataset.imTool;renderPanel.keepScroll=true;renderPanel();};
 q('[data-im-brushtone]').onchange=e=>{IM.tone=e.target.value;};q('[data-im-brushwidth]').onchange=e=>{IM.width=imClamp(Number(e.target.value),.4,10,3);};
 const co=q('[data-im-coloron]');if(co)co.onchange=()=>imEditCur(c=>{const a=imLib().normalizeAppearance(c.appearance??{});a.color=co.checked?'#d8ded5':'';c.appearance=a;},'圖示外觀');
 for(const el of all('[data-im-ap]'))el.onchange=()=>{const k=el.dataset.imAp;imEditCur(c=>{const L=imLib(),a=L.normalizeAppearance(c.appearance??{});a[k]=['color','glowColor','effect','effectTiming'].includes(k)?el.value:Number(el.value);if(k==='effect'&&L.effects[el.value]){a.effectDuration=L.effects[el.value].duration;a.effectTiming=L.effects[el.value].timing;}c.appearance=L.normalizeAppearance(a);},'圖示外觀');};
 for(const row of all('[data-im-layer]'))row.onclick=e=>{if(e.composedPath().some(n=>n!==row&&n instanceof Element&&n.closest?.('[data-im-layer]')===row&&/^(INPUT|SELECT|BUTTON|LABEL|OPTION)$/.test(n.tagName)))return;IM.layer=Number(row.dataset.imLayer);renderPanel.keepScroll=true;renderPanel();};
 for(const b of all('[data-im-move]'))b.onclick=()=>{const i=Number(b.dataset.i),j=i+Number(b.dataset.imMove);if(imEditCur(c=>{[c.layers[i],c.layers[j]]=[c.layers[j],c.layers[i]];},'圖層順序'))IM.layer=j,renderPanel();};
 for(const b of all('[data-im-dupl]'))b.onclick=()=>{const i=Number(b.dataset.imDupl);if(imEditCur(c=>{c.layers.splice(i+1,0,clone(c.layers[i]));},'複製圖層'))IM.layer=i+1,renderPanel();};
 for(const b of all('[data-im-dell]'))b.onclick=()=>{const i=Number(b.dataset.imDell);if(imEditCur(c=>{c.layers.splice(i,1);},'刪除圖層'))IM.layer=Math.max(0,Math.min(IM.layer,ic.layers.length-2)),renderPanel();};
 const add=layer=>{if(imEditCur(c=>{c.layers.push(layer);},'加入圖層'))IM.layer=imCur().layers.length-1,renderPanel();};
 for(const b of all('[data-im-add]'))b.onclick=()=>{const k=b.dataset.imAdd;add(imLayer(k,['line','curve','arc'].includes(k)?{tone:IM.tone}:{strokeTone:IM.tone,fillTone:IM.tone}));};
 q('[data-im-addicon]').onchange=e=>{if(e.target.value)add(imLayer('icon',{icon:e.target.value,scale:.6}));};
 for(const el of all('[data-im-lf]'))el.onchange=()=>{const k=el.dataset.imLf,i=IM.layer;imEditCur(c=>{const l=imNorm(c.layers[i]);
  if(k==='kind'){c.layers[i]=imLayer(el.value,{x:l.x||0,y:l.y||0});return;}
  if(k==='icon'){if(imLib().validReference(el.value))l.icon=el.value;}
  else if(['tone','strokeTone','fillTone'].includes(k)){if(el.value)l[k]=el.value;else delete l[k];}
  else if(k==='filled')l.filled=el.checked;else if(k==='points')l.points=el.value;else l[k]=Number(el.value);
  c.layers[i]=imNorm(l);},'圖層');};
 imBindCanvas(ic);
}
function imBindCanvas(ic){
 const svg=root.querySelector('[data-im-canvas]');if(!svg)return;let drag=null;
 const pt=e=>{const r=svg.getBoundingClientRect();return [imClamp((e.clientX-r.left)/r.width*48,-8,56),imClamp((e.clientY-r.top)/r.height*48,-8,56)];};
 const local=()=>imNorm(imCur().layers[IM.layer]);
 const redraw=l=>{const c=imCur();c.layers[IM.layer]=imNorm(l);const g=svg.querySelector('g:nth-of-type(2)');const L=imLib();if(g)g.innerHTML=c.layers.map((x,i)=>`<g data-im-cl="${i}" opacity="${i===IM.layer?1:.55}">${L.layerMarkup(x)}</g>`).join('');};
 const draftG=()=>svg.querySelector('[data-im-draft]');
 svg.onpointerdown=e=>{
  const p=pt(e);svg.setPointerCapture?.(e.pointerId);const l=local();
  const hit=e.composedPath().find(n=>n instanceof Element&&n.hasAttribute?.('data-im-cl'));
  if(e.target.hasAttribute?.('data-im-handle')){drag={type:'handle',l,orig:clone(imCur().layers[IM.layer])};return;}
  if(IM.tool==='move'&&hit&&Number(hit.getAttribute('data-im-cl'))!==IM.layer){IM.layer=Number(hit.getAttribute('data-im-cl'));renderPanel.keepScroll=true;renderPanel();return;}
  const orig=clone(imCur().layers[IM.layer]);
  if(IM.tool==='move')drag={type:'move',l,orig,start:p,origin:[l.x,l.y]};
  else if(IM.tool==='rotate')drag={type:'rotate',l,orig,start:Math.atan2(p[1]-24-l.y,p[0]-24-l.x),origin:l.rotation||0};
  else if(IM.tool==='fill'){const i=IM.layer;imEditCur(c=>{const x=imNorm(c.layers[i]);if(['rect','ellipse','polygon'].includes(x.kind)){x.filled=true;x.fillTone=IM.tone;}else x.tone=IM.tone;c.layers[i]=imNorm(x);},'填色');}
  else if(IM.tool==='erase')drag={type:'erase',l,points:[imToLocal(l,...p).map(imRound)]};
  else{if(ic.layers.length>=8){IM.error='圖層已達 8 層上限。';return renderPanel();}drag={type:IM.tool,start:p,end:p};}
 };
 svg.onpointermove=e=>{if(!drag)return;const p=pt(e),l=drag.l;
  if(drag.type==='move'){l.x=imClamp(imRound(drag.origin[0]+p[0]-drag.start[0]),-24,24);l.y=imClamp(imRound(drag.origin[1]+p[1]-drag.start[1]),-24,24);redraw(l);}
  else if(drag.type==='rotate'){let d=Math.round(drag.origin+(Math.atan2(p[1]-24-l.y,p[0]-24-l.x)-drag.start)*180/Math.PI);while(d>180)d-=360;while(d<-180)d+=360;l.rotation=d;redraw(l);}
  else if(drag.type==='handle'){const q=imToLocal({...l,scale:1},...p);l.cx=imClamp(imRound(q[0]),-48,48);l.cy=imClamp(imRound(q[1]),-48,48);redraw(l);}
  else if(drag.type==='erase'){const q=imToLocal(l,...p).map(imRound),last=drag.points.at(-1);if(drag.points.length<128&&(q[0]!==last[0]||q[1]!==last[1]))drag.points.push(q);const k=l.scale||1;draftG().innerHTML=`<polyline points="${drag.points.map(x=>imToCanvas(l,x[0]*k,x[1]*k).join(',')).join(' ')}" stroke="#ff6b6b" stroke-width="${IM.width}" opacity=".6"/>`;}
  else{drag.end=p;draftG().innerHTML=`<line x1="${drag.start[0]}" y1="${drag.start[1]}" x2="${p[0]}" y2="${p[1]}" stroke="#58a6ff" stroke-width="${IM.width}" opacity=".7"/>`;}
 };
 svg.onpointerup=svg.onpointercancel=()=>{if(!drag)return;const d=drag;drag=null;const i=IM.layer;
  if(d.type==='move'||d.type==='rotate'||d.type==='handle'){const saved=clone(d.l),orig=d.orig;
   // 拖曳中只改了畫面上的暫存值；以 commit 寫回草稿，使復原能回到拖曳前。
   const c=imCur();c.layers[i]=orig;imEditCur(x=>{x.layers[i]=imNorm(saved);},d.type==='rotate'?'旋轉圖層':'移動圖層');return;}
  if(d.type==='erase'){imEditCur(c=>{const l=imNorm(c.layers[i]);l.eraseStrokes=[...(l.eraseStrokes||[]),{width:imClamp(IM.width/(l.scale||1),.1,40,3),points:d.points}].slice(-32);c.layers[i]=imNorm(l);},'擦除');return;}
  const [a,b]=[d.start,d.end],len=Math.hypot(b[0]-a[0],b[1]-a[1]);if(len<1.5){draftG().innerHTML='';return;}
  const mx=imClamp(imRound((a[0]+b[0])/2-24),-24,24),my=imClamp(imRound((a[1]+b[1])/2-24),-24,24);let layer;
  if(d.type==='line')layer=imLayer('line',{x:mx,y:my,length:imClamp(imRound(len),2,64),rotation:Math.round(Math.atan2(b[1]-a[1],b[0]-a[0])*180/Math.PI),strokeWidth:IM.width,tone:IM.tone});
  else{const hx=(a[0]-b[0])/2,hy=(a[1]-b[1])/2;layer=imLayer('curve',{x:mx,y:my,x1:imRound(hx),y1:imRound(hy),x2:imRound(-hx),y2:imRound(-hy),cx:imRound(hy*.8),cy:imRound(-hx*.8),strokeWidth:IM.width,tone:IM.tone});}
  if(imEditCur(c=>{c.layers.push(layer);},d.type==='line'?'畫直線':'畫曲線')){IM.layer=imCur().layers.length-1;renderPanel.keepScroll=true;renderPanel();}
 };
}

// ---------- 啟動 ----------
function boot(){
 if(typeof applyBalanceConfig!=='function'||typeof exportableBalance!=='function'){console.warn('[即時平衡器] 找不到遊戲平衡 API');return;}
 const published=globalThis.__EMBERWILD_PUBLISHED_BALANCE;
 try{base=clone(exportableBalance());}catch{base=clone(published);}
 draft=clone(base);
 const saved=store.get(DRAFT_KEY);
 if(saved){try{const s=JSON.parse(saved);if(s.base===signature(base)&&s.draft){draft=s.draft;mount();if(countDiff(base,draft))applyDraft();refreshBadge();return;}
  else if(s.draft&&confirm('即時平衡器：遊戲發布版本已更新，上次的草稿建立在舊版本上。\n要繼續使用舊草稿嗎？（取消＝從新版本重新開始）')){draft=s.draft;mount();applyDraft();return;}}catch{}}
 mount();
}
globalThis.DreamingAbyssLiveEditor={get draft(){return draft;},get base(){return base;},apply(){const r=applyDraft();renderPanel.keepScroll=true;renderPanel();return r;},export:exportJSON,setOverride,inspectElement,openGroup,findRefs,buildModuleFiles,changeReport,makeZip,get inspectResults(){return inspectResults;},get ui(){return ui;},render:renderPanel,openIconMaker,get iconMaker(){return {...IM,hits:undefined};},version:VERSION};
if(globalThis.emberwildBootComplete||globalThis.__EMBERWILD_BALANCE_READY)boot();
else addEventListener('emberwild-balance-ready',boot,{once:true});
})();
