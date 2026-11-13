/* 教學管理：edits data.tutorials with the game's own contract (EmberwildTutorial, embedded from
   js/story/tutorial-model.js). Only the condition, event, target and trigger types the game declares can be chosen.
   「在遊戲預覽中測試」asks the developer shell to apply the draft and run the module in the preview frame. */
(()=>{
 const M=EmberwildTutorial;
 let selected='',stepIndex=0,testStep=0,testState=null,testError='',poll=null,lastReply=0;
 const T=()=>data.tutorials;
 const ctx=()=>({quests:data.story?.quests,items:data.items});
 const issues=()=>T()?M.issues(T(),ctx()):[];
 const mod=()=>T()?.modules.find(m=>m.id===selected)||null;
 const original=()=>{try{return new Set((ORIGINAL_DATA.tutorials?.modules||[]).map(m=>m.id));}catch{return new Set();}};
 const opts=(rows,value,blank)=>(blank!==undefined?`<option value="" ${value===''?'selected':''}>${esc(blank)}</option>`:'')+rows.map(([v,l])=>`<option value="${esc(v)}" ${String(v)===String(value)?'selected':''}>${esc(l)}</option>`).join('');
 const entries=o=>Object.entries(o);
 const attr=p=>esc(JSON.stringify(p));
 const get=path=>path.reduce((o,k)=>o?.[k],T());
 // Inputs: data-tu = path inside data.tutorials, data-tu-kind = str|num|bool.
 const field=(label,path,kind='str',{area=false,rows=2,hint=''}={})=>{const v=get(path);if(kind==='bool')return `<label class="tutorial-check"><input type="checkbox" data-tu="${attr(path)}" data-tu-kind="bool" ${v?'checked':''}> ${esc(label)}</label>`;return `<label>${esc(label)}${area?`<textarea data-tu="${attr(path)}" data-tu-kind="${kind}" rows="${rows}">${esc(v??'')}</textarea>`:`<input data-tu="${attr(path)}" data-tu-kind="${kind}" type="${kind==='num'?'number':'text'}" value="${esc(v??'')}">`}${hint?`<small>${esc(hint)}</small>`:''}</label>`;};
 const select=(label,path,rows,blank)=>`<label>${esc(label)}<select data-tu="${attr(path)}" data-tu-kind="str">${opts(rows,get(path)??'',blank)}</select></label>`;
 const pages=()=>entries(M.PAGES);
 function triggerText(m){const t=m.trigger;return (M.TRIGGERS[t.type]||t.type)+(t.type==='pageEnter'?'：'+(M.PAGES[t.page]||t.page||'未設定'):'')+(t.notify?'（先通知）':'');}

 function conditionRow(path,c,i){
  const def=M.CONDITIONS[c.type]||{},p=[...path,i],key=[...p,'key'];let keyField='';
  if(def.key==='tutorial')keyField=select('教學',key,T().modules.map(m=>[m.id,m.title+'（'+m.id+'）']),'選擇教學');
  else if(def.key==='page')keyField=select('頁面',key,pages(),'選擇頁面');
  else if(def.key==='slotType')keyField=select('技能槽',key,entries(M.SLOT_TYPES),'選擇');
  else if(def.key==='lesson')keyField=select('序幕操作',key,entries(M.LESSONS),'選擇');
  else if(def.key==='quest')keyField=select('任務',key,(data.story?.quests||[]).map(q=>[q.id,q.name+'（'+q.id+'）']),'選擇任務');
  else if(def.key==='item')keyField=select('物品類型',[...p,'itemType'],[['item','道具'],['material','材料']],'選擇')+(c.itemType==='item'?select('道具',key,(data.items||[]).map(x=>[x.id,x.name||x.id]),'選擇道具'):field('材料名稱',key));
  else if(def.key==='text')keyField=field('解鎖鍵',key);
  return `<div class="tutorial-condition">${select('條件',[...p,'type'],entries(M.CONDITIONS).map(([k,d])=>[k,d.label]))}${keyField}${def.count?field('數量',[...p,'count'],'num'):''}<button type="button" data-tu-remove="${attr(path)}" data-index="${i}">刪除</button></div>`;
 }
 function groupHTML(title,path,help=''){
  const g=get(path);if(!g)return '';
  return `<fieldset class="tutorial-group"><legend>${esc(title)}</legend>${help?`<p class="small">${esc(help)}</p>`:''}${select('判定方式',[...path,'mode'],[['all','全部成立'],['any','任一成立']])}${g.conditions.map((c,i)=>conditionRow([...path,'conditions'],c,i)).join('')||'<p class="small">沒有條件（一律成立）。</p>'}<button type="button" data-tu-add-condition="${attr([...path,'conditions'])}">新增條件</button></fieldset>`;
 }
 function stepHTML(m,mi,si){
  const s=m.steps[si],p=['modules',mi,'steps',si],a=s.advance,targets=entries(M.TARGETS).filter(([,t])=>!s.page||!t.page||t.page===s.page).map(([id,t])=>[id,t.label+'（'+(M.PAGES[t.page]||'任何頁面')+'）']);
  let advance=select('下一步條件',[...p,'advance','type'],entries(M.ADVANCE));
  if(a.type==='event')advance+=select('遊戲事件',[...p,'advance','key'],entries(M.EVENTS),'選擇事件');
  if(a.type==='page')advance+=select('等待頁面',[...p,'advance','key'],pages(),'選擇頁面');
  if(a.type==='condition')advance+=`<div class="tutorial-condition-host">${conditionRow([...p,'advance'],a.condition,'condition').replace(/<button type="button" data-tu-remove[^>]*>刪除<\/button>/,'')}</div>`;
  return `<article class="tutorial-step" data-tutorial-step="${esc(s.id)}"><div class="tutorial-step-head"><b>第 ${si+1} 步 · ${esc(s.title)}</b><span class="actions"><button type="button" data-tu-step-move="${si}" data-delta="-1" ${si===0?'disabled':''}>上移</button><button type="button" data-tu-step-move="${si}" data-delta="1" ${si===m.steps.length-1?'disabled':''}>下移</button><button type="button" data-tu-step-remove="${si}">刪除</button><button type="button" data-tu-test-step="${si}">從這一步測試</button></span></div>
   <div class="tutorial-fields">${field('步驟 ID',[...p,'id'])}${field('標題',[...p,'title'])}${select('所在頁面',[...p,'page'],pages(),'依高亮目標決定')}${select('高亮目標',[...p,'target'],targets,'不高亮（只顯示說明）')}${select('提示位置',[...p,'placement'],entries(M.PLACEMENTS))}${select('重播時',[...p,'onReplay'],[['same','照常操作'],['explain','只說明，不要求實際操作']])}</div>
   ${field('說明文字',[...p,'text'],'str',{area:true,rows:3})}<div class="tutorial-fields">${advance}${field('可略過這一步',[...p,'optional'],'bool')}</div>
   <details><summary>可執行條件與略過條件</summary>${groupHTML('可執行條件',[...p,'requires'],'不成立時，玩家會看到原因並可略過這一步。')}${groupHTML('略過條件（序幕已教過時使用）',[...p,'skipIf'],'成立時自動跳過這一步；重播與測試不跳過。')}</details></article>`;
 }
 function moduleHTML(m){
  const mi=T().modules.indexOf(m),p=['modules',mi],fixed=original().has(m.id);
  return `<section class="tutorial-edit" data-tutorial-edit="${esc(m.id)}"><h2>${esc(m.title)} <small>${esc(m.id)}</small></h2>
   <div class="tutorial-fields">${fixed?`<label>教學 ID<input value="${esc(m.id)}" disabled><small>已發布的 ID 固定不變，玩家進度以此對應。</small></label>`:field('教學 ID',[...p,'id'],'str',{hint:'小寫英文、數字與底線；發布後不可更改'})}${field('名稱',[...p,'title'])}${select('所屬系統',[...p,'category'],entries(M.CATEGORIES))}${select('類型',[...p,'type'],entries(M.TYPES))}${select('中斷處理',[...p,'interrupt'],[['pause','離開頁面時暫停'],['end','離開頁面時結束']])}</div>
   ${field('說明（教學回顧中顯示）',[...p,'description'],'str',{area:true})}
   <div class="tutorial-flags">${field('啟用',[...p,'enabled'],'bool')}${field('已實裝（內容完成，可向玩家顯示）',[...p,'implemented'],'bool')}${field('允許重播',[...p,'replayable'],'bool')}${field('允許跳過',[...p,'skippable'],'bool')}</div>
   <div class="tutorial-fields"><label>修訂版本<input value="${m.revision}" disabled></label><label>　<button type="button" data-tu-revision>內容大幅修改：修訂版本 +1</button></label>${field('新版本時再提示一次已完成的玩家',[...p,'reprompt'],'bool')}</div>
   <fieldset class="tutorial-group"><legend>觸發</legend><div class="tutorial-fields">${select('觸發方式',[...p,'trigger','type'],entries(M.TRIGGERS))}${m.trigger.type==='pageEnter'?select('頁面',[...p,'trigger','page'],pages(),'選擇頁面'):''}${field('條件成立時先顯示通知',[...p,'trigger','notify'],'bool')}${field('通知文字',[...p,'trigger','notifyText'])}</div></fieldset>
   ${groupHTML('前置條件（解鎖）',[...p,'prerequisites'],'全部成立後才會觸發，也才會出現在教學回顧。')}
   <fieldset class="tutorial-group"><legend>完成條件</legend>${select('完成方式',[...p,'completion','type'],[['steps','走完所有步驟'],['condition','走完步驟且狀態成立']])}${m.completion.type==='condition'?groupHTML('完成時必須成立',[...p,'completion','condition']):''}</fieldset>
   <h3>步驟（${m.steps.length}）</h3>${m.steps.map((_,si)=>stepHTML(m,mi,si)).join('')}<button type="button" data-tu-step-add>新增步驟</button></section>`;
 }
 function testHTML(m){
  const s=testState,a=s?.active,mr=s?.module;
  const cond=list=>list?.length?`<ul>${list.map(c=>`<li class="${c.met?'tutorial-met':'tutorial-unmet'}">${esc(c.label)}：${c.value} / ${c.count} ${c.met?'✓':'✗'}</li>`).join('')}</ul>`:'<p class="small">沒有條件</p>';
  return `<section class="tutorial-test" aria-label="教學測試"><h2>在遊戲預覽中測試</h2><p class="small">先把目前草稿套用到預覽，再從指定步驟執行。測試不寫入教學進度；開發者預覽的存檔只存在記憶體，不影響玩家存檔。需要背包裝備、技能等狀態時，請在預覽中實際取得，這裡不會另外發放物品。</p>
   <div class="actions"><label>從第<select id="tutorialTestStep">${m.steps.map((x,i)=>`<option value="${i}" ${i===testStep?'selected':''}>${i+1}. ${esc(x.title)}</option>`).join('')}</select>步</label><button type="button" class="primary" data-tu-test="start">從指定步驟開始</button><button type="button" data-tu-test="first">從第一步開始</button></div>
   <div class="actions"><button type="button" data-tu-control="restartStep">重複目前步驟</button><button type="button" data-tu-control="back">上一步</button><button type="button" data-tu-control="next">跳至下一步</button><button type="button" data-tu-control="pause">暫停</button><button type="button" data-tu-control="resume">繼續</button><button type="button" data-tu-control="close">結束測試</button></div>
   ${testError?`<p class="notice bad">${esc(testError)}</p>`:''}
   ${a?`<dl class="tutorial-test-status"><dt>目前</dt><dd>${esc(a.title)} · 第 ${a.step+1} / ${a.steps} 步「${esc(a.stepTitle)}」${a.mode==='test'?'（測試）':'（'+esc(a.mode)+'）'}${a.paused?' · 暫停：'+esc(a.reason):''}</dd><dt>目標定位</dt><dd>${esc(a.target.id||'無')} · ${esc(a.target.text)}</dd><dt>下一步條件</dt><dd>${esc(M.ADVANCE[a.advance.type]||a.advance.type)}${a.advance.key?'：'+esc(M.EVENTS[a.advance.key]||M.PAGES[a.advance.key]||a.advance.key):''}${a.advance.met===null?'':a.advance.met?' · 已成立':' · 未成立'}</dd><dt>可執行條件</dt><dd>${a.unavailable?esc(a.unavailable):'可執行'}</dd><dt>頁面</dt><dd>目前 ${esc(M.PAGES[a.page]||a.page)} · 步驟 ${esc(M.PAGES[a.stepPage]||'不限')}</dd></dl>`:s?'<p class="small">預覽中目前沒有進行中的教學。</p>':''}
   ${mr?`<details open><summary>觸發與完成條件（預覽目前狀態）</summary><p>觸發：${esc(M.TRIGGERS[mr.trigger.type])}${mr.trigger.page?'：'+esc(M.PAGES[mr.trigger.page]):''} · 前置條件${mr.prerequisites.met?'已成立':'未成立'}</p>${cond(mr.prerequisites.conditions)}<p>完成：${mr.completion.type==='steps'?'走完所有步驟':'走完步驟且狀態成立（'+(mr.completion.met?'已成立':'未成立')+'）'}</p>${cond(mr.completion.conditions)}<p class="small">預覽中的玩家紀錄：${esc(mr.status)}</p></details>`:''}
   ${s&&!s.ready?'<p class="notice bad">預覽中尚未建立角色。請先在遊戲預覽中開始遊戲（序幕結束後才能測試教學）。</p>':''}${s?.prologue?'<p class="notice bad">預覽中的角色仍在序幕，序幕結束後才能測試教學。</p>':''}</section>`;
 }
 function page(){
  const app=document.getElementById('app');
  if(!T()){app.innerHTML=sectionHead('教學管理','遊戲教學的內容、觸發條件與預覽測試')+'<p class="notice bad">目前的資料沒有教學設定。載入遊戲 v0.144 以上的資料，或加入內建的三個核心教學。</p><button id="tutorialSeed" class="primary">加入內建教學</button>';document.getElementById('tutorialSeed').onclick=seed;return;}
  const errs=issues(),m=mod();
  app.innerHTML=sectionHead('教學管理','建立與調整遊戲教學。條件、事件與高亮目標只能選擇遊戲已支援的類型；文字與步驟可自由修改。',`<span class="pill">${T().modules.length} 個教學</span><button type="button" data-tu-add-module class="primary">新增教學</button>`)
   +(errs.length?`<div class="notice bad tutorial-errors"><b>教學資料有 ${errs.length} 個問題，修正前無法套用或發布：</b><ul>${errs.map(e=>`<li>${esc(e)}</li>`).join('')}</ul></div>`:'<p class="notice good">教學資料驗證通過。</p>')
   +`<div class="tutorial-table"><table><thead><tr><th>順序</th><th>名稱</th><th>所屬系統</th><th>類型</th><th>狀態</th><th>觸發</th><th>步驟</th><th>修訂</th><th></th></tr></thead><tbody>${T().modules.map((x,i)=>`<tr class="${x.id===selected?'selected':''}" data-tutorial-row="${esc(x.id)}"><td>${i+1}</td><td><b>${esc(x.title)}</b><br><small>${esc(x.id)}</small></td><td>${esc(M.CATEGORIES[x.category]||x.category)}</td><td>${esc(M.TYPES[x.type]||x.type)}</td><td>${x.enabled?(x.implemented?'啟用':'啟用（未實裝，不顯示）'):'停用'}</td><td>${esc(triggerText(x))}</td><td>${x.steps.length}</td><td>${x.revision}</td><td class="actions"><button type="button" data-tu-select="${esc(x.id)}">編輯</button><button type="button" data-tu-move="${i}" data-delta="-1" ${i===0?'disabled':''}>上移</button><button type="button" data-tu-move="${i}" data-delta="1" ${i===T().modules.length-1?'disabled':''}>下移</button><button type="button" data-tu-toggle="${i}">${x.enabled?'停用':'啟用'}</button>${original().has(x.id)?'':`<button type="button" data-tu-delete="${i}">刪除</button>`}</td></tr>`).join('')}</tbody></table></div>
   <p class="small">清單順序就是同時符合條件時的優先順序。已發布的教學不能刪除，只能停用，以保留玩家進度的對應。</p>`
   +(m?moduleHTML(m)+testHTML(m):'<p class="small">選擇一個教學以編輯內容與測試。</p>');
  bind(app);
 }
 function bind(app){
  const on=(sel,fn)=>app.querySelectorAll(sel).forEach(el=>el.onclick=()=>fn(el));
  app.querySelectorAll('[data-tu]').forEach(el=>el.onchange=()=>{const k=el.dataset.tuKind,v=k==='bool'?el.checked:k==='num'?Number(el.value):el.value;try{set(JSON.parse(el.dataset.tu),v);}catch(e){alert(e.message);render();}});
  on('[data-tu-select]',el=>{selected=el.dataset.tuSelect;testStep=0;testState=null;testError='';render();});
  on('[data-tu-move]',el=>moveModule(Number(el.dataset.tuMove),Number(el.dataset.delta)));
  on('[data-tu-toggle]',el=>{const m=T().modules[Number(el.dataset.tuToggle)];m.enabled=!m.enabled;changed(m.enabled?'已啟用教學':'已停用教學');});
  on('[data-tu-delete]',el=>removeModule(Number(el.dataset.tuDelete)));
  on('[data-tu-add-module]',()=>addModule());
  on('[data-tu-step-add]',()=>addStep());
  on('[data-tu-step-move]',el=>moveStep(Number(el.dataset.tuStepMove),Number(el.dataset.delta)));
  on('[data-tu-step-remove]',el=>removeStep(Number(el.dataset.tuStepRemove)));
  on('[data-tu-add-condition]',el=>{get(JSON.parse(el.dataset.tuAddCondition)).push(M.condition('prologueDone'));changed('已新增條件');});
  on('[data-tu-remove]',el=>{get(JSON.parse(el.dataset.tuRemove)).splice(Number(el.dataset.index),1);changed('已刪除條件');});
  on('[data-tu-revision]',()=>{const m=mod();m.revision=Math.min(9999,m.revision+1);changed('修訂版本已改為 '+m.revision);});
  on('[data-tu-test-step]',el=>{testStep=Number(el.dataset.tuTestStep);runTest(testStep);});
  on('[data-tu-test]',el=>runTest(el.dataset.tuTest==='first'?0:Number(document.getElementById('tutorialTestStep')?.value||0)));
  on('[data-tu-control]',el=>control(el.dataset.tuControl));
  const pick=document.getElementById('tutorialTestStep');if(pick)pick.onchange=()=>{testStep=Number(pick.value);};
 }
 // ---------- edits (the controls and the tests use the same functions) ----------
 const changed=(message,redraw=true)=>{markDirty(message);if(redraw&&currentSection==='tutorials')render();};
 const FIXED=['version'];
 function set(path,value){
  const parent=get(path.slice(0,-1)),key=path.at(-1);
  if(!parent||typeof parent!=='object'||FIXED.includes(key))throw Error('這個欄位不能在教學管理修改');
  if(path.length===3&&key==='id'&&path[0]==='modules'){const m=parent;if(original().has(m.id))throw Error('已發布的教學 ID 不能更改');if(selected===m.id)selected=value;}
  if(key==='type'&&path.at(-2)==='trigger'&&value!=='pageEnter')parent.page='';
  if(key==='type'&&path.at(-2)==='completion'&&value==='condition'&&!parent.condition)parent.condition=M.group([M.condition('prologueDone')]);
  if(key==='type'&&path.at(-2)==='advance'){for(const k of Object.keys(parent))if(k!=='type')delete parent[k];if(value==='event'||value==='page')parent.key='';if(value==='condition')parent.condition=M.condition('prologueDone');}
  if(key==='type'&&Object.hasOwn(M.CONDITIONS,value)&&parent.count!==undefined){parent.key='';if(M.CONDITIONS[value].key==='item')parent.itemType='item';else delete parent.itemType;}
  if(key==='itemType')parent.key='';
  parent[key]=value;changed('已修改教學');
 }
 function uniqueId(base,taken){let id=base,n=2;while(taken.has(id))id=base+'_'+n++;return id;}
 function addModule(){const ids=new Set(T().modules.map(m=>m.id)),id=uniqueId('new_tutorial',ids);T().modules.push(M.module({id,title:'新教學',category:'other',type:'intro',enabled:false,implemented:false,trigger:{type:'manual'},prerequisites:M.group([M.condition('prologueDone')]),steps:[M.step('intro','說明','請填寫說明文字。')]}));selected=id;changed('已新增教學（預設停用、未實裝）');return id;}
 function removeModule(i){const m=T().modules[i];if(!m)return false;if(original().has(m.id))throw Error('已發布的教學不能刪除，請改為停用');const used=T().modules.filter(x=>x!==m&&JSON.stringify([x.prerequisites,x.completion,x.steps]).includes('"key":"'+m.id+'"'));if(used.length)throw Error('仍被其他教學的條件引用：'+used.map(x=>x.title).join('、'));T().modules.splice(i,1);if(selected===m.id)selected='';changed('已刪除教學');return true;}
 function moveModule(i,d){const a=T().modules,j=i+d;if(j<0||j>=a.length)return false;[a[i],a[j]]=[a[j],a[i]];changed('已調整教學順序');return true;}
 function addStep(){const m=mod(),ids=new Set(m.steps.map(s=>s.id));m.steps.push(M.step(uniqueId('step',ids),'新步驟','請填寫說明文字。'));changed('已新增步驟');}
 function removeStep(i){const m=mod();m.steps.splice(i,1);changed('已刪除步驟');}
 function moveStep(i,d){const a=mod().steps,j=i+d;if(j<0||j>=a.length)return false;[a[i],a[j]]=[a[j],a[i]];changed('已調整步驟順序');return true;}
 function seed(){if(T())return false;data.tutorials=M.defaults();selected=data.tutorials.modules[0].id;changed('已加入內建教學');return true;}

 // ---------- preview test (through the developer shell) ----------
 const pending=new Map();let seq=0;
 function ask(action,payload={}){
  const host=globalThis.parent;if(!host||host===globalThis)return Promise.resolve({ok:false,error:'需要在開發者模式（遊戲預覽與編輯器並排的畫面）中測試。'});
  const id=++seq;return new Promise(resolve=>{pending.set(id,resolve);host.postMessage({kind:'dreaming-abyss-dev-tutorial',...payload,id,action},location.origin);setTimeout(()=>{if(pending.has(id)){pending.delete(id);resolve({ok:false,error:'遊戲預覽沒有回應，請確認預覽已載入。'});}},4000);});
 }
 globalThis.addEventListener?.('message',e=>{if(e.origin!==location.origin||e.data?.kind!=='dreaming-abyss-dev-tutorial-result')return;const r=pending.get(e.data.id);if(r){pending.delete(e.data.id);r(e.data);}});
 function show(reply){lastReply=Date.now();testError=reply.ok===false?reply.error||'測試失敗':'';if(reply.status)testState={...reply.status,module:reply.module||null};if(currentSection==='tutorials'){const host=document.querySelector?.('.tutorial-test'),m=mod();if(host&&m){host.outerHTML=testHTML(m);bind(document.getElementById('app'));}else render();}}
 async function runTest(step){
  const m=mod();if(!m)return;const errs=issues();if(errs.length){testError='教學資料有問題，請先修正：'+errs[0];render();return;}
  const reply=await ask('test',{tutorialId:m.id,step});show(reply);
  clearInterval(poll);if(reply.ok)poll=setInterval(async()=>{if(currentSection!=='tutorials'||selected!==m.id){clearInterval(poll);return;}const r=await ask('status',{tutorialId:m.id});show(r);if(r.ok&&!r.status?.active)clearInterval(poll);},700);
 }
 async function control(action){const m=mod();const r=await ask('control',{tutorialId:m?.id,control:action});show(r);if(action==='close')clearInterval(poll);}

 SECTION_META.push(['tutorials','教學管理']);
 const group=NAV_GROUPS.find(g=>g[0]==='questsJournal');if(group)group[2].push('tutorials');else NAV_GROUPS.push(['tutorials','教學管理',['tutorials']]);
 const baseRender=render;render=function(...args){if(currentSection!=='tutorials')return baseRender(...args);ensureArrays();renderNav(true);if(T()&&!mod()&&T().modules.length)selected=T().modules[0].id;page();};
 const baseCount=count;count=function(section,normalized=false){if(section!=='tutorials')return baseCount(section,normalized);return T()?.modules?.length??0;};
 // Publishing and applying already run the shared document check, which includes the tutorial rules; list them here too.
 const baseValidate=validateData;validateData=function(...args){const out=baseValidate(...args);for(const e of issues())out.push('教學：'+e);return out;};
 globalThis.__EMBERWILD_TUTORIAL_EDITOR={issues,set,addModule,removeModule,moveModule,addStep,removeStep,moveStep,seed,runTest,control,select(id){selected=id;},get selected(){return selected;},open(id){if(id)selected=id;currentSection='tutorials';render();},get testState(){return testState;},get testError(){return testError;}};
})();
