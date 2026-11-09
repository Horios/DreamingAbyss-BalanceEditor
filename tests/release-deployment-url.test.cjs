// After the rename, GitHub Pages serves the game at horios.github.io/DreamingAbyss/. The deployment check reads
// data/build.json from there; the old /Emberwild/ address left every publish at 等待部署.
const test=require('node:test'),assert=require('node:assert/strict'),{ReleaseService}=require('../server/release-service.cjs');
test('deployment status reads build.json from the renamed Pages site',async()=>{
 const commit='c'.repeat(40),blob='b'.repeat(40),seen=[],realFetch=globalThis.fetch;
 const s=new ReleaseService({validate:d=>d,api:async p=>{if(p.includes('/contents/data/balance/manifest.json'))throw Object.assign(Error('Not Found'),{status:404});if(p.includes('/contents/data/balance.json'))return {type:'file',encoding:'base64',sha:blob,content:Buffer.from('{}').toString('base64')};if(p.includes('/git/ref/heads/'))return {object:{sha:commit}};throw Error('Unexpected '+p);}});
 globalThis.fetch=async url=>{seen.push(String(url));return {ok:true,json:async()=>({branch:'chatgpt-dev',commit,balanceBlob:blob})};};
 try{
  const out=await s.deployment({branch:'chatgpt-dev',commit});
  assert.equal(out.state,'部署成功');assert.equal(out.url,'https://horios.github.io/DreamingAbyss/preview/');
  assert.match(seen[0],/^https:\/\/horios\.github\.io\/DreamingAbyss\/preview\/data\/build\.json\?v=/);
 }finally{globalThis.fetch=realFetch;}
});
