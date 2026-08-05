# Project Overview

## Current State TL;DR (max 5 lines — Startup reads ONLY this block)
Visual Page Imposition Designer,public repo
https://github.com/cworkfox-source/pdfprint-layout。**Phase 0、Phase 1、
Phase 2 已完成**(geometry/store/model + paper/margin/zoom/print-CSS +
PDF/圖片 Source Engine,89 個單元測試 + 瀏覽器實測皆通過)。下一步:
Phase 3 Layout Engine(1/2/4/6/9-up、自訂 Grid、上2下1 等 preset 版型)。
無 blocker(開發用 pdf.js 版本 pin 改為 v5.4.149,見 decision_log D-009)。

## Current Version
Plan v2.1(§5.2 補 docId 欄位)/ Phase 2 完成(無產品 UI,僅引擎與 dev 檢查頁)

## Project Goals
純前端、零後端、可離線、可打包為單一 HTML 的視覺化拼版工具。使用者載入 PDF 或
圖片,自由拖放到紙張上拼版,輸出尺寸精確且不點陣化的 PDF,或直接列印。
定位為 Visual Page Imposition Designer,非單純的 N-up PDF Tool。

## Core Features
- 自由版型 Layout Designer(新增/移動/縮放/分割/合併 Slot、Snap、對齊)
- Preset 版型與自訂 Grid(1/2/4/6/9/16-up、上2下1、上1下2 等)
- PDF / 圖片來源管理(PDF 每頁為獨立 Source、Lazy Thumbnail、LRU 快取)
- Auto Fill 自動填版(順序/逆序/奇偶/重複 N 次、自動產生 Output Pages)
- 高品質 PDF Export(pdf-lib embedPage 保留向量與可選取文字)
- 列印經由匯出的同一份 PDF,確保列印與匯出一致;含 100 mm 校正頁
- 專案 / 版型儲存與載入、Undo / Redo

## Completed Features
- Phase −1 可行性 Spike(2026-08-05):`spike/dist/index.html` 於 `file://`
  下驗證通過 pdf.js ESM 透過 Blob URL 動態載入、Worker 透過 Blob URL 運作、
  原始 PDF bytes 未被 detach 且可交給 pdf-lib 匯出。技術手法見
  `spike/README.md`。
- Phase 0 資料模型核心(2026-08-05):
  - `src/geometry.js` — mm/pt 換算、A4/A3/Letter/Legal 精確 pt 值、2D 仿射
    矩陣工具、§6.3 Slot transform matrix(含旋轉 90/270 時 fit 目標尺寸對調
    的修正,已回寫 plan.md §6.3)、§6.2 PDF Y 軸翻轉(唯一一處)、§14.3
    `/Rotate` 正規化、§13.5/§14.4 CropBox 優先、§6.5 z-order 排序。
  - `src/store.js` — 單一 mutation 入口(`commit`)、immutable snapshot
    history(上限 50)、coalescing(拖曳合併為一步 undo)、
    `historyEntry:false`(Zoom/Pan/Selection 不進 history)、狀態 deep
    freeze 防止繞過 reducer 直接改物件。
  - `src/model.js` — Project/Source/Page/Slot/Template/AppState 工廠函式,
    Template 建立時自動去除 `sourceId`(§21 Template 不存 Source)。
  - 39 個單元測試全數通過(`npm test`,零 npm 依賴,純 Node 內建
    `node:test`)。
