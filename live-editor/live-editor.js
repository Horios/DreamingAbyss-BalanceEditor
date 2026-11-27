/* 夢淵 即時平衡器（Live Balance Editor）
 * 注入遊戲頁面後，在畫面右下角提供編輯面板。
 * - 點字改字：點畫面上的任何文字，寫入 textOverrides。
 * - 點選定位：點畫面上的道具、技能、夥伴、怪物等，找出對應資料並開啟編輯。
 * - 資料分類：所有平衡資料都能以欄位或 JSON 編輯，改完立即套用到遊戲。
 * - 一鍵匯出完整 balance JSON。
 * 只使用遊戲公開的 validateBalanceConfig / applyBalanceConfig / exportableBalance / EmberwildTextOverrides。
 */
(()=>{
'use strict';
if(globalThis.__DA_LIVE_EDITOR__)return;
globalThis.__DA_LIVE_EDITOR__=true;

const VERSION='1.0.0';
const DRAFT_KEY='da-live-editor-draft-v1';
const UI_KEY='da-live-editor-ui-v1';
const clone=v=>JSON.parse(JSON.stringify(v));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const store={get(k){try{return localStorage.getItem(k);}catch{return null;}},set(k,v){try{localStorage.setItem(k,v);return true;}catch{return false;}},del(k){try{localStorage.removeItem(k);}catch{}}};

// 資料分類：path 指向陣列或物件；label 決定清單顯示名稱
const CATEGORIES=[
 {id:'items',name:'道具',path:['items']},
 {id:'skills',name:'技能',path:['skillSystem','definitions']},
 {id:'gems',name:'寶石',path:['skillSystem','gems']},
 {id:'classRules',name:'職業技能規則',path:['skillSystem','classRules']},
 {id:'skillEquip',name:'裝備技能池',path:['skillSystem','equipment']},
 {id:'classes',name:'職業',path:['classes']},
 {id:'support',name:'輔助技能',path:['supportSkills']},
 {id:'companions',name:'夥伴',path:['companions']},
 {id:'passives',name:'被動',path:['passiveDefinitions']},
 {id:'companionSettings',name:'夥伴設定',path:['companionSettings']},
 {id:'tokens',name:'信物',path:['companionTokens','catalog']},
 {id:'monsters',name:'怪物',path:['balanceSettings','monsters','catalog']},
 {id:'monsterRules',name:'怪物規則',path:['balanceSettings','monsters']},
 {id:'maps',name:'地圖',path:['balanceSettings','maps']},
 {id:'drops',name:'掉落',path:['balanceSettings','drops']},
 {id:'statuses',name:'狀態',path:['statusDefinitions']},
 {id:'forms',name:'裝備類型',path:['equipmentForms']},
 {id:'power',name:'裝備強度',path:['equipmentPowerSystem']},
 {id:'shop',name:'商店',path:['shopSettings']},
 {id:'story',name:'劇情任務',path:['story','quests']},
 {id:'quests',name:'委託',path:['balanceSettings','quests']},
 {id:'tutorials',name:'教學',path:['tutorials','modules']},
 {id:'wishing',name:'許願池',path:['wishingLake']},
 {id:'crafting',name:'製作',path:['crafting']},
 {id:'starter',name:'新手包',path:['starterPacks']},
 {id:'settings',name:'遊戲設定',path:['balanceSettings']},
 {id:'combat',name:'戰鬥公式',path:['balance']},
 {id:'uiText',name:'介面標題',path:['uiText']},
 {id:'navigation',name:'選單',path:['navigation']},
 {id:'icons',name:'背包圖示',path:['inventoryIcons']},
 {id:'root',name:'全部資料',path:[]}
];
const LABEL_KEYS=['name','title','label','text','id','key','type'];

let base=null;          // 遊戲啟動時的發布資料
let draft=null;         // 目前編輯中的完整文件
let history=[],future=[];
let ui={open:false,tab:'data',cat:'items',path:null,filter:'',auto:true,x:null};
try{Object.assign(ui,JSON.parse(store.get(UI_KEY)||'{}'));}catch{}
let pickMode=null;      // 'text' | 'inspect' | null
let applyTimer=null,lastStatus={ok:true,msg:'尚未修改'};
let pendingText=null;   // {source,original,text}
let inspectResults=[];

// ---------- 路徑工具 ----------
function getAt(obj,path){let cur=obj;for(const k of path){if(cur==null)return undefined;cur=cur[k];}return cur;}
function setAt(obj,path,value){if(!path.length)return value;let cur=obj;for(let i=0;i<path.length-1;i++)cur=cur[path[i]];cur[path[path.length-1]]=value;return obj;}
function pathText(path){return path.length?path.map(k=>typeof k==='number'?'['+k+']':'.'+k).join('').replace(/^\./,''):'（根）';}
function labelOf(v,k){
 if(v&&typeof v==='object'&&!Array.isArray(v)){
  for(const key of LABEL_KEYS)if(typeof v[key]==='string'&&v[key].trim()){const id=v.id!=null&&key!=='id'?' · '+v.id:'';return v[key]+id;}
  for(const key of LABEL_KEYS)if(typeof v[key]==='number')return key+' '+v[key];
 }
 if(Array.isArray(v)){const named=v.find(x=>x&&typeof x==='object'&&typeof x.name==='string');return (typeof k==='number'?'#'+k+' ':'')+(named?named.name+' 等 ':'')+v.length+' 筆';}
 if(v===null||typeof v!=='object')return String(k)+'：'+String(v).slice(0,40);
 return String(k);
}

// ---------- 套用與草稿 ----------
function signature(doc){const s=JSON.stringify(doc);let h=0;for(let i=0;i<s.length;i+=7)h=(h*31+s.charCodeAt(i))|0;return s.length+':'+h;}
function saveDraft(){store.set(DRAFT_KEY,JSON.stringify({base:signature(base),draft}));}
function commit(mutator,{label}={}){
 history.push(JSON.stringify(draft));if(history.length>80)history.shift();future=[];
 mutator();saveDraft();
 if(ui.auto)scheduleApply();else setStatus(true,'已修改（尚未套用）'+(label?'：'+label:''));
 refreshBadge();
}
function scheduleApply(){clearTimeout(applyTimer);applyTimer=setTimeout(applyDraft,350);}
function applyDraft(){
 clearTimeout(applyTimer);
 try{
  const doc=clone(draft);
  validateBalanceConfig(clone(doc));
  applyBalanceConfig(doc,{persist:false});
  globalThis.__EMBERWILD_BALANCE_SOURCE=clone(draft);
  try{if(typeof render==='function'&&globalThis.state)render();}catch(e){console.warn('[即時平衡器] 重繪失敗',e);}
  setStatus(true,'已套用到遊戲 · '+new Date().toLocaleTimeString());
  return true;
 }catch(e){
  console.warn('[即時平衡器] 套用失敗',e);
  setStatus(false,'套用失敗：'+(e?.message||e));
  return false;
 }
}
function setStatus(ok,msg){lastStatus={ok,msg};const el=root?.querySelector('[data-status]');if(el){el.textContent=msg;el.className='status '+(ok?'ok':'bad');}}
function undo(){if(!history.length)return;future.push(JSON.stringify(draft));draft=JSON.parse(history.pop());saveDraft();applyDraft();renderPanel();}
function redo(){if(!future.length)return;history.push(JSON.stringify(draft));draft=JSON.parse(future.pop());saveDraft();applyDraft();renderPanel();}

function countDiff(a,b,limit=5000){
 let n=0;const walk=(x,y)=>{if(n>limit)return;
  if(x===y)return;
  if(typeof x!=='object'||typeof y!=='object'||x===null||y===null||Array.isArray(x)!==Array.isArray(y)){n++;return;}
  const keys=new Set([...Object.keys(x),...Object.keys(y)]);for(const k of keys)walk(x[k],y[k]);};
 walk(a,b);return n;
}
function diffList(a,b,limit=300){
 const out=[];const walk=(x,y,p)=>{if(out.length>=limit)return;
  if(x===y)return;
  if(typeof x!=='object'||typeof y!=='object'||x===null||y===null||Array.isArray(x)!==Array.isArray(y)){out.push({path:p,from:x,to:y});return;}
  const keys=new Set([...Object.keys(x),...Object.keys(y)]);for(const k of keys)walk(x[k],y[k],p.concat(Array.isArray(y)?Number(k):k));};
 walk(a,b,[]);return out;
}

// ---------- 匯出／匯入 ----------
function exportJSON(){
 if(!applyDraft()&&!confirm('目前草稿未通過遊戲驗證：\n'+lastStatus.msg+'\n\n仍要匯出草稿原樣嗎？'))return;
 let out;
 try{out=lastStatus.ok?exportableBalance():clone(draft);}catch(e){out=clone(draft);}
 // exportableBalance 會帶入已安裝的 textOverrides；草稿為準
 if(draft.textOverrides?.entries?.length)out.textOverrides=clone(draft.textOverrides);else delete out.textOverrides;
 const text=JSON.stringify(out,null,2)+'\n';
 const d=new Date(),stamp=d.getFullYear()+String(d.getMonth()+1).padStart(2,'0')+String(d.getDate()).padStart(2,'0')+'-'+String(d.getHours()).padStart(2,'0')+String(d.getMinutes()).padStart(2,'0');
 const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type:'application/json'}));a.download='dreaming-abyss-balance-'+stamp+'.json';
 document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},1000);
 setStatus(true,'已匯出完整 JSON（'+Math.round(text.length/1024)+' KB）');
}
function importJSON(file){
 const r=new FileReader();r.onload=()=>{
  try{const doc=JSON.parse(r.result);if(doc.schema!=='emberwild-balance-v1')throw Error('schema 不是 emberwild-balance-v1');
   validateBalanceConfig(clone(doc));commit(()=>{draft=doc;});applyDraft();renderPanel();}
  catch(e){setStatus(false,'匯入失敗：'+e.message);}
 };r.readAsText(file);
}
function resetAll(){
 if(!confirm('捨棄所有修改，回到遊戲發布版本？'))return;
 commit(()=>{draft=clone(base);});applyDraft();renderPanel();
}

