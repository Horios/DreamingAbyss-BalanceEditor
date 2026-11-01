/* Editor-only mechanism definitions, instances and reverse examples. No runtime schema changes. */
(function(root){
'use strict';
const copy=x=>JSON.parse(JSON.stringify(x)),pick=(s,ks)=>Object.fromEntries(ks.filter(k=>s[k]!==undefined).map(k=>[k,copy(s[k])])),defs=new Map();
const common=['damage','drain','heal','shield','cleanse','dispel','revive'];
const mainKeys=['effect','systemEffect','power','powerPerLevel','duration','element','drainRate','healResolution','dispelCount','reviveHpRatio','statusId','statusTarget','statusTargetStat','statusTargetOrder','statusTargetIncludeSelf','statusMaxTargets'];
const supportKeys=['kind','value','effectPerLevel','duration','element','statusId','statusTarget','statusTargetStat','statusTargetOrder','statusTargetIncludeSelf','baseCritRate','baseCritDamage','defensePenetration','defenseIgnore'];
const commonKeys=['target','hitCount','powerBasis','damageResolution','healResolution','drainRate','onHitStatusId','onHitStatusChance','dispelCount','reviveHpRatio'];
function define(id,name,category,description,source,reusable=true){if(!defs.has(id))defs.set(id,{id,name,category,description,source,reusable});return defs.get(id);}
const names={damage:'直接傷害',drain:'傷害轉治療',heal:'恢復生命',shield:'生成護盾',cleanse:'淨化減益',dispel:'驅散增益',revive:'復活',applyStatus:'施加自訂狀態',taunt:'嘲諷',guard:'減傷',slow:'緩速',regen:'持續恢復',polymorph:'變形',freeze:'凍結',frost:'冰霜',rage:'狂暴',summonMorphTrap:'變形陷阱',summonFreezeTrap:'冰凍陷阱',fear:'恐懼',tauntRage:'嘲諷狂暴',nextActiveDamage:'下次主動技能增傷',advanceNextRound:'下回合行動提前',shieldLowest:'最低生命護盾'};
for(const e of common.concat('applyStatus'))define('core.'+e,names[e],['heal','revive'].includes(e)?'治療':['shield','applyStatus','cleanse','dispel'].includes(e)?'狀態':'傷害','核心技能主要效果；同一技能只有一個主效果槽。','js/combat/skill-effect-runtime.js / js/skills/status-maker.js');
for(const e of ['taunt','guard','slow','regen'])define('system.'+e,names[e],'狀態','職業特殊效果覆蓋一般主要效果，限人物核心技能。','js/skills/skill-system-runtime.js');
for(const e of ['polymorph','freeze','frost','rage','summonMorphTrap','summonFreezeTrap','fear','tauntRage','nextActiveDamage','advanceNextRound','shieldLowest'])define('exclusive.'+e,names[e],'特殊機制','專屬處理器；尚未拆成可獨立取用的積木。完整複製保留此處理器及原職業限制。','js/combat/control-status-summon.js / js/core/core-game.js',false);
define('core.target','目標篩選','目標','核心共用效果的目標及數量上限。','js/combat/skill-effect-runtime.js');
define('core.hitCount','多段傷害','傷害','每個目標執行指定段數。','js/combat/skill-effect-runtime.js');
define('core.powerBasis','計算基準','條件','選擇倍率計算使用的生命、攻擊等基準。','js/combat/skill-effect-runtime.js');
define('core.damageResolution','傷害結算','傷害','一般、固定或真實傷害結算。','js/combat/skill-effect-runtime.js');
define('core.onHitStatus','命中／恢復後附加狀態','狀態','命中傷害、治療或護盾後按機率附加狀態。','js/combat/skill-effect-runtime.js');
define('core.induction','誘發技能','事件','一次誘發 1～2 個技能／槽位；禁止誘發再誘發。','js/skills/induction-runtime.js');
for(const [event,label] of Object.entries({targetTurnEnd:'受術者回合結束（含受控）',targetActionEnd:'受術者行動結束',targetDeath:'受術者死亡'}))define('event.'+event,label,'事件','可獨立複製至施加狀態技能；各事件共用標記次數，觸發後可移除，死亡連鎖使用佇列。','js/combat/event-trigger-runtime.js');
for(const event of ['kill','enemyDeath'])define('passiveEvent.'+event,event==='kill'?'擊殺連續追擊':'敵人死亡冷卻縮減','事件','常駐事件型被動，不占技能槽。','js/combat/event-trigger-runtime.js');
define('event.proc','普攻後觸發','事件','目前引擎的 proc 是普攻後觸發，不代表受擊觸發。','js/core/core-game.js',false);
function instances(sk,doc){
 const out=[],add=(id,key,parameters,slot,editable=true,extra={})=>{const def=defs.get(id);out.push({key,id,definition:def,parameters:copy(parameters),slot,editable,reusable:def.reusable&&editable,dependencies:[],...extra});};
 const core=sk.adapter.kind==='core',normal=core&&!sk.systemEffect&&common.includes(sk.effect);
 if(core){
  let id=sk.systemEffect?'system.'+sk.systemEffect:(common.includes(sk.effect)||sk.effect==='applyStatus'?'core.':'exclusive.')+sk.effect;
  if(!defs.has(id))define(id,'尚未結構化：'+(sk.effect||'未知'),'特殊機制','未辨識的處理器，保留原始設定，禁止單獨重用。','未辨識',false);
  add(id,'main',pick(sk,mainKeys),'main',true,{dependencies:sk.statusId?[{kind:'status',id:sk.statusId}]:[]});
  // systemEffect short-circuits the common handler; dormant fields are not advertised as running.
  if(normal){
   if(sk.target!==undefined)add('core.target','target',pick(sk,['target','maxTargets','targetLimit']),'target');
   if(['damage','drain'].includes(sk.effect)&&sk.hitCount!==undefined)add('core.hitCount','hitCount',pick(sk,['hitCount']),'hitCount');
   if(['damage','drain','heal','shield'].includes(sk.effect)&&sk.powerBasis!==undefined)add('core.powerBasis','powerBasis',pick(sk,['powerBasis']),'powerBasis');
   if(['damage','drain'].includes(sk.effect)&&sk.damageResolution!==undefined)add('core.damageResolution','damageResolution',pick(sk,['damageResolution']),'damageResolution');
   if(sk.onHitStatusId)add('core.onHitStatus','onHitStatus',pick(sk,['onHitStatusId','onHitStatusChance']),'onHitStatus',true,{dependencies:[{kind:'status',id:sk.onHitStatusId}]});
  }
  if(sk.tags?.includes('induce')||sk.induction||sk.effect==='induceSkill')add('core.induction','induction',pick(sk,['tags','induction']),'induction',true,{dependencies:(sk.induction?.targets||[]).filter(t=>t.kind==='skill').map(t=>({kind:'skill',id:t.skillId}))});
  if(sk.type==='proc')add('event.proc','proc',pick(sk,['procBaseChance','procChancePerLevel']),'trigger',false);
 }else if(sk.adapter.kind==='support'){
  const kind=sk.kind||'unknown',known=['attack','critical','guard','power','regen','fracture','weaken','vulnerable','followup','dotAttack','dotMaxHp','damageAmp','applyStatus'].includes(kind);
  const id='support.'+kind;define(id,({dotAttack:'行動前持續傷害（攻擊）',dotMaxHp:'行動前持續傷害（生命）',followup:'受擊後追加傷害',regen:'持續恢復',applyStatus:'施加自訂狀態'})[kind]||'輔助效果：'+kind,known?'狀態':'特殊機制','輔助技能的單一持續效果槽；保留施放目標。','js/skills/support-debuff.js / js/skills/status-maker.js',known);
  add(id,'support',pick(sk,[...supportKeys,'target']),'support',true,{dependencies:sk.statusId?[{kind:'status',id:sk.statusId}]:[]});
 }else{
  if(sk.eventPassive)add('passiveEvent.'+sk.eventPassive.event,'eventPassive',{eventPassive:sk.eventPassive},'eventPassive');
  for(const [i,e] of (sk.effects||[]).entries()){
   const known=Object.hasOwn(root.EmberwildPassives?.labels||{},e.key),id='passive.'+e.key;define(id,'被動：'+(root.EmberwildPassives?.labels?.[e.key]||e.key),known?'狀態':'特殊機制','被動常駐效果；目標方向須相容。','js/skills/passive-model.js',known);add(id,'passive:'+i,{effect:copy(e),target:sk.target,kind:sk.kind},'passive');
  }
 }
 // State internals are shown separately from the skill's application mechanism.
 for(const inst of [...out])for(const dep of inst.dependencies.filter(d=>d.kind==='status')){
  const state=doc.statusDefinitions?.find(s=>s.id===dep.id);if(!state)continue;
  for(const [i,t] of (state.triggers||[]).entries())add('event.'+t.event,'statusEvent:'+state.id+':'+t.event,{statusId:state.id,trigger:t,uses:state.uses,removeOnTrigger:state.removeOnTrigger,stackable:state.stackable,permanent:state.permanent,duration:state.duration,durationClock:state.durationClock},'statusEvent');
  for(const [i,e] of (state.periodic||[]).entries()){
   const id='status.periodic.'+e.kind;define(id,e.kind==='heal'?'狀態持續恢復':'狀態持續傷害','狀態','相關狀態內的週期效果。由施加狀態積木一併複製，不能獨立貼到技能。','js/skills/status-maker.js',false);add(id,inst.key+':periodic:'+i,{statusId:state.id,...copy(e)},'related',false,{related:true});
  }
  for(const [i,m] of (state.modifiers||[]).entries()){
   const id='status.modifier.'+m.kind;define(id,'狀態效果：'+m.kind,'狀態','相關狀態的增減益效果；透過施加狀態積木取用。','js/skills/status-maker.js',false);add(id,inst.key+':modifier:'+i,{statusId:state.id,...copy(m)},'related',false,{related:true});
  }
  if(state.control){const id='status.control.'+state.control.kind;define(id,'狀態控制：'+(names[state.control.kind]||state.control.kind),'狀態','相關狀態嵌入的控制處理器。','js/skills/status-maker.js',false);add(id,inst.key+':control',{statusId:state.id,...copy(state.control)},'related',false,{related:true});}
  for(const [field,name] of [['stackable','狀態疊加'],['uses','狀態觸發次數']])if(state[field]){const id='status.'+field;define(id,name,'條件','狀態定義的疊加或消耗次數設定，不是門檻比較或死亡事件。','js/skills/status-maker.js',false);add(id,inst.key+':'+field,{statusId:state.id,[field]:state[field],duration:state.duration},'related',false,{related:true});}
  if(state.tags?.includes('instant')){const id='status.instant';define(id,'施加時立即結算','事件','施加時額外結算一次 periodic。','js/skills/status-maker.js',false);add(id,inst.key+':instant',{statusId:state.id},'related',false,{related:true});}

 }
 return out;
}
function index(doc){const byMechanism=new Map(),bySkill=new Map();for(const sk of doc.skillSystem.definitions.filter(s=>!s.deleted)){const xs=instances(sk,doc);bySkill.set(sk.id,xs);for(const x of xs){if(!byMechanism.has(x.id))byMechanism.set(x.id,{...x.definition,skills:[],uses:0});const row=byMechanism.get(x.id);row.uses++;if(!row.skills.includes(sk.id))row.skills.push(sk.id);}}return {byMechanism,bySkill};}
function newId(prefix,used){let n=1;while(used.has(prefix+n))n++;return prefix+n;}
function allocate(doc,sk){const kind=sk.adapter.kind,used=new Set(doc.skillSystem.definitions.flatMap(s=>s.adapters||[s.adapter]).filter(a=>a.kind===kind).map(a=>a.job+':'+a.index));const adapters=kind==='passive'?[{job:sk.jobs[0],kind,index:doc.passiveDefinitions.length}]:sk.jobs.map(job=>{let index=kind==='core'?doc.classes[job].skills.length:doc.supportSkills[job].length;while(used.has(job+':'+index))index++;if(index>=64)throw Error('此職業技能池已滿（最多 64）');return {job,kind,index};});sk.adapter=adapters[0];delete sk.adapters;if(adapters.length>1)sk.adapters=adapters;return sk;}
function cloneStates(doc,skill){const map=new Map();for(const key of ['statusId','onHitStatusId'])if(skill[key]){const id=skill[key],src=doc.statusDefinitions?.find(s=>s.id===id);if(!src)throw Error('缺少狀態來源：'+id);if(!map.has(id)){const fresh=newId('copied-status-',new Set(doc.statusDefinitions.map(s=>s.id)));doc.statusDefinitions.push({...copy(src),id:fresh,name:src.name+'（副本）'});map.set(id,fresh);}skill[key]=map.get(id);}return skill;}
function duplicate(doc,id){const next=copy(doc),src=next.skillSystem.definitions.find(s=>s.id===id);if(!src)throw Error('技能不存在');const sk=allocate(next,copy(src));sk.id=newId('custom-skill-',new Set(next.skillSystem.definitions.map(s=>s.id)));sk.name=(sk.name.slice(0,72)+'（副本）');delete sk.deleted;cloneStates(next,sk);next.skillSystem.definitions.push(sk);return {document:next,skillId:sk.id,warnings:instances(src,doc).filter(x=>!x.reusable).map(x=>x.definition.name+'：'+x.definition.description).concat((sk.induction?.targets||[]).filter(t=>t.kind==='skill').map(t=>'保留外部技能引用：'+t.skillId))};}
function blank(doc,job=0,type='active'){
 const next=copy(doc),sk={id:newId('custom-skill-',new Set(next.skillSystem.definitions.map(s=>s.id))),name:'新技能',description:'請設定機制與取得來源後再啟用。',type,jobs:[job],adapter:{job,kind:type==='support'?'support':type==='passive'?'passive':'core',index:0},sources:[{type:'quest',rewardOnly:true}],partnerId:null,usageScope:'character',requiredLevel:1,requiresAdvanced:false,disabled:true,unlockConditions:root.EmberwildSkillSystem.emptyConditions(),cooldown:3,power:0,powerPerLevel:0,element:'physical',maxTargets:1,baseCritRate:0,baseCritDamage:1.5,defensePenetration:0,defenseIgnore:0,requiredMastery:null,requiredMasteryLevel:0,mastery:null,weaponTypes:[]};
 if(type==='support')Object.assign(sk,{kind:'guard',target:'allies',value:0,duration:1,level:1,effectPerLevel:0});else if(type==='passive')Object.assign(sk,{kind:'buff',target:'self',effects:[{key:'flatAttack',value:0}]});else Object.assign(sk,{activation:type,effect:'damage',target:'enemy',commonEffectKeys:['target'],...(type==='proc'?{procBaseChance:0,procChancePerLevel:0}:{})});allocate(next,sk);next.skillSystem.definitions.push(sk);return {document:next,skillId:sk.id};
}
function check(doc){
 root.EmberwildSkillSystem.project(doc);const issues=[];
 for(const sk of doc.skillSystem.definitions){
  if(sk.adapter.kind==='core'){
   if(sk.systemEffect){if(sk.usageScope&&!['character'].includes(sk.usageScope))issues.push(sk.id+'：systemEffect 只支援人物');}
   else issues.push(...root.EmberwildSkillEffects.validateSkill(sk,doc.statusDefinitions||[]).map(s=>sk.id+'：'+s));
   if(sk.effect==='applyStatus'&&!doc.statusDefinitions?.some(s=>s.id===sk.statusId))issues.push(sk.id+'：缺少狀態來源');
  }
 }
 issues.push(...root.EmberwildInduction.validate(doc));if(issues.length)throw Error(issues.join('\n'));return doc;
}
function transfer(doc,sourceId,keys,targetId,options={}){
 const next=copy(doc),src=next.skillSystem.definitions.find(s=>s.id===sourceId),dst=next.skillSystem.definitions.find(s=>s.id===targetId);if(!src||!dst)throw Error('來源或目標技能不存在');
 const xs=instances(src,next),selected=[...new Set(keys)].map(key=>{const x=xs.find(x=>x.key===key);if(!x||!x.reusable)throw Error('此機制僅可查看，無法獨立重用：'+key);return x;});if(!selected.length)throw Error('請選擇機制');
 const changes=[],deps=[],conflicts=[],eventStates=new Set();
 for(const x of selected){
  if(x.slot==='eventPassive'){
   if(dst.type!=='passive')throw Error('事件被動需要被動技能');
   if(dst.eventPassive&&JSON.stringify(dst.eventPassive)!==JSON.stringify(x.parameters.eventPassive)&&!options.replace)throw Error('將替換事件被動，請允許替換');
   dst.eventPassive=copy(x.parameters.eventPassive);changes.push({mechanism:x.id,values:copy(x.parameters)});continue;
  }
  if(x.slot==='statusEvent'){
   if(!['active','proc','support'].includes(dst.type))throw Error('狀態事件需要施加狀態技能');
   let state=next.statusDefinitions.find(s=>s.id===dst.statusId);
   if(state&&!eventStates.has(state.id)&&next.skillSystem.definitions.some(s=>s.id!==dst.id&&(s.statusId===state.id||s.onHitStatusId===state.id))){
    state={...copy(state),id:newId('event-status-',new Set(next.statusDefinitions.map(s=>s.id))),name:state.name+'（副本）'};next.statusDefinitions.push(state);dst.statusId=state.id;
   }
   if(!state){const id=newId('event-status-',new Set(next.statusDefinitions.map(s=>s.id)));state={id,name:dst.name+'標記',tags:[],polarity:'debuff',dispellable:true,modifiers:[],periodic:[],control:null,triggers:[]};next.statusDefinitions.push(state);dst.statusId=id;}
   eventStates.add(state.id);
   const p=x.parameters,old=state.triggers?.find(t=>t.event===p.trigger.event);
   if(old&&JSON.stringify(old)!==JSON.stringify(p.trigger)&&!options.replace)throw Error('將替換同時機的狀態事件，請允許替換');
   for(const k of ['uses','removeOnTrigger','stackable','permanent','duration','durationClock'])state[k]=copy(p[k]);
   state.triggers=(state.triggers||[]).filter(t=>t.event!==p.trigger.event).concat(copy(p.trigger));
   for(const k of commonKeys)delete dst[k];dst.commonEffectKeys=[];dst.statusTarget='enemies';
   if(dst.type==='support'){dst.kind='applyStatus';dst.target='enemies';}else {dst.effect='applyStatus';delete dst.systemEffect;}
   changes.push({mechanism:x.id,statusId:state.id,trigger:copy(p.trigger)});continue;
  }
  if(x.slot==='passive'){if(dst.type!=='passive'||dst.target!==x.parameters.target)throw Error('被動機制需要相同目標方向的被動技能');dst.effects.push(copy(x.parameters.effect));changes.push({mechanism:x.id,append:x.parameters.effect});continue;}
  if((x.slot==='support')!==(dst.type==='support')||dst.type==='passive')throw Error('核心／輔助／被動技能引擎不相容');
  const values=copy(x.parameters),fields=x.slot==='main'?mainKeys:x.slot==='support'?[...supportKeys,'target']:Object.keys(values);
  if(x.slot==='main'&&dst.effect==='induceSkill')throw Error('誘發專屬主效果需先在技能設定中調整，避免遺失誘發流程');
  for(const k of fields)if(dst[k]!==undefined&&JSON.stringify(dst[k])!==JSON.stringify(values[k]))conflicts.push(k);
  if(x.slot==='induction'){
   // Preserve unrelated tags; only the induce tag belongs to this mechanism.
   values.tags=[...new Set([...(dst.tags||[]),'induce'])];
   for(const t of values.induction?.targets||[])if(t.kind==='skill'){
    const chosen=options.skillMap?.[t.skillId];if(!chosen)throw Error('請明確指定誘發技能相依：'+t.skillId);t.skillId=chosen;const ref=next.skillSystem.definitions.find(s=>s.id===chosen);
    if(!ref||ref.id===dst.id||ref.partnerId!==dst.partnerId||!dst.jobs.every(j=>ref.jobs.includes(j)))throw Error('誘發目標角色／職業不相容');deps.push({kind:'skill',source:x.dependencies.find(d=>d.id===chosen)?.id||chosen,target:chosen});
   }
  }
  for(const dep of x.dependencies.filter(d=>d.kind==='status')){
   const mode=options.statusMode;if(!['clone','existing'].includes(mode))throw Error('請選擇複製相依狀態或重新指定既有狀態：'+dep.id);
   const key=values.onHitStatusId?'onHitStatusId':'statusId';
   if(mode==='existing'){const id=options.statusMap?.[dep.id];if(!next.statusDefinitions?.some(s=>s.id===id))throw Error('請指定有效的目標狀態');values[key]=id;}
   else cloneStates(next,values);
   deps.push({kind:'status',source:dep.id,target:values[key],mode});
  }
  for(const k of fields)delete dst[k];Object.assign(dst,values);
  if(x.slot==='main'){
   // A changed main handler cannot silently retain incompatible optional behavior.
   for(const k of commonKeys)if(dst[k]!==undefined&&!fields.includes(k)&&!selected.some(s=>Object.hasOwn(s.parameters,k))){
    if((!common.includes(dst.effect)&&dst.effect!=='applyStatus')||dst.systemEffect||(root.EmberwildSkillEffects.validateSkill(dst,next.statusDefinitions||[]).length))throw Error('目標含不相容的 '+k+'；請先移除或調整目標機制');
   }
  }
  changes.push({mechanism:x.id,fields,values:copy(values)});
 }
 for(const x of selected)if(['target','hitCount','powerBasis','damageResolution','onHitStatus'].includes(x.slot)){if(dst.systemEffect||!common.includes(dst.effect))throw Error('目標處理器不支援共用選項：'+x.id);if(x.slot==='hitCount'&&!['damage','drain'].includes(dst.effect))throw Error('多段傷害需要傷害／吸血效果');if(x.slot==='onHitStatus'&&!['damage','drain','heal','shield'].includes(dst.effect))throw Error('附加狀態需要傷害、治療或護盾');}
 if(conflicts.length&&!options.replace)throw Error('會替換既有欄位：'+[...new Set(conflicts)].join('、')+'；請勾選明確替換');
 if(dst.adapter.kind==='core'&&!dst.systemEffect&&common.includes(dst.effect))dst.commonEffectKeys=commonKeys.filter(k=>dst[k]!==undefined);
 check(next);return {document:next,skillId:dst.id,changes,dependencies:deps,conflicts:[...new Set(conflicts)]};
}
function compatible(id,sk){if(!sk)return false;if(id.startsWith('passiveEvent.'))return sk.type==='passive';if(id.startsWith('event.target'))return ['active','proc','support'].includes(sk.type);if(id.startsWith('passive.'))return sk.type==='passive';if(id.startsWith('support.'))return sk.type==='support';if(!['active','proc'].includes(sk.type))return false;if(id.startsWith('system.'))return sk.usageScope==='character';if(['core.hitCount','core.damageResolution'].includes(id))return !sk.systemEffect&&['damage','drain'].includes(sk.effect);if(['core.onHitStatus','core.powerBasis'].includes(id))return !sk.systemEffect&&['damage','drain','heal','shield'].includes(sk.effect);return !sk.systemEffect;}
root.EmberwildMechanisms={definitions:defs,compatible,instances,index,duplicate,blank,transfer,check,copy,mainKeys};
})(globalThis);
