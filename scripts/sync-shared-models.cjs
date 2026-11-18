#!/usr/bin/env node
/* Replaces the game models the editor embeds verbatim in balance-editor.html with the current game files.
   Each block is <script id="ID">\n…</script>; the content becomes the game file exactly (tests compare them). */
'use strict';
const fs=require('node:fs'),path=require('node:path');
const game=path.resolve(process.env.EMBERWILD_GAME_ROOT||path.join(__dirname,'../../DreamingAbyss')),file=path.join(__dirname,'../balance-editor.html');
const MODELS=[['quest-design-model-v1','js/world/quest-design-model.js'],['companion-passive-model-v1','js/skills/passive-model.js'],['inventory-icon-model-v1','js/ui/inventory-icon-model.js']];
let html=fs.readFileSync(file,'utf8');
for(const [id,rel] of MODELS){
 const src=fs.readFileSync(path.join(game,rel),'utf8'),open=`<script id="${id}">\n`,a=html.indexOf(open);
 if(a<0)throw Error('編輯器找不到內嵌模型：'+id);
 const b=html.indexOf('</script>',a+open.length);if(b<0)throw Error('內嵌模型沒有結尾：'+id);
 html=html.slice(0,a+open.length)+src.replace(/\n?$/,'\n')+html.slice(b);
}
fs.writeFileSync(file,html);console.log('Synchronized shared models: '+MODELS.map(m=>m[0]).join(', '));
