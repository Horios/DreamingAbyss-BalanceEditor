/* Audit the existing canonical catalog. No second skill database or defaults. */
(()=>{
 'use strict';
 const M=EmberwildCombatMigration;let query='';
 SECTION_META.push(['combatMigration','秒數／MP 移植稽核']);
 const group=NAV_GROUPS.find(g=>g[0]==='tools');if(group)group[2].push('combatMigration');
 const validate=validateData;validateData=function(){const paths=M.unsupportedPaths(data);return paths.length?['秒數／MP 格式尚未接通：'+paths.slice(0,8).join('、')]:validate();};
 const clean=__EMBERWILD_MASTERY_EDITOR.cleanExport;
 __EMBERWILD_MASTERY_EDITOR.cleanExport=function(){M.assertSupported(data);return clean();};
 const previous=render;
 render=function(){
  if(currentSection!=='combatMigration')return previous();
  renderNav(true);const report=M.inspect(data),rows=report.rows.filter(r=>!query||(r.path+' '+r.owner+' '+r.category).toLowerCase().includes(query.toLowerCase()));
  document.getElementById('app').innerHTML=sectionHead('秒數／MP 戰鬥移植稽核','目前尚未切換秒數執行器。此頁會追蹤現有資料與相依；不自動換算或套入草案數值。')+
   card('資料與驗收範圍',`<p>${esc(report.note)}</p><p>共用技能 ${report.sharedSkills} 個；其中 ${report.activeNeedingMpDesign.length} 個主動／輔助技能尚待 MP 設計。</p><p>${Object.entries(report.counts).map(([k,n])=>esc(k)+' '+n+' 欄').join(' ／ ')}</p><ul>${report.checklist.map(s=>'<li>'+esc(s)+'</li>').join('')}</ul><button id="combatMigrationSkills">前往共用技能與機制索引</button>`)+
   card('既有時間與事件欄位',`<label>搜尋技能、單位或資料路徑<input id="combatMigrationSearch" value="${esc(query)}"></label><p>共 ${rows.length} 欄，顯示前 100 欄；輸入名稱或路徑可縮小範圍。</p><div style="overflow:auto"><table><thead><tr><th>對象／分類</th><th>資料路徑</th><th>目前值</th><th>移植處理</th></tr></thead><tbody>${rows.slice(0,100).map(r=>`<tr><td>${esc(r.owner)}<small>${esc(r.category)}</small></td><td><code>${esc(r.path)}</code></td><td>${esc(String(r.value))}</td><td>${esc(r.clock)}</td></tr>`).join('')}</tbody></table></div>`);
  document.getElementById('combatMigrationSearch').onchange=e=>{query=e.target.value;render();};
  document.getElementById('combatMigrationSkills').onclick=()=>{currentSection='skillSystem';render();};
  globalThis.__EMBERWILD_EXPERIENCE?.afterPage();
 };
 globalThis.__EMBERWILD_COMBAT_MIGRATION_AUDIT={scan:()=>M.inspect(data),open(){currentSection='combatMigration';render();}};
 requestEditorInitialRender();
})();
