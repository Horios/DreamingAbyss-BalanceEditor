'use strict';
// In-memory Git (content-addressed blobs, trees, commits, refs) and modular game files for release tests.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const M=require('../scripts/balance-modules.cjs');
const game=path.resolve(process.env.EMBERWILD_GAME_ROOT||path.join(__dirname,'../../DreamingAbyss'));
const seed=JSON.parse(fs.readFileSync(path.join(game,'data/balance.json'),'utf8'));
const sha1=t=>crypto.createHash('sha1').update('blob '+Buffer.byteLength(t)+'\0').update(t).digest('hex'),sha256=t=>crypto.createHash('sha256').update(t).digest('hex');
const inspect=require(path.join(game,'js/balance/balance-document.js')).inspect;

function filesFor(doc,{version='v0.120',previous=null}={}){
 const {layout,modules}=M.split(doc),files={},hashes={};
 for(const m of M.MODULES)if(modules[m.id]!==undefined){const t=M.serialize(modules[m.id]);files[M.SOURCE_DIR+'/'+m.file]=t;hashes[m.id]={sha256:sha256(t),bytes:Buffer.byteLength(t)};}
 const integrated=M.serialize(M.assemble(modules,layout));files['data/balance.json']=integrated;
 files[M.MANIFEST_FILE]=M.serialize(M.createManifest({layout,hashes,integrated:{sha256:sha256(integrated),bytes:Buffer.byteLength(integrated)},previous}));
 files['data/preview-version.json']=JSON.stringify({version});files['js/balance/balance-document.js']='const api={monsterDesignVersion:1,tutorialsVersion:1,storyVersion:1,skillSystemVersion:1,combatTimingVersion:1,independentActionsVersion:1,continuousExplorationVersion:1,wishingLakeVersion:1,equipmentGemModeVersion:2,attributeGemsVersion:1,storyEquipmentLessonsVersion:1,equipmentAcquisitionVersion:1,starterMailVersion:1,questEncountersVersion:1,consumableClockVersion:1,healingPotionVersion:1,lifeProductsVersion:1,iconColorTemplatesVersion:1,lifeShopMaterialsVersion:1,itemDetailsVersion:2,inventoryIconsVersion:2,textOverridesVersion:1};EmberwildInventoryIcons.migrateDescriptions';
 return files;
}
function git(initial){
 const blobs=new Map(),trees=new Map(),commits=new Map(),refs={},calls=[];let n=0;
 const putTree=files=>{const id='t'+(++n)+'0'.repeat(38);trees.set(id,files);return id;};
 const commitOf=(files,parent)=>{const id=crypto.createHash('sha1').update(String(++n)).digest('hex');commits.set(id,{tree:putTree(files),parent});return id;};
 for(const [branch,files] of Object.entries(initial)){for(const t of Object.values(files))blobs.set(sha1(t),t);refs[branch]=commitOf(files,null);}
 const notFound=()=>Object.assign(Error('Not Found'),{status:404});
 const filesAt=sha=>trees.get(commits.get(sha).tree);
 const api=async(p,o={})=>{calls.push([o.method||'GET',p]);const url=new URL('https://x'+p),parts=url.pathname.split('/').slice(4);
  if(parts[0]==='git'&&parts[1]==='ref')return {object:{sha:refs[parts.slice(3).join('/')]}};
  if(parts[0]==='contents'){const file=parts.slice(1).join('/'),text=filesAt(url.searchParams.get('ref'))[file];if(text===undefined)throw notFound();return {type:'file',sha:sha1(text),encoding:Buffer.byteLength(text)>1e6?'none':'base64',content:Buffer.byteLength(text)>1e6?'':Buffer.from(text).toString('base64')};}
  if(parts[0]==='git'&&parts[1]==='blobs'&&o.method==='POST'){const t=o.body.content;blobs.set(sha1(t),t);return {sha:sha1(t)};}
  if(parts[0]==='git'&&parts[1]==='blobs')return {sha:parts[2],encoding:'base64',content:Buffer.from(blobs.get(parts[2])).toString('base64')};
  if(parts[0]==='git'&&parts[1]==='trees'&&o.method==='POST'){const files={...trees.get(o.body.base_tree)};for(const e of o.body.tree){if(e.sha===null)delete files[e.path];else files[e.path]=blobs.get(e.sha);}return {sha:putTree(files),entries:o.body.tree};}
  if(parts[0]==='git'&&parts[1]==='trees'){const files=filesAt(parts[2]);return {truncated:false,tree:Object.entries(files).map(([p,t])=>({path:p,type:'blob',sha:sha1(t)}))};}
  if(parts[0]==='git'&&parts[1]==='commits'&&o.method==='POST'){const id=crypto.createHash('sha1').update(String(++n)).digest('hex');commits.set(id,{tree:o.body.tree,parent:o.body.parents[0],message:o.body.message});return {sha:id};}
  if(parts[0]==='git'&&parts[1]==='commits'){const c=commits.get(parts[2]);return {tree:{sha:c.tree},parents:c.parent?[{sha:c.parent}]:[]};}
  if(parts[0]==='git'&&parts[1]==='refs'&&o.method==='PATCH'){const b=parts.slice(3).join('/');refs[b]=o.body.sha;return {object:{sha:o.body.sha}};}
  if(parts[0]==='compare'){const [from,to]=parts[1].split('...');let c=to;while(c){if(c===from)return {status:from===to?'identical':'ahead'};c=commits.get(c).parent;}return {status:'diverged'};}
  throw Error('Unexpected '+p);};
 return {api,refs,calls,filesAt,commits,trees};
}
const edit=doc=>{const d=structuredClone(doc);d.balanceSettings.monsters.catalog[0].hpMultiplier=1.5;return d;};
module.exports={git,filesFor,edit,seed,inspect,sha256};
