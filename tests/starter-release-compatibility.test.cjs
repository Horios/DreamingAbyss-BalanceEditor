const test=require('node:test'),assert=require('node:assert/strict'),{ReleaseService}=require('../server/release-service.cjs');
test('starter weapon documents require a compatible target engine on either branch',async()=>{
 let upgraded=false;const service=new ReleaseService({validate:x=>x,api:async()=>({type:'file',encoding:'base64',content:Buffer.from(upgraded?'const api={starterMailVersion:1};':'const api={};').toString('base64')})});
 for(const branch of ['main','chatgpt-dev'])await assert.rejects(service.requireLifeRuntime({branch,commit:'a'.repeat(40)},{starterPacks:[[{slot:0}]]}),/新手武器信箱/);
 upgraded=true;for(const branch of ['main','chatgpt-dev'])await service.requireLifeRuntime({branch,commit:'a'.repeat(40)},{starterPacks:[[{slot:0}]]});
});
