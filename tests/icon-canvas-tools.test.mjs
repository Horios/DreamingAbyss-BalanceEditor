import test from 'node:test';import assert from 'node:assert/strict';import {createGameValidator} from '../server/online/game-validator.mjs';import {createRequire} from 'node:module';const require=createRequire(import.meta.url);
const {loadRuntime}=require('./headless-editor.cjs');
test('editor and deployed validator retain curve, fill and eraser parameters through JSON',()=>{
 const e=loadRuntime(process.cwd());e.run(`data.skillIcons.push({id:'canvas',name:'畫布',layers:[{kind:'curve',x:0,y:0,rotation:20,x1:-12,y1:0,cx:0,cy:-16,x2:12,y2:0,strokeWidth:3,tone:'ember',eraseStrokes:[{width:2,points:[[0,0],[2,2]]}]},{kind:'icon',icon:'fire',x:0,y:0,rotation:0,scale:1,filled:true,fillTone:'ember'}]});ensureArrays();`);
 const doc=JSON.parse(e.run('JSON.stringify(__EMBERWILD_RELEASE_EDITOR.current())')),v=createGameValidator(),saved=v.validate(doc);assert.deepEqual(saved.skillIcons,doc.skillIcons);
 e.ctx.input=structuredClone(saved);e.run('data=input;ensureArrays();currentSection="iconMaker";render();');assert.deepEqual(JSON.parse(e.run('JSON.stringify(data.skillIcons)')),saved.skillIcons);
 const html=e.elements.get('app').innerHTML;for(const tool of ['fill','erase','line','curve','rotate'])assert(html.includes('data-canvas-tool="'+tool+'"'));assert(html.includes('iconLayerUndo'));assert.deepEqual(e.errors,[]);
});
test('release validation rejects invalid eraser data and unbounded curve coordinates',()=>{
 const v=createGameValidator(),d=structuredClone(v.defaults),l={kind:'curve',x:0,y:0,rotation:0,x1:-12,y1:0,cx:0,cy:-16,x2:12,y2:0,strokeWidth:3,tone:'neutral'};d.skillIcons=[{id:'canvas',name:'畫布',layers:[l]}];assert.doesNotThrow(()=>v.validate(d));l.cx=999;assert.throws(()=>v.validate(d),/圖示圖層/);l.cx=0;l.eraseStrokes=[{width:3,points:[[999,0]]}];assert.throws(()=>v.validate(d),/圖示圖層/);
});
