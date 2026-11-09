'use strict';
const crypto=require('node:crypto'),D=require('./balance-diff.cjs'),CM=require('../scripts/combat-migration-audit.cjs'),M=require('../scripts/balance-modules.cjs');
const utf8Length=text=>new TextEncoder().encode(text).length;
class ReleaseService{
 constructor({api,validate,effective=null,ticketStore=null}){this.api=api;this.validateDocument=validate;this.effectiveDocument=effective;this.base='/repos/Horios/DreamingAbyss';this.tickets=ticketStore||new Map();}
 branch(value){if(!['main','chatgpt-dev'].includes(value))throw Error('僅允許 main／chatgpt-dev');return value;}
 async validate({data}){CM.assertSupported(data);return {data:CM.assertSupported(this.validateDocument(data)),valid:true};}
 async requireMonsterRuntime(target,candidate){
  const maps=candidate.balanceSettings?.maps?.catalog||[],monsters=candidate.balanceSettings?.monsters?.catalog||[];
  const needed=maps.some((m,i)=>m.mapType!=='final'&&(m.bossStageMode==='random'||monsters.filter(x=>x.mapIndex===i&&x.kind==='boss').length!==1))||monsters.some(m=>m.kind==='elite'||m.kind==='boss'&&(m.enabled===false||(m.bossStageCount??1)!==1)||m.baseStats&&(m.baseStats.hp>0||m.baseStats.attack>0||m.baseStats.defense>=0))||(candidate.balanceSettings?.drops?.entries||[]).some(d=>['equipment','token'].includes(d.type))||(candidate.items||[]).filter(x=>['imbue','ward','elementTonic'].includes(x.type)).length>15;
  if(!needed)return;
  const source=await this.api(this.base+'/contents/js/balance/balance-document.js?ref='+target.commit),text=source.type==='file'&&source.encoding==='base64'?Buffer.from(source.content.replace(/\s/g,''),'base64').toString('utf8'):'';
  if(!/monsterDesignVersion\s*:\s*1\b/.test(text))throw Error('目標遊戲程式尚未支援怪物個別設定、物品連結或多種 BOSS 陣容。請先升級該分支遊戲程式，再發布平衡 JSON。');
 }
 async requireLifeRuntime(target,candidate){
  // Game v0.119: on-screen text overrides. Older game code keeps the field but never applies it, so publishing would change nothing.
  if(candidate.textOverrides?.entries?.length){const source=await this.api(this.base+'/contents/js/balance/balance-document.js?ref='+target.commit),text=source.type==='file'&&source.encoding==='base64'?Buffer.from(source.content.replace(/\s/g,''),'base64').toString('utf8'):'';if(!/textOverridesVersion\s*:\s*1\b/.test(text))throw Error('目標遊戲程式尚未支援文字覆寫（textOverrides）；請先將遊戲程式升級至 v0.119 以上，再發布這份平衡 JSON。');}
  if(candidate.balanceSettings?.meta?.combatTimingVersion===1){const source=await this.api(this.base+'/contents/js/balance/balance-document.js?ref='+target.commit),text=source.type==='file'&&source.encoding==='base64'?Buffer.from(source.content.replace(/\s/g,''),'base64').toString('utf8'):'';if(!/combatTimingVersion\s*:\s*1\b/.test(text))throw Error('目標遊戲尚未支援秒數／MP 戰鬥；請先升級該分支程式，禁止把新資料寫入舊回合制正式版。');const c=candidate.balanceSettings.combat?.seconds,m=candidate.balanceSettings.meta;if((m.independentActionsVersion===1||c?.actionModel==='independent')&&!/independentActionsVersion\s*:\s*1\b/.test(text))throw Error('目標遊戲尚未支援獨立普攻與瞬發技能；請先升級該分支程式。');if((m.continuousExplorationVersion===1||c?.recovery)&&!/continuousExplorationVersion\s*:\s*1\b/.test(text))throw Error('目標遊戲尚未支援連續探索與脫戰恢復；請先升級該分支程式。');}

  if(candidate.wishingLake){const source=await this.api(this.base+'/contents/js/balance/balance-document.js?ref='+target.commit),text=source.type==='file'&&source.encoding==='base64'?Buffer.from(source.content.replace(/\s/g,''),'base64').toString('utf8'):'';if(!/wishingLakeVersion\s*:\s*1\b/.test(text))throw Error('目標版本尚未支援許願湖，請先升級遊戲程式，再發布設定。');}
  if(candidate.items?.some(x=>x.type==='healPotion'&&x.healAmount!==undefined)){const source=await this.api(this.base+'/contents/js/balance/balance-document.js?ref='+target.commit),text=source.type==='file'&&source.encoding==='base64'?Buffer.from(source.content.replace(/\s/g,''),'base64').toString('utf8'):'';if(!/healingPotionVersion\s*:\s*1\b/.test(text))throw Error('目標遊戲尚未支援固定 HP 治療藥水與 VIP 購買條件，請先更新該分支程式。');}
  if(candidate.story?.gearRewards?.length||candidate.skillSystem?.gemSlotRuleVersion===2){const source=await this.api(this.base+'/contents/js/balance/balance-document.js?ref='+target.commit),text=source.type==='file'&&source.encoding==='base64'?Buffer.from(source.content.replace(/\s/g,''),'base64').toString('utf8'):'';if(!/equipmentGemModeVersion\s*:\s*2\b/.test(text)||!/storyEquipmentLessonsVersion\s*:\s*1\b/.test(text))throw Error('目標遊戲尚未支援第一孔規則與裝備教學任務，請先更新測試分支程式。');}

  if(candidate.skillSystem){const source=await this.api(this.base+'/contents/js/balance/balance-document.js?ref='+target.commit),text=source.type==='file'&&source.encoding==='base64'?Buffer.from(source.content.replace(/\s/g,''),'base64').toString('utf8'):'';if(!/skillSystemVersion\s*:\s*1\b/.test(text))throw Error('目標遊戲尚未支援新版技能、裝備與寶石系統；請先升級該分支程式。');}

  if(candidate.equipmentPowerSystem?.strength?.acquisitionVersion===1||candidate.shopSettings?.equipmentStages?.length){
   const source=await this.api(this.base+'/contents/js/balance/balance-document.js?ref='+target.commit),text=source.type==='file'&&source.encoding==='base64'?Buffer.from(source.content.replace(/\s/g,''),'base64').toString('utf8'):'';
   if(!/equipmentAcquisitionVersion\s*:\s*1\b/.test(text))throw Error('目標版本尚未支援裝備取得、固定商店與 BOSS 通關解鎖，請先升級該分支遊戲程式。');
  }

  if((candidate.starterPacks||[]).some(row=>row.length===1)||candidate.starterPackItems?.some(row=>row.length)){
   const source=await this.api(this.base+'/contents/js/balance/balance-document.js?ref='+target.commit),text=source.type==='file'&&source.encoding==='base64'?Buffer.from(source.content.replace(/\s/g,''),'base64').toString('utf8'):'';
   if(!/starterMailVersion\s*:\s*1\b/.test(text))throw Error('目標遊戲程式尚未支援新手武器信箱禮包與自由贈品。請先升級該分支遊戲程式，再發布平衡 JSON。');
  }

  const catalogueOnly=(candidate.inventoryIcons||[]).some(r=>r.description!==undefined)&&(candidate.items||[]).some(item=>!Object.hasOwn(item,'description'));
  if(catalogueOnly){
   const source=await this.api(this.base+'/contents/js/balance/balance-document.js?ref='+target.commit),text=source.type==='file'&&source.encoding==='base64'?Buffer.from(source.content.replace(/\s/g,''),'base64').toString('utf8'):'';
   if(!/EmberwildInventoryIcons\.migrateDescriptions\b/.test(text))throw Error('目標遊戲程式尚未支援集中物品說明。請先升級該分支遊戲程式，再發布平衡 JSON。');
  }
  if(candidate.story?.quests?.length){
   const source=await this.api(this.base+'/contents/js/balance/balance-document.js?ref='+target.commit),text=source.type==='file'&&source.encoding==='base64'?Buffer.from(source.content.replace(/\s/g,''),'base64').toString('utf8'):'';
   if(!/storyVersion\s*:\s*1\b/.test(text))throw Error('目標版本尚未支援任務／劇情系統，請先升級該分支遊戲程式。');
  }
  const encounters=candidate.story?.quests?.some(q=>q.stages?.some(s=>s.encounter?.enabled));
  if(encounters||candidate.timeUnits?.consumableClock==='exploration'){
   const source=await this.api(this.base+'/contents/js/balance/balance-document.js?ref='+target.commit),text=source.type==='file'&&source.encoding==='base64'?Buffer.from(source.content.replace(/\s/g,''),'base64').toString('utf8'):'';
   if(encounters&&!/questEncountersVersion\s*:\s*1\b/.test(text))throw Error('目標版本尚未支援任務關卡，請先升級該分支遊戲程式。');
   if(candidate.timeUnits?.consumableClock==='exploration'&&!/consumableClockVersion\s*:\s*1\b/.test(text))throw Error('目標版本尚未支援有效探索時間增益，請先升級該分支遊戲程式。');
  }
  await this.requireMonsterRuntime(target,candidate);
  const life=candidate.lifeSkills?.gathering!==undefined,icons=Boolean(candidate.inventoryIcons?.length),palette=Boolean(candidate.iconColorTemplates?.length);
  if(target.branch!=='main'||(!life&&!icons&&!palette))return;
  const source=await this.api(this.base+'/contents/js/balance/balance-document.js?ref='+target.commit);
  const text=source.type==='file'&&source.encoding==='base64'?Buffer.from(source.content.replace(/\s/g,''),'base64').toString('utf8'):'';
  if(life&&!/lifeProductsVersion\s*:\s*1\b/.test(text))
   throw Error('正式版程式尚未支援採集與煉金產物設定。請先將已測試的遊戲程式升級至 main，再發布這份平衡 JSON。');
  if(palette&&!/iconColorTemplatesVersion\s*:\s*1\b/.test(text))throw Error('正式版程式尚未支援色彩模板。請先升級正式版程式，再發布這份平衡 JSON。');
  if(Object.keys(candidate.lifeSkills?.materialBuyPrices||{}).some(k=>!['清水','藥水瓶'].includes(k))&&!/lifeShopMaterialsVersion\s*:\s*1/.test(text))throw Error('目標版本尚未支援自訂商店材料；請先升級遊戲程式。');
  if((candidate.inventoryIcons||[]).some(r=>r.sellPrice!==undefined||r.saleEnabled!==undefined||r.salvageRewards!==undefined||r.displayName!==undefined)&&!/itemDetailsVersion\s*:\s*2/.test(text))throw Error('目標版本尚未支援全域道具個別售價；請先升級遊戲程式。');
  const iconVersion=Number(text.match(/inventoryIconsVersion\s*:\s*(\d+)/)?.[1]||0),needsV2=(candidate.inventoryIcons||[]).some(r=>r.color!==undefined||r.description!==undefined||r.kind==='equipment');
  if(icons&&(iconVersion<1||needsV2&&iconVersion<2))
   throw Error('正式版程式尚未支援道具圖示設定。請先將已測試的遊戲程式升級至 main，再發布這份平衡 JSON。');
 }
 // Reads one file at a commit. The contents API omits files over 1 MB (encoding "none"); the same blob is then read
 // from the Git API. optional:true returns null for a 404.
 async readFile(file,commit,{optional=false}={}){
  let f;try{f=await this.api(this.base+'/contents/'+file+'?ref='+commit);}catch(error){if(optional&&error.status===404)return null;throw error;}
  if(optional&&(!f||f.type!=='file'))return null;
  if(!f||f.type!=='file')throw Error('線上 '+file+' 不是檔案');
  if(f.encoding!=='base64'||!f.content){if(!/^[a-f0-9]{40}$/.test(f.sha||''))throw Error('JSON 檔案格式無效');const blob=await this.api(this.base+'/git/blobs/'+f.sha);if(blob.encoding!=='base64'||typeof blob.content!=='string')throw Error('JSON 檔案格式無效（Git blob 編碼 '+blob.encoding+'）');f={...f,content:blob.content,encoding:'base64'};}
  return {sha:f.sha,text:Buffer.from(f.content.replace(/\s/g,''),'base64').toString('utf8')};
 }
 async sha256(text){return crypto.createHash('sha256').update(text).digest('hex');}
 async gitBlobSha(text){return crypto.createHash('sha1').update('blob '+utf8Length(text)+'\0').update(text).digest('hex');}
 // A snapshot pins every file to one commit. On a modular branch (data/balance/manifest.json exists) the integrated
 // data/balance.json is split locally and each module is checked against the Git tree (blob SHA) and the manifest
 // (SHA-256), so three requests prove sources, manifest and integrated file belong together.
 async snapshot(args){return this.view(await this.read(args));}
 async read({branch,ref}){
  branch=this.branch(branch);if(ref&&!/^[a-f0-9]{40}$/.test(ref))throw Error('commit SHA 格式錯誤');
  const head=await this.api(this.base+'/git/ref/heads/'+branch),commit=ref||head.object.sha;
  const [integrated,manifestFile]=await Promise.all([this.readFile('data/balance.json',commit),this.readFile(M.MANIFEST_FILE,commit,{optional:true})]);
  let data;try{data=JSON.parse(integrated.text);}catch{throw Error('線上 JSON 無法解析');}
  const out={branch,commit,head:head.object.sha,blob:integrated.sha,data,layout:'legacy'};
  let manifest=null;try{manifest=manifestFile&&JSON.parse(manifestFile.text);}catch{throw Error('線上模組清單無法解析');}
  if(!manifest||manifest.schema!==M.SCHEMA)return out;
  const problems=M.checkManifest(manifest);if(problems.length)throw Error('線上模組清單無效：'+problems.join('；'));
  const tree=await this.api(this.base+'/git/trees/'+commit+'?recursive=1'),blobs=new Map((tree.tree||[]).filter(x=>x.type==='blob').map(x=>[x.path,x.sha]));
  if(tree.truncated)throw Error('Git tree 過大，無法核對模組');
  const parts=M.split(data),modules={},mismatched=[],integratedHash=await this.sha256(integrated.text);
  for(const row of manifest.modules){
   const value=parts.modules[row.id],text=value===undefined?null:M.serialize(value),path=M.SOURCE_DIR+'/'+row.file;
   const entry={id:row.id,title:row.title,file:path,version:row.version,sha256:row.sha256||null,present:row.present};
   if(text!==null){entry.actualSha256=await this.sha256(text);entry.text=text;}
   if(text===null?row.present||blobs.has(path):!row.present||blobs.get(path)!==await this.gitBlobSha(text)||entry.actualSha256!==row.sha256)mismatched.push(row.id);
   modules[row.id]=entry;
  }
  const consistency=integratedHash!==manifest.integrated.sha256?'integrated-newer':mismatched.length?'modules-mismatch':'consistent';
  return {...out,layout:'modular',manifest,modules,mismatched,consistency,blobs:Object.fromEntries([...blobs].filter(([p])=>p.startsWith(M.SOURCE_DIR+'/')))};
 }
 // Public view of a snapshot for the browser: module texts and the tree map stay on the server.
 view(snapshot){if(!snapshot||snapshot.layout!=='modular')return snapshot;const {blobs,modules,...rest}=snapshot;return {...rest,modules:Object.fromEntries(Object.entries(modules).map(([id,m])=>[id,{id,title:m.title,version:m.version,sha256:m.sha256,present:m.present}]))};}
 async history({branch,page=1,module}){
  branch=this.branch(branch);if(!Number.isInteger(page)||page<1||page>1000)throw Error('歷史頁碼無效');
  const def=module===undefined?null:M.module(module);if(module!==undefined&&!def)throw Error('未知模組：'+module);
  const file=def?M.SOURCE_DIR+'/'+def.file:'data/balance.json';
  const [head,rows]=await Promise.all([this.api(this.base+'/git/ref/heads/'+branch),this.api(this.base+'/commits?sha='+branch+'&path='+encodeURIComponent(file)+'&per_page=20&page='+page)]);
  return {branch,head:head.object.sha,page,module:def?.id||null,file,hasMore:rows.length===20,versions:rows.map((c,i)=>({commit:c.sha,message:c.commit.message,date:c.commit.committer.date,branch,current:page===1&&i===0,parent:c.parents[0]?.sha||null}))};
 }
 // Next preview version: chatgpt-dev must advance data/preview-version.json once per commit (game CI rule).
 async nextPreviewVersion(target){
  if(target.branch!=='chatgpt-dev')return null;
  const file=await this.readFile('data/preview-version.json',target.commit,{optional:true});if(!file)return null;
  let value;try{value=JSON.parse(file.text);}catch{return null;}
  const m=typeof value?.version==='string'&&value.version.match(/^v(\d+)\.(\d{3})$/);if(!m)return null;
  const n=Number(m[1])*1000+Number(m[2])+1,next='v'+Math.floor(n/1000)+'.'+String(n%1000).padStart(3,'0');
  return {from:value.version,to:next,text:file.text.replace(value.version,next)};
 }
 // Modules to write: those whose canonical text differs from the target's. Unchanged modules are never rewritten.
 async plan(target,candidate,{manifestFrom=null,source=null}={}){
  const parts=M.split(candidate),files=[],changed=[],hashes={};
  for(const m of M.MODULES){
   const value=parts.modules[m.id],text=value===undefined?null:M.serialize(value),old=target.modules[m.id];
   if(text!==null)hashes[m.id]={sha256:await this.sha256(text),bytes:utf8Length(text)};
   const same=text===null?!old.present:old.present&&old.text===text;
   if(!same){changed.push({id:m.id,title:m.title,from:old.version,file:M.SOURCE_DIR+'/'+m.file,removed:text===null});files.push({path:M.SOURCE_DIR+'/'+m.file,content:text});}
  }
  const integrated=M.serialize(M.assemble(parts.modules,parts.layout));
  if(integrated!==M.serialize(candidate))throw Error('模組重新整合結果與候選資料不一致，已停止');
  const manifest=manifestFrom||M.createManifest({layout:parts.layout,hashes,integrated:{sha256:await this.sha256(integrated),bytes:utf8Length(integrated)},previous:target.manifest});
  if(manifestFrom&&source){for(const c of changed)c.to=source.modules[c.id]?.version;}else for(const c of changed)c.to=manifest.modules.find(r=>r.id===c.id)?.version;
  return {changed,files,integrated,manifest};
 }
 async prepare({kind='preview',branch,restoreCommit,sourceCommit,expectedCommit,message,data,modules,baseModules},session){
  if(!['preview','restore','promote'].includes(kind))throw Error('不支援此發布類型');
  const target=await this.read({branch:kind==='preview'?'chatgpt-dev':kind==='promote'?'main':this.branch(branch)});
  let source=null;
  if(kind==='promote'){
   source=await this.read({branch:'chatgpt-dev'});if(source.commit!==sourceCommit)throw Object.assign(Error('測試版已更新，請重新取得並重新比較。'),{status:409});
   if(source.layout==='modular'&&source.consistency!=='consistent')throw Object.assign(Error('測試版的來源模組與整合檔不一致（'+source.consistency+'），請先在遊戲 Repository 執行 resync 再升級正式版'),{status:409});
   data=source.data;
  }
  if(kind==='restore'){
   if(!/^[a-f0-9]{40}$/.test(restoreCommit))throw Error('歷史 commit SHA 無效');
   const lineage=await this.api(this.base+'/compare/'+restoreCommit+'...'+target.commit);
   if(!['ahead','identical'].includes(lineage.status))throw Error('歷史版本不屬於此分支');
   const old=await this.read({branch:target.branch,ref:restoreCommit});data=old.data;message='restore balance data to '+restoreCommit;
  }
  if(target.layout==='modular'&&target.consistency!=='consistent')throw Object.assign(Error('目標分支的 data/balance.json 與來源模組不一致（'+(target.consistency==='integrated-newer'?'舊版發布器只寫入了整合檔':'模組 '+target.mismatched.join('、'))+'）。請先在遊戲 Repository 執行 node scripts/balance-modules.cjs resync，再重新比較。'),{status:409,consistency:target.consistency});
  // Modules sent without a full document are applied onto the target's own modules.
  if(kind==='preview'&&modules&&data===undefined){
   if(target.layout!=='modular')throw Error('目標分支尚未使用模組化平衡資料，請送出完整 JSON');
   const parts=M.split(target.data),next={...parts.modules};
   for(const [id,value] of Object.entries(modules)){if(!M.module(id))throw Error('未知模組：'+id);next[id]=value;}
   data=M.assemble(next,parts.layout);
  }
  if(target.commit!==expectedCommit){
   // Another publish moved the branch. Continue only when none of the modules this draft changes moved too.
   const conflicts=target.layout==='modular'&&baseModules&&typeof baseModules==='object'?Object.entries(baseModules).filter(([id,sha])=>target.modules[id]?.sha256!==sha).map(([id])=>({id,title:target.modules[id]?.title||id,version:target.modules[id]?.version})):null;
   if(!conflicts)throw Object.assign(Error('線上版本已更新，請重新取得最新版並重新比較。'),{status:409});
   if(conflicts.length)throw Object.assign(Error('線上版本已更新，且以下模組已被其他發布修改：'+conflicts.map(c=>c.title+'（'+c.id+' v'+c.version+'）').join('、')+'。請重新取得最新版並重新比較，不會覆寫他人的修改。'),{status:409,conflicts});
  }
  if(typeof message!=='string'||message.trim().length<4||message.length>300||/[\u0000-\u001f]/.test(message)||/^update(?: json)?$/i.test(message.trim()))throw Error('請輸入至少四個字的具體版本說明');
  CM.assertSupported(data);
  // Compare like with like: the stored JSON is not normalized, the candidate is. Both sides go through the same game load
  // (effective) or validator, so format-only differences (projections the game fills in, migrated starter packs, explicit
  // defaults) stay out of the summary and a publish with no real change is still refused.
  const candidate=CM.assertSupported(this.validateDocument(data)),view=doc=>{const copy=JSON.parse(JSON.stringify(doc));return this.effectiveDocument?this.effectiveDocument(copy):this.validateDocument(copy);};
  let baseline=target.data,after=candidate;try{baseline=view(target.data);after=view(candidate);}catch{baseline=target.data;after=candidate;}
  let plan=null,diff;
  if(target.layout==='modular'){
   plan=await this.plan(target,candidate,kind==='promote'&&source?.layout==='modular'?{manifestFrom:source.manifest,source}:{});
   // The summary covers the changed modules only; unchanged modules are byte-identical to the target.
   const rows=[];
   for(const c of plan.changed)for(const p of M.modulePaths(c.id,candidate).concat(M.modulePaths(c.id,target.data)).filter((x,i,l)=>l.indexOf(x)===i)){const d=D.diff({[p]:M.get(baseline,p)},{[p]:M.get(after,p)});rows.push(...d.rows.map(r=>({...r,module:c.id})));}
   if(!plan.changed.length)throw Error('沒有有效設定差異，禁止建立空白發布 commit');
   // A module whose file changes only through the game's normalization still counts; its rows may be empty.
   diff={rows,total:rows.length||plan.changed.length,added:rows.filter(r=>r.type==='新增').length,modified:rows.filter(r=>r.type==='修改').length,deleted:rows.filter(r=>r.type==='刪除').length,modules:plan.changed};
  }else{diff=D.diff(baseline,after);if(!diff.total)throw Error('沒有有效設定差異，禁止建立空白發布 commit');}
  await this.requireLifeRuntime(target,candidate);
  const version=await this.nextPreviewVersion(target);
  const ticket=crypto.randomBytes(32).toString('hex'),nextVersion=crypto.createHash('sha256').update(D.stable(candidate)).digest('hex').slice(0,12);
  if(this.tickets.prune)await this.tickets.prune();else for(const [id,t] of this.tickets)if(t.expires<Date.now())this.tickets.delete(id);
  const stored={...target,modules:undefined,blobs:undefined,data:undefined};
  await this.tickets.set(ticket,{session,kind,restoreCommit,sourceCommit,target:stored,candidate,message:message.trim(),diff,nextVersion,version,plan:plan&&{changed:plan.changed,manifest:plan.manifest},expires:Date.now()+600000});
  return {ticket,branch:target.branch,currentVersion:target.commit,nextVersion,diff,message:message.trim(),sourceCommit:kind==='promote'?sourceCommit:null,layout:target.layout,modules:plan?.changed||null,previewVersion:version&&{from:version.from,to:version.to}};
 }
 async commit({ticket,confirmed,productionConfirmation},session){
  const t=await this.tickets.get(ticket);if(!t||t.session!==session||t.expires<Date.now())throw Error('發布摘要已過期，請重新比較');
  CM.assertSupported(t.candidate);
  if(confirmed!==true)throw Error('必須確認完整發布摘要');
  if(t.target.branch==='main'&&productionConfirmation!=='正式版')throw Error('你正在更新正式版遊戲資料。請輸入「正式版」完成二次確認');
  if(this.tickets.take){if(!await this.tickets.take(ticket,session))throw Error('發布摘要已使用或正在提交，請核對線上版本。');}else this.tickets.delete(ticket);
  const current=await this.read({branch:t.target.branch});
  if(current.commit!==t.target.commit||current.blob!==t.target.blob)throw Object.assign(Error('線上版本已更新，請重新取得最新版並重新比較。'),{status:409});
  if(t.kind==='promote'){
   const source=await this.read({branch:'chatgpt-dev'});if(source.commit!==t.sourceCommit||D.stable(source.data)!==D.stable(t.candidate))throw Object.assign(Error('測試版已更新，請重新取得並重新比較。'),{status:409});
  }
  this.validateDocument(t.candidate);
  await this.requireLifeRuntime(current,t.candidate);
  const base=await this.api(this.base+'/git/commits/'+current.commit),entries=[],blob=async content=>(await this.api(this.base+'/git/blobs',{method:'POST',body:{encoding:'utf-8',content}})).sha;
  let integratedText=JSON.stringify(t.candidate,null,2)+'\n',plan=null;
  if(current.layout==='modular'){
   // Rebuild the plan against the verified current snapshot; it must match what the summary showed.
   plan=await this.plan(current,t.candidate,t.plan?.manifest&&t.kind==='promote'?{manifestFrom:t.plan.manifest}:{});
   if(JSON.stringify(plan.changed.map(c=>c.id))!==JSON.stringify((t.plan?.changed||[]).map(c=>c.id)))throw Object.assign(Error('線上模組已變更，請重新比較。'),{status:409});
   integratedText=plan.integrated;
   for(const f of plan.files)entries.push(f.content===null?{path:f.path,mode:'100644',type:'blob',sha:null}:{path:f.path,mode:'100644',type:'blob',sha:await blob(f.content)});
   entries.push({path:M.MANIFEST_FILE,mode:'100644',type:'blob',sha:await blob(M.serialize(plan.manifest))});
  }
  const integratedBlob=await blob(integratedText);entries.push({path:'data/balance.json',mode:'100644',type:'blob',sha:integratedBlob});
  if(t.version){const fresh=await this.nextPreviewVersion(current);if(!fresh||fresh.to!==t.version.to)throw Object.assign(Error('遊戲版本號已變更，請重新比較。'),{status:409});entries.push({path:'data/preview-version.json',mode:'100644',type:'blob',sha:await blob(fresh.text)});}
  const tree=await this.api(this.base+'/git/trees',{method:'POST',body:{base_tree:base.tree.sha,tree:entries}});
  const moduleLines=plan?'\n\nModules: '+plan.changed.map(c=>c.id+(c.from?' v'+c.from:'')+'→'+(c.removed?'removed':'v'+c.to)).join(', '):'';
  const versionLine=t.version?'\nPreview-Version: '+t.version.to:'';
  const commit=await this.api(this.base+'/git/commits',{method:'POST',body:{message:(t.kind==='restore'?t.message:'balance: '+t.message)+moduleLines+versionLine+(t.kind==='promote'?(moduleLines||versionLine?'\n':'\n\n')+'Source-Test-Commit: '+t.sourceCommit:''),tree:tree.sha,parents:[current.commit]}});
  if(t.kind==='promote'){const source=await this.api(this.base+'/git/ref/heads/chatgpt-dev');if(source.object.sha!==t.sourceCommit)throw Object.assign(Error('測試版已更新，請重新取得並重新比較。'),{status:409});}
  await this.api(this.base+'/git/refs/heads/'+current.branch,{method:'PATCH',body:{sha:commit.sha,force:false}});
  const checked=await this.read({branch:current.branch});
  if(checked.blob!==integratedBlob||checked.commit!==commit.sha)throw Error('無法確認線上資料；請重新取得版本，勿重複提交');
  if(checked.layout==='modular'&&checked.consistency!=='consistent')throw Error('已提交，但線上模組與整合檔核對不一致（'+checked.consistency+'）；請勿重複提交，改由遊戲 Repository 檢查');
  return {commit:commit.sha,branch:current.branch,committed:true,deployment:'等待部署',message:'資料已提交，等待 GitHub Pages 部署。',modules:plan?.changed||null,previewVersion:t.version?.to||null};
 }
 async deployment({branch,commit}){
  branch=this.branch(branch);if(!/^[a-f0-9]{40}$/.test(commit))throw Error('commit SHA 無效');
  // Preview dispatch runs from main, so workflow head_sha alone cannot prove deployment.
  const prefix=branch==='main'?'':'preview/',url='https://horios.github.io/DreamingAbyss/'+prefix;
  const expected=await this.read({branch,ref:commit});
  try{
   const response=await fetch(url+'data/build.json?v='+Date.now(),{cache:'no-store',signal:AbortSignal.timeout(10000)});
   if(response.ok){const build=await response.json();if(build.branch===branch&&build.balanceBlob===expected.blob){
    if(build.commit===commit)return {commit,branch,url,state:'部署成功'};
    if(/^[a-f0-9]{40}$/.test(build.commit)){const lineage=await this.api(this.base+'/compare/'+commit+'...'+build.commit);if(lineage.status==='ahead')return {commit,branch,url,state:'部署成功（後續版本已包含本次資料）'};}
   }}
  }catch{}
  const runs=await this.api(this.base+'/actions/workflows/deploy-preview.yml/runs?per_page=20');
  const relevant=runs.workflow_runs.filter(r=>r.head_sha===commit||r.display_title?.includes(commit));
  const r=relevant[0];return {commit,branch,url,state:r?.conclusion==='failure'?'部署失敗':r?.status==='in_progress'?'部署中':'等待部署',runUrl:r?.html_url||null};
 }

}
module.exports={ReleaseService};

