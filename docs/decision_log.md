# Decision Log

Required for: architecture, database, API, framework selection, major refactoring,
security strategy, deployment strategy. Append entries using the template in
`docs/templates.md`.

## D-001 — Repo 用途由治理範本改為 pdfprint-layout 產品 repo

### Date
2026-08-05

### Topic
專案定位

### Context
本 repo 原為「跨專案 AI agent 治理範本 + playbooks」的 docs-only repo,
`docs/spec.md` 明確寫「不寫任何可執行程式碼」。但 `docs/plan.md` 是一份要實作
前端應用的產品計畫,且未被 change_log 記錄過,與 spec 直接衝突。

### Alternatives Considered
A. 本 repo 轉為 pdfprint-layout 產品 repo,重寫 spec。
B. 視為誤放,把 plan.md 搬到另一個產品 repo,本 repo 維持治理範本。

### Selected Solution
A。使用者裁決。

### Reason
repo 目錄名即為 `pdfprint-layout`,產品意圖明確;治理範本 `AGENTS.md` 本身
可繼續作為本 repo 的規則檔使用,不需為此另開 repo。

### Consequences
- `docs/spec.md` 全部重寫;`AGENTS.md` Project Facts 全部重填。
- `playbooks/embeddable-python-packaging/`、`docs/templates.md`、
  `docs/bootstrap.md`、`docs/log_rotation.md` 成為與本產品無關的遺留物。
  依 Boundaries「刪除檔案需先詢問」予以保留,已記於 spec 未確認假設。
- 治理範本若日後仍需維護,須另行複製到獨立 repo。

### Future Review Conditions
若使用者決定清掉治理範本遺留物,或決定把範本抽回獨立 repo 時重新檢視。

## D-002 — Preview 與 Export 分離但強制幾何等價(唯一 geometry 模組)

### Date
2026-08-05

### Topic
架構 / 輸出正確性

### Context
plan v1.0 已要求 Preview Renderer 與 Export Renderer 分離,但只寫「分離」,
沒有要求兩者結果一致。兩個 renderer 各自實作 mm↔pt 換算、PDF 左下原點的 Y 軸
翻轉、fit 計算與 transform 疊加,結果必然飄移 —— 使用者看到的與印出的不同。
plan v1.0 亦未定義 transform 套用順序與 offset 單位,等於允許兩邊各自解釋。

### Alternatives Considered
A. 兩個 renderer 共用唯一 `geometry.js`,並以自動化腳本驗證四角座標等價。
B. 僅用 Export 結果回灌 Preview(以 PDF 當預覽來源)。
C. 維持各自實作,靠人工目視比對。

### Selected Solution
A。並在 plan §6 明確定義:內部單位一律 pt、Y 軸翻轉只允許存在於單一函式、
transform 矩陣順序 `T(slot)·T(offset)·T(+c)·R·S·F·T(-c)`、offset 單位為 Slot
寬高比例、旋轉中心為 Slot 中心、z-order 排序函式共用。

### Reason
B 會犧牲互動效能與編輯即時性;C 無法在 rotation × flip × offset × 來源
`/Rotate` 的組合下靠目視發現 0.5 mm 級誤差。A 的成本只在前期定義。

### Consequences
- 新增驗收條件 plan §23.3:四角座標差異 ≤ 0.1 mm,涵蓋 contain/cover/stretch ×
  rotation × flip × offset × `/Rotate`=90,且須為可重複執行的腳本。
- 任何模組不得自行做單位換算或 Y 翻轉;review 時應以此為檢查點。

### Future Review Conditions
若日後導入第三個 renderer(例如伺服器端輸出)時重新檢視。

## D-003 — 列印一律經由匯出的 PDF,不直接列印 DOM

### Date
2026-08-05

### Topic
輸出 / 列印架構

### Context
plan v1.0 §35 規劃以 `window.print()` 直接列印 DOM,與 PDF Export 並列為兩條
獨立輸出路徑。DOM 列印會產生第三套幾何實作,且受瀏覽器邊界、印表機驅動縮放
與「預覽用中解析度圖」影響,尺寸無法保證,與匯出的 PDF 不一致。

### Alternatives Considered
A. 列印時走 Export Renderer 產生 PDF → blob URL → 由瀏覽器 PDF Viewer 列印。
B. 維持 `@media print` + `@page{margin:0}` 直接列印 DOM。
C. 兩者並存,預設 A。

### Selected Solution
C 的簡化版:MVP 只做 A;B 降級為第二階段的「草稿列印」,且 UI 須標示
「尺寸不保證」。

### Reason
只有 A 能讓「列印」與「匯出」保證一致,§15.3 的 100 mm 校正頁才有意義 ——
校正的是印表機縮放,而非本工具的排版誤差。

### Consequences
- 新增驗收條件 plan §23.6:列印與匯出產生的 PDF byte 內容一致。
- 列印品質直接受 PDF Export 品質影響,Export 因此提前到 Phase 7。

### Future Review Conditions
若使用者實測發現瀏覽器 PDF Viewer 列印流程過於繁瑣時重新檢視。

## D-004 — 單檔離線 build 採 esbuild IIFE + Blob URL Worker

### Date
2026-08-05

### Topic
打包 / 部署策略

### Context
產品要求「雙擊 HTML 即可使用、不依賴 CDN/Server」。但 `file://` 協定下:
(1) Chrome 以 origin `null` 處理,`<script type="module">` 被 CORS 擋掉;
(2) PDF.js 的 Worker 需要獨立檔案,單檔無法提供;
(3) 各瀏覽器對 `file://` 下 Blob Worker 的行為不一致。
plan v1.0 同時要求「ES6+」「多檔 src/」「單檔輸出」,未指出此衝突,也未指定
bundler,且把 Standalone Build 排在最後一個 Phase。

### Alternatives Considered
A. esbuild 打包成 classic script(IIFE),PDF.js worker 原始碼內嵌為字串,
   以 Blob URL 建立 Worker。
B. 設定 `disableWorker = true`,在主執行緒解析 PDF。
C. 放棄單檔,改為需解壓的資料夾或需啟動 local server。

### Selected Solution
A,並新增 **Phase −1 可行性 Spike** 先行驗證;未通過才退回 C。

### Reason
B 會凍結 UI(大型 PDF 尤其嚴重)且新版 PDF.js 支援度差。C 直接違背產品定位,
只能作為 A 失敗後的退路。esbuild 為單一執行檔、輸出 IIFE 簡單可控,不需完整
node 生態。

### Consequences
- 開發期可用 dev server 跑 ESM,但 **build 產物必須是 classic script**;
  任何依賴原生 ESM 載入的第三方套件都不可引入(SortableJS 因此排除)。
- Phase −1 未通過前不得進入 Phase 0(plan §22)。
- 風險登記 R1 為產品形態的存亡風險。

### Future Review Conditions
Phase −1 Spike 結果出爐時;或未來瀏覽器放寬 `file://` 限制時。

## D-005 — 原始 bytes 與 PDF.js 分離保存(SourceBinaryStore)

### Date
2026-08-05

### Topic
架構 / 資料流

### Context
`pdfjs.getDocument({ data: buffer })` 會將 ArrayBuffer transfer 給 Worker 並
detach,原 buffer 隨即不可用。plan v1.0 §32 要求匯出時回頭用 pdf-lib embed
原始頁面,兩者直接衝突,會在 Phase 9 才以 `ArrayBuffer is detached` 爆出。

### Alternatives Considered
A. 檔案讀入後保存原始 bytes 於 SourceBinaryStore,交給 PDF.js 的是複本
   (`buffer.slice(0)`)。
B. 匯出時重新從 File 物件讀取一次。
C. 改用 PDF.js 的 `getData()` 取回資料。

### Selected Solution
A。並將此規則列為 **Phase 2 的驗收項目**,不得延後到 Phase 9。

### Reason
B 需保留 File 參照,使用者關閉/移動檔案後失效,且專案載入情境下無 File 物件。
C 多一次跨 Worker 傳輸與記憶體峰值,且相依於 PDF.js 內部 API。
A 的成本僅為一份 bytes 的記憶體,換取明確的資料所有權邊界。

### Consequences
- 記憶體約為原始檔案大小的 2 倍(原件 + Worker 內副本),已納入 §23.5 的
  500 MB 上限評估。
- Export 一律從 SourceBinaryStore 取件,不得向 PDF.js 索取資料。

### Future Review Conditions
若記憶體實測超標,或 PDF.js 改為不 detach 時重新檢視。

## D-006 — AGENTS.md Boundaries 新增 GitHub publish 例外,授權 agent 可 push

### Date
2026-08-05

### Topic
治理規則 / 部署權限

### Context
`AGENTS.md` 原本明訂「NEVER: run deploy/publish commands inside an agent
session」。使用者要求「自動發布到 GitHub」,兩者直接衝突。依 AGENTS.md 規則
本應停下來問,已詢問使用者三個選項(自行執行 / 修改 Boundaries 授權 agent /
只準備不動 git),使用者選擇修改 Boundaries。

### Alternatives Considered
A. 維持原 NEVER 規則,agent 只準備 git init / workflow,實際 push 由使用者
   自己執行。
B. 修改 Boundaries,新增範圍嚴格限定的例外(僅限單一 remote、禁止 force、
   禁止改寫歷史),授權 agent 可執行 push / 建 repo / 發 release。
C. 完全不處理 git,僅停在文件層級。

### Selected Solution
B(使用者明確選擇)。

### Reason
這是使用者對自己專案治理文件的正式修改,不是 agent 自行放寬規則;範圍被限定
在單一指定 remote,且 force push / 改寫歷史 / 刪除 log 歷史等既有 NEVER 規則
完全不受影響,風險可控。

### Consequences
- `AGENTS.md` Boundaries 新增「GitHub publish exception」段落,並要求每次
  push/release 後在對話中回報實際結果與 URL。
- 每次要 push 到其他 remote、或需要 force push / 改寫歷史時,仍必須回到
  「ASK FIRST」流程,不在本例外範圍內。
- Repo 可見性(public/private)變更需另外詢問,不含在本例外自動授權內。

### Future Review Conditions
若日後發現此例外被誤用(例如推到非預期 remote),應立即收回並改回 A。

## D-007 — 新增「手動更新檢查」功能,作為離線原則的唯一例外

### Date
2026-08-05

### Topic
架構 / 產品範圍

### Context
使用者要求「讓程式自動偵測是否有更新，讓使用者可以直接連線更新處理」,這與
剛在同一次審查中寫入 spec.md / plan.md 的「純前端、零後端、不依賴 Internet」
核心原則直接衝突。依 AGENTS.md「若任務與 spec 衝突需停下來問」,已詢問使用者
連線時機與更新機制,使用者選擇:僅手動點擊才連線、且不做自動安裝(顯示連結由
使用者手動下載取代)。

### Alternatives Considered
A. 完全不做,保持絕對離線。
B. 手動點擊才連線 GitHub Releases API 查版本,顯示下載連結,使用者手動取代
   檔案(使用者選擇)。
C. 每次啟動自動背景檢查。
D. 改做可安裝的桌面 App(如 Electron)才能真正自動下載安裝。

### Selected Solution
B。

### Reason
C 會讓「零背景網路請求」的承諾失真,且與 §20 隱私聲明衝突。D 是重大架構改變,
推翻「純前端單一 HTML、免安裝」的產品定位,超出目前範圍。B 把連網行為限定在
使用者主動觸發的單一動作,且範圍(僅查詢公開版本號)不涉及使用者檔案,對「離線
處理個人檔案」這個核心隱私承諾沒有實質影響。

### Consequences
- plan.md 新增 §19.4(功能規格)、§19.5(發布流程)、§23.8(驗收條件);
  §2.2、§19.3、§20 加註例外範圍。
- spec.md 新增驗收條件(未點擊前 Network 面板無請求)與「不做什麼」的例外注記。
- UI 必須明確標示「檢查更新」按鈕會連網,避免與「純離線」的宣稱矛盾。
- 此功能標記為 [S](第二階段),不阻塞 MVP。

### Future Review Conditions
若使用者之後想要真正的自動安裝(選項 D),需重新評估是否放棄純前端單檔定位。

## D-008 — Phase −1 Spike 確認可行,但改用手動 vendor 而非 esbuild(環境缺 Node)

### Date
2026-08-05

### Topic
架構驗證 / 開發工具鏈

### Context
使用者指示開始寫程式,依 plan.md 規則須先跑 Phase −1 Spike。動手時發現開發機
未安裝 Node.js/npm(`node`/`npm` 皆 command not found,`where.exe node` 也找不
到),而 D-004 指定的正式打包工具 esbuild 需要 Node。Spike 本身的目的只是驗證
`file://` 下 ESM/Worker/detach 三個問題,不必等 Node 裝好才能驗證。

### Alternatives Considered
A. 停下來,請使用者先安裝 Node.js,才能繼續。
B. Spike 階段改用 `curl` 直接下載 pdf.js / pdf-lib 官方預建產物,搭配一個不需
   Node 的 Python 腳本(`spike/build.py`)串接成單一 HTML,先驗證可行性;
   Node 缺口留到 Phase 11(真正需要 esbuild 的階段)再處理。
C. 放棄 esbuild,整個專案改用其他不需 Node 的打包方式。

### Selected Solution
B。

### Reason
A 會讓 Phase −1 這個「純粹回答可不可行」的問題被不相關的環境安裝工作卡住;
Phase 0～10 的開發也不需要 bundler(單一 HTML 組裝到 Phase 11 才需要)。C 尚無
證據顯示 esbuild 選擇有問題,不必现在推翻 D-004。B 用最小成本(下載 3 個官方
建置產物 + 一支 Python 腳本)拿到 Phase −1 的答案,且驗證出的技術手法(Blob URL
dynamic import / Blob URL module Worker)與正式 esbuild 產物的行為一致,不會
因為換了組裝方式而讓驗證結果失效。

