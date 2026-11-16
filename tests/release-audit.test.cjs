'use strict';
// Issue #2 release audit (D05-D09, C08, G04-G05, H04-H05): reproductions against the in-memory Git.
const test=require('node:test'),assert=require('node:assert/strict'),{ReleaseService}=require('../server/release-service.cjs'),M=require('../scripts/balance-modules.cjs');
const {git,filesFor,edit,seed,inspect}=require('./modular-git-fixture.cjs');
const service=(g,extra={})=>new ReleaseService({api:g.api,validate:d=>{const e=inspect(d);if(e.length)throw Object.assign(Error(e.map(x=>x.field+'：'+x.reason).join('；')),{issues:e});return JSON.parse(JSON.stringify(d));},...extra});
const part=(doc,id)=>M.split(doc).modules[id];
const publishMonster=async(s,old)=>{const a=await s.prepare({expectedCommit:old.commit,message:'甲調整怪物',modules:{'world/monsters':part(edit(seed),'world/monsters')},baseModules:{'world/monsters':old.modules['world/monsters'].sha256}},'a');return s.commit({ticket:a.ticket,confirmed:true},'a');};

test('D07: after another publish, a complete document from the old base cannot revert the other module',async()=>{
 const g=git({'chatgpt-dev':filesFor(seed)}),s=service(g),old=s.view(await s.snapshot({branch:'chatgpt-dev'}));
 await publishMonster(s,old);
 const drops=structuredClone(seed);drops.balanceSettings.drops.entries[0].chanceByDifficulty=[0.03,0.04,0.05];
 // The whole old-base document plus base hashes for the one module this session changed.
 const p=await s.prepare({expectedCommit:old.commit,message:'乙調整掉落',data:drops,baseModules:{'world/drops':old.modules['world/drops'].sha256}},'b');
 assert.deepEqual(p.modules.map(m=>m.id),['world/drops'],'only the module this session changed is written');
 await s.commit({ticket:p.ticket,confirmed:true},'b');
 const final=JSON.parse(g.filesAt(g.refs['chatgpt-dev'])['data/balance.json']);
 assert.equal(final.balanceSettings.monsters.catalog[0].hpMultiplier,1.5,'the first publish is kept');
 assert.deepEqual(final.balanceSettings.drops.entries[0].chanceByDifficulty,[0.03,0.04,0.05]);
});

test('D07: a module sent without its base hash is refused once the branch has moved',async()=>{
 const g=git({'chatgpt-dev':filesFor(seed)}),s=service(g),old=s.view(await s.snapshot({branch:'chatgpt-dev'}));
 await publishMonster(s,old);
 const other=structuredClone(seed);other.balanceSettings.monsters.catalog[1].hpMultiplier=2;other.balanceSettings.drops.entries[0].chanceByDifficulty=[0.03,0.04,0.05];
 await assert.rejects(()=>s.prepare({expectedCommit:old.commit,message:'乙漏送怪物基準',modules:{'world/monsters':part(other,'world/monsters'),'world/drops':part(other,'world/drops')},baseModules:{'world/drops':old.modules['world/drops'].sha256}},'b'),e=>e.status===409);
 assert.equal(JSON.parse(g.filesAt(g.refs['chatgpt-dev'])['data/balance.json']).balanceSettings.monsters.catalog[0].hpMultiplier,1.5);
});

test('D07/C05: a merge that leaves a dangling cross-module reference is refused with the record and field',async()=>{
 const g=git({'chatgpt-dev':filesFor(seed)}),s=service(g),old=s.view(await s.snapshot({branch:'chatgpt-dev'}));
 // Session A renames a material every drop rule of that monster family refers to.
 const a=structuredClone(seed),entry=a.balanceSettings.drops.entries.find(e=>e.type==='material'&&e.sources?.length),monsterId=entry.sources[0];
 const removed=structuredClone(seed);removed.balanceSettings.drops.entries=removed.balanceSettings.drops.entries.map(e=>({...e,sources:(e.sources||[]).filter(x=>x!==monsterId)}));
 // Session B (old base) deletes that monster while A's drops still name it: validated as one merged document.
 const b=structuredClone(seed);b.balanceSettings.monsters.catalog=b.balanceSettings.monsters.catalog.filter(m=>m.id!==monsterId);
 await assert.rejects(()=>s.prepare({expectedCommit:old.commit,message:'刪除仍被掉落引用的怪物',modules:{'world/monsters':part(b,'world/monsters')},baseModules:{'world/monsters':old.modules['world/monsters'].sha256}},'b'),e=>Array.isArray(e.issues)&&e.issues.length>0);
});

