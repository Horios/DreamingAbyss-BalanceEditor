/* Contextual presentation reuses the existing document, fields and publishing flow. */
(()=>{'use strict';
const style=document.createElement('style');style.id='v2-panel-style';style.textContent=`
:root{--bg:#192124;--panel:#1c272a;--panel2:var(--surface);--line:#354348;--text:#edf1ef;--muted:#adb9ba;--accent:var(--gold);--input:var(--inset);--workbench-top:0px!important}
html,body{background:var(--bg)}.topbar,#nav{display:none!important}.layout{display:block;min-height:100vh}.main{padding:14px;max-width:100%;overflow-x:clip}.workbench-route{padding:0 0 10px;margin-bottom:12px;background:transparent;position:static}.workbench-route strong,#workbenchPublish{display:none}.section-head{gap:8px;flex-wrap:wrap}.section-head h1{font-size:16px}.section-head p{font-size:12px}.section-actions{justify-content:flex-start;margin-left:0}.section-actions button{font-size:12px}.grid2,.world-layout,#catalogueWorkbench{grid-template-columns:minmax(0,1fr)!important}.listitem{display:block;width:100%;text-align:left;white-space:normal;overflow-wrap:anywhere}.listitem small{display:block;color:var(--muted);font-size:11px}.listitem.active{background:var(--selected);color:var(--text)}.list,.world-list,.inventory-icons-list{max-height:230px!important}.catalogue-center,#catalogueWorkbench .catalogue-center{position:static!important}.catalogue-filter-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}#catalogueFilters .catalogue-filter-grid{display:grid}.fields,.world-fields,.md-fields{grid-template-columns:repeat(2,minmax(0,1fr))!important}.field,.card,.card-b,.world-layout>*,.grid2>*,#catalogueWorkbench>*{min-width:0}.fields input,.fields select,.world-fields input,.world-fields select{min-width:0}.kvrow,.fixed-effect-row{grid-template-columns:repeat(2,minmax(0,1fr))!important}.ref-grid{grid-template-columns:1fr}.statgrid{grid-template-columns:repeat(2,minmax(0,1fr))}.toolbar select,.toolbar input{min-width:0;max-width:100%}button.primary{background:var(--primary);color:var(--on-primary);border-color:var(--control-border)}.card{box-shadow:none}.card-h{flex-wrap:wrap}#app{scroll-margin-top:0}.pathrow{grid-template-columns:1fr!important}.mini-note,.field-help{overflow-wrap:anywhere}@media(max-width:400px){.fields,.world-fields,.md-fields,.catalogue-filter-grid{grid-template-columns:1fr!important}}
`;document.head.append(style);const palette=document.createElement('link');palette.rel='stylesheet';palette.href='/v2-theme.css';document.head.append(palette);
const send=message=>parent.postMessage(message,location.origin);
let lastSection;const announce=()=>{if(lastSection!==currentSection){lastSection=currentSection;send({kind:'dreaming-abyss-dev-section',section:currentSection});}};
const renderBase=render;render=function(...args){const out=renderBase(...args);announce();return out;};
const dirtyBase=markDirty;markDirty=function(...args){const out=dirtyBase(...args);send({kind:'dreaming-abyss-dev-change'});return out;};
function sections(){const labels=new Map(SECTION_META),assigned=new Set(),groups=[];for(const [id,label,ids] of NAV_GROUPS){const pages=ids.filter(id=>labels.has(id)&&!assigned.has(id)).map(id=>{assigned.add(id);return {id,label:labels.get(id)};});if(pages.length)groups.push({id,label,pages});}const pages=SECTION_META.filter(([id])=>!assigned.has(id)).map(([id,label])=>({id,label}));if(pages.length)groups.unshift({id:'general',label:'一般',pages});return groups;}
globalThis.__EMBERWILD_V2_BRIDGE=Object.freeze({
 sections,
 theme(id){if(['ember','forest','paper'].includes(id))document.documentElement.dataset.uiTheme=id;},
 open(section,context={}){if(!SECTION_META.some(row=>row[0]===section))throw Error('找不到設定頁面：'+section);if(section==='world'&&Number.isInteger(context.mapIndex)&&data.balanceSettings.maps.catalog[context.mapIndex])selected.worldMap=context.mapIndex;if(section==='classes'&&Number.isInteger(context.job)&&data.classes[context.job])selected.class=context.job;if(section==='skillSystem'&&Number.isInteger(context.job)){const sk=data.skillSystem.definitions.find(s=>s.id==='class'+context.job+'-initial0')||data.skillSystem.definitions.find(s=>s.jobs?.includes(context.job)&&s.partnerId==null&&!s.disabled);if(sk){__EMBERWILD_SKILL_SYSTEM_EDITOR.select('skills',sk.id);return currentSection;}}currentSection=section;render();return currentSection;},
 inspect(target,context={}){
  if(!target||typeof target!=='object')throw Error('物件識別無效');
  if(target.kind==='skill'){
   const sk=data.skillSystem.definitions.find(s=>s.id===target.id);if(!sk)throw Error('找不到技能定義：'+target.id);
   __EMBERWILD_SKILL_SYSTEM_EDITOR.select('skills',sk.id);return currentSection;
  }
  if(target.kind==='monster'){
   const monster=data.balanceSettings.monsters.catalog.find(m=>m.id===target.id);if(!monster)throw Error('找不到怪物定義：'+target.id);
   selected.worldMap=monster.mapIndex;selected.worldMonsterSearch=monster.id;selected.worldMonsterPage=0;currentSection='world';render();return currentSection;
  }
  if(target.kind==='hero'){return this.open('classes',{...context,job:target.job});}
  const id=target.kind+':'+target.key,row=__EMBERWILD_INVENTORY_ICON_EDITOR.entries().find(r=>r.id===id);if(!row)throw Error('找不到物品定義：'+id);
  __EMBERWILD_INVENTORY_ICON_EDITOR.open('inventoryIcons','all',id);__EMBERWILD_INVENTORY_ICON_EDITOR.selectTab('basic');return currentSection;
 },
 current(){if(!__EMBERWILD_EXPERIENCE.guardRaw())throw Error('原始 JSON 有尚未套用的內容');return __EMBERWILD_RELEASE_EDITOR.current();},
 validate(doc){return __EMBERWILD_VALIDATE_DOCUMENT(doc);},
 save(){document.getElementById('cacheBtn').click();}
});announce();
})();
