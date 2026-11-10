# 平衡器 ↔ 遊戲資料發布全鏈路排查（issue #2）

查核基準：遊戲 `Horios/DreamingAbyss` `chatgpt-dev` `aab17f6`（v0.120），平衡器 `Horios/DreamingAbyss-BalanceEditor` `main` `a14f1b6`。

範圍限定在資料發布鏈路。沒有修改任何平衡數值、遊戲程式、畫面版型，也沒有對測試版或正式版執行任何發布。所有破壞性情境都在記憶體中的 Git 替身、本機 HTTP 伺服器或暫存的 Repository 複本執行。

狀態用語：**已覆蓋**（有自動測試或可重複指令作為證據）、**待人工**（需要擁有者登入或真實線上環境）、**不適用**、**失敗**（確認的缺陷，已修正並附回歸測試）。

## 一、缺陷清單

| 編號 | 嚴重度 | 項目 | 現象與重現 | 原因 | 修正 | 回歸測試 |
|---|---|---|---|---|---|---|
| DEF-1 | 高 | D01、B05、H06 | 以目前線上資料（v0.120）在工作台只改一隻怪物的生命，發布會改寫 9 個模組檔（`meta/document`、`meta/notes`、`world/maps`、`world/monsters`、`combat/statuses`、`characters/classes`、`characters/support-skills`、`characters/passives`、`items/starter-packs`），摘要卻只列 1 筆修改；8 個無關模組的版本號一併遞增 | 線上模組是未正規化的原始資料，工作台匯出的是正規化文件；後端以檔案文字判斷模組是否改變 | 後端以同一個遊戲驗證程式載入兩邊，載入結果相同的模組保留線上原檔；保留後的文件必須再載入一次並與完整候選資料完全相同才採用，否則一併寫入並在摘要標示 `formatOnly` | `tests/release-audit.test.cjs`「D01」三項 |
| DEF-2 | 高 | D03 | 沒有任何編輯也能建立發布摘要並提交：`meta/notes` 每次匯出文字都不同，後端視為有變更，產生只改備註的 commit 並遞增版本號 | 同上；空白發布的判斷只看模組文字 | 兩邊載入結果完全相同時拒絕（沒有有效設定差異） | 同上，含真實資料與真實驗證器的情境 |
| DEF-3 | 高 | D07、D10 | 他人發布後，後端收到「舊基準的完整文件＋部分模組的基準雜湊」時，會把他人剛發布的模組改回舊內容；模組未附基準雜湊時同樣直接覆寫 | 衝突檢查只看有附雜湊的模組，卻以整份文件或全部送來的模組決定寫入內容 | 分支已前進時：完整文件只採用有附基準的模組，其餘保留新版本；未附基準的模組一律拒絕 | `tests/release-audit.test.cjs`「D07」兩項 |
| DEF-4 | 高 | C08、E05 | 目標分支的模組清單 schema 不是工作台認得的版本時，後端把分支當成「尚未模組化」，改走只寫 `data/balance.json` 的舊流程，會造成整合檔與模組不一致 | `manifest.schema` 不符時直接回傳 legacy | 清單屬於模組清單但版本、模組集合不相容時停止讀取與發布，標示「契約」層級 | 「C08」 |
| DEF-5 | 高 | E05 | 目標分支的遊戲新增欄位後，舊版工作台匯出時會丟掉該欄位，而且差異摘要不會顯示（兩邊經舊驗證器載入後都沒有該欄位）。實測工作台會丟掉不認得欄位的位置：`uiText`、`shopSettings` 及其商品列、`equipmentPowerSystem` 及前綴／後綴／BOSS 詞綴列、`balanceSettings.maps.catalog` 列、`statusDefinitions` 列、`passiveDefinitions` 列 | 匯入時以已知欄位重建物件 | 發布前比對線上模組、候選模組與載入結果的欄位樣式，會被靜默刪除的欄位一律停止發布並列出 | 「E05」兩項 |
| DEF-6 | 中 | E03、A07 | `check-game-sync.cjs` 只比對兩份紀錄的 commit 字串，不檢查模組共用程式的紀錄、任何檔案雜湊，也不檢查工作台自己的複本 | 原設計只做提示 | 比對三份紀錄、全部記錄檔案的 SHA-256、契約檔的 Git blob 與內嵌複本；區分「落後」與「來源不相容」。另在發布前以 Git tree 比對契約檔，不同時停止測試版發布 | `tests/check-game-sync.test.cjs` 第二項、「E03」 |
| DEF-7 | 中 | G04、G05 | 「檢查部署狀態」只要 `build.json` 宣稱的 commit 與 blob 相符就回報部署成功，沒有讀取網站實際提供的 `data/balance.json` | 只驗證中繼資料 | 另外下載 `data/balance.json`，重新計算 Git blob 後比對；不符時回報「部署未完成」並標示載入層級 | 「G04/G05」 |
| DEF-8 | 中 | D09 | 提交請求逾時或連線中斷時，工作台只顯示「發布結果尚未確認」，沒有任何方式判斷是否已寫入 | 沒有查核端點；摘要使用後即失效 | 新增 `outcome`：以摘要的基準 commit 與資料版本向 GitHub 查核，回報已提交／未提交／無法確認，不重送 | 「D09」 |
| DEF-9 | 中 | H04、H05 | 發布完成後沒有可保存的紀錄；API 失敗沒有標示發生在哪個階段 | 未實作 | 提交回傳發布收據並可下載；部署檢查結果寫回收據；所有 API 失敗附 `layer` | 「H04」「H05」 |
| DEF-10 | 低 | G04（遊戲端） | 部署 workflow 在 `deploy-pages` 結束後就算成功，沒有確認網站內容 | 未實作 | 遊戲 Repository 新增 `scripts/verify-deployment.cjs` 並接入 workflow | 遊戲 `tests/verify-deployment.test.cjs` |
| DEF-11 | 高 | B12、H05 | V2 的「套用至遊戲預覽」在預覽隊伍探索或遭遇中時顯示「已套用至遊戲預覽」，草稿標示為已套用，但遊戲仍使用舊數值；彈窗的儲存與刪除同樣顯示「已更新並套用至預覽」。重現：預覽遊戲開始探索後修改任一數值並按套用 | 遊戲在探索中拒絕新文件時回傳 `false` 而不丟出錯誤，橋接程式沒有檢查回傳值 | `scripts/v2-game-bridge.js` 檢查回傳值並回報「無法套用」；外殼的 `apply()` 回傳是否成功，彈窗只在成功時顯示「套用至預覽」 | `tests/v2-apply-refused.browser.cjs`；`tests/v2-inline-crud.browser.cjs` 原本把草稿有既有問題、預覽實際拒絕時的「已更新並套用至預覽」當成預期結果，已改為「已更新草稿，未套用至預覽」 |
| DEF-12 | 高 | B12 | 同一情境下預覽遊戲處於新舊混合狀態：被拒絕的文件中，秒數與 MP 等設定已經換成新值，隊伍相關設定仍是舊值。實測最大 MP 由 123 變成 124，但遊戲回傳未套用 | 拒絕的判斷位於包裝鏈內層（`team-runtime.js`），在它之後載入的 12 個模組已先套用新文件 | 橋接程式在被拒絕時把先前的文件重新套用一次並比對匯出結果，無法還原時要求重新整理。遊戲程式未修改（見下方） | 同上（確認被拒絕的文件沒有任何部分留在遊戲中） |
| DEF-13 | 高 | B02 | 技能定義的 `hitCount`、`powerPerLevel`、`procChancePerLevel`、`statusMaxTargets` 填入文字或 null 時，工作台、發布驗證器與遊戲都接受並保留，可以發布到線上 | 遊戲的技能驗證沒有檢查這些欄位的型別；一般設定欄位靠與預設值比對型別，記錄陣列內的選用欄位沒有預設值可比 | 發布服務在建立摘要時比對線上模組與候選模組的欄位型別：線上只出現數值的欄位不得變成文字、布林值或新的 null | `tests/release-audit.test.cjs`「B02」、`tests/boundary.test.cjs` |

