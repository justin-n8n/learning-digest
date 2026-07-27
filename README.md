# 學習信件彙整站 (learning-digest)

把 Gmail「06_學習」標籤底下的訂閱電子報，依標籤分類整理成一個可瀏覽、可搜尋的靜態網頁。

網址：https://learning-digest.pages.dev

## 結構
- `index.html` — 前端主頁（純靜態，讀取 `data/labels.json` 動態產生分頁）
- `data/labels.json` — 標籤設定檔（可自行新增標籤，不需改程式碼）
- `data/<key>.json` — 各標籤的信件資料
- `data/CLAUDE.md` — **完整專案交接文件（給接手的 Claude / AI 看，是本專案的權威技術文件）**，包含系統架構、每週自動更新流程、重大事故記錄與教訓，任何要維護這個專案的 AI 對話都應該先讀這份文件。

## 標籤格式
```json
{ "key": "example", "name": "顯示名稱", "gmailLabel": "06_學習/xxx", "labelId": "Label_xxx", "bilingual": false }
```

## 信件資料格式
非雙語標籤：
```json
{ "label": "key", "emails": [{ "id", "subject", "date", "gmailUrl", "content" }] }
```
雙語標籤（bilingual: true）—— 目前 damon、james 用「段落級對齊」格式，逐段中英並排顯示：
```json
{ "label": "key", "emails": [{ "id", "subject", "date", "gmailUrl", "paragraphs": [{ "en", "zh" }, ...] }] }
```
wsj 目前仍使用舊版整段對照格式（尚未改為逐段對齊，詳見 `data/CLAUDE.md` 第 4 節）：
```json
{ "label": "key", "emails": [{ "id", "subject", "date", "gmailUrl", "contentEn", "contentZh" }] }
```

## 部署
Cloudflare Pages（連接此 repo，build 指令留空，輸出目錄設為 `/`），前面掛 Cloudflare Access 限制登入者（Email 一次性驗證碼，僅限擁有者信箱）。

**每週自動更新**：已設定排程（透過 claude-code-remote 的 scheduled task），會定期啟動一個新的 Claude session 讀取 `data/CLAUDE.md` 並依流程執行增量更新。**資料檔案的更新一律由使用者本人手動上傳到 GitHub**（用「Add file → Upload files」蓋掉舊檔），不透過自動化推送——這是因為實測發現大型 JSON 檔案（尤其含大量中文內容）透過 AI 工具呼叫直接推送容易被靜默截斷，細節與教訓詳見 `data/CLAUDE.md` 第 6 節。

## 後端功能（Cloudflare Pages Functions）
- `functions/api/read.js`：已讀狀態同步。GET 讀取、POST 合併寫入，存在 KV namespace（需在 Pages 專案設定綁定變數 `READ_KV`）。
- `functions/api/readwise.js`：畫重點存 Readwise 的後端代理，避免 API token 落到前端。需在 Pages 專案的環境變數設定加密變數 `READWISE_TOKEN`（Readwise 個人 API token，可在 https://readwise.io/access_token 取得）。

兩者皆需在 Cloudflare dashboard 手動設定（KV 綁定、環境變數），設定完成後重新部署即可生效。
