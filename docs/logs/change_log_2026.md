# Change Log Archive — 2026

> Rotated out of docs/change_log.md per AGENTS.md "Log Rotation".
> Entries below are verbatim, in original order. Do not edit.

## 2026-07-06 00:00

### Type
Docs

### Summary
Initialized governance docs (project_status / change_log / decision_log) from
`docs/templates.md`, and filled the "Project Facts" section of `AGENTS.md`.

### Files Changed
- docs/project_status.md (created)
- docs/change_log.md (created)
- docs/decision_log.md (created)
- AGENTS.md (Project Facts filled)

### Reason
AGENTS.md Bootstrap / Startup procedure requires these files; they were missing.

### Implementation Details
Created from the templates in `docs/templates.md`, content derived from the
actual repo contents (docs-only template repo, no build/test commands).

### Impact Analysis
Documentation only; no behavior change.

### Verification Result
PASS

## 2026-07-06 00:10

### Type
Docs

### Summary
Packaging playbook now requires a clean venv to lock dependencies, so only
necessary components are installed into the embeddable Python distribution.

### Files Changed
- playbooks/embeddable-python-packaging/PLAYBOOK.md
  - Step 3 rewritten: create throwaway `venv_pack`, install only the direct
    dependencies actually imported by the shipped source, `pip freeze` to
    `requirements-embed.txt`, and install into `python_embed` exclusively via
    `pip install -r requirements-embed.txt` (never by copying the dev venv or
    global site-packages, never ad-hoc installs).
  - Step 0 folder layout now includes `requirements-embed.txt`.
- playbooks/embeddable-python-packaging/references/compatibility-check.md
  - Step 1 now says to run the dependency/.pyd checks against `venv_pack`
    instead of the day-to-day development venv.

### Reason
User request: packaging must go through a venv so only necessary components
are bundled. Dev venvs and the global environment accumulate unused packages;
copying them bloats the distribution.

### Implementation Details
See PLAYBOOK.md step 3 (sub-steps 3-1 to 3-4).

### Impact Analysis
Affects future packaging sessions in any repo using this playbook; no impact
on already-shipped distributions.

### Verification Result
PASS (document review; no executable code in this repo)

## 2026-07-27 13:30

### Type
Docs

### Summary
Split the two conditional procedures out of `AGENTS.md` into `docs/bootstrap.md`
and `docs/log_rotation.md`, filled Project Facts / Scale, created the mandatory
`docs/spec.md`, and corrected stale content in `docs/project_status.md`.

### Files Changed
- AGENTS.md (Bootstrap + Log Rotation replaced by pointers; Project Facts and
  Profile Scale filled)
- docs/bootstrap.md, docs/log_rotation.md (created — verbatim moved sections)
- docs/spec.md (created), docs/project_status.md, docs/change_log.md (header)

### Reason
`AGENTS.md` loaded ~2.4k est. tokens every session including two sections needed
only on first-run / >400-line conditions. Empty Project Facts + missing
`docs/spec.md` also made every session trigger Bootstrap. Correction: the
2026-07-06 entry above stated Project Facts was filled; it was not — filled now.

### Implementation Details
Moved sections are byte-identical inside the new files; kept as plain docs (not
Claude skills) because AGENTS.md must stay readable by Codex/Cursor/Antigravity.

### Impact Analysis
~833 est. tokens/session less always-loaded context. No rule was removed or
weakened; conditional rules now load on demand.

### Verification Result
PASS (document review; no executable code in this repo)

## 2026-08-05 | Docs | repo 轉為 pdfprint-layout 產品 repo;plan.md 重整為 v2.0
(補齊 bytes detach / file:// ESM / embedPage 限制 / Preview-Export 幾何等價 /
Undo 契約等缺口,新增可量測驗收與風險登記),重寫 spec.md、project_status.md、
AGENTS.md Project Facts,decision_log 補 D-001~D-005 | 文件審查 PASS

## 2026-08-05 15:50

### Type
Docs

### Summary
Project Scale 由 `solo-small` 改為 `solo-large`(使用者指示);刪除與本產品
無關的 `playbooks/embeddable-python-packaging/`(Python exe 打包 playbook)。

### Files Changed
- AGENTS.md — Scale 改為 solo-large;Reusable Playbooks 條目清空;
  Project Facts 的 Key directories 更新
- playbooks/embeddable-python-packaging/ — 整個資料夾刪除(5 個檔案)
- docs/spec.md — 移除「治理範本遺留物」未確認假設,改為已確認段落
- docs/project_status.md — TL;DR、Dependencies 更新

### Reason
使用者確認清掉「沒用處的檔案」。判定範圍:`playbooks/embeddable-python-
packaging/` 是 Python exe 打包用途,與本 JS/HTML PDF 拼版產品完全無關,予以
刪除。`docs/templates.md`、`docs/bootstrap.md`、`docs/log_rotation.md` **未
刪除**——這三份被 AGENTS.md 本身的 Startup / Bootstrap / Log Rotation 章節
直接引用,是治理機制的一部分而非遺留物,刪除會讓 AGENTS.md 自我引用失效。
此為 agent 依 Boundaries「刪除檔案需先詢問」精神所做的範圍判斷,非使用者
逐一列舉。

### Implementation Details
`rm -rf playbooks/embeddable-python-packaging`;AGENTS.md Reusable Playbooks
區塊改為空清單並保留 template comment,供日後新增。

### Impact Analysis
Scale 提升為 solo-large 後,往後每個任務的 change_log 需完整欄位、
project_status 需更新受影響章節、任務結束需輸出 short report(Task Summary /
Files Modified / Documents Updated / Tests Performed / Known Risks /
Recommended Next Steps)。無程式碼受影響(repo 尚無程式碼)。

### Verification Result
PASS(`find playbooks -maxdepth 2` 確認資料夾已空;AGENTS.md 無殘留指向已刪
路徑的引用)

## 2026-08-05 16:10

### Type
Docs

### Summary
新增「手動更新檢查」功能規格(離線原則的唯一例外)與「GitHub 發布流程」;
修改 `AGENTS.md` Boundaries 新增範圍受限的 push/release 授權例外。

### Files Changed
- AGENTS.md — Boundaries 移除全域 NEVER-deploy,改為 NEVER(不含 deploy)+
  scoped「GitHub publish exception」段落
- docs/plan.md — v2.0→v2.1;新增 §19.4 手動更新檢查、§19.5 GitHub 發布流程、
  §23.8 驗收條件;§2.2、§19.3、§20 加註例外範圍;文件版本表更新
- docs/spec.md — 驗收條件新增第 8 項(未點擊前無網路請求);
  「不做什麼」新增兩項例外注記
- docs/decision_log.md — 新增 D-006(治理權限變更)、D-007(架構例外)

### Reason
使用者要求「自動發布到 GitHub」與「程式自動偵測更新」,兩者分別與 AGENTS.md
既有 NEVER 規則、spec.md 剛定案的離線原則衝突。依規則停下來問(見對話中三組
AskUserQuestion),使用者選擇:更新檢查僅手動點擊才連線、更新為顯示連結由
使用者手動取代檔案(不做自動安裝)、GitHub push 授權以修改 AGENTS.md
Boundaries 方式明確給予、repo 現在就以 public 建立。

### Implementation Details
例外範圍嚴格限定:push 僅限 `github.com/cworkfox-source/pdfprint-layout`
這一個 remote;force push、改寫歷史、刪除 log 歷史等既有 NEVER 規則不受影響。
更新檢查僅在使用者點擊按鈕時發出單一 GET 請求,不含使用者資料。

### Impact Analysis
架構層面新增一個受控的連網例外,不影響核心排版/匯出/列印的離線保證。
治理層面的權限放寬僅適用本 repo 這一個 remote。尚無程式碼受影響。

### Verification Result
PASS(文件審查;§23.8 為程式碼進場後才可實際執行的驗收項目,目前僅完成規格
定義)


## 2026-08-05 16:20

### Type
Docs

### Summary
建立本機 git 倉庫與遠端 GitHub public repo,推送目前的文件內容作為版本控制
起點。