- Phase 1 Paper & Preview Engine(2026-08-05):
  - `src/preview.js` — 純計算(`computePaperPreviewLayout`/`resolveZoom`/
    `computeContentAreaPt`)與 DOM adapter(`renderPaper`/
    `applyPrintPageSize`)分離;Preview 內部「zoom=1 時 1pt=1px」的換算
    與 Model 的 pt 儲存互不影響。
  - `scripts/dev-server.mjs` — 零依賴靜態伺服器,開發期以 http:// 跑原生
    ESM(file:// 的限制只在 Phase 11 打包時才需處理,見 plan §19.2)。
  - `dev/index.html` — Phase 1 人工檢查頁(非產品 UI)。
  - 12 個新單元測試(共 51 個)+ 瀏覽器實測(A4/A3、方向切換、Zoom
    100%→200%、Fit Page、`@page` CSS、超額 margin 報錯)全數通過,細節見
    change_log 2026-08-05 18:15。

- Phase 2 Source Engine(2026-08-05):
  - `src/binary-store.js` — `SourceBinaryStore`(§12.3):原始 bytes 依
    `docId` 保存,與 `store.js`/AppState 完全分離(不進 undo history、
    不被 deep-freeze);`getCopyForPdfJs()` 是唯一交給 PDF.js 的管道,每次
    回傳全新 `slice(0)` 複本。
  - `src/lru-cache.js` — 通用容量上限 LRU,`onEvict` 掛 §12.6 釋放邏輯,
    Thumbnail 快取上限 300、Preview 快取上限 60。
  - `src/page-range.js` — §12.2 頁碼範圍語法解析(`all`/`odd`/`even`/
    `1-5,8,10-12`),0-based 輸出。
  - `src/sources.js` — Source Engine 核心:`createSourceEngine()`
    orchestrate PDF/圖片載入、docId 參照計數(多頁共用一份原始 bytes,
    最後一頁釋放才真正 `binaryStore.remove()`+`loadingTask.destroy()`)、
    `createRenderQueue(3)`(§12.5 最多 3 個並行 render)、
    `computeThumbnailSize()`/`computePreviewCanvasSize()`。所有
    Canvas/PDF.js 呼叫皆透過 `deps.render*`/`deps.decodeImage` 注入,
    orchestration 本身可在純 Node 測試。
  - `src/render-adapters.js` — 瀏覽器端實際 render 實作(Canvas 縮圖、
    `createImageBitmap`、`page.cleanup()`),不含任何 orchestration 邏輯。
  - `src/model.js` — `createSource()` 新增 `docId` 欄位(見 D-009)。
  - `dev/sources.html` — Phase 2 dev harness(檔案上傳、頁碼範圍輸入、
    縮圖 Gallery、Delete/Delete All、記憶體統計 readout)。
  - 38 個新單元測試(共 89 個)+ 瀏覽器實測(Playwright + 真實 Chromium:
    合成 3 頁 PDF 含混合 A4/A3 尺寸與 `/Rotate 90`、縮圖像素檢查非空白、
    docId 參照計數行為、Delete All 記憶體歸零、頁碼範圍 UI 串接)全數
    通過,細節見 change_log 2026-08-05 19:30。

## Features In Development
Phase 3(Layout Engine)尚未開始:1/2/4/6/9/16-up、自訂 Grid、上2下1、
上1下2、左1右2 等 preset 版型。

## Planned Features
見 `docs/plan.md` §22 開發階段。Phase 3 → Phase 11。

## Known Issues
- 開發/測試環境(Playwright 內建 Chromium 141)無法 render pdf.js
  v6.2.108(呼叫尚未普及的 `Map.prototype.getOrInsertComputed`,拋
  `TypeError`)。已改用 `scripts/fetch-vendor.sh` pin 的 v5.4.149 供 Phase
  2+ 開發使用;`spike/fetch-vendor.sh`(v6.2.108)維持不動,僅為 Phase −1
  的歷史驗證記錄。之後 Phase(含 Phase 11 正式 build)選用 pdf.js 版本時
  需重新確認目標瀏覽器相容性,見 decision_log D-009。
- pdf.js v6(現行最新版)API 變更:`PDFDocumentProxy.destroy()` 已移除,改用
  `.cleanup()` 或 `loadingTask.destroy()`。`src/sources.js` 已採用新 API
  (`loadingTask.destroy()`),勿參考含 `pdfDoc.destroy()` 的舊教學。

## Technical Architecture
Vanilla HTML5 + ES6+,PDF.js 負責解析與預覽,pdf-lib 負責輸出,esbuild 打包成
單一 IIFE HTML(僅 Phase 11)。三條不可違反的分離原則(plan §4):Layout
Model 與 DOM 分離、Slot 與 Source 分離、Preview 與 Export Renderer 分離但
幾何等價。所有單位換算、Y 軸翻轉、fit 與 transform 疊加集中於唯一的
`src/geometry.js`;`src/preview.js` 是第一個實際的 Preview Renderer,
`src/render-adapters.js` 是 Source Engine 的 DOM/PDF.js adapter,兩者都依此
原則把計算與 DOM/第三方庫寫入分開,讓 `src/sources.js` 的 orchestration 邏輯
可在純 Node 測試。開發期用 `scripts/dev-server.mjs`(http://)跑原生 ESM,
`file://` 相容性只在 Phase 11 打包產物上驗證。

## Data Structure
AppState = Project / Sources / Templates / Pages(→ Slots)/ Selection / History。
Slot 採 normalized 座標(相對內容區 0..1),內部長度單位一律 pt。
原始檔案 bytes 存於獨立的 `SourceBinaryStore`(`src/binary-store.js`,Phase 2
已實作;不得被 PDF.js detach,plan §12.3),依 `docId` 保存、與 AppState 完全
分離,不進 store.js 的 undo history。Source 的 `docId` 欄位是兩者之間的唯一
連結(同一 PDF 檔案的所有頁 Source 共用一個 docId,見 decision_log D-009)。
工廠函式見 `src/model.js`,幾何運算見 `src/geometry.js`,狀態管理見
`src/store.js`,Source Engine 見 `src/sources.js`。詳見 `docs/plan.md` §5–§7、
§12。

## API Structure
N/A — 純前端,無後端 API。

## Deployment Process
原始碼與文件託管於 https://github.com/cworkfox-source/pdfprint-layout
(public)。Phase 11 產出單一 `index.html`,經 GitHub Release 發布,使用者
雙擊即可在 Chrome / Edge 開啟使用;應用程式本身除 §19.4 手動更新檢查外
不得依賴 CDN / Server / Internet。發布流程見 plan.md §19.5。

## Dependencies
PDF.js(開發用 v5.4.149,由 `scripts/fetch-vendor.sh` 取得至 `vendor/`,不
commit,見 decision_log D-009)、pdf-lib(Phase 7 才需要)、esbuild(build
期)。不引入前端 Framework 與 SortableJS。`playbooks/` 目錄現為空
(2026-08-05 移除無關的 Python 打包 playbook)。

## Future Roadmap
第二階段(plan §16、§25):雙面列印/背面對齊、SVG、文字框、浮水印、Bleed、
Safe Area、Header/Footer、頁碼、進階對齊、快捷鍵、Template Library。
