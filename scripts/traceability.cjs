#!/usr/bin/env node
/* Field-level traceability matrix (issue #2: A03, A04, B01, B06, E05, H01).

   Every leaf path of the game's balance document is edited once and sent through the three programs a
   published value passes: the workbench (import -> export), the release validator (canonicalize) and the
   real game (applyBalanceConfig -> exportableBalance). The matrix records, per path pattern:
   module, V2 page sections, the edit that was tried, what each program did with it, the game files that
   mention the field and a status. Nothing here changes a balance value: all edits stay in memory.

   node scripts/traceability.cjs                 regenerate docs/traceability-matrix.json and .md (about 40 minutes)
   node scripts/traceability.cjs --only <regex>  probe only the matching patterns again and merge them into the matrix
   node scripts/traceability.cjs --reclassify    apply docs/traceability-known.json to the stored results (no probing)
   node scripts/traceability.cjs --check         structure only: every current path has a row (fast, no probing)

   docs/traceability-known.json holds what a blind probe cannot know: a valid value to try for a field with a
   narrow range (edits), fields the game derives from another field (derived), fields the game fixes (fixed),
   enumerations that have no second valid value in the data (constrained) and the remaining acknowledged losses
   (fields). Each entry carries its reason; tests/traceability.test.cjs fails on a loss that has none.
   EMBERWILD_GAME_ROOT selects the game checkout (default ../DreamingAbyss). */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..'),game=path.resolve(process.env.EMBERWILD_GAME_ROOT||path.join(root,'../DreamingAbyss'));
const OUT_JSON=path.join(root,'docs/traceability-matrix.json'),OUT_MD=path.join(root,'docs/traceability-matrix.md'),KNOWN=path.join(root,'docs/traceability-known.json');
const known=()=>fs.existsSync(KNOWN)?JSON.parse(fs.readFileSync(KNOWN,'utf8')):{edits:{},derived:[],fixed:[],constrained:[],fields:{}};
const LOST=['ignored-by-game','dropped-by-editor','dropped-by-validator'];
const plain=x=>JSON.parse(JSON.stringify(x)),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const isIndex=k=>/^\d+$/.test(k);
const get=(doc,p)=>{let x=doc;for(const k of p){if(x==null||typeof x!=='object')return undefined;x=x[k];}return x;};
const set=(doc,p,v)=>{let x=doc;for(const k of p.slice(0,-1))x=x[k];x[p.at(-1)]=v;};

// Modules whose content is documentation for people; the game regenerates or ignores it.
const READ_ONLY_MODULES={'meta/reference':'欄位說明由遊戲匯出時重新產生，僅供閱讀','meta/notes':'設計備註由遊戲匯出時重新產生，僅供閱讀'};

/* One row per path pattern (array indexes become *). The first occurrence is the instance that is edited. */
function patterns(doc){
 const rows=new Map();
 (function walk(v,p,pat){
  const leaf=kind=>{const key=pat.join('.');if(!rows.has(key))rows.set(key,{pattern:key,instance:p.slice(),type:kind,count:0});rows.get(key).count++;};
  if(Array.isArray(v)){if(!v.length)return leaf('empty-array');v.forEach((x,i)=>walk(x,[...p,String(i)],[...pat,'*']));return;}
  if(v&&typeof v==='object'){const keys=Object.keys(v);if(!keys.length)return leaf('empty-object');for(const k of keys)walk(v[k],[...p,k],[...pat,k]);return;}
  leaf(v===null?'null':Number.isInteger(v)?'integer':typeof v);
 })(doc,[],[]);
 return [...rows.values()];
}
function candidates(value){
 if(typeof value==='boolean')return [!value];
 if(typeof value==='string')return [value+'·測'];
 if(typeof value!=='number')return [];
 if(Number.isInteger(value))return [value+1,value-1,value*2||2,value+10];
 const r=x=>+x.toFixed(4);return [r(value*1.1),r(value/2),r(value+1),r(value-0.01)];
}
function pageIndex(){
 const ctx={};ctx.globalThis=ctx;vm.runInNewContext(fs.readFileSync(path.join(root,'scripts/v2-page-context.js'),'utf8'),ctx);
 const rows=[];for(const [page,def] of Object.entries(ctx.DreamingAbyssPageContexts))for(const s of def.sections)for(const p of s.paths)rows.push({page,pageLabel:def.label,section:s.id,sectionLabel:s.label,path:p.split('.')});
 return pattern=>{const p=pattern.split('.');return rows.filter(r=>r.path.every((k,i)=>p[i]===k)).map(r=>r.page+'/'+r.section);};
}
/* Game scripts (index.html order) that mention an identifier; the field's name, or its nearest named parent. */
function readerIndex(){
 const html=fs.readFileSync(path.join(game,'index.html'),'utf8'),files=[];
 for(const m of html.matchAll(/<script\b[^>]*?\b(?:data-balance-src|src)="([^"]+)"/g)){const f=m[1].split('?')[0];if(f.endsWith('.js')&&!files.includes(f)&&fs.existsSync(path.join(game,f)))files.push(f);}
 const words=new Map();
 for(const f of files)for(const w of new Set(fs.readFileSync(path.join(game,f),'utf8').match(/[A-Za-z_$][\w$]*/g)||[])){if(!words.has(w))words.set(w,[]);words.get(w).push(f);}
 return pattern=>{const keys=pattern.split('.').filter(k=>k!=='*');for(let i=keys.length-1;i>=0;i--){const hit=words.get(keys[i]);if(hit)return {key:keys[i],files:hit.length,sample:hit.slice(0,4)};}return {key:null,files:0,sample:[]};};
}

