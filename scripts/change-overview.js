/* 變更總覽：目前編輯內容與明確指定的比較基準之間的最終差異。
   Read-only comparison reuses EmberwildBalanceDiff on two exports normalized the same way; nothing here edits data
   except the explicit revert buttons, which rebuild the document through the editor's validator and roll back unless
   exactly the reverted differences disappear. */
(()=>{
 'use strict';
 const D=EmberwildBalanceDiff,copy=x=>x===undefined?undefined:JSON.parse(JSON.stringify(x)),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
 SECTION_META.push(['changeOverview','變更總覽']);
 const group=NAV_GROUPS.find(g=>g[0]==='tools');if(group&&!group[2].includes('changeOverview'))group[2].unshift('changeOverview');

 // ---- baseline: an export of the chosen document, produced by the same validator/normalizer as the current data.
 let baseline=null,notice='',expanded=new Set(),openRecords=new Set();
 function normalizedExport(doc){const keep=data;try{data=__EMBERWILD_VALIDATE_DOCUMENT(copy(doc));ensureArrays();return __EMBERWILD_RELEASE_EDITOR.current();}finally{data=keep;}}
 function defaultBaseline(){
  const src=globalThis.__EMBERWILD_SOURCE_DOCUMENT?.original,meta=globalThis.__EMBERWILD_EDITOR_WORKSPACE_META;
  return src?{label:'本次載入的文件'+(meta?.source&&meta.source!=='內建預設'?'（'+meta.source+'）':''),doc:normalizedExport(src)}:{label:'內建發布資料',doc:normalizedExport(ORIGINAL_DATA)};
 }
 function base(){if(!baseline){baseline=defaultBaseline();lastExported??=D.stable(baseline.doc);}return baseline;}
 // Unexported changes: the current export differs from the last JSON export (or from the loaded document before any export).
 let lastExported=null;
 // A successful JSON export reports through markSaved('已匯出…'); browser draft saves use other messages.
 const savedBase=markSaved;markSaved=function(msg,...rest){const out=savedBase.call(this,msg,...rest);if(/^已匯出/.test(String(msg||'')))try{lastExported=D.stable(__EMBERWILD_RELEASE_EDITOR.current());}catch{}return out;};
 const unexported=state=>lastExported===null?state.stats.records>0:D.stable(state.current)!==lastExported;
 function setBaseline(label,doc){baseline={label,doc:normalizedExport(doc)};expanded.clear();openRecords.clear();}
 // Importing another document into the editor is an explicit new source: compare against it from now on.
 const importBase=globalThis.__EMBERWILD_WORKSPACE_IMPORT;
 if(importBase)globalThis.__EMBERWILD_WORKSPACE_IMPORT=(candidate,name,original=candidate)=>{const out=importBase(candidate,name,original);try{setBaseline('匯入的文件（'+name+'）',original);}catch(e){baseline=null;}return out;};

 // ---- categories follow the editor's own sections.
 const CATEGORIES=[
  ['characters','角色與職業',p=>/^(classes(\.|$)(?!.*\.skills\.)|companions|companionSettings|companionUnlocks|teamSettings|starterPacks|balanceSettings\.progression)/.test(p)],
  ['skills','技能與技能機制',p=>/^(skillSystem|supportSkills|passiveDefinitions|statusDefinitions|skillIcons|masteryTypes|classes\.\d+\.skills|balanceSettings\.skills|balanceSettings\.combat\.seconds\.cooldownReduction)/.test(p)],
  ['equipment','裝備、詞綴與強化',p=>/^(equipmentForms|equipmentPowerSystem|starterPackItems|balance\.affixes|balanceSettings\.(equipment|enhancement)|companionTokens)/.test(p)],
  ['monsters','怪物與 BOSS',p=>/^balanceSettings\.monsters/.test(p)],
  ['maps','地圖與遭遇',p=>/^balanceSettings\.(maps|difficulty)/.test(p)],
  ['drops','掉落與獎勵',p=>/^balanceSettings\.(drops|rewards|quests)|^wishingLake|^story/.test(p)],
  ['economy','商店與經濟',p=>/^(items|shopSettings|inventoryIcons|lifeSkills|balanceSettings\.economy)/.test(p)],
  ['other','其他系統設定',()=>true]
 ];
 const categoryOf=p=>CATEGORIES.find(c=>c[2](p))[0];

 // ---- grouping diff rows into records (one game object each).
 const segments=p=>p.split('.');
 function recordPath(row){
  const segs=segments(row.path);
  if(row.id!==''&&row.id!==undefined){const i=segs.lastIndexOf(String(row.id));if(i>=0)return segs.slice(0,i+1).join('.');}
  if(row.type!=='修改')return row.path;
  // Objects without an id (settings groups, class rows by index): group by their parent object.
  return segs.slice(0,Math.max(1,segs.length-1)).join('.');
 }
 const at=(doc,segs)=>{let x=doc;for(const s of segs){if(x==null)return undefined;x=Array.isArray(x)?arrayItem(x,s):x[s];}return x;};
 function keyed(arr){return arr.length&&arr.every(x=>x&&typeof x==='object'&&!Array.isArray(x)&&(x.id!==undefined||x.key!==undefined));}
 function arrayItem(arr,seg){if(keyed(arr))return arr.find(x=>String(x.id??x.key)===seg);return arr[Number(seg)];}
 function changes(){
  const b=base(),cur=__EMBERWILD_RELEASE_EDITOR.current(),d=D.diff(b.doc,cur),records=new Map();
  // classes[].skills, supportSkills and passiveDefinitions are projections of the canonical skillSystem; list each skill once.
  const projected=b.doc.skillSystem&&cur.skillSystem?/^(classes\.\d+\.skills|supportSkills|passiveDefinitions)(\.|$)/:null;
  for(const row of d.rows){
   if(projected&&projected.test(row.path))continue;
   const path=row.path.endsWith('.order')?row.path:recordPath(row),cat=categoryOf(path);
   if(!records.has(path)){const obj=at(cur,segments(path))??at(b.doc,segments(path));records.set(path,{path,category:cat,system:row.system,name:recordName(path,obj,row),rows:[],kind:'修改'});}
   const r=records.get(path);r.rows.push(row);
   if(row.path===path&&row.type!=='修改')r.kind=row.type;
  }
  const list=[...records.values()];
  return {baseline:b,current:cur,records:list,
   stats:{records:list.length,fields:list.filter(r=>r.kind==='修改').reduce((n,r)=>n+r.rows.length,0),added:list.filter(r=>r.kind==='新增').length,deleted:list.filter(r=>r.kind==='刪除').length}};
 }
 const TYPE_NAMES={active:'主動',proc:'觸發',support:'輔助',passive:'被動'};
 function recordName(path,obj,row){
  const name=obj&&typeof obj==='object'?(obj.name||obj.title||obj.label):null;
  const kind=/^skillSystem\.definitions/.test(path)?'技能':/monsters\.catalog/.test(path)?'怪物':/maps\.catalog/.test(path)?'地圖':/^classes\.\d+$/.test(path)?'職業':/^companions\./.test(path)?'夥伴':/^items\./.test(path)?'道具':/^statusDefinitions/.test(path)?'狀態':/^equipmentForms/.test(path)?'裝備':/^companionTokens/.test(path)?'信物':row.system||'設定';
  if(name)return kind+'：'+name+(obj?.type&&TYPE_NAMES[obj.type]?'（'+TYPE_NAMES[obj.type]+'）':'')+(obj?.deleted?'（已標記刪除）':'');
  if(path.startsWith('balanceSettings.'))return '平衡設定：'+(settingLabel(path)||path.replace(/^balanceSettings\./,''));
  return kind+'：'+path;
 }

 // ---- field names and value formats come from the editor's existing definitions.
 const LABELS={...D.labels,battlefieldColor:'戰場底色',cardColor:'戰鬥卡片顏色',name:'名稱',description:'說明',power:'威力倍率',powerPerLevel:'每級威力',maxTargets:'目標數',requiredLevel:'需求等級',disabled:'停用',enabled:'啟用',effect:'效果類型',element:'元素',target:'作用目標',hitCount:'命中段數',mode:'縮減類型',value:'數值',thresholdSeconds:'衰減起點（秒）',factor:'衰減後保留比例',minimumSeconds:'冷卻下限（秒）',initialCooldownSeconds:'初始冷卻（秒）',cooldownSeconds:'再使用冷卻（秒）',condition:'自動施放條件',priority:'優先級',hpMultiplier:'生命倍率',attackMultiplier:'攻擊倍率',defenseMultiplier:'防禦倍率',spawnWeight:'出現權重',maxDrops:'最大掉落物數',eliteEnabled:'可菁英化',race:'種族',sellPrice:'售價',cost:'購買價',healAmount:'回復量',order:'排列順序',baseIntervalSeconds:'普攻基礎間隔（秒）',procBaseChance:'基礎觸發率'};
 const ENUMS={mode:{percent:'百分比減少',flat:'固定秒數減少'},condition:{always:'符合目標即可',injured:'生命低於治療門檻',missingEffect:'缺少自身施加的效果'},type:TYPE_NAMES};
 // 0~1 ratios: only fields whose own definition says so.
 const RATIO_KEYS=new Set(['procBaseChance','eliteChance','healThreshold','minimumHpRatio','minimumMpRatio','factor','costReduction','chance','legendaryChance']);
 function settingLabel(path){try{const m=path.startsWith('balanceSettings.')?settingMeta(path):path.startsWith('balance.')?balanceMeta(path):null;return m&&m.label&&m.label!==path&&!m.label.includes('.')?m.label:'';}catch{return '';}}
 function settingRatio(path){try{const m=path.startsWith('balanceSettings.')?settingMeta(path):path.startsWith('balance.')?balanceMeta(path):null;return !!m&&/0\s*[~～]\s*1|=\s*\d+(?:\.\d+)?%/.test(m.help||'');}catch{return false;}}
 function fieldLabel(row,record){
  const key=segments(row.path).at(-1),rel=row.path.slice(record.path.length+1)||key;
  const label=settingLabel(row.path)||LABELS[key]||row.field||key;
  const prefix=segments(rel).slice(0,-1).filter(s=>s!=='timing'&&s!=='sources').map(s=>LABELS[s]||s).join(' · ');
  return (prefix?prefix+' · ':'')+label;
 }
 function format(value,row,doc){
  if(value===undefined)return '（不存在）';if(value===null)return 'null（明確設為空）';
  const segs=segments(row.path),key=segs.at(-1);
  if(typeof value==='boolean')return key==='enabled'||key==='eliteEnabled'?(value?'啟用':'停用'):key==='disabled'?(value?'停用':'啟用'):(value?'是':'否');
  if(ENUMS[key]&&typeof value==='string')return ENUMS[key][value]||value;
  if(typeof value==='number'){
   if(key==='value'&&segs.at(-3)==='sources'){const mode=at(doc,segs.slice(0,-1))?.mode;return mode==='percent'?value+'%':value+' 秒';}
   if(/Seconds$/.test(key))return +value.toPrecision(12)+' 秒';
   if(RATIO_KEYS.has(key)||settingRatio(row.path))return +(value*100).toPrecision(12)+'%';
   return String(+value.toPrecision(12));
  }
  if(typeof value==='string')return value===''?'（空字串）':value;
  if(key==='order'&&Array.isArray(value))return value.join(' → ');
  const json=JSON.stringify(value);return json.length>120?json.slice(0,117)+'…':json;
 }

 // ---- reverting: rebuild the document from the current export with baseline values, validate, and keep it only if
 // exactly the reverted differences disappear.
 function locateParent(doc,segs){let x=doc;for(const s of segs.slice(0,-1)){if(x==null)throw Error('找不到上層資料：'+segs.join('.'));x=Array.isArray(x)?arrayItem(x,s):x[s];}if(x==null)throw Error('找不到上層資料：'+segs.join('.'));return x;}
 function assign(doc,baseDoc,path){
  const segs=segments(path),last=segs.at(-1);
  if(last==='order'){const arr=at(doc,segs.slice(0,-1)),ref=at(baseDoc,segs.slice(0,-1));if(!Array.isArray(arr)||!Array.isArray(ref))throw Error('排列順序無法還原');const id=x=>String(x.id??x.key),rank=new Map(ref.map((x,i)=>[id(x),i]));arr.sort((a,b)=>(rank.get(id(a))??1e9)-(rank.get(id(b))??1e9));return;}
  const parent=locateParent(doc,segs),value=copy(at(baseDoc,segs));
  if(Array.isArray(parent)){
   if(!keyed(parent)&&!(value&&typeof value==='object'&&(value.id!==undefined||value.key!==undefined))){const ref=at(baseDoc,segs.slice(0,-1));if(!Array.isArray(ref))throw Error('陣列無法還原');parent.splice(0,parent.length,...copy(ref));return;}
   const i=parent.findIndex(x=>String(x?.id??x?.key)===last);
   if(value===undefined){if(i<0)throw Error('還原目標已不存在');parent.splice(i,1);return;}
   if(i>=0){parent[i]=value;return;}
   const ref=at(baseDoc,segs.slice(0,-1)),pos=Array.isArray(ref)?ref.findIndex(x=>String(x?.id??x?.key)===last):-1;parent.splice(pos<0?parent.length:Math.min(pos,parent.length),0,value);return;
  }
  if(value===undefined)delete parent[last];else parent[last]=value;
 }
 const rowKey=r=>r.type+'|'+r.path+'|'+D.stable(r.before)+'|'+D.stable(r.after);
 function revert(paths,label){
  const before=changes(),target=new Set(before.records.flatMap(r=>r.rows).filter(r=>paths.some(p=>r.path===p||r.path.startsWith(p+'.'))).map(rowKey));
  if(!target.size)throw Error('沒有可還原的差異');
  const next=copy(before.current),keep=data;
  for(const p of paths)assign(next,before.baseline.doc,p);
  try{data=__EMBERWILD_VALIDATE_DOCUMENT(next);ensureArrays();}catch(e){data=keep;throw Error('還原後的資料未通過驗證：'+e.message);}
  const after=changes(),expected=new Set(before.records.flatMap(r=>r.rows).map(rowKey).filter(k=>!target.has(k))),got=new Set(after.records.flatMap(r=>r.rows).map(rowKey));
  const unexpected=[...got].filter(k=>!expected.has(k)),missing=[...expected].filter(k=>!got.has(k));
  if(unexpected.length||missing.length){data=keep;ensureArrays();throw Error('這項還原會連帶影響其他資料（'+[...unexpected,...missing].slice(0,3).map(k=>k.split('|')[1]).join('、')+'），已取消。請改用整筆還原或在編輯頁調整。');}
  markDirty(label);return after;
 }

 // ---- jumping to the existing editor for a record.
 function focusField(key){setTimeout(()=>{const el=document.querySelector(`#app [data-key="${key}"],#app [data-field="${key}"],#app [data-seconds-field="${key}"],#app [data-quest-field="${key}"],#app #${CSS.escape(key)}`);if(el){el.scrollIntoView?.({block:'center'});el.focus?.();el.classList?.add('change-overview-focus');}},0);}
 function locate(record,row){
  const segs=segments(record.path),key=segments((row||record.rows[0]).path).at(-1);
  if(segs[0]==='skillSystem'&&segs[1]==='definitions'&&segs[2]){if(!data.skillSystem.definitions.some(s=>s.id===segs[2]))return false;globalThis.__EMBERWILD_SKILL_SYSTEM_EDITOR.select('skills',segs[2]);focusField(key);return true;}
  if(segs[0]==='balanceSettings'&&segs[1]==='monsters'&&segs[2]==='catalog'&&segs[3]){const m=data.balanceSettings.monsters.catalog.find(x=>x.id===segs[3]);if(!m)return false;selected.worldMap=m.mapIndex;selected.worldMonsterSearch=m.id;currentSection='world';render();focusField(key);return true;}
  if(segs[0]==='balanceSettings'&&segs[1]==='maps'){const i=Number(segs[3]);if(Number.isInteger(i))selected.worldMap=i;currentSection='world';render();focusField(key);return true;}
  if(segs[0]==='balanceSettings'&&segs[1]==='combat'&&segs[2]==='seconds'){const id=segs[3]==='cooldownReduction'?(segs[4]==='sources'?'cdr:'+segs[5]:'cdrDiminishing'):segs[3]==='classes'?'class'+segs[4]:segs[3]==='recovery'||segs[3]==='mana'||segs[3]==='finalBoss'?segs[3]:'combat';__EMBERWILD_COMBAT_MIGRATION_AUDIT.select('combat',id);currentSection='combatMigration';render();focusField(key);return true;}
  if(segs[0]==='classes'&&segs.length>=2){selected.class=Number(segs[1])||0;currentSection='classes';render();focusField(key);return true;}
  if(segs[0]==='companions'){const i=data.companions.findIndex(p=>String(p.id)===segs[1]);if(i>=0)selected.companion=i;currentSection='companions';render();focusField(key);return true;}
  if(segs[0]==='statusDefinitions'){currentSection='statuses';render();return true;}
  if(segs[0]==='items'||segs[0]==='inventoryIcons'){currentSection='inventoryIcons';render();return true;}
  if(segs[0]==='equipmentForms'){currentSection='equipment';render();focusField(key);return true;}
  if(segs[0]==='balanceSettings'&&segs[1]){const sec='balanceSettings:'+segs[1];if(SECTION_META.some(([id])=>id===sec)||NAV_GROUPS.some(g=>g[2].includes(sec))){currentSection=sec;render();focusField(key);return true;}}
  return false;
 }

 // ---- summary text for commit messages and handover notes.
 function summary(state=changes()){
  const lines=['本次平衡修改','比較基準：'+state.baseline.label,''];
  for(const [id,label] of CATEGORIES){const recs=state.records.filter(r=>r.category===id);if(!recs.length)continue;lines.push(label+'：');
   for(const r of recs){if(r.kind!=='修改'){lines.push('- '+r.kind+' '+r.name);continue;}lines.push('- '+r.name+'：'+r.rows.map(row=>fieldLabel(row,r)+' '+format(row.before,row,state.baseline.doc)+' → '+format(row.after,row,state.current)).join('；'));}
   lines.push('');}
  lines.push('共修改 '+state.stats.records+' 筆資料、'+state.stats.fields+' 個欄位'+(state.stats.added?'；新增 '+state.stats.added+' 筆':'')+(state.stats.deleted?'；刪除 '+state.stats.deleted+' 筆':'')+'。');
  return lines.join('\n');
 }
 async function copyText(text){try{await navigator.clipboard.writeText(text);return true;}catch{const t=document.createElement('textarea');t.value=text;document.body.appendChild(t);t.select();let ok=false;try{ok=document.execCommand('copy');}catch{}t.remove();return ok;}}

 // ---- page.
 function page(){
  let state;try{state=changes();}catch(e){document.getElementById('app').innerHTML=sectionHead('變更總覽','無法計算差異。')+'<div class="notice" role="alert">'+esc(e.message)+'</div>';return;}
  const s=state.stats,app=document.getElementById('app');
  const head='<div class="change-overview-stats"><span>比較基準：<b>'+esc(state.baseline.label)+'</b></span><span>資料項目 <b>'+s.records+'</b></span><span>欄位變更 <b>'+s.fields+'</b></span><span>新增 <b>'+s.added+'</b></span><span>刪除 <b>'+s.deleted+'</b></span><span>'+(unexported(state)?'<b class="change-overview-dirty">有尚未匯出的變更</b>':'目前沒有尚未匯出的變更')+'</span></div>'+
   '<div class="actions"><button id="changeOverviewCopy" '+(s.records?'':'disabled')+'>複製變更摘要</button><button id="changeOverviewRebase">以目前內容作為新基準</button><button id="changeOverviewBuiltin">改用內建發布資料作為基準</button><label class="change-overview-file">載入 JSON 作為基準<input id="changeOverviewBaseFile" type="file" accept=".json,application/json"></label></div>'+(notice?'<p class="notice" role="status">'+esc(notice)+'</p>':'');
  const cats=CATEGORIES.map(([id,label])=>{const recs=state.records.filter(r=>r.category===id);if(!recs.length)return '';const open=!expanded.size||expanded.has(id);
   return '<details class="change-overview-category" data-change-category="'+id+'" '+(open?'open':'')+'><summary>'+esc(label)+' <span class="pill">'+recs.length+'</span></summary>'+recs.map(r=>recordHTML(r,state)).join('')+'</details>';}).join('');
  app.innerHTML=sectionHead('變更總覽','目前編輯內容與比較基準之間的最終差異；改回原值的欄位不會列出。比較為唯讀，只有還原按鈕會修改資料。')+head+(cats||'<p class="mini-note">與比較基準相同，沒有任何差異。</p>');
  bind(state);
 }
 function recordHTML(r,state){
  const tag=r.kind==='新增'?'<span class="tag change-added">新增</span>':r.kind==='刪除'?'<span class="tag change-deleted">刪除</span>':'<span class="tag">修改 '+r.rows.length+' 欄</span>';
  const body=r.kind==='修改'?'<table class="change-overview-table"><thead><tr><th>欄位</th><th>修改前</th><th>修改後</th><th></th></tr></thead><tbody>'+r.rows.map((row,i)=>'<tr><td>'+esc(fieldLabel(row,r))+'<small class="mini-note"> '+esc(row.path)+'</small></td><td>'+esc(format(row.before,row,state.baseline.doc))+'</td><td>'+esc(format(row.after,row,state.current))+'</td><td><button data-change-revert-field="'+esc(row.path)+'" data-change-record="'+esc(r.path)+'">還原此欄</button></td></tr>').join('')+'</tbody></table>':
   '<details class="change-overview-raw" '+(openRecords.has(r.path)?'open':'')+'><summary>查看完整設定</summary><pre>'+esc(JSON.stringify(r.kind==='新增'?at(state.current,segments(r.path)):at(state.baseline.doc,segments(r.path)),null,1))+'</pre></details>';
  return '<article class="change-overview-record" data-change-record-path="'+esc(r.path)+'"><div class="row"><b>'+esc(r.name)+'</b>'+tag+'<span class="actions"><button data-change-locate="'+esc(r.path)+'" '+(r.kind==='刪除'?'disabled title="已刪除的資料沒有編輯位置；可先整筆還原"':'')+'>前往編輯</button><button data-change-revert-record="'+esc(r.path)+'">'+(r.kind==='新增'?'取消新增':r.kind==='刪除'?'恢復刪除':'整筆還原')+'</button></span></div>'+body+'</article>';
 }
 function bind(state){
  const app=document.getElementById('app'),act=fn=>{try{fn();}catch(e){notice=e.message;}page();};
  app.querySelector('#changeOverviewCopy')?.addEventListener('click',async()=>{notice=await copyText(summary())?'已複製變更摘要。':'無法存取剪貼簿，請從下方手動複製。';page();if(!notice.startsWith('已'))app.insertAdjacentHTML('beforeend','<textarea class="change-overview-summary" readonly>'+esc(summary())+'</textarea>');});
  app.querySelector('#changeOverviewRebase')?.addEventListener('click',()=>act(()=>{if(!confirm('以目前編輯內容作為新的比較基準？目前列出的差異會清空，資料本身不變。'))return;setBaseline('目前內容（'+new Date().toLocaleString('zh-TW')+' 設定）',__EMBERWILD_RELEASE_EDITOR.current());notice='已更新比較基準。';}));
  app.querySelector('#changeOverviewBuiltin')?.addEventListener('click',()=>act(()=>{setBaseline('內建發布資料',ORIGINAL_DATA);notice='已改用內建發布資料作為比較基準。';}));
  app.querySelector('#changeOverviewBaseFile')?.addEventListener('change',async e=>{const f=e.target.files?.[0];if(!f)return;try{setBaseline('JSON 檔案（'+f.name+'）',JSON.parse(await f.text()));notice='已載入比較基準：'+f.name;}catch(err){notice='無法載入比較基準：'+err.message;}page();});
  app.querySelectorAll('[data-change-category]').forEach(d=>d.addEventListener('toggle',()=>{if(!expanded.size)CATEGORIES.forEach(([id])=>expanded.add(id));if(d.open)expanded.add(d.dataset.changeCategory);else expanded.delete(d.dataset.changeCategory);}));
  app.querySelectorAll('[data-change-locate]').forEach(b=>b.onclick=()=>{const r=state.records.find(x=>x.path===b.dataset.changeLocate);if(!r||!locate(r)){notice='這項資料沒有對應的編輯頁面，已開啟原始 JSON。';currentSection='raw';render();}});
  app.querySelectorAll('[data-change-revert-field]').forEach(b=>b.onclick=()=>act(()=>{revert([b.dataset.changeRevertField],'還原欄位');notice='已還原：'+b.dataset.changeRevertField;}));
  app.querySelectorAll('[data-change-revert-record]').forEach(b=>b.onclick=()=>act(()=>{const r=state.records.find(x=>x.path===b.dataset.changeRevertRecord);if(!r)throw Error('找不到這筆資料');if(!confirm((r.kind==='新增'?'取消新增「':r.kind==='刪除'?'恢復已刪除的「':'將「')+r.name+(r.kind==='修改'?'」的 '+r.rows.length+' 個欄位全部還原？':'」？')))return;revert(r.kind==='修改'?r.rows.map(x=>x.path):[r.path],'整筆還原');notice='已還原：'+r.name;}));
 }
 const previous=render;
 render=function(...args){if(currentSection!=='changeOverview')return previous(...args);if(typeof renderNav==='function')renderNav();page();};
 // Entry beside 匯出 in the top bar, so the overview is reachable from any page.
 const top=document.querySelector('.topbar');if(top&&!document.getElementById('changeOverviewBtn')){const b=document.createElement('button');b.id='changeOverviewBtn';b.type='button';b.textContent='變更總覽';b.onclick=()=>{currentSection='changeOverview';render();};top.insertBefore(b,document.getElementById('exportBtn')||null);}
 globalThis.__EMBERWILD_CHANGE_OVERVIEW={changes,summary,revert,locate,format,fieldLabel,setBaseline,baseline:()=>base(),categories:CATEGORIES.map(([id,label])=>({id,label}))};
})();
