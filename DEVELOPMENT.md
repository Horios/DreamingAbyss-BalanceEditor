# 平衡器開發與發布

本私有 Repository 保存 `balance-editor.html`。遊戲原始碼位於 `Horios/Emberwild`。

- `chatgpt-dev`：修正與整合先推送的分支。
- `main`：通過遊戲邏輯、JSON 循環與瀏覽器檢查後發布。
- 保留歷史，不用 force push、reset 或 rebase 覆蓋遠端。
- 修改前確認最新分支與 blob SHA；寫入時比對原始 SHA，避免覆蓋其他修改。
- 不公開託管平衡器，不把私有 HTML 放入公開遊戲 Repository。

## 2026-10-12 整合

以共同祖先 f33864b 做三方整合，合併 main 9d75de9 的新功能與 chatgpt-dev d367f92 的成長、商品池、限時道具、夥伴信物、隊伍配置、Lucide 擴充。

保留固定角色姓名、獨立專屬技能、LV1／3／8 解鎖、啟用／禁用、成就招募券、材料售價，以及狀態次數／排序／苦痛蔓延。
內建預設與遊戲有效設定同步；已有瀏覽器工作草稿仍優先讀取並遷移。還原預設才重設工作資料。
主角技能沒有技能點／學習成本；永久精通、任務、材料與成就解鎖條件繼續生效。

## 共用來源

| script ID | 遊戲來源 |
| --- | --- |
| progression-model-v2 | js/balance/progression-model.js |
| timed-boost-schema-v1 | js/items/timed-boosts.js |
| companion-model-v1 | js/character/companion-model.js |
| companion-token-model-v1 | js/items/companion-token-model.js |
| team-model-v1 | js/character/team-model.js |
| companion-skill-model-v1 | js/skills/companion-skill-model.js |
| achievement-model-v1 | js/character/achievement-model.js |
| companion-passive-model-v1 | js/skills/passive-model.js |
| shop-catalog-v2 | js/items/shop-catalog.js |
| skill-effect-schema-v1 | js/skills/skill-effect-schema.js |
| skill-induction-schema | js/skills/induction-schema.js |
| lucide-catalog-v1 | js/ui/lucide-catalog.js |
| skill-icon-library-v1 | js/ui/skill-icon-library.js |

圖示與隊伍模型可用公開遊戲的 tools/sync-icon-resources.cjs、tools/sync-team-schema.cjs 同步。

## 檢查

從遊戲 Repository 執行 `npm test`，本檔案放在同層 `../Emberwild-Balance/balance-editor.html`，或設定 `EMBERWILD_BALANCE_ROOT`。
JSON 專項為 `npm run test:balance`：六輪 30 欄位模組往返，加三輪真正表單修改／下載／匯入／販售／重載。
2026-10-12 全套 360／360 通過，0 失敗、0 跳過。完整清單與已知高難度戰鬥現況見遊戲 docs/RELEASE_AUDIT_2026-10-12.md。
