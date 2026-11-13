/* Embed the game's tutorial contract and the 教學管理 editor in the single-file editor.
   Usage: EMBERWILD_GAME_ROOT=/path/to/DreamingAbyss node scripts/sync-tutorials.cjs */
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),game=path.resolve(process.env.EMBERWILD_GAME_ROOT||path.join(root,'../DreamingAbyss'));
const model=fs.readFileSync(path.join(game,'js/story/tutorial-model.js'),'utf8').trimEnd();
const controls=fs.readFileSync(path.join(root,'scripts/tutorial-editor.js'),'utf8').trimEnd();
const file=path.join(root,'balance-editor.html');let html=fs.readFileSync(file,'utf8');
html=html.replace(/\n?<!-- tutorial-editor:start -->[\s\S]*?<!-- tutorial-editor:end -->\n?/,'\n');
const style='.tutorial-table{overflow:auto}.tutorial-table table{width:100%;min-width:760px}.tutorial-table tr.selected{background:rgba(223,193,139,.12)}.tutorial-table td{vertical-align:top;padding:8px}.tutorial-table .actions{display:flex;flex-wrap:wrap;gap:4px;margin:0}.tutorial-edit,.tutorial-test{border:1px solid var(--line);border-radius:8px;padding:12px;margin:14px 0}.tutorial-edit h2 small{font-weight:400;opacity:.6}.tutorial-fields{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;margin:10px 0}.tutorial-fields label,.tutorial-edit>label,.tutorial-step>label,.tutorial-condition label{display:flex;flex-direction:column;gap:4px}.tutorial-edit textarea,.tutorial-step textarea{width:100%;box-sizing:border-box}.tutorial-flags{display:flex;flex-wrap:wrap;gap:14px;margin:8px 0}.tutorial-check{display:flex!important;flex-direction:row!important;align-items:center;gap:6px}.tutorial-group{border:1px solid var(--line);border-radius:6px;margin:10px 0;padding:8px 10px}.tutorial-condition{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;align-items:end;margin:6px 0;padding:6px;background:rgba(255,255,255,.03);border-radius:6px}.tutorial-step{border-left:3px solid #8a93a8;padding:8px 10px;margin:10px 0;background:rgba(255,255,255,.03)}.tutorial-step-head{display:flex;flex-wrap:wrap;justify-content:space-between;gap:8px;align-items:center}.tutorial-step-head .actions{display:flex;flex-wrap:wrap;gap:4px;margin:0}.tutorial-test .actions{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:8px 0}.tutorial-test-status{display:grid;grid-template-columns:max-content 1fr;gap:4px 12px}.tutorial-test-status dt{opacity:.7}.tutorial-test-status dd{margin:0}.tutorial-met{color:#8cd5bc}.tutorial-unmet{color:#efb48a}';
const block='<!-- tutorial-editor:start -->\n<style id="tutorial-editor-style">'+style+'</style>\n<script id="tutorial-model-v1">\n'+model+'\n</script>\n<script id="tutorial-editor-v1">\n'+controls+'\n</script>\n<!-- tutorial-editor:end -->';
// Right after the prologue editor, which shares the 任務與劇情 navigation group.
const anchor=/(<!-- prologue-editor:end -->\n)/;
if(!anchor.test(html))throw Error('找不到 prologue-editor:end');
html=html.replace(anchor,(_,a)=>a+block+'\n');
fs.writeFileSync(file,html);
console.log('Synchronized tutorial contract and editor');
