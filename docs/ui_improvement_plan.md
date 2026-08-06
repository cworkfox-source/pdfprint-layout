# UI 改善計畫書(U-1 ~ U-4)

> 提出日期:2026-08-06 · 範圍:`app.html`(產品 UI)+ `src/keymap.js`
> 對應 plan.md §18(使用者介面)、§12.4/§12.6(Source Gallery / 記憶體釋放)
> 狀態:**已執行(2026-08-06)** · 實作與文件同步完成;驗證結果見 change log

---

## 1. 需求來源

使用者於 2026-08-06 提出 4 點:

| # | 使用者原話 | 對應工作包 |
|---|---|---|
| 1 | 有辦法分成簡易介面跟詳細介面,大部分時候只是想快速處理 | **U-1 介面模式** |
| 2 | 點擊格位後,點擊其他空白處應該自動跳出,回到屬性欄 | **U-2 取消選取** |
| 3 | 要有一鍵清除已經放入格位的 PDF 檔案 | **U-3 一鍵清除** |
| 4 | 屬性板塊可以往左拉寬一點,降低使用拉棒調整視窗的頻率 | **U-4 面板可調寬** |

---

## 2. 現況勘查(重要:工作區有未提交的半成品)

`git status` 顯示 `app.html` 為 **已修改但未提交**。比對 `git diff` 後確認:
**前一次工作階段已經寫好 U-1 / U-3 / U-4 的 HTML 與 CSS 骨架,但完全沒有寫
對應的 JavaScript**,因此目前這三個功能在瀏覽器上是「按了沒反應」的死按鈕。

已存在(未提交)的骨架:

| 元素 | 位置 | 現況 |
|---|---|---|
| `#ui-mode-simple` / `#ui-mode-advanced` 按鈕 | app.html:225-226 | 無 `addEventListener`,無人設定 `body[data-ui-mode]` |
| `body[data-ui-mode="simple"] .adv-only {display:none}` | app.html:77 | 規則存在,但 `<body>` 從未帶上該屬性 → 等同永遠是「詳細」模式 |
| 15 處 `.adv-only` class 標記 | 工具列、頁面列 | 標記已下好,尚未涵蓋 Properties Panel |
| `#btn-clear-sources`「一鍵清除全部來源」 | app.html:273 | 無 `addEventListener` |
| `#props-resizer` 拖曳條 + `--props-w: 300px` | app.html:72-73, 303 | 只有一條灰色直條,無任何拖曳 JS |

因此本計畫的實際工作量大部分是**補上缺的 JS**,而非從零設計。此外必須先做
一次**前置整理**(U-0),因為這批未提交變更本身帶有兩個缺陷,見 §3。

其他相關現況:

- `renderPropertiesPanel()`(app.html:796)在 `document.activeElement` 位於面板
  內時會**跳過重建**(app.html:805),這是刻意設計(避免拖曳 range 時節點被
  抽換),U-2 必須確認不會與它衝突。
- `deleteSource()`(app.html:766)對每個受影響 Slot 各 `commit` 一次,沒有
  coalescing → 刪 1 個來源可能產生 N 筆 undo 紀錄。U-3 若沿用同寫法,「一鍵
  清除」會把 undo 堆疊灌爆。
- `#main` 的 grid 為 `var(--gallery-w) 1fr var(--resizer-w) var(--props-w)`,
  但 `#canvas-viewport` **沒有 `min-width: 0`**;grid 項目預設 `min-width: auto`,
  面板被拉寬時中央欄可能拒絕收縮而把版面撐破。U-4 必須一併修。

---

## 3. 目標與非目標

**目標**

- G1 一鍵在「簡易 / 詳細」兩種介面密度間切換,簡易為預設;簡易模式同時作用於
  **工具列、頁面列、Properties Panel**(只做工具列不足以解決「快速處理」)。
- G2 點擊畫布空白處(含紙張外的灰色區域)自動取消選取,屬性欄回到文件/紙張屬性。
- G3 提供不需逐格點的「清空」動作,一次把已放入格位的內容清掉。
- G4 Properties Panel 可用滑鼠拖曳加寬,並修好上述 `min-width` 隱患。