### Files Changed
- .gitignore(新增)、README.md(新增)
- 首次 commit 涵蓋:AGENTS.md、CLAUDE.md、.antigravity_rules.md、docs/*、
  README.md、.gitignore(不含程式碼,因尚未開始 Phase −1)

### Reason
使用者於 AskUserQuestion 選擇「現在就建 repo」「Public」,作為後續每次修改
直接 push 的版本控制起點,而非等 Phase 11 build 完成才一次性建立。

### Implementation Details
`git init` → `git add` 指定檔案(非 `-a`,避免誤入未預期檔案)→ 初次 commit →
`gh repo create cworkfox-source/pdfprint-layout --public --source=. --push`。
執行細節與實際結果見下方 Verification Result。

### Impact Analysis
專案原始碼與文件自此有遠端備份;repo 目前公開但只含文件,不含任何使用者資料
或機敏內容(已依 Boundaries「不得印出/寫入金鑰密碼個資」檢查)。

### Verification Result
PASS — repo 建立於 https://github.com/cworkfox-source/pdfprint-layout
(public),root commit `8fbf7bb0`。commit 作者身分原被自動猜成
`unknown <BASS000025@tccg.gov.tw>`(政府網域,不宜公開),經使用者確認後改為
GitHub noreply 位址 `256346730+cworkfox-source@users.noreply.github.com`
再 push,未推送任何含真實 email 的歷史。

## 2026-08-05 16:35

### Type
Docs

### Summary
依使用者指示,`AGENTS.md`、`CLAUDE.md`、`.antigravity_rules.md` 三個 AI
agent 治理規則檔改為只留本機,不再發布到 public GitHub repo。

### Files Changed
- .gitignore — 新增三行,忽略上述三個檔案
- AGENTS.md、CLAUDE.md、.antigravity_rules.md — `git rm --cached`(僅取消
  git 追蹤,本機檔案未刪除,仍正常生效)

### Reason
使用者要求這三個檔案「都不用上去(GitHub)」。已詢問是「只不上傳、本機保留」
還是「本機也刪除」,使用者選擇前者——保留本機治理機制運作,只是不公開發布。

### Implementation Details
`git rm --cached` 三檔 → 加入 `.gitignore` → commit → push。舊 commit
(`8fbf7bb0`、`7afb294`)歷史中仍含這三個檔案,因 AGENTS.md Hard Rules 禁止
改寫歷史;只有目前與往後的檔案樹不再包含它們。

### Impact Analysis
公開 repo 現在只看得到產品文件(`docs/`、`README.md`),AI 治理規則對外不可見。
本機端 AGENTS.md/CLAUDE.md 治理流程不受影響,之後每個 session 仍會照常運作。

### Verification Result
PASS — `git log -1` 確認已 push(`801ae4b`);本機 `ls` 確認三檔仍存在於
工作目錄。


## 2026-08-05 17:00

### Type
Feature

### Summary
完成 Phase −1 可行性 Spike 並通過(見 plan.md §22 Phase −1、§23.1)。
`spike/dist/index.html` 在 `file://` 下驗證:ESM 透過 Blob URL 動態載入、
PDF.js Worker 透過 Blob URL 運作、原始 PDF bytes 未被 PDF.js detach 且可交給
pdf-lib 匯出。

### Files Changed
- spike/app.js、spike/template.html、spike/build.py(新增,已 commit)
- spike/README.md、spike/fetch-vendor.sh(新增,已 commit)
- vendor/pdfjs/、vendor/pdf-lib/(新增,**不 commit**,由 fetch-vendor.sh 重現)
- .gitignore(新增 `/vendor/`、`/spike/dist/`)

### Reason
使用者指示「開始依計畫編寫程式」。plan.md 明訂 Phase −1 未通過不得進入
Phase 0,故從此處開始,而非直接寫 Data Model。

### Implementation Details
開發機未安裝 Node.js/npm(`node`/`npm` 均 command not found),無法用 D-004
指定的 esbuild。改用 `curl` 直接下載 pdf.js v6.2.108 官方 dist(`pdf.mjs`、
`pdf.worker.mjs`,皆為自足的單檔 ESM,無外部 relative import)與 pdf-lib
1.17.1 的官方 UMD build,再用一個不需 Node 的 Python 腳本
(`spike/build.py`)把它們與測試邏輯串接成單一 HTML。

驗證出的關鍵技術手法(供 Phase 0+ 沿用,已寫入 `spike/README.md`):
1. pdf.js 原始碼整段內嵌為純文字,執行期包 `Blob` → `blob:` URL →
   `import(blobUrl)` 動態載入,繞過 `<script type="module" src="file:...">`
   在 Chrome file:// 下的 CORS 阻擋。
2. `pdf.worker.mjs` 同法包成 `blob:` URL 設給
   `GlobalWorkerOptions.workerSrc`,`new Worker(url,{type:'module'})` 正常運作。
3. pdf-lib 用官方 UMD build 直接以 classic `<script>` 內嵌,無 ESM 疑慮。
4. `file.arrayBuffer()` 後立即 `buffer.slice(0)` 給 PDF.js,原始 buffer 全程
   保留給 pdf-lib——實測未被 detach,證實 §12.3 規則可行。

### Impact Analysis
證實產品定位(單檔、離線、`file://` 雙擊執行)技術上可行,可以進入 Phase 0。
但發現本機開發環境缺 Node.js/npm,是 Phase 11(esbuild 正式 build)前必須解決
的環境缺口,已記入 decision_log D-008 與 project_status Known Issues。
另外發現 pdf.js v6 API 變更:`PDFDocumentProxy.destroy()` 已移除,只剩
`.cleanup()`,完整釋放需呼叫 `loadingTask.destroy()`——初版 spike 程式碼因此
噴錯,已修正,細節見 `spike/app.js` 註解。

### Verification Result
PASS — 於 Claude Browser 以 `file://` 開啟 `spike/dist/index.html` 實測(非僅
程式碼審查):
1. 頁面載入無 console 錯誤;`window.PDFLib` 與 ESM 動態載入皆成功。
2. 用 pdf-lib 在頁面內即時產生一份 2 頁測試 PDF(因本沙盒環境無法操作原生
   檔案選取對話框,改用 `window.__spikeHandleFile()` debug hook 餵入同一條
   程式路徑,詳見 `spike/app.js` 註解),PDF.js 於 67–114 ms 內 render 出第 1
   頁,Canvas 像素檢查確認非空白(1579 個非白像素)。
3. 原始 ArrayBuffer 於 PDF.js 使用後以 `new Uint8Array()` 檢測未被 detach。
4. 同一份原始 bytes 交給 pdf-lib 成功複製第 1 頁並輸出新 PDF(870 bytes)。
全數符合 plan.md §23.1 的四項驗收條件。


## 2026-08-05 17:40

### Type
Feature

### Summary
確認開發機已裝好 Node.js v24.19.0 / npm 11.17.0(先前 Known Issue 解除),
完成 Phase 0 Data Model 核心:`src/geometry.js`(唯一幾何模組)、
`src/store.js`(單一 mutation 入口)、`src/model.js`(§5 資料結構),
39 個單元測試全數通過。

### Files Changed
- package.json(新增,零 runtime 依賴,`npm test` = `node --test`)
- src/geometry.js、src/geometry.test.js(新增)
- src/store.js、src/store.test.js(新增)
- src/model.js、src/model.test.js(新增)
- docs/plan.md — §6.3 fitScale 公式修正(見 Implementation Details)
- AGENTS.md — Project Facts 的 Build/Test/Dev server 改為真實指令,
  Key directories 加入 `src/`
- docs/project_status.md — TL;DR、Completed/In Development、移除已解決的
  Node.js Known Issue

### Reason
使用者確認「Node.js已安裝 繼續執行計畫」。plan.md Phase 0 規則要求先有
Data Model 才能進 Phase 1,且 geometry.js/store.js 是明訂「不能後補」的
架構地基(plan §4),故從此處開始寫程式碼,而非直接做 UI。

### Implementation Details
**geometry.js** 依 plan §6 逐項實作:mm/pt 換算、A4/A3/Letter/Legal 精確 pt
值、2D 仿射矩陣工具(與 Canvas2D `transform(a,b,c,d,e,f)` 同慣例,方便未來
Preview Renderer 直接使用)、§6.3 Slot transform matrix、§6.2 唯一的 PDF Y
軸翻轉函式、§14.3 `/Rotate` 正規化、§13.5/§14.4 CropBox 優先、§6.5 z-order
排序。

**寫測試時發現並修正一個公式落差**:原 plan.md §6.3 的 `fitScale` 公式在
`rotation` 為 90°/270° 時未考慮內容局部座標軸被旋轉到 Slot 的另一軸上,若
不對調比較用的 Slot 目標尺寸,非正方形 Slot 配合 90°/270° 旋轉時 contain/
cover/stretch 會算錯。已在 `computeFitScale()` 修正(180° 不受影響,因為外框
方向不變),並回寫 plan.md §6.3 文字說明。此修正在單元測試階段被抓到——先寫
了一個依直覺（未對調）手算的測試,執行後與程式碼實際輸出不符,逐步排查後
確認公式本身有落差而非程式碼錯誤,才回頭修正 plan.md。

**store.js** 依 plan §7 實作:`commit(reducer, action, options)` 為唯一
mutation 入口,reducer 須為純函式;history 用 immutable snapshot(上限 50,
超過丟最舊)搭配 `coalesceKey` 合併連續操作(例如拖曳中每個 pointermove)為
一個 undo 步驟,`endCoalescing()` 結束合併;`historyEntry:false` 供
Zoom/Pan/Selection 不進 history;每次 commit 後對整個 state tree 做
`Object.freeze`,外部繞過 reducer 直接改物件會直接噴錯而非靜默損壞資料。

**model.js** 依 plan §5 提供 Source/Slot/Page/Template/Project/AppState 的
工廠函式,欄位與預設值逐一對照 plan.md §5.2–§5.4;`createTemplate()` 會自動
清除傳入 Slot 的 `sourceId`,對應 §21「Template 不保存 Source」的硬性規則,
而不是靠使用者自律。

### Impact Analysis
Phase 0 的三項不可後補規則(§4.1 Layout Model 與 DOM 分離、§7.1 單一
mutation 入口、§4.3 唯一 geometry 模組)現在有實際程式碼與測試支撐,不再只是
文件承諾。Phase 11 的 Node.js 環境缺口已解除,decision_log D-008 的
「Phase 11 前需解決」條件達成,但本次仍未安裝 esbuild/pdfjs-dist/pdf-lib
(Phase 0 用不到,留到實際需要的 Phase 才加,避免預先綁定用不到的依賴)。

### Verification Result
PASS — `npm test` 39/39 通過(geometry 18、store 9、model 12)。測試內容
非泛用斷言,包含依 plan.md 手算的具體數值案例(如 §23.2 的 A4/A3 精確 pt
值、slot matrix 具體座標映射、history coalescing 行為),過程中這些手算
測試也確實抓出了一次 fitScale 公式落差(見上)。尚未做瀏覽器端整合測試,
因 Phase 0 範圍不含 DOM/Canvas。

## 2026-08-05 18:15

### Type
Feature

### Summary
完成 Phase 1 Paper & Preview Engine:`src/preview.js`(paper/margin/zoom
純計算 + 薄 DOM adapter)、`scripts/dev-server.mjs`(零依賴靜態伺服器,開發期
用 http:// 跑原生 ESM,見 plan §19.2)、`dev/index.html` 人工檢查頁,並在真實
瀏覽器(非僅 code review)以 Claude Browser 實測驗證。

### Files Changed
- src/preview.js、src/preview.test.js(新增)
- scripts/dev-server.mjs(新增)
- dev/index.html(新增,Phase 1 專用檢查頁,非產品 UI)
- .claude/launch.json(新增,供 preview_start 啟動 dev server)

### Reason
延續 Phase 0 完成後的下一步(plan.md §22 開發優先順序:Paper Engine 在
Data Model 之後)。Phase 1 是第一個需要 DOM/Canvas 的階段,依操作規範
「UI/前端變更需啟動 dev server 並在瀏覽器中實測」,不能只靠 `npm test`。

### Implementation Details
`preview.js` 的數學與 DOM 操作分離(§4.1 原則的具體實踐):
`computePaperPreviewLayout()`/`resolveZoom()`/`computeContentAreaPt()` 全部
不碰 DOM,`renderPaper()`/`applyPrintPageSize()` 只負責把算好的數字寫進
DOM/CSS,不含任何計算邏輯。Preview 內部約定「zoom=1 時 1pt=1 CSS px」,此
約定只影響 Preview 顯示,不影響已用 pt 儲存的 Model,因此 Zoom 改變不會讓
`paperPt`/`contentAreaPt` 變動(對應 §23.2.4 的「Zoom 不影響輸出」)。
`applyPrintPageSize()` 是 `@page size` 唯一寫入點,pt→mm 換算只在此發生。

開發環境問題:`file://` 下原生 ESM 會被擋(plan §19.2),但那是 Phase 11
「打包成單檔」才要解決的問題;開發期本來就規劃可用 dev server(§19.1
「開發期可用 dev server 跑 ESM」),故寫了一個不依賴任何套件的靜態檔案
伺服器,單純把 repo 用 http:// 服務出來,原生 `<script type="module">`
即可正常運作,不需要重複 spike 階段的 Blob URL workaround。

### Impact Analysis
Phase 1 的三項驗收(A4 Canvas 比例正確、方向切換正常、mm 計算正確)現在有
純函式版本(12 個新單元測試)與瀏覽器內實測雙重驗證。§23.2.4「Zoom 不影響
輸出」的前提(pt 與 px 分離)已在程式碼與測試中落實,為 Phase 7 Export 對接
鋪路。

### Verification Result
PASS — 兩層驗證:
1. `npm test`:51/51 通過(新增 12 個 preview.js 測試)。
2. 瀏覽器實測(`node scripts/dev-server.mjs` + Claude Browser 開啟
   `http://localhost:5173`,console 無錯誤):
   - A4 portrait zoom=100%:`paperPt` = `{595.276, 841.89}`,DOM 實際
     `getBoundingClientRect()` = `595.27 × 841.88`(次像素誤差 < 0.02px,
     瀏覽器 layout 四捨五入所致)。
   - 切換 Landscape:`paperPt` 正確變為 `{841.89, 595.276}`,DOM 同步跟上。
   - Zoom 200%:`paperPx` 精確變為兩倍(`1683.78 × 1190.552`),但
     `paperPt` 完全不變 —— 證實 Zoom 與 Export 用的 pt 值互不影響。
   - `applyPrintPageSize()` 產生的 `@page` 內容隨方向正確切換
     (`210mm × 297mm` ↔ `297mm × 210mm`)。
   - Fit Page 依容器實際尺寸算出非整數 zoom(0.475),使用容器當下
     `clientWidth/Height` 為準,行為符合預期(觀察到一個純 DOM 現象:
     捲軸出現/消失會讓 `clientWidth` 在計算前後不同,這是瀏覽器 layout
     的正常行為,不是 `resolveZoom()` 的邏輯問題,函式本身以顯式傳入的
     容器尺寸為準,已由純函式測試鎖定)。
   - 邊界案例:margin 設為超過紙張一半寬度,`computeContentAreaPt()`
     正確拋出「Margins leave zero or negative content area」,未靜默
     產生錯誤版面。

## 2026-08-05 | Docs | Rotated 1 entry (2026-07-06 00:00) to docs/logs/change_log_2026.md | wc -l verified (410 lines active; "newest 10" policy kept us just over 400 — worth revisiting the threshold once solo-large entries stay this long)


## 2026-08-05 19:30

### Type
Feature

### Summary
完成 Phase 2 Source Engine:PDF/圖片載入、每頁獨立 Source、§12.3
SourceBinaryStore(原始 bytes 保留規則)、§12.5 Thumbnail/Preview LRU
快取與最多 3 個並行 render 工作、§12.2 頁碼範圍解析、§12.6 記憶體釋放
(含跨頁 docId 參照計數)。38 個新單元測試(共 89 個)+ 真實瀏覽器
(Playwright + Chromium)實測驗證。

### Files Changed
- src/model.js — `createSource()` 新增 `docId` 欄位
- src/page-range.js、src/page-range.test.js(新增)
- src/lru-cache.js、src/lru-cache.test.js(新增)
- src/binary-store.js、src/binary-store.test.js(新增)
- src/sources.js、src/sources.test.js(新增)— Source Engine 核心,
  deps 注入使純邏輯可在 Node 測試,不需真實 PDF.js/瀏覽器
- src/render-adapters.js(新增)— Canvas/PDF.js 實際 render 的瀏覽器端
  adapter,不含任何 orchestration 邏輯
- dev/sources.html(新增)— Phase 2 dev harness,非產品 UI
- scripts/make-test-pdf.mjs(新增)— 零依賴合成測試 PDF 產生器(混合
  A4/A3 尺寸 + 一頁 /Rotate 90,對應 §12.4/§14.3)
- scripts/fetch-vendor.sh(新增)— pin pdf.js v5.4.149,供 Phase 2+
  開發使用(與 spike/fetch-vendor.sh 的 v6.2.108 歷史紀錄分開,見下)
- .gitignore — 新增 `/fixtures/`(合成測試 PDF,可由腳本重現)
- docs/plan.md — §5.2 補上 `docId` 欄位說明
- docs/decision_log.md — 新增 D-009(docId 設計、cropBox/mediaBox 取值
  範圍、pdf.js 開發版本改 pin 的理由)

### Reason
延續 Phase 1 完成後的下一步(plan.md §22:Source Engine 在 Paper Engine
之後)。decision_log D-005 已將 §12.3 bytes 保留規則列為 Phase 2 的硬性
驗收項目,必須這一階段就落實,不能延後。

### Implementation Details
沿用 Phase 0/1 已建立的「純邏輯可測 / DOM-Canvas-第三方庫觸碰面薄」分離
原則(§4.1):`sources.js` 只做 orchestration(頁碼範圍解析、docId/bytes
記帳、並行度限制、快取存取、release 生命週期),所有實際 Canvas 繪製、
PDF.js `page.render()`、`createImageBitmap()` 呼叫都透過 `deps.render*`
/`deps.decodeImage` 注入,`render-adapters.js` 只提供這些注入的瀏覽器端
實作。這讓 89 個測試中的 38 個 Phase 2 測試全部能在純 Node(`node:test`)
下用假的 `pdfjsLib`/render 函式跑,不需要啟動瀏覽器。

`docId` 設計解決「一份 PDF 檔案多頁,但原始 bytes 只該存一份」的問題:
同一檔案的所有 page-Source 共用一個 docId,`sources.js` 對每個 docId 維護
參照計數,只有最後一個引用它的 Source 被 `releaseSource()` 時才真正呼叫
`binaryStore.remove()` 與 `loadingTask.destroy()`(pdf.js v6 起無
`pdfDoc.destroy()`,沿用 D-008 記錄的 `loadingTask.destroy()`)。

§12.5 的三個門檻具體實作:`computeThumbnailSize()`(長邊 200px)、
`computePreviewCanvasSize()`(150 DPI,長邊上限 4096px,快取已建但 Phase 2
尚未有任何呼叫端填入內容,留給之後真正需要中解析度 Canvas 的 Phase)、
`createRenderQueue(3)`(最多 3 個並行 render,其餘排隊,用手動控制
resolve 時機的假任務測試驗證排隊/釋放行為)。`createLruCache()` 為通用
LRU,`onEvict` 掛 §12.6 的釋放邏輯(revokeObjectURL、canvas 歸零、
ImageBitmap.close()),Thumbnail 快取上限 300、Preview 快取上限 60。

實測階段發現此開發環境(Playwright 內建 Chromium 141)無法 render 用
spike 選用的 pdf.js v6.2.108(呼叫了尚未普及的
`Map.prototype.getOrInsertComputed`),改用 v5.4.149 後恢復正常,細節與
理由見 decision_log D-009(刻意不動 spike 既有的驗證記錄與腳本)。

### Impact Analysis
Phase 2 是 decision_log D-005 認定的高風險項目(ArrayBuffer detach)的
實際驗收點,現在有程式碼與瀏覽器實測雙重證據支撐,不再只是文件承諾。
`docId` 欄位與參照計數機制也是 Phase 7 Export 需要的資料流基礎(同一 PDF
檔案的多個 Slot/頁面共用同一份原始 bytes)。Preview 快取(60 筆)已建好
但未被任何呼叫端填入,是刻意的範圍控制,不是遺漏——已在程式碼註解與
decision_log 中說明,避免被誤認為忘記做。

### Verification Result
PASS — 兩層驗證:
1. `npm test`:89/89 通過(新增 38 個:page-range 10、lru-cache 7、
   binary-store 5、sources 16)。
2. 瀏覽器實測(`node scripts/dev-server.mjs` + Playwright 啟動真實
   Chromium,開啟 `http://localhost:5173/dev/sources.html`,console 無
   錯誤):
   - 上傳合成 3 頁 PDF(A4 / A3 / A4+Rotate90):3 個 Source 正確產生,
     `naturalWidth/Height` 對第 3 頁(`/Rotate 90`)正確對調為
     841.89×595.276(§14.3),三者共用同一個 `docId`。
   - 3 個縮圖與 1 張額外上傳的合成 PNG(400×300 漸層圖)縮圖全部成功
     render 到 canvas,像素檢查確認非空白(PDF 頁 75/48/130 個非白像素,
     圖片 30000/30000 全非白,符合各自內容預期);旋轉頁縮圖長寬比正確
     呈現橫向(200×141)。
   - `binaryStore`:2 個 doc(PDF+圖片)共 124449 bytes;`openPdfDocs`:1
     (3 頁共用一份)。
   - 刪除 3 頁 PDF 中的 1 頁後,`binaryStore`/`openPdfDocs` 皆不變
     (bytes 與 doc 仍在,因為另外 2 頁還在引用)——確認 docId
     參照計數正確;點擊「Delete All」後 `binaryStore`/`openPdfDocs`/
     `thumbnailCache` 全部归零(§23.5.3)。
   - 頁碼範圍輸入 `2`(只載入第 2 頁):正確只產生 1 個 Source,
     `pageIndex=1`、尺寸為 A3(841.89×1190.551),確認 §12.2 語法與
     UI 輸入框正確串接。
   - 全程無 console error(換用 v5.4.149 之前的版本會在每次
     `page.render()` 噴 `TypeError`,已在上方 Implementation Details
     記錄診斷過程)。


## 2026-08-05 20:15

### Type
Feature

### Summary
完成 Phase 3 Layout Engine:`src/layout.js`(§9.1 preset 版型 + §9.2 自訂
Grid 的純幾何產生器)、`src/preview.js` 新增 Slot 繪製(`computeSlotPx()`/
`renderSlots()`)、`dev/layout.html` dev harness。23 個新單元測試
(共 112 個)+ 真實瀏覽器(Playwright)逐一驗證全部 14 個 preset 的實際
`getBoundingClientRect()` 與 model 換算值完全吻合。

### Files Changed
- src/layout.js、src/layout.test.js(新增)
- src/preview.js — 新增 `computeSlotPx()`、`renderSlots()`;新增 import
  `sortByZOrder`(geometry.js)
- src/preview.test.js — 新增 2 個 `computeSlotPx` 測試
- dev/layout.html(新增)— Phase 3 dev harness,非產品 UI
- docs/decision_log.md — 新增 D-010(非對稱 preset 列/欄權重假設、
  「2+2」preset 不實作的理由)
- docs/project_status.md — TL;DR、Completed/In Development/Known Issues
  更新

### Reason
延續 Phase 2 完成後的下一步(plan.md §22:Layout Engine 在 Source Engine
之後)。§9.1 明訂 MVP 必備 preset 清單(1/2/4/6/9-up、上2下1、上1下2),
§9.2 要求自訂 Grid,兩者都需要一個能從「內容區尺寸 + Gap 設定」算出
Normalized Slot 座標的純函式核心,才能讓 Phase 4(自由版型)在同一份資料
結構上疊加編輯能力,而不必重寫。

### Implementation Details
`src/layout.js` 只有一個真正的幾何原語:`splitAxis(sizePt, gapPt,
weights)`——把一段長度依權重比例切成 N 段、扣除 (N-1) 個 gap,回傳已經是
0..1 正規化的 `{start, size}`。§9.1 的均勻 grid(1/2/4/6/9/16-up)與 §9.2
的自訂 Grid 是同一個 `generateGridSlots()`,差別只在 rows/cols 是常數還是
使用者輸入。上2下1/上1下2/左1右2/左2右1(以及 [S] 的「3+1」「1+3」,對應
`generateTopBottomSplit`/`generateLeftRightSplit` 的參數化版本)則是先把
主軸(上下或左右)二等分,再對其中一段依格數均分——這個「二等分」是 Phase 3
本身要填的假設,§9.1 的 ASCII 圖沒有文字明確規定,已記入 decision_log
D-010,連同「2+2」preset 因語意不明而不實作的理由。

`preview.js` 新增的 `computeSlotPx()`/`renderSlots()` 延續 Phase 1 建立的
「純計算 vs DOM adapter」分離:前者把 Slot 的 Normalized 值換算成
content-area 相對的 preview px(純函式,可測);後者只負責把換算好的數字
寫進 DOM,並在繪製時呼叫 `geometry.js` 既有但至今未被任何 renderer 實際
使用過的 `sortByZOrder()`(§6.5)——這是它第一次真正派上用場,也讓
「Preview 與 Export 用同一份排序函式」不再只是文件承諾。

### Impact Analysis
Phase 3 的產出(`generatePresetSlots()`/`generateGridSlots()`/
`createSlotsFromRects()`)是 Phase 4 自由版型編輯(拖曳/縮放/分割/合併)
與 Phase 17 Template 儲存的共同基礎——兩者都直接操作這裡產生的 Slot
陣列,不需要另一套資料轉換。`renderSlots()` 也是 Phase 5(Source
Placement)畫出實際內容前,Slot 外框本身就能先被看見與互動的前提。

### Verification Result
PASS — 兩層驗證:
1. `npm test`:112/112 通過(新增 23 個:layout.js 21、preview.js
   computeSlotPx 2)。
2. 瀏覽器實測(`node scripts/dev-server.mjs` + Playwright 啟動真實
   Chromium,開啟 `http://localhost:5173/dev/layout.html`,console 無
   錯誤):
   - 逐一套用全部 14 個 preset(1up/2up-h/2up-v/4up/6up-2x3/6up-3x2/
     9up/16up/top2-bottom1/top1-bottom2/left1-right2/left2-right1/
     top3-bottom1/top1-bottom3):每個 Slot 的實際
     `getBoundingClientRect()`(扣除 content-area 偏移後)與 model 的
     normalized 值乘以 `contentAreaPx` 算出的期望值比較,容許
     1.5px 次像素誤差,**全部 0 mismatch**。
   - §9.2 自訂 Grid 輸入 3×5:正確產生 15 個 Slot。
   - 切換 Orientation 後重新套用不報錯,Slot 數量不變(模型本身不因
     Orientation 改變而自動變動,需使用者手動重新套用 preset,符合
     §8.2 的既定行為)。
   - Gap H/V 改為 20pt 後重新套用 4-up:算出的 normalized 值與手算公式
     `(內容區長度 - gap) / 2 / 內容區長度` 相符。

## 2026-08-05 21:40

### Type
Feature

### Summary
完成 Phase 4 Free Layout Designer:`src/free-layout.js`(純 Slot 編輯
原語 + Snap 系統)、`src/reducers.js`(接上 `store.js` 的 action
creator)、`dev/free-layout.html`(互動式 dev harness,支援真實滑鼠拖曳
新增/移動/縮放/分割/合併/刪除/複製 + Undo/Redo)。過程中修正
`src/store.js` 一個既有 bug(reducer throw 時 history 記帳未回滾)。
44 個新單元測試(共 156 個)+ 真實瀏覽器(Playwright 模擬滑鼠拖曳)全數
驗證通過。

### Files Changed
- src/free-layout.js、src/free-layout.test.js(新增)
- src/reducers.js、src/reducers.test.js(新增)
- src/store.js — 修正 `commit()` 的 history 記帳順序(見 Implementation
  Details);新增 regression test
- dev/free-layout.html(新增)— Phase 4 互動式 dev harness,非產品 UI
- docs/decision_log.md — 新增 D-011(分割方向命名、鎖定 Slot 操作邊界、
  Snap 衝突取捨策略、store.js bug 修正)
- docs/project_status.md — TL;DR、Completed/In Development/Known Issues/
  Technical Architecture/Data Structure 更新

### Reason
延續 Phase 3 完成後的下一步(plan.md §22:Free Layout Designer 在 Layout
Engine 之後,是本工具與一般 N-up 工具的主要差異)。§9.3/§9.4/§9.5 皆標記
[M],且 §7 的 History 契約明訂拖曳/縮放/刪除/新增/分割/合併都必須進
Undo/Redo,這是第一個真正需要「編輯操作」而非「一次性產生 Slot」的
Phase,因此也是 `store.js`(Phase 0 完成、但 Phase 1-3 dev harness 都未
實際使用)第一次被真正的 commit/undo/redo 流程驗證。

### Implementation Details
**`free-layout.js`** 提供的都是 `Slot[] -> Slot[]` 的純函式,不 import
`store.js`,可獨立單元測試:
- `moveSlots()`/`setSlotRect()`/`deleteSlots()`/`duplicateSlots()`:
  §9.3 的基本編輯操作。鎖定 Slot 的處理邊界(decision_log D-011):
  Move 靜默略過鎖定成員,Resize/Delete/Split/Merge 對鎖定目標一律 throw。
- `splitSlotHorizontal()`/`splitSlotVertical()`:因 §9.3 沒有圖示,方向
  命名依 Word/Excel「分割儲存格」慣例(水平分割線 -> 上下兩塊),已記入
  decision_log D-011,而非默默照字面猜測。
- `canMergeSlots()`/`mergeSlots()`:§23.4.2「合併非矩形選取時操作被禁用
  並顯示提示」的實作——判斷式為「選取集合兩兩不重疊」且「聯集面積等於
  外框面積」(兩個條件同時成立,數學上等價於聯集本身就是一個乾淨的矩形)。
  單元測試直接複現 plan §9.3 的範例(2×2 grid 合併下面兩格 -> 上2下1的
  下半格)。
- `createSlotRectFromDrag()`:§9.4 自由拖曳建立格位,把任意方向的拖曳
  正規化成 min-origin 矩形並 clamp 到內容區。
- Snap 系統:`computeSnapTargetsX/Y()` 收集紙張邊界/中心與其他 Slot 邊/
  中線(§9.5 [M] 範圍;參考線與 Grid 吸附需要 Guides 資料模型,AppState
  尚無此結構,列為缺口未做);`computeSnapThresholdNormalized()` 把
  §9.5 固定的 6 螢幕 px 依目前 zoom 換算成 normalized 誤差範圍(zoom 越
  大、normalized 門檻越小,視覺上永遠是同樣 6px);`snapMoveAxis()` 同時
  比較起始邊/結束邊/中心線三個候選,取需要調整量最小者(decision_log
  D-011);`snapResizeAxis()`/`snapResize()` 則只吸附呼叫端指定的那條邊
  (對應使用者正在拖曳的 handle)。

**`reducers.js`** 是 free-layout.js 與 `store.js` 之間唯一的接線層:
每個 action creator 回傳 `(state) => newState`,與 `store.test.js` 既有
的 `setCount`/`increment` 慣例一致,鎖定在 `state.pages[pageId].slots`
這條路徑上操作。

**`store.js` bug 修正**:寫 `reducers.test.js` 的「合併非矩形選取應該
threw 且 store 完全不變」整合測試時,發現 `commit()` 原本的順序是
`past.push(current)` → 清空 `future` → **才**呼叫 `reducer(current,
action)`。若 reducer 中途 throw(例如 `mergeSlots` 驗證失敗),`past`
已經多了一筆重複記錄、`future` 已被清空,即使這次操作完全沒有真的改動
任何狀態。修正為:先算出 `nextState = reducer(current, action)`,成功後
才動 history 記帳。Phase 0-3 從未寫過會 throw 的 reducer,這條路徑一直
沒被測試觸發過。

**dev harness 的一個附帶修正**:`setPointerCapture` 原本呼叫在
`e.target`(可能是 `.pl-slot` 元素)上,但選取一個尚未選取的 Slot 時會先
觸發 `setSelection()` 的重新渲染,把包含 `e.target` 的舊 DOM 整批換掉,
導致對「已從文件移除」的元素呼叫 `setPointerCapture` 拋出
`InvalidStateError`。改為 capture 在穩定不變的 `viewport` 容器元素上
(本來就是所有拖曳事件監聽器所在的元素),徹底避開這個問題。

### Impact Analysis
Phase 4 的產出(`free-layout.js`/`reducers.js`)是 Phase 5(Source
Placement)、Phase 6(Auto Imposition)、Phase 9(Project System 的
Undo/Redo 驗收)共同的編輯基礎設施——之後任何會修改 Slot 的功能都應該
透過這裡的 reducer 模式接上 store,而不是重新發明一套 mutation 路徑。
`store.js` 的 bug 修正影響所有現有與未來的 reducer,是這次意外但重要的
副產出;若未修正,Phase 5+ 一旦有 reducer 做輸入驗證(例如 fitMode 檢查、
sourceId 存在性檢查),同樣會在驗證失敗時悄悄弄髒 undo history。

### Verification Result
PASS — 兩層驗證:
1. `npm test`:156/156 通過(新增 44 個:free-layout.js 31、reducers.js
   12、store.js regression 1)。
2. 瀏覽器實測(`node scripts/dev-server.mjs` + Playwright 模擬真實滑鼠
   `down`/`move`/`up` 序列,開啟 `http://localhost:5173/dev/free-
   layout.html`,console 無錯誤):
   - 點選 Slot:正確選取、顯示 8 個縮放 handle。
   - 關閉 Snap 後拖曳:模型座標變化量與滑鼠實際移動像素數換算後的
     normalized 值精確吻合(誤差 < 0.002)。
   - 開啟 Snap 後拖曳:吸附行為符合「調整量最小的邊獲勝」設計——一次
     刻意設計成「起始邊吸到 0」與「結束邊吸到 0.5」兩個候選都在門檻內
     的情境,驗證確實選到調整量較小的結束邊,而非天真假設的起始邊
     (過程中先發現這是測試腳本自身的錯誤假設,而非程式邏輯錯誤,
     诊断後確認吸附行為完全正確)。
   - 關閉 Snap 縮放單一 handle:寬高變化量與滑鼠位移精確吻合。
   - Split Horizontal:1 個 Slot 變 2 個,Undo 還原。
   - Merge:載入無 gap 的 4up(有 gap 的預設格位間本來就有間隙,聯集本非
     矩形,正確被拒絕——先誤判為 bug,細查後確認是預期行為),選取相鄰
     兩格,Merge 按鈕正確啟用且合併後變 3 個 Slot;選取對角兩格時 Merge
     按鈕正確保持停用並顯示「選取的格位聯集不是矩形,無法合併」提示。
   - Delete / Ctrl+Z / Ctrl+Y / Duplicate:計數變化皆符合預期。
   - Create 模式拖曳建立 Slot:清空所有 Slot 後,在內容區拖出一個矩形,
     產生的 Slot 座標(x=0.200, y=0.200, w=0.400, h=0.300)與拖曳範圍
     精確吻合。

## 2026-08-05 | Docs | Rotated 5 entries (2026-07-06 00:10 .. 2026-08-05 16:10) to docs/logs/change_log_2026.md | wc -l verified (549 lines active after rotation, before this Phase 5 entry)

## 2026-08-05 22:30

### Type
Feature

### Summary
Phase 5 Source Placement: assigning a Source to a Slot (drag from the
Gallery), and editing its Fit(Contain)/Fill(Cover)/Stretch, Scale, Rotation
(0/90/180/270), Offset X/Y, and Flip X/Y — plus the Preview Renderer actually
drawing that placed content (clipped to the Slot, §6.6) instead of just an
outlined box. Also completes the §12.7 mid-resolution Canvas Preview tier
Phase 2 had only stood up the cache for.

### Files Changed
- src/slot-content.js (created) — pure `Slot[]` field-editing primitives:
  `setSlotSource`/`setSlotFitMode`/`setSlotScale`/`setSlotRotation`/
  `rotateSlotContent`/`setSlotOffset`/`setSlotFlip`/`clearSlotContent`.
- src/slot-content.test.js (created) — 15 tests.
- src/reducers.js — 8 new action creators wiring slot-content.js to
  `store.commit()`, same pattern as Phase 4's Free Layout actions.
- src/reducers.test.js — 8 new tests, including a coalescing check for an
  Offset slider drag and a rejected-rotation history-untouched check.
- src/sources.js — `computeImagePreviewSize()` (new, pixel-based cap, no DPI
  math); `ensurePreview()`/`getPreview()`/`waitForPreview()` on
  `createSourceEngine()` (lazy §12.7 mid-res render, shares the existing
  render queue/cache with thumbnails).
- src/sources.test.js — 11 new tests (2 pure sizing, 9 ensurePreview/
  releaseSource-with-preview).
- src/render-adapters.js — `renderPdfPagePreview()` / `renderImagePreview()`
  (mirrors the thumbnail renderers, targets `computePreviewCanvasSize()` /
  `computeImagePreviewSize()` respectively; the image path re-decodes from
  `SourceBinaryStore`, not the thumbnail's already-closed bitmap).
- src/preview.js — `computeSlotContentTransform()` (pure, calls geometry.js's
  `slotContentMatrix()` with slotX/slotY pinned to 0) and `renderSlotContent()`
  (DOM adapter, writes the CSS `transform`); `renderSlots()` now sets
  `overflow:hidden` on each `.pl-slot` (§6.6 clip).
- src/preview.test.js — 7 new tests covering contain/cover/stretch,
  local-origin rotation, §6.4 offset units, and flip.
- dev/placement.html (created) — Phase 5 dev harness.

### Reason
Phase 4 completed the Free Layout Designer; per plan.md §22's phase order,
Source Placement is next, and it is the first phase to actually exercise
geometry.js's `slotContentMatrix()` (written in Phase 0, unused until now) —
so this is also the first real-world check that §4.3's "one geometry module"
contract holds up against a concrete renderer, ahead of Phase 7 Export having
to lean on the exact same function.

### Implementation Details
See decision_log D-012 for the three judgment calls made (image Source
preview sizing uses a pixel-based cap rather than PDF-page DPI math; the
§12.7 mid-res tier renders lazily the moment a Source is placed into a Slot,
not at load time; Preview calls `slotContentMatrix()` with a local
slot-relative origin since the `<img>` is a DOM child of the already-
positioned/clipped `.pl-slot`, while Export will later call the same
function with the real absolute origin).

`slot-content.js` deliberately does not check `locked` — §10.3 only scopes
locking to Move/Resize/Delete, not content edits.

### Impact Analysis
Phase 6 (Auto Imposition) will assign Sources to Slots in bulk (Auto Fill) —
it should call the same `setSlotSourceAction`/`clearSlotContentAction`
reducers this phase adds rather than inventing a second mutation path.
Phase 7 (Export) must call `geometry.js`'s `slotContentMatrix()` with the
real absolute slotX/slotY (not the Preview's local-origin convention) but
otherwise reuses the exact same function and field set — the equivalence
check in §23.3 should confirm the two call sites only differ in that one
parameter.

### Verification Result
PASS — two layers:
1. `npm test`: 191/191 passing (35 new: slot-content.js 15, reducers.js 6,
   sources.js 8, preview.js 6).
2. Browser verification (`node scripts/dev-server.mjs` + Playwright against
   a synthetic 3-page PDF with mixed A4/A3 sizes and one `/Rotate 90` page,
   plus a synthetic 2-color PNG, opening
   `http://localhost:5173/dev/placement.html`, console clean): dragging a
   Gallery thumbnail onto a Slot assigns the Source and defaults to
   `fitMode: 'contain'`; the §12.7 mid-res preview renders and the `<img>`
   swaps to it once ready; contain/cover/stretch bounding boxes measured via
   `getBoundingClientRect()` match the expected letterbox/fill/exact-match
   behavior; the Rotate 90° button cycles 0→90→180→270→0 and, visually, a
   90°-rotated image still fits correctly (confirms §6.3's fit-target-axis
   swap end to end); an Offset X slider drag (three `input` events + one
   `change`) coalesces into exactly one undo step and one Undo reverts the
   whole drag; Flip X mirrors the content; Clear Content removes the `<img>`
   and resets every transform field; the pixel-dimensioned image Source
   places and fits correctly despite its different unit from PDF-page
   Sources (see D-012).

## 2026-08-05 23:15

### Type
Bugfix / Feature (gap-fill)

### Summary
Completeness audit of Phase 5 turned up two [M] MUST requirements that
plan.md assigns to Phase 4 (merged in from another session) but that were
never actually implemented: Lock/Unlock toggling (§10.3) and Z-order
operations (§6.5). Both are now implemented.

### Files Changed
- src/free-layout.js — `setSlotLocked()` (unrestricted toggle) and
  `bringSlotForward()`/`sendSlotBackward()`/`bringSlotToFront()`/
  `sendSlotToBack()` (single-Slot, re-rank to a clean 0..n-1 z via
  `sortByZOrder()`, not blocked by `locked`).
- src/free-layout.test.js — 9 new tests.
- src/reducers.js — 5 new action creators (`setSlotLockedAction` +
  4 Z-order actions).
- src/reducers.test.js — 2 new integration tests.
- dev/free-layout.html — Lock/Unlock button (label reflects current state)
  and 4 Z-order buttons, enabled only for a single selection; readout now
  includes `z`.

### Reason
`free-layout.js` already ENFORCED locking (moveSlots skips locked members;
setSlotRect/deleteSlots/splitSlot*/mergeSlots throw) and `geometry.js`
already SORTS by z (`sortByZOrder()`, shared by Preview/Export per §4.3) —
but nothing anywhere could actually flip `slot.locked` or change `slot.z`.
Both mechanisms existed with no way to trigger them. Neither gap was
recorded in decision_log D-011 (which covered other Phase 4 judgment calls)
or project_status.md's Known Issues, so "Phase 0-4 已完成" was not quite
accurate until now.

