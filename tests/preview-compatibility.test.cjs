const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const {loadRuntime}=require('./headless-editor.cjs'),{loadRuntime:loadGame}=require('../../DreamingAbyss/tests/headless-runtime.cjs'),D=require('../server/balance-diff.cjs');
const root=path.resolve(__dirname,'..'),game=path.resolve(root,'../DreamingAbyss'),html=fs.readFileSync(path.join(root,'balance-editor.html'),'utf8');
const plain=x=>JSON.parse(JSON.stringify(x));
test('the editor is complete and every inline script parses, including its final canonical skill editor',()=>{
 const blocks=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
 assert.equal(blocks.length,(html.match(/<script\b/gi)||[]).length,'an unterminated script must never be published');
 for(const [i,block]of blocks.entries())assert.doesNotThrow(()=>new vm.Script(block[2],{filename:'editor-script-'+i}));
 assert(html.includes('<!-- canonical-skill-system:end -->'),'the canonical editor must remain in the complete document');
});
test('shared design models and the compiled release validator match the pinned preview source',()=>{
 const sources={'progression-model-v2':'balance/progression-model.js','companion-token-model-v1':'items/companion-token-model.js','team-model-v1':'character/team-model.js','shop-catalog-v2':'items/shop-catalog.js','achievement-model-v1':'character/achievement-model.js','balance-document-v1':'balance/balance-document.js','inventory-icon-model-v1':'ui/inventory-icon-model.js','timed-boost-schema-v1':'items/timed-boosts.js','balance-diff-v1':'balance/balance-diff.js','seconds-schema-model':'combat/seconds-schema.js','quest-design-model-v1':'world/quest-design-model.js','monster-design-model':'world/monster-design-model.js','companion-skill-model-v1':'skills/companion-skill-model.js','companion-passive-model-v1':'skills/passive-model.js','skill-effect-schema-v1':'skills/skill-effect-schema.js','skill-induction-schema':'skills/induction-schema.js'};
 for(const [id,file]of Object.entries(sources)){
  const code=html.match(new RegExp('<script id="'+id+'">\\n([\\s\\S]*?)\\n</script>'))?.[1];
  assert.equal(code?.trim(),fs.readFileSync(path.join(game,'js',file),'utf8').trim(),id);
 }
 const provenance=JSON.parse(fs.readFileSync(path.join(root,'server/online/runtime-provenance.json')));
 assert.match(provenance.sourceCommit,/^[a-f0-9]{40}$/);
 for(const file of provenance.files)if(file.path!=='inline')assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(game,file.path.split('?')[0]))).digest('hex'),file.sha256,file.path);
});
test('current preview data round-trips without an edit for three cycles and edits survive game validation and editor reload',async()=>{
 const {createGameValidator}=await import('../server/online/game-validator.mjs'),validator=createGameValidator();
 const g=loadGame(game),original=plain(g.run('exportableBalance()')),r=loadRuntime(root);
 let doc=original;
 for(let i=0;i<3;i++){
  r.ctx.input=doc;r.run('data=__EMBERWILD_VALIDATE_DOCUMENT(input);ensureArrays()');
  doc=plain(r.run('__EMBERWILD_RELEASE_EDITOR.current()'));
  assert.deepEqual(D.diff(original,doc).rows,[],'no new starter gear, obsolete materials or encounter defaults');
  assert.deepEqual(D.diff(validator.canonicalize(original),validator.canonicalize(doc)).rows,[]);
 }
 r.run('data.balanceSettings.combat.seconds.recovery.hpFractionPerSecond=.0125;data.balanceSettings.combat.seconds.recovery.minimumMpRatio=.4;data.balanceSettings.equipment.enhance.flatStatsPerLevel.atk=1.25;data.items.find(x=>x.id==="heal_small").healAmount=47;__EMBERWILD_SKILL_SYSTEM_EDITOR.updateSkill("class1-initial0",{power:2.25});markDirty()');
 const edited=plain(r.run('__EMBERWILD_RELEASE_EDITOR.current()'));validator.validate(edited);
 g.ctx.input=edited;g.run('applyBalanceConfig(input,{persist:false})');
 assert.equal(g.run('EmberwildSecondsCombat.config().recovery.hpFractionPerSecond'),.0125);
 assert.equal(g.run('EmberwildSecondsCombat.config().recovery.minimumMpRatio'),.4);
 assert.equal(g.run('exportableBalance().items.find(x=>x.id==="heal_small").healAmount'),47);
 assert.equal(g.run('exportableBalance().balanceSettings.equipment.enhance.flatStatsPerLevel.atk'),1.25);
 assert.equal(g.run('exportableBalance().skillSystem.definitions.find(x=>x.id==="class1-initial0").power'),2.25);
 r.elements.get('cacheBtn').onclick();
 const reloaded=loadRuntime(root,'balance-editor.html',Object.fromEntries(r.values));
 assert.deepEqual(D.diff(edited,plain(reloaded.run('__EMBERWILD_RELEASE_EDITOR.current()'))).rows,[]);
 assert.deepEqual(r.errors,[]);assert.deepEqual(reloaded.errors,[]);assert.deepEqual(g.errors,[]);
});
