# 學習信件彙整站（learning-digest）專案交接文件

最後更新：2026-07-27

這份文件是為了讓新的 Claude 對話（新視窗/新 session，包含每週自動排程觸發的 session）能夠無縫接手這個專案而寫的。請新的 Claude 在開始工作前完整閱讀這份文件。

---

## 0. 目前狀態（2026-07-27）

網站已經正式上線並運作中：
- 網址：https://learning-digest.pages.dev
- GitHub repo：`justin-n8n/learning-digest`（public）
- 前端已改版為天空藍配色，右上角有「使用說明」按鈕（操作教學＋維護方式說明）。
- 已設定 Cloudflare Access 登入保護、已讀狀態雲端同步（KV）、畫重點存 Readwise 功能，皆已驗證可用。
- **每週自動更新排程已設定**（見第 9 節），不需要使用者手動提醒即可定期更新。

## 1. 專案目標

使用者（Justin）的 Gmail 帳號下有一個「06_學習」標籤，底下有多個子標籤，每個子標籤對應一個訂閱的電子報/newsletter 寄件來源。網站把這些信件依標籤分類呈現，方便閱讀與學習。

需求摘要：
1. 依照 Gmail 子標籤分類顯示（頁籤 tabs），每個標籤內的信件依日期新到舊排序。
2. 標籤清單可自行擴充（`data/labels.json`），不需要改程式碼架構。
3. 標記為 `bilingual: true` 的標籤（目前是 Damon、james、華爾街日報）要把英文內容翻譯成繁體中文，中英對照呈現。
4. 其餘標籤不翻譯、不摘要，只呈現清理過的原文內容（`content`）。
5. 網頁預設只顯示「最近 6 個月」的信件，可勾選「顯示全部歷史」看更早的。
6. Cloudflare Access 保護，只有使用者自己的 Google 帳號能登入。
7. 已讀時間戳記與畫重點存 Readwise：已完成並驗證可用。
8. 更新方式：**已從 v1 手動版升級為每週自動排程**（2026-07-27 起，見第 9 節）。

## 2. 技術架構

- **前端**：純靜態單一 `index.html`（自包含 CSS/JS），讀取 `data/labels.json` 動態產生分頁。
- **託管**：Cloudflare Pages（連接 GitHub repo 自動部署，build 指令留空，輸出目錄 `/`）。
- **後端**：Cloudflare Pages Functions —— `functions/api/read.js`（已讀狀態，需要 KV binding `READ_KV`）、`functions/api/readwise.js`（Readwise API 代理，需要環境變數 `READWISE_TOKEN`）。
- **Cloudflare Access（Zero Trust）**：限制只有使用者自己的 Google 帳號可以登入存取整個網站。
- **資料抓取**：透過 Gmail MCP 工具（`mcp__Gmail__*`）用 `label:` 查詢語法抓信，用 `get_thread` 抓全文內容。
- **推送資料到 GitHub**：⚠️ **重要**——這個沙盒環境的 `git push` / 直接呼叫 GitHub REST API 都會被安全代理擋下（`git push` 會卡在要求終端機認證；直接 curl GitHub API 寫入端點會回傳「Write access to this GitHub API path is not permitted through this proxy」）。**唯一能寫入的方式是使用 MCP 工具 `mcp__remote-devices__github__create_or_update_file`（單檔）或 `mcp__remote-devices__github__push_files`（多檔一次 commit）**，把完整檔案內容當作參數傳入。更新既有檔案時需要先用 `get_file_contents` 拿到該檔案目前的 `sha`。
  - **檔案大小限制（2026-07-27 新增，非常重要，詳見第 6 節事故三）**：`content` 參數必須由 AI 在當下這輪對話「原樣輸出」全部內容，不是引用檔案路徑。實測 **~150KB 以下**（James.json 124KB）可以放心交給 subagent 直接推送；**超過這個門檻（例如 damon.json 465KB、wsj.json 2.3MB）不要再用 subagent 硬推**，容易輸出被截斷、把正式檔案寫壞卻誤判成功。超過門檻的檔案，請改成用 `SendUserFile` 交給使用者，請他自己到 GitHub 網頁用「Add file → Upload files」手動上傳蓋掉舊檔（使用者對這個流程已經很熟悉）。推送完不論是誰推的，都要用 `get_file_contents` 核對 byte size 是否跟來源檔案一致，不要只看有沒有報錯。
