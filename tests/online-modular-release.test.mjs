// The compiled Worker release module (WebCrypto hashing, no Buffer) publishes modules exactly like the Node service.
import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
import {ReleaseService} from '../server/online/release-service.mjs';
const require=createRequire(import.meta.url),{git,filesFor,edit,seed,inspect}=require('./modular-git-fixture.cjs'),M=require('../scripts/balance-modules.cjs');
test('Worker build: snapshot verifies module blobs and a monster edit writes only its module',async()=>{
 const g=git({'chatgpt-dev':filesFor(seed)}),s=new ReleaseService({api:g.api,validate:d=>{const e=inspect(d);if(e.length)throw Error(e[0].reason);return JSON.parse(JSON.stringify(d));}});
 const snap=await s.snapshot({branch:'chatgpt-dev'});assert.equal(snap.consistency,'consistent');
 const p=await s.prepare({expectedCommit:snap.commit,message:'線上調整怪物',modules:{'world/monsters':M.split(edit(seed)).modules['world/monsters']},baseModules:{'world/monsters':snap.modules['world/monsters'].sha256}},'u');
 assert.deepEqual(p.modules.map(m=>m.id),['world/monsters']);await s.commit({ticket:p.ticket,confirmed:true},'u');
 assert.equal((await s.snapshot({branch:'chatgpt-dev'})).consistency,'consistent');
});
