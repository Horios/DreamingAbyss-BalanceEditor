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
globalThis.__EMBERWILD_V2_GAME=Object.freeze({inspect(value){inspecting=!!value;devTools();},setMode(value){if(['developer','control'].includes(value))mode=value;devTools();},get mode(){return mode;},selectMap(index){if(typeof selectExplorationMap==='function'){setTab('battle');selectExplorationMap(index);}},apply(doc){if(!ready)throw Error('遊戲仍在載入');const checked=validateBalanceConfig(structuredClone(doc));applyBalanceConfig(checked,{persist:false});return true;}});
// Capture only definitions with stable game IDs. Other controls retain their normal behavior.
document.addEventListener('click',event=>{
 if(!ready||!inspecting)return;const node=event.target.closest?.('[data-skill-id],[data-skill-slot],[data-seconds-skill],[data-item-kind],[data-enemy-id],[data-hero-id]');if(!node)return;const d=node.dataset;let target;
 if(d.skillId)target={kind:'skill',id:d.skillId};
 else if(d.skillSlot){const [type,n]=d.skillSlot.split(':'),id=party?.members?.[0]?.skillLoadout?.[type]?.[Number(n)];if(id)target={kind:'skill',id};}
 else if(d.secondsSkill&&d.secondsSkill!=='basic')target={kind:'skill',id:d.secondsSkill};
 else if(d.itemKind&&d.itemKey)target={kind:d.itemKind,key:d.itemKey};
 else if(d.enemyId){const enemy=typeof foes!=='undefined'?foes.find(x=>x.id===d.enemyId):null;if(enemy?.monsterId)target={kind:'monster',id:enemy.monsterId};}
 else if(d.heroId){const hero=typeof party!=='undefined'?party?.members.find(x=>String(heroKey(x))===d.heroId):null;if(hero)target={kind:'hero',job:hero.job};}
 if(!target)return;event.preventDefault();event.stopImmediatePropagation();send({kind:'dreaming-abyss-dev-inspect',target,context:context()});
},true);
// Developer editing mode: edit entry points next to the game's own controls. They post to the shell, which opens a dialog.
function devTools(){
 // Edit entry points belong to developer mode only; control mode edits through its console, play mode shows none.
 if(SIM||!inspecting||mode!=='developer')return document.querySelectorAll('.dev-inline-tools').forEach(n=>n.remove());
 const select=document.querySelector('select[aria-label="探索地圖"]');
 if(select&&!select.parentElement.querySelector('.dev-inline-tools')){
  const box=document.createElement('span');box.className='dev-inline-tools';box.style.cssText='display:inline-flex;gap:6px;margin-top:6px;flex-wrap:wrap';
  const add=(label,target)=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.dataset.devEdit=target.create?'map:new':'map:edit';b.style.cssText='font-size:12px;padding:3px 8px;border:1px dashed var(--gold,#dfc18b);background:transparent;color:inherit;border-radius:6px;cursor:pointer';b.onclick=e=>{e.preventDefault();e.stopPropagation();send({kind:'dreaming-abyss-dev-edit',target:typeof target==='function'?target():target});};box.append(b);};
  add('✎ 編輯此地圖',()=>({kind:'map',index:Number(select.value)}));add('＋ 新增地圖',{kind:'map',create:true});
  select.insertAdjacentElement('afterend',box);
 }
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
