#!/usr/bin/env node
/* 把遊戲與即時平衡器打包成單一 HTML 檔，可直接用瀏覽器開啟（不需伺服器）。
 * 用法：node live-editor/build-html.cjs [遊戲資料夾] [輸出檔]
 * 預設遊戲資料夾 ../DreamingAbyss，輸出 live-editor/dist/dreaming-abyss-live-editor.html
 * 做法：
 *  - CSS 與一般 <script> 直接內嵌。
 *  - data-balance-src 的遊戲模組在開啟時轉成 blob URL，由遊戲原本的載入器依序執行。
 *  - data/ 下的 JSON 內嵌，攔截 fetch 回傳。
 * 單檔模式沒有本機伺服器，「直接提交到遊戲分支」不可用；其餘功能（含模組 ZIP 輸出）皆可用。
 */
'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const GAME=path.resolve(process.argv[2]||path.join(__dirname,'..','..','DreamingAbyss'));
const OUT=path.resolve(process.argv[3]||path.join(__dirname,'dist','dreaming-abyss-live-editor.html'));
const read=rel=>fs.readFileSync(path.join(GAME,rel.split('?')[0]),'utf8');
const scriptSafe=s=>s.replace(/<\/script/gi,'<\\/script').replace(/<!--/g,'<\\!--');
let html=read('index.html');

// CSS
html=html.replace(/<link\b([^>]*)>/g,(m,attrs)=>{
 if(!/\brel="stylesheet"/.test(attrs))return m;const href=(attrs.match(/\bhref="([^"]+)"/)||[])[1];if(!href||/^https?:/.test(href))return m;
 const id=(attrs.match(/\bid="([^"]+)"/)||[])[1];
 return '<style'+(id?' id="'+id+'"':'')+' data-src="'+href.split('?')[0]+'">'+read(href).replace(/<\/style/gi,'<\\/style')+'</style>';});

// 遊戲模組（由載入器執行）
const modules={};
html=html.replace(/<script\b([^>]*)\bdata-balance-src="([^"]+)"([^>]*)><\/script>/g,(m,pre,src,post)=>{const key=src.split('?')[0];modules[key]=read(src);return '<script'+pre+'data-balance-src="'+key+'"'+post+'></script>';});

// 一般 script
let loaderPatched=false;
html=html.replace(/<script\b([^>]*?)\ssrc="([^"]+)"([^>]*)><\/script>/g,(m,pre,src,post)=>{
 if(/^https?:/.test(src)||/data-balance-src/.test(pre+post))return m;
 let code=read(src);
 if(src.startsWith('js/balance/published-loader.js')){
  const a="url.searchParams.set('balance-build',runtimeVersion);";
  if(!code.includes(a))throw Error('遊戲載入器格式已改變，請更新 build-html.cjs');
  code=code.replace(a,"if(url.protocol!=='blob:')"+a);
  // 模組路徑換成內嵌的 blob URL
  code=code.replace("const urls=Array.from(document.querySelectorAll('script[data-balance-src]'),node=>{const url=new URL(node.getAttribute('data-balance-src'),location.href);",
   "const urls=Array.from(document.querySelectorAll('script[data-balance-src]'),node=>{const url=new URL(globalThis.__DA_BLOB__?.(node.getAttribute('data-balance-src'))||node.getAttribute('data-balance-src'),location.href);");
  if(!code.includes('__DA_BLOB__'))throw Error('遊戲載入器格式已改變（模組清單），請更新 build-html.cjs');
  loaderPatched=true;
 }
 return '<script'+pre+post+' data-src="'+src.split('?')[0]+'">'+scriptSafe(code)+'</script>';
});
if(!loaderPatched)throw Error('找不到 js/balance/published-loader.js');
const leftovers=(html.match(/<(?:script|link)\b[^>]*\s(?:src|href)="(?:js|css)\/[^"]+"/g)||[]).filter(t=>!/data-balance-src/.test(t));
if(leftovers.length)throw Error('仍有未內嵌的外部檔案：'+leftovers.slice(0,5).join(' '));

// data/ 內嵌
const data={};
(function walk(dir){for(const e of fs.readdirSync(path.join(GAME,dir),{withFileTypes:true})){const rel=dir+'/'+e.name;if(e.isDirectory())walk(rel);else if(e.name.endsWith('.json'))data[rel]=fs.readFileSync(path.join(GAME,rel),'utf8');}})('data');
let commit='development';try{commit=cp.execFileSync('git',['-C',GAME,'rev-parse','HEAD'],{encoding:'utf8'}).trim();}catch{}
const build=JSON.parse(data['data/build.json']||'{}');build.commit=commit;build.bundled=true;data['data/build.json']=JSON.stringify(build);

const boot=`<script>
/* 單檔模式：內嵌檔案與 fetch 攔截 */
(()=>{
 const DATA=${JSON.stringify(data)};
 const MODULES=${JSON.stringify(modules)};
 const blobs={};
 globalThis.__DA_BLOB__=key=>{key=String(key).split('?')[0];if(!(key in MODULES))return null;return blobs[key]||(blobs[key]=URL.createObjectURL(new Blob([MODULES[key]],{type:'text/javascript'})));};
 globalThis.__DA_BUNDLED__=true;
 const realFetch=globalThis.fetch.bind(globalThis);
 globalThis.fetch=function(input,init){
  try{const url=new URL(typeof input==='string'?input:input.url,location.href);
   const base=new URL('.',location.href).href;
   let key=url.href.startsWith(base)?url.href.slice(base.length).split(/[?#]/)[0]:null;
   if(key&&key in DATA)return Promise.resolve(new Response(DATA[key],{status:200,headers:{'Content-Type':'application/json'}}));
   if(key&&/^(data\\/|__live-editor\\/)/.test(key))return Promise.resolve(new Response('Not found',{status:404}));
  }catch{}
  return realFetch(input,init);
 };
})();
</script>`;
html=html.replace(/<head>|<meta charset="UTF-8">/i,m=>m+boot);
if(!html.includes('__DA_BLOB__'))throw Error('無法插入啟動程式');

// 即時平衡器
html=html.replace(/<\/body>(?![\s\S]*<\/body>)/i,'<script data-src="live-editor.js">'+scriptSafe(fs.readFileSync(path.join(__dirname,'live-editor.js'),'utf8'))+'</script></body>');
if(!html.includes('data-src="live-editor.js"'))html+='<script data-src="live-editor.js">'+scriptSafe(fs.readFileSync(path.join(__dirname,'live-editor.js'),'utf8'))+'</script>';
html=html.replace(/<title>([^<]*)<\/title>/,'<title>$1 · 即時平衡器</title>');

fs.mkdirSync(path.dirname(OUT),{recursive:true});fs.writeFileSync(OUT,html);
console.log('已輸出 '+OUT+'（'+(Buffer.byteLength(html)/1048576).toFixed(1)+' MB，遊戲 '+commit.slice(0,7)+'，模組 '+Object.keys(modules).length+' 個，資料 '+Object.keys(data).length+' 個）');
