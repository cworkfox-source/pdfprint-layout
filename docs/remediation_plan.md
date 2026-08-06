# 修正計畫(Remediation Plan)— 產品 UI 與功能缺口補完

- 建立日期:2026-08-06
- 依據:`docs/plan.md` v2.1、`docs/project_status.md`(Phase 0–11 完成現況)、
  2026-08-06 缺口盤點(本文件 §2)
- 狀態:**待使用者核可**(其中 R-1 涉及 plan.md §22 規格增補,依 AGENTS.md
  「與 spec 衝突須先問」規則,核可本計畫即視為同意該增補)

---

## 1. 背景與問題陳述

Phase 0–10 已完成完整的引擎(543 測試通過),Phase 11 已產出單檔
`index.html`。但盤點發現:**plan §18.1 三區架構與 §18.2 Properties Panel
均標為 [M],卻從未被排入任何 Phase**;Phase 11 打包的入口是
`dev/print-aids.html` —— 一個自我標示「不是產品 UI,僅供檢查」的
dev harness。因此目前交付給使用者的單檔產物是除錯頁:固定 A4 直向
2-up、無法換版型、無 Undo/Redo、無存檔、無列印按鈕,且畫面上有
JSON readout 與 `[PASS]` log 等除錯元素。

本計畫的目標:補上產品 UI 與所有已盤點的功能缺口,讓單檔產物成為
plan §1 定位的「Visual Page Imposition Designer」,而非引擎驗證頁。

## 2. 缺口總表

| 編號 | 缺口 | 規格出處 | 嚴重度 |
|---|---|---|---|
| G-01 | 三區架構產品 UI 不存在 | §18.1 **[M]** | 致命(阻斷所有引擎功能的使用) |
| G-02 | Properties Panel 不存在 | §18.2 **[M]** | 致命 |
| G-03 | 引擎功能無 UI 可達:Preset/Grid、自由版型編輯、鎖定/Z-order、Slot 內容調整、Auto Fill、Output Pages、Crop Marks、列印/校正頁、專案存讀、Template(含 Library)、Undo/Redo、對齊/分布、Zoom、多選、紙張設定 | §8–§17 各 [M]/[S] | 致命(功能已寫好但使用者拿不到) |
| G-04 | 鍵盤快捷鍵未接線:`src/keymap.js` 是純 resolver,全專案無任何 `addEventListener` 呼叫它 | §18.3(Undo/Redo 為 **[M]**) | 高 |
| G-05 | SVG Source 在打包入口是死路:`dev/print-aids.html` 的 `accept` 無 `.svg`,`handleFiles` 不呼叫 `loadSvgFile()` | §5.2 / Phase 10 | 中 |
| G-06 | 浮水印 `type: image` 有下拉選項但無任何指定 `imageSourceId` 的 UI,選了即壞 | §16 | 中 |
| G-07 | §19.4 手動更新檢查未實作(D-007 使用者決議新增;§23.8 驗收無法達成) | §19.4 **[S]** | 中 |
| G-08 | §10.4 批次套用未實作 | §10.4 **[S]** | 低 |
| G-09 | Ctrl+C/Ctrl+V:resolver 可解析,但無 clipboard/paste 語意(僅有 duplicate) | §18.3 | 低 |
| G-10 | Annotations 遺失無 UI 提示(§25 明文「UI 須提示」) | §25 | 中 |
| G-11 | 零使用者文件;README 仍寫「規劃階段,尚未有程式碼」,與現況嚴重脫節 | — | 中 |
| G-12 | 已知設計限制(載入專案須重選檔案、ASCII-only、Bleed 對 contain 無效、混合尺寸提示等)只存在內部文件,使用者不可見 | §11.4 / §17.1 / D-019 | 中 |

**確認非缺口**(刻意排除,僅需寫進使用者說明,見 R-6):雙面列印/背面
對齊、中文文字(fontkit)、書帖、標籤紙預設、`證件照8格` 非真實證件
尺寸(§25、D-019)。§15.2 列印 CSS 判定 N/A —— 列印一律經由 PDF
(§15.1/D-003),不存在需要列印 CSS 的 DOM 列印路徑。

## 3. 工作包

### R-1|plan.md §22 增補 Phase 12(規格變更,先行)

- **範圍**:在 `docs/plan.md` §22 的 Phase 11 之後新增「Phase 12:
  Product UI」條目與驗收條件(§23 增補對應小節);§22.1 總覽補上
  「→ Product UI → Re-build」。同時修正 §22 既有敘述中「Standalone
  Build 是最後階段」的表述。
- **檔案**:`docs/plan.md`、`docs/decision_log.md`(新增一筆:為何
  §18 [M] 當初漏排、如何補救)。
