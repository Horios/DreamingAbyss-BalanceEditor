// Every skill definition and every equipment form edited through the editor must survive release validation
// and reach the game unchanged, and the edits must change seconds combat and character stats.
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {loadRuntime}=require('./headless-editor.cjs'),{loadRuntime:loadGame}=require('../../DreamingAbyss/tests/headless-runtime.cjs');
const root=path.resolve(__dirname,'..'),game=path.resolve(root,'../DreamingAbyss');
const plain=x=>JSON.parse(JSON.stringify(x)),round=v=>+v.toFixed(4);
const SKILL_FIELDS={power:v=>round(v+0.07),procBaseChance:v=>Math.min(1,round(v+0.01)),maxTargets:v=>v+1,baseCritRate:v=>round(v+0.01),baseCritDamage:v=>round(v+0.05),defensePenetration:v=>round(v+0.01),slowPct:v=>round(v+0.01),damageReduction:v=>round(v+0.01),skipChance:v=>round(v+0.01),hitCount:v=>v+1,powerPerLevel:v=>round(v+0.01),value:v=>round(v+1),requiredLevel:v=>v+1};
const TIMING_FIELDS={cooldownSeconds:v=>v+1,mpCost:v=>v>0?round(v+1):v,priority:v=>v+1,durationSeconds:v=>v>0?v+1:v,bossDurationSeconds:v=>v>0?v+1:v,castSeconds:v=>v>0?round(v+0.1):v};

function editor(){
 const g=loadGame(game),e=loadRuntime(root);
 e.ctx.input=plain(g.run('exportableBalance()'));e.run('data=__EMBERWILD_VALIDATE_DOCUMENT(input);ensureArrays()');
 return e;
}
function applied(doc){const g=loadGame(game);g.ctx.input=doc;g.run('applyBalanceConfig(input,{persist:false})');return g;}

test('every skill and every equipment form edited in the editor passes validation and arrives in the game',async()=>{
 const {createGameValidator}=await import('../server/online/game-validator.mjs'),validator=createGameValidator();
 const e=editor(),defs=plain(e.run('data.skillSystem.definitions')),expected={};
 assert(defs.length>=185,'all skill definitions are present');
 assert.deepEqual(plain(e.run('__EMBERWILD_SKILL_SYSTEM_EDITOR.issues()')),[]);
 for(const s of defs){
  const patch={timing:{...s.timing}};
  for(const [k,f] of Object.entries(SKILL_FIELDS))if(typeof s[k]==='number')patch[k]=f(s[k]);
  for(const [k,f] of Object.entries(TIMING_FIELDS))if(typeof s.timing[k]==='number')patch.timing[k]=f(s.timing[k]);
  if(Array.isArray(s.effects))patch.effects=s.effects.map(x=>typeof x?.value==='number'?{...x,value:round(x.value+1)}:x);
  e.ctx.p=patch;
  assert.doesNotThrow(()=>e.run(`__EMBERWILD_SKILL_SYSTEM_EDITOR.updateSkill(${JSON.stringify(s.id)},p)`),s.id);
  expected[s.id]=patch;
 }
 const forms=plain(e.run('data.equipmentForms')),formExpect={};
 forms.forEach(slots=>slots.forEach(list=>list.forEach(f=>{for(const x of f.fixedEffects||[])if(typeof x.value==='number')x.value=round(x.value+1);formExpect[f.id]=plain(f.fixedEffects||[]);})));
 assert(Object.keys(formExpect).length>0);
 e.ctx.forms=forms;e.run('data.equipmentForms=forms;markDirty("roundtrip")');
 assert.deepEqual(plain(e.run('__EMBERWILD_SKILL_SYSTEM_EDITOR.issues()')),[]);
 const doc=plain(e.run('__EMBERWILD_RELEASE_EDITOR.current()'));
 assert.doesNotThrow(()=>validator.validate(doc));
 const g=applied(doc);
 assert.deepEqual(g.errors,[]);
 for(const [id,patch] of Object.entries(expected)){
  const got=plain(g.run(`__EMBERWILD_SKILLS.byId(${JSON.stringify(id)})`));
  for(const [k,v] of Object.entries(patch)){
   const value=k==='timing'?Object.fromEntries(Object.keys(v).map(x=>[x,got.timing[x]])):got[k];
   assert.deepEqual(value,v,`${id}.${k}`);
  }
 }
 const gameForms=plain(g.run('exportableBalance().equipmentForms'));
 gameForms.forEach(slots=>slots.forEach(list=>list.forEach(f=>assert.deepEqual(f.fixedEffects||[],formExpect[f.id],f.id))));
});

test('legacy duration fields stay read-only and passive skills cannot gain a mana cost',()=>{
 const e=editor(),support=plain(e.run('data.skillSystem.definitions.find(s=>typeof s.duration==="number")')),passive=plain(e.run('data.skillSystem.definitions.find(s=>s.type==="passive")'));
 e.ctx.p={duration:support.duration+1};
 assert.throws(()=>e.run(`__EMBERWILD_SKILL_SYSTEM_EDITOR.updateSkill(${JSON.stringify(support.id)},p)`),/timing\.durationSeconds/);
 e.ctx.p={timing:{...passive.timing,mpCost:1}};
 assert.throws(()=>e.run(`__EMBERWILD_SKILL_SYSTEM_EDITOR.updateSkill(${JSON.stringify(passive.id)},p)`),/耗魔/);
});