### Implementation Details
See decision_log D-013 for the three judgment calls: single-Slot (not
multi-select) Z-order operations, matching how mainstream design tools treat
"bring forward/to front"; z re-ranked to a clean contiguous 0..n-1 from
`sortByZOrder()`'s output rather than nudging the raw z number by ±1 (which
could silently no-op when the existing z values have wide gaps, e.g. from
duplicateSlots()/mergeSlots() minting new z far outside the existing range);
and Z-order changes are NOT blocked by `locked`, since §10.3 only names
Move/Resize/Delete.

### Impact Analysis
No impact on Phase 5's own deliverables — this is purely filling in a gap
in the Phase 4 foundation those and all future Slot-editing features sit on.
Phase 6+ inherits a Free Layout Designer that now actually matches plan.md's
§10.3/§6.5 [M] requirements.

### Verification Result
PASS — two layers:
1. `npm test`: 204/204 passing (12 new this round: free-layout.js 10,
   reducers.js 2; also includes 1 earlier addition this session — an
   explicit §10.1 "same Source into multiple Slots" regression test in
   reducers.js — bringing the running total from 191 to 204).
2. Browser verification (`node scripts/dev-server.mjs` + Playwright against
   `http://localhost:5173/dev/free-layout.html`, console clean): Bring to
   Front / Send to Back / Bring Forward / Send Backward each produce the
   exact expected z-order position; toggling Lock via the new button then
   attempting a real mouse-drag on that Slot confirms it does NOT move
   (Phase 4's existing enforcement correctly wired to the new toggle),
   Unlock restores normal dragging; locking enters Undo history (not
   `historyEntry:false` like Selection) and Undo correctly reverts it.

## 2026-08-05 | Docs | Rotated 2 entries (2026-08-05 16:20, 16:35) to docs/logs/change_log_2026.md | wc -l verified (642 lines active after rotation)

## 2026-08-06 00:30

### Type
Feature

### Summary
Phase 6 Auto Imposition: Auto Fill (spread a list of Sources across as many
generated Output Pages as a chosen layout needs), fill-rule controls
(sequential/reverse order, odd/even filter, repeat-N), and Output Pages
management (add/delete/duplicate/reorder).

### Files Changed
- src/auto-fill.js (created) — `applyFillRule()`, `generateAutoFillPages()`/
  `generateAutoFillPageObjects()`, `detectMixedSourceSizes()`.
- src/auto-fill.test.js (created) — 17 tests, including the exact plan.md
  §11.1 worked example (30 sources + 4-up -> 8 pages, last page 2+2).
- src/pages.js (created) — `addPage`/`deletePage`/`duplicatePage`/`movePage`.
- src/pages.test.js (created) — 12 tests.
- src/reducers.js — `autoFillAction()` + 4 page-management action creators.
- src/reducers.test.js — 6 new tests.
- dev/auto-fill.html (created) — Phase 6 dev harness.

### Reason
Next phase per plan.md §22 after Phase 5 (Source Placement). Phase 6 is the
first phase where a single action can change the NUMBER of Output Pages
rather than just one page's Slots, so it needed a new reducer shape
(`autoFillAction`/page-management actions) alongside the existing
`updatePageSlots()`-based ones.

### Implementation Details
See decision_log D-014 for the three judgment calls: collapsing plan.md
§11.2's six listed fill "modes" into three orthogonal knobs (order/filter/
repeatCount) since the only worked example only ever demonstrates one
source repeated a fixed count; Auto Fill replaces the template page in
place (same array position) rather than leaving it untouched or requiring a
separate blank template; and `deletePage()` refuses to remove the last
remaining page, mirroring how Phase 4 guards the last Slot.