### Consequences
- `spike/` 下新增 `app.js`、`template.html`、`build.py`、`fetch-vendor.sh`、
  `README.md`(皆 commit);`vendor/` 與 `spike/dist/` 不 commit(改 gitignore,
  可用 `fetch-vendor.sh` 重現,含版本與 checksum)。
- **Phase 11 開始前必須解決 Node.js 缺口**(安裝 Node,或改用其他方式取得
  esbuild),已記入 project_status.md Known Issues。Phase 0～10 不受影響。
- 過程中發現 pdf.js v6 API 變更(`PDFDocumentProxy.destroy()` 移除,改用
  `loadingTask.destroy()`),已在 spike 程式碼修正並加註解,Phase 2 Source
  Engine 實作時需採用同一 API。

### Future Review Conditions
Phase 11 開始前,或使用者決定要在此開發機安裝 Node.js 時重新檢視。

## D-009 — Phase 2 Source Engine:docId 設計、cropBox/mediaBox 取值範圍、開發用 pdf.js 版本改 pin v5.4.149

### Date
2026-08-05

### Topic
架構 / 資料模型 / 開發工具鏈

### Context
實作 Phase 2 Source Engine 時遇到三個 plan.md 未明訂細節的缺口:
1. §5.2 的 Source 物件沒有欄位指向 §12.3 SourceBinaryStore 的原始 bytes——
   一份多頁 PDF 產生多個 page-Source,但原始 bytes 只應存一份,需要某種
   共用 key。
2. §13.5/§14.4 要求 Preview 與 Export 都以 CropBox 為準,但 PDF.js 的公開
   `PDFPageProxy` API 只曝露一個已經是 CropBox∩MediaBox 結果的 `page.view`,
   不曝露獨立的原始 MediaBox。
3. 實測時發現本開發環境(Playwright 內建 Chromium 141)以 spike 選用的
   pdf.js v6.2.108 render 任何頁面都拋
   `TypeError: ...getOrInsertComputed is not a function`——v6.2.108 的
   `pdf.mjs` 直接呼叫了 TC39 尚在 Stage 2/3 的 `Map.prototype.
   getOrInsertComputed`,此開發環境的 V8 版本尚未支援。

### Alternatives Considered
(1) docId:
  A. Source 新增 `docId` 欄位,同一檔案的所有頁 Source 共用一個 docId,
     image Source 的 docId 等於自己的 id(1:1)。
  B. 用 `fileName` 當 key(可能重複、不穩定)。
  C. SourceBinaryStore 直接以 sourceId 為 key,每頁各存一份原始 bytes
     (記憶體浪費 N 倍)。

(2) cropBox/mediaBox:
  A. Phase 2 只用 `page.view` 同時填 cropBox 與 mediaBox 兩欄位(視為
     Preview 用的便利欄位),Export(Phase 7)重新從 pdf-lib 對
     SourceBinaryStore 的原始 bytes 取得權威的 MediaBox/CropBox 兩者,不
     依賴這裡存的值。
  B. Phase 2 就想辦法從 PDF.js 內部 API 挖出真正獨立的 MediaBox(依賴未公開
     行為,版本間不穩定)。
  C. Phase 2 直接用 pdf-lib 另外解析一次同一份 bytes 取得雙 box(多一次
     parse 成本,且 pdf-lib 在 Phase 2 階段還不需要引入)。

(3) pdf.js 開發版本:
  A. 開發/測試改 pin v5.4.149(不含該新 API),spike 既有的
     `spike/fetch-vendor.sh`(v6.2.108,Phase −1 驗證記錄)維持不動。
  B. 想辦法升級此環境的 Chromium。
  C. 全專案(含未來 Phase 11 正式 build)改 pin v5.4.149。

### Selected Solution
均選 A。

### Reason
docId 的 A 案是唯一同時滿足「多頁共用一份 bytes」與「圖片 1:1」且不引入額外
穩定性風險的做法,成本只是 model.js 多一個 nullable 欄位。cropBox/mediaBox
的 A 案符合 §14.4 本來就要求 Export 端權威來源是 pdf-lib 對 SourceBinaryStore
原始 bytes 的解析,Phase 2 沒有理由提前做 Phase 7 的事,且能維持公開 API,不
依賴 PDF.js 未公開內部結構。pdf.js 版本的 A 案把「這個開發環境的 Chromium
版本落後於 v6.2.108 所需的 V8 版本」與「Phase −1 已驗證通過的紀錄」分開處理
——不去動一份已經寫進 change_log/README 的歷史驗證證據,只在「目前開發用」
的新腳本換版本;B 不在 agent 控制範圍內;C 過早鎖死正式 build 的版本,且
v6.2.108 本身沒有其他已知問題,未來此環境 Chromium 更新後仍可能改回。

### Consequences
- `src/model.js` `createSource()` 新增 `docId`(nullable,預設 null);
  `docs/plan.md` §5.2 同步補上此欄位與註解。
- `src/sources.js` 對每個 docId 做 ref-count:同一 PDF 檔案的多個
  page-Source 共用一份 SourceBinaryStore bytes 與一個開啟中的 PDF.js
  document,最後一個引用它的 Source 被 release 時才真正 `binaryStore.
  remove()` 與 `loadingTask.destroy()`(已用 Playwright 實測驗證:刪除
  3 頁 PDF 中的 1 頁,doc 與 bytes 仍在;刪光才真正釋放)。
- Source 的 `cropBox`/`mediaBox` 兩欄位在 Phase 2 階段永遠相等(都來自
  `page.view`),**不得**被 Phase 7 Export 直接信任為權威 MediaBox——
  Export 必須照 §14.4 原文重新從 pdf-lib 對 SourceBinaryStore 的原始 bytes
  取得,這裡只是 Preview 階段的便利值,已在 `src/sources.js` 加註解防止
  未來誤用。
- 新增 `scripts/fetch-vendor.sh`(pin v5.4.149,供 Phase 2+ 開發/dev
  harness 使用),`spike/fetch-vendor.sh`(pin v6.2.108)維持原樣不變,兩者
  刻意分離、寫明各自用途避免互相覆寫時搞混。

### Future Review Conditions
Phase 7 Export 實作時確認 pdf-lib 是否真的能穩定取得獨立 MediaBox/CropBox
(若不行需回頭重新設計);此開發環境 Chromium 版本更新、或確認正式 Release
build 目標瀏覽器已支援 `Map.prototype.getOrInsertComputed` 時,重新評估是否
把 pdf.js pin 回 v6.2.108 或更新版本。

## D-010 — Phase 3 Layout Engine:非對稱 preset 的列/欄權重假設,以及「2+2」preset 不實作

### Date
2026-08-05

### Topic
架構 / 產品範圍

### Context
實作 Phase 3(plan.md §9.1 preset 版型)時,兩處 plan.md 沒有給出足夠幾何
定義:
1. §9.1 的 ASCII 示意圖(上2下1、上1下2)畫出上下兩塊大致等高,但沒有文字
   明確規定「上下兩列一定要等高」還是「依內容自動決定高度」。左1右2/左2右1
   則完全沒有示意圖,只有名稱。
2. §9.1 同時列出「3+1」「1+3」「2+2」三個 preset,語意與上2下1/上1下2 的
   命名法不一致(這兩個用「上/下」,那三個用數字加號),且「2+2」從名稱看
   不出與 2×2 grid(已存在的「4up」)有何幾何差異——兩者都是 2 列 2 欄。

### Alternatives Considered
(1) 列/欄權重:
  A. 固定「上下兩列(或左右兩欄)永遠等高/等寬,只有列/欄內部的格數不同」
     ——例如上2下1 = 上下各佔內容區高度的 50%,上列再依 topCols 均分寬度。
  B. 依格子數量比例分配高度(例如上2下1 的上列因為有 2 個格,分配比上面
     更多空間)。
  C. 開放使用者自行輸入每列高度比例(更彈性但 MVP 範圍外)。

(2)「2+2」:
  A. 不實作,列為未解決假設,文件中明確記錄。
  B. 猜測其為某種與 4up 不同的意涵(例如上下兩列高度不等)並自行定義。
  C. 直接視為 4up 的別名。

### Selected Solution
(1) 選 A。(2) 選 A。

### Reason
(1)A 案是從 §9.1 示意圖最直接、最不需要額外猜測的讀法(圖上兩塊看起來
大致等高/等寬),且對稱、可預期,符合「使用者不需理解傳統印刷拼版規則」的
產品定位(§1)——不等高的自動比例(B案)會讓使用者難以預測結果,C 案的
輸入 UI 超出 Phase 3 範圍(自訂比例更接近 Phase 4 自由版型的能力)。
(2)A 案符合本專案一貫做法(遇到 spec 缺口時記錄假設而非憑空定義產品行為,
見 spec.md「未確認假設」機制);B 案是無依據的猜測,C 案则會讓「2+2」這個
名稱變得沒有意義(使用者選了它卻得到跟 4up 一模一樣的結果,體驗上更像是
bug 而非刻意設計)。

### Consequences
- `src/layout.js` 的 `generateTopBottomSplit()`/`generateLeftRightSplit()`
  固定以 `splitAxis(..., [1, 1])` 二等分主軸,列/欄內部再依格數等分。
- `GRID_PRESETS`/`generatePresetSlots()` 不包含 `2+2`;`listPresetIds()`
  也不會列出它。UI(未來 Phase 18)若要提供「2+2」選項,需先回頭定義其
  幾何規則,不能直接照抄 4up。
- 已在 `src/layout.js` 註解、`project_status.md` Known Issues 記錄此缺口。

### Future Review Conditions
使用者對「2+2」給出明確定義,或對非對稱 preset 的列/欄高度分配規則有不同
要求(例如改成可調整比例)時重新檢視。

## D-011 — Phase 4 Free Layout Designer:分割方向命名、鎖定 Slot 的操作邊界、Snap 衝突時的選取策略,以及 store.js 一個既有 bug 的修正

### Date
2026-08-05

### Topic
架構 / 資料模型 / 程式碼修正

### Context
實作 Phase 4(plan.md §9.3-§9.5)時遇到三個 plan.md 缺口,以及在把
free-layout.js 接上 `store.js` 時發現一個既有實作缺陷:
1. §9.3「水平分割、垂直分割」沒有圖示,無法確定「水平分割」是切出上下兩塊
   還是左右兩塊。
2. §10.3 規定鎖定的 Slot「不得 Move / Resize / Delete」,但沒說多選中混雜
   鎖定與未鎖定 Slot 時,Move 操作該整體失敗還是只動未鎖定的部分。
3. §9.5 的吸附系統列出多種吸附目標(紙張邊界/中心、其他 Slot 邊與中線),
   但沒規定同一次拖曳中,如果 Slot 的起始邊、結束邊、中心線同時有各自的
   候選吸附目標時該吸附哪一個。
4. 撰寫 `free-layout.js` 的 reducer(`mergeSlots`/`deleteSlots`/
   `splitSlot*` 對非法操作會 throw)並接上 `store.commit()` 後,寫
   reducers.test.js 的整合測試時發現:`store.js` 的 `commit()` 在呼叫
   reducer **之前**就先把目前狀態 push 進 `past`、清空 `future`,若
   reducer 隨後 throw(例如合併非矩形選取),`past` 會留下一筆多餘的重複
   記錄、`future` 被錯誤清空——即使這次操作實際上完全失敗、狀態毫無變化。
   Phase 0-3 從未讓 reducer 會 throw,所以這個缺陷一直沒被觸發過。

### Alternatives Considered
(1) 分割方向命名:
  A. 依常見編輯器慣例(Word/Excel「分割儲存格」):分割線的方向決定名稱
     ——「水平分割」畫一條水平線,產生上下兩塊。
  B. 反過來:「水平分割」產生左右並排的兩塊(以最終排列方向命名)。
  C. 不用「水平/垂直」,改用「上下分割/左右分割」等無歧義字眼(但這樣
     偏離 plan.md 原文用字)。

(2) 鎖定 Slot 的多選操作邊界:
  A. Move:靜默略過選取中鎖定的成員(其餘正常移動);Resize/Delete/
     Split/Merge:只要目標包含鎖定 Slot 就整個操作失敗並 throw。
  B. 所有操作(含 Move)一律整個失敗並 throw。
  C. 所有操作都靜默略過鎖定成員,從不 throw。

(3) Snap 衝突時的選取策略:
  A. 同時比較「起始邊、結束邊、中心線」三個候選對齊目標,取需要調整量
     最小的那個。
  B. 固定優先序(例如永遠優先吸附起始邊)。
  C. 只吸附使用者當下實際拖曳的那個邊,不考慮中心線。

(4) store.js 的 history bug:
  A. 修正 `commit()`,先算出 reducer 的結果,成功後才動 `past`/`future`/
     `pendingCoalesceKey`。
  B. 保持現狀,要求所有 reducer 都不得 throw(把驗證邏輯挪到呼叫端)。

### Selected Solution
(1) A。(2) A。(3) A。(4) A。

### Reason
(1)A 案是最直觀、最少意外的讀法,且此慣例在中文輔助軟體 UI 也常見。
已在 `free-layout.js` 加註解明確記錄此假設,而非默默照字面猜測。
(2)A 案讓「拖曳整批選取」在混有鎖定項目時仍然有用(未鎖定的照常移動),
但更「重」的操作(刪除、分割、合併——這些通常是使用者主動、單一目標的
動作,誤觸的代價更高)則直接擋下並給明確錯誤,呼應 §10.3「避免誤操作」
的精神;B 案會讓「拖曳一批含鎖定項目的選取」完全動不了,體驗不佳;C 案
讓鎖定形同虛設,刪除/分割/合併鎖定 Slot 不會有任何警示。
(3)A 案讓吸附結果永遠是「視覺上調整幅度最小」的那個,符合使用者對吸附
的直覺預期(輕微超出目標時,吸附行為應該像「磁鐵」抓住最近的線,而不是
固定抓某一邊);B/C 案在 Slot 尺寸接近吸附間距時容易吸到使用者沒有預期
的邊。
(4)A 案是純粹的正確性修正,成本極低(重新排列兩行程式碼的執行順序),
且直接對應 Phase 4 才第一次出現的「reducer 需要能安全地拒絕非法操作」
需求;B 案會讓 Phase 4 起「驗證失敗時 throw」這個現有測試驗證過的模式
整個不能用,且驗證邏輯本來就該和它要保護的資料放在一起(reducer 內),
不該搬到每個呼叫端各自重複檢查。

