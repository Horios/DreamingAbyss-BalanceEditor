#!/usr/bin/env node
/* One command to bring the editor up to the current game checkout.
   Usage: EMBERWILD_GAME_ROOT=/path/to/DreamingAbyss node scripts/sync-game.cjs
   Runs the existing sync and build steps in their required order and records the game commit. */
'use strict';
const cp=require('node:child_process'),path=require('node:path'),fs=require('node:fs');
const root=path.resolve(__dirname,'..'),game=path.resolve(process.env.EMBERWILD_GAME_ROOT||path.join(root,'../DreamingAbyss'));
const git=(...args)=>cp.execFileSync('git',['-C',game,...args],{encoding:'utf8'}).trim();
if(!fs.existsSync(path.join(game,'data/balance.json')))throw Error('找不到遊戲資料：'+game+'（請設定 EMBERWILD_GAME_ROOT）');
const commit=process.env.EMBERWILD_GAME_COMMIT||git('rev-parse','HEAD');
const dirty=git('status','--porcelain','--','js','css','data','index.html');
if(dirty&&!process.argv.includes('--allow-dirty'))throw Error('遊戲的 js／css／data／index.html 有未提交的修改；來源紀錄會對不上 '+commit.slice(0,7)+'。請先提交，或加上 --allow-dirty。\n'+dirty);
const version=JSON.parse(fs.readFileSync(path.join(game,'data/preview-version.json'),'utf8')).version;
const env={...process.env,EMBERWILD_GAME_ROOT:game,EMBERWILD_GAME_COMMIT:commit};
const steps=['sync-preview-editor-contract.cjs','sync-combat-migration.cjs','sync-skill-system.cjs','sync-wishing-lake.cjs','sync-prologue.cjs','sync-tutorials.cjs','sync-incremental-editing.cjs','sync-shared-models.cjs','build-online-runtime.cjs','build-v2-core.cjs','build-v2-assets.cjs','build-online.cjs'];
console.log(`同步遊戲 ${version}（${commit.slice(0,7)}）`);
for(const step of steps){
 process.stdout.write('  '+step+' … ');
 const r=cp.spawnSync(process.execPath,[path.join(__dirname,step)],{cwd:root,env,encoding:'utf8'});
 if(r.status!==0){console.log('失敗');process.stderr.write(r.stdout+r.stderr);process.exit(r.status||1);}
 console.log('完成');
}
console.log('完成。接著執行 npm test 與瀏覽器測試，再提交。');