**非目標(本次不做)**

- 不動 Source Gallery 的寬度(使用者只提到屬性面板)。
- 不改任何引擎模組(`src/*.js`)的幾何/匯出行為 —— 唯一會動到的 `src` 檔是
  `src/keymap.js`,且只新增一個按鍵對應。
- 不做 responsive / 手機版版面。
- 不做自訂「哪些功能算進階」的使用者設定介面(進階清單寫死在程式碼中)。

---

## 4. 各工作包設計

### U-0 前置整理(必須先做,約 15 分鐘)

1. `<body>` 直接寫成 `<body data-ui-mode="simple">`。
   **理由**:若只靠 JS 在載入後設定,首次繪製會先閃出完整的詳細介面再隱藏
   (FOUC)。寫在 HTML 上可讓首屏就是正確的。
2. `#canvas-viewport` 補 `min-width: 0`(修 §2 的版面撐破隱患)。
3. `deleteSource()` 的迴圈改用 `store.commit(..., { coalesceKey: 'del-src:<id>' })`
   並在結束後 `store.endCoalescing()` → 刪一個來源 = 一步 undo。

### U-1 簡易 / 詳細介面模式

**做法**:純 CSS 切換 + 一個 body 屬性,不改變任何 render 邏輯。

```
setUiMode(next):
  document.body.dataset.uiMode = next            // 'simple' | 'advanced'
  兩顆按鈕 classList.toggle('active', ...)        // .active 樣式已存在
  if (next === 'simple') setMode('select')        // 見下方「必要副作用」
  safeStorageSet('ui-mode', next)                 // try/catch 包住
```

**必要副作用**:切回簡易模式時強制 `setMode('select')`。否則使用者若停在
「建立格位」模式,切簡易後該按鈕被隱藏,會卡在無法離開建立模式的狀態。

**不需要呼叫 `render()`**:`.adv-only` 全靠 CSS,面板重繪時新產生的 HTML 也
會自動吃到 `body[data-ui-mode]` 規則(這正是原作者選 body 屬性的原因)。

**進階功能清單**(即掛 `.adv-only` 的項目):

| 區域 | 簡易模式保留 | 簡易模式隱藏(進階) |
|---|---|---|
| 工具列 | 復原/重做、縮放、列印、匯出 PDF、說明、簡易/詳細切換 | 開啟/儲存專案、選取/建立格位/吸附、檢查更新、校正頁 *(已標記)* |
| 來源欄 | 載入檔案、一鍵清除、PDF 頁碼 | (無) |
| 頁面列 | 新增、複製、刪除 | 上移 / 下移 *(已標記)* |
| **Properties Panel(本次新增標記)** | 紙張與版型(尺寸/方向/邊距/間距/Preset/自訂 Grid)、Auto Fill | 專案名稱、版型範本 Template、Bleed、Safe Area、頁首/頁尾、頁碼、浮水印、裁切標記、新增文字框 |
| **格位屬性(本次新增標記)** | Fit 模式、縮放、旋轉 90°、清除內容、刪除、複製 | 水平/垂直偏移、翻轉、鎖定、分割、Z 順序 |
| 多選面板 | 維持原樣不變(降低風險) | — |

Properties Panel 的標記方式:在 `paperAndDocumentPanelHtml()` / `slotPanelHtml()`
的樣板字串中,對應的 `<details>` / `<label>` / `<div class="field-row">` 加上
`adv-only` class。**不需要新增任何 JS 分支**。

**說明對話框**:「快速上手」段落加一行說明兩種模式的差異與切換位置。

### U-2 點空白處自動取消選取

**根因**:目前「取消選取」只有一條路徑 —— `#paper-host` 上的 marquee(拖曳
框選)在 `pointerup` 時若命中 0 個格位才會 `setSelection([])`(app.html:1592-1605)。
點在 `#canvas-viewport` 的灰色留白、工具列、來源欄上時**完全沒有監聽器**,
選取狀態因此殘留,屬性欄也就停在「格位屬性」。

