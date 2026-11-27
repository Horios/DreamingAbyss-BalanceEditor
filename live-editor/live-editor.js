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

const VERSION='1.0.0';
const DRAFT_KEY='da-live-editor-draft-v1';
const UI_KEY='da-live-editor-ui-v1';
const clone=v=>JSON.parse(JSON.stringify(v));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const store={get(k){try{return localStorage.getItem(k);}catch{return null;}},set(k,v){try{localStorage.setItem(k,v);return true;}catch{return false;}},del(k){try{localStorage.removeItem(k);}catch{}}};

// 資料分類：path 指向陣列或物件；label 決定清單顯示名稱
const CATEGORIES=[
 {id:'items',name:'道具',path:['items']},
 {id:'skills',name:'技能',path:['skillSystem','definitions']},
 {id:'gems',name:'寶石',path:['skillSystem','gems']},
 {id:'classRules',name:'職業技能規則',path:['skillSystem','classRules']},
 {id:'skillEquip',name:'裝備技能池',path:['skillSystem','equipment']},
 {id:'classes',name:'職業',path:['classes']},
 {id:'support',name:'輔助技能',path:['supportSkills']},
 {id:'companions',name:'夥伴',path:['companions']},
 {id:'passives',name:'被動',path:['passiveDefinitions']},
 {id:'companionSettings',name:'夥伴設定',path:['companionSettings']},
 {id:'tokens',name:'信物',path:['companionTokens','catalog']},
 {id:'monsters',name:'怪物',path:['balanceSettings','monsters','catalog']},
 {id:'monsterRules',name:'怪物規則',path:['balanceSettings','monsters']},
 {id:'maps',name:'地圖',path:['balanceSettings','maps']},
 {id:'drops',name:'掉落',path:['balanceSettings','drops']},
 {id:'statuses',name:'狀態',path:['statusDefinitions']},
 {id:'forms',name:'裝備類型',path:['equipmentForms']},
 {id:'power',name:'裝備強度',path:['equipmentPowerSystem']},
 {id:'shop',name:'商店',path:['shopSettings']},
 {id:'story',name:'劇情任務',path:['story','quests']},
 {id:'quests',name:'委託',path:['balanceSettings','quests']},
 {id:'tutorials',name:'教學',path:['tutorials','modules']},
 {id:'wishing',name:'許願池',path:['wishingLake']},
 {id:'crafting',name:'製作',path:['crafting']},
 {id:'starter',name:'新手包',path:['starterPacks']},
 {id:'settings',name:'遊戲設定',path:['balanceSettings']},
 {id:'combat',name:'戰鬥公式',path:['balance']},
 {id:'uiText',name:'介面標題',path:['uiText']},
 {id:'navigation',name:'選單',path:['navigation']},
 {id:'icons',name:'背包圖示',path:['inventoryIcons']},
 {id:'root',name:'全部資料',path:[]}
];
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
 for(const t2 of [R.elements,R.races,R.activations,R.effects,R.qualities])if(t2&&typeof t2[v]==='string'&&(k===undefined))return t2[v];
 if(R.equipmentExclusive?.[v])return R.equipmentExclusive[v];
 return '';
}
function pathHint(path){
 const R=base?._reference||{};const plain=path.filter(x=>typeof x!=='number').join('.');
 return R.balancePaths?.[plain]||(R.legacySettings?.[path.map(x=>typeof x==='number'?'[]':x).join('.').replace(/\.\[\]/g,'[]')]?.note)||'';
}

// ---------- 套用與草稿 ----------
function signature(doc){const s=JSON.stringify(doc);let h=0;for(let i=0;i<s.length;i+=7)h=(h*31+s.charCodeAt(i))|0;return s.length+':'+h;}
function saveDraft(){store.set(DRAFT_KEY,JSON.stringify({base:signature(base),draft}));}
function commit(mutator,{label}={}){
 history.push(JSON.stringify(draft));if(history.length>80)history.shift();future=[];
 mutator();saveDraft();
 if(ui.auto)scheduleApply();else setStatus(true,'已修改（尚未套用）'+(label?'：'+label:''));
 refreshBadge();
}
function scheduleApply(){clearTimeout(applyTimer);applyTimer=setTimeout(applyDraft,350);}
function applyDraft(){
 clearTimeout(applyTimer);
 try{
  const doc=clone(draft);
  validateBalanceConfig(clone(doc));
  applyBalanceConfig(doc,{persist:false});
  globalThis.__EMBERWILD_BALANCE_SOURCE=clone(draft);
  try{if(typeof render==='function'&&globalThis.state)render();}catch(e){console.warn('[即時平衡器] 重繪失敗',e);}
  setStatus(true,'已套用到遊戲 · '+new Date().toLocaleTimeString());
  return true;
 }catch(e){
  console.warn('[即時平衡器] 套用失敗',e);
  setStatus(false,'套用失敗：'+(e?.message||e));
  return false;
 }
}
function setStatus(ok,msg){lastStatus={ok,msg};const el=root?.querySelector('[data-status]');if(el){el.textContent=msg;el.className='status '+(ok?'ok':'bad');}}
function undo(){if(!history.length)return;future.push(JSON.stringify(draft));draft=JSON.parse(history.pop());saveDraft();applyDraft();renderPanel();}
function redo(){if(!future.length)return;history.push(JSON.stringify(draft));draft=JSON.parse(future.pop());saveDraft();applyDraft();renderPanel();}

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
  const keys=new Set([...Object.keys(x),...Object.keys(y)]);for(const k of keys)walk(x[k],y[k],p.concat(Array.isArray(y)?Number(k):k));};
 walk(a,b,[]);return out;
}

