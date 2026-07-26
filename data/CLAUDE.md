# 學習信件彙整站（learning-digest）專案交接文件

最後更新：2026-07-14

這份文件是為了讓新的 Claude 對話（新視窗/新 session）能夠無縫接手這個專案而寫的。請新的 Claude 在開始工作前完整閱讀這份文件。

---

## 1. 專案目標

使用者（Justin）的 Gmail 帳號下有一個「06_學習」標籤，底下有多個子標籤，每個子標籤對應一個訂閱的電子報/newsletter 寄件來源，累積了大量未整理的學習信件。使用者希望建立一個網頁，把這些信件依標籤分類呈現，方便閱讀與學習，而不是讓信件淹沒在收件匣裡。

最終要交付的是一個 **HTML 學習信件彙整網站**，需求如下：

1. 依照 Gmail 子標籤分類顯示（例如頁籤 tabs），每個標籤內的信件依日期新到舊排序。
2. 標籤清單必須是**使用者可自行擴充**的（之後可以自己再加新標籤，不需要改程式碼架構）。
3. 對於標記為「中英對照」的 3 個標籤（Damon、james、華爾街日報），需要把英文內容**翻譯成繁體中文**，並排版成中英對照呈現。
4. **其餘 10 個標籤不需要翻譯、不需要摘要**，只呈現清理過（去除廣告/取消訂閱等樣板文字）的原文內容。這是使用者在中途明確糾正的重點（見下方「重要決策」）。
5. 網頁預設只顯示「最近 6 個月」的信件（使用者已確認的最終決定）。
6. 需要 Cloudflare Access 保護，設定成只有使用者自己的 Google 帳號可以登入查看（使用者已確認）。
7. 第一版先做「手動更新版」，不需要做成自動排程抓信（使用者已確認，之後可以再擴充自動化）。
8. 額外考慮過的功能（使用者有討論但尚未定案是否納入 v1）：
   - 畫重點 → 自動存到 Readwise（Readwise Reader）的功能。已與使用者討論過，結論是 Readwise Reader 本身能做「未來新信件」的自動轉寄，但無法批次匯入歷史信件、也無法自動做「全文中英對照翻譯」，所以還是需要保留這個自訂系統；Readwise 可以作為「畫重點之後拿去做間隔複習」的互補用途，透過 Cloudflare Worker 做安全的伺服器端代理（不能把 Readwise API token 放在前端 JS，會外洩）。
   - 記錄「這封信我什麼時候讀過」的已讀時間戳記功能，需要跨裝置（手機+平板）同步，所以不能只用瀏覽器 localStorage，需要伺服器端儲存（Cloudflare KV）。

## 2. 技術架構決策

- **前端**：純靜態 HTML（單一自包含檔案或搭配少量 JS/CSS），用標籤分頁呈現內容。
- **託管**：原本考慮單純用 GitHub Pages，但因為後續要做「畫重點存 Readwise」和「已讀時間記錄」都需要伺服器端保密與寫入能力，所以改為：
  - **Cloudflare Pages**：託管前端靜態網站，連接 GitHub repo 自動部署。
  - **Cloudflare Worker**：後端 API，負責（a）代理呼叫 Readwise API（保護 API token 不外洩到前端）、（b）讀寫 Cloudflare KV 記錄已讀時間戳記。
  - **Cloudflare KV**：儲存已讀時間紀錄的 key-value 資料庫。
  - **Cloudflare Access（Zero Trust）**：限制只有使用者自己的 Google 帳號可以登入存取整個網站。
- **GitHub repo**：已建立，見下方「已完成事項」。
- **資料抓取**：透過 Gmail MCP 工具（`mcp__Gmail__*`）用 `label:` 查詢語法抓信，用 `get_thread` 抓全文內容。
- **排程更新（v1 不做，先手動）**：未來若要做自動化，需要用 claude-code-remote MCP server 的 `create_trigger`/`send_later` 等工具（**絕對不要用**本機的 `CronCreate`/`CronList`/`CronDelete`，因為那些是 session 內部排程，session 結束就失效，不會真的持續運作）。

## 3. 標籤清單（13 個，已全數確認存在於使用者 Gmail 中，皆為既有標籤，不需要新建）

