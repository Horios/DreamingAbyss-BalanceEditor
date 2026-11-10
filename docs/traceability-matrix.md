# 欄位級追溯矩陣

由 `node scripts/traceability.cjs` 產生，請勿手動修改。完整資料在 `traceability-matrix.json`。

遊戲資料 commit `c9c51aa`（`data/balance.json` SHA-256 `02b2b55e8133…`），1508 個欄位樣式，33187 個欄位值，35 個模組。

每個欄位樣式取第一筆資料改一次值，依序交給工作台（匯入→匯出）、發布驗證器（canonicalize）與遊戲（`applyBalanceConfig`→`exportableBalance`）。

| 狀態 | 意義 |
|---|---|
| `effective` | 可編輯，三個程式都保留編輯值 |
| `normalized` | 可編輯，但值會被正規化（四捨五入、夾限或衍生） |
| `constrained` | 受驗證器限制（列舉、ID 或引用），不接受任意值 |
| `ignored-by-game` | 遊戲載入後不採用編輯值 |
| `dropped-by-editor` | 工作台匯入匯出後遺失編輯值 |
| `dropped-by-validator` | 發布驗證器正規化後遺失編輯值 |
| `derived` | 由其他欄位衍生，修改來源欄位才會生效 |
| `fixed-by-game` | 遊戲程式固定此值，資料中的值不會被採用 |
| `read-only` | 僅供閱讀 |
| `no-value` | 目前為空值，沒有可探測的內容 |

| 模組 | effective | normalized | constrained | ignored-by-game | dropped-by-editor | dropped-by-validator | derived | fixed-by-game | read-only | no-value |
|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| `meta/document` | 1 | 0 | 4 | 0 | 0 | 0 | 0 | 10 | 0 | 0 |
| `meta/reference` | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 162 | 0 |
| `meta/notes` | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 0 |
| `equipment/affix-pools` | 83 | 0 | 7 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| `characters/classes` | 17 | 0 | 1 | 0 | 0 | 0 | 43 | 1 | 0 | 11 |
| `characters/support-skills` | 0 | 0 | 0 | 0 | 0 | 0 | 24 | 0 | 0 | 9 |
| `equipment/forms` | 3 | 0 | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 1 |
| `items/items` | 13 | 0 | 5 | 0 | 0 | 0 | 1 | 0 | 0 | 1 |
| `characters/progression` | 36 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 1 |
| `combat/skill-settings` | 16 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 2 |
| `equipment/settings` | 51 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 1 |
| `world/monsters` | 75 | 0 | 5 | 0 | 0 | 0 | 0 | 1 | 0 | 1 |
| `world/difficulty` | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| `systems/rewards` | 41 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| `combat/rules` | 73 | 0 | 9 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| `systems/quests` | 80 | 0 | 13 | 0 | 0 | 0 | 0 | 1 | 0 | 12 |
| `meta/balance-settings` | 1 | 0 | 3 | 0 | 0 | 0 | 0 | 5 | 0 | 0 |
| `world/maps` | 12 | 0 | 3 | 0 | 0 | 0 | 1 | 2 | 0 | 0 |
| `world/drops` | 16 | 0 | 4 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| `systems/economy` | 5 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| `interface/presentation` | 20 | 0 | 10 | 0 | 0 | 0 | 0 | 0 | 0 | 1 |
| `equipment/power-system` | 24 | 0 | 8 | 0 | 0 | 0 | 0 | 10 | 0 | 0 |
| `combat/statuses` | 17 | 0 | 8 | 0 | 0 | 0 | 0 | 0 | 0 | 4 |
| `items/starter-packs` | 5 | 0 | 5 | 0 | 0 | 0 | 0 | 0 | 0 | 3 |
| `characters/companions` | 32 | 0 | 11 | 0 | 0 | 0 | 0 | 0 | 0 | 2 |
| `characters/passives` | 0 | 0 | 0 | 0 | 0 | 0 | 30 | 0 | 0 | 9 |
| `characters/companion-settings` | 63 | 0 | 11 | 0 | 0 | 0 | 0 | 0 | 0 | 4 |
| `systems/shop` | 23 | 0 | 15 | 0 | 0 | 0 | 0 | 0 | 0 | 2 |
| `systems/life-skills` | 21 | 0 | 6 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| `items/inventory-icons` | 4 | 0 | 4 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| `systems/story` | 30 | 0 | 35 | 0 | 0 | 0 | 0 | 0 | 0 | 14 |
| `interface/navigation` | 4 | 0 | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| `combat/skill-system` | 20 | 0 | 16 | 0 | 0 | 0 | 0 | 1 | 0 | 5 |
| `combat/skills` | 53 | 0 | 27 | 0 | 0 | 0 | 0 | 0 | 0 | 12 |
| `systems/wishing-lake` | 24 | 0 | 25 | 0 | 0 | 0 | 0 | 0 | 0 | 3 |

