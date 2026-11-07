// Voucher rules (rewards.regionVouchers) are editable, checked in the editor and accepted by the game.
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {loadRuntime}=require('./headless-editor.cjs'),{loadRuntime:loadGame}=require('../../Emberwild/tests/headless-runtime.cjs');
const root=path.resolve(__dirname,'..'),game=path.resolve(root,'../Emberwild'),plain=x=>JSON.parse(JSON.stringify(x));

function editor(doc){const e=loadRuntime(root);e.ctx.input=doc;e.run('data=__EMBERWILD_VALIDATE_DOCUMENT(input);ensureArrays()');return e;}

test('voucher settings have labels, defaults for older drafts and range checks',async()=>{
 const {createGameValidator}=await import('../server/online/game-validator.mjs'),validator=createGameValidator();
 const g=loadGame(game),doc=plain(g.run('exportableBalance()'));
 assert.deepEqual(doc.balanceSettings.rewards.regionVouchers,{ticketMinutes:30,sampleMinutes:30,maxGapMinutes:10,chargePotions:true,averageMinutes:180},'game v0.119 adds averageMinutes');
 const e=editor(doc);
 assert.equal(e.run('settingMeta("balanceSettings.rewards.regionVouchers.ticketMinutes").label'),'每張收益券分鐘數');
 assert(plain(e.run('flattenSettingLeaves(data.balanceSettings)')).some(([p])=>p==='rewards.regionVouchers.chargePotions'),'the fields are shown on the settings page');
 e.run('data.balanceSettings.rewards.regionVouchers.ticketMinutes=3');
 assert(plain(e.run('validateData()')).some(x=>/每張收益券分鐘數/.test(x)));
 assert.equal(e.run('settingMeta("balanceSettings.rewards.regionVouchers.averageMinutes").label'),'無樣本時平均試算分鐘數');
 e.run('data.balanceSettings.rewards.regionVouchers.ticketMinutes=30;data.balanceSettings.rewards.regionVouchers.averageMinutes=30;markDirty("voucher range")');
 {const issues=plain(e.run('validateData()'));assert(issues.some(x=>/無樣本時平均試算分鐘數必須是 60～720/.test(x)),'the editor checks the same range as the game: '+JSON.stringify(issues)+JSON.stringify(plain(e.run('data.balanceSettings.rewards.regionVouchers'))));}
 assert.throws(()=>{const bad=plain(e.run('__EMBERWILD_RELEASE_EDITOR.current()'));validator.validate(bad);},/無樣本時平均試算分鐘數/);
 e.run('data.balanceSettings.rewards.regionVouchers={ticketMinutes:15,sampleMinutes:45,maxGapMinutes:5,chargePotions:false,averageMinutes:240};markDirty("voucher test")');
 assert.deepEqual(plain(e.run('validateData()')),[]);
 const out=plain(e.run('__EMBERWILD_RELEASE_EDITOR.current()'));
 assert.doesNotThrow(()=>validator.validate(out));
 const applied=loadGame(game);applied.ctx.input=out;applied.run('applyBalanceConfig(input,{persist:false})');
 assert.deepEqual(plain(applied.run('EmberwildIdleStatistics.voucherSettings()')),{ticketMinutes:15,sampleMinutes:45,maxGapMinutes:5,chargePotions:false,averageMinutes:240});
 // A draft saved before this setting existed gets the defaults.
 const old=plain(doc);delete old.balanceSettings.rewards.regionVouchers;
 assert.deepEqual(plain(editor(old).run('data.balanceSettings.rewards.regionVouchers')),{ticketMinutes:30,sampleMinutes:30,maxGapMinutes:10,chargePotions:true,averageMinutes:180});
});