function fight(doc,id,type){
 const r=doc?applied(doc):loadGame(game);r.ctx.setTimeout=fn=>setImmediate(fn);
 // Fixed random seed: proc counts are compared between runs.
 r.run(`selectSaveSlot(1);start(0);closeModal();globalThis.__times=[];{let seed=17;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
  {const h=playerHero();setClassMasteryLevel(30,h);h.won=false;for(const k of Object.keys(h.mastery||{}))h.mastery[k]=1e9;}
  const sp=spawnGroup;spawnGroup=function(...a){const o=sp.apply(this,a);for(const e of foes){e.maxhp=e.hp=1e7;e.atk=1;}return o;};
  const name=__EMBERWILD_SKILLS.byId(${JSON.stringify(id)}).name,rec=recordAction;recordAction=function(i,n,t){if(${JSON.stringify(type)}==='active'&&String(i)===String(heroKey(playerHero()))&&t===name)__times.push(Date.now());return rec.apply(this,arguments);};
  const cp=castPartySkill;castPartySkill=function(h,i){const d=__EMBERWILD_SKILLS.byPosition(h?.job,'core',i),o=cp.apply(this,arguments);if(${JSON.stringify(type)}==='proc'&&h===playerHero()&&o!==false&&d?.id===${JSON.stringify(id)})__times.push(Date.now());return o;};
  {const sk=__EMBERWILD_SKILLS.byId(${JSON.stringify(id)}),h=playerHero();sk.unlockConditions={};sk.requiredMastery=null;sk.weaponTypes=[];sk.sources=[{type:'quest',rewardOnly:true}];h.acquiredSkillIds=[sk.id];
   for(const k of ['active','proc','support'])h.skillLoadout[k]=h.skillLoadout[k].map(()=>null);__EMBERWILD_SKILLS.refreshHero(h);save();}
  configureSkill(${JSON.stringify(type)},0,${JSON.stringify(id)});startSelectedExploration();`);
 for(let t=0;t<480;t++){r.advance(250);r.run('tick()');}
 assert.deepEqual(r.errors,[]);
 const t=plain(r.run('__times'));return {count:t.length,gap:Math.min(...t.slice(1).map((x,i)=>(x-t[i])/1000))};
}

test('an edited cooldown and proc chance change seconds combat in the game',()=>{
 const e=editor(),active=plain(e.run('data.skillSystem.definitions.find(s=>s.id==="job0-core0")'));
 e.ctx.p={timing:{...active.timing,cooldownSeconds:active.timing.cooldownSeconds-3}};e.run('__EMBERWILD_SKILL_SYSTEM_EDITOR.updateSkill("job0-core0",p)');
 e.ctx.p={procBaseChance:1};e.run('__EMBERWILD_SKILL_SYSTEM_EDITOR.updateSkill("job0-core2",p)');
 const doc=plain(e.run('__EMBERWILD_RELEASE_EDITOR.current()'));
 const before=fight(null,'job0-core0','active'),after=fight(doc,'job0-core0','active');
 assert(Math.abs(before.gap-active.timing.cooldownSeconds)<0.01,JSON.stringify(before));
 assert(Math.abs(after.gap-(active.timing.cooldownSeconds-3))<0.01,JSON.stringify(after));
 const procBefore=fight(null,'job0-core2','proc'),procAfter=fight(doc,'job0-core2','proc');
 assert(procBefore.count>0&&procAfter.count>procBefore.count*2,JSON.stringify({procBefore,procAfter}));
});

test('an edited equipment fixed effect changes the stats of a character wearing that form',()=>{
 const e=editor();
 e.run('data.equipmentForms[0][0][0].fixedEffects=data.equipmentForms[0][0][0].fixedEffects.map(x=>x.key==="flatAttack"?{...x,value:x.value+30}:x);markDirty("roundtrip")');
 const doc=plain(e.run('__EMBERWILD_RELEASE_EDITOR.current()'));
 // Base quality, no affixes and a fixed random seed, so only the edited fixed effect differs.
 const attack=g=>plain(g.run(`selectSaveSlot(1);start(0);closeModal();(()=>{let seed=11;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};const h=playerHero();h.lv=30;h.equipped=Array(5).fill(null);const bare=stats(h).atk,it=gear(5,0,0,0);Object.assign(it,{job:0,formJob:0,form:0,slot:0,affix:[]});h.bag.push(it);h.equipped[0]=it.id;return stats(h).atk-bare;})()`));
 // Each runtime reports what wearing the item adds, so unrelated differences cancel out.
 const before=attack(loadGame(game)),after=attack(applied(doc));
 assert(Math.abs(after-before-30)<1e-9,JSON.stringify({before,after}));
});