// ---------- 文字覆寫 ----------
function overrides(){if(!draft.textOverrides||typeof draft.textOverrides!=='object')draft.textOverrides={version:1,entries:[]};if(!Array.isArray(draft.textOverrides.entries))draft.textOverrides.entries=[];return draft.textOverrides.entries;}
function templateOf(s){const T=globalThis.EmberwildTextOverrides;const t=String(s).replace(/\s+/g,' ').trim();return T?.templateOf?T.templateOf(t):t.replace(/\d+(?:\.\d+)?/g,'{#}');}
function setOverride(source,text){
 source=templateOf(source);if(!source)return;
 commit(()=>{const list=overrides();const i=list.findIndex(x=>x.source===source);
  if(text==null||text===''||text===source){if(i>=0)list.splice(i,1);}
  else if(i>=0)list[i].text=text;else list.push({source,text});
  if(!list.length)delete draft.textOverrides;},{label:'文字'});
}
function textAtPoint(x,y,target){
 let node=null;
 if(document.caretPositionFromPoint){const p=document.caretPositionFromPoint(x,y);node=p?.offsetNode;}
 else if(document.caretRangeFromPoint){const r=document.caretRangeFromPoint(x,y);node=r?.startContainer;}
 if(node&&node.nodeType===3&&node.nodeValue.trim()&&target.contains(node))return {node};
 // 退而找目標元素內第一個非空文字節點
 const w=document.createTreeWalker(target,NodeFilter.SHOW_TEXT,{acceptNode:n=>n.nodeValue.trim()?1:3});
 const n=w.nextNode();if(n)return {node:n};
 for(const attr of ['placeholder','title','aria-label'])if(target.getAttribute?.(attr))return {node:target,attr};
 return null;
}
function originalText(hit){const T=globalThis.EmberwildTextOverrides;
 if(hit.attr)return T?.originalOf?T.originalOf(hit.node,hit.attr):hit.node.getAttribute(hit.attr);
 return T?.originalOf?T.originalOf(hit.node):hit.node.nodeValue;}

