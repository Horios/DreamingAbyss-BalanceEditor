'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {createGithubApp}=require('./github-app.cjs');
function createServer({service,editorRoot=path.resolve(__dirname,'..'),port=4318}){
 const sessions=new Map(),origin='http://127.0.0.1:'+port;
 const json=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value));};
 return http.createServer(async(req,res)=>{
  try{
   if(req.headers.host!=='127.0.0.1:'+port){json(res,403,{error:'不允許此 Host'});return;}
   const url=new URL(req.url,origin);
   if(req.method==='GET'&&url.pathname==='/'){
    const id=crypto.randomBytes(32).toString('hex'),csrf=crypto.randomBytes(32).toString('hex');sessions.set(id,{csrf,expires:Date.now()+24*3600000});
    for(const [k,s] of sessions)if(s.expires<Date.now())sessions.delete(k);
    res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Set-Cookie':'ew-release='+id+'; HttpOnly; SameSite=Strict; Path=/','X-Frame-Options':'DENY','X-Content-Type-Options':'nosniff'});res.end(fs.readFileSync(path.join(editorRoot,'balance-editor.html')));return;
   }
   const id=(req.headers.cookie||'').match(/(?:^|;\s*)ew-release=([a-f0-9]{64})(?:;|$)/)?.[1],session=sessions.get(id);
   if(!session||session.expires<Date.now()){json(res,401,{error:'尚未登入本機發布工作台，請從首頁開啟'});return;}
   if(req.headers.origin&&req.headers.origin!==origin){json(res,403,{error:'不允許跨來源請求'});return;}
   if(req.method==='GET'&&url.pathname==='/api/session'){json(res,200,{csrf:session.csrf,repository:'Horios/Emberwild'});return;}
   if(req.method!=='POST'||req.headers.origin!==origin||req.headers['x-emberwild-csrf']!==session.csrf||!/^application\/json/.test(req.headers['content-type']||'')){json(res,403,{error:'請求未通過 CSRF／來源檢查'});return;}
   let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>4000000){json(res,413,{error:'JSON 過大'});return;}}
   const body=JSON.parse(raw||'{}'),method=url.pathname.slice('/api/'.length);
   if(!url.pathname.startsWith('/api/')||!['snapshot','history','prepare','commit','deployment','validate'].includes(method)){json(res,404,{error:'未知操作'});return;}
   const result=await service[method](body,id);json(res,200,result);
  }catch(e){json(res,e.status>=400&&e.status<=599?e.status:400,{error:e.message,issues:e.issues||[]});}
 });
}
if(require.main===module){
 const gameRoot=path.resolve(process.env.EMBERWILD_GAME_ROOT||path.join(__dirname,'../../Emberwild'));
 const {ReleaseService}=require('./release-service.cjs');
 const api=createGithubApp({appId:process.env.EMBERWILD_GITHUB_APP_ID,installationId:process.env.EMBERWILD_GITHUB_INSTALLATION_ID,privateKeyPath:process.env.EMBERWILD_GITHUB_PRIVATE_KEY_PATH});
 const {loadRuntime}=require(path.join(gameRoot,'tests/headless-runtime.cjs'));
 const runtime=loadRuntime(gameRoot);const validate=d=>{runtime.ctx.__candidate=d;return JSON.parse(runtime.run('JSON.stringify(EmberwildBalanceDocument.validate(__candidate,validateBalanceConfig,exportableBalance()))'));};
 const service=new ReleaseService({api,validate});const server=createServer({service});server.listen(4318,'127.0.0.1',()=>console.log('平衡工作台：http://127.0.0.1:4318（GitHub App 金鑰只由本機服務讀取）'));
}
module.exports={createServer};
