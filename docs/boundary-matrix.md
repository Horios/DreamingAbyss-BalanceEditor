# 數值欄位邊界值

由 `node scripts/boundary-probe.cjs` 產生，請勿手動修改。完整資料在 `boundary-matrix.json`。

749 個數值欄位（追溯矩陣中狀態為 `effective` 者），每個欄位取第一筆資料嘗試下列編輯。資料 SHA-256 `ea0e6baec855…`。

| 編輯 | 三個程式都保留 | 被拒絕 | 工作台保留、驗證器拒絕（發布停在驗證） | 工作台較嚴格 | 沒有錯誤但值被改變 |
|---|--:|--:|--:|--:|--:|
| 0 | 495 | 106 | 14 | 16 | 4 |
| -1 | 283 | 382 | 44 | 29 | 9 |
| 1e12 | 451 | 257 | 15 | 23 | 3 |
| 整數加 0.5 | 402 | 142 | 2 | 18 | 7 |
| 字串 "x" | 3 | 658 | 81 | 5 | 2 |
| null | 4 | 646 | 94 | 5 | 0 |

## 錯誤型別或 null 被整條鏈路保留（7）

| 欄位 | 模組 | 原值 | 編輯 | 遊戲 |
|---|---|---|---|---|
| `skillSystem.definitions.*.powerPerLevel` | `combat/skills` | 0 | 字串 "x" | preserved |
| `skillSystem.definitions.*.powerPerLevel` | `combat/skills` | 0 | null | preserved |
| `skillSystem.definitions.*.hitCount` | `combat/skills` | 1 | 字串 "x" | preserved |
| `skillSystem.definitions.*.hitCount` | `combat/skills` | 1 | null | preserved |
| `skillSystem.definitions.*.procChancePerLevel` | `combat/skills` | 0 | null | preserved |
| `skillSystem.definitions.*.statusMaxTargets` | `combat/skills` | 3 | 字串 "x" | preserved |
| `skillSystem.definitions.*.statusMaxTargets` | `combat/skills` | 3 | null | preserved |

## 沒有錯誤但值被改變（25）

| 欄位 | 模組 | 原值 | 編輯 | 工作台 | 驗證器 | 遊戲 |
|---|---|---|---|---|---|---|
| `balance.affixes.poolBySlotRank.*.*.*.max` | `equipment/affix-pools` | 1 | 整數加 0.5 | preserved | 改為 2 |  |
| `equipmentForms.*.*.*.fixedEffects.*.value` | `equipment/forms` | 5 | 字串 "x" | 改為 0 | 改為 0 |  |
| `balanceSettings.skills.mastery.characterXpMultiplier` | `combat/skill-settings` | 1 | 0 | 改為 1（還原） | 改為 1（還原） |  |
| `balanceSettings.skills.mastery.characterXpMultiplier` | `combat/skill-settings` | 1 | -1 | 改為 1（還原） | 改為 1（還原） |  |
| `balanceSettings.skills.mastery.xpBase` | `combat/skill-settings` | 8 | 0 | 改為 1 | 改為 1 |  |
| `balanceSettings.skills.mastery.xpBase` | `combat/skill-settings` | 8 | -1 | 改為 1 | 改為 1 |  |
| `balanceSettings.skills.mastery.xpLinear` | `combat/skill-settings` | 5 | -1 | 改為 0 | 改為 0 |  |
| `balanceSettings.skills.mastery.xpQuadratic` | `combat/skill-settings` | 1 | -1 | 改為 0 | 改為 0 |  |
| `balanceSettings.skills.mastery.skillUseXp` | `combat/skill-settings` | 2 | -1 | 改為 0 | 改為 0 |  |
| `balanceSettings.skills.mastery.basicAttackXp` | `combat/skill-settings` | 1 | -1 | 改為 0 | 改為 0 |  |
| `balanceSettings.skills.mastery.maxLevel` | `combat/skill-settings` | 30 | 整數加 0.5 | 改為 30（還原） | 改為 30（還原） |  |
| `balanceSettings.skills.mastery.advanceRequiredLevel` | `combat/skill-settings` | 4 | -1 | 改為 0 | 改為 0 |  |
| `balanceSettings.skills.mastery.advanceRequiredLevel` | `combat/skill-settings` | 4 | 整數加 0.5 | 改為 4（還原） | 改為 4（還原） |  |
| `statusDefinitions.*.duration` | `combat/statuses` | 99 | 0 | 改為 1 | 改為 1 |  |
| `statusDefinitions.*.duration` | `combat/statuses` | 99 | 1e12 | 改為 99（還原） | 改為 99（還原） |  |
| `statusDefinitions.*.duration` | `combat/statuses` | 99 | 整數加 0.5 | 改為 99（還原） | 改為 99（還原） |  |
| `statusDefinitions.*.modifiers.*.value` | `combat/statuses` | 0.3 | 字串 "x" | 改為 0 | 改為 0 |  |
| `statusDefinitions.*.modifiers.*.targets` | `combat/statuses` | 2 | 0 | 改為 1 | 改為 1 |  |
| `statusDefinitions.*.modifiers.*.targets` | `combat/statuses` | 2 | -1 | 改為 1 | 改為 1 |  |
| `statusDefinitions.*.modifiers.*.targets` | `combat/statuses` | 2 | 1e12 | 改為 99 | 改為 99 |  |
| `statusDefinitions.*.modifiers.*.targets` | `combat/statuses` | 2 | 整數加 0.5 | 改為 3 | 改為 3 |  |
| `statusDefinitions.*.uses` | `combat/statuses` | 1 | -1 | 改為 0 | 改為 0 |  |
| `statusDefinitions.*.uses` | `combat/statuses` | 1 | 1e12 | 改為 99 | 改為 99 |  |
| `statusDefinitions.*.uses` | `combat/statuses` | 1 | 整數加 0.5 | 改為 2 | 改為 2 |  |
| `starterPacks.*.*.growth.startLevel` | `items/starter-packs` | 1 | 整數加 0.5 | 改為 1（還原） | 改為 1（還原） |  |

## 工作台保留、驗證器拒絕（250）

