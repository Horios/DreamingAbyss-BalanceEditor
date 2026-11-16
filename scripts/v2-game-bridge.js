/* Developer preview: real game navigation and objects point to the shared editor. */
(()=>{'use strict';
function memoryStorage(){const values=new Map();return {get length(){return values.size;},key(i){return [...values.keys()][i]??null;},getItem(k){return values.get(String(k))??null;},setItem(k,v){values.set(String(k),String(v));},removeItem(k){values.delete(String(k));},clear(){values.clear();}};}
Object.defineProperty(window,'localStorage',{value:memoryStorage()});Object.defineProperty(window,'sessionStorage',{value:memoryStorage()});
// Simulation frames (?sim) run the real game on a virtual clock so the editor can measure a draft quickly.
const SIM=new URLSearchParams(location.search).has('sim');let simNow=Date.now();
if(SIM){const Real=Date;class SimDate extends Real{constructor(...a){super(...(a.length?a:[simNow]));}static now(){return simNow;}}window.Date=SimDate;const origin=simNow;try{Object.defineProperty(performance,'now',{configurable:true,value:()=>simNow-origin});}catch{}
 // Simulation saves live only in this frame's memory, so it must not wait for the visible preview's save lock.
 const locks={request(name,options,callback){const fn=typeof options==='function'?options:callback;return Promise.resolve().then(()=>fn({name,mode:'exclusive'}));},query:async()=>({held:[],pending:[]})};try{Object.defineProperty(navigator,'locks',{configurable:true,value:locks});}catch{}}
let ready=false,lastContext,lastTheme,inspecting=true,hooked=false,mode='developer';const send=data=>parent.postMessage(data,location.origin);
const context=()=>({page:typeof state==='undefined'||!state?'creation':tab,mapIndex:typeof party!=='undefined'?party?.map:state?.map,job:typeof state!=='undefined'?state?.job:undefined});
function notify(navigated=false){const value=context(),key=JSON.stringify(value);if(navigated||key!==lastContext){lastContext=key;send({kind:'dreaming-abyss-dev-page',...value,navigated});}}
globalThis.__EMBERWILD_V2_GAME=Object.freeze({textPick(value){setTextPick(value);},get picking(){return textPick;},inspect(value){inspecting=!!value;devTools();},setMode(value){if(['developer','control'].includes(value))mode=value;devTools();},get mode(){return mode;},selectMap(index){if(typeof selectExplorationMap==='function'){setTab('battle');selectExplorationMap(index);}},apply(doc){if(!ready)throw Error('遊戲仍在載入');const checked=validateBalanceConfig(structuredClone(doc));
 // While the team is exploring or in an encounter the game refuses a new document and returns false without throwing.
 // Reporting that as applied would leave the preview on the old values.
 const before=exportableBalance();
 if(applyBalanceConfig(checked,{persist:false})===false){
  // The refusal comes from the team rules deep in the chain; modules wrapped around them (seconds and MP, story,
  // wishing lake, interface text) have already switched to the new document. Applying the previous document again
  // puts those back, so the preview is not left running a mix of old and new values.
  let restored=false;try{applyBalanceConfig(before,{persist:false});restored=JSON.stringify(exportableBalance())===JSON.stringify(before);}catch{}
  throw Error('遊戲預覽正在探索或戰鬥中，沒有套用。'+(restored?'':'預覽中有部分設定已換成新值而無法還原，請重新整理頁面。')+'請先在遊戲內停止探索並結束目前遭遇，再套用一次');
 }
 return true;}});
// Capture only definitions with stable game IDs. Other controls retain their normal behavior.
document.addEventListener('click',event=>{
 if(!ready||!inspecting)return;const node=event.target.closest?.('[data-skill-id],[data-skill-slot],[data-seconds-skill],[data-item-kind],[data-enemy-id],[data-hero-id]');if(!node)return;const d=node.dataset;let target;
 if(d.skillId)target={kind:'skill',id:d.skillId};
 else if(d.skillSlot){const [type,n]=d.skillSlot.split(':'),id=party?.members?.[0]?.skillLoadout?.[type]?.[Number(n)];if(id)target={kind:'skill',id};}
 else if(d.secondsSkill&&d.secondsSkill!=='basic')target={kind:'skill',id:d.secondsSkill};
 else if(d.itemKind&&d.itemKey)target={kind:d.itemKind,key:d.itemKey};
 else if(d.enemyId){const enemy=typeof foes!=='undefined'?foes.find(x=>x.id===d.enemyId):null;if(enemy?.monsterId)target={kind:'monster',id:enemy.monsterId};}
 else if(d.heroId){const hero=typeof party!=='undefined'?party?.members.find(x=>String(heroKey(x))===d.heroId):null;if(hero)target=hero.companionId!==undefined&&mode==='developer'?{kind:'companion',id:hero.companionId}:{kind:'hero',job:hero.job};}
 if(!target)return;event.preventDefault();event.stopImmediatePropagation();send({kind:'dreaming-abyss-dev-inspect',target,context:context()});
},true);
// Text editing (開發者模式 · 改文字): while on, clicking any text on the game screen opens it for editing instead of
// running the game control under it. The original wording comes from the game's text override layer.
let textPick=false,hovered=null;
const squash=s=>String(s??'').replace(/\s+/g,' ').trim();
function setTextPick(on){
 textPick=!!on;if(!textPick&&hovered){hovered.classList.remove('dev-text-hover');hovered=null;}
 const b=document.querySelector('.dev-text-tool');if(b){b.setAttribute('aria-pressed',String(textPick));b.textContent=textPick?'✎ 改文字：開啟中（Esc 結束）':'✎ 改文字';}
 document.documentElement.classList.toggle('dev-text-picking',textPick);
}
function textTool(){
 if(!document.getElementById('dev-text-style')){const st=document.createElement('style');st.id='dev-text-style';st.textContent='.dev-text-picking body *{cursor:text!important}.dev-text-hover{outline:2px dashed var(--gold,#dfc18b)!important;outline-offset:2px}';document.head.append(st);}
 if(document.querySelector('.dev-text-tool'))return;
 const b=document.createElement('button');b.type='button';b.className='dev-text-tool';b.setAttribute('aria-pressed','false');b.title='開啟後點遊戲畫面上的任何文字即可修改；相同原文會一起修改';
 b.style.cssText='position:fixed;left:14px;bottom:72px;z-index:2147483000;font-size:12px;padding:6px 11px;border:1px solid var(--gold,#dfc18b);background:var(--panel,#211e2c);color:inherit;border-radius:8px;cursor:pointer;box-shadow:0 6px 20px #0006';
 b.onclick=e=>{e.preventDefault();e.stopPropagation();setTextPick(!textPick);};document.body.append(b);setTextPick(textPick);
}
const devChrome=el=>!!el?.closest?.('.dev-text-tool,.dev-inline-tools,.dev-page-tools');
function textAt(event){
 const x=event.clientX,y=event.clientY;let node=document.caretPositionFromPoint?.(x,y)?.offsetNode||document.caretRangeFromPoint?.(x,y)?.startContainer||null;
 if(node?.nodeType!==3||!node.nodeValue.trim())node=[...(event.target?.childNodes||[])].find(n=>n.nodeType===3&&n.nodeValue.trim())||null;
 if(node)return {original:globalThis.EmberwildTextOverrides?.originalOf(node)??node.nodeValue,current:node.nodeValue};
 const el=event.target;for(const attr of ['placeholder','title','aria-label'])if(el?.getAttribute?.(attr))return {original:globalThis.EmberwildTextOverrides?.originalOf(el,attr)??el.getAttribute(attr),current:el.getAttribute(attr)};
 return null;
}
window.addEventListener('click',event=>{
 if(!ready||!textPick||!inspecting||mode!=='developer'||devChrome(event.target))return;
 event.preventDefault();event.stopImmediatePropagation();
 const found=textAt(event);if(!found||!squash(found.original))return;
 const T=globalThis.EmberwildTextOverrides;if(!T){send({kind:'dreaming-abyss-dev-status',text:'這個遊戲版本不支援畫面文字修改'});return;}
 send({kind:'dreaming-abyss-dev-edit',target:{kind:'text',source:T.templateOf(found.original),current:squash(found.current)}});
},true);
// Keep the game's own pointer handlers (interaction guard, drags) from reacting while picking text.
for(const type of ['pointerdown','mousedown','dblclick'])window.addEventListener(type,event=>{if(textPick&&inspecting&&mode==='developer'&&!devChrome(event.target)){event.preventDefault();event.stopImmediatePropagation();}},true);
window.addEventListener('mouseover',event=>{if(!textPick||devChrome(event.target))return;if(hovered)hovered.classList.remove('dev-text-hover');hovered=event.target;hovered.classList.add('dev-text-hover');},true);
window.addEventListener('keydown',event=>{if(textPick&&event.key==='Escape'){event.preventDefault();setTextPick(false);}},true);
// Developer editing mode: edit entry points next to the game's own controls. They post to the shell, which opens a dialog.
function devTools(){
 // Edit entry points belong to developer mode only; control mode edits through its console, play mode shows none.
 if(SIM||!inspecting||mode!=='developer'){setTextPick(false);return document.querySelectorAll('.dev-inline-tools,.dev-page-tools,.dev-text-tool').forEach(n=>n.remove());}
 textTool();
 const select=document.querySelector('select[aria-label="探索地圖"]');
 if(select&&!select.parentElement.querySelector('.dev-inline-tools')){
  const box=document.createElement('span');box.className='dev-inline-tools';box.style.cssText='display:inline-flex;gap:6px;margin-top:6px;flex-wrap:wrap';
  const add=(label,target)=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.dataset.devEdit=target.create?'map:new':'map:edit';b.style.cssText='font-size:12px;padding:3px 8px;border:1px dashed var(--gold,#dfc18b);background:transparent;color:inherit;border-radius:6px;cursor:pointer';b.onclick=e=>{e.preventDefault();e.stopPropagation();send({kind:'dreaming-abyss-dev-edit',target:typeof target==='function'?target():target});};box.append(b);};
  add('✎ 編輯此地圖',()=>({kind:'map',index:Number(select.value)}));add('＋ 新增地圖',{kind:'map',create:true});add('＋ 新增怪物',()=>({kind:'monster',create:true,mapIndex:Number(select.value)}));add('☰ 此地圖的怪物',()=>({list:'monsters',job:Number(select.value)}));
  select.insertAdjacentElement('afterend',box);
 }
 // Page lists: switch class, see every existing record, edit or add.
 const page=typeof tab==='string'?tab:'',lists={battle:[['地圖清單','maps'],['怪物清單','monsters']],skills:[['技能清單','skills']],equipment:[['裝備清單','equipment'],['道具清單','items'],['信物清單','tokens']],worn:[['裝備清單','equipment'],['信物清單','tokens']],forge:[['裝備清單','equipment']],shop:[['商店商品','shop'],['道具清單','items']],character:[['職業數值','classes']],roster:[['夥伴清單','companions']],partnerRoster:[['夥伴清單','companions'],['信物清單','tokens']],quests:[['委託清單','quests']],'story-side':[['委託清單','quests']]}[page]||[];
 let bar=document.querySelector('.dev-page-tools');
 if(!lists.length){bar?.remove();return;}
 const sig=page+':'+lists.map(x=>x[1]).join(',');if(bar?.dataset.sig===sig)return;
 bar?.remove();bar=document.createElement('div');bar.className='dev-page-tools';bar.dataset.sig=sig;bar.setAttribute('role','group');bar.setAttribute('aria-label','開發者清單');
 bar.style.cssText='position:fixed;right:14px;bottom:72px;z-index:2147483000;display:flex;gap:6px;padding:6px;border:1px dashed var(--gold,#dfc18b);border-radius:10px;background:var(--panel,#211e2c);box-shadow:0 6px 20px #0006';
 for(const [label,list] of lists){const b=document.createElement('button');b.type='button';b.textContent='🛠 '+label;b.dataset.devList=list;b.style.cssText='font-size:12px;padding:5px 10px;border:1px solid var(--gold,#dfc18b);background:transparent;color:inherit;border-radius:7px;cursor:pointer';b.onclick=e=>{e.preventDefault();e.stopPropagation();
  // The list opens on the current class, or on the current map for the monster list and on side quests from the side story page.
  const job=list==='monsters'?Number(typeof party!=='undefined'?party?.map:state?.map)||0:list==='quests'&&page==='story-side'?'side':typeof party!=='undefined'&&party?.members?.[0]?Number(party.members[0].job)||0:0;send({kind:'dreaming-abyss-dev-edit',target:{list,job}});};bar.append(b);}
 document.body.append(bar);
}
const watch=setInterval(()=>{
 const theme=document.documentElement.dataset.uiTheme;if(theme!==lastTheme){lastTheme=theme;send({kind:'dreaming-abyss-dev-theme',theme});}
 if(!ready&&globalThis.__EMBERWILD_BALANCE_READY===true){ready=true;send({kind:'dreaming-abyss-dev-ready'});}
 if(ready)devTools();
 if(ready){if(!hooked&&typeof setTab==='function'){const base=setTab;setTab=function(...args){const out=base(...args);notify(true);return out;};hooked=true;}notify();}
},150);
if(SIM){
 const pause=()=>new Promise(resolve=>setTimeout(resolve,0));
 let seed=7;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 function prepare(doc,job){
  if(!ready)throw Error('模擬用遊戲仍在載入');
  if(doc)applyBalanceConfig(validateBalanceConfig(structuredClone(doc)),{persist:false});
  selectSaveSlot(1);start(job);closeModal();clearInterval(timer);seed=7;Math.random=random;
  // The frame is never shown; skipping page renders keeps long runs fast.
  render=()=>{};globalThis.refreshGlobalJournal=()=>{};
 }
 const step=ms=>{simNow+=ms;if(document.getElementById('modal')?.open)closeModal();tick();};
 const hero=()=>party.members[0];
 function toughFoes(){const base=spawnGroup;spawnGroup=function(...a){const out=base.apply(this,a);for(const e of foes){e.maxhp=e.hp=1e7;e.atk=1;}return out;};}
 function recruit(count){
  const ids=(exportableBalance().companions||[]).filter(p=>p.availability!=='hidden').map(p=>p.id);
  for(const id of ids){if(party.members.length>=count+1)break;try{recruitCompanion(id);closeModal();}catch{}}
  return party.members.slice(1).map(h=>h.name);
 }
 const numericStats=h=>Object.fromEntries(Object.entries(stats(h)).filter(([,v])=>typeof v==='number'&&Number.isFinite(v)));
 async function levelPace(doc,{job=0,companions=0,minutes=30}={},progress){
  prepare(doc,job);const members=recruit(companions);startSelectedExploration();closeModal();
  const reached=[{level:hero().lv,seconds:0}],total=minutes*60*2;let stopped=null;
  for(let i=1;i<=total;i++){
   step(500);if(hero().lv>reached.at(-1).level)reached.push({level:hero().lv,seconds:i/2});
   if(!running&&stopped===null)stopped=i/2;
   if(i%1200===0){progress?.(i/total);await pause();}
  }
  return {job,companions:members,minutes,reached,finalLevel:hero().lv,kills:state.totalKills||0,stoppedAt:stopped};
 }
 async function skillTrial(doc,{skillId,seconds=60}={},progress){
  const def=(doc?.skillSystem||__EMBERWILD_SKILLS.system()).definitions.find(s=>s.id===skillId);
  if(!def)throw Error('找不到技能：'+skillId);if(def.partnerId!=null)throw Error('夥伴專屬技能請在夥伴隊伍中試打');
  prepare(doc,def.jobs?.[0]??0);
  const h=hero();h.lv=Math.max(h.lv,60);h.advanced=true;h.won=false;for(const k of Object.keys(h.mastery||{}))h.mastery[k]=1e9;
  const sk=__EMBERWILD_SKILLS.byId(skillId);sk.unlockConditions={};sk.requiredMastery=null;sk.weaponTypes=[];sk.sources=[{type:'quest',rewardOnly:true}];
  h.acquiredSkillIds=[sk.id];for(const k of ['active','proc','support'])h.skillLoadout[k]=h.skillLoadout[k].map(()=>null);__EMBERWILD_SKILLS.refreshHero(h);
  if(sk.type==='passive'){
   const off=(setPassiveSkillEnabled(sk.id,false),numericStats(h)),on=(setPassiveSkillEnabled(sk.id,true),numericStats(h));
   return {skillId,name:sk.name,type:sk.type,statChanges:Object.keys(on).filter(k=>on[k]!==off[k]).map(k=>({key:k,before:off[k],after:on[k]}))};
  }
  const times=[];let basic=0;const me=String(heroKey(h));
  const rec=recordAction;recordAction=function(id,name,action){if(String(id)===me){if(action===sk.name&&sk.type==='active')times.push(simNow);if(action==='普攻')basic++;}return rec.apply(this,arguments);};
  const core=castPartySkill;castPartySkill=function(who,i){const d=__EMBERWILD_SKILLS.byPosition(who?.job,'core',i),out=core.apply(this,arguments);if(who===h&&out!==false&&d?.id===sk.id&&sk.type==='proc')times.push(simNow);return out;};
  const support=castSupport;castSupport=function(who,i){const d=__EMBERWILD_SKILLS.byPosition(who?.job,'support',i),out=support.apply(this,arguments);if(who===h&&out!==false&&d?.id===sk.id)times.push(simNow);return out;};
  toughFoes();
  if(!configureSkill(sk.type,0,sk.id))throw Error('無法把技能放入技能槽');
  startSelectedExploration();closeModal();
  const total=seconds*10;let mpLow=Infinity;
  for(let i=1;i<=total;i++){step(100);if(Number.isFinite(h.mp))mpLow=Math.min(mpLow,h.mp);if(i%500===0){progress?.(i/total);await pause();}}
  const gaps=times.slice(1).map((t,i)=>(t-times[i])/1000),damage=foes.reduce((sum,e)=>sum+Math.max(0,(e.maxhp||0)-(e.hp||0)),0);
  return {skillId,name:sk.name,type:sk.type,seconds,casts:times.length,minGap:gaps.length?Math.min(...gaps):null,maxGap:gaps.length?Math.max(...gaps):null,basicAttacks:basic,damage:Math.round(damage),lowestMp:Number.isFinite(mpLow)?Math.round(mpLow):null,cooldown:sk.timing?.cooldownSeconds,mpCost:sk.timing?.mpCost};
 }
 function equipmentStats(doc,{formId,tier=1}={}){
  const m=/^job(\d+)-slot(\d+)-form(\d+)$/.exec(String(formId));if(!m)throw Error('裝備型態 ID 無效：'+formId);
  const [job,slot,form]=m.slice(1).map(Number);prepare(doc,Math.min(job,3));
  const h=hero(),it=gear(Math.max(1,Number(tier)||1),slot,0,job);Object.assign(it,{job,formJob:job,form,slot,affix:[]});
  h.lv=Math.max(h.lv,gearRequiredLevel(it));h.equipped=Array(5).fill(null);const before=numericStats(h);
  h.bag.push(it);h.equipped[slot]=it.id;const after=numericStats(h);
  return {formId,name:itemForm(it)?.name||it.name,tier:it.tier,requiredLevel:gearRequiredLevel(it),fixedEffects:itemForm(it)?.fixedEffects||[],changes:Object.keys(after).filter(k=>after[k]!==before[k]).map(k=>({key:k,before:before[k],after:after[k]}))};
 }
 globalThis.__EMBERWILD_V2_SIM=Object.freeze({levelPace,skillTrial,equipmentStats,get ready(){return ready;}});
}
window.addEventListener('pagehide',()=>clearInterval(watch),{once:true});
})();
