/* Developer preview: real game navigation and objects point to the shared editor. */
(()=>{'use strict';
function memoryStorage(){const values=new Map();return {get length(){return values.size;},key(i){return [...values.keys()][i]??null;},getItem(k){return values.get(String(k))??null;},setItem(k,v){values.set(String(k),String(v));},removeItem(k){values.delete(String(k));},clear(){values.clear();}};}
Object.defineProperty(window,'localStorage',{value:memoryStorage()});Object.defineProperty(window,'sessionStorage',{value:memoryStorage()});
let ready=false,lastContext,lastTheme,inspecting=true,hooked=false;const send=data=>parent.postMessage(data,location.origin);
const context=()=>({page:typeof state==='undefined'||!state?'creation':tab,mapIndex:typeof party!=='undefined'?party?.map:state?.map,job:typeof state!=='undefined'?state?.job:undefined});
function notify(navigated=false){const value=context(),key=JSON.stringify(value);if(navigated||key!==lastContext){lastContext=key;send({kind:'dreaming-abyss-dev-page',...value,navigated});}}
globalThis.__EMBERWILD_V2_GAME=Object.freeze({inspect(value){inspecting=!!value;},apply(doc){if(!ready)throw Error('遊戲仍在載入');const checked=validateBalanceConfig(structuredClone(doc));applyBalanceConfig(checked,{persist:false});return true;}});
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
const watch=setInterval(()=>{
 const theme=document.documentElement.dataset.uiTheme;if(theme!==lastTheme){lastTheme=theme;send({kind:'dreaming-abyss-dev-theme',theme});}
 if(!ready&&globalThis.__EMBERWILD_BALANCE_READY===true){ready=true;send({kind:'dreaming-abyss-dev-ready'});}
 if(ready){if(!hooked&&typeof setTab==='function'){const base=setTab;setTab=function(...args){const out=base(...args);notify(true);return out;};hooked=true;}notify();}
},150);
window.addEventListener('pagehide',()=>clearInterval(watch),{once:true});
})();
