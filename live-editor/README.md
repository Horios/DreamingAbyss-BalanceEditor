# 夢淵 即時平衡器（Live Balance Editor）

依目前遊戲版本打造的平衡器。在遊戲畫面上一邊玩一邊改，改完一鍵匯出完整平衡 JSON，或直接輸出遊戲模組檔、提交到遊戲分支。
不依賴舊版 `balance-editor.html`／`balance-editor-v2.html`。

## 啟動

遊戲 repository 與本 repository 並列放置（`../DreamingAbyss`）：

```bash
npm run live
```

開啟 http://localhost:8787/ 即是遊戲本體，右下角多一顆「平衡器」按鈕（Alt+B 開關）。

遊戲放在其他位置時指定路徑與連接埠：

```bash
node live-editor/server.cjs /path/to/DreamingAbyss --port 9000
```

伺服器只在遊戲 `index.html` 結尾注入 `live-editor/live-editor.js`，不修改遊戲任何檔案（除非使用「直接提交到遊戲分支」）。伺服器只聽本機 127.0.0.1。

## 單檔 HTML（不需伺服器）

```bash
npm run build:html
```

產生 `live-editor/dist/dreaming-abyss-live-editor.html`，內含遊戲與平衡器，雙擊即可用瀏覽器開啟。遊戲程式、樣式與 `data/` 全部內嵌，以遊戲資料夾當下的版本為準。
單檔模式沒有本機伺服器，「直接提交到遊戲分支」不可用；請改用「輸出遊戲模組檔」ZIP。其餘功能相同。CI 每次也會打包一份，可在 Actions 的 artifact 下載。

## 功能

### 找資料
| 功能 | 說明 |
|---|---|
| 🎯 定位（Alt+F） | 點遊戲畫面上的道具、技能、夥伴、怪物、任務等，找出對應資料。開啟後，畫面上出現的數值與文字所對應的欄位會以黃框標示並自動捲到該處。 |
| 同步編輯 | 定位結果中同名的資料合併為「×N · 全部一起改」，修改會寫入每一筆。預設只勾選同一遊戲系統的資料，可逐筆勾選或取消。識別欄位不可統一修改。 |
| 系統分類 | 資料分類按鈕依遊戲系統分為 7 組：職業與技能、夥伴、道具與裝備、怪物與地圖、任務與劇情、商店與經濟、戰鬥與系統。 |
| 全域搜尋 | 依名稱或識別碼搜尋所有分類。 |
| 釘選與最近 | 編輯畫面可釘選；最近開過的 10 筆顯示在分類下方。 |

### 編輯
| 功能 | 說明 |
|---|---|
| 中文參數 | 每個欄位顯示中文名稱與原始欄位名，附單位說明（機率、秒數、百分點、倍率、權重）與 `_reference` 的代碼說明。 |
| 欄位分組 | 物件第一層依「基本資料、數值、開關、取得與解鎖、價格與獎勵、其他文字、子項目」分組。 |
| 代碼選單 | 屬性、種族、施放方式、品質為下拉選單；其他代碼欄位提供遊戲中既有值的建議清單。 |
| 引用欄位 | 技能、道具、夥伴、怪物、狀態、裝備類型、地圖、被動、任務等引用欄位提供識別碼清單，並顯示被引用資料的名稱；找不到時警告。 |
| 數值檢查 | 機率超出 0~1、價格／權重／數量為負、秒數為負或 0 等，輸入當下即提示。 |
| 錯誤定位 | 遊戲驗證失敗時，狀態列列出出錯欄位連結，點擊後開啟並以紅框標示。 |
| 識別碼改名 | 識別碼欄位旁的「改名」會同時更新所有引用。 |
| 刪除確認 | 刪除整筆資料前列出所有引用位置，並提醒既有存檔相容性。 |
| 表格與批次 | 陣列型分類可切換表格，逐格編輯、點標題排序；批次調整可對篩選結果的某欄位做乘、加、設定或百分比增減。 |
| 戰鬥預覽 | 技能顯示倍率、每秒倍率，進入遊戲後依目前角色攻擊估算單次與每秒傷害；怪物顯示大約擊倒次數；道具顯示賣出比例。 |
| ✎ 改字（Alt+T） | 點畫面文字直接修改，寫入 `textOverrides`。若這段文字來自資料欄位，會先列出該欄位，建議直接改資料。 |
| 自動套用 | 每次修改先經遊戲 `validateBalanceConfig` 驗證，再以 `applyBalanceConfig` 套用並重繪。 |
| 復原／重做 | 最多 80 步（Ctrl+Z／Ctrl+Shift+Z）。 |

### 測試
「測試」頁可增加金幣、給予道具與素材、回滿生命。只改目前存檔，不寫進平衡資料。

### 變更與發布
| 功能 | 說明 |
|---|---|
| 變更 | 依遊戲系統與資料分組列出所有變更，可逐項還原；取消勾選的資料不納入匯出與提交（草稿保留）。 |
| 變更報告 | 下載 Markdown 報告，列出每筆資料的欄位、原值與新值。 |
| ⬇ 匯出 JSON（Ctrl+Shift+E） | 驗證並執行遊戲完整檢查（`EmberwildBalanceDocument.inspect`）後輸出整份平衡資料。 |
| 輸出模組 ZIP | 直接產生 `data/balance/<模組>.json`、`data/balance/manifest.json` 與 `data/balance.json`。以遊戲原始發布檔為底，只套用本次變更。解壓到遊戲 repository 根目錄即可。 |
| 直接提交到遊戲分支 | 透過本機伺服器把模組檔寫入遊戲資料夾，建立新分支並提交，可選擇推送。提交前執行遊戲的 `scripts/balance-modules.cjs check`；失敗時自動還原。遊戲資料夾 `data/` 有未提交修改時拒絕執行。完成後切回原分支。 |
| 匯入／重設 | 讀入先前匯出的 JSON，或回到發布版本。 |

草稿自動保存在瀏覽器 localStorage（`da-live-editor-draft-v1`），重新整理後自動套用。所有修改只以 `persist:false` 套用，玩家存檔不受影響（測試頁除外）。

## 快捷鍵

| 按鍵 | 功能 |
|---|---|
| Alt+F | 定位 |
| Alt+T | 改字 |
| Alt+B | 開關面板 |
| Ctrl+S | 套用到遊戲 |
| Ctrl+Shift+E | 匯出 JSON |
| Ctrl+Z／Ctrl+Shift+Z | 復原／重做 |

## 測試與 CI

```bash
npm test
```

在 headless Chromium 開啟真正的遊戲，逐項驗證上述功能；提交測試在遊戲的暫存 clone 上進行。需要 Playwright。
CI（`.github/workflows/live-editor.yml`）取得 `Horios/DreamingAbyss` 的 `chatgpt-dev` 並執行同一套測試。

## 使用的遊戲介面

`validateBalanceConfig`、`applyBalanceConfig`、`exportableBalance`、`render`、`stats`、`state`、`EmberwildTextOverrides`、`EmberwildBalanceDocument.inspect`、`EmberwildBalanceModules`（`split`／`assemble`／`serialize`／`createManifest`／`referenceIndex`），以及啟動事件 `emberwild-balance-ready`。

## 主控台介面

`window.DreamingAbyssLiveEditor`：`draft`、`base`、`apply()`、`export()`、`setOverride()`、`inspectElement()`、`openGroup()`、`findRefs()`、`buildModuleFiles()`、`changeReport()`。
