# Project Overview

## Current State TL;DR (max 5 lines — Startup reads ONLY this block)
Visual Page Imposition Designer,public repo
https://github.com/cworkfox-source/pdfprint-layout。**Phase 0-7 已完成**
(引擎層:geometry/store/model、Source Engine、Layout Engine、Free Layout
Designer、Source Placement、Auto Imposition、**PDF Export**〔pdf-lib 輸出,
§23.3 Preview/Export 等價性以 104 案例證實,並修正一個嚴重的 XObject
座標系 bug,見 D-016〕,382 個單元測試 + 瀏覽器實測(含真實 pdf-lib/pdf.js
往返驗證)皆通過)。下一步:Phase 8 Print Path(列印經由匯出的 PDF、列印
校正頁)。無 blocker。

## Current Version
Plan v2.1(§5.2 補 docId 欄位、§9.1 補非對稱 preset 假設)/ Phase 7 完成
(含 Phase 4 遺留的鎖定/解鎖、Z-order [M] 缺口補完見 D-013、AppState.sources
從未被寫入的缺口補完見 D-015;無產品 UI,僅引擎與 dev 檢查頁)

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

- Phase 3 Layout Engine(2026-08-05):
  - `src/layout.js` — 純幾何、無 DOM:`splitAxis()` 是唯一的軸切割原語
    (扣除 gap 後依權重比例分配,回傳已正規化 0..1 的 segment);
    `generateGridSlots()` 同時服務 §9.1 均勻 grid(1/2/4/6/9/16-up)與
    §9.2 自訂 Grid(同一函式,只是 rows/cols 由使用者輸入);
    `generateTopBottomSplit()`/`generateLeftRightSplit()` 服務上2下1、
    上1下2、左1右2、左2右1,以及 [S] 的上3下1/上1下3(即 plan §9.1 的
    「3+1」「1+3」);`GRID_PRESETS`/`generatePresetSlots()` 是完整的
    preset registry。`createSlotsFromRects()` 橋接到 `model.js` 的
    `createSlot()`。plan §9.1 另列的「2+2」preset 因規格未定義其與
    2×2(=4up)的幾何差異,本階段刻意不實作,已記錄為未解決假設(見
    decision_log D-010)。
  - `src/preview.js` — 新增 `computeSlotPx()`(純函式)與
    `renderSlots()`(DOM adapter),沿用同一套「純計算/DOM 寫入分離」
    原則;繪製順序呼叫 `geometry.js` 既有的 `sortByZOrder()`(§6.5),
    這是該函式第一次被實際的 renderer 使用。
  - `dev/layout.html` — Phase 3 dev harness:preset 下拉選單、自訂
    Rows/Cols、Gap H/V 控制,即時把產生的 Slots 畫到 Phase 1 的紙張
    Canvas 上。
  - 23 個新單元測試(共 112 個,含 preview.js 新增 2 個)+ 瀏覽器實測
    (Playwright:14 個 preset 逐一套用,每個 Slot 的實際
    `getBoundingClientRect()` 與 model 算出的 normalized 值換算後比對,
    0 個像素誤差;自訂 3×5 Grid 正確產生 15 個 Slot;調整 Gap 後重新
    套用 4-up,數值符合手算公式)全數通過,細節見 change_log
    2026-08-05 20:15。

