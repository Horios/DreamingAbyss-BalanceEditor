# 平衡工作台：線上比較與 GitHub 發布

## 秒數／MP 改版的移植稽核

「秒數／MP 移植稽核」頁讀取同一份技能、狀態、怪物、裝備與道具資料，列出時間及事件欄位與待驗收範圍；不建立第二套技能資料庫，也不自動換算平衡值。MP 與獨立冷卻仍依改版計畫並存。

遊戲 v0.015 只新增排程核心，尚未啟用秒數戰鬥。此階段的設計器會在舊回合遷移前拒絕已標記的新秒數／MP 文件；後端驗證、發布摘要與提交也會拒絕，避免秒數被轉回回合或新欄位被舊執行器忽略。一般舊文件的匯入、比較、匯出與還原保持原流程。正式接通新 schema 後須共同更新此檢查、編輯欄位、發布 validator 與遊戲能力宣告，不能只刪除檢查或只換標籤。

## 開發者模式的新增、編輯與刪除

開發者模式在各遊戲頁面右下角提供清單按鈕，清單內可新增項目，點選項目開啟彈窗編輯或刪除：

| 遊戲頁面 | 清單 |
|---|---|
| 荒野探索 | 地圖清單、怪物清單（依地圖切換；怪物可改類型、倍率、個別基礎數值與技能） |
| 技能 | 技能清單 |
| 背包 | 裝備清單、道具清單（藥水、限時增益券、素材）、信物清單 |
| 裝備與信物 | 裝備清單、信物清單 |
| 商店 | 商店商品（隨機／固定）、道具清單 |
| 委託、支線 | 委託清單（每日委託／支線任務） |
| 隊伍編成、夥伴名冊 | 夥伴清單、信物清單 |
| 角色能力 | 職業數值（職業數量由遊戲固定，只能編輯） |

刪除按鈕需按兩次（「刪除」→「確認刪除」）。每次儲存或刪除都會驗證整份草稿，不通過時還原且不套用；仍被引用的資料（例如劇情指定的怪物、裝備技能池中的技能、任務前置條件）會顯示引用位置並拒絕刪除。刪除道具時一併移除其商店商品，刪除怪物時一併移除掉落與信物掉落中的引用，刪除地圖時一併刪除該地圖的怪物，刪除夥伴時一併刪除其專屬技能。

只修改開發者外殼（`balance-editor-v2.html`、`scripts/v2-*.js`、V2 文件）而沒有遊戲 checkout 時，用 `node scripts/repack-v2-shell.cjs` 更新 `server/online/v2-assets.mjs`；遊戲檔案保持原樣，並更新 `docs/v2-game-provenance.json` 的橋接雜湊。遊戲有新版本時仍用下方的同步指令。

## 同步遊戲新版本

遊戲資料或程式更新後，用一個指令完成全部同步步驟（內建資料與共用模型、許願湖、發布驗證器、V2 核心與遊戲預覽、線上包）：

```bash
EMBERWILD_GAME_ROOT=../Emberwild node scripts/sync-game.cjs
```

- 遊戲的 js／css／data／index.html 有未提交修改時會停止，避免來源紀錄對不上 commit；確定要用工作中的檔案時加 `--allow-dirty`。
- `node scripts/check-game-sync.cjs` 檢查記錄的遊戲 commit 是否等於目前遊戲 checkout。CI 的 `game-contract` 會執行它；落後時顯示警告與同步指令，不會讓 CI 失敗（加 `--strict` 才會）。
- 同步後執行 `npm test`、四組瀏覽器測試與 `bash scripts/build.sh && node scripts/validate-artifact.mjs`，再提交。

`sync-preview-editor-contract.cjs` 同步新工作區的內建資料及共用夥伴／成長模型；讀取目前測試分支 `data/balance.json`，不覆蓋已存在的瀏覽器草稿。夥伴固定能力／成長格式不再強制補回已淘汰的循環配點。`sync-combat-migration.cjs` 同步稽核與保護邏輯。發布 validator 的來源 commit 及每個模組 SHA256 保存在既有 provenance 文件。

線上入口：https://emberwild-balance.hortw.chatgpt.site/