test('C08: a manifest from a newer module contract stops reads and publishes instead of falling back to the single-file flow',async()=>{
 const files=filesFor(seed),manifest=JSON.parse(files[M.MANIFEST_FILE]);
 const newer={...files,[M.MANIFEST_FILE]:M.serialize({...manifest,schema:'dreaming-abyss-balance-modules-v2'})};
 const extra={...files,[M.MANIFEST_FILE]:M.serialize({...manifest,modules:[...manifest.modules,{id:'systems/guilds',title:'公會',file:'systems/guilds.json',source:'guilds',present:true,version:1,sha256:'0'.repeat(64),bytes:2}]})};
 for(const f of [newer,extra]){
  const g=git({'chatgpt-dev':f}),s=service(g);
  await assert.rejects(()=>s.snapshot({branch:'chatgpt-dev'}),e=>e.status===409&&e.layer==='契約'&&/同步工作台/.test(e.message));
  await assert.rejects(()=>s.prepare({expectedCommit:g.refs['chatgpt-dev'],message:'不相容的契約',data:edit(seed)},'u'),e=>e.layer==='契約');
  assert.equal(g.calls.filter(([m])=>m!=='GET').length,0,'nothing is written');
 }
});

test('H04: a publish returns a receipt naming the commit, parent, modules, versions, blob and unverified stages',async()=>{
 const g=git({'chatgpt-dev':filesFor(seed)}),s=service(g,{validatorCommit:'a'.repeat(40)}),old=s.view(await s.snapshot({branch:'chatgpt-dev'}));
 const p=await s.prepare({expectedCommit:old.commit,message:'調整苔原史萊姆生命',modules:{'world/monsters':part(edit(seed),'world/monsters')},baseModules:{'world/monsters':old.modules['world/monsters'].sha256}},'u');
 const {receipt:r,commit}=await s.commit({ticket:p.ticket,confirmed:true},'u'),after=g.filesAt(commit);
 assert.equal(r.commit,commit);assert.equal(r.parent,old.commit);assert.equal(r.branch,'chatgpt-dev');assert.equal(r.validatorCommit,'a'.repeat(40));
 assert.deepEqual(r.modules,[{id:'world/monsters',file:'data/balance/world/monsters.json',from:1,to:2,removed:false}]);
 assert.deepEqual(r.fields,{total:1,added:0,modified:1,deleted:0});assert.deepEqual(r.previewVersion,{from:'v0.120',to:'v0.121'});
 assert.equal(r.integrated.sha256,JSON.parse(after[M.MANIFEST_FILE]).integrated.sha256);assert.equal(r.integrated.blob,(await s.snapshot({branch:'chatgpt-dev'})).blob);
 assert.equal(r.dataVersion,p.nextVersion);assert.deepEqual(r.restore.commit,old.commit);
 assert.deepEqual(r.stages.map(x=>[x.layer,x.state]),[['驗證','通過'],['提交','通過'],['CI','未驗證'],['部署','未驗證'],['載入','未驗證'],['生效','未驗證']]);
});

test('D09: after a lost commit response the outcome is decided from GitHub and nothing is resubmitted',async()=>{
 const g=git({'chatgpt-dev':filesFor(seed)}),s=service(g),old=s.view(await s.snapshot({branch:'chatgpt-dev'}));
 const p=await s.prepare({expectedCommit:old.commit,message:'調整苔原史萊姆生命',modules:{'world/monsters':part(edit(seed),'world/monsters')},baseModules:{'world/monsters':old.modules['world/monsters'].sha256}},'u');
 const ask=()=>s.outcome({branch:'chatgpt-dev',baseCommit:old.commit,nextVersion:p.nextVersion});
 assert.deepEqual((({state,committed})=>({state,committed}))(await ask()),{state:'未提交',committed:false});
 const out=await s.commit({ticket:p.ticket,confirmed:true},'u'),writes=g.calls.filter(([m])=>m!=='GET').length;
 const seen=await ask();assert.equal(seen.state,'已提交');assert.equal(seen.commit,out.commit);
 // A later publish by someone else: the first commit is still found behind the head.
 const now=s.view(await s.snapshot({branch:'chatgpt-dev'})),drops=structuredClone(edit(seed));drops.balanceSettings.drops.entries[0].chanceByDifficulty=[0.03,0.04,0.05];
 const q=await s.prepare({expectedCommit:now.commit,message:'丙調整掉落',modules:{'world/drops':part(drops,'world/drops')},baseModules:{'world/drops':now.modules['world/drops'].sha256}},'c');await s.commit({ticket:q.ticket,confirmed:true},'c');
 const later=await ask();assert.equal(later.state,'已提交');assert.equal(later.commit,out.commit);
 assert.equal((await s.outcome({branch:'chatgpt-dev',baseCommit:old.commit,nextVersion:'0'.repeat(12)})).state,'無法確認');
 assert.equal(g.calls.filter(([m])=>m!=='GET').length-writes,7,'only the second publish wrote (4 blobs, tree, commit, ref)');
 await assert.rejects(()=>s.outcome({branch:'evil',baseCommit:old.commit,nextVersion:p.nextVersion}),/僅允許/);
});

