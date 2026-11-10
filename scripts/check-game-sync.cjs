#!/usr/bin/env node
/* Reports whether the editor's recorded game sources match the game checkout (default ../DreamingAbyss).

   Three things are compared, not only the version string:
   1. the game commit recorded by each generated part (release validator, V2 preview, module model);
   2. the SHA-256 of every recorded game file against the file in the checkout;
   3. the editor's own copies (scripts/balance-modules.cjs and the model embedded in balance-editor.html)
      against what the provenance says they were built from.

   A changed program file means the editor validates and packages by other rules than the game ("不相容").
   A commit that only changed balance data or files the editor does not use is reported as behind.
   In GitHub Actions a mismatch becomes an annotation; --strict turns any mismatch into a failure.
   --json prints the full result. */
'use strict';
const cp=require('node:child_process'),path=require('node:path'),fs=require('node:fs'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),game=path.resolve(process.env.EMBERWILD_GAME_ROOT||path.join(root,'../DreamingAbyss'));
const read=f=>JSON.parse(fs.readFileSync(path.join(root,f),'utf8')),sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const gameFile=f=>{const p=path.join(game,f.split('?')[0]);return fs.existsSync(p)?fs.readFileSync(p):null;};

function inspect(){
 const head=cp.execFileSync('git',['-C',game,'rev-parse','HEAD'],{encoding:'utf8'}).trim();
 const version=JSON.parse(fs.readFileSync(path.join(game,'data/preview-version.json'),'utf8')).version;
 const runtime=read('server/online/runtime-provenance.json'),v2=read('docs/v2-game-provenance.json'),model=read('docs/balance-modules-provenance.json');
 const recorded={'發布驗證器':runtime.sourceCommit,'V2 遊戲預覽':v2.gameCommit,'模組共用程式':model.gameCommit};
 const behind=Object.entries(recorded).filter(([,c])=>c!==head).map(([part,commit])=>({part,commit}));
 // Program files decide compatibility; data/ changes with every balance publish and is expected to move.
 const program=[],data=[];
 const compare=(part,file,expected)=>{
  const bytes=gameFile(file),clean=file.split('?')[0];
  if(bytes===null){program.push({part,file:clean,reason:'遊戲已無此檔案'});return;}
  if(sha(bytes)!==expected)(clean.startsWith('data/')?data:program).push({part,file:clean,reason:'內容不同'});
 };
 for(const f of runtime.files)if(f.path!=='inline')compare('發布驗證器',f.path,f.sha256);
 for(const f of v2.files)compare('V2 遊戲預覽',f.path,f.sha256);
 compare('模組共用程式','js/balance/balance-modules.js',model.sha256);
 for(const c of runtime.contract||[]){const bytes=gameFile(c.path);if(bytes===null||crypto.createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex')!==c.gitBlob)program.push({part:'發布契約',file:c.path,reason:'Git blob 不同'});}
 // The editor's own copies must be the recorded ones, whatever the game checkout is.
 const internal=[],vendored=fs.readFileSync(path.join(root,'scripts/balance-modules.cjs'),'utf8'),html=fs.readFileSync(path.join(root,'balance-editor.html'),'utf8');
 if(sha(vendored)!==model.sha256)internal.push({file:'scripts/balance-modules.cjs',reason:'與 docs/balance-modules-provenance.json 記錄的雜湊不同'});
 const embedded=html.match(/<script id="balance-modules-model" data-sha256="([a-f0-9]{64})">\n([\s\S]*?)\n<\/script>/);
 if(!embedded)internal.push({file:'balance-editor.html',reason:'找不到內嵌的模組共用程式'});
 else if(embedded[1]!==model.sha256||sha(embedded[2])!==model.sha256)internal.push({file:'balance-editor.html',reason:'內嵌的模組共用程式與記錄的雜湊不同'});
 const seen=new Set(),unique=rows=>rows.filter(r=>{if(seen.has(r.file))return false;seen.add(r.file);return true;});
 const programFiles=unique(program),dataFiles=unique(data);
 const state=internal.length||programFiles.length?'incompatible':behind.length?'behind':'synced';
 return {state,game:{root:game,commit:head,version},recorded,behind,program:programFiles,data:dataFiles,internal};
}

function main(){
 const strict=process.argv.includes('--strict'),r=inspect(),short=c=>String(c).slice(0,7);
 if(process.argv.includes('--json')){console.log(JSON.stringify(r,null,2));process.exit(r.state==='synced'||!strict?0:1);}
 if(r.state==='synced'){console.log(`平衡器已同步到遊戲 ${r.game.version}（${short(r.game.commit)}）：${Object.keys(r.recorded).length} 份來源紀錄與全部程式檔雜湊相符`+(r.data.length?`；${r.data.length} 個資料檔與封裝時不同（遊戲工作目錄有未提交的資料修改：${r.data.map(f=>f.file).join('、')}）`:''));process.exit(0);}
 const lines=[];
 if(r.behind.length)lines.push(`平衡器落後遊戲 ${r.game.version}（${short(r.game.commit)}）：`+r.behind.map(b=>`${b.part}記錄 ${short(b.commit)}`).join('、')+'。');
 if(r.program.length)lines.push(`來源不相容：${r.program.length} 個遊戲程式檔與平衡器建置時不同（`+r.program.slice(0,6).map(f=>f.file).join('、')+(r.program.length>6?'…':'')+'）。平衡器會以舊規則驗證與封裝。');
 else if(r.behind.length)lines.push(r.data.length?`平衡器使用的遊戲程式檔沒有變更；${r.data.length} 個資料檔已更新（線上資料由工作台執行時取得）。`:'平衡器使用的遊戲程式檔沒有變更。');
 for(const i of r.internal)lines.push(`平衡器內部不一致：${i.file} ${i.reason}。`);
 lines.push('請執行 node scripts/sync-game.cjs 後提交。');
 const message=lines.join(' ');
 if(process.env.GITHUB_ACTIONS)console.log(`::${r.state==='incompatible'?'error':'warning'} title=平衡器需要同步遊戲::${message}`);else console.log(message);
 if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,`### 平衡器需要同步遊戲\n${lines.join('\n')}\n`);
 process.exit(strict?1:0);
}
if(require.main===module)main();
module.exports={inspect};