工作台是 owner-private Sites，須登入擁有者的 ChatGPT 帳號。平衡器原始碼仍保存在私有 `Horios/Emberwild-Balance`；遊戲正式版、測試版的 `data/balance.json` 仍分別保存在 `Horios/Emberwild` 的 `main`、`chatgpt-dev`。不需要公開平衡器 Repository，也不在工作台另建平衡版本資料庫。

## 首次啟用上傳

1. 開啟工作台的「GitHub 連線設定」。
2. 按「連結 GitHub 並啟用上傳」，使用 **Horios** 帳號確認建立專用 GitHub App。
3. 安裝時選 **Only select repositories → Emberwild**，不要選 All repositories。權限只有 Contents: write、Actions: read，以及 GitHub 必要的 Metadata: read。
4. 返回工作台；如果沒有自動返回，開啟 `/setup`，按「已安裝，檢查連線」。後端會用 App JWT 核對真正的安裝、帳號、App ID、選取範圍及 Repository 可讀性；不信任回傳網址的 installation_id。
5. 顯示連線成功後，回到平衡器。重新取得線上版本即可啟用上傳。

這是 GitHub App manifest 流程。私鑰由 GitHub 直接交給後端，使用 AES-GCM 加密，綁定工作台使用者後存入 D1；不需要使用者下載、貼上或把私鑰送到聊天。installation token 只在該後端請求期間保存，限定 Emberwild、Contents write 與 Actions read。OAuth user scopes、PAT、帳號與組織管理權限均不使用。GitHub App 本身為私人 App。

App 尚未完成連結時，工作台可透過公開 GitHub API 讀取版本、比較、編輯、驗證及下載 JSON；上傳與正式版升級停用。公開 API 有用量限制；錯誤會顯示，不能當成零差異或發布成功。

## 日常操作

1. 新工作區會先載入目前 GitHub 測試版；已有瀏覽器草稿時保留草稿。若取得版本前已開始編輯，工作台也不會覆蓋剛輸入的修改。
2. 「本次變更」固定比較所選的 **測試版或正式版**。每次開啟比較會重新取得最新 commit。沒有「將草稿設為基準」；重開頁面也不會把未發布修改算成已發布。
3. 頂部比較與「發布管理」均使用實際匯出 JSON。顯示完整新增、修改、刪除，以及目標分支／commit。相容性遷移新增的 metadata 也會顯示。
4. 修改 → JSON 驗證 → 填寫版本說明 → 建立測試版摘要 → 檢查完整差異 → 勾選確認 → 確認發布。
5. 後端固定寫入 `chatgpt-dev:data/balance.json`，建立一個新的 GitHub commit；其他路徑不能由瀏覽器指定。
6. 提交後仍須「檢查部署狀態」。GitHub commit 成功與 GitHub Pages 部署成功分開顯示，部署必須符合實際 `build.json` 的 commit／balance blob。
7. 正式版只能取用 GitHub 已提交的測試版 commit，忽略未發布草稿。檢查來源 commit、完整差異，勾選確認並輸入「正式版」。

目前正式版 `0402f4b` 尚未支援新版採集／煉金產物格式。服務會阻擋只更新新版 JSON；須先完成遊戲程式升級，再發布該資料。本次只升級平衡工作台，不合併或修改遊戲正式版。

## 版本管控與還原

版本紀錄讀取 `data/balance.json` 的 Git commit history，支援分支、分頁、歷史比較、父版本修改摘要、下載和載入。歷史比較可以指定歷史參考，與頂部固定線上基準分開；歷史比較不覆蓋草稿。

還原先檢查歷史版本屬於目標分支，再驗證、比較和確認，建立新的 restore commit；不 reset、不 force push、不刪除後續紀錄。正式版還原同樣需要二次確認。

摘要綁定登入使用者、候選 JSON、目標 commit，十分鐘到期。D1 原子領取確保同一摘要只提交一次，跨 Worker 節點也成立。提交前重新核對目標 SHA/blob，正式版同時核對測試來源。衝突、過期、重複點擊、權限或网络錯誤均拒絕提交或回報未確認；不自動重送。

## 儲存與登入

網站與 API 都受 Sites 私人存取政策保護；操作另外檢查平台提供的登入身分、同來源、HMAC CSRF 與輸入大小。部署的 Site 不可任意改成公開；若要分享，先設計明確的發布人員權限。