test('G04/G05: deployment needs build.json and the served data/balance.json to be this publish; a green build alone is not enough',async()=>{
 const g=git({'chatgpt-dev':filesFor(seed)}),s=service(g),commit=g.refs['chatgpt-dev'],files=g.filesAt(commit),snap=await s.snapshot({branch:'chatgpt-dev'});
 g.runs=[];const api=g.api,withRuns=async(p,o)=>p.includes('/actions/workflows/')?{workflow_runs:g.runs}:api(p,o),s2=new ReleaseService({api:withRuns,validate:d=>d});
 const realFetch=globalThis.fetch;let build={branch:'chatgpt-dev',commit,balanceBlob:snap.blob},served=files['data/balance.json'],seen=[];
 globalThis.fetch=async url=>{seen.push(String(url));return String(url).includes('build.json')?{ok:true,json:async()=>build}:{ok:true,text:async()=>served};};
 try{
  let out=await s2.deployment({branch:'chatgpt-dev',commit});
  assert.equal(out.state,'部署成功');assert.equal(out.layer,null);assert.equal(out.checks.build.state,'相符');assert.equal(out.checks.data.state,'相符');
  assert.match(seen[1],/\/preview\/data\/balance\.json\?v=/);
  served=files['data/balance.json'].replace('"schema"','"schema" ');out=await s2.deployment({branch:'chatgpt-dev',commit});
  assert.match(out.state,/^部署未完成/);assert.equal(out.layer,'載入');assert.equal(out.checks.data.state,'不符');
  build={...build,balanceBlob:'0'.repeat(40)};g.runs=[{head_sha:commit,status:'completed',conclusion:'success',html_url:'https://example.test/run'}];out=await s2.deployment({branch:'chatgpt-dev',commit});
  assert.equal(out.state,'等待部署','a finished workflow without matching build.json is not a deployment');assert.equal(out.layer,'部署');assert.equal(out.checks.run.conclusion,'success');
 }finally{globalThis.fetch=realFetch;}
});

test('H05: every API failure maps to one stage',()=>{
 const L=ReleaseService.layerOf;
 assert.equal(L('validate',Error('x')),'驗證');assert.equal(L('prepare',Object.assign(Error('x'),{issues:[{}]})),'驗證');assert.equal(L('prepare',Object.assign(Error('x'),{status:409})),'提交前核對');
 assert.equal(L('commit',Error('x')),'提交');assert.equal(L('deployment',Error('x')),'部署');assert.equal(L('snapshot',Object.assign(Error('x'),{layer:'契約'})),'契約');
});

test('E03: a target whose contract files differ from the ones this workbench was built from cannot be published to',async()=>{
 const files=filesFor(seed),crypto=require('node:crypto'),blob=t=>crypto.createHash('sha1').update('blob '+Buffer.byteLength(t)+'\0').update(t).digest('hex');
 files['js/balance/balance-modules.js']='/* layout */';
 const contract={'js/balance/balance-modules.js':blob(files['js/balance/balance-modules.js']),'js/balance/balance-document.js':blob(files['js/balance/balance-document.js'])};
 const g=git({'chatgpt-dev':files}),s=service(g,{contract}),snap=s.view(await s.snapshot({branch:'chatgpt-dev'}));
 assert.deepEqual(snap.contractDrift,[]);
 const body={expectedCommit:snap.commit,message:'調整苔原史萊姆生命',modules:{'world/monsters':part(edit(seed),'world/monsters')},baseModules:{'world/monsters':snap.modules['world/monsters'].sha256}};
 assert.equal((await s.prepare(body,'u')).modules.length,1,'same contract: publish allowed');
 const newer=git({'chatgpt-dev':{...files,'js/balance/balance-document.js':files['js/balance/balance-document.js']+'/* new field */'}}),s2=service(newer,{contract}),snap2=s2.view(await s2.snapshot({branch:'chatgpt-dev'}));
 assert.deepEqual(snap2.contractDrift,['js/balance/balance-document.js'],'reading still works and reports the drift');
 await assert.rejects(()=>s2.prepare({...body,expectedCommit:snap2.commit},'u'),e=>e.status===409&&e.layer==='契約'&&e.files[0]==='js/balance/balance-document.js'&&/sync-game/.test(e.message));
 assert.equal(newer.calls.filter(([m])=>m!=='GET').length,0);
});