修正所在：平衡器 `server/release-service.cjs`、`server/online/worker.mjs`、`server/server.cjs`、`scripts/check-game-sync.cjs`、`scripts/build-online-runtime.cjs`、`scripts/build-online.cjs`、`balance-editor.html`（發布頁的確認畫面、提交與部署檢查）；遊戲 `scripts/verify-deployment.cjs`、`.github/workflows/deploy-preview.yml`、`.github/workflows/test-skill-gems.yml`。

第二輪（DEF-11 至 DEF-13）另外修改平衡器的 `scripts/v2-game-bridge.js`、`scripts/v2-inline-edit.js`、`balance-editor-v2.html`、`server/release-service.cjs`，新增 `scripts/boundary-probe.cjs`；遊戲新增 `tests/balance-effects-systems.test.cjs`。

### 已確認但未修改的現象

- 工作台送出的發布內容在目前資料上一律是完整文件：草稿多出一個線上沒有的頂層鍵 `starterPackItems`，頂層鍵順序因此與線上不同，前端的「只送出異動模組」退回完整文件。後端修正後寫入範圍仍是正確的模組，所以沒有修改前端；影響是他人同時發布時不會自動合併，而是要求重新取得版本（安全，但較保守）。
- 寫入的模組檔內容是正規化後的格式。第一次修改某個模組時，該檔案的 Git 差異會包含格式變化（例如怪物的明確預設值），不只有被修改的那一行；數值經載入比對確認沒有改變。
- 遊戲的 `applyBalanceConfig` 一次約 4 秒（Node headless 環境），欄位級探測因此需要分批執行。
- 遊戲端的部分套用（DEF-12 的根因）沒有修改：`applyBalanceConfig` 在探索中回傳 `false` 時，外層模組已換成新文件；核心的 `importBalanceJSON` 也沒有檢查回傳值，遊戲內開發工具在探索中匯入測試設定會顯示「測試設定已套用」。正式資料在啟動時、存檔載入之前套用，不經過這條路徑，所以不影響發布；修正需要改動遊戲程式並重新同步工作台，建議另開 issue。遊戲的 `tests/balance-effects-systems.test.cjs` 記錄了目前的回傳值約定。
- 邊界值報表顯示 282 個數值欄位接受 -1、489 個接受 0、450 個接受 1e12（三個程式都保留）。探測無法判斷設計意圖，沒有新增範圍限制；各模組的數量列在 `docs/boundary-matrix.md` 最後一節，例如難度的生命倍率可以設為 0。
- 有 81 個欄位的文字、94 個欄位的 null 能通過工作台匯入匯出，但被發布驗證器拒絕並附原因，發布停在驗證層。
- `balance.affixes.poolBySlotRank` 的詞綴上限填小數時，工作台保留小數，驗證器取整數；發布摘要顯示的是取整後的值。

