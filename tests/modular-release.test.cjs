'use strict';
// Modular publishing against an in-memory Git: only changed module files are written together with the manifest,
// the generated data/balance.json and the next preview version in one commit; conflicts are detected per module.
const test=require('node:test'),assert=require('node:assert/strict'),{ReleaseService}=require('../server/release-service.cjs'),M=require('../scripts/balance-modules.cjs');
const {git,filesFor,edit,seed,inspect}=require('./modular-git-fixture.cjs');
const service=g=>new ReleaseService({api:g.api,validate:d=>{const e=inspect(d);if(e.length)throw Object.assign(Error(e.map(x=>x.field+'：'+x.reason).join('；')),{issues:e});return JSON.parse(JSON.stringify(d));}});

test('a monster HP publish writes only that module, the manifest, data/balance.json and the next preview version',async()=>{
 const g=git({'chatgpt-dev':filesFor(seed),main:filesFor(seed,{version:'v0.118'})}),s=service(g),snap=await s.snapshot({branch:'chatgpt-dev'});
 assert.equal(snap.layout,'modular');assert.equal(snap.consistency,'consistent');
 const view=s.view(snap);assert.equal(view.modules['world/monsters'].version,1);assert.equal(view.blobs,undefined);
 const changed=M.split(edit(seed)).modules['world/monsters'];
 const p=await s.prepare({expectedCommit:snap.commit,message:'調整苔原史萊姆生命',modules:{'world/monsters':changed},baseModules:{'world/monsters':view.modules['world/monsters'].sha256}},'u');
 assert.deepEqual(p.modules.map(m=>[m.id,m.from,m.to]),[['world/monsters',1,2]]);assert.equal(p.diff.total,1);assert.equal(p.diff.rows[0].module,'world/monsters');
 assert.deepEqual(p.previewVersion,{from:'v0.120',to:'v0.121'});
 const out=await s.commit({ticket:p.ticket,confirmed:true},'u');assert(out.committed);
 const trees=g.calls.filter(([m,p])=>m==='POST'&&p.endsWith('/git/trees'));assert.equal(trees.length,1);
 const after=g.filesAt(g.refs['chatgpt-dev']),before=g.filesAt(snap.commit),written=Object.keys(after).filter(f=>after[f]!==before[f]).sort();
 assert.deepEqual(written,['data/balance.json','data/balance/manifest.json','data/balance/world/monsters.json','data/preview-version.json']);
 assert.equal(JSON.parse(after['data/preview-version.json']).version,'v0.121');
 const manifest=JSON.parse(after[M.MANIFEST_FILE]);for(const row of manifest.modules)assert.equal(row.version,row.id==='world/monsters'?2:1,row.id);
 assert.equal(JSON.parse(after['data/balance.json']).balanceSettings.monsters.catalog[0].hpMultiplier,1.5);
 assert.equal((await s.snapshot({branch:'chatgpt-dev'})).consistency,'consistent');
 assert.match(g.commits.get(g.refs['chatgpt-dev']).message,/Modules: world\/monsters v1→v2[\s\S]*Preview-Version: v0\.121/);
});

test('concurrent sessions: a changed module conflicts, a different module merges onto the newer commit, nothing is overwritten',async()=>{
 const g=git({'chatgpt-dev':filesFor(seed)}),s=service(g),old=s.view(await s.snapshot({branch:'chatgpt-dev'}));
 const a=await s.prepare({expectedCommit:old.commit,message:'甲調整怪物',modules:{'world/monsters':M.split(edit(seed)).modules['world/monsters']},baseModules:{'world/monsters':old.modules['world/monsters'].sha256}},'a');
 await s.commit({ticket:a.ticket,confirmed:true},'a');
 const other=structuredClone(seed);other.balanceSettings.monsters.catalog[1].hpMultiplier=2;
 await assert.rejects(()=>s.prepare({expectedCommit:old.commit,message:'乙也調整怪物',modules:{'world/monsters':M.split(other).modules['world/monsters']},baseModules:{'world/monsters':old.modules['world/monsters'].sha256}},'b'),e=>e.status===409&&e.conflicts?.[0]?.id==='world/monsters');
 await assert.rejects(()=>s.prepare({expectedCommit:old.commit,message:'沒有模組基準',data:other},'b'),e=>e.status===409);
 const drops=structuredClone(seed);drops.balanceSettings.drops.entries[0].chanceByDifficulty=[0.03,0.04,0.05];
 const c=await s.prepare({expectedCommit:old.commit,message:'丙調整掉落',modules:{'world/drops':M.split(drops).modules['world/drops']},baseModules:{'world/drops':old.modules['world/drops'].sha256}},'c');
 assert.deepEqual(c.modules.map(m=>m.id),['world/drops']);await s.commit({ticket:c.ticket,confirmed:true},'c');
 const final=JSON.parse(g.filesAt(g.refs['chatgpt-dev'])['data/balance.json']);
 assert.equal(final.balanceSettings.monsters.catalog[0].hpMultiplier,1.5,'first publish kept');assert.deepEqual(final.balanceSettings.drops.entries[0].chanceByDifficulty,[0.03,0.04,0.05]);
 // A used ticket is not replayed.
 await assert.rejects(()=>s.commit({ticket:c.ticket,confirmed:true},'c'),/過期|已使用/);
});