### Impact Analysis
Phase 7 (PDF Export) will iterate `AppState.pages` to render each page —
Auto Fill-generated pages are ordinary Page objects with no special marker,
so Export needs no Auto-Fill-specific handling. Phase 9 (Project System)'s
save/load must round-trip the full `pages` array Auto Fill can now grow
arbitrarily large.

### Verification Result
PASS — two layers:
1. `npm test`: 238/238 passing (34 new: auto-fill.js 17, pages.js 12,
   reducers.js 5; running total 204 -> 238).
2. Browser verification (`node scripts/dev-server.mjs` + Playwright against
   a synthetic 3-page mixed-size PDF (A4/A3/`/Rotate 90`) + a synthetic
   image, opening `http://localhost:5173/dev/auto-fill.html`, console
   clean): loaded 4 sources with genuinely differing sizes correctly
   triggers the §11.4 mixed-size hint; setting `repeatCount=30` on a single
   source through the real UI reproduces plan.md's own §11.1 numbers
   exactly (8 pages, last page 2 filled + 2 empty); sequential vs. reverse
   order actually reverses fill order with 4 distinct real sources;
   filter:"odd" keeps exactly 2 of 4; Duplicate/Delete/Move Up all update
   both the DOM and the store state correctly.

## 2026-08-06 | Docs | Rotated 1 entry (2026-08-05 17:00) to docs/logs/change_log_2026.md | wc -l verified (646 lines active after rotation)

