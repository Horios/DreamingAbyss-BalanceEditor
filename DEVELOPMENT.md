# LV1～60 成長曲線

本次數值修改位於 `chatgpt-dev`，正式 `main` 不接受未發布的數值變更。遊戲的對應版本為 `Horios/Emberwild` 的 `chatgpt-dev`。

`balance-editor.html` 的 `progression-model-v2` script 必須與遊戲 `js/balance/progression-model.js` 保持完全一致。遊戲的瀏覽器整合測試會檢查文字一致、有效預設值、欄位修改、JSON 匯出／匯入及實際數值。

新增的有效設定為：

- `classes[].growthSteps`：每隔 every 級，額外增加整數 hp／atk／def；從 LV1 的零成長起算。
- `balanceSettings.rewards.xp.kindMultiplier`：EXP 專用普通／菁英／BOSS 倍率。
- `balanceSettings.difficulty.modes[].xpMultiplier`：EXP 專用難度倍率。原有 `reward` 繼續控制金幣等獎勵。
- `balanceSettings.monsters.encounter.levelLeadInterval`：怪物領先等級逐步開放的間隔，0 恢復舊的固定上限；最大領先值仍取 `progression.mapAheadAllowance`。BOSS 仍使用地圖固定等級。

舊 JSON 未包含 EXP 專用倍率時，以原來的共用倍率補齊，保留自訂平衡的含義。共用 `progression.statsPerLevel` 只供缺少各職業成長的舊資料 fallback，設計器已隱藏；請編輯職業的獨立成長。

完整數值表、三人隊模擬及測試說明位於遊戲 Repository 的 `docs/PROGRESSION_REDESIGN.md`。測試命令請參照遊戲 `tests/README.md`，並將本 Repository 的路徑交給 `EMBERWILD_BALANCE_ROOT`。