> **2026-07-26 使用者決策更新（重要，覆蓋舊規則）：**
> - 使用者決定只再處理以下 6 個標籤，且這 6 個標籤要**抓「全部歷史信件」，不再只抓近 6 個月**：damon、james、wsj、fuge（福哥來信）、ai2026（2026AI訂閱）、alvin（艾爾文）、vista_cheng（Vista Cheng）。（原文列了 6 個但含 damon+james 共 7 個標籤，以下逐一列出。）
> - **wsj 的雙語規則變更**：原本規劃 wsj 要中英對照，使用者考量到 wsj 全歷史信件量可能非常大（初估可能上看 500~1000+ 封）、逐封翻譯的 token 成本過高，**已明確決定 wsj 不翻譯，只保留清理過的英文原文**（跟其他一般標籤一樣的呈現方式）。`labels.json` 中 wsj 的 `bilingual` 欄位已改為 `false`。
> - **damon、james 維持雙語**（中英對照），且維持全歷史抓取。
> - 其餘標籤（master_easy_read 大師輕鬆讀、future_biz 未來商務、hou_zhixun 侯智薰、bnext 數位時代、ali_mirza）**使用者決定不再抓取**。這些標籤原本就沒有完整資料，之後也不會補齊，除非使用者之後改變主意。
> - 全歷史初步盤點（僅計數，未抓內文，數字為 2026-07-26 盤點時的下限，實際可能更多）：damon 約 96 封（`damon.json` 現有 95 封，幾乎已經抓完）、james 22 封（`james.json` 已完整，全歷史=近6個月）、ai2026 全歷史=近6個月共 50 封（現有 45 封，只差 5 封）、fuge 至少 108 封（分頁尚未抓到底）、alvin 至少 100 封（分頁尚未抓到底）、vista_cheng 至少 94 封、最早回溯到 2023-08（分頁尚未抓到底，現有 `vista_cheng.json` 102 封，需要再核對是否已涵蓋全部）、wsj 近 6 個月已確認 182 封，全歷史還在盤點中，可能是這批工作中信件量最大的標籤。

| key（程式內部代號） | 顯示名稱 | Gmail 標籤路徑 | Gmail labelId | 是否中英對照(bilingual) | 抓取範圍（2026-07-26 起） |
|---|---|---|---|---|---|
| damon | Damon | 06_學習/Damon | Label_3753692681857176071 | ✅ 是 | 全歷史 |
| james | james | 06_學習/james | Label_2318727129382809273 | ✅ 是 | 全歷史 |
| ai2026 | 2026AI訂閱 | 06_學習/2026AI訂閱 | Label_522335023913587695 | 否 | 全歷史 |
| master_easy_read | 大師輕鬆讀 | 06_學習/大師輕鬆讀 | Label_850179891846499761 | 否 | ⛔ 不再抓取 |
| future_biz | 未來商務 | 06_學習/未來商務 | Label_4031827219020548547 | 否 | ⛔ 不再抓取 |
| alvin | 艾爾文 | 06_學習/艾爾文 | Label_2171113756778292459 | 否 | 全歷史 |
| hou_zhixun | 侯智薰 | 06_學習/侯智薰 | Label_3544715739386180075 | 否 | ⛔ 不再抓取 |
| wsj | 華爾街日報 | 06_學習/華爾街日報 | Label_8760175458355617909 | ❌ 否（2026-07-26 起改為不翻譯） | 全歷史 |
| brief | Brief | 06_學習/Brief | Label_3367205939263792668 | 否 | 維持近 6 個月即可（未變更，資料已完整） |
| vista_cheng | Vista Cheng | 06_學習/Vista Cheng from Vista電子報 | Label_4092887730022971363 | 否 | 全歷史 |
| fuge | 福哥來信 | 06_學習/福哥來信 | Label_4523792686777732210 | 否 | 全歷史 |
| bnext | 數位時代 | 06_學習/數位時代 | Label_1757920366459479671 | 否 | ⛔ 不再抓取 |
| ali_mirza | ali mirza | 06_學習/ali mirza | Label_5327024402327838555 | 否 | ⛔ 不再抓取 |

這份對照表已經寫成 `data/labels.json`（見下方檔案清單），**這就是「標籤可擴充」需求的實作依據** —— 之後使用者想加新標籤，只要在這個 JSON 陣列裡新增一筆即可，不需要改前端程式碼邏輯（前端應該要設計成讀這個 config 動態產生分頁）。

## 4. 資料抓取與清理規則（給任何後續要抓 Gmail 信件的 agent 的統一規範）

