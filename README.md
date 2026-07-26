# 學習信件彙整站 (learning-digest)

把 Gmail「06_學習」標籤底下的訂閱電子報，依標籤分類整理成一個可瀏覽、可搜尋的靜態網頁。

## 結構
- `index.html` — 前端主頁（純靜態，讀取 `data/labels.json` 動態產生分頁）
- `data/labels.json` — 標籤設定檔（可自行新增標籤，不需改程式碼）
- `data/<key>.json` — 各標籤的信件資料

## 標籤格式
```json
{ "key": "example", "name": "顯示名稱", "gmailLabel": "06_學習/xxx", "labelId": "Label_xxx", "bilingual": false }
```

## 信件資料格式
非雙語標籤：
```json
{ "label": "key", "emails": [{ "id", "subject", "date", "gmailUrl", "content" }] }
```
雙語標籤（bilingual: true）：
```json
{ "label": "key", "emails": [{ "id", "subject", "date", "gmailUrl", "contentEn", "contentZh" }] }
```

## 部署
Cloudflare Pages（連接此 repo，build 指令留空，輸出目錄設為 `/`），前面掛 Cloudflare Access 限制登入者。

v1 為手動更新版：資料抓取與更新透過 Claude 執行 Gmail 抓取流程後直接 push 新的 `data/*.json`。
