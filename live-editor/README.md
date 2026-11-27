# 夢淵 即時平衡器（Live Balance Editor）

依目前遊戲版本重新打造的平衡器。直接在遊戲畫面上一邊玩一邊改，改完一鍵匯出完整平衡 JSON。
不依賴舊版 `balance-editor.html`／`balance-editor-v2.html`。

## 啟動

遊戲 repository 與本 repository 並列放置（`../DreamingAbyss`）：

```bash
npm run live
```

開啟 http://localhost:8787/ 即是遊戲本體，右下角多一顆「平衡器」按鈕。

遊戲放在其他位置時指定路徑與連接埠：

```bash
node live-editor/server.cjs /path/to/DreamingAbyss --port 9000
```

伺服器只在遊戲 `index.html` 的結尾注入 `live-editor/live-editor.js`，不修改遊戲任何檔案。

## 功能

| 功能 | 用法 |
|---|---|
| 🎯 定位 | 按下後點遊戲畫面上的道具、技能、夥伴、怪物、任務等。平衡器依點到的文字找出所有對應資料，點選即開啟編輯。 |
| ✎ 改字 | 按下後點畫面上任何文字，輸入新文字後儲存。輸入時即時預覽。數字自動視為 `{#}`，同一句原文全遊戲一起修改（寫入 `textOverrides`）。 |
| 資料 | 道具、技能、寶石、職業、輔助技能、夥伴、被動、信物、怪物、地圖、掉落、狀態、裝備類型、商店、劇情、委託、教學、許願池、製作、新手包、戰鬥公式、介面標題、選單等分類，另有「全部資料」可走訪整份文件。每個欄位依型別顯示輸入框；任何物件都能切換「以 JSON 編輯」；陣列項目可複製、刪除。 |
| 自動套用 | 每次修改先經遊戲 `validateBalanceConfig` 驗證，再以 `applyBalanceConfig` 套用並重繪畫面。驗證失敗時顯示原因，遊戲維持上一個有效狀態。 |
| 變更 | 列出與遊戲發布版本不同的每個欄位，可逐項還原。 |
| 復原／重做 | 最多 80 步。 |
| ⬇ 匯出 JSON | 驗證並套用後，輸出遊戲 `exportableBalance()` 整理過的完整文件（含文字覆寫），檔名 `dreaming-abyss-balance-日期-時間.json`。可直接取代遊戲的 `data/balance.json`，或在遊戲內「匯入平衡資料」。 |
| 匯入／重設 | 讀入先前匯出的 JSON 繼續編輯；或一鍵回到發布版本。 |

草稿自動保存在瀏覽器 localStorage（`da-live-editor-draft-v1`），重新整理後自動套用。遊戲發布版本更新時會詢問要沿用舊草稿或重新開始。
所有修改只以 `persist:false` 套用，不寫入遊戲的平衡測試存檔鍵；玩家存檔不受影響。

## 使用的遊戲介面

`validateBalanceConfig`、`applyBalanceConfig`、`exportableBalance`、`render`、`EmberwildTextOverrides`（`originalOf`／`templateOf`／`preview`），以及啟動事件 `emberwild-balance-ready`。
這些都是遊戲公開的全域介面，遊戲改版只要保留它們，平衡器不需同步任何程式。

## 主控台介面

`window.DreamingAbyssLiveEditor`：`draft`、`base`、`apply()`、`export()`、`setOverride(原文, 新文字)`、`inspectElement(元素)`。
