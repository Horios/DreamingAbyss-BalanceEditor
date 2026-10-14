const test=require('node:test'),assert=require('node:assert/strict'),{ReleaseService}=require('../server/release-service.cjs');
test('catalogue-only descriptions require a compatible engine on both release branches',async()=>{
 let upgraded=false;const service=new ReleaseService({validate:x=>x,api:async()=>({type:'file',encoding:'base64',content:Buffer.from(upgraded?'EmberwildInventoryIcons.migrateDescriptions(d,{hydrate:true}); const api={inventoryIconsVersion:2};':'const api={inventoryIconsVersion:2};').toString('base64')})});
 const doc={items:[{id:'fixture'}],inventoryIcons:[{kind:'item',key:'fixture',iconType:'auto',description:''}]};
 for(const branch of ['main','chatgpt-dev'])await assert.rejects(service.requireLifeRuntime({branch,commit:'a'.repeat(40)},doc),/集中物品說明/);
 upgraded=true;for(const branch of ['main','chatgpt-dev'])await service.requireLifeRuntime({branch,commit:'a'.repeat(40)},doc);
});
