const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {ReleaseService}=require('../server/release-service.cjs');
test('expanded life designs cannot be promoted or restored into an older production engine',async()=>{
 const head='a'.repeat(40),source='b'.repeat(40);let upgraded=false;const calls=[],data={lifeSkills:{gathering:[]},value:2};
 const s=new ReleaseService({validate:x=>x,api:async p=>{calls.push(p);if(p.includes('/git/ref/heads/'))return {object:{sha:p.endsWith('main')?head:source}};if(p.includes('/compare/'))return {status:'ahead'};if(p.includes('/contents/js/')){assert(p.endsWith('ref='+head));return {type:'file',encoding:'base64',content:Buffer.from(upgraded?fs.readFileSync('server/online/game-validator.mjs'):'const api={VERSION:1};').toString('base64')};}return {type:'file',encoding:'base64',sha:head,content:Buffer.from(JSON.stringify(p.endsWith('ref='+head)?{value:1}:data)).toString('base64')};}});
 const args={kind:'promote',sourceCommit:source,expectedCommit:head,message:'發布採集煉金設定'};
 await assert.rejects(()=>s.prepare(args,'s'),/正式版程式尚未支援/);assert.equal(s.tickets.size,0);
 await assert.rejects(()=>s.prepare({...args,kind:'restore',branch:'main',restoreCommit:source},'s'),/正式版程式尚未支援/);assert.equal(s.tickets.size,0);assert(!calls.some(p=>p.endsWith('/git/blobs')));
 upgraded=true;const out=await s.prepare(args,'s');assert.equal(out.branch,'main');assert.equal(s.tickets.size,1);
});
test('inventory icon publication requires production icon runtime support',async()=>{
 const head='a'.repeat(40),source='b'.repeat(40);let upgraded=false;const data={inventoryIcons:[{kind:'material',key:'紅色草',iconType:'lucide:leaf'}]};
 const s=new ReleaseService({validate:x=>x,api:async p=>{if(p.includes('/git/ref/heads/'))return {object:{sha:p.endsWith('main')?head:source}};if(p.includes('/compare/'))return {status:'ahead'};if(p.includes('/contents/js/'))return {type:'file',encoding:'base64',content:Buffer.from(upgraded?'const api={inventoryIconsVersion:1};':'const api={lifeProductsVersion:1};').toString('base64')};return {type:'file',encoding:'base64',sha:head,content:Buffer.from(JSON.stringify(p.endsWith('ref='+head)?{}:data)).toString('base64')};}});
 const args={kind:'promote',sourceCommit:source,expectedCommit:head,message:'發布素材圖示設定'};await assert.rejects(s.prepare(args,'s'),/正式版程式尚未支援道具圖示/);assert.equal(s.tickets.size,0);upgraded=true;assert.equal((await s.prepare(args,'s')).branch,'main');
});
test('direct colors and equipment icons require the upgraded production presentation contract',async()=>{
 const head='a'.repeat(40),source='b'.repeat(40);let version=1;const data={inventoryIcons:[{kind:'material',key:'紅色草',iconType:'auto',color:'#123abc'}]};
 const s=new ReleaseService({validate:x=>x,api:async p=>{if(p.includes('/git/ref/heads/'))return {object:{sha:p.endsWith('main')?head:source}};if(p.includes('/compare/'))return {status:'ahead'};if(p.includes('/contents/js/'))return {type:'file',encoding:'base64',content:Buffer.from('const api={inventoryIconsVersion:'+version+'};').toString('base64')};return {type:'file',encoding:'base64',sha:head,content:Buffer.from(JSON.stringify(p.endsWith('ref='+head)?{}:data)).toString('base64')};}});
 const args={kind:'promote',sourceCommit:source,expectedCommit:head,message:'發布直接圖示顏色'};await assert.rejects(s.prepare(args,'s'),/正式版程式尚未支援道具圖示/);version=2;assert.equal((await s.prepare(args,'s')).branch,'main');
});
test('named color templates cannot be promoted to an engine that only supports individual icon colors',async()=>{
 const head='a'.repeat(40),source='b'.repeat(40);let supported=false;const data={iconColorTemplates:[{id:'shared',name:'共用色',color:'#123abc'}]};
 const s=new ReleaseService({validate:x=>x,api:async p=>{if(p.includes('/git/ref/heads/'))return {object:{sha:p.endsWith('main')?head:source}};if(p.includes('/compare/'))return {status:'ahead'};if(p.includes('/contents/js/'))return {type:'file',encoding:'base64',content:Buffer.from('const api={inventoryIconsVersion:2'+(supported?',iconColorTemplatesVersion:1':'')+'};').toString('base64')};return {type:'file',encoding:'base64',sha:head,content:Buffer.from(JSON.stringify(p.endsWith('ref='+head)?{}:data)).toString('base64')};}});
 const args={kind:'promote',sourceCommit:source,expectedCommit:head,message:'套用共用色彩模板'};await assert.rejects(s.prepare(args,'s'),/正式版程式尚未支援色彩模板/);supported=true;assert.equal((await s.prepare(args,'s')).branch,'main');
});