| 欄位 | 模組 | 原值 | 編輯 | 驗證器 | 遊戲 |
|---|---|---|---|---|---|
| `balance.combat.elementMultipliers.neutral` | `equipment/affix-pools` | 1 | -1 | 拒絕：elementMultipliers.neutral 無效 |  |
| `balance.combat.elementMultipliers.neutral` | `equipment/affix-pools` | 1 | 字串 "x" | 拒絕：balance  balance.combat.elementMultipliers.neutral：型別必須為 number |  |
| `balance.combat.elementMultipliers.neutral` | `equipment/affix-pools` | 1 | null | 拒絕：balance  balance.combat.elementMultipliers.neutral：此欄位不可為 null |  |
| `balance.combat.elementMultipliers.same` | `equipment/affix-pools` | 0.8 | -1 | 拒絕：elementMultipliers.same 無效 |  |
| `balance.combat.elementMultipliers.same` | `equipment/affix-pools` | 0.8 | 字串 "x" | 拒絕：balance  balance.combat.elementMultipliers.same：型別必須為 number |  |
| `balance.combat.elementMultipliers.same` | `equipment/affix-pools` | 0.8 | null | 拒絕：balance  balance.combat.elementMultipliers.same：此欄位不可為 null |  |
| `balance.combat.elementMultipliers.strong` | `equipment/affix-pools` | 1.3 | -1 | 拒絕：elementMultipliers.strong 無效 |  |
| `balance.combat.elementMultipliers.strong` | `equipment/affix-pools` | 1.3 | 字串 "x" | 拒絕：balance  balance.combat.elementMultipliers.strong：型別必須為 number |  |
| `balance.combat.elementMultipliers.strong` | `equipment/affix-pools` | 1.3 | null | 拒絕：balance  balance.combat.elementMultipliers.strong：此欄位不可為 null |  |
| `balance.combat.elementMultipliers.weak` | `equipment/affix-pools` | 0.85 | -1 | 拒絕：elementMultipliers.weak 無效 |  |
| `balance.combat.elementMultipliers.weak` | `equipment/affix-pools` | 0.85 | 字串 "x" | 拒絕：balance  balance.combat.elementMultipliers.weak：型別必須為 number |  |
| `balance.combat.elementMultipliers.weak` | `equipment/affix-pools` | 0.85 | null | 拒絕：balance  balance.combat.elementMultipliers.weak：此欄位不可為 null |  |
| `balance.combat.statCaps.pierce` | `equipment/affix-pools` | 30 | 1e12 | 拒絕：statCaps.pierce 必須介於 0~10000 |  |
| `balance.combat.minimumActiveCooldown` | `equipment/affix-pools` | 1 | -1 | 拒絕：minimumActiveCooldown 無效 |  |
| `balance.combat.minimumActiveCooldown` | `equipment/affix-pools` | 1 | 字串 "x" | 拒絕：balance  balance.combat.minimumActiveCooldown：型別必須為 number |  |
| `balance.combat.minimumActiveCooldown` | `equipment/affix-pools` | 1 | null | 拒絕：balance  balance.combat.minimumActiveCooldown：此欄位不可為 null |  |
| `balance.affixes.qualityMultiplier.normal` | `equipment/affix-pools` | 1 | 字串 "x" | 拒絕：balance  balance.affixes.qualityMultiplier.normal：型別必須為 number |  |
| `balance.affixes.qualityMultiplier.normal` | `equipment/affix-pools` | 1 | null | 拒絕：balance  balance.affixes.qualityMultiplier.normal：此欄位不可為 null |  |
| `balance.affixes.qualityMultiplier.fine` | `equipment/affix-pools` | 1.4 | 字串 "x" | 拒絕：balance  balance.affixes.qualityMultiplier.fine：型別必須為 number |  |
| `balance.affixes.qualityMultiplier.fine` | `equipment/affix-pools` | 1.4 | null | 拒絕：balance  balance.affixes.qualityMultiplier.fine：此欄位不可為 null |  |
| `balance.affixes.qualityMultiplier.rare` | `equipment/affix-pools` | 1.9 | 字串 "x" | 拒絕：balance  balance.affixes.qualityMultiplier.rare：型別必須為 number |  |
| `balance.affixes.qualityMultiplier.rare` | `equipment/affix-pools` | 1.9 | null | 拒絕：balance  balance.affixes.qualityMultiplier.rare：此欄位不可為 null |  |
| `balance.affixes.qualityMultiplier.legendary` | `equipment/affix-pools` | 2.6 | 字串 "x" | 拒絕：balance  balance.affixes.qualityMultiplier.legendary：型別必須為 number |  |
| `balance.affixes.qualityMultiplier.legendary` | `equipment/affix-pools` | 2.6 | null | 拒絕：balance  balance.affixes.qualityMultiplier.legendary：此欄位不可為 null |  |
| `balance.affixes.skillSpecialChance` | `equipment/affix-pools` | 0.4 | 字串 "x" | 拒絕：balance  balance.affixes.skillSpecialChance：型別必須為 number |  |
| `balance.affixes.skillSpecialChance` | `equipment/affix-pools` | 0.4 | null | 拒絕：balance  balance.affixes.skillSpecialChance：此欄位不可為 null |  |
| `balance.affixes.skillEffectShare` | `equipment/affix-pools` | 0.72 | 字串 "x" | 拒絕：balance  balance.affixes.skillEffectShare：型別必須為 number |  |
| `balance.affixes.skillEffectShare` | `equipment/affix-pools` | 0.72 | null | 拒絕：balance  balance.affixes.skillEffectShare：此欄位不可為 null |  |
| `balance.affixes.extendedPoolChance` | `equipment/affix-pools` | 0.55 | 字串 "x" | 拒絕：balance  balance.affixes.extendedPoolChance：型別必須為 number |  |
| `balance.affixes.extendedPoolChance` | `equipment/affix-pools` | 0.55 | null | 拒絕：balance  balance.affixes.extendedPoolChance：此欄位不可為 null |  |
| `balance.affixes.procChancePerPointPercent` | `equipment/affix-pools` | 6 | 字串 "x" | 拒絕：balance  balance.affixes.procChancePerPointPercent：型別必須為 number |  |
| `balance.affixes.procChancePerPointPercent` | `equipment/affix-pools` | 6 | null | 拒絕：balance  balance.affixes.procChancePerPointPercent：此欄位不可為 null |  |
| `balance.affixes.baseValues.attackPerTier.min` | `equipment/affix-pools` | 0 | -1 | 拒絕：baseValues.attackPerTier 範圍無效 |  |
| `balance.affixes.baseValues.attackPerTier.min` | `equipment/affix-pools` | 0 | 字串 "x" | 拒絕：balance  balance.affixes.baseValues.attackPerTier.min：型別必須為 number |  |
| `balance.affixes.baseValues.attackPerTier.min` | `equipment/affix-pools` | 0 | null | 拒絕：balance  balance.affixes.baseValues.attackPerTier.min：此欄位不可為 null |  |
| `balance.affixes.baseValues.attackPerTier.max` | `equipment/affix-pools` | 1 | -1 | 拒絕：baseValues.attackPerTier 範圍無效 |  |
| `balance.affixes.baseValues.attackPerTier.max` | `equipment/affix-pools` | 1 | 字串 "x" | 拒絕：balance  balance.affixes.baseValues.attackPerTier.max：型別必須為 number |  |
| `balance.affixes.baseValues.attackPerTier.max` | `equipment/affix-pools` | 1 | null | 拒絕：balance  balance.affixes.baseValues.attackPerTier.max：此欄位不可為 null |  |
| `balance.affixes.baseValues.hpPerTier.min` | `equipment/affix-pools` | 1 | -1 | 拒絕：baseValues.hpPerTier 範圍無效 |  |
| `balance.affixes.baseValues.hpPerTier.min` | `equipment/affix-pools` | 1 | 字串 "x" | 拒絕：balance  balance.affixes.baseValues.hpPerTier.min：型別必須為 number |  |
| `balance.affixes.baseValues.hpPerTier.min` | `equipment/affix-pools` | 1 | null | 拒絕：balance  balance.affixes.baseValues.hpPerTier.min：此欄位不可為 null |  |
| `balance.affixes.baseValues.hpPerTier.max` | `equipment/affix-pools` | 3 | -1 | 拒絕：baseValues.hpPerTier 範圍無效 |  |
| `balance.affixes.baseValues.hpPerTier.max` | `equipment/affix-pools` | 3 | 字串 "x" | 拒絕：balance  balance.affixes.baseValues.hpPerTier.max：型別必須為 number |  |
| `balance.affixes.baseValues.hpPerTier.max` | `equipment/affix-pools` | 3 | null | 拒絕：balance  balance.affixes.baseValues.hpPerTier.max：此欄位不可為 null |  |
| `balance.affixes.baseValues.defensePerTier.min` | `equipment/affix-pools` | 0 | -1 | 拒絕：baseValues.defensePerTier 範圍無效 |  |
| `balance.affixes.baseValues.defensePerTier.min` | `equipment/affix-pools` | 0 | 字串 "x" | 拒絕：balance  balance.affixes.baseValues.defensePerTier.min：型別必須為 number |  |
| `balance.affixes.baseValues.defensePerTier.min` | `equipment/affix-pools` | 0 | null | 拒絕：balance  balance.affixes.baseValues.defensePerTier.min：此欄位不可為 null |  |
| `balance.affixes.baseValues.defensePerTier.max` | `equipment/affix-pools` | 1 | -1 | 拒絕：baseValues.defensePerTier 範圍無效 |  |
| `balance.affixes.baseValues.defensePerTier.max` | `equipment/affix-pools` | 1 | 字串 "x" | 拒絕：balance  balance.affixes.baseValues.defensePerTier.max：型別必須為 number |  |
| `balance.affixes.baseValues.defensePerTier.max` | `equipment/affix-pools` | 1 | null | 拒絕：balance  balance.affixes.baseValues.defensePerTier.max：此欄位不可為 null |  |
| `balance.affixes.baseValues.critPercent.min` | `equipment/affix-pools` | 2 | -1 | 拒絕：baseValues.critPercent 範圍無效 |  |
| `balance.affixes.baseValues.critPercent.min` | `equipment/affix-pools` | 2 | 字串 "x" | 拒絕：balance  balance.affixes.baseValues.critPercent.min：型別必須為 number |  |
| `balance.affixes.baseValues.critPercent.min` | `equipment/affix-pools` | 2 | null | 拒絕：balance  balance.affixes.baseValues.critPercent.min：此欄位不可為 null |  |
| `balance.affixes.baseValues.critPercent.max` | `equipment/affix-pools` | 4 | -1 | 拒絕：baseValues.critPercent 範圍無效 |  |
| `balance.affixes.baseValues.critPercent.max` | `equipment/affix-pools` | 4 | 字串 "x" | 拒絕：balance  balance.affixes.baseValues.critPercent.max：型別必須為 number |  |
| `balance.affixes.baseValues.critPercent.max` | `equipment/affix-pools` | 4 | null | 拒絕：balance  balance.affixes.baseValues.critPercent.max：此欄位不可為 null |  |
| `balance.affixes.baseValues.critPercent.cap` | `equipment/affix-pools` | 12 | -1 | 拒絕：baseValues.critPercent 範圍無效 |  |
| `balance.affixes.baseValues.critPercent.cap` | `equipment/affix-pools` | 12 | 字串 "x" | 拒絕：balance  balance.affixes.baseValues.critPercent.cap：型別必須為 number |  |
| `balance.affixes.baseValues.critPercent.cap` | `equipment/affix-pools` | 12 | null | 拒絕：balance  balance.affixes.baseValues.critPercent.cap：此欄位不可為 null |  |
| `balance.affixes.skillEffectPercent.normal` | `equipment/affix-pools` | 0 | 字串 "x" | 拒絕：balance  balance.affixes.skillEffectPercent.normal：型別必須為 number |  |
| `balance.affixes.skillEffectPercent.normal` | `equipment/affix-pools` | 0 | null | 拒絕：balance  balance.affixes.skillEffectPercent.normal：此欄位不可為 null |  |
| `balance.affixes.skillEffectPercent.fine` | `equipment/affix-pools` | 18 | 字串 "x" | 拒絕：balance  balance.affixes.skillEffectPercent.fine：型別必須為 number |  |
| `balance.affixes.skillEffectPercent.fine` | `equipment/affix-pools` | 18 | null | 拒絕：balance  balance.affixes.skillEffectPercent.fine：此欄位不可為 null |  |
| `balance.affixes.skillEffectPercent.rare` | `equipment/affix-pools` | 30 | 字串 "x" | 拒絕：balance  balance.affixes.skillEffectPercent.rare：型別必須為 number |  |
| `balance.affixes.skillEffectPercent.rare` | `equipment/affix-pools` | 30 | null | 拒絕：balance  balance.affixes.skillEffectPercent.rare：此欄位不可為 null |  |
| `balance.affixes.skillEffectPercent.legendary` | `equipment/affix-pools` | 45 | 字串 "x" | 拒絕：balance  balance.affixes.skillEffectPercent.legendary：型別必須為 number |  |
| `balance.affixes.skillEffectPercent.legendary` | `equipment/affix-pools` | 45 | null | 拒絕：balance  balance.affixes.skillEffectPercent.legendary：此欄位不可為 null |  |
| `balance.affixes.cooldownReduction.normal` | `equipment/affix-pools` | 0 | 字串 "x" | 拒絕：balance  balance.affixes.cooldownReduction.normal：型別必須為 number |  |
| `balance.affixes.cooldownReduction.normal` | `equipment/affix-pools` | 0 | null | 拒絕：balance  balance.affixes.cooldownReduction.normal：此欄位不可為 null |  |
| `balance.affixes.cooldownReduction.fine` | `equipment/affix-pools` | 1 | 字串 "x" | 拒絕：balance  balance.affixes.cooldownReduction.fine：型別必須為 number |  |
| `balance.affixes.cooldownReduction.fine` | `equipment/affix-pools` | 1 | null | 拒絕：balance  balance.affixes.cooldownReduction.fine：此欄位不可為 null |  |
| `balance.affixes.cooldownReduction.rare` | `equipment/affix-pools` | 1 | 字串 "x" | 拒絕：balance  balance.affixes.cooldownReduction.rare：型別必須為 number |  |
| `balance.affixes.cooldownReduction.rare` | `equipment/affix-pools` | 1 | null | 拒絕：balance  balance.affixes.cooldownReduction.rare：此欄位不可為 null |  |
| `balance.affixes.cooldownReduction.legendary` | `equipment/affix-pools` | 2 | 字串 "x" | 拒絕：balance  balance.affixes.cooldownReduction.legendary：型別必須為 number |  |
| `balance.affixes.cooldownReduction.legendary` | `equipment/affix-pools` | 2 | null | 拒絕：balance  balance.affixes.cooldownReduction.legendary：此欄位不可為 null |  |
| `balance.affixes.extendedValues.critDamage.normal` | `equipment/affix-pools` | 4 | 字串 "x" | 拒絕：balance  balance.affixes.extendedValues.critDamage.normal：型別必須為 number |  |
| `balance.affixes.extendedValues.critDamage.normal` | `equipment/affix-pools` | 4 | null | 拒絕：balance  balance.affixes.extendedValues.critDamage.normal：此欄位不可為 null |  |
| `balance.affixes.extendedValues.critDamage.fine` | `equipment/affix-pools` | 8 | 字串 "x" | 拒絕：balance  balance.affixes.extendedValues.critDamage.fine：型別必須為 number |  |
| `balance.affixes.extendedValues.critDamage.fine` | `equipment/affix-pools` | 8 | null | 拒絕：balance  balance.affixes.extendedValues.critDamage.fine：此欄位不可為 null |  |
| `balance.affixes.extendedValues.critDamage.rare` | `equipment/affix-pools` | 12 | 字串 "x" | 拒絕：balance  balance.affixes.extendedValues.critDamage.rare：型別必須為 number |  |
| `balance.affixes.extendedValues.critDamage.rare` | `equipment/affix-pools` | 12 | null | 拒絕：balance  balance.affixes.extendedValues.critDamage.rare：此欄位不可為 null |  |
| `balance.affixes.extendedValues.critDamage.legendary` | `equipment/affix-pools` | 16 | 字串 "x" | 拒絕：balance  balance.affixes.extendedValues.critDamage.legendary：型別必須為 number |  |
| `balance.affixes.extendedValues.critDamage.legendary` | `equipment/affix-pools` | 16 | null | 拒絕：balance  balance.affixes.extendedValues.critDamage.legendary：此欄位不可為 null |  |
| `balance.affixes.extendedValues.pierce.normal` | `equipment/affix-pools` | 1 | 字串 "x" | 拒絕：balance  balance.affixes.extendedValues.pierce.normal：型別必須為 number |  |
| `balance.affixes.extendedValues.pierce.normal` | `equipment/affix-pools` | 1 | null | 拒絕：balance  balance.affixes.extendedValues.pierce.normal：此欄位不可為 null |  |
| `balance.affixes.extendedValues.pierce.fine` | `equipment/affix-pools` | 2 | 字串 "x" | 拒絕：balance  balance.affixes.extendedValues.pierce.fine：型別必須為 number |  |
| `balance.affixes.extendedValues.pierce.fine` | `equipment/affix-pools` | 2 | null | 拒絕：balance  balance.affixes.extendedValues.pierce.fine：此欄位不可為 null |  |
| `balance.affixes.extendedValues.pierce.rare` | `equipment/affix-pools` | 4 | 字串 "x" | 拒絕：balance  balance.affixes.extendedValues.pierce.rare：型別必須為 number |  |
| `balance.affixes.extendedValues.pierce.rare` | `equipment/affix-pools` | 4 | null | 拒絕：balance  balance.affixes.extendedValues.pierce.rare：此欄位不可為 null |  |
| `balance.affixes.extendedValues.pierce.legendary` | `equipment/affix-pools` | 6 | 字串 "x" | 拒絕：balance  balance.affixes.extendedValues.pierce.legendary：型別必須為 number |  |
| `balance.affixes.extendedValues.pierce.legendary` | `equipment/affix-pools` | 6 | null | 拒絕：balance  balance.affixes.extendedValues.pierce.legendary：此欄位不可為 null |  |
| `balance.affixes.extendedValues.lifesteal.normal` | `equipment/affix-pools` | 1 | 字串 "x" | 拒絕：balance  balance.affixes.extendedValues.lifesteal.normal：型別必須為 number |  |
| `balance.affixes.extendedValues.lifesteal.normal` | `equipment/affix-pools` | 1 | null | 拒絕：balance  balance.affixes.extendedValues.lifesteal.normal：此欄位不可為 null |  |
| `balance.affixes.extendedValues.lifesteal.fine` | `equipment/affix-pools` | 2 | 字串 "x" | 拒絕：balance  balance.affixes.extendedValues.lifesteal.fine：型別必須為 number |  |
| `balance.affixes.extendedValues.lifesteal.fine` | `equipment/affix-pools` | 2 | null | 拒絕：balance  balance.affixes.extendedValues.lifesteal.fine：此欄位不可為 null |  |
| `balance.affixes.extendedValues.lifesteal.rare` | `equipment/affix-pools` | 3 | 字串 "x" | 拒絕：balance  balance.affixes.extendedValues.lifesteal.rare：型別必須為 number |  |
| `balance.affixes.extendedValues.lifesteal.rare` | `equipment/affix-pools` | 3 | null | 拒絕：balance  balance.affixes.extendedValues.lifesteal.rare：此欄位不可為 null |  |
| `balance.affixes.extendedValues.lifesteal.legendary` | `equipment/affix-pools` | 4 | 字串 "x" | 拒絕：balance  balance.affixes.extendedValues.lifesteal.legendary：型別必須為 number |  |
| `balance.affixes.extendedValues.lifesteal.legendary` | `equipment/affix-pools` | 4 | null | 拒絕：balance  balance.affixes.extendedValues.lifesteal.legendary：此欄位不可為 null |  |
| `balance.affixes.extendedValues.evasion.normal` | `equipment/affix-pools` | 2 | 字串 "x" | 拒絕：balance  balance.affixes.extendedValues.evasion.normal：型別必須為 number |  |
| `balance.affixes.extendedValues.evasion.normal` | `equipment/affix-pools` | 2 | null | 拒絕：balance  balance.affixes.extendedValues.evasion.normal：此欄位不可為 null |  |
| `balance.affixes.extendedValues.evasion.fine` | `equipment/affix-pools` | 4 | 字串 "x" | 拒絕：balance  balance.affixes.extendedValues.evasion.fine：型別必須為 number |  |
| `balance.affixes.extendedValues.evasion.fine` | `equipment/affix-pools` | 4 | null | 拒絕：balance  balance.affixes.extendedValues.evasion.fine：此欄位不可為 null |  |
| `balance.affixes.extendedValues.evasion.rare` | `equipment/affix-pools` | 6 | 字串 "x" | 拒絕：balance  balance.affixes.extendedValues.evasion.rare：型別必須為 number |  |
| `balance.affixes.extendedValues.evasion.rare` | `equipment/affix-pools` | 6 | null | 拒絕：balance  balance.affixes.extendedValues.evasion.rare：此欄位不可為 null |  |
| `balance.affixes.extendedValues.evasion.legendary` | `equipment/affix-pools` | 8 | 字串 "x" | 拒絕：balance  balance.affixes.extendedValues.evasion.legendary：型別必須為 number |  |
| `balance.affixes.extendedValues.evasion.legendary` | `equipment/affix-pools` | 8 | null | 拒絕：balance  balance.affixes.extendedValues.evasion.legendary：此欄位不可為 null |  |
| `balance.affixes.extendedValues.elementDamage.normal` | `equipment/affix-pools` | 5 | 字串 "x" | 拒絕：balance  balance.affixes.extendedValues.elementDamage.normal：型別必須為 number |  |
| `balance.affixes.extendedValues.elementDamage.normal` | `equipment/affix-pools` | 5 | null | 拒絕：balance  balance.affixes.extendedValues.elementDamage.normal：此欄位不可為 null |  |
| `balance.affixes.extendedValues.elementDamage.fine` | `equipment/affix-pools` | 10 | 字串 "x" | 拒絕：balance  balance.affixes.extendedValues.elementDamage.fine：型別必須為 number |  |
| `balance.affixes.extendedValues.elementDamage.fine` | `equipment/affix-pools` | 10 | null | 拒絕：balance  balance.affixes.extendedValues.elementDamage.fine：此欄位不可為 null |  |
| `balance.affixes.extendedValues.elementDamage.rare` | `equipment/affix-pools` | 15 | 字串 "x" | 拒絕：balance  balance.affixes.extendedValues.elementDamage.rare：型別必須為 number |  |
| `balance.affixes.extendedValues.elementDamage.rare` | `equipment/affix-pools` | 15 | null | 拒絕：balance  balance.affixes.extendedValues.elementDamage.rare：此欄位不可為 null |  |
| `balance.affixes.extendedValues.elementDamage.legendary` | `equipment/affix-pools` | 20 | 字串 "x" | 拒絕：balance  balance.affixes.extendedValues.elementDamage.legendary：型別必須為 number |  |
| `balance.affixes.extendedValues.elementDamage.legendary` | `equipment/affix-pools` | 20 | null | 拒絕：balance  balance.affixes.extendedValues.elementDamage.legendary：此欄位不可為 null |  |
| `balance.affixes.extendedValues.raceDamage.normal` | `equipment/affix-pools` | 5 | 字串 "x" | 拒絕：balance  balance.affixes.extendedValues.raceDamage.normal：型別必須為 number |  |
| `balance.affixes.extendedValues.raceDamage.normal` | `equipment/affix-pools` | 5 | null | 拒絕：balance  balance.affixes.extendedValues.raceDamage.normal：此欄位不可為 null |  |
| `balance.affixes.extendedValues.raceDamage.fine` | `equipment/affix-pools` | 10 | 字串 "x" | 拒絕：balance  balance.affixes.extendedValues.raceDamage.fine：型別必須為 number |  |
| `balance.affixes.extendedValues.raceDamage.fine` | `equipment/affix-pools` | 10 | null | 拒絕：balance  balance.affixes.extendedValues.raceDamage.fine：此欄位不可為 null |  |
| `balance.affixes.extendedValues.raceDamage.rare` | `equipment/affix-pools` | 15 | 字串 "x" | 拒絕：balance  balance.affixes.extendedValues.raceDamage.rare：型別必須為 number |  |
| `balance.affixes.extendedValues.raceDamage.rare` | `equipment/affix-pools` | 15 | null | 拒絕：balance  balance.affixes.extendedValues.raceDamage.rare：此欄位不可為 null |  |
| `balance.affixes.extendedValues.raceDamage.legendary` | `equipment/affix-pools` | 20 | 字串 "x" | 拒絕：balance  balance.affixes.extendedValues.raceDamage.legendary：型別必須為 number |  |
| `balance.affixes.extendedValues.raceDamage.legendary` | `equipment/affix-pools` | 20 | null | 拒絕：balance  balance.affixes.extendedValues.raceDamage.legendary：此欄位不可為 null |  |
| `balance.affixes.extendedValues.resist.normal` | `equipment/affix-pools` | 5 | 字串 "x" | 拒絕：balance  balance.affixes.extendedValues.resist.normal：型別必須為 number |  |
| `balance.affixes.extendedValues.resist.normal` | `equipment/affix-pools` | 5 | null | 拒絕：balance  balance.affixes.extendedValues.resist.normal：此欄位不可為 null |  |
| `balance.affixes.extendedValues.resist.fine` | `equipment/affix-pools` | 10 | 字串 "x" | 拒絕：balance  balance.affixes.extendedValues.resist.fine：型別必須為 number |  |
| `balance.affixes.extendedValues.resist.fine` | `equipment/affix-pools` | 10 | null | 拒絕：balance  balance.affixes.extendedValues.resist.fine：此欄位不可為 null |  |
| `balance.affixes.extendedValues.resist.rare` | `equipment/affix-pools` | 15 | 字串 "x" | 拒絕：balance  balance.affixes.extendedValues.resist.rare：型別必須為 number |  |
| `balance.affixes.extendedValues.resist.rare` | `equipment/affix-pools` | 15 | null | 拒絕：balance  balance.affixes.extendedValues.resist.rare：此欄位不可為 null |  |
| `balance.affixes.extendedValues.resist.legendary` | `equipment/affix-pools` | 20 | 字串 "x" | 拒絕：balance  balance.affixes.extendedValues.resist.legendary：型別必須為 number |  |
| `balance.affixes.extendedValues.resist.legendary` | `equipment/affix-pools` | 20 | null | 拒絕：balance  balance.affixes.extendedValues.resist.legendary：此欄位不可為 null |  |
| `balance.affixes.extendedValues.attackPercent.normal` | `equipment/affix-pools` | 0 | 字串 "x" | 拒絕：balance  balance.affixes.extendedValues.attackPercent.normal：型別必須為 number |  |
| `balance.affixes.extendedValues.attackPercent.normal` | `equipment/affix-pools` | 0 | null | 拒絕：balance  balance.affixes.extendedValues.attackPercent.normal：此欄位不可為 null |  |
| `balance.affixes.extendedValues.attackPercent.fine` | `equipment/affix-pools` | 0 | 字串 "x" | 拒絕：balance  balance.affixes.extendedValues.attackPercent.fine：型別必須為 number |  |
| `balance.affixes.extendedValues.attackPercent.fine` | `equipment/affix-pools` | 0 | null | 拒絕：balance  balance.affixes.extendedValues.attackPercent.fine：此欄位不可為 null |  |
| `balance.affixes.extendedValues.attackPercent.rare` | `equipment/affix-pools` | 2 | 字串 "x" | 拒絕：balance  balance.affixes.extendedValues.attackPercent.rare：型別必須為 number |  |
| `balance.affixes.extendedValues.attackPercent.rare` | `equipment/affix-pools` | 2 | null | 拒絕：balance  balance.affixes.extendedValues.attackPercent.rare：此欄位不可為 null |  |
| `balance.affixes.extendedValues.attackPercent.legendary` | `equipment/affix-pools` | 4 | 字串 "x" | 拒絕：balance  balance.affixes.extendedValues.attackPercent.legendary：型別必須為 number |  |
| `balance.affixes.extendedValues.attackPercent.legendary` | `equipment/affix-pools` | 4 | null | 拒絕：balance  balance.affixes.extendedValues.attackPercent.legendary：此欄位不可為 null |  |
| `balance.affixes.extendedValues.dropRateBonus.normal` | `equipment/affix-pools` | 0 | 字串 "x" | 拒絕：balance  balance.affixes.extendedValues.dropRateBonus.normal：型別必須為 number |  |
| `balance.affixes.extendedValues.dropRateBonus.normal` | `equipment/affix-pools` | 0 | null | 拒絕：balance  balance.affixes.extendedValues.dropRateBonus.normal：此欄位不可為 null |  |
| `balance.affixes.extendedValues.dropRateBonus.fine` | `equipment/affix-pools` | 5 | 字串 "x" | 拒絕：balance  balance.affixes.extendedValues.dropRateBonus.fine：型別必須為 number |  |
| `balance.affixes.extendedValues.dropRateBonus.fine` | `equipment/affix-pools` | 5 | null | 拒絕：balance  balance.affixes.extendedValues.dropRateBonus.fine：此欄位不可為 null |  |
| `balance.affixes.extendedValues.dropRateBonus.rare` | `equipment/affix-pools` | 10 | 字串 "x" | 拒絕：balance  balance.affixes.extendedValues.dropRateBonus.rare：型別必須為 number |  |
| `balance.affixes.extendedValues.dropRateBonus.rare` | `equipment/affix-pools` | 10 | null | 拒絕：balance  balance.affixes.extendedValues.dropRateBonus.rare：此欄位不可為 null |  |
| `balance.affixes.extendedValues.dropRateBonus.legendary` | `equipment/affix-pools` | 20 | 字串 "x" | 拒絕：balance  balance.affixes.extendedValues.dropRateBonus.legendary：型別必須為 number |  |
| `balance.affixes.extendedValues.dropRateBonus.legendary` | `equipment/affix-pools` | 20 | null | 拒絕：balance  balance.affixes.extendedValues.dropRateBonus.legendary：此欄位不可為 null |  |
| `balance.affixes.extendedValues.defenseIgnore.normal` | `equipment/affix-pools` | 0 | 字串 "x" | 拒絕：balance  balance.affixes.extendedValues.defenseIgnore.normal：型別必須為 number |  |
| `balance.affixes.extendedValues.defenseIgnore.normal` | `equipment/affix-pools` | 0 | null | 拒絕：balance  balance.affixes.extendedValues.defenseIgnore.normal：此欄位不可為 null |  |
| `balance.affixes.extendedValues.defenseIgnore.fine` | `equipment/affix-pools` | 4 | 字串 "x" | 拒絕：balance  balance.affixes.extendedValues.defenseIgnore.fine：型別必須為 number |  |
| `balance.affixes.extendedValues.defenseIgnore.fine` | `equipment/affix-pools` | 4 | null | 拒絕：balance  balance.affixes.extendedValues.defenseIgnore.fine：此欄位不可為 null |  |
| `balance.affixes.extendedValues.defenseIgnore.rare` | `equipment/affix-pools` | 8 | 字串 "x" | 拒絕：balance  balance.affixes.extendedValues.defenseIgnore.rare：型別必須為 number |  |
| `balance.affixes.extendedValues.defenseIgnore.rare` | `equipment/affix-pools` | 8 | null | 拒絕：balance  balance.affixes.extendedValues.defenseIgnore.rare：此欄位不可為 null |  |
| `balance.affixes.extendedValues.defenseIgnore.legendary` | `equipment/affix-pools` | 12 | 字串 "x" | 拒絕：balance  balance.affixes.extendedValues.defenseIgnore.legendary：型別必須為 number |  |
| `balance.affixes.extendedValues.defenseIgnore.legendary` | `equipment/affix-pools` | 12 | null | 拒絕：balance  balance.affixes.extendedValues.defenseIgnore.legendary：此欄位不可為 null |  |
| `balance.affixes.rerollCost.goldPerTier` | `equipment/affix-pools` | 80 | -1 | 拒絕：rerollCost 不可為負數 |  |
| `balance.affixes.rerollCost.goldPerTier` | `equipment/affix-pools` | 80 | 字串 "x" | 拒絕：balance  balance.affixes.rerollCost.goldPerTier：型別必須為 number |  |
| `balance.affixes.rerollCost.goldPerTier` | `equipment/affix-pools` | 80 | null | 拒絕：balance  balance.affixes.rerollCost.goldPerTier：此欄位不可為 null |  |
| `balance.affixes.rerollCost.dustPerRoll` | `equipment/affix-pools` | 10 | -1 | 拒絕：rerollCost 不可為負數 |  |
| `balance.affixes.rerollCost.dustPerRoll` | `equipment/affix-pools` | 10 | 字串 "x" | 拒絕：balance  balance.affixes.rerollCost.dustPerRoll：型別必須為 number |  |
| `balance.affixes.rerollCost.dustPerRoll` | `equipment/affix-pools` | 10 | null | 拒絕：balance  balance.affixes.rerollCost.dustPerRoll：此欄位不可為 null |  |
| `balance.affixes.poolBySlotRank.*.*.*.skill` | `equipment/affix-pools` | -1 | null | 拒絕：balance  balance.affixes.poolBySlotRank.0.1.4.skill：此欄位不可為 null |  |
| `classes.*.initialStats.def` | `characters/classes` | 6 | null | 拒絕：職業  classes.0.initialStats.def：此欄位不可為 null |  |
| `classes.*.initialStats.crit` | `characters/classes` | 0.07 | null | 拒絕：職業  classes.0.initialStats.crit：此欄位不可為 null |  |
| `classes.*.initialStats.critDamage` | `characters/classes` | 1.5 | null | 拒絕：職業  classes.0.initialStats.critDamage：此欄位不可為 null |  |
| `classes.*.growthPerLevel.hp` | `characters/classes` | 5 | null | 拒絕：職業  classes.0.growthPerLevel.hp：此欄位不可為 null |  |
| `classes.*.growthPerLevel.atk` | `characters/classes` | 1 | null | 拒絕：職業  classes.0.growthPerLevel.atk：此欄位不可為 null |  |
| `classes.*.growthPerLevel.def` | `characters/classes` | 1 | null | 拒絕：職業  classes.0.growthPerLevel.def：此欄位不可為 null |  |
| `classes.*.growthPerLevel.crit` | `characters/classes` | 0 | null | 拒絕：職業  classes.0.growthPerLevel.crit：此欄位不可為 null |  |
| `classes.*.growthPerLevel.critDamage` | `characters/classes` | 0 | null | 拒絕：職業  classes.0.growthPerLevel.critDamage：此欄位不可為 null |  |
| `balanceSettings.progression.xpCurve.base` | `characters/progression` | 24 | -1 | 拒絕：成長／EXP 設定無效：progression.xpCurve.base |  |
| `balanceSettings.progression.xpCurve.linear` | `characters/progression` | 18 | -1 | 拒絕：成長／EXP 設定無效：progression.xpCurve.linear |  |
| `balanceSettings.progression.xpCurve.quadratic` | `characters/progression` | 8 | -1 | 拒絕：成長／EXP 設定無效：progression.xpCurve.quadratic |  |
| `balanceSettings.progression.xpCurve.multiplierBase` | `characters/progression` | 16 | 0 | 拒絕：成長／EXP 設定無效：progression.xpCurve.multiplierBase |  |
| `balanceSettings.progression.xpCurve.multiplierBase` | `characters/progression` | 16 | -1 | 拒絕：成長／EXP 設定無效：progression.xpCurve.multiplierBase |  |
| `balanceSettings.progression.xpCurve.multiplierPerLevel` | `characters/progression` | 0 | -1 | 拒絕：成長／EXP 設定無效：progression.xpCurve.multiplierPerLevel |  |
| `balanceSettings.progression.levelCaps.beforeClear` | `characters/progression` | 30 | 0 | 拒絕：等級上限設定無效 |  |
| `balanceSettings.progression.levelCaps.beforeClear` | `characters/progression` | 30 | -1 | 拒絕：等級上限設定無效 |  |
| `balanceSettings.progression.levelCaps.afterClear` | `characters/progression` | 60 | 0 | 拒絕：等級上限設定無效 |  |
| `balanceSettings.progression.xpLevelGap.midMultiplier` | `characters/progression` | 0.5 | 0 | 拒絕：經驗等級差懲罰設定無效 |  |
| `balanceSettings.progression.xpLevelGap.highGap` | `characters/progression` | 5 | 1e12 | 拒絕：經驗等級差懲罰設定無效 |  |
| `balanceSettings.progression.xpLevelGap.zeroGap` | `characters/progression` | 10 | 0 | 拒絕：經驗等級差懲罰設定無效 |  |
| `balanceSettings.progression.xpLevelGap.zeroGap` | `characters/progression` | 10 | -1 | 拒絕：經驗等級差懲罰設定無效 |  |
| `balanceSettings.progression.xpLevelGap.zeroGap` | `characters/progression` | 10 | 整數加 0.5 | 拒絕：經驗等級差懲罰設定無效 |  |
| `balanceSettings.equipment.difficultyAffix.hardFineThreshold` | `equipment/settings` | 0.7 | -1 | 拒絕：平衡設定機率需介於 0~1：equipment.difficultyAffix.hardFineThreshold |  |
| `balanceSettings.equipment.difficultyAffix.hardFineThreshold` | `equipment/settings` | 0.7 | 1e12 | 拒絕：平衡設定機率需介於 0~1：equipment.difficultyAffix.hardFineThreshold |  |
| `balanceSettings.equipment.difficultyAffix.hellFineThreshold` | `equipment/settings` | 0.35 | -1 | 拒絕：平衡設定機率需介於 0~1：equipment.difficultyAffix.hellFineThreshold |  |
| `balanceSettings.equipment.difficultyAffix.hellFineThreshold` | `equipment/settings` | 0.35 | 1e12 | 拒絕：平衡設定機率需介於 0~1：equipment.difficultyAffix.hellFineThreshold |  |
| `balanceSettings.equipment.difficultyAffix.hellRareThreshold` | `equipment/settings` | 0.85 | -1 | 拒絕：平衡設定機率需介於 0~1：equipment.difficultyAffix.hellRareThreshold |  |
| `balanceSettings.equipment.difficultyAffix.hellRareThreshold` | `equipment/settings` | 0.85 | 1e12 | 拒絕：平衡設定機率需介於 0~1：equipment.difficultyAffix.hellRareThreshold |  |
| `balanceSettings.equipment.dropLevelGap.freeLevels` | `equipment/settings` | 5 | -1 | 拒絕：裝備掉落等級差設定無效 |  |
| `balanceSettings.equipment.dropLevelGap.penaltyPerLevel` | `equipment/settings` | 0.4 | -1 | 拒絕：裝備掉落等級差設定無效 |  |
| `balanceSettings.equipment.dropLevelGap.minimumMultiplier` | `equipment/settings` | 0.05 | -1 | 拒絕：裝備掉落等級差設定無效 |  |
| `balanceSettings.equipment.dropLevelGap.minimumMultiplier` | `equipment/settings` | 0.05 | 1e12 | 拒絕：裝備掉落等級差設定無效 |  |
| `balanceSettings.monsters.kindMultipliers.eliteDefense` | `world/monsters` | 1.1 | 0 | 拒絕：精英／BOSS 防禦倍率必須大於 0 |  |
| `balanceSettings.monsters.kindMultipliers.eliteDefense` | `world/monsters` | 1.1 | -1 | 拒絕：精英／BOSS 防禦倍率必須大於 0 |  |
| `balanceSettings.monsters.kindMultipliers.bossDefense` | `world/monsters` | 1.2 | 0 | 拒絕：精英／BOSS 防禦倍率必須大於 0 |  |
| `balanceSettings.monsters.kindMultipliers.bossDefense` | `world/monsters` | 1.2 | -1 | 拒絕：精英／BOSS 防禦倍率必須大於 0 |  |
| `balanceSettings.difficulty.modes.*.equipmentChance.*` | `world/difficulty` | 0.002 | -1 | 拒絕：難度掉落率需介於 0~1 |  |
| `balanceSettings.difficulty.modes.*.equipmentChance.*` | `world/difficulty` | 0.002 | 1e12 | 拒絕：難度掉落率需介於 0~1 |  |
| `balanceSettings.difficulty.modes.*.gemChance.*` | `world/difficulty` | 0.04 | -1 | 拒絕：難度掉落率需介於 0~1 |  |
| `balanceSettings.difficulty.modes.*.gemChance.*` | `world/difficulty` | 0.04 | 1e12 | 拒絕：難度掉落率需介於 0~1 |  |
| `balanceSettings.difficulty.materialChance.*` | `world/difficulty` | 0.025 | -1 | 拒絕：素材掉落率需介於 0~1 |  |
| `balanceSettings.difficulty.materialChance.*` | `world/difficulty` | 0.025 | 1e12 | 拒絕：素材掉落率需介於 0~1 |  |
| `balanceSettings.rewards.xp.base` | `systems/rewards` | 18 | -1 | 拒絕：成長／EXP 設定無效：rewards.xp.base |  |
| `balanceSettings.rewards.xp.perLevel` | `systems/rewards` | 9 | -1 | 拒絕：成長／EXP 設定無效：rewards.xp.perLevel |  |
| `balanceSettings.rewards.xp.kindMultiplier.normal` | `systems/rewards` | 1 | 0 | 拒絕：EXP 遭遇倍率必須大於 0 |  |
| `balanceSettings.rewards.xp.kindMultiplier.normal` | `systems/rewards` | 1 | -1 | 拒絕：EXP 遭遇倍率必須大於 0 |  |
| `balanceSettings.rewards.xp.kindMultiplier.elite` | `systems/rewards` | 2.2 | 0 | 拒絕：EXP 遭遇倍率必須大於 0 |  |
| `balanceSettings.rewards.xp.kindMultiplier.elite` | `systems/rewards` | 2.2 | -1 | 拒絕：EXP 遭遇倍率必須大於 0 |  |
| `balanceSettings.rewards.xp.kindMultiplier.boss` | `systems/rewards` | 10 | 0 | 拒絕：EXP 遭遇倍率必須大於 0 |  |
| `balanceSettings.rewards.xp.kindMultiplier.boss` | `systems/rewards` | 10 | -1 | 拒絕：EXP 遭遇倍率必須大於 0 |  |
| `balanceSettings.rewards.ether.eliteBase` | `systems/rewards` | 0.01 | -1 | 拒絕：平衡設定機率需介於 0~1：rewards.ether.eliteBase |  |
| `balanceSettings.rewards.ether.eliteBase` | `systems/rewards` | 0.01 | 1e12 | 拒絕：平衡設定機率需介於 0~1：rewards.ether.eliteBase |  |
| `balanceSettings.rewards.ether.elitePerTier` | `systems/rewards` | 0.004 | -1 | 拒絕：平衡設定機率需介於 0~1：rewards.ether.elitePerTier |  |
| `balanceSettings.rewards.ether.elitePerTier` | `systems/rewards` | 0.004 | 1e12 | 拒絕：平衡設定機率需介於 0~1：rewards.ether.elitePerTier |  |
| `balanceSettings.rewards.ether.eliteCap` | `systems/rewards` | 0.06 | -1 | 拒絕：平衡設定機率需介於 0~1：rewards.ether.eliteCap |  |
| `balanceSettings.rewards.ether.eliteCap` | `systems/rewards` | 0.06 | 1e12 | 拒絕：平衡設定機率需介於 0~1：rewards.ether.eliteCap |  |
| `balanceSettings.rewards.ether.bossRepeat` | `systems/rewards` | 0.01 | -1 | 拒絕：平衡設定機率需介於 0~1：rewards.ether.bossRepeat |  |
| `balanceSettings.rewards.ether.bossRepeat` | `systems/rewards` | 0.01 | 1e12 | 拒絕：平衡設定機率需介於 0~1：rewards.ether.bossRepeat |  |
| `balanceSettings.rewards.ether.firstBossMax` | `systems/rewards` | 2 | 0 | 拒絕：首次 BOSS 以太鍛鐵範圍無效 |  |
| `companionSettings.activeLimit` | `characters/companion-settings` | 6 | null | 拒絕：夥伴  companionSettings.activeLimit：此欄位不可為 null |  |
| `companionSettings.ratings.maxBaseGapPercent` | `characters/companion-settings` | 18 | null | 拒絕：夥伴  companionSettings.ratings.maxBaseGapPercent：此欄位不可為 null |  |
| `companionSettings.ratings.maxGrowthGapPercent` | `characters/companion-settings` | 13 | null | 拒絕：夥伴  companionSettings.ratings.maxGrowthGapPercent：此欄位不可為 null |  |
| `story.quests.*.chapter.allies.*.template` | `systems/story` | 10 | 0 | 拒絕：劇情：chapter1：章節：臨時隊友範本不存在：0 |  |
| `story.quests.*.chapter.allies.*.template` | `systems/story` | 10 | 1e12 | 拒絕：劇情：chapter1：章節：臨時隊友範本不存在：1000000000000 |  |
| `story.quests.*.chapter.companion` | `systems/story` | 13 | 0 | 拒絕：劇情：chapter1：章節：加入的夥伴範本不存在 |  |
| `story.quests.*.chapter.companion` | `systems/story` | 13 | 1e12 | 拒絕：劇情：chapter1：章節：加入的夥伴範本不存在 |  |
| `skillSystem.definitions.*.unlockConditions.classMasteryLevel` | `combat/skills` | 0 | null | 拒絕：skillSystem  skillSystem.definitions.0.unlockConditions.classMasteryLevel：此欄位不可為 null |  |
| `skillSystem.definitions.*.bossDuration` | `combat/skills` | 1 | 字串 "x" | 拒絕：skillSystem  skillSystem.definitions.6.bossDuration：型別必須為 number |  |
| `skillSystem.definitions.*.bossDuration` | `combat/skills` | 1 | null | 拒絕：skillSystem  skillSystem.definitions.6.bossDuration：此欄位不可為 null |  |
| `skillSystem.definitions.*.slowPct` | `combat/skills` | 0.3 | 字串 "x" | 拒絕：skillSystem  skillSystem.definitions.6.slowPct：型別必須為 number |  |
| `skillSystem.definitions.*.slowPct` | `combat/skills` | 0.3 | null | 拒絕：skillSystem  skillSystem.definitions.6.slowPct：此欄位不可為 null |  |
| `skillSystem.definitions.*.basicAttackBonus` | `combat/skills` | 0.2 | 字串 "x" | 拒絕：skillSystem  skillSystem.definitions.6.basicAttackBonus：型別必須為 number |  |
| `skillSystem.definitions.*.basicAttackBonus` | `combat/skills` | 0.2 | null | 拒絕：skillSystem  skillSystem.definitions.6.basicAttackBonus：此欄位不可為 null |  |
| `skillSystem.definitions.*.skipChance` | `combat/skills` | 0.3 | 字串 "x" | 拒絕：skillSystem  skillSystem.definitions.6.skipChance：型別必須為 number |  |
| `skillSystem.definitions.*.skipChance` | `combat/skills` | 0.3 | null | 拒絕：skillSystem  skillSystem.definitions.6.skipChance：此欄位不可為 null |  |
| `skillSystem.definitions.*.bossSkipChance` | `combat/skills` | 0.15 | 字串 "x" | 拒絕：skillSystem  skillSystem.definitions.6.bossSkipChance：型別必須為 number |  |
| `skillSystem.definitions.*.bossSkipChance` | `combat/skills` | 0.15 | null | 拒絕：skillSystem  skillSystem.definitions.6.bossSkipChance：此欄位不可為 null |  |
| `skillSystem.definitions.*.damageReduction` | `combat/skills` | 0.2 | 字串 "x" | 拒絕：skillSystem  skillSystem.definitions.6.damageReduction：型別必須為 number |  |
| `skillSystem.definitions.*.damageReduction` | `combat/skills` | 0.2 | null | 拒絕：skillSystem  skillSystem.definitions.6.damageReduction：此欄位不可為 null |  |
| `skillSystem.definitions.*.trapHp` | `combat/skills` | 1 | 字串 "x" | 拒絕：skillSystem  skillSystem.definitions.6.trapHp：型別必須為 number |  |
| `skillSystem.definitions.*.trapHp` | `combat/skills` | 1 | null | 拒絕：skillSystem  skillSystem.definitions.6.trapHp：此欄位不可為 null |  |
| `skillSystem.definitions.*.sources.*.companionId` | `combat/skills` | 10 | 字串 "x" | 拒絕：skillSystem  skillSystem.definitions.7.sources.0.companionId：型別必須為 number |  |
| `skillSystem.definitions.*.sources.*.companionId` | `combat/skills` | 10 | null | 拒絕：skillSystem  skillSystem.definitions.7.sources.0.companionId：此欄位不可為 null |  |
| `skillSystem.definitions.*.level` | `combat/skills` | 1 | 0 | 拒絕：輔助技能回合／等級無效：0-0 |  |
| `skillSystem.definitions.*.level` | `combat/skills` | 1 | -1 | 拒絕：輔助技能回合／等級無效：0-0 |  |
| `skillSystem.definitions.*.level` | `combat/skills` | 1 | 整數加 0.5 | 拒絕：輔助技能回合／等級無效：0-0 |  |
| `skillSystem.definitions.*.level` | `combat/skills` | 1 | 字串 "x" | 拒絕：skillSystem  skillSystem.definitions.35.level：型別必須為 number |  |
| `skillSystem.definitions.*.level` | `combat/skills` | 1 | null | 拒絕：skillSystem  skillSystem.definitions.35.level：此欄位不可為 null |  |

