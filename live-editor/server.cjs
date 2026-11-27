#!/usr/bin/env node
/* 即時平衡器本機伺服器：
 * 以遊戲資料夾為網站根目錄，並在 index.html 注入 live-editor.js（同源，平衡器可直接操作遊戲）。
 * 用法：node live-editor/server.cjs [遊戲資料夾] [--port 8787]
 * 預設遊戲資料夾為 ../DreamingAbyss（與本 repository 並列）。
 */
'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const args=process.argv.slice(2);
const portIndex=args.indexOf('--port');
const PORT=Number(portIndex>=0?args.splice(portIndex,2)[1]:process.env.PORT)||8787;
const GAME=path.resolve(args[0]||process.env.GAME_DIR||path.join(__dirname,'..','..','DreamingAbyss'));
const EDITOR=path.join(__dirname,'live-editor.js');
if(!fs.existsSync(path.join(GAME,'index.html'))){console.error('找不到遊戲 index.html：'+GAME+'\n請指定遊戲資料夾：node live-editor/server.cjs <路徑>');process.exit(1);}
const TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.cjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.gif':'image/gif','.ico':'image/x-icon','.woff2':'font/woff2','.woff':'font/woff','.mp3':'audio/mpeg','.ogg':'audio/ogg','.wav':'audio/wav'};
const TAG='<script src="/__live-editor/live-editor.js?v='+Date.now()+'"></script>';
function injectEditor(html){return html.includes('</body>')?html.replace(/<\/body>(?![\s\S]*<\/body>)/i,TAG+'</body>'):html+TAG;}
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');
 let rel=decodeURIComponent(url.pathname);
 res.setHeader('Cache-Control','no-store');
 if(rel==='/__live-editor/live-editor.js'){res.writeHead(200,{'Content-Type':TYPES['.js']});return fs.createReadStream(EDITOR).pipe(res);}
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
server.listen(PORT,()=>console.log('夢淵 即時平衡器：http://localhost:'+PORT+'/\n遊戲資料夾：'+GAME));