- **排程更新**：用 claude-code-remote MCP server 的 `create_trigger`/`update_trigger`/`list_triggers` 等工具。**絕對不要用**本機的 `CronCreate`/`CronList`/`CronDelete`，那些是 session 內部排程，session 結束就失效。

## 3. 標籤清單（目前 10 個，2026-07-27 起現況）

> **2026-07-27 使用者決策更新（覆蓋舊規則）：**
> - **數位時代（bnext）、ali mirza（ali_mirza）、未來商務（future_biz）已被使用者要求永久移除**，已從 `data/labels.json` 刪除，網站上不再顯示這三個分頁。除非使用者明確表示要重新加回來，否則不要主動恢復，也不要再抓取這些標籤的信件。
> - **大師輕鬆讀（master_easy_read）已補齊全部歷史信件（122 封）**，`data/master_easy_read.json` 已完整，並已正式加入每週自動更新的標籤清單（不再是「不再抓取」狀態）。
> - **華爾街日報（wsj）的雙語問題已修正**：`wsj.json` 資料本身其實已經是中英對照格式（`contentEn`/`contentZh`），但 2026-07-26 一度把 `labels.json` 的 `bilingual` 改成 `false` 導致前端顯示空白。2026-07-27 已改回 `bilingual: true`，wsj 現在**是**雙語標籤，資料完整（187 封起跳），繼續維持雙語抓取與翻譯。

| key | 顯示名稱 | Gmail 標籤路徑 | Gmail labelId | bilingual | 抓取範圍 |
|---|---|---|---|---|---|
| damon | Damon | 06_學習/Damon | Label_3753692681857176071 | ✅ 是（段落對齊格式） | 全歷史（已完整，每週增量更新） |
| james | james | 06_學習/james | Label_2318727129382809273 | ✅ 是（段落對齊格式） | 全歷史（已完整，每週增量更新） |
| wsj | 華爾街日報 | 06_學習/華爾街日報 | Label_8760175458355617909 | ✅ 是（舊版 contentEn/contentZh 格式，暫不對齊，見第 4 節） | 全歷史（已完整，每週增量更新） |
| ai2026 | 2026AI訂閱 | 06_學習/2026AI訂閱 | Label_522335023913587695 | 否 | 全歷史（每週增量更新） |
| master_easy_read | 大師輕鬆讀 | 06_學習/大師輕鬆讀 | Label_850179891846499761 | 否 | 全歷史（2026-07-27 已補齊122封，每週增量更新） |
| alvin | 艾爾文 | 06_學習/艾爾文 | Label_2171113756778292459 | 否 | 全歷史（每週增量更新） |
| vista_cheng | Vista Cheng | 06_學習/Vista Cheng from Vista電子報 | Label_4092887730022971363 | 否 | 全歷史（每週增量更新） |
| fuge | 福哥來信 | 06_學習/福哥來信 | Label_4523792686777732210 | 否 | 全歷史（每週增量更新） |
| brief | Brief | 06_學習/Brief | Label_3367205939263792668 | 否 | 近 6 個月（每週增量更新） |
| hou_zhixun | 侯智薰 | 06_學習/侯智薰 | Label_3544715739386180075 | 否 | ⛔ 使用者決定不抓取（維持現狀） |

`bnext`（數位時代）、`ali_mirza`（ali mirza）、`future_biz`（未來商務）：**已移除，不在 `labels.json` 裡，不要抓取。**

這份對照表就是 `data/labels.json`，之後使用者想加新標籤，只要在這個 JSON 陣列裡新增一筆即可，不需要改前端程式碼邏輯。

## 4. 資料抓取與清理規則

