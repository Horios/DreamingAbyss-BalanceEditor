import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {createWorker} from '../server/online/worker.mjs';
const worker=createWorker(),root=path.resolve(import.meta.dirname,'..');
const request=(url,user)=>new Request('https://private.test'+url,{headers:user?{'oai-authenticated-user-id':user}:{}});
test('V2 game and editor routes stay behind the existing private identity boundary',async()=>{
 for(const url of ['/v2','/v2-editor','/v2-game/','/v2-game/data/balance.json'])assert.equal((await worker.fetch(request(url),{},{})).status,401);
 assert.equal((await worker.fetch(request('/v2','other'),{EMBERWILD_ALLOWED_USER_ID:'owner'},{})).status,403);
 const page=await worker.fetch(request('/v2','owner'),{},{});
 assert.equal(page.status,200);assert.match(await page.text(),/id="devGame"/);
 assert.match(page.headers.get('Content-Security-Policy'),/frame-ancestors 'self'/);
 const original=await worker.fetch(request('/','owner'),{},{});
 assert.equal(original.headers.get('X-Frame-Options'),'DENY','existing root protection stays unchanged');
 const editor=await worker.fetch(request('/v2-editor','owner'),{},{});
 assert.equal(editor.headers.get('X-Frame-Options'),'SAMEORIGIN');assert.match(await editor.text(),/__EMBERWILD_V2_BRIDGE/);
});
test('packaged game assets match the pinned real game source and isolation runs first',async()=>{
 const provenance=JSON.parse(fs.readFileSync(path.join(root,'docs/v2-game-provenance.json')));
 for(const file of provenance.files){const body=fs.readFileSync(path.join(root,'../Emberwild',file.path));assert.equal(crypto.createHash('sha256').update(body).digest('hex'),file.sha256,file.path);}
 const entry=await worker.fetch(request('/v2-game/','owner'),{},{}),html=await entry.text();
 assert(html.indexOf('function memoryStorage')<html.indexOf('js/ui/themes.js'));
 const schema=await worker.fetch(request('/v2-game/js/combat/seconds-schema.js','owner'),{},{});
 assert.equal(await schema.text(),fs.readFileSync(path.join(root,'../Emberwild/js/combat/seconds-schema.js'),'utf8'));
 assert.equal((await worker.fetch(request('/v2-game/not-a-file','owner'),{},{})).status,404);
});
