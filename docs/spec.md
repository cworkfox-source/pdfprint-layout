# 專案規格

## 目標(一句話)
提供一套純前端、可離線、單一 HTML 的視覺化拼版工具(Visual Page Imposition
Designer),讓使用者把 PDF 與圖片自由排到指定紙張上,並輸出尺寸精確、內容不
點陣化的 PDF 或列印成品。

## 輸入 / 輸出
輸入:使用者本機的 PDF、PNG、JPG、WEBP 檔案(全部在瀏覽器記憶體處理,不上傳)。
輸出:
- 匯出的 PDF —— 紙張尺寸精確,PDF 來源保持向量/可選取文字,圖片直接嵌入。
- 列印成品 —— 經由匯出的同一份 PDF 送印,與匯出結果一致。
- 專案檔 `project.json`(不含來源二進位)與版型 Template。

## 驗收條件(每條都必須可實際驗證)
1. 單檔 HTML 以 `file://` 在 Chrome 與 Edge 開啟,Console 無錯誤;選取本機 PDF
   後可顯示第 1 頁,且同一份 bytes 隨即能以 pdf-lib 匯出新 PDF(證明未被
   PDF.js detach)。
2. 匯出 A4 PDF 的 MediaBox = 595.276 × 841.890 pt(誤差 ≤ 0.01 pt);
   A3 = 841.890 × 1190.551 pt。
3. Preview 與 Export 對同一份專案計算出的每個 Slot 內容四角座標差異
   ≤ 0.1 mm,測試須涵蓋 contain/cover/stretch × rotation 0/90/180/270 ×
   flip × offset ≠ 0 × 來源 `/Rotate` = 90 的 PDF。
4. 同一 Template 套用於 A4 與 A3 時,所有 Slot 的 normalized 座標值完全相同
   (證明 Slot 座標與紙張尺寸分離)。
5. 文字型 PDF 匯出後,於 PDF 閱讀器中仍可選取與搜尋文字(證明未整頁點陣化)。
6. 載入 100 頁 PDF 時同時存在的高解析 Canvas ≤ 3,分頁記憶體增幅 < 500 MB。
7. 列印校正頁實測 100 mm × 100 mm,誤差 ≤ 0.5 mm(印表機設為 Actual Size)。
8. 頁面載入後、使用者未點擊「檢查更新」按鈕前,瀏覽器 Network 面板不得出現
   任何對外請求;點擊後僅出現一筆對 `api.github.com` 的 GET,不含使用者檔案
   或個資。

## 不做什麼(明確排除範圍,防止過度工程)
- 不做後端、雲端同步或任何遠端 API;檔案不得離開瀏覽器。**唯一例外**:使用者
  於 UI 手動點擊「檢查更新」時,允許唯讀呼叫公開的 GitHub Releases API 查詢
  最新版本號,不傳送任何使用者資料或檔案內容;不自動觸發、不背景輪詢,詳見
  `docs/plan.md` §19.4。
- 不做「自動下載並自我覆寫本機檔案」——`file://` 瀏覽器沙箱不允許,偵測到新版
  時僅提供下載連結,由使用者手動取代檔案。
- 不做色彩管理(ICC / CMYK 分色 / 疊印預覽)。
- 不做完整 PDF 編輯(改內文、改字型、編輯既有註解)。
- 不做書帖排版(signature / folding scheme)。
- 不做雙面列印/背面對齊(名片、卡片類需求,留待更後續階段)。
- 【已於 Phase 10 完成,不再排除】SVG Source(§14,匯出時光柵化為 PNG,
  非向量輸出)、文字框、浮水印、Bleed、Safe Area——原列為 MVP(Phase
  0-9)排除範圍,但一直是 plan.md §16/§22「第二階段功能」的既定範疇,
  已在 Phase 10 實作,見 docs/decision_log.md D-019。
- 文字框/浮水印目前僅支援 ASCII 文字(不支援中文),見 decision_log
  D-019——非規格排除,是使用者明確做出的技術範圍決定,未來可加入
  fontkit 解除此限制。
- 不引入大型前端 Framework;能用原生 API 就不加依賴。

## 環境限制
- Windows 11 + Git Bash / PowerShell 為開發環境;產物須在 Chrome / Edge 的
  `file://` 協定下可直接雙擊執行。
- `file://` 下不可使用原生 ES Module(CORS origin `null`),build 產物必須是
  classic script(esbuild 輸出 IIFE);PDF.js Worker 須以 Blob URL 建立。
- 正式 Release 不得依賴 CDN / Server / Internet。
- 文件與程式碼中不得出現任何金鑰、密碼或個資;匯出 PDF 的 metadata 不得含
  使用者路徑或系統資訊。

## 未確認假設(agent 標註,待使用者確認後移除)
- [假設] 目標瀏覽器以 Chrome / Edge 為主,Firefox / Safari 為次要支援(可接受
  次要瀏覽器有已知差異)。
- [假設] 單檔 HTML 內嵌 pdf.js + pdf-lib 後體積約 2–4 MB 為可接受範圍。

## 治理範本遺留物處理(2026-08-05 已由使用者確認,非未確認假設)
- `playbooks/embeddable-python-packaging/`(Python exe 打包,與本 JS/HTML 產品
  無關)已刪除。
- `docs/templates.md`、`docs/bootstrap.md`、`docs/log_rotation.md` **予以保留**
  ——這三份不是遺留物,而是 `AGENTS.md` 本身 Startup / Bootstrap / Log Rotation
  三個章節直接指向的程序文件,刪除會讓 AGENTS.md 的自我引用失效。
