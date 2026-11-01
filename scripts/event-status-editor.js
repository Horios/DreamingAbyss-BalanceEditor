/* Event triggers use the existing status maker and canonical source references. */
(()=>{
 'use strict';
 const events={targetTurnEnd:'受術者回合結束（含受控）',targetActionEnd:'受術者行動結束',targetDeath:'受術者死亡'},fx={damage:'傷害',heal:'治療',shield:'護盾'},targets={enemies:'敵方全體',allies:'我方全體',self:'施術者',target:'受術者'};
 const STATUS_ELEMENT_LABELS={physical:'無屬性',fire:'火',ice:'冰',wind:'風',light:'光',shadow:'暗'};
 const options=(values,chosen)=>Object.entries(values).map(([k,v])=>`<option value="${k}" ${k===chosen?'selected':''}>${v}</option>`).join('');
 function update(id,patch){const i=data.statusDefinitions.findIndex(s=>s.id===id);if(i<0)throw Error('狀態不存在');const raw={...structuredClone(data.statusDefinitions[i]),...structuredClone(patch)};data.statusDefinitions[i]=__EMBERWILD_STATUS_EDITOR_TEST_API.normalize(raw,i);markDirty('已修改狀態事件積木');}
 const renderBase=render;
 render=function(...args){
  const out=renderBase(...args);if(currentSection!=='statuses')return out;
  const s=data.statusDefinitions.find(s=>s.id===__EMBERWILD_STATUS_EDITOR_TEST_API.selectedId);if(!s)return out;
  const app=document.getElementById('app');app.insertAdjacentHTML('beforeend',`<section class="card"><div class="card-h"><b>可重用事件觸發</b></div><div class="card-b"><p>多種時機共用每個標記的觸發次數；死亡優先。回合結束包含被控制跳過；行動結束限實際完成行動。倍率以施術者攻擊力計算。</p><label><input type="checkbox" id="eventPermanent" ${s.permanent?'checked':''}>永久標記</label><label>持續時間時計<select id="eventDurationClock">${options({target:'受術者回合',caster:'施術者回合',battle:'戰鬥回合'},s.durationClock||'target')}</select></label><label><input type="checkbox" id="eventRemoveOnTrigger" ${s.removeOnTrigger!==false?'checked':''}>任一事件觸發後移除整個標記</label><p>最大觸發次數與可疊加沿用狀態本體設定。到期移除不引爆。</p>${(s.triggers||[]).map((t,i)=>`<div class="mechanism-card"><label>時機<select data-event-field="event" data-event-row="${i}">${options(events,t.event)}</select></label><label>效果<select data-event-field="effect" data-event-row="${i}">${options(fx,t.effect)}</select></label><label>目標<select data-event-field="target" data-event-row="${i}">${options(targets,t.target)}</select></label><label>攻擊倍率<input type="number" min="0" max="100" step="0.01" value="${t.power}" data-event-field="power" data-event-row="${i}"></label><label>屬性<select data-event-field="element" data-event-row="${i}">${options(STATUS_ELEMENT_LABELS,t.element)}</select></label><label><input type="checkbox" data-event-field="allowDeathChain" data-event-row="${i}" ${t.allowDeathChain?'checked':''}>允許引發死亡連鎖</label><label>連鎖傷害倍率<input type="number" min="0" max="100" step="0.01" value="${t.chainMultiplier}" data-event-field="chainMultiplier" data-event-row="${i}"></label><button data-event-delete="${i}">移除此事件</button></div>`).join('')}<button id="eventAddTrigger" ${(s.triggers||[]).length>=3?'disabled':''}>新增事件積木</button><p id="eventStatusError" role="status"></p></div></section>`);
  const apply=patch=>{try{update(s.id,{triggers:s.triggers||[],...patch});render();}catch(e){document.getElementById('eventStatusError').textContent=e.message;}};
  document.getElementById('eventPermanent').onchange=e=>apply({permanent:e.target.checked});document.getElementById('eventRemoveOnTrigger').onchange=e=>apply({removeOnTrigger:e.target.checked});document.getElementById('eventDurationClock').onchange=e=>apply({durationClock:e.target.value});
  document.getElementById('eventAddTrigger').onclick=()=>{const event=Object.keys(events).find(e=>!s.triggers?.some(t=>t.event===e));if(event)apply({triggers:[...(s.triggers||[]),{event,effect:'damage',power:.5,target:'enemies',element:'light',allowDeathChain:true,chainMultiplier:1}]});};
  app.querySelectorAll('[data-event-field]').forEach(el=>el.onchange=()=>{const triggers=structuredClone(s.triggers),k=el.dataset.eventField;triggers[Number(el.dataset.eventRow)][k]=k==='allowDeathChain'?el.checked:['power','chainMultiplier'].includes(k)?Number(el.value):el.value;apply({triggers});});
  app.querySelectorAll('[data-event-delete]').forEach(el=>el.onclick=()=>apply({triggers:s.triggers.filter((_,i)=>i!==Number(el.dataset.eventDelete))}));
  return out;
 };
 globalThis.__EMBERWILD_EVENT_STATUS_EDITOR={update,events};
})();
