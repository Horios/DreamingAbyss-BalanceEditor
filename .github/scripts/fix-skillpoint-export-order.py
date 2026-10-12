from pathlib import Path
p=Path('balance-editor.html')
t=p.read_text(encoding='utf-8')
old="const exportBase=cleanMasteryExport;cleanMasteryExport=function(){const out=cleanSkillPointFields(exportBase());out.notes=(out.notes||[]).filter(x=>!String(x).includes('技能點'));out.notes.push('主角技能不使用技能點；unlockConditions 可指定 BOSS 擊殺、菁英擊殺與持有 BOSS 裝備等永久解鎖條件。');return out;};"
new="const exportBase=typeof cleanMasteryExport==='function'?cleanMasteryExport:null;if(exportBase)cleanMasteryExport=function(){const out=cleanSkillPointFields(exportBase());out.notes=(out.notes||[]).filter(x=>!String(x).includes('技能點'));out.notes.push('主角技能不使用技能點；unlockConditions 可指定 BOSS 擊殺、菁英擊殺與持有 BOSS 裝備等永久解鎖條件。');return out;};"
if old in t:t=t.replace(old,new,1)
elif new not in t:raise SystemExit('skill-point export compatibility marker not found')
p.write_text(t,encoding='utf-8')
