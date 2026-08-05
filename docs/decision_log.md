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