**三條互補的修法**(建議三條都做,成本都很低):

1. **畫布留白點擊**:在 `#canvas-viewport` 加 `pointerdown` 監聽,
   `if (!e.target.closest('#paper-host')) setSelection([])`。
   這是使用者最直覺的動作,也是本次的主修。
2. **Esc 鍵**:`src/keymap.js` 的 `resolveShortcut()` 新增
   `if (key === 'Escape') return { type: 'clearSelection' }`,並在
   `src/keymap.test.js` 補測試;`app.html` 的 keydown switch 新增對應 case。
   *(這是本次唯一動到 `src/` 的地方。放 keymap.js 而非寫死在 app.html,是為了
   維持「按鍵語意集中在 keymap.js、DOM 綁定留在 app 殼層」的既有分工。)*
3. **明確的返回按鈕**:在格位/文字框/多選面板最上方加一顆
   「← 回到文件屬性」(`data-action="clear-selection"`,該 action **已存在**,
   見 app.html:1253)。當版面被格位鋪滿、沒有空白可點時,這是唯一的出路。

**與既有機制的相容性檢查**:`renderPropertiesPanel()` 在焦點位於面板內時會
略過重建。但在非可聚焦元素上按下滑鼠會先讓輸入框 blur(焦點回到 `body`),
因此點畫布留白 → 面板重建,行為正確。**驗證時仍需實測**「在屬性欄輸入框打字
→ 直接點畫布留白」這條路徑。

### U-3 一鍵清除

**歧義釐清**:使用者說的「清除已放入格位的 PDF」有兩種讀法 ——
(a) 清空格位內容但保留已載入的來源清單;(b) 連來源一起移除。
未提交的骨架做的是 (b)。**建議兩顆都提供**,因為兩者的成本幾乎相同,而語意
完全不同(見 §7 決策點 D-3)。

| 按鈕 | 行為 | 保留 |
|---|---|---|
| 「清空所有格位內容」 | 所有頁的所有 Slot 執行 `clearSlotContentAction` | 版型、格位、來源清單全部保留 |
| 「清除全部來源」*(骨架已有)* | 上述 + 移除全部 Source + 清浮水印引用 + `engine.releaseSource()` | 版型與格位保留(變空框) |

**兩顆共通的實作要求**:

- **確認對話**:`window.confirm()`,並在訊息中寫出受影響數量
  (例:「將清空 3 頁共 12 個格位的內容,確定嗎?」)。這是不可逆感很強的動作。
- **單一 undo 步驟**:所有 `commit` 帶同一個 `coalesceKey`,結束後
  `store.endCoalescing()`。**這是本工作包最容易做錯的一點** —— 不加的話
  清除 20 個格位就會產生 20 筆 undo 紀錄。
- **記憶體釋放(僅「清除全部來源」)**:依 §12.6 的既有順序 ——
  先清 Slot 引用 → 清浮水印引用 → `removeSourceAction` → `sources.delete()` →
  `requestedPreviews.delete()` → `await engine.releaseSource()`。
  順序錯會踩到 decision_log **D-015**(Export 丟 "unknown source")。
- **無事可做時 disable**:`renderSourceGallery()` 中依
  `st.sources.length` / 是否有任何 slot 有 `sourceId` 切換 `disabled`。

**位置**:兩顆都放在來源欄工具列(`#gallery-toolbar`),簡易模式可見。

### U-4 Properties Panel 可拖曳加寬

**做法**:`#props-resizer` 上的 pointer 拖曳,改寫 `:root` 的 `--props-w`。

```
pointerdown : setPointerCapture, 記下 startX 與目前面板寬度,
              加 .dragging class,document.body.style.userSelect = 'none'
pointermove : w = clamp(startW - (e.clientX - startX), MIN, MAX)
              documentElement.style.setProperty('--props-w', w + 'px')
              debounce(render, 150)   // 見下方「為什麼要 render」
pointerup   : releasePointerCapture, 還原 class/userSelect,
              render(), safeStorageSet('props-w', w)
dblclick    : 還原 300px(元素的 title 已經對使用者這樣承諾了)
```