// ---------- 點選定位 ----------
function inspectElement(el){
 const texts=[];let cur=el;
 for(let i=0;i<6&&cur&&cur!==document.body;i++,cur=cur.parentElement){const t=(cur.innerText||cur.textContent||'').trim();if(t)texts.push(t.slice(0,4000));if(t.length>1500)break;}
 const near=texts[0]||'',wide=texts.join('\n');
 const found=[];
 const walk=(v,p,depth)=>{
  if(depth>9||!v||typeof v!=='object')return;
  if(!Array.isArray(v)){
   for(const key of ['name','title','label']){const s=v[key];
    if(typeof s==='string'&&s.trim().length>=2){
     const inNear=near.includes(s),inWide=!inNear&&wide.includes(s);
     if(inNear||inWide)found.push({path:p,name:s,score:(inNear?1000:0)+s.length*10-p.length,key});
    }}
  }
  if(p[0]==='_reference'||p[0]==='notes')return;
  for(const k of Object.keys(v))walk(v[k],p.concat(Array.isArray(v)?Number(k):k),depth+1);
 };
 walk(draft,[],0);
 found.sort((a,b)=>b.score-a.score);
 const seen=new Set();inspectResults=found.filter(f=>{const k=pathText(f.path);if(seen.has(k))return false;seen.add(k);return true;}).slice(0,40);
 inspectResults.clickedText=near.slice(0,120);
}

// ---------- 攔截畫面點擊 ----------
let hoverBox=null;
function onPointerMove(e){if(!pickMode||isOurs(e.target))return hideHover();const r=e.target.getBoundingClientRect();
 if(!hoverBox){hoverBox=document.createElement('div');hoverBox.setAttribute('data-text-override','off');hoverBox.style.cssText='position:fixed;pointer-events:none;z-index:2147483646;border:2px solid #f5b942;background:rgba(245,185,66,.12);border-radius:4px;transition:all .05s';document.documentElement.appendChild(hoverBox);}
 Object.assign(hoverBox.style,{display:'block',left:r.left+'px',top:r.top+'px',width:r.width+'px',height:r.height+'px'});}
function hideHover(){if(hoverBox)hoverBox.style.display='none';}
function isOurs(t){return t===host||host?.contains(t);}
function onClickCapture(e){
 if(!pickMode||isOurs(e.target))return;
 e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
 if(e.type!=='click')return;
 if(pickMode==='text'){
  const hit=textAtPoint(e.clientX,e.clientY,e.target);
  if(!hit){setStatus(false,'這裡沒有可改的文字');return;}
  const orig=String(originalText(hit)??'').replace(/\s+/g,' ').trim();
  const source=templateOf(orig);const existing=overrides().find(x=>x.source===source);
  pendingText={source,original:orig,text:existing?existing.text:source};
  ui.tab='text';
 }else if(pickMode==='inspect'){
  inspectElement(e.target);ui.tab='inspect';
 }
 pickMode=null;hideHover();ui.open=true;renderPanel();
}
for(const type of ['pointerdown','mousedown','pointerup','mouseup','click'])document.addEventListener(type,onClickCapture,true);
document.addEventListener('pointermove',onPointerMove,true);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&pickMode){pickMode=null;hideHover();renderPanel();}
 if((e.ctrlKey||e.metaKey)&&e.key==='z'&&isOurs(e.target)&&!/INPUT|TEXTAREA/.test(e.composedPath()[0]?.tagName||'')){e.preventDefault();e.shiftKey?redo():undo();}},true);