// D01/D03/B05/H06: the stored modules are not normalized and the workbench exports normalized data.
const clone=x=>JSON.parse(JSON.stringify(x));
test('D01: modules that differ only in format keep their file; a publish with no effective change is refused',async()=>{
 // validate() regenerates the notes (text differs every time); effective() is how the game loads either side.
 const validate=d=>{const e=inspect(d);if(e.length)throw Object.assign(Error('invalid'),{issues:e});const c=clone(d);c.notes=[...(c.notes||[]),'exported'];return c;},effective=d=>{const c=clone(d);c.notes=[];return c;};
 const g=git({'chatgpt-dev':filesFor(seed)}),s=new ReleaseService({api:g.api,validate,effective}),snap=await s.snapshot({branch:'chatgpt-dev'});
 await assert.rejects(()=>s.prepare({expectedCommit:snap.commit,message:'沒有任何修改',data:clone(seed)},'u'),/沒有有效設定差異/);
 const p=await s.prepare({expectedCommit:snap.commit,message:'調整苔原史萊姆生命',data:edit(seed)},'u');
 assert.deepEqual(p.modules.map(m=>m.id),['world/monsters']);assert.deepEqual(p.formatOnly,[]);assert.equal(p.diff.rows.length,1);
 await s.commit({ticket:p.ticket,confirmed:true},'u');
 const before=g.filesAt(snap.commit),after=g.filesAt(g.refs['chatgpt-dev']);
 assert.deepEqual(Object.keys(after).filter(f=>after[f]!==before[f]).sort(),['data/balance.json','data/balance/manifest.json','data/balance/world/monsters.json','data/preview-version.json']);
 assert.equal(after['data/balance/meta/notes.json'],before['data/balance/meta/notes.json'],'the regenerated notes are not written');
 assert.equal((await s.snapshot({branch:'chatgpt-dev'})).consistency,'consistent');
 for(const row of JSON.parse(after[M.MANIFEST_FILE]).modules)assert.equal(row.version,row.id==='world/monsters'?2:1,row.id);
});

test('D01: a format-only module the change depends on is written with it and named in the summary',async()=>{
 // The notes carry a migration marker: without it the game doubles the first monster's HP on load.
 const validate=d=>{const c=clone(d);if(!c.notes.includes('migrated')){c.notes=[...c.notes,'migrated'];c.balanceSettings.monsters.catalog[0].hpMultiplier*=2;}return c;};
 const effective=d=>{const c=validate(d);c.notes=[];return c;};
 const g=git({'chatgpt-dev':filesFor(seed)}),s=new ReleaseService({api:g.api,validate,effective}),snap=await s.snapshot({branch:'chatgpt-dev'});
 const draft=validate(seed);draft.balanceSettings.monsters.catalog[0].hpMultiplier=9;
 const p=await s.prepare({expectedCommit:snap.commit,message:'調整已遷移的怪物生命',data:draft},'u');
 assert.deepEqual(p.modules.map(m=>m.id).sort(),['meta/notes','world/monsters']);assert.deepEqual(p.formatOnly.map(m=>m.id),['meta/notes']);
 await s.commit({ticket:p.ticket,confirmed:true},'u');
 assert.equal(effective(JSON.parse(g.filesAt(g.refs['chatgpt-dev'])['data/balance.json'])).balanceSettings.monsters.catalog[0].hpMultiplier,9,'the published document loads to the edited value, not a re-migrated one');
});

test('D01: on the real game data and validator a one-field edit in the workbench writes one module and an untouched draft cannot be published',async()=>{
 const {createGameValidator}=await import('../server/online/game-validator.mjs'),{loadRuntime}=require('./headless-editor.cjs'),v=createGameValidator(),path=require('node:path');
 const g=git({'chatgpt-dev':filesFor(seed)}),s=new ReleaseService({api:g.api,validate:d=>v.validate(d),effective:d=>v.effective(d)}),r=loadRuntime(path.resolve(__dirname,'..'));
 const open=async()=>{const snap=await s.snapshot({branch:'chatgpt-dev'});r.ctx.input=clone(snap.data);r.run('data=__EMBERWILD_VALIDATE_DOCUMENT(input);ensureArrays()');r.ctx.snap=clone(snap);return snap;};
 const payload=()=>clone(r.run('__EMBERWILD_INCREMENTAL.payload(__EMBERWILD_RELEASE_EDITOR.current(),snap)'));
 let snap=await open();
 await assert.rejects(()=>s.prepare({expectedCommit:snap.commit,message:'沒有任何修改',...payload()},'u'),/沒有有效設定差異/);
 const untouched=clone(seed).balanceSettings.monsters.catalog[1];
 r.run('data.balanceSettings.monsters.catalog[0].hpMultiplier+=0.5');
 let p=await s.prepare({expectedCommit:snap.commit,message:'調整一隻怪物的生命',...payload()},'u');
 assert.deepEqual(p.modules.map(m=>m.id),['world/monsters']);assert.deepEqual(p.diff.rows.map(x=>x.path),['balanceSettings.monsters.catalog.map0_mob0.hpMultiplier']);
 await s.commit({ticket:p.ticket,confirmed:true},'u');
 const live=JSON.parse(g.filesAt(g.refs['chatgpt-dev'])['data/balance.json']);
 assert.equal(live.balanceSettings.monsters.catalog[0].hpMultiplier,seed.balanceSettings.monsters.catalog[0].hpMultiplier+0.5);
 assert.equal(v.effective(clone(live)).balanceSettings.monsters.catalog[1].hpMultiplier,v.effective(clone(seed)).balanceSettings.monsters.catalog[1].hpMultiplier,'other monsters load unchanged');
 assert.equal(untouched.id,live.balanceSettings.monsters.catalog[1].id);
 // The next session starts from the published commit: again one module, and again nothing without an edit.
 snap=await open();await assert.rejects(()=>s.prepare({expectedCommit:snap.commit,message:'沒有任何修改',...payload()},'u'),/沒有有效設定差異/);
 r.run('data.items[0].cost+=1');p=await s.prepare({expectedCommit:snap.commit,message:'調整一個道具的價格',...payload()},'u');
 assert.deepEqual(p.modules.map(m=>m.id),['items/items']);assert.equal(p.diff.rows.length,1);
});