// ---------- 匯出／匯入 ----------
function exportJSON(){
 if(!applyDraft()&&!confirm('目前草稿未通過遊戲驗證：\n'+lastStatus.msg+'\n\n仍要匯出草稿原樣嗎？'))return;
 let out;
 try{out=lastStatus.ok?exportableBalance():clone(draft);}catch(e){out=clone(draft);}
 // exportableBalance 會帶入已安裝的 textOverrides；草稿為準
 if(draft.textOverrides?.entries?.length)out.textOverrides=clone(draft.textOverrides);else delete out.textOverrides;
 const text=JSON.stringify(out,null,2)+'\n';
 const d=new Date(),stamp=d.getFullYear()+String(d.getMonth()+1).padStart(2,'0')+String(d.getDate()).padStart(2,'0')+'-'+String(d.getHours()).padStart(2,'0')+String(d.getMinutes()).padStart(2,'0');
 const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type:'application/json'}));a.download='dreaming-abyss-balance-'+stamp+'.json';
 document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},1000);
 setStatus(true,'已匯出完整 JSON（'+Math.round(text.length/1024)+' KB）');
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
 commit(()=>{draft=clone(base);});applyDraft();renderPanel();
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
 // 退而找目標元素內第一個非空文字節點
 const w=document.createTreeWalker(target,NodeFilter.SHOW_TEXT,{acceptNode:n=>n.nodeValue.trim()?1:3});
 const n=w.nextNode();if(n)return {node:n};
 for(const attr of ['placeholder','title','aria-label'])if(target.getAttribute?.(attr))return {node:target,attr};
 return null;
}
function originalText(hit){const T=globalThis.EmberwildTextOverrides;
 if(hit.attr)return T?.originalOf?T.originalOf(hit.node,hit.attr):hit.node.getAttribute(hit.attr);
 return T?.originalOf?T.originalOf(hit.node):hit.node.nodeValue;}

// ---------- 多筆同步編輯 ----------
// ui.group={name,paths:[完整路徑…],rel:[群組內子路徑]}；編輯時以第一筆顯示，寫入時套用到每一筆
function startsWith(p,pre){return pre.length<=p.length&&pre.every((k,i)=>p[i]===k);}
function groupRel(p){const g=ui.group;if(!g)return null;for(const gp of g.paths)if(startsWith(p,gp))return p.slice(gp.length);return null;}
function groupTargets(p){
 const rel=groupRel(p);if(rel==null)return [p];
 return ui.group.paths.map(gp=>gp.concat(rel)).filter(tp=>{const par=getAt(draft,tp.slice(0,-1));return tp.length===0||(par!=null&&typeof par==='object');});
}
function writeAll(p,fn){for(const tp of groupTargets(p))fn(tp);}
function groupValues(p){const rel=groupRel(p);if(rel==null)return null;return ui.group.paths.map(gp=>getAt(draft,gp.concat(rel)));}
function sameAll(list){const f=JSON.stringify(list[0]);return list.every(x=>JSON.stringify(x)===f);}

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
  if(p[0]==='_reference'||p[0]==='notes')return;
  for(const k of Object.keys(v))walk(v[k],p.concat(Array.isArray(v)?Number(k):k),depth+1);
 };
 walk(draft,[],0);
 found.sort((a,b)=>b.score-a.score);
 const seen=new Set();inspectResults=found.filter(f=>{const k=pathText(f.path);if(seen.has(k))return false;seen.add(k);return true;}).slice(0,40);
 inspectResults.clickedText=near.slice(0,120);
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
  pendingText={source,original:orig,text:existing?existing.text:source};
  ui.tab='text';
 }else if(pickMode==='inspect'){
  inspectElement(e.target);ui.tab='inspect';
 }
 pickMode=null;hideHover();ui.open=true;renderPanel();
}
for(const type of ['pointerdown','mousedown','pointerup','mouseup','click'])document.addEventListener(type,onClickCapture,true);
document.addEventListener('pointermove',onPointerMove,true);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&pickMode){pickMode=null;hideHover();renderPanel();}
 if((e.ctrlKey||e.metaKey)&&e.key==='z'&&isOurs(e.target)&&!/INPUT|TEXTAREA/.test(e.composedPath()[0]?.tagName||'')){e.preventDefault();e.shiftKey?redo():undo();}},true);

