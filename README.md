# pdfprint-layout

Visual Page Imposition Designer — 純前端、可離線的 HTML/PDF/圖片自由拼版與列印工具。

## 目前狀態

Phase 0–12 已完成:排版引擎、來源管理、自動填版、PDF 匯出、列印路徑、
專案/模板系統、進階印刷輔助元素(Bleed、Safe Area、Header/Footer、
Page Number、Text Box、浮水印、SVG、對齊/分布、Template Library),以及
Phase 12 的正式產品 UI(§18 三區架構 + Properties Panel,`app.html`)
全部實作完畢,560 個單元測試通過,並已用 `scripts/build.mjs` 打包成
單一離線 `index.html`(entry 為 `app.html`,已通過 `file://` 冒煙
測試)。

## 下載與開啟方式

下載或建置產出的 `index.html` 後,直接在 Chrome 或 Edge 雙擊開啟即可
使用,不需安裝、不需伺服器、不需連網(§19.4 手動檢查更新除外)。

## 功能清單

- 自由版型 Layout Designer(新增/移動/縮放/分割/合併 Slot、Snap、對齊)
- Preset 版型與自訂 Grid(1/2/4/6/9/16-up、上2下1、上1下2 等)
- PDF / 圖片 / SVG 來源管理(PDF 每頁為獨立來源、Lazy Thumbnail、
  LRU 快取)
- Auto Fill 自動填版(順序/逆序/奇偶/重複 N 次、自動產生 Output Pages)
- 高品質 PDF Export(pdf-lib embedPage,保留向量與可選取文字)
- 列印經由匯出的同一份 PDF,確保列印與匯出一致;含 100mm 校正頁
- 專案 / 版型儲存與載入、Undo / Redo
- 印刷輔助元素:Bleed、Safe Area(僅預覽)、Header/Footer、Page
  Number、Text Box、浮水印(文字/圖片)、多選對齊/分布、鍵盤快捷鍵、
  內建 Template Library

## 已知限制

- 專案存檔不內嵌任何來源二進位檔案;每次載入專案都需要重新選取原始
  PDF/圖片/SVG 檔案(依檔名+頁碼+尺寸+雜湊比對重新連結)。
- 文字功能(Header/Footer、Page Number、Text Box、浮水印)目前只支援
  ASCII 字元,不支援中文(需要 fontkit 內嵌字型子集,列為第二階段)。
- Bleed 對 `fitMode: contain` 的 Slot 沒有實際視覺效果(出血區維持
  空白);`cover` fit 才能延伸進出血區。
- 內建 Template Library 的「證件照8格」是均分 4×2 網格,非真正符合
  證件照物理尺寸的排版。
- 不支援雙面列印/背面對齊、書帖排版、標籤紙預設、色彩管理(ICC/CMYK
  轉換)。
- `embedPage` 不保留來源 PDF 的超連結、表單欄位、註解。

完整規格見 [`docs/plan.md`](docs/plan.md);決策記錄見
[`docs/decision_log.md`](docs/decision_log.md)。

## 開發者指引

- 規格與需求:[`docs/plan.md`](docs/plan.md)
- AI agent 規則:[`AGENTS.md`](AGENTS.md)
- 產品 UI 原始檔:`app.html`(單一入口,搭配
  `node scripts/dev-server.mjs` 於 `http://localhost:5173/app.html`
  開發期預覽)
- 引擎驗證用 dev harness(非產品 UI,每個對應一個 Phase):`dev/*.html`
- 測試:`npm test`(Node 內建 test runner,零外部依賴,560 個測試)
- 正式打包:`npm run build`(esbuild,entry 為 `app.html` → 單一
  `index.html`)
