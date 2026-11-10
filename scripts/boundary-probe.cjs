#!/usr/bin/env node
/* Boundary values for every numeric field the chain keeps (issue #2, B02).

   For each numeric field that docs/traceability-matrix.json marks effective, six edits are tried on the first
   record: zero, a negative number, a very large number, a fraction (integers only), a string and null. Each edit
   goes to the shared document rules first; what they accept goes to the workbench (import -> export) and the
   release validator (the game's own validation and normalization, compiled into the workbench). A string or null
   that both accept is also loaded by the real game. Recorded per field and edit:
     rules      accepted | rejected
     editor     preserved | rejected | changed (with the value it became)
     validator  preserved | rejected | changed
   and a verdict:
     accepted        every program keeps the value
     rejected        the rules, or both programs, refuse it
     blocked         the workbench keeps it but the validator refuses it: publishing stops at validation
     editor-stricter the workbench refuses or changes it, the validator would keep it
     changed         accepted without an error but the value becomes another one (clamp, rounding, default)
   Nothing is written to any balance file.

   node scripts/boundary-probe.cjs            regenerate docs/boundary-matrix.json and .md (long: tens of minutes)
   node scripts/boundary-probe.cjs --only <regex>   limit to matching field patterns (for a quick look; not saved) */
'use strict';
const fs=require('node:fs'),path=require('node:path');
const T=require('./traceability.cjs');
const root=path.resolve(__dirname,'..'),game=path.resolve(process.env.EMBERWILD_GAME_ROOT||path.join(root,'../DreamingAbyss'));
const OUT_JSON=path.join(root,'docs/boundary-matrix.json'),OUT_MD=path.join(root,'docs/boundary-matrix.md');
const plain=x=>JSON.parse(JSON.stringify(x)),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const get=(doc,p)=>{let x=doc;for(const k of p){if(x==null||typeof x!=='object')return undefined;x=x[k];}return x;};
const set=(doc,p,v)=>{let x=doc;for(const k of p.slice(0,-1))x=x[k];x[p.at(-1)]=v;};
const KINDS={zero:()=>0,negative:()=>-1,huge:()=>1e12,fraction:(v,type)=>type==='integer'?v+0.5:undefined,string:()=>'x',null:()=>null};
const LABEL={zero:'0',negative:'-1',huge:'1e12',fraction:'整數加 0.5',string:'字串 "x"',null:'null'};

function verdict(c){
 if(c.rules==='rejected')return 'rejected';
 const e=c.editor,v=c.validator;
 if(e==='preserved'&&v==='preserved')return c.game&&c.game!=='preserved'?(c.game==='rejected'?'blocked':'changed'):'accepted';
 // The validator refuses it. If the workbench also refuses it, or puts the old value back, the edit goes nowhere.
 if(v==='rejected')return e==='preserved'?'blocked':'rejected';
 if(v==='preserved')return 'editor-stricter';
 // The validator turns it into another value without an error.
 return e==='rejected'?'editor-stricter':'changed';
}