// ---------- 面板 ----------
let host,root;
const CSS=`
:host{all:initial}
*{box-sizing:border-box;font-family:system-ui,"Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif}
.fab{position:fixed;right:16px;bottom:16px;z-index:2147483647;border:0;border-radius:24px;padding:10px 16px;background:#2b2140;color:#f5d98a;font-size:14px;font-weight:700;box-shadow:0 4px 16px rgba(0,0,0,.45);cursor:pointer}
.fab b{background:#f5b942;color:#2b2140;border-radius:10px;padding:0 6px;margin-left:6px;font-size:12px}
.panel{position:fixed;right:12px;bottom:12px;top:12px;width:min(460px,calc(100vw - 24px));z-index:2147483647;background:#1b1626;color:#ece6f5;border:1px solid #4a3d66;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,.6);display:flex;flex-direction:column;font-size:13px;overflow:hidden}
.panel.left{right:auto;left:12px}
.head{display:flex;align-items:center;gap:6px;padding:8px 10px;background:#2b2140;border-bottom:1px solid #4a3d66;flex-wrap:wrap}
.head h1{font-size:14px;margin:0 auto 0 0;color:#f5d98a}
button{font:inherit;color:#ece6f5;background:#3a2e55;border:1px solid #5b4b80;border-radius:6px;padding:4px 9px;cursor:pointer}
button:hover{background:#4a3b6c}button.on{background:#f5b942;color:#2b2140;border-color:#f5b942}
button.primary{background:#6b4fd8;border-color:#8a70f0}button.danger{background:#6a2a3a;border-color:#a04058}
button:disabled{opacity:.4;cursor:default}
.tabs{display:flex;gap:2px;padding:6px 8px 0;background:#231c33;flex-wrap:wrap}
.tabs button{border-radius:6px 6px 0 0;border-bottom:0}
.body{flex:1;overflow:auto;padding:10px}
.foot{padding:6px 10px;border-top:1px solid #4a3d66;background:#231c33;display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.status{flex:1 1 100%;font-size:12px;min-height:16px;word-break:break-all}.status.ok{color:#8fe0a8}.status.bad{color:#ff8a9a}
input,textarea,select{font:inherit;color:#ece6f5;background:#120e1b;border:1px solid #4a3d66;border-radius:5px;padding:4px 6px;width:100%}
textarea{resize:vertical;min-height:54px;font-family:ui-monospace,Consolas,monospace;font-size:12px}
.row{display:flex;gap:6px;align-items:center;margin-bottom:6px}.row>*{flex:1}.row>.fit{flex:0 0 auto}
.cats{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px}.cats button{padding:3px 7px;font-size:12px}
.list{display:flex;flex-direction:column;gap:2px}
.item{display:flex;justify-content:space-between;gap:8px;padding:5px 8px;border-radius:5px;background:#241d34;cursor:pointer;text-align:left;border:1px solid transparent}
.item:hover{border-color:#6b4fd8}.item small{color:#a99cc4;white-space:nowrap}
.crumb{font-size:12px;color:#a99cc4;margin-bottom:8px;word-break:break-all}.link{color:#c7b6ff;cursor:pointer;text-decoration:underline}.crumb a{color:#c7b6ff;cursor:pointer;text-decoration:underline}
.field{display:grid;grid-template-columns:minmax(90px,38%) 1fr;gap:6px;align-items:start;padding:3px 0;border-bottom:1px dashed #2f2644}
.field>label{color:#c9bfe0;word-break:break-all;padding-top:3px;font-size:12px;display:flex;flex-direction:column;gap:1px}
.zh{color:#ece6f5;font-size:13px}.en{color:#7f739b;font-size:11px;font-family:ui-monospace,Consolas,monospace}
.note{color:#a99cc4;font-size:11px;line-height:1.4;margin-top:2px}.note.was{color:#f5b942}
.ui{pointer-events:none}.fab,.panel,.picking{pointer-events:auto}
.hover{position:fixed;pointer-events:none;border:2px solid #f5b942;background:rgba(245,185,66,.12);border-radius:4px;display:none}
.field.changed>label{color:#f5b942}.field.changed>label .zh::after{content:" ●";color:#f5b942}
.nest{border-left:2px solid #3a2e55;padding-left:8px;margin:2px 0 4px}
details>summary{cursor:pointer;color:#c7b6ff;padding:3px 0;font-size:12px}
.hint{color:#a99cc4;font-size:12px;line-height:1.6;margin:4px 0 8px}
.card{background:#241d34;border:1px solid #3a2e55;border-radius:8px;padding:8px;margin-bottom:8px}
.diff{font-family:ui-monospace,Consolas,monospace;font-size:11px;word-break:break-all;padding:3px 0;border-bottom:1px solid #2f2644}
.diff del{color:#ff8a9a}.diff ins{color:#8fe0a8;text-decoration:none}
.picking{position:fixed;left:50%;top:10px;transform:translateX(-50%);z-index:2147483647;background:#f5b942;color:#2b2140;padding:8px 14px;border-radius:20px;font-weight:700;box-shadow:0 4px 12px rgba(0,0,0,.4);display:flex;gap:8px;align-items:center}
.picking button{background:#2b2140;color:#f5d98a}
`;
// 遊戲彈窗使用 <dialog>.showModal()，會進入瀏覽器頂層並讓其他元素無法點選。
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
 // 彈窗開關、彈窗內容重寫（會移除平衡器）時重新放置
 new MutationObserver(()=>{if(placing)return;const want=topModal()||document.documentElement;if(!host.isConnected||host.parentNode!==want){placeHost();}}).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['open']});
 // 遊戲以 innerHTML 重寫彈窗內容時，先把平衡器移出，寫完再放回，避免移除途中觸發失焦事件造成錯誤
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
 for(const proto of [HTMLDialogElement.prototype]){for(const m of ['showModal','show']){const orig=proto[m];proto[m]=function(...a){const r=orig.apply(this,a);placeHost.force=true;placeHost();return r;};}}
 addEventListener('keydown',e=>{if(e.key==='Escape'&&isOurs(e.target)){e.stopPropagation();}},true);
 root.addEventListener('click',onPanelClick);root.addEventListener('change',onPanelChange);root.addEventListener('input',onPanelInput);
 renderPanel();
}
function refreshBadge(){const b=root?.querySelector('[data-badge]');if(b)b.textContent=countDiff(base,draft);}

