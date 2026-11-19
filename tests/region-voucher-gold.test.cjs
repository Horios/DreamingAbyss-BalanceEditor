/* Maps retain the current gear recommendation and do not restore the retired overlevel voucher payout. */
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {loadRuntime}=require('./headless-editor.cjs'),{loadRuntime:loadGame}=require('../../DreamingAbyss/tests/headless-runtime.cjs');
const root=path.resolve(__dirname,'..'),game=path.resolve(root,'../DreamingAbyss'),plain=x=>JSON.parse(JSON.stringify(x));
test('recommended gear levels survive editor round-trips, validation and game application without retired voucher fields',async()=>{
 const {createGameValidator}=await import('../server/online/game-validator.mjs'),validator=createGameValidator();
 const g=loadGame(game),r=loadRuntime(root);r.ctx.input=plain(g.run('exportableBalance()'));r.run('data=__EMBERWILD_VALIDATE_DOCUMENT(input);ensureArrays()');
 const maps=plain(r.run('__EMBERWILD_RELEASE_EDITOR.current()')).balanceSettings.maps.catalog;
 assert.deepEqual(maps.map(m=>m.recommendedGearLevel),plain(g.run('MAPS.map((m,i)=>mapRecommendedGearLevel(i))')));
 assert(maps.every(m=>!Object.hasOwn(m,'overlevelVoucherGold')));
 r.run('data.balanceSettings.maps.catalog[0].recommendedGearLevel=17;data.balanceSettings.maps.catalog[1].recommendedGearLevel=1;markDirty()');
 const edited=plain(r.run('__EMBERWILD_RELEASE_EDITOR.current()'));
 assert.equal(edited.balanceSettings.maps.catalog[0].recommendedGearLevel,17);assert.equal(edited.balanceSettings.maps.catalog[1].recommendedGearLevel,1);
 assert.doesNotThrow(()=>validator.validate(edited));
 g.ctx.input=edited;g.run('applyBalanceConfig(input,{persist:false})');
 assert.equal(g.run('mapRecommendedGearLevel(0)'),17);assert.equal(g.run('mapRecommendedGearLevel(1)'),1);
 r.ctx.input=plain(g.run('exportableBalance()'));r.run('data=__EMBERWILD_VALIDATE_DOCUMENT(input);ensureArrays()');
 assert.equal(plain(r.run('__EMBERWILD_RELEASE_EDITOR.current()')).balanceSettings.maps.catalog[0].recommendedGearLevel,17);
});