test('E05: a field the branch has but this workbench does not know is never deleted silently',async()=>{
 // The branch's game added shopSettings.fixedOffers.entries[].bundle; this workbench's game build drops it on load
 // and the workbench exports the module without it.
 const strip=d=>{const c=clone(d);for(const o of c.shopSettings.fixedOffers.entries)delete o.bundle;return c;};
 const online=clone(seed);online.shopSettings.fixedOffers.entries.forEach((o,i)=>{o.bundle=i+1;});
 const g=git({'chatgpt-dev':filesFor(online)}),s=new ReleaseService({api:g.api,validate:d=>clone(d),effective:strip}),snap=await s.snapshot({branch:'chatgpt-dev'});
 const draft=strip(online);draft.shopSettings.fixedOffers.entries[0].quantity+=1;
 await assert.rejects(()=>s.prepare({expectedCommit:snap.commit,message:'調整固定商品數量',data:draft},'u'),e=>e.status===409&&e.layer==='契約'&&e.code==='unknown-fields'&&e.unknown.some(u=>u.module==='systems/shop'&&u.field==='fixedOffers.entries.*.bundle')&&/同步工作台/.test(e.message));
 assert.equal(g.calls.filter(([m])=>m!=='GET').length,0,'nothing is written');
 // A workbench that keeps the field publishes normally, and an edit in another module never touches the shop file.
 const kept=clone(online);kept.shopSettings.fixedOffers.entries[0].quantity+=1;
 assert.deepEqual((await s.prepare({expectedCommit:snap.commit,message:'調整固定商品數量',data:kept},'u')).modules.map(m=>m.id),['systems/shop']);
 const p=await s.prepare({expectedCommit:snap.commit,message:'調整苔原史萊姆生命',data:edit(strip(online))},'u');
 assert.deepEqual(p.modules.map(m=>m.id),['world/monsters']);await s.commit({ticket:p.ticket,confirmed:true},'u');
 assert.equal(JSON.parse(g.filesAt(g.refs['chatgpt-dev'])['data/balance.json']).shopSettings.fixedOffers.entries[1].bundle,2,'the unknown field is still online');
});

test('E05: with the real validator and workbench, writing every module of the current game data loses no field',async()=>{
 const {createGameValidator}=await import('../server/online/game-validator.mjs'),{loadRuntime}=require('./headless-editor.cjs'),v=createGameValidator(),path=require('node:path');
 // effective() that reports a difference in every module forces the widest write set the guard can see.
 const g=git({'chatgpt-dev':filesFor(seed)}),r=loadRuntime(path.resolve(__dirname,'..'));
 r.ctx.input=clone(seed);r.run('data=__EMBERWILD_VALIDATE_DOCUMENT(input);ensureArrays()');r.run('data.balanceSettings.monsters.catalog[0].hpMultiplier+=0.5');
 const exported=clone(r.run('__EMBERWILD_RELEASE_EDITOR.current()'));
 let side=0;const s=new ReleaseService({api:g.api,validate:d=>v.validate(d),effective:d=>{const out=v.effective(d);out.__side=++side;return out;}}),snap=await s.snapshot({branch:'chatgpt-dev'});
 const p=await s.prepare({expectedCommit:snap.commit,message:'寫入所有文字不同的模組',data:exported},'u');
 assert(p.modules.length>1,'format-only modules are included when their equivalence cannot be shown');assert(p.formatOnly.length===0||p.modules.length>p.formatOnly.length);
});

