/* 序章劇情：edits the text of the `prologue` quest inside data.story (the same document the story designer edits).
   Text is free; the system events (naming, class, skill lesson, helper, gear, arrival) are fixed stage bindings shown
   read-only. Structure rules come from the shared EmberwildStory.prologueIssues, so the game and the editor agree. */
(()=>{
 const M=EmberwildStory;let scene=1,draftOnly=false;
 const quest=()=>M.prologueQuest(data.story),KINDS=[['narrator','旁白'],['npc','角色'],['player','主角']];
 const UI_LABELS={place:'地點名稱',continue:'繼續按鈕',nameLabel:'名字欄位標題',namePlaceholder:'名字欄位提示',nameConfirm:'確認名字按鈕',nameRequired:'未輸入名字的提示',classConfirm:'確認職業按鈕',toTask:'開始練習按鈕',returnToGoddess:'回到對話按鈕',taskPending:'步驟未完成的說明',startBattle:'開始訓練戰按鈕',retryBattle:'重試訓練戰按鈕',battleRunning:'戰鬥進行中標記',helperAccept:'接納助手按鈕',helperJoined:'助手加入後的提示',giftReceived:'收到裝備的提示',locked:'功能未開放的提示',enter:'穿過出口按鈕',begin:'開始旅程按鈕',backToTitle:'返回標題按鈕'};
 const opts=(rows,value)=>rows.map(([v,l])=>`<option value="${esc(v)}" ${String(v)===String(value)?'selected':''}>${esc(l)}</option>`).join('');
 const get=path=>path.reduce((o,k)=>o?.[k],quest());
 const attr=path=>esc(JSON.stringify(path));
 const input=(label,path,{area=false,rows=2}={})=>{const v=get(path)??'';return `<label>${esc(label)}${area?`<textarea data-pl="${attr(path)}" rows="${rows}">${esc(v)}</textarea>`:`<input data-pl="${attr(path)}" type="text" value="${esc(v)}">`}</label>`;};
 function lines(title,path){
  const rows=get(path)||[];
  return `<fieldset class="prologue-lines"><legend>${esc(title)}（${rows.length}）</legend>${rows.map((l,i)=>`<div class="prologue-line prologue-line-${esc(l.source||'draft')}" data-line="${attr([...path,i])}"><div class="prologue-line-meta"><select data-pl="${attr([...path,i,'kind'])}" aria-label="說話類型">${opts(KINDS,l.kind)}</select><input data-pl="${attr([...path,i,'speaker'])}" type="text" value="${esc(l.speaker)}" aria-label="顯示名稱" placeholder="顯示名稱"${l.kind==='player'?' title="遊戲中顯示玩家取的名字"':''}><select data-pl="${attr([...path,i,'source'])}" aria-label="來源">${opts(Object.entries(M.PROLOGUE_SOURCES),l.source||'draft')}</select></div><textarea data-pl="${attr([...path,i,'text'])}" rows="2" aria-label="文字">${esc(l.text)}</textarea><div class="actions"><button data-pl-move="${attr(path)}" data-index="${i}" data-delta="-1" ${i===0?'disabled':''}>上移</button><button data-pl-move="${attr(path)}" data-index="${i}" data-delta="1" ${i===rows.length-1?'disabled':''}>下移</button><button data-pl-remove="${attr(path)}" data-index="${i}">刪除</button></div></div>`).join('')}<button data-pl-add="${attr(path)}">新增對話</button></fieldset>`;
 }
 function stageHTML(q,si){
  const s=q.stages[si],x=s.prologue,base=['stages',si],event=x.action?M.PROLOGUE_ACTIONS[x.action]:s.encounter?.enabled?'訓練戰鬥（'+s.encounter.name+'，'+s.encounter.enemies.reduce((n,e)=>n+e.count,0)+' 個訓練對象）':'';
  return `<article class="prologue-stage" data-stage="${esc(s.id)}"><h3>${esc(s.name)} <small>${esc(s.id)}</small></h3>${event?`<p class="prologue-event" title="系統事件由遊戲程式執行，固定綁定在這個階段，不能在這裡移除或改成其他行為。">系統事件：${esc(event)}（固定）</p>`:'<p class="small">這個階段只有對話。</p>'}<div class="prologue-fields">${input('任務名稱',[...base,'name'])}${input('任務說明',[...base,'description'],{area:true})}${x.action||s.encounter?.enabled?input('教學提示',[...base,'prologue','hint'],{area:true}):''}${x.action&&x.action!=='nameHero'&&x.action!=='chooseClass'&&x.action!=='enterWorld'||s.encounter?.enabled?`<label>教學步驟（每行一項）<textarea data-pl-steps="${attr([...base,'prologue','steps'])}" rows="4">${esc(x.steps.join('\n'))}</textarea></label>`:''}${s.encounter?.enabled?input('訓練戰名稱',[...base,'encounter','name']):''}</div>${x.action==='chooseClass'?`<fieldset><legend>職業選項（對應遊戲的四個初始職業，數量與順序固定）</legend><div class="prologue-fields">${x.options.map((o,i)=>`<div class="prologue-option-edit"><b>${esc(data.classes?.[o.job]?.name||'職業 '+o.job)}</b>${input('選項文字',[...base,'prologue','options',i,'text'])}${input('選項說明',[...base,'prologue','options',i,'description'])}</div>`).join('')}</div></fieldset>`:''}${lines(event?'系統事件之前的對話':'對話',[...base,'dialogue'])}${event?lines('系統事件完成後的對話',[...base,'prologue','after']):''}</article>`;
 }
 function sharedHTML(q){const p=q.prologue;
  // Game v0.167 replaced the opening chapter: the prologue keeps only its scenes, without helper/training/chapter/ui texts.
  if(!p.helper||!p.training||!p.chapter||!p.ui)return '';return `<details class="prologue-shared"><summary>共用文字：臨時隊友、訓練對象、章節轉場與按鈕</summary><div class="prologue-fields">${input('臨時隊友名稱',['prologue','helper','name'])}${input('臨時隊友稱號',['prologue','helper','title'])}${input('臨時隊友說明',['prologue','helper','description'],{area:true})}${input('訓練對象名稱',['prologue','training','name'])}${input('章節標題',['prologue','chapter','title'])}</div>${lines('降臨後的轉場文字（顯示在章節標題之前）',['prologue','chapter','lines'])}<fieldset><legend>按鈕與提示文字</legend><div class="prologue-fields">${Object.keys(p.ui).map(k=>input(UI_LABELS[k]||k,['prologue','ui',k])).join('')}</div></fieldset></details>`;}
 function previewHTML(q){
  const p=q.prologue,out=[];let n=0;
  const row=(l,extra='')=>{if(draftOnly&&l.source!=='draft')return;n++;out.push(`<li class="prologue-preview-${esc(l.kind)}"><span class="tag">${esc(M.PROLOGUE_SOURCES[l.source]||'未標記')}</span> ${l.kind==='narrator'?'':`<b>${esc(l.kind==='player'?'（玩家名字）':l.speaker)}</b>：`}${esc(l.text)}${extra}</li>`);};
  for(const sc of p.scenes){out.push(`<li class="prologue-preview-scene"><b>場景 ${sc.id}：${esc(sc.name)}</b> <span class="small">${esc(sc.description)}</span></li>`);
   for(const s of q.stages.filter(s=>s.prologue.scene===sc.id)){s.dialogue.forEach(l=>row(l));const a=s.prologue.action,event=a?M.PROLOGUE_ACTIONS[a]:s.encounter?.enabled?'訓練戰鬥：'+s.encounter.name:'';if(event&&!draftOnly)out.push(`<li class="prologue-preview-event">〔系統事件〕${esc(event)}${s.prologue.hint?'　提示：'+esc(s.prologue.hint):''}</li>`);(s.prologue?.after||[]).forEach(l=>row(l));}
  }
  (p.chapter?.lines||[]).forEach(l=>row(l));if(!draftOnly&&p.chapter?.title)out.push(`<li class="prologue-preview-scene"><b>${esc(p.chapter.title)}</b></li>`);
  return `<details class="prologue-preview" open><summary>播放順序預覽（${n} 句）</summary><label><input type="checkbox" id="prologueDraftOnly" ${draftOnly?'checked':''}> 只看暫定續寫</label><ol>${out.join('')}</ol></details>`;
 }
 /* Version 2 (game v0.167+): the onboarding runs inside the game screen. The game reads the goddess's opening lines
    (first stage), each stage's name and description (the task bar) and the class option texts; nothing else is shown. */
 const V2_EVENTS={practice:'首次探索戰鬥（贏得一場戰鬥）'};
 const v2=q=>q?.prologue?.version===2;
 const v2Event=s=>s.prologue?.action?M.PROLOGUE_ACTIONS[s.prologue.action]:V2_EVENTS[s.id]||'';
 function stageV2(q,si){
  const s=q.stages[si],base=['stages',si],event=v2Event(s);
  return `<article class="prologue-stage" data-stage="${esc(s.id)}"><h3>${esc(s.name)} <small>${esc(s.id)}</small></h3>${event?`<p class="prologue-event" title="系統事件由遊戲程式執行，固定綁定在這個階段，不能在這裡移除或改成其他行為。">系統事件：${esc(event)}（固定）</p>`:''}<div class="prologue-fields">${input('階段名稱',[...base,'name'])}${input('任務提示列文字',[...base,'description'],{area:true})}</div>${s.prologue?.action==='chooseClass'?`<fieldset><legend>職業選項（對應遊戲的四個初始職業，數量與順序固定）</legend><div class="prologue-fields">${s.prologue.options.map((o,i)=>`<div class="prologue-option-edit"><b>${esc(data.classes?.[o.job]?.name||'職業 '+o.job)}</b>${input('選項文字',[...base,'prologue','options',i,'text'])}${input('選項說明',[...base,'prologue','options',i,'description'])}</div>`).join('')}</div></fieldset>`:''}${si===0?lines('命名畫面的女神開場',[...base,'dialogue']):''}</article>`;
 }
 function previewV2(q){
  const out=[];let n=0;
  q.stages.forEach((s,si)=>{if(si===0)for(const l of s.dialogue){if(draftOnly&&l.source!=='draft')continue;n++;out.push(`<li class="prologue-preview-${esc(l.kind)}"><span class="tag">${esc(M.PROLOGUE_SOURCES[l.source]||'未標記')}</span> ${l.kind==='narrator'?'':`<b>${esc(l.kind==='player'?'（玩家名字）':l.speaker)}</b>：`}${esc(l.text)}</li>`);}
   const event=v2Event(s);if(event&&!draftOnly)out.push(`<li class="prologue-preview-event">〔系統事件〕${esc(event)}　任務提示：${esc(s.description||s.name)}</li>`);});
  return `<details class="prologue-preview" open><summary>播放順序預覽（${n} 句）</summary><label><input type="checkbox" id="prologueDraftOnly" ${draftOnly?'checked':''}> 只看暫定續寫</label><ol>${out.join('')}</ol></details>`;
 }
 function pageV2(app,q){
  const errors=M.prologueIssues(q,{classes:data.classes,companions:data.companions}),all=q.stages[0]?.dialogue||[],original=all.filter(l=>l.source==='original').length;
  app.innerHTML=sectionHead('序章劇情','修改命名畫面的女神開場、新手引導各階段的名稱與任務提示列文字、職業選項文字。系統事件（命名、選職業、穿戴新手裝備、首次探索戰鬥、招募夥伴、完成）由遊戲程式執行，固定綁定在各階段。',`<span class="pill">開發者原文 ${original} 句</span><span class="pill">暫定續寫 ${all.length-original} 句</span>`)
   +(errors.length?`<div class="notice bad prologue-errors"><b>序章資料有 ${errors.length} 個問題，修正前無法發布：</b><ul>${errors.map(e=>`<li>${esc(e)}</li>`).join('')}</ul></div>`:'')
   +`<section class="prologue-scene-edit">${q.stages.map((s,i)=>stageV2(q,i)).join('')}</section>`+previewV2(q);
 }
 // Fields of a version 2 prologue the game reads; everything else is fixed.
 function editableV2(path){
  const q=quest(),[a,i,k,...rest]=path;if(a!=='stages'||!Number.isInteger(i)||!q.stages[i])return false;
  if(rest.length===0)return k==='name'||k==='description';
  if(k==='dialogue')return i===0&&rest.length===2&&Number.isInteger(rest[0])&&['speaker','kind','text','source'].includes(rest[1]);
  return k==='prologue'&&rest[0]==='options'&&q.stages[i].prologue?.action==='chooseClass'&&Number.isInteger(rest[1])&&['text','description'].includes(rest[2]);
 }
 function page(){
  const app=document.getElementById('app'),q=quest();
  if(!q){app.innerHTML=sectionHead('序章劇情','造物室的對話、選項、教學提示與轉場文字')+'<p class="notice bad">目前的資料沒有序章任務。載入遊戲 v0.125 以上版本的資料，或加入內建的預設序章後再修改。</p><button id="prologueSeed" class="primary">加入預設序章</button>';document.getElementById('prologueSeed').onclick=seed;return;}
  if(v2(q))pageV2(app,q);else{
  if(scene<1||scene>M.PROLOGUE_SCENES)scene=1;
  const errors=M.prologueIssues(q,{classes:data.classes,companions:data.companions}),p=q.prologue,all=q.stages.flatMap(s=>[...(s.dialogue||[]),...(s.prologue?.after||[])]).concat(p.chapter?.lines||[]),original=all.filter(l=>l.source==='original').length;
  app.innerHTML=sectionHead('序章劇情','修改造物室的旁白、對話、選項文字、教學提示與轉場文字。系統事件（命名、選職業、技能教學、訓練戰、臨時隊友、發放裝備、降臨）由遊戲程式執行，固定綁定在各階段。',`<span class="pill">開發者原文 ${original} 句</span><span class="pill">暫定續寫 ${all.length-original} 句</span>`)
   +(errors.length?`<div class="notice bad prologue-errors"><b>序章資料有 ${errors.length} 個問題，修正前無法發布：</b><ul>${errors.map(e=>`<li>${esc(e)}</li>`).join('')}</ul></div>`:'')
   +`<nav class="prologue-scenes" aria-label="場景">${p.scenes.map(s=>`<button data-pl-scene="${s.id}" class="${s.id===scene?'primary':''}">${s.id}. ${esc(s.name)}</button>`).join('')}</nav>`
   +`<section class="prologue-scene-edit"><div class="prologue-fields">${input('場景名稱',['prologue','scenes',scene-1,'name'])}${input('場景說明',['prologue','scenes',scene-1,'description'],{area:true})}</div>${q.stages.map((s,i)=>s.prologue.scene===scene?stageHTML(q,i):'').join('')}</section>`+sharedHTML(q)+previewHTML(q);
  }
  app.querySelectorAll('[data-pl-scene]').forEach(el=>el.onclick=()=>{scene=Number(el.dataset.plScene);render();});
  app.querySelectorAll('[data-pl]').forEach(el=>el.onchange=()=>{const path=JSON.parse(el.dataset.pl),key=path.at(-1);set(path,el.value,el.tagName==='SELECT'||path.includes('scenes')||key==='name');});
  app.querySelectorAll('[data-pl-steps]').forEach(el=>el.onchange=()=>set(JSON.parse(el.dataset.plSteps),el.value.split('\n').map(t=>t.trim()).filter(Boolean),false));
  app.querySelectorAll('[data-pl-add]').forEach(el=>el.onclick=()=>addLine(JSON.parse(el.dataset.plAdd)));
  app.querySelectorAll('[data-pl-remove]').forEach(el=>el.onclick=()=>removeLine(JSON.parse(el.dataset.plRemove),Number(el.dataset.index)));
  app.querySelectorAll('[data-pl-move]').forEach(el=>el.onclick=()=>moveLine(JSON.parse(el.dataset.plMove),Number(el.dataset.index),Number(el.dataset.delta)));
  const only=document.getElementById('prologueDraftOnly');if(only)only.onchange=()=>{draftOnly=only.checked;render();};
 }
 // The same operations the controls use; text only. Stage ids, order and system bindings are not reachable from here.
 const changed=(message,redraw=true)=>{markDirty(message);if(redraw&&currentSection==='prologue')render();};
 const lineList=path=>{const a=get(path),k=path.at(-1);if(!Array.isArray(a)||!['dialogue','after','lines'].includes(k)||v2(quest())&&!(path.length===3&&path[0]==='stages'&&path[1]===0&&k==='dialogue'))throw Error('不是可編輯的對話清單');return a;};
 function set(path,value,redraw=true){const parent=get(path.slice(0,-1)),key=path.at(-1);if(v2(quest())&&!editableV2(path)||!parent||!Object.hasOwn(parent,key)||typeof parent[key]==='object'&&!(key==='steps'&&Array.isArray(value))||['id','next','action','scene','job','version','type','entry'].includes(key))throw Error('這個欄位不能在序章劇情編輯');parent[key]=value;changed('已修改序章文字',redraw);}
 function addLine(path,line={}){lineList(path).push({speaker:quest().npc||'女神',kind:'npc',text:'',source:'draft',...line});changed('已新增序章對話');}
 function removeLine(path,index){lineList(path).splice(index,1);changed('已刪除序章對話');}
 function moveLine(path,index,delta){const a=lineList(path),j=index+delta;if(j<0||j>=a.length)return;[a[index],a[j]]=[a[j],a[index]];changed('已調整序章對話順序');}
 function seed(){const q=M.prologueQuest(STORY_SEED);if(!q||quest())return false;data.story.quests.push(M.copy(q));changed('已加入預設序章');return true;}
 SECTION_META.push(['prologue','序章劇情']);
 const group=NAV_GROUPS.find(g=>g[0]==='questsJournal');if(group)group[2].unshift('prologue');else NAV_GROUPS.push(['prologue','序章劇情',['prologue']]);
 const baseRender=render;render=function(...args){if(currentSection!=='prologue')return baseRender(...args);ensureArrays();renderNav(true);page();};
 const baseCount=count;count=function(section,normalized=false){if(section!=='prologue')return baseCount(section,normalized);ensureArrays();const q=quest();return q?q.stages.reduce((n,s)=>n+(s.dialogue?.length||0)+(s.prologue?.after?.length||0),0)+(q.prologue.chapter?.lines?.length||0):0;};
 globalThis.__EMBERWILD_PROLOGUE_EDITOR={quest,seed,set,addLine,removeLine,moveLine,issues:()=>{const q=quest();return q?M.prologueIssues(q,{classes:data.classes,companions:data.companions}):['沒有序章任務'];},open(n=1){scene=n;currentSection='prologue';render();},get scene(){return scene;}};
})();
