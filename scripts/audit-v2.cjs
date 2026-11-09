/* Dreaming Abyss V2 phase-one audit. Reads source; never writes game data.
   Static references are evidence candidates, not proof of editable coverage. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..'),game=path.resolve(process.env.EMBERWILD_GAME_ROOT||path.join(root,'../DreamingAbyss'));
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const native={exports:{}};
new Function('module','exports',process.binding('natives')['internal/deps/acorn/acorn/dist/acorn'])(native,native.exports);
const parse=code=>native.exports.parse(code,{ecmaVersion:'latest',sourceType:'script',locations:true});
function children(n){return Object.entries(n).flatMap(([k,v])=>['loc','start','end'].includes(k)?[]:Array.isArray(v)?v.filter(x=>x?.type):v?.type?[v]:[]);}
function walk(n,fn){fn(n);for(const x of children(n))walk(x,fn);}
function chain(n){if(n?.type==='ChainExpression')return chain(n.expression);if(n?.type==='Identifier')return n.name;if(n?.type!=='MemberExpression')return null;const base=chain(n.object);if(!base)return null;return base+(n.computed?(n.property.type==='Literal'&&typeof n.property.value==='string'?'.'+n.property.value:'[]'):'.'+n.property.name);}
function shapes(doc){
 const rows=new Map(),parents=new Map();
 function visit(v,p){const type=v===null?'null':Array.isArray(v)?'array':typeof v;
  if(p){if(!rows.has(p))rows.set(p,{path:p,types:new Set(),occurrences:0});const r=rows.get(p);r.types.add(type);r.occurrences++;}
  if(type==='array'){for(const x of v)visit(x,p+'[]');}
  else if(type==='object'){
   const parent=parents.get(p)||{instances:0,keys:new Map()};parent.instances++;parents.set(p,parent);
   for(const [k,x] of Object.entries(v)){parent.keys.set(k,(parent.keys.get(k)||0)+1);visit(x,p?p+'.'+k:k);}
  }
 }visit(doc,'');
 return [...rows.values()].map(r=>{const i=r.path.lastIndexOf('.'),parent=i<0?'':r.path.slice(0,i),key=i<0?r.path:r.path.slice(i+1),population=parents.get(parent);return {...r,types:[...r.types].sort(),observedOptional:!!population&&population.keys.get(key)<population.instances,presentInObjects:population?.keys.get(key)??null,parentObjectCount:population?.instances??null};}).sort((a,b)=>a.path.localeCompare(b.path));
}
function analyzeHTML(html){
 const modules=[],owners=new Map();let index=0;
 for(const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){
  const id=m[1].match(/\bid="([^"]+)"/)?.[1]||'inline-'+index++,code=m[2],baseLine=html.slice(0,m.index).split('\n').length;
  const ast=parse(code),r={id,line:baseLine,sha256:sha(code),bytes:Buffer.byteLength(code),functions:[],globalExports:[],dataReferences:[],dom:[],bindings:[],wrappers:[]};
  walk(ast,n=>{
   if(n.type==='FunctionDeclaration')r.functions.push({name:n.id?.name,line:baseLine+n.loc.start.line});
   if(n.type==='MemberExpression'){
    const c=chain(n);if(c?.startsWith('data.'))r.dataReferences.push({path:c.slice(5),line:baseLine+n.loc.start.line});
   }
   if(n.type==='AssignmentExpression'){
    const c=chain(n.left);if(c&&/^(globalThis|root|window)\./.test(c))r.globalExports.push(c.split('.')[1]);
    if(c&&/\.(onclick|onchange|oninput)$/.test(c))r.bindings.push({kind:c.split('.').at(-1),line:baseLine+n.loc.start.line});
    if(n.left.type==='Identifier'&&['render','ensureArrays','validateData','markDirty','count'].includes(n.left.name))r.wrappers.push({name:n.left.name,line:baseLine+n.loc.start.line});
   }
   if(n.type==='CallExpression'&&n.callee.type==='MemberExpression'){
    const method=n.callee.property.name,a=n.arguments[0];
    if(['getElementById','querySelector','querySelectorAll'].includes(method))r.dom.push({method,selector:a?.type==='Literal'?String(a.value):null,dynamic:a?.type!=='Literal',line:baseLine+n.loc.start.line});
    if(method==='addEventListener')r.bindings.push({kind:a?.value||'dynamic',line:baseLine+n.loc.start.line});
   }
  });
  r.globalExports=[...new Set(r.globalExports)].sort();
  r.dataReferences=[...new Map(r.dataReferences.map(x=>[x.path,x])).values()];
  for(const name of r.globalExports)if(!owners.has(name))owners.set(name,id);
  modules.push({...r,ast});
 }
 const globals=new Set(owners.keys());
 return modules.map(({ast,...r})=>{const dependencies=new Set();walk(ast,n=>{if(n.type==='Identifier'&&globals.has(n.name)&&owners.get(n.name)!==r.id)dependencies.add(owners.get(n.name));});return {...r,dependencyCandidates:[...dependencies].sort()};});
}
function differences(a,b,p='',out=[]){
 if(JSON.stringify(a)===JSON.stringify(b))return out;
 if(a&&b&&typeof a==='object'&&typeof b==='object'&&Array.isArray(a)===Array.isArray(b)){for(const k of new Set([...Object.keys(a),...Object.keys(b)]))differences(a[k],b[k],p?p+'.'+k:k,out);}
 else out.push({path:p,kind:a===undefined?'added':b===undefined?'removed':'changed'});return out;
}
function temporal(p){
 if(p.startsWith('_reference.'))return 'reference';
 if(/^classes\[\]\.skills(\[\]|$)|^(supportSkills|passiveSkills|passiveDefinitions)\[\]|^skillSystem\.definitions\[\]\.adapter/.test(p))return 'compatibility-projection-or-adapter';
 if(/(^|\.)timing(\.|$)|^balanceSettings\.combat\.seconds(\.|$)/.test(p))return 'canonical-seconds-or-resource';
 if(/(cooldown|duration|Turn|Round|Interval|Seconds)/i.test(p))return 'time-or-event-needs-review';
 return 'other';
}
function importForAudit(r,doc){
 r.ctx.input=doc;
 // Use the same original-document capture as file import and release Load.
 // Replacing data directly would measure the UI projection as if it were loss.
 r.run('__EMBERWILD_WORKSPACE_IMPORT(__EMBERWILD_VALIDATE_DOCUMENT(input),"稽核測試文件",input)');
 return JSON.parse(JSON.stringify(r.run('__EMBERWILD_RELEASE_EDITOR.current()')));
}
// Absent fields are read from the maintained schema, never added to balance.json.
// Their exact paths are curated so the report does not mistake an alias for a
// document root. Evidence is verified on each run; changed schemas fail loudly.
const optional=[
 ['skillSystem.definitions[].timing.minTargets','t.minTargets!==undefined'],
 ['skillSystem.definitions[].timing.requiredTargetStatusId','t.requiredTargetStatusId!=null'],
 ['statusDefinitions[].timing.bossControlDurationSeconds','t.bossControlDurationSeconds!==undefined'],
 ['balanceSettings.monsters.catalog[].timing.maxMp',"['maxMp',1]"],
 ['balanceSettings.monsters.catalog[].timing.regenPerSecond',"['regenPerSecond',0]"],
 ['balanceSettings.monsters.catalog[].timing.costMultiplier',"['costMultiplier',0]"],
 ['equipmentForms[][][].mana','if(form.mana)'],
 ['equipmentForms[][][].mana.maxMp','finite(m.maxMp)'],
 ['equipmentForms[][][].mana.regenPerSecond','finite(m.regenPerSecond)'],
 ['equipmentForms[][][].mana.costReduction','finite(m.costReduction,0,1)']
];
function audit(){
 const raw=fs.readFileSync(path.join(game,'data/balance.json'),'utf8'),doc=JSON.parse(raw),html=fs.readFileSync(path.join(root,'balance-editor.html'),'utf8');
 const modules=analyzeHTML(html),refs=modules.flatMap(m=>m.dataReferences.map(r=>({...r,module:m.id}))),schema=fs.readFileSync(path.join(game,'js/combat/seconds-schema.js'),'utf8');
 const fields=shapes(doc).map(r=>({...r,role:temporal(r.path),editorReferenceCandidates:refs.filter(x=>x.path===r.path).map(x=>({module:x.module,line:x.line})),editingVerified:false}));
 const optionalFields=optional.map(([p,needle])=>{const at=schema.indexOf(needle);if(at<0)throw Error('Optional-field evidence changed: '+p);return {path:p,present:fields.some(x=>x.path===p),source:'js/combat/seconds-schema.js',line:schema.slice(0,at).split('\n').length,editingVerified:false};});
 const g=require('../../DreamingAbyss/tests/headless-runtime.cjs').loadRuntime(game),effective=JSON.parse(JSON.stringify(g.run('exportableBalance()')));
 const r=require('../tests/headless-editor.cjs').loadRuntime(root);
 const exported=importForAudit(r,doc),roundTrip=differences(doc,exported);
 const canonicalExport=importForAudit(r,effective),canonicalDiff=differences(effective,canonicalExport);
 for(const field of fields)field.loadExportPreserved=roundTrip.length===0?true:null;
 const coverageFile=path.join(root,'docs/v2-seconds-coverage.json');
 const uiCoverage=fs.existsSync(coverageFile)?JSON.parse(fs.readFileSync(coverageFile)):null;
 if(uiCoverage&&uiCoverage.balanceSha256!==sha(raw))throw Error('Seconds UI evidence is stale; rerun scripts/audit-seconds-browser.cjs');
 const verified=new Set((uiCoverage?.results||[]).filter(x=>x.result==='ui-export-game-verified').map(x=>x.path));
 for(const field of fields){field.editingVerified=verified.has(field.path);if(field.editingVerified)field.editingEvidence='docs/v2-seconds-coverage.json; representative field shape';}
 for(const field of optionalFields)field.editingVerified=verified.has(field.path);
 const sections=JSON.parse(JSON.stringify(r.run('SECTION_META'))),groups=JSON.parse(JSON.stringify(r.run('NAV_GROUPS')));
 const sourceFiles=['index.html','data/balance.json','js/combat/seconds-schema.js','js/combat/seconds-runtime.js','js/combat/seconds-timeline.js'];
 return {formatVersion:1,title:'Dreaming Abyss V2 開發者模式第一階段稽核',
  game:{repository:'Horios/DreamingAbyss',commit:cp.execFileSync('git',['-C',game,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),files:sourceFiles.map(file=>({path:file,sha256:sha(fs.readFileSync(path.join(game,file)))}))},
  editor:{sha256:sha(html),sections,groups,modules},
  limitations:['欄位清冊是目前文件所有觀測路徑，並非完整 schema。','observedOptional 只表示同類物件有缺值，不能當作 schema 選用欄位定義。','靜態引用、依賴和 DOM 清冊是候選證據；未解析所有別名、字串路徑及作用域，不等於編輯支援或完整呼叫圖。','optionalFields 是有來源行號的秒數 schema 補充清單，不宣稱涵蓋所有選用或動態欄位。','UI 驗證只涵蓋已列證據的代表性欄位形狀；未驗證欄位與每筆物件不可算作通過。','roundTrip 保留 raw JSON 的完整差異，包含 _reference 與 notes。','未修改資料、預設、規則或遊戲數值。'],
  summary:{fieldPaths:fields.length,canonicalTimeOrResource:fields.filter(x=>x.role==='canonical-seconds-or-resource').length,observedOptional:fields.filter(x=>x.observedOptional).length,withStaticEditorReference:fields.filter(x=>x.editorReferenceCandidates.length).length,modules:modules.length,sections:sections.length,domReferences:modules.reduce((n,m)=>n+m.dom.length,0),verifiedEditing:fields.filter(x=>x.editingVerified).length,unverifiedEditing:fields.filter(x=>!x.editingVerified).length},
  sharedCore:require('./build-v2-core.cjs').build().provenance,uiCoverage,
  fields,effectiveFields:shapes(effective).map(x=>({...x,role:temporal(x.path),loadExportPreserved:canonicalDiff.length===0,editingVerified:verified.has(x.path)})),optionalFields,roundTrip:{changes:roundTrip,gameNormalization:differences(doc,effective),effectiveGameToEditor:canonicalDiff,effectiveSemanticChanges:require('../server/balance-diff.cjs').diff(effective,canonicalExport).rows,editorErrors:r.errors,gameErrors:g.errors},
  dynamicAccess:refs.filter(x=>x.path.includes('[]')),
  runtimeEvidence:['mana','skillCooldownSeconds','actorInterval','recoveryWait','tokenTiming'].map(name=>{const source=fs.readFileSync(path.join(game,'js/combat/seconds-runtime.js'),'utf8'),at=source.search(new RegExp('(?:function |const )'+name+'\\b'));return {name,source:'js/combat/seconds-runtime.js',line:at<0?null:source.slice(0,at).split('\n').length};})};
}
function markdown(a){return '# '+a.title+'\n\n遊戲基準：`'+a.game.commit+'`。由 `node scripts/audit-v2.cjs` 重建；輸出不含時間戳，來源不變時可重現。\n\n'+a.limitations.map(x=>'- '+x).join('\n')+'\n\n## 清冊摘要\n\n'+Object.entries(a.summary).map(([k,v])=>'- '+k+'：'+v).join('\n')+'\n\n完整逐欄路徑、型別、缺值比例、秒數角色、引用候選與行號見 `v2-audit.json`。`loadExportPreserved` 表示正式匯入後原樣匯出的逐欄保存結果；`editingVerified` 僅在有實際 UI 修改、匯出及遊戲套用證據時標示 true，並限定為代表性欄位形狀。\n\n## 資料讀寫與 DOM 耦合\n\n`loadEditorWorkspaceAtBoot → data → ensureArrays`；匯入經 `__EMBERWILD_VALIDATE_DOCUMENT → __EMBERWILD_WORKSPACE_IMPORT`；匯出經 `__EMBERWILD_MASTERY_EDITOR.cleanExport → __EMBERWILD_SOURCE_DOCUMENT.serialize → __EMBERWILD_RELEASE_EDITOR.current`。\n\n`data` 與 `currentSection` 為共用可變狀態，多個 extension 包裝 `render`／`ensureArrays`；頁面透過 innerHTML 重建，再依 ID／selector 綁定事件。JSON 內保留每個 script 的 exports、function、DOM selector、動態 selector、事件與 wrapper 行號。共用核心在舊入口已載入，第一階段不抽換它們或建立新模型。\n\n## 共同核心與依賴\n\n```mermaid\nflowchart TD\n  A["balance.json / 瀏覽器草稿"] --> B["BalanceDocument / SecondsSchema"]\n  B --> C["SkillSystem / Mechanisms"]\n  C --> D["舊編輯器 data 與 DOM"]\n  D --> E["SourceDocument / BalanceDiff"]\n  E --> F["發布服務 / 遊戲 validator"]\n```\n\n此圖是已確認的主要資料流；逐 script 靜態依賴候選見 JSON，不宣稱完整呼叫圖。\n\n## 舊功能入口\n\n| ID | 名稱 |\n|---|---|\n'+a.editor.sections.map(([id,label])=>'| '+id+' | '+label+' |').join('\n')+'\n\n分類與子入口完整清單見 JSON 的 editor.groups。技能機制索引的複製、跳轉、跨技能引用沿用 `__EMBERWILD_SKILL_SYSTEM_EDITOR`；發布管理沿用快照、驗證、差異摘要、確認提交、歷史與還原，不新增第二套 API。\n\n## 秒數與相容投影\n\n`skillSystem.definitions[].timing`、狀態／怪物／道具／信物的 timing 與 `balanceSettings.combat.seconds` 為秒數／資源主欄位；classes[].skills、supportSkills、passiveDefinitions 與 adapter 是投影或定位資訊（含其 timing）。其他含 turn、round、duration 的欄位只能標示待查，不能一律改秒數。選用的目標門檻、狀態引用、怪物 MP、裝備 mana 另列來源證據。裝備冷卻使用既有技能／寶石效果及 `skillCooldownSeconds`，不能另造 mana.cooldown 欄位。\n\n## 往返結果\n\nraw balance.json → 正式匯入（含 SourceDocument.capture）→ 現行匯出：'+a.roundTrip.changes.length+' 個完整欄位差異；遊戲本身 raw → effective 有 '+a.roundTrip.gameNormalization.length+' 項；effective 遊戲文件 → 編輯器有 '+a.roundTrip.effectiveGameToEditor.length+' 項；既有語意比較為 '+a.roundTrip.effectiveSemanticChanges.length+' 項。'+a.roundTrip.editorErrors.length+' 個編輯器錯誤。完整差異含 metadata，見 JSON。此檢查不代表所有欄位均有專用 UI 或修改已套用遊戲；後者由現行 preview-compatibility 測試的具體操作另驗。\n\n## V2 範圍\n\n依使用者補充，`balance-editor-v2.html` 以目前遊戲介面作為主畫面：載入釘選來源的原版遊戲，右側開啟對應頁面的既有編輯器。編輯文件仍由舊版持有；套用至預覽會經既有驗證與實際遊戲 applyBalanceConfig。測試存檔隔離於遊戲 frame 記憶體；發布沿用既有完整差異、摘要與確認流程。原唯讀稽核入口移至 `balance-audit.html`。四個共用核心的原樣來源雜湊見 v2-core-provenance.json；實際遊戲來源與每檔雜湊見 v2-game-provenance.json。\n';}
if(require.main===module){const a=audit(),dir=path.join(root,'docs');fs.writeFileSync(path.join(dir,'v2-audit.json'),JSON.stringify(a,null,2)+'\n');fs.writeFileSync(path.join(dir,'v2-audit.md'),markdown(a));console.log(JSON.stringify(a.summary));if(a.roundTrip.editorErrors.length||a.roundTrip.changes.length||a.roundTrip.effectiveGameToEditor.length)process.exitCode=1;}
module.exports={shapes,analyzeHTML,differences,temporal,importForAudit,audit,markdown};