### Consequences
- `src/free-layout.js`:`moveSlots()` 靜默略過鎖定 Slot;
  `setSlotRect()`/`deleteSlots()`/`splitSlotHorizontal()`/
  `splitSlotVertical()`/`mergeSlots()` 對鎖定目標一律 throw
  `Cannot ... a locked slot (§10.3)`。
- `src/free-layout.js`:`snapMoveAxis()` 同時試算起始邊/結束邊/中心線
  三個候選,取 `Math.abs(delta)` 最小者;`snapResizeAxis()`/`snapResize()`
  則只吸附呼叫端明確指定的那條邊(對應「使用者正在拖曳哪個 handle」,
  不需要在多個候選間取捨)。
- `src/store.js` `commit()`:改為先呼叫 `reducer(current, action)` 算出
  `nextState`,成功後才 `past.push(current)`/清空 `future`/更新
  `pendingCoalesceKey`,最後才寫入 `current`。新增 regression test
  (`store.test.js`:「a throwing reducer leaves history completely
  untouched」)與整合測試(`reducers.test.js`:merge 非矩形選取失敗後
  `store.getState()` 與 `historyDepth()` 完全不變,含物件參照相等)。
- `docs/plan.md` §9.1 已補充非對稱 preset 的等分假設(D-010),本次不再
  重複修改;分割方向的假設只記在程式碼註解與本決議,因 §9.3 原文本身
  未提供足夠細節可供精確改寫。

### Future Review Conditions
使用者對「水平/垂直分割」的實際方向有不同預期時(例如透過操作實測發現
與直覺不符)重新檢視;§9.5 加入參考線/Grid 吸附(Guides 資料模型)時,
需要決定它們與既有「起始邊/結束邊/中心線」候選集合的優先序如何合併。

## D-012 — Phase 5 Source Placement:圖片 Preview 尺寸單位、§12.7 中解析度 Canvas Preview 的實際渲染時機、Preview 端 slotContentMatrix 的座標原點取法

### Date
2026-08-05

### Topic
架構 / 資料模型 / 渲染

### Context
實作 Phase 5(plan.md §10.1/§10.2/§6.6)——把 Source 拖曳放入 Slot 並套用
Fit/Scale/Rotation/Offset/Flip/Clip——時遇到三個缺口:

1. Phase 2 的 `computePreviewCanvasSize(naturalWidthPt, naturalHeightPt, {targetDpi})`
   假設輸入是 pt(以 `targetDpi/72` 換算成像素),對 PDF 頁面正確(pdf.js
   `getViewport({scale:1})` 的寬高本來就是 pt)。但 `src/sources.js` 的
   `loadImageFile()` 從一開始(Phase 2)就把 `decodeImage()`(即
   `createImageBitmap()`)回傳的**像素**寬高直接指派給 `Source.naturalWidth/
   naturalHeight`,完全沒有 pt 換算——一張相片沒有內建的實體尺寸,只有
   像素數。Phase 2 的 fit 計算(`computeFitScale`,純比例運算)不受這個
   單位混用影響而沒被發現,但 Phase 5 若直接把 `computePreviewCanvasSize()`
   套用在圖片的像素寬高上,150 DPI 的換算(`×2.08`)對像素輸入毫無意義。
2. Phase 2 的 `previewCache`(§12.7 中解析度 Canvas Preview 分層)當時只是
   「立好架子」,程式碼註解明講「populated starting whichever later phase
   actually draws Sources onto the paper canvas」——但沒說這個 render 要
   在什麼時機觸發、從哪裡取得可重新 render 的來源(PDF 頁面 proxy 用完即可
   丟、圖片的 decode bitmap 在縮圖產生後已 `close()`)。
3. §4.3 規定 Preview 與 Export 都只能透過 geometry.js 的
   `slotContentMatrix()` 取得座標,不得各自實作——但 Phase 5 的 Preview
   是把內容 `<img>` 當成 DOM 子節點放進「已經被 `renderSlots()` 定位好、
   且已設 `overflow:hidden`」的 `.pl-slot` 容器裡,所以矩陣要用「相對容器
   自己 (0,0)」的座標,還是「相對整個內容區」的絕對座標,plan.md 沒有
   明確講(它假設的是單一扁平畫布,比較接近 Export 的情境)。

### Alternatives Considered
(1) 圖片 Preview 尺寸單位:
  A. 圖片維持像素單位,§12.7 的中解析度 tier 對圖片改用「單純以
     `maxLongEdgePx` 封頂、不足時保持原始像素、不套用任何 DPI 換算」的
     獨立函式(`computeImagePreviewSize`),PDF 頁面繼續用既有的
     `computePreviewCanvasSize`(DPI 換算)。
  B. 回頭把 `loadImageFile()` 改成也存 pt(例如假設 96 DPI 換算圖片像素
     為 pt),讓所有 Source 的 `naturalWidth/Height` 單位一致。
  C. 忽略單位不一致,直接讓圖片也走 `computePreviewCanvasSize()`(只是靠
     `maxLongEdgePx` 封頂救回不合理的放大結果)。

(2) §12.7 中解析度 Preview 的渲染時機:
  A. Lazy:一個 Source 被指派給某個 Slot(`setSlotSourceAction`)之後,
     由呼叫端主動呼叫 `engine.ensurePreview(source)`——對 PDF 頁面重新
     `pdfDoc.getPage()`(文件在 Source 存在期間本來就開著,§12.5/D-009 的
     ref-count 機制保證這點),對圖片則從 `SourceBinaryStore` 的原始
     bytes 重新 decode(而非依賴縮圖用完即關閉的 bitmap)。
  B. 在 Source 載入當下就順便 render 好中解析度版本(跟縮圖一起做)。
  C. 完全不做,Phase 5 的 Preview 永遠只用縮圖(200px 長邊),把
     `previewCache`/`computePreviewCanvasSize` 的實際串接留給更後面的
     Phase。

(3) Preview 端 `slotContentMatrix()` 的原點:
  A. 呼叫時 `slotX=slotY=0`(相對 Slot 自己的區域),回傳的矩陣直接當成
     該 `<img>` 的 CSS `transform`,平移量的單位沿用呼叫時傳入的 px 值;
     Export(Phase 7)日後改用真正的絕對 slotX/slotY 呼叫同一函式,
     兩者是「同一函式、不同呼叫參數」,不是兩套實作。
  B. 一律傳入絕對座標(相對整個內容區),讓 Preview 的 `<img>` 直接掛在
     內容區容器下,不掛在 `.pl-slot` 內部,另外用 CSS clip-path 而非
     `overflow:hidden` 做裁切。

### Selected Solution
(1) A。(2) A。(3) A。

### Reason
(1)A 案不需要改動 Phase 2 已經測試/上線的 `loadImageFile()` 行為
(不製造 D-009 之後的第二次「回頭改資料模型」),且誠實反映「圖片沒有
實體尺寸」這個事實,而不是像 B 案那樣編造一個任意的假想 DPI;C 案表面上
能動,但語意上「150 DPI」對像素輸入沒有意義,容易在日後被誤用。
(2)A 案完全符合 §12.5「Lazy Rendering……只 render 目前可見/使用中的
頁面」的精神——一個 Source 在被放進 Slot 之前根本不需要中解析度版本;
B 案會讓每個載入的 Source 都多一次 render 成本,即使使用者從未把它放進
任何 Slot(違背 Lazy 原則,也是 Phase 2 特意不做這件事的原因);C 案會讓
Phase 2 特地立好的 `previewCache`/`computePreviewCanvasSize` 一直是死碼,
且放大版 Slot 用 200px 縮圖會明顯模糊。
(3)A 案讓 Preview 端不需要重新計算「Slot 在內容區裡的絕對位置」——那份
計算 `renderSlots()`/`computeSlotPx()` 已經做過且已經定位好 DOM 容器,
重複計算是浪費也是雙重實作風險;更重要的是它保留了「唯一一個
`slotContentMatrix()` 函式,靠參數區分場合」的 §4.3 契約精神,Export
改一個參數就能重用,不必新增函式。B 案等於在 Preview 端提前解決 Export
才需要面對的「單一扁平畫布」問題,徒增複雜度,且 `overflow:hidden` 已經
是 Phase 3/4 一路沿用的裁切機制,沒有理由在 Phase 5 換掉。

### Consequences
- `src/sources.js` 新增 `computeImagePreviewSize(naturalWidth, naturalHeight,
  {maxLongEdgePx})`(純函式,只封頂不做 DPI 換算),與既有
  `computePreviewCanvasSize()`(DPI 換算,供 PDF 頁面用)並存,兩者呼叫處
  以 Source `kind` 區分,已在函式註解交叉引用本決議避免日後誤用。
- `src/sources.js` 的 `createSourceEngine()` 新增 `ensurePreview(source)`/
  `getPreview(sourceId)`/`waitForPreview(sourceId)`,與縮圖共用同一個
  `renderQueue`(§12.5 併發上限仍是全域一個,不是每層各自一個);
  `releaseSource()`(Phase 2 已寫好的邏輯,原本就會 release
  `previewCache`)不需改動即可正確運作。`src/render-adapters.js` 新增
  `renderPdfPagePreview()`(比照 `renderPdfPageThumbnail()`,改用
  `computePreviewCanvasSize`)與 `renderImagePreview()`(從
  `SourceBinaryStore` 原始 bytes 重新 `createImageBitmap()`,改用
  `computeImagePreviewSize`)。
- `src/preview.js` 新增 `computeSlotContentTransform()`(純函式,呼叫
  `geometry.js` 既有的 `slotContentMatrix()`,`slotX=slotY=0`)與
  `renderSlotContent()`(DOM adapter,將回傳矩陣寫入 `<img>` 的 CSS
  `transform`);`renderSlots()` 額外對每個 `.pl-slot` 設
  `overflow:hidden`(§6.6 裁切,先前 Phase 3/4 只畫外框、不需要裁切內容
  故未設)。
- `src/slot-content.js`(新檔案)只提供 `setSlotSource`/`setSlotFitMode`/
  `setSlotScale`/`setSlotRotation`/`rotateSlotContent`/`setSlotOffset`/
  `setSlotFlip`/`clearSlotContent` 這些 Slot 欄位層級的純編輯函式,刻意
  **不**檢查 `locked`——§10.3 原文只規定鎖定擋 Move/Resize/Delete,沒提到
  內容編輯,已在檔案註解記錄此範圍界定而非預設套用 D-011 的鎖定慣例。
  `clearSlotContent()` 額外決定把 Fit/Scale/Rotation/Offset/Flip 一併重設
  回 `createSlot()` 預設值(不只清 `sourceId`),讓下一次放入的新內容從
  乾淨狀態開始,不會繼承前一個內容調過的參數。
- `dev/placement.html`(新檔案,Phase 5 dev harness):Gallery 縮圖可拖曳
  到 Slot 上放置、Properties Panel(Fit/Scale/Rotate 90°/Offset 滑桿/
  Flip/清除內容),以 Playwright 實測(合成 3 頁 PDF 含 `/Rotate 90` +
  合成雙色 PNG)驗證 contain/cover/stretch 三種 fit、旋轉對 fit 目標軸的
  對調(§6.3)、Offset 滑桿拖曳的 History coalescing(§7.2,一次拖曳只
  產生一筆 undo)、Flip、清除內容會移除 DOM 內容節點且重置欄位、圖片與
  PDF 兩種 Source 都能正確走到 §12.7 中解析度 Preview。

### Future Review Conditions
Phase 7 Export 實作 `slotContentMatrix()` 的另一種呼叫方式(絕對
slotX/slotY)時,回頭確認兩處呼叫的參數差異只在原點、其餘欄位(fitMode/
scale/rotation/offset/flip)完全共用,佐證 §4.3 等價性契約沒有被打破;
若日後圖片 Source 需要「實際列印尺寸」(例如使用者輸入照片的實體寬高做
DPI 感知的排版),需要回頭重新設計 §5.2 Source 的尺寸欄位語意,而不是
繼續讓圖片停留在純像素單位。

## D-013 — Phase 4 遺留缺口補完:鎖定／解鎖切換、Z-order 操作(Phase 5 完整性檢查發現)

### Date
2026-08-05

### Topic
架構 / 產品範圍 / 補完既有 Phase

### Context
完成 Phase 5(Source Placement)後,依使用者要求「檢查是否有未完成部分」
逐條核對 plan.md 的 [M] 需求與現有程式碼,發現兩個標記 **[M] 必須**、但
Phase 4(由另一個 session 完成、經 fast-forward 併入本分支)完全沒有實作
的項目:

1. **§10.3「鎖定／解鎖」**:`free-layout.js` 只實作了鎖定的**強制執行**
   (`moveSlots` 靜默略過、`setSlotRect`/`deleteSlots`/`splitSlot*`/
   `mergeSlots` 對鎖定目標 throw,見 D-011),但整個程式碼庫**沒有任何
   函式能把 `slot.locked` 實際設成 true/false**——鎖定機制形同虛設,因為
   根本無法觸發它。
2. **§6.5「Z-order 與重疊」的 UI 需求**(「上移一層／下移一層／移到最上／
   移到最下」),且 plan.md §22 明確把「Z-order」列在 Phase 4 的範圍內。
   `geometry.js` 的 `sortByZOrder()`(Phase 0 就寫好、Preview/Export 共用
   的排序函式)只能「读」既有的 `z`,**沒有任何函式能修改 `z`**。

兩者都不屬於「Phase 5」本身在 §22 的範圍(拖曳放置、Fit/Fill/Stretch、
Rotation、Scale、Offset、Flip、Clip),是被合併進來的 Phase 4 工作遺漏,
且未被 decision_log D-011 或 project_status.md 的 Known Issues 記錄過。

