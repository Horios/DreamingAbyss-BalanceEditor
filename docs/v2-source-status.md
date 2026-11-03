# Dreaming Abyss V2：來源與部署差異

稽核時間：2026-11-02 17:23（Asia/Taipei）。此為時間點紀錄，繼續工作前仍須重新核對 HEAD、CI 與部署。

| 來源 | 實際提交 | 判定 |
|---|---|---|
| 遊戲 `chatgpt-dev` | `cea79fe8920b78d20cd26db717628039e9c1b500`，v0.030 | 僅修正手機導覽測試定位／互動保護重繪等待並遞增版號；最新 CI 執行中。本機 Chromium 153 手機導覽回歸已通過；v0.029 核心與全部存檔測試通過，瀏覽器仍有魔爆及尚未等候重繪的導覽失敗 |
| 遊戲 `main` | `0402f4b2b1437a791b30eb0991fd479f77f9b5cf` | 未修改 |
| Preview 實際 HTTP | `8f20e67d7c2746b4dc33a71670a1e47455a5c1cb`，v0.015 | 已直接讀取 `/preview/data/build.json` 與 `/preview/data/preview-version.json`；與開發 HEAD 不同 |
| 平衡器 `main` | `da8d3241b41d8de2f0979a41724baa7b180f5f5b` | 僅重建既有 game-validator 與 provenance；來源釘選遊戲 v0.029；本機原有測試 118/118；GitHub 四項驗證全通過，run 41418134159 completed/success |
| 平衡器 `chatgpt-dev` | `43632764388fb5c914014b784aadb92b285a32da` | 保留原狀；main 為維護基準，不合併或重寫歷史 |
| 平衡器 `v2-developer-mode` | 從 `da8d324` 建立 | 僅第一階段稽核與唯讀獨立入口；舊版保持可用 |
| 私人 Sites 第 38 版 | source `c42b51783f35fa2366c1582270e9a8ee8b485c85` | Sites API 確認部署 `appgdep_6ae81a120d5c8191b5e3bfd557c4cb32` succeeded；來源 checkout HEAD 與已部署版本相符 |

## GitHub 分支差異

`main...chatgpt-dev` 的 GitHub compare：chatgpt-dev ahead 6、behind 9（在同步修復前的 main `bcd6daa` 量測）。先前交接已逐項判定這 6 個提交被 main 包含或取代，本次未重新實作。`da8d324` 僅增加驗證器同步提交；分支差距不代表應整枝合併。

## Sites 實際來源差異

透過 Sites source helper 取得第 38 版來源後逐檔比對，並非以不同 repository 的 SHA 不同推斷內容不同。比較維護版 82 個檔案：70 個相同、10 個內容不同、2 個只存在維護版；Sites checkout 無未提交修改。

| 路徑 | 相對維護版的 Site 狀態 |
|---|---|
| `.github/workflows/ci.yml` | Site 缺少 |
| `docs/handoff-2026-11-02.md` | Site 缺少 |
| `PUBLISHING.md` | 內容不同 |
| `balance-editor.html` | 內容不同；內嵌預設資料有 21 個語意差異 |
| `docs/item-catalogue-spec.md` | 內容不同 |
| `server/online/connect.mjs` | 畫面／App 顯示名稱不同，權限未改變 |
| `server/online/game-validator.mjs` | Site 仍以遊戲 `787eff6`（v0.022）編譯 |
| `server/online/runtime-provenance.json` | Site 釘選 `787eff6`，維護版釘選 `06f4c33`（v0.029；v0.030 僅測試及版號變更） |
| `tests/category-tree-editor.test.mjs` | 內容不同 |
| `tests/daily-speed-boss.test.mjs` | 內容不同 |
| `tests/global-item-editor.test.mjs` | 內容不同 |
| `tests/global-item-workbench.browser.cjs` | 內容不同 |

內嵌資料 21 個語意差異包含：已移除的倍速道具／商店規則／圖示／pacing.rates、groupSize.max、遊戲顯示名稱與導覽分類。這些是既有版本之間的差異，本次只記錄，未修改遊戲資料或自動同步私人站點。

Sites 部署成功與「內容等於 GitHub main」是不同命題。此處已驗證來源與部署紀錄；登入後實際操作、GitHub App 發布及資料寫入尚未驗證。第 38 版不包含本次 main 同步修復或 V2 稽核入口。

## 本階段驗證與後續邊界

- 原有平衡器測試：118/118 通過；新增稽核工具測試：3/3 通過。
- 產出物：`bash scripts/build.sh` 與 `node scripts/validate-artifact.mjs` 通過。
- Playwright 官方 Chromium 下載無法取得有效 ZIP；另以 npm @sparticuz/chromium@153.0.0 執行本機瀏覽器檢查，手機導覽與 V2 唯讀入口通過。GitHub CI 採遊戲釘選的 Playwright Chromium，兩者版本不同。
- V2 不修改草稿、資料值、秒數規則、舊版入口或發布流程；唯讀入口也不會被現行 Worker 自動對外提供。
- 完整 V2 原始指令未取得；僅依交接第六節完成明確列出的第一階段，不自行設計下一階段編輯介面。
- 魔爆多目標特效案例與魔力循環技能文字維持擱置。

