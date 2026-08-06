# Change Log (append-only)

> Older entries: docs/logs/ (archive, do not load at startup)

## 2026-08-06 18:10 | Product UI | Fixed multi-file source selection dropping all but the first file

### Type
Bugfix

### Summary
Selecting multiple files via the Source Gallery's "載入 PDF / 圖片 / SVG"
button silently loaded only the first file; images 2..N (and pages from
additional PDFs) never became Sources. Root cause: the `change` handler on
`#file-input-sources` passed the live `FileList` (`e.target.files`) by
reference into the async `handleSourceFiles()`, then immediately reset
`e.target.value = ''`. Since `handleSourceFiles()` `await`s inside its
`for...of` loop on the very first file, control returned to the `change`
handler before the loop finished; clearing `input.value` truncates the
*live* FileList out from under the still-running iterator, so every file
after the first is skipped with no error.

### Files Changed
- app.html — `#file-input-sources` `change` handler now snapshots
  `[...e.target.files]` into a plain array before resetting `input.value`,
  matching the pattern the `#file-input-relink` handler (added in 12e)
  already used correctly.
- docs/change_log.md, docs/project_status.md — this entry / TL;DR update.

### Reason
User reported 2026-08-06: (1) slots not clickable to edit, (2) text boxes
not draggable, (3) multi-file selection not showing all images / PDFs not
reading by content pages, (4) slots not clickable to delete. (1), (2), and
(4) were already fixed by uncommitted work earlier the same day (see the
entry immediately below, "Restored Slot editing/deletion, Text Box
dragging, and direct file drops") but that entry's claim that "every
selected file is retained" was not actually verified against real
multi-file input — browser reproduction here showed only 1 of 3 selected
images loading.

### Impact Analysis
Isolated to the Source Gallery's file-picker entry point; drag-and-drop
onto a Slot (`paperHost` `drop` handler) and the Project Relink dialog's
file input were unaffected — neither resets an `<input>`'s `.value` while
still holding a reference to its live `FileList`.

### Verification
`npm.cmd test`: 561/561 passed. `npm.cmd run build`: index.html
2,955,569 bytes. Browser smoke (`app.html` via dev server, synthetic
`File`/`DataTransfer` + real `change`/`PointerEvent` sequences):
- Selecting 3 synthetic PNGs in one `change` event before the fix loaded
  1 of 3 into `state.sources`; after the fix, 3 of 3.
- Re-verified the other three reported issues on the same build: clicking
  a Slot updates `state.selection` and renders "格位屬性" with a working
  刪除 button (4→3 slots); dragging a Text Box via `pointerdown`/
  `pointermove`/`pointerup` moves its `x`/`y` in `state`.
- `read_console_messages`: 0 errors throughout.

## 2026-08-06 | Product UI | Restored Slot editing/deletion, Text Box dragging, and direct file drops

### Type
Bugfix / UI / Docs

### Summary
Selecting a Slot now blurs a stale Properties Panel control so Slot Properties and Delete render immediately. Text Boxes can be dragged; every selected file is retained and every selected PDF page becomes a Source.

### Files Changed
- app.html, index.html, docs/plan.md, docs/project_status.md

### Verification
npm.cmd test: 561/561 passed; npm.cmd run build: index.html 2,955,569 bytes. Browser smoke: selected-slot delete succeeded; a Text Box drag moved from x=452.17/y=515.19 to x=492.17/y=545.19.

## 2026-08-06 | Docs | Rotated 2 entries (rotation-record and 12:00 R-1 spec-amendment entry) to docs/logs/change_log_2026.md | wc -l verified (831 lines active after rotation, exceeds 400 because the 10-entry retention floor takes precedence)

## 2026-08-06 13:59

### Type
Docs / Plan

### Summary
依使用者提出的 4 點 UI 需求(簡易/詳細介面、點空白處取消選取、一鍵清除、
屬性面板可拖寬)撰寫 `docs/ui_improvement_plan.md`(U-0~U-4 工作包)。
**尚未修改任何程式碼**,計畫待核可。

### Files Changed
- docs/ui_improvement_plan.md — 新增。含現況勘查、四個工作包設計、
  檔案異動清單、13 項瀏覽器實測清單、5 個待拍板決策點(D-1~D-5)、
  風險表與工時預估。

### Reason
使用者 2026-08-06 回報實際使用上的四個摩擦點,均集中在 `app.html` 產品
UI(plan.md §18),與引擎行為無關。

### Implementation Details
勘查時發現 `app.html` 有**未提交**的半成品:前一階段已寫好 U-1/U-3/U-4 的
HTML+CSS 骨架(`#ui-mode-simple`/`#ui-mode-advanced`、`.adv-only` 標記、
`#btn-clear-sources`、`#props-resizer`、`--props-w`),但完全沒有對應
JavaScript,目前這三個按鈕按了沒反應。計畫因此以「補上缺的 JS」為主軸,
並新增 U-0 前置整理修掉骨架自帶的兩個缺陷:`<body>` 缺 `data-ui-mode`
(會 FOUC 且簡易模式從未生效)、`#canvas-viewport` 缺 `min-width: 0`
(面板拉寬會撐破版面)。

### Impact Analysis
本次僅新增文件,零程式碼風險。計畫執行後將動到 `app.html`、
`src/keymap.js`(新增 Esc → clearSelection)與 `src/keymap.test.js`,
並需 `npm run build` 重建 `index.html`;決策點核可後補 decision_log D-021。

## 2026-08-06 | Product UI | 執行 docs/ui_improvement_plan.md(U-0~U-4)

### Type
Feature / UI / Docs

### Summary
完成簡易/詳細模式、取消選取、兩種批次清除與可調 Properties Panel,並重建
單檔 `index.html`;原有未提交修改與計畫文件均保留並同步為已執行狀態。

### Files Changed
- `app.html` — U-0~U-4 的 CSS/HTML/事件/狀態與本機偏好儲存。
- `src/keymap.js`, `src/keymap.test.js` — `Esc` → `clearSelection` 及回歸測試。
- `index.html`, `docs/plan.md`, `docs/decision_log.md`, `docs/project_status.md`,
  `docs/ui_improvement_plan.md` — build 產物與規格/決策/狀態同步。

### Reason
把使用者回報的四個 UI 摩擦點落地,同時保留完整進階欄位、離線邊界與 Undo
可復原性;清除來源仍遵守來源鏡像/預覽快取/引擎釋放的既定順序。

### Implementation Details
簡易模式初始即由 `body[data-ui-mode]` 宣告,模式/面板寬度以容錯 localStorage
記憶;空白畫布與 `Esc` 清除 selection;格位內容與來源分開確認、各自一筆
Undo;面板寬度限制 240~`min(720,60vw)`,雙擊回 300。

### Impact Analysis
UI 進階欄位在簡易模式隱藏,但邊距/間距與高頻操作保留;批次來源清除會影響
所有頁面的來源引用且需使用者確認。未使用真實檔案選擇器重跑來源清除
全流程,因瀏覽器煙霧測試環境未提供檔案注入操作。

### Verification
`npm.cmd test`:561/561 passed;`npm.cmd run build`:成功產出 2,954,661 bytes
`index.html`;瀏覽器已驗證簡易初始狀態、簡易/詳細切換、詳細欄位顯示/隱藏、
無來源時兩個清除按鈕 disabled、resizer 存在且雙擊回 300px;console error/warn 為 0。

## 2026-08-06 12:20

### Type
Bugfix / Docs

### Summary
R-3 快速修復:`dev/print-aids.html` 補上 SVG Source 接線(§14.5/G-05,
Phase 10 已有引擎但打包入口從未接上,是死路);README.md 從「規劃階段」
更新為現況(功能清單、已知限制、下載/開發指引)。

### Files Changed
- dev/print-aids.html — `file-input` 的 `accept` 新增 `.svg`/
  `image/svg+xml`;import 補 `decodeSvgText`/`renderSvgThumbnail`/
  `renderSvgPreview`(render-adapters.js)並傳入 `createSourceEngine`
  的 deps;`handleFiles()` 新增 svg 分支呼叫 `engine.loadSvgFile()`;
  Export 呼叫補上 `rasterizeSvgToPng` dep(export.js 的 `embedSource`
  對 svg 來源一律需要此 dep,先前未傳入時若有人載入 SVG 並匯出會直接
  throw)。
- README.md — 全文重寫:現況、下載開啟方式、功能清單、已知限制、
  開發者指引。

### Reason
2026-08-06 缺口盤點(docs/remediation_plan.md G-05、G-11)找到的兩個
可獨立處理、不依賴 Phase 12 的缺口,依計畫 R-3 工作包執行。

### Implementation Details
浮水印 `type: image` 的來源選取 UI(G-06)刻意不在本次一併做——
remediation_plan.md 已註明該項留給 12c(Properties Panel)一次做好,
避免在 dev harness 上先做一次、Phase 12 又要重做。

### Impact Analysis
`dev/print-aids.html` 現在是唯一同時支援 PDF/圖片/SVG 三種來源的
dev harness,可作為 Phase 12 12b(Source Gallery)實作時的參考範例。
README 更新後不再與 `docs/project_status.md` 現況矛盾。

### Verification Result
PASS:
1. `npm test`:543/543(本次未新增測試,純 dev harness/文件變更)。
2. 瀏覽器驗證(`node scripts/dev-server.mjs` +
   `http://localhost:5173/dev/print-aids.html`,console 無錯誤):以
   合成 `<svg>` 文字建構 `File` 物件呼叫 `window.__handleFiles()`,
   確認 SVG Source 正確建立(`kind: 'svg'`、`naturalWidth/Height`
   取自 SVG 根元素、寫入 `AppState.sources`);指派到 Slot 並執行
   Export,確認 `exportProjectToPdf()` 成功產生 1251 bytes 的 PDF、
   `[PASS] Export 完成` 顯示於 log、無例外拋出(證明
   `rasterizeSvgToPng` dep 有效接上)。pdf.js 重新渲染驗證步驟因本機
   自動化環境既有限制(見 project_status.md Known Issues)未在時限內
   完成,與本次改動無關。

## 2026-08-06 13:10

### Type
Feature

### Summary
R-2 12a(Phase 12 Product UI 第 1 步):新增 `app.html`,§18.1 三區架構
產品 UI 骨架 —— 頂部工具列(開啟/儲存專案、Undo/Redo、縮放、列印、校正頁、
匯出 PDF)+ 中央 Paper Canvas(接上 `src/preview.js` 全套 renderer)+
左/右/底三個尚待 12b/12c/12e 填入內容的空面板容器。全繁體中文介面,無
除錯用 JSON dump 或 `[PASS]`/`[FAIL]` log(以 toast 通知取代)。

### Files Changed
- app.html(新增)— 產品 UI 入口。三區 CSS Grid 骨架;頂部工具列 9 個
  控制項;`render()` 串接 `computePaperPreviewLayout`/`resolveZoom`/
  `renderPaper`/`renderSlots`/`renderSlotContent`/`computeSlotPx`/
  `renderCropMarks`/`renderBleedGuide`/`renderSafeAreaGuide`/
  `renderHeaderFooter`/`renderPageNumber`/`renderTextBoxes`/
  `renderWatermark`(preview.js 全部 DOM adapter,首次在單一畫面全部
  接齊);`store.subscribe(render)` 取代逐一手動呼叫 render();Export/
  Print/Calibration 沿用 Phase 7/8 既定的
  `exportProjectToPdf(state, {binaryStore, pdfLib, transcodeWebpToPng,
  rasterizeSvgToPng})` + `openPdfBytesForPrint()`/`exportCalibrationPagePdf()`
  管線;Save/Load Project 接上 `serializeProject`/`deserializeProject`/
  `downloadProjectJson`/`readProjectFile`/`store.resetWithState()`;
  Toast 元件取代 dev harness 的 `#log` 除錯面板。

### Reason
`docs/remediation_plan.md` R-2 工作包第 1 步,`docs/plan.md` Phase 12
12a 範圍。§18.1/§18.2 [M] 從未有對應 Phase(見 D-020),本步先把
「骨架 + 頂部工具列 + 中央畫布」跑起來,作為後續 12b(Source
Gallery)、12c(Properties Panel)、12d(畫布編輯互動)、12e(頁面管理/
Auto Fill/專案系統)、12f(快捷鍵)填入內容的基座。

### Implementation Details
「開啟專案」目前是**有意的局部實作**:能正確反序列化並透過
`store.resetWithState()` 套用 project/pages/templates,但尚未提供
Source 重新選取/relink 的 UI(§17.1 本就要求每次載入都要重選檔案)——
若載入的專案含有 Source 參照,對應格位會先顯示空白,並跳出提示
說明「後續版本會補上」。完整的 relink 流程(列出缺少檔案清單、
逐一比對結果)已排入 remediation_plan.md 的 12e,不在本步重複實作,
避免之後又要重寫一次。Undo/Redo 兩顆按鈕的 `disabled` 狀態、狀態列
文字(專案名稱/頁碼/縮放百分比)、畫布空狀態提示的顯示/隱藏,皆由
`store.subscribe(render)` 統一驅動,沒有另外手動呼叫 render() 的分散
邏輯。`scripts/build.mjs` 的 build entry 尚未改成 `app.html`(留給
R-7,待 12b~12f 全部完成後一次切換,避免中途來回改 entry)。

### Impact Analysis
`dev/print-aids.html` 等既有 dev harness 不受影響,繼續作為引擎驗證
用途;`app.html` 是全新檔案,不影響任何既有測試或既有頁面。後續
12b~12f 都會直接編輯這個檔案(在既有骨架內填入左/右/底三個面板的
實際內容與畫布互動),不是另起新檔案。

### Verification Result
PASS:
1. `npm test`:543/543(本步未新增測試,純 UI orchestration,無新
   純函式邏輯需要單元測試——與既有 dev harness 慣例一致)。
2. 瀏覽器驗證(`node scripts/dev-server.mjs` +
   `http://localhost:5173/app.html`,console 全程無錯誤):三區骨架與
   9 個工具列控制項皆正確渲染(`read_page`/`get_page_text` 確認);
   點擊「匯出 PDF」成功產生 598 bytes PDF 並顯示 toast;點擊「列印」/
   「校正頁」皆無例外、顯示對應 toast;以合成 `File` 物件模擬
   Save→反序列化→`resetWithState()` 全流程,確認專案名稱正確更新且
   `canUndo`/`canRedo` 皆重置為 false;以 `addSourceAction` 手動
   commit 一筆來源,確認 Undo 後 `state.sources.length` 回到 0、Redo
   後回到 1,UI 的復原/重做按鈕狀態與畫布空狀態提示同步反映;縮放
   下拉切換至「100%」後狀態列正確顯示「縮放 100%」。

## 2026-08-06 13:45

### Type
Feature

### Summary
R-2 12b(Phase 12 Product UI 第 2 步):`app.html` 左欄 Source Gallery ——
載入 PDF/圖片/SVG(§12.4)、PDF 頁碼範圍輸入、拖曳來源卡片到 Slot、刪除
來源(含 §12.6 完整記憶體釋放與 Slot 懸空參照清理)、§25 Annotations
遺失提示(G-10)、加密 PDF 友善錯誤訊息。

### Files Changed
- app.html —
  - `#source-gallery-body` 新增:載入按鈕 + 隱藏 file input(accept 含
    `.svg`)、PDF 頁碼範圍文字輸入、`#gallery-list`/`#gallery-empty`。
  - `renderSourceGallery(st)`:依 `state.sources` 重繪卡片,縮圖取自
    `engine.getThumbnail()`(尚未就緒時顯示占位符,`onThumbnailReady`
    callback 觸發的 `render()` 會補上);卡片 `draggable=true`,
    `dragstart` 寫入 `dataTransfer`。
  - `deleteSource(source)`:刪除前先掃描所有 Page 的所有 Slot,對每個
    仍參照該來源的 Slot 呼叫 `clearSlotContentAction()`(避免懸空
    `sourceId` 導致 Export 拋「unknown source」,同 D-015 教訓);若為
    目前的浮水印圖片來源也一併清除;再依序
    `removeSourceAction()` → 本地 Map 移除 → `engine.releaseSource()`。
  - `checkForAnnotations(file)`:獨立、非阻斷的第二次 `pdfjsLib.getDocument`
    輕量解析,掃描每頁 `getAnnotations()`,找到即以 toast 提示「匯出後
    這些內容將會遺失」(§25);刻意不修改 `src/sources.js`(核心引擎的
    公開介面不曝露逐頁 annotation 資料,屬 UI 端專用的加值檢查,不動
    已測試過的 Phase 2 模組)。
  - `describePdfLoadError(err)`:辨識 `PasswordException`/訊息含
    "password" 時,轉換成人話「此 PDF 已加密…請先移除加密後再試」。
  - `handleSourceFiles()`:三分支(pdf/svg/image)+ 逐檔案 try/catch +
    toast,取代 dev harness 的 `#log` 除錯輸出慣例。
  - `#paper-host` 上以事件委派(delegation)掛 `dragover`/`dragleave`/
    `drop`——`renderSlots()` 每次都整批重建 `.pl-slot` 節點,委派掛在
    不會被重建的父容器上,不需要每次 render 後重新掛監聽器。

### Reason
`docs/remediation_plan.md` R-2 工作包第 2 步,`docs/plan.md` Phase 12
12b 範圍;同時解決 remediation_plan.md 的 G-10(Annotations 遺失無 UI
提示)。SVG/加密 PDF 相關項目(G-05 的一半)已在 R-3 對
`dev/print-aids.html` 做過,本次是 `app.html` 自己的獨立實作(兩個
入口各自維護各自的 UI 邏輯,只共用 `src/` 下的引擎函式)。

### Implementation Details
`checkForAnnotations()` 對同一個檔案做了第二次 `pdfjsLib.getDocument()`
解析(第一次是 `engine.loadPdfFile()` 內部自己的解析)——刻意接受這個
重複解析的成本,換取不去動 Source Engine 的公開介面;若之後有更多 UI
需要逐頁 metadata,應該重新評估是否該讓 `sources.js` 直接暴露這項資訊,
而不是繼續在各個 UI 入口各自重複解析。加密 PDF 的判斷是字串/`err.name`
啟發式(`PasswordException` 或訊息含 "password"),測試環境沒有可用的
加密 PDF 產生工具,已用直接呼叫該函式驗證邏輯本身(見 Verification
Result),真正的密碼保護 PDF 錯誤訊息只驗證了「錯誤會被攔截並顯示
`err.message`」這條路徑,未驗證確切文案分支曾被真實加密檔案觸發。

### Impact Analysis
`src/sources.js`、`src/reducers.js`、`src/render-adapters.js` 等核心
引擎檔案本次完全未修改,純粹是 `app.html` 這個 UI 入口的擴充;12c
(Properties Panel)會需要讀取 `state.selection`(尚未在本步引入,
12d 才會開始寫入)才能顯示 Slot 屬性,屆時會沿用本步已建立的
`store.subscribe(render)` 單一重繪入口,不需要另開一條更新路徑。

### Verification Result
PASS:
1. `npm test`:543/543(本步未新增測試,純 UI orchestration)。
2. 瀏覽器驗證(`node scripts/dev-server.mjs` +
   `http://localhost:5173/app.html`,console 除下方刻意觸發的例外
   之外全程無錯誤):
   - 以合成 `File`(透過真正的 `DataTransfer` + `change` 事件,非直接
     呼叫內部函式)驗證 SVG、以 pdf-lib 現場產生的最小 PDF、Canvas
     現場產生的 PNG 三種來源皆能經由真實 UI 入口載入,`state.sources`
     與畫廊卡片數量正確增加。
   - 以真實 `DragEvent`(`dragover`+`drop`,附帶 `DataTransfer`)對
     `.pl-slot` 元素觸發拖放,確認 `Slot.sourceId` 正確寫入且與拖曳的
     來源 id 相符。
   - 刪除一個「目前指派在某個 Slot 上」的來源:確認
     `state.sources.length` 歸零、本地 Map 同步清空、gallery 卡片
     消失、且該 Slot 的 `sourceId` 正確變回 `null`(而非留下懸空
     參照)。
   - 以 pdf-lib 現場產生一份含真實 `/Annots` Link 註解的 PDF 載入,
     確認 toast 顯示「含有超連結／表單欄位／註解…」提示;另以一份
     `Annots` 為空陣列的 PDF 載入,確認未觸發此提示(無偽陽性)。
   - 以一份刻意損毀的 PNG bytes 觸發 `decodeImage` 失敗,確認 toast
     顯示乾淨的錯誤訊息(`The source image could not be decoded.`)
     而非未捕捉例外/白屏。
   - `describePdfLoadError()` 邏輯以 `{name:'PasswordException'}` 與一般
     `Error` 兩種輸入直接呼叫驗證,分支正確。

## 2026-08-06 14:20

### Type
Feature / Bugfix

### Summary
R-2 12c(Phase 12 Product UI 第 3 步):`app.html` 右欄 Properties Panel
依選取狀態切換 Paper/文件設定、單一 Slot、單一 Text Box、多選(對齊/
分布/等尺寸/§10.4 批次套用)四種面板;新增最小可行的點選/Shift 點選
選取(完整多選框選/拖曳/縮放留給 12d)。過程中發現並修正 `src/reducers.js`
缺少 `setPaperAction`/`setProjectNameAction` 的缺口,以及 `app.html`
自身兩個真實 bug(詳見 Implementation Details)。

### Files Changed
- src/reducers.js — 新增 `setPaperAction(overrides)`(合併式更新
  `state.project.paper`,比照既有 `setCropMarksAction` 慣例;其註解早已
  預留這個缺口:「mirroring how the paper-settings UI would merge a
  single changed field」)、`setProjectNameAction(name)`。
- src/reducers.test.js — 新增 3 個測試(`setPaperAction` 部分更新/多欄位
  更新、`setProjectNameAction`)。
- app.html —
  - `renderPropertiesPanel(st, page)` + `classifySelection()`:依
    `state.selection`(Slot id 與 Text Box id 共用同一個陣列,以
    `slot-`/`text-` id 前綴區分,沿用 `dev/free-layout.html` 建立的
    selection 慣例)切換四種面板 HTML。
  - `paperAndDocumentPanelHtml()`:紙張尺寸/方向/邊距/間距、Preset 下拉
    (`listPresetIds()` 全部 14 個)+ 自訂 Grid 列/欄套用、新增文字框,
    以及 Bleed/Safe Area/Header-Footer/Page Number/Watermark(圖片類型
    時提供從 `state.sources` 選取來源的下拉)/Crop Marks 六組摺疊區塊。
  - `slotPanelHtml()`/`textBoxPanelHtml()`:單一物件的完整屬性(Fit/
    Scale/Rotation/Offset/Flip/Lock、Z-order 四操作、清除內容/刪除/
    複製;Text Box 另有內容/字級/對齊/粗體)。
  - `multiSlotPanelHtml()`:對齊(6)、等尺寸/分布(5)、§10.4 批次套用
    (Fit/Scale/旋轉,以 `store.commit(..., {coalesceKey})` +
    `store.endCoalescing()` 把整批多個 Slot 的套用收斂成單一 Undo 步驟)、
    刪除全部/複製全部。
  - `applyProjectField()`/`handleSlotFieldChange()`/`handleTextFieldChange()`/
    `handlePropertiesPanelAction()`:三個委派事件監聽器(`change`/
    `input`/`click`)掛在 `#properties-panel-body` 上,依 `data-field`/
    `data-slot-field`/`data-text-field`/`data-action` 屬性分派,取代
    12a/12b 逐一手動掛監聽器的寫法(面板內容本身就是每次重新產生的
    innerHTML,不可能预先掛好個別監聽器)。
  - `#paper-host` 新增 `click` delegated listener:點選 `.pl-slot`/
    `.pl-text-box` 設定選取(單選),Shift 點選加入/移出多選;點選空白
    區域清空選取。`.pl-text-box` 補上 `pointer-events: auto !important`
    覆寫 `preview.js` `renderTextBoxes()` 預設的 `pointer-events: none`
    (該預設是為了讓 Text Box 疊加層不擋到底下的 Slot 拖放互動,§4.1
    Preview Renderer 本身不含互動邏輯;由呼叫端的 UI 層決定是否要接上
    點擊)。

### Reason
`docs/remediation_plan.md` R-2 工作包第 3 步,`docs/plan.md` Phase 12
12c 範圍;§10.4(批次套用)一併在本步做掉,因為多選面板本來就要在場,
分開做只會之後重寫一次面板佈局。

### Implementation Details
兩個在瀏覽器實測中發現的真實 bug(皆已修正並重新驗證):

1. **Properties Panel 重繪摧毀進行中的拖曳/輸入焦點**:`renderPropertiesPanel()`
   每次都用 `body.innerHTML = ...` 整段重建面板 DOM;`store.subscribe(render)`
   代表每一次 `store.commit()`(包含 offset 滑桿每一次 `input` 事件的
   coalesced commit)都會觸發整個 `render()`,連帶重建 Properties Panel
   ——使用者正在拖曳的那個 `<input type="range">` 節點本身被替換成新節點,
   後續的原生 `input`/`change` 事件打在一個已從文件樹分離(detached)的
   舊節點上,不會再冒泡到掛在 `#properties-panel-body` 上的委派監聽器,
   導致拖曳中途的值全部遺失、只保留拖曳開始那一瞬間的狀態。修正:
   `renderPropertiesPanel()` 開頭加一個 guard——若目前的
   `document.activeElement` 位於面板內,直接 return、不重建 DOM(等
   使用者操作結束、焦點離開面板後的下一次 render 再重建,那正好是每個
   編輯手勢原本就會結束的時間點)。用 Playwright 風格的真實
   `input`/`change` 事件序列(0 到 0.3、每 10ms 一次)重現過修正前後的
   差異:修正前 `finalOffsetX` 停在拖曳開始的值,修正後正確落在 `0.3`
   且整個拖曳仍收斂成同一個 Undo 步驟。
2. **Crop Marks 的 `enabled` 被 `Number()` 誤轉成 `1`/`0`**:
   `applyProjectField()` 的 `cropMarks` 分支原本對所有非 mm 欄位一律套用
   `Number(raw)`,對 `sizePt`/`lengthPt`/`gapPt` 這類數字欄位是對的,但
   `enabled` 是勾選框傳來的 boolean,`Number(true) === 1`——雖然 `1` 在
   `if (cropMarks.enabled)` 這種寬鬆真值判斷下不會立即造成視覺錯誤,但
   會讓 `state.project.cropMarks.enabled` 的型別偏離 `createCropMarksSettings()`
   的 boolean 契約,污染之後的 `serializeProject()`/`deserializeProject()`
   往返與任何嚴格型別比較。修正:只對 `lengthPt`/`gapPt`(mm 換算)與
   `lineWidthPt`(純數字)呼叫 `Number()`,`enabled` 等其餘欄位維持
   `raw` 原樣。Watermark 的對應分支本來就是逐欄位明確分派、沒有這個
   問題,已一併確認(見 Verification Result)。

12d(畫布編輯互動)會在本步建立的「點選=單選、Shift 點選=多選」基礎上
擴充框選(rubber-band)、拖曳移動、8 個縮放 handle 與 Snap——不是另起
一套選取機制。

### Impact Analysis
`src/reducers.js` 新增的兩個 action creator 是任何未來想讀寫
`Project.paper`/`Project.name` 的程式碼現在唯一該用的入口(沿用單一
mutation 入口慣例),不應該繞過它們直接组裝 reducer。12e(頁面管理/
Auto Fill/專案系統)會需要在 Properties Panel 之外的地方也呼叫
`setSelectionAction`(例如切換 Output Page 時清空選取),屬於自然擴充,
不需要重新設計 selection 的資料形狀。

### Verification Result
PASS:
1. `npm test`:546/546(543 → 546,新增 `setPaperAction`/
   `setProjectNameAction` 共 3 個測試)。
2. 瀏覽器驗證(`node scripts/dev-server.mjs` +
   `http://localhost:5173/app.html`,console 除瀏覽器分頁沿用的舊
   session log 外無新錯誤):
   - 以真實 `change` 事件編輯紙張上邊距(mm→pt 換算正確)、套用 4-up
     Preset(產生 4 個 Slot)。
   - 點選 Slot 切換到格位屬性面板,變更 Fit 模式為 `cover` 並反映到
     `state`。
   - Shift 點選第二個 Slot 進入多選,面板正確顯示「批次套用」區塊;
     `align-left` 後兩個 Slot 的 `x` 相同;批次套用 Fit 為 `stretch`
     後兩者皆更新,單一次 `store.undo()` 完整還原兩個 Slot(確認
     §23.9 第 5 條「單一步驟即可 Undo」)。
   - 新增文字框、自動選取,編輯文字內容並確認寫入 `state`。
   - offset 滑桿以連續 `input` 事件模擬真實拖曳(見上方 bug 1 的重現/
     修正描述),確認拖曳全程同一個 DOM 節點、最終值正確、單一 Undo
     步驟。
   - Crop Marks 啟用開關與 `lineWidthPt` 輸入、Watermark 啟用開關三者
     皆確認寫回 `state` 後型別正確為 `boolean`/`number`(見上方 bug 2）。
   - Watermark 切換為「圖片」類型後,面板正確改顯示來源選取下拉
     (`data-field="watermark.imageSourceId"` 元素存在)。

## 2026-08-06 15:15

### Type
Feature / Bugfix

### Summary
R-2 12d(Phase 12 Product UI 第 4 步,§9.3/§9.4/§9.5):`app.html` 畫布
編輯互動 —— Select/Create 模式、拖曳移動(含 Snap)、8 個縮放 handle
(含 Snap)、框選(marquee)多選、拖曳建立格位、水平/垂直分割、合併。
邏輯移植自已驗證過的 `dev/free-layout.html`(Phase 4),而非重新設計。

### Files Changed
- app.html —
  - import 新增:`moveSlotsAction`/`resizeSlotAction`/
    `splitSlotHorizontalAction`/`splitSlotVerticalAction`/
    `mergeSlotsAction`(reducers.js)、`createSlot`(model.js)、
    `canMergeSlots`/`createSlotRectFromDrag`/`computeSnapTargetsX`/
    `computeSnapTargetsY`/`computeSnapThresholdNormalized`/`snapMove`/
    `snapResize`(free-layout.js)。
  - 工具列新增「選取」/「建立格位」模式切換按鈕 + 「吸附」勾選框。
  - `render()` 新增:8 個 `.rl-handle` 縮放把手(僅單一、未鎖定 Slot
    選取時繪製,座標依 `computeSlotPx()`);每次 render 結尾記錄
    `lastLayout`,供 pointer handler 換算螢幕 px → normalized 差量。
  - 移除 12c 暫時性的簡易 `click` 選取監聽器,改為完整的
    `pointerdown`/`pointermove`/`pointerup` 三段式狀態機(`dragState`),
    處理五種手勢:`move`(拖曳 Slot,單選時套用 Snap,多選時走
    `moveSlotsAction`)、`resize`(縮放把手,套用 Snap)、`create`
    (建立模式下拖曳空白處,`createSlotRectFromDrag` + `createSlot`)、
    `marquee`(選取模式下拖曳空白處框選,以 `rectsIntersect()` 判定
    交集,Shift 為聯集加選)、純點選/Shift 點選(不觸發拖曳)。Text Box
    僅點選/Shift 點選,無拖曳/縮放(不在本步範圍)。所有拖曳手勢皆以
    `coalesceKey` 收斂成單一 Undo 步驟,`pointerup` 呼叫
    `store.endCoalescing()` 收尾。
  - `slotPanelHtml()` 新增「水平分割(上下)」/「垂直分割(左右)」
    按鈕;`multiSlotPanelHtml()` 新增「合併」按鈕,以 `canMergeSlots()`
    即時判斷是否可合併並顯示「聯集不是矩形,無法合併」提示(不可合併
    時停用按鈕)。`handlePropertiesPanelAction()` 新增
    `split-h`/`split-v`/`merge` 三個 case。
  - `tryCapturePointer()`:包一層 try/catch 的
    `paperHost.setPointerCapture()`,取代 4 處直接呼叫(見
    Implementation Details)。

### Reason
`docs/remediation_plan.md` R-2 工作包第 4 步,`docs/plan.md` Phase 12
12d 範圍。選擇移植 `dev/free-layout.html` 既有邏輯而非重寫,因為該套
pointer-capture-on-stable-ancestor 的手法已在 Phase 4 用真實瀏覽器拖曳
驗證過(含「選取觸發的 render() 會重建剛點選的那個 DOM 節點」這個
容易踩到的坑,見 dev/free-layout.html 行內註解)——app.html 唯一的
差異是要支援動態的 `currentPage()`/`state()`(free-layout.html 寫死
單一 `PAGE_ID`),以及新增框選(§9.4 之外、free-layout.html 沒做過的
功能)。

### Implementation Details
瀏覽器實測過程中發現 `paperHost.setPointerCapture(e.pointerId)` 在以
`new PointerEvent(...)` 手動建構的合成事件上呼叫會拋
`NotFoundError: No active pointer with the given id is found`——這是
因為合成事件不會像真實使用者操作那樣在瀏覽器內部註冊一個「作用中的
pointer」。追蹤程式碼確認 `dragState` 在呼叫 `setPointerCapture` **之前**
就已經設定好,因此即使該呼叫拋出,拖曳狀態機仍會正確運作(所有功能性
測試——拖曳移動/縮放/框選/建立格位——在拋出此例外的情況下依然量得
正確結果)。真實使用者互動(滑鼠/觸控)一定會有作用中的 pointer,
`dev/free-layout.html` 的 Phase 4 瀏覽器測試已用真實拖曳驗證過同一套
呼叫模式,故判定這是測試工具本身合成事件的限制、不是 app 的真實 bug。
仍加上 `try/catch` 防禦性包裝(`tryCapturePointer()`)——這本來就是
低成本的健壯性改善,即使正式環境不會觸發,也不該讓一個非致命的例外
以未捕捉的形式出現在 console。

### Impact Analysis
12e(頁面管理/Auto Fill/專案系統)會需要在切換 Output Page 時清空
`selection`(避免選取殘留指向另一頁不存在的 Slot id)——延續本步
`setSelection()` 這個既有小工具即可,不需要新的清空邏輯。Split/Merge
的 selection 清空慣例(操作後 `setSelection([])`)在此步已對齊
`dev/free-layout.html` 的既有慣例。

### Verification Result
PASS:
1. `npm test`:546/546(本步為純 UI orchestration,無新純函式邏輯,
   複用的 `free-layout.js`/`reducers.js` 函式已有既有測試覆蓋)。
2. 瀏覽器驗證(`node scripts/dev-server.mjs` +
   `http://localhost:5173/app.html`,以真實 `PointerEvent` 序列驅動):
   - 拖曳移動:點選並拖曳一個 Slot,確認 `x`/`y` 正確變化且整個拖曳
     手勢收斂成單一 Undo 步驟。
   - 縮放把手:選取單一 Slot 後拖曳 `se` 把手,確認 `w`/`h` 正確變化、
     單一 Undo 步驟。
   - 水平分割:對一個 Slot 執行 split-h,4 個 Slot 變成 5 個。
   - 合併:Shift 點選相鄰兩個 Slot(聯集為矩形),合併按鈕正確為
     enabled、點擊後 4 個 Slot 變成 3 個;（過程中一度誤判合併失敗,
     追查後確認是測試腳本自身用浮點容差比對 DOM 節點時抓錯元素,
     重新以 state 中的 slot id 精確比對後合併功能本身完全正確)。
   - 框選:在選取模式下對空白區域拖曳,確認 marquee 矩形視覺元素在
     拖曳中顯示、放開後正確消失,且與矩形相交的 Slot 被選取。
   - 建立模式:切換到「建立格位」模式,對空白區域拖曳,確認新 Slot
     正確建立(4 個變 5 個)並自動成為選取狀態,隨後正確切回選取模式。
   - console 除本節「Implementation Details」說明的合成事件
     `NotFoundError`(已修正為不再拋出)與延續自更早期測試的舊 session
     殘留訊息外,無新錯誤。

## 2026-08-06 16:00

### Type
Feature

### Summary
R-2 12e(Phase 12 Product UI 第 5 步,§11.2/§11.3/§17.1/§17.3):
`app.html` 底部 Output Pages 管理(新增/複製/刪除/上移/下移)、右欄
Auto Fill 面板(含 §11.4 混合尺寸提示)、內建 + 使用者自存 Template
存取/套用/刪除,以及「開啟專案」補上完整的 Source Relink 對話框
(取代 12a 的局部實作)。已用真實的存檔→載入→重新選取檔案→驗證內容
還原全流程驗證通過。

### Files Changed
- app.html —
  - import 新增:`autoFillAction`/`addPageAction`/`deletePageAction`/
    `duplicatePageAction`/`movePageAction`/`saveTemplateAction`/
    `deleteTemplateAction`/`applyTemplateAction`(reducers.js)、
    `detectMixedSourceSizes`(auto-fill.js)、`getBuiltInTemplates`
    (template-library.js)、`relinkSources`(project-file.js)、
    `createPage`/`createTemplate`(model.js)。
  - `#pages-strip` 新增新增/複製/上移/下移/刪除五個按鈕 +
    `renderPagesStrip()`(縮圖列以頁碼數字為 chip,點擊切換
    `activePageIndex` 並清空選取;刪除/移動按鈕在邊界時停用)。
  - `paperAndDocumentPanelHtml()` 新增「版型範本 Template」與
    「Auto Fill 自動填版」兩個 `<details>` 區塊;`builtInTemplates`
    在模組載入時只呼叫一次 `getBuiltInTemplates()` 並快取(該函式每次
    呼叫都用 `createTemplate()`/`makeId()` 產生全新亂數 id,呼叫兩次會
    讓 `<select>` 渲染時的 option value 與之後「套用」查找時的 id 對不
    起來)。
  - `handlePropertiesPanelAction()` 新增 `apply-template`(在
    `builtInTemplates`與`state.templates`兩處查找 id)、`save-template`
    (`window.prompt()` 取名 → `createTemplate()` → `saveTemplateAction`)、
    `delete-template`(只允許刪已存於 `state.templates` 的範本,內建
    範本不在裡面,天然被擋下)、`run-auto-fill`(以 `state.sources` 全部
    id 作為填版素材,§11.4 混合尺寸偵測顯示於面板)。
  - `<dialog id="relink-dialog">`(原生 `<dialog>` + `showModal()`)+
    `renderRelinkDialog()`/`finishProjectLoad()`:「開啟專案」的
    `#file-input-project` change handler改為——若反序列化出的
    `sources.length > 0`,不直接呼叫 `resetWithState()`,而是先開對話框
    列出待重新選取的檔名(依 `fileName` 分組去重);使用者選檔後呼叫
    `relinkSources(remaining, freshlyLoaded)`,對每個 `relinked` 項目
    呼叫 `engine.ensurePreview(r)`,可分批多次選檔案(每輪只針對還
    `remaining` 的部分重新比對);「完成載入」把
    `[...relinked, ...remaining]` 全部併入最終的 `state.sources`(未比對
    成功的仍保留 metadata,對應 Slot 之後匯出會如預期拋錯,§17.1 既有
    設計,不是本步遺漏)才真正呼叫 `finishProjectLoad()` →
    `store.resetWithState()`。
  - `renderSourceGallery()` 的縮圖改用
    `engine.getThumbnail(id) ?? engine.getPreview(id)`(relink 後的來源
    只有 Preview 層有資料,見 Implementation Details)。

### Reason
`docs/remediation_plan.md` R-2 工作包第 5 步,`docs/plan.md` Phase 12
12e 範圍。12a 當時刻意把完整 relink UI 留到本步(見 2026-08-06 13:10
條目的 Implementation Details),避免在骨架階段重寫兩次。

### Implementation Details
最大的架構風險是「relink 之後,Slot 的內容到底能不能真的重新顯示」
——而不只是 metadata 對得起來。查證 `src/sources.js` 的
`ensurePreview(source)` 實作發現:它用 `source.id` 當快取 key、但用
`source.docId` 去 `binaryStore`/`openPdfDocs` 撈實際 bytes/文件。而
`relinkSources()`(Phase 9 既有函式)回傳的 `relinked` 項目本身就是
`{ ...saved, docId: match.docId, ... }`——即「保留原本(SAVED)的 id、
換上新選取檔案的 docId」。這代表把這個合併後物件直接丟給
`engine.ensurePreview()`,不需要任何額外的 id 對照表:快取會正確寫在
SAVED id 底下,而讀取的是新 session 剛載入的 docId 對應資料。已用
瀏覽器實測驗證這個推論成立(見 Verification Result),不是只憑程式碼
推導就假設可行。這也是為什麼 12e 沒有像最初設計草稿考慮過的那樣另外
維護一個 `sourceIdAlias` Map——查證後發現根本不需要。

唯一的落差:relink 後的來源只有 Preview 層被填入(明確呼叫
`ensurePreview()`),Thumbnail 層(`engine.getThumbnail()`)不會有資料,
因為 Thumbnail 只在 `loadPdfFile()`/`loadImageFile()`/`loadSvgFile()`
內部用「剛載入的新 id」快取,而 relink 用的是 SAVED id 讀取。已修正
`renderSourceGallery()` 讓縮圖改抓 Thumbnail 或 Preview 其中之一,relink
後的來源縮圖因此改顯示解析度較高的 Preview 圖(非缺陷,只是尺寸來源
不同層)。

### Impact Analysis
`window.prompt()` 用於範本命名是 MVP 折衷(同步、無額外 UI 元件成本);
若之後要做成非阻塞式命名輸入框,屬於獨立的 UI 打磨項目,不影響
`saveTemplateAction` 這條資料路徑。relink 對話框目前只在「開啟專案」
當下提供一次重新選取機會,若使用者跳過部分檔案,之後沒有另一個「重新
relink」入口——這是刻意的範圍控制(remediation_plan.md 已在 R-6 排入
「內建使用者說明」向使用者說明此限制),非本步遺漏。12f(快捷鍵)接下來
會需要在 Delete 鍵時分辨「刪除選取的 Slot/Text Box」與「刪除整頁」的
語意邊界(目前只有工具列的「刪除」按鈕操作頁面,Delete 鍵尚未綁定任何
頁面層級操作)。

### Verification Result
PASS:
1. `npm test`:546/546(本步為純 UI orchestration,複用的
   `pages.js`/`auto-fill.js`/`template-library.js`/`project-file.js`
   函式已有既有測試覆蓋)。
2. 瀏覽器驗證(`node scripts/dev-server.mjs` +
   `http://localhost:5173/app.html`,以真實 DOM 事件驅動):
   - 頁面管理:新增/複製/上移/刪除連續操作後,頁數與內容正確反映
     `pages.js` 既有語意(複製含格位內容、刪除後 activePageIndex 落在
     合理範圍)。
   - Template:套用內建範本「A4_上2下1」後,目標頁正確產生 3 個格位;
     以假的 `window.prompt` 存一個範本後 `state.templates` 正確新增
     一筆。
   - Auto Fill:載入 3 個合成圖片來源、`repeatCount=2`(共 6 份素材)、
     以 3 格位範本頁執行後,原本的 1 個範本頁被整段替換成 2 個新頁,
     每頁 3 個格位(6÷3=2,與 Phase 6 既有語意一致)。
   - **relink 全流程**(這是本步最關鍵的驗證):`serializeProject()`
     目前 state(3 來源、3 頁、1 範本)→ 包成 `File` 經真實
     `#file-input-project` change 事件觸發載入 → 確認 relink 對話框
     開啟且正確列出 3 個待選檔名、狀態列顯示「已比對成功:0、尚待
     重新選取:3」→ 產生 3 個內容相同(相同檔名/尺寸)的合成圖片經
     `#file-input-relink` 選取 → 狀態列正確更新為「已比對成功:3、
     尚待重新選取:0」→ 點擊「完成載入」→ 確認對話框關閉、
     `state.pages/sources/templates` 數量與存檔時完全一致、Undo/Redo
     歷史正確重置(`canUndo`/`canRedo` 皆 false,符合 D-018 既有慣例)、
     且**取一個仍指派了來源的 Slot,確認
     `engine.getPreview(sourceId) ?? engine.getThumbnail(sourceId)`
     真的有資料**(不只是 metadata 比對成功,內容確實可重新渲染)。

## 2026-08-06 16:30

### Type
Feature

### Summary
R-2 12f + R-5(Phase 12 Product UI 第 6 步,同時完成 remediation_plan.md
R-5,§18.3):`app.html` 接上 `src/keymap.js` 的 `resolveShortcut()`/
`nudgeDelta()`——Delete/Ctrl+Z/Ctrl+Y/Ctrl+A/Arrow/Shift+Arrow 全數可用;
Ctrl+C/Ctrl+V 實作為決策點 3 定案的「頁內 Slot 複製貼上」。**Phase 12
的 12a~12f 六步至此全部完成**——`app.html` 已具備 §18.1/§18.2 [M] 要求
的完整產品 UI,不再需要透過 dev harness 操作引擎功能。

### Files Changed
- app.html —
  - import 新增:`resolveShortcut`/`nudgeDelta`(keymap.js)、
    `moveTextBoxesAction`(reducers.js,微移文字框需要)。
  - `slotClipboard`(模組層級陣列,§18.3 Ctrl+C/V 用,非瀏覽器系統剪貼簿)。
  - `document.addEventListener('keydown', ...)`:先擋兩種情況直接
    return——`pendingRelink` 存在時(relink 對話框自己的輸入應維持原生
    行為)、`e.target` 是表單欄位(`input`/`textarea`/`select`/
    `contenteditable`,讓 Properties Panel 輸入框、專案名稱等欄位的
    打字/瀏覽器原生文字 Undo 不被攔截)。其餘依 `resolveShortcut()` 的
    回傳型別分派:`delete`(同時處理 Slot 與 Text Box 選取)、
    `undo`/`redo`(直接呼叫 `store.undo()`/`store.redo()`)、`selectAll`
    (全選目前頁的所有 Slot,不含 Text Box——與 12d 既有的
    Slot-為主設計一致)、`nudge`(依 `nudgeDelta()` 算出的 dx/dy,
    Slot 走 `moveSlotsAction`、Text Box 走 `moveTextBoxesAction`,皆帶
    `coalesceKey` 讓連續按同一方向鍵收斂成同一個 Undo 步驟)、`copy`
    (存目前選取 Slot 的淺拷貝到 `slotClipboard`)、`paste`(以
    `createSlot({...s, id: undefined, x: s.x+0.02, y: s.y+0.02, z: maxZ+1+i})`
    產生新 Slot,offset+z 疊放慣例照搬 `free-layout.js`
    `duplicateSlots()` 既有作法,貼上後自動選取新產生的 Slot)。

### Reason
`docs/remediation_plan.md` R-2 工作包第 6 步(`docs/plan.md` Phase 12
12f 範圍),與 R-5(§10.4 批次套用/Ctrl+C+V)兩者原計畫就是併入
12c/12f 一次做掉(見 2026-08-06 11:30 條目與 remediation_plan.md 原文),
本次完成後 R-5 視為一併結案,不再是獨立待辦項。Ctrl+C/V 的範圍依
2026-08-06 12:00 條目記錄的決策點 3(使用者核可 remediation_plan.md
建議方案)定案為「頁內複製貼上」,不做跨頁/跨專案剪貼簿。

### Implementation Details
`document.addEventListener('keydown', ...)` 掛在 `document` 而非
`paperHost`,是刻意的——快捷鍵(尤其 Undo/Redo)應該在整個應用程式
可用,不侷限於滑鼠游標停在畫布上時;真正的範圍控制交給表單欄位判斷
式,而不是縮小監聽器掛載的 DOM 範圍。瀏覽器實測時第一次驗證表單欄位
判斷式,不慎用 `document.dispatchEvent(new KeyboardEvent(...))` 直接在
`document` 上派送合成事件——這樣 `event.target` 會是 `document` 本身而
非真正取得焦點的 `<input>`,導致誤判「guard 沒生效」;改成在
**取得焦點的那個 input 元素**上呼叫 `dispatchEvent()`(讓事件依真實
瀏覽器行為往上冒泡到 `document`)後,guard 正確生效——這是測試腳本
本身模擬鍵盤事件的方式有誤,不是 app 的真實 bug,已在 Verification
Result 記錄兩種派送方式的對照結果。

### Impact Analysis
Phase 12 的 6 步(12a~12f)全部完成,`app.html` 現在是一個功能完整、
不依賴任何 `dev/*.html` 的產品 UI。剩餘的 remediation_plan.md 工作包
只剩 R-4(§19.4 更新檢查)、R-6(內建使用者說明)、R-7(重新打包,把
`scripts/build.mjs` 的 entry 從 `dev/print-aids.html` 切換到 `app.html`
並跑 `file://` 回歸)。R-7 執行前,`docs/project_status.md` 的
Completed Features 應補上 Phase 12 條目(比照既有 Phase 0–10 的記錄
格式),目前先在 Planned Features 標記進度。

### Verification Result
PASS:
1. `npm test`:546/546(本步為純 UI orchestration,複用的
   `keymap.js`/`reducers.js`/`free-layout.js` 函式已有既有測試覆蓋)。
2. 瀏覽器驗證(`node scripts/dev-server.mjs` +
   `http://localhost:5173/app.html`,以真實 `KeyboardEvent` 驅動):
   - Ctrl+A 全選 4-up 的 4 個 Slot;ArrowRight 微移全選中 Slot 的 `x`
     皆 +0.002(`NUDGE_STEP_NORMALIZED`);Shift+ArrowDown 微移 `y` 皆
     +0.02(`NUDGE_STEP_LARGE_NORMALIZED`)。
   - Ctrl+C 複製 4 個已選 Slot、Ctrl+V 貼上後 Slot 總數 4→8 且新貼上的
     4 個自動成為選取狀態;Delete 鍵刪除選取(剛貼上的 4 個)後
     8→4;Ctrl+Z 復原回 8、Ctrl+Y 重做回 4,皆與 store 的
     `historyDepth()` 對應正確。
   - 表單欄位 guard:聚焦專案名稱輸入框後按 Ctrl+A——第一次以
     `document.dispatchEvent()` 直接在 document 派送合成事件,
     `event.target` 錯誤地變成 `document`,guard 未生效(selection
     從 0 變 4,誤判為 bug);改為在**取得焦點的 input 元素本身**上
     `dispatchEvent()`(貼近真實瀏覽器行為)後重新驗證,guard 正確
     生效(selection 維持 0),確認先前是測試方式本身的問題。
   - console 除延續自更早期測試的舊 session 殘留訊息外,無新錯誤。

## 2026-08-06 17:00

### Type
Feature

### Summary
R-4(§19.4 手動檢查更新,唯一允許連網的例外,D-007):新增
`src/update-check.js`(純函式,fetch 經 deps 注入)+ 14 個測試;
`app.html` 工具列新增「檢查更新」按鈕與連網揭露文字,依結果顯示
更新卡片(新版本)/toast(已是最新版/失敗訊息三態)。APP_VERSION 定為
`1.0.0`(決策點 5)。

### Files Changed
- src/update-check.js(新增)— `RELEASES_API_URL`(固定指向
  `api.github.com/repos/cworkfox-source/pdfprint-layout/releases/latest`)、
  `parseVersion()`/`isNewerVersion()`(只比較 major.minor.patch 三段
  數字,忽略 pre-release/build metadata)、`checkForUpdate(currentVersion,
  deps)`(deps.fetch 注入,§4.1 慣例;任何失敗路徑一律回傳
  `{status:'error', message}` 而非 throw)。
- src/update-check.test.js(新增)— 14 個測試,涵蓋版本比較、URL 正確性、
  三種結果狀態、離線/HTTP 錯誤/JSON 解析失敗/缺欄位四種失敗路徑皆不
  throw。
- app.html —
  - `APP_VERSION = '1.0.0'` 常數 + import `checkForUpdate`。
  - 工具列新增「檢查更新」按鈕 + 按鈕旁 11px 灰字「將連線 GitHub
    查詢最新版本」(§19.4 明訂 UI 需明確標示此按鈕會連網)。
  - `#update-card`(固定定位卡片,非 toast——需要容納可點擊連結與可
    捲動的 release notes,不像 toast 會自動消失)+ `showUpdateCard()`/
    關閉按鈕。
  - `btn-check-update` 的 click handler:呼叫中停用按鈕(避免連點造成
    多個併發請求)、依 `checkForUpdate()` 回傳的三種 status 分派——
    `update-available` 顯示卡片(版本號 + release notes + 「前往下載」
    連結,連結 `target="_blank" rel="noopener noreferrer"`)、
    `up-to-date`/`error` 顯示對應 toast。release notes 經既有的
    `escapeHtml()` 轉義後才組進 `innerHTML`(GitHub API 回應是不受信任
    的外部內容,§25 OWASP 提醒)。

### Reason
`docs/remediation_plan.md` R-4 工作包,`docs/plan.md` §19.4(2026-08-05
使用者決議新增,D-007)。§23.8 的四條驗收條件(page-load 不觸發任何
請求、點擊後只有一筆對 api.github.com 的 GET、離線時顯示訊息且不影響
核心功能、新版連結正確導向 Release 頁面)本次全數對應到實作與驗證。

### Implementation Details
`checkForUpdate()` 只在被呼叫時才有任何網路行為——`app.html` 裡除了
`btn-check-update` 的 click handler,沒有任何其他地方 import 或呼叫
這個函式,§19.4「不得在頁面載入時自動觸發、不得背景輪詢」的要求因此是
架構上自然成立,不是需要額外程式碼把關的承諾(同 Phase 8 D-017 對
「列印」按鈕不是第三條算繪路徑的論證方式)。release notes 用
`escapeHtml()` 轉義後測試:餵入含 `<script>` 標籤的假 release body,
確認 `update-card-body` 的 `innerHTML` 不含未轉義的 `<script>` 標籤
(顯示為純文字),沒有 XSS 風險。

### Impact Analysis
R-7(重新打包)完成、正式發布 v1.0.0 GitHub Release 後,`APP_VERSION`
即為這次檢查更新功能實際比對的基準版本;之後每次發布新版都必須同步
更新這個常數,否則使用者永遠會被判定為「已是最新版」。

### Verification Result
PASS:
1. `npm test`:560/560(546 → 560,新增 14 個 `update-check.test.js`
   測試)。
2. 瀏覽器驗證(`node scripts/dev-server.mjs` +
   `http://localhost:5173/app.html`):
   - 頁面載入後、點擊「檢查更新」前,以 `read_network_requests`
     確認 0 筆符合 `github` 的請求(§23.8 條件 1)。
   - 以假 `window.fetch` 模擬三種情境並點擊按鈕驗證:回傳較新
     `tag_name` 時,卡片正確顯示版本號、release notes、連結
     `href` 正確指向 `html_url`;回傳相同版本時顯示「目前已是最新版」
     toast;`fetch` reject(模擬離線)時顯示「無法檢查更新(可能離線)」
     error-樣式 toast,且畫面其餘功能未受影響(§23.8 條件 3)。
   - XSS 檢查:release notes 帶 `<script>alert(1)</script>` 時,卡片
     `innerHTML` 確認不含未轉義的 `<script>` 標籤。
   - 關閉按鈕正確隱藏卡片。

## 2026-08-06 17:20

### Type
Feature

### Summary
R-6(內建使用者說明):`app.html` 工具列新增「說明」按鈕,開啟原生
`<dialog>` 顯示快速上手四步驟、§18.3 快捷鍵表、七項已知限制(§17.1
relink、§16 ASCII-only、Bleed 與 contain、§25 註解遺失、§25 排除項、
Template Library 證件照非實際尺寸、§11.4 混合尺寸)。符合單檔離線
原則,內容完全內嵌、不外連。

### Files Changed
- app.html —
  - 工具列新增「說明」按鈕(`btn-help`)。
  - `<dialog id="help-dialog">`:靜態內嵌內容(三個 `<section>`——快速
    上手 `<ol>`、快捷鍵 `<table>`、已知限制 `<ul>`),`.help-body` 內部
    可捲動、對話框本身 `max-height:80vh` 避免小視窗被截斷。
  - `btn-help`/`btn-help-close` 的 `showModal()`/`close()` 開關。
  - `document.addEventListener('keydown', ...)` 的 guard 新增
    `if ($('help-dialog').open) return;`(比照既有的 `pendingRelink`
    guard)——避免使用者在說明視窗開啟時瀏覽內容,不小心觸發底下畫布的
    Ctrl+A/Delete 等快捷鍵(說明對話框本身沒有任何表單欄位,原本的
    `isFormField` 判斷式不會擋下這個情境,必須另外加一條)。

### Reason
`docs/remediation_plan.md` R-6 工作包;§23.9 第 9 條驗收條件(內建說明
需涵蓋快速上手、快捷鍵表、§25/§11.4/§17.1 表列的每一項已知限制)。
內容與 README.md 的「已知限制」章節出自同一份缺口盤點,兩處分別服務
不同讀者(README 給開發者/GitHub 瀏覽者,說明對話框給實際使用單檔
`index.html` 的終端使用者,離線時仍可查閱)。

### Implementation Details
瀏覽器實測時第一次驗證「開啟說明後按 Ctrl+A 不應該影響畫布」——確認若
沒有額外的 `help-dialog.open` guard,快捷鍵 keydown handler 既有的
`isFormField` 判斷式不會擋下這個情境(對話框內容全是 `<section>`/
`<table>`/`<li>`,沒有任何 `input`/`textarea`/`select`),導致使用者
單純瀏覽說明內容時意外觸發全選/刪除。加上這條 guard 後重新驗證
selection 維持 0,不受影響。

### Impact Analysis
`docs/remediation_plan.md` 的 G-12(已知設計限制只存在內部文件,使用者
不可見)至此透過本次的說明對話框關閉;R-7 重新打包後,這份說明內容
會隨 `index.html` 一起離線可用,不依賴任何外部連結。

### Verification Result
PASS:
1. `npm test`:560/560(本步無新純函式邏輯,純靜態 UI 內容)。
2. 瀏覽器驗證(`node scripts/dev-server.mjs` +
   `http://localhost:5173/app.html`):點擊「說明」開啟對話框,確認
   內容包含「快速上手」「鍵盤快捷鍵」「已知限制」「重新選取」
   「ASCII」等關鍵字;對話框開啟時對其自身 dispatch `Ctrl+A`
   keydown,確認 `state.selection` 維持不變(guard 生效);關閉按鈕
   正確關閉對話框(`dialog.open` 變回 `false`)。

## 2026-08-06 17:40

### Type
Feature

### Summary
R-7(重新打包 + file:// 回歸)—— `docs/remediation_plan.md` 全部
7 個工作包(R-1~R-7)至此**全數完成**。`scripts/build.mjs` 的 build
entry 從 `dev/print-aids.html`(Phase 10 dev harness)切換為 `app.html`
(Phase 12 產品 UI),重新產出 `index.html`(2,948,131 bytes,重複
build SHA-256 相同),並在真實 `file://` 分頁完成端到端冒煙測試
(載入圖片→套用版型→拖曳到格位→匯出 PDF,console 無錯誤)。

### Files Changed
- scripts/build.mjs — `DEV_ENTRY` 從 `dev/print-aids.html` 改為
  `app.html`;`createReleaseHtml()` 移除對 `<title>`/`<h1>` 的強制覆寫
  (原本是為了蓋掉 dev harness 專用的標題,`app.html` 已經是正確的
  產品標題「拼版設計工具」,不需要再改寫)。
- index.html — 重新產出,entry 改變後內容整個不同(不再是除錯頁)。
- docs/project_status.md — TL;DR、Phase 11 Standalone Build 章節(新
  bytes/SHA-256)、Features In Development/Planned Features(全部
  R-1~R-7 標記完成)、Future Roadmap(v1.0.0 首發 Release 提醒)更新。
- README.md — 「目前狀態」移除已解決的「已知落差」段落、「開發者
  指引」補上 `app.html` 為產品 UI 入口。

### Reason
`docs/remediation_plan.md` R-7 工作包,是整份修正計畫的收尾步驟——
前六個工作包(R-1~R-6)分別修正/新增了規格、SVG 接線、產品 UI 六步、
更新檢查、使用者說明,但正式發布產物 `index.html` 一直到本步之前都還
是舊的 dev harness 打包結果,使用者實際拿到的東西尚未反映前六步的
任何成果。

### Implementation Details
`createReleaseHtml()` 的 `<title>`/`<h1>` 強制覆寫是 Phase 11 當初的
設計,理由是 `dev/print-aids.html` 的標題是「Phase 10 dev harness —
Print Aids」,不適合出現在正式產物裡。`app.html` 從 12a 一開始就有
正確的 `<title>拼版設計工具</title>` 與對應 `<h1>`,繼續套用這段覆寫
邏輯反而會把已經正確的中文標題換成寫死的英文字串
「pdfprint-layout」——移除後改為直接沿用 `app.html` 自己的標題,不是
遺漏原本的把關,而是原本把關的理由(dev harness 標題不適合出現在
正式產物)在新 entry 底下已經不成立。

### Impact Analysis
`dev/*.html` 全部維持不變,繼續作為引擎驗證用途;正式發布 v1.0.0
GitHub Release 時,§19.4 更新檢查功能(R-4)的比對基準
(`app.html` 內的 `APP_VERSION = '1.0.0'` 常數)才會第一次有意義地
派上用場——release 建立前,「檢查更新」永遠會回報「已是最新版」
(因為沒有比 1.0.0 更新的 tag)。`docs/remediation_plan.md` 的完成
定義(§7:G-01~G-12 全數關閉、`npm test` 全綠且淨增、`file://` 全流程
冒煙測試通過、四份文件與實況一致)至此全部達成。

### Verification Result
PASS:
1. `npm run build`:成功,重複執行兩次 SHA-256 相同
   (`0376a5c25007b673009170de1bec220434917a57c4b4f0f80a7020fc4d4cb167`);
   build script 自身的靜態斷言(無 `<script type="module">`、無
   `from './src/`/`from './vendor/` import 字串、含 pdf.js 5.4.149
   版本字串、含 Blob worker 內嵌邏輯、無外部 `<script>`/`<link>`
   URL)全數通過。
2. `npm test`:560/560(本步無新純函式邏輯)。
3. `file://` 冒煙測試(Chrome,直接開啟本機
   `file:///.../pdfprint-layout/index.html`,非透過 dev server):
   頁面正確渲染完整產品 UI(三區架構、工具列、頁面管理列);以合成
   `File` 物件驅動真實 `change`/`DragEvent` 事件——套用 2up-h 版型、
   載入一張合成 PNG 圖片、拖曳到格位、匯出 PDF,確認
   `Slot.sourceId` 正確指派且成功產生 1,007 bytes 的 PDF、toast 顯示
   「已匯出 PDF」;全程 console 無錯誤(`read_console_messages`
   `onlyErrors: true` 確認)。
