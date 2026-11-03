#!/usr/bin/env node
/* Reports whether the editor's recorded game commit matches the game checkout (default ../Emberwild).
   In GitHub Actions a mismatch becomes a warning annotation; --strict turns it into a failure. */
'use strict';
const cp=require('node:child_process'),path=require('node:path'),fs=require('node:fs');
const root=path.resolve(__dirname,'..'),game=path.resolve(process.env.EMBERWILD_GAME_ROOT||path.join(root,'../Emberwild'));
const read=f=>JSON.parse(fs.readFileSync(path.join(root,f),'utf8'));
const head=cp.execFileSync('git',['-C',game,'rev-parse','HEAD'],{encoding:'utf8'}).trim();
const version=JSON.parse(fs.readFileSync(path.join(game,'data/preview-version.json'),'utf8')).version;
const recorded={'發布驗證器':read('server/online/runtime-provenance.json').sourceCommit,'V2 遊戲預覽':read('docs/v2-game-provenance.json').gameCommit};
const behind=Object.entries(recorded).filter(([,c])=>c!==head);
if(!behind.length){console.log(`平衡器已同步到遊戲 ${version}（${head.slice(0,7)}）`);process.exit(0);}
const message=`平衡器落後遊戲 ${version}（${head.slice(0,7)}）：`+behind.map(([k,c])=>`${k}記錄 ${String(c).slice(0,7)}`).join('、')+'。請執行 node scripts/sync-game.cjs 後提交。';
if(process.env.GITHUB_ACTIONS)console.log(`::warning title=平衡器需要同步遊戲::${message}`);else console.log(message);
if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,`### 平衡器需要同步遊戲\n${message}\n`);
process.exit(process.argv.includes('--strict')?1:0);