## 二、欄位級追溯（A03、A04、B01、B06、H01）

`node scripts/traceability.cjs` 對 `data/balance.json`（SHA-256 `02b2b55e8133…`，與 manifest 記錄的整合檔雜湊相同）的 1508 個欄位樣式（涵蓋 33187 個欄位值）逐一探測：每個樣式取第一筆資料改一次值，交給工作台（匯入→匯出）、發布驗證器與真正的遊戲（`applyBalanceConfig`→`exportableBalance`），記錄三個程式是否保留。完整結果在 `docs/traceability-matrix.json`，摘要在 `docs/traceability-matrix.md`，補充說明在 `docs/traceability-known.json`。完整產生一次約 38 分鐘。

| 狀態 | 欄位樣式 | 說明 |
|---|--:|---|
| `effective` | 875 | 三個程式都保留編輯值（整數 560、小數 178、字串 86、布林 51） |
| `constrained` | 242 | 列舉、ID 或引用：共用規則、工作台或遊戲驗證拒絕任意值。其中 126 個沒有候選值通過共用規則；其餘 116 個在工作台、驗證器或遊戲被拒絕，或被正規化回有效值 |
| `derived` | 99 | 由其他欄位衍生，修改來源欄位才會生效 |
| `fixed-by-game` | 31 | 遊戲程式固定此值 |
| `read-only` | 163 | `meta/reference`、`meta/notes`，遊戲匯出時重新產生 |
| `no-value` | 98 | 目前資料為空陣列、空物件或 null |

35 個模組的狀態：

- 31 個模組有 `effective` 欄位。
- `meta/reference`、`meta/notes`：說明文件，不是設定。
- `characters/support-skills`、`characters/passives`：整個模組都是 `skillSystem.definitions` 的投影，直接編輯不會生效。`characters/classes` 的 `skills` 陣列（40 個欄位樣式）與 `hp`／`atk`／`def` 同樣是投影。已個別確認修改來源欄位後投影同步改變。