let rendering=false,renderAgain=false;
function renderPanel(){
 if(!root)return;
 if(rendering){renderAgain=true;return;}
 rendering=true;
 try{
  // 先讓焦點離開，失焦觸發的 change 會在此時處理，不會打斷下面的重繪
  try{root.activeElement?.blur?.();}catch{}
  renderAgain=false;renderPanelNow();
 }finally{rendering=false;}
 if(renderAgain){renderAgain=false;renderPanel();}
}
function renderPanelNow(){
 store.set(UI_KEY,JSON.stringify({open:ui.open,tab:ui.tab,cat:ui.cat,auto:ui.auto,left:ui.left}));
 const diff=countDiff(base,draft);
 let html='';const box=root.querySelector('.ui');
 if(pickMode)html+=`<div class="picking">${pickMode==='text'?'點選畫面上要修改的文字':'點選畫面上的道具、技能、夥伴、怪物等'}<button data-act="cancel-pick">取消（Esc）</button></div>`;
 if(!ui.open){box.innerHTML=html+`<button class="fab" data-act="open">平衡器<b data-badge>${diff}</b></button>`;return;}
 const tabs=[['data','資料'],['inspect','點選定位'],['text','文字'],['changes','變更 '+diff],['export','匯出']];
 html+=`<section class="panel${ui.left?' left':''}">
 <div class="head"><h1>夢淵 即時平衡器</h1>
  <button data-act="pick-inspect" title="點畫面元素找出資料">🎯 定位</button>
  <button data-act="pick-text" title="點畫面文字直接改字">✎ 改字</button>
  <button data-act="side" title="切換左右">⇆</button>
  <button data-act="close">收起</button></div>
 <div class="tabs">${tabs.map(([id,n])=>`<button class="${ui.tab===id?'on':''}" data-tab="${id}">${n}</button>`).join('')}</div>
 <div class="body">${renderTab()}</div>
 <div class="foot">
  <button data-act="undo" ${history.length?'':'disabled'}>↶ 復原</button>
  <button data-act="redo" ${future.length?'':'disabled'}>↷ 重做</button>
  <label style="display:flex;gap:4px;align-items:center;font-size:12px"><input type="checkbox" data-act="auto" style="width:auto" ${ui.auto?'checked':''}>自動套用</label>
  <button data-act="apply">套用到遊戲</button>
  <button class="primary" data-act="export">⬇ 匯出 JSON</button>
  <div class="status ${lastStatus.ok?'ok':'bad'}" data-status>${esc(lastStatus.msg)}</div>
 </div></section>`;
 const body=root.querySelector('.body'),scroll=body?.scrollTop||0;
 box.innerHTML=html;
 const nb=root.querySelector('.body');if(nb&&renderPanel.keepScroll)nb.scrollTop=scroll;renderPanel.keepScroll=false;
 const f=root.querySelector('[data-autofocus]');if(f){f.focus();f.select?.();}
}
function renderTab(){
 switch(ui.tab){
  case 'data':return renderData();
  case 'inspect':return renderInspect();
  case 'text':return renderText();
  case 'changes':return renderChanges();
  case 'export':return renderExport();
 }return '';
}

