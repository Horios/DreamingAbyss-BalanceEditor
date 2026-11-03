// The sync check reports the recorded game commit and only fails in --strict mode.
const test=require('node:test'),assert=require('node:assert/strict'),cp=require('node:child_process'),path=require('node:path');
const script=path.join(__dirname,'../scripts/check-game-sync.cjs'),env={...process.env};delete env.GITHUB_ACTIONS;delete env.GITHUB_STEP_SUMMARY;
test('check-game-sync reports synced or behind and fails only in strict mode when behind',()=>{
 const normal=cp.spawnSync(process.execPath,[script],{env,encoding:'utf8'}),strict=cp.spawnSync(process.execPath,[script,'--strict'],{env,encoding:'utf8'});
 assert.equal(normal.status,0,normal.stderr);
 const synced=/已同步到遊戲 v\d+\.\d{3}/.test(normal.stdout),behind=/平衡器落後遊戲 v\d+\.\d{3}.*sync-game\.cjs/.test(normal.stdout);
 assert(synced!==behind,normal.stdout);assert.equal(strict.status,synced?0:1);
});