- Phase 4 Free Layout Designer(2026-08-05):
  - `src/free-layout.js` — 純 `Slot[]` 編輯原語(無 DOM、不 import
    store.js):`moveSlots()`(鎖定成員靜默略過)、`setSlotRect()`/
    `deleteSlots()`/`splitSlotHorizontal()`/`splitSlotVertical()`/
    `mergeSlots()`(對鎖定目標一律 throw,§10.3);`canMergeSlots()` 以
    「無重疊 + 聯集面積等於外框面積」判斷 §9.3 的矩形規則;
    `createSlotRectFromDrag()` 供 §9.4 自由拖曳建立格位;Snap 系統
    (`computeSnapTargetsX/Y`、`computeSnapThresholdNormalized`(6 螢幕
    px,與 zoom 無關)、`snapMove`/`snapResize`,同時比較起始邊/結束邊/
    中心線取調整量最小者)。分割方向命名假設(水平分割→上下、垂直分割→
    左右)見 decision_log D-011。
  - `src/reducers.js` — 把 free-layout.js 接上 `store.commit()` 的
    AppState action creator(`moveSlotsAction`/`resizeSlotAction`/
    `deleteSlotsAction`/`duplicateSlotsAction`/`splitSlot*Action`/
    `mergeSlotsAction`/`setSelectionAction`),這是 Phase 0 的 `store.js`
    第一次被實際的編輯操作使用(Phase 1-3 的 dev harness 都繞過它)。
  - **修正 `src/store.js` 的既有 bug**:`commit()` 原本在呼叫 reducer
    **之前**就把狀態 push 進 `past`,若 reducer 中途 throw(例如合併非
    矩形選取),會留下一筆多餘的 history 記錄且錯誤清空 `future`。改為
    先算出 reducer 結果,成功後才動 history 記帳。第一次寫會 throw 的
    reducer(Phase 4 之前 History 從未被 Phase 0-3 的程式碼真正驗證過這
    條路徑)才發現,細節見 decision_log D-011。
  - `dev/free-layout.html` — Phase 4 互動式 dev harness:Select/Create
    模式切換、點選/Shift 點選多選、拖曳移動與 8 個縮放 handle(皆支援
    Snap 開關)、Delete/Duplicate/Split H/Split V/Merge(不可合併時停用
    並顯示提示)、Undo/Redo 按鈕與 Ctrl+Z/Ctrl+Y。
  - 44 個新單元測試(共 156 個:free-layout.js 31、reducers.js 12、
    store.js regression 1)+ 瀏覽器實測(Playwright 模擬真實
    pointer 拖曳:無 Snap 時移動/縮放的像素位移與模型變化量精確吻合;
    有 Snap 時吸附行為符合「調整量最小的邊獲勝」設計;分割/合併/刪除/
    複製/Undo/Redo/拖曳建立格位全數驗證通過)全數通過,過程中順帶修正
    dev harness 自身一個 `setPointerCapture` 在元素被重新渲染後呼叫導致
    `InvalidStateError` 的問題(改成在穩定的容器元素上 capture),細節見
    change_log 2026-08-05 21:40。

- Phase 5 Source Placement(2026-08-05):
  - `src/slot-content.js` — 純 `Slot[]` 欄位編輯原語(無 DOM、不 import
    store.js,同 Phase 4 free-layout.js 的分層方式):`setSlotSource()`/
    `setSlotFitMode()`(驗證 contain/cover/stretch)/`setSlotScale()`
    (正數)/`setSlotRotation()`(§10.2 MVP 僅 0/90/180/270,自動正規化
    任意輸入角度)/`rotateSlotContent()`/`setSlotOffset()`/`setSlotFlip()`/
    `clearSlotContent()`(重設 sourceId 與全部 transform 欄位回預設值)。
    刻意不檢查 `locked`——§10.3 只規定鎖定擋 Move/Resize/Delete,已在檔案
    註解記錄此範圍界定,見 decision_log D-012。
  - `src/reducers.js` 新增對應 action creator(`setSlotSourceAction` 等
    8 個),與 Phase 4 的 Free Layout action 共用同一個
    `updatePageSlots()` 內部工具與 coalescing 慣例(Offset 滑桿拖曳可用
    `coalesceKey` 收斂成一筆 undo,同 §7.2)。
  - `src/sources.js`/`src/render-adapters.js` 補上 §12.7 中解析度 Canvas
    Preview 分層的實際渲染:`ensurePreview(source)`/`getPreview()`/
    `waitForPreview()`,一個 Source 被放入 Slot 時才 lazy render(§12.5
    「只 render 目前使用中的頁面」),PDF 頁面重新 `pdfDoc.getPage()`
    (文件在 ref-count 存活期間本來就開著)、圖片則從
    `SourceBinaryStore` 原始 bytes 重新 decode(縮圖用的 bitmap 早已
    `close()`)。新增 `computeImagePreviewSize()`——圖片的
    `naturalWidth/Height` 是像素而非 pt(Phase 2 既有行為),沿用既有
    DPI-based `computePreviewCanvasSize()` 對圖片沒有意義,故另立一個只
    以 `maxLongEdgePx` 封頂的函式,見 decision_log D-012。
  - `src/preview.js` 新增 `computeSlotContentTransform()`(純函式,呼叫
    `geometry.js` 既有的 `slotContentMatrix()`,§6.3/§4.3 的唯一矩陣函式
    ——Phase 0 已提前寫好)與 `renderSlotContent()`(DOM adapter,寫入
    `<img>` 的 CSS `transform`);呼叫時 `slotX=slotY=0`,因為這個
    `<img>` 是掛在 `renderSlots()` 已經定位好的 `.pl-slot` 容器內,矩陣
    只需相對該容器自己的原點,Export(Phase 7)日後會用同一函式、換成
    絕對 slotX/slotY 呼叫,見 decision_log D-012。`renderSlots()` 同時
    補上 `overflow:hidden`(§6.6 裁切,Phase 3/4 只畫外框、當時還不需要
    裁切內容)。
  - `dev/placement.html` — Phase 5 dev harness:Source Gallery 縮圖可拖曳
    到 Slot 上(HTML5 Drag & Drop)、Properties Panel(Fit Mode 下拉、
    Scale 數字輸入、Rotate 90° 按鈕、Offset X/Y 滑桿、Flip X/Y 勾選、
    清除內容按鈕)、Undo/Redo。
  - 34 個新單元測試(共 191 個)+ 瀏覽器實測(Playwright:合成 3 頁 PDF
    含 `/Rotate 90` + 合成雙色 PNG,驗證 contain 置中留白/cover 填滿裁切/
    stretch 精確貼合三種 Fit 的實際 DOM bounding box、旋轉對調 fit 目標軸
    (§6.3,視覺確認 90° 旋轉圖片仍正確 fit)、Offset 滑桿拖曳收斂為單一
    undo 且一次 Undo 完整還原、Flip 鏡射、清除內容移除 DOM 節點並重置
    欄位、PDF 頁面與圖片兩種 Source 皆正確產生 §12.7 中解析度 Preview 且
    非同步就緒後自動換上)全數通過,細節見 decision_log D-012。

