#!/usr/bin/env node
/* Refresh the developer shell inside server/online/v2-assets.mjs without a game checkout.
   build-v2-assets.cjs packages the game and the shell together and needs ../DreamingAbyss. When only the shell changed
   (balance-editor-v2.html, scripts/v2-*.js, the V2 docs), this keeps the packaged game files byte for byte, swaps the
   shell files and the game bridge script in the game entry, and updates the bridge hashes in docs/v2-game-provenance.json.
   Usage: node scripts/repack-v2-shell.cjs */
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),zlib=require('node:zlib');
const root=path.resolve(__dirname,'..'),modulePath=path.join(root,'server/online/v2-assets.mjs'),provenancePath=path.join(root,'docs/v2-game-provenance.json');
const hash=s=>crypto.createHash('sha256').update(s).digest('hex'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
function repack(source){
 const packedMatch=/\nconst v2Packed=("(?:[^"\\]|\\.)*");\n/.exec(source),bridgeMatch=/\nconst v2EditorBridge=("(?:[^"\\]|\\.)*");\n/.exec(source);
 if(!packedMatch||!bridgeMatch)throw Error('v2-assets.mjs 格式不符，請改用 build-v2-assets.cjs 重新建置');
 const assets=JSON.parse(zlib.gunzipSync(Buffer.from(JSON.parse(packedMatch[1]),'base64')).toString('utf8'));
 const gameBridge=read('scripts/v2-game-bridge.js'),editorBridge=read('scripts/v2-editor-bridge.js'),shell=read('balance-editor-v2.html'),audit=read('balance-audit.html');
 // The game entry is the unchanged game index.html with the bridge inserted as the first script.
 for(const route of ['/v2-game/','/v2-game/index.html']){
  const body=assets[route]?.body;if(typeof body!=='string')throw Error('找不到遊戲入口 '+route);
  const start=body.indexOf('<script>'),end=body.indexOf('</script>',start);if(start<0||end<0)throw Error('遊戲入口缺少橋接 script');
  assets[route].body=body.slice(0,start)+'<script>'+gameBridge+'</script>'+body.slice(end+'</script>'.length);
 }
 for(const route of ['/v2','/v2/','/balance-editor-v2.html'])assets[route]={body:shell,type:'text/html'};
 for(const route of ['/v2-audit','/balance-audit.html'])assets[route]={body:audit,type:'text/html'};
 for(const file of ['scripts/v2-shared-core.js','scripts/v2-page-context.js','scripts/v2-simulation.js','scripts/v2-inline-edit.js','docs/v2-audit.json','docs/v2-audit.md','docs/v2-source-status.md','docs/v2-seconds-coverage.json','docs/v2-core-provenance.json'])assets['/'+file]={body:read(file),type:file.endsWith('.js')?'text/javascript':file.endsWith('.json')?'application/json':'text/plain'};
 const packed=zlib.gzipSync(Buffer.from(JSON.stringify(assets)),{level:9}).toString('base64');
 const out=source.slice(0,packedMatch.index)+'\nconst v2Packed='+JSON.stringify(packed)+';\n'+source.slice(packedMatch.index+packedMatch[0].length);
 const again=/\nconst v2EditorBridge=("(?:[^"\\]|\\.)*");\n/.exec(out);
 return {module:out.slice(0,again.index)+'\nconst v2EditorBridge='+JSON.stringify(editorBridge)+';\n'+out.slice(again.index+again[0].length),gameBridge,editorBridge,shell};
}
if(require.main===module){
 const r=repack(fs.readFileSync(modulePath,'utf8'));fs.writeFileSync(modulePath,r.module);
 const provenance=JSON.parse(fs.readFileSync(provenancePath,'utf8'));Object.assign(provenance,{gameBridgeSha256:hash(r.gameBridge),editorBridgeSha256:hash(r.editorBridge),entrySha256:hash(r.shell)});
 fs.writeFileSync(provenancePath,JSON.stringify(provenance,null,2)+'\n');
 console.log('Repacked developer shell ('+Buffer.byteLength(r.module)+' bytes); game files unchanged.');
}
module.exports={repack};
