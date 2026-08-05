# Project Overview

## Current State TL;DR (max 5 lines — Startup reads ONLY this block)
Visual Page Imposition Designer,public repo
https://github.com/cworkfox-source/pdfprint-layout。**Phase 0-5 已完成**
(geometry/store/model + paper/margin/zoom/print-CSS + PDF/圖片 Source
Engine + Layout Engine preset/自訂 Grid + Free Layout Designer(含補完的
鎖定/解鎖切換與 Z-order 操作)+ Source Placement 含 Fit/Cover/Stretch/
Rotation/Scale/Offset/Flip/Clip 與 §12.7 中解析度 Canvas Preview,204 個
單元測試 + 瀏覽器實測皆通過)。下一步:Phase 6 Auto Imposition(Auto
Fill、Page Generation、Repeat、Odd/Even)。無 blocker。

## Current Version
Plan v2.1(§5.2 補 docId 欄位、§9.1 補非對稱 preset 假設)/ Phase 5 完成
(含 Phase 4 遺留的鎖定/解鎖、Z-order [M] 缺口補完,見 D-013;無產品 UI,
僅引擎與 dev 檢查頁)

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

## Features In Development
Phase 6(Auto Imposition)尚未開始:Auto Fill、Page Generation、Repeat、
Reverse、Odd/Even、Empty Slot、混合尺寸處理。

## Planned Features
見 `docs/plan.md` §22 開發階段。Phase 6 → Phase 11。

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
開發期用 `scripts/dev-server.mjs`(http://)跑原生 ESM,`file://` 相容性
只在 Phase 11 打包產物上驗證。

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