- Gmail 搜尋語法：對於「全歷史」標籤（damon、james、ai2026、alvin、vista_cheng、fuge、wsj），**不要加 `newer_than:6m`**，直接用 `label:06_學習/<子標籤名稱>` 抓全部；只有 brief 維持 `newer_than:6m`（因其資料已完整、範圍未變更）。**注意**：官方工具文件說 `label:` 只接受 label ID，但實測發現**用顯示名稱（display name）也可以查得到結果，而用 label ID 查詢反而會回傳空結果**，所以統一都用顯示名稱查詢。標籤名稱有空格的要加引號，例如 `label:"06_學習/Vista Cheng from Vista電子報"`。
- `resultCountEstimate` 這個欄位**不可信**（同一個帳號不同標籤常常都回傳相同的數字如 201，明顯是估計值或快取值），必須實際用 `THREAD_VIEW_MINIMAL` 分頁抓完整個結果集，取得真實信件數量。
- 抓信內容用 `get_thread`（`messageFormat=FULL_CONTENT` 或優先拿 plaintext body）。
- **清理規則**：把每封信中重複出現的樣板內容去除，包括：取消訂閱連結、社群媒體圖示連結、追蹤像素、"View this post on the web"、Substack/skool 等平台的固定頁尾、書單/業配連結（例如 Damon 信件裡固定重複的「My Books」書單）等。只保留信件的實質內容（本文/文章內容）。
- **只有 damon / james 這兩個標籤需要翻譯成繁體中文**（2026-07-26 起 wsj 移出雙語名單），其餘標籤（含 wsj）**完全不要翻譯、不要摘要**，保留原文（可能中文可能英文，看原信語言）。這是使用者中途明確糾正過的重點，務必遵守，不要自作主張加摘要。
- 資料輸出格式（每個標籤一個 JSON 檔）：
  - 非雙語標籤：`{"label": "<key>", "emails": [{"id", "subject", "date"(ISO), "gmailUrl", "content"}]}`
  - 雙語標籤：`{"label": "<key>", "emails": [{"id", "subject", "date"(ISO), "gmailUrl", "contentEn", "contentZh"}]}`
  - 依 `date` 新到舊排序。

## 5. 已完成事項（狀態總覽）

### GitHub
- 已建立 repo：`justin-n8n/learning-digest`（public，已 `autoInit`，目前只有自動產生的 README，尚未 push 任何程式碼/資料）。
  - html_url: https://github.com/justin-n8n/learning-digest

### 資料檔案（存放於使用者本機資料夾）
使用者已將本機資料夾連接到本次 session：
`C:\Users\s8825\Desktop\claude code使用專案資料夾\01.專案-請AI整理資料\17.信件`

目前這個資料夾裡已經有的檔案（皆已確認成功寫入使用者本機，非雲端暫存）：

| 檔案 | 狀態 | 內容 |
|---|---|---|
| labels.json | ✅ 完整 | 13 個標籤設定檔 |
| wsj.json | ✅ 完整 | 140 封，中英對照 |
| damon.json | ✅ 完整 | 18 封，中英對照 |
| james.json | ✅ 完整 | 17 封，中英對照 |
| alvin.json | ✅ 完整 | 31 封 |
| brief.json | ✅ 完整 | 18 封 |
| future_biz.json | ⚠️ 部分 | 只找回 5 封（原本應有約 27 封），標記了 `_truncated_note` |

**尚未產生 / 需要重新抓取 Gmail 的標籤（6 個，資料完全遺失，見第 6 節「重大事故」）：**
- master_easy_read（大師輕鬆讀，原約 27 封）
- ai2026（2026AI訂閱，原 44 封）
- vista_cheng（原 29 封）
- fuge（福哥來信，原 58 封）
- ali_mirza（原 174 封 — 這個標籤信件量很大，注意 token/時間成本）
- hou_zhixun（侯智薰，原 41 封）
- bnext（數位時代，原 85 封）