- Phase 4 遺留缺口補完(2026-08-05,Phase 5 完成後的完整性檢查發現):
  §10.3「鎖定／解鎖」與 §6.5「Z-order 操作」兩個 **[M]** 項目,plan.md
  §22 都列在 Phase 4 範圍內,但當時的實作只做了鎖定的**強制執行**與
  z 的**排序讀取**,從未提供任何方式能實際「切換鎖定」或「改變 z」——
  兩者形同虛設。已補上:
  - `src/free-layout.js` 新增 `setSlotLocked()`(雙向切換,不加限制)與
    `bringSlotForward()`/`sendSlotBackward()`/`bringSlotToFront()`/
    `sendSlotToBack()`(單一 Slot,重新映射為乾淨的 `0..n-1` z 值,對
    鎖定的 Slot 一律允許)。
  - `src/reducers.js` 新增對應 5 個 action creator。
  - `dev/free-layout.html` 新增 Lock/Unlock 與四個 Z-order 按鈕。
  - 13 個新單元測試(共 204 個)+ 瀏覽器實測(Z-order 四種操作逐一驗證
    排序位置;Lock 切換後以真實滑鼠拖曳確認強制執行仍正確生效、Unlock
    後恢復可動;鎖定/解鎖進入 Undo history 且可復原)全數通過。
  - 判斷點(單一 Slot 而非多選、z 語意為排序位置而非原始數值、鎖定不擋
    Z-order)見 decision_log D-013。

