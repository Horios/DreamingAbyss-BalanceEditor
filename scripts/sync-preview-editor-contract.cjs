/* Keep new-workspace fallback and shared models on the actual preview contract.
   This does not replace browser drafts or mutate the published game JSON. */
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),game=path.resolve(process.env.EMBERWILD_GAME_ROOT||path.join(root,'../DreamingAbyss')),file=path.join(root,'balance-editor.html');
let html=fs.readFileSync(file,'utf8');
const source=JSON.parse(fs.readFileSync(path.join(game,'data/balance.json'),'utf8'));
// Reuse the existing embedded document, rather than add a second catalog.
html=html.replace(/const ORIGINAL_B64\s*=\s*"[^"]*";/,()=> 'const ORIGINAL_B64 = '+JSON.stringify(Buffer.from(JSON.stringify(source),'utf8').toString('base64'))+';');
html=html.replace(/const ORIGINAL_DATA\s*=\s*[^\n]+;/,()=> 'const ORIGINAL_DATA = JSON.parse(decodeURIComponent(escape(atob(ORIGINAL_B64))));');
const settings=structuredClone(source.balanceSettings);
// A migration receipt belongs to the source document that was migrated; it is
// not a required setting to add to every otherwise unchanged exported document.
delete settings.meta.activeCooldownFloorVersion;
for(const k of ['independentActionsVersion','continuousExplorationVersion'])delete settings.meta[k];
for(const k of ['actionModel','recovery'])delete settings.combat.seconds[k];
html=html.replace(/^const BALANCE_SETTINGS_DEFAULTS = .+;$/m,()=> 'const BALANCE_SETTINGS_DEFAULTS = '+JSON.stringify(settings)+';');
for(const [id,sourcePath] of [['balance-document-v1','js/balance/balance-document.js'],['companion-model-v1','js/character/companion-model.js'],['progression-model-v2','js/balance/progression-model.js'],['companion-token-model-v1','js/items/companion-token-model.js'],['team-model-v1','js/character/team-model.js'],['shop-catalog-v2','js/items/shop-catalog.js'],['achievement-model-v1','js/character/achievement-model.js'],['inventory-model-v1','js/items/inventory-model.js'],['drop-rework-model-v1','js/world/drop-rework-model.js'],['inventory-icon-model-v1','js/ui/inventory-icon-model.js'],['timed-boost-schema-v1','js/items/timed-boosts.js'],['balance-diff-v1','js/balance/balance-diff.js'],['quest-design-model-v1','js/world/quest-design-model.js'],['monster-design-model','js/world/monster-design-model.js'],['companion-skill-model-v1','js/skills/companion-skill-model.js'],['companion-passive-model-v1','js/skills/passive-model.js'],['skill-effect-schema-v1','js/skills/skill-effect-schema.js'],['skill-induction-schema','js/skills/induction-schema.js']]){
 const marker=new RegExp('(<script id="'+id+'">)[\\s\\S]*?(<\\/script>)');
 if(!marker.test(html))throw Error('Missing shared model '+id);
 html=html.replace(marker,(_all,start,end)=>start+'\n'+fs.readFileSync(path.join(game,sourcePath),'utf8')+'\n'+end);
}
const old="if(!Array.isArray(p.points)||!p.points.length||p.points.length>32||p.points.some(n=>!Number.isInteger(n)||n<0||n>2))issues.push(label+' 的循環配點只能填 0、1、2。');";
const next="if(p.points!==undefined&&(!Array.isArray(p.points)||!p.points.length||p.points.length>32||p.points.some(n=>!Number.isInteger(n)||n<0||n>2)))issues.push(label+' 的循環配點只能填 0、1、2。');\n      if(p.points===undefined&&(!p.initialStats||!p.growthPerLevel))issues.push(label+' 缺少固定初始能力與每級成長。');\n      try{EmberwildCompanions.validatePlanStats(p);}catch(e){issues.push(e.message);}";
html=html.replace(old,next);
// New companions use initialStats/growthPerLevel; do not recreate retired points.
html=html.replace("+p.points.map((n,i)=>", "+(p.points||[]).map((n,i)=>");
html=html.replace("0 為職業主屬、1 為體質、2 為韌性；依下列順序循環分配每個能力點。", "舊版循環配點：0 為職業主屬、1 為體質、2 為韌性。新版夥伴採 initialStats／growthPerLevel 固定能力與成長，保留原設定，不補回循環配點。");
html=html.replace('return structuredClone(data);}finally{data=previous;}', 'return EmberwildCombatMigration.retainContract(structuredClone(data),input);}finally{data=previous;}');
fs.writeFileSync(file,html);console.log('Synchronized current preview fallback and companion growth contract');