## 2026-11-02 18:38 接續紀錄

- 遊戲最新為 v0.031 `7c9ee58e2ddd5ad23744c36c0133c6879ccab2ac`。此提交僅遞增版號，透過現有 `[extended-regression]` 入口啟動六組延伸測試，沒有改 workflow 或遊戲規則；執行中不再推送遊戲。
- 延伸 run `41428742704` 已實際執行；economy、equipment、Chromium interfaces 有失敗，其他組仍在執行。不得視為驗收通過；先前 skipped 的資訊已被本次執行取代。
- 稽核方法已修正為正式 `__EMBERWILD_WORKSPACE_IMPORT`，包含原始文件 capture。raw → editor 及 effective game → editor 都為完整零差異；先前 215 / 10 項差異來自稽核繞過 source capture，不能當成產品資料遺失。
- 1909 個原始路徑皆通過原樣匯入／匯出。既有秒數 UI 有 46 項代表性欄位修改通過 UI → 匯出 → 真正遊戲套用；另有 2 個刻意唯讀案例、1 個永久持續案例。完整證據見 `v2-seconds-coverage.json`；不等於每個欄位或每筆物件都已驗收。
- V2 載入舊版原樣產生的四個核心模型；`build-v2-core.cjs`、provenance 與自動測試防止分叉。舊版單檔保持不變；完整新版編輯體驗仍需完整原始工作規格。
- Sites 已同步 Github main `da8d324` 的全部 82 個來源檔（逐檔 Git blob SHA 相符），第 39 版部署 succeeded。Site source commit `e2b1bd2799780e81f86f60bf004a987680d7d7bd`；deployment `appgdep_6ae8678af84c8191b3a36f8123c82af5`。此部署不含 V2 分支。
- 沒有修改遊戲 main、遊戲平衡值、掉落率或規則，也未處理擱置的魔爆與魔力循環文字。

## 開發者模式設計方向補充

使用者指定以目前遊戲介面設計 V2。現在主入口 `/v2` 為實際遊戲預覽，右側可開啟目前頁面的設定：技能對應共用技能編輯器、戰鬥對應秒數設定、裝備／商店／夥伴／任務／生活對應原管理頁。原稽核頁移至 `/v2-audit`。

同一份既有編輯文件與發布服務持有變更；遊戲 frame 使用記憶體儲存，預覽存檔不寫入真實遊戲的 localStorage。套用預覽不等於發布。既有網站根入口與 owner-private 存取政策保持可用。

本機已驗證：實際遊戲啟動、依頁面開啟設定、MP 修改經 UI 套用到實際遊戲、既有發布頁、存檔隔離、手機設定區，以及未登入／非允許使用者不能讀取 V2 資產。

## 2026-11-03 地區收益券欄位與遊戲 v0.046 同步

- 遊戲 `chatgpt-dev` v0.046（`4cace6794724953305183672dd55ca293236789f`）新增地區收益券。地圖設定新增 `overlevelVoucherGold`：主角等級超過該地圖最高等級後，此地區 30 分鐘收益券每張兌換的固定金幣。遊戲預設是等級 1 起的地區 100，每 5 級階段 +300。
- 平衡器地圖頁（舊版與 V2 共用同一編輯器）新增「超等收益券金幣（每張）」欄位，終局地圖不顯示。正規化預設與遊戲相同，0 為有效值，負數或非數字拒絕輸入。
- 依交接第七節同步：
  - `sync-preview-editor-contract.cjs`（內嵌預設資料、共用模型）
  - `sync-wishing-lake.cjs`（遊戲 v0.038 起的許願湖模型）
  - `build-online-runtime.cjs`（發布驗證器改用 v0.046 的 122 個遊戲腳本）
  - `build-v2-core.cjs`
  - `build-v2-assets.cjs`（V2 遊戲預覽改為 v0.046）
- 新增 `tests/region-voucher-gold.test.cjs`：預設值與遊戲一致；編輯器修改後能通過發布驗證器，遊戲套用後匯出值相同，重新載入回編輯器後也保留。
- V2 瀏覽器實測：在 `/v2` 地圖頁修改此欄位並「套用至遊戲預覽」後，遊戲讀到新值；狀態列顯示「尚未發布至 GitHub」。
- 真實 GitHub App 上傳與私人 Sites 部署仍未驗證：需要擁有者登入 Sites，本環境沒有 Sites 部署工具。V2 分支尚未合併到 main，也尚未部署到 Sites。