- Gmail 搜尋語法：全歷史標籤不要加 `newer_than:`，直接用 `label:06_學習/<子標籤名稱>` 抓全部；brief 用 `newer_than:6m`。**注意**：`label:` 用顯示名稱（display name）查詢才查得到結果，用 label ID 查詢會回傳空結果。標籤名稱有空格要加引號，例如 `label:"06_學習/Vista Cheng from Vista電子報"`。
- `resultCountEstimate` 欄位不可信，必須用 `THREAD_VIEW_METADATA_ONLY`（或 `THREAD_VIEW_MINIMAL`）分頁抓完整個結果集才能拿到真實信件數量。
- 抓信內容用 `get_thread`（`messageFormat=FULL_CONTENT`），但**取回後只保留 `plaintextBody` 欄位、忽略 `htmlBody`**——`htmlBody` 內含大量無用的 CSS/樣板標籤，會浪費大量 token，完全不需要。
- **清理規則**：去除取消訂閱連結、社群媒體圖示連結、追蹤像素、"View this post on the web"、平台固定頁尾、書單/業配連結、廣告 banner、"COMING SOON" 之類的推廣區塊。只保留信件的實質內容（標題、作者、核心觀點內文、引言、作者小傳等）。
- **只有 damon / james / wsj 這三個標籤需要翻譯成繁體中文**，其餘標籤完全不要翻譯、不要摘要，保留原文。
- 資料輸出格式（每個標籤一個 JSON 檔）：
  - 非雙語標籤：`{"label": "<key>", "emails": [{"id", "subject", "date"(ISO), "gmailUrl", "content"}]}`
  - 雙語標籤（damon、james）：`{"label": "<key>", "emails": [{"id", "subject", "date"(ISO), "gmailUrl", "paragraphs": [{"en", "zh"}, ...]}]}`
  - 依 `date` 新到舊排序。
  - `gmailUrl` 格式：`https://mail.google.com/mail/u/0/#all/<threadId>`

> **2026-07-27 重要更新：雙語資料格式改為「段落級對齊」（`paragraphs` 陣列）**
> - **背景**：使用者反映中英對照畫面「英文跟中文對不齊」，原因是原本的格式是 `contentEn`/`contentZh` 兩大段純文字，各自獨立換行、各自捲動，段落數/長度不一致時右邊的中文會跟左邊的英文完全對不上。
> - **新格式**：把內文拆成「段落陣列」`paragraphs: [{"en": "...", "zh": "..."}, ...]`，每個陣列元素是一個英文段落 + 對應的中文翻譯段落，前端會逐列並排渲染（同一列一定是同一段），確保視覺上精準對齊。
> - **翻譯規則（非常重要，適用於 damon、james 這兩個標籤，之後任何一個要做逐段對齊的雙語標籤都要遵守）**：**翻譯時必須嚴格保持「一個英文段落 = 一個中文段落」，絕對不可以合併多段、也不可以把段落摘要成一段。** 即使是很短的段落（例如只有一個數字、一個分隔線、一個小標題），也要獨立成一個陣列元素，不要跟前後段落合併。段落判定以原文的空行（`\n\n`）為界。
> - **damon、james 現況**：2026-07-27 已將現有全部歷史信件（damon 95 封、james 22 封）轉換成 `paragraphs` 格式並驗證對齊（damon 94/95、james 21/22 完全逐段對應，剩下各 1 封因為原始翻譯段落結構有些微差異，暫時保留舊的 `contentEn`/`contentZh` 格式作為前端 fallback）。**之後 damon、james 的每週增量更新，新抓的信件也必須直接組成 `paragraphs` 格式，不要再用舊的 contentEn/contentZh 格式。**
> - **wsj（華爾街日報）現況（重要，先不要動）**：wsj 的中文翻譯是「整合摘要式」——把好幾個英文段落（例如「標題編號」+「一句話摘要」）合併翻譯成一段，跟英文原文的段落結構完全不同（187 封中有 110 封段落數對不上，比例過高，不是個案）。**使用者已明確決定：wsj 這次先不重新翻譯**，維持現有的 `contentEn`/`contentZh` 舊格式與前端舊版「兩欄各自捲動」呈現方式。如果之後使用者要求把 wsj 也做成逐段對齊，必須把全部 187 封信重新翻譯（改成嚴格逐段翻譯、不合併不摘要），這是一項耗時耗 token 的大工程，動手前務必先跟使用者確認範圍與预估時間，不要自行開始。
> - **前端相容性**：`index.html` 的渲染邏輯是「有 `paragraphs` 陣列就用逐段對齊排版；沒有的話 fallback 回舊版 `contentEn`/`contentZh` 兩欄各自捲動」，兩種格式可以並存，不會互相影響。

