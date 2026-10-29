/* Embed the canonical game draw and editor controls in the single-file editor. */
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),game=path.resolve(process.env.EMBERWILD_GAME_ROOT||path.join(root,'../game'));
const model=fs.readFileSync(path.join(game,'js/world/wishing-lake-model.js'),'utf8');
const controls=fs.readFileSync(path.join(root,'scripts/wishing-lake-editor.js'),'utf8');
const block='<!-- wishing-lake:start -->\n<style>.lake-editor-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px;margin:12px 0}.lake-editor-grid label,.lake-editor-table label{display:flex;flex-direction:column;gap:5px}.lake-editor-table{overflow:auto}.lake-editor-table table{min-width:760px;width:100%}.lake-editor-table td{vertical-align:top;padding:10px}.lake-editor-table input,.lake-editor-table select{max-width:260px;width:100%}.lake-editor-grid textarea{min-width:0}.lake-editor-grid input[type=checkbox],.lake-editor-table input[type=checkbox]{width:auto;align-self:start}</style>\n<script id="wishing-lake-model">\n'+model+'\n</script>\n<script id="wishing-lake-editor">\n'+controls+'\n</script>\n<!-- wishing-lake:end -->';
const file=path.join(root,'balance-editor.html');let html=fs.readFileSync(file,'utf8');
html=html.replace(/\n?<!-- wishing-lake:start -->[\s\S]*?<!-- wishing-lake:end -->\n?/,'');
html+='\n'+block+'\n';
fs.writeFileSync(file,html);
console.log('Synchronized lake draw and management controls');