## 由其他欄位衍生，修改來源欄位才會生效（99）

| 欄位 | 數量 | 來源 | 說明 |
|---|--:|---|---|
| `classes.*…` | 3 | `classes.*.initialStats` | 舊版 LV1 數值欄位，與 initialStats 同步。已確認修改 initialStats.hp 後此處同步改變。 |
| `classes.*…` | 40 | `skillSystem.definitions` | 舊版位置式技能陣列，由技能定義投影產生。已確認修改來源技能的 power 後此處同步改變。 |
| `supportSkills.*…` | 24 | `skillSystem.definitions` | 輔助技能陣列由技能定義投影產生。已確認修改來源技能的 value 後此處同步改變。 |
| `items.*…` | 1 | `shopSettings.fixedOffers.entries` | 是否在商店販售由固定商品清單決定（js/items/shop-inventory.js）。 |
| `balanceSettings.maps.levelRanges.*…` | 1 | `balanceSettings.maps.catalog` | 等級範圍由地圖清單的 min／max 重新產生（js/world/dynamic-world.js）。 |
| `passiveDefinitions.*…` | 30 | `skillSystem.definitions` | 被動陣列由技能定義投影產生。已確認修改來源技能的 name 後此處同步改變。 |

## 遊戲程式固定此值，資料中的值不會被採用（31）

| 欄位 | 數量 | 說明 |
|---|--:|---|
| `classes.*…` | 1 | 職業 id 等於陣列位置，職業數量由遊戲固定。 |
| `balanceSettings.monsters.encounter.bossChance`、`balanceSettings.maps.catalog.*…` | 2 | 一般地圖不隨機遭遇 BOSS，遊戲固定為 0（js/combat/manual-boss.js）。 |
| `balanceSettings.quests.tutorial.skillLevelRequirement` | 1 | 遊戲固定為 1（js/skills/mastery-core.js）。 |
| `balanceSettings.meta.numericCompressionVersion`、`balanceSettings.meta.teamBuildVersion`、`balanceSettings.meta.masteryOverhaulVersion`、`balanceSettings.meta.activeCooldownFloorVersion`、`balanceSettings.meta.skillSystemVersion` | 5 | 資料格式版本旗標，由遊戲在載入與匯出時設定。 |
| `balanceSettings.maps.catalog.*…` | 1 | 進度關卡的位置由遊戲依既有地圖決定（js/world/dynamic-world.js）。 |
| `timeUnits.consumableClock` | 1 | 遊戲在限時道具正規化時固定為 wall（js/items/timed-boosts.js），工作台內嵌同一份規則。遊戲匯出會原樣帶出文件中的值，但執行時不採用。 |
| `timeUnits.supportDuration`、`timeUnits.itemDuration`、`timeUnits.elementPotionDuration`、`timeUnits.timedBoostDuration`、`timeUnits.combat`、`timeUnits.skillCooldown`… | 7 | 時間單位標示，由遊戲匯出時寫入。 |
| `equipmentPowerSystem.schemaVersion`、`equipmentPowerSystem.strength.acquisitionVersion`、`skillSystem.gemSlotRuleVersion` | 3 | 資料格式版本旗標，由遊戲設定。 |
| `equipmentPowerSystem.bossAffixes.*…` | 4 | 探測的第一筆屬於 legacy 群組，其識別欄位由遊戲重建。parallel 群組未個別探測。 |
| `equipmentPowerSystem.rerollItem.id`、`equipmentPowerSystem.rerollItem.cost`、`equipmentPowerSystem.rerollItem.shopEnabled`、`equipmentPowerSystem.rerollItem.dropRuleInitialized` | 4 | 強度重鑄石的識別碼、cost、shopEnabled 與掉落初始化旗標由遊戲固定（js/equipment/equipment-identity.js）；售價與出現率使用 shopPrice、shopChance。 |
| `masteryTypes.*…` | 2 | 精通類型由遊戲定義。 |