- Phase 6 Auto Imposition(2026-08-05):
  - `src/auto-fill.js` — 純函式:`applyFillRule(sourceIds, {order,
    filter, repeatCount})` 把 §11.2 的填版規則收斂成三個正交參數
    (order: sequential/reverse;filter: all/odd/even,依列表 1-based
    位置而非來源自己的 PDF 頁碼;repeatCount: 正整數,連續重複);
    `generateAutoFillPages()`/`generateAutoFillPageObjects()` 把展開後的
    id 序列依模板 Slot 數切成多頁,每頁 Slot 保留模板的全部
    fitMode/scale/rotation/offset/flip/z、只換 id 與 sourceId,空清單仍
    固定產生 1 頁(全清空,不是 0 頁);`detectMixedSourceSizes()` 供
    §11.4 UI 提示用。語意判斷點見 decision_log D-014。
  - `src/pages.js` — §11.3 Output Pages 管理:`addPage()`/`deletePage()`
    (只剩 1 頁時 throw,Project 不可以沒有任何頁)/`duplicatePage()`
    (連 Slot 內容一起複製,不同於 Template 的 §17.3 規則)/`movePage()`
    (索引超出範圍時 clamp)。
  - `src/reducers.js` 新增 `autoFillAction()`(取模板頁目前的 slots 版型,
    執行後在 `state.pages` 中原地整段替換成產生的新頁,其餘頁不受影響)
    與 4 個頁面管理 action creator。
  - `dev/auto-fill.html` — Phase 6 dev harness:Source Gallery(沿用
    Phase 2/5 引擎)、版型 Preset 下拉、順序/篩選/重複次數控制、Output
    Pages 面板(每頁縮圖 + Duplicate/Delete/上移/下移)、§11.4 混合尺寸
    提示。
  - 41 個新單元測試(共 238 個:auto-fill.js 17、pages.js 12、
    reducers.js 6)+ 瀏覽器實測(Playwright:合成 3 頁混合尺寸 PDF
    (A4/A3/`/Rotate 90`)+ 1 張合成圖片,透過真實 UI 以
    `repeatCount=30` 精確重現 §11.1 範例本身的數字——8 頁、最後一頁
    2 個來源 + 2 個空格;sequential/reverse/odd filter 皆用 4 個相異
    來源驗證;混合尺寸提示正確顯示;Duplicate/Delete/Move Up 頁面管理
    皆正確反映在 DOM 與 store 狀態)全數通過,console 無錯誤。

