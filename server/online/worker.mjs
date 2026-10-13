import {GithubConnection,connectionConfig,setupHTML} from './connect.mjs';
import {createHostedGithubApp,randomToken,digest,decodeGitContent,b64url} from './github-app.mjs';
import {D1TicketStore} from './tickets.mjs';
import {createGameValidator} from './game-validator.mjs';
import {ReleaseService} from './release-service.mjs';
import {editorHTML,validatorCommit} from './editor.mjs';
const csrfEncoder=new TextEncoder();
const JSON_HEADERS={'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
const json=(status,value)=>new Response(JSON.stringify(value),{status,headers:JSON_HEADERS});
async function csrf(secret,user,expires){const key=await crypto.subtle.importKey('raw',csrfEncoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return expires+'.'+b64url(new Uint8Array(await crypto.subtle.sign('HMAC',key,csrfEncoder.encode(user+'|'+expires))));}
async function csrfValid(secret,user,token){const expires=Number(token?.split('.')[0]);if(!Number.isSafeInteger(expires)||expires<Date.now()||expires>Date.now()+86400000)return false;const expected=await csrf(secret,user,expires);if(token.length!==expected.length)return false;let delta=0;for(let i=0;i<expected.length;i++)delta|=token.charCodeAt(i)^expected.charCodeAt(i);return delta===0;}
async function bodyJSON(request){const reader=request.body?.getReader();if(!reader)return {};const chunks=[];let size=0;for(;;){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>4000000){await reader.cancel();throw Object.assign(Error('JSON 超過 4 MB 上限'),{status:413});}chunks.push(value);}const all=new Uint8Array(size);let offset=0;for(const c of chunks){all.set(c,offset);offset+=c.length;}return JSON.parse(new TextDecoder().decode(all));}
export function createWorker({githubFactory=createHostedGithubApp,validatorFactory=createGameValidator}={}){return {
 async fetch(request,env,ctx){
  const url=new URL(request.url);
  try{
   // Sites provides the owner-private access boundary and trusted identity headers.
   if(request.method==='GET'&&url.pathname==='/api/health')return json(200,{ok:true,repository:'Horios/Emberwild',validatorCommit,online:true});
   const user=request.headers.get('oai-authenticated-user-id');
   if(!user)return url.pathname==='/'?Response.redirect(url.origin+'/signin-with-chatgpt?return_to=%2F',302):json(401,{error:'請先登入私人工作台'});
   if(env.EMBERWILD_ALLOWED_USER_ID&&user!==env.EMBERWILD_ALLOWED_USER_ID)return json(403,{error:'此帳號沒有發布權限'});
   if(request.method==='GET'&&url.pathname==='/')return new Response(editorHTML,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store','X-Frame-Options':'DENY','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"}});
   const secret=env.EMBERWILD_SESSION_SECRET;
   if(!secret||secret.length<32)return json(503,{error:'工作台安全金鑰尚未配置'});
   if(url.pathname==='/setup'&&request.method==='GET'){
    if(!env.DB)return json(503,{error:'GitHub 連線儲存尚未配置'});
    return new Response(setupHTML(await new GithubConnection(env,user,url.origin).status()),{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store','X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; form-action 'self' https://github.com; frame-ancestors 'none'; base-uri 'none'"}});
   }
   if(request.method==='GET'&&['/api/github/manifest-callback','/api/github/install-callback'].includes(url.pathname)){
    const connection=new GithubConnection(env,user,url.origin);
    if(url.pathname.endsWith('manifest-callback')){const result=await connection.exchange(url.searchParams.get('state'),url.searchParams.get('code'));return Response.redirect(result.installationUrl,303);}
    await connection.verify();return Response.redirect(url.origin+'/setup',303);
   }
   const runtimeEnv=await connectionConfig(env,user);
   const api=githubFactory(runtimeEnv),capabilities={publishing:api.configured&&Boolean(env.DB),readOnly:!api.configured,validatorCommit};
   if(request.method==='GET'&&url.pathname==='/api/session')return json(200,{csrf:await csrf(secret,user,Date.now()+23*3600000),repository:'Horios/Emberwild',capabilities});
   if(request.method!=='POST'||request.headers.get('Origin')!==url.origin||!/^application\/json/.test(request.headers.get('Content-Type')||'')||!await csrfValid(secret,user,request.headers.get('X-Emberwild-CSRF')))return json(403,{error:'請求未通過來源或 CSRF 檢查'});
   const method=url.pathname.replace(/^\/api\//,'');
   if(!url.pathname.startsWith('/api/')||!['snapshot','history','prepare','commit','deployment','validate','connect','connect-check'].includes(method))return json(404,{error:'未知操作'});
   if(['prepare','commit'].includes(method)&&!capabilities.publishing)return json(503,{error:'尚未設定線上 GitHub App 或摘要儲存，上傳未啟用'});
   const body=await bodyJSON(request);
   if(['connect','connect-check'].includes(method)){if(!env.DB)return json(503,{error:'GitHub 連線儲存尚未配置'});const connection=new GithubConnection(env,user,url.origin);return json(200,await (method==='connect'?connection.begin():connection.verify()));}
   const runtime=['validate','prepare','commit'].includes(method)?validatorFactory():null;
   const service=new ReleaseService({api,validate:input=>runtime.validate(input),ticketStore:env.DB?new D1TicketStore(env.DB):null});
   return json(200,await service[method](body,user));
  }catch(err){if(url.pathname.startsWith('/api/github/'))return new Response(setupHTML({},err.message),{status:err.status>=400&&err.status<=599?err.status:400,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store'}});return json(err.status>=400&&err.status<=599?err.status:400,{error:err.message,issues:err.issues||[]});}
 }
};}
export default createWorker();
