/* Exercise existing seconds controls; only in-memory fixtures are edited. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),http=require('node:http'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),game=path.resolve(root,'../Emberwild');
const moduleRoot=process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
const {chromium}=require(moduleRoot?path.join(moduleRoot,'playwright'):'playwright');
const get=(doc,parts)=>parts.reduce((v,k)=>v?.[k],doc),shape=parts=>parts.map(p=>typeof p==='number'?'[]':'.'+p).join('').replace(/^\./,'');
async function run(){
 const raw=fs.readFileSync(path.join(game,'data/balance.json'),'utf8'),doc=JSON.parse(raw);
 const server=http.createServer((_req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(fs.readFileSync(path.join(root,'balance-editor.html')));});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 let browser;
 try{
  browser=await chromium.launch({headless:true,args:['--no-sandbox'],...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})});
  const p=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],dialogs=[];
  p.on('pageerror',e=>errors.push(e.message));p.on('dialog',async d=>{dialogs.push(d.message());await d.accept();});
  await p.route('**/api/**',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({csrf:'audit',capabilities:{publishing:false},branch:'chatgpt-dev',commit:'a'.repeat(40),data:doc})}));
  await p.goto('http://127.0.0.1:'+server.address().port+'/');
  await p.evaluate(async input=>{await __EMBERWILD_ONLINE_BOOT();__EMBERWILD_WORKSPACE_IMPORT(__EMBERWILD_VALIDATE_DOCUMENT(input),'稽核測試文件',input);__EMBERWILD_COMBAT_MIGRATION_AUDIT.open();},doc);
  const plan=await p.evaluate(()=>{
   const rows=[],c=data.balanceSettings.combat.seconds;
   const add=(category,id,target,parts,type)=>rows.push({category,id,target:structuredClone(target),parts,type});
   add('combat','combat',c,['balanceSettings','combat','seconds']);
   for(const k of ['finalBoss','recovery','mana'])add('combat',k,c[k],['balanceSettings','combat','seconds',k]);
   c.classes.forEach((r,i)=>add('combat','class'+r.job,r,['balanceSettings','combat','seconds','classes',i]));
   data.skillSystem.definitions.forEach((s,i)=>add('skills',s.id,{minTargets:1,requiredTargetStatusId:null,...s.timing},['skillSystem','definitions',i,'timing'],s.type));
   data.statusDefinitions.forEach((s,i)=>add('statuses',s.id,s.timing,['statusDefinitions',i,'timing']));
   data.balanceSettings.monsters.catalog.forEach((s,i)=>add('monsters',s.id,{maxMp:c.mana.maxMp,regenPerSecond:c.mana.regenPerSecond,costMultiplier:c.mana.costMultiplier,...s.timing},['balanceSettings','monsters','catalog',i,'timing']));
   data.companionTokens.catalog.forEach((s,i)=>{add('tokens',s.id,s.ability.timing,['companionTokens','catalog',i,'ability','timing']);Object.assign(rows.at(-1),{tokenEvent:s.ability.event,tokenAction:s.ability.action});});
   data.items.forEach((s,i)=>{if(s.timing)add('items',s.id,s.timing,['items',i,'timing']);});
   data.equipmentForms.forEach((g,j)=>g.forEach((slot,k)=>slot.forEach((f,i)=>add('equipment',f.id||j+':'+k+':'+i,f.mana||{maxMp:0,regenPerSecond:0,costReduction:0},['equipmentForms',j,k,i,'mana']))));
   return {rows,statusId:data.statusDefinitions[0].id};
  });
  const cases=new Map();
  for(const row of plan.rows)for(const [key,value] of Object.entries(row.target||{})){
   if(['version','job'].includes(key)||!(typeof value==='number'||value===null||['condition','requiredTargetStatusId'].includes(key)))continue;
   const applicable=row.category!=='tokens'||(key==='durationSeconds'?['attack','guard','critical','power'].includes(row.tokenAction):!['triggerIntervalSeconds','firstTriggerSeconds'].includes(key)||row.tokenEvent==='round');
   const parts=[...row.parts,key],normalized=shape(parts),variant=!applicable?'not-applicable':(value===null&&key==='durationSeconds'?'permanent':row.category==='skills'&&key==='mpCost'&&['passive','proc'].includes(row.type)?'free-trigger':'editable');
   const identity=normalized+'|'+variant;
   if(!cases.has(identity))cases.set(identity,{...row,key,value,parts,path:normalized,variant});
  }
  const results=[];
  for(const x of cases.values()){
   await p.evaluate(({category,id})=>__EMBERWILD_COMBAT_MIGRATION_AUDIT.select(category,id),x);
   const control=p.locator('[data-seconds-field="'+x.key+'"]');
   if(x.variant==='not-applicable'){assert.equal(await control.count(),0,'unused token timing must be hidden: '+x.path);results.push({path:x.path,variant:x.variant,result:'inapplicable-hidden'});continue;}
   if(!await control.count()){results.push({path:x.path,variant:x.variant,result:'missing-control'});continue;}
   if(!await control.isEnabled()){
    const intended=x.key==='priority'||x.variant==='free-trigger';
    assert(intended,'unexpected disabled field '+x.path);
    results.push({path:x.path,variant:x.variant,result:'intentional-readonly'});continue;
   }
   // Permanent duration is verified as an empty, preserved control, not changed
   // to a finite duration while the status still declares itself permanent.
   if(x.variant==='permanent'){
    assert.equal(await control.inputValue(),'');results.push({path:x.path,variant:x.variant,result:'permanent-preserved'});continue;
   }
   let value;
   if(x.key==='requiredTargetStatusId'){value=plan.statusId;await control.selectOption(value);}
   else if(x.key==='condition'){value=x.value==='always'?'injured':'always';await control.selectOption(value);}
   else{
    const old=Number(await control.inputValue());
    value=x.key==='minTargets'?old+1:['healThreshold','minimumHpRatio','minimumMpRatio','costReduction'].includes(x.key)?Number((old>=.5?old-.01:old+.01).toFixed(6)):Number((old+.125).toFixed(6));
    await control.fill(String(value));await control.press('Tab');
   }
   assert.equal(dialogs.length,0,'control validation rejected '+x.path+': '+dialogs.join('; '));
   const actual=await p.evaluate(parts=>{const d=__EMBERWILD_RELEASE_EDITOR.current();return parts.reduce((v,k)=>v?.[k],d);},x.parts);
   assert.deepEqual(actual,value,x.path+' must survive source-preserving export');
   results.push({path:x.path,parts:x.parts,variant:x.variant,result:'edited-and-exported',value});
  }
  await p.evaluate(()=>__EMBERWILD_COMBAT_MIGRATION_AUDIT.select('combat','combat'));
  const weights=JSON.parse(await p.locator('#secondsWeights').inputValue());weights[0]+=.125;
  await p.locator('#secondsWeights').fill(JSON.stringify(weights));await p.locator('#secondsWeights').press('Tab');
  results.push({path:'balanceSettings.combat.seconds.groupWeights',parts:['balanceSettings','combat','seconds','groupWeights'],variant:'editable',result:'edited-and-exported',value:weights});
  const out=await p.evaluate(()=>__EMBERWILD_RELEASE_EDITOR.current());
  const {createGameValidator}=await import('../server/online/game-validator.mjs');createGameValidator().validate(out);
  const g=require('../../Emberwild/tests/headless-runtime.cjs').loadRuntime(game);g.ctx.input=out;g.run('applyBalanceConfig(input,{persist:false})');
  const effective=JSON.parse(JSON.stringify(g.run('exportableBalance()')));
  for(const r of results)if(r.result==='edited-and-exported'){
   assert.deepEqual(get(out,r.parts),r.value,r.path+' exported');
   assert.deepEqual(get(effective,r.parts),r.value,r.path+' applied by the actual game');r.result='ui-export-game-verified';
  }
  assert.deepEqual(errors,[]);assert.deepEqual(g.errors,[]);
  const report={formatVersion:1,gameCommit:require('node:child_process').execFileSync('git',['-C',game,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),balanceSha256:crypto.createHash('sha256').update(raw).digest('hex'),scope:'Representative field shapes in the existing canonical seconds UI, including optional MP/equipment fields. Not every object instance or every editor page.',summary:results.reduce((a,r)=>(a[r.result]=(a[r.result]||0)+1,a),{}),results};
  fs.writeFileSync(path.join(root,'docs/v2-seconds-coverage.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report.summary));
  if(results.some(x=>x.result==='missing-control'))process.exitCode=1;
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
}
if(require.main===module)run().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={shape,get};