遊戲固定的設定欄位（資料中有值但不會被採用）：`balanceSettings.monsters.encounter.bossChance`、`balanceSettings.maps.catalog.*.bossChance`（固定 0）、`balanceSettings.quests.tutorial.skillLevelRequirement`（固定 1）、`balanceSettings.maps.catalog.*.progressionGate`、`equipmentPowerSystem.rerollItem` 的 `cost`／`shopEnabled`、`timeUnits.consumableClock`（固定 `wall`）。工作台匯入時同樣會把這些欄位還原，所以沒有發現「工作台接受編輯、遊戲靜默忽略」的設定欄位；衍生欄位 `items.*.shopEnabled` 由固定商品清單決定。

其他觀察：

- 有 3 個欄位（`balanceSettings.progression.xpLevelGap.minimumMultiplier`、`balanceSettings.equipment.difficultyAffix.hardRareThreshold`、`skillSystem.definitions.*.target`）的無效值可通過工作台匯入匯出，但被發布驗證器拒絕並附原因；發布會停在驗證層。
- 有 4 個欄位（`statusDefinitions.*.permanent`、`companions.*.weapon`、`skillSystem.definitions.*.weaponTypes.*`、`skillSystem.definitions.*.usageScope`）遊戲接受探測值而工作台拒絕，工作台較嚴格。
- 49 個 `effective` 欄位樣式沒有任何 V2 遊戲頁面登記（`scripts/v2-page-context.js`）：`balanceSettings.combat` 之下除 `seconds`、`damageFormula` 以外的 37 個（`speed`、`caps`、`finalBoss`、`groupSize`、`pacing`、`supply` 等）、`skillIcons` 10 個、`iconColorTemplates` 1 個、`balanceSettings.meta.progressionCurveVersion`。這些欄位只能從原工作台或原始 JSON 編輯。未調整頁面對應（屬於 V2 版面範圍）。
- 探測的限制：每個樣式只測第一筆資料與一個值，不涵蓋邊界值（0、極大值、負數、空字串）；`bossAffixes` 的 parallel 群組未個別探測。

## 三、驗收項目對照