- **上下限**:`MIN = 240px`,`MAX = Math.min(720, window.innerWidth * 0.6)`。
- **為什麼要 `render()`**:`zoomMode` 為 `fit-page` / `fit-width` 時,縮放比例
  是從 `#canvas-viewport` 的 `clientWidth/Height` 算出來的(app.html:600-607)。
  拖曳面板不會觸發 `window.resize`,不重繪的話紙張縮放會停在舊值。拖曳中用
  既有的 `debounce()` 節流,放開時再 render 一次確保收斂。
- **搭配 U-0 的 `min-width: 0`**:兩者必須一起,否則拉寬時中央畫布欄不肯收縮。
- **不做**(留待日後視情況):面板 ≥ 420px 時把 `.field-grid` 從 2 欄改 3 欄。
  先觀察「簡易模式少掉大半區塊 + 面板可加寬」是否已經足夠。

---

## 5. 檔案異動清單

| 檔案 | 異動 | 工作包 |
|---|---|---|
| `app.html` | `<body>` 加 `data-ui-mode="simple"`;`#canvas-viewport` 加 `min-width:0`;Properties Panel 樣板加 `.adv-only`;各面板加「回到文件屬性」按鈕;`#gallery-toolbar` 加第二顆清除鈕;新增 `setUiMode()`、`clearAllSlotContent()`、`clearAllSources()`、resizer 拖曳、viewport 留白 pointerdown、`safeStorageGet/Set()`;`deleteSource()` 加 coalescing;keydown switch 加 `clearSelection` case;說明對話框補文字 | U-0~U-4 |
| `src/keymap.js` | `resolveShortcut()` 新增 `Escape → { type: 'clearSelection' }` | U-2 |
| `src/keymap.test.js` | 新增 Escape 的測試 | U-2 |
| `index.html` | `npm run build` 重新產生(**不手改**) | 收尾 |
| `docs/plan.md` | §18.3 快捷鍵表補 `Esc`;§18.1/§18.2 補「簡易/詳細模式」與可調寬面板 | 收尾 |
| `docs/change_log.md` | 完整條目(solo-large) | 收尾 |
| `docs/decision_log.md` | 新增 **D-021**,記錄 §7 的 5 個決策 | 收尾 |
| `docs/project_status.md` | 更新 TL;DR 與受影響章節 | 收尾 |

---

## 6. 執行順序與驗證

建議順序(每步都可獨立驗證,不必一次做完):

1. **U-0** 前置整理 → 開 dev server 確認版面沒壞。
2. **U-1** 介面模式 → 兩顆按鈕切換,確認工具列與 Properties Panel 同步增減。
3. **U-2** 取消選取 → 三條路徑各測一次。
4. **U-3** 一鍵清除 → 含 undo 只需按一次的驗證。
5. **U-4** 面板拖寬 → 含 `fit-page` 縮放是否跟著更新。
6. `npm test`(現有 543+ 筆,加上新的 keymap 測試)。
7. `npm run build` 重建 `index.html`,並**直接用 `file://` 開啟 index.html 實測**
   一輪 —— 這是使用者真正拿到的東西,dev server 測過不等於它沒問題。
8. 文件更新 + 提交。