### Alternatives Considered
(1) 鎖定／解鎖:
  A. 在 `free-layout.js`(既有鎖定強制執行邏輯的所在檔案)新增
     `setSlotLocked(slots, slotId, locked)`,不對「切換動作本身」加任何
     限制(必須能鎖也必須能解鎖,否則鎖定會變成單向陷阱)。
  B. 放進 `slot-content.js`(Phase 5 新檔案),理由是它也是「Slot 欄位
     編輯」。

(2) Z-order 操作的目標範圍:
  A. 只支援單一 Slot(`slotId`,不支援陣列)——比照多數設計工具
     (PowerPoint/Illustrator/Figma)把「上移一層/移到最上」當成單一物件
     的操作;「整組多選、同時上移並保留組內相對順序」是另一個更複雜、
     plan.md 原文完全沒有提及的需求。
  B. 支援多選(`slotIds` 陣列),比照 `moveSlots`/`deleteSlots` 的介面。

(3) Z-order 語意(「層」指什麼):
  A. 「層」= §6.5 `sortByZOrder()` 排序後的**位置**(z 升冪 + 陣列索引
     tie-break),每次操作後把整個排序重新映射回一組乾淨的 `0..n-1` z
     值——不管操作前的原始 `z` 數值是否連續(`duplicateSlots`/
     `mergeSlots` 本來就會產生任意大小的新 `z`)。
  B. 「層」= 原始 `z` 數值本身(例如 +1/-1),不重新映射。

(4) 鎖定的 Slot 能否被 Z-order 操作:
  A. 可以——§10.3 原文只點名 Move/Resize/Delete,沒提到繪製順序。
  B. 也一併擋下(比照其他鎖定限制)。

### Selected Solution
(1) A。(2) A。(3) A。(4) A。

### Reason
(1)A 案讓「鎖定的強制執行」與「鎖定的切換」留在同一個檔案,單一職責,
且不需要 Phase 5 的 `slot-content.js` 認識「鎖定」這個跟內容編輯完全無關
的概念;B 案會讓鎖定邏輯分散在兩個檔案,增加日後修改的認知負擔。
(2)A 案符合 plan.md 原文字面(§6.5 只寫「上移一層／下移一層／移到最上／
移到最下」,讀起來就是單物件操作,沒有「保留多選內部順序」這種額外語意);
B 案是憑空替 plan.md 加需求,且會讓實作與測試複雜度不成比例地增加。
(3)A 案確保操作結果對「Preview 與 Export 必須用同一 `sortByZOrder()`」
這個既有契約(§6.5)保持穩定——不管歷史上 `z` 被 `duplicateSlots`/
`mergeSlots` 弄出什麼奇怪的數值,Z-order 操作後永遠回到一組乾淨的
`0..n-1`;B 案(直接 ±1)在 `z` 本身有大間距或重複值時,可能導致「上移
一層」實際排序位置不變(因為新 z 值仍然小於下一個既有 z),使用者會覺得
按鈕沒有反應。
(4)A 案是最省事、也最貼近 §10.3 原文的讀法;B 案會讓「鎖定」的定義從
「防止誤觸的幾何變更」擴大成「凍結繪製順序」,原文沒有這層意思,屬於
過度推測。

### Consequences
- `src/free-layout.js` 新增 `setSlotLocked()`(無限制,可雙向切換)與
  四個 Z-order 函式:`bringSlotForward()`/`sendSlotBackward()`/
  `bringSlotToFront()`/`sendSlotToBack()`,皆為單一 `slotId`、皆呼叫共用
  的內部 `reorderSlotZ()`(取得 `sortByZOrder()` 排序 → 依操作重新排列
  id 列表 → 重新映射為 `0..n-1` 的 `z`)。四者對鎖定的 Slot 一律允許
  (不 throw)。
- `src/reducers.js` 新增對應 5 個 action creator(`setSlotLockedAction`/
  `bringSlotForwardAction`/`sendSlotBackwardAction`/
  `bringSlotToFrontAction`/`sendSlotToBackAction`),與既有 Free Layout
  action 共用 `updatePageSlots()`。
- `dev/free-layout.html`(Phase 4 dev harness)新增對應按鈕:單選時啟用,
  Lock 按鈕文字依目前鎖定狀態顯示「Lock」/「Unlock」;readout 補上 `z`
  欄位方便人工核對。
- 13 個新單元測試(`free-layout.js` 9、`reducers.js` 2 個整合測試,共
  204 個)+ 瀏覽器實測(Playwright:Bring to Front/Send to Back/Bring
  Forward/Send Backward 依序驗證排序位置;Lock 按鈕切換後,對該 Slot 的
  真實滑鼠拖曳確認完全不動,Unlock 後同一段拖曳確認恢復可動——證明新增的
  切換入口與 Phase 4 既有的強制執行邏輯正確串接;鎖定/解鎖進入 Undo
  history 且可正確復原)全數通過,console 無錯誤。
- `docs/project_status.md` 的 Phase 4 完成項目與「Phase 0-4 已完成」的
  TL;DR 表述已回頭補上這兩項(原本的表述不完全準確,因為兩個 [M] 項目
  當時其實缺漏)。

### Future Review Conditions
若日後需要「多選整組上移一層並保留組內相對順序」這種更進階的 Z-order
批次操作,回頭重新設計(2)的介面,而不是勉強用現有的單一 `slotId` 函式
疊加迴圈(疊加迴圈在多選情境下,「上移一層」對每個成員各自處理時,彼此的
相對順序可能被打亂,需要專門設計)。

## D-014 — Phase 6 Auto Imposition:填版規則語意、Auto Fill 對「模板頁」的取代方式、刪除最後一頁的防護

### Date
2026-08-05

### Topic
架構 / 產品範圍

### Context
實作 Phase 6(plan.md §11 自動填版)時遇到三個缺口:

1. §11.2 原文把「順序填入、逆序填入、僅奇數頁、僅偶數頁、每頁重複、每張
   重複 N 次」並列書寫,讀起來像六種互斥的填版模式,但唯一的驗收範例
   (「一張圖片 → 重複 8 次 → 填滿 A4」)只示範了「一個來源重複固定次數」
   這一種情境,從未示範「每頁重複」單獨是什麼意思、也未說明奇偶篩選是依
   「來源自己的 PDF 頁碼」還是「使用者選取列表裡的順序」。
2. §11.1「不足時自動新增 Output Page」沒有說明 Auto Fill 是把目前哪一頁
   當作「版型模板」,以及執行後那一頁本身變成什麼(被取代?被當成序列
   第一頁保留?)。
3. §11.3「刪除頁」與 Phase 4 的「刪除格位」情境類似:若允許刪光所有頁,
   AppState 會進入沒有任何 Page 可顯示/匯出的狀態,但 §11.3 原文未明訂
   是否需要「至少保留一頁」的下限。

### Alternatives Considered
(1) 填版規則語意:
  A. 把「順序/逆序」「僅奇數/僅偶數」「重複 N 次」視為三個**正交**參數
     (`order`、`filter`、`repeatCount`),各自獨立設定、疊加生效;
     filter 依「使用者選取列表裡的 1-based 位置」判斷奇偶(不依賴來源
     自己的 PDF 頁碼,因為列表可能混合多個檔案或純圖片,圖片沒有
     pageIndex)。
  B. 維持六個互斥模式(單選其一),各自獨立實作。
  C. filter 依來源自己的 `pageIndex`(僅 PDF 有意義,圖片來源需另外
     決定行為)。

(2) Auto Fill 對模板頁的處理:
  A. 讀取目前指定頁的 `slots` 版型(忽略其現有內容指派)當「模板」,執行
     後把該頁在 `AppState.pages` 中的位置,整段替換成新產生的 N 頁。
  B. 保留模板頁本身不動,產生的新頁全部插入在它後面。
  C. 要求使用者另外新建一個空白模板頁,Auto Fill 絕不觸碰既有頁面。

(3) 刪除最後一頁:
  A. `deletePage()` 在只剩 1 頁時 throw,擋下刪除。
  B. 允許刪光,`AppState.pages` 可以是空陣列。

### Selected Solution
(1) A。(2) A。(3) A。

### Reason
(1)A 案是唯一與 §11.2 那個具體範例(單一來源、固定重複次數)完全吻合、
又不需要無依據地替「每頁重複」單獨發明語意的讀法;B 案得先回答「每頁
重複」到底是什麼(原文沒給答案,等於是憑空定義);C 案在混合圖片與 PDF
頁的清單裡沒有一致的「頁碼」可用,必須額外規定圖片的替代行為,增加不必要
的複雜度,且與「填版對象是使用者挑選的一串來源,不是單一 PDF 檔案」的
§11.1 描述(「將 Source Gallery 的頁面依序放入 Slot」)更貼近的是列表
本身的順序,而非個別檔案內部的頁碼。
(2)A 案讓「先排好一頁喜歡的版面 → Auto Fill 套用到一整批」這個最自然的
使用情境成立,且直接對應 §11.1 範例的量詞算法(4-up 版型套用在 30 個
來源上 → 8 頁);B 案會讓「模板頁」本身變成一個內容不明、多出來的頁面,
使用者需要額外手動清掉;C 案增加一個多餘步驟,且與「不足時自動新增」的
措辭(暗示是就地擴充,不是另開新頁面)不符。
(3)A 案與 D-013 處理「刪除最後一個 Slot」時類似情境保持一致的防禦性設計
(雖然 §11.3 沒有像 §10.3 那樣明講,但一個沒有任何 Page 的 Project 在
語意上沒有意義——沒有東西可顯示、可匯出);B 案會讓後續 Preview/Export
的「至少要有一頁可畫」隱性假設在執行期才爆炸,晚於在 `deletePage()` 這裡
用一個明確錯誤訊息擋下。

### Consequences
- `src/auto-fill.js`:`applyFillRule(sourceIds, {order, filter,
  repeatCount})` 純函式,`order` ∈ {sequential, reverse}、`filter` ∈
  {all, odd, even}(依 1-based 位置、在 order 之後套用)、`repeatCount`
  為正整數(每個留下的 id 連續重複 N 次)。`generateAutoFillPages()` 把
  展開後的 id 列表依模板 Slot 數切成多頁,每頁的 Slot 保留模板的全部
  transform 欄位(fitMode/scale/rotation/offset/flip/z),只換
  `id`(每頁重新產生)與 `sourceId`;`sourceIds` 為空陣列時仍固定產生
  **恰好 1 頁**(全部清空),不是 0 頁。`detectMixedSourceSizes()` 供
  §11.4 UI 提示用,只讀不影響排版(排版本來就已經是逐格用該格自己
  Source 的尺寸計算 fit,無需額外處理)。
- `src/reducers.js` 的 `autoFillAction(templatePageId, sourceIds,
  fillOptions)`:取得指定頁目前的 `slots` 當模板,呼叫
  `applyFillRule()`+`generateAutoFillPageObjects()`,再用
  `Array.splice()` 把該頁在 `state.pages` 中的位置整段換成產生的新頁——
  其餘頁面(在它之前/之後的)完全不受影響。
- `src/pages.js` 新增 §11.3 的頁面管理原語:`addPage()`/`deletePage()`
  (只剩 1 頁時 throw)/`duplicatePage()`(連同 Slot 內容一起複製,不同於
  Template 的 §17.3 規則)/`movePage()`(索引超出範圍時 clamp,不 throw,
  方便 UI 拖曳重排不必自行夾範圍)。`src/reducers.js` 對應新增
  `addPageAction`/`deletePageAction`/`duplicatePageAction`/
  `movePageAction`。
- `dev/auto-fill.html`(新增,Phase 6 dev harness):Source Gallery(沿用
  Phase 2/5 的 `sources.js`/`render-adapters.js`)、版型 Preset 下拉、
  順序/篩選/重複次數控制、Output Pages 面板(每頁縮圖預覽 + Duplicate/
  Delete/上移/下移)、§11.4 混合尺寸提示。
- 41 個新單元測試(`auto-fill.js` 17、`pages.js` 12、`reducers.js` 6,
  共 238 個)+ 瀏覽器實測(Playwright:合成 3 頁混合尺寸 PDF + 1 張
  合成圖片,實際透過 UI 以 `repeatCount=30` 精確重現 §11.1 範例本身的
  數字——8 頁、最後一頁 2 個來源 + 2 個空格;sequential/reverse/odd
  filter 皆用真實 4 個相異來源驗證;混合尺寸提示正確顯示;Duplicate/
  Delete/Move Up 頁面管理皆正確反映在 DOM 與 store 狀態)全數通過,
  console 無錯誤。

### Future Review Conditions
若使用者對「每頁重複」給出與(1)A 不同的明確定義(例如證實它其實是
獨立於 repeatCount 之外的另一個維度),需要回頭重新設計 `applyFillRule()`
的參數形狀,而不是勉強塞進現有的三個正交參數。

## D-015 — Phase 7 PDF Export 架構:pdf-lib 在 Node 測試中直接可用、低階 operator 而非高階 drawPage/drawImage、AppState.sources 從未被寫入的缺口

### Date
2026-08-06

### Topic
架構 / 開發工具鏈 / 測試策略

### Context
實作 Phase 7(plan.md §14 Export Renderer)時遇到三個決定性的技術問題:

1. plan.md §21 指定 pdf-lib 為 Export 函式庫,但本專案至今(Phase 0-6)維持
   「零 npm 依賴、`npm test` 只靠 Node 內建 `node:test`」的慣例——Phase 2
   對 pdf.js 的處理方式是:核心邏輯完全靠假物件(fake `pdfjsLib`)在 Node
   測試,真正的 pdf.js 只在瀏覽器(Playwright)驗證,因為 pdf.js 需要
   Worker/DOM 環境。pdf-lib 是否也必須走同一條路?
