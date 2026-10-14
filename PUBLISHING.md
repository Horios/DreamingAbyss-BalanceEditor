# 平衡工作台：線上比較與 GitHub 發布

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