// ---------- 面板 ----------
let host,root;
const CSS=`
:host{all:initial}
*{box-sizing:border-box;font-family:system-ui,"Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif}
.fab{position:fixed;right:16px;bottom:16px;z-index:2147483647;border:0;border-radius:24px;padding:10px 16px;background:#2b2140;color:#f5d98a;font-size:14px;font-weight:700;box-shadow:0 4px 16px rgba(0,0,0,.45);cursor:pointer}
.fab b{background:#f5b942;color:#2b2140;border-radius:10px;padding:0 6px;margin-left:6px;font-size:12px}
.panel{position:fixed;right:12px;bottom:12px;top:12px;width:min(460px,calc(100vw - 24px));z-index:2147483647;background:#1b1626;color:#ece6f5;border:1px solid #4a3d66;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,.6);display:flex;flex-direction:column;font-size:13px;overflow:hidden}
.panel.left{right:auto;left:12px}
.head{display:flex;align-items:center;gap:6px;padding:8px 10px;background:#2b2140;border-bottom:1px solid #4a3d66;flex-wrap:wrap}
.head h1{font-size:14px;margin:0 auto 0 0;color:#f5d98a}
button{font:inherit;color:#ece6f5;background:#3a2e55;border:1px solid #5b4b80;border-radius:6px;padding:4px 9px;cursor:pointer}
button:hover{background:#4a3b6c}button.on{background:#f5b942;color:#2b2140;border-color:#f5b942}
button.primary{background:#6b4fd8;border-color:#8a70f0}button.danger{background:#6a2a3a;border-color:#a04058}
button:disabled{opacity:.4;cursor:default}
.tabs{display:flex;gap:2px;padding:6px 8px 0;background:#231c33;flex-wrap:wrap}
.tabs button{border-radius:6px 6px 0 0;border-bottom:0}
.body{flex:1;overflow:auto;padding:10px}
.foot{padding:6px 10px;border-top:1px solid #4a3d66;background:#231c33;display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.status{flex:1 1 100%;font-size:12px;min-height:16px;word-break:break-all}.status.ok{color:#8fe0a8}.status.bad{color:#ff8a9a}
input,textarea,select{font:inherit;color:#ece6f5;background:#120e1b;border:1px solid #4a3d66;border-radius:5px;padding:4px 6px;width:100%}
textarea{resize:vertical;min-height:54px;font-family:ui-monospace,Consolas,monospace;font-size:12px}
.row{display:flex;gap:6px;align-items:center;margin-bottom:6px}.row>*{flex:1}.row>.fit{flex:0 0 auto}
.cats{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px}.cats button{padding:3px 7px;font-size:12px}
.list{display:flex;flex-direction:column;gap:2px}
.item{display:flex;justify-content:space-between;gap:8px;padding:5px 8px;border-radius:5px;background:#241d34;cursor:pointer;text-align:left;border:1px solid transparent}
.item:hover{border-color:#6b4fd8}.item small{color:#a99cc4;white-space:nowrap}
.crumb{font-size:12px;color:#a99cc4;margin-bottom:8px;word-break:break-all}.crumb a{color:#c7b6ff;cursor:pointer;text-decoration:underline}
.field{display:grid;grid-template-columns:minmax(90px,38%) 1fr;gap:6px;align-items:start;padding:3px 0;border-bottom:1px dashed #2f2644}
.field>label{color:#c9bfe0;word-break:break-all;padding-top:4px;font-size:12px}
.field.changed>label{color:#f5b942}.field.changed>label::after{content:" ●"}
.nest{border-left:2px solid #3a2e55;padding-left:8px;margin:2px 0 4px}
details>summary{cursor:pointer;color:#c7b6ff;padding:3px 0;font-size:12px}
.hint{color:#a99cc4;font-size:12px;line-height:1.6;margin:4px 0 8px}
.card{background:#241d34;border:1px solid #3a2e55;border-radius:8px;padding:8px;margin-bottom:8px}
.diff{font-family:ui-monospace,Consolas,monospace;font-size:11px;word-break:break-all;padding:3px 0;border-bottom:1px solid #2f2644}
.diff del{color:#ff8a9a}.diff ins{color:#8fe0a8;text-decoration:none}
.picking{position:fixed;left:50%;top:10px;transform:translateX(-50%);z-index:2147483647;background:#f5b942;color:#2b2140;padding:8px 14px;border-radius:20px;font-weight:700;box-shadow:0 4px 12px rgba(0,0,0,.4);display:flex;gap:8px;align-items:center}
.picking button{background:#2b2140;color:#f5d98a}
`;
function mount(){
 host=document.createElement('div');host.id='da-live-editor';host.setAttribute('data-text-override','off');
 root=host.attachShadow({mode:'open'});document.documentElement.appendChild(host);
 root.addEventListener('click',onPanelClick);root.addEventListener('change',onPanelChange);root.addEventListener('input',onPanelInput);
 renderPanel();
}
function refreshBadge(){const b=root?.querySelector('[data-badge]');if(b)b.textContent=countDiff(base,draft);}

