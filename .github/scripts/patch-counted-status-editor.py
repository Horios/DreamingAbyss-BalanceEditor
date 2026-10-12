from pathlib import Path

path=Path('balance-editor.html')
text=path.read_text(encoding='utf-8')
text=text.replace('實際遊戲的 supportLevels 固定 3 格、supportSlots 只允許索引 0~2，因此每職業固定三個輔助技能；這裡只允許修改內容，不提供增刪。','遊戲會依各職業目前的輔助技能池長度讀取 supportLevels；這裡可修改現有技能內容，不另外提供技能池增刪。')
marker='<script id="counted-status-targeting-editor-extension">'
if marker not in text:
    ext=r'''
<script id="counted-status-targeting-editor-extension">
/* Advanced reusable status mechanics: counted uses, stacking, ranked targets and damage spread. */
(function installCountedStatusTargetingEditor(){
  if(!STATUS_MODIFIER_KINDS.includes('damageSpread'))STATUS_MODIFIER_KINDS.push('damageSpread');
  STATUS_MODIFIER_LABELS.damageSpread='單體技能傷害擴散';
  STATUS_HERO_ONLY_MODIFIERS.add('damageSpread');
  for(const mode of ['rankedAllies','rankedEnemies'])if(!STATUS_TARGETS.includes(mode))STATUS_TARGETS.push(mode);
  Object.assign(STATUS_TARGET_LABELS,{rankedAllies:'依能力排序的我方單位',rankedEnemies:'依能力排序的敵方單位'});
  if(typeof SUPPORT_KINDS!=='undefined'&&!SUPPORT_KINDS.includes('applyStatus'))SUPPORT_KINDS.push('applyStatus');
  if(typeof SUPPORT_KIND_LABELS!=='undefined')SUPPORT_KIND_LABELS.applyStatus='套用自訂狀態';
  if(typeof SUPPORT_TARGETS!=='undefined')for(const mode of ['rankedAllies','rankedEnemies'])if(!SUPPORT_TARGETS.includes(mode))SUPPORT_TARGETS.push(mode);
  if(typeof SUPPORT_TARGET_LABELS!=='undefined')Object.assign(SUPPORT_TARGET_LABELS,{rankedAllies:'依能力排序的我方單位',rankedEnemies:'依能力排序的敵方單位'});

  const ADV_STATUS_STATS=['attack','defense','maxHp','currentHp','missingHp','shield','level','crit'];
  const ADV_STATUS_STAT_LABELS={attack:'攻擊力',defense:'防禦力',maxHp:'最大生命',currentHp:'目前生命',missingHp:'已損生命',shield:'護盾',level:'等級',crit:'暴擊率'};
  const ADV_STATUS_ORDERS=['highest','lowest'];
  const ADV_STATUS_ORDER_LABELS={highest:'最高',lowest:'最低'};
  const PAIN_STATUS={id:'pain-spread',name:'苦痛蔓延',polarity:'buff',dispellable:true,tags:['modifier'],duration:99,uses:1,stackable:false,modifiers:[{kind:'damageSpread',value:.30,targets:2}],control:null,periodic:[]};
  const PAIN_SUPPORT={id:'pain-spread',name:'苦痛蔓延',description:'指定攻擊力最高的夥伴，使其下一次單體技能對額外最多 2 名敵人造成 30% 傷害。',target:'rankedAllies',statusTarget:'rankedAllies',statusTargetStat:'attack',statusTargetOrder:'highest',statusTargetIncludeSelf:false,kind:'applyStatus',statusId:'pain-spread',element:'light',value:0,effectPerLevel:0,duration:99,cooldown:16,level:1};

  const advNormalizeBase=normalizeStatusDefinition;
  normalizeStatusDefinition=function(raw,index=0){
    const source=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{},out=advNormalizeBase(source,index);
    out.uses=statusInt(source.uses,0,0,99);
    out.stackable=source.stackable===true;
    out.modifiers=out.modifiers.map((m,i)=>{if(m.kind==='damageSpread')m.targets=statusInt(source.modifiers?.[i]?.targets,2,1,99);return m;});
    return out;
  };
  const advValidateStatusBase=validateStatusDefinition;
  validateStatusDefinition=function(raw){
    const issues=advValidateStatusBase(raw),s=normalizeStatusDefinition(raw);
    if(!Number.isInteger(s.uses)||s.uses<0||s.uses>99)issues.push('觸發次數必須介於 0～99');
    if(typeof s.stackable!=='boolean')issues.push('可疊加必須是布林值');
    for(const m of s.modifiers)if(m.kind==='damageSpread'){
      if(!Number.isFinite(m.value)||m.value<0)issues.push('傷害擴散比例不可為負數');
      if(!Number.isInteger(m.targets)||m.targets<1||m.targets>99)issues.push('傷害擴散目標數必須介於 1～99');
    }
    return issues;
  };
  const advAllowedTargetsBase=statusAllowedTargetsForDefinition;
  statusAllowedTargetsForDefinition=function(def){
    const out=advAllowedTargetsBase(def);
    if(out.includes('allies')&&!out.includes('rankedAllies'))out.push('rankedAllies');
    if(out.includes('enemies')&&!out.includes('rankedEnemies'))out.push('rankedEnemies');
    return out;
  };

  const advModifierRuleBase=statusModifierRuleText;
  statusModifierRuleText=function(m){
    if(m?.kind==='damageSpread')return '下一次符合條件的單體傷害技能，對額外 '+Math.max(1,Number(m.targets)||1)+' 名敵人造成原技能實際傷害的 '+Number(((Number(m.value)||0)*100).toFixed(2))+'%；目前會消耗 1 次次數。';
    return advModifierRuleBase(m);
  };
  const advPreviewBase=statusPreview;
  statusPreview=function(s){
    const n=normalizeStatusDefinition(s),base=advPreviewBase(n),bits=[];
    for(const m of n.modifiers)if(m.kind==='damageSpread')bits.push('擴散：'+Number((m.value*100).toFixed(2))+'% → 額外 '+m.targets+' 名敵人');
    bits.push('觸發次數：'+(n.uses>0?n.uses+' 次':'不使用次數限制'));
    bits.push('疊加：'+(n.stackable?'可疊加':'不可疊加（再次套用會刷新同名狀態）'));
    return [base,...bits].filter(Boolean).join('\n');
  };
  modifierRowsHtml=function(s){return s.modifiers.map((m,i)=>'<div class="status-maker-row" data-status-mod-row="'+i+'"><label>效果<select data-status-mod-kind>'+labelOptions(STATUS_MODIFIER_KINDS,STATUS_MODIFIER_LABELS,m.kind)+'</select></label><label>數值<input data-status-mod-value type="number" step="0.001" value="'+esc(m.value)+'"></label>'+(m.kind==='followup'?'<label>追打元素<select data-status-mod-element>'+labelOptions(STATUS_ELEMENTS,STATUS_ELEMENT_LABELS,m.element||'physical')+'</select></label>':m.kind==='damageSpread'?'<label>額外目標數<input data-status-mod-targets type="number" min="1" max="99" step="1" value="'+esc(m.targets??2)+'"></label>':'<div class="mini-note">0.20 = 20%</div>')+'<div></div><div></div><button type="button" class="danger" data-status-mod-del="'+i+'">刪除</button><div class="mini-note status-maker-row-help">'+esc(statusModifierRuleText(m))+'</div></div>').join('');};

  function ensureAdvancedSkillFields(sk){
    if(!sk||((sk.effect!=='applyStatus')&&(sk.kind!=='applyStatus')))return;
    sk.statusTarget=sk.statusTarget||sk.target||'enemy';
    sk.target=sk.target||sk.statusTarget;
    if(!ADV_STATUS_STATS.includes(sk.statusTargetStat))sk.statusTargetStat='attack';
    if(!ADV_STATUS_ORDERS.includes(sk.statusTargetOrder))sk.statusTargetOrder='highest';
    if(typeof sk.statusTargetIncludeSelf!=='boolean')sk.statusTargetIncludeSelf=false;
  }
  const advEnsureBase=ensureArrays;
  ensureArrays=function(){
    const out=advEnsureBase();
    data.statusDefinitions=Array.isArray(data.statusDefinitions)?data.statusDefinitions.map((x,i)=>normalizeStatusDefinition(x,i)):[];
    if(!data.statusDefinitions.some(x=>x.id==='pain-spread'))data.statusDefinitions.push(normalizeStatusDefinition(PAIN_STATUS,data.statusDefinitions.length));
    while(data.supportSkills.length<data.classes.length)data.supportSkills.push([]);
    if(data.supportSkills[3]&&!data.supportSkills[3].some(x=>x?.statusId==='pain-spread'||x?.id==='pain-spread'))data.supportSkills[3].push(structuredClone(PAIN_SUPPORT));
    for(const c of data.classes||[])for(const sk of c.skills||[])ensureAdvancedSkillFields(sk);
    for(const list of data.supportSkills||[])for(const sk of list||[])ensureAdvancedSkillFields(sk);
    return out;
  };

  function rankedFieldsHtml(sk,prefix){
    const target=sk.statusTarget||sk.target||'enemy';if(!['rankedAllies','rankedEnemies'].includes(target))return '';
    return '<div class="field"><label>排序能力</label><select id="'+prefix+'StatusTargetStat">'+labelOptions(ADV_STATUS_STATS,ADV_STATUS_STAT_LABELS,sk.statusTargetStat||'attack')+'</select><div class="field-help">以此能力決定自動指定對象。</div></div>'+
      '<div class="field"><label>排序方向</label><select id="'+prefix+'StatusTargetOrder">'+labelOptions(ADV_STATUS_ORDERS,ADV_STATUS_ORDER_LABELS,sk.statusTargetOrder||'highest')+'</select><div class="field-help">可指定數值最高或最低的單位。</div></div>'+
      (target==='rankedAllies'?'<div class="field"><label>包含自己</label><select id="'+prefix+'StatusTargetIncludeSelf"><option value="false" '+(!sk.statusTargetIncludeSelf?'selected':'')+'>否</option><option value="true" '+(sk.statusTargetIncludeSelf?'selected':'')+'>是</option></select><div class="field-help">關閉時只從其他存活夥伴中選擇。</div></div>':'');
  }
  function bindRankedFields(sk,prefix){
    const stat=document.getElementById(prefix+'StatusTargetStat');if(stat)stat.onchange=e=>{sk.statusTargetStat=e.target.value;markDirty();};
    const order=document.getElementById(prefix+'StatusTargetOrder');if(order)order.onchange=e=>{sk.statusTargetOrder=e.target.value;markDirty();};
    const self=document.getElementById(prefix+'StatusTargetIncludeSelf');if(self)self.onchange=e=>{sk.statusTargetIncludeSelf=e.target.value==='true';markDirty();};
  }

  const advRenderStatusesBase=renderStatuses;
  renderStatuses=function(){
    advRenderStatusesBase();const list=statusList(),s=list[selectedStatusIndex];if(!s)return;const app=document.getElementById('app'),duration=document.getElementById('statusDuration');
    if(duration){const field=duration.closest('.field');field?.insertAdjacentHTML('afterend','<div class="field"><label>觸發次數</label><input id="statusUses" type="number" min="0" max="99" step="1" value="'+esc(s.uses??0)+'"><div class="field-help">0 代表不使用次數限制；大於 0 會建立剩餘次數。支援次數消耗的事件效果會在觸發後扣除，目前「傷害擴散」會消耗 1 次。</div></div><div class="field"><label>可疊加</label><select id="statusStackable"><option value="false" '+(!s.stackable?'selected':'')+'>不可疊加</option><option value="true" '+(s.stackable?'selected':'')+'>可疊加</option></select><div class="field-help">不可疊加時，同名狀態再次套用會刷新為新的一份；可疊加時會保留多份獨立狀態。</div></div>');}
    document.getElementById('statusUses')?.addEventListener('change',e=>{s.uses=statusInt(e.target.value,s.uses??0,0,99);markDirty();render();});
    document.getElementById('statusStackable')?.addEventListener('change',e=>{s.stackable=e.target.value==='true';markDirty();render();});
    app.querySelectorAll('[data-status-mod-row]').forEach(row=>{const i=Number(row.dataset.statusModRow),input=row.querySelector('[data-status-mod-targets]');if(input)input.onchange=e=>{s.modifiers[i].targets=statusInt(e.target.value,s.modifiers[i].targets??2,1,99);markDirty();render();};});
    const del=document.getElementById('delStatus');if(del)del.onclick=()=>{const usedCore=(data.classes||[]).some(c=>(c.skills||[]).some(sk=>(sk.effect==='applyStatus'&&sk.statusId===s.id)||sk.onHitStatusId===s.id)),usedSupport=(data.supportSkills||[]).some(list=>(list||[]).some(sk=>sk.kind==='applyStatus'&&sk.statusId===s.id));if(usedCore||usedSupport)return alert('仍有技能引用此狀態。請先更換或移除技能的狀態引用。');if(confirmDelete('刪除狀態「'+s.name+'」？')){list.splice(selectedStatusIndex,1);selectedStatusIndex=Math.max(0,selectedStatusIndex-1);markDirty('已刪除狀態');render();}};
  };

  const advRenderSupportBase=renderSupport;
  renderSupport=function(){
    advRenderSupportBase();const group=data.supportSkills[selected.supportClass]||[],sk=group[selected.support];if(!sk)return;ensureAdvancedSkillFields(sk);const app=document.getElementById('app');
    const desc=app.querySelector('.section-head p');if(desc)desc.textContent='遊戲會依各職業目前的輔助技能池長度讀取 supportLevels；這裡可修改現有技能內容，不另外提供技能池增刪。';
    const kind=app.querySelector('[data-key="kind"]');if(kind){const old=kind.onchange;kind.onchange=()=>{old?.();if(sk.kind==='applyStatus'){sk.statusId=sk.statusId||statusList()[0]?.id||'';sk.statusTarget=sk.target||'allies';ensureAdvancedSkillFields(sk);}markDirty();render();};}
    const target=app.querySelector('[data-key="target"]');
    if(sk.kind==='applyStatus'){
      const defs=statusList(),def=defs.find(d=>d.id===sk.statusId)||null,allowed=statusAllowedTargetsForDefinition(def);if(!allowed.includes(sk.statusTarget||sk.target)){sk.statusTarget=allowed[0]||'';sk.target=sk.statusTarget;}
      if(target){target.innerHTML=labelOptions(allowed,STATUS_TARGET_LABELS,sk.statusTarget||sk.target);target.value=sk.statusTarget||sk.target;target.onchange=e=>{sk.target=e.target.value;sk.statusTarget=e.target.value;markDirty();render();};}
      const grid=app.querySelector('.grid2');if(grid){const box=document.createElement('div');box.className='card';box.id='support-status-link-card';box.innerHTML='<div class="card-h"><strong>自訂狀態套用</strong></div><div class="card-b"><div class="fields"><div class="field"><label>套用狀態</label><select id="supportStatusId"><option value="">請選擇</option>'+defs.map(d=>'<option value="'+esc(d.id)+'" '+(sk.statusId===d.id?'selected':'')+'>'+esc(d.name)+' · '+esc(d.id)+'</option>').join('')+'</select><div class="field-help">狀態本體只維護一份；輔助技能以 statusId 引用。</div></div>'+rankedFieldsHtml(sk,'support')+'</div><div class="mini-note">此類輔助技能的持續、次數、可否疊加與傷害擴散比例，都由引用的「狀態製作器」資料控制；施放冷卻與需求等級仍由本技能控制。</div></div>';grid.insertAdjacentElement('afterend',box);}
      document.getElementById('supportStatusId')?.addEventListener('change',e=>{sk.statusId=e.target.value;const next=statusList().find(d=>d.id===sk.statusId)||null,targets=statusAllowedTargetsForDefinition(next);if(!targets.includes(sk.statusTarget)){sk.statusTarget=targets[0]||'';sk.target=sk.statusTarget;}markDirty();render();});
      bindRankedFields(sk,'support');
    }else if(target){const old=target.onchange;target.onchange=()=>{old?.();markDirty();render();};}
  };

  const advRenderSkillsBase=renderSkills;
  renderSkills=function(){
    advRenderSkillsBase();if(selected.skillTab==='support')return;const sk=data.classes?.[selected.skillClass]?.skills?.[selected.skill];if(!sk||sk.effect!=='applyStatus')return;ensureAdvancedSkillFields(sk);const card=document.getElementById('status-skill-link-card');if(!card)return;
    const target=document.getElementById('skillStatusTarget');if(target)target.onchange=e=>{sk.statusTarget=e.target.value;sk.target=e.target.value;markDirty();render();};
    const fields=card.querySelector('.fields');if(fields&&['rankedAllies','rankedEnemies'].includes(sk.statusTarget||sk.target)){fields.insertAdjacentHTML('beforeend',rankedFieldsHtml(sk,'core'));bindRankedFields(sk,'core');}
  };

  function validateAdvancedSkill(sk,label,defs,issues){
    if(!sk||((sk.effect!=='applyStatus')&&(sk.kind!=='applyStatus')))return;
    const def=defs.find(x=>x.id===String(sk.statusId||'')),target=sk.statusTarget||sk.target||'enemy';
    if(!def){issues.push(label+' 引用不存在的狀態。');return;}
    if(!STATUS_TARGETS.includes(target))issues.push(label+' 的狀態目標無效。');
    else if(!statusAllowedTargetsForDefinition(def).includes(target))issues.push(label+' 的狀態效果與套用目標方向不相容。');
    if(['rankedAllies','rankedEnemies'].includes(target)){
      if(!ADV_STATUS_STATS.includes(sk.statusTargetStat))issues.push(label+' 的排序能力無效。');
      if(!ADV_STATUS_ORDERS.includes(sk.statusTargetOrder))issues.push(label+' 的排序方向無效。');
      if(typeof sk.statusTargetIncludeSelf!=='boolean')issues.push(label+' 的「包含自己」設定必須是布林值。');
    }
  }
  const advValidateDataBase=validateData;
  validateData=function(){
    const issues=advValidateDataBase();ensureArrays();const defs=statusList();
    for(const [job,c] of (data.classes||[]).entries())for(const [i,sk] of (c.skills||[]).entries())validateAdvancedSkill(sk,'角色 '+job+' 技能 '+i,defs,issues);
    for(const [job,list] of (data.supportSkills||[]).entries())for(const [i,sk] of (list||[]).entries())validateAdvancedSkill(sk,'角色 '+job+' 輔助技能 '+i,defs,issues);
    return [...new Set(issues)];
  };

  ensureArrays();requestEditorInitialRender();
})();
</script>
'''
    insert=text.rfind('</body>')
    if insert<0: insert=text.rfind('</html>')
    if insert<0: raise SystemExit('closing body/html not found')
    text=text[:insert]+ext+'\n'+text[insert:]
path.write_text(text,encoding='utf-8')