平衡草稿仍依瀏覽器／網址自動儲存。跨裝置可以讀取同一批 GitHub 已發布版本，但尚未發布的草稿不會自動跨裝置同步；可下載／匯入搬移。D1 只存短期發布摘要及加密 App 連線，不保存第二份遊戲版本。

## 部署與維護

- `.openai/hosting.json` 保留固定 `project_id`，D1 binding 為 `DB`。
- `EMBERWILD_SESSION_SECRET` 必須為至少 32 字元的強隨機 secret，由 Sites runtime secrets 設定，不進入 Repository。**不要直接輪換或遺失此金鑰**，它也用於加密 App 憑證；需要輪換時先實作 re-encryption migration。
- 可選 `EMBERWILD_ALLOWED_USER_ID` 再縮限可操作的 Site 使用者；不要以可任意輸入的 HTTP header 替代平台身分。
- 也可由部署管理者設定 `EMBERWILD_GITHUB_APP_ID`、`EMBERWILD_GITHUB_INSTALLATION_ID`、`EMBERWILD_GITHUB_PRIVATE_KEY` runtime secrets，沿用既有 App，不必重新註冊。不要把 privateKeyPath 放到線上設定；Worker 不讀本機檔案。
- 遊戲 validator 編入 `server/online/game-validator.mjs`，使用原有 82 個遊戲腳本，沒有 runtime eval 或第二套 domain validation。`runtime-provenance.json` 記錄來源 commit 和各檔案 SHA256。升級遊戲 schema／驗證規則時，設置 `EMBERWILD_GAME_ROOT` 後執行 `node scripts/build-online-runtime.cjs`，測試並重新部署工作台。
- `node scripts/build-online.cjs` 從共享 CJS 發布服務與平衡器 HTML 產生 Worker 模組；`bash scripts/build.sh` 打包自包含 Worker，包含 D1 migrations。生成的 editor／release-service 模組與 Worker bundle 不手動修改。
- D1 schema 變更只能追加 migration；不可在請求中 CREATE／ALTER 資料表。
- Sites source repository 是部署來源鏡像；私人 GitHub Repository 是維護來源。更新時同步同一組來源到兩者，固定使用既有 Site ID。

## 本機模式

既有 `node server/server.cjs` 和 `http://127.0.0.1:4318/` 保留。需要並列的遊戲 checkout、Node.js 22+，並在 Repository 外設定 App 私鑰路徑；設定格式見 `server/server.cjs`。線上發布不依賴使用者電腦啟動本機服務。

## 驗證界線

本機測試覆蓋登入／CSRF、草稿保留、線上基準切換、完整遊戲 validator、持久化摘要、重複點擊、衝突、正式來源固定、歷史還原，以及 App manifest、JWT、PEM、加密與安裝檢查。模擬 API 測試不代表實際 GitHub 已授權或發布。首次專用 App 仍須擁有者到 GitHub 完成確認；此後才可驗收真實上傳與 Pages 部署。

## 全域道具管理器

新增功能、分類、篩選排序及直接設定／精準跳轉方式見 `GLOBAL_ITEM_CATALOGUE.md`；設計基準見 `docs/item-catalogue-spec.md`。全域管理器沿用原資料與庫存識別；新增經濟設定發布前要求目標遊戲支援 `itemDetailsVersion:2`。本次對應遊戲測試版 f303e506，正式版保持原狀。

## 工作台操作優化（Editor 2.1）

側欄可搜尋設定、道具、技能、地圖與怪物；所有頁面支援返回與「驗證與發布」。原始 JSON 未套用文字會獨立保留；先套用或捨棄才能發布。發布頁的「下一步」會帶到對應操作，完整操作說明可展開查看。改善範圍與驗證界線見 `docs/workbench-experience-audit-2026-10-14.md`。

## GitHub Actions 驗證（不需登入 Sites）

`.github/workflows/ci.yml` 只執行 Repository 內的程式，並以 `actions/checkout` 取得公開的 `Horios/Emberwild`（預設 `chatgpt-dev`，可於手動執行時指定其他分支或 commit），放在平衡器旁的 `../Emberwild`，與本機目錄結構相同。