### 尚未開始的工作（Task list）
1. ~~建立 GitHub repo~~ ✅ 完成
2. ~~抓取 13 個標籤的 Gmail 信件~~ ⚠️ 部分完成（6 個標籤需重抓，見上表）
3. ~~翻譯 Damon/james/華爾街日報 為中英對照~~ ✅ 完成
4. **建立資料檔與標籤設定檔** — 進行中，尚有 6 個標籤未補齊
5. **開發靜態網頁介面** — 尚未開始
6. **開發 Cloudflare Worker 後端**（Readwise 代理 + 已讀時間記錄）— 尚未開始
7. **推送程式碼與資料到 GitHub** — 尚未開始
8. **用瀏覽器操作設定 Cloudflare Pages / Worker / KV / Access** — 尚未開始（需要使用者登入自己的 Cloudflare 帳號，用 claude-in-chrome 瀏覽器工具操作）
9. **驗證部署結果**（網站能開、Access 登入正常、畫重點存 Readwise 功能正常、已讀時間記錄正常）— 尚未開始

## 6. 重大事故記錄（非常重要，請詳讀，避免重蹈覆轍）

### 事故：雲端工作環境重置導致資料遺失
在執行過程中，曾經連續呼叫多個 subagent 平行抓取不同標籤的 Gmail 資料，並用 `Write` 工具把整理好的 JSON 檔案寫入雲端沙盒（sandbox）工作區的 `/home/claude/learning-digest/data/` 資料夾。**但沒有立即同步到使用者本機**。

後來因為一次 Agent 呼叫觸發了 `You've hit your session limit`（額度上限）錯誤，接著雲端沙盒環境被重置（container 重啟或換了一個新的），導致**先前寫入 `/home/claude/learning-digest/` 底下的所有檔案全部消失**，包括已經整理好的 11 個標籤 JSON 檔案與 labels.json。

**教訓／以後必須遵守的原則：**
1. **任何整理好的資料檔，寫入雲端沙盒後，必須立刻用 `SendUserFile` + `mcp__remote-devices__device_commit_files` 存到使用者本機資料夾，不要囤著等全部做完再交付。** 雲端沙盒是不可靠的暫存空間，隨時可能因為額度、逾時或其他原因被重置。
2. 之後每完成一個標籤的資料抓取，就馬上分別存檔到本機，一個一個來，不要累積。
3. 若要呼叫多個平行 subagent 抓取大量資料，考慮拆小批次執行，避免單一長任務因超時/額度問題整批失敗或遺失。

### 事後搶救行動與發現
重置後嘗試搶救資料，過程與發現如下（供之後參考，若再發生類似事故可以用同樣方法搶救）：

- 這個 Claude session 的**逐字稿（transcript）目錄**（`/root/.claude/projects/-home-claude/<session-id>/`）**沒有跟著沙盒一起重置**，裡面保留了：
  - `subagents/agent-<id>.jsonl`：每個曾經呼叫過的 subagent 的完整對話紀錄（包含它呼叫過的所有工具與回應）。
  - `tool-results/`：部分過大而被另存的工具呼叫結果（例如超過 token 上限的 `get_thread` 回應內容），檔名格式如 `mcp-Gmail-get_thread-<timestamp>.txt`。**但這個目錄有清理/輪替機制，只保留最近一段時間內的檔案**，較早的（例如最早抓 ai2026/vista_cheng 那幾個 subagent 的原始 Gmail 內容）已經被清掉了，只剩下最後一次（WSJ）任務期間產生的檔案還在。
- 搶救方法：
  1. 對於「subagent 最後直接把完整 JSON 印在自己回覆文字裡」的案例（damon、james、alvin、brief），可以直接從 `subagents/agent-<id>.jsonl` 裡撈出最後一則 assistant 訊息的文字內容，用正規表達式取出 ```json ... ``` 區塊，重新解析回 JSON——這幾個成功救回。
  2. 對於「subagent 只回覆簡短確認文字、把完整資料寫進檔案（而不是印在回覆裡）」的案例（vista_cheng、fuge、ali_mirza、hou_zhixun、bnext、ai2026），由於完整內容根本沒有出現在對話文字裡，只存在於沙盒檔案系統，而沙盒檔案系統已經被重置，**這些完全無法用逐字稿救回**，只能重新呼叫 Gmail API 抓取。
  3. future_biz 和 master_easy_read 這兩個標籤比較特殊：因為它們的完整 JSON 內容曾經被印在**主線對話（不是 subagent）的訊息文字裡**（不是存成檔案，是直接貼在回覆中），所以我自己還記得（在對話上下文裡還看得到），可以直接重新用 `Write` 工具寫回去——但 master_easy_read 因為內容太大（27封信全文），考量到 token 成本，最後沒有重新完整寫回，只有 future_biz 補了 5/27 封（部分）。
