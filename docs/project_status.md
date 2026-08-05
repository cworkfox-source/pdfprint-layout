# Project Overview

## Current State TL;DR (max 5 lines — Startup reads ONLY this block)
Visual Page Imposition Designer,public repo
https://github.com/cworkfox-source/pdfprint-layout。**Phase −1 可行性 Spike
已通過**(`spike/`,見 change_log 2026-08-05 17:00)。下一步:Phase 0 Data
Model(geometry.js / store.js,見 plan.md §5–§7)。已知缺口:開發機無
Node.js/npm,Phase 11(esbuild build)前必須解決,見 Known Issues。

## Current Version
Plan v2.0 / 尚未有程式碼版本

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

## Features In Development
Phase 0(Data Model):`geometry.js`(§6 唯一幾何模組)、`store.js`(§7 單一
mutation 入口)、Project/Source/Page/Slot/Transform/Template 資料結構。

## Planned Features
見 `docs/plan.md` §22 開發階段。Phase 0 → Phase 11。

## Known Issues
- **開發機未安裝 Node.js/npm**(`node`/`npm` command not found)。Phase 0–10
  不受影響(spike 用 Python 腳本 + 手動 vendor 繞過);但 Phase 11 的正式
  build 依 decision_log D-004 指定用 esbuild,需要 Node,屆時必須先安裝。
- pdf.js v6(現行最新版)API 變更:`PDFDocumentProxy.destroy()` 已移除,改用
  `.cleanup()` 或 `loadingTask.destroy()`。Phase 2 Source Engine 實作時需
  採用新 API,勿參考含 `pdfDoc.destroy()` 的舊教學。

## Technical Architecture
Vanilla HTML5 + ES6+,PDF.js 負責解析與預覽,pdf-lib 負責輸出,esbuild 打包成
單一 IIFE HTML。三條不可違反的分離原則(plan §4):Layout Model 與 DOM 分離、
Slot 與 Source 分離、Preview 與 Export Renderer 分離但幾何等價。
所有單位換算、Y 軸翻轉、fit 與 transform 疊加集中於唯一的 `geometry.js`。

## Data Structure
AppState = Project / Sources / Templates / Pages(→ Slots)/ Selection / History。
Slot 採 normalized 座標(相對內容區 0..1),內部長度單位一律 pt。
原始檔案 bytes 存於獨立的 SourceBinaryStore(不得被 PDF.js detach,plan §12.3)。
詳見 `docs/plan.md` §5–§7。

## API Structure
N/A — 純前端,無後端 API。

## Deployment Process
原始碼與文件託管於 https://github.com/cworkfox-source/pdfprint-layout
(public)。Phase 11 產出單一 `index.html`,經 GitHub Release 發布,使用者
雙擊即可在 Chrome / Edge 開啟使用;應用程式本身除 §19.4 手動更新檢查外
不得依賴 CDN / Server / Internet。發布流程見 plan.md §19.5。

## Dependencies
PDF.js、pdf-lib、esbuild(build 期)。不引入前端 Framework 與 SortableJS。
`playbooks/` 目錄現為空(2026-08-05 移除無關的 Python 打包 playbook)。

## Future Roadmap
第二階段(plan §16、§25):雙面列印/背面對齊、SVG、文字框、浮水印、Bleed、
Safe Area、Header/Footer、頁碼、進階對齊、快捷鍵、Template Library。
