const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{loadRuntime}=require('./headless-editor.cjs');
const source=JSON.parse(fs.readFileSync('../DreamingAbyss/data/balance.json','utf8'));
test('crafting page edits immediate recipe values, recalibrates map dust, and exports no retired system',async()=>{
 const r=loadRuntime(process.cwd());r.ctx.doc=source;r.run('data=__EMBERWILD_VALIDATE_DOCUMENT(doc);currentSection="crafting";render()');assert.match(r.elements.get('app').innerHTML,/以太鍛鐵/);assert.match(r.elements.get('app').innerHTML,/粉塵產量校準/);
 const {createGameValidator}=await import('../server/online/game-validator.mjs');const v=createGameValidator();assert.doesNotThrow(()=>v.validate(v.defaults));const baseline=JSON.parse(JSON.stringify(r.run('__EMBERWILD_RELEASE_EDITOR.current()'))),before=v.effective(source),after=v.effective(baseline);for(const key of ['equipmentForms','skillSystem'])assert.deepEqual(after[key],before[key],key+' must not change on export');assert.deepEqual(after.balanceSettings.combat,before.balanceSettings.combat);
 r.run('data.crafting.etherIron={dust:120,ore:4,quantity:2};data.balanceSettings.maps.catalog[0].recommendedGearLevel=10;EmberwildMaterialEconomy.calibrateDust(data);');
 assert.equal(r.run('Math.round(EmberwildMaterialEconomy.expected(data,0).dust)'),200);
 r.run('data.lifeSkills={obsolete:true}');const out=r.run('__EMBERWILD_RELEASE_EDITOR.current()');assert.deepEqual(JSON.parse(JSON.stringify(out.crafting)),{etherIron:{dust:120,ore:4,quantity:2}});assert.equal(out.lifeSkills,undefined);assert.doesNotThrow(()=>r.run('__EMBERWILD_VALIDATE_DOCUMENT(data)'));assert.deepEqual(r.errors,[]);
});