function renderPanel(){
 if(!root)return;
 store.set(UI_KEY,JSON.stringify({open:ui.open,tab:ui.tab,cat:ui.cat,auto:ui.auto,left:ui.left}));
 const diff=countDiff(base,draft);
 let html=`<style>${CSS}</style>`;
 if(pickMode)html+=`<div class="picking">${pickMode==='text'?'點選畫面上要修改的文字':'點選畫面上的道具、技能、夥伴、怪物等'}<button data-act="cancel-pick">取消（Esc）</button></div>`;
 if(!ui.open){root.innerHTML=html+`<button class="fab" data-act="open">平衡器<b data-badge>${diff}</b></button>`;return;}
 const tabs=[['data','資料'],['inspect','點選定位'],['text','文字'],['changes','變更 '+diff],['export','匯出']];
 html+=`<section class="panel${ui.left?' left':''}">
 <div class="head"><h1>夢淵 即時平衡器</h1>
  <button data-act="pick-inspect" title="點畫面元素找出資料">🎯 定位</button>
  <button data-act="pick-text" title="點畫面文字直接改字">✎ 改字</button>
  <button data-act="side" title="切換左右">⇆</button>
  <button data-act="close">收起</button></div>
 <div class="tabs">${tabs.map(([id,n])=>`<button class="${ui.tab===id?'on':''}" data-tab="${id}">${n}</button>`).join('')}</div>
 <div class="body">${renderTab()}</div>
 <div class="foot">
  <button data-act="undo" ${history.length?'':'disabled'}>↶ 復原</button>
  <button data-act="redo" ${future.length?'':'disabled'}>↷ 重做</button>
  <label style="display:flex;gap:4px;align-items:center;font-size:12px"><input type="checkbox" data-act="auto" style="width:auto" ${ui.auto?'checked':''}>自動套用</label>
  <button data-act="apply">套用到遊戲</button>
  <button class="primary" data-act="export">⬇ 匯出 JSON</button>
  <div class="status ${lastStatus.ok?'ok':'bad'}" data-status>${esc(lastStatus.msg)}</div>
 </div></section>`;
 const body=root.querySelector('.body'),scroll=body?.scrollTop||0;
 root.innerHTML=html;
 const nb=root.querySelector('.body');if(nb&&renderPanel.keepScroll)nb.scrollTop=scroll;renderPanel.keepScroll=false;
 const f=root.querySelector('[data-autofocus]');if(f){f.focus();f.select?.();}
}
function renderTab(){
 switch(ui.tab){
  case 'data':return renderData();
  case 'inspect':return renderInspect();
  case 'text':return renderText();
  case 'changes':return renderChanges();
  case 'export':return renderExport();
 }return '';
}

// 資料頁
function renderData(){
 const cat=CATEGORIES.find(c=>c.id===ui.cat)||CATEGORIES[0];
 let h=`<div class="cats">${CATEGORIES.map(c=>getAt(draft,c.path)===undefined?'':`<button class="${c.id===cat.id&&!ui.path?'on':''}" data-cat="${c.id}">${c.name}</button>`).join('')}</div>`;
 if(ui.path)return h+renderEditor(ui.path);
 const coll=getAt(draft,cat.path);
 h+=`<div class="row"><input data-filter placeholder="搜尋${cat.name}（名稱、ID、任何文字）" value="${esc(ui.filter)}"><button class="fit" data-open="${esc(JSON.stringify(cat.path))}">整組編輯</button></div>`;
 if(!coll||typeof coll!=='object')return h+`<p class="hint">此分類目前沒有資料。</p>`;
 const entries=Array.isArray(coll)?coll.map((v,i)=>[i,v]):Object.entries(coll);
 const q=ui.filter.trim().toLowerCase();
 const rows=entries.filter(([k,v])=>!q||(String(k)+JSON.stringify(v)).toLowerCase().includes(q));
 h+=`<div class="hint">${rows.length}／${entries.length} 筆 · 點選開啟編輯</div><div class="list">`;
 for(const [k,v] of rows.slice(0,400)){const p=cat.path.concat(k);const changed=JSON.stringify(getAt(base,p))!==JSON.stringify(v);
  h+=`<div class="item" data-open="${esc(JSON.stringify(p))}"><span>${changed?'<b style="color:#f5b942">● </b>':''}${esc(labelOf(v,k))}</span><small>${esc(Array.isArray(coll)?'#'+k:k)}</small></div>`;}
 if(rows.length>400)h+=`<p class="hint">僅顯示前 400 筆，請用搜尋縮小範圍。</p>`;
 if(Array.isArray(coll)&&coll.length&&coll.every(x=>x&&typeof x==='object'&&!Array.isArray(x)))h+=`</div><div class="row" style="margin-top:8px"><button data-act="dup-last" data-path="${esc(JSON.stringify(cat.path))}">＋ 複製最後一筆新增</button></div>`;
 else h+='</div>';
 return h;
}
function crumbs(path){
 let h='<div class="crumb">';const cat=CATEGORIES.slice().reverse().find(c=>c.path.length<=path.length&&c.path.every((k,i)=>path[i]===k));
 h+=`<a data-act="back">← 返回清單</a> · `;
 for(let i=0;i<=path.length;i++){const p=path.slice(0,i);const name=i===0?'根':String(path[i-1]);h+=(i?' › ':'')+(i===path.length?`<b>${esc(name)}</b>`:`<a data-open="${esc(JSON.stringify(p))}">${esc(name)}</a>`);}
 return h+'</div>';
}
function renderEditor(path){
 const v=getAt(draft,path);
 let h=crumbs(path);
 if(v===undefined)return h+'<p class="hint">此路徑已不存在。</p>';
 h+=`<div class="card"><b>${esc(labelOf(v,path[path.length-1]))}</b><div class="hint">${esc(pathText(path))}</div>`;
 h+=`<div class="row"><button data-act="raw" data-path="${esc(JSON.stringify(path))}">以 JSON 編輯</button>`;
 const parent=getAt(draft,path.slice(0,-1));
 if(Array.isArray(parent)){h+=`<button data-act="dup" data-path="${esc(JSON.stringify(path))}">複製一筆</button><button class="danger" data-act="del" data-path="${esc(JSON.stringify(path))}">刪除</button>`;}
 if(JSON.stringify(getAt(base,path))!==JSON.stringify(v)&&getAt(base,path)!==undefined)h+=`<button data-act="revert" data-path="${esc(JSON.stringify(path))}">還原此項</button>`;
 h+='</div></div>';
 if(ui.raw===pathText(path))return h+`<textarea data-raw style="min-height:50vh">${esc(JSON.stringify(v,null,2))}</textarea><div class="row" style="margin-top:6px"><button class="primary" data-act="raw-save" data-path="${esc(JSON.stringify(path))}">儲存 JSON</button><button data-act="raw-cancel">取消</button></div>`;
 return h+renderFields(v,path,0);
}
function renderFields(v,path,depth){
 if(v===null||typeof v!=='object')return fieldRow(path[path.length-1],v,path);
 const entries=Array.isArray(v)?v.map((x,i)=>[i,x]):Object.entries(v);
 let h='';
 for(const [k,x] of entries.slice(0,300)){
  const p=path.concat(k);
  if(x!==null&&typeof x==='object'){
   const big=JSON.stringify(x).length>2500||depth>=3;
   const changed=JSON.stringify(getAt(base,p))!==JSON.stringify(x);
   if(big)h+=`<div class="field${changed?' changed':''}"><label>${esc(k)}</label><div><a class="item" data-open="${esc(JSON.stringify(p))}" style="display:block">${esc(labelOf(x,k))} ›</a></div></div>`;
   else h+=`<details ${depth<1?'open':''}><summary>${changed?'<b style="color:#f5b942">● </b>':''}${esc(k)} · ${esc(labelOf(x,k))} <a data-open="${esc(JSON.stringify(p))}" style="color:#a99cc4">開啟</a></summary><div class="nest">${x.length===0||Object.keys(x).length===0?'<span class="hint">（空）</span>':renderFields(x,p,depth+1)}</div></details>`;
  }else h+=fieldRow(k,x,p);
 }
 if(entries.length>300)h+=`<p class="hint">還有 ${entries.length-300} 項，請用「以 JSON 編輯」。</p>`;
 if(Array.isArray(v)&&v.every(x=>x===null||typeof x!=='object'))h+=`<button data-act="push" data-path="${esc(JSON.stringify(path))}" style="margin:4px 0">＋ 新增一項</button>`;
 return h;
}
function fieldRow(k,x,p){
 const changed=getAt(base,p)!==x;const ps=esc(JSON.stringify(p));
 let input;
 if(typeof x==='boolean')input=`<input type="checkbox" data-field="${ps}" data-type="boolean" ${x?'checked':''} style="width:auto">`;
 else if(typeof x==='number')input=`<input type="number" step="any" data-field="${ps}" data-type="number" value="${x}">`;
 else if(x===null)input=`<input data-field="${ps}" data-type="json" value="null" title="以 JSON 輸入，例如 0、&quot;文字&quot;、null">`;
 else if(String(x).length>60||String(x).includes('\n'))input=`<textarea data-field="${ps}" data-type="string">${esc(x)}</textarea>`;
 else input=`<input data-field="${ps}" data-type="string" value="${esc(x)}">`;
 const delBtn=typeof p[p.length-1]==='number'?`<button class="fit" data-act="del" data-path="${ps}" title="刪除">✕</button>`:'';
 return `<div class="field${changed?' changed':''}" title="${esc(pathText(p))}${changed?'\n原值：'+esc(JSON.stringify(getAt(base,p))):''}"><label>${esc(k)}</label><div class="row" style="margin:0">${input}${delBtn}</div></div>`;
}