## 工作台較嚴格（96）

| 欄位 | 模組 | 原值 | 編輯 | 工作台 |
|---|---|---|---|---|
| `items.*.duration` | `items/items` | 50 | 整數加 0.5 | 拒絕：道具 imbue_fire 的價格必須非負，持續回合必須是非負整數。 |
| `items.*.durationMinutes` | `items/items` | 5 | 0 | 拒絕：現實時間分鐘必須為有效正數 |
| `items.*.durationMinutes` | `items/items` | 5 | 1e12 | 拒絕：現實時間分鐘必須為有效正數 |
| `items.*.effectPercent` | `items/items` | 25 | -1 | 拒絕：屬性藥水效果百分比或時間單位無效：ward_fire |
| `items.*.effectPercent` | `items/items` | 25 | 1e12 | 拒絕：屬性藥水效果百分比或時間單位無效：ward_fire |
| `items.*.bonusPercent` | `items/items` | 100 | 0 | 拒絕：限時增益百分比必須為正整數：exp_100_30m |
| `items.*.bonusPercent` | `items/items` | 100 | -1 | 拒絕：限時增益百分比必須為正整數：exp_100_30m |
| `items.*.bonusPercent` | `items/items` | 100 | 整數加 0.5 | 拒絕：限時增益百分比必須為正整數：exp_100_30m |
| `items.*.cooldown` | `items/items` | 2 | 1e12 | 拒絕：治療藥水 heal_small 的冷卻必須是 0~99 的整數自身回合。 |
| `items.*.cooldown` | `items/items` | 2 | 整數加 0.5 | 改為 3 |
| `balanceSettings.equipment.baseStats.weaponAttackPerTier` | `equipment/settings` | 3 | 1e12 | 拒絕：戰士新手禮包「武器」的基礎攻擊無效。 |
| `balanceSettings.monsters.catalog.*.combatStats.crit` | `world/monsters` | 0 | -1 | 改為 0（還原） |
| `balanceSettings.monsters.catalog.*.combatStats.critDamage` | `world/monsters` | 1.5 | 0 | 改為 1 |
| `balanceSettings.monsters.catalog.*.combatStats.critDamage` | `world/monsters` | 1.5 | -1 | 改為 1 |
| `balanceSettings.monsters.catalog.*.combatStats.pierce` | `world/monsters` | 0 | -1 | 改為 0（還原） |
| `balanceSettings.monsters.catalog.*.combatStats.defenseIgnore` | `world/monsters` | 0 | -1 | 改為 0（還原） |
| `balanceSettings.monsters.catalog.*.combatStats.defenseIgnore` | `world/monsters` | 0 | 1e12 | 改為 1 |
| `balanceSettings.monsters.catalog.*.combatStats.lifesteal` | `world/monsters` | 0 | -1 | 改為 0（還原） |
| `balanceSettings.monsters.catalog.*.combatStats.evasion` | `world/monsters` | 0 | -1 | 改為 0（還原） |
| `balanceSettings.monsters.catalog.*.combatStats.evasion` | `world/monsters` | 0 | 1e12 | 改為 1 |
| `balanceSettings.monsters.catalog.*.spawnWeight` | `world/monsters` | 1 | 0 | 改為 1（還原） |
| `balanceSettings.monsters.catalog.*.spawnWeight` | `world/monsters` | 1 | -1 | 改為 1（還原） |
| `balanceSettings.monsters.catalog.*.hpMultiplier` | `world/monsters` | 1 | 0 | 改為 1（還原） |
| `balanceSettings.monsters.catalog.*.hpMultiplier` | `world/monsters` | 1 | -1 | 改為 1（還原） |
| `balanceSettings.monsters.catalog.*.attackMultiplier` | `world/monsters` | 1 | 0 | 改為 1（還原） |
| `balanceSettings.monsters.catalog.*.attackMultiplier` | `world/monsters` | 1 | -1 | 改為 1（還原） |
| `balanceSettings.monsters.catalog.*.defenseMultiplier` | `world/monsters` | 1 | 0 | 改為 1（還原） |
| `balanceSettings.monsters.catalog.*.defenseMultiplier` | `world/monsters` | 1 | -1 | 改為 1（還原） |
| `balanceSettings.monsters.catalog.*.stageCount` | `world/monsters` | 1 | 0 | 改為 1（還原） |
| `balanceSettings.monsters.catalog.*.stageCount` | `world/monsters` | 1 | -1 | 改為 1（還原） |
| `balanceSettings.monsters.catalog.*.stageCount` | `world/monsters` | 1 | 1e12 | 拒絕：怪物 map0_mob0 的終局關卡數量／型態／隊列順序無效。 |
| `balanceSettings.monsters.catalog.*.stageCount` | `world/monsters` | 1 | 整數加 0.5 | 改為 1（還原） |
| `balanceSettings.monsters.catalog.*.stageOrder` | `world/monsters` | 10 | -1 | 改為 10（還原） |
| `balanceSettings.monsters.catalog.*.stageOrder` | `world/monsters` | 10 | 1e12 | 拒絕：怪物 map0_mob0 的終局關卡數量／型態／隊列順序無效。 |
| `balanceSettings.monsters.catalog.*.stageOrder` | `world/monsters` | 10 | 整數加 0.5 | 改為 10（還原） |
| `balanceSettings.monsters.catalog.*.bossStageCount` | `world/monsters` | 0 | -1 | 改為 0（還原） |
| `balanceSettings.monsters.catalog.*.bossStageCount` | `world/monsters` | 0 | 整數加 0.5 | 改為 0（還原） |
| `balanceSettings.monsters.catalog.*.bossStageOrder` | `world/monsters` | 10 | -1 | 改為 10（還原） |
| `balanceSettings.monsters.catalog.*.bossStageOrder` | `world/monsters` | 10 | 1e12 | 改為 999 |
| `balanceSettings.monsters.catalog.*.bossStageOrder` | `world/monsters` | 10 | 整數加 0.5 | 改為 10（還原） |
| `balanceSettings.rewards.regionVouchers.ticketMinutes` | `systems/rewards` | 30 | 字串 "x" | 改為 30（還原） |
| `balanceSettings.rewards.regionVouchers.ticketMinutes` | `systems/rewards` | 30 | null | 改為 30（還原） |
| `balanceSettings.rewards.regionVouchers.sampleMinutes` | `systems/rewards` | 30 | 字串 "x" | 改為 30（還原） |
| `balanceSettings.rewards.regionVouchers.sampleMinutes` | `systems/rewards` | 30 | null | 改為 30（還原） |
| `balanceSettings.rewards.regionVouchers.maxGapMinutes` | `systems/rewards` | 10 | 字串 "x" | 改為 10（還原） |
| `balanceSettings.rewards.regionVouchers.maxGapMinutes` | `systems/rewards` | 10 | null | 改為 10（還原） |
| `balanceSettings.rewards.regionVouchers.averageMinutes` | `systems/rewards` | 180 | 字串 "x" | 改為 180（還原） |
| `balanceSettings.rewards.regionVouchers.averageMinutes` | `systems/rewards` | 180 | null | 改為 180（還原） |
| `balanceSettings.maps.levelRanges.*.max` | `world/maps` | 5 | 0 | 改為 5（還原） |
| `balanceSettings.maps.levelRanges.*.max` | `world/maps` | 5 | -1 | 改為 5（還原） |
| `balanceSettings.maps.levelRanges.*.max` | `world/maps` | 5 | 整數加 0.5 | 改為 5（還原） |
| `balanceSettings.maps.catalog.*.min` | `world/maps` | 1 | 整數加 0.5 | 改為 2 |
| `balanceSettings.maps.catalog.*.max` | `world/maps` | 5 | 整數加 0.5 | 改為 6 |
| `balanceSettings.maps.catalog.*.family` | `world/maps` | 0 | 整數加 0.5 | 改為 0（還原） |
| `equipmentPowerSystem.prefixes.*.tierMin` | `equipment/power-system` | 1 | 0 | 改為 1（還原） |
| `equipmentPowerSystem.prefixes.*.tierMin` | `equipment/power-system` | 1 | -1 | 改為 1（還原） |
| `equipmentPowerSystem.prefixes.*.tierMin` | `equipment/power-system` | 1 | 1e12 | 改為 10 |
| `equipmentPowerSystem.prefixes.*.tierMin` | `equipment/power-system` | 1 | 整數加 0.5 | 改為 2 |
| `equipmentPowerSystem.prefixes.*.tierMax` | `equipment/power-system` | 10 | 0 | 改為 1 |
| `equipmentPowerSystem.prefixes.*.tierMax` | `equipment/power-system` | 10 | -1 | 改為 1 |
| `equipmentPowerSystem.prefixes.*.tierMax` | `equipment/power-system` | 10 | 1e12 | 改為 10（還原） |
| `equipmentPowerSystem.prefixes.*.tierMax` | `equipment/power-system` | 10 | 整數加 0.5 | 改為 10（還原） |
| `equipmentPowerSystem.prefixes.*.weight` | `equipment/power-system` | 1 | 1e12 | 改為 100 |
| `equipmentPowerSystem.prefixes.*.slots.*` | `equipment/power-system` | 0 | -1 | 改為 0（還原） |
| `equipmentPowerSystem.prefixes.*.slots.*` | `equipment/power-system` | 0 | 1e12 | 改為 0（還原） |
| `equipmentPowerSystem.prefixes.*.slots.*` | `equipment/power-system` | 0 | 整數加 0.5 | 改為 0（還原） |
| `equipmentPowerSystem.suffixes.*.tierMin` | `equipment/power-system` | 1 | 0 | 改為 1（還原） |
| `equipmentPowerSystem.suffixes.*.tierMin` | `equipment/power-system` | 1 | -1 | 改為 1（還原） |
| `equipmentPowerSystem.suffixes.*.tierMin` | `equipment/power-system` | 1 | 1e12 | 改為 10 |
| `equipmentPowerSystem.suffixes.*.tierMin` | `equipment/power-system` | 1 | 整數加 0.5 | 改為 2 |
| `equipmentPowerSystem.suffixes.*.tierMax` | `equipment/power-system` | 10 | 0 | 改為 1 |
| `equipmentPowerSystem.suffixes.*.tierMax` | `equipment/power-system` | 10 | -1 | 改為 1 |
| `equipmentPowerSystem.suffixes.*.tierMax` | `equipment/power-system` | 10 | 1e12 | 改為 10（還原） |
| `equipmentPowerSystem.suffixes.*.tierMax` | `equipment/power-system` | 10 | 整數加 0.5 | 改為 10（還原） |
| `equipmentPowerSystem.suffixes.*.weight` | `equipment/power-system` | 1 | 1e12 | 改為 100 |
| `equipmentPowerSystem.suffixes.*.slots.*` | `equipment/power-system` | 0 | -1 | 改為 0（還原） |
| `equipmentPowerSystem.suffixes.*.slots.*` | `equipment/power-system` | 0 | 1e12 | 改為 0（還原） |
| `equipmentPowerSystem.suffixes.*.slots.*` | `equipment/power-system` | 0 | 整數加 0.5 | 改為 0（還原） |
| `equipmentPowerSystem.suffixes.*.effect.value` | `equipment/power-system` | 1 | 0 | 改為 1（還原） |
| `equipmentPowerSystem.suffixes.*.effect.value` | `equipment/power-system` | 1 | -1 | 改為 1（還原） |
| `equipmentPowerSystem.suffixes.*.effect.value` | `equipment/power-system` | 1 | 1e12 | 改為 5 |
| `equipmentPowerSystem.bossAffixes.*.effects.*.value` | `equipment/power-system` | 10 | 1e12 | 改為 500 |
| `equipmentPowerSystem.strength.weightsByDifficulty.*.*` | `equipment/power-system` | 8 | 1e12 | 改為 1000000000 |
| `equipmentPowerSystem.strength.legacyBossLevelBonus` | `equipment/power-system` | 7 | -1 | 改為 0 |
| `equipmentPowerSystem.strength.legacyBossLevelBonus` | `equipment/power-system` | 7 | 1e12 | 改為 100 |
| `equipmentPowerSystem.rerollItem.sellPrice` | `equipment/power-system` | 80 | 1e12 | 改為 1000000000 |
| `equipmentPowerSystem.rerollItem.shopPrice` | `equipment/power-system` | 650 | 0 | 改為 1 |
| `equipmentPowerSystem.rerollItem.shopPrice` | `equipment/power-system` | 650 | -1 | 改為 1 |
| `equipmentPowerSystem.rerollItem.shopPrice` | `equipment/power-system` | 650 | 1e12 | 改為 1000000000 |
| `equipmentPowerSystem.rerollItem.shopPrice` | `equipment/power-system` | 650 | 整數加 0.5 | 改為 651 |
| `statusDefinitions.*.modifiers.*.value` | `combat/statuses` | 0.3 | -1 | 拒絕：狀態 1：傷害擴散比例不可為負數 |
| `statusDefinitions.*.timing.durationSeconds` | `combat/statuses` | 594 | null | 拒絕：狀態 pain-spread 的永久標記與 timing.durationSeconds 不一致；請於狀態秒數設定修正 |
| `skillSystem.definitions.*.baseCritDamage` | `combat/skills` | 1.5 | 0 | 拒絕：技能 0-0 基礎暴擊傷害必須至少 1。 |
| `skillSystem.definitions.*.baseCritDamage` | `combat/skills` | 1.5 | -1 | 拒絕：技能 0-0 基礎暴擊傷害必須至少 1。 |
| `skillSystem.definitions.*.defensePenetration` | `combat/skills` | 0 | -1 | 拒絕：技能 0-0 固定防禦穿透必須為非負數。 |
| `skillSystem.definitions.*.procChancePerLevel` | `combat/skills` | 0 | 字串 "x" | 拒絕：角色 0 技能 38 的逐技能觸發率必須介於 0~1。 |

