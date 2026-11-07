// The game repository was renamed to Horios/DreamingAbyss. Requests must use the new name, and a refused
// installation token must not be reported as "線上版本已更新".
import test from 'node:test';import assert from 'node:assert/strict';import {generateKeyPairSync} from 'node:crypto';
import {createHostedGithubApp,REPOSITORY,REPOSITORY_PATH} from '../server/online/github-app.mjs';
const pem=generateKeyPairSync('rsa',{modulusLength:2048}).privateKey.export({type:'pkcs8',format:'pem'});
const env={EMBERWILD_GITHUB_APP_ID:'1',EMBERWILD_GITHUB_INSTALLATION_ID:'2',EMBERWILD_GITHUB_PRIVATE_KEY:pem};
test('the hosted App targets Horios/DreamingAbyss and refuses the old name',async()=>{
 assert.equal(REPOSITORY,'Horios/DreamingAbyss');assert.equal(REPOSITORY_PATH,'/repos/Horios/DreamingAbyss');
 const calls=[];const api=createHostedGithubApp(env,{fetchImpl:async(url,opts)=>{calls.push({url,body:opts.body});return url.endsWith('/access_tokens')?{ok:true,status:201,json:async()=>({token:'t',expires_at:new Date(Date.now()+3600000).toISOString()})}:{ok:true,status:200,json:async()=>({full_name:REPOSITORY})};}});
 assert.equal((await api(REPOSITORY_PATH)).full_name,REPOSITORY);
 assert.deepEqual(JSON.parse(calls[0].body).repositories,['DreamingAbyss'],'the token is requested for the renamed repository');
 await assert.rejects(()=>api('/repos/Horios/Emberwild/contents/data/balance.json'),/不允許此 GitHub 目標/);
});
test('a refused installation token explains the App installation instead of a stale version',async()=>{
 for(const status of [403,422]){
  const api=createHostedGithubApp(env,{fetchImpl:async url=>url.endsWith('/access_tokens')?{ok:false,status,json:async()=>({})}:assert.fail('no repository call without a token')});
  await assert.rejects(()=>api(REPOSITORY_PATH+'/branches/chatgpt-dev'),e=>/無法取得 GitHub 存取權杖/.test(e.message)&&/Horios\/DreamingAbyss/.test(e.message)&&!/線上版本已更新/.test(e.message));
 }
});