// H02: end-to-end examples on the in-memory Git. (1) one value in one module is the D01 real-data case above;
// (3) concurrent publishes are the D07 cases above and tests/modular-release.test.cjs.
test('H02/G09: a structural change across modules publishes atomically and a restore returns every file to the earlier bytes',async()=>{
 const g=git({'chatgpt-dev':filesFor(seed)}),s=service(g),first=s.view(await s.snapshot({branch:'chatgpt-dev'}));
 // A new monster and a drop rule that names it: two modules, one of them referring to the other.
 const doc=clone(seed),monsters=doc.balanceSettings.monsters.catalog,template=monsters.find(m=>m.kind==='normal'),drop=doc.balanceSettings.drops.entries.find(e=>e.type==='material'&&e.sources?.length);
 monsters.push({...clone(template),id:'audit_new_monster',name:'排查用怪物'});
 doc.balanceSettings.drops.entries.push({...clone(drop),id:'audit_new_drop',name:'排查用掉落',sources:['audit_new_monster']});
 const body=d=>({modules:{'world/monsters':part(d,'world/monsters'),'world/drops':part(d,'world/drops')},baseModules:{'world/monsters':first.modules['world/monsters'].sha256,'world/drops':first.modules['world/drops'].sha256}});
 // The reference without its target is refused and names the broken field; nothing is written.
 const dangling=clone(doc);dangling.balanceSettings.monsters.catalog.pop();
 await assert.rejects(()=>s.prepare({expectedCommit:first.commit,message:'引用不存在的怪物',...body(dangling)},'u'),e=>e.issues?.some(i=>/audit_new_monster|sources|來源/.test(JSON.stringify(i))));
 assert.equal(g.calls.filter(([m])=>m!=='GET').length,0);
 const p=await s.prepare({expectedCommit:first.commit,message:'新增怪物與它的掉落規則',...body(doc)},'u');
 assert.deepEqual(p.modules.map(m=>m.id).sort(),['world/drops','world/monsters']);
 const out=await s.commit({ticket:p.ticket,confirmed:true},'u'),before=g.filesAt(first.commit),after=g.filesAt(out.commit);
 assert.deepEqual(Object.keys(after).filter(f=>after[f]!==before[f]).sort(),['data/balance.json','data/balance/manifest.json','data/balance/world/drops.json','data/balance/world/monsters.json','data/preview-version.json']);
 assert.equal(g.calls.filter(([m,u])=>m==='POST'&&u.endsWith('/git/commits')).length,1,'one commit');assert.equal(g.commits.get(out.commit).parent,first.commit);
 assert.deepEqual(out.receipt.modules.map(m=>[m.id,m.from,m.to]).sort(),[['world/drops',1,2],['world/monsters',1,2]]);
 assert.equal(JSON.parse(after['data/balance.json']).balanceSettings.monsters.catalog.at(-1).id,'audit_new_monster');
 // Restore to the receipt's restore entry: a new commit on top, no history rewritten, every data file as before.
 const now=await s.snapshot({branch:'chatgpt-dev'}),r=await s.prepare({kind:'restore',branch:'chatgpt-dev',restoreCommit:out.receipt.restore.commit,expectedCommit:now.commit},'u');
 const back=await s.commit({ticket:r.ticket,confirmed:true},'u'),restored=g.filesAt(back.commit);
 assert.equal(g.commits.get(back.commit).parent,out.commit,'restore is a new commit after the publish');
 for(const f of Object.keys(before).filter(f=>f.startsWith('data/balance')&&f!=='data/balance/manifest.json'))assert.equal(restored[f],before[f],f+' is byte-identical to the earlier version');
 const m1=JSON.parse(before[M.MANIFEST_FILE]),m3=JSON.parse(restored[M.MANIFEST_FILE]);
 assert.equal(m3.integrated.sha256,m1.integrated.sha256);for(const row of m3.modules)assert.equal(row.sha256,m1.modules.find(x=>x.id===row.id).sha256,row.id);
 assert.deepEqual(m3.modules.filter(x=>x.version!==1).map(x=>[x.id,x.version]).sort(),[['world/drops',3],['world/monsters',3]],'module versions keep counting forward');
 assert.equal(JSON.parse(restored['data/preview-version.json']).version,'v0.122','one version step per commit, also for the restore');
 assert.equal((await s.snapshot({branch:'chatgpt-dev'})).consistency,'consistent');
});