- Phase 7 PDF Export(2026-08-06):**產品核心價值與最大技術風險**。
  - `src/export.js` — `roundedPaperSizePt()`(§14.6 MediaBox 取整)、
    `computeSlotAbsoluteRectPt()`(Slot 絕對 pt 矩形)、
    `computeContentRotationAndSize()`(image 用像素、pdf-page 用
    `effectiveBoundingBox()` 的 RAW pt,合併 `slot.rotation +
    source.pageRotate`)、`computeExportContentMatrix()`(概念矩陣,僅供
    §23.3 等價性測試比對,不含 pdf-lib 特定修正)、
    `computeXObjectDrawMatrix()`(實際餵給 pdf-lib `cm` 運算子的矩陣,在
    概念矩陣之上疊加依 source kind 而異的座標系修正,見下方 D-016)、
    `computeExportClipRectPt()`(Slot 裁切矩形,Slot 本身不旋轉故僅需
    Y 翻轉)、`detectImageFormat()`(PNG/JPEG/WEBP magic bytes 偵測,不信
    檔名)、`embedSource()`(pdf-page 走 `PDFDocument.load` +
    `embedPage()`,`EncryptedPDFError` 轉換成明確錯誤訊息;image 视需要經
    `deps.transcodeWebpToPng` 轉碼後 `embedPng`/`embedJpg`)、
    `exportProjectToPdf()`(完整管線:依 `state.sources` 建索引、每頁依
    `sortByZOrder()` 排序 Slot、以 `embeddedBySourceId` Map 去重同一
    Source 的重複嵌入、用低階運算子 `pushGraphicsState → rectangle →
    clip → endPath → concatTransformationMatrix → drawObject →
    popGraphicsState` 而非高階 `drawPage()`/`drawImage()`,避免矩陣分解
    風險)。所有 pdf-lib API 皆經 `deps` 參數注入,orchestration 邏輯可在
    純 Node 測試,真實庫僅在專屬測試檔與瀏覽器中被呼叫。
  - **關鍵 bug 與修正**:`computeExportContentMatrix()` 原始實作(概念矩陣
    直接當作繪製矩陣)通過全部 104 個 §23.3 等價性測試與多項 byte-level
    測試,但實際以真實 pdf-lib 匯出、真實 pdf.js 重新渲染後畫面明顯錯誤
    (文字上下顛倒、圖片幾乎不可見)。根因:pdf-lib 嵌入的 XObject 有
    自己的原生座標系,與 `slotContentMatrix()` 假設不符——Image XObject
    是 [0,1]×[0,1] 單位正方形需要 rescale+flip,Form XObject(embedPage)
    是 Y-up、與 BBox 尺寸相同只需要 flip。透過系統化校準方法定位
    (四色象限測試圖/測試頁,對照 pdf-lib 自身高階 API 當作已知正確
    基準,逐一排除候選矩陣的符號組合)。修正方式:拆成
    `computeExportContentMatrix()`(概念、供等價性測試)與
    `computeXObjectDrawMatrix()`(pdf-lib 專用、供實際繪製)兩個函式,並
    針對這兩個校準後的精確矩陣數值加上永久回歸測試(純函式層級 +
    解析真實匯出 PDF 的 `cm` 運算子 byte 內容層級)。完整診斷過程見
    decision_log D-016。
  - **AppState.sources 缺口修正**:發現 Phase 2-6 從未有任何 reducer
    真正寫入 `AppState.sources`(Preview 一直只用 harness 端本地 Map),
    導致 `exportProjectToPdf()` 對已載入的 Source 仍拋
    「unknown source」錯誤。修正:`src/reducers.js` 新增
    `addSourceAction()`/`removeSourceAction()`,並回頭修改
    `dev/placement.html`、`dev/auto-fill.html`、`dev/export.html` 三個
    harness,載入 Source 時同步呼叫 `store.commit(addSourceAction(s))`。
    見 decision_log D-015。
  - `src/export-adapters.js` — 瀏覽器限定的 `transcodeWebpToPng()`,沿用
    `render-adapters.js` 的 `createImageBitmap` + Canvas 模式,但以原生
    解析度轉碼(不像 Preview 分層有上限)。
  - `dev/export.html` — Source Gallery(沿用 Phase 2/5 引擎)+ Auto Fill
    按鈕(沿用 `autoFillAction`)+ Export PDF 按鈕 + 驗證面板(以真實
    pdf-lib 重新載入輸出結果做結構檢查、以真實 pdf.js 重新渲染做視覺
    檢查)。
  - `scripts/fetch-vendor.sh` 擴充為同時抓取 pdf-lib
    1.17.1(`vendor/pdf-lib/pdf-lib.esm.js`,unpkg CDN 被 proxy 擋
    403,改用 npm registry tarball)。已驗證 pdf-lib 可在 Node 原生執行
    (不像 pdf.js 需要 Worker/DOM),故 `src/export-real-pdf-lib.test.js`
    直接動態 import 真實 pdf-lib、以 `{ skip }` 優雅跳過未抓取 vendor
    的環境。
  - 144 個新單元/整合測試(共 382 個:export.js 純函式測試、
    preview-export-equivalence.test.js 104 案例〔2 Source × 3 fitMode ×
    4 旋轉 × 4 翻轉組合 + 8 個 offset/scale 案例,EPSILON_PT=0.28〕、
    export-real-pdf-lib.test.js 5 個〔含解析真實 `cm` 運算子 byte 的
    回歸測試、8-Slot-1-XObject 去重測試、`/Rotate 90` 來源頁測試〕)+
    瀏覽器實測(Playwright:合成混合尺寸來源匯出、以真實 pdf-lib 重新
    載入確認 MediaBox/頁數/資源去重、以真實 pdf.js 重新渲染確認畫面
    正確——非僅靠自動化像素計數,人工檢視畫面才發現前述關鍵 bug)全數
    通過,console 無錯誤。

## Features In Development
Phase 8(列印路徑)尚未開始:列印一律經由匯出的 PDF(§15.1,不採用
`window.print()` 直接列印 DOM,避免第三套幾何實作)、列印校正頁
(§15.3,100mm×100mm 測試框供使用者確認印表機為 Actual Size)、Crop
Marks。見 `docs/plan.md` §15。

## Planned Features
見 `docs/plan.md` §22 開發階段。Phase 8 → Phase 11。

## Known Issues
- plan.md §9.1 的「2+2」preset 未定義其與 2×2 grid(=4up)的幾何差異,
  Phase 3 刻意未實作,見 decision_log D-010。