// 點選定位頁
function renderInspect(){
 let h=`<p class="hint">按「🎯 定位」後點選遊戲畫面上的道具、技能、夥伴、怪物、任務等，平衡器會依畫面文字找出對應資料。</p><button class="primary" data-act="pick-inspect">🎯 開始點選</button>`;
 if(inspectResults.clickedText!=null){
  h+=`<div class="card" style="margin-top:8px"><div class="hint">點到的文字：</div>${esc(inspectResults.clickedText)}</div>`;
  if(!inspectResults.length)h+='<p class="hint">找不到對應資料，可改用「✎ 改字」修改這段畫面文字。</p>';
  h+='<div class="list">';
  for(const r of inspectResults){const cat=CATEGORIES.slice(0,-1).find(c=>c.path.length&&c.path.every((k,i)=>r.path[i]===k));
   h+=`<div class="item" data-open="${esc(JSON.stringify(r.path))}" data-goto-data><span>${esc(r.name)}</span><small>${esc(cat?cat.name:'')} ${esc(pathText(r.path)).slice(0,40)}</small></div>`;}
  h+='</div>';
 }
 return h;
}

// 文字頁
function renderText(){
 let h=`<p class="hint">按「✎ 改字」後點選遊戲畫面上的任何文字即可修改。數字會自動視為 {#}，同一句原文全遊戲一起修改。</p><button class="primary" data-act="pick-text">✎ 開始點選文字</button>`;
 if(pendingText){
  h+=`<div class="card" style="margin-top:8px"><div class="hint">原文（比對用）</div><div style="margin-bottom:6px">${esc(pendingText.source)}</div>
  <textarea data-pending data-autofocus>${esc(pendingText.text)}</textarea>
  <div class="row" style="margin-top:6px"><button class="primary" data-act="text-save">儲存</button><button data-act="text-restore">還原原文</button><button data-act="text-cancel">取消</button></div></div>`;
 }
 const list=draft.textOverrides?.entries||[];
 h+=`<h3 style="font-size:13px;margin:12px 0 6px">已修改的文字（${list.length}）</h3><input data-tfilter placeholder="搜尋" value="${esc(ui.tfilter||'')}" style="margin-bottom:6px">`;
 const q=(ui.tfilter||'').toLowerCase();
 h+='<div class="list">'+list.map((x,i)=>[x,i]).filter(([x])=>!q||(x.source+x.text).toLowerCase().includes(q)).slice(0,300).map(([x,i])=>`<div class="field"><label title="${esc(x.source)}">${esc(x.source)}</label><div class="row" style="margin:0"><input data-otext="${i}" value="${esc(x.text)}"><button class="fit" data-act="text-del" data-i="${i}">✕</button></div></div>`).join('')+'</div>';
 const ut=draft.uiText;
 if(ut&&typeof ut==='object')h+=`<h3 style="font-size:13px;margin:12px 0 6px">介面標題（uiText）</h3>`+renderFields(ut,['uiText'],1);
 return h;
}

