'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const M=require('../scripts/combat-migration-audit.cjs');
const {ReleaseService}=require('../server/release-service.cjs');
test('audit inventories every affected data family without changing values or units',()=>{
 const d={timeUnits:{supportDuration:'battleRounds'},skillSystem:{definitions:[{id:'heal',type:'active',cooldown:3},{id:'passive',type:'passive'}]},
  classes:[{skills:[{duration:2}]}],supportSkills:[[{duration:10}]],statusDefinitions:[{duration:3,triggers:[{event:'targetTurnEnd'}]}],
  companions:[{duration:3}],companionTokens:{effects:[{cooldown:1}]},items:[{id:'ticket',type:'timedBoost',durationMinutes:30},{id:'imbue',type:'imbue',duration:10}],
  balance:{affixes:{extendedValues:{allCooldownReduction:{rare:1}}}},equipmentForms:[[[{fixedEffects:[{key:'basicAdvanceNextRound',value:1}]}]]],
  balanceSettings:{combat:{pacing:{roundMinimumMs:6000},speed:{heroBase:[102,108,116,96]},finalBoss:{enrageAfterTurn:45}},monsters:{catalog:[{id:'boss',cooldown:3}]}}};
 const before=JSON.stringify(d),r=M.inspect(d);assert.equal(JSON.stringify(d),before);assert.equal(r.runtimeSwitched,false);assert.equal(r.activeNeedingMpDesign.length,1);
 for(const group of ['共用技能','技能投影','狀態／事件','夥伴／信物','消耗品','裝備／詞綴','怪物／BOSS','戰鬥核心'])assert(r.counts[group]>0,group);
 assert.equal(r.rows.find(x=>x.path==='items.0.durationMinutes').clock,'現實時間（保留）');
 assert(r.rows.some(x=>x.path==='balanceSettings.combat.finalBoss.enrageAfterTurn'));
 assert(r.rows.some(x=>x.path==='equipmentForms.0.0.0.fixedEffects.0.key'));
});
test('new seconds and MP markers are rejected; legacy values and real-time items remain accepted',()=>{
 for(const d of [
  {timeUnits:{supportDuration:'battleSeconds'}},{timeUnits:{cooldown:'seconds'}},
  {skillSystem:{definitions:[{mpCost:0}]}},{skillSystem:{definitions:[{cooldownSeconds:1.25}]}},
  {classes:[{baseMp:100}]},{statusDefinitions:[{durationSeconds:null}]},{statusDefinitions:[{durationClock:'seconds'}]},
  {balanceSettings:{meta:{combatTimingVersion:1}}},{balanceSettings:{combat:{model:'seconds'}}}
 ])assert.throws(()=>M.assertSupported(d),/秒數／MP/);
 const old={timeUnits:{supportDuration:'battleRounds',elementPotionDuration:'realMinutes'},supportSkills:[[{cooldown:3}]],items:[{duration:18},{durationMinutes:30}],lifeSkills:{gathering:{periodMs:1000}}};
 assert.equal(M.assertSupported(old),old);assert.deepEqual(M.unsupportedPaths(old),[]);
});
test('backend validation and prepare reject unsupported documents before domain conversion or ticket creation',async()=>{
 let validationCalls=0;const service=new ReleaseService({api:async()=>{throw Error('unexpected API');},validate:d=>(validationCalls++,d)});
 await assert.rejects(service.validate({data:{skillSystem:{definitions:[{mpCost:2}]}}}),/秒數／MP/);assert.equal(validationCalls,0);
 service.read=service.snapshot=async()=>({branch:'chatgpt-dev',commit:'a'.repeat(40),data:{}});
 await assert.rejects(service.prepare({data:{timeUnits:{cooldown:'seconds'}},expectedCommit:'a'.repeat(40),message:'技能秒數改版'},'owner'),/秒數／MP/);
 assert.equal(validationCalls,0);assert.equal(service.tickets.size,0);
});
test('a retained old ticket cannot bypass the new-format guard at commit',async()=>{
 let writes=0;const service=new ReleaseService({api:async()=>writes++,validate:d=>d});
 service.tickets.set('old',{session:'owner',expires:Date.now()+10000,candidate:{timeUnits:{cooldown:'seconds'}}});
 await assert.rejects(service.commit({ticket:'old',confirmed:true},'owner'),/秒數／MP/);assert.equal(writes,0);assert(service.tickets.has('old'));
});
test('publication checks both independent actions and continuous recovery on the actual target commit',async()=>{let text='combatTimingVersion:1';const service=new ReleaseService({validate:d=>d,api:async()=>({type:'file',encoding:'base64',content:Buffer.from(text).toString('base64')})}),target={branch:'chatgpt-dev',commit:'a'.repeat(40)},candidate={balanceSettings:{meta:{combatTimingVersion:1,independentActionsVersion:1,continuousExplorationVersion:1},combat:{seconds:{actionModel:'independent',recovery:{}}}}};await assert.rejects(service.requireLifeRuntime(target,candidate),/獨立普攻/);text+=',independentActionsVersion:1';await assert.rejects(service.requireLifeRuntime(target,candidate),/連續探索/);text+=',continuousExplorationVersion:1';await service.requireLifeRuntime(target,candidate);});