- 開發/測試環境(Playwright 內建 Chromium 141)無法 render pdf.js
  v6.2.108(呼叫尚未普及的 `Map.prototype.getOrInsertComputed`,拋
  `TypeError`)。已改用 `scripts/fetch-vendor.sh` pin 的 v5.4.149 供 Phase
  2+ 開發使用;`spike/fetch-vendor.sh`(v6.2.108)維持不動,僅為 Phase −1
  的歷史驗證記錄。之後 Phase(含 Phase 11 正式 build)選用 pdf.js 版本時
  需重新確認目標瀏覽器相容性,見 decision_log D-009。
- pdf.js v6(現行最新版)API 變更:`PDFDocumentProxy.destroy()` 已移除,改用
  `.cleanup()` 或 `loadingTask.destroy()`。`src/sources.js` 已採用新 API
  (`loadingTask.destroy()`),勿參考含 `pdfDoc.destroy()` 的舊教學。
- §9.3「水平/垂直分割」的方向命名、鎖定 Slot 混合選取時 Move 與其他操作的
  邊界、Snap 衝突時的取捨策略,plan.md 皆未明確定義,Phase 4 已依常見編輯
  器慣例自行決定並記錄假設,見 decision_log D-011。已修正 `store.js` 的
  history bug(reducer throw 時不得留下 history 記錄),見同一決議。
- Source 的 `naturalWidth/naturalHeight` 對 `kind: 'image'` 是**像素**、對
  `kind: 'pdf-page'` 是 **pt**(Phase 2 既有行為,見 decision_log D-012)。
  fit 計算本身是純比例運算故不受影響,但 §12.7 中解析度 Preview 的尺寸
  策略因此對兩種 kind 分別採 DPI 換算 vs. 純封頂兩套函式——若日後圖片
  需要「實際列印尺寸」語意(例如使用者輸入照片實體寬高),需回頭重新設計
  §5.2 的尺寸欄位,見 D-012 Future Review Conditions。
- Preview 的概念矩陣(`geometry.js` `slotContentMatrix()` + Y 翻轉)與
  Export 實際餵給 pdf-lib 的矩陣(`export.js`
  `computeXObjectDrawMatrix()`)並非同一個矩陣——兩者在數學上等價(同一個
  座標變換),但後者疊加了 pdf-lib 嵌入 XObject 原生座標系(image 單位
  正方形、pdf-page Y-up)所需的額外修正。若日後新增第三種 Source kind 或
  改用其他 PDF 函式庫,必須重新逐一校準這層修正,不能假設沿用既有公式,
  見 decision_log D-016。
- `AppState.sources` 在 Phase 2-6 期間從未被任何 reducer 寫入(Preview 全程
  只用 harness 端本地 Map),直到 Phase 7 才發現並修正(新增
  `addSourceAction`/`removeSourceAction`,回頭修改三個 dev harness)。若日後
  新增 Source 載入入口,務必同步呼叫 `addSourceAction`,否則 Export 會對
  該 Source 拋「unknown source」錯誤,見 decision_log D-015。