// 變更頁
function renderChanges(){
 const list=diffList(base,draft);
 if(!list.length)return '<p class="hint">與遊戲發布版本相同，沒有變更。</p>';
 let h=`<p class="hint">共 ${countDiff(base,draft)} 處與發布版本不同${list.length>=300?'（只列前 300 處）':''}。點路徑可開啟編輯。</p>`;
 for(const d of list){const target=d.path.length>1?d.path.slice(0,-1):d.path;
  h+=`<div class="diff"><a data-open="${esc(JSON.stringify(target))}" data-goto-data style="color:#c7b6ff;cursor:pointer">${esc(pathText(d.path))}</a><br><del>${esc(short(d.from))}</del> → <ins>${esc(short(d.to))}</ins> <button data-act="revert" data-path="${esc(JSON.stringify(d.path))}" style="font-size:11px;padding:0 5px">還原</button></div>`;}
 return h;
}
function short(v){if(v===undefined)return '（無）';const s=JSON.stringify(v);return s.length>120?s.slice(0,120)+'…':s;}

// 匯出頁
function renderExport(){
 return `<div class="card"><b>一鍵匯出</b><p class="hint">先以遊戲驗證並套用目前草稿，再輸出遊戲整理後的完整平衡 JSON（含文字覆寫），可直接放回遊戲的 data/balance.json，或用遊戲「匯入平衡資料」載入。</p><button class="primary" data-act="export">⬇ 匯出完整 JSON</button> <button data-act="copy">複製到剪貼簿</button></div>
 <div class="card"><b>匯入</b><p class="hint">讀入先前匯出的 JSON 繼續編輯。</p><input type="file" accept=".json,application/json" data-import></div>
 <div class="card"><b>重設</b><p class="hint">捨棄所有修改，回到遊戲目前發布的版本。草稿自動保存在此瀏覽器，重新整理後會自動套用。</p><button class="danger" data-act="reset">回到發布版本</button></div>
 <p class="hint">即時平衡器 v${VERSION} · 遊戲資料修訂 ${esc(globalThis.__EMBERWILD_BALANCE_MODULES?.dataRevision??'—')}</p>`;
}