2. §14.1 的管線要「套用 §6.3 矩陣」到 embedPage/embedImage 產生的內容,但
   pdf-lib 的高階 API(`page.drawPage()`/`page.drawImage()`)只接受
   `{x,y,xScale,yScale,rotate,xSkew,ySkew}` 這組參數,無法直接餵入
   geometry.js 現成的 6 值仿射矩陣(尤其 flip 需要負數 scale,高階 API
   未必支援)。
3. 實作 `dev/export.html` 時發現 `exportProjectToPdf()` 讀取
   `state.sources` 一律是空陣列——追查後發現 Phase 2-6 的每個 dev harness
   都只維護自己的本地 `sources` Map(供 Preview 查詢),從未呼叫任何
   reducer 把載入的 Source 寫進 `AppState.sources`,因為 Preview 一直只需要
   本地 Map 就夠用。`reducers.js` 裡從來沒有 `addSourceAction` 這種東西。

### Alternatives Considered
(1) pdf-lib 的測試策略:
  A. 直接驗證:`pdf-lib.esm.js`(npm 套件的 dist 產物)在純 Node 環境下
     實測(`node --input-type=module -e "..."`)確認核心 API(`create`/
     `load`/`save`/`embedPdf`/`embedPng`/`embedJpg`)完全不需要 Worker 或
     DOM,可直接在 `node:test` 中使用真正的函式庫,不需要像 pdf.js 那樣
     全靠假物件。`src/export.js` 本身仍不在模組頂層 import pdf-lib(維持
     deps 注入,§4.1),但測試檔案可以注入「真正的」pdf-lib。
  B. 比照 pdf.js 的做法,`src/export.js` 的核心邏輯一律只用假物件測試,
     真正的 pdf-lib 只在瀏覽器 Playwright 驗證。
  C. 把 pdf-lib 直接列為 npm `dependencies`(`npm install pdf-lib`),而非
     沿用 `scripts/fetch-vendor.sh` 的 vendor 拉取模式。

(2) 矩陣套用方式:
  A. 放棄 pdf-lib 的高階 `drawPage`/`drawImage`,改用其匯出的低階 operator
     建構函式(`pushGraphicsState`/`concatTransformationMatrix`/
     `drawObject`/`popGraphicsState`/`rectangle`/`clip`/`endPath`),直接把
     geometry.js 算出的 6 值矩陣以一個 `cm` operator 寫入內容流,裁切用
     `re`+`W`+`n`。
  B. 想辦法把 6 值矩陣分解成高階 API 能接受的
     `{x,y,xScale,yScale,rotate,xSkew,ySkew}` 參數組合。
  C. 放棄使用矩陣,改為針對每種 fitMode/rotation/flip 組合寫個別對應的
     高階 API 呼叫。

(3) AppState.sources 缺口:
  A. 在 `reducers.js` 新增 `addSourceAction()`/`removeSourceAction()`,並
     回頭補上 Phase 5/6 遺留的三個 dev harness(`placement.html`/
     `auto-fill.html`/`export.html`),讓每個載入的 Source 同時寫進本地
     Map(供這些 harness 自己的 Preview 查詢用)與 `store.commit()`(供
     Export/未來的 Project Save 用)。
  B. 只在 `export.html` 補,不動其他兩個既有 harness。
  C. 讓 `exportProjectToPdf()` 改成直接接受一個外部 Source 查找表
     (Map),不依賴 `AppState.sources`。

### Selected Solution
(1) A。(2) A。(3) A。

### Reason
(1)A 案在動手前先用一次性腳本直接驗證 pdf-lib 的 `dist/pdf-lib.esm.js`
在 Node 下能正常 `create`/`save`/`load`(zero import 語句,所有依賴——
pako、tslib、@pdf-lib/standard-fonts、@pdf-lib/upng——都已被打包進單一
檔案,不需要 Worker 或 DOM API),因此不必像 pdf.js 那樣被迫全靠假物件;
用真正的函式庫能寫出遠比假物件更有說服力的測試(§23.7 要求的「文字仍可
選取」「同一張圖只 embed 一次」等,靠假物件測不出真正的 PDF 位元組結構)。
B 案會白白放棄這個可行性,讓 Phase 7 的測試信心低於它本可以達到的水準。
C 案違背本專案「打包成單一離線 HTML、不依賴 npm 生態」的既有慣例
(decision_log D-004/D-008),且會讓 `node_modules` 出現在一個目前完全不需要
它的專案裡。
(2)A 案是唯一能保證「Export 用的矩陣就是 geometry.js 算出的那個矩陣,一個
值都沒有被重新拆解」的做法,直接消除「分解成高階參數時算錯正負號或漏看
flip」這整類風險;B 案在有 flip(負 scale)時是否可行取決於 pdf-lib 內部
如何處理負的 `xScale`/`yScale`,屬於未驗證的不確定行為,且分解三角函數
容易在浮點誤差與角度正規化上出錯;C 案會讓 Export 出現「N 個 fitMode ×
rotation 組合各自一套程式碼」的重複與遺漏風險,且完全放棄 geometry.js
「唯一矩陣函式」的既有投資。
(3)A 案是唯一真正修好缺口的做法,且與 D-013(Phase 5 稽核時發現 Phase 4
遺留缺口)是同一種情境——不回頭補其他 harness 只會讓下次某個功能又踩到
同一個坑;B 案留下技術債;C 案讓 `exportProjectToPdf()` 的簽章脫離 §5.1
「AppState 是唯一狀態來源」的設計原則,且無法滿足 Phase 9 Project Save/
Load 需要序列化 `state.sources` 的需求。

### Consequences
- `scripts/fetch-vendor.sh` 新增 pdf-lib 1.17.1(`dist/pdf-lib.esm.js`,從
  npm registry tarball 解出;unpkg CDN 在本環境被 proxy 擋下 403,改用
  `registry.npmjs.org` 的 tarball URL)至 `vendor/pdf-lib/`,與既有 pdf.js
  vendor 並列,同樣不 commit。
- `src/export.js` 完全不在模組頂層 import pdf-lib 或 vendor 任何東西——
  `exportProjectToPdf()`/`embedSource()` 透過 `deps.pdfLib` 注入,維持
  §4.1 的注入慣例,但測試檔案(`src/export-real-pdf-lib.test.js`)可以
  `await import('../vendor/pdf-lib/pdf-lib.esm.js')` 拿到真正的函式庫。
  此檔案在 vendor 未被 fetch 時,用 `test(name, {skip: reason}, fn)` 整檔
  優雅跳過並顯示提示訊息,而不是讓 `npm test` 在全新 clone 上失敗——
  `src/export.test.js` 的假 pdfLib 測試已經覆蓋同一批 orchestration 邏輯,
  真正的函式庫只用來做假物件做不到的位元組層級驗證。
- `src/export.js` 的繪製改用 pdf-lib 匯出的低階 operator
  (`pushGraphicsState`/`concatTransformationMatrix`/`drawObject`/
  `popGraphicsState`/`rectangle`/`clip`/`endPath`),繞過高階
  `drawPage`/`drawImage`,確保矩陣不被二次分解。
- `src/reducers.js` 新增 `addSourceAction()`/`removeSourceAction()`;
  `dev/placement.html`/`dev/auto-fill.html`/`dev/export.html` 三個既有/
  新增的 dev harness 全部回頭補上「載入 Source 時同時寫入
  `store.commit(addSourceAction(...))`」,不再只靠本地 Map。
- Phase 8(Print Path)、Phase 9(Project System)可直接沿用同一套
  pdf-lib 注入與 vendor 策略,不需要重新評估。

### Future Review Conditions
若日後升級 pdf-lib 版本後其 dist 產物開始依賴瀏覽器專屬 API(目前
1.17.1 未觀察到此問題),需要重新驗證 Node 直接可用性,必要時退回方案 B。

## D-016 — Phase 7 PDF Export:XObject 繪製座標系與 slotContentMatrix 假設不符的嚴重 bug,以及概念矩陣／繪製矩陣的拆分

### Date
2026-08-06

### Topic
架構 / 正確性 / 測試方法論

### Context
`computeExportContentMatrix()` 的初版實作(把 §6.2 的 `pdfPageFlipMatrix()`
接在 `slotContentMatrix()` 前面)通過了 §23.3 equivalence 測試的全部
104 個案例,也通過了一批只檢查頁數/MediaBox/文字可選取/資源去重的真實
pdf-lib 測試——但用 `dev/export.html` 實際跑一次「3 頁混合尺寸 PDF(含
`/Rotate 90`)+ 1 張圖片,4-up 版面」再以真正的 pdf.js 重新渲染輸出的
PDF 時,畫面明顯錯誤:文字全部上下顛倒、圖片幾乎完全消失(見對話中的
截圖與逐步排查記錄)。

逐一用 Playwright + 真實 pdf-lib + 真實 pdf.js 隔離測試後,精確定位出
兩個獨立、且與 `slotContentMatrix()` 完全無關的成因:

1. **圖片(`embedPng`/`embedJpg`)**:內嵌的 Image XObject 原生佔用的是
   **單位正方形** `[0,1]x[0,1]`,不是 `contentW x contentH`——pdf-lib 自己
   的高階 `drawImage()`/`drawPage()` 都是把單位正方形再另外 `scale()` 到
   目標像素尺寸,從未直接以 `contentW x contentH` 為單位繪製。直接把
   `computeExportContentMatrix()` 算出的矩陣(假設輸入範圍是
   `[0,contentW]x[0,contentH]`)當成 `cm` 值,會把圖片畫進一個近乎不可見
   的極小角落(實測:100×100 圖片撐滿 200×200 Slot 時,只有一塊 2×2pt
   的區域真正被畫到)。
2. **PDF 頁面(`embedPage`)**:Form XObject 的 BBox 確實與
   `contentW x contentH` 一致(`boundingBoxAdjustedMatrix` 只做平移,見
   `vendor/pdf-lib/pdf-lib.esm.js` 原始碼),但其座標系是 **Y 軸向上**
   (原始 PDF 頁面自己的原生座標系,未被改動),與
   `slotContentMatrix()` 假設的「內容本地座標為 Y 軸向下、左上角原點」
   (對應 Preview 用的點陣圖/CSS 慣例)方向相反——實測顯示:不修正的話,
   內容會整個垂直鏡射(用四色象限測試圖精確驗證,非籠統的「看起來怪怪
   的」)。

這揭露一個方法論層面的重要教訓:**§23.3 的 equivalence 測試只證明
Preview 與 Export「兩邊自己的矩陣數學互相一致」,完全無法證明任一邊
「相對於 pdf-lib 真正的繪圖語意是正確的」**——因為 equivalence 測試比較的
是兩個「用同一套(可能同時錯誤的)假設算出來的」矩陣,兩者一致並不代表
假設本身是對的。這正是本專案從 Phase −1 就決定「UI/繪圖相關程式碼必須用
真實瀏覽器/真實函式庫驗證,不能只靠單元測試」這條規則存在的理由,這次
是它在 Export 這一側第一次真正發威。

### Alternatives Considered
(1) 如何確認正確的修正公式:
  A. 用 Playwright 對照組實驗:分別用 pdf-lib 自己的高階
     `drawImage()`/`drawPage()`(視為已知正確的參考答案)與「我方低階
     matrix 方案的候選公式」畫同一張四象限測色圖,交給真正的 pdf.js
     重新渲染後逐色比對,直到候選公式與參考答案完全吻合為止——不接受
     憑手算/口頭推理就下結論(這次手算過程中我自己就推錯了兩次方向,
     若未經實測驗證會把錯誤的假設寫進正式程式碼與其文件註解)。
  B. 純靠閱讀 pdf-lib/PDF 規格書手動推導座標系慣例。
  C. 放棄矩陣繪製方式,改用 pdf-lib 高階 API 逐一嘗試,直到肉眼看起來
     正確為止。

(2) `computeExportContentMatrix()` 是否要包含 pdf-lib 專屬修正:
  A. 拆成兩個函式:`computeExportContentMatrix()` 維持「概念矩陣」
     (與 Preview 可比較、被 equivalence 測試使用,完全不知道 pdf-lib
     的 XObject 繪圖細節),新增 `computeXObjectDrawMatrix()` 在概念矩陣
     基礎上疊加 pdf-lib 專屬修正,只被 `exportProjectToPdf()` 使用。
  B. 直接讓 `computeExportContentMatrix()` 就地加上這些修正,equivalence
     測試改成比較「修正後」的矩陣。

### Selected Solution
(1) A。(2) A。

### Reason
(1)A 案是這次真正抓出 bug 的方法,且把「口頭推理」與「實測驗證」的落差
攤在陽光下——過程中我自己對「圖片是否需要額外翻轉」的判斷至少反覆修正
兩次,每次都是靠實測結果而非重新推理才發現前一次推理錯在哪裡,證明 B 案
（純手推）在這個問題上不可靠,C 案則放棄了「唯一矩陣函式」的既有架構
投資,且逐一試探高階 API 一樣需要肉眼/實測驗證,不會比 A 案省事。
(2)A 案讓 §23.3 那個「本專案最重要的一條驗收」保持純粹——它驗證的是
「Preview 與 Export 對『內容該出現在紙上哪個位置』的計算方式一致」,這個
問題本質上與「pdf-lib 的 XObject 內部怎麼定義它自己的原生座標系」無關,
硬要把兩者混在一起會讓 equivalence 測試失去單一職責,日後 pdf-lib 版本
更新若原生座標系定義有變,不應該連 Preview/Export 的概念一致性都要重新
驗證一遍。B 案省了一個函式,但把兩個不同層次的正確性(「位置算得對不對」
vs「怎麼把這個位置交給 pdf-lib 這個特定函式庫」)綁在一起,任何一邊改動
都會互相干擾。

