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

## 2026-10-12 每日委託與支線設計

新增「委託與支線」分類及每日委託／支線獨立設計頁。有效來源改為 `balanceSettings.quests.design`，可新增、複製、排序、停用、搜尋，並編輯多項需求、獎勵、等級、地圖、權重與前置支線。

遊戲 `js/world/quest-design-model.js` 與 HTML 的 `quest-design-model-v1` script 完全相同；`npm run test:quests` 驗證此契約。當日需求及獎勵使用快照，切換地圖／角色／匯入 JSON 不重抽。每日一張、台灣午夜更新；既有支線 ID、已完成紀錄及當日委託保留。

`quests.board`、`quests.repeat`、`quests.side` 只保留舊 JSON 遷移，介面移除這些過時的任務控制。支線前置不可自我引用、循環或引用不存在的任務；仍被任務或技能引用的支線不可直接刪除。

需求支援材料、藥水、道具、累計擊殺、等級及地區開放。獎勵支援金幣、鍛鐵、粉塵、EXP、寶石、材料、藥水、道具與裝備。獎勵上限／裝備空間不足阻止交付，儲存失敗原地回復任務、資源、EXP、夥伴與隊伍配點。

詳見遊戲 `docs/QUEST_DESIGN_2026-10-12.md`；測試涵蓋六輪新任務 JSON 往返、原有六輪平衡往返、實際表單／下載／匯入／交付／重載、桌面與手機版面，以及完整專案回歸。

本次完整回歸 377／377 通過，0 失敗、0 跳過。還原預設流程中的早期地圖／藥水資料與新任務驗證已確認相容。