// 資料頁
function renderData(){
 const cat=CATEGORIES.find(c=>c.id===ui.cat)||CATEGORIES[0];
 let h=`<div class="cats">${CATEGORIES.map(c=>getAt(draft,c.path)===undefined?'':`<button class="${c.id===cat.id&&!ui.path?'on':''}" data-cat="${c.id}">${c.name}</button>`).join('')}</div>`;
 if(ui.group)return h+renderGroup();
 if(ui.path)return h+renderEditor(ui.path);
 const coll=getAt(draft,cat.path);
 h+=`<div class="row"><input data-filter placeholder="搜尋${cat.name}（名稱、ID、任何文字）" value="${esc(ui.filter)}"><button class="fit" data-open="${esc(JSON.stringify(cat.path))}">整組編輯</button></div>`;
 if(!coll||typeof coll!=='object')return h+`<p class="hint">此分類目前沒有資料。</p>`;
 const entries=Array.isArray(coll)?coll.map((v,i)=>[i,v]):Object.entries(coll);
 const q=ui.filter.trim().toLowerCase();
 const rows=entries.filter(([k,v])=>!q||(String(k)+JSON.stringify(v)).toLowerCase().includes(q));
 h+=`<div class="hint">${rows.length}／${entries.length} 筆 · 點選開啟編輯</div><div class="list">`;
 for(const [k,v] of rows.slice(0,400)){const p=cat.path.concat(k);const changed=JSON.stringify(getAt(base,p))!==JSON.stringify(v);
  h+=`<div class="item" data-open="${esc(JSON.stringify(p))}"><span>${changed?'<b style="color:#f5b942">● </b>':''}${esc(labelOf(v,k))}</span><small>${esc(Array.isArray(coll)?'#'+k:k)}</small></div>`;}
 if(rows.length>400)h+=`<p class="hint">僅顯示前 400 筆，請用搜尋縮小範圍。</p>`;
 if(Array.isArray(coll)&&coll.length&&coll.every(x=>x&&typeof x==='object'&&!Array.isArray(x)))h+=`</div><div class="row" style="margin-top:8px"><button data-act="dup-last" data-path="${esc(JSON.stringify(cat.path))}">＋ 複製最後一筆新增</button></div>`;
 else h+='</div>';
 return h;
}
function crumbs(path){
 let h='<div class="crumb">';const cat=CATEGORIES.slice().reverse().find(c=>c.path.length<=path.length&&c.path.every((k,i)=>path[i]===k));
 h+=`<a data-act="back">← 返回清單</a> · `;
 for(let i=0;i<=path.length;i++){const p=path.slice(0,i);const name=i===0?'根':String(path[i-1]);h+=(i?' › ':'')+(i===path.length?`<b>${esc(name)}</b>`:`<a data-open="${esc(JSON.stringify(p))}">${esc(name)}</a>`);}
 return h+'</div>';
}
function renderGroup(){
 const g=ui.group,path=g.paths[0].concat(g.rel);const v=getAt(draft,path);
 let h=`<div class="crumb"><a data-act="group-exit">← 離開同步編輯</a> · `+(g.rel.length?`<a data-act="group-rel" data-rel="[]">${esc(g.name)}</a>`:`<b>${esc(g.name)}</b>`)+g.rel.map((k,i)=>' › '+(i===g.rel.length-1?`<b>${esc(zhKey(k)||k)}</b>`:`<a data-act="group-rel" data-rel="${esc(JSON.stringify(g.rel.slice(0,i+1)))}">${esc(zhKey(k)||k)}</a>`)).join('')+'</div>';
 h+=`<div class="card"><b>同步編輯 ${g.paths.length} 筆「${esc(g.name)}」</b><p class="hint">修改任一欄位會同時寫入下列每一筆。各筆數值不同的欄位標示「各筆不同」，修改後會統一為新值。</p>`;
 h+=g.paths.map((gp,i)=>{const cat=CATEGORIES.slice(0,-1).reverse().find(c=>c.path.length&&startsWith(gp,c.path));return `<div class="hint" style="margin:0">${i+1}. ${esc(cat?cat.name:'')} <a class="link" data-act="group-single" data-path="${esc(JSON.stringify(gp))}">${esc(pathText(gp))}</a></div>`;}).join('');
 h+=`<div class="row" style="margin-top:6px"><button data-act="raw" data-path="${esc(JSON.stringify(path))}">以 JSON 編輯（套用到全部）</button><button data-act="revert" data-path="${esc(JSON.stringify(path))}">全部還原</button></div></div>`;
 if(v===undefined)return h+'<p class="hint">第一筆沒有此欄位。</p>';
 if(ui.raw===pathText(path))return h+`<textarea data-raw style="min-height:50vh">${esc(JSON.stringify(v,null,2))}</textarea><div class="row" style="margin-top:6px"><button class="primary" data-act="raw-save" data-path="${esc(JSON.stringify(path))}">儲存到全部 ${g.paths.length} 筆</button><button data-act="raw-cancel">取消</button></div>`;
 return h+renderFields(v,path,0);
}
function renderEditor(path){
 const v=getAt(draft,path);
 let h=crumbs(path);
 if(v===undefined)return h+'<p class="hint">此路徑已不存在。</p>';
 h+=`<div class="card"><b>${esc(labelOf(v,path[path.length-1]))}</b><div class="hint">${esc(pathText(path))}</div>`;
 h+=`<div class="row"><button data-act="raw" data-path="${esc(JSON.stringify(path))}">以 JSON 編輯</button>`;
 const parent=getAt(draft,path.slice(0,-1));
 if(Array.isArray(parent)){h+=`<button data-act="dup" data-path="${esc(JSON.stringify(path))}">複製一筆</button><button class="danger" data-act="del" data-path="${esc(JSON.stringify(path))}">刪除</button>`;}
 if(JSON.stringify(getAt(base,path))!==JSON.stringify(v)&&getAt(base,path)!==undefined)h+=`<button data-act="revert" data-path="${esc(JSON.stringify(path))}">還原此項</button>`;
 h+='</div></div>';
 if(ui.raw===pathText(path))return h+`<textarea data-raw style="min-height:50vh">${esc(JSON.stringify(v,null,2))}</textarea><div class="row" style="margin-top:6px"><button class="primary" data-act="raw-save" data-path="${esc(JSON.stringify(path))}">儲存 JSON</button><button data-act="raw-cancel">取消</button></div>`;
 return h+renderFields(v,path,0);
}
function renderFields(v,path,depth){
 if(v===null||typeof v!=='object')return fieldRow(path[path.length-1],v,path);
 const entries=Array.isArray(v)?v.map((x,i)=>[i,x]):Object.entries(v);
 let h='';
 for(const [k,x] of entries.slice(0,300)){
  const p=path.concat(k);
  if(x!==null&&typeof x==='object'){
   const big=JSON.stringify(x).length>2500||depth>=3;
   const changed=JSON.stringify(getAt(base,p))!==JSON.stringify(x);
   if(big)h+=`<div class="field${changed?' changed':''}">${keyLabel(k,p,x)}<div><a class="item" data-open="${esc(JSON.stringify(p))}" style="display:block">${esc(labelOf(x,k))} ›</a></div></div>`;
   else h+=`<details ${depth<1?'open':''}><summary>${changed?'<b style="color:#f5b942">● </b>':''}${esc(zhKey(k)||k)} <span class="en">${esc(k)}</span> · ${esc(labelOf(x,k))} <a data-open="${esc(JSON.stringify(p))}" style="color:#a99cc4">開啟</a></summary><div class="nest">${x.length===0||Object.keys(x).length===0?'<span class="hint">（空）</span>':renderFields(x,p,depth+1)}</div></details>`;
  }else h+=fieldRow(k,x,p);
 }
 if(entries.length>300)h+=`<p class="hint">還有 ${entries.length-300} 項，請用「以 JSON 編輯」。</p>`;
 if(Array.isArray(v)&&v.every(x=>x===null||typeof x!=='object'))h+=`<button data-act="push" data-path="${esc(JSON.stringify(path))}" style="margin:4px 0">＋ 新增一項</button>`;
 return h;
}
function keyLabel(k,p,v){
 const zh=zhKey(k),hint=[unitHint(k),pathHint(p)].filter(Boolean).join('；');
 return `<label title="${esc(pathText(p)+(hint?'\n'+hint:''))}">${zh?`<span class="zh">${esc(zh)}</span><span class="en">${esc(k)}</span>`:`<span class="zh">${esc(k)}</span>`}${hint?`<span class="note">${esc(hint)}</span>`:''}</label>`;
}
function fieldRow(k,x,p){
 const gv=groupValues(p);const differs=gv&&!sameAll(gv);
 const changed=gv?gv.some((y,i)=>JSON.stringify(y)!==JSON.stringify(getAt(base,ui.group.paths[i].concat(groupRel(p))))):getAt(base,p)!==x;const ps=esc(JSON.stringify(p));const vh=valueHint(k,x);
 let input;
 if(typeof x==='boolean')input=`<input type="checkbox" data-field="${ps}" data-type="boolean" ${x?'checked':''} style="width:auto">`;
 else if(typeof x==='number')input=`<input type="number" step="any" data-field="${ps}" data-type="number" value="${x}">`;
 else if(x===null)input=`<input data-field="${ps}" data-type="json" value="null" title="以 JSON 輸入，例如 0、&quot;文字&quot;、null">`;
 else if(String(x).length>60||String(x).includes('\n'))input=`<textarea data-field="${ps}" data-type="string">${esc(x)}</textarea>`;
 else input=`<input data-field="${ps}" data-type="string" value="${esc(x)}">`;
 // 同步編輯時，識別欄位（各筆不同的 id、編號、索引）不可統一，只顯示不可改
 if(gv&&differs&&/^(id|key|job|index)$|Id$|Index$|Key$/.test(String(k)))input=`<input value="${esc(String(x))}" disabled title="各筆識別碼不同，同步編輯時不可修改">`;
 const delBtn=typeof p[p.length-1]==='number'?`<button class="fit" data-act="del" data-path="${ps}" title="刪除">✕</button>`:'';
 return `<div class="field${changed?' changed':''}">${keyLabel(k,p,x)}<div><div class="row" style="margin:0">${input}${delBtn}</div>${vh?`<div class="note">${esc(vh)}</div>`:''}${differs?`<div class="note was">${/^(id|key|job|index)$|Id$|Index$|Key$/.test(String(k))?'識別欄位，各筆保留原值：':'各筆不同：'}${esc(gv.map(short).join('／'))}</div>`:''}${changed&&!gv?`<div class="note was">原值：${esc(short(getAt(base,p)))}</div>`:''}</div></div>`;
}

