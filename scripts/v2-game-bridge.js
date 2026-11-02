/* Preview uses the real game with isolated, ephemeral storage. */
(()=>{'use strict';
function memoryStorage(){const values=new Map();return {get length(){return values.size;},key(i){return [...values.keys()][i]??null;},getItem(k){return values.get(String(k))??null;},setItem(k,v){values.set(String(k),String(v));},removeItem(k){values.delete(String(k));},clear(){values.clear();}};}
Object.defineProperty(window,'localStorage',{value:memoryStorage()});Object.defineProperty(window,'sessionStorage',{value:memoryStorage()});
let ready=false,lastPage;const send=data=>parent.postMessage(data,location.origin);
globalThis.__EMBERWILD_V2_GAME=Object.freeze({apply(doc){if(!ready)throw Error('遊戲仍在載入');const checked=validateBalanceConfig(structuredClone(doc));applyBalanceConfig(checked,{persist:false});return true;}});
const watch=setInterval(()=>{if(!ready&&globalThis.__EMBERWILD_BALANCE_READY===true){ready=true;send({kind:'dreaming-abyss-dev-ready'});}if(ready&&typeof tab!=='undefined'&&tab!==lastPage){lastPage=tab;send({kind:'dreaming-abyss-dev-page',page:tab});}},150);
window.addEventListener('pagehide',()=>clearInterval(watch),{once:true});
})();
