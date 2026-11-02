# Dreaming Abyss V2：來源與部署差異

稽核時間：2026-11-02 17:13（Asia/Taipei）。此為時間點紀錄，繼續工作前仍須重新核對 HEAD、CI 與部署。

| 來源 | 實際提交 | 判定 |
|---|---|---|
| 遊戲 `chatgpt-dev` | `06f4c33eb1f981fc08cd31d9462577796e4e04dc`，v0.029 | 僅修正手機導覽測試定位並遞增版號；核心／存檔短測試通過，瀏覽器與長離線測試仍在執行 |
| 遊戲 `main` | `0402f4b2b1437a791b30eb0991fd479f77f9b5cf` | 未修改 |
| Preview 實際 HTTP | `8f20e67d7c2746b4dc33a71670a1e47455a5c1cb`，v0.015 | 已直接讀取 `/preview/data/build.json` 與 `/preview/data/preview-version.json`；與開發 HEAD 不同 |
| 平衡器 `main` | `da8d3241b41d8de2f0979a41724baa7b180f5f5b` | 僅重建既有 game-validator 與 provenance；來源釘選遊戲 v0.029；本機原有測試 118/118；GitHub CI 仍在執行 |
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
| `server/online/runtime-provenance.json` | Site 釘選 `787eff6`，維護版釘選 `06f4c33` |
| `tests/category-tree-editor.test.mjs` | 內容不同 |
| `tests/daily-speed-boss.test.mjs` | 內容不同 |
| `tests/global-item-editor.test.mjs` | 內容不同 |
| `tests/global-item-workbench.browser.cjs` | 內容不同 |

內嵌資料 21 個語意差異包含：已移除的倍速道具／商店規則／圖示／pacing.rates、groupSize.max、遊戲顯示名稱與導覽分類。這些是既有版本之間的差異，本次只記錄，未修改遊戲資料或自動同步私人站點。

Sites 部署成功與「內容等於 GitHub main」是不同命題。此處已驗證來源與部署紀錄；登入後實際操作、GitHub App 發布及資料寫入尚未驗證。第 38 版不包含本次 main 同步修復或 V2 稽核入口。

## 本階段驗證與後續邊界

- 原有平衡器測試：118/118 通過；新增稽核工具測試：3/3 通過。
- 產出物：`bash scripts/build.sh` 與 `node scripts/validate-artifact.mjs` 通過。
- 本機 Chromium 安裝無法取得有效 ZIP，瀏覽器驗證採 GitHub Actions，不能宣稱本機通過。
- V2 不修改草稿、資料值、秒數規則、舊版入口或發布流程；唯讀入口也不會被現行 Worker 自動對外提供。
- 完整 V2 原始指令未取得；僅依交接第六節完成明確列出的第一階段，不自行設計下一階段編輯介面。
- 魔爆多目標特效案例與魔力循環技能文字維持擱置。