// 點選定位頁
function renderInspect(){
 let h=`<p class="hint">按「🎯 定位」後點選遊戲畫面上的道具、技能、夥伴、怪物、任務等，平衡器會依畫面文字找出對應資料。</p><button class="primary" data-act="pick-inspect">🎯 開始點選</button>`;
 if(inspectResults.clickedText!=null){
  h+=`<div class="card" style="margin-top:8px"><div class="hint">點到的文字：</div>${esc(inspectResults.clickedText)}</div>`;
  if(!inspectResults.length)h+='<p class="hint">找不到對應資料，可改用「✎ 改字」修改這段畫面文字。</p>';
  h+='<div class="list">';
  const byName=new Map();for(const r of inspectResults){if(!byName.has(r.name))byName.set(r.name,[]);byName.get(r.name).push(r);}
  for(const [name,list] of byName)if(list.length>1){
   const names=[...new Set(list.map(r=>{const c=CATEGORIES.slice(0,-1).reverse().find(c=>c.path.length&&startsWith(r.path,c.path));return c?c.name:'其他';}))].join('、');
   h+=`<div class="item" data-act="group-open" data-name="${esc(name)}" style="border-color:#f5b942"><span><b>${esc(name)}</b> ×${list.length} · 全部一起改</span><small>${esc(names)}</small></div>`;
  }
  for(const r of inspectResults){const cat=CATEGORIES.slice(0,-1).find(c=>c.path.length&&c.path.every((k,i)=>r.path[i]===k));
   h+=`<div class="item" data-open="${esc(JSON.stringify(r.path))}" data-goto-data><span>${esc(r.name)}</span><small>${esc(cat?cat.name:'')} ${esc(pathText(r.path)).slice(0,40)}</small></div>`;}
  h+='</div>';
 }
 return h;
}

