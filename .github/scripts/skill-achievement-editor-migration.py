from pathlib import Path
import base64,json,re

path=Path('balance-editor.html')
text=path.read_text(encoding='utf-8')

EMPTY=lambda:{'classMasteryLevel':0,'quests':[],'materials':[],'bossKills':[],'eliteKills':[],'bossEquipment':[]}
def norm_unlock(sk):
    sk.pop('learnCost',None)
    raw=sk.get('unlockConditions') if isinstance(sk.get('unlockConditions'),dict) else {}
    out=EMPTY()
    try: out['classMasteryLevel']=max(0,int(raw.get('classMasteryLevel',0) or 0))
    except: out['classMasteryLevel']=0
    out['quests']=[str(x) for x in raw.get('quests',[]) if isinstance(x,str)]
    out['materials']=[{'name':str(x.get('name','')),'quantity':max(1,int(x.get('quantity',1) or 1))} for x in raw.get('materials',[]) if isinstance(x,dict) and x.get('name')]
    for key,valkey in [('bossKills','count'),('eliteKills','count'),('bossEquipment','quantity')]:
        rows=[]
        for x in raw.get(key,[]):
            if not isinstance(x,dict): continue
            try: mi=int(x.get('mapIndex',-1)); value=max(1,int(x.get(valkey,1) or 1))
            except: continue
            rows.append({'mapIndex':mi,valkey:value})
        out[key]=rows
    sk['unlockConditions']=out
    return out

def clean_doc(doc,seed=False):
    if not isinstance(doc,dict): return doc
    settings=doc.get('balanceSettings') if isinstance(doc.get('balanceSettings'),dict) else {}
    progression=settings.get('progression') if isinstance(settings.get('progression'),dict) else {}
    for group in ('starting','levelRewards'):
        if isinstance(progression.get(group),dict): progression[group].pop('skillPoints',None)
    if isinstance(doc.get('teamSettings'),dict): doc['teamSettings'].pop('defaultLearnCost',None)
    for cls in doc.get('classes') or []:
        for sk in (cls.get('skills') or []) if isinstance(cls,dict) else []: norm_unlock(sk)
    for skills in doc.get('supportSkills') or []:
        for sk in skills or []: norm_unlock(sk)
    if seed:
        for job,cls in enumerate(doc.get('classes') or []):
            skills=cls.get('skills') or [] if isinstance(cls,dict) else []
            if len(skills)>4:
                u=norm_unlock(skills[4]);u['bossKills']=[{'mapIndex':2,'count':1}]
            if len(skills)>5:
                u=norm_unlock(skills[5]);u['bossEquipment']=[{'mapIndex':3,'quantity':1}]
            supports=(doc.get('supportSkills') or [[]])[job] if job<len(doc.get('supportSkills') or []) else []
            if len(supports)>2:
                u=norm_unlock(supports[2]);u['eliteKills']=[{'mapIndex':2,'count':10}]
    notes=doc.setdefault('notes',[])
    if isinstance(notes,list):
        notes[:]=[x for x in notes if '技能點' not in str(x)]
        note='主角技能不再使用技能點；技能設計器可用 unlockConditions 指定 BOSS 擊殺、菁英擊殺與持有 BOSS 裝備等永久解鎖條件。'
        if note not in notes: notes.append(note)
    return doc

# Embedded initial JSON.
m=re.search(r'const ORIGINAL_B64\s*=\s*"([A-Za-z0-9+/=]+)";',text)
if not m: raise SystemExit('ORIGINAL_B64 not found')
doc=json.loads(base64.b64decode(m.group(1)).decode('utf-8'))
clean_doc(doc,seed=True)
encoded=base64.b64encode(json.dumps(doc,ensure_ascii=False,separators=(',',':')).encode('utf-8')).decode('ascii')
text=text[:m.start(1)]+encoded+text[m.end(1):]

# Static defaults / compatibility code: skill points are deleted, not zeroed.
text=text.replace('"dust":0,"skillPoints":2,"abilityPoints":0','"dust":0,"abilityPoints":0')
text=text.replace('"levelRewards":{"abilityPoints":3,"skillPoints":2}','"levelRewards":{"abilityPoints":3}')
text=text.replace('obj.balanceSettings.progression.starting.skillPoints=0;obj.balanceSettings.progression.levelRewards.skillPoints=0;','delete obj.balanceSettings.progression.starting.skillPoints;delete obj.balanceSettings.progression.levelRewards.skillPoints;')
text=text.replace('BALANCE_SETTINGS_DEFAULTS.progression.starting.skillPoints=0;BALANCE_SETTINGS_DEFAULTS.progression.levelRewards.skillPoints=0;','delete BALANCE_SETTINGS_DEFAULTS.progression.starting.skillPoints;delete BALANCE_SETTINGS_DEFAULTS.progression.levelRewards.skillPoints;')
text=re.sub(r'\s*"progression\.starting\.skillPoints":\[[^\n]+\],?','',text,count=1)
text=re.sub(r'\s*"progression\.levelRewards\.skillPoints":\[[^\n]+\],?','',text,count=1)
text=text.replace("'balanceSettings.progression.starting.skillPoints',",'').replace("'balanceSettings.progression.levelRewards.skillPoints',",'')
text=text.replace('舊版共用每級成長、基礎爆擊率、技能點與技能等級欄位只保留相容資料，不在正常 UI 顯示。','舊版共用每級成長、基礎爆擊率與技能等級欄位只保留相容資料；技能點機制已完全移除。')
text=text.replace('第一次大修：技能只有未學／已學；技能點與技能等級舊欄位不再參與正式計算。','技能只有未學／已學；技能點機制已移除，永久解鎖條件由 unlockConditions 控制。')