## 5. 每週自動更新的執行流程（給排程觸發的 session 看）

當這份文件是被「每週自動更新」排程觸發的 session 讀到時，請照以下步驟執行「增量更新」（只抓新信，不要重抓已經有的）：

1. 從 GitHub 讀取 `data/labels.json`，取得目前所有標籤清單。
2. 對第 3 節標記「每週增量更新」的每一個標籤：
   a. 從 GitHub 讀取該標籤現有的 `data/<key>.json`，找出裡面最新的 `date`（第一筆，因為已按新到舊排序）。
   b. 用 Gmail 搜尋該標籤的信，篩選出 `date` 比現有最新那筆更新的信件（可以搜尋時加 `after:YYYY/MM/DD` 抓保險一點的範圍，抓回來後再用 `id` 去重）。
   c. 若沒有新信，跳過這個標籤，處理下一個。
   d. 若有新信，用第 4 節規則清理（雙語標籤要翻譯；damon/james 要組成 `paragraphs` 格式，wsj 維持舊的 `contentEn`/`contentZh` 格式），組成新的 email 物件，**加到現有陣列最前面**（維持新到舊排序），組回完整 JSON。
   e. 檢查更新後的完整 JSON 檔案大小：**~150KB 以下**用 `mcp__remote-devices__github__create_or_update_file` 直接推送（需要先用 `get_file_contents` 拿到目前檔案的 `sha`）；**超過 ~150KB** 則改用 `SendUserFile` 交給使用者手動上傳（詳見第 2 節、第 6 節事故三）。**每處理完一個標籤就處理一次，不要全部標籤都抓完才一次處理**（避免中途出錯遺失已完成的部分）。
3. 全部標籤處理完後，可以簡單記錄這次更新了幾個標籤、新增了幾封信（不需要主動通知使用者，除非有異常狀況，例如某個 Gmail 標籤已經不存在了）。
4. 資料量大的標籤（wsj、fuge）建議交給 subagent 處理抓取＋清理，但**推送時仍要遵守第 2 節的檔案大小限制**，不要讓 subagent 硬推超過 ~150KB 的完整檔案。

## 6. 重大事故記錄（非常重要，請詳讀，避免重蹈覆轍）

### 事故一：雲端工作環境重置導致資料遺失（2026-07 中旬）
曾經連續呼叫多個 subagent 平行抓取不同標籤的 Gmail 資料，寫入雲端沙盒工作區但沒有立即同步/推送到外部（GitHub 或使用者本機）。後來因為額度上限錯誤，沙盒環境被重置，所有寫在沙盒裡但還沒推送出去的資料全部消失。

**教訓：任何整理好的資料，寫完就立刻推送到 GitHub（或用 `SendUserFile` 交給使用者），不要囤著等全部做完才交付。沙盒是不可靠的暫存空間。**

### 事故二：直接用 git / curl 寫入 GitHub 會被安全代理擋下（2026-07-27）
沙盒環境對外的 git push 與直接呼叫 GitHub REST API 寫入端點都被安全代理阻擋（詳見第 2 節）。**唯一能用的寫入方式是 `mcp__remote-devices__github__*` 系列 MCP 工具**，不要浪費時間嘗試 git push 或 curl PUT。

### 事故三：`create_or_update_file` 推送過大檔案時會被截斷、把 GitHub 上的檔案寫壞（2026-07-27）
把 damon.json（改成段落對齊格式後約 465KB）交給 subagent 用 `mcp__remote-devices__github__create_or_update_file` 推送時，subagent 反覆嘗試都無法把完整內容放進 `content` 參數（每次只塞進幾百到幾千 bytes），最後誤把一個只有 1 封信、明顯不完整的 JSON 當作「推送成功」寫上 GitHub，導致網站上的 Damon 分頁一度只剩 1 封信可看。

**根本原因**：`content` 參數的值必須由執行推送的那個 AI 對話輪次「原樣打出來」（不是引用檔案路徑），檔案太大時，這相當於要求單一次回覆輸出超過模型單輪輸出上限的文字量，會直接被截斷，而且截斷後的內容仍是「語法上合法但內容不完整」的 JSON，很容易被誤判成推送成功。