**瀏覽器實測清單**(`node scripts/dev-server.mjs` → http://localhost:5173/app.html):

| # | 測項 | 期望 |
|---|---|---|
| 1 | 首次載入 | 直接是簡易模式,**不得**閃現完整工具列 |
| 2 | 切詳細 → 進「建立格位」→ 切簡易 | 自動回到選取模式,不卡住 |
| 3 | 重新整理 | 沿用上次選的模式(若決策 D-2 採「記住」) |
| 4 | 點格位 → 點紙張外灰色區 | 取消選取,屬性欄回到紙張/文件屬性 |
| 5 | 點格位 → 按 Esc | 同上 |
| 6 | 在屬性欄輸入框打字 → 直接點灰色區 | 取消選取且面板正確重建(不卡在舊內容) |
| 7 | 格位鋪滿整頁 → 用「← 回到文件屬性」 | 可回到文件屬性 |
| 8 | 放 3 個 PDF 進格位 → 清空格位內容 → Ctrl+Z | **一次**復原全部,來源清單仍在 |
| 9 | 清除全部來源 → 匯出 PDF | 不得出現 "unknown source"(D-015 迴歸) |
| 10 | 拖曳 resizer 到最寬 / 最窄 | 有上下限,畫布不被撐破、不出現水平捲軸 |
| 11 | 拖寬後看 fit-page 紙張 | 縮放跟著重算,紙張仍完整可見 |
| 12 | 雙擊 resizer | 回到 300px |
| 13 | 匯出 PDF / 列印 | 與改動前輸出一致(本次不碰幾何) |

---

## 7. 需使用者拍板的決策點

| # | 問題 | 建議 |
|---|---|---|
| **D-1** | 預設是簡易還是詳細? | **簡易**(使用者原話「大部分時候只是想快速處理」) |
| **D-2** | 要不要用 `localStorage` 記住介面模式與面板寬度? | **要**,但用 try/catch 包住。localStorage 是純本地的,不違反 §19.3 離線原則;但 `file://` 下部分瀏覽器設定會擋,失敗時必須安靜退回預設值而不是壞掉 |
| **D-3** | 「一鍵清除」要哪一種? | **兩顆都給**:「清空所有格位內容」(保留來源)與「清除全部來源」。使用者原話偏向前者,骨架做的是後者 |
| **D-4** | 清除要不要確認對話? | **要**(`window.confirm`)。雖然可以 undo,但這是「一鍵」動作,誤觸成本高 |
| **D-5** | 簡易模式的 Properties Panel 要不要保留「邊距 / 間距」6 個數字欄位? | **保留**。它們是列印排版最常調的參數,藏起來反而會逼使用者切詳細模式 |

其中 D-1/D-2/D-5 若使用者無特別意見,即依建議執行;D-3/D-4 建議明確確認一次。

---

## 8. 風險

| 風險 | 影響 | 緩解 |
|---|---|---|
| 簡易模式藏掉使用者其實會用的功能 | 中 | 切換按鈕永遠可見且在工具列最左;隱藏清單集中在 `.adv-only` 一處,調整成本極低 |
| `#canvas-viewport` 的 pointerdown 誤清選取(例如拖曳來源卡片經過時) | 低 | 只在 `pointerdown` 且 `!e.target.closest('#paper-host')` 時觸發;拖放來源走的是 HTML5 drag 事件,不是 pointerdown |
| 一鍵清除的 undo 沒收斂成一步 | 中 | 已列為 U-3 的明確驗收條件(測項 8) |
| 面板拖寬造成版面撐破 | 中 | U-0 的 `min-width: 0` + MIN/MAX 夾制(測項 10) |
| `localStorage` 在 `file://` 下丟例外 | 低 | `safeStorageGet/Set()` 一律 try/catch,失敗即退回預設 |
| `npm run build` 需要連網下載 esbuild | 低 | 既有限制(`scripts/build.mjs` 用 `npm exec --yes esbuild@0.25.9`),非本次引入 |
| 動到 `src/keymap.js` 影響既有快捷鍵 | 低 | 只新增一個分支,不改既有;`npm test` 覆蓋 |

---

## 9. 預估

| 工作包 | 預估 |
|---|---|
| U-0 前置整理 | 15 分鐘 |
| U-1 介面模式 | 45 分鐘(大半是 Properties Panel 樣板標記) |
| U-2 取消選取 | 30 分鐘(含 keymap 測試) |
| U-3 一鍵清除 | 40 分鐘 |
| U-4 面板拖寬 | 30 分鐘 |
| 瀏覽器實測 13 項 + `npm test` + build | 45 分鐘 |
| 文件(change_log / decision_log D-021 / plan §18 / project_status) | 30 分鐘 |
| **合計** | **約 4 小時** |