// ---------- 事件 ----------
function pathAttr(el,name='data-path'){return JSON.parse(el.getAttribute(name));}
function onPanelClick(e){
 const t=e.target.closest('[data-act],[data-tab],[data-cat],[data-open]');if(!t)return;
 if(t.matches('input[type=checkbox]'))return;
 if(t.dataset.tab){ui.tab=t.dataset.tab;return renderPanel();}
 if(t.dataset.cat){ui.cat=t.dataset.cat;ui.path=null;ui.filter='';ui.raw=null;return renderPanel();}
 if(t.dataset.open&&!t.dataset.act){
  const p=pathAttr(t,'data-open');ui.raw=null;
  const cat=CATEGORIES.slice().reverse().find(c=>c.path.length<=p.length&&c.path.every((k,i)=>p[i]===k));
  if(cat)ui.cat=cat.id;
  if(cat&&JSON.stringify(cat.path)===JSON.stringify(p)&&p.length&&t.closest('.crumb'))ui.path=null;else ui.path=p;
  ui.tab='data';return renderPanel();
 }
 const act=t.dataset.act;
 switch(act){
  case 'open':ui.open=true;break;
  case 'close':ui.open=false;break;
  case 'side':ui.left=!ui.left;break;
  case 'pick-text':pickMode='text';break;
  case 'pick-inspect':pickMode='inspect';break;
  case 'cancel-pick':pickMode=null;hideHover();break;
  case 'undo':return undo();
  case 'redo':return redo();
  case 'apply':applyDraft();break;
  case 'export':return exportJSON();
  case 'copy':{applyDraft();let out;try{out=exportableBalance();}catch{out=clone(draft);}if(draft.textOverrides?.entries?.length)out.textOverrides=clone(draft.textOverrides);
   navigator.clipboard?.writeText(JSON.stringify(out,null,2)).then(()=>setStatus(true,'已複製完整 JSON'),()=>setStatus(false,'無法寫入剪貼簿'));return;}
  case 'reset':return resetAll();
  case 'back':ui.path=null;ui.raw=null;break;
  case 'raw':ui.raw=pathText(pathAttr(t));break;
  case 'raw-cancel':ui.raw=null;break;
  case 'raw-save':{const p=pathAttr(t);try{const v=JSON.parse(root.querySelector('[data-raw]').value);commit(()=>{draft=setAt(draft,p,v);});ui.raw=null;}catch(err){setStatus(false,'JSON 格式錯誤：'+err.message);return;}break;}
  case 'dup':{const p=pathAttr(t);const arr=getAt(draft,p.slice(0,-1));const i=p[p.length-1];commit(()=>{const c=clone(arr[i]);bumpId(c,arr);arr.splice(i+1,0,c);});ui.path=p.slice(0,-1).concat(i+1);break;}
  case 'dup-last':{const p=pathAttr(t);const arr=getAt(draft,p);commit(()=>{const c=clone(arr[arr.length-1]);bumpId(c,arr);arr.push(c);});ui.path=p.concat(arr.length-1);break;}
  case 'del':{const p=pathAttr(t);if(!confirm('刪除 '+pathText(p)+'？\n若其他資料引用此項，遊戲驗證會拒絕套用。'))return;const arr=getAt(draft,p.slice(0,-1));commit(()=>{arr.splice(p[p.length-1],1);});if(ui.path&&pathText(ui.path)===pathText(p))ui.path=p.slice(0,-1);break;}
  case 'push':{const p=pathAttr(t);const arr=getAt(draft,p);const sample=arr[arr.length-1];commit(()=>arr.push(typeof sample==='number'?0:typeof sample==='boolean'?false:''));renderPanel.keepScroll=true;break;}
  case 'revert':{const p=pathAttr(t);const orig=getAt(base,p);commit(()=>{if(orig===undefined){const par=getAt(draft,p.slice(0,-1));if(Array.isArray(par))par.splice(p[p.length-1],1);else delete par[p[p.length-1]];}else draft=setAt(draft,p,clone(orig));});renderPanel.keepScroll=true;break;}
  case 'text-save':{const v=root.querySelector('[data-pending]').value;setOverride(pendingText.source,v);pendingText=null;break;}
  case 'text-restore':setOverride(pendingText.source,null);pendingText=null;break;
  case 'text-cancel':pendingText=null;break;
  case 'text-del':{const i=Number(t.dataset.i);const s=overrides()[i]?.source;if(s)setOverride(s,null);renderPanel.keepScroll=true;break;}
 }
 renderPanel();
}
function bumpId(obj,arr){
 if(!obj||typeof obj!=='object')return;
 if(typeof obj.id==='string'){let n=2,id;do{id=obj.id.replace(/(-copy\d*)?$/,'')+'-copy'+n++;}while(arr.some(x=>x?.id===id));obj.id=id;}
 else if(typeof obj.id==='number'){obj.id=Math.max(...arr.map(x=>Number(x?.id)||0))+1;}
 if(typeof obj.name==='string')obj.name+='（複製）';
}
function onPanelChange(e){
 const t=e.target;
 if(t.matches('[data-act=auto]')){ui.auto=t.checked;if(ui.auto)applyDraft();return renderPanel();}
 if(t.matches('[data-import]')&&t.files[0])return importJSON(t.files[0]);
 if(t.matches('[data-field]')){
  const p=pathAttr(t,'data-field');let v;
  switch(t.dataset.type){
   case 'boolean':v=t.checked;break;
   case 'number':if(t.value===''){setStatus(false,'數字不可空白');return;}v=Number(t.value);break;
   case 'json':try{v=JSON.parse(t.value);}catch{v=t.value;}break;
   default:v=t.value;
  }
  commit(()=>{draft=setAt(draft,p,v);},{label:pathText(p)});
  renderPanel.keepScroll=true;renderPanel();
 }
 if(t.matches('[data-otext]')){const i=Number(t.dataset.otext);const s=overrides()[i]?.source;if(s)setOverride(s,t.value);renderPanel.keepScroll=true;renderPanel();}
}
function onPanelInput(e){
 const t=e.target;
 if(t.matches('[data-filter]')){ui.filter=t.value;const pos=t.selectionStart;renderPanel();const n=root.querySelector('[data-filter]');n.focus();n.setSelectionRange(pos,pos);}
 if(t.matches('[data-tfilter]')){ui.tfilter=t.value;const pos=t.selectionStart;renderPanel();const n=root.querySelector('[data-tfilter]');n.focus();n.setSelectionRange(pos,pos);}
 if(t.matches('[data-pending]')&&pendingText){pendingText.text=t.value;
  // 即時預覽，不寫入草稿
  const T=globalThis.EmberwildTextOverrides;if(T?.preview){const list=overrides().filter(x=>x.source!==pendingText.source);if(t.value&&t.value!==pendingText.source)list.push({source:pendingText.source,text:t.value});try{T.preview({version:1,entries:list});}catch{}}}
}

// ---------- 啟動 ----------
function boot(){
 if(typeof applyBalanceConfig!=='function'||typeof exportableBalance!=='function'){console.warn('[即時平衡器] 找不到遊戲平衡 API');return;}
 const published=globalThis.__EMBERWILD_PUBLISHED_BALANCE;
 try{base=clone(exportableBalance());}catch{base=clone(published);}
 draft=clone(base);
 const saved=store.get(DRAFT_KEY);
 if(saved){try{const s=JSON.parse(saved);if(s.base===signature(base)&&s.draft){draft=s.draft;mount();if(countDiff(base,draft))applyDraft();refreshBadge();return;}
  else if(s.draft&&confirm('即時平衡器：遊戲發布版本已更新，上次的草稿建立在舊版本上。\n要繼續使用舊草稿嗎？（取消＝從新版本重新開始）')){draft=s.draft;mount();applyDraft();return;}}catch{}}
 mount();
}
globalThis.DreamingAbyssLiveEditor={get draft(){return draft;},get base(){return base;},apply:applyDraft,export:exportJSON,setOverride,inspectElement,get inspectResults(){return inspectResults;},version:VERSION};
if(globalThis.emberwildBootComplete||globalThis.__EMBERWILD_BALANCE_READY)boot();
else addEventListener('emberwild-balance-ready',boot,{once:true});
})();
