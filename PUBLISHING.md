# 平衡器發布管理

目前程式具備完整發布流程；真正的 GitHub 寫入需要先安裝專用 GitHub App。沒有 App 憑證時，仍可編輯、驗證、匯入及下載 JSON；不會顯示假的發布成功。

## 一次性設定

1. 將私有 `Emberwild-Balance` 與遊戲 `Emberwild` checkout 放在同一資料夾下；遊戲 checkout 使用已完成這次升級的版本。保留平衡器私有，不啟用公開 Pages。
2. 安裝 Node.js 22 或更新版本；後端沒有额外套件依賴。
3. 在 GitHub Settings → Developer settings → GitHub Apps 建立私人 App。Repository permissions 只選 **Contents: Read and write** 與 **Actions: Read-only**；Metadata 為 GitHub 必要的唯讀權限。不選 administration、secrets、organization 或帳號權限，不使用 OAuth user scopes，也不需要 webhook。
4. 將 App 安裝在 **Horios/Emberwild 這一個 Repository**。不要授予其他 Repository。記下 App ID 與 Installation ID。
5. 下載 App 私鑰，存放在兩個 Repository 以外的位置。服務會拒絕放在 Repository 內的金鑰；私鑰與 Token 不會傳送至瀏覽器，也不會進入 balance.json。
6. 建立使用者家目錄下的 `.config/emberwild-release/app-settings.json`：

```json
{
  "appId": "填入 App ID",
  "installationId": "填入 Installation ID",
  "privateKeyPath": "填入 Repository 外的私鑰檔案絕對路徑"
}
```

也可以使用 `EMBERWILD_GITHUB_APP_ID`、`EMBERWILD_GITHUB_INSTALLATION_ID`、`EMBERWILD_GITHUB_PRIVATE_KEY_PATH` 環境變數；`EMBERWILD_RELEASE_CONFIG` 可指定設定檔，`EMBERWILD_GAME_ROOT` 可指定遊戲 checkout。設定檔只有 IDs 與私鑰路徑，沒有私鑰內容或 PAT。

## 日常使用

在私有平衡器目錄執行：

```sh
node server/server.cjs
```

開啟 **http://127.0.0.1:4318/**。這是綁定 loopback 的單一使用者本機工具，不是公開網站或多人服務。只提供平衡器 HTML 與固定發布 API；不公開其他檔案。

第一次換到本機服務網址時，舊 file:// 或其他網址的瀏覽器草稿不會自動搬移。先從原工作台下載 JSON，再於新工作台匯入；新網址的草稿仍會自動儲存。

1. 修改既有設定頁；新 `lifeSkills` 設定可在原始 JSON 頁編輯。
2. 進入「發布管理」，驗證 JSON、取得線上測試版並比較。
3. 輸入具體版本說明，建立摘要；檢查所有新增／修改／刪除後勾選確認，發布測試版。
4. GitHub commit 完成後畫面顯示「資料已提交，等待 GitHub Pages 部署」。用「檢查部署狀態」核對網站 build.json；開啟測試版完成測試。
5. 選「取得測試版並建立正式版摘要」。來源是目前 GitHub chatgpt-dev 的固定 commit，**不使用本地草稿**。檢查測試版 commit、完整差異，輸入「正式版」並勾選確認後才可提交 main。
6. 版本紀錄直接取自 data/balance.json 的 Git commit history。可翻頁、下載、載入、查看與父版本的修改、設為歷史比較基準，再比較另一版本。比較不會覆蓋草稿。
7. 還原歷史版本會先檢查分支可達性、验证、比較，再建立新的 restore commit；不會 reset、force push 或刪除後續 commits。正式版還原同樣需要二次確認。

每個摘要 ticket 綁定本機 session、候選 JSON 與目標 commit，十分鐘到期。提交前再次讀取目標 SHA，正式版同時核對來源測試版 SHA。任何更新或非 fast-forward 都會被拒絕，請重新取得版本並重新比較。

備份下載永遠獨立可用。GitHub App 401、403／rate limit、404、409／422、逾時或提交後確認失敗，都會顯示錯誤，不會假稱網站已部署。成功提交與 Pages 部署分開處理。

## 維護

升級遊戲 validator／schema 時，一併更新服務使用的遊戲 checkout。GitHub App installation token 只在記憶體中保存並自動更新；私鑰透過檔案路徑讀取。

此服務刻意不能綁定公共網路或任意指定 Repository、任意寫入路徑。若日後要多人／雲端發布，須另外加入 HTTPS、OAuth 使用者授權與 session 儲存；不可直接公開目前的 loopback 服務。