async function main(){
 const only=process.argv.includes('--only')?new RegExp(process.argv[process.argv.indexOf('--only')+1]):null;
 const matrix=JSON.parse(fs.readFileSync(path.join(root,'docs/traceability-matrix.json'),'utf8'));
 const doc=JSON.parse(fs.readFileSync(path.join(game,'data/balance.json'),'utf8'));
 const sha=require('node:crypto').createHash('sha256').update(fs.readFileSync(path.join(game,'data/balance.json'))).digest('hex');
 if(matrix.game.dataSha256!==sha)throw Error('遊戲資料已不同於追溯矩陣記錄的版本，請先重新產生追溯矩陣');
 const fields=matrix.rows.filter(r=>r.status==='effective'&&(r.type==='integer'||r.type==='number')&&(!only||only.test(r.pattern))).map(r=>({pattern:r.pattern,module:r.module,type:r.type,instance:r.instance.split('.'),cases:{}}));
 const log=m=>process.stderr.write(new Date().toISOString().slice(11,19)+' '+m+'\n');
 log('數值欄位：'+fields.length);
 const P=await T.pipelines(),base={editor:P.editor(doc),validator:P.validator(doc)};
 // 1. Shared rules, one edit at a time.
 const jobs=[];
 for(const f of fields){f.from=get(doc,f.instance);for(const [kind,make] of Object.entries(KINDS)){const to=make(f.from,f.type);if(to===undefined||same(to,f.from))continue;const d=plain(doc);set(d,f.instance,to);let ok=false;try{ok=P.inspect(d)===0;}catch{}const c=f.cases[kind]={to,rules:ok?'accepted':'rejected'};if(ok)jobs.push({f,kind,c});}}
 log('共用規則接受的編輯：'+jobs.length+'／'+fields.reduce((n,f)=>n+Object.keys(f.cases).length,0));
 // 2. Workbench and validator: batches of one kind; a rejected batch is split until the rejected edit stands alone.
 const outcome=(out,b,job)=>{const x=get(out,job.f.instance);if(same(x,job.c.to))return ['preserved'];return ['changed',x===undefined?null:x,same(x,get(b,job.f.instance))];};
 const run=(name,batch)=>{
  const d=plain(doc);for(const j of batch)set(d,j.f.instance,j.c.to);
  let out;try{out=P[name](d);}catch(error){
   if(batch.length===1){batch[0].c[name]='rejected';batch[0].c[name+'Reason']=String(error.message||error).split('\n')[0].slice(0,120);return;}
   const half=batch.length>>1;run(name,batch.slice(0,half));run(name,batch.slice(half));return;}
  for(const j of batch){const [state,became,reverted]=outcome(out,base[name],j);j.c[name]=state;if(state==='changed'){j.c[name+'Became']=became;if(reverted)j.c[name+'Reverted']=true;}else{delete j.c[name+'Became'];delete j.c[name+'Reverted'];}}
 };
 for(const name of ['editor','validator']){
  for(const kind of Object.keys(KINDS)){const list=jobs.filter(j=>j.kind===kind);for(let i=0;i<list.length;i+=40)run(name,list.slice(i,i+40));log(name+' '+kind+' 批次完成（'+list.length+'）');}
  const again=jobs.filter(j=>j.c[name]==='changed');for(const j of again)run(name,[j]);log(name+' 單欄位複驗：'+again.length);
 }
 // 3. A wrong type that both programs keep is given to the real game.
 const wrong=jobs.filter(j=>['string','null'].includes(j.kind)&&j.c.editor==='preserved'&&j.c.validator==='preserved');
 const g0=wrong.length?P.game(doc):null;
 for(const j of wrong){const d=plain(doc);set(d,j.f.instance,j.c.to);try{const out=P.game(d);j.c.game=same(get(out,j.f.instance),j.c.to)?'preserved':'changed';if(j.c.game==='changed')j.c.gameBecame=get(out,j.f.instance)??null;}catch(error){j.c.game='rejected';j.c.gameReason=String(error.message||error).split('\n')[0].slice(0,120);}}
 log('交給遊戲的錯誤型別：'+wrong.length);void g0;
 for(const f of fields)for(const c of Object.values(f.cases))c.verdict=verdict(c);
 const result={schema:'dreaming-abyss-boundary-v1',game:matrix.game,kinds:LABEL,fields:fields.map(f=>({pattern:f.pattern,module:f.module,type:f.type,from:f.from,cases:f.cases}))};
 if(only){console.log(JSON.stringify(result.fields,null,1));return;}
 fs.writeFileSync(OUT_JSON,JSON.stringify(result,null,1)+'\n');fs.writeFileSync(OUT_MD,markdown(result)+'\n');
 console.log(JSON.stringify(summary(result)));
}
function summary(result){const out={};for(const f of result.fields)for(const [kind,c] of Object.entries(f.cases)){out[kind]??={};out[kind][c.verdict]=(out[kind][c.verdict]||0)+1;}return out;}
function markdown(result){
 const s=summary(result),verdicts=['accepted','rejected','blocked','editor-stricter','changed'],text={accepted:'三個程式都保留',rejected:'被拒絕',blocked:'工作台保留、驗證器拒絕（發布停在驗證）','editor-stricter':'工作台較嚴格',changed:'沒有錯誤但值被改變'};
 const lines=['# 數值欄位邊界值','','由 `node scripts/boundary-probe.cjs` 產生，請勿手動修改。完整資料在 `boundary-matrix.json`。','',
  result.fields.length+' 個數值欄位（追溯矩陣中狀態為 `effective` 者），每個欄位取第一筆資料嘗試下列編輯。資料 SHA-256 `'+result.game.dataSha256.slice(0,12)+'…`。','',
  '| 編輯 | '+verdicts.map(v=>text[v]).join(' | ')+' |','|---|'+verdicts.map(()=>'--:').join('|')+'|',
  ...Object.keys(result.kinds).map(k=>'| '+result.kinds[k]+' | '+verdicts.map(v=>s[k]?.[v]||0).join(' | ')+' |'),''];
 const list=(title,pick,cols)=>{const rows=[];for(const f of result.fields)for(const [kind,c] of Object.entries(f.cases))if(pick(kind,c))rows.push([f,kind,c]);if(!rows.length)return;
  lines.push('## '+title+'（'+rows.length+'）','','| 欄位 | 模組 | 原值 | 編輯 | '+cols.map(c=>c[0]).join(' | ')+' |','|---|---|---|---|'+cols.map(()=>'---').join('|')+'|');
  for(const [f,kind,c] of rows.slice(0,400))lines.push('| `'+f.pattern+'` | `'+f.module+'` | '+JSON.stringify(f.from)+' | '+result.kinds[kind]+' | '+cols.map(col=>col[1](c)).join(' | ')+' |');
  if(rows.length>400)lines.push('','其餘 '+(rows.length-400)+' 筆見 JSON。');lines.push('');};
 const became=(c,n)=>c[n]==='changed'?'改為 '+JSON.stringify(c[n+'Became'])+(c[n+'Reverted']?'（還原）':''):c[n]==='rejected'?'拒絕：'+(c[n+'Reason']||''):c[n]||'';
 list('錯誤型別或 null 被整條鏈路保留',(k,c)=>['string','null'].includes(k)&&c.verdict==='accepted',[['遊戲',c=>c.game||'']]);
 list('沒有錯誤但值被改變',(k,c)=>c.verdict==='changed',[['工作台',c=>became(c,'editor')],['驗證器',c=>became(c,'validator')],['遊戲',c=>c.game?became(c,'game'):'']]);
 list('工作台保留、驗證器拒絕',(k,c)=>c.verdict==='blocked',[['驗證器',c=>became(c,'validator')],['遊戲',c=>c.game?became(c,'game'):'']]);
 list('工作台較嚴格',(k,c)=>c.verdict==='editor-stricter',[['工作台',c=>became(c,'editor')]]);
 // Negative and zero values every program keeps are listed by module for a designer to read; the probe cannot know intent.
 const by={};for(const f of result.fields)for(const k of ['negative','zero','huge'])if(f.cases[k]?.verdict==='accepted'){(by[f.module]??={negative:0,zero:0,huge:0})[k]++;}
 lines.push('## 各模組被整條鏈路接受的 0、負數與極大值','','探測無法判斷設計意圖；下表供檢視哪些模組的數值沒有範圍限制。','','| 模組 | 0 | -1 | 1e12 |','|---|--:|--:|--:|',...Object.entries(by).map(([m,c])=>'| `'+m+'` | '+c.zero+' | '+c.negative+' | '+c.huge+' |'),'');
 return lines.join('\n');
}
if(require.main===module)main().catch(e=>{console.error(e);process.exit(1);});
module.exports={KINDS,verdict,summary,markdown};
