#!/usr/bin/env node
/* Replaces the game models the editor embeds verbatim in balance-editor.html with the current game files.
   Each block is <script id="ID">\n…</script> (or <style>); the content becomes the game file exactly (tests compare them). */
'use strict';
const fs=require('node:fs'),path=require('node:path');
const game=path.resolve(process.env.EMBERWILD_GAME_ROOT||path.join(__dirname,'../../DreamingAbyss')),file=path.join(__dirname,'../balance-editor.html');
// [tag, block id, game file]. Styles are embedded the same way (<style id="ID">\n…</style>).
const MODELS=[['script','quest-design-model-v1','js/world/quest-design-model.js'],['script','companion-passive-model-v1','js/skills/passive-model.js'],['script','inventory-model-v1','js/items/inventory-model.js'],['script','inventory-icon-model-v1','js/ui/inventory-icon-model.js'],
 ['script','lucide-catalog-v1','js/ui/lucide-catalog.js'],['script','skill-icon-library-v1','js/ui/skill-icon-library.js'],['style','skill-icons-shared-style','css/skill-icons.css'],['style','text-rarity-shared-style','css/text-rarity.css'],['script','attack-speed-model','js/combat/attack-speed.js'],['script','seconds-schema-model','js/combat/seconds-schema.js'],['script','shop-catalog-v2','js/items/shop-catalog.js']];
let html=fs.readFileSync(file,'utf8');
for(const [tag,id,rel] of MODELS){
 const src=fs.readFileSync(path.join(game,rel),'utf8'),open=`<${tag} id="${id}">\n`,a=html.indexOf(open);
 if(a<0)throw Error('編輯器找不到內嵌模型：'+id);
 const b=html.indexOf(`</${tag}>`,a+open.length);if(b<0)throw Error('內嵌模型沒有結尾：'+id);
 html=html.slice(0,a+open.length)+src.replace(/\n?$/,'\n')+html.slice(b);
}
fs.writeFileSync(file,html);
// The online build and the combat migration read the seconds schema from scripts/seconds-schema.cjs; keep it the game file.
fs.writeFileSync(path.join(__dirname,'seconds-schema.cjs'),fs.readFileSync(path.join(game,'js/combat/seconds-schema.js'),'utf8'));fs.writeFileSync(path.join(__dirname,'attack-speed.cjs'),fs.readFileSync(path.join(game,'js/combat/attack-speed.js'),'utf8'));console.log('Synchronized shared models: '+MODELS.map(m=>m[1]).join(', '));