**教訓與作法**：
- 檔案大小在 **~150KB 以下**（James.json 124KB 實測成功）可以放心交給 subagent 直接推送。
- 檔案大小超過這個門檻（例如 damon.json 465KB、wsj.json 2.3MB），**不要**再嘗試用 subagent 硬推，容易靜默寫壞正式資料。**改成請使用者本人手動上傳**：把整理好的檔案用 `SendUserFile` 交給使用者，請他到 `https://github.com/<owner>/<repo>/tree/main/<path所在資料夾>`，用「Add file → Upload files」把檔案拖進去、蓋掉舊檔、commit。使用者對這個流程已經很熟悉（先前 master_easy_read.json 254KB 也是這樣上傳的）。
- 推送完（不論是 AI 推的還是使用者手動推的），**務必用 `get_file_contents` 或 `curl raw.githubusercontent.com` 檢查檔案的 byte size 與內容筆數是否跟本機的來源檔案完全一致**，不要只看「有沒有回傳成功」就當作推送正確——這次的事故就是 subagent 誤判「工具呼叫沒報錯」＝「內容正確」，但實際上內容已經被截斷。

### 其他曾踩過的坑
- `AskUserQuestion` 工具的 JSON 參數要用正確的結構化格式，避免手動跳脫字元出錯。
- `has:nouserlabels` 搭配 `label:` 篩選會回傳空結果，不要用來找「未分類信件」。
- 大量信件的原始 HTML 內容常夾帶重複的巨大樣板文字，抓取當下就要清理掉，不要整段存下來。
- `get_thread` 回傳的 `htmlBody` 對於清理任務完全用不到，只需要 `plaintextBody`，讀取後應盡快只保留清理過的純文字、捨棄原始 HTML，避免塞爆 context。

## 7. 使用者偏好與溝通注意事項

- 使用者對 **token / 時間成本敏感**，過程中會問進度。啟動耗時久的任務前，先簡短告知預估時間，能拆小批次就拆小批次分批交付，不要一次丟出去等很久都沒有回報。
- 使用者要求「回報進度」時要簡潔、誠實，不要模糊帶過或過度樂觀。
- 使用者重視資料不遺失，任何已完成的部分應盡快確實推送到 GitHub（不要只留在雲端沙盒工作區）。
- 使用者對「動用多少 agent / 花多少 token」很在意，會直接質疑不合理的做法（例如同時開 4 個 agent 推送檔案）。**能用簡單、便宜的方式解決（例如請使用者自己手動上傳），就不要動用昂貴的 subagent 大軍。**
- 使用者的裝置名稱是 `laptop-fp8p1sv9`。

## 8. 網站維護方式（給使用者看，也給接手的 Claude 參考）

- **想更新最新信件**：現在已經是自動排程，不需要手動提醒。若想立即手動觸發一次，可以跟 Claude 說「幫我更新學習信件」，照第 5 節流程執行。
- **想新增新的訂閱來源標籤**：跟 Claude 說要新增哪個 Gmail 標籤，會更新 `labels.json` 並抓資料，不需要改網站程式碼。
- **想調整每週自動更新的排程時間或頻率**：可以請 Claude 用 `update_trigger` 調整，不需要重建。
- **Readwise 金鑰要更換**：去 Cloudflare Pages 專案設定的「Variables and secrets」，把 `READWISE_TOKEN` 改成新的值，這步需要使用者本人操作。
- **想清空已讀記錄重來**：去 Cloudflare dashboard 的 Workers KV，清空 `learning_digest_read_tracking` namespace。

## 9. 每週自動更新排程（2026-07-27 設定）

已透過 claude-code-remote MCP 的 `create_trigger` 設定一個每週排程，會在固定時間自動啟動一個新的 Claude session，該 session 的第一件事就是讀這份文件（`data/CLAUDE.md`）然後照第 5 節的流程執行增量更新。若使用者想調整時間、暫停或取消，直接請 Claude 用 `update_trigger` / `delete_trigger` 處理，不需要重新手動設定整個流程。

## 10. 變更記錄（Changelog）

