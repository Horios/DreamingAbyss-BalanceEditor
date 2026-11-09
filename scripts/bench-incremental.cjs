#!/usr/bin/env node
/* Measures, in Chromium, one monster HP edit in the workbench: incremental tracking/validation/autosave/diff/payload
   against the full-document operations the editor used before. Prints JSON. Needs Playwright (see CI browser job). */
'use strict';
const path=require('node:path'),modules=process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
const {chromium}=require(modules?path.join(modules,'playwright'):'playwright'),{createPreviewServer}=require('./serve-v2.cjs');
(async()=>{
 const server=await createPreviewServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,args:['--no-sandbox'],...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})});
 try{
  const page=await browser.newPage();await page.goto('http://127.0.0.1:'+server.address().port+'/workbench');
  await page.waitForFunction(()=>globalThis.__EMBERWILD_INCREMENTAL&&globalThis.__EMBERWILD_RELEASE_EDITOR);
  await page.waitForTimeout(3500); // start-up migrations settle into the session baseline
  const result=await page.evaluate(()=>{
   const runs=7,median=fn=>{const xs=[];let out;for(let i=0;i<runs;i++){const t=performance.now();out=fn(i);xs.push(performance.now()-t);}xs.sort((a,b)=>a-b);return {ms:+xs[runs>>1].toFixed(2),out};};
   const I=__EMBERWILD_INCREMENTAL,M=EmberwildBalanceModules,m=data.balanceSettings.monsters.catalog.find(x=>x.kind==='normal'),base=m.hpMultiplier;
   currentSection='world';
   const incremental=median(i=>{m.hpMultiplier=base+0.01*(i+1);markDirty('bench');return I.refresh();});
   const field=median(()=>I.validateField('balanceSettings.monsters.catalog.0.hpMultiplier').length);
   const exportDoc=__EMBERWILD_RELEASE_EDITOR.current(),online=structuredClone(exportDoc);online.balanceSettings.monsters.catalog[0].hpMultiplier=9;
   const fullValidate=median(()=>__EMBERWILD_VALIDATE_DOCUMENT(structuredClone(exportDoc))&&1);
   const fullInspect=median(()=>EmberwildBalanceDocument.inspect(exportDoc).length);
   const fullDiff=median(()=>EmberwildBalanceDiff.diff(online,exportDoc).total),modDiff=median(()=>I.diff(online,exportDoc).total);
   const fullSave=median(()=>JSON.stringify({data}).length);
   // Full validation may swap `data` for a normalized copy; edit the record of the current draft.
   const n=data.balanceSettings.monsters.catalog.find(x=>x.id===m.id);document.getElementById('cacheBtn').onclick();n.hpMultiplier=base+1;markDirty('bench');I.refresh();
   const modSave=median(i=>{n.hpMultiplier=base+1+i;markDirty('bench');document.getElementById('cacheBtn').onclick();return globalThis.__EMBERWILD_WORKSPACE_MODULES.written;});
   const snap={commit:'x',layout:'modular',data:online,modules:Object.fromEntries(M.MODULES.map(x=>[x.id,{sha256:'h'}]))};
   const payload=median(()=>Object.keys(I.payload(exportDoc,snap).modules||{}).length),fullPayload=median(()=>JSON.stringify(exportDoc).length);
   n.hpMultiplier=base;markDirty('bench');I.refresh();
   return {modulesTotal:M.MODULES.length,
    edit:{incrementalMs:incremental.ms,serializedModules:incremental.out.last.inspected,changedModules:incremental.out.modules.map(x=>x.id),records:incremental.out.modules[0]?.records.length,blocks:incremental.out.last.blocks},
    fieldValidationMs:field.ms,
    validation:{fullGameValidatorMs:fullValidate.ms,fullSharedInspectMs:fullInspect.ms,incrementalMs:incremental.ms},
    diff:{fullMs:fullDiff.ms,fullRows:fullDiff.out,byModuleMs:modDiff.ms,byModuleRows:modDiff.out},
    save:{fullDocumentStringifyMs:fullSave.ms,moduleAutosaveMs:modSave.ms,modulesWritten:modSave.out},
    publish:{changedModulesSent:payload.out,payloadMs:payload.ms,fullPayloadBytes:fullPayload.out}};
  });
  console.log(JSON.stringify(result,null,2));
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
