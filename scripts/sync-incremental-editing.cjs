/* Embed the shared balance module model (copied from the game) and the incremental editing controls last in
   the single-file editor, after every markDirty wrapper. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),game=path.resolve(process.env.EMBERWILD_GAME_ROOT||path.join(root,'../DreamingAbyss'));
const gameModel=path.join(game,'js/balance/balance-modules.js'),vendored=path.join(root,'scripts/balance-modules.cjs');
if(fs.existsSync(gameModel))fs.copyFileSync(gameModel,vendored);
const model=fs.readFileSync(vendored,'utf8'),controls=fs.readFileSync(path.join(root,'scripts/incremental-editing.js'),'utf8');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
// The model loads before the workspace boot (it can restore a draft stored by module); the controls load last.
const modelBlock='<!-- balance-modules-model:start -->\n<script id="balance-modules-model" data-sha256="'+sha(model)+'">\n'+model+'\n</script>\n<!-- balance-modules-model:end -->\n';
const block='<!-- balance-modules:start -->\n<script id="incremental-editing">\n'+controls+'\n</script>\n<!-- balance-modules:end -->';
const file=path.join(root,'balance-editor.html');let html=fs.readFileSync(file,'utf8');
html=html.replace(/<!-- balance-modules-model:start -->[\s\S]*?<!-- balance-modules-model:end -->\n/,'');
html=html.replace(/\n?<!-- balance-modules:start -->[\s\S]*?<!-- balance-modules:end -->\n?/,'');
const boot=html.indexOf('const ORIGINAL_B64'),tag=html.lastIndexOf('<script',boot);
if(boot<0||tag<0)throw Error('找不到工作區啟動程式');
html=html.slice(0,tag)+modelBlock+html.slice(tag);
html+='\n'+block+'\n';
fs.writeFileSync(file,html);
fs.writeFileSync(path.join(root,'docs/balance-modules-provenance.json'),JSON.stringify({source:'Horios/DreamingAbyss:js/balance/balance-modules.js',gameCommit:process.env.EMBERWILD_GAME_COMMIT||null,sha256:sha(model)},null,2)+'\n');
console.log('Synchronized balance modules model and incremental editing controls');