## Technical Architecture
Vanilla HTML5 + ES6+,PDF.js 負責解析與預覽,pdf-lib 負責輸出,esbuild 打包成
單一 IIFE HTML(僅 Phase 11)。三條不可違反的分離原則(plan §4):Layout
Model 與 DOM 分離、Slot 與 Source 分離、Preview 與 Export Renderer 分離但
幾何等價。所有單位換算、Y 軸翻轉、fit 與 transform 疊加集中於唯一的
`src/geometry.js`;`src/preview.js` 是第一個實際的 Preview Renderer,
`src/render-adapters.js` 是 Source Engine 的 DOM/PDF.js adapter,兩者都依此
原則把計算與 DOM/第三方庫寫入分開,讓 `src/sources.js` 的 orchestration 邏輯
可在純 Node 測試。`src/free-layout.js` 同樣是純 Slot 編輯邏輯、不碰 DOM,
`src/reducers.js` 是它與 `store.js` 之間唯一的接線層——Phase 4 是 `store.js`
(Phase 0 完成)第一次被真正的編輯操作使用,過程中也修正了它一個既有 bug
(reducer throw 時history 記帳未回滾,見 decision_log D-011)。Phase 5 的
`src/slot-content.js` 沿用同一種「純編輯原語 + reducers.js 接線」分層,
`src/preview.js` 的 `computeSlotContentTransform()` 是第一個實際呼叫
`geometry.js`(Phase 0 就寫好的)`slotContentMatrix()` 的 Preview 端
call site,§4.3「唯一 geometry 模組」的契約從「寫好但沒人用」變成「真正
被用上」;`src/sources.js`/`src/render-adapters.js` 補上 §12.7 中解析度
Canvas Preview 分層的實際渲染(Phase 2 只立好 `previewCache` 架子)。
Phase 6 的 `src/auto-fill.js`/`src/pages.js` 延續同一種「純函式 +
reducers.js 接線」分層,`autoFillAction()` 是第一個會一次改動
`AppState.pages` 陣列本身(而非單一頁面內的 slots)的 reducer,與既有
`updatePageSlots()` 的操作範疇並列但不重疊。開發期用
`scripts/dev-server.mjs`(http://)跑原生 ESM,`file://` 相容性只在
Phase 11 打包產物上驗證。Phase 7 的 `src/export.js` 是第一個真正呼叫
pdf-lib 的模組,同樣採「純函式 + deps 注入」分層:所有 pdf-lib API 呼叫
(`PDFDocument.create/load`、`embedPng/embedJpg/embedPage`、
`pushGraphicsState` 等低階運算子)只在 `embedSource()`/
`exportProjectToPdf()` 內部經 `deps` 參數呼叫,故 orchestration 邏輯
(去重、z-order、頁面迭代)可用 fake pdfLib 在純 Node 測試,真實 pdf-lib
只在 `export-real-pdf-lib.test.js`(guarded,vendor 未抓取則 skip)與瀏覽器
(`dev/export.html`)中被呼叫。§4.3「Preview/Export 幾何等價」的契約由
`preview-export-equivalence.test.js` 驗證兩者的**概念矩陣**一致,但這只能
證明雙方的矩陣數學互相一致,無法證明任一方對真實 pdf-lib 繪製語意是正確
的——這正是 D-016 那個關鍵 bug 能通過全部等價性測試卻仍視覺錯誤的原因,
最終靠人工檢視 Playwright 產生的畫面、而非自動化像素計數,才發現問題。

## Data Structure
AppState = Project / Sources / Templates / Pages(→ Slots)/ Selection / History。
Slot 採 normalized 座標(相對內容區 0..1),內部長度單位一律 pt(Source 的
`naturalWidth/Height` 例外,見上方 Known Issues 的圖片像素單位說明)。
原始檔案 bytes 存於獨立的 `SourceBinaryStore`(`src/binary-store.js`,Phase 2
已實作;不得被 PDF.js detach,plan §12.3),依 `docId` 保存、與 AppState 完全
分離,不進 store.js 的 undo history。Source 的 `docId` 欄位是兩者之間的唯一
連結(同一 PDF 檔案的所有頁 Source 共用一個 docId,見 decision_log D-009)。
Slot 的新增/移動/縮放/分割/合併/刪除/複製透過 `src/reducers.js` 的 action
creator 經 `store.commit()` 寫入,唯一合法的 mutation 路徑(§7.1)。Slot 的
內容關聯與 Fit/Scale/Rotation/Offset/Flip 透過 `src/slot-content.js` 的純
編輯原語、經同一批 `src/reducers.js` action creator 寫入(Phase 5)。
`AppState.pages` 陣列本身的新增/刪除/複製/重排透過 `src/pages.js` 的純
原語寫入;Auto Fill(`src/auto-fill.js`)一次性把指定的模板頁替換成多頁,
兩者皆經 `src/reducers.js` 接上 `store.commit()`(Phase 6)。
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
commit,見 decision_log D-009)、pdf-lib(開發用 1.17.1,同樣由
`scripts/fetch-vendor.sh` 取得,unpkg CDN 被 proxy 擋 403、改用 npm
registry tarball,見 decision_log D-015;Phase 7 起實際使用)、esbuild
(build 期)。不引入前端 Framework 與 SortableJS。`playbooks/` 目錄現為空
(2026-08-05 移除無關的 Python 打包 playbook)。

## Future Roadmap
第二階段(plan §16、§25):雙面列印/背面對齊、SVG、文字框、浮水印、Bleed、
Safe Area、Header/Footer、頁碼、進階對齊、快捷鍵、Template Library。
