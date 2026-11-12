/* Embed the game's story contract (which carries the prologue rules) and the 序章劇情 editor in the single-file editor.
   Usage: EMBERWILD_GAME_ROOT=/path/to/DreamingAbyss node scripts/sync-prologue.cjs */
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),game=path.resolve(process.env.EMBERWILD_GAME_ROOT||path.join(root,'../DreamingAbyss'));
const model=fs.readFileSync(path.join(game,'js/story/story-model.js'),'utf8').trimEnd();
const controls=fs.readFileSync(path.join(root,'scripts/prologue-editor.js'),'utf8').trimEnd();
const file=path.join(root,'balance-editor.html');let html=fs.readFileSync(file,'utf8');
const modelBlock=/(<script id="story-model-v1">\n)[\s\S]*?(\n<\/script>)/;
if(!modelBlock.test(html))throw Error('找不到 story-model-v1');
html=html.replace(modelBlock,(_,open,close)=>open+model+close);
// The built-in story seed (used when a document has no story yet) follows the game's published story, prologue included.
const seed=/(<script id="story-seed-v1">const STORY_SEED=)[\s\S]*?(;<\/script>)/,story=JSON.parse(fs.readFileSync(path.join(game,'data/balance.json'),'utf8')).story;
if(!seed.test(html))throw Error('找不到 story-seed-v1');
html=html.replace(seed,(_,open,close)=>open+JSON.stringify(story).replace(/</g,'\\u003c')+close);
html=html.replace(/\n?<!-- prologue-editor:start -->[\s\S]*?<!-- prologue-editor:end -->\n?/,'\n');
const style='.prologue-scenes{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}.prologue-fields{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px;margin:10px 0}.prologue-fields label,.prologue-stage label{display:flex;flex-direction:column;gap:5px}.prologue-stage{border:1px solid var(--line);border-radius:8px;padding:12px;margin:12px 0}.prologue-stage h3{margin:0 0 6px}.prologue-stage h3 small{font-weight:400;opacity:.6}.prologue-event{display:inline-block;margin:0 0 8px;padding:4px 10px;border:1px dashed var(--line);border-radius:999px}.prologue-lines{margin:12px 0}.prologue-line{display:grid;gap:6px;margin:8px 0;padding:8px;border-left:3px solid #8a93a8;background:rgba(255,255,255,.03)}.prologue-line-original{border-left-color:#e0bd79}.prologue-line-meta{display:grid;grid-template-columns:110px minmax(0,1fr) 130px;gap:6px}.prologue-line textarea,.prologue-fields textarea,.prologue-fields input{width:100%;box-sizing:border-box}.prologue-option-edit{display:grid;gap:6px}.prologue-preview ol{padding-left:22px;line-height:1.9}.prologue-preview-scene{list-style:none;margin:10px 0 4px -22px}.prologue-preview-event{list-style:none;margin-left:-22px;opacity:.75}.prologue-preview-narrator{font-style:italic}.prologue-errors ul{margin:6px 0 0}';
const block='<!-- prologue-editor:start -->\n<style id="prologue-editor-style">'+style+'</style>\n<script id="prologue-editor-v1">\n'+controls+'\n</script>\n<!-- prologue-editor:end -->';
// Fixed position: right after the story designer it builds on, before the modules that snapshot the document.
const anchor=/(<script id="story-editor-v1">[\s\S]*?<\/script>\n)/;
if(!anchor.test(html))throw Error('找不到 story-editor-v1');
html=html.replace(anchor,(_,story)=>story+block+'\n');
fs.writeFileSync(file,html);
console.log('Synchronized story contract and prologue editor');