async function pipelines(){
 const {loadRuntime}=require(path.join(root,'tests/headless-editor.cjs')),{loadRuntime:loadGame}=require(path.join(game,'tests/headless-runtime.cjs'));
 const {createGameValidator}=await import(path.join(root,'server/online/game-validator.mjs'));
 const g=loadGame(game),e=loadRuntime(root),v=createGameValidator();
 return {
  inspect:d=>{g.ctx.__TRACE=d;return g.run('EmberwildBalanceDocument.inspect(__TRACE).length');},
  editor:d=>{e.ctx.input=plain(d);e.run('data=__EMBERWILD_VALIDATE_DOCUMENT(input);ensureArrays()');return plain(e.run('__EMBERWILD_RELEASE_EDITOR.current()'));},
  validator:d=>v.canonicalize(plain(d)),
  game:d=>{g.ctx.__TRACE=plain(d);g.run('applyBalanceConfig(__TRACE,{persist:false})');return plain(g.run('exportableBalance()'));}
 };
}
const outcome=(out,base,p,value)=>{const x=get(out,p);return same(x,value)?'preserved':x===undefined?'removed':same(x,get(base,p))?'reverted':'transformed';};

async function probe(doc,rows,log){
 const P=await pipelines(),names=['editor','validator','game'],base={};
 for(const n of names)base[n]=P[n](doc);
 // 1. Choose an edit the shared document rules accept; none accepted means the field is an enum, id or reference.
 const edits=[];
 for(const row of rows){
  if(row.readOnly)continue;
  const value=get(doc,row.instance),K=known(),list=Object.prototype.hasOwnProperty.call(K.edits||{},row.pattern)?[K.edits[row.pattern]]:candidates(value);row.tried=list.length;
  for(const c of list){const d=plain(doc);set(d,row.instance,c);let ok=false;try{ok=P.inspect(d)===0;}catch{}if(ok){row.edit={from:value,to:c};edits.push(row);break;}}
  if(!row.edit)row.status=row.tried?'constrained':'no-value';
 }
 log('可接受的單欄位編輯：'+edits.length+'／'+rows.length);
 // 2. Batches; a batch a program rejects is split until the rejected field stands alone.
 const run=(name,batch)=>{
  const d=plain(doc);for(const row of batch)set(d,row.instance,row.edit.to);
  let out;try{out=P[name](d);}catch(error){
   if(batch.length===1){batch[0][name]='rejected';batch[0][name+'Reason']=String(error.message||error).slice(0,160);return;}
   const half=batch.length>>1;run(name,batch.slice(0,half));run(name,batch.slice(half));return;}
  for(const row of batch)row[name]=outcome(out,base[name],row.instance,row.edit.to);
 };
 const size={editor:60,validator:60,game:120};
 for(const name of names){for(let i=0;i<edits.length;i+=size[name])run(name,edits.slice(i,i+size[name]));log(name+' 批次完成');}
 // 3. Anything not preserved inside a batch is repeated alone, so one edit cannot hide another.
 for(const name of names){const again=edits.filter(r=>r[name]!=='preserved');for(const row of again)run(name,[row]);log(name+' 單欄位複驗：'+again.length);}
 for(const row of edits){
  const r=names.map(n=>row[n]);
  row.status=r.every(x=>x==='preserved')?'effective'
   :r.includes('rejected')?'constrained'
   :row.game==='reverted'||row.game==='removed'?'ignored-by-game'
   :row.editor==='reverted'||row.editor==='removed'?'dropped-by-editor'
   :row.validator==='reverted'||row.validator==='removed'?'dropped-by-validator':'normalized';
 }
}
// What the probe saw, before any explanation from docs/traceability-known.json.
function observed(row){
 if(!row.edit)return row.status;
 const r=['editor','validator','game'].map(n=>row[n]);
 return r.every(x=>x==='preserved')?'effective':r.includes('rejected')?'constrained':row.game==='reverted'||row.game==='removed'?'ignored-by-game':row.editor==='reverted'||row.editor==='removed'?'dropped-by-editor':row.validator==='reverted'||row.validator==='removed'?'dropped-by-validator':'normalized';
}
// Explanations apply only to an edit that was not kept; a kept edit stays effective whatever the rules say.
function classify(rows){
 const K=known(),rules=[['derived',K.derived],['fixed-by-game',K.fixed],['constrained',K.constrained]];
 for(const row of rows){
  if(row.readOnly||row.status==='read-only')continue;
  row.status=observed(row);delete row.note;delete row.source;
  if(!LOST.includes(row.status)&&row.status!=='normalized')continue;
  for(const [status,list] of rules){const rule=(list||[]).find(x=>new RegExp(x.match).test(row.pattern));if(rule){row.status=status;row.note=rule.note;if(rule.source)row.source=rule.source;break;}}
  if(LOST.includes(row.status)&&K.fields?.[row.pattern])row.note=K.fields[row.pattern];
 }
}

