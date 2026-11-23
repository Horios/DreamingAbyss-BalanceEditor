const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {loadRuntime}=require('./headless-editor.cjs');
const root=path.resolve(__dirname,'..'),game=path.resolve(root,'../DreamingAbyss');
const plain=x=>JSON.parse(JSON.stringify(x));
test('enhancement floor coefficients roundtrip through the editor and release validator with the shared formula',async()=>{
 const doc=JSON.parse(fs.readFileSync(path.join(game,'data/balance.json'),'utf8'));
 const {createGameValidator}=await import('../server/online/game-validator.mjs'),validator=createGameValidator(),r=loadRuntime(root);
 r.ctx.input=doc;r.run('data=__EMBERWILD_VALIDATE_DOCUMENT(input);ensureArrays()');
 const original=plain(r.run('__EMBERWILD_RELEASE_EDITOR.current()'));
 assert.deepEqual(original.balanceSettings.equipment.enhance,doc.balanceSettings.equipment.enhance);
 assert.deepEqual(original.balanceSettings.equipment.enhance.flatStatsPerLevel,{atk:1,hp:1,def:.35});
 assert.equal(r.run('EmberwildProgression.enhancedGearStats({atk:3},3,1,data.balanceSettings.equipment.enhance.flatStatsPerLevel,data.balanceSettings.equipment.enhance.flatStatsPerEquipmentLevel,data.balanceSettings.equipment.enhance.levels[2].baseBonus).atk'),6);
 r.run('data.balanceSettings.equipment.enhance.flatStatsPerLevel.atk=1.75;data.balanceSettings.equipment.enhance.flatStatsPerEquipmentLevel.def=.025;markDirty()');
 const edited=plain(r.run('__EMBERWILD_RELEASE_EDITOR.current()')),effective=validator.effective(edited);
 assert.deepEqual(effective.balanceSettings.equipment.enhance,edited.balanceSettings.equipment.enhance);
 r.ctx.input=JSON.parse(JSON.stringify(effective));r.run('data=__EMBERWILD_VALIDATE_DOCUMENT(input);ensureArrays()');
 assert.deepEqual(plain(r.run('__EMBERWILD_RELEASE_EDITOR.current()')).balanceSettings.equipment.enhance,edited.balanceSettings.equipment.enhance);
 for(const field of ['flatStatsPerLevel','flatStatsPerEquipmentLevel'])for(const value of [-1,Infinity,NaN]){
  const bad=structuredClone(edited);bad.balanceSettings.equipment.enhance[field].hp=value;
  assert.throws(()=>validator.validate(bad));r.ctx.input=bad;assert.throws(()=>r.run('__EMBERWILD_VALIDATE_DOCUMENT(input)'));
 }
 const html=fs.readFileSync(path.join(root,'balance-editor.html'),'utf8');assert.match(html,/強化最低收益固定攻擊（F）/);assert.match(html,/與百分比收益取較大值/);assert.deepEqual(r.errors,[]);
});