| 項目 | 狀態 | 證據與說明 |
|---|---|---|
| A01 | 已覆蓋／待人工 | 遊戲 `chatgpt-dev` `aab17f6`（v0.120，模組化）、`main` `317abe9`（v0.118，尚未模組化）；平衡器 `main` `a14f1b6`。已讀取兩邊的 workflow。工作台 Sites 的實際部署來源需擁有者登入確認 |
| A02 | 已覆蓋 | `npm run balance:check`：35 個模組一致。在暫存複本製造模組未重建、整合檔單獨修改、manifest 雜湊偏差、孤兒檔、缺少模組、格式非標準六種情況，全部被偵測並指出檔案 |
| A03 | 已覆蓋 | `docs/traceability-matrix.json`：每列含模組、JSON path、V2 頁面與區段、型別、編輯、三個程式的結果、提到該欄位的遊戲程式檔與狀態 |
| A04 | 已覆蓋 | 見第二節；4 個模組沒有可直接編輯的欄位並已標示 |
| A05 | 已覆蓋 | 矩陣的 `fixed-by-game`（31）與 `derived`（99），各附來源程式檔或來源欄位 |
| A06 | 已覆蓋（有發現） | 矩陣的 `pages` 欄；49 個有效欄位沒有 V2 頁面登記（見第二節）。既有測試「every game navigation page has editable shared data routes with existing document paths」通過 |
| A07 | 失敗→已修正 | DEF-6 |
| A08–A15 | 已覆蓋 | 35 個模組都在矩陣中，每個模組的欄位都有工作台匯入匯出、驗證器與遊戲載入的往返結果。實際遊戲數值的證據限於 F 區列出的代表欄位 |
| B01 | 已覆蓋 | 矩陣：整數、小數、字串、布林四種型別共 875 個欄位樣式保留編輯值 |
| B02 | 失敗→已修正 | `docs/boundary-matrix.json`：738 個數值欄位各嘗試 0、-1、1e12、整數加 0.5、文字、null，共 4133 個編輯，記錄共用規則、工作台、驗證器的結果與判定。發現 DEF-13 並修正。未涵蓋字串欄位的空字串、特殊字元與長文字 |
| B03 | 已覆蓋 | 既有 `seconds-authoring`、`audit-seconds-browser`（通過）；遊戲 `balance-effects`：冷卻秒數加 7.5 秒後 `skillCooldown` 增加相同秒數 |
| B04 | 已覆蓋 | `tests/entry-points.test.cjs`：10 個欄位分別以就地編輯與整份匯入兩種入口修改，匯出文字相同，除被編輯欄位與其衍生欄位外沒有其他差異，再次匯出不變。瀏覽器層的 `v2-inline-edit`、`v2-inline-crud`、`v2-game` 通過 |
| B05 | 失敗→已修正 | DEF-1、DEF-2；既有 `release-summary-noise` 通過 |
| B06 | 已覆蓋 | 矩陣的遊戲欄結果 |
| B07–B09 | 已覆蓋 | `v2-inline-crud.browser`（各頁新增、編輯、刪除）；`release-audit`「B08/B09」以真實驗證器確認調序（摘要一筆 `order`、一個模組）、重複 ID 被拒並定位、更名未更新引用被拒並列出引用欄位、連同引用一起更名時相關模組同次寫入、複製為新增 |
| B10 | 已覆蓋（既有） | 「a write outside the page modules is still found (sweep) and an unknown page sweeps every module」 |
| B11 | 已覆蓋（既有） | `online-baseline`、`workbench-experience`、「autosave writes only changed modules and a reload restores the draft from module keys」 |
| B12 | 失敗→已修正 | DEF-11、DEF-12；`v2-game.browser`、`v2-hosting` 通過 |
| C01 | 已覆蓋 | 遊戲 `test:balance-modules` 47 項通過；`balance-effects` 第一項確認模組重新整合後與 `data/balance.json` 逐位元組相同 |
| C02 | 已覆蓋 | 同 A02 |
| C03 | 已覆蓋（既有） | 遊戲 `balance-modules.test.cjs`、平衡器 `incremental-editing.test.cjs` |
| C04 | 部分覆蓋 | 怪物↔掉落的新增、刪除與懸空引用（`release-audit`「H02/G09」「D07/C05」）。其餘引用組合依賴既有驗證器規則，未逐一新增測試 |
| C05 | 已覆蓋 | 新增後立即引用、刪除後仍被引用、多模組同時修改（同上）。循環依賴未測 |
| C06 | 已覆蓋（既有） | 「deleting a referenced monster runs cross-module checks and locates every broken drop by module, record and field」 |
| C07 | 已覆蓋 | 建立摘要與提交時都以完整遊戲驗證器檢查完整文件；「D01」真實資料情境 |
| C08 | 失敗→已修正 | DEF-4、DEF-5、DEF-6 的發布前契約檢查 |
| D01 | 失敗→已修正 | DEF-1 |
| D02 | 已覆蓋（既有） | 同 B11 |
| D03 | 失敗→已修正 | DEF-2 |
| D04 | 已覆蓋 | 摘要兩邊經同一個驗證程式載入；「D01」確認只列 1 筆 |
| D05 | 已覆蓋 | 「H02/G09」：一個 commit 寫入兩個模組、manifest、整合檔與版本號；提交後重新讀取核對一致 |
| D06 | 已覆蓋 | 版本號取自提交當下的 HEAD，還原也遞增一次（「H02/G09」得到 v0.122）；資料發布不涉及 JS／CSS 快取參數 |
| D07 | 失敗→已修正 | DEF-3 |
| D08 | 已覆蓋 | `release-audit`「D08」：提交過程中建立 blob（403）、tree（404）、commit（409）、更新分支（422）各自失敗時都不回報成功、分支不動、摘要不可重用、`outcome` 回報未提交。既有測試涵蓋過期、重複點擊與衝突 |
| D09 | 失敗→已修正 | DEF-8 |
| D10 | 已覆蓋 | 分支限定 `main`／`chatgpt-dev`（含新的 `outcome`）；路徑由後端固定；正式版只取測試版 commit（既有 `balance-release-promote`、`balance-release-security`） |
| E01 | 已覆蓋（既有） | 「baseline is never the boot draft」「switching online reference never changes editing data」 |
| E02 | 已覆蓋 | 以 `aab17f6` 的複本實際執行 `sync-game.cjs`，七個步驟完成；產生檔除本次修改帶來的差異外沒有其他變動 |
| E03 | 失敗→已修正 | DEF-6 |
| E04 | 已覆蓋 | `check-game-sync.cjs --strict`：3 份來源紀錄與全部程式檔雜湊相符 |
| E05 | 失敗→已修正 | DEF-5 |
| E06 | 已覆蓋（既有） | 「failed refresh retains draft and marks baseline unavailable instead of reporting zero changes」 |
| E07 | 已覆蓋 | 暫存複本：整合檔單獨修改後 `check` 失敗（含 `--allow-legacy-integrated`），`resync` 只改動 `world/monsters.json`、manifest 與整合檔，差異只有被修改的那個數值；後端同樣拒絕發布（既有測試） |
| F01 | 部分覆蓋 | 遊戲以 `data/balance.json` 啟動，執行中的怪物、道具、職業、難度數值等於檔案內容。固定種子與歷史存檔語料未新增 |
| F02 | 已覆蓋 | 遊戲 `balance-effects`：難度與怪物倍率改變生成怪物的生命與攻擊。`balance-effects-systems`：掉落機率、數量與停用；離線結算的擊殺數與經驗隨設定改變。地圖遭遇組成未新增測試 |
| F03 | 部分覆蓋 | 冷卻秒數（含小數）、MP 消耗、傷害倍率。BUFF／DOT 時長與間隔、控制效果、戰報文字未新增測試，依賴遊戲既有的秒數與技能效果測試 |
| F04 | 已覆蓋 | 職業初始能力與每級成長、等級上限；夥伴初始能力對隊伍中既有夥伴與新招募者都生效。技能解鎖條件未新增測試 |
| F05 | 部分覆蓋 | 強化消耗、售價、需求等級即時改變；基礎能力只影響之後生成的裝備；信物效果只影響之後建立的信物。詞綴、精煉、裝備技能未新增測試 |
| F06 | 已覆蓋 | 道具價格、素材售價、商店刷新費用、生活素材購買價、委託板刷新費用。藥水與限時效果依賴遊戲既有測試 |
| F07 | 部分覆蓋 | 地圖名稱與等級範圍、採集週期、許願湖每日次數、劇情階段獎勵。任務前置與解鎖、許願湖抽選結果未新增測試 |
| F08 | 部分覆蓋 | 介面標題文字 |
| F09 | 已覆蓋 | 即時採用與只影響新生成內容的清單寫在遊戲 `DEVELOPMENT.md`（v0.122）與 `PUBLISHING.md`「套用至遊戲預覽」，工作台的部署檢查結果也會顯示這段說明 |
| F10 | 部分覆蓋 | 線上生成的怪物與離線結算使用同一份設定（怪物生命 5 倍時線上生成值為 5 倍、離線擊殺數減少）；完整模擬與加速模擬結果一致。升級、商店等入口未逐一比對 |
| G01 | 已覆蓋／待人工 | 本機執行等同 CI 的工作：`npm test` 全數通過、`game-contract` 的同步檢查與矩陣檢查通過、8 支瀏覽器測試通過、`build.sh` 與 `validate-artifact.mjs` 通過。`sites-deployment` 未驗證。GitHub Actions 的實際執行結果以推送後為準 |
| G02 | 已覆蓋 | 遊戲 `balance:check`、`balance:validate`、版本號檢查、`test:balance-modules`（41 項）與新增的 20 項通過。完整回歸（`node --test`，962 項）：未提供平衡器路徑時 895 項通過、56 項失敗、11 項略過，失敗集中在 32 個需要私有平衡器的檔案，都不在 CI 清單內；提供平衡器路徑後只剩 2 項：`balance-publisher.browser` 需要另一個正式版目錄 `../Emberwild-main`（環境），`companions-roster` 的「三十名角色捲動」畫面斷言（遊戲畫面測試，與資料發布無關，遊戲程式本次未修改）。GitHub Actions 的實際結果以推送後為準 |
| G03 | 已覆蓋 | `chatgpt-dev` `aab17f6`：`data/balance.json` blob `897ea2fd…`、manifest blob `3332a902…`、整合檔 SHA-256 `02b2b55e…`、版本 v0.120；`main` `317abe9`：blob `a28e75b1…` |
| G04、G05 | 失敗→已修正 | DEF-7、DEF-10。另以 `verify-deployment.cjs` 對真實網站唯讀檢查：測試版提供的確實是 `aab17f6`（6 項全過），正式版是 `317abe9`（4 項全過）。不同瀏覽器與 CDN 快取行為未測 |
| G06 | 已覆蓋 | `verify-deployment.cjs` 比對 `index.html` 引用的程式與樣式（含快取參數）與檔案內容 |
| G07 | 待人工 | 需擁有者登入工作台確認 Sites 版本、GitHub App 授權與發布流程 |
| G08 | 不適用 | 未獲授權發布正式版 |
| G09 | 已覆蓋／待人工 | 「H02/G09」：還原是新的 commit，模組、整合檔與先前版本逐位元組相同，版本號與模組版本繼續遞增。真實分支上的還原與部署待人工 |
| H01 | 已覆蓋 | 矩陣＋`tests/traceability.test.cjs`（6 項）＋CI 的 `traceability.cjs --check` |
| H02 | 已覆蓋 | ①「D01」真實資料單一數值；②「H02/G09」跨模組結構與引用；③「D07」與 `modular-release` 的合併／衝突 |
| H03 | 已覆蓋 | 見下方量測 |
| H04 | 失敗→已修正 | DEF-9 |
| H05 | 失敗→已修正 | DEF-9 |
| H06 | 已覆蓋 | 本次沒有修改任何平衡資料檔；發布後無關模組檔逐位元組不變（「D01」「E05」） |
| H07 | 已覆蓋 | `PUBLISHING.md`「發布驗收流程（issue #2）」；CI 接入矩陣檢查；遊戲 `DEVELOPMENT.md`「發布後的部署與生效驗證（v0.121）」 |
| H08 | 已覆蓋 | 本文件 |

