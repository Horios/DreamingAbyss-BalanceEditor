/* Region vouchers: the per-map overlevelVoucherGold is edited here, validated by the compiled game and used by the game. */
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {loadRuntime}=require('./headless-editor.cjs'),{loadRuntime:loadGame}=require('../../DreamingAbyss/tests/headless-runtime.cjs');
const root=path.resolve(__dirname,'..'),game=path.resolve(root,'../DreamingAbyss'),plain=x=>JSON.parse(JSON.stringify(x));
test('overlevel voucher gold defaults per level band, survives editor round-trips, validation and game application',async()=>{
 const {createGameValidator}=await import('../server/online/game-validator.mjs'),validator=createGameValidator();
 const g=loadGame(game),r=loadRuntime(root);r.ctx.input=plain(g.run('exportableBalance()'));r.run('data=__EMBERWILD_VALIDATE_DOCUMENT(input);ensureArrays()');
 const maps=plain(r.run('__EMBERWILD_RELEASE_EDITOR.current()')).balanceSettings.maps.catalog;
 // Default 100 for the level-1 band, +300 per 5-level band, identical to the game.
 for(const [i,m] of maps.entries())assert.equal(m.overlevelVoucherGold,100+300*Math.floor((m.min-1)/5),m.name);
 assert.deepEqual(maps.map(m=>m.overlevelVoucherGold),plain(g.run('MAPS.map((m,i)=>worldMapConfig(i).overlevelVoucherGold)')));
 r.run('data.balanceSettings.maps.catalog[0].overlevelVoucherGold=777;data.balanceSettings.maps.catalog[1].overlevelVoucherGold=0;markDirty()');
 const edited=plain(r.run('__EMBERWILD_RELEASE_EDITOR.current()'));
 assert.equal(edited.balanceSettings.maps.catalog[0].overlevelVoucherGold,777);assert.equal(edited.balanceSettings.maps.catalog[1].overlevelVoucherGold,0,'zero gold is a valid setting');
 assert.doesNotThrow(()=>validator.validate(edited));
 g.ctx.input=edited;g.run('applyBalanceConfig(input,{persist:false})');
 assert.equal(g.run('worldMapConfig(0).overlevelVoucherGold'),777);assert.equal(g.run('worldMapConfig(1).overlevelVoucherGold'),0);
 assert.equal(g.run('exportableBalance().balanceSettings.maps.catalog[0].overlevelVoucherGold'),777,'the game exports the edited value back');
 r.ctx.input=plain(g.run('exportableBalance()'));r.run('data=__EMBERWILD_VALIDATE_DOCUMENT(input);ensureArrays()');
 assert.equal(plain(r.run('__EMBERWILD_RELEASE_EDITOR.current()')).balanceSettings.maps.catalog[0].overlevelVoucherGold,777);
});
