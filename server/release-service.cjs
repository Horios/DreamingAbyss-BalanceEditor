'use strict';
const crypto=require('node:crypto'),D=require('./balance-diff.cjs'),CM=require('../scripts/combat-migration-audit.cjs'),M=require('../scripts/balance-modules.cjs');
const utf8Length=text=>new TextEncoder().encode(text).length;
// Field patterns of a JSON value: object keys joined by dots, array positions as *.
const fieldPatterns=value=>{const out=new Set();(function walk(v,p){if(Array.isArray(v)){if(!v.length)out.add(p);for(const x of v)walk(x,p?p+'.*':'*');return;}if(v&&typeof v==='object'){const keys=Object.keys(v);if(!keys.length)out.add(p);for(const k of keys)walk(v[k],p?p+'.'+k:k);return;}out.add(p);})(value,'');return out;};
// JSON types seen for each field pattern of a value (number, string, boolean or null leaves).
const fieldTypes=value=>{const out=new Map();(function walk(v,p){if(Array.isArray(v)){for(const x of v)walk(x,p?p+'.*':'*');return;}if(v&&typeof v==='object'){for(const k of Object.keys(v))walk(v[k],p?p+'.'+k:k);return;}const t=v===null?'null':typeof v;if(!out.has(p))out.set(p,new Set());out.get(p).add(t);})(value,'');return out;};
// Documentation modules: the game regenerates them on export, so their fields are never "lost".
const REGENERATED_MODULES=new Set(['meta/reference','meta/notes']);
class ReleaseService{
 constructor({api,validate,effective=null,ticketStore=null,validatorCommit=null,contract=null}){this.api=api;this.validatorCommit=validatorCommit;this.contract=contract&&Object.keys(contract).length?contract:null;this.validateDocument=validate;this.effectiveDocument=effective;this.base='/repos/Horios/DreamingAbyss';this.tickets=ticketStore||new Map();}
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
  if(candidate.story?.gearRewards?.length||candidate.skillSystem?.gemSlotRuleVersion===2||candidate.skillSystem?.gems?.some(g=>g.base&&!g.skill)){const source=await this.api(this.base+'/contents/js/balance/balance-document.js?ref='+target.commit),text=source.type==='file'&&source.encoding==='base64'?Buffer.from(source.content.replace(/\s/g,''),'base64').toString('utf8'):'';const attributes=candidate.skillSystem?.gems?.length&&candidate.skillSystem.gems.every(g=>g.base&&!g.skill);if(attributes&&!/attributeGemsVersion\s*:\s*1\b/.test(text))throw Error('目標遊戲尚未支援屬性寶石，請先更新該分支程式。');if((!attributes&&!/equipmentGemModeVersion\s*:\s*2\b/.test(text))||candidate.story?.gearRewards?.length&&!/storyEquipmentLessonsVersion\s*:\s*1\b/.test(text))throw Error('目標遊戲尚未支援第一孔規則與裝備教學任務，請先更新測試分支程式。');}

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
  if(candidate.tutorials!==undefined){
   const source=await this.api(this.base+'/contents/js/balance/balance-document.js?ref='+target.commit),text=source.type==='file'&&source.encoding==='base64'?Buffer.from(source.content.replace(/\s/g,''),'base64').toString('utf8'):'';
   if(!/tutorialsVersion\s*:\s*1\b/.test(text))throw Error('目標版本尚未支援教學系統（需要遊戲 v0.144 以上），請先升級該分支遊戲程式。');
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
  // No manifest, or a file there that is not a module manifest at all: the branch predates modules (legacy flow).
  if(!manifest||!(manifest.schema===M.SCHEMA||typeof manifest.schema==='string'&&manifest.schema.startsWith('dreaming-abyss-balance-modules-')))return out;
  // A manifest this workbench cannot read means the game moved to a newer module contract. Falling back to the
  // legacy single-file flow would write data/balance.json without its modules, so it stops here instead.
  const problems=M.checkManifest(manifest);
  if(problems.length)throw Object.assign(Error('工作台的模組契約與 '+branch+' 分支不相容（'+problems.slice(0,4).join('；')+(problems.length>4?'…等 '+problems.length+' 項':'')+'）。請先同步工作台（node scripts/sync-game.cjs）並重新部署，再取得版本或發布。'),{status:409,layer:'契約',code:'contract',problems});
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
  // Files that define the data contract, compared with the copies this workbench was built from.
  const contractDrift=this.contract?Object.entries(this.contract).filter(([file,sha])=>blobs.get(file)!==sha).map(([file])=>file):[];
  return {...out,layout:'modular',manifest,modules,mismatched,consistency,contractDrift,blobs:Object.fromEntries([...blobs].filter(([p])=>p.startsWith(M.SOURCE_DIR+'/')))};
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
  // A workbench built from other contract files would validate by old rules and can miss new fields. Promotion
  // copies data already validated on the test branch, so it is not held back by the production branch's code.
  if(kind!=='promote'&&target.contractDrift?.length)throw Object.assign(Error('工作台內建的遊戲資料契約與 '+target.branch+' 分支不同（'+target.contractDrift.join('、')+'）。請先同步工作台（node scripts/sync-game.cjs）並重新部署，再發布。'),{status:409,layer:'契約',code:'contract',files:target.contractDrift});
  if(target.layout==='modular'&&target.consistency!=='consistent')throw Object.assign(Error('目標分支的 data/balance.json 與來源模組不一致（'+(target.consistency==='integrated-newer'?'舊版發布器只寫入了整合檔':'模組 '+target.mismatched.join('、'))+'）。請先在遊戲 Repository 執行 node scripts/balance-modules.cjs resync，再重新比較。'),{status:409,consistency:target.consistency});
  if(target.commit!==expectedCommit){
   // Another publish moved the branch. Continue only when none of the modules this draft changes moved too.
   const known=kind==='preview'&&target.layout==='modular'&&baseModules&&typeof baseModules==='object'&&!Array.isArray(baseModules);
   if(!known)throw Object.assign(Error('線上版本已更新，請重新取得最新版並重新比較。'),{status:409});
   for(const id of Object.keys(baseModules))if(!M.module(id))throw Error('未知模組：'+id);
   const conflicts=Object.entries(baseModules).filter(([id,sha])=>target.modules[id]?.sha256!==sha).map(([id])=>({id,title:target.modules[id]?.title||id,version:target.modules[id]?.version}));
   if(conflicts.length)throw Object.assign(Error('線上版本已更新，且以下模組已被其他發布修改：'+conflicts.map(c=>c.title+'（'+c.id+' v'+c.version+'）').join('、')+'。請重新取得最新版並重新比較，不會覆寫他人的修改。'),{status:409,conflicts});
   if(data!==undefined){
    // A complete document built on the older commit also carries the old text of every other module. Only the
    // modules this session declared a base for are taken from it; the rest stay as the newer commit has them.
    const mine=M.split(data).modules;modules=Object.fromEntries(Object.keys(baseModules).map(id=>[id,mine[id]]));data=undefined;
   }else{
    const unbased=Object.keys(modules||{}).filter(id=>!Object.prototype.hasOwnProperty.call(baseModules,id));
    if(unbased.length)throw Object.assign(Error('線上版本已更新，而模組 '+unbased.join('、')+' 沒有附上修改依據的版本，無法確認是否覆寫他人的修改。請重新取得最新版並重新比較。'),{status:409,unbased});
   }
  }
  // Modules sent without a full document are applied onto the target's own modules.
  if(kind==='preview'&&modules&&data===undefined){
   if(target.layout!=='modular')throw Error('目標分支尚未使用模組化平衡資料，請送出完整 JSON');
   const parts=M.split(target.data),next={...parts.modules};
   for(const [id,value] of Object.entries(modules)){if(!M.module(id))throw Error('未知模組：'+id);next[id]=value;}
   data=M.assemble(next,parts.layout);
  }
  if(typeof message!=='string'||message.trim().length<4||message.length>300||/[\u0000-\u001f]/.test(message)||/^update(?: json)?$/i.test(message.trim()))throw Error('請輸入至少四個字的具體版本說明');
  CM.assertSupported(data);
  // Compare like with like: the stored JSON is not normalized, the candidate is. Both sides go through the same game load
  // (effective) or validator, so format-only differences (projections the game fills in, migrated starter packs, explicit
  // defaults) stay out of the summary and a publish with no real change is still refused.
  let candidate=CM.assertSupported(this.validateDocument(data)),comparable=true;const view=doc=>{const copy=JSON.parse(JSON.stringify(doc));return this.effectiveDocument?this.effectiveDocument(copy):this.validateDocument(copy);};
  let baseline=target.data,after=candidate;try{baseline=view(target.data);after=view(candidate);}catch{baseline=target.data;after=candidate;comparable=false;}
  // Both sides loaded by the same game and equal: there is nothing to publish, whatever the file texts look like.
  if(comparable&&kind!=='promote'&&D.stable(baseline)===D.stable(after))throw Error('沒有有效設定差異，禁止建立空白發布 commit');
  let plan=null,diff,formatOnly=[];
  if(target.layout==='modular'){
   plan=await this.plan(target,candidate,kind==='promote'&&source?.layout==='modular'?{manifestFrom:source.manifest,source}:{});
   if(comparable&&kind!=='promote'){
    // The stored modules are not normalized, the candidate is: a module can differ in text while the game loads the
    // same values from both (regenerated notes, explicit defaults, projections). Such modules keep the target's file,
    // but only when the document built that way loads to exactly the same game state as the full candidate. If it
    // does not (a skipped module carries a migration the others rely on), every differing module is written as before.
    const eb=M.split(baseline).modules,ea=M.split(after).modules,text=v=>v===undefined?null:M.serialize(v);
    const same=plan.changed.filter(c=>text(eb[c.id])===text(ea[c.id]));
    if(same.length&&same.length<plan.changed.length){
     const mine=M.split(candidate),theirs=M.split(target.data),mixedModules={...mine.modules};
     for(const c of same)mixedModules[c.id]=theirs.modules[c.id];
     let mixed=null;
     try{
      const keys=cont=>Object.keys(cont===''?M.assemble(mixedModules,mine.layout):M.assemble(mixedModules,mine.layout)[cont]||{});
      const layout=Object.fromEntries(Object.keys(mine.layout).map(cont=>[cont,theirs.layout[cont]&&keys(cont).every(k=>theirs.layout[cont].includes(k))?theirs.layout[cont]:mine.layout[cont]]));
      mixed=M.assemble(mixedModules,layout);CM.assertSupported(mixed);
      // view() validates and loads the document; an invalid mix throws and is discarded.
      if(D.stable(view(mixed))!==D.stable(after))mixed=null;
     }catch{mixed=null;}
     if(mixed){candidate=mixed;plan=await this.plan(target,candidate,{});}
     else formatOnly=same.map(c=>({id:c.id,title:c.title}));
    }
   }
   if(comparable&&kind==='preview'){
    // A field the online module has, the candidate lacks and this workbench's game build does not keep when it loads
    // the online data: the game on the branch knows a field this workbench does not. The deletion would not appear
    // in the summary (both loaded sides lack it), so the publish stops instead of removing it silently.
    const online=M.split(target.data).modules,mine=M.split(candidate).modules,loaded=M.split(baseline).modules,unknown=[];
    for(const c of plan.changed){
     if(c.removed||REGENERATED_MODULES.has(c.id)||online[c.id]===undefined)continue;
     const have=fieldPatterns(mine[c.id]),seen=fieldPatterns(loaded[c.id]);
     for(const p of fieldPatterns(online[c.id]))if(!have.has(p)&&!seen.has(p))unknown.push({module:c.id,field:p});
    }
    if(unknown.length)throw Object.assign(Error('線上資料含有工作台內建的遊戲版本不認得的欄位，這次發布會把它們刪除：'+unknown.slice(0,8).map(u=>u.module+' → '+u.field).join('、')+(unknown.length>8?'…等 '+unknown.length+' 個':'')+'。請先同步工作台（node scripts/sync-game.cjs）並重新部署，再發布。'),{status:409,layer:'契約',code:'unknown-fields',unknown});
   }
   if(kind==='preview'){
    // A field that holds only numbers online (or numbers and null) must not become text, a boolean or, where it was
    // never null, null. The game's own validation does not look at every numeric field of a record (for example a
    // skill's hitCount), so such a value would otherwise be published and loaded.
    const online=M.split(target.data).modules,mine=M.split(candidate).modules,issues=[];
    for(const c of plan.changed){
     if(c.removed||REGENERATED_MODULES.has(c.id)||online[c.id]===undefined)continue;
     const before=fieldTypes(online[c.id]);
     for(const [field,types] of fieldTypes(mine[c.id])){
      const known=before.get(field);if(!known||!known.has('number')||known.has('string')||known.has('boolean'))continue;
      const wrong=[...types].filter(t=>t!=='number'&&!known.has(t));
      if(wrong.length)issues.push({system:'型別',object:c.title+'（'+c.id+'）',field,reason:'此欄位在線上資料中是數值，候選資料出現 '+wrong.map(t=>({string:'文字',boolean:'布林值',null:'null'})[t]||t).join('、')});
     }
    }
    if(issues.length)throw Object.assign(Error('數值欄位的型別不正確：'+issues.slice(0,8).map(i=>i.object+' '+i.field+'：'+i.reason).join('；')+(issues.length>8?'…等 '+issues.length+' 項':'')),{status:400,layer:'驗證',code:'field-types',issues});
   }
   // The summary covers the changed modules only; unchanged modules are byte-identical to the target.
   const rows=[];
   for(const c of plan.changed)for(const p of M.modulePaths(c.id,candidate).concat(M.modulePaths(c.id,target.data)).filter((x,i,l)=>l.indexOf(x)===i)){const d=D.diff({[p]:M.get(baseline,p)},{[p]:M.get(after,p)});rows.push(...d.rows.map(r=>({...r,module:c.id})));}
   if(!plan.changed.length)throw Error('沒有有效設定差異，禁止建立空白發布 commit');
   // A module whose file changes only through the game's normalization still counts; its rows may be empty.
   diff={rows,total:rows.length||plan.changed.length,added:rows.filter(r=>r.type==='新增').length,modified:rows.filter(r=>r.type==='修改').length,deleted:rows.filter(r=>r.type==='刪除').length,modules:plan.changed,formatOnly};
  }else{diff=D.diff(baseline,after);if(!diff.total)throw Error('沒有有效設定差異，禁止建立空白發布 commit');}
  await this.requireLifeRuntime(target,candidate);
  const version=await this.nextPreviewVersion(target);
  const ticket=crypto.randomBytes(32).toString('hex'),nextVersion=crypto.createHash('sha256').update(D.stable(candidate)).digest('hex').slice(0,12);
  if(this.tickets.prune)await this.tickets.prune();else for(const [id,t] of this.tickets)if(t.expires<Date.now())this.tickets.delete(id);
  const stored={...target,modules:undefined,blobs:undefined,data:undefined};
  await this.tickets.set(ticket,{session,kind,restoreCommit,sourceCommit,target:stored,candidate,message:message.trim(),diff,nextVersion,version,plan:plan&&{changed:plan.changed,manifest:plan.manifest},expires:Date.now()+600000});
  return {ticket,branch:target.branch,currentVersion:target.commit,nextVersion,diff,message:message.trim(),sourceCommit:kind==='promote'?sourceCommit:null,layout:target.layout,modules:plan?.changed||null,formatOnly,previewVersion:version&&{from:version.from,to:version.to}};
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
  // The receipt states what this commit wrote and what is still unverified. CI, Pages and the running game are
  // separate stages: deployment() fills in the ones it can prove, the rest stay 未驗證.
  const receipt={schema:'dreaming-abyss-release-receipt-v1',kind:t.kind,branch:current.branch,commit:commit.sha,parent:current.commit,committedAt:new Date().toISOString(),message:t.message,
   validatorCommit:this.validatorCommit,sourceCommit:t.kind==='promote'?t.sourceCommit:null,restoreCommit:t.kind==='restore'?t.restoreCommit:null,
   layout:current.layout,modules:plan?plan.changed.map(c=>({id:c.id,file:c.file,from:c.from??null,to:c.removed?null:c.to??null,removed:!!c.removed})):null,
   fields:{total:t.diff?.total??null,added:t.diff?.added??null,modified:t.diff?.modified??null,deleted:t.diff?.deleted??null},
   dataRevision:plan?.manifest?.dataRevision??null,dataVersion:t.nextVersion,previewVersion:t.version?{from:t.version.from,to:t.version.to}:null,
   integrated:{file:'data/balance.json',blob:integratedBlob,sha256:plan?.manifest?.integrated?.sha256||await this.sha256(integratedText)},
   stages:[{layer:'驗證',state:'通過'},{layer:'提交',state:'通過',commit:commit.sha},{layer:'CI',state:'未驗證'},{layer:'部署',state:'未驗證'},{layer:'載入',state:'未驗證'},{layer:'生效',state:'未驗證',note:'需在遊戲內實際確認'}],
   restore:{branch:current.branch,commit:current.commit,note:'在版本紀錄選擇此 commit「還原至此版本」，會建立新的還原 commit'}};
  return {commit:commit.sha,branch:current.branch,committed:true,deployment:'等待部署',message:'資料已提交，等待 GitHub Pages 部署。',modules:plan?.changed||null,previewVersion:t.version?.to||null,receipt};
 }
 // The commit request can succeed while its response is lost. This decides from GitHub alone whether the publish a
 // summary described (its base commit and data version) is on the branch. It never writes.
 async outcome({branch,baseCommit,nextVersion}){
  branch=this.branch(branch);if(!/^[a-f0-9]{40}$/.test(baseCommit||'')||!/^[a-f0-9]{12}$/.test(nextVersion||''))throw Error('發布摘要資訊無效');
  const head=(await this.api(this.base+'/git/ref/heads/'+branch)).object.sha;
  if(head===baseCommit)return {branch,state:'未提交',committed:false,commit:null,head,message:'線上版本仍是發布前的 commit，本次發布沒有寫入。請重新建立摘要後再發布。'};
  let sha=head;
  for(let i=0;i<5&&sha&&sha!==baseCommit;i++){
   const snap=await this.read({branch,ref:sha});
   if((await this.sha256(D.stable(snap.data))).slice(0,12)===nextVersion)return {branch,state:'已提交',committed:true,commit:sha,head,message:'線上已有這次發布的 commit，不需要重新提交。'};
   sha=(await this.api(this.base+'/git/commits/'+sha)).parents?.[0]?.sha||null;
  }
  return {branch,state:'無法確認',committed:false,commit:null,head,message:'線上版本已由其他提交更新，找不到這次發布的資料。請取得線上版本核對後再決定是否重新發布。'};
 }
 async deployment({branch,commit}){
  branch=this.branch(branch);if(!/^[a-f0-9]{40}$/.test(commit))throw Error('commit SHA 無效');
  // Preview dispatch runs from main, so workflow head_sha alone cannot prove deployment.
  const prefix=branch==='main'?'':'preview/',url='https://horios.github.io/DreamingAbyss/'+prefix;
  const expected=await this.read({branch,ref:commit});
  // Three separate facts: build.json names this commit and blob, the served data/balance.json is that blob, and
  // (otherwise) what the deployment workflow says. A green workflow alone never counts as deployed.
  const checks={expectedBlob:expected.blob,build:{state:'未取得'},data:{state:'未取得'},run:null};let deployed='';
  try{
   const response=await fetch(url+'data/build.json?v='+Date.now(),{cache:'no-store',signal:AbortSignal.timeout(10000)});
   if(response.ok){const build=await response.json();checks.build={state:'不符',commit:build.commit??null,branch:build.branch??null,balanceBlob:build.balanceBlob??null};if(build.branch===branch&&build.balanceBlob===expected.blob){
    if(build.commit===commit)deployed='部署成功';
    else if(/^[a-f0-9]{40}$/.test(build.commit)){const lineage=await this.api(this.base+'/compare/'+commit+'...'+build.commit);if(lineage.status==='ahead')deployed='部署成功（後續版本已包含本次資料）';}
    if(deployed)checks.build.state='相符';
   }}else checks.build.status=response.status;
  }catch(error){checks.build.error=String(error?.message||error).slice(0,120);}
  if(deployed){
   try{
    const response=await fetch(url+'data/balance.json?v='+Date.now(),{cache:'no-store',signal:AbortSignal.timeout(20000)});
    if(response.ok){const blob=await this.gitBlobSha(await response.text());checks.data={state:blob===expected.blob?'相符':'不符',blob};}else checks.data.status=response.status;
   }catch(error){checks.data.error=String(error?.message||error).slice(0,120);}
   if(checks.data.state==='相符')return {commit,branch,url,state:deployed,layer:null,checks};
   return {commit,branch,url,state:checks.data.state==='不符'?'部署未完成：網站的 data/balance.json 還不是這次發布的內容':'部署未確認：無法讀取網站的 data/balance.json',layer:'載入',checks};
  }
  const runs=await this.api(this.base+'/actions/workflows/deploy-preview.yml/runs?per_page=20');
  const relevant=runs.workflow_runs.filter(r=>r.head_sha===commit||r.display_title?.includes(commit));
  const r=relevant[0];checks.run=r?{status:r.status??null,conclusion:r.conclusion??null,url:r.html_url||null}:null;
  return {commit,branch,url,state:r?.conclusion==='failure'?'部署失敗':r?.status==='in_progress'?'部署中':'等待部署',layer:'部署',runUrl:r?.html_url||null,checks};
 }

 // Which stage an API failure belongs to, so the workbench never reports a later stage as reached.
 static layerOf(method,error){
  if(error?.layer)return error.layer;
  if(method==='validate')return '驗證';
  if(method==='prepare')return error?.issues?.length?'驗證':error?.status===409?'提交前核對':'驗證';
  if(method==='commit'||method==='outcome')return '提交';
  if(method==='deployment')return '部署';
  return '讀取線上版本';
 }
}
module.exports={ReleaseService};

