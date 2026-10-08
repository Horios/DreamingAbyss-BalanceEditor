# LV1～60 成長曲線

本次數值修改位於 `chatgpt-dev`，正式 `main` 不接受未發布的數值變更。遊戲的對應版本為 `Horios/Emberwild` 的 `chatgpt-dev`。

`balance-editor.html` 的 `progression-model-v2` script 必須與遊戲 `js/balance/progression-model.js` 保持完全一致。遊戲的瀏覽器整合測試會檢查文字一致、有效預設值、欄位修改、JSON 匯出／匯入及實際數值。

`timed-boost-schema-v1` 同樣必須與遊戲 `js/items/timed-boosts.js` 完全一致。限時道具沿用 `items` 目錄，`type=timedBoost`、`boostType=speed4/exp/drop`、`bonusPercent` 為加算百分比、`durationMinutes` 為現實分鐘，`duration=0` 不參與既有回合遷移。百分比與分鐘可輸入正整數；4× 解鎖百分比固定為 0。不同名稱保留獨立來源，同名刷新完整時間。

限時道具頁直接編輯既有 `shopSettings.randomOffers.entries` 的上架、權重／每批追加率、數量與單價，不使用第二套商品池。遊戲 `npm run test:boosts` 驗證設計器操作、實際下載 JSON、遊戲匯入生效及限時狀態保存。`timeUnits.timedBoostDuration=realMinutes` 標記完成舊資料遷移，避免再次補入已移除的道具；明確空商品池保持空白。

屬性抗性 `ward` 與屬性增幅 `elementTonic` 同樣使用現實時間：每個道具獨立設定 `effectPercent`（百分比）與 `durationMinutes`（正數，可含小數），`duration=0`。使用時保存效果快照與 `expiresAt`，暫停、候補、離線都會到期，同類覆蓋並刷新。附加 `statEffects` 跟隨同一到期時間；附魔 `imbue` 保持出戰回合。`timeUnits.elementPotionDuration=realMinutes` 避免重複遷移，舊全域強度只供缺少欄位的舊資料使用。平衡器的消耗道具頁與商店來源編輯均使用上述欄位。

`shop-catalog-v2` 的內容必須與遊戲 `js/items/shop-catalog.js` 完全相同（script ID 保持相容，內部 schemaVersion 為 3）。抗性／屬性增幅商品預設停用，舊固定與隨機商品池一次性遷移為下架，既有庫存與道具定義保留。新版本明確設定的商品池保持可編輯，空池不會被補回。遊戲 `npm run test:potions` 可在沒有 Chromium 時驗證共同契約及實際模組行為；瀏覽器操作仍由既有整合測試驗證。

新增的有效設定為：

- `classes[].growthSteps`：每隔 every 級，額外增加整數 hp／atk／def；從 LV1 的零成長起算。
- `balanceSettings.rewards.xp.kindMultiplier`：EXP 專用普通／菁英／BOSS 倍率。
- `balanceSettings.difficulty.modes[].xpMultiplier`：EXP 專用難度倍率。原有 `reward` 繼續控制金幣等獎勵。
- `balanceSettings.monsters.encounter.levelLeadInterval`：怪物領先等級逐步開放的間隔，0 恢復舊的固定上限；最大領先值仍取 `progression.mapAheadAllowance`。BOSS 仍使用地圖固定等級。

舊 JSON 未包含 EXP 專用倍率時，以原來的共用倍率補齊，保留自訂平衡的含義。共用 `progression.statsPerLevel` 只供缺少各職業成長的舊資料 fallback，設計器已隱藏；請編輯職業的獨立成長。

完整數值表、三人隊模擬及測試說明位於遊戲 Repository 的 `docs/PROGRESSION_REDESIGN.md`。測試命令請參照遊戲 `tests/README.md`，並將本 Repository 的路徑交給 `EMBERWILD_BALANCE_ROOT`。

## 夥伴內化成長與單一信物

夥伴 `initialStats`／`growthPerLevel` 支援 12 個實際能力鍵；`equipmentInternalized=1` 表示已包含一次性普通裝備內化預算，避免重複加入。新增 `companionTokens` 管理目錄、複合屬性、特殊事件／能力與獨立掉落。契約 `companion-token-model-v1` 必須與遊戲 `js/items/companion-token-model.js` 一致。機率／能力倍率採 0～1 比例，複合屬性中的百分比採百分數；立即效果 duration=0，BUFF duration≥1。每個編輯器選項皆有對應遊戲實作。

遊戲 `npm run test:tokens` 執行真正 JSON 下載、匯入與效果一致性測試；完整結果及初始成長／十件信物／掉落／遷移說明見遊戲 `docs/COMPANION_TOKENS.md`。此版仍只提交 chatgpt-dev，不合併 main。

## 獨立隊伍配置與永久解鎖

`team-model-v1` 必須與遊戲 `js/character/team-model.js` 完全一致，可使用遊戲 `tools/sync-team-schema.cjs` 同步。新增 `teamSettings.maxPlans/defaultLearnCost`；AP／SP 仍編輯 `balanceSettings.progression.starting/levelRewards`。`meta.teamBuildVersion=1` 表示 SP 預算已完成一次性遷移，明確設定 0 會保留。

每個核心與輔助技能的 `learnCost` 是本隊技能點成本，`unlockConditions.classMasteryLevel/quests/materials` 是全域永久條件。材料只付一次；既有等級、二轉、武器／元素精通門檻與曲線繼續使用原有效來源。編輯器正規化保留既有巢狀物件，避免事件引用失效。降低遊戲點數或刪除技能前需先調整已保存的方案，遊戲會拒絕會破壞現有配置／永久成果的 JSON。

`npm run test:teams` 在遊戲 Repository 執行共用契約、實際遊戲模組與 Chromium 欄位／JSON 下載／匯入／重新整理測試。完整交付紀錄見公開遊戲 `docs/TEAM_BUILDS.md`。設計器保持私有，下載此分支 `balance-editor.html` 後在本機開啟；不新增公開 hosting，不合併 main。

## Lucide 圖示製作器擴充

沿用 `skillIcons`／`iconType=custom:<id>` 與原有圖層編輯器。Lucide 原名保存於 `layers[].icon=lucide:<name>`，明確清除為 `none`，整體外觀／動畫為可選 `appearance`，不保存 SVG HTML 或圖庫瀏覽狀態。原本內建圖示與基本圖形繼續可用。

固定 `lucide-static@1.53.0` 的 1,869 個本地 SVG。`lucide-catalog-v1`、`skill-icon-library-v1`、`skill-icons-shared-style` 必須與公開遊戲的 `js/ui/lucide-catalog.js`、`js/ui/skill-icon-library.js`、`css/skill-icons.css` 完全一致；使用遊戲的 `tools/sync-icon-resources.cjs` 同步，勿建立另一份設定來源。完整 ISC／Feather MIT 授權包含於圖庫嵌入註解。

圖標共用既有文字 CSS keyframes，只新增 SVG 旋轉；文字稀有度設計器及其共用 CSS 不改動。公開遊戲 `npm run test:icons` 執行契約、離線模式及 Chromium 實際設計、JSON 下載／匯入／重載與遊戲顯示。詳細使用、模型、授權、限制及修改檔案見遊戲 `docs/ICON_DESIGNER.md`。仍只提交 chatgpt-dev。