### 2026-07-27
1. **視覺改版**：`index.html` 全面改為天空藍配色主題（CSS 變數 `--bg`/`--accent`/`--accent-dark`/`--accent-bg`，漸層 header），保留原有 JS 邏輯（已讀同步、Readwise、分頁渲染）不變。
2. **新增使用說明**：`index.html` 右上角新增「❓ 使用說明」按鈕，點擊開啟說明彈窗，內容涵蓋基本操作、如何手動觸發更新、自動排程說明。
3. **修正華爾街日報（wsj）空白內文 bug**：根因是 `labels.json` 的 `wsj.bilingual` 被設成 `false`，但 `wsj.json` 資料實際上是雙語格式（`contentEn`/`contentZh`），導致前端找不到 `content` 欄位而顯示空白。修正方式：把 `wsj.bilingual` 改回 `true`，不需要重新抓取資料。
4. **補齊大師輕鬆讀（master_easy_read）全部歷史信件**：從 Gmail 抓取並清理全部 122 封信件，組成 `data/master_easy_read.json`（254,861 bytes），已推送到 GitHub（由使用者本人手動上傳完成，因檔案過大不適合透過沙盒逐字傳遞）。已正式加入每週自動更新的標籤清單。
5. **移除三個標籤**：依使用者要求，`數位時代（bnext）`、`ali mirza（ali_mirza）`、`未來商務（future_biz）` 依序從 `data/labels.json` 移除（各自獨立 commit push 到 GitHub），網站上不再顯示這三個分頁，之後也不再抓取。
6. **設定每週自動更新排程**：透過 claude-code-remote MCP 的 `create_trigger` 建立每週排程（見第 9 節），排程觸發的 session 會讀這份文件並依第 5 節流程執行增量更新，不需要使用者手動提醒。
7. **發現並記錄沙盒 GitHub 寫入限制**：確認 `git push` 與直接 `curl` PUT GitHub REST API 都會被沙盒的安全代理擋下，唯一可用的寫入方式是 `mcp__remote-devices__github__*` 系列 MCP 工具，已記錄於第 2 節與第 6 節事故二，避免之後的 session（尤其是排程觸發的 session）重新踩坑。
8. **同步使用者本機資料夾**：把 `C:\Users\s8825\Desktop\claude code使用專案資料夾\01.專案-請AI整理資料\17.信件` 資料夾內的檔案更新為與 GitHub 一致的最新版本（`index.html`、`data/labels.json`、`data/CLAUDE.md`、`README.md`、新增 `data/master_easy_read.json`），並把已刪除標籤對應的舊資料檔（`data/future_biz.json`）與先前不小心夾帶的垃圾檔（`data/damon_batch4.json`）移到 `_to_delete/` 子資料夾，方便使用者自行刪除。
9. **更新 learning-digest-report.html 專案總結報告**：反映當天全部變更（天空藍改版、10 標籤全數完整、WSJ 修復、每週自動更新上線），同步到本機資料夾與 Cowork 桌面 artifact（`learning-digest-report`），並在報告中註記 `PROJECT_HANDOFF.md` 是尚未同步、內容重疊的舊版技術文件。
10. **中英對照改為「段落級對齊」排版**：使用者反映中英對照畫面英文跟中文對不齊。檢查後發現 damon、james 的翻譯本來就幾乎是逐段對應的，只是前端把 `contentEn`/`contentZh` 當兩大段文字各自捲動渲染，才會視覺上對不齊；wsj 則是翻譯本身就是整合摘要式，段落結構跟原文差異太大（187 封中 110 封對不上），真要對齊得整批重新翻譯，使用者決定 wsj 這次先不動。最後做法：把 damon（95 封）、james（22 封）轉成新的 `paragraphs: [{en, zh}]` 段落陣列格式，前端 `index.html` 改成逐列並排渲染（同一列一定是同一段），確保視覺精準對齊；wsj 維持舊格式與舊排版不變。
11. **修復大檔案推送導致的資料損毀事故**：把 damon.json 交給 subagent 推送時，因檔案過大（465KB）超出單輪輸出上限，subagent 誤判推送成功，實際把 GitHub 上的 damon.json 寫壞成只剩 1 封信。已請使用者本人手動上傳完整版修復（並用 byte size 核對內容一致），詳見第 6 節事故三。之後任何超過 ~150KB 的資料檔異動都會請使用者手動上傳，不再冒險用 subagent 硬推。
