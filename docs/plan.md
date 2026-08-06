# Visual Page Imposition Designer — 實作計畫書

| 項目 | 內容 |
| --- | --- |
| 專案代號 | `pdfprint-layout` |
| 文件版本 | v2.1 |
| 更新日期 | 2026-08-05 |
| 狀態 | 規劃中（尚未開始實作） |
| 上一版 | v2.0（結構重整）；v2.1 新增 §19.4 更新檢查、§19.5 GitHub 發布流程（唯一連網例外，使用者決議） |

---

## 0. 目錄

| 章 | 主題 |
| --- | --- |
| 1 | [產品定位](#1-產品定位) |
| 2 | [目標與非目標](#2-目標與非目標) |
| 3 | [優先級標記](#3-優先級標記) |
| 4 | [架構核心原則](#4-架構核心原則) |
| 5 | [資料模型](#5-資料模型) |
| 6 | [幾何規格（單位・座標系・變換）](#6-幾何規格單位座標系變換) |
| 7 | [狀態變更與 History 契約](#7-狀態變更與-history-契約) |
| 8 | [紙張與版面設定](#8-紙張與版面設定) |
| 9 | [排版引擎](#9-排版引擎) |
| 10 | [Slot 內容與編輯操作](#10-slot-內容與編輯操作) |
| 11 | [自動填版](#11-自動填版) |
| 12 | [檔案載入・來源管理・記憶體規則](#12-檔案載入來源管理記憶體規則) |
| 13 | [Preview Renderer](#13-preview-renderer) |
| 14 | [Export Renderer（PDF 輸出）](#14-export-rendererpdf-輸出) |
| 15 | [列印路徑](#15-列印路徑) |
| 16 | [印刷輔助元素](#16-印刷輔助元素) |
| 17 | [專案與模板](#17-專案與模板) |
| 18 | [使用者介面](#18-使用者介面) |
| 19 | [打包與離線約束](#19-打包與離線約束) |
| 20 | [安全與隱私](#20-安全與隱私) |
| 21 | [技術棧](#21-技術棧) |
| 22 | [開發階段](#22-開發階段) |
| 23 | [驗收條件（可量測）](#23-驗收條件可量測) |
| 24 | [測試計畫](#24-測試計畫) |
| 25 | [明確排除與已知限制](#25-明確排除與已知限制) |
| 26 | [風險登記](#26-風險登記) |

---

## 1. 產品定位

本工具**不是** N-up PDF Tool，而是 **Visual Page Imposition Designer**。

核心能力：

> 任何 PDF / Image ＋ 任何紙張 ＋ 任何 Slot Layout ＋ 自由拖曳 ＋ 高品質 PDF Export

使用者不需理解傳統印刷拼版規則，只需在畫面上決定「我要這張紙怎麼放」，系統負責把視覺版型轉換成精確的列印與 PDF 輸出結果。

---

## 2. 目標與非目標

### 2.1 目標

純前端、零後端、可離線、可打包為單一 HTML，支援 PDF 與圖片、自由版型、精確紙張尺寸、高品質 PDF 匯出與列印。

典型使用情境：1 張放滿整頁、2 張上下／左右、4 張 2×2、9 張 3×3、上 2 下 1、上 1 下 2、左 1 右 2，以及任意大小與位置的自由格位。

### 2.2 非目標（本專案不做）

- 後端服務、雲端同步、任何遠端 API（**唯一例外：§19.4 使用者手動點擊的更新
  檢查，僅查詢公開版本號，不涉及使用者檔案**）。
- 印前色彩管理（ICC 轉換、CMYK 分色、疊印預覽）。
- 完整的 PDF 編輯（改內文、改字型、修改既有註解）。
- 取代專業 imposition 軟體的書帖排版（signature / folding scheme）。
- 自動下載並自我覆寫本機檔案（`file://` 瀏覽器沙箱不允許，見 §19.4）。

---

## 3. 優先級標記

本文件所有需求皆標記優先級，實作順序以此為準：

| 標記 | 意義 |
| --- | --- |
| **[M]** MUST | MVP 必須完成，缺少即不可交付 |
| **[S]** SHOULD | 第二階段，不影響 MVP 可用性 |
| **[C]** COULD | 有餘力再做，可能永不實作 |

MVP（第一版）＝ 所有 **[M]** 項目。

---

## 4. 架構核心原則

三項最不能後補的設計，若一開始正確，日後新增紙張、特殊版型、模板與批次排版都不需重寫：

### 4.1 [M] Layout Model 與 DOM 分離

系統核心不得以圖片或 PDF 的 DOM 元素作為排版資料。資料結構為：

```text
Project
 ├─ Sources
 ├─ Layout Templates
 └─ Output Pages
      └─ Slots
           └─ Source + Transform
```

DOM 只是 Model 的一種投影，刪掉整個 DOM 後由 Model 重建必須得到完全相同的畫面。

### 4.2 [M] Slot 與 Source 分離

Slot 描述「紙張上的區域」，Source 描述「內容」。兩者以 `sourceId` 關聯，任一方都能單獨替換。因此同一版型可套用於不同 PDF／圖片，同一 Source 也可放進多個 Slot。

### 4.3 [M] Preview Renderer 與 Export Renderer 分離 —— 但必須等價

```text
Layout Model
      │
      ├─ Preview Renderer  → Canvas / DOM
      │
      └─ Export Renderer   → pdf-lib
```

畫面 Preview 不決定最終 PDF 品質。**但兩者必須產生幾何上等價的結果。**

> **等價性契約（Equivalence Contract）**
> 兩個 Renderer 都**只能**透過第 6 章定義的唯一 geometry 模組取得座標與變換矩陣，
> 不得各自實作單位換算、Y 軸翻轉、fit 計算或 transform 疊加。
> 違反此點是本專案最可能的失敗原因。

驗證方式見 [§23.3](#233-preview--export-等價性-m)。

---

## 5. 資料模型

### 5.1 [M] AppState

```text
AppState
├─ Project        專案級設定（紙張、邊距、輸出選項）
├─ Sources        Source[]（含原始 bytes 參照與 metadata）
├─ Templates      Template[]
├─ Pages          Page[] → Slot[]
├─ Selection      目前選取的 Slot id 集合
└─ History        Undo / Redo（見 §7）
```

### 5.2 [M] Source

代表原始來源：PDF 單頁、PNG、JPG、WEBP、空白頁、色塊、文字（[S]）、SVG（[S]）。

```js
{
  id: "src-001",
  kind: "pdf-page" | "image" | "blank" | "color" | "text",

  fileName: "drawing.pdf",
  pageIndex: 0,              // kind = pdf-page 時有效（0-based）

  // 原始尺寸，統一以 pt 記錄（見 §6.1）
  naturalWidth: 595.276,
  naturalHeight: 841.890,

  // PDF 來源專屬
  pageRotate: 0,             // 來源頁的 /Rotate，0 | 90 | 180 | 270
  cropBox: { x, y, w, h },   // 若無則等同 mediaBox
  mediaBox: { x, y, w, h },

  thumbUrl: null,            // 縮圖 ObjectURL，可被 LRU 回收

  docId: null,               // 指向 SourceBinaryStore 內原始 bytes 的 key
                              // （Phase 2 新增）；同一 PDF 檔的所有頁 Source
                              // 共用一個 docId，image Source 的 docId 等於自己
                              // 的 id（1:1）。
}
```

**PDF 每一頁皆為獨立 Source。** 原始 bytes 不放在 Source 內，另存於 `SourceBinaryStore`（見 §12.3）。

### 5.3 [M] Slot

```js
{
  id: "slot-001",

  // Normalized Coordinate：相對於「內容區」(紙張扣除 margin) 的 0..1 比例
  x: 0, y: 0, w: 0.5, h: 0.5,

  sourceId: null,

  fitMode: "contain" | "cover" | "stretch",

  scale: 1,                  // 在 fitMode 計算出的基礎縮放上再乘的倍率
  rotation: 0,               // 度，正值為順時針（見 §6.3）
  offsetX: 0, offsetY: 0,    // 單位：Slot 寬/高的比例（見 §6.4）
  flipX: false, flipY: false,

  locked: false,
  z: 0,                      // 繪製順序，見 §6.5
}
```

> **座標必須是 Normalized，不得是畫面 Pixel。**
> 如此同一版型可直接套用於 A4 / A3 / Letter / Legal / 自訂紙張，
> 也不受 Zoom 影響。

### 5.4 [M] Page / Template

- `Page` = 紙張設定（可繼承 Project）＋ `Slot[]`。
- `Template` 只保存 Paper、Margins、Gap、Slots、Layout；**不保存 Source**，因此可跨檔案重複套用。

---

## 6. 幾何規格（單位・座標系・變換）

> 本章是 §4.3 等價性契約的實體。所有數值運算集中於單一模組 `geometry.js`，
> 兩個 Renderer 一律呼叫它，不得自行換算。

### 6.1 [M] 單位

- **內部唯一單位為 pt**（1 pt = 1/72 inch）。使用者介面顯示 mm / cm / in / pt，輸入時立即換算為 pt 儲存。
- 換算：`pt = mm / 25.4 * 72`。
- 預設紙張精確值：

| 紙張 | mm / in | pt |
| --- | --- | --- |
| A4 | 210 × 297 mm | 595.276 × 841.890 |
| A3 | 297 × 420 mm | 841.890 × 1190.551 |
| Letter | 8.5 × 11 in | 612 × 792 |
| Legal | 8.5 × 14 in | 612 × 1008 |

- **四捨五入策略**：所有中間運算保持 double 精度，**僅在寫入 PDF 時**四捨五入至小數 3 位。UI 顯示四捨五入至 mm 小數 2 位。

### 6.2 [M] 座標系與 Y 軸

| 空間 | 原點 | Y 方向 |
| --- | --- | --- |
| Layout Model（本系統） | 紙張左上 | 向下為正 |
| CSS / Canvas Preview | 左上 | 向下為正 |
| **PDF（pdf-lib 輸出）** | **紙張左下** | **向上為正** |

Export 時必須翻轉：`pdfY = paperHeightPt - modelY - elementHeightPt`。

此翻轉**只允許存在於 geometry 模組的一個函式中**。

### 6.3 [M] Transform 套用順序

Slot 內容的最終變換矩陣定義如下（由右往左套用）：

```text
M = T(slotOrigin)
  · T(offsetX * slotW, offsetY * slotH)
  · T(+slotW/2, +slotH/2)
  · R(rotation)
  · S(scale * fitScale)
  · F(flipX, flipY)
  · T(-contentW/2, -contentH/2)
```

- `fitScale` 由 `fitMode` 決定，**且 `rotation` 為 90°/270° 時，用來比較的 Slot
  目標尺寸要對調**（因為 `S` 是套用在內容自身未旋轉的局部座標上、在 `R` 之前，
  90°/270° 旋轉後內容的局部 x/y 軸會對調到 Slot 的 y/x 軸；180° 不改變外框方向
  故不對調）：
  - 令 `targetW = (rotation ∈ {90,270}) ? slotH : slotW`，
    `targetH = (rotation ∈ {90,270}) ? slotW : slotH`
  - `contain` → `min(targetW/cw, targetH/ch)`
  - `cover` → `max(targetW/cw, targetH/ch)`
  - `stretch` → `sx = targetW/cw, sy = targetH/ch`（非等向，`S` 退化為 `S(sx, sy)`）
  - 實作與此對應的測試見 `src/geometry.js` 的 `computeFitScale()`。
- 旋轉中心固定為 **Slot 中心**，非內容中心、非左上角。
- `flip` 在 `scale` 之後、`rotation` 之前套用（等同對內容自身鏡射，不影響 Slot 位置）。
- **來源頁 `/Rotate` 不屬於此矩陣**，須先正規化（見 §14.3）。

### 6.4 [M] Offset 單位

`offsetX` / `offsetY` 的單位是 **Slot 寬 / 高的比例**（`0.1` = 向右移動 Slot 寬度的 10%）。選擇比例而非 mm，是為了讓版型套用到不同紙張尺寸時位移等比縮放。

### 6.5 [M] Z-order 與重疊

自由版型允許 Slot 重疊。繪製順序由 `z` 升冪決定，`z` 相同時以陣列索引為序。Preview 與 Export **必須使用同一排序函式**。UI 提供上移一層／下移一層／移到最上／移到最下。

### 6.6 [M] Contain / Cover / Stretch 定義

| 模式 | 行為 | 結果 |
| --- | --- | --- |
| Contain（Fit） | 完整顯示來源 | 可能留白 |
| Cover（Fill） | 填滿 Slot | 超出部分裁切 |
| Stretch | 直接拉伸 | 變形，不保持比例 |

Cover 與任何 `scale > fitScale` 的情況都會超出 Slot 邊界，**必須以 Slot 矩形做 clip**：Preview 用 CSS `overflow:hidden` 或 Canvas `clip()`，Export 用 pdf-lib 的圖形狀態裁切路徑。兩者裁切邊界必須一致。

---

## 7. 狀態變更與 History 契約

> Undo/Redo 雖排在後期 Phase 完成，但它的**約束屬於 Phase 0**。
> 若資料模型允許到處直接改物件，後期補做必然全面重寫。

### 7.1 [M] 單一 Mutation 入口

所有狀態變更只能經由 store API（例如 `store.commit(action)`）。**任何模組不得直接改寫 AppState 上的物件。** 這是 Phase 0 的驗收項目之一。

### 7.2 [M] History 策略

- 採 **immutable snapshot + 結構共享**（改動路徑上的節點才複製）。優於 command pattern 之處在於不需為每個操作寫反向邏輯。
- 上限預設 50 步，超過丟棄最舊。
- **Coalescing（必要）**：拖曳 / Resize / 滑桿調整期間不得每次 `mousemove` 存檔。規則為「操作開始時記錄起始快照，操作結束（pointerup / 失焦 / 300 ms 無變動）時提交一筆」。

### 7.3 [M] 適用範圍

拖曳、縮放、刪除、新增、旋轉、分割、合併、排版變更、批次套用、Auto Fill。
快捷鍵 `Ctrl+Z` / `Ctrl+Y`。

**不進入 History**：Zoom、Pan、選取變更、面板開合。

---

## 8. 紙張與版面設定

### 8.1 [M] 紙張

預設 A4 / A3 / Letter / Legal（數值見 §6.1）＋ 自訂（寬、高、單位 mm/cm/in/pt）。

### 8.2 [M] 方向

Portrait / Landscape。切換方向時，Slot 因採 Normalized 座標而**自動保持比例配置**；另提供「重新套用目前 Preset」按鈕讓使用者選擇重算。

### 8.3 [M] 邊距與間距

個別設定 Top / Bottom / Left / Right Margin，以及 Horizontal Gap / Vertical Gap。提供「全部邊距同步」開關。

Slot 的 Normalized 座標基準是**內容區**（紙張扣除四邊 margin），因此改 margin 時版型自動縮放。

---

## 9. 排版引擎

### 9.1 [M] 快速版型 Preset

一般 Grid：1-up、2-up（水平／垂直）、4-up（2×2）、6-up（2×3／3×2）、9-up（3×3）、16-up（4×4）。

非對稱版型：

```text
上 2 下 1                上 1 下 2
┌────────┬────────┐      ┌─────────────────┐
│   1    │   2    │      │        1        │
├────────┴────────┤      ├────────┬────────┤
│        3        │      │   2    │   3    │
└─────────────────┘      └────────┴────────┘
```

另提供：左 1 右 2、左 2 右 1、3+1、1+3、2+2。

> **Phase 3 實作補註**（decision_log D-010）：上述非對稱版型的主軸（上下
> 或左右）固定二等分，格數只影響其中一段內部的等分數；「2+2」因與 4-up
> 的幾何差異未定義，Phase 3 尚未實作。

MVP 必備：1-up、2-up、4-up、6-up、9-up、上 2 下 1、上 1 下 2。其餘為 **[S]**。

### 9.2 [M] 自訂網格

使用者指定 Columns / Rows，自動產生對應 Slot（例：5 × 3 → 15 Slots），套用目前 Gap 設定。

### 9.3 [M] 自由版型 Layout Designer

這是本工具與一般 N-up 工具最主要的差異。支援：新增、刪除、移動、縮放、複製格位；水平分割、垂直分割、合併格位。

例：先建 2×2，再合併下面兩格 → 得到上 2 下 1。

**合併規則**：僅允許合併「聯集後為矩形」的選取集合，否則禁用該操作並提示。

### 9.4 [M] 自由拖曳建立格位

進入「新增格位」模式後：`Mouse Down → 拖曳 → Mouse Up` 建立 Slot。建立後可自由 Move / Resize。

### 9.5 [M] 吸附系統 Snap

吸附對象：紙張邊界、紙張中心、其他 Slot 邊與中線、水平／垂直參考線、Grid。
可切換 Snap On / Off（`[S]` 可調吸附距離，預設 6 px 螢幕距離，與 Zoom 無關）。

### 9.6 [S] 對齊與分布工具

多選後：左／右／上／下對齊、水平置中、垂直置中；等寬、等高、等尺寸；水平平均分布、垂直平均分布。

---

## 10. Slot 內容與編輯操作

### 10.1 [M] 內容放置

Source 由 Gallery 拖入 Slot 即建立關聯。同一 Source 可放入多個 Slot。

### 10.2 [M] 精細調整

Fit（Contain）／Fill（Cover）／Stretch、Scale、Offset X/Y、Rotation、Flip X/Y。
Rotation MVP 支援 0° / 90° / 180° / 270°；**[S]** 任意角度。

### 10.3 [M] 編輯操作

複製、清除內容、刪除、鎖定／解鎖。鎖定後不得 Move / Resize / Delete，避免誤操作。

### 10.4 [S] 批次套用

選取多個 Slot 後一次套用：Fit / Fill、Rotation、Scale、Alignment、內距。

---

## 11. 自動填版

### 11.1 [M] Auto Fill

將 Source Gallery 的頁面依序放入 Slot，不足時自動新增 Output Page。

例：PDF 30 頁 ＋ 4-up 版型 → 產生 8 頁；最後一頁 2 個 Source ＋ 2 個 Empty Slot。

### 11.2 [M] 填版規則

順序填入、逆序填入、僅奇數頁、僅偶數頁、每頁重複、**每張重複 N 次**。

證件照情境：一張圖片 → 重複 8 次 → 填滿 A4。

### 11.3 [M] Output Pages 管理

新增頁、刪除頁、複製頁、重新排序。

### 11.4 [M] 混合尺寸來源處理

當來源 PDF 各頁尺寸不一（例如同一份含 A4 與 A3），Auto Fill **以每個 Source 自身的 `cropBox` 尺寸各自計算 fit**，不做全域統一縮放。此行為需在 UI 顯示提示。

---

## 12. 檔案載入・來源管理・記憶體規則

### 12.1 [M] 支援格式

| 格式 | 載入 | PDF 匯出方式 | 優先級 |
| --- | --- | --- | --- |
| PDF | PDF.js 解析 | pdf-lib `embedPage`（向量保留） | [M] |
| PNG | Image / createImageBitmap | pdf-lib `embedPng` | [M] |
| JPG / JPEG | 同上 | pdf-lib `embedJpg` | [M] |
| WEBP | 同上 | **需先轉碼為 PNG**（見 §14.5） | [M] |
| SVG | 同上 | **pdf-lib 不支援 embed SVG** —— 需光柵化或轉路徑 | [S] |

支援多選、拖放、批次匯入。

### 12.2 [M] PDF 載入流程

```text
PDF → 取得頁數 → 建立 Source Page（含 mediaBox / cropBox / rotate）
    → 產生縮圖 → 加入來源頁面畫廊
```

支援頁碼範圍語法：`1-5`、`1,3,5`、`1-5,8,10-12`、奇數頁、偶數頁、全部。

### 12.3 [M] ⚠ 原始 bytes 保留規則（關鍵）

> `pdfjs.getDocument({ data: buffer })` 會把 ArrayBuffer **transfer 給 Worker 並 detach**。
> 之後 pdf-lib 再要用同一份 buffer 會直接拋 `ArrayBuffer is detached`。

**強制規則**：檔案讀入後立即保存原始 bytes 於 `SourceBinaryStore`，交給 PDF.js 的**必須是複本**（`buffer.slice(0)`）。Export 一律從 `SourceBinaryStore` 取原件。

此規則屬於 Phase 2 的驗收項目，不得延後到 Phase 9。

### 12.4 [M] Source Gallery

顯示縮圖、檔名、PDF 頁碼；支援多選、全選、刪除、旋轉、翻轉、複製、拖曳到 Canvas。
多選檔案時每張圖片皆建立一個 Source，PDF 依指定頁碼範圍（預設全部）建立一個
Source/頁。使用者可從左欄拖曳縮圖，或直接把檔案拖放到 Slot；後者置入第一個成功
讀入的 Source，其餘讀入內容仍完整保留於 Source Gallery。

### 12.5 [M] 大型 PDF 效能

不得一次 render 50～500 頁高解析 Canvas。採 Lazy Rendering + Virtual Gallery + Thumbnail Cache，只 render：目前可見頁面、鄰近頁面（前後各 5 頁）、目前使用中的頁面。

**具體門檻**（可依實測調整，但必須有明確數值）：

| 項目 | 設定 |
| --- | --- |
| Thumbnail 目標尺寸 | 長邊 200 px |
| Thumbnail Cache 上限 | 300 筆，LRU 驅逐 |
| Canvas Preview 解析度 | 目標 150 DPI，上限單張 4096 px 長邊 |
| Preview Cache 上限 | 60 筆，LRU 驅逐 |
| 同時進行的 render 工作 | 最多 3 個，其餘排隊 |

### 12.6 [M] 記憶體釋放

Source 刪除或被 LRU 驅逐時，必須釋放：Canvas（寬高設 0）、ImageBitmap（`close()`）、ObjectURL（`revokeObjectURL`）、PDF.js 的 `page.cleanup()` 與 `pdfDoc.destroy()`。

### 12.7 [M] 三層解析度分離

Thumbnail 低解析度、Canvas Preview 中解析度、PDF Export 原始解析度。三者互不共用快取。

---

## 13. Preview Renderer

### 13.1 [M] Canvas 顯示

顯示實際紙張比例、Slots、Source Preview、Guides、Crop Marks。支援 Zoom 與 Pan。

### 13.2 [M] Zoom

25% / 50% / 75% / 100% / 150% / 200% / Fit Page / Fit Width。
**僅改變 Preview，不影響真實紙張尺寸，不進入 History。**

### 13.3 [M] 選取

Shift + Click、Ctrl + Click、拖曳框選。

### 13.4 [M] PDF.js 的角色邊界

PDF.js **只負責** PDF Parsing、Thumbnail、Screen Preview。
**不得**把 PDF 頁面永久轉成圖片作為輸出來源。

### 13.5 [M] CropBox 一致性

PDF.js 的 `getViewport()` 以 **CropBox** 為準。Export 端必須同樣以 CropBox 為 boundingBox（見 §14.4），否則預覽與輸出位置不同。

---

## 14. Export Renderer（PDF 輸出）

### 14.1 [M] 輸出管線

```text
Original PDF bytes（來自 SourceBinaryStore）
 ↓ pdf-lib PDFDocument.load
 ↓ embedPdf / embedPage
 ↓ 套用 §6.3 矩陣（Scale / Rotate / Offset / Flip）＋ Clip
 ↓ drawPage 至 Output PDF
```

PDF 原始頁面必須維持 Vector / Text / Line，**避免 Rasterization**。
圖片來源直接 embed，**嚴禁** `DOM → html2canvas → JPG → PDF` 造成整頁點陣化。

### 14.2 [M] ⚠ pdf-lib `embedPage` 的已知限制（必須在實作前納入設計）

| 限制 | 影響 | 對策 |
| --- | --- | --- |
| 不帶 annotations | 超連結、表單欄位、註解遺失 | 列入已知限制並於 UI 提示；不在 MVP 修復 |
| 不自動套用來源頁 `/Rotate` | 橫向掃描 PDF 轉錯（最常見 bug） | 見 §14.3 |
| 預設用 MediaBox 而非 CropBox | 與 PDF.js 預覽不一致 | 見 §14.4 |
| 加密 PDF 需 `ignoreEncryption` | 仍可能失敗 | 載入時偵測並明確報錯，不靜默失敗 |

### 14.3 [M] `/Rotate` 正規化

載入時讀取每頁 `/Rotate`，並在 embed 時**先**套用該旋轉，使 Source 的 `naturalWidth/Height` 永遠代表「使用者實際看到的方向」。之後 §6.3 的 `rotation` 才是使用者額外指定的旋轉。兩者不得混為一談。

`/Rotate` 為 90 或 270 時，`naturalWidth` 與 `naturalHeight` 對調。

### 14.4 [M] boundingBox 一律用 CropBox

`embedPage(page, boundingBox)` 明確傳入該頁 CropBox（無 CropBox 時退回 MediaBox）。與 §13.5 使用同一份資料，由 geometry 模組提供。

### 14.5 [M] 圖片 embed

- PNG → `embedPng`，JPG → `embedJpg`。
- **WEBP：pdf-lib 不支援。** 載入時（或匯出前）以 Canvas 轉碼為 PNG 再 embed。透明 WEBP 一律轉 PNG，不透明可轉 JPEG（品質 0.92）以縮小檔案。
- 同一 Source 被多個 Slot 使用時，**只 embed 一次**並重複 `drawImage`，避免 PDF 膨脹。

### 14.6 [M] 輸出檔案設定

輸出 PDF 的 MediaBox 等於紙張尺寸（pt，四捨五入至小數 3 位）。中繼資料寫入 Producer 與建立時間；**不得寫入使用者檔名以外的個資**。

### 14.7 [M] 色彩

不做任何色彩轉換。CMYK PDF 內容以原樣嵌入並保留 CMYK；圖片維持 sRGB。此行為需寫在 UI 說明中，避免印刷用途誤解。

---

## 15. 列印路徑

### 15.1 [M] 列印一律經由 PDF（架構決策）

> **不採用**「`window.print()` 直接列印 DOM」。

原因：DOM 列印會造成第三套幾何實作，且受瀏覽器邊界、驅動縮放、預覽用中解析度圖影響，尺寸無法保證，與匯出的 PDF 不一致。

採用流程：

```text
按下「列印」
 ↓ 以 Export Renderer 產生 PDF（與「匯出 PDF」完全同一條路徑）
 ↓ blob URL 開啟
 ↓ 由瀏覽器內建 PDF Viewer 列印
```

如此列印與匯出保證輸出一致，第 15.3 的校正頁才有意義。

### 15.2 [S] 列印 CSS

若日後仍需 DOM 直接列印（例如快速草稿），以 `@media print` ＋ `@page { margin: 0 }` 實作，並在 UI 明確標示「草稿列印，尺寸不保證」。

### 15.3 [M] 列印校正頁

產生 100 mm × 100 mm 測試框（含刻度與說明文字）。使用者實際列印後以尺量測，確認印表機為 100% / Actual Size，避免自動 Fit 造成縮放。

---

## 16. 印刷輔助元素

| 功能 | 說明 | 優先級 |
| --- | --- | --- |
| Crop Marks | 可設定長度、與內容距離、線寬 | [M] |
| Bleed 出血 | 0 / 1 / 2 / 3 mm / 自訂 | [S] |
| Safe Area | 僅畫面預覽，**不列印、不匯出** | [S] |
| Header / Footer | 文字內容 | [S] |
| Page Number | 支援 `1 / 10` 格式（頁碼 / 總頁數） | [S] |
| 文字框 Text Box | 文字、字型、大小、粗體、對齊、旋轉 | [S] |
| 浮水印 | 文字／圖片；透明度、位置、角度、大小 | [S] |

浮水印典型內容：草稿、COPY、案件編號、日期。

**[S] 文字與字型注意**：pdf-lib 標準字型不含中日韓字符，中文文字框／浮水印必須內嵌字型子集（`fontkit`），會顯著增加打包體積 —— 屬第二階段議題。

---

## 17. 專案與模板

### 17.1 [M] 專案儲存 / 載入

格式 `.json`，內容包含：Project Settings、Paper、Pages、Slots、Transforms、Template 參照、Source Metadata（檔名、頁碼、尺寸、雜湊）。

**Source 二進位不內嵌**（避免檔案過大）。載入時若找不到來源，提示使用者重新指定原始 PDF／圖片，並以檔名＋頁數＋尺寸比對。

`[S]` 提供「含來源打包」選項（Base64 內嵌，檔案較大）。

### 17.2 [M] 版本欄位

專案 JSON 必須含 `schemaVersion`。載入舊版時執行 migration，不得靜默忽略未知欄位。

### 17.3 [M] Layout Template

儲存／載入版型（例：`A4_上2下1`、`A4_照片4格`、`A3_6格`、`證件照8格`）。僅保存 Paper、Margins、Slots、Layout，不保存 Source。

`[S]` Template Library（內建常用版型集合）。

---

## 18. 使用者介面

### 18.1 [M] 三區架構

```text
┌──────────────┬──────────────────────┬──────────────┐
│ Source       │                      │ Properties   │
│ Gallery      │    Paper Canvas      │ Panel        │
│ (PDF Pages   │  (紙張・Slots・      │              │
│  Images      │   Guides・Crop Marks)│              │
│  Assets)     │                      │              │
└──────────────┴──────────────────────┴──────────────┘
```

產品 UI 提供「簡易／詳細」兩種密度模式，預設為簡易模式；簡易模式保留
Source Gallery、Paper Canvas、版型/紙張設定與常用操作，詳細模式才展開
進階工具列、頁面管理與完整 Properties Panel。模式偏好可由瀏覽器本機
儲存，不能寫入任何使用者檔案內容。Canvas viewport 必須允許縮小
(`min-width: 0`)，Properties Panel 可在 240 px 至
`min(720 px, viewport 寬度 × 60%)` 間拖曳調整，雙擊回復 300 px。

### 18.2 [M] Properties Panel

依選取物件切換：Paper Properties、Slot Properties、Image Properties、Text Properties（[S]）、Export Properties。
未選取時顯示文件屬性；選取 Slot、Text Box 或多個物件時顯示對應面板，
並提供「回到文件屬性」操作。簡易模式保留 Fit、Scale、Rotation、清除
內容等高頻操作，詳細模式再展開 Offset、Flip、鎖定、分割、Z-order、
Bleed、Safe Area、Header/Footer、頁碼、浮水印與 Crop Marks 等欄位。
Source Gallery 提供「清空所有格位內容」與「清空所有來源」兩個獨立
動作；後者必須顯示影響數量並要求確認，兩者各自只產生一筆 Undo。
點擊 Canvas 空白處或按 `Esc` 清除選取並回到文件屬性。

### 18.3 [S] 鍵盤快捷鍵

| 鍵 | 功能 |
| --- | --- |
| `Delete` | 刪除 |
| `Ctrl+C` / `Ctrl+V` | 複製 / 貼上 |
| `Ctrl+Z` / `Ctrl+Y` | Undo / Redo（**[M]**） |
| `Ctrl+A` | 全選 |
| `Esc` | 取消選取，回到文件屬性 |
| `Arrow` | 微移 |
| `Shift+Arrow` | 大幅微移 |

---

## 19. 打包與離線約束

### 19.1 [M] 開發期結構

```text
src/
 ├─ app.js
 ├─ store.js        ← §7 單一 mutation 入口
 ├─ geometry.js     ← §6 唯一幾何模組
 ├─ layout.js
 ├─ sources.js
 ├─ preview.js
 ├─ export.js
 └─ style.css
```

Release 時 build 成單一 `index.html`，內嵌 CSS、JS、pdf.js、pdf-lib、Icons。

### 19.2 [M] ⚠ `file://` 環境的三重限制（決定專案可行性）

> 本專案要求「雙擊 HTML → 瀏覽器開啟 → 選取本機檔案 → 開始排版」。
> 在 `file://` 協定下有以下硬限制，**必須在寫任何功能前先驗證**：

1. **ES Module 不可用**：Chrome 在 `file://` 下以 origin `null` 處理，`<script type="module">` 會被 CORS 擋掉。
   → 打包**必須** bundle 成 classic script（IIFE / UMD），不得使用原生 ESM 載入。開發期可用 dev server 跑 ESM，但 build 產物必須是 classic。
2. **PDF.js Worker 需獨立檔案**：單檔內嵌只能把 worker 原始碼轉成字串並以 **Blob URL** 建立 Worker。`disableWorker` 方案會凍結 UI 且新版支援度差，不採用。
3. **CSP / 沙箱差異**：部分瀏覽器對 `file://` 的 Blob Worker 行為不一致，需實測 Chrome 與 Edge。

**指定 bundler：esbuild**（單一執行檔、無需 node_modules 生態、輸出 IIFE 簡單可控）。

### 19.3 [M] 離線原則

正式 Release 核心排版／匯出／列印功能不得依賴 CDN、Server、API、Internet。
**唯一例外見 §19.4**，且該例外不得以任何方式影響核心功能離線可用。

### 19.4 [S] 手動更新檢查（唯一被允許的連網例外）

> 2026-08-05 使用者決議：新增此功能，見 decision_log D-007。
> 這是本文件中**唯一**允許連網的地方，範圍與行為被嚴格限制如下。

**觸發方式**：僅限使用者於 UI 主動點擊「檢查更新」按鈕。**不得**在頁面載入時
自動觸發、**不得**背景輪詢、**不得**定時檢查。

**行為**：

```text
使用者點擊「檢查更新」
 ↓ fetch: https://api.github.com/repos/cworkfox-source/pdfprint-layout/releases/latest
 ↓ 比對回傳 tag_name 與頁面內嵌的 APP_VERSION（semver 比較）
 ↓ 有新版 → 顯示卡片：版本號 + release notes 摘要 + 「前往下載」連結
 ↓ 無新版 / 例外 → 顯示「目前已是最新版」或「無法檢查更新（可能離線）」
```

- 「前往下載」連結指向 GitHub Release 頁面，**由使用者手動下載新的 `index.html`
  並取代舊檔**。`file://` 下瀏覽器沙箱無法自我覆寫本機檔案，因此不存在「自動
  安裝」這回事——這是架構限制，不是產品選擇。
- 此請求為公開唯讀 REST 查詢，**不帶任何使用者資料、不含任何已載入的檔案內容**。
- 失敗（離線、API 限速、GitHub 不可達）時僅顯示提示文字，不得阻塞或影響任何
  核心功能。
- UI 需明確標示此按鈕會連網（例如按鈕旁小字：「將連線 GitHub 查詢最新版本」），
  不得讓使用者誤以為工具仍是純離線。

**驗收**：見 §23.8。

### 19.5 [S] GitHub 發布流程

- Repo：public，`https://github.com/cworkfox-source/pdfprint-layout`。
- 版本號採 semver，單一來源（例如 `src/version.js` 或 build 時注入常數），與
  git tag（`vX.Y.Z`）保持一致，兩者不同步視為 release 流程錯誤。
- 建議流程：打 tag → CI（GitHub Actions）跑 esbuild build → 產出單檔
  `index.html` 上傳為 Release Asset → 撰寫 release notes。
- Push／建立 repo／發 release 的執行權限例外，見 `AGENTS.md` Boundaries
  「GitHub publish exception」與 decision_log D-006 —— 範圍嚴格限定在這一個
  repo，且不含 force push 或改寫歷史。
- 首個推送內容僅為文件（`docs/`、`AGENTS.md` 等），不含任何程式碼；正式
  Release Asset 要等 Phase 11 才會產出。

---

## 20. 安全與隱私

- [M] 所有檔案只存在 Browser Memory；不得 Upload、Cloud Sync、Remote Processing。
  **§19.4 的更新檢查是唯一例外**，且該例外不涉及使用者檔案，僅查詢公開版本號。
- [M] 介面顯示：「所有文件均於本機瀏覽器處理，不會上傳。」需在「檢查更新」
  按鈕旁另外標示連網行為（見 §19.4），避免與此聲明矛盾。
- [M] 不得寫入 localStorage 任何檔案內容（僅可存 UI 偏好設定，例如是否記得
  上次檢查更新的時間戳記）。
- [M] 匯出 PDF 的 metadata 不得含使用者路徑或系統資訊。

---

## 21. 技術棧

| 模組 | 技術 |
| --- | --- |
| UI | Vanilla HTML5 |
| CSS | Modern CSS |
| JS | ES6+（**build 產物須為 classic script，見 §19.2**） |
| PDF Parsing | PDF.js |
| PDF Export | pdf-lib |
| Drag & Drop | Pointer Events |
| Canvas | HTML Canvas |
| File | File API / Blob / ArrayBuffer |
| Project Save | JSON |
| Bundler | esbuild（輸出 IIFE 單檔） |

原則：**能用原生 API 就不加大型 Framework。**

排序功能自行實作，不引入 SortableJS（避免額外體積與 ESM 相容問題）。

---

## 22. 開發階段

### Phase −1：可行性 Spike ⚠ 最優先

> 整個「單檔離線」定位押在這一步。**未通過即需重新評估產品形態**（改為需解壓的資料夾，或需 local server）。

產出：一個單檔 HTML，在 `file://` 下用 Blob URL Worker 成功載入並 render 一頁 PDF，且同一份 bytes 之後仍能交給 pdf-lib 匯出。

通過條件見 §23.1。**此 Spike 未通過前不進入 Phase 0。**

### Phase 0：Data Model

完成 Project / Source / Page / Slot / Transform / Template 的資料結構、`geometry.js`、`store.js`（單一 mutation 入口）。

**不得從 DOM 開始設計。**

### Phase 1：Paper & Preview Engine

A4 / A3、Portrait / Landscape、Margin、Zoom、Canvas、pt → Preview 座標換算。

### Phase 2：Source Engine

Image Upload、PDF Upload、PDF.js、Thumbnail Gallery、Source Management、**§12.3 bytes 保留規則**、§12.5 快取門檻。

### Phase 3：Layout Engine

1-up / 2-up / 4-up / 6-up / 9-up / Custom Grid / 上 2 下 1 / 上 1 下 2 / 左 1 右 2。

### Phase 4：Free Layout Designer

Create / Move / Resize / Split / Merge / Delete / Duplicate / Align / Snap / Z-order。
**本 Phase 是與一般 N-up 工具的主要差異。**

### Phase 5：Source Placement

拖曳放置、Fit / Fill / Stretch、Rotation、Scale、Offset、Flip、Clip。

### Phase 6：Auto Imposition

Auto Fill、Page Generation、Repeat、Reverse、Odd / Even、Empty Slot、混合尺寸處理。

### Phase 7：PDF Export

PDF Source → Vector Embed；Image Source → Image Embed；`/Rotate` 正規化、CropBox、WEBP 轉碼、資源去重。

> **注意：Export 提前到 Print Aids 之前。**
> 原因：Export 是本產品的價值核心與最大技術風險，且 §23.3 的等價性驗證必須儘早建立，
> 否則後續每個功能都在未驗證的幾何基礎上疊加。

### Phase 8：Print Path

列印經由 PDF（§15.1）、列印校正頁、Crop Marks。

### Phase 9：Project System

Save / Load Project、Save / Load Template、Undo / Redo、schemaVersion migration。

### Phase 10：Print Aids 進階與第二階段功能

Bleed、Safe Area、Page Number、Header / Footer、Text Box、Watermark、SVG、進階對齊、快捷鍵、Template Library。

### Phase 11：Standalone Build

Single HTML、Offline、No CDN、No Server 的正式 build 與跨瀏覽器驗證。

> **範圍澄清（2026-08-06 追加，見 decision_log D-020）**：Phase 11 完成的
> `index.html` 打包入口是 `dev/print-aids.html`——一份自我標示「不是產品
> UI，僅供人工／自動化檢查」的 dev harness，並非 §18.1/§18.2 描述的產品
> 介面。Phase 11 的驗收範圍僅止於「打包管線本身可重現、單檔離線」，不含
> 產品 UI 的存在與可用性；產品 UI 由下方 Phase 12 補上。

### Phase 12：Product UI

> 2026-08-06 使用者決議新增，見 decision_log D-020。§18.1「三區架構」與
> §18.2「Properties Panel」皆標為 **[M]**，但在 Phase 0–11 的排序中從未
> 被實際排入任何階段——Phase 0–10 完整實作了引擎（排版／來源／自動填版／
> 匯出／列印／專案／進階印刷輔助），但這些能力僅能透過個別 Phase 的
> dev harness（`dev/*.html`，每個只驗證單一 Phase 的切面）操作，沒有任何
> 單一介面能讓使用者依 §1 產品定位完整走過「載入 → 排版 → 匯出／列印」
> 的流程。Phase 12 把已完成的引擎接上 §18 規定的產品介面，並補上隨之
>發現的周邊缺口，不新增任何 §4–§17 尚未定義的功能語意。

依 `docs/remediation_plan.md`（2026-08-06 缺口盤點,R-2/R-4/R-5/R-6 工作包）
分六步交付：

1. **12a 骨架 + Paper Canvas**：§18.1 三區 flex/grid 骨架、頂部工具列
   （開啟／儲存專案、匯出、列印、校正頁、Undo/Redo、Zoom、§19.4 檢查
   更新入口）、中央畫布串接既有 `src/preview.js` 全套 renderer。全繁體
   中文單語介面（不建 i18n 框架）。移除 readout/log/verify 等除錯元素。
2. **12b Source Gallery（左欄）**：§12.4 縮圖、頁碼範圍輸入、刪除、拖曳
   到 Slot；SVG Source 接線（Phase 10 已有引擎、`dev/print-aids.html`
   未接）；§25 明訂的 Annotations 遺失提示。
3. **12c Properties Panel（右欄）+ §10.4 批次套用**：依選取切換
   Paper／Slot／Text／多選 屬性面板；「文件」分頁收納 Bleed/Safe
   Area/Header-Footer/Page Number/Watermark（含圖片來源選取 UI）/Crop
   Marks；多選批次套用 fit/rotation/scale/alignment（§10.4）。
4. **12d 畫布編輯互動**：Select/Create 模式、多選、拖曳移動（Slot 與 Text Box）、縮放
   handle、Snap、分割/合併/刪除/複製，沿用 Phase 4 已驗證的互動邏輯。
5. **12e 頁面管理 + Auto Fill + 專案系統整合**：Output Pages 管理、Auto
   Fill 面板（含 §11.4 混合尺寸提示）、專案存讀 + relink 流程 UI、
   Template 存取／套用 + 內建 Template Library。
6. **12f 鍵盤快捷鍵接線 + 複製貼上**：§18.3 `src/keymap.js` resolver
   接上實際事件層與 reducers；Ctrl+C/V 範圍為「頁內 Slot 複製貼上」。

另含 §19.4 手動更新檢查（`src/update-check.js`，APP_VERSION 起點
`1.0.0`）與內建使用者說明（快速上手、快捷鍵表、已知限制）。完成後
`scripts/build.mjs` 的 build entry 由 `dev/print-aids.html` 改為新的
`app.html`，`index.html` 產物隨之改變（`dev/` 系列 harness 維持原樣，
繼續作為引擎驗證用途保留，不受影響）。

### 22.1 開發優先順序總覽

```text
Feasibility Spike → Data Model → Paper Engine → Slot Layout Engine
→ Source Engine → Free Layout Designer → Preview → Auto Fill
→ PDF Export → Print Path → Project / Template → 第二階段 → Standalone HTML
→ Product UI（Phase 12）→ Re-build
```

---

## 23. 驗收條件（可量測）

> 每條都必須能實際判定通過或失敗。「比例正確」「計算正確」不是驗收條件。

### 23.1 Phase −1 Spike [M]

1. 單檔 HTML 以 `file://` 在 Chrome 與 Edge 開啟，Console 無錯誤。
2. 選取本機 PDF 後 3 秒內顯示第 1 頁 Canvas。
3. 同一份 PDF 隨即以 pdf-lib 匯出一頁新 PDF 且可正常開啟（證明 bytes 未被 detach）。

### 23.2 Phase 1 / 紙張與尺寸 [M]

1. 匯出 A4 PDF 的 MediaBox = `595.276 × 841.890` pt，誤差 ≤ 0.01 pt。
2. 匯出 A3 PDF 的 MediaBox = `841.890 × 1190.551` pt，誤差 ≤ 0.01 pt。
3. Landscape 切換後寬高對調，Slot 相對位置比例不變（Normalized 值不變）。
4. Zoom 由 25% 切至 200%，匯出結果的 byte 內容不變（證明 Zoom 不影響輸出）。

### 23.3 Preview ↔ Export 等價性 [M]

> 本專案最重要的一條驗收。

對同一份專案：
1. 取每個 Slot 內容的四個角點，分別由 Preview Renderer 與 Export Renderer 計算其在紙張上的座標。
2. 兩者差異必須 **≤ 0.1 mm（≈ 0.28 pt）**。
3. 測試涵蓋：contain / cover / stretch × rotation 0/90/180/270 × flipX/flipY × offset ≠ 0 × 來源 `/Rotate` = 90 的 PDF。
4. 此檢查應寫成可重複執行的腳本，每次改動 geometry 後執行。

### 23.4 Layout Engine [M]

1. Slot 座標與紙張尺寸完全分離：同一 Template 套用於 A4 與 A3，所有 Slot 的 Normalized 值完全相同。
2. 合併非矩形選取時操作被禁用並顯示提示。

### 23.5 Source Engine / 效能 [M]

1. 載入 100 頁 PDF 後，同時存在的高解析 Canvas 數量 ≤ 3（以計數器驗證）。
2. 100 頁 PDF 載入完成後瀏覽器分頁記憶體增幅 < 500 MB。
3. 刪除全部 Source 後，記憶體回落至載入前 +50 MB 內。

### 23.6 列印 [M]

1. 校正頁列印後實測 100 mm × 100 mm，誤差 ≤ 0.5 mm（印表機設定為 Actual Size）。
2. 「列印」與「匯出 PDF」產生的 PDF byte 內容一致。

### 23.7 Export 品質 [M]

1. 文字型 PDF 匯出後，於 PDF 閱讀器中仍可選取與搜尋文字（證明未 rasterize）。
2. 同一張圖片放入 8 個 Slot，輸出 PDF 內該圖片物件僅出現 1 份。
3. 來源 `/Rotate` = 90 的掃描 PDF 匯出後方向正確。

### 23.8 更新檢查（連網例外）[S]

1. 頁面載入後、使用者未點擊「檢查更新」按鈕前，以瀏覽器 Network 面板確認**無
   任何對外請求**。
2. 點擊「檢查更新」後，僅出現一筆對 `api.github.com` 的 GET 請求，不含使用者
   檔案資料、不含個資。
3. 中斷網路後點擊「檢查更新」，顯示「無法檢查更新（可能離線）」，核心排版／
   匯出／列印功能不受影響（可繼續正常操作）。
4. 偵測到新版時，顯示的連結可正確導向該版本的 GitHub Release 頁面。

### 23.9 Phase 12 Product UI [M]

> 2026-08-06 追加，見 decision_log D-020。

1. 以 build 產物 `index.html`（`file://` 開啟）為準，不依賴任何 `dev/*.html`：
   使用者可在不打開瀏覽器開發者工具的前提下，完成「載入 PDF/圖片 →
   套用 Preset 或自訂版型 → 拖曳來源到 Slot → Auto Fill → 匯出 PDF」
   全流程。
2. 畫面符合 §18.1 三區配置（Gallery / Canvas / Properties），且無殘留
   除錯用文字（JSON dump、`[PASS]`/`[FAIL]` log 等）。
3. §18.2 五種 Properties Panel（Paper／Slot／Image／Text／Export）依選取
   物件正確切換顯示。
4. §18.3 表列的每個快捷鍵在畫布取得焦點時實測有效（Delete/Ctrl+Z/
   Ctrl+Y/Ctrl+C/Ctrl+V/Ctrl+A/Arrow/Shift+Arrow）。
5. §10.4 批次套用：對 3 個以上、初始狀態互不相同的已選取 Slot 一次套用
   fit/rotation/scale 中至少一項，結果對每個 Slot 生效且以單一步驟
   即可 Undo。
6. SVG 檔案可經 UI 載入、拖入 Slot、匯出後於 PDF 閱讀器中正確顯示。
7. 浮水印選擇「圖片」類型時，UI 提供從已載入 Source 選取圖片的方式，
   且匯出結果反映所選圖片。
8. §25 表列「Annotations 遺失」於載入含超連結/表單欄位的 PDF 時，UI
   顯示明確提示文字。
9. 內建說明可從 UI 開啟，內容涵蓋快速上手步驟、快捷鍵表，以及 §25、
   §11.4、§17.1 表列的每一項已知限制。

---

## 24. 測試計畫

### 24.1 排版測試

Slot 數：1、2、3、4、6、9、16。
非對稱：2+1、1+2、1+3、重疊 Slot、自由格位。

### 24.2 PDF 測試

頁數：1、10、50、100+。
類型：文字 PDF、掃描 PDF、工程圖、圖片 PDF、混合 PDF、含 `/Rotate` 的 PDF、CropBox ≠ MediaBox 的 PDF、加密 PDF（需正確報錯）、混合頁面尺寸 PDF。

### 24.3 圖片測試

Portrait、Landscape、超大圖（> 8000 px）、極小圖、透明 PNG、WEBP（含透明）。

### 24.4 瀏覽器測試

主要：Chrome、Edge（皆須測 `file://` 與 `http://`）。
次要：Firefox、Safari。

### 24.5 列印測試

A4 = 210 × 297 mm、A3 = 297 × 420 mm、100 mm 校正框，確認 Actual Size 尺寸正確。

---

## 25. 明確排除與已知限制

| 項目 | 說明 |
| --- | --- |
| Annotations 遺失 | `embedPage` 不帶超連結、表單欄位、註解。UI 須提示 |
| 加密 PDF | 不支援，載入時明確報錯 |
| SVG 輸出 | pdf-lib 不支援 embed SVG，第二階段以光柵化或轉路徑處理 |
| 色彩管理 | 不做 ICC / CMYK 轉換 |
| 中文文字框 | 需內嵌字型子集，第二階段議題 |
| **雙面列印 / 背面對齊** | **MVP 不做**，列為第二階段（名片、卡片類需求） |
| 書帖排版 | 不做 signature / folding scheme |
| 標籤紙預設 | 不內建廠商標籤版型 |

---

## 26. 風險登記

| # | 風險 | 影響 | 對策 |
| --- | --- | --- | --- |
| R1 | `file://` 下 Blob Worker 或 bundle 失敗 | **產品形態不成立** | Phase −1 Spike 先驗證（§23.1） |
| R2 | Preview 與 Export 幾何飄移 | 使用者看到的與印出的不同 | 單一 geometry 模組 ＋ §23.3 自動化檢查 |
| R3 | ArrayBuffer detach | Export 完全無法運作 | §12.3 bytes 保留規則，Phase 2 即驗收 |
| R4 | `/Rotate` 與 CropBox 處理錯誤 | 掃描 PDF 方向／位置錯誤 | §14.3、§14.4；測試資料須含此類 PDF |
| R5 | 大型 PDF 記憶體爆掉 | 分頁崩潰 | §12.5 門檻 ＋ §23.5 量測 |
| R6 | 單檔體積過大（pdf.js + pdf-lib 內嵌） | 開啟緩慢 | 量測 build 體積，必要時延後載入 pdf-lib |
| R7 | Undo/Redo 後期補做導致重寫 | 進度損失 | §7.1 單一 mutation 入口列為 Phase 0 驗收 |
