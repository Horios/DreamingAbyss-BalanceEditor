#!/usr/bin/env node
/* 即時平衡器本機伺服器：
 * 以遊戲資料夾為網站根目錄，並在 index.html 注入 live-editor.js（同源，平衡器可直接操作遊戲）。
 * 另提供：
 *   GET  /__live-editor/status   遊戲資料夾與 git 狀態
 *   POST /__live-editor/publish  把平衡模組檔寫入遊戲資料夾、建立新分支並提交（可選推送）
 * 用法：node live-editor/server.cjs [遊戲資料夾] [--port 8787]
 * 預設遊戲資料夾為 ../DreamingAbyss（與本 repository 並列）。
 */
'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const args=process.argv.slice(2);
const portIndex=args.indexOf('--port');
const PORT=Number(portIndex>=0?args.splice(portIndex,2)[1]:process.env.PORT)||8787;
const GAME=path.resolve(args[0]||process.env.GAME_DIR||path.join(__dirname,'..','..','DreamingAbyss'));
const EDITOR=path.join(__dirname,'live-editor.js');
const TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.cjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.gif':'image/gif','.ico':'image/x-icon','.woff2':'font/woff2','.woff':'font/woff','.mp3':'audio/mpeg','.ogg':'audio/ogg','.wav':'audio/wav'};

function git(...a){return cp.execFileSync('git',['-C',GAME,...a],{encoding:'utf8',stdio:['ignore','pipe','pipe'],maxBuffer:1<<28}).trim();}
function gitStatus(){
 try{git('rev-parse','--is-inside-work-tree');}catch{return {git:false,game:GAME};}
 const branch=git('rev-parse','--abbrev-ref','HEAD');
 const dirty=git('status','--porcelain','--','data').length>0;
 return {git:true,game:GAME,branch,dirty,head:git('rev-parse','HEAD')};
}
function json(res,code,obj){res.writeHead(code,{'Content-Type':TYPES['.json'],'Cache-Control':'no-store'});res.end(JSON.stringify(obj));}
function readBody(req,limit=64<<20){return new Promise((resolve,reject)=>{let size=0;const chunks=[];req.on('data',c=>{size+=c.length;if(size>limit){reject(Error('資料過大'));req.destroy();}else chunks.push(c);});req.on('end',()=>resolve(Buffer.concat(chunks).toString('utf8')));req.on('error',reject);});}

async function publish(req,res){
 // 只接受本機請求
 const origin=req.headers.origin;if(origin&&!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin))return json(res,403,{ok:false,error:'只接受本機頁面的請求'});
 let body;try{body=JSON.parse(await readBody(req));}catch(e){return json(res,400,{ok:false,error:'請求格式錯誤：'+e.message});}
 const st=gitStatus();if(!st.git)return json(res,400,{ok:false,error:'遊戲資料夾不是 git repository'});
 if(st.dirty)return json(res,409,{ok:false,error:'遊戲資料夾的 data/ 有未提交的修改，請先處理'});
 const branch=String(body.branch||'').trim();
 if(!/^[\w.\-/]+$/.test(branch)||branch.startsWith('-')||branch.includes('..'))return json(res,400,{ok:false,error:'分支名稱不合法'});
 try{git('check-ref-format','--branch',branch);}catch{return json(res,400,{ok:false,error:'分支名稱不合法'});}
 const files=body.files&&typeof body.files==='object'?body.files:{};
 const names=Object.keys(files);if(!names.length)return json(res,400,{ok:false,error:'沒有檔案'});
 for(const n of names){const full=path.resolve(GAME,n);if(!n.startsWith('data/')||!full.startsWith(path.join(GAME,'data')+path.sep)||typeof files[n]!=='string')return json(res,400,{ok:false,error:'不允許的檔案路徑：'+n});}
 const start=st.branch;
 try{
  git('switch','-c',branch);
  for(const n of names){const full=path.resolve(GAME,n);fs.mkdirSync(path.dirname(full),{recursive:true});fs.writeFileSync(full,files[n]);}
  // 以遊戲自己的檢查確認模組、manifest 與整合檔一致
  let note='';
  const checker=path.join(GAME,'scripts','balance-modules.cjs');
  if(fs.existsSync(checker)){try{cp.execFileSync(process.execPath,[checker,'check'],{cwd:GAME,encoding:'utf8',stdio:['ignore','pipe','pipe']});note='模組檢查通過。';}
   catch(e){throw Error('遊戲模組檢查未通過：'+String(e.stdout||'')+String(e.stderr||e.message));}}
  git('add','--',...names);
  const message=String(body.message||'平衡調整（即時平衡器）').slice(0,500);
  git('-c','user.name='+(process.env.GIT_AUTHOR_NAME||git('config','user.name')||'Live Balance Editor'),'-c','user.email='+(process.env.GIT_AUTHOR_EMAIL||git('config','user.email')||'live-editor@localhost'),'commit','-m',message);
  const commit=git('rev-parse','HEAD');
  let pushed=false;
  if(body.push){try{git('push','-u','origin',branch);pushed=true;}catch(e){note+='推送失敗：'+String(e.stderr||e.message).trim()+'（已在本機提交）';}}
  git('switch',start);
  return json(res,200,{ok:true,branch,commit,pushed,note:note+'遊戲資料夾已切回 '+start+'。'});
 }catch(e){
  // 失敗時還原：丟棄寫入、回到原分支並刪除新分支
  try{git('checkout','--','.');}catch{}
  try{git('clean','-fd','--','data');}catch{}
  try{git('switch',start);}catch{}
  try{git('branch','-D',branch);}catch{}
  return json(res,500,{ok:false,error:String(e.message||e).slice(0,2000)});
 }
}

if(require.main===module&&!fs.existsSync(path.join(GAME,'index.html'))){console.error('找不到遊戲 index.html：'+GAME+'\n請指定遊戲資料夾：node live-editor/server.cjs <路徑>');process.exit(1);}
const TAG='<script src="/__live-editor/live-editor.js?v='+Date.now()+'"></script>';
function injectEditor(html){return html.includes('</body>')?html.replace(/<\/body>(?![\s\S]*<\/body>)/i,TAG+'</body>'):html+TAG;}
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');
 let rel=decodeURIComponent(url.pathname);
 res.setHeader('Cache-Control','no-store');
 if(rel==='/__live-editor/live-editor.js'){res.writeHead(200,{'Content-Type':TYPES['.js']});return fs.createReadStream(EDITOR).pipe(res);}
 if(rel==='/__live-editor/status')return json(res,200,gitStatus());
 if(rel==='/__live-editor/publish'&&req.method==='POST')return void publish(req,res);
 if(rel.endsWith('/'))rel+='index.html';
 const file=path.join(GAME,path.normalize(rel).replace(/^([/\\])+/,''));
 if(!file.startsWith(GAME+path.sep)&&file!==GAME){res.writeHead(403);return res.end();}
 fs.stat(file,(err,st)=>{
  if(err||!st.isFile()){res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});return res.end('Not found');}
  const type=TYPES[path.extname(file).toLowerCase()]||'application/octet-stream';
  if(path.basename(file)==='index.html'){return fs.readFile(file,'utf8',(e,html)=>{if(e){res.writeHead(500);return res.end();}res.writeHead(200,{'Content-Type':type});res.end(injectEditor(html));});}
  res.writeHead(200,{'Content-Type':type});fs.createReadStream(file).pipe(res);
 });
});
if(require.main===module)server.listen(PORT,'127.0.0.1',()=>console.log('夢淵 即時平衡器：http://localhost:'+PORT+'/\n遊戲資料夾：'+GAME));
module.exports={server,GAME};