### 量測（H03）

工作台單一怪物生命編輯（`bench-incremental.cjs`，Chromium，前端程式本次未修改）：增量追蹤與驗證 4.5 ms（序列化 3 個模組、檢查 1 筆記錄），單欄位驗證 0.1 ms；完整遊戲驗證 320.6 ms、完整共用規則檢查 26.3 ms；依模組差異 17.6 ms（完整差異 44.8 ms）；模組自動儲存 3.8 ms（寫入 1 個模組）。

後端發布（真實驗證器、記憶體 Git、本機同時有其他工作在執行，數字只適合前後比較）：

| | 修正前 | 修正後 |
|---|---|---|
| 第一次單一欄位發布寫入的模組 | 9 個 | 1 個 |
| 第二次單一欄位發布寫入的模組 | 2 個（含 `meta/notes`） | 1 個 |
| 提交時的寫入請求 | 15、8 | 7、7 |
| 建立摘要耗時 | 約 8.7–10.4 秒 | 約 13.8–14.0 秒 |
| 提交耗時 | 約 0.8–0.9 秒 | 約 0.9–1.0 秒 |

建立摘要多了一次完整遊戲載入，用來證明保留線上原檔不會改變遊戲讀到的數值。這段時間在線上 Worker 的實際表現需擁有者在部署後確認。

## 四、驗收條件

1. 完整性：35 個模組都有明確狀態；1508 個欄位樣式都有來源、編輯、輸出與遊戲載入的紀錄；不可編輯的欄位已標示。
2. 正確性：單欄位、跨模組引用、新增、刪除、調序、更名、複製、還原與數值邊界值有對應測試；歷史存檔語料、字串欄位的邊界值，以及部分遊戲行為（BUFF／DOT、詞綴與精煉、任務解鎖）沒有新增測試。
3. 一致性：發布寫入的模組、manifest、整合檔與版本號在同一個 commit，並在提交後重新讀取核對；無關模組不再被改寫。
4. 可發布性：模擬發布、衝突、拒絕、回應遺失、還原、部署比對都可獨立執行。真實的工作台發布、Sites 部署與 GitHub App 授權待人工。
5. 可維護性：遊戲新增或搬移欄位時，CI 的矩陣檢查會列出缺少紀錄的欄位。
6. 無假陽性：部署成功需要網站實際資料相符；各層級未通過時標示層級。

這次沒有對測試版或正式版發布任何資料。