test('invalid references, empty publishes and a legacy-written integrated file are refused before any write',async()=>{
 const legacy=filesFor(seed);legacy['data/balance.json']=M.serialize(edit(seed));
 const g=git({'chatgpt-dev':filesFor(seed),stale:legacy}),s=service(g),snap=s.view(await s.snapshot({branch:'chatgpt-dev'}));
 const removed=structuredClone(seed);removed.balanceSettings.monsters.catalog.splice(1,1);
 await assert.rejects(()=>s.prepare({expectedCommit:snap.commit,message:'刪除被引用的怪物',data:removed},'u'),/balanceSettings\.drops\.entries\.\d+\.sources：引用不存在的怪物/);
 await assert.rejects(()=>s.prepare({expectedCommit:snap.commit,message:'沒有任何修改',data:seed},'u'),/沒有有效設定差異/);
 g.refs['chatgpt-dev']=g.refs.stale;
 await assert.rejects(()=>s.prepare({expectedCommit:g.refs.stale,message:'在不一致的分支上發布',data:edit(edit(seed))},'u'),e=>e.status===409&&/resync/.test(e.message));
 assert(!g.calls.some(([m])=>m==='POST'),'nothing was written');
});

test('promotion copies the tested snapshot (modules, manifest, integrated file) and restore rewrites from one historic commit',async()=>{
 const g=git({'chatgpt-dev':filesFor(seed),main:filesFor(seed,{version:'v0.118'})}),s=service(g),dev=s.view(await s.snapshot({branch:'chatgpt-dev'}));
 const p=await s.prepare({expectedCommit:dev.commit,message:'測試版調整',data:edit(seed)},'u');await s.commit({ticket:p.ticket,confirmed:true},'u');
 const main=await s.snapshot({branch:'main'}),promote=await s.prepare({kind:'promote',sourceCommit:g.refs['chatgpt-dev'],expectedCommit:main.commit,message:'正式發布怪物調整'},'u');
 assert.equal(promote.previewVersion,null,'main keeps its own version file');
 await s.commit({ticket:promote.ticket,confirmed:true,productionConfirmation:'正式版'},'u');
 const m=g.filesAt(g.refs.main),d=g.filesAt(g.refs['chatgpt-dev']);
 for(const f of Object.keys(d).filter(f=>f.startsWith('data/balance')))assert.equal(m[f],d[f],f);
 assert.equal(JSON.parse(m['data/preview-version.json']).version,'v0.118');
 const restore=await s.prepare({kind:'restore',branch:'chatgpt-dev',restoreCommit:dev.commit,expectedCommit:g.refs['chatgpt-dev']},'u');
 assert.deepEqual(restore.modules.map(x=>x.id),['world/monsters']);await s.commit({ticket:restore.ticket,confirmed:true},'u');
 assert.equal(g.filesAt(g.refs['chatgpt-dev'])['data/balance.json'],filesFor(seed)['data/balance.json']);
 assert.equal((await s.snapshot({branch:'chatgpt-dev'})).consistency,'consistent');
 const history=await s.history({branch:'chatgpt-dev',module:'world/monsters'}).catch(e=>e);assert(history instanceof Error||history.file==='data/balance/world/monsters.json');
});
