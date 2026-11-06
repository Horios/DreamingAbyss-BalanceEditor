'use strict';
const crypto=require('node:crypto'),fs=require('node:fs');
class GithubError extends Error{constructor(status,message){super(message);this.status=status;}}
function createGithubApp({appId,installationId,privateKeyPath,fetchImpl=fetch}){
 let token=null,expires=0;
 const base='https://api.github.com';
 async function request(path,{method='GET',body,auth}={}){
  let response;try{response=await fetchImpl(base+path,{method,headers:{Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28',Authorization:'Bearer '+auth,'Content-Type':'application/json','User-Agent':'Emberwild-Balance-Publisher'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(20000)});}catch{throw new GithubError(502,'GitHub 網路錯誤或逾時；尚未確認提交成功');}
  if(!response.ok){const status=response.status,reason=status===401?'GitHub App 尚未授權或憑證已失效':(status===429||status===403&&response.headers?.get('x-ratelimit-remaining')==='0')?'GitHub API rate limit 已達限制，請稍後重新取得版本':status===403?'GitHub 權限不足或次要 API rate limit':status===404?'Repository、branch 或 JSON 不存在':status===409||status===422?'線上版本已更新，請重新取得最新版並重新比較':'GitHub API 失敗（HTTP '+status+'）';throw new GithubError(status,reason);}
  return response.status===204?null:response.json();
 }
 async function access(){
  if(!appId||!installationId||!privateKeyPath)throw new GithubError(401,'尚未設定 GitHub App；目前仍可編輯、驗證與下載 JSON');
  if(token&&expires>Date.now()+60000)return token;
  const now=Math.floor(Date.now()/1000),b64=x=>Buffer.from(JSON.stringify(x)).toString('base64url'),head=b64({alg:'RS256',typ:'JWT'}),payload=b64({iat:now-60,exp:now+540,iss:String(appId)}),data=head+'.'+payload;
  const jwt=data+'.'+crypto.sign('RSA-SHA256',Buffer.from(data),fs.readFileSync(privateKeyPath)).toString('base64url');
  const out=await request('/app/installations/'+encodeURIComponent(installationId)+'/access_tokens',{method:'POST',auth:jwt,body:{repositories:['DreamingAbyss'],permissions:{contents:'write',actions:'read'}}});
  token=out.token;expires=Date.parse(out.expires_at);return token;
 }
 return async(path,options={})=>request(path,{...options,auth:await access()});
}
module.exports={createGithubApp,GithubError};
