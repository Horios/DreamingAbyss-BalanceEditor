// The stored data/balance.json is not normalized; the editor's export is. Comparing them directly listed ~234
// format-only rows (skill timing projections, migrated starter packs, explicit defaults) for a single edit, and an
// unchanged publish was not refused. Both the publish summary and 差異比較 compare normalized forms.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{ReleaseService}=require('../server/release-service.cjs'),{loadRuntime}=require('./headless-editor.cjs');
const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..'),game=path.resolve(root,'../DreamingAbyss'),plain=x=>JSON.parse(JSON.stringify(x));
const raw=JSON.parse(fs.readFileSync(path.join(game,'data/balance.json'),'utf8'));
function editorWith(doc){const r=loadRuntime(root);r.ctx.input=doc;r.run('data=__EMBERWILD_VALIDATE_DOCUMENT(input);ensureArrays()');return r;}
test('the publish summary lists only real changes and refuses an unchanged publish',async()=>{
 const {createGameValidator}=await import('../server/online/game-validator.mjs'),V=createGameValidator(),commit='a'.repeat(40);
 const s=new ReleaseService({validate:d=>V.validate(d),effective:d=>V.effective(d),api:async p=>{
  if(p.includes('/git/ref/heads/'))return {object:{sha:commit}};
  if(p.includes('/contents/data/balance/manifest.json')||p.includes('/contents/data/preview-version.json'))throw Object.assign(Error('Not Found'),{status:404});
  if(p.includes('/contents/data/balance.json'))return {type:'file',encoding:'base64',sha:'b'.repeat(40),content:Buffer.from(JSON.stringify(raw)).toString('base64')};
  if(p.includes('/contents/js/'))return {type:'file',encoding:'base64',content:Buffer.from(fs.readFileSync(path.join(game,p.split('/contents/')[1].split('?')[0]),'utf8')).toString('base64')};
  throw Error('Unexpected '+p);}});
 const r=editorWith(raw);r.run('data.items.find(x=>x.id==="heal_small").healAmount+=3;markDirty("summary")');
 const p=await s.prepare({kind:'preview',expectedCommit:commit,message:'調整小治療藥水回復量',data:plain(r.run('__EMBERWILD_RELEASE_EDITOR.current()'))},'s');
 assert.deepEqual(p.diff.rows.map(x=>x.path),['items.heal_small.healAmount']);
 const same=editorWith(raw);
 await assert.rejects(()=>s.prepare({kind:'preview',expectedCommit:commit,message:'沒有修改的發布測試',data:plain(same.run('__EMBERWILD_RELEASE_EDITOR.current()'))},'s'),/沒有有效設定差異/);
});
test('差異比較 normalizes the online version like the local export, and restores the editor state',()=>{
 const r=editorWith(raw);r.ctx.raw=raw;const names=plain(r.run('MAP_NAMES'));
 const D=require('../server/balance-diff.cjs');
 assert.deepEqual(D.diff(plain(r.run('__EMBERWILD_NORMALIZED_EXPORT(raw)')),plain(r.run('__EMBERWILD_RELEASE_EDITOR.current()'))).rows,[]);
 r.ctx.other=(()=>{const d=plain(raw);d.balanceSettings.maps.catalog[0].name='另一份文件';return d;})();r.run('__EMBERWILD_NORMALIZED_EXPORT(other)');
 assert.deepEqual(plain(r.run('MAP_NAMES')),names,'normalizing another document leaves the current map names');
});