- **驗收**:plan §22/§23 與本計畫一致;decision_log 新增 D-020。
- **相依**:無,但**須使用者核可本計畫後才動 plan.md**。

### R-2|Phase 12 產品 UI(主體,分六步)

新增 `src/app.js`(UI orchestration)與 `app.html`(產品入口,取代
dev harness 作為 build entry)。所有狀態變更一律經
`src/reducers.js` → `store.commit()`(§7.1),UI 層不得直接
mutate;純計算(版面幾何、面板顯示邏輯)與 DOM 寫入分離,延續
§4.1 慣例,可測部分放 `src/app-*.js` 純函式模組。

- **12a 骨架 + Paper Canvas**:三區 flex/grid 骨架、頂部工具列
  (開啟/儲存專案、匯出、列印、校正頁、Undo/Redo、Zoom 100%/Fit)、
  中央畫布接 `src/preview.js` 全套 renderer(Slots、內容、Crop
  Marks、Bleed/Safe Area、Header/Footer、Page Number、Text Box、
  Watermark)。移除 readout/log/verify 等除錯元素。
  驗收:載入 PDF 後畫布顯示與 `dev/print-aids.html` 等價的預覽;
  Zoom/Fit 正確;console 無錯誤。
- **12b Source Gallery(左欄)**:縮圖、PDF 頁碼範圍輸入(§12.2)、
  刪除(含記憶體釋放 §12.6)、HTML5 拖曳到 Slot(搬用
  `dev/placement.html` 既有寫法);載入 SVG 接 `loadSvgFile()`
  (一併解 G-05);載入含註解 PDF 時顯示「超連結/表單/註解將
  遺失」提示(解 G-10);加密 PDF 錯誤以人話顯示。
  驗收:PDF/圖片/SVG 三種來源端到端(載入→拖入 Slot→匯出)通過。
- **12c Properties Panel(右欄)**:依選取切換 —— 無選取=Paper
  Properties(紙張/方向/邊距/間距 §8 + Preset/自訂 Grid §9.1–9.2);
  選 Slot=內容屬性(fit/scale/rotation/offset/flip/清除 §10.2)+
  鎖定/Z-order;選 Text Box=文字屬性;多選=對齊/分布/Match Size
  (§9.6)+ 批次套用(R-5 併入);另設「文件」分頁收納 Bleed/
  Safe Area/Header/Footer/Page Number/Watermark/Crop Marks,其中
  Watermark image 型提供「從 Gallery 選取來源」控制(解 G-06)。
  驗收:每種面板的變更即時反映於畫布並可 Undo。
- **12d 畫布編輯互動**:Select/Create 模式、點選/Shift 多選/框選、
  拖曳移動、8 handle 縮放、Snap 開關、分割/合併/刪除/複製
  (搬用 `dev/free-layout.html` 已驗證的 pointer 邏輯)。
  驗收:Playwright 重跑 Phase 4 既有互動驗證項目於新 UI 上全過。
- **12e 頁面管理 + Auto Fill + 專案系統整合**:底部 Output Pages
  縮圖列(新增/複製/刪除/排序 §11.3)、Auto Fill 面板(順序/篩選/
  重複 §11.2,含 §11.4 混合尺寸提示接線)、專案存讀 + relink 流程
  UI(明確列出缺少檔案清單、比對成功/失敗與原因)、Template
  存取/套用 + 內建 Library。
  驗收:存檔→新 session 載入→relink→匯出,全流程經真實 UI 通過。
- **12f 鍵盤快捷鍵接線(解 G-04)**:事件層將 `keymap.js`
  resolver 接上 reducers(Delete/Undo/Redo/全選/微移);Ctrl+C/V
  依 R-5 的決策實作或暫映射為 duplicate。
  驗收:§18.3 表列快捷鍵逐一在瀏覽器實測。

- **檔案**:`app.html`、`src/app.js` 與拆出的純函式模組 + 測試;
  不改動既有引擎模組(如需改動,個案記錄於 change_log)。
- **風險**:UI orchestration 是第一個大量事件接線的模組,Playwright
  驗證量大;分六步逐步交付、每步獨立驗收以控制風險。

### R-3|快速修復(可立即先行,不依賴 R-1/R-2)

- README 更新:產品簡介、下載與開啟方式(雙擊 `index.html`)、
  功能清單、已知限制、開發者指引(解 G-11 一半)。
- `dev/print-aids.html` 的 SVG 接線與浮水印 image 選項:因 R-2 會
  整頁取代其打包角色,dev harness 本身**僅**補 SVG 載入(維持
  引擎驗證完整性),浮水印 image UI 留給 12c,不重複做兩次。
