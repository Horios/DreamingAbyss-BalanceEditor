from pathlib import Path
p=Path('balance-editor.html')
t=p.read_text(encoding='utf-8')
old="const PAIN_SUPPORT={id:'pain-spread',name:'苦痛蔓延',description:'指定攻擊力最高的夥伴，使其下一次單體技能對額外最多 2 名敵人造成 30% 傷害。',target:'rankedAllies',statusTarget:'rankedAllies',statusTargetStat:'attack',statusTargetOrder:'highest',statusTargetIncludeSelf:false,kind:'applyStatus',statusId:'pain-spread',element:'light',value:0,effectPerLevel:0,duration:99,cooldown:16,level:1};"
new="const PAIN_SUPPORT={id:'pain-spread',name:'苦痛蔓延',description:'指定攻擊力最高的夥伴，使其下一次單體技能對額外最多 2 名敵人造成 30% 傷害。',target:'rankedAllies',statusTarget:'rankedAllies',statusTargetStat:'attack',statusTargetOrder:'highest',statusTargetIncludeSelf:false,kind:'applyStatus',statusId:'pain-spread',element:'light',value:0,effectPerLevel:0,duration:99,cooldown:16,level:1,unlockConditions:{classMasteryLevel:0,quests:[],materials:[],bossKills:[],eliteKills:[],bossEquipment:[]},mastery:'light',requiredMastery:null,requiredMasteryLevel:0,weaponTypes:[],iconType:'auto'};"
if old in t:t=t.replace(old,new,1)
elif new not in t:raise SystemExit('Pain Spread support schema marker not found')
p.write_text(t,encoding='utf-8')
