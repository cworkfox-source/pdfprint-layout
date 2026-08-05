# Project Overview

## Current State TL;DR (max 5 lines — Startup reads ONLY this block)
本 repo 已由「AI 治理範本」轉為產品 repo:Visual Page Imposition Designer。
`docs/plan.md` v2.0 為需求來源,`docs/spec.md` 已重寫,Scale 已改為 solo-large。
無關的 Python 打包 playbook 已刪除;尚無任何程式碼。下一步:Phase −1 可行性
Spike(file:// + Blob Worker + pdf-lib),未通過前不得進入 Phase 0。
待決:GitHub 發布 + 應用內自動更新需求與現有「離線/禁止發布」規則衝突,待使用者裁決。

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
(none — 尚未開始實作)

## Features In Development
(none)

## Planned Features
見 `docs/plan.md` §22 開發階段。Phase −1 → Phase 11。

## Known Issues
(尚無實作,無 issue)

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
Phase 11 產出單一 `index.html`,使用者雙擊即可在 Chrome / Edge 開啟使用。
不得依賴 CDN / Server / Internet。

## Dependencies
PDF.js、pdf-lib、esbuild(build 期)。不引入前端 Framework 與 SortableJS。
`playbooks/` 目錄現為空(2026-08-05 移除無關的 Python 打包 playbook)。

## Future Roadmap
第二階段(plan §16、§25):雙面列印/背面對齊、SVG、文字框、浮水印、Bleed、
Safe Area、Header/Footer、頁碼、進階對齊、快捷鍵、Template Library。
