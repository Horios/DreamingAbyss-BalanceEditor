/* Developer mode: edit balance data from dialogs opened on the game screen itself.
   Each kind registers how to load, describe and save a record; saving goes through the editor's guarded API,
   then the draft is applied to the preview. New kinds (monsters, skills, items...) plug into EDITORS. */
(()=>{'use strict';
const $=id=>document.getElementById(id),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const FAMILIES=['林地／風','礦坑／物理','沼澤／暗','山脊／冰','熔火／火','星隕／暗'];
// Field types: text, number, select, check, color. `when(record)` hides a field; `create` limits it to new records.
const EDITORS={
 map:{
  title:(t,r)=>t.create?'新增地圖':'編輯地圖 · '+r.name,
  section:'world',
  load(t,shell){
   if(t.create){const maps=shell.bridge().maps(),last=maps.filter(m=>!m.final).at(-1)||{min:1,max:5,family:0};return {mapType:'normal',name:'新地圖',min:last.max+1,max:last.max+5,family:(last.family+1)%6,icon:'',color:'#34324a',parallel:true,eliteEnabled:true,eliteChance:.12,bossEnabled:true,overlevelVoucherGold:100+300*Math.floor(last.max/5)};}
   const row=shell.bridge().maps()[t.index];if(!row)throw Error('找不到地圖 '+t.index);return row;
  },
  fields:[
   {key:'mapType',label:'地圖類型',type:'select',options:[['normal','一般地圖'],['final','終局地圖（自訂首領關卡）']],create:true},
   {key:'name',label:'顯示名稱',type:'text'},
   {key:'min',label:'最低等級',type:'number',min:1,step:1},
   {key:'max',label:'最高等級',type:'number',min:1,step:1},
   {key:'family',label:'區域家族',type:'select',options:FAMILIES.map((n,i)=>[String(i),i+'｜'+n])},
   {key:'icon',label:'圖示文字',type:'text'},
   {key:'color',label:'介面色碼',type:'color'},
   {key:'parallel',label:'平行／追加區域',type:'check'},
   {key:'eliteEnabled',label:'啟用菁英',type:'check',when:r=>r.mapType!=='final'},
   {key:'eliteChance',label:'菁英遭遇率（0～1）',type:'number',min:0,max:1,step:.001,when:r=>r.mapType!=='final'},
   {key:'bossEnabled',label:'啟用 BOSS',type:'check',when:r=>r.mapType!=='final'},
   {key:'overlevelVoucherGold',label:'超等收益券金幣（每張）',type:'number',min:0,step:1,when:r=>r.mapType!=='final'}
  ],
  note:(t,r)=>t.create?'新地圖會自動建立 1 隻普通怪與 BOSS，可在完整設定中調整怪物。':r.core?'前 7 張核心地圖不能變更類型或刪除。':'怪物 '+r.monsters+' 隻；怪物與掉落請在完整設定調整。',
  save(t,values,shell){const {mapType,...patch}=values;return t.create?shell.bridge().createMap(mapType,patch):shell.bridge().saveMap(t.index,patch);},
  after(t,result,shell){shell.game()?.contentWindow.__EMBERWILD_V2_GAME?.selectMap(result.index);},
  context:(t,result)=>({mapIndex:result?.index??t.index})
 }
};
let current=null;
function dialog(){
 let d=$('devInlineDialog');if(d)return d;
 d=document.createElement('dialog');d.id='devInlineDialog';d.className='dev-inline-dialog';d.setAttribute('aria-labelledby','devInlineTitle');
 d.innerHTML='<form method="dialog" id="devInlineForm"><h2 id="devInlineTitle"></h2><p id="devInlineNote" class="muted"></p><div id="devInlineFields" class="dev-inline-fields"></div><p id="devInlineError" class="dev-inline-error" role="alert"></p><div class="dev-inline-actions"><button type="button" id="devInlineFull">在總控模式開啟</button><span class="spacer"></span><button type="button" id="devInlineCancel">取消</button><button type="submit" id="devInlineSave" class="primary">儲存並套用預覽</button></div></form>';
 document.body.append(d);
 const style=document.createElement('style');style.textContent='.dev-inline-dialog{border:1px solid var(--gold);border-radius:12px;background:var(--panel);color:var(--text);padding:18px;width:min(560px,calc(100vw - 32px));max-height:calc(100dvh - 40px);overflow:auto}.dev-inline-dialog::backdrop{background:#0008}.dev-inline-dialog h2{margin:0 0 4px;font-size:17px}.dev-inline-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:12px 0}.dev-inline-fields label{display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--muted);min-width:0}.dev-inline-fields label.check{flex-direction:row;align-items:center;gap:8px;color:var(--text)}.dev-inline-fields input:not([type=checkbox]),.dev-inline-fields select{width:100%;min-width:0;border:1px solid var(--line);background:var(--control);color:var(--text);border-radius:7px;padding:6px 8px;font:inherit}.dev-inline-fields input[type=color]{padding:2px;height:34px}.dev-inline-error{color:#e49a8a;font-size:12px;white-space:pre-wrap;min-height:1em;margin:0 0 8px}.dev-inline-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.dev-inline-actions .spacer{flex:1}@media(max-width:460px){.dev-inline-fields{grid-template-columns:1fr}}';
 document.head.append(style);
 $('devInlineCancel').onclick=()=>d.close();
 $('devInlineForm').onsubmit=e=>{e.preventDefault();save();};
 $('devInlineFull').onclick=()=>{const c=current;d.close();if(c)c.shell.open(c.editor.section,c.editor.context(c.target));};
 return d;
}
function input(f,v){
 const id='devInline-'+f.key;
 if(f.type==='check')return `<label class="check"><input id="${id}" type="checkbox" data-key="${f.key}" ${v?'checked':''}>${esc(f.label)}</label>`;
 if(f.type==='select')return `<label>${esc(f.label)}<select id="${id}" data-key="${f.key}">${f.options.map(([k,n])=>`<option value="${esc(k)}" ${String(v)===k?'selected':''}>${esc(n)}</option>`).join('')}</select></label>`;
 const attrs=['min','max','step'].filter(a=>f[a]!==undefined).map(a=>`${a}="${f[a]}"`).join(' ');
 return `<label>${esc(f.label)}<input id="${id}" data-key="${f.key}" type="${f.type==='number'?'number':f.type==='color'?'color':'text'}" ${attrs} value="${esc(v)}"></label>`;
}
function draw(){
 const {editor,target,record}=current;
 $('devInlineTitle').textContent=editor.title(target,record);$('devInlineNote').textContent=editor.note?.(target,record)||'';
 $('devInlineFields').innerHTML=editor.fields.filter(f=>(!f.create||target.create)&&(!f.when||f.when(record))).map(f=>input(f,record[f.key])).join('');
 for(const el of $('devInlineFields').querySelectorAll('[data-key]'))el.onchange=()=>{record[el.dataset.key]=read(el);if(el.dataset.key==='mapType')draw();};
}
function read(el){const f=current.editor.fields.find(x=>x.key===el.dataset.key);if(f.type==='check')return el.checked;if(f.type==='number')return el.value===''?NaN:Number(el.value);if(f.key==='family')return Number(el.value);return el.value;}
function values(){const out={};for(const el of $('devInlineFields').querySelectorAll('[data-key]'))out[el.dataset.key]=read(el);return out;}
function save(){
 const {editor,target,shell}=current,result=editor.save(target,values(),shell);
 if(!result?.ok){$('devInlineError').textContent='無法儲存：'+(result?.error||'未知錯誤');return false;}
 dialog().close();shell.apply();editor.after?.(target,result,shell);
 shell.status((target.create?'已新增並套用至預覽：':'已更新並套用至預覽：')+(values().name||'')+'。尚未發布。');return true;
}
function open(target,shell){
 const editor=EDITORS[target?.kind];if(!editor)return false;
 try{current={editor,target,shell,record:structuredClone(editor.load(target,shell))};}catch(e){shell.status('無法開啟：'+e.message);return false;}
 const d=dialog();$('devInlineError').textContent='';draw();if(!d.open)d.showModal();$('devInlineFields').querySelector('input,select')?.focus();return true;
}
globalThis.DreamingAbyssInlineEdit=Object.freeze({open,kinds:()=>Object.keys(EDITORS),save});
})();