## 2026-08-06 01:45

### Type
Feature

### Summary
Phase 7 PDF Export — the product's core value and biggest technical risk.
`src/export.js` renders the full Layout Model to a real PDF via pdf-lib
(low-level operators, not the high-level `drawPage()`/`drawImage()` API),
with §23.3 Preview/Export geometric equivalence proven by 104 test cases.
A critical rendering bug (upside-down text, near-invisible images) was found
via manual screenshot review — NOT by the automated Playwright pixel checks —
and fixed; see decision_log D-016 for the full diagnosis.

### Files Changed
- src/geometry.js — `pdfPageFlipMatrix(paperHeightPt)` (new; the second and
  last sanctioned Y-flip location alongside `modelYToPdfY`).
- src/geometry.test.js — new tests for `pdfPageFlipMatrix` consistency.
- src/export.js (created) — `roundedPaperSizePt()`, `computeSlotAbsoluteRectPt()`,
  `computeContentRotationAndSize()`, `computeExportContentMatrix()` (conceptual
  matrix, for §23.3 equivalence only), `computeXObjectDrawMatrix()`
  (pdf-lib-specific matrix actually used to draw — see Implementation Details),
  `computeExportClipRectPt()`, `detectImageFormat()` (magic-byte sniffing),
  `embedSource()`, `exportProjectToPdf()`.