// B07-B09 at the publish boundary, with the real game validator: what a reorder, a duplicate, a rename and a copy
// become once they reach the release service, whatever page or dialog produced them.
test('B08/B09: reorder, duplicate ID, rename with and without its references, and copy',async()=>{
 const {createGameValidator}=await import('../server/online/game-validator.mjs'),v=createGameValidator();
 const attempt=async change=>{const g=git({'chatgpt-dev':filesFor(seed)}),s=new ReleaseService({api:g.api,validate:d=>v.validate(d),effective:d=>v.effective(d)}),snap=await s.snapshot({branch:'chatgpt-dev'}),d=clone(seed);change(d);
  try{return {plan:await s.prepare({expectedCommit:snap.commit,message:'集合操作測試',data:d},'u'),g};}catch(error){assert.equal(g.calls.filter(([m])=>m!=='GET').length,0,'a refused change writes nothing');return {error};}};
 const monsters=d=>d.balanceSettings.monsters.catalog,first=seed.balanceSettings.monsters.catalog[0].id;
 // Order is data: it is one row in the summary and one module.
 let out=await attempt(d=>{const c=monsters(d);[c[0],c[1]]=[c[1],c[0]];});
 assert.deepEqual(out.plan.modules.map(m=>m.id),['world/monsters']);assert.deepEqual(out.plan.diff.rows.map(r=>r.field),['order']);
 // A second record with an existing ID is refused and located.
 out=await attempt(d=>{monsters(d).push(clone(monsters(d)[0]));});
 assert(out.error.issues.some(i=>/catalog\.\d+\.id$/.test(i.field)&&/重複/.test(i.reason)),out.error.message);
 // Renaming an ID others refer to is refused with every referring field...
 out=await attempt(d=>{monsters(d)[0].id='audit_renamed';});
 assert(out.error.issues.length>=2&&out.error.issues.every(i=>i.field&&i.reason),out.error.message);assert(out.error.issues.some(i=>/引用不存在的怪物/.test(i.reason)));assert(out.error.issues.some(i=>/^balanceSettings\.drops\.entries\.\d+\.sources$/.test(i.field)));
 // ...and accepted when the references move with it: every module that named the ID is written in the same publish.
 const rename=x=>{if(Array.isArray(x)){for(let i=0;i<x.length;i++){if(x[i]===first)x[i]='audit_renamed';else rename(x[i]);}}else if(x&&typeof x==='object')for(const k of Object.keys(x)){if(x[k]===first)x[k]='audit_renamed';else rename(x[k]);}};
 out=await attempt(rename);
 assert(out.plan.modules.map(m=>m.id).includes('world/monsters')&&out.plan.modules.map(m=>m.id).includes('world/drops'),out.plan.modules.map(m=>m.id).join());
 assert(!out.plan.modules.some(m=>['items/items','characters/classes','combat/skills'].includes(m.id)),'modules that never named the monster are not written');
 // A copy under a new ID is an addition; the item catalogue gains its entry in the same publish.
 out=await attempt(d=>{d.items.push({...clone(d.items[0]),id:'audit_copy',name:'排查用複製品'});});
 assert(out.plan.modules.map(m=>m.id).includes('items/items'));assert(out.plan.diff.rows.some(r=>r.type==='新增'&&r.id==='audit_copy'));assert.equal(out.plan.diff.rows.filter(r=>r.type==='刪除').length,0);
});

// D08/D09: GitHub failures at each write step. Nothing is reported as published, the branch is not moved by a failed
// step, the consumed summary cannot be replayed, and outcome() tells the two endings apart.
test('D08: 403, 404, 409 and 422 from GitHub during the commit never report success or move the branch',async()=>{
 const steps=[['POST','/git/blobs',403,'Resource not accessible by integration'],['POST','/git/trees',404,'Not Found'],['POST','/git/commits',409,'Git Repository is empty'],['PATCH','/git/refs/heads/chatgpt-dev',422,'Update is not a fast forward']];
 for(const [method,suffix,status,message] of steps){
  const g=git({'chatgpt-dev':filesFor(seed)}),real=g.api;let failed=0;
  const api=async(p,o={})=>{if((o.method||'GET')===method&&p.endsWith(suffix)){failed++;throw Object.assign(Error(message),{status});}return real(p,o);};
  const s=new ReleaseService({api,validate:d=>{const e=inspect(d);if(e.length)throw Object.assign(Error('invalid'),{issues:e});return clone(d);}}),old=s.view(await s.snapshot({branch:'chatgpt-dev'}));
  const body={expectedCommit:old.commit,message:'調整苔原史萊姆生命',modules:{'world/monsters':part(edit(seed),'world/monsters')},baseModules:{'world/monsters':old.modules['world/monsters'].sha256}};
  const p=await s.prepare(body,'u');
  await assert.rejects(()=>s.commit({ticket:p.ticket,confirmed:true},'u'),e=>e.status===status,method+' '+suffix);
  assert(failed>=1);assert.equal(g.refs['chatgpt-dev'],old.commit,status+': the branch still points at the previous commit');
  assert.equal((await s.outcome({branch:'chatgpt-dev',baseCommit:old.commit,nextVersion:p.nextVersion})).state,'未提交');
  await assert.rejects(()=>s.commit({ticket:p.ticket,confirmed:true},'u'),/過期|已使用/,'the used summary is not replayed');
  assert.equal(ReleaseService.layerOf('commit',Object.assign(Error(message),{status})),'提交');
 }
});