// 文字頁
function renderText(){
 let h=`<p class="hint">按「✎ 改字」後點選遊戲畫面上的任何文字即可修改。數字會自動視為 {#}，同一句原文全遊戲一起修改。</p><button class="primary" data-act="pick-text">✎ 開始點選文字</button>`;
 if(pendingText){
  h+=`<div class="card" style="margin-top:8px"><div class="hint">原文（比對用）</div><div style="margin-bottom:6px">${esc(pendingText.source)}</div>
  <textarea data-pending data-autofocus>${esc(pendingText.text)}</textarea>
  <div class="row" style="margin-top:6px"><button class="primary" data-act="text-save">儲存</button><button data-act="text-restore">還原原文</button><button data-act="text-cancel">取消</button></div></div>`;
 }
 const list=draft.textOverrides?.entries||[];
 h+=`<h3 style="font-size:13px;margin:12px 0 6px">已修改的文字（${list.length}）</h3><input data-tfilter placeholder="搜尋" value="${esc(ui.tfilter||'')}" style="margin-bottom:6px">`;
 const q=(ui.tfilter||'').toLowerCase();
 h+='<div class="list">'+list.map((x,i)=>[x,i]).filter(([x])=>!q||(x.source+x.text).toLowerCase().includes(q)).slice(0,300).map(([x,i])=>`<div class="field"><label title="${esc(x.source)}">${esc(x.source)}</label><div class="row" style="margin:0"><input data-otext="${i}" value="${esc(x.text)}"><button class="fit" data-act="text-del" data-i="${i}">✕</button></div></div>`).join('')+'</div>';
 const ut=draft.uiText;
 if(ut&&typeof ut==='object')h+=`<h3 style="font-size:13px;margin:12px 0 6px">介面標題（uiText）</h3>`+renderFields(ut,['uiText'],1);
 return h;
}

// 變更頁
function renderChanges(){
 const list=diffList(base,draft);
 if(!list.length)return '<p class="hint">與遊戲發布版本相同，沒有變更。</p>';
 let h=`<p class="hint">共 ${countDiff(base,draft)} 處與發布版本不同${list.length>=300?'（只列前 300 處）':''}。點路徑可開啟編輯。</p>`;
 for(const d of list){const target=d.path.length>1?d.path.slice(0,-1):d.path;
  h+=`<div class="diff"><a data-open="${esc(JSON.stringify(target))}" data-goto-data style="color:#c7b6ff;cursor:pointer">${esc(pathText(d.path))}</a><br><del>${esc(short(d.from))}</del> → <ins>${esc(short(d.to))}</ins> <button data-act="revert" data-path="${esc(JSON.stringify(d.path))}" style="font-size:11px;padding:0 5px">還原</button></div>`;}
 return h;
}
function short(v){if(v===undefined)return '（無）';const s=JSON.stringify(v);return s.length>120?s.slice(0,120)+'…':s;}

// 匯出頁
function renderExport(){
 return `<div class="card"><b>一鍵匯出</b><p class="hint">先以遊戲驗證並套用目前草稿，再輸出遊戲整理後的完整平衡 JSON（含文字覆寫），可直接放回遊戲的 data/balance.json，或用遊戲「匯入平衡資料」載入。</p><button class="primary" data-act="export">⬇ 匯出完整 JSON</button> <button data-act="copy">複製到剪貼簿</button></div>
 <div class="card"><b>匯入</b><p class="hint">讀入先前匯出的 JSON 繼續編輯。</p><input type="file" accept=".json,application/json" data-import></div>
 <div class="card"><b>重設</b><p class="hint">捨棄所有修改，回到遊戲目前發布的版本。草稿自動保存在此瀏覽器，重新整理後會自動套用。</p><button class="danger" data-act="reset">回到發布版本</button></div>
 <p class="hint">即時平衡器 v${VERSION} · 遊戲資料修訂 ${esc(globalThis.__EMBERWILD_BALANCE_MODULES?.dataRevision??'—')}</p>`;
}