- **驗收**:README 與現況一致;dev harness 可載入 .svg 並匯出。

### R-4|§19.4 手動更新檢查(解 G-07)

- **範圍**:依 §19.4 規格逐條實作:僅使用者點擊觸發、fetch GitHub
  releases/latest、semver 比對內嵌 `APP_VERSION`、成功/無新版/失敗
  三態 UI、按鈕旁標示「將連線 GitHub 查詢最新版本」。放入 12a 的
  頂部工具列,故排在 12a 之後。
- **檔案**:`src/update-check.js`(純函式:semver 比對、回應解析,
  fetch 經 deps 注入)+ 測試;UI 接線在 `src/app.js`。
- **驗收**:§23.8 全數通過(含離線失敗態不阻塞核心功能)。

### R-5|§10.4 批次套用 + 剪貼簿(解 G-08、G-09)

- **範圍**:多選 Slot 一次套用 fit/rotation/scale/alignment(reducer
  層新增批次 action,UI 在 12c 多選面板);Ctrl+C/V 的範圍需使用者
  決策(見 §5 決策點 3),預設建議:MVP 做「頁內複製貼上」
  (複製選取 Slot 含內容,貼上時偏移少許),不做跨專案剪貼簿。
- **驗收**:批次套用對 3+ 個混合狀態的 Slot 一次生效且單步 Undo;
  複製貼上經快捷鍵與按鈕雙路徑驗證。

### R-6|使用者說明(解 G-12 + G-11 另一半)

- **範圍**:UI 內建「說明」對話框(符合單檔離線原則,不外連):
  快速上手四步驟(載入→選版型→Auto Fill→匯出)、快捷鍵表、
  已知限制清單(載入專案須重選檔案及原因、ASCII-only、Bleed 與
  contain、註解遺失、刻意排除項);首次開啟時畫布空狀態顯示
  引導文字。
- **驗收**:§2 表中 G-12 列舉的每一項限制都能在說明內找到對應
  條目;空狀態引導在載入第一個檔案後消失。

### R-7|重新打包 + 發布回歸(收尾)

- **範圍**:`scripts/build.mjs` entry 從 `dev/print-aids.html` 改為
  `app.html`;重跑單檔靜態檢查(無 ESM import、無外部 URL、Blob
  worker);Chrome/Edge 實機 `file://` 回歸(含更新檢查按鈕在
  `file://` 下的行為);更新 `index.html` 產物。
- **驗收**:重複 build SHA-256 一致;`file://` 下全功能冒煙測試
  (載入→拼版→匯出→列印→存檔→載入)通過。

## 4. 執行順序與相依

```text
R-3(快速修復,隨時可做)
R-1(規格增補,需核可)
 └→ R-2 12a → 12b → 12c → 12d → 12e → 12f
        └→ R-4(12a 後即可)     └→ R-5(12c/12f 內)
     R-6(12a 後可並行,12e 完成後定稿)
      └→ R-7(全部完成後收尾)
```

每個工作包完成即依 AGENTS.md solo-large 層級寫 change_log 完整
條目並跑 `npm test`;12a–12f 每步都含 Playwright 瀏覽器實測,不得
只跑單元測試(UI/DOM 變更規則,見 AGENTS.md Project Facts)。

## 5. 需要使用者確認的決策點

1. **核可本計畫**(= 同意 R-1 對 plan.md §22/§23 的增補)。
2. **UI 語言**:建議全繁體中文單語(現 harness 中英混雜);不做
   i18n 框架。
3. **Ctrl+C/V 範圍**(R-5):建議「頁內 Slot 複製貼上」;若你要
   跨頁貼上或貼上到其他 Output Page,範圍會變大,請指示。
4. **`index.html` 命運**(R-7):建議直接被新產品 UI build 取代;
   dev harness 群維持原樣供引擎驗證。
5. **APP_VERSION 與 Release 版號起點**(R-4/R-7):建議 `v1.0.0`
   於 R-7 完成時首發,更新檢查以此為基準。

## 6. 明確不做(本計畫範圍外)

雙面列印/背面對齊、中文字型內嵌(fontkit)、書帖排版、標籤紙
預設、真實證件照尺寸版型、色彩管理 —— 均維持 plan §25 的第二階段
/排除清單,不因本計畫改變。

## 7. 完成定義

- G-01 ~ G-12 全數關閉(每項在 change_log 有對應驗證記錄)。
- `npm test` 全綠且測試數較 543 淨增(UI 純函式模組有測試)。
- 單檔 `index.html` 於 Chrome/Edge `file://` 下完成全流程冒煙測試。
- plan.md、project_status.md、README、使用者說明四份文件與實況一致。