### Consequences
- `src/export.js`:`computeExportContentMatrix()` 維持純概念矩陣(§23.3
  equivalence 測試持續使用,不受影響,104 個案例全數通過如初);新增
  `computeXObjectDrawMatrix()`,依 `source.kind` 疊加修正——圖片疊加
  `pdfPageFlipMatrix(contentH) ∘ scaleXY(contentW, contentH)`(先縮放
  再翻轉),PDF 頁面疊加單獨的 `pdfPageFlipMatrix(contentH)`;
  `exportProjectToPdf()` 改用 `computeXObjectDrawMatrix()` 的結果餵給
  `concatTransformationMatrix`。
- 新增的迴歸測試釘住這次實測校準出的精確數值,而非只驗證「有沒有規律」:
  `src/export.test.js` 兩個 `computeXObjectDrawMatrix()` 純函式測試(滿版
  stretch 情境下,圖片應得到 `[200,0,0,200,0,0]`、PDF 頁面應得到單位矩陣
  `[1,0,0,1,0,0]`);`src/export-real-pdf-lib.test.js` 新增一個測試,直接
  解碼真正輸出 PDF 的內容流、抓出實際寫入的 `cm` operator 六個數值,與
  `computeXObjectDrawMatrix()` 的計算結果比對,把「公式本身」與「pdf-lib
  實際吃到的位元組」串在一起驗證。
- `dev/export.html` 的 Playwright 驗證新增「四象限測色」與「文字位置」
  兩種真實渲染回讀檢查(見 change_log),往後任何人若打算「簡化」或
  「重構掉」`computeXObjectDrawMatrix()` 的兩個分支,都應該先重新跑這條
  瀏覽器驗證,而不是只看單元測試是否還過。

### Future Review Conditions
若 pdf-lib 升級版本後改變了 `embedPage`/`embedPng`/`embedJpg` 的
`boundingBoxAdjustedMatrix`/Image XObject 原生座標系定義,需要重新走一次
本決議(1)A 的實測校準流程,不能假設既有公式繼續適用。

## D-017 — Phase 8 Print Path:Crop Marks 的預設數值與繪製範圍、校正頁的固定紙張與英文文字、「列印」按鈕不是第三條算繪路徑

### Date
2026-08-06

### Topic
架構 / 產品範圍 / 視覺設計預設值

### Context
實作 Phase 8(plan.md §15 列印路徑、§16 Crop Marks)時遇到四個 plan.md
未明訂的缺口:

1. §16 表格只說 Crop Marks「可設定長度、與內容距離、線寬」,是 [M] 必備
   控制項,但完全沒給出這三個數值的預設值,也沒說 marks 要畫在「每個
   Slot 四角」還是「整張紙的外緣」。
2. §15.3 要求一個 100mm×100mm 校正框「含刻度與說明文字」,但沒說明這個
   校正頁本身要用哪種紙張尺寸(是否跟隨目前 Project 的紙張設定?)、要用
   哪種語言的說明文字。§16 另外明確指出 pdf-lib 標準字型不含中日韓字符,
   中文文字需要 fontkit 子集內嵌,且明訂這是「第二階段議題」。
3. §13.1 [M] 明訂 Preview Canvas 必須顯示「Slots、Source Preview、
   Guides、Crop Marks」,但 Crop Marks 這個功能本身要到 Phase 8 才存在
   ——它在 Preview 端是否也要跟著這次一起補上,還是可以先只做到 Export
   輸出裡就好,留到之後再補 Preview 顯示。
4. §15.1 明訂列印必須「以 Export Renderer 產生 PDF」再用瀏覽器內建 PDF
   Viewer 開啟,但「Print」按鈕實際上要不要在點擊當下才呼叫
   `window.print()`,還是把責任完全交給使用者在瀏覽器原生 PDF Viewer
   裡自己按列印,原文流程圖沒有明確到能直接照抄實作。

### Alternatives Considered
(1) Crop Marks 預設值與繪製範圍:
  A. 長度 5mm、間距(與內容/Slot 邊緣的距離)3mm、線寬 0.5pt 三個固定
     預設值;繪製範圍為**每個 Slot 的四個角**(不論該 Slot 是否已指派
     Source),因為這是一個拼版軟體,每個 Slot 本身就是使用者印完要裁下來
     的一個獨立單位,不是只在整張紙外緣畫一圈。
  B. 只在整張紙(paper)的四個外角畫一次 crop marks,沿用傳統印刷「一張紙
     只有一組裁切線」的慣例。
  C. 要求使用者在使用前必須自行輸入所有數值,不提供任何預設值。

(2) 校正頁的紙張與語言:
  A. 固定使用 A4 直式,與目前 Project 的紙張設定完全無關(校正頁的本質是
     「測試這台印表機/驅動程式有沒有偷偷縮放」,不是使用者版面的一部分);
     說明文字用純 ASCII 英文,不使用 fontkit 內嵌中文字型子集。
  B. 跟隨目前 Project 的紙張設定產生校正頁。
  C. 說明文字改用中文,順帶把 fontkit 一併引入。

(3) Crop Marks 是否也要補進 Preview:
  A. 這次一起補上:`preview.js` 新增 `renderCropMarks()`,重用
     `print.js` 的 `computeCropMarksForSlot()`(§4.3「唯一計算函式,兩個
     渲染端各自套用」的既有模式,不是又寫一份新的 crop-mark 幾何)。
  B. 這次只做 Export 輸出,Preview 端的顯示留到之後某個 Phase 再補,列入
     Known Issues。

(4) 「Print」按鈕的行為邊界:
  A. 只做到「呼叫 `exportProjectToPdf()` → Blob URL → `window.open()`」
     為止,不主動呼叫 `window.print()`——實際列印動作交給瀏覽器內建 PDF
     Viewer 自己的列印按鈕/快捷鍵。
  B. 額外在新分頁載入後自動呼叫該分頁的 `window.print()`。

### Selected Solution
(1) A。(2) A。(3) A。(4) A。

### Reason
(1)A 案是本工具「一次印出多份、印完裁開」這個核心使用情境下唯一合理的
語意——B 案的「整張紙外緣一組裁切線」是傳統單一版面印刷的慣例,套用在
N-up 拼版工具上使用者反而看不出每一格該從哪裡裁,C 案则讓 Crop Marks
預設關閉時仍然「有功能卻不能用」,增加不必要的操作摩擦,且與本專案一路
以來「所有 Phase 都提供一組合理預設值、讓使用者可以不填任何東西就先看到
效果」的慣例(paper margin、Auto Fill 的 order/filter 皆有預設)不一致。
(2)A 案把「校正印表機本身有沒有問題」與「使用者目前的版面設計」完全
切開,任何人在任何 Project 狀態下點擊都能拿到同一張可信賴的測試頁,B 案
會讓校正頁本身的可信度隨 Project 設定變動而變動,偏離它原本要驗證的東西
(印表機,而非版面);而 C 案在 §16 已經明文把中文字型子集列為第二階段
議題的前提下,若只為一頁校正頁就提前引入 fontkit,會顯著增加打包體積換取
一個與產品核心功能無關的頁面,不成比例。
(3)A 案維持本專案一路以來「一個座標/繪製函式,Preview 與 Export 各自帶
入自己的原點慣例」的既有紀律(D-012 的 `computeSlotContentTransform()`
即是同一套模式的前例)——§13.1 原文本來就把 Crop Marks 與 Slots 並列為
Preview 必須顯示的項目,拖到之後才補等同於讓「Phase 0-8 已完成」的說法
不完全誠實,與 Phase 5 完整性稽核之後建立的「不要遺留看得到的 [M] 缺口」
慣例衝突。
(4)A 案完全對應 §15.1 流程圖本身的字面意思——「由瀏覽器內建 PDF Viewer
列印」講的是使用者在那個 Viewer 裡自己觸發列印,不是我方程式碼代為呼叫；
B 案額外呼叫 `window.print()` 在多數瀏覽器對一個剛用 `window.open()`
開啟、內容還在非同步載入中的分頁上呼叫,行為並不可靠(可能印出空白頁或
被瀏覽器忽略),徒增一個未被 plan.md 要求、也難以自動化驗證正確性的動作。

### Consequences
- `src/model.js`:新增 `createCropMarksSettings()`(`enabled` 預設
  `false`、`lengthPt` 預設 `mmToPt(5)`、`gapPt` 預設 `mmToPt(3)`、
  `lineWidthPt` 預設 `0.5`),掛在 `createProject().cropMarks` 上(屬於
  §17.1 的 Project Settings,會隨專案存檔,非 Phase 9 才要處理的缺口)。
- `src/print.js`(新增):`computeCropMarksForSlot()`/
  `cropMarkSegmentsToPdfSpace()`(純函式,§16),
  `computeCalibrationPageContent()`/`exportCalibrationPagePdf()`(§15.3,
  deps 注入 pdfLib,與 `export.js` 同一種分層)。
- `src/export.js` 的 `exportProjectToPdf()` 在每頁 Slot 內容畫完後,若
  `state.project.cropMarks.enabled`,對該頁**每一個 Slot**(不論是否有
  Source)畫 crop marks,使用 pdf-lib 高階 `page.drawLine()`(不是
  `computeXObjectDrawMatrix()` 用的低階 operator——直線沒有 D-016 那種
  矩陣分解風險,沒有必要繞開高階 API)。
- `src/preview.js` 新增 `renderCropMarks()`,DOM adapter,重用
  `print.js` 的 `computeCropMarksForSlot()`,座標原點採用
  `computeSlotContentTransform()`(D-012)已建立的「content-area 本地座標」
  慣例,而非 Export 用的頁面絕對座標。
- `src/reducers.js` 新增 `setCropMarksAction()`,合併式更新
  `state.project.cropMarks`。
- `src/export-adapters.js` 新增 `openPdfBytesForPrint()`:Blob +
  `window.open()`,不呼叫 `window.print()`。
- `dev/print.html`(新增,Phase 8 dev harness):Crop Marks 控制面板
  (啟用開關 + 長度/間距/線寬輸入)、Print 按鈕、Print Calibration Page
  按鈕,驗證面板沿用 Phase 7 `dev/export.html` 的「真實 pdf-lib 重新載入 +
  真實 pdf.js 重新渲染」雙重確認模式。
- 21 個新測試(共 403 個,238 → 382 是 Phase 7、382 → 403 是本 Phase):
  純函式/fake 層級 17 個(`print.js` 9、`model.js` 3、`export.js` 3、
  `reducers.js` 2)+ 真實 pdf-lib 層級 4 個(`print-real-pdf-lib.test.js`
  3〔新檔案,guarded skip〕、`export-real-pdf-lib.test.js` 1 個 Crop Marks
  迴歸測試)+ 瀏覽器實測(Playwright:Preview 端 Crop Marks 開關
  正確增減 DOM 元素;Export 輸出以真實 pdf.js 重新渲染後,在紙張邊界內
  量得到 Crop Marks 的深色像素;Print 與 Export 針對同一個 store 狀態各自
  獨立呼叫 `exportProjectToPdf()`,產生的 PDF bytes 在排除
  `/CreationDate` 時間戳記欄位後完全一致,§23.6.2 成立;Print 與 Print
  Calibration Page 兩個按鈕皆確實開啟新分頁;校正頁的 100mm 方框在真實
  pdf.js 重新渲染的畫布上量得約 283–284px 寬,與 100mm 換算值吻合)全數
  通過,console 無錯誤(除瀏覽器對 `/favicon.ico` 的既有 404,與本 Phase
  無關,見驗證腳本註解)。

### Future Review Conditions
若日後新增 Bleed(§16 [S],第二階段)概念,Crop Marks 與 Slot 邊緣的
`gapPt` 語意需要重新檢視——屆時「與內容距離」可能要改成「與出血邊界的
距離」而非現在的「與 Slot 邊緣的距離」,不能假設現有的 `computeCropMarksForSlot()`
參數形狀繼續適用。若使用者明確要求校正頁改用中文說明文字,需要一併評估
引入 `fontkit` 的打包體積代價,而不是繞過 §16 已記錄的「第二階段議題」
自行決定。

## D-018 — Phase 9 Project System:project.json 信封格式、schemaVersion 遲到的版本號提升、來源重新比對(relink)策略、Template 套用語意、專案載入重置 History 而非走 reducer

### Date
2026-08-06

### Topic
架構 / 資料格式 / 產品範圍

### Context
實作 Phase 9(plan.md §17 專案與模板)時遇到五個 plan.md 未明訂、或實作
過程中才發現的缺口:

1. §17.1 只列出 project.json 必須包含的欄位清單(Project Settings、
   Paper、Pages、Slots、Transforms、Template 參照、Source Metadata),未
   規定實際 JSON 信封的巢狀結構,也未明訂 `AppState.selection`(純 UI
   狀態)是否要存檔。
2. 檢查後發現 Phase 8 為 `Project` 新增 `cropMarks` 欄位時,`SCHEMA_VERSION`
   常數仍停在 1 沒有跟著提升——這正是 §17.2「不得靜默忽略未知欄位」要
   防範的那種情況本身:同一個版本號底下,Project 的實際形狀已經悄悄變了。
3. §17.1 明訂「Source 二進位不內嵌…載入時若找不到來源,提示使用者重新
   指定原始 PDF/圖片,並以檔名＋頁數＋尺寸比對」,但沒有規定：當兩份
   候選檔案的檔名/頁數/尺寸都相同時(例如同名但內容不同的檔案覆蓋)要
   如何進一步分辨,也沒有規定重新載入後 Slot 對 Source 的參照(id)如何
   維持有效。
4. §17.3 只說 Template 保存 Paper/Margins/Slots,未規定「套用」一個
   Template 到既有頁面時,是與該頁現有內容合併,還是整段取代。
5. 檢查 `AppState.templates` 的實際使用狀況,發現自 Phase 0 至今從未有
   任何 reducer 寫入過它(`createAppState()` 只是把它預設成 `[]`)——與
   D-015 發現的 `AppState.sources` 缺口是同一類問題(資料模型欄位存在,
   但沒有任何寫入路徑)。另外,Undo/Redo 本身(store.js)自 Phase 4 起已
   實作並持續被使用,但「載入一個全新專案」這個動作該不該進入現有的
   Undo 歷史,plan.md 也未提及。