// ---------- 事件 ----------
function pathAttr(el,name='data-path'){return JSON.parse(el.getAttribute(name));}
function onPanelClick(e){
 const t=e.target.closest('[data-act],[data-tab],[data-cat],[data-open]');if(!t)return;
 if(t.matches('input[type=checkbox]'))return;
 if(t.dataset.tab){ui.tab=t.dataset.tab;return renderPanel();}
 if(t.dataset.cat){ui.cat=t.dataset.cat;ui.path=null;ui.group=null;ui.filter='';ui.raw=null;return renderPanel();}
 if(t.dataset.open&&!t.dataset.act){
  const p=pathAttr(t,'data-open');ui.raw=null;
  if(ui.group&&!t.hasAttribute('data-goto-data')){const rel=groupRel(p);if(rel!=null){ui.group.rel=rel;return renderPanel();}}
  ui.group=null;
  const cat=CATEGORIES.slice().reverse().find(c=>c.path.length<=p.length&&c.path.every((k,i)=>p[i]===k));
  if(cat)ui.cat=cat.id;
  if(cat&&JSON.stringify(cat.path)===JSON.stringify(p)&&p.length&&t.closest('.crumb'))ui.path=null;else ui.path=p;
  ui.tab='data';return renderPanel();
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
  case 'copy':{applyDraft();let out;try{out=exportableBalance();}catch{out=clone(draft);}if(draft.textOverrides?.entries?.length)out.textOverrides=clone(draft.textOverrides);
   navigator.clipboard?.writeText(JSON.stringify(out,null,2)).then(()=>setStatus(true,'已複製完整 JSON'),()=>setStatus(false,'無法寫入剪貼簿'));return;}
  case 'reset':return resetAll();
  case 'back':ui.path=null;ui.group=null;ui.raw=null;break;
  case 'raw':ui.raw=pathText(pathAttr(t));break;
  case 'raw-cancel':ui.raw=null;break;
  case 'group-open':{const name=t.dataset.name;const paths=inspectResults.filter(r=>r.name===name).map(r=>r.path);ui.group={name,paths,rel:[]};ui.tab='data';ui.raw=null;ui.path=null;break;}
  case 'group-exit':ui.group=null;ui.raw=null;break;
  case 'group-rel':ui.group.rel=JSON.parse(t.dataset.rel);ui.raw=null;break;
  case 'group-single':{const gp=pathAttr(t);ui.group=null;ui.path=gp;ui.raw=null;break;}
  case 'raw-save':{const p=pathAttr(t);try{const v=JSON.parse(root.querySelector('[data-raw]').value);commit(()=>{writeAll(p,tp=>{draft=setAt(draft,tp,clone(v));});});ui.raw=null;}catch(err){setStatus(false,'JSON 格式錯誤：'+err.message);return;}break;}
  case 'dup':{const p=pathAttr(t);const arr=getAt(draft,p.slice(0,-1));const i=p[p.length-1];commit(()=>{const c=clone(arr[i]);bumpId(c,arr);arr.splice(i+1,0,c);});ui.path=p.slice(0,-1).concat(i+1);break;}
  case 'dup-last':{const p=pathAttr(t);const arr=getAt(draft,p);commit(()=>{const c=clone(arr[arr.length-1]);bumpId(c,arr);arr.push(c);});ui.path=p.concat(arr.length-1);break;}
  case 'del':{const p=pathAttr(t);if(!confirm('刪除 '+pathText(p)+'？\n若其他資料引用此項，遊戲驗證會拒絕套用。'))return;commit(()=>{writeAll(p,tp=>{const a=getAt(draft,tp.slice(0,-1));if(Array.isArray(a))a.splice(tp[tp.length-1],1);});});if(ui.path&&pathText(ui.path)===pathText(p))ui.path=p.slice(0,-1);break;}
  case 'push':{const p=pathAttr(t);const arr=getAt(draft,p);const sample=arr[arr.length-1];const nv=typeof sample==='number'?0:typeof sample==='boolean'?false:'';commit(()=>writeAll(p,tp=>{const a=getAt(draft,tp);if(Array.isArray(a))a.push(nv);}));renderPanel.keepScroll=true;break;}
  case 'revert':{const p0=pathAttr(t);const targets=groupTargets(p0).sort((a,b)=>(b[b.length-1]>a[a.length-1])?1:-1);commit(()=>{for(const p of targets){const orig=getAt(base,p);if(orig===undefined){const par=getAt(draft,p.slice(0,-1));if(Array.isArray(par))par.splice(p[p.length-1],1);else if(par)delete par[p[p.length-1]];}else draft=setAt(draft,p,clone(orig));}});renderPanel.keepScroll=true;break;}
  case 'text-save':{const v=root.querySelector('[data-pending]').value;setOverride(pendingText.source,v);pendingText=null;break;}
  case 'text-restore':setOverride(pendingText.source,null);pendingText=null;break;
  case 'text-cancel':pendingText=null;break;
  case 'text-del':{const i=Number(t.dataset.i);const s=overrides()[i]?.source;if(s)setOverride(s,null);renderPanel.keepScroll=true;break;}
 }
 renderPanel();
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
 if(t.matches('[data-field]')){
  const p=pathAttr(t,'data-field');let v;
  switch(t.dataset.type){
   case 'boolean':v=t.checked;break;
   case 'number':if(t.value===''){setStatus(false,'數字不可空白');return;}v=Number(t.value);break;
   case 'json':try{v=JSON.parse(t.value);}catch{v=t.value;}break;
   default:v=t.value;
  }
  commit(()=>{writeAll(p,tp=>{draft=setAt(draft,tp,clone(v));});},{label:pathText(p)});
  renderPanel.keepScroll=true;renderPanel();
 }
 if(t.matches('[data-otext]')){const i=Number(t.dataset.otext);const s=overrides()[i]?.source;if(s)setOverride(s,t.value);renderPanel.keepScroll=true;renderPanel();}
}
function onPanelInput(e){
 const t=e.target;
 if(t.matches('[data-filter]')){ui.filter=t.value;const pos=t.selectionStart;renderPanel();const n=root.querySelector('[data-filter]');n.focus();n.setSelectionRange(pos,pos);}
 if(t.matches('[data-tfilter]')){ui.tfilter=t.value;const pos=t.selectionStart;renderPanel();const n=root.querySelector('[data-tfilter]');n.focus();n.setSelectionRange(pos,pos);}
 if(t.matches('[data-pending]')&&pendingText){pendingText.text=t.value;
  // 即時預覽，不寫入草稿
  const T=globalThis.EmberwildTextOverrides;if(T?.preview){const list=overrides().filter(x=>x.source!==pendingText.source);if(t.value&&t.value!==pendingText.source)list.push({source:pendingText.source,text:t.value});try{T.preview({version:1,entries:list});}catch{}}}
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
globalThis.DreamingAbyssLiveEditor={get draft(){return draft;},get base(){return base;},apply:applyDraft,export:exportJSON,setOverride,inspectElement,get inspectResults(){return inspectResults;},version:VERSION};
if(globalThis.emberwildBootComplete||globalThis.__EMBERWILD_BALANCE_READY)boot();
else addEventListener('emberwild-balance-ready',boot,{once:true});
})();
