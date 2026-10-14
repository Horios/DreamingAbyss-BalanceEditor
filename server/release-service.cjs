'use strict';
const crypto=require('node:crypto'),D=require('./balance-diff.cjs');
class ReleaseService{
 constructor({api,validate,ticketStore=null}){this.api=api;this.validateDocument=validate;this.base='/repos/Horios/Emberwild';this.tickets=ticketStore||new Map();}
 branch(value){if(!['main','chatgpt-dev'].includes(value))throw Error('僅允許 main／chatgpt-dev');return value;}
 async validate({data}){return {data:this.validateDocument(data),valid:true};}
 async requireMonsterRuntime(target,candidate){
  const maps=candidate.balanceSettings?.maps?.catalog||[],monsters=candidate.balanceSettings?.monsters?.catalog||[];
  const needed=maps.some((m,i)=>m.mapType!=='final'&&(m.bossStageMode==='random'||monsters.filter(x=>x.mapIndex===i&&x.kind==='boss').length!==1))||monsters.some(m=>m.kind==='elite'||m.kind==='boss'&&(m.enabled===false||(m.bossStageCount??1)!==1)||m.baseStats&&(m.baseStats.hp>0||m.baseStats.attack>0||m.baseStats.defense>=0))||(candidate.balanceSettings?.drops?.entries||[]).some(d=>['equipment','token'].includes(d.type))||(candidate.items||[]).filter(x=>['imbue','ward','elementTonic'].includes(x.type)).length>15;
  if(!needed)return;
  const source=await this.api(this.base+'/contents/js/balance/balance-document.js?ref='+target.commit),text=source.type==='file'&&source.encoding==='base64'?Buffer.from(source.content.replace(/\s/g,''),'base64').toString('utf8'):'';
  if(!/monsterDesignVersion\s*:\s*1\b/.test(text))throw Error('目標遊戲程式尚未支援怪物個別設定、物品連結或多種 BOSS 陣容。請先升級該分支遊戲程式，再發布平衡 JSON。');
 }
 async requireLifeRuntime(target,candidate){
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
 async snapshot({branch,ref}){
  branch=this.branch(branch);if(ref&&!/^[a-f0-9]{40}$/.test(ref))throw Error('commit SHA 格式錯誤');
  const head=await this.api(this.base+'/git/ref/heads/'+branch),commit=ref||head.object.sha;
  const f=await this.api(this.base+'/contents/data/balance.json?ref='+commit);
  if(f.type!=='file'||f.encoding!=='base64')throw Error('JSON 檔案格式無效');
  let data;try{data=JSON.parse(Buffer.from(f.content.replace(/\s/g,''),'base64').toString('utf8'));}catch{throw Error('線上 JSON 無法解析');}
  return {branch,commit,head:head.object.sha,blob:f.sha,data};
 }
 async history({branch,page=1}){
  branch=this.branch(branch);if(!Number.isInteger(page)||page<1||page>1000)throw Error('歷史頁碼無效');
  const [head,rows]=await Promise.all([this.api(this.base+'/git/ref/heads/'+branch),this.api(this.base+'/commits?sha='+branch+'&path=data%2Fbalance.json&per_page=20&page='+page)]);
  return {branch,head:head.object.sha,page,hasMore:rows.length===20,versions:rows.map((c,i)=>({commit:c.sha,message:c.commit.message,date:c.commit.committer.date,branch,current:page===1&&i===0,parent:c.parents[0]?.sha||null}))};
 }
 async prepare({kind='preview',branch,restoreCommit,sourceCommit,expectedCommit,message,data},session){
  if(!['preview','restore','promote'].includes(kind))throw Error('不支援此發布類型');
  const target=await this.snapshot({branch:kind==='preview'?'chatgpt-dev':kind==='promote'?'main':this.branch(branch)});
  if(kind==='promote'){
   const source=await this.snapshot({branch:'chatgpt-dev'});if(source.commit!==sourceCommit)throw Object.assign(Error('測試版已更新，請重新取得並重新比較。'),{status:409});
   data=source.data;
  }
  if(kind==='restore'){
   if(!/^[a-f0-9]{40}$/.test(restoreCommit))throw Error('歷史 commit SHA 無效');
   const lineage=await this.api(this.base+'/compare/'+restoreCommit+'...'+target.commit);
   if(!['ahead','identical'].includes(lineage.status))throw Error('歷史版本不屬於此分支');
   const old=await this.snapshot({branch:target.branch,ref:restoreCommit});data=old.data;message='restore balance data to '+restoreCommit;
  }
  if(target.commit!==expectedCommit)throw Object.assign(Error('線上版本已更新，請重新取得最新版並重新比較。'),{status:409});
  if(typeof message!=='string'||message.trim().length<4||message.length>300||/[\u0000-\u001f]/.test(message)||/^update(?: json)?$/i.test(message.trim()))throw Error('請輸入至少四個字的具體版本說明');
  const candidate=this.validateDocument(data),diff=D.diff(target.data,candidate);if(!diff.total)throw Error('沒有有效設定差異，禁止建立空白發布 commit');
  await this.requireLifeRuntime(target,candidate);
  const ticket=crypto.randomBytes(32).toString('hex'),nextVersion=crypto.createHash('sha256').update(D.stable(candidate)).digest('hex').slice(0,12);
  if(this.tickets.prune)await this.tickets.prune();else for(const [id,t] of this.tickets)if(t.expires<Date.now())this.tickets.delete(id);
  await this.tickets.set(ticket,{session,kind,restoreCommit,sourceCommit,target,candidate,message:message.trim(),diff,nextVersion,expires:Date.now()+600000});
  return {ticket,branch:target.branch,currentVersion:target.commit,nextVersion,diff,message:message.trim(),sourceCommit:kind==='promote'?sourceCommit:null};
 }
 async commit({ticket,confirmed,productionConfirmation},session){
  const t=await this.tickets.get(ticket);if(!t||t.session!==session||t.expires<Date.now())throw Error('發布摘要已過期，請重新比較');
  if(confirmed!==true)throw Error('必須確認完整發布摘要');
  if(t.target.branch==='main'&&productionConfirmation!=='正式版')throw Error('你正在更新正式版遊戲資料。請輸入「正式版」完成二次確認');
  if(this.tickets.take){if(!await this.tickets.take(ticket,session))throw Error('發布摘要已使用或正在提交，請核對線上版本。');}else this.tickets.delete(ticket);
  const current=await this.snapshot({branch:t.target.branch});
  if(current.commit!==t.target.commit||current.blob!==t.target.blob)throw Object.assign(Error('線上版本已更新，請重新取得最新版並重新比較。'),{status:409});
  if(t.kind==='promote'){
   const source=await this.snapshot({branch:'chatgpt-dev'});if(source.commit!==t.sourceCommit||D.stable(source.data)!==D.stable(t.candidate))throw Object.assign(Error('測試版已更新，請重新取得並重新比較。'),{status:409});
  }
  this.validateDocument(t.candidate);
  await this.requireLifeRuntime(current,t.candidate);
  const base=await this.api(this.base+'/git/commits/'+current.commit);
  const blob=await this.api(this.base+'/git/blobs',{method:'POST',body:{encoding:'utf-8',content:JSON.stringify(t.candidate,null,2)+'\n'}});
  const tree=await this.api(this.base+'/git/trees',{method:'POST',body:{base_tree:base.tree.sha,tree:[{path:'data/balance.json',mode:'100644',type:'blob',sha:blob.sha}]}});
  const commit=await this.api(this.base+'/git/commits',{method:'POST',body:{message:t.kind==='restore'?t.message:'balance: '+t.message+(t.kind==='promote'?'\n\nSource-Test-Commit: '+t.sourceCommit:''),tree:tree.sha,parents:[current.commit]}});
  if(t.kind==='promote'){const source=await this.api(this.base+'/git/ref/heads/chatgpt-dev');if(source.object.sha!==t.sourceCommit)throw Object.assign(Error('測試版已更新，請重新取得並重新比較。'),{status:409});}
  await this.api(this.base+'/git/refs/heads/'+current.branch,{method:'PATCH',body:{sha:commit.sha,force:false}});
  const checked=await this.snapshot({branch:current.branch});
  if(checked.blob!==blob.sha||checked.commit!==commit.sha)throw Error('無法確認線上資料；請重新取得版本，勿重複提交');
  return {commit:commit.sha,branch:current.branch,committed:true,deployment:'等待部署',message:'資料已提交，等待 GitHub Pages 部署。'};
 }
 async deployment({branch,commit}){
  branch=this.branch(branch);if(!/^[a-f0-9]{40}$/.test(commit))throw Error('commit SHA 無效');
  // Preview dispatch runs from main, so workflow head_sha alone cannot prove deployment.
  const prefix=branch==='main'?'':'preview/',url='https://horios.github.io/Emberwild/'+prefix;
  const expected=await this.snapshot({branch,ref:commit});
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