const STATUS={effective:'可編輯，三個程式都保留編輯值',normalized:'可編輯，但值會被正規化（四捨五入、夾限或衍生）',constrained:'受驗證器限制（列舉、ID 或引用），不接受任意值',
 'ignored-by-game':'遊戲載入後不採用編輯值','dropped-by-editor':'工作台匯入匯出後遺失編輯值','dropped-by-validator':'發布驗證器正規化後遺失編輯值',
 'derived':'由其他欄位衍生，修改來源欄位才會生效','fixed-by-game':'遊戲程式固定此值，資料中的值不會被採用','read-only':'僅供閱讀','no-value':'目前為空值，沒有可探測的內容'};

function markdown(matrix){
 const by=new Map();for(const r of matrix.rows){if(!by.has(r.module))by.set(r.module,{});const m=by.get(r.module);m[r.status]=(m[r.status]||0)+1;}
 const cols=Object.keys(STATUS),lines=['# 欄位級追溯矩陣','',
  '由 `node scripts/traceability.cjs` 產生，請勿手動修改。完整資料在 `traceability-matrix.json`。','',
  '遊戲資料 commit `'+matrix.game.dataCommit.slice(0,7)+'`（`data/balance.json` SHA-256 `'+matrix.game.dataSha256.slice(0,12)+'…`），'+matrix.rows.length+' 個欄位樣式，'+matrix.leaves+' 個欄位值，'+by.size+' 個模組。','',
  '每個欄位樣式取第一筆資料改一次值，依序交給工作台（匯入→匯出）、發布驗證器（canonicalize）與遊戲（`applyBalanceConfig`→`exportableBalance`）。','',
  '| 狀態 | 意義 |','|---|---|',...cols.map(k=>'| `'+k+'` | '+STATUS[k]+' |'),'',
  '| 模組 | '+cols.join(' | ')+' |','|---|'+cols.map(()=>'--:').join('|')+'|',
  ...[...by].map(([id,c])=>'| `'+id+'` | '+cols.map(k=>c[k]||0).join(' | ')+' |'),''];
 const grouped=s=>{const g=new Map();for(const r of matrix.rows.filter(x=>x.status===s)){const k=(r.source||'')+'\u0000'+(r.note||'');if(!g.has(k))g.set(k,{source:r.source,note:r.note,rows:[]});g.get(k).rows.push(r);}return [...g.values()];};
 for(const s of ['derived','fixed-by-game']){
  const groups=grouped(s);if(!groups.length)continue;
  lines.push('## '+STATUS[s]+'（'+matrix.rows.filter(r=>r.status===s).length+'）','','| 欄位 | 數量 | '+(s==='derived'?'來源 | ':'')+'說明 |','|---|--:|'+(s==='derived'?'---|':'')+'---|');
  for(const g of groups){const head=[...new Set(g.rows.map(r=>r.pattern.split('.*')[0]+(r.pattern.includes('.*')?'.*…':'')))];lines.push('| '+head.slice(0,6).map(p=>'`'+p+'`').join('、')+(head.length>6?'…':'')+' | '+g.rows.length+' | '+(s==='derived'?'`'+(g.source||'')+'` | ':'')+(g.note||'')+' |');}
  lines.push('');
 }
 for(const s of ['ignored-by-game','dropped-by-editor','dropped-by-validator','normalized']){
  const rows=matrix.rows.filter(r=>r.status===s);if(!rows.length)continue;
  lines.push('## '+STATUS[s]+'（'+rows.length+'）','','| 欄位 | 模組 | 編輯 | 工作台 | 驗證器 | 遊戲 | 說明 |','|---|---|---|---|---|---|---|');
  for(const r of rows)lines.push('| `'+r.pattern+'` | `'+r.module+'` | '+JSON.stringify(r.edit.from)+' → '+JSON.stringify(r.edit.to)+' | '+r.editor+' | '+r.validator+' | '+r.game+' | '+(r.note||'')+' |');
  lines.push('');
 }
 return lines.join('\n');
}