### Alternatives Considered
(1) project.json 信封格式:
  A. `{ schemaVersion, project, sources, templates, pages }`——
     `schemaVersion` 提升到最外層(唯一版本標記),`project` 物件本身不再
     重複帶自己的 `schemaVersion`(避免兩份版本號不同步);`selection`
     完全不存檔(比照 §7.3 排除 Zoom/Pan/選取進入 History 的同一個理由:
     純 UI 狀態,存檔沒有意義)。
  B. 直接把整個 `AppState`(含 `selection`)原樣 `JSON.stringify()`,
     `schemaVersion` 留在 `project.schemaVersion` 巢狀欄位裡,不額外提到
     最外層。

(2) SCHEMA_VERSION 遲到的提升:
  A. 現在補上:`SCHEMA_VERSION` 1→2,並撰寫 v1→v2 migration(補上
     `cropMarks` 預設值),當作「這個缺口本來就該在 Phase 8 做,現在
     補齊」處理,而非留到日後某次真正的 v3 才一次跳兩版。
  B. 維持 `SCHEMA_VERSION = 1` 不變,假裝 Phase 8 沒有讓 Project 形狀
     變過。

(3) Source relink 比對策略:
  A. 依「檔名 + 頁碼(pdf-page 專屬)+ 尺寸」比對候選,若儲存值與新載入
     值**兩邊都有** `contentHash`(§17.1 的「雜湊」欄位,Phase 9 新增,
     src/hash.js 用 Web Crypto `SHA-256`,瀏覽器與 Node 收斂為同一份原生
     API,不需要 deps 注入)則以雜湊作為最終判準——雜湊不符時即使檔名/
     頁碼/尺寸都吻合也視為不同檔案,拒絕比對;任一邊缺雜湊時退回只用
     檔名+頁碼+尺寸。重新比對成功後,保留「已存檔」那筆 Source 的原始
     `id`(讓 Slot.sourceId 參照持續有效),只把它的 `docId` 換成新載入
     檔案的 `docId`。
  B. 只比對檔名+頁碼+尺寸,不計算/不使用雜湊。
  C. 重新載入後產生全新的 Source id,並回頭改寫每個 Page 的每個 Slot
     的 `sourceId` 讓它們指向新 id。

(4) Template 套用語意:
  A. 整段取代(套用時同時替換 Page 的 `paper` 與 `slots`,清空該頁原有
     的所有內容指派),與 D-014 Auto Fill「整段取代模板頁」的既有先例
     一致;Slot id 全部重新產生(同一份 `duplicatePage()` 已用過的
     `createSlot({ ...slot, id: undefined })` 模式),避免同一個 Template
     被套用兩次時 id 互相碰撞。
  B. 與既有內容合併(只換 Paper/Slot 版型,盡量保留已指派的 Source)。

(5-a) AppState.templates 缺口:
  A. 補上 `saveTemplateAction()`/`deleteTemplateAction()`/
     `applyTemplateAction()` 三個 reducer,走既有 `store.commit()` 路徑,
     與 D-015 修 `AppState.sources` 缺口時的做法一致。
  B. 略過不修,留待更後面的 Phase。

(5-b) 「載入專案」是否進入 Undo 歷史:
  A. 新增 `store.resetWithState(newState)`,獨立於 `commit(reducer,
     action)` 之外:直接替換 `current`,同時清空 `past`/`future`/
     `pendingCoalesceKey`。載入一個(可能完全不相關的)專案是一次「情境
     切換」,不是從目前狀態衍生出的一次編輯,不應該讓 Undo 能夠「跳出」
     這次載入、回到另一個專案自己的編輯歷史裡。
  B. 把「載入專案」包成一個一般的 `loadProjectAction(newState)` reducer,
     透過 `store.commit()` 派送,讓它跟其他編輯一樣進入 Undo 歷史。

### Selected Solution
(1) A。(2) A。(3) A。(4) A。(5-a) A。(5-b) A。

### Reason
(1)A 案讓「版本號」只有一個位置需要檢查與提升,B 案的巢狀
`project.schemaVersion` 若未來又要在最外層加別的檔案層級中繼資料(例如
匯出時間戳、應用程式版本字串),會缺一個自然的容身之處,且巢狀版本號
容易在只改了外層的情況下被忘記同步。
(2)A 案的理由就是 Context 裡描述的那個情況本身——不補的話,§17.2
「必須含 schemaVersion」與「不得靜默忽略未知欄位」這兩條 [M] 驗收條件,
對「Phase 8 之後才存的專案」與「Phase 8 之前存的專案」其實已經名不副實
(兩者版本號相同但形狀不同),這正是版本欄位存在的意義被架空的實例;
B 案等於讓這個落差繼續存在,只是換了個方式視而不見。
(3)A 案是唯一同時滿足 plan.md 明文要求的「檔名＋頁數＋尺寸」比對與其
明文要求的「雜湊」兩者的做法,雜湊在兩邊都有時優先(也是唯一真正能
分辨「同名同尺寸但內容不同」這種情況的信號),但不強制要求(舊專案
存檔於 contentHash 加入之前,或某些歷史檔案可能缺這個欄位,不能因此
直接判定為不比對);B 案沒有用到 plan.md 明確點名的雜湊,遇到同名同尺寸
的不同檔案時無法分辨;C 案技術上可行,但意味著載入一個大型專案時要
遍歷並改寫每個 Page 底下每個 Slot 的 `sourceId`,比起「保留舊 id、只換
docId」複雜且容易在某個巢狀層級漏改,A 案讓 Slot 完全不需要知道
relink 這件事發生過。
(4)A 案與 D-014 已建立的「Auto Fill 整段取代模板頁」先例一致,使用者
心智模型統一(套用一個現成版型 = 用它換掉目前這頁,不是疊加);B 案的
「合併」語意含糊(哪些 Slot 該保留?依什麼規則配對新舊 Slot?),
plan.md 完全沒有給出可據以實作的規則,勉強決定等於是自己發明一整套
未經驗證的合併演算法。
(5-a)A 案理由與 D-015 完全相同:這是資料模型已經存在、卻沒有任何寫入
路徑的真實缺口,不是假設性的。
(5-b)A 案符合直覺的使用者心智模型(開啟另一個專案檔案,不應該還能
「復原」回到前一個開啟中的專案),也避免 Undo 歷史裡累積一份完全無關
專案的大型 snapshot(上限 50 步,可能因此浪費可觀記憶體);B 案技術上
可行(`commit()` 本身足夠通用,一個忽略舊 state、直接回傳新 state 的
reducer 就能做到),但沒有任何好處抵銷「使用者可以 Undo 回到另一個
專案」這個令人困惑的副作用。

### Consequences
- `src/model.js`:`SCHEMA_VERSION` 1→2;`createSource()` 新增
  `contentHash` 欄位(預設 `null`)。
- `src/hash.js`(新增)——`computeContentHash(bytes)`,直接呼叫
  `crypto.subtle.digest('SHA-256', ...)`,不需要 deps 注入(這是本專案
  第一個「第三方能力邊界」檔案不需要注入/adapter 分層的案例,因為
  Web Crypto 是瀏覽器與 Node 收斂為同一份 API 的少數例外,已直接在
  這個 Node 版本驗證過)。
- `src/sources.js`:`loadPdfFile()`/`loadImageFile()` 各自對整份原始
  bytes 算一次 hash(同一 docId 的所有頁共用同一個值),寫入每個
  Source 的 `contentHash`。
- `src/project-file.js`(新增)——`serializeProject()`(輸出上述信封
  格式)、`migrateProjectData()`(v1→v2,補上 `cropMarks` 預設值,拒絕
  比目前 app 支援版本更新的檔案)、`deserializeProject()`(migration +
  透過 `createSource()`/`createTemplate()` 重新驗證,遇到損毀資料——例如
  Template 缺少必填的 `name`——直接拋錯而非靜默接受)、`relinkSources()`
  (依檔名+頁碼+尺寸+雜湊比對,保留舊 id、換新 docId)、
  `findMissingSourceIds()`(供 UI 提示用)。
- `src/pages.js`:`applyTemplateToPage(page, template)`——整段取代
  paper+slots,slot id 全部重新產生。
- `src/reducers.js` 新增 `saveTemplateAction()`/`deleteTemplateAction()`/
  `applyTemplateAction()`。
- `src/store.js` 新增 `resetWithState(newState)`——替換 state 並清空
  `past`/`future`/`pendingCoalesceKey`,獨立於 `commit()` 之外,是 Phase 9
  才需要的第二種「改變目前狀態」入口(仍是唯一由 `store.js` 自己管控的
  入口,§7.1 精神不變——外部依然不能繞過 store 直接改物件)。
- `src/project-adapters.js`(新增)——`downloadProjectJson()`/
  `readProjectFile()`,瀏覽器限定的薄 DOM 層,同 `export-adapters.js`
  的分層慣例,無對應單元測試。
- `dev/project.html`(新增)——Phase 9 dev harness:Save Project、Load
  Project(含「請重新選取來源檔案」的第二階段流程)、Save as Template、
  Apply Template、Undo/Redo 按鈕與 history 狀態顯示。

### Future Review Conditions
若 Slot 或 Page 未來新增欄位(目前自 Phase 0 起兩者形狀都沒變過),
`migrateProjectData()`/`deserializeProject()` 需要往下深入 pages/slots
層級做欄位遷移,不能假設只有 `project` 物件會變。若日後真的需要「合併」
語意的 Template 套用(而非整段取代),需要先有一個明確的配對規則來源
(例如依 Slot 在陣列中的位置配對),不能沿用 D-014 的複製取代前例硬套。

## D-019 — Phase 10 Print Aids 進階與第二階段功能:Bleed/Safe Area 模型、Watermark 置中與旋轉數學、Text Box 與 Source 系統分離、ASCII-only 文字範圍、SVG 光柵化策略、Align/Distribute 語意、Template Library 內容

### Date
2026-08-06

### Topic
架構 / 產品範圍 / 幾何數學

### Context
plan.md §16(Bleed/Safe Area/Header-Footer/Page Number/Text Box/浮水印)、
§17.3(Template Library)、§9.6(Align & Distribute)、§18.3(鍵盤快捷鍵)、
以及 §5.2/§14(SVG Source)在 Phase 10 一次性補齊。這些條目多半只列功能
名稱與優先級,幾乎不含具體數值或演算法,實作過程中累積了以下八類需要
記錄的判斷:

1. §16 Bleed 只說「0/1/2/3mm/自訂」,沒說出血實際如何影響匯出幾何。
2. §16 Safe Area 明訂「僅畫面預覽,不列印、不匯出」,但沒說 Preview 端
   如何呈現、預設邊距多少。
3. §16 浮水印「文字／圖片;透明度、位置、角度、大小」中的「位置」未給
   選項清單;而浮水印的旋轉若要在 Preview(CSS,Y-down)與 Export
   (PDF,Y-up)之間視覺一致,牽涉到 D-002/D-016 已定調的「唯一 geometry
   模組」慣例是否也適用於這個全新的、不依附 Slot 的元素。
4. §16「文字框 Text Box」與 §5.2 既有的 `'text'` Source kind stub 是否
   為同一件事,需要先釐清才能決定資料模型放哪裡。
5. 使用者已於本次對話明確決定:Text Box/浮水印文字先只支援 ASCII(不加
   `fontkit`)——這裡記錄該決定的技術背景與後續解除條件。
6. §14 表格只說「pdf-lib 不支援 embed SVG——需光柵化或轉路徑」,未給
   光柵化解析度。
7. §9.6 只列功能名稱(左/右/上/下對齊、水平/垂直置中、等寬/等高/等
   尺寸、水平/垂直平均分布),未定義對齊基準與「平均分布」是「等間距
   中心」還是「等間距邊緣」。
8. §17.3 的 4 個範例 Template 名稱(`A4_上2下1`、`A4_照片4格`、`A3_6格`、
   `證件照8格`)只給名稱,無版面細節;`證件照8格` 更不是 §9.1 任何一個
   已命名 preset。

### Alternatives Considered
(1) Bleed 的匯出語意:
  A. 只放大 Slot 的 CLIP 邊界(export.js `computeBleedClipRectPt`),內容
     的 fit-scale/定位完全不變——'cover' fit 因為本來就會溢出而露出出血
     區,'contain' fit 沒有溢出可露出(已知限制,不嘗試連動放大內容)。
  B. 連 Slot 本身的定位/縮放矩陣都跟著放大,讓所有 fit 模式都「填滿」
     出血區。

(2) Safe Area 呈現:
  A. Preview 專屬的虛線內縮引導線(`renderSafeAreaGuide`),完全不進入
     export.js 任何函式——與 Bleed 共用同一個 `offsetRect()` 正負號雙用
     原語(正值外擴、負值內縮)。
  B. 另外設計一套獨立的內縮幾何函式。

(3) Watermark 位置與旋轉:
  A. MVP 只支援「置中」(不做位置下拉選單)——§16 舉的典型內容(草稿/
     COPY/案件編號/日期)全部是置中對角圖章慣例,無一是角落浮水印。
     旋轉數學比照 Slot 內容的既有模式:先在 Y-down model space 用
     `rotateDeg()`(不手動反轉正負號)組出「置中 + 旋轉」矩陣
     (`computeWatermarkMatrix`,可直接被 Preview 的 CSS `matrix()` 使用),
     Export 端再組合 `pdfPageFlipMatrix()` 一次,和 Slot 內容完全同一套
     手法(D-016 的低階 operator 路徑,而非 pdf-lib 高階 `drawText`/
     `drawImage` 的 `rotate:` 選項——後者的旋轉樞紐點是文字/圖片自身的
     (x,y) 錨點而非視覺中心,且 Y-flip 疊加旋轉後行列式為 -1,不再是
     單純旋轉,高階選項無法表達,兩點在 export-real-pdf-lib.test.js 已
     用真實 pdf-lib 驗證:90° 旋轉的 `cm` 矩陣 b 分量確實 ≈ ±1)。
  B. 提供完整位置下拉(9 宮格),旋轉直接呼叫 pdf-lib 高階 API 的
     `rotate:` 選項並手動試錯正負號。

