/* Loopback-only developer preview; publishing is disabled in this fixture. */
'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
async function createPreviewServer({loopbackOnly=true}={}){
 const {serveV2}=await import('../server/online/v2-assets.mjs'),{createGameValidator}=await import('../server/online/game-validator.mjs');
 const html=fs.readFileSync(path.join(root,'balance-editor.html'),'utf8'),doc=await (await serveV2('/v2-game/data/balance.json',html)).json(),validator=createGameValidator();
 return http.createServer(async(req,res)=>{try{
  const url=new URL(req.url,'http://127.0.0.1');
  if(loopbackOnly&&!req.headers.host?.startsWith('127.0.0.1:')){res.writeHead(403);res.end();return;}
  if(req.method==='GET'){
   if(url.pathname==='/'){res.writeHead(302,{Location:'/v2'});res.end();return;}
   if(url.pathname==='/api/session'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({csrf:'local-preview',capabilities:{publishing:false,readOnly:true}}));return;}
   const result=await serveV2(url.pathname,html);if(result){res.writeHead(result.status,Object.fromEntries(result.headers));res.end(Buffer.from(await result.arrayBuffer()));return;}
  }
  if(req.method==='POST'&&req.headers['x-emberwild-csrf']==='local-preview'){
   let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>4000000)throw Error('資料過大');}const body=JSON.parse(raw||'{}');
   res.setHeader('Content-Type','application/json');
   if(url.pathname==='/api/snapshot'){res.end(JSON.stringify({branch:body.branch||'chatgpt-dev',commit:'a'.repeat(40),data:doc}));return;}
   if(url.pathname==='/api/validate'){validator.validate(body.data);res.end(JSON.stringify({valid:true}));return;}
   if(url.pathname==='/api/history'){res.end(JSON.stringify({versions:[],page:1}));return;}
   res.writeHead(403);res.end(JSON.stringify({error:'本機預覽不提供發布'}));return;
  }
  res.writeHead(404);res.end('Not found');
 }catch(e){res.writeHead(400,{'Content-Type':'application/json'});res.end(JSON.stringify({error:e.message}));}});
}
if(require.main===module){
 const args=require('node:util').parseArgs({options:{host:{type:'string',default:'127.0.0.1'},port:{type:'string',default:'4319'},strictPort:{type:'boolean'}}}).values;
 createPreviewServer({loopbackOnly:args.host==='127.0.0.1'}).then(server=>server.listen(Number(args.port),args.host,()=>console.log('Developer preview: http://'+args.host+':'+args.port+'/v2')));
}
module.exports={createPreviewServer};