function skeleton(){
 const M=require(path.join(game,'js/balance/balance-modules.js')),doc=JSON.parse(fs.readFileSync(path.join(game,'data/balance.json'),'utf8'));
 const pages=pageIndex(),readers=readerIndex(),rows=patterns(doc);
 for(const row of rows){
  const mod=M.moduleForPath(row.instance);row.module=Array.isArray(mod)?mod[0]:mod;
  row.pages=pages(row.pattern);row.reader=readers(row.pattern);
  if(READ_ONLY_MODULES[row.module]){row.readOnly=true;row.status='read-only';row.note=READ_ONLY_MODULES[row.module];}
 }
 return {M,doc,rows,leaves:rows.reduce((n,r)=>n+r.count,0)};
}

async function main(){
 const check=process.argv.includes('--check'),{M,doc,rows,leaves}=skeleton();
 if(check){
  const saved=JSON.parse(fs.readFileSync(OUT_JSON,'utf8')),have=new Map(saved.rows.map(r=>[r.pattern,r])),now=new Set(rows.map(r=>r.pattern));
  const missing=rows.filter(r=>!have.has(r.pattern)),moved=rows.filter(r=>have.has(r.pattern)&&have.get(r.pattern).module!==r.module),stale=saved.rows.filter(r=>!now.has(r.pattern));
  for(const r of missing)console.log('缺少追溯紀錄：'+r.pattern+'（'+r.module+'）');
  for(const r of moved)console.log('模組改變：'+r.pattern+' '+have.get(r.pattern).module+' → '+r.module);
  for(const r of stale)console.log('遊戲已無此欄位：'+r.pattern);
  if(missing.length||moved.length||stale.length){console.log('請執行 node scripts/traceability.cjs 重新產生矩陣並檢查新欄位的狀態。');process.exit(1);}
  console.log('追溯矩陣涵蓋目前全部 '+rows.length+' 個欄位樣式（'+M.MODULES.length+' 個模組）');return;
 }
 // The data that is probed: the last commit that changed data/balance.json, and the manifest's integrated hash.
 const commit=cp.execFileSync('git',['-C',game,'log','-1','--format=%H','--','data/balance.json'],{encoding:'utf8'}).trim(),sha256=require('node:crypto').createHash('sha256').update(fs.readFileSync(path.join(game,'data/balance.json'))).digest('hex');
 const store=out=>({pattern:out.pattern,module:out.module,type:out.type,count:out.count,instance:Array.isArray(out.instance)?out.instance.join('.'):out.instance,pages:out.pages,reader:out.reader,status:out.status,
   ...(out.edit?{edit:out.edit,editor:out.editor,validator:out.validator,game:out.game}:{}),...(out.source?{source:out.source}:{}),...(out.note?{note:out.note}:{}),
   ...Object.fromEntries(['editorReason','validatorReason','gameReason'].filter(k=>out[k]).map(k=>[k,out[k]]))});
 const only=process.argv.includes('--only')?new RegExp(process.argv[process.argv.indexOf('--only')+1]):null,reclassify=process.argv.includes('--reclassify');
 let result=rows;
 if(only||reclassify){
  // Stored results are kept for every row that is not probed again; the data must be the data they were made from.
  const saved=JSON.parse(fs.readFileSync(OUT_JSON,'utf8'));if(saved.game.dataSha256&&saved.game.dataSha256!==sha256)throw Error('遊戲資料已不同於矩陣記錄的版本，請完整重新產生');
  const have=new Map(saved.rows.map(r=>[r.pattern,r]));
  if(only){const again=rows.filter(r=>only.test(r.pattern));await probe(doc,again,m=>console.error(m));for(const r of again)have.set(r.pattern,store(r));console.error('重新探測 '+again.length+' 個欄位樣式');}
  result=rows.map(r=>({...have.get(r.pattern),readOnly:r.readOnly}));
 }else await probe(doc,rows,m=>console.error(m));
 classify(result);
 const matrix={schema:'dreaming-abyss-traceability-v1',game:{dataCommit:commit,dataSha256:sha256},leaves,statuses:STATUS,rows:result.map(store)};
 fs.writeFileSync(OUT_JSON,JSON.stringify(matrix,null,1)+'\n');fs.writeFileSync(OUT_MD,markdown(matrix)+'\n');
 const count={};for(const r of matrix.rows)count[r.status]=(count[r.status]||0)+1;console.log(JSON.stringify(count));
}
if(require.main===module)main().catch(e=>{console.error(e);process.exit(1);});
module.exports={patterns,candidates,skeleton,STATUS,markdown,classify,observed,LOST,pipelines};