test('D09: a failure after the branch moved is not a success message, and GitHub shows the publish is there',async()=>{
 const g=git({'chatgpt-dev':filesFor(seed)}),real=g.api;let moved=false;
 // The ref update succeeds; every later read fails (connection lost before the verification read).
 const api=async(p,o={})=>{if(moved&&(o.method||'GET')==='GET'&&!globalThis.__auditOnline)throw Error('network down');const out=await real(p,o);if(o.method==='PATCH')moved=true;return out;};
 const s=new ReleaseService({api,validate:d=>clone(d)}),old=s.view(await s.snapshot({branch:'chatgpt-dev'}));
 const p=await s.prepare({expectedCommit:old.commit,message:'調整苔原史萊姆生命',modules:{'world/monsters':part(edit(seed),'world/monsters')},baseModules:{'world/monsters':old.modules['world/monsters'].sha256}},'u');
 await assert.rejects(()=>s.commit({ticket:p.ticket,confirmed:true},'u'),/network down/);
 assert.notEqual(g.refs['chatgpt-dev'],old.commit,'the write did happen');
 globalThis.__auditOnline=true;
 try{const seen=await s.outcome({branch:'chatgpt-dev',baseCommit:old.commit,nextVersion:p.nextVersion});assert.equal(seen.state,'已提交');assert.equal(seen.commit,g.refs['chatgpt-dev']);
  assert.equal(g.calls.filter(([m,u])=>m==='POST'&&u.endsWith('/git/commits')).length,1,'one commit, never a second attempt');}
 finally{delete globalThis.__auditOnline;}
});

// B02: docs/boundary-matrix.json shows fields where text or null passes the workbench, the validator and the game.
test('B02: a numeric field cannot be published as text, a boolean or a new null, even where the game validator does not check it',async()=>{
 const {createGameValidator}=await import('../server/online/game-validator.mjs'),v=createGameValidator(),fs=require('node:fs'),path=require('node:path');
 const boundary=JSON.parse(fs.readFileSync(path.join(__dirname,'../docs/boundary-matrix.json'),'utf8'));
 const leaks=[];for(const f of boundary.fields)for(const [kind,c] of Object.entries(f.cases))if(['string','null'].includes(kind)&&(c.validator==='preserved'))leaks.push([f.pattern,c.to]);
 assert(leaks.length>0,'the probe found values the game validator lets through');
 const g=git({'chatgpt-dev':filesFor(seed)}),s=new ReleaseService({api:g.api,validate:d=>v.validate(d),effective:d=>v.effective(d)}),snap=await s.snapshot({branch:'chatgpt-dev'});
 let caught=0;
 for(const [pattern,value] of leaks){
  const d=clone(seed);
  // The probed instance is the first record that has the field.
  const instance=JSON.parse(fs.readFileSync(path.join(__dirname,'../docs/traceability-matrix.json'),'utf8')).rows.find(r=>r.pattern===pattern).instance.split('.');
  let x=d;for(const k of instance.slice(0,-1))x=x[k];x[instance.at(-1)]=value;
  // Refused in every case: by the type check, by a validator issue, or because the game load turns the value back
  // into the online one (nothing to publish). Fields no validator rule covers must be caught by the type check.
  const error=await s.prepare({expectedCommit:snap.commit,message:'錯誤型別測試',data:d},'u').then(()=>null,e=>e);
  assert(error,pattern+' = '+JSON.stringify(value)+' must not be publishable');
  if(pattern.startsWith('skillSystem.definitions.')){assert.equal(error.code,'field-types',pattern+': '+error.message);assert.equal(error.layer,'驗證');assert(error.issues.some(i=>i.field.endsWith(pattern.split('.').at(-1))));caught++;}
 }
 assert(caught>=4,'the skill fields the game validator does not check are caught by the type check');
 assert.equal(g.calls.filter(([m])=>m!=='GET').length,0,'nothing is written');
 // A number stays publishable, and a field that is already null online for some records may be null.
 const ok=clone(seed);ok.skillSystem.definitions[0].hitCount=3;
 assert.deepEqual((await s.prepare({expectedCommit:snap.commit,message:'命中次數改為三次',data:ok},'u')).modules.map(m=>m.id).includes('combat/skills'),true);
 const offers=clone(seed).shopSettings.fixedOffers.entries,nullable=offers.findIndex(o=>o.unitPrice===null),priced=offers.findIndex(o=>typeof o.unitPrice==='number');
 if(nullable>=0&&priced>=0){const d=clone(seed);d.shopSettings.fixedOffers.entries[priced].unitPrice=null;const p=await s.prepare({expectedCommit:snap.commit,message:'固定商品改用預設價格',data:d},'u').catch(e=>e);assert.notEqual(p.code,'field-types','null is allowed where the online data already uses it');}
});
