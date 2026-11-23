const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),out=path.join(root,'server/online');
const doc=fs.readFileSync(path.join(root,'server/balance-diff.cjs'),'utf8');
// The attack speed module registers itself on globalThis, where the seconds schema looks it up (game v0.196).
const secondsSchema=fs.readFileSync(path.join(root,'scripts/attack-speed.cjs'),'utf8')+'\n'+fs.readFileSync(path.join(root,'scripts/seconds-schema.cjs'),'utf8').replace('})(globalThis,','})(root,');
const combatMigration=fs.readFileSync(path.join(root,'scripts/combat-migration-audit.cjs'),'utf8');
let service=fs.readFileSync(path.join(root,'server/release-service.cjs'),'utf8').replace(",M=require('../scripts/balance-modules.cjs');",';');
service=service.replace("'use strict';\nconst crypto=require('node:crypto'),D=require('./balance-diff.cjs'),CM=require('../scripts/combat-migration-audit.cjs');", "import {randomToken,digest,decodeGitContent} from './github-app.mjs';\nconst root={};\n"+doc.replace(/\}\)\(globalThis\);\s*$/, '})(root);')+secondsSchema+combatMigration.replace(/\}\)\(globalThis\);\s*$/, '})(root);')+"\nconst D=root.EmberwildBalanceDiff,CM=root.EmberwildCombatMigration;");
service=service.replaceAll("Buffer.from(source.content.replace(/\\s/g,''),'base64').toString('utf8')",'decodeGitContent(source.content)').replaceAll("Buffer.from(f.content.replace(/\\s/g,''),'base64').toString('utf8')",'decodeGitContent(f.content)');
service=service.replace("crypto.randomBytes(32).toString('hex')",'randomToken()').replace("crypto.createHash('sha256').update(D.stable(candidate)).digest('hex').slice(0,12)","(await digest(D.stable(candidate))).slice(0,12)");
const modules=fs.readFileSync(path.join(root,'scripts/balance-modules.cjs'),'utf8');
service=service.replace("const D=root.EmberwildBalanceDiff,CM=root.EmberwildCombatMigration;","const D=root.EmberwildBalanceDiff,CM=root.EmberwildCombatMigration;\n"+modules.replace(/\}\)\(typeof globalThis!=='undefined'\?globalThis:this\);\s*$/,'})(root);')+"\nconst M=root.EmberwildBalanceModules;");
service=service.replace("async sha256(text){return crypto.createHash('sha256').update(text).digest('hex');}","async sha256(text){return digest(text);}");
service=service.replace("async gitBlobSha(text){return crypto.createHash('sha1').update('blob '+utf8Length(text)+'\\0').update(text).digest('hex');}","async gitBlobSha(text){const b=new TextEncoder().encode(text),h=new TextEncoder().encode('blob '+b.length+'\\0'),all=new Uint8Array(h.length+b.length);all.set(h);all.set(b,h.length);return [...new Uint8Array(await crypto.subtle.digest('SHA-1',all))].map(n=>n.toString(16).padStart(2,'0')).join('');}");
service=service.replace('module.exports={ReleaseService};','export {ReleaseService};');
fs.writeFileSync(path.join(out,'release-service.mjs'),service);
const provenance=JSON.parse(fs.readFileSync(path.join(out,'runtime-provenance.json')));
fs.writeFileSync(path.join(out,'editor.mjs'),'export const editorHTML='+JSON.stringify(fs.readFileSync(path.join(root,'balance-editor.html'),'utf8'))+';\nexport const validatorCommit='+JSON.stringify(provenance.sourceCommit)+';\nexport const contractBlobs='+JSON.stringify(Object.fromEntries((provenance.contract||[]).map(c=>[c.path,c.gitBlob])))+';\n');
console.log('Built online release module and private editor HTML');