## 各模組被整條鏈路接受的 0、負數與極大值

探測無法判斷設計意圖；下表供檢視哪些模組的數值沒有範圍限制。

| 模組 | 0 | -1 | 1e12 |
|---|--:|--:|--:|
| `equipment/affix-pools` | 72 | 57 | 74 |
| `characters/classes` | 7 | 0 | 13 |
| `equipment/forms` | 1 | 1 | 1 |
| `items/items` | 6 | 0 | 4 |
| `characters/progression` | 26 | 21 | 30 |
| `combat/skill-settings` | 13 | 7 | 15 |
| `equipment/settings` | 50 | 33 | 41 |
| `world/monsters` | 26 | 40 | 57 |
| `world/difficulty` | 11 | 5 | 7 |
| `systems/rewards` | 31 | 20 | 25 |
| `combat/rules` | 58 | 37 | 39 |
| `systems/quests` | 46 | 39 | 45 |
| `meta/balance-settings` | 1 | 1 | 1 |
| `world/maps` | 2 | 1 | 4 |
| `world/drops` | 8 | 6 | 6 |
| `systems/economy` | 4 | 0 | 4 |
| `equipment/power-system` | 9 | 1 | 0 |
| `interface/presentation` | 0 | 4 | 0 |
| `combat/statuses` | 4 | 0 | 1 |
| `characters/companions` | 10 | 0 | 27 |
| `characters/companion-settings` | 45 | 0 | 39 |
| `systems/shop` | 5 | 0 | 0 |
| `systems/life-skills` | 6 | 0 | 3 |
| `systems/story` | 7 | 1 | 1 |
| `combat/skills` | 24 | 9 | 14 |
| `combat/skill-system` | 11 | 0 | 0 |
| `systems/wishing-lake` | 8 | 0 | 0 |
| `systems/tutorials` | 4 | 0 | 0 |

