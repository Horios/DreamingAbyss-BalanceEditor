const test=require('node:test'),assert=require('node:assert/strict');
const {shapes,analyzeHTML,differences,temporal}=require('../scripts/audit-v2.cjs');
test('field inventory unions heterogeneous records without losing optional or unknown keys',()=>{
 const input={rows:[{id:'a',timing:{mpCost:1}},{id:'b',extra:3,timing:{mpCost:null}}],empty:[],nested:[[{newField:true}]]},before=JSON.stringify(input);
 const rows=shapes(input),get=p=>rows.find(x=>x.path===p);
 assert.deepEqual(get('rows[].timing.mpCost').types,['null','number']);
 assert.equal(get('rows[].extra').observedOptional,true);
 assert.equal(get('rows[].extra').parentObjectCount,2);
 assert.equal(get('rows[].timing').observedOptional,false);
 assert(get('empty'));assert(get('nested[][].newField'));
 assert.equal(JSON.stringify(input),before);
});
test('source inventory retains literal/dynamic selectors, wrappers and cross-script candidates',()=>{
 const m=analyzeHTML('<script id="core">globalThis.Core={};function load(){return data.rows[i].timing.mpCost;}</script><script id="ui">render=function(){Core.read();document.getElementById("cost").onclick=save;document.querySelector(selector);};</script>');
 assert(m[0].dataReferences.some(x=>x.path==='rows[].timing.mpCost'));
 assert.deepEqual(m[1].dependencyCandidates,['core']);
 assert(m[1].dom.some(x=>x.selector==='cost'&&!x.dynamic));
 assert(m[1].dom.some(x=>x.dynamic));assert.equal(m[1].wrappers[0].name,'render');
});
test('full round-trip diff includes metadata and temporal roles do not mislabel class base stats',()=>{
 assert.deepEqual(differences({_reference:{x:1},notes:'a'},{_reference:{x:2},notes:'b'}).map(x=>x.path),['_reference.x','notes']);
 assert.equal(temporal('classes[].base.hp'),'other');
 assert.equal(temporal('classes[].skills[].cooldown'),'compatibility-projection-or-adapter');
 assert.equal(temporal('skillSystem.definitions[].timing.mpCost'),'canonical-seconds-or-resource');
});