- `tests`：先執行 `scripts/build-online.cjs` 產生 `release-service.mjs` 與 `editor.mjs`，再跑全部 `tests/*.test.mjs`、`tests/*.test.cjs`（遊戲契約測試除外）。涵蓋 JSON、資料模型、技能機制、匯入匯出、版本比較與發布服務。
- `game-contract`：單獨執行 `tests/preview-compatibility.test.cjs`，確認內嵌共用模型、發布驗證器來源雜湊與遊戲最新 `data/balance.json` 相容，且資料可往返匯出。遊戲更新共用檔案後這項會失敗，屬於需要同步的提示；同步方式為 `scripts/sync-preview-editor-contract.cjs` 與 `scripts/build-online-runtime.cjs`。
- `browser`：以遊戲 repository 釘選的 Playwright 啟動 Chromium，測試在本機 `127.0.0.1` HTTP Server 上開啟 `balance-editor.html`，API 以測試資料回應，不連線任何線上網址。
- `sites-artifact`：執行 `scripts/build.sh` 產生與 Sites 相同的部署產出物，並以 `scripts/validate-artifact.mjs` 驗證 Worker 模組。
- `sites-deployment`：線上工作台是擁有者私人 Sites，Actions 無法取得登入身分。此 job 一律標示「未驗證」，只記錄匿名存取網址的 HTTP 狀態碼供參考，不計入測試成敗，也不代表部署成功。實際部署驗收需由擁有者登入後確認。

本機執行與 CI 相同：

```bash
node scripts/build-online.cjs && node --test tests/*.test.mjs tests/*.test.cjs
```

## 分支狀態（2026-11-02 稽核）

`chatgpt-dev`（`4363276`）的 6 個提交已全部包含在 `main` 或被 `main` 的新版本取代：技能機制索引與重用、載入來源 JSON 保留、經驗曲線、治療藥水控制。後續以 `main` 為維護基準；`chatgpt-dev` 保留原狀，不強制改寫。

## 開發者模式 V2

根入口預設進入 `/v2`。使用遊戲導覽切換頁面時，自動顯示該頁使用的共用資料編輯項目，無須再從舊平衡器選單找功能。資料編輯模式下，點選技能槽／技能、商品／背包物品、敵方或我方頭像，會依穩定識別碼定位原有資料定義，並阻止該次點擊執行裝備／使用等遊玩操作；「遊玩測試」可恢復正常操作。`scripts/v2-page-context.js` 記錄各頁與既有編輯入口、JSON 路徑的對應，不另外建立資料模型。編輯後按「套用至遊戲預覽」將同一份文件交由真正遊戲驗證及套用；不會因此發布。右側「驗證與發布」沿用既有差異摘要、確認與版本管控。

桌面版遊戲與設定面板並排，手機版以可收起的設定面板顯示。面板使用遊戲配色並隱藏舊側欄與工具列；依目前遊戲頁面顯示相關設定分頁，可關閉「跟隨遊戲畫面」固定編輯項目。全部設定、草稿儲存、套用狀態及驗證發布沿用同一份工作文件。

遊戲預覽的存檔及進度保存在該 frame 的記憶體，重整會清除；不寫入正式遊戲存檔。既有平衡器草稿仍由原編輯器保存。原工作台保留於 `/workbench`，稽核報告移至 `/v2-audit`。

`scripts/build-v2-assets.cjs` 從並列遊戲 checkout 原樣封裝遊戲檔案，僅在入口注入預覽儲存隔離與套用橋接。來源 commit 與逐檔 SHA256 見 `docs/v2-game-provenance.json`。更新遊戲來源或 V2 文件後須重建封裝、跑 V2 瀏覽器與 hosting 測試並重新部署；生成的 `v2-assets.mjs` 不手動修改。

## 命名規則

遊戲名稱為「夢淵（Dreaming Abyss）」。畫面文字、文件與註解中的「Emberwild」一律寫作「Dreaming Abyss」，之後新增內容也依此辦理。程式運作依據維持原樣：程式識別名稱（`Emberwild*`、`__EMBERWILD_*`、`X-Emberwild-CSRF`）、User-Agent、localStorage 鍵名，以及實際存在的 repository 名稱與網址（`Horios/Emberwild`、`Horios/Emberwild-Balance`、`horios.github.io/Emberwild`）。

