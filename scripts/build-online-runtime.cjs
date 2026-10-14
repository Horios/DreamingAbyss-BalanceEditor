/* Compile the existing game scripts into a static, isolated validator. No runtime eval. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const game=path.resolve(process.env.EMBERWILD_GAME_ROOT||path.join(__dirname,'../../Emberwild'));
const html=fs.readFileSync(path.join(game,'index.html'),'utf8');
const scripts=[];
for(const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){
 const src=m[1].match(/(?:\bsrc|data-balance-src)="([^"]+)"/)?.[1];
 if(src&&/startup-guard|published-loader/.test(src))continue;
 scripts.push({file:src||'inline',code:src?fs.readFileSync(path.join(game,src.split('?')[0]),'utf8'):m[2]});
}
const acornModule={exports:{}};
new Function('module','exports',process.binding('natives')['internal/deps/acorn/acorn/dist/acorn'])(acornModule,acornModule.exports);
const declared=new Set(),constants=new Set();
for(const s of scripts){const ast=acornModule.exports.parse(s.code,{ecmaVersion:'latest',sourceType:'script'});for(const n of ast.body){if(n.type==='FunctionDeclaration')declared.add(n.id.name);if(n.type==='VariableDeclaration')for(const d of n.declarations)if(d.id.type==='Identifier'){declared.add(d.id.name);if(n.kind==='const')constants.add(d.id.name);}}}
const properties=new Set();
for(const s of scripts)for(const m of s.code.matchAll(/(?:globalThis|root|window)\.([A-Za-z_$][\w$]*)/g))properties.add(m[1]);
const harness=fs.readFileSync(path.join(game,'tests/headless-runtime.cjs'),'utf8');
const element=harness.slice(harness.indexOf('class Element'),harness.indexOf('function loadRuntime'));
const reserved=new Set(['window','self','globalThis','document','location','navigator','console','crypto','Date','addEventListener','removeEventListener']);
const props=[...properties].filter(n=>!reserved.has(n));
const prelude=`
 const globalThis={},window=globalThis,self=globalThis;
 ${element}
 const elements=new Map(),values=new Map(),node=id=>{if(!elements.has(id))elements.set(id,new Element(id));return elements.get(id);};
 const document={getElementById:node,querySelector:s=>s.startsWith('#')&&!/[ >]/.test(s)?node(s.slice(1)):null,querySelectorAll:()=>[],createElement:()=>new Element(),addEventListener(){},removeEventListener(){},body:new Element('body'),head:new Element('head'),documentElement:new Element('html'),activeElement:null,readyState:'complete'};
 const localStorage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k),clear:()=>values.clear()},sessionStorage={getItem:()=>null,setItem(){},removeItem(){}};
 const location={href:'http://emberwild.test/',origin:'http://emberwild.test',pathname:'/',hash:'',search:'',reload(){}},navigator={userAgent:'release-validator'},console={log(){},warn(){},error(){}};
 const HTMLElement=Element,HTMLDialogElement=Element,HTMLInputElement=Element,HTMLSelectElement=Element,HTMLTextAreaElement=Element;
 const MutationObserver=class{observe(){}disconnect(){}},ResizeObserver=MutationObserver;
 let seq=0;const setTimeout=()=>++seq,clearTimeout=()=>{},setInterval=()=>++seq,clearInterval=()=>{},requestAnimationFrame=()=>++seq,cancelAnimationFrame=()=>{},queueMicrotask=()=>{},addEventListener=()=>{},removeEventListener=()=>{},matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}}),getComputedStyle=()=>({lineHeight:'20px',fontSize:'16px',getPropertyValue:()=>''}),performance={now:()=>0},crypto={randomUUID:()=>String(++seq)},innerWidth=1440,innerHeight=900,scrollX=0,scrollY=0,alert=()=>{},confirm=()=>true,prompt=()=>null;
 Object.assign(globalThis,{document,localStorage,sessionStorage,location,navigator,crypto,window,self,addEventListener,removeEventListener,setTimeout,clearTimeout,setInterval,clearInterval,requestAnimationFrame,cancelAnimationFrame,matchMedia,getComputedStyle,performance});
 var ${props.filter(n=>!declared.has(n)).join(',')};
`;
const compiled='export function createGameValidator(){\n'+prelude+scripts.map(s=>'\n/* '+s.file+' */\n'+s.code+'\n'+props.filter(n=>!constants.has(n)).filter(n=>s.code.includes('globalThis.'+n)||s.code.includes('root.'+n)||s.code.includes('window.'+n)).map(n=>`${n}=globalThis.${n}??${n};`).join('')).join('\n')+`\nconst defaults=exportableBalance();return {defaults,canonicalize(input){return EmberwildInventoryIcons.migrateDescriptions(validateBalanceConfig(EmberwildBalanceDocument.validate(input,validateBalanceConfig,defaults)));},validate(input){const document=EmberwildBalanceDocument.validate(input,validateBalanceConfig,defaults);validateBalanceConfig(structuredClone(document));return EmberwildInventoryIcons.migrateDescriptions(document);}};\n}\n`;
const output=path.join(__dirname,'../server/online/game-validator.mjs');
fs.writeFileSync(output,compiled);
fs.writeFileSync(path.join(__dirname,'../server/online/runtime-provenance.json'),JSON.stringify({sourceRepository:'Horios/Emberwild',sourceCommit:process.env.EMBERWILD_GAME_COMMIT||require('node:child_process').execFileSync('git',['-C',game,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),files:scripts.map(s=>({path:s.file,sha256:crypto.createHash('sha256').update(s.code).digest('hex')}))},null,2)+'\n');
console.log('Compiled '+scripts.length+' game scripts ('+Buffer.byteLength(compiled)+' bytes)');
