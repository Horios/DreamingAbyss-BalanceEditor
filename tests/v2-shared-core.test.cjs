const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {build,names}=require('../scripts/build-v2-core.cjs'),root=path.resolve(__dirname,'..');
test('V2 uses the unchanged existing model bodies and the generated provenance is current',()=>{
 const b=build();assert.equal(fs.readFileSync(path.join(root,'scripts/v2-shared-core.js'),'utf8'),b.code);
 assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root,'docs/v2-core-provenance.json'))),b.provenance);
 const ctx={structuredClone};vm.createContext(ctx);vm.runInContext(b.code,ctx);
 for(const name of names)assert.equal(typeof ctx[name],'object',name+' is loaded');
 assert.equal(ctx.EmberwildSecondsSchema.VERSION,1);assert.equal(ctx.EmberwildSkillSystem.VERSION,1);
 assert.equal(ctx.EmberwildBalanceDocument.VERSION,1);
 assert.equal(ctx.EmberwildMechanisms.definitions.size>0,true);
 assert.equal(ctx.localStorage,undefined,'models do not create a second workspace');
});
