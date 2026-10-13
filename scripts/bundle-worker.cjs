const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),files=['github-app.mjs','connect.mjs','tickets.mjs','game-validator.mjs','editor.mjs','release-service.mjs','worker.mjs'];
const text=files.map(file=>{let src=fs.readFileSync(path.join(root,'server/online',file),'utf8');src=src.replace(/^import .*?;\s*$/gm,'').replace(/^export \{[^}]*\};?\s*$/gm,'').replace(/\bexport (const|function|class) /g,'$1 ');return '/* '+file+' */\n'+src;}).join('\n');
fs.mkdirSync(path.join(root,'worker'),{recursive:true});fs.writeFileSync(path.join(root,'worker/index.js'),text);
console.log('Bundled private Worker ('+Buffer.byteLength(text)+' bytes)');
