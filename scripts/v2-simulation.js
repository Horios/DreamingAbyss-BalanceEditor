/* Developer-mode simulations: the current draft runs in a hidden copy of the real game on a virtual clock.
   Results never touch the visible preview, the saved draft or publishing. */
(()=>{'use strict';
const $=id=>document.getElementById(id),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const STAT_LABELS={hp:'生命',atk:'攻擊',def:'防禦',crit:'暴擊率',critDamage:'暴擊傷害',pierce:'穿透',defenseIgnore:'無視防禦',lifesteal:'吸血',evasion:'閃避',elementBonus:'屬性加成',bossDamage:'首領傷害',speed:'速度',mp:'魔力'};
const FIXED_LABELS={gearAtkPct:'此裝備基礎攻擊 %',gearHpPct:'此裝備基礎生命 %',gearDefPct:'此裝備基礎防禦 %',attackPct:'角色總攻擊力 %',crit:'暴擊率 %',critDamage:'暴擊傷害 %',pierce:'防禦穿透（固定）',defenseIgnore:'防禦無視 %',lifesteal:'生命竊取 %',evasion:'閃避率 %',elementBonus:'全元素傷害 %',flatHp:'固定生命',basicElement:'普通攻擊屬性'};
const SLOT_LABELS=['武器','頭部','身體','手部','飾品'];
const HELP={level:'從新存檔開始探索第一個地區，記錄主角每次升級的時間。三人隊伍會加入前兩位可招募的夥伴。',skill:'主角只裝這一個技能，對高血量標靶打指定秒數，記錄施放次數與間隔。被動技能改為比較開關前後的能力值。',equipment:'讓對應職業穿上這個裝備型態（無詞綴），比較穿戴前後的能力值。'};
let mode='level',busy=false,bridge=()=>null,doc=()=>null;
function stat(key){return STAT_LABELS[key]||key;}
function num(v){return typeof v==='number'?(Math.abs(v)<10&&!Number.isInteger(v)?v.toFixed(3).replace(/0+$/,'').replace(/\.$/,''):String(Math.round(v*100)/100)):'—';}
function time(seconds){if(seconds==null)return '—';const m=Math.floor(seconds/60),s=Math.round(seconds%60);return m?`${m} 分 ${s} 秒`:`${s} 秒`;}
function skillOptions(d){
 const classes=d.classes||[],rows=(d.skillSystem?.definitions||[]).filter(s=>!s.deleted&&s.partnerId==null&&Array.isArray(s.jobs)&&s.jobs.length);
 return classes.map((c,j)=>{const list=rows.filter(s=>s.jobs[0]===j);return list.length?`<optgroup label="${esc(c.name)}">${list.map(s=>`<option value="${esc(s.id)}">${esc(s.name)}（${esc({active:'主動',proc:'觸發',support:'輔助',passive:'被動'}[s.type]||s.type)}）</option>`).join('')}</optgroup>`:'';}).join('');
}
function formOptions(d){
 const classes=d.classes||[];return (d.equipmentForms||[]).map((slots,j)=>`<optgroup label="${esc(classes[j]?.name||('職業 '+j))}">${slots.map((list,slot)=>list.map(f=>`<option value="${esc(f.id)}">${esc(SLOT_LABELS[slot]||('部位 '+slot))} · ${esc(f.name)}</option>`).join('')).join('')}</optgroup>`).join('');
}
function form(){
 const d=doc();$('simHelp').textContent=HELP[mode];
 for(const b of document.querySelectorAll('#simTabs [data-sim]'))b.setAttribute('aria-pressed',String(b.dataset.sim===mode));
 if(!d){$('simForm').innerHTML='<p class="muted wide">編輯器尚未載入。</p>';return;}
 if(mode==='level')$('simForm').innerHTML=`<label>職業<select id="simJob">${(d.classes||[]).map((c,j)=>`<option value="${j}">${esc(c.name)}</option>`).join('')}</select></label><label>隊伍<select id="simParty"><option value="0">主角單人</option><option value="2">三人隊伍</option></select></label><label>試算時間<select id="simMinutes"><option value="10">10 分鐘</option><option value="30" selected>30 分鐘</option><option value="60">60 分鐘</option></select></label>`;
 else if(mode==='skill'){
  $('simForm').innerHTML=`<label class="wide">技能<select id="simSkill">${skillOptions(d)}</select></label><label>戰鬥秒數<select id="simSeconds"><option value="30">30 秒</option><option value="60" selected>60 秒</option><option value="120">120 秒</option></select></label>`;
  const selected=bridge()?.selectedSkill?.();if(selected&&[...$('simSkill').options].some(o=>o.value===selected))$('simSkill').value=selected;
 }else $('simForm').innerHTML=`<label class="wide">裝備型態<select id="simForm1">${formOptions(d)}</select></label><label>裝備階級<input id="simTier" type="number" min="1" max="20" step="1" value="1"></label>`;
}
function frame(){
 return new Promise((resolve,reject)=>{
  const f=document.createElement('iframe');f.src='/v2-game/?sim=1';f.title='模擬用遊戲';f.setAttribute('aria-hidden','true');f.tabIndex=-1;f.style.cssText='position:fixed;left:0;top:0;width:360px;height:240px;opacity:.01;z-index:-1;pointer-events:none;border:0';
  document.body.append(f);const deadline=Date.now()+90000;
  const check=()=>{try{if(f.contentWindow.__EMBERWILD_V2_SIM?.ready)return resolve(f);}catch{}if(Date.now()>deadline){f.remove();reject(Error('模擬用遊戲載入逾時'));}else setTimeout(check,100);};check();
 });
}
async function runOne(label,draft,request,share,offset,pending){
 const f=await pending;
 try{const api=f.contentWindow.__EMBERWILD_V2_SIM,progress=p=>{$('simProgress').value=offset+p*share;};
  const result=request.kind==='level'?await api.levelPace(draft,request.params,progress):request.kind==='skill'?await api.skillTrial(draft,request.params,progress):api.equipmentStats(draft,request.params);
  return {label,result:JSON.parse(JSON.stringify(result))};
 }finally{f.remove();}
}
function levelTable(rows){
 const levels=[...new Set(rows.flatMap(r=>r.result.reached.map(x=>x.level)))].sort((a,b)=>a-b).filter(l=>l>1);
 const first=rows[0].result;
 return `<p>${esc(first.companions.length?'隊伍：主角、'+first.companions.join('、'):'隊伍：主角單人')} · 試算 ${first.minutes} 分鐘</p><table><thead><tr><th>等級</th>${rows.map(r=>`<th>${esc(r.label)}</th>`).join('')}</tr></thead><tbody>${levels.map(l=>`<tr><td>Lv${l}</td>${rows.map(r=>`<td>${time(r.result.reached.find(x=>x.level===l)?.seconds)}</td>`).join('')}</tr>`).join('')}</tbody></table>`
  +rows.map(r=>`<p>${esc(r.label)}：最後 Lv${r.result.finalLevel}，擊殺 ${r.result.kills}${r.result.stoppedAt!=null?`，<span class="sim-error">隊伍在 ${time(r.result.stoppedAt)} 停止探索</span>`:''}</p>`).join('');
}
function changeTable(title,rows,pick){
 const keys=[...new Set(rows.flatMap(r=>pick(r.result).map(x=>x.key)))];
 if(!keys.length)return `<h3>${esc(title)}</h3><p>能力值沒有變化。</p>`;
 return `<h3>${esc(title)}</h3><table><thead><tr><th>能力</th>${rows.map(r=>`<th>${esc(r.label)}</th>`).join('')}</tr></thead><tbody>${keys.map(k=>`<tr><td>${esc(stat(k))}</td>${rows.map(r=>{const x=pick(r.result).find(x=>x.key===k);return `<td>${x?`${num(x.before)} → <span class="${x.after>=x.before?'up':'down'}">${num(x.after)}</span>`:'無變化'}</td>`;}).join('')}</tr>`).join('')}</tbody></table>`;
}
function skillTable(rows){
 const r0=rows[0].result;if(r0.type==='passive')return `<p>${esc(r0.name)}（被動）</p>`+changeTable('開啟後的能力值',rows,r=>r.statChanges);
 const line=(name,fn)=>`<tr><td>${name}</td>${rows.map(r=>`<td>${fn(r.result)}</td>`).join('')}</tr>`;
 return `<p>${esc(r0.name)} · ${r0.seconds} 秒</p><table><thead><tr><th>項目</th>${rows.map(r=>`<th>${esc(r.label)}</th>`).join('')}</tr></thead><tbody>`
  +line('設定冷卻',r=>r.cooldown!=null?r.cooldown+' 秒':'—')+line('設定耗魔',r=>num(r.mpCost))+line('施放／觸發次數',r=>r.casts)+line('最短間隔',r=>r.minGap!=null?num(r.minGap)+' 秒':'—')+line('最長間隔',r=>r.maxGap!=null?num(r.maxGap)+' 秒':'—')+line('普攻次數',r=>r.basicAttacks)+line('總傷害（含普攻）',r=>r.damage.toLocaleString())+line('最低魔力',r=>r.lowestMp)+'</tbody></table>';
}
function equipmentTable(rows){
 const r0=rows[rows.length-1].result;
 return `<p>${esc(r0.name)} · 階級 ${r0.tier} · 需求 Lv${r0.requiredLevel}</p><h3>固定效果</h3><table><thead><tr><th>效果</th>${rows.map(r=>`<th>${esc(r.label)}</th>`).join('')}</tr></thead><tbody>${[...new Set(rows.flatMap(r=>r.result.fixedEffects.map(x=>x.key)))].map(k=>`<tr><td>${esc(FIXED_LABELS[k]||k)}</td>${rows.map(r=>{const v=r.result.fixedEffects.find(x=>x.key===k)?.value;return `<td>${typeof v==='number'?num(v):esc(v??'—')}</td>`;}).join('')}</tr>`).join('')}</tbody></table>`+changeTable('穿戴前後的能力值',rows,r=>r.changes);
}
async function run(){
 if(busy)return;const b=bridge();if(!b)return;
 let draft;try{draft=b.current();b.validate(draft);}catch(e){$('simResult').innerHTML=`<p class="sim-error">草稿無法試算：${esc(e.message)}</p>`;return;}
 const request=mode==='level'?{kind:'level',params:{job:Number($('simJob').value),companions:Number($('simParty').value),minutes:Number($('simMinutes').value)}}
  :mode==='skill'?{kind:'skill',params:{skillId:$('simSkill').value,seconds:Number($('simSeconds').value)}}
  :{kind:'equipment',params:{formId:$('simForm1').value,tier:Number($('simTier').value)}};
 const runs=$('simCompare').checked?[['遊戲內建資料',null],['工作草稿',draft]]:[['工作草稿',draft]];
 busy=true;$('simRun').disabled=true;$('simProgress').hidden=false;$('simProgress').value=0;$('simResult').innerHTML='<p>試算中，畫面可繼續操作。</p>';
 try{
  const frames=runs.map(()=>frame());frames.forEach(f=>f.catch(()=>{}));const rows=[];
  try{for(const [i,[label,d]] of runs.entries())rows.push(await runOne(label,d,request,1/runs.length,i/runs.length,frames[i]));}
  finally{for(const f of frames)f.then(x=>x.remove(),()=>{});}
  $('simResult').innerHTML=request.kind==='level'?levelTable(rows):request.kind==='skill'?skillTable(rows):equipmentTable(rows);
 }catch(e){$('simResult').innerHTML=`<p class="sim-error">試算失敗：${esc(e.message)}</p>`;}
 finally{busy=false;$('simRun').disabled=false;$('simProgress').hidden=true;}
}
function show(){$('devSimPanel').hidden=false;$('devEditor').hidden=true;$('devSim').setAttribute('aria-pressed','true');form();}
function hide(){$('devSimPanel').hidden=true;$('devEditor').hidden=false;$('devSim')?.setAttribute('aria-pressed','false');}
function enable(getBridge){bridge=getBridge;doc=()=>{try{return bridge()?.current();}catch{return null;}};$('devSim').disabled=false;}
document.addEventListener('DOMContentLoaded',()=>{
 for(const b of document.querySelectorAll('#simTabs [data-sim]'))b.onclick=()=>{mode=b.dataset.sim;form();};
 $('simRun').onclick=run;
});
globalThis.DreamingAbyssSimulation=Object.freeze({show,hide,enable,toggle(){if($('devSimPanel').hidden)show();else hide();},get busy(){return busy;}});
})();
