/* Hosted GitHub App credentials never enter HTML, JSON documents or browser storage. */
const encoder=new TextEncoder(),decoder=new TextDecoder();
export class GithubError extends Error{constructor(status,message){super(message);this.status=status;}}
export const randomToken=()=>[...crypto.getRandomValues(new Uint8Array(32))].map(n=>n.toString(16).padStart(2,'0')).join('');
export const digest=async s=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(s)))].map(n=>n.toString(16).padStart(2,'0')).join('');
export function b64url(bytes){return btoa(String.fromCharCode(...bytes)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');}
const json64=x=>b64url(encoder.encode(JSON.stringify(x)));
function der(tag,bytes){const n=bytes.length,len=n<128?[n]:n<256?[0x81,n]:n<65536?[0x82,n>>8,n&255]:[0x83,n>>16,(n>>8)&255,n&255];return new Uint8Array([tag,...len,...bytes]);}
function pemBytes(pem){const pkcs1=pem.includes('BEGIN RSA PRIVATE KEY');if(!pkcs1&&!pem.includes('BEGIN PRIVATE KEY'))throw new GithubError(503,'GitHub App 私鑰格式無效');const raw=Uint8Array.from(atob(pem.replace(/-----[^-]+-----/g,'').replace(/\s/g,'')),c=>c.charCodeAt(0));return pkcs1?der(0x30,new Uint8Array([2,1,0,0x30,0x0d,6,9,0x2a,0x86,0x48,0x86,0xf7,0x0d,1,1,1,5,0,...der(4,raw)])):raw;}
export async function makeAppJwt(env){
 const now=Math.floor(Date.now()/1000),data=json64({alg:'RS256',typ:'JWT'})+'.'+json64({iat:now-60,exp:now+540,iss:String(env.EMBERWILD_GITHUB_APP_ID)});
 let key;try{key=await crypto.subtle.importKey('pkcs8',pemBytes(env.EMBERWILD_GITHUB_PRIVATE_KEY),{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);}catch{throw new GithubError(503,'GitHub App 私鑰無法讀取；請檢查後端密鑰設定');}
 return data+'.'+b64url(new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,encoder.encode(data))));
}
export function createHostedGithubApp(env,{fetchImpl=fetch}={}){
 const configured=Boolean(env.EMBERWILD_GITHUB_APP_ID&&env.EMBERWILD_GITHUB_INSTALLATION_ID&&env.EMBERWILD_GITHUB_PRIVATE_KEY);
 let token=null,expires=0;
 async function request(path,{method='GET',body,auth}={}){
  if(!path.startsWith('/repos/Horios/Emberwild/')&&!/^\/app\/installations\/\d+\/access_tokens$/.test(path))throw new GithubError(403,'不允許此 GitHub 目標');
  let r;try{r=await fetchImpl('https://api.github.com'+path,{method,headers:{Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'Emberwild-Online-Publisher','Content-Type':'application/json',...(auth?{Authorization:'Bearer '+auth}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(20000),cache:'no-store'});}catch{throw new GithubError(502,'GitHub 連線失敗或逾時；請先核對線上版本，勿重複上傳');}
  if(!r.ok){const n=r.status;throw new GithubError(n,n===401?'GitHub App 授權失效':n===403||n===429?'GitHub 權限不足或 API 用量限制':n===404?'Repository、版本或檔案不存在':n===409||n===422?'線上版本已更新；請重新取得並比較':'GitHub API 失敗（HTTP '+n+'）');}
  return r.status===204?null:r.json();
 }
 async function access(){
  if(!configured)throw new GithubError(503,'尚未設定線上 GitHub App 授權；可編輯、比較及下載，但不能上傳');
  if(token&&expires>Date.now()+60000)return token;
  if(!/^\d+$/.test(String(env.EMBERWILD_GITHUB_INSTALLATION_ID)))throw new GithubError(503,'GitHub App Installation ID 設定無效');
  const jwt=await makeAppJwt(env);
  const out=await request('/app/installations/'+env.EMBERWILD_GITHUB_INSTALLATION_ID+'/access_tokens',{method:'POST',auth:jwt,body:{repositories:['Emberwild'],permissions:{contents:'write',actions:'read'}}});
  token=out.token;expires=Date.parse(out.expires_at);return token;
 }
 const api=async(path,options={})=>{const method=options.method||'GET';if(method!=='GET'&&!configured)throw new GithubError(503,'尚未設定 GitHub App，禁止上傳');return request(path,{...options,auth:configured?await access():undefined});};
 api.configured=configured;return api;
}
export function decodeGitContent(content){return decoder.decode(Uint8Array.from(atob(content.replace(/\s/g,'')),c=>c.charCodeAt(0)));}
