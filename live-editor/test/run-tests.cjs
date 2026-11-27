#!/usr/bin/env node
/* 即時平衡器整合測試：在 headless Chromium 中開啟真正的遊戲，逐項驗證平衡器功能。
 * 用法：node live-editor/test/run-tests.cjs [遊戲資料夾]
 * 預設遊戲資料夾為 ../DreamingAbyss。提交測試在遊戲的暫存 clone 上進行，不動原資料夾。
 */
'use strict';
const path=require('node:path'),fs=require('node:fs'),os=require('node:os'),cp=require('node:child_process');
let chromium;try{({chromium}=require('playwright'));}catch{try{({chromium}=require(path.join(cp.execSync('npm root -g',{encoding:'utf8'}).trim(),'playwright')));}catch{console.error('需要 playwright：npm i --no-save playwright && npx playwright install chromium');process.exit(1);}}
const GAME_SRC=path.resolve(process.argv[2]||process.env.GAME_DIR||path.join(__dirname,'..','..','..','DreamingAbyss'));
const SERVER=path.join(__dirname,'..','server.cjs');
const results=[];let failed=0;
let shotPage=null;
async function test(name,fn){const t=Date.now();try{await fn();results.push('✔ '+name+' ('+(Date.now()-t)+'ms)');}catch(e){failed++;if(shotPage&&process.env.SHOTS){try{await shotPage.screenshot({path:path.join(process.env.SHOTS,'fail-'+failed+'.png')});}catch{}}results.push('✘ '+name+'\n    '+String(e&&e.stack||e).split('\n').slice(0,4).join('\n    '));}console.log(results[results.length-1]);}
function assert(c,m){if(!c)throw Error(m||'assert failed');}
function startServer(game,port){
 const child=cp.spawn(process.execPath,[SERVER,game,'--port',String(port)],{stdio:['ignore','pipe','pipe']});
 return new Promise((resolve,reject)=>{let out='';child.stdout.on('data',d=>{out+=d;if(out.includes('http://'))resolve(child);});child.stderr.on('data',d=>out+=d);child.on('exit',c=>reject(Error('server exit '+c+': '+out)));setTimeout(()=>reject(Error('server timeout: '+out)),15000);});
}
(async()=>{
 if(!fs.existsSync(path.join(GAME_SRC,'index.html'))){console.error('找不到遊戲：'+GAME_SRC);process.exit(1);}
 // 遊戲的暫存 clone（提交測試用）
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'da-live-'));const GAME=path.join(tmp,'game');
 cp.execFileSync('git',['clone','--quiet','--local',GAME_SRC,GAME]);
 cp.execFileSync('git',['-C',GAME,'config','user.name','live-editor-test']);cp.execFileSync('git',['-C',GAME,'config','user.email','test@localhost']);
 const port=18000+Math.floor(Math.random()*1000);
 const server=await startServer(GAME,port);
 const browser=await chromium.launch();
 const ctx=await browser.newContext({viewport:{width:1500,height:950},acceptDownloads:true});
 const page=await ctx.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 const host=page.locator('#da-live-editor');shotPage=page;
 const E=(fn,a)=>page.evaluate(fn,a);
 const status=()=>host.locator('[data-status]').textContent();
 async function setField(sel,val){const i=host.locator(sel).first();await i.fill(String(val));await i.dispatchEvent('change');await page.evaluate(()=>DreamingAbyssLiveEditor.apply());}
 try{
  await page.goto('http://localhost:'+port+'/');
  await page.waitForFunction(()=>window.DreamingAbyssLiveEditor?.draft,null,{timeout:90000});
  await host.locator('button.fab').click();

  await test('分類依遊戲系統分組',async()=>{assert(await host.locator('.sysrow').count()===7,'系統列數');assert((await host.locator('.sysname').allInnerTexts()).includes('道具與裝備'));});

  await test('修改道具價格並套用到遊戲',async()=>{
   await host.locator('[data-cat=items]').click();await host.locator('.list .item').first().click();
   await setField('input[data-field=\'["items",0,"cost"]\']',777);
   assert(await E(()=>exportableBalance().items[0].cost)===777,'遊戲未套用');assert((await status()).includes('已套用'));});

  await test('參數顯示中文名稱與單位',async()=>{const t=await host.locator('.panel .body').innerText();assert(t.includes('價格')&&t.includes('賣出價格'),'缺中文名稱');});

  await test('驗證錯誤指到出錯欄位',async()=>{try{
   await setField('input[data-field=\'["items",0,"cost"]\']',-5);
   assert((await status()).includes('套用失敗'));assert(await host.locator('.field.err').count()>=1,'沒有標示錯誤欄位');
   assert(await host.locator('[data-status] a').count()>=1,'狀態列沒有欄位連結');
   assert((await host.locator('.note.warn').allInnerTexts()).some(t=>t.includes('負數')),'沒有數值範圍提示');
  }finally{await E(()=>{DreamingAbyssLiveEditor.draft.items[0].cost=777;DreamingAbyssLiveEditor.apply();});}});

  await test('代碼欄位提供選單與中文說明',async()=>{
   await host.locator('[data-cat=monsters]').click();await host.locator('.list .item').first().click();
   assert(await host.locator('select[data-field=\'["balanceSettings","monsters","catalog",0,"element"]\']').count()===1,'屬性不是下拉選單');
   assert(await host.locator('.sec').count()>=2,'欄位沒有分組');});

  await test('釘選與最近開啟',async()=>{await host.locator('[data-act=pin]').click();assert(await host.locator('.chips').count()>=1);});

  await test('彈窗開啟時仍可定位並同步編輯同名資料',async()=>{try{
   await E(()=>{const m=document.getElementById('modal');m.innerHTML='<h2>技能</h2><article><h3>裂地斬</h3><p>冷卻 3 秒</p></article>';m.showModal();});
   await page.waitForTimeout(200);
   assert(await E(()=>document.getElementById('da-live-editor').parentNode.id)==='modal','平衡器不在彈窗內');
   await host.locator('.head [data-act=pick-inspect]').click();await page.locator('#modal h3').click();await page.waitForTimeout(200);
   await host.locator('[data-act=group-open]').first().click();
   const n=await E(()=>DreamingAbyssLiveEditor.ui.group.paths.length);assert(n>=2,'同步筆數 '+n);
   assert(await host.locator('.field.hl').count()>=1,'沒有標示畫面上的欄位');
   await setField('input[data-field$=\',"cooldownSeconds"]\']',4);
   const vals=await E(()=>{const E=DreamingAbyssLiveEditor;return E.ui.group.paths.map(p=>p.reduce((o,k)=>o?.[k],E.draft)?.timing?.cooldownSeconds);});
   assert(vals.every(v=>v===4),'不是每筆都改到：'+vals);
   assert(await host.locator('.field input[disabled]').count()>=1,'識別碼沒有鎖定');
   // 取消勾選一筆後只改其餘
   await host.locator('[data-group-pick]').nth(1).uncheck();
   assert(await E(()=>DreamingAbyssLiveEditor.ui.group.paths.length)===n-1);
  }finally{await E(()=>{const m=document.getElementById('modal');m.innerHTML='<p>x</p>';if(m.open)m.close();});const x=host.locator('[data-act=group-exit]');if(await x.count())await x.click();}});

  await test('刪除前列出引用',async()=>{
   await host.locator('[data-cat=monsters]').click();await host.locator('.list .item').first().click();
   await host.locator('.card [data-act=del]').first().click();
   assert(await host.locator('.card.warn').count()===1,'沒有刪除確認');
   assert((await host.locator('.card.warn').innerText()).includes('引用'),'沒有列出引用');
   await host.locator('[data-act=del-cancel]').click();});

  await test('識別碼改名並更新引用',async()=>{try{
   const id=await E(()=>{const d=DreamingAbyssLiveEditor.draft;const refs=(d.shopSettings?.randomOffers?.entries||[]).concat(d.shopSettings?.fixedOffers?.entries||[]).filter(r=>r.type==='item').map(r=>r.key);return d.items.find(x=>refs.includes(x.id)&&x.type==='timedBoost')?.id;});
   assert(id,'找不到被商店引用的道具');
   const idx=await E(id=>DreamingAbyssLiveEditor.draft.items.findIndex(x=>x.id===id),id);
   await host.locator('[data-cat=items]').click();await host.locator(`.list .item[data-open='["items",${idx}]']`).click();
   await host.locator('[data-act=rename]').click();await host.locator('[data-rename]').fill(id+'_renamed');await host.locator('[data-act=rename-confirm]').click();await E(()=>DreamingAbyssLiveEditor.apply());
   const left=await E(id=>JSON.stringify(DreamingAbyssLiveEditor.draft).split('"'+id+'"').length-1,id);
   assert(left===0,'仍有 '+left+' 處舊識別碼');assert((await status()).includes('已套用'),await status());
   }finally{await host.locator('.foot [data-act=undo]').click();await E(()=>DreamingAbyssLiveEditor.apply());}});

  await test('表格檢視與批次調整',async()=>{
   await host.locator('[data-cat=items]').click();await host.locator('[data-act=toggle-table]').click();
   assert(await host.locator('table').count()===1);
   const before=await E(()=>DreamingAbyssLiveEditor.draft.items.map(x=>x.sellPrice));
   await host.locator('[data-batch-col]').selectOption('sellPrice');await host.locator('[data-batch-op]').selectOption('mul');await host.locator('[data-batch-val]').fill('2');
   await host.locator('[data-act=batch]').click();await page.waitForTimeout(500);
   const after=await E(()=>DreamingAbyssLiveEditor.draft.items.map(x=>x.sellPrice));
   assert(after.every((v,i)=>typeof before[i]!=='number'||Math.abs(v-before[i]*2)<1e-6),'批次結果錯誤');
   await host.locator('th[data-sort=sellPrice]').click();
   await host.locator('.foot [data-act=undo]').click();await host.locator('[data-act=toggle-table]').click();});

  await test('全域搜尋',async()=>{await host.locator('[data-gsearch]').fill('史萊姆');await page.waitForTimeout(200);assert(await host.locator('.list .item').count()>=1);await host.locator('[data-gsearch]').fill('');});

  await test('改字時提示資料來源與文字覆寫',async()=>{
   await host.locator('.head [data-act=pick-text]').click();await page.locator('header .brand span').first().click();await page.waitForTimeout(200);
   await host.locator('[data-pending]').fill('夢淵X');await host.locator('[data-act=text-save]').click();await page.waitForTimeout(500);
   assert((await page.locator('header .brand').innerText()).includes('夢淵X'));
   await E(()=>{const d=document.createElement('p');d.id='t-src';d.textContent=DreamingAbyssLiveEditor.draft.skillSystem.definitions[0].description;document.body.appendChild(d);});
   await host.locator('.head [data-act=pick-text]').click();await page.locator('#t-src').click();await page.waitForTimeout(200);
   assert(await host.locator('[data-act=text-src]').count()>=1,'沒有列出資料來源');await host.locator('[data-act=text-cancel]').click();});

  await test('變更依系統分組、可排除並下載報告',async()=>{
   await host.locator('[data-tab=changes]').click();assert(await host.locator('.sec').count()>=1);
   const [dl]=await Promise.all([page.waitForEvent('download'),host.locator('[data-act=report]').click()]);
   const md=fs.readFileSync(await dl.path(),'utf8');assert(md.includes('# 夢淵 平衡調整報告'));});

  await test('匯出完整 JSON',async()=>{
   await host.locator('[data-tab=export]').click();
   const [dl]=await Promise.all([page.waitForEvent('download'),host.locator('.body [data-act=export]').click()]);
   const j=JSON.parse(fs.readFileSync(await dl.path(),'utf8'));assert(j.items[0].cost===777);assert(j.textOverrides.entries.some(x=>x.text==='夢淵X'));
   assert(await E(j=>EmberwildBalanceDocument.inspect(j).length,j)===0,'完整檢查不通過');});

  await test('輸出模組 ZIP',async()=>{
   const [dl]=await Promise.all([page.waitForEvent('download'),host.locator('[data-act=modules-changed]').click()]);
   const buf=fs.readFileSync(await dl.path());assert(buf.readUInt32LE(0)===0x04034b50,'不是 ZIP');
   const names=[];for(let i=0;i<buf.length-4;i++)if(buf.readUInt32LE(i)===0x02014b50){const n=buf.readUInt16LE(i+28);names.push(buf.slice(i+46,i+46+n).toString());}
   assert(names.includes('data/balance.json')&&names.includes('data/balance/manifest.json'),names.join(','));
   assert(names.some(n=>/^data\/balance\/items\//.test(n)),'沒有道具模組：'+names.join(','));});

  await test('排除變更後只匯出勾選部分',async()=>{
   await host.locator('[data-tab=changes]').click();await host.locator('[data-act=ex-none]').click();
   await host.locator('[data-tab=export]').click();
   const [dl]=await Promise.all([page.waitForEvent('download'),host.locator('.body [data-act=export]').click()]);
   const j=JSON.parse(fs.readFileSync(await dl.path(),'utf8'));assert(j.items[0].cost!==777,'被排除的變更仍匯出');
   await host.locator('[data-tab=changes]').click();await host.locator('[data-act=ex-all]').click();});

  await test('直接提交到遊戲分支（暫存 clone）',async()=>{
   await host.locator('[data-tab=export]').click();await page.waitForTimeout(500);
   await host.locator('[data-pub-branch]').fill('balance/test-run');await host.locator('[data-act=publish]').click();
   await page.waitForFunction(()=>/已提交|提交失敗/.test(document.getElementById('da-live-editor').shadowRoot.querySelector('[data-status]').textContent),null,{timeout:60000});
   const s=await status();assert(s.includes('已提交'),s);
   const files=cp.execFileSync('git',['-C',GAME,'show','--name-only','--format=','balance/test-run'],{encoding:'utf8'});
   assert(files.includes('data/balance.json'),files);
   cp.execFileSync('git',['-C',GAME,'switch','--quiet','balance/test-run']);
   cp.execFileSync(process.execPath,[path.join(GAME,'scripts','balance-modules.cjs'),'check'],{cwd:GAME,stdio:'pipe'});
   const doc=JSON.parse(fs.readFileSync(path.join(GAME,'data','balance.json'),'utf8'));assert(doc.items[0].cost===777,'提交內容錯誤');});

  await test('測試工具（存檔外操作）在未進遊戲時提示',async()=>{await host.locator('[data-tab=test]').click();assert((await host.locator('.body').innerText()).length>0);});

  await test('快捷鍵 Alt+B 開關面板',async()=>{await page.keyboard.press('Alt+KeyB');assert(await host.locator('.panel').count()===0);await page.keyboard.press('Alt+KeyB');assert(await host.locator('.panel').count()===1);});

  await test('重新整理後保留草稿',async()=>{await page.reload();await page.waitForFunction(()=>window.DreamingAbyssLiveEditor?.draft,null,{timeout:90000});await page.waitForTimeout(800);assert(await E(()=>exportableBalance().items[0].cost)===777);});

  await test('頁面沒有執行錯誤',async()=>{assert(!errors.length,errors.join('\n'));});
 }finally{
  await browser.close();server.kill();fs.rmSync(tmp,{recursive:true,force:true});
 }
 console.log('\n'+(results.length-failed)+'／'+results.length+' 通過');
 process.exit(failed?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
