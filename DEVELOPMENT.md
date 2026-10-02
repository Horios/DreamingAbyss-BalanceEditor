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
