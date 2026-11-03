/* Package the unchanged current game for the private developer preview. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),zlib=require('node:zlib'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..'),game=path.resolve(process.env.EMBERWILD_GAME_ROOT||path.join(root,'../Emberwild'));
const hash=s=>crypto.createHash('sha256').update(s).digest('hex'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
function inject(html,code){const script='<script>'+code+'</script>';return /<\/body>/i.test(html)?html.replace(/<\/body>/i,script+'</body>'):html+script;}
function build(){
 const assets={},files=[];
 function add(route,body,type){assets[route]={body,type};}
 function scan(dir){for(const f of fs.readdirSync(path.join(game,dir),{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){const relative=dir+'/'+f.name;if(f.isDirectory())scan(relative);else if(f.isFile()&&/\.(js|css|json)$/.test(f.name)){const body=fs.readFileSync(path.join(game,relative),'utf8');files.push({path:relative,sha256:hash(body)});add('/v2-game/'+relative,body,f.name.endsWith('.js')?'text/javascript':f.name.endsWith('.css')?'text/css':'application/json');}}}
 for(const dir of ['js','css','data'])scan(dir);
 const original=fs.readFileSync(path.join(game,'index.html'),'utf8'),gameBridge=read('scripts/v2-game-bridge.js');
 files.push({path:'index.html',sha256:hash(original)});
 // Insert storage isolation before the first existing game script executes.
 const gameHTML=original;
 const at=gameHTML.indexOf('<script');if(at<0)throw Error('Game entry has no script boundary');
 const entry=gameHTML.slice(0,at)+'<script>'+gameBridge+'</script>'+gameHTML.slice(at);
 add('/v2-game/',entry,'text/html');add('/v2-game/index.html',entry,'text/html');
 // Reuse the game's theme tokens without importing its page layout rules.
 add('/v2-theme.css',fs.readFileSync(path.join(game,'css/themes.css'),'utf8').split('body{')[0],'text/css');
 add('/v2',read('balance-editor-v2.html'),'text/html');add('/v2/',read('balance-editor-v2.html'),'text/html');add('/balance-editor-v2.html',read('balance-editor-v2.html'),'text/html');
 add('/v2-audit',read('balance-audit.html'),'text/html');add('/balance-audit.html',read('balance-audit.html'),'text/html');
 for(const file of ['scripts/v2-shared-core.js','scripts/v2-page-context.js','docs/v2-audit.json','docs/v2-audit.md','docs/v2-source-status.md','docs/v2-seconds-coverage.json','docs/v2-core-provenance.json'])add('/'+file,read(file),file.endsWith('.js')?'text/javascript':file.endsWith('.json')?'application/json':'text/plain');
 const editorBridge=read('scripts/v2-editor-bridge.js'),packed=zlib.gzipSync(Buffer.from(JSON.stringify(assets)),{level:9}).toString('base64');
 const provenance={gameCommit:cp.execFileSync('git',['-C',game,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),files,gameBridgeSha256:hash(gameBridge),editorBridgeSha256:hash(editorBridge),entrySha256:hash(read('balance-editor-v2.html'))};
 const module='/* Generated private developer-preview assets. */\nexport const v2GameCommit='+JSON.stringify(provenance.gameCommit)+';\nconst v2Packed='+JSON.stringify(packed)+';\nconst v2EditorBridge='+JSON.stringify(editorBridge)+';\nlet v2AssetCache;\n'+`
async function v2Assets(){if(!v2AssetCache)v2AssetCache=(async()=>JSON.parse(await new Response(new Blob([Uint8Array.from(atob(v2Packed),c=>c.charCodeAt(0))]).stream().pipeThrough(new DecompressionStream('gzip'))).text()))();return v2AssetCache;}
export async function serveV2(pathname,editorHTML){
 if(pathname==='/v2-editor'){
  const script='<script>'+v2EditorBridge+'</script>';
  // The legacy editor keeps extensions after its early closing body tag.
  const body=editorHTML+script;
  return new Response(body,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store','X-Frame-Options':'SAMEORIGIN','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'self'; base-uri 'none'; form-action 'self'"}});
 }
 if(!['/v2','/v2/','/balance-editor-v2.html','/v2-audit','/balance-audit.html'].includes(pathname)&&!pathname.startsWith('/v2-game/')&&!pathname.startsWith('/docs/v2-')&&pathname!=='/scripts/v2-shared-core.js'&&pathname!=='/scripts/v2-page-context.js'&&pathname!=='/v2-theme.css')return null;
 const all=await v2Assets();if(!Object.hasOwn(all,pathname))return new Response('Not found',{status:404});const row=all[pathname];
 return new Response(row.body,{headers:{'Content-Type':row.type+'; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff',...(row.type==='text/html'?{'X-Frame-Options':'SAMEORIGIN','Content-Security-Policy':"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; frame-src 'self'; frame-ancestors 'self'; base-uri 'none'; form-action 'self'"}:{})}});
}
`;
 return {module,provenance};
}
if(require.main===module){const b=build();fs.writeFileSync(path.join(root,'server/online/v2-assets.mjs'),b.module);fs.writeFileSync(path.join(root,'docs/v2-game-provenance.json'),JSON.stringify(b.provenance,null,2)+'\n');console.log('Packaged unchanged game and developer shell ('+Buffer.byteLength(b.module)+' bytes)');}
module.exports={build,inject};
