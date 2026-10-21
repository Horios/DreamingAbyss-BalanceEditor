/* Embedded after the existing editor. All authoring targets the canonical IDs. */
(()=>{
 'use strict';
 const M=EmberwildSkillSystem,copy=M.copy;
 let section='skills',selection='',query='';
 function ensure(d){if(!d.skillSystem)d.skillSystem=M.fromLegacy(d);M.project(d);return d.skillSystem;}
 ensure(ORIGINAL_DATA);ensure(data);
 const ensureBase=ensureArrays;ensureArrays=function(...args){const out=ensureBase(...args);ensure(data);return out;};
 function issueList(){try{M.project(copy(data));return [];}catch(e){return [e.message];}}
 const validateBase=validateData;validateData=function(){try{ensure(data);}catch(e){return [e.message];}return [...new Set([...validateBase(),...issueList()])];};
 const exportBase=__EMBERWILD_MASTERY_EDITOR.cleanExport;__EMBERWILD_MASTERY_EDITOR.cleanExport=function(){ensure(data);const out=exportBase();out.skillSystem=copy(data.skillSystem);out.balanceSettings.meta.skillSystemVersion=1;return M.project(out);};
 const labels={active:'主動',proc:'觸發',support:'輔助',passive:'被動'},sourceLabels={class:'職業',advanced:'二轉',quest:'任務',equipment:'裝備',companion:'夥伴'};
 function references(id){const s=data.skillSystem,out=[];for(const r of s.classRules)for(const k of ['initial','advanced'])if(r[k].some(x=>x.skillId===id))out.push('職業 '+r.job+' '+k);if(s.equipment.pool.some(x=>x.skillId===id)||s.equipment.formRules?.some(x=>x.skillId===id))out.push('裝備技能池');for(const sk of s.definitions)if(sk.induction?.targets?.some(x=>x.skillId===id))out.push('誘發技能 '+sk.name);for(const mon of data.balanceSettings.monsters.catalog)if(mon.skillAssignments?.some(x=>x.skillId===id))out.push('怪物 '+mon.name);const sk=s.definitions.find(x=>x.id===id);if(sk){const a=sk.adapter;for(const p of data.companions)if(p.core?.includes(a.index)&&a.kind==='core'&&p.job===a.job||p.support?.includes(a.index)&&a.kind==='support'&&p.job===a.job||p.passives?.includes(id))out.push('夥伴 '+p.name);for(const cls of data.equipmentForms||[])for(const forms of cls)for(const form of forms)if(form.fixedEffects?.some(x=>['skillEffectPct','skillCooldownReduction'].includes(x.key)&&x.skill===a.index)&&a.kind==='core')out.push('裝備詞條 '+form.name);}return out;}
 function updateSkill(id,patch){const s=copy(data.skillSystem),i=s.definitions.findIndex(x=>x.id===id);if(i<0)return false;const old=s.definitions[i];s.definitions[i]={...old,...copy(patch),id:old.id,adapter:old.adapter};M.project({...copy(data),skillSystem:s});data.skillSystem=s;M.project(data);markDirty('已修改技能 '+old.name);return true;}
 function addSkill(job=0,type='active'){
  const s=copy(data.skillSystem),kind=type==='support'?'support':type==='passive'?'passive':'core',index=kind==='core'?data.classes[job].skills.length:kind==='support'?data.supportSkills[job].length:data.passiveDefinitions.length;
  const template=s.definitions.find(x=>x.type===type&&(x.jobs.includes(job)||type==='passive'));if(!template)throw Error('請先建立此類型技能範本');
  let serial=1;while(s.definitions.some(x=>x.id==='custom-skill-'+serial))serial++;
  const sk={...copy(template),id:'custom-skill-'+serial,name:'新技能',description:'',jobs:[job],adapter:{job,kind,index},sources:[{type:'quest',questIds:['tutorial']}],partnerId:null,requiredLevel:1,requiresAdvanced:false,disabled:false,unlockConditions:M.emptyConditions()};
  s.definitions.push(sk);M.project({...copy(data),skillSystem:s});data.skillSystem=s;M.project(data);selection=sk.id;markDirty('已新增技能');return sk.id;
 }
 function deleteSkill(id){const refs=references(id);if(refs.length)throw Error('技能仍被引用：'+refs.join('、'));return updateSkill(id,{disabled:true,deleted:true});}
 function applyPart(part,value){const s=copy(data.skillSystem);s[part]=copy(value);M.project({...copy(data),skillSystem:s});data.skillSystem=s;M.project(data);markDirty('已修改 '+part);return true;}
 function iconMetadata(sk){const a=sk.adapter;return __EMBERWILD_INVENTORY_ICON_EDITOR.settings('skill',`${a.kind}:${a.job}:${a.index}`);}
 function skillForm(sk){return `<h2>${esc(sk.name)}</h2><p class="mini-note">ID：${esc(sk.id)} · ${labels[sk.type]} · 來源：${sk.sources.map(x=>sourceLabels[x.type]).join('／')}</p>${__EMBERWILD_COLOR_EDITOR.control('skillPalette',iconMetadata(sk))}<label>名稱<input id="canonicalSkillName" value="${esc(sk.name)}"></label><label>說明<textarea id="canonicalSkillDescription">${esc(sk.description||'')}</textarea></label><label><input id="canonicalSkillDisabled" type="checkbox" ${sk.disabled?'checked':''}>停用</label><p class="mini-note">以下可編輯類型、職業限制、圖示、目標、倍率、冷卻、元素、觸發、取得來源與既有效果參數。ID 與引擎索引固定；變更類型時須保留對應的核心／輔助／被動引擎。</p><textarea id="canonicalSkillJSON" class="canonical-json" spellcheck="false">${esc(JSON.stringify(sk,null,2))}</textarea><div class="actions"><button id="canonicalSkillApply">套用技能設定</button><button id="canonicalSkillDelete">刪除未引用技能</button></div><p class="mini-note">刪除會保留停用的 ID 對照，供既有存檔安全遷移。</p>`;}
 function page(){
  const s=ensure(data),app=document.getElementById('app'),tabs=[['skills','技能資料庫'],['classRules','職業解鎖與槽位'],['equipment','裝備技能與孔數'],['gems','寶石雙模式']];
  let body='';
  if(section==='skills'){
   const list=s.definitions.filter(x=>!x.deleted&&(!query||(x.name+' '+x.id+' '+x.type+' '+x.sources.map(s=>s.type).join(' ')).toLowerCase().includes(query.toLowerCase()))),sk=s.definitions.find(x=>x.id===selection)||list[0];selection=sk?.id||'';
   body=`<div class="canonical-editor-layout"><section class="card"><div class="card-b"><input id="canonicalSkillSearch" aria-label="搜尋技能" placeholder="搜尋名稱、ID、類型或來源" value="${esc(query)}"><label>新增技能職業<select id="canonicalNewJob">${data.classes.map((c,j)=>`<option value="${j}">${esc(c.name)}</option>`).join('')}</select></label><label>新增技能類型<select id="canonicalNewType">${Object.entries(labels).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></label><button id="canonicalAddSkill">新增技能</button><div class="canonical-skill-list">${list.map(x=>`<button type="button" data-canonical-skill="${esc(x.id)}" aria-pressed="${x.id===selection}"><b>${esc(x.name)}</b><small>${labels[x.type]} · ${x.sources.map(y=>sourceLabels[y.type]).join('／')}${x.disabled?' · 已停用':''}</small></button>`).join('')}</div></div></section><section class="card"><div class="card-b">${sk?skillForm(sk):'尚無技能'}</div></section></div>`;
  }else{
   const help={classRules:'各職業 initial／advanced 以 skillId 引用技能；level 設定解鎖等級。slots.first／advanced 設定一轉與二轉槽數。',equipment:'chanceByDifficulty 是三難度附技機率；pool 設定技能、職業、部位、等級、地區、怪物、BOSS、權重及商店／製作限制。formRules 可指定 formId、固定 skillId、allowSkill、skillChance。socketBands／sourceRules 設定等級與來源的零至三孔機率。',gems:'五種寶石保留三階。base 設定 stat、unit（flat／ratio）及 values；skill 設定效果 key、三階 values、相容 types／effects、可用 slots（0～2）；cap 設定加成上限。'};
   body=`<section class="card"><div class="card-b"><p>${help[section]}</p><textarea id="canonicalPartJSON" class="canonical-json" spellcheck="false">${esc(JSON.stringify(s[section],null,2))}</textarea><button id="canonicalPartApply">驗證並套用</button></div></section>`;
  }
  app.innerHTML=sectionHead('技能、裝備與寶石','技能 ID 是共用引用；此頁編輯後沿用既有草稿、匯入匯出、差異比較及發布管理。','')+`<div class="actions">${tabs.map(([id,label])=>`<button data-canonical-tab="${id}" class="${id===section?'primary':''}">${label}</button>`).join('')}</div><p id="canonicalError" role="status"></p>`+body;
  app.querySelectorAll('[data-canonical-tab]').forEach(b=>b.onclick=()=>{section=b.dataset.canonicalTab;render();});
  const bind=(id,fn)=>{const b=document.getElementById(id);if(b)b.onclick=()=>{try{fn();render();}catch(e){document.getElementById('canonicalError').textContent=e.message;}};};
  if(section==='skills'){
   const sk=s.definitions.find(x=>x.id===selection);if(sk)__EMBERWILD_COLOR_EDITOR.bind('skillPalette',iconMetadata(sk),patch=>{const a=sk.adapter;__EMBERWILD_INVENTORY_ICON_EDITOR.set('skill',`${a.kind}:${a.job}:${a.index}`,iconMetadata(sk).iconType||'auto',patch);});
   document.getElementById('canonicalSkillSearch').oninput=e=>{query=e.target.value;page();};
   app.querySelectorAll('[data-canonical-skill]').forEach(b=>b.onclick=()=>{selection=b.dataset.canonicalSkill;render();});
   bind('canonicalAddSkill',()=>addSkill(Number(document.getElementById('canonicalNewJob').value),document.getElementById('canonicalNewType').value));
   bind('canonicalSkillApply',()=>{const next=JSON.parse(document.getElementById('canonicalSkillJSON').value);next.name=document.getElementById('canonicalSkillName').value;next.description=document.getElementById('canonicalSkillDescription').value;next.disabled=document.getElementById('canonicalSkillDisabled').checked;updateSkill(selection,next);});
   bind('canonicalSkillDelete',()=>deleteSkill(selection));
  }else bind('canonicalPartApply',()=>applyPart(section,JSON.parse(document.getElementById('canonicalPartJSON').value)));
 }
 SECTION_META.push(['skillSystem','技能、裝備與寶石']);NAV_GROUPS.find(g=>g[0]==='skillsCombat')[2].unshift('skillSystem');
 const renderBase=render;render=function(...args){if(['skills','passives'].includes(currentSection)){const kind=currentSection==='passives'?'passive':selected.skillTab==='support'?'support':'core',job=kind==='support'?selected.supportClass:selected.skillClass,index=kind==='passive'?selected.passive:kind==='support'?selected.support:selected.skill;const sk=data.skillSystem.definitions.find(x=>x.adapter.kind===kind&&x.adapter.job===job&&x.adapter.index===index);if(sk)selection=sk.id;section='skills';currentSection='skillSystem';}if(currentSection!=='skillSystem'){const out=renderBase(...args);if(!document.getElementById('app').innerHTML.includes('class="workbench-route"')){globalThis.__EMBERWILD_EXPERIENCE?.refreshSearch();globalThis.__EMBERWILD_EXPERIENCE?.afterPage();}return out;}ensureArrays();renderNav(true);page();globalThis.__EMBERWILD_EXPERIENCE?.refreshSearch();globalThis.__EMBERWILD_EXPERIENCE?.afterPage();};
 const countBase=count;count=function(key,...args){return key==='skillSystem'?data.skillSystem?.definitions.filter(x=>!x.deleted).length||0:countBase(key,...args);};
 const designer=globalThis.__EMBERWILD_MONSTER_DESIGNER,assignBase=designer?.assignSkill;if(assignBase)designer.assignSkill=function(monster,id,...args){const sk=data.skillSystem.definitions.find(x=>x.id===id),previous=sk?.usageScope;if(sk){sk.usageScope='shared';M.project(data);}try{return assignBase(monster,id,...args);}catch(e){if(sk){sk.usageScope=previous;M.project(data);}throw e;}};
 globalThis.__EMBERWILD_SKILL_SYSTEM_EDITOR={system:()=>ensure(data),updateSkill,addSkill,deleteSkill,applyPart,references,issues:issueList,select(part='skills',id=''){section=part;if(id)selection=id;currentSection='skillSystem';render();}};
 requestEditorInitialRender();
})();
