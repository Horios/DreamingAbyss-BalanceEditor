/* Seconds authoring adapters. Legacy points remain compatible with existing games. */
(()=>{'use strict';
const clone=x=>structuredClone(x),active=()=>data.balanceSettings?.meta?.combatTimingVersion===1,config=()=>data.balanceSettings.combat.seconds;
const finite=(n,min=0)=>typeof n==='number'&&Number.isFinite(n)&&n>=min;
function status(raw,previous,patch){
 if(!active())return raw;const c=config(),s=clone(raw);if(s.timing&&previous?.timing)s.timing={...previous.timing,...s.timing};s.timing??={durationSeconds:s.permanent?null:s.duration*c.durationReferenceSeconds,periodicIntervalSeconds:c.periodicIntervalSeconds,triggerIntervalSeconds:c.triggerIntervalSeconds};
 if(Object.hasOwn(patch,'permanent'))s.timing.durationSeconds=patch.permanent?null:(previous?.timing?.durationSeconds??s.duration*c.durationReferenceSeconds);
 if(patch.timing&&Object.hasOwn(patch.timing,'durationSeconds'))s.timing.durationSeconds=patch.timing.durationSeconds;
 const duration=s.timing.durationSeconds;if(duration!==null&&!finite(duration,.000001))throw Error('狀態持續秒數必須大於 0；永久請使用永久標記');
 for(const key of ['periodicIntervalSeconds','triggerIntervalSeconds'])if(!finite(s.timing[key],.000001))throw Error('狀態 '+key+' 必須是正秒數');s.permanent=duration===null;s.triggers??=[];return s;
}
function assertSkillPatch(before,patch){if(!active())return;if(patch.eventPassive&&before.eventPassive?.event==='enemyDeath')for(const key of ['reduction','cooldown'])if(patch.eventPassive[key]!==before.eventPassive[key])throw Error('eventPassive.'+key+' 是相容點數；請使用被動事件秒數頁修改');for(const key of ['cooldown','duration','bossDuration'])if(Object.hasOwn(patch,key)&&patch[key]!==before[key])throw Error(key+' 是唯讀相容欄位；請修改 timing.'+({cooldown:'cooldownSeconds',duration:'durationSeconds',bossDuration:'bossDurationSeconds'}[key]));}
function validateStatuses(doc){if(doc.balanceSettings?.meta?.combatTimingVersion!==1)return;for(const s of doc.statusDefinitions||[])if(s.timing&&(s.permanent===true)!==(s.timing.durationSeconds===null))throw Error('狀態 '+s.id+' 的永久標記與 timing.durationSeconds 不一致；請於狀態秒數設定修正');}
// Legacy cooldown-reduction points convert at the fixed action reference (game v0.074), independent of class basic intervals.
function unitFor(job){return config().actionReferenceSeconds;}
function points(seconds,factor){if(!finite(seconds))throw Error('冷卻秒數必須是非負有限值');const n=seconds/factor;if(Math.abs(n-Math.round(n))>1e-6)throw Error('此相容效果以 '+factor+' 秒為一個步進；請輸入其整數倍');return Math.round(n);}
function eventRows(){return data.skillSystem.definitions.filter(s=>s.eventPassive?.event==='enemyDeath').map(s=>({id:'event:'+s.id,name:s.name,adapter:'passiveEvent',source:s.eventPassive,job:s.jobs?.[0]??s.adapter?.job??0,target:{reductionSeconds:s.eventPassive.reduction*unitFor(s.jobs?.[0]??s.adapter?.job??0),cooldownSeconds:s.eventPassive.cooldown*config().actionReferenceSeconds}}));}
function equipmentRows(){const out=[];for(const [job,group] of data.equipmentForms.entries())for(const [slot,forms] of group.entries())for(const [i,form] of forms.entries())for(const [n,effect] of (form.fixedEffects||[]).entries()){
 if(!['allCooldownReduction','skillCooldownReduction'].includes(effect.key))continue;
 for(const useJob of job<4?[job]:[0,1,2,3]){const proc=effect.key==='skillCooldownReduction'&&data.classes[useJob]?.skills?.[effect.skill]?.type==='proc';out.push({id:'fixed:'+job+':'+slot+':'+i+':'+n+':'+useJob,name:form.name+' · '+data.classes[useJob].name+' · '+(effect.key==='allCooldownReduction'?'全部技能':'核心技能 '+(effect.skill+1)),adapter:'equipmentCooldown',source:effect,job:useJob,proc,target:proc?{procPoints:effect.value}:{reductionSeconds:effect.value*unitFor(useJob)}});}
 }
 const add=(source,key,id,label)=>{for(let job=0;job<4;job++)out.push({id:id+':'+job,name:label+' · '+data.classes[job].name,adapter:'equipmentPointMap',source,sourceKey:key,job,target:{reductionSeconds:source[key]*unitFor(job)}});};
 for(const [key,values]of [['all',data.balance.affixes.extendedValues.allCooldownReduction],['skill',data.balance.affixes.cooldownReduction]])for(const rank of Object.keys(values))add(values,rank,'affix:'+key+':'+rank,(key==='all'?'全技能':'指定技能')+'詞綴 '+rank);
 for(const [slot,ranks]of data.balance.affixes.poolBySlotRank.entries())for(const [rank,pool]of ranks.entries())for(const [i,effect]of pool.entries())if([5,16].includes(effect.type))for(const key of ['min','max'])add(effect,key,'pool:'+slot+':'+rank+':'+i+':'+key,'詞綴池 '+slot+'/'+rank+' '+(effect.type===5?'指定技能（proc 為機率點數）':'全技能')+' '+key);
 return out;}
function update(row,patch){const old=clone(row.source);try{
 if(row.adapter==='passiveEvent'){for(const [k,v]of Object.entries(patch)){if(k==='reductionSeconds')row.source.reduction=points(v,unitFor(row.job));else if(k==='cooldownSeconds')row.source.cooldown=points(v,config().actionReferenceSeconds);else throw Error('未知的事件秒數欄位');}EmberwildSkillSystem.validate(data.skillSystem);}
 else if(row.adapter==='equipmentPointMap')row.source[row.sourceKey]=points(patch.reductionSeconds,unitFor(row.job));
 else{if(row.proc){if(!Number.isInteger(patch.procPoints)||patch.procPoints<0)throw Error('觸發效果必須是非負整數點數');row.source.value=patch.procPoints;}else row.source.value=points(patch.reductionSeconds,unitFor(row.job));}
 EmberwildSecondsSchema.validate(data);__EMBERWILD_VALIDATE_DOCUMENT(data);markDirty('已修改秒數相容參數');
 }catch(e){Object.keys(row.source).forEach(k=>delete row.source[k]);Object.assign(row.source,old);throw e;}}
function describe(s){const e=s.eventPassive;if(e?.event==='enemyDeath')return '冷卻減少 '+e.reduction*unitFor(s.jobs?.[0]??s.adapter?.job??0)+' 秒；內部冷卻 '+e.cooldown*config().actionReferenceSeconds+' 秒。';if(s.statusId){const d=data.statusDefinitions.find(x=>x.id===s.statusId);if(d?.triggers?.some(t=>t.event==='targetTurnEnd'))return '固定每 '+d.timing.triggerIntervalSeconds+' 秒觸發（受控仍會觸發），不是行動次數；持續 '+(d.timing.durationSeconds===null?'永久':d.timing.durationSeconds+' 秒')+'。';}return '';}
const api={active,status,assertSkillPatch,validateStatuses,eventRows,equipmentRows,update,describe};globalThis.EmberwildSecondsAuthoring=api;
const check=__EMBERWILD_VALIDATE_DOCUMENT;__EMBERWILD_VALIDATE_DOCUMENT=function(doc,...args){validateStatuses(doc);return check(doc,...args);};
const exportBase=__EMBERWILD_MASTERY_EDITOR.cleanExport;__EMBERWILD_MASTERY_EDITOR.cleanExport=function(...args){validateStatuses(data);return exportBase(...args);};
const dirty=validateData;validateData=function(...args){const issues=dirty(...args);try{validateStatuses(data);}catch(e){issues.push(e.message);}return issues;};
// Existing fixed-effect selectors keep their point storage and now explain the seconds conversion.
for(const key of ['allCooldownReduction','skillCooldownReduction']){const d=EQUIPMENT_FIXED_EFFECT_BY_KEY[key];d.unit='冷卻點數';d.help='主動／輔助技能：每點減少該職業一個基礎間隔的秒數；指定觸發技能仍轉成觸發率點數。請使用秒數／MP 戰鬥的裝備冷卻頁編輯秒數。';}
const previous=render;render=function(...args){const out=previous(...args);if(!active())return out;
 if(currentSection==='statuses'){const s=data.statusDefinitions.find(s=>s.id===__EMBERWILD_STATUS_EDITOR_TEST_API.selectedId),preview=document.querySelector('.status-maker-preview');if(s&&preview)preview.innerHTML=preview.innerHTML.replace(/\d+(?:\.\d+)? 回合/g,s.timing.durationSeconds===null?'永久':s.timing.durationSeconds+' 秒');}
 if(currentSection==='skillSystem'){const box=document.getElementById('canonicalSkillJSON');if(box){try{const s=JSON.parse(box.value);const p=document.createElement('p');p.className='notice';p.textContent='正式時間以 timing 的秒數欄位為準；cooldown／duration／bossDuration 為唯讀相容欄位。'+describe(s);box.insertAdjacentElement?.('beforebegin',p);}catch{}}}
 return out;};
})();
