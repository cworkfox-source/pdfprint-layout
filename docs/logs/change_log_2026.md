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

