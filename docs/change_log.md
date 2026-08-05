# Change Log (append-only)

> Older entries: docs/logs/ (archive, do not load at startup)

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
