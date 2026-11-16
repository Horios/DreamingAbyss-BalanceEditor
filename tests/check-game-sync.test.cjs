// The sync check reports the recorded game commit and only fails in --strict mode.
const test=require('node:test'),assert=require('node:assert/strict'),cp=require('node:child_process'),path=require('node:path');
const script=path.join(__dirname,'../scripts/check-game-sync.cjs'),env={...process.env};delete env.GITHUB_ACTIONS;delete env.GITHUB_STEP_SUMMARY;
test('check-game-sync reports synced or behind and fails only in strict mode when behind',()=>{
 const normal=cp.spawnSync(process.execPath,[script],{env,encoding:'utf8'}),strict=cp.spawnSync(process.execPath,[script,'--strict'],{env,encoding:'utf8'});
 assert.equal(normal.status,0,normal.stderr);
 const synced=/已同步到遊戲 v\d+\.\d{3}/.test(normal.stdout),behind=/平衡器落後遊戲 v\d+\.\d{3}.*sync-game\.cjs/.test(normal.stdout);
 assert(synced!==behind,normal.stdout);assert.equal(strict.status,synced?0:1);
});
// Issue #2 A07/E03/E04: hashes of the recorded files decide compatibility, not the version string.
test('check-game-sync separates data-only updates from changed program files and verifies its own copies',t=>{
 const fs=require('node:fs'),os=require('node:os'),{inspect}=require(script);
 const here=inspect(),recorded=here.recorded['發布驗證器'];
 assert.deepEqual(here.internal,[],'the editor\'s own copies are the recorded ones');assert.equal(Object.keys(here.recorded).length,3);
 // Work on a copy of the game at the commit the editor was built from; a shallow CI checkout of a newer game lacks it.
 const clone=fs.mkdtempSync(path.join(os.tmpdir(),'game-sync-')),git=(...a)=>cp.execFileSync('git',['-C',clone,'-c','user.email=t@example.test','-c','user.name=t',...a],{encoding:'utf8',stdio:['ignore','pipe','ignore']});
 try{
  cp.execFileSync('git',['clone','-q',here.game.root,clone],{stdio:'ignore'});
  try{git('checkout','-q',recorded);}catch{return t.skip('the game checkout does not contain the recorded commit '+recorded.slice(0,7));}
  const run=(...args)=>cp.spawnSync(process.execPath,[script,...args],{env:{...env,EMBERWILD_GAME_ROOT:clone},encoding:'utf8'});
  let out=JSON.parse(run('--json').stdout);assert.equal(out.state,'synced');assert.deepEqual(out.program,[]);assert.deepEqual(out.data,[]);assert.equal(run('--strict').status,0);
  // A balance publish: data files move, program files do not.
  const file=path.join(clone,'data/preview-version.json');fs.writeFileSync(file,fs.readFileSync(file,'utf8').replace(/v(\d+)\.(\d{3})/,(_,a,b)=>'v'+a+'.'+String(Number(b)+1).padStart(3,'0')));git('commit','-qam','data');
  out=JSON.parse(run('--json').stdout);assert.equal(out.state,'behind');assert.deepEqual(out.program,[]);assert.deepEqual(out.data.map(f=>f.file),['data/preview-version.json']);
  assert.match(run().stdout,/遊戲程式檔沒有變更/);assert.equal(run().status,0);assert.equal(run('--strict').status,1);
  // A contract file changes: incompatible, named file by file.
  fs.appendFileSync(path.join(clone,'js/balance/balance-document.js'),'\n// newer rule\n');git('commit','-qam','program');
  out=JSON.parse(run('--json').stdout);assert.equal(out.state,'incompatible');assert(out.program.some(f=>f.file==='js/balance/balance-document.js'));
  assert.match(run().stdout,/來源不相容：.*balance-document\.js/);assert.equal(run().status,0,'still a report without --strict');assert.equal(run('--strict').status,1);
 }finally{fs.rmSync(clone,{recursive:true,force:true});}
});