# Replace embedded team model with the final game source supplied by the migration workflow.
source_path=Path('.github/scripts/team-model-source.js')
if not source_path.exists(): raise SystemExit('team-model-source.js missing')
team_model=source_path.read_text(encoding='utf-8').rstrip('\n')
pattern=r'(<script id="team-model-v1">\n)(.*?)(\n</script>)'
text,n=re.subn(pattern,lambda mm:mm.group(1)+team_model+mm.group(3),text,count=1,flags=re.S)
if n!=1: raise SystemExit('embedded team model block not found')

addon=r'''<script id="skill-achievement-unlock-editor-v1">
(()=>{
 const emptyUnlock=()=>({classMasteryLevel:0,quests:[],materials:[],bossKills:[],eliteKills:[],bossEquipment:[]});
 const normalizeUnlock=sk=>{if(!sk)return emptyUnlock();delete sk.learnCost;const r=sk.unlockConditions&&typeof sk.unlockConditions==='object'?sk.unlockConditions:{},u=emptyUnlock();u.classMasteryLevel=Math.max(0,Math.floor(Number(r.classMasteryLevel)||0));u.quests=Array.isArray(r.quests)?r.quests.filter(x=>typeof x==='string'):[];u.materials=Array.isArray(r.materials)?r.materials.filter(x=>x&&typeof x.name==='string').map(x=>({name:x.name,quantity:Math.max(1,Math.floor(Number(x.quantity)||1))})):[];for(const [k,v] of [['bossKills','count'],['eliteKills','count'],['bossEquipment','quantity']])u[k]=Array.isArray(r[k])?r[k].filter(x=>x&&Number.isFinite(Number(x.mapIndex))).map(x=>({mapIndex:Math.floor(Number(x.mapIndex)),[v]:Math.max(1,Math.floor(Number(x[v])||1))})):[];sk.unlockConditions=u;return u;};
 const cleanupDoc=doc=>{if(!doc||typeof doc!=='object')return doc;delete doc.teamSettings?.defaultLearnCost;delete doc.balanceSettings?.progression?.starting?.skillPoints;delete doc.balanceSettings?.progression?.levelRewards?.skillPoints;for(const c of doc.classes||[])for(const sk of c?.skills||[])normalizeUnlock(sk);for(const list of doc.supportSkills||[])for(const sk of list||[])normalizeUnlock(sk);return doc;};
 const maps=()=>data.balanceSettings?.maps?.catalog||[];
 const currentSkill=()=>{const j=Math.max(0,Number(selected.skillClass)||0),i=Math.max(0,Number(selected.skill)||0);return selected.skillTab==='support'?data.supportSkills?.[j]?.[i]:data.classes?.[j]?.skills?.[i];};
 const mapLabel=i=>i<0?'任意區域':`${i}. ${maps()[i]?.name||MAP_NAMES?.[i]||('區域 '+i)}`;
 const mapOptions=(current,kind)=>{const values=[-1,...maps().map((_,i)=>i).filter(i=>kind==='eliteKills'?maps()[i]?.eliteEnabled!==false:maps()[i]?.bossEnabled!==false)];if(!values.includes(current))values.push(current);return values.map(i=>`<option value="${i}" ${i===current?'selected':''}>${esc(mapLabel(i))}</option>`).join('');};
 const section=(u,kind,title,valKey,buttonId)=>`<div class="mini-note" style="margin-top:10px"><b>${title}</b></div><div data-unlock-kind="${kind}">${u[kind].map((x,i)=>`<div class="fields" data-unlock-row="${kind}" data-index="${i}"><div class="field"><label>區域／BOSS</label><select data-unlock-map="${kind}" data-index="${i}">${mapOptions(x.mapIndex,kind)}</select></div><div class="field"><label>${valKey==='quantity'?'持有數量':'需求數量'}</label><input type="number" min="1" step="1" value="${x[valKey]}" data-unlock-value="${kind}" data-index="${i}"></div><div class="field"><label>&nbsp;</label><button type="button" data-unlock-remove="${kind}" data-index="${i}">移除</button></div></div>`).join('')}</div><div class="actions"><button type="button" id="${buttonId}">新增條件</button></div>`;
 const renderUnlockEditor=()=>{const sk=currentSkill(),app=document.getElementById('app');if(!sk||!app)return;const u=normalizeUnlock(sk);app.insertAdjacentHTML('beforeend',card('技能永久解鎖條件',`<div class="mini-note">技能不消耗技能點。以下條件與既有角色等級、二轉／精通需求同時成立才可學習；同一技能設定多筆條件時全部都必須達成。</div>${section(u,'bossKills','擊敗 BOSS','count','skillAddBossKill')}${section(u,'eliteKills','擊敗菁英怪','count','skillAddEliteKill')}${section(u,'bossEquipment','持有 BOSS 裝備','quantity','skillAddBossEquipment')}`));
  for(const kind of ['bossKills','eliteKills','bossEquipment']){const valKey=kind==='bossEquipment'?'quantity':'count';app.querySelectorAll(`[data-unlock-map="${kind}"]`).forEach(el=>el.onchange=()=>{u[kind][Number(el.dataset.index)].mapIndex=Number(el.value);markDirty();});app.querySelectorAll(`[data-unlock-value="${kind}"]`).forEach(el=>el.onchange=()=>{u[kind][Number(el.dataset.index)][valKey]=Math.max(1,Math.floor(Number(el.value)||1));el.value=u[kind][Number(el.dataset.index)][valKey];markDirty();});app.querySelectorAll(`[data-unlock-remove="${kind}"]`).forEach(el=>el.onclick=()=>{u[kind].splice(Number(el.dataset.index),1);markDirty();render();});}
  const add=(id,kind)=>{const b=document.getElementById(id);if(b)b.onclick=()=>{u[kind].push(kind==='bossEquipment'?{mapIndex:-1,quantity:1}:{mapIndex:-1,count:1});markDirty();render();};};add('skillAddBossKill','bossKills');add('skillAddEliteKill','eliteKills');add('skillAddBossEquipment','bossEquipment');
 };
 cleanupDoc(data);cleanupDoc(ORIGINAL_DATA);delete BALANCE_SETTINGS_DEFAULTS?.progression?.starting?.skillPoints;delete BALANCE_SETTINGS_DEFAULTS?.progression?.levelRewards?.skillPoints;
 const ensureBase=ensureArrays;ensureArrays=function(){const out=ensureBase();cleanupDoc(data);return out;};
 const skillRenderBase=renderSkills;renderSkills=function(){ensureArrays();skillRenderBase();document.getElementById('teamLearnCost')?.closest('.field')?.remove();renderUnlockEditor();};
 const exportBase=cleanMasteryExport;cleanMasteryExport=function(){const out=cleanupDoc(exportBase());out.notes=(out.notes||[]).filter(x=>!String(x).includes('技能點'));out.notes.push('主角技能不使用技能點；unlockConditions 可指定 BOSS 擊殺、菁英擊殺與持有 BOSS 裝備等永久解鎖條件。');return out;};
 const validateBase=validateData;validateData=function(){const issues=validateBase().filter(x=>!String(x).includes('技能點'));for(const [j,c] of (data.classes||[]).entries())for(const [i,sk] of (c.skills||[]).entries())try{EmberwildTeams.rules(sk)}catch(e){issues.push(`${CLASS_NAMES[j]} 技能 ${i+1} 解鎖條件：${e.message}`);}for(const [j,list] of (data.supportSkills||[]).entries())for(const [i,sk] of (list||[]).entries())try{EmberwildTeams.rules(sk)}catch(e){issues.push(`${CLASS_NAMES[j]} 輔助技能 ${i+1} 解鎖條件：${e.message}`);}return [...new Set(issues)];};
 const renderBase=render;render=function(...args){const out=renderBase(...args);document.getElementById('teamLearnCost')?.closest('.field')?.remove();document.querySelectorAll('[data-team-point-key="skillPoints"],[data-path$=".skillPoints"]').forEach(el=>(el.closest('.pathrow,.field')||el).remove());return out;};
})();
</script>'''
if 'skill-achievement-unlock-editor-v1' in text: raise SystemExit('achievement editor addon already present')
if '</body>' not in text: raise SystemExit('body close not found')
text=text.replace('</body>',addon+'\n</body>',1)

path.write_text(text,encoding='utf-8')

# Validate embedded payload after write.
written=path.read_text(encoding='utf-8')
mm=re.search(r'const ORIGINAL_B64\s*=\s*"([A-Za-z0-9+/=]+)";',written)
check=json.loads(base64.b64decode(mm.group(1)).decode('utf-8'))
assert 'skillPoints' not in check['balanceSettings']['progression']['starting']
assert 'skillPoints' not in check['balanceSettings']['progression']['levelRewards']
assert 'defaultLearnCost' not in check.get('teamSettings',{})
for job in range(min(4,len(check.get('classes',[])))):
    assert check['classes'][job]['skills'][4]['unlockConditions']['bossKills']==[{'mapIndex':2,'count':1}]
    assert check['classes'][job]['skills'][5]['unlockConditions']['bossEquipment']==[{'mapIndex':3,'quantity':1}]
    assert check['supportSkills'][job][2]['unlockConditions']['eliteKills']==[{'mapIndex':2,'count':10}]
if 'teamLearnCost' not in written: pass