- src/export.test.js (created) — pure-function tests + fake-pdfLib
  orchestration tests (dedup, encryption, page count, z-order, metadata) +
  regression tests pinned to the calibrated `computeXObjectDrawMatrix` values.
- src/preview-export-equivalence.test.js (created) — 104 cases (2 sources ×
  3 fitModes × 4 rotations × 4 flip combos + 8 offset/scale cases),
  `EPSILON_PT = 0.28` per §23.3.2.
- src/export-adapters.js (created) — browser-only `transcodeWebpToPng()`.
- src/export-real-pdf-lib.test.js (created) — guarded (skips gracefully if
  `vendor/pdf-lib` hasn't been fetched); MediaBox/page-count check,
  text-selectable check, 8-slot-1-XObject dedup check, a `cm`-operator
  byte-level regression test, and a `/Rotate 90` source-page test.
- src/reducers.js — `addSourceAction()`/`removeSourceAction()` (new; see
  Implementation Details for why these were missing).
- src/reducers.test.js — new tests for the two actions above.
- scripts/fetch-vendor.sh — now also fetches pdf-lib 1.17.1 into
  `vendor/pdf-lib/` (npm registry tarball; unpkg CDN returned 403 via the
  proxy).
- dev/export.html (created) — Phase 7 dev harness: Source Gallery, Auto Fill,
  Export PDF, and a verification panel that reloads the output via real
  pdf-lib (structural check) and re-renders it via real pdf.js (visual check).
- dev/placement.html, dev/auto-fill.html — retrofitted to also call
  `store.commit(addSourceAction(s))` when loading sources.
- docs/decision_log.md — D-012 (Phase 5 image preview decisions, recorded
  earlier this session but not yet summarized here), D-013 (Phase 4 gap-fill),
  D-014 (Phase 6 Auto Fill semantics), D-015 (Phase 7 architecture + the
  AppState.sources gap), D-016 (the critical XObject coordinate-system bug).

### Reason
Next phase per plan.md §22 after Phase 6 (Auto Imposition). plan.md itself
flags this as "產品核心價值與最大技術風險" (the product's core value and
biggest technical risk), and §23.3 requires Preview and Export to be
geometrically provably equivalent before Export can be trusted.

### Implementation Details
pdf-lib runs natively in Node (unlike pdf.js, which needs a Worker/DOM) —
verified directly, so `export.js`'s orchestration logic (dedup, z-order,
page iteration) is Node-testable via `deps` injection, the same pattern as
`sources.js`. Low-level operators (`pushGraphicsState`, `concatTransformationMatrix`,
`drawObject`, `rectangle`+`clip`+`endPath`, `popGraphicsState`) are used
instead of pdf-lib's high-level `drawPage()`/`drawImage()` to avoid any
implicit matrix-decomposition risk in the high-level API.

**The critical bug**: `computeExportContentMatrix()`'s first implementation —
just `multiply(pdfPageFlipMatrix(paperHeightPt), modelMatrix)` — passed all
104 §23.3 equivalence tests and several byte-level real-pdf-lib tests, but
produced visibly wrong output (upside-down text, near-invisible images) once
actually rendered via real pdf.js. Root cause: pdf-lib's embedded XObjects
have native coordinate systems that `slotContentMatrix()` doesn't account
for — an embedded Image XObject is a [0,1]×[0,1] unit square needing a
rescale-plus-flip, while a Form XObject from `embedPage()` is Y-up and
BBox-sized needing only a flip. Found via systematic calibration: built
isolated Playwright scripts comparing pdf-lib's own high-level
`drawImage()`/`drawPage()` (a known-correct reference) against the raw
`cm`+`Do` approach with quadrant-colored test images/pages (TL=red,
TR=green, BL=blue, BR=yellow) to unambiguously tell flips from rotations
from correct output, trying every scale-sign combination before landing on
the right formula for each source kind. Fixed by splitting the function in
two: `computeExportContentMatrix()` stays purely conceptual (what §23.3
compares against Preview) and a new `computeXObjectDrawMatrix()` adds the
kind-specific correction on top and is the one actually fed to pdf-lib.
Permanent regression tests pin the exact calibrated matrix values at both
the pure-function level and by parsing the real `cm` operator bytes out of
an actual exported PDF. Full trace in decision_log D-016.

**The AppState.sources gap**: `exportProjectToPdf()` initially threw
"unknown source" for every Source a user had actually loaded through the UI,
because no reducer across Phases 2–6 had ever written to `AppState.sources` —
Preview had always used a harness-local Map instead. Fixed with
`addSourceAction()`/`removeSourceAction()` and retrofitted all three dev
harnesses that load Sources to call the new action alongside their existing
local Map population. See decision_log D-015.

### Impact Analysis
Phase 8 (Print Path) reuses `exportProjectToPdf()` as-is per plan.md §15.1
(printing is explicitly required to go through the exported PDF, never
`window.print()` on the DOM) — no new Export logic should be needed there,
only a print-calibration page and Crop Marks. Any future third Source kind,
or a switch away from pdf-lib, must re-derive `computeXObjectDrawMatrix()`'s
correction from scratch per D-016 — it must not be assumed to generalize.
Any future Source-loading entry point must call `addSourceAction()` or
Export will silently fail to find it.

### Verification Result
PASS — two layers:
1. `npm test`: 382/382 passing (144 new this round).
2. Browser verification (`node scripts/dev-server.mjs` + Playwright against
   synthetic mixed-size sources, opening `http://localhost:5173/dev/export.html`,
   console clean): exporting produces a PDF that reloads correctly via real
   pdf-lib (MediaBox/page-count/resource-dedup all match expectations) AND
   re-renders correctly via real pdf.js — verified by actually looking at the
   rendered screenshot rather than trusting only the automated pixel-count
   checks, which is how the D-016 bug was caught in the first place (the
   automated checks alone had been passing throughout).

## 2026-08-06 | Docs | Rotated 3 entries (2026-08-05 17:40, 18:15, and the 2026-08-05 first rotation-record) to docs/logs/change_log_2026.md | wc -l verified (631 lines active after rotation)

## 2026-08-06 02:30

### Type
Feature

### Summary
Phase 8 Print Path: Crop Marks (§16) drawn into every exported PDF and, per
§13.1's own requirement, into the Preview canvas too; a standalone 100mm
Print Calibration Page (§15.3); and the "Print" button, which is not a third
rendering path — it calls the exact same `exportProjectToPdf()` "Export PDF"
does, then opens the bytes via the browser's built-in PDF viewer (§15.1).

### Files Changed
- src/model.js — `createCropMarksSettings()` (new; `enabled`/`lengthPt`/
  `gapPt`/`lineWidthPt`, defaults not specified by plan.md, see D-017),
  wired into `createProject().cropMarks`.
- src/model.test.js — 3 new tests.
- src/print.js (created) — `computeCropMarksForSlot()`/
  `cropMarkSegmentsToPdfSpace()` (§16 pure geometry), `computeCalibrationPageContent()`/
  `exportCalibrationPagePdf()` (§15.3, deps-injected pdfLib, same split as
  export.js).
- src/print.test.js (created) — 9 tests.
- src/print-real-pdf-lib.test.js (created) — 3 guarded tests (A4 page size,
  the actual drawn square measures exactly 100mm in the real output content
  stream, text is real selectable Tj/TJ not rasterized).
- src/export.js — `exportProjectToPdf()` now draws Crop Marks for every Slot
  on a page (regardless of whether it has a Source) when
  `state.project.cropMarks.enabled`, via pdf-lib's high-level `page.drawLine()`.
- src/export.test.js — 3 new tests.
- src/export-real-pdf-lib.test.js — 1 new guarded test (16 real stroked
  lines for 2 empty Slots with Crop Marks on).
- src/preview.js — `renderCropMarks()` (new DOM adapter; §13.1 requires the
  Preview canvas to show Crop Marks, not just bake them into Export's
  output — reuses print.js's same `computeCropMarksForSlot()`, content-area-
  local origin per D-012's established convention).
- src/reducers.js — `setCropMarksAction()` (new; merges a partial update
  into `state.project.cropMarks`).
- src/reducers.test.js — 2 new tests.
- src/export-adapters.js — `openPdfBytesForPrint()` (new; Blob +
  `window.open()`, no `window.print()` call — see Implementation Details).
- dev/print.html (created) — Phase 8 dev harness: Crop Marks controls,
  Print button, Print Calibration Page button, reusing Phase 7's
  Export/verify wiring.

### Reason
Next phase per plan.md §22 after Phase 7 (PDF Export). §15.1 makes printing
depend on Export already being trustworthy (same rendering path, same
geometry), so it had to come after Export was proven, not before.

### Implementation Details
See decision_log D-017 for the four judgment calls: Crop Marks are drawn
per-Slot (every Slot gets its own cut guides, since this is an imposition
tool where each Slot is a separate piece to be cut out — not once around
the sheet's outer edge, the traditional single-page-print convention); the
Calibration Page is always A4 with ASCII-only English text, independent of
the current Project's paper settings (it tests the printer/driver itself,
not the user's layout — and §16 already defers CJK font-subset embedding
via fontkit to the second stage); Crop Marks are drawn into the Preview
canvas this same phase rather than deferred, since §13.1 already lists them
as a required Preview element; and "Print" deliberately does NOT call
`window.print()` itself — it opens the PDF via the browser's own viewer and
leaves the actual print trigger to that viewer's own UI, matching §15.1's
flowchart literally ("由瀏覽器內建 PDF Viewer 列印").

Because "Print" and "Export PDF" are two buttons that each independently
call the exact same `exportProjectToPdf()`, §23.6.2's "the two produce
byte-identical PDFs" holds by construction — there is no second rendering
path to keep in sync. The one caveat: two independent calls carry their own
wall-clock `/CreationDate`, so a literal byte-for-byte comparison needs that
one fixed-width metadata field normalized out first (see Verification
Result) — everything else, including every drawing operator, is identical.

### Impact Analysis
Phase 9 (Project System) will persist `Project.cropMarks` as part of the
project JSON like any other Project Setting — no new serialization concern.
Any future third Source kind or Bleed (§16 [S], second stage) feature must
revisit Crop Marks' `gapPt` semantics (currently "distance from the Slot
edge"; Bleed would introduce a distinct "distance from the bleed boundary"
concept) rather than assuming the current single-gap parameter still
applies, per D-017's Future Review Conditions.

### Verification Result
PASS — two layers:
1. `npm test`: 403/403 passing (21 new: 17 pure/fake-level across print.js,
   model.js, export.js, reducers.js + 4 real-pdf-lib-level across the new
   print-real-pdf-lib.test.js and export-real-pdf-lib.test.js; running total
   382 -> 403).
