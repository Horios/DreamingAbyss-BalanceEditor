const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),file=path.join(root,'balance-editor.html');
const game=path.resolve(process.env.EMBERWILD_GAME_ROOT||path.join(root,'../DreamingAbyss'));
fs.copyFileSync(path.join(game,'js/combat/seconds-schema.js'),path.join(root,'scripts/seconds-schema.cjs'));
let html=fs.readFileSync(file,'utf8');
for(const id of ['combat-migration-model','combat-migration-editor','seconds-schema-model'])html=html.replace(new RegExp('\\n?<script id="'+id+'">[\\s\\S]*?<\\/script>\\n?','g'),'\n');
const model=fs.readFileSync(path.join(__dirname,'combat-migration-audit.cjs'),'utf8');
const schema=fs.readFileSync(path.join(root,'scripts/seconds-schema.cjs'),'utf8');
html=html.replace('<script','<script id="seconds-schema-model">\n'+schema+'\n</script>\n<script id="combat-migration-model">\n'+model+'\n</script>\n<script');
html=html.replace('function checked(input){const d=M.migrate(input,ORIGINAL_DATA)',
 'function checked(input){EmberwildCombatMigration.assertSupported(input);const d=M.migrate(input,ORIGINAL_DATA)');
const marker='function normalizeTurnUnitsInPlace(obj){';
const guard='\n    if(globalThis.EmberwildCombatMigration?.unsupportedPaths(obj).length)return obj;';
if(!html.includes(marker+guard))html=html.replace(marker,marker+guard);
html=html.trimEnd()+'\n<script id="combat-migration-editor">\n'+fs.readFileSync(path.join(__dirname,'combat-migration-editor.js'),'utf8')+'\n</script>\n';
fs.writeFileSync(file,html);
console.log('Synchronized read-only seconds/MP audit and pre-migration guards');
