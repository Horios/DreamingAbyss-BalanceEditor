// Game v0.119 adds textOverrides. Older game code (main at v0.118) keeps the field but never applies it,
// so publishing overrides there must be refused like other features the target runtime lacks.
const test=require('node:test'),assert=require('node:assert/strict'),{ReleaseService}=require('../server/release-service.cjs');
const service=capabilities=>new ReleaseService({validate:d=>d,api:async p=>{if(p.includes('/contents/js/balance/balance-document.js'))return {type:'file',encoding:'base64',content:Buffer.from('const api={'+capabilities+'VERSION};').toString('base64')};throw Error('Unexpected '+p);}});
const target={branch:'main',commit:'a'.repeat(40)},candidate={textOverrides:{version:1,entries:[{source:'開始探索',text:'出發'}]}};
test('text overrides need a target runtime that applies them',async()=>{
 await assert.rejects(()=>service('combatTimingVersion:1,').requireRuntimeCapabilities(target,candidate),/尚未支援文字覆寫/);
 await assert.doesNotReject(()=>service('textOverridesVersion:1,').requireRuntimeCapabilities(target,candidate));
 await assert.doesNotReject(()=>service('').requireRuntimeCapabilities(target,{textOverrides:{version:1,entries:[]}}),'an empty override list needs nothing');
});