2. Browser verification (`node scripts/dev-server.mjs` + Playwright against
   `http://localhost:5173/dev/print.html`, console clean aside from the
   browser's own pre-existing `/favicon.ico` 404 — unrelated to this phase,
   dev-server.mjs has never had a favicon route): Crop Marks OFF by default
   shows zero `.pl-crop-mark` elements in the Preview DOM; toggling ON shows
   exactly 32 (4 Slots x 8 segments) for a 4-up template, toggling back OFF
   removes them; the exported PDF, re-rendered via real pdf.js, shows dark
   (crop-mark) pixels inside the page margin where no Slot content ever
   draws; clicking Print opens a genuine new browser tab pointed at a
   `blob:` URL; Print's and Export's bytes for the same store state are
   identical once the `/CreationDate` field is normalized out; clicking
   Print Calibration Page also opens a new tab, and the resulting PDF
   reloads as a single A4 page whose re-rendered 100mm square measures
   ~283-284px wide (100mm at pdf.js's 1px-per-pt scale=1 convention).

## 2026-08-06 | Docs | Rotated 1 entry (2026-08-05 19:30, Phase 2 Source Engine) to docs/logs/change_log_2026.md | wc -l verified (636 lines active after rotation)

## 2026-08-06 | Docs | Rotated 3 entries (2026-08-05 02:30 rotation-record, 02:30 Phase 8 Print Path, and 03:15 rotation-record) to docs/logs/change_log_2026.md | wc -l verified (330 lines active after rotation)

## 2026-08-06 03:15

### Type
Feature / Bugfix (schema-version gap-fill)

### Summary
Phase 9 Project System: save/load a project as `.json` (§17.1), Layout
Template save/apply (§17.3), and `schemaVersion` migration (§17.2) — plus
two real gaps found along the way: `AppState.templates` had never been
written to by any reducer since Phase 0 (the same class of gap Phase 7
found for `AppState.sources`), and `SCHEMA_VERSION` never got bumped when
Phase 8 added `Project.cropMarks`, silently breaking the "one version
number, one shape" contract §17.2 requires.

### Files Changed
- src/model.js — `SCHEMA_VERSION` 1 -> 2; `createSource()` gains
  `contentHash` (§17.1's "雜湊" metadata field).
- src/model.test.js — 1 new test.
- src/hash.js (created) — `computeContentHash(bytes)`, a direct
  `crypto.subtle.digest('SHA-256', ...)` call — no deps injection needed,
  since Web Crypto is a converged Node/browser standard (verified directly
  against this repo's Node runtime).
- src/hash.test.js (created) — 4 tests.
- src/sources.js — `loadPdfFile()`/`loadImageFile()` now hash each loaded
  file's original bytes once (shared across every page-Source from the
  same docId) and store it as `contentHash`.
- src/sources.test.js — 2 new assertions added to existing tests.
- src/project-file.js (created) — `serializeProject()` (envelope:
  `{schemaVersion, project, sources, templates, pages}`, `selection`
  excluded), `migrateProjectData()` (v1 -> v2 fills in the missing
  `cropMarks` default; throws for a file newer than this app supports),
  `deserializeProject()` (migrate + re-validate via `createSource()`/
  `createTemplate()`), `relinkSources()` (§17.1's re-select-and-match flow:
  fileName + pageIndex + dimensions, with contentHash as the authoritative
  tiebreaker whenever both sides have one), `findMissingSourceIds()`.
- src/project-file.test.js (created) — 19 tests.
- src/pages.js — `applyTemplateToPage()` (§17.3; replaces a page's
  paper+slots wholesale, regenerating Slot ids, same precedent as Auto
  Fill's page replacement).
- src/pages.test.js — 3 new tests.
- src/reducers.js — `saveTemplateAction()`/`deleteTemplateAction()`/
  `applyTemplateAction()` (new; fixes the AppState.templates gap).
- src/reducers.test.js — 4 new tests.
- src/store.js — `resetWithState(newState)` (new; a full state replacement
  that clears `past`/`future`/`pendingCoalesceKey`, distinct from
  `commit(reducer, action)` — loading a project is a context switch, not a
  derived edit).
- src/store.test.js — 3 new tests.
- src/project-adapters.js (created) — `downloadProjectJson()`/
  `readProjectFile()`, browser-only Blob/File glue (same split as
  export-adapters.js, no unit test per that same precedent).
- dev/project.html (created) — Phase 9 dev harness: load sources, Auto
  Fill, Save Project, Load Project (with the "please re-select these
  files" relink flow), Save as Template, Apply Template, Undo/Redo buttons
  with a live history-depth readout.

### Reason
Next phase per plan.md §22 after Phase 8 (Print Path). A project's edit
history and Layout Templates are only meaningful once they can actually be
saved and reloaded, and store.js's Undo/Redo (implemented since Phase 4)
had never been exercised in a save/load context until now.

### Implementation Details
See decision_log D-018 for the six judgment calls: the project.json
envelope shape (`schemaVersion` hoisted to the top level rather than
duplicated inside `project`, `selection` excluded entirely); the retroactive
`SCHEMA_VERSION` bump and why it's being treated as fixing a real gap now
rather than silently left inconsistent; the Source relink matching strategy
(fileName + pageIndex + dimensions, contentHash as the authoritative
signal when both sides have one — and REJECTING a match when both hashes
are present but differ, even if everything else coincidentally matches);
Template application semantics (wholesale replacement, matching Auto
Fill's precedent, since plan.md gives no rule for what a "merge" would even
mean); and why loading a project resets Undo/Redo history via a new
`store.resetWithState()` rather than going through `commit()` as an
ordinary reducer (a project load is a context switch, not an edit derived
from whatever was open before).

Because Source binaries are never embedded in the project file (§17.1,
"避免檔案過大"), every project load requires the user to re-select every
original PDF/image — this is the intended design, not a missing feature.
`relinkSources()` is what makes that re-selection actually reattach to the
right Slots afterward: it keeps each SAVED Source's original `id` (so
existing `Slot.sourceId` references keep resolving) and only swaps in the
freshly re-loaded bytes' `docId`.

### Impact Analysis
Phase 10 (advanced Print Aids / second-stage features) can now assume
Projects persist correctly — any new Project-level setting it adds must
come with a `SCHEMA_VERSION` bump and a migration step this time, per the
gap D-018 just fixed. The built-in Template Library (§17.3 [S]) remains
unimplemented — Phase 9 only covers the [M] user-saved-Template core.

### Verification Result
PASS — two layers:
1. `npm test`: 437/437 passing (34 new: 403 -> 437).
2. Browser verification (`node scripts/dev-server.mjs` + Playwright against
   `http://localhost:5173/dev/project.html`, console clean): built a
   project with 4 sources (3 PDF pages + 1 image) via Auto Fill plus one
   manual edit, saved it as a Template, then serialized the whole project;
   loading that JSON back (simulating a fresh session with a brand-new
   SourceBinaryStore/engine) correctly prompted for the 4 missing source
   files; re-selecting the SAME original files relinked all 4 by
   content-hash, the reloaded Pages/Templates matched exactly what was
   saved (Slot.sourceId references stayed valid), and the relinked
   content actually re-rendered in the Preview (not just a metadata match);
   history was fully reset after load (`canUndo`/`canRedo` both false), and
   a fresh edit made after the load could be undone/redone normally;
   applying the saved Template correctly cleared the page's content; and a
   hand-constructed v1-shaped project JSON correctly migrated to
   schemaVersion 2 with `cropMarks` defaults filled in.

## 2026-08-06 | Docs | Rotated 2 entries (2026-08-06 03:15 rotation-record and 03:15 Phase 9 Project System) to docs/logs/change_log_2026.md | wc -l verified (335 lines active after rotation)

## 2026-08-06 | Docs | Rotated 1 entry (2026-08-05 20:15, Phase 3 Layout Engine) to docs/logs/change_log_2026.md | wc -l verified (675 lines active after rotation)

## 2026-08-06 | Docs | Rotated 3 entries (2026-08-05 21:40 Phase 4, plus 2 interleaved rotation-record lines) to docs/logs/change_log_2026.md | wc -l verified (470 lines active after rotation, before this Phase 10 entry)

## 2026-08-06 | Docs | Rotated 3 entries (oldest retained rotation-record lines) to docs/logs/change_log_2026.md | wc -l verified (419 lines active after rotation, exceeds 400 because the 10-entry retention floor takes precedence — see docs/log_rotation.md precedent)

## 2026-08-06 10:00

### Type
Feature

### Summary
完成 Phase 10(plan.md §16/§17.3/§9.6/§18.3/§5.2 SVG):Bleed、Safe Area、
Header/Footer、Page Number、Text Box、浮水印(文字/圖片)、SVG Source、
Align & Distribute、鍵盤快捷鍵 resolver、內建 Template Library。這是繼
Phase -1~9(先前於 GitHub 分支 `claude/phase-5-handling-wi8vcd` 完成)之後
的下一階段——工作在該分支上直接延續(見 project_status.md「Current
Version」的分支說明)。543 個單元測試通過(較本分支 Phase 9 完成時的
437 個新增 106 個,含先前因本機未 `scripts/fetch-vendor.sh` 而略過的 9 個
real-pdf-lib 測試,本次一併 fetch vendor 並讓它們真正跑通)+ 瀏覽器實測
(`dev/print-aids.html`)全數驗證通過。

### Files Changed
- src/model.js — Bleed/SafeArea/HeaderFooter/PageNumber/Watermark 設定
  factory、TextBox factory、SCHEMA_VERSION 2→3、Page 新增 textBoxes、
  Template 新增 textBoxes
- src/print-aids.js(新增)+ print-aids.test.js — §16 純幾何(Bleed/Safe
  Area 矩形、Header/Footer/Page Number 定位、Watermark 矩陣、文字對齊)
- src/text-elements.js(新增)+ text-elements.test.js — Text Box CRUD
  純函式(move/resize/content/delete/duplicate/z-order)
- src/reducers.js/.test.js — Phase 10 設定 action + Text Box action +
  Align/Distribute action
- src/preview.js — Bleed/Safe Area 引導線、Header/Footer/Page Number/
  Text Box/Watermark 的 DOM 算繪
- src/export.js/.test.js、src/export-real-pdf-lib.test.js — 低階 pdf-lib
  operator 算繪(Bleed clip 擴張、Header/Footer/Page Number 高階
  drawText、Text Box/Watermark 低階旋轉矩陣 + ExtGState 透明度、Watermark
  圖片 XObject)
- src/sources.js/.test.js、src/render-adapters.js — SVG Source(
  parseSvgIntrinsicSize、computeSvgRasterSize、loadSvgFile、瀏覽器端
  rasterizeSvg 系列)
- src/free-layout.js/.test.js — Align(左右上下/水平垂直置中)、Match
  Size(等寬/等高/等尺寸)、Distribute(水平/垂直平均分布)
- src/keymap.js(新增)+ keymap.test.js — §18.3 鍵盤快捷鍵 resolveShortcut
  + nudgeDelta
- src/template-library.js(新增)+ template-library.test.js — §17.3 內建
  Template Library(4 個範例)
- src/pages.js/.test.js、src/project-file.js/.test.js — duplicatePage/
  applyTemplateToPage 補上 textBoxes;schemaVersion v2→v3 migration
- dev/print-aids.html(新增)— Phase 10 dev harness,非產品 UI
- scripts/fetch-vendor.sh 的產出(vendor/pdf-lib/pdf-lib.esm.js、
  vendor/pdfjs/*)本機補 fetch,讓 9 個原本略過的 real-pdf-lib 測試恢復執行
- docs/decision_log.md — 新增 D-019
- docs/change_log.md — 本次 rotation(207 行移至 docs/logs/change_log_2026.md)
- docs/project_status.md — TL;DR、Completed/In Development/Known Issues/
  Technical Architecture/Data Structure 更新

### Reason
使用者要求「繼續執行 phase 10」。發現本機 checkout 原本停留在 master
分支(僅 Phase 0-1),而 Phase 1-9 實際已在 GitHub 遠端分支
`claude/phase-5-handling-wi8vcd` 完成但未合併——與使用者確認後,改為在該
分支上繼續(而非在落後的 master 上重做)。Phase 10 是 plan.md §22 排序中
Standalone Build(Phase 11)之前的最後一個功能階段。

### Implementation Details
見 decision_log D-019 的完整記錄(8 組判斷:Bleed 只擴張 clip 邊界不連動
內容縮放、Safe Area 純 Preview 引導線、Watermark 僅置中且旋轉矩陣沿用
Slot 內容的「Y-down model space 組矩陣 + pdfPageFlipMatrix 疊加」既有
手法而非 pdf-lib 高階 API 的 `rotate:` 選項、Text Box 獨立於 Source/Slot
系統之外、文字先只支援 ASCII(使用者本次對話明確決定,不加 fontkit)、
SVG 光柵化採固定 4 倍放大, 上限 3000px 長邊、Align/Distribute 採
bounding-box 對齊與等間距邊緣分布、Template Library 全部透過既有 §9
Layout Engine 純函式產生)。

Watermark/Text Box 的旋轉矩陣正確性(Preview CSS 旋轉方向與 Export PDF
旋轉方向視覺一致)透過 export-real-pdf-lib.test.js 對真實 pdf-lib 輸出的
`cm` 矩陣做迴歸測試驗證(90° 旋轉時 b 分量 ≈ ±1),而非僅憑手動推導。

### Impact Analysis
Phase 10 完成後,plan.md §22 僅剩 Phase 11(Standalone Build,單檔離線
esbuild 正式打包)。§16 的 Bleed/Watermark/Text Box 均為 Project 層級新
欄位,任何後續讀寫 `AppState.project`/`Page` 的程式碼都應透過本次新增的
reducer(而非直接 mutate),沿用 Phase 4 以來的單一 mutation 入口慣例。
SVG 光柵化與 WEBP 轉碼共用「embedSource 依 source.kind 分派、
embeddedBySourceId 跨 Slot 去重」的既有架構,未來若要新增其他 Source
kind(例如色塊/文字頁),應延續同一分派模式。

### Verification Result
PASS — 兩層驗證:
1. `npm test`:543/543 通過(較 437 新增 106 個;0 skipped,含 fetch
   vendor 後恢復執行的 9 個 real-pdf-lib 測試)。
2. 瀏覽器實測(`node scripts/dev-server.mjs`,開啟
   `http://localhost:5173/dev/print-aids.html`,console 無錯誤):Bleed/
   Safe Area 引導線的實際 px 座標與手算期望值精確吻合(過程中發現並修正
   一個真實 bug——`computeSlotPx()` 回傳 `{width,height}` 而
   `computeBleedExpandedRect`/`computeSafeAreaRect` 預期 `{w,h}`,原本會
   靜默產生 `NaN` 座標);Header/Footer/Page Number/Text Box/Watermark
   文字皆正確顯示於畫面;匯出的 PDF 經 pdf-lib 重新載入確認結構正確
   (ExtGState/ca 透明度值、Font 資源、re/gs/Do/Tj operator 皆存在);
   SVG Source 端到端(載入→縮圖→匯出光柵化為 PNG XObject)全流程驗證
   通過。pdf.js 重新渲染步驟(`page.render()`)在本次瀏覽器自動化環境中
   卡住未完成——但確認同一個卡住行為在既有、Phase 8 已驗收過的
   `dev/print.html` 也會發生,判定為本次自動化環境限制而非本次改動
   引入的問題,不影響上述其他驗證管道的結論。

## 2026-08-06 | Docs | Rotated 2 entries (2026-08-06 rotation-record and 10:00 Phase 10 entry) to docs/logs/change_log_2026.md | wc -l verified (441 lines active after rotation, exceeds 400 because the 10-entry retention floor takes precedence)

## 2026-08-06 | Docs | Rotated 1 entry (oldest retained rotation-record) to docs/logs/change_log_2026.md | wc -l verified (538 lines active after rotation, exceeds 400 because the 10-entry retention floor takes precedence)

## 2026-08-06 | Docs | Rotated 2 entries (2026-08-05 23:15 Phase 5 gap-fill, plus 1 interleaved rotation-record line) to docs/logs/change_log_2026.md | wc -l verified (504 lines active after rotation, exactly the 10-entry retention floor — see docs/log_rotation.md, this is expected to exceed 400 lines when recent entries are individually long)

## 2026-08-06 | Docs | Rotated 1 entries (oldest retained history) to docs/logs/change_log_2026.md | byte slices preserved; newest 10 entries retained

## 2026-08-06 | Docs | Rotated 3 entries (oldest retained rotation-record lines) to docs/logs/change_log_2026.md | wc -l verified (653 lines active after rotation, exceeds 400 because the 10-entry retention floor takes precedence)

## 2026-08-06 10:36

### Type
Feature

### Summary
Phase 11 Standalone Build:以 esbuild 0.25.9 將 Phase 10 UI、pdf.js、pdf-lib
打包成單一 IIFE `index.html`，並將 pdf.js worker 以 Blob URL 內嵌。

### Files Changed
- scripts/build.mjs、package.json：新增可重現的 `npm run build` pipeline。
- index.html：產出 2,874,334 bytes 的正式單檔 HTML。
- docs/project_status.md、docs/change_log.md：同步 Phase 11 完成狀態與驗證紀錄。

### Reason
Phase 0–10 已完成，依 `docs/plan.md` §22 執行最後的 Standalone Build。

### Implementation Details
Build 從既有 `dev/print-aids.html` 的完整 UI entry 擷取模組，改寫為本機相對 import，
esbuild 輸出 browser IIFE；worker source 直接序列化進 bundle，避免 `file://` 外部載入。

### Impact Analysis
正式產物不再需要 dev server、ESM、CDN 或獨立 worker 檔案；vendor 仍是 gitignored 的
build input。後續發布前仍需在 Chrome / Edge 實機執行 `file://` 回歸。

### Verification Result
PASS：`npm run build` 成功，重複 build SHA-256 均為
`8F412601766B7AD35173C687D4AF0A27057FF41A381BABEBCD749EB024E55E1B`。
PASS：`npm test` 543/543；單檔、無 ESM import、無外部資源 URL、Blob worker 靜態檢查通過。

## 2026-08-06 | Docs | Rotated 2 entries (rotation-record and Phase 11 Standalone Build entry) to docs/logs/change_log_2026.md | wc -l verified (708 lines active after rotation, exceeds 400 because the 10-entry retention floor takes precedence)

## 2026-08-06 | Docs | Rotated 2 entries (oldest retained history) to docs/logs/change_log_2026.md | byte slices preserved; newest 10 entries retained

## 2026-08-06 | Docs | Rotated 2 entries (oldest retained rotation-record lines) to docs/logs/change_log_2026.md | wc -l verified (781 lines active after rotation, exceeds 400 because the 10-entry retention floor takes precedence)

## 2026-08-06 11:30

### Type
Docs(修正計畫)

### Summary
缺口盤點後建立 `docs/remediation_plan.md`:12 項缺口(G-01~G-12)、
7 個工作包(R-1~R-7),核心是補上從未排入 Phase 的 §18 產品 UI
(Phase 11 打包的 index.html 實為 Phase 10 dev harness)。

### Files Changed
- docs/remediation_plan.md(新增)— 缺口總表、工作包、順序、決策點
- docs/project_status.md — Planned Features 改指向修正計畫
- README.md 未動(其更新屬 R-3 工作包)

### Reason
使用者要求盤點版面/操作/功能遺漏並寫成修正計畫。盤點方法:
project_status + plan §10/§16/§18/§19/§22/§25 對照原始碼與
瀏覽器實開打包後的 index.html。

### Implementation Details
關鍵佐證:§18.1/§18.2 [M] 無對應 Phase;src/keymap.js 無任何
addEventListener 呼叫端;dev/print-aids.html accept 無 .svg 且
handleFiles 不呼叫 loadSvgFile;§19.4/§10.4 [S] 無實作。

### Impact Analysis
計畫本身不改任何程式碼與規格;R-1(plan.md §22 增補 Phase 12)
為規格變更,依 AGENTS.md 須使用者核可後才執行,決策點見計畫 §5。

### Verification Result
N/A(純文件)。npm test 未跑 —— 無程式碼變更;缺口清單中的
程式事實均以 grep/檔案內容/瀏覽器實測(localhost:5173)確認。

## 2026-08-06 | Docs | Rotated 2 entries (rotation-record and 11:30 remediation-plan entry) to docs/logs/change_log_2026.md | wc -l verified (803 lines active after rotation, exceeds 400 because the 10-entry retention floor takes precedence)

## 2026-08-06 12:00

### Type
Docs(規格增補)

### Summary
使用者核可 `docs/remediation_plan.md`(含 §5 五個決策點:全繁中 UI、
Ctrl+C/V 為頁內複製貼上、index.html 由新產品 UI 取代、v1.0.0 版號
起點)。依 R-1 執行:`docs/plan.md` §22 新增 Phase 12(Product UI,
6 步)、§22.1 總覽補上流程、新增 §23.9 驗收條件(9 條);
`docs/decision_log.md` 新增 D-020 記錄根因與五個決策點。

### Files Changed
- docs/plan.md — §22 新增 Phase 12 條目(於 Phase 11 之後)、Phase 11
  條目補澄清段落(說明其 index.html 打包入口實為 dev harness)、§22.1
  總覽、新增 §23.9(9 條可量測驗收)。
- docs/decision_log.md — 新增 D-020。

### Reason
`docs/remediation_plan.md` R-1 工作包:規格變更(新增 Phase)須先經
使用者核可(AGENTS.md「與 spec 衝突/scope 變動須先問」規則),使用者
已於對話中以「依照建議處理」核可全部 5 點,故執行本次增補。

### Implementation Details
Phase 12 排序緊接 Phase 11 之後,不插入既有 Phase 0–11 之間(不打亂
已完成階段的歷史記錄)。§23.9 的 9 條驗收條件對應
`docs/remediation_plan.md` §2 的 G-01~G-12 缺口,以「build 產物
`index.html`、不依賴 dev/*.html」為判準基準,避免日後又以 dev harness
充當驗收對象。

### Impact Analysis
`docs/project_status.md` 的 Planned Features 已於前一則條目指向
remediation_plan.md,本次不再重複更新;待 Phase 12 六步逐一完成後,
再依 solo-large 慣例於 Completed Features 新增 Phase 12 條目。後續
R-2~R-7 工作包的執行不再需要額外核可(已被本次核可涵蓋),但每個工作包
完成仍需個別 change_log 條目與驗證記錄。

### Verification Result
N/A(純文件)。npm test 未跑——無程式碼變更。plan.md/decision_log.md
變更內容已交叉核對 remediation_plan.md 原文,用詞與工作包編號一致。

