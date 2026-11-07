// GitHub's contents API omits the content of files over 1 MB (encoding "none", content ""). The test branch's
// data/balance.json passed 1 MB, so 取得線上版本 failed with "JSON 檔案格式無效". The snapshot reads the blob instead.
const test=require('node:test'),assert=require('node:assert/strict'),{ReleaseService}=require('../server/release-service.cjs');
function service({blobEncoding='base64'}={}){
 const data={schemaVersion:1,filler:'x'.repeat(1100000)},blob='b'.repeat(40),calls=[];
 const api=async p=>{calls.push(p);
  if(p.includes('/git/ref/heads/'))return {object:{sha:'a'.repeat(40)}};
  if(p.includes('/contents/data/balance.json'))return {type:'file',encoding:'none',content:'',size:1165818,sha:blob};
  if(p.endsWith('/git/blobs/'+blob))return {sha:blob,encoding:blobEncoding,content:Buffer.from(JSON.stringify(data)).toString('base64'),size:1165818};
  throw Error('Unexpected '+p);};
 return {calls,data,blob,s:new ReleaseService({api,validate:d=>d})};
}
test('a balance.json over 1 MB is read through the Git blob API',async()=>{
 const {s,calls,data,blob}=service(),out=await s.snapshot({branch:'chatgpt-dev'});
 assert.deepEqual(out.data,data);assert.equal(out.blob,blob);
 assert(calls.some(p=>p==='/repos/Horios/DreamingAbyss/git/blobs/'+blob),'the blob of the same file is read');
});
test('an unreadable blob is still refused',async()=>{
 const {s}=service({blobEncoding:'utf-8'});await assert.rejects(()=>s.snapshot({branch:'chatgpt-dev'}),/JSON 檔案格式無效/);
});
