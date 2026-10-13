'use strict';
const crypto=require('node:crypto'),D=require('./balance-diff.cjs');
class ReleaseService{
 constructor({api,validate}){this.api=api;this.validateDocument=validate;this.base='/repos/Horios/Emberwild';this.tickets=new Map();}
 branch(value){if(!['main','chatgpt-dev'].includes(value))throw Error('僅允許 main／chatgpt-dev');return value;}
 async validate({data}){return {data:this.validateDocument(data),valid:true};}
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
 async prepare({kind='preview',expectedCommit,message,data},session){
  if(kind!=='preview')throw Error('不支援此發布類型');
  const target=await this.snapshot({branch:'chatgpt-dev'});
  if(target.commit!==expectedCommit)throw Object.assign(Error('線上版本已更新，請重新取得最新版並重新比較。'),{status:409});
  if(typeof message!=='string'||message.trim().length<4||message.length>300||/[\u0000-\u001f]/.test(message)||/^update(?: json)?$/i.test(message.trim()))throw Error('請輸入至少四個字的具體版本說明');
  const candidate=this.validateDocument(data),diff=D.diff(target.data,candidate);if(!diff.total)throw Error('沒有有效設定差異，禁止建立空白發布 commit');
  const ticket=crypto.randomBytes(32).toString('hex'),nextVersion=crypto.createHash('sha256').update(D.stable(candidate)).digest('hex').slice(0,12);
  for(const [id,t] of this.tickets)if(t.expires<Date.now())this.tickets.delete(id);
  this.tickets.set(ticket,{session,kind,target,candidate,message:message.trim(),diff,nextVersion,expires:Date.now()+600000});
  return {ticket,branch:target.branch,currentVersion:target.commit,nextVersion,diff,message:message.trim()};
 }
 async commit({ticket,confirmed},session){
  const t=this.tickets.get(ticket);if(!t||t.session!==session||t.expires<Date.now())throw Error('發布摘要已過期，請重新比較');
  if(confirmed!==true)throw Error('必須確認完整發布摘要');
  this.tickets.delete(ticket);
  const current=await this.snapshot({branch:t.target.branch});
  if(current.commit!==t.target.commit||current.blob!==t.target.blob)throw Object.assign(Error('線上版本已更新，請重新取得最新版並重新比較。'),{status:409});
  this.validateDocument(t.candidate);
  const base=await this.api(this.base+'/git/commits/'+current.commit);
  const blob=await this.api(this.base+'/git/blobs',{method:'POST',body:{encoding:'utf-8',content:JSON.stringify(t.candidate,null,2)+'\n'}});
  const tree=await this.api(this.base+'/git/trees',{method:'POST',body:{base_tree:base.tree.sha,tree:[{path:'data/balance.json',mode:'100644',type:'blob',sha:blob.sha}]}});
  const commit=await this.api(this.base+'/git/commits',{method:'POST',body:{message:'balance: '+t.message,tree:tree.sha,parents:[current.commit]}});
  await this.api(this.base+'/git/refs/heads/'+current.branch,{method:'PATCH',body:{sha:commit.sha,force:false}});
  const checked=await this.snapshot({branch:current.branch});
  if(checked.blob!==blob.sha)throw Error('無法確認線上資料；請重新取得版本，勿重複提交');
  return {commit:commit.sha,branch:current.branch,committed:true,deployment:'等待部署',message:'資料已提交，等待 GitHub Pages 部署。'};
 }
 async deployment({branch,commit}){
  branch=this.branch(branch);if(!/^[a-f0-9]{40}$/.test(commit))throw Error('commit SHA 無效');
  // Preview dispatch runs from main, so workflow head_sha alone cannot prove deployment.
  const prefix=branch==='main'?'':'preview/',url='https://horios.github.io/Emberwild/'+prefix;
  const runs=await this.api(this.base+'/actions/workflows/deploy-preview.yml/runs?per_page=20');
  const relevant=runs.workflow_runs.filter(r=>r.head_sha===commit);
  const r=relevant[0];return {commit,branch,url,state:r?.conclusion==='failure'?'部署失敗':r?.status==='in_progress'?'部署中':'等待部署',runUrl:r?.html_url||null};
 }

}
module.exports={ReleaseService};