(4) Text Box 的資料歸屬:
  A. Page 上獨立的 `textBoxes[]` 陣列(`model.js` `createTextBox`),不
     經過 Source/Slot 系統——文字排版(對齊/自動置中)與圖片的
     fit-scale 縮放語意本質不同,勉強共用 `slotContentMatrix` 的 fit
     邏輯只會製造混淆。§5.2 的 `'text'` Source kind 維持未實作,留給
     未來「把一頁純文字當成可拼版來源頁面」這個不同的構想。
  B. 把 Text Box 實作成「一個內容為 `kind:'text'` Source 的特殊 Slot」,
     完全重用 Slot 的 fit/rotation 機制。

(5) 中文字型支援範圍:
  A.(使用者本次對話明確選擇)先只支援 ASCII,不加 `fontkit`——沿用
     Phase 8 校正頁的既有先例(D-017),避免現在就為單檔離線體積(§19)
     背上字型子集內嵌的重量。StandardFonts 對非 WinAnsi 字元會自行
     throw,不需要額外的輸入驗證邏輯。
  B. 現在就加入 `fontkit` 依賴,支援中文輸入。

(6) SVG 光柵化解析度:
  A. 以來源自身 intrinsic size(解析 `<svg>` 根標籤的 width/height 或
     viewBox,`parseSvgIntrinsicSize()`)為基準放大 4 倍
     (`SVG_RASTER_SCALE`),長邊上限 3000px(`SVG_RASTER_MAX_LONG_EDGE_PX`)
     ——不知道實際匯出時 Slot 有多大,4 倍是「印刷品質但不失控」的經驗
     值,而非依 Slot 實際尺寸動態計算(那需要更動 `embedSource()` 簽章,
     且同一個 Source 被多個不同大小的 Slot 共用時,§14.5 的「每個 Source
     只 embed 一次」去重規則會與「依 Slot 大小客製解析度」互相衝突)。
  B. 更動 `embedSource()`/`exportProjectToPdf()` 讓每個 Slot 各自以自己
     的實際輸出大小光柵化 SVG(放棄跨 Slot 共用同一份 embed 結果)。

(7) Align/Distribute 語意:
  A. 對齊基準一律用「選取範圍自身的 bounding box」(min/max),不是「以
     某一個成員為錨點」——上/下/左/右對齊時兩者數學上等價(極值本身就是
     極值 Slot 的邊),但水平/垂直置中時採用 bounding-box 中心(業界慣例,
     如 Figma/Illustrator),不是任一成員自己的中心。等寬/等高/等尺寸取
     `slotIds` 陣列**第一個**目標的尺寸為準(陣列順序,非點擊順序——這層
     不知道使用者點擊順序)。平均分布採「等間距邊緣」(distribute
     spacing,首尾不動、中間依邊對邊間距等分),不是「等間距中心」——
     前者對不同尺寸的混合選取不會產生重疊,是更常見的專業工具慣例。
  B. 對齊以「使用者選取的第一個/最後一個 Slot」為錨點;平均分布採等間距
     中心。

(8) Template Library 內容:
  A. 全部透過既有的 §9 Layout Engine 純函式(`generatePresetSlots`/
     `generateGridSlots`)產生,不手刻座標——`證件照8格` 因為不是任何
     已命名 preset,改直接呼叫 `generateGridSlots(rows:2, cols:4)`(與
     §9.2 自訂 Grid 走同一條路徑),且明確記錄它是「均分 4×2 網格」而非
     真正符合證件照標準實體尺寸(1 吋/2 吋)的排版——避免把簡化實作偽裝
     成精確規格。
  B. 讓 `證件照8格` 真正計算標準證件照物理尺寸(例如 3.5cm x 4.5cm)並
     置中留白排列。

### Selected Solution
每組皆選 A。

### Reason
每個 A 選項都遵循同一條主線:能重用既有、已驗證過的機制(§4.3 唯一
geometry 模組、§9 Layout Engine、§12.5 Source 去重快取)就重用,不新增
平行的第二套邏輯;範圍不明確時,優先選「現在可驗證、之後容易擴充」的
最小可行版本(Watermark 只置中、SVG 固定放大倍率、Text Box 保持獨立
模型),而不是在缺乏規格依據的情況下自行擴大範圍去猜測完整功能。

### Consequences
Bleed 對 'contain' fit 的 Slot 沒有實際效果(出血區保持空白)是使用者
之後可能回報的「看起來沒作用」——Properties Panel 之後可以在 UI 層提示
「Bleed 對 contain fit 效果有限,建議搭配 cover」,不需要現在就解決。
Watermark 若未來要支援多位置,`computeWatermarkCenterPt()` 需要擴充成
接受一個 anchor 參數而非寫死置中,`createWatermarkSettings()` 需要新增
`position` 欄位並走一次 schemaVersion migration。若未來要支援中文
Text Box/浮水印,需要另外開一個 decision 記錄 fontkit 的引入與子集內嵌
策略(§19 單檔體積的取捨)。`證件照8格` 若之後要做成真正的證件照規格,
需要新增一個不經過 `generateGridSlots` 等分邏輯的專用排版函式。

### Future Review Conditions
使用者要求中文 Text Box/浮水印支援時、Bleed 對 contain-fit 內容的視覺
限制被回報為 bug 時、Watermark 需要非置中位置時、`證件照8格` 需要符合
實際證件照物理尺寸規格時。

## D-020 — Phase 12 Product UI 增補:§18 [M] 產品介面漏排入 Phase 的根因、修正計畫核可、五個使用者決策點

### Date
2026-08-06

### Topic
架構 / 開發階段排序 / 產品範圍

### Context
2026-08-06 依使用者要求對 §10/§16/§18/§19/§22/§25 逐條與原始碼、打包後
`index.html` 實際畫面比對,發現 `docs/plan.md` §18.1(三區架構)與
§18.2(Properties Panel)均標為 **[M]**,但 §22 的 Phase 0–11 排序從未
把它們排入任一階段——Phase 0–10 完整實作了引擎,Phase 11 的
`scripts/build.mjs` 打包 entry 卻直接取自 `dev/print-aids.html`,一份
自我標示「不是產品 UI,僅供人工／自動化檢查」的 Phase 10 dev harness
(見 `dev/print-aids.html:29`)。結果是使用者拿到的正式單檔產物固定
A4 直向 2-up、無法換版型、無 Undo/Redo 按鈕、無存檔、無列印按鈕,畫面
上還留有 JSON readout 與 `[PASS]`/`[FAIL]` log 等除錯元素。

盤點同時發現 10 個周邊缺口(完整列於 `docs/remediation_plan.md` §2 的
G-01~G-12):`src/keymap.js` 是純 resolver、全專案無任何
`addEventListener` 呼叫端(快捷鍵形同虛設);`dev/print-aids.html` 的
`accept` 屬性未列 `.svg` 且 `handleFiles` 不分派到 `loadSvgFile()`
(SVG 功能在打包產物中是死路);浮水印 `type: image` 有下拉選項但無任何
指定 `imageSourceId` 的 UI;§19.4(D-007 使用者決議新增的更新檢查)與
§10.4(批次套用)均為 [S] 但完全未實作;README.md 仍寫「規劃階段,
尚未有程式碼」;以及若干已知設計限制(§17.1 載入專案須重選檔案、
§16 文字 ASCII-only 等)只存在內部文件,使用者不可見。

### Alternatives Considered
A. 就地在既有 Phase 10/11 範圍內「補完」,不承認這是規格排序上的缺口,
   直接動手改 `dev/print-aids.html` 讓它兼任產品 UI。
B. 明確承認 §18 [M] 從未被排入 Phase 是規格執行上的疏漏,新增
   Phase 12(Product UI)、更新 §22.1 總覽與新增 §23.9 驗收條件,
   把產品 UI 當作獨立、可驗收的階段;先寫成
   `docs/remediation_plan.md` 交使用者核可,核可後才動 plan.md。
C. 把產品 UI 排除在本專案範圍外,永久維持「引擎 + dev harness」的
   交付形態,由使用者自行接 UI。

### Selected Solution
B。使用者已核可 `docs/remediation_plan.md` 全文,並對計畫 §5 的五個
決策點逐一採納建議方案:
1. 核可整份修正計畫,包含本次對 plan.md §22/§23 的增補。
2. UI 語言:全繁體中文單語,不建 i18n 框架。
3. Ctrl+C/Ctrl+V 範圍:MVP 僅做「頁內 Slot 複製貼上」,不做跨頁/跨
   Output Page/跨專案剪貼簿。
4. `index.html` 命運:Phase 12 完成後由新產品 UI(`app.html`)的 build
   直接取代;`dev/` 系列 harness 維持原樣,繼續作為引擎驗證用途保留。
5. APP_VERSION / Release 版號起點:`v1.0.0`,於 R-7(重新打包)完成時
   首發,§19.4 更新檢查以此為比對基準。

### Reason
`dev/*.html` 從 Phase 1 起的檔案內註解與 `docs/project_status.md` 就
反覆強調「非產品 UI,僅供人工/自動化檢查」——這個邊界在文件層面一直
是清楚的,問題是 §22 的階段排序本身漏排了「把邊界另一側的產品 UI 做
出來」這一步,使得 Phase 11 打包時沒有非除錯用的入口可選,只能取用
dev harness 頂替。選 B 而非 A,是因為 A 會讓「除錯頁兼任產品 UI」
這個事實繼續被掩蓋,且違反 §4.1「Layout Model 與 DOM 分離」以外
plan.md 從未言明、但一直隱含的假設——dev harness 的 DOM 結構、CSS、
除錯 log 從未被設計成可交付給終端使用者。選 C 則直接違反 §1 產品
定位(Visual Page Imposition Designer,非單純函式庫),Phase 0–10
投入的引擎工作也將失去被實際使用的途徑。

### Consequences
- `docs/plan.md` §22 新增 Phase 12 條目(6 步:12a 骨架+Canvas、12b
  Source Gallery、12c Properties Panel+批次套用、12d 畫布編輯互動、
  12e 頁面管理+Auto Fill+專案系統、12f 快捷鍵+複製貼上)、§22.1 總覽
  補上「→ Product UI → Re-build」、新增 §23.9 驗收條件(9 條)。
- `scripts/build.mjs` 的 build entry 未來會從 `dev/print-aids.html`
  改為新的 `app.html`;`index.html` 產物內容會整個改變(不再是除錯頁),
  現有 §23.1「Phase 11 Standalone Build」驗收(單檔可重現、`file://`
  可開啟)仍然適用於新 entry,不需要重新定義,只是 R-7 階段要重跑一次。
- Phase 12 完成前,任何人拿到目前的 `index.html` 實質上只能做 Phase 10
  dev harness 範圍內的事(固定 2-up、無存檔、無列印按鈕)——這個落差
  在 Phase 12 完成前持續存在,已記錄於 `docs/project_status.md` 的
  Planned Features 區塊供後續 session 得知現況。
- Ctrl+C/V 範圍定為「頁內 Slot 複製貼上」後,若日後需要跨頁或跨專案
  剪貼簿,需要重新設計 clipboard 的資料格式(目前的複製貼上不需要
  離開 `AppState.pages` 的既有結構),屬於未來才需要考慮的擴充,不在
  Phase 12 範圍內預先設計。

### Future Review Conditions
Phase 12 六步全數完成、`npm test` 全綠且較 543 淨增、單檔
`index.html` 於 Chrome/Edge `file://` 下完成全流程冒煙測試後,回頭把
§23.9 逐條勾選驗收,並在 `docs/project_status.md` 的 Completed
Features 新增 Phase 12 條目(比照既有 Phase 0–10 的記錄格式)。若使用者
之後要求跨頁/跨專案剪貼簿或多語系 UI,需另開新的 decision 記錄,不得
沿用本次「頁內複製貼上 + 全繁中單語」的既有決定直接擴大範圍。

## D-021 — 產品 UI 改善計畫 U-0~U-4:模式密度、清除動作與可調面板

### Date
2026-08-06

### Topic
產品 UI / UX 狀態

### Context
Phase 12 的產品 UI 已可用,但使用者回報四個實際摩擦點:大多數情境只需
快速操作、選取後缺少明確的離開路徑、來源與格位清除語意混在一起、以及
Properties Panel 寬度不足。`docs/ui_improvement_plan.md` 將其拆成 U-0~U-4。

### Alternatives Considered
A. 維持單一完整介面,只增加更多按鈕。
B. 導入簡易／詳細模式,將高頻操作與進階欄位分層,並補上明確的清除與
   面板調整互動。

### Selected Solution
B,並採用計畫中的五項決定:
1. 簡易模式為預設,保留紙張邊距與格位間距設定。
2. 以 `localStorage` 記住模式與面板寬度,但以 try/catch 容忍不可用環境。
3. 清除格位內容與清除來源拆成兩個按鈕,來源清除先顯示影響數量並確認。
4. 每種批次清除只建立一筆 Undo,來源移除依既定釋放順序執行。
5. Properties Panel 以 240 px 至 `min(720 px, 60vw)` 限制拖曳,雙擊回 300 px。

### Reason
這些決策直接對應使用者的操作意圖,降低初始畫面資訊密度,又不犧牲
進階設定與可復原性;`localStorage` 僅保存 UI 偏好,符合 §20 的離線隱私邊界。

### Consequences
`app.html` 需在初始 HTML 宣告簡易模式以避免 FOUC,並將進階區塊以
`.adv-only` 控制;Canvas 空白處與 `Esc` 共用清除選取語意。`src/keymap.js`
新增 `clearSelection` 動作,`index.html` 必須由 build 重新產生。

### Future Review Conditions
若日後需要跨裝置同步 UI 偏好、第三種模式、或不同於目前兩種清除語意的
批次操作,應另開 decision,不得把使用者檔案內容或專案資料寫入本地偏好儲存。
