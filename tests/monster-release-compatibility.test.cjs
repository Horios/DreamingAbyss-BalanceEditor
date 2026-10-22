const test=require('node:test'),assert=require('node:assert/strict');
const {ReleaseService}=require('../server/release-service.cjs');
test('new monster designs cannot target an older production or preview runtime',async()=>{
 let supported=false,reads=0;const s=new ReleaseService({validate:x=>x,api:async p=>{reads++;assert(p.endsWith('ref='+'a'.repeat(40)));return {type:'file',encoding:'base64',content:Buffer.from(supported?'const api={monsterDesignVersion:1};':'const api={inventoryIconsVersion:2};').toString('base64')};}});
 const candidates=[{balanceSettings:{maps:{catalog:[{name:'測試',mapType:'normal',bossStageMode:'random'}]},monsters:{catalog:[{mapIndex:0,kind:'boss'}]}}},{balanceSettings:{monsters:{catalog:[{kind:'elite'}]}}},{balanceSettings:{drops:{entries:[{type:'equipment',key:'form:0:0:0'}]}}},{balanceSettings:{monsters:{catalog:[{kind:'normal',baseStats:{hp:123,attack:0,defense:-1}}]}}}];
 for(const branch of ['main','chatgpt-dev'])for(const doc of candidates)await assert.rejects(s.requireMonsterRuntime({branch,commit:'a'.repeat(40)},doc),/目標遊戲程式尚未支援/);
 supported=true;for(const doc of candidates)await s.requireMonsterRuntime({branch:'main',commit:'a'.repeat(40)},doc);
 const before=reads;await s.requireMonsterRuntime({branch:'main',commit:'a'.repeat(40)},{balanceSettings:{monsters:{catalog:[{kind:'normal',baseStats:{hp:0,attack:0,defense:-1}}]}}});assert.equal(reads,before);
});