- **結論**：以後若要對抗這類風險，最根本的做法還是「做完一個立刻存到使用者本機」，而不是靠這種事後搶救。

### 其他曾踩過的坑
- `AskUserQuestion` 工具第一次呼叫時因為 JSON 格式錯誤（未跳脫的反斜線等）而失敗過兩次，後來改用正確的結構化參數格式才成功。
- `has:nouserlabels` 搭配 `label:` 篩選會回傳空結果（邏輯上矛盾：有標籤的信件不可能同時符合「沒有使用者標籤」），這個方法後來放棄，不要再用來找「未分類信件」。
- 大量信件的原始 HTML 內容裡常常夾帶重複的巨大樣板文字（例如 Damon 信件固定附的「My Books」書單，裡面有約 20 個 Amazon 聯盟連結），如果不先清理直接整段存下來，會浪費大量儲存空間與後續處理的 token，務必在抓取當下就清理掉，只留核心信件內容。

## 7. 待辦事項（TODO，給接手的新 Claude）

依優先順序：

1. **確認使用者要不要繼續補齊那 6 個遺失的標籤資料**（master_easy_read, ai2026, vista_cheng, fuge, ali_mirza, hou_zhixun, bnext）。ali_mirza 信件量特別大（174封），可能要拆更小批次或請使用者評估是否要縮短時間範圍。
   - 抓取時**務必比照第 6 節的教訓**：每抓完一個標籤，立刻存到使用者本機資料夾（`C:\Users\s8825\Desktop\claude code使用專案資料夾\01.專案-請AI整理資料\17.信件`），不要等全部做完才交付。
   - 抓取規則與清理規則見第 4 節。
2. 補齊 future_biz.json 剩餘的 22 封信（目前只有 5 封）。
3. 開發前端靜態網頁：
   - 讀取 `data/labels.json` 動態產生標籤分頁（tabs），達成「標籤可擴充」的需求。
   - 每個標籤讀取對應的 `data/<key>.json`，依 `date` 新到舊排序顯示。
   - 對於 `bilingual: true` 的標籤（damon, james, wsj），用中英對照排版（例如左右並排或上下交錯）顯示 `contentEn` 和 `contentZh`。
   - 其餘標籤只顯示 `content`。
   - 網頁預設只顯示最近 6 個月的信件（資料本身已經是抓 6 個月內的，但如果之後改成累積式資料庫，前端要記得加日期篩選邏輯）。
   - 保留「畫重點存 Readwise」與「已讀時間記錄」功能的 UI 掛勾點（實際串接留給 Worker 開發階段）。
4. 開發 Cloudflare Worker 後端：
   - Readwise API 代理端點（保護 API token）。
   - 已讀時間戳記讀寫端點（串接 Cloudflare KV）。
5. 把前端程式碼與所有 `data/*.json` 推送到 GitHub repo `justin-n8n/learning-digest`。
6. 使用 claude-in-chrome 瀏覽器工具，在使用者登入自己 Cloudflare 帳號的狀態下，協助設定：
   - Cloudflare Pages（連接 GitHub repo）
   - Cloudflare Worker（部署後端）
   - Cloudflare KV namespace
   - Cloudflare Zero Trust Access（限制只有使用者自己 Google 帳號能登入）
7. 驗證整個部署：網站能否正常開啟、Access 登入是否正常運作、畫重點功能、已讀時間記錄功能是否正常。

## 8. 使用者偏好與溝通注意事項

- 使用者對 **token / 時間成本非常敏感**，過程中多次表達擔心額度被用光、任務跑太久。**務必在啟動任何耗時久的 subagent 任務前，先簡短告知預估時間，並在可能的情況下拆小批次、分批交付**，不要一次丟出去等很久都沒有回報進度。
- 使用者要求「回報進度」時要簡潔、誠實，不要模糊帶過或過度樂觀。
- 使用者重視資料不遺失，任何已經完成的部分，都應該盡快確實存到使用者本機（透過 device bridge：`SendUserFile` 拿到 `file_uuid` 後，再呼叫 `mcp__remote-devices__device_commit_files` 寫入本機路徑），而不是只留在雲端沙盒工作區。
- 使用者的裝置名稱是 `laptop-fp8p1sv9`，已連接的本機資料夾是：
  `C:\Users\s8825\Desktop\claude code使用專案資料夾\01.專案-請AI整理資料\17.信件`
