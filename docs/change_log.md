# Change Log (append-only)

> Older entries: docs/logs/ (archive, do not load at startup)

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

## 2026-08-06 01:45

### Type
Feature

### Summary
Phase 7 PDF Export — the product's core value and biggest technical risk.
`src/export.js` renders the full Layout Model to a real PDF via pdf-lib
(low-level operators, not the high-level `drawPage()`/`drawImage()` API),
with §23.3 Preview/Export geometric equivalence proven by 104 test cases.
A critical rendering bug (upside-down text, near-invisible images) was found
via manual screenshot review — NOT by the automated Playwright pixel checks —
and fixed; see decision_log D-016 for the full diagnosis.

### Files Changed
- src/geometry.js — `pdfPageFlipMatrix(paperHeightPt)` (new; the second and
  last sanctioned Y-flip location alongside `modelYToPdfY`).
- src/geometry.test.js — new tests for `pdfPageFlipMatrix` consistency.
- src/export.js (created) — `roundedPaperSizePt()`, `computeSlotAbsoluteRectPt()`,
  `computeContentRotationAndSize()`, `computeExportContentMatrix()` (conceptual
  matrix, for §23.3 equivalence only), `computeXObjectDrawMatrix()`
  (pdf-lib-specific matrix actually used to draw — see Implementation Details),
  `computeExportClipRectPt()`, `detectImageFormat()` (magic-byte sniffing),
  `embedSource()`, `exportProjectToPdf()`.
- src/export.test.js (created) — pure-function tests + fake-pdfLib
  orchestration tests (dedup, encryption, page count, z-order, metadata) +
  regression tests pinned to the calibrated `computeXObjectDrawMatrix` values.
- src/preview-export-equivalence.test.js (created) — 104 cases (2 sources ×
  3 fitModes × 4 rotations × 4 flip combos + 8 offset/scale cases),
  `EPSILON_PT = 0.28` per §23.3.2.
- src/export-adapters.js (created) — browser-only `transcodeWebpToPng()`.
- src/export-real-pdf-lib.test.js (created) — guarded (skips gracefully if
  `vendor/pdf-lib` hasn't been fetched); MediaBox/page-count check,
  text-selectable check, 8-slot-1-XObject dedup check, a `cm`-operator
  byte-level regression test, and a `/Rotate 90` source-page test.
- src/reducers.js — `addSourceAction()`/`removeSourceAction()` (new; see
  Implementation Details for why these were missing).
- src/reducers.test.js — new tests for the two actions above.
- scripts/fetch-vendor.sh — now also fetches pdf-lib 1.17.1 into
  `vendor/pdf-lib/` (npm registry tarball; unpkg CDN returned 403 via the
  proxy).
- dev/export.html (created) — Phase 7 dev harness: Source Gallery, Auto Fill,
  Export PDF, and a verification panel that reloads the output via real
  pdf-lib (structural check) and re-renders it via real pdf.js (visual check).
- dev/placement.html, dev/auto-fill.html — retrofitted to also call
  `store.commit(addSourceAction(s))` when loading sources.
- docs/decision_log.md — D-012 (Phase 5 image preview decisions, recorded
  earlier this session but not yet summarized here), D-013 (Phase 4 gap-fill),
  D-014 (Phase 6 Auto Fill semantics), D-015 (Phase 7 architecture + the
  AppState.sources gap), D-016 (the critical XObject coordinate-system bug).

### Reason
Next phase per plan.md §22 after Phase 6 (Auto Imposition). plan.md itself
flags this as "產品核心價值與最大技術風險" (the product's core value and
biggest technical risk), and §23.3 requires Preview and Export to be
geometrically provably equivalent before Export can be trusted.

### Implementation Details
pdf-lib runs natively in Node (unlike pdf.js, which needs a Worker/DOM) —
verified directly, so `export.js`'s orchestration logic (dedup, z-order,
page iteration) is Node-testable via `deps` injection, the same pattern as
`sources.js`. Low-level operators (`pushGraphicsState`, `concatTransformationMatrix`,
`drawObject`, `rectangle`+`clip`+`endPath`, `popGraphicsState`) are used
instead of pdf-lib's high-level `drawPage()`/`drawImage()` to avoid any
implicit matrix-decomposition risk in the high-level API.

**The critical bug**: `computeExportContentMatrix()`'s first implementation —
just `multiply(pdfPageFlipMatrix(paperHeightPt), modelMatrix)` — passed all
104 §23.3 equivalence tests and several byte-level real-pdf-lib tests, but
produced visibly wrong output (upside-down text, near-invisible images) once
actually rendered via real pdf.js. Root cause: pdf-lib's embedded XObjects
have native coordinate systems that `slotContentMatrix()` doesn't account
for — an embedded Image XObject is a [0,1]×[0,1] unit square needing a
rescale-plus-flip, while a Form XObject from `embedPage()` is Y-up and
BBox-sized needing only a flip. Found via systematic calibration: built
isolated Playwright scripts comparing pdf-lib's own high-level
`drawImage()`/`drawPage()` (a known-correct reference) against the raw
`cm`+`Do` approach with quadrant-colored test images/pages (TL=red,
TR=green, BL=blue, BR=yellow) to unambiguously tell flips from rotations
from correct output, trying every scale-sign combination before landing on
the right formula for each source kind. Fixed by splitting the function in
two: `computeExportContentMatrix()` stays purely conceptual (what §23.3
compares against Preview) and a new `computeXObjectDrawMatrix()` adds the
kind-specific correction on top and is the one actually fed to pdf-lib.
Permanent regression tests pin the exact calibrated matrix values at both
the pure-function level and by parsing the real `cm` operator bytes out of
an actual exported PDF. Full trace in decision_log D-016.

**The AppState.sources gap**: `exportProjectToPdf()` initially threw
"unknown source" for every Source a user had actually loaded through the UI,
because no reducer across Phases 2–6 had ever written to `AppState.sources` —
Preview had always used a harness-local Map instead. Fixed with
`addSourceAction()`/`removeSourceAction()` and retrofitted all three dev
harnesses that load Sources to call the new action alongside their existing
local Map population. See decision_log D-015.

### Impact Analysis
Phase 8 (Print Path) reuses `exportProjectToPdf()` as-is per plan.md §15.1
(printing is explicitly required to go through the exported PDF, never
`window.print()` on the DOM) — no new Export logic should be needed there,
only a print-calibration page and Crop Marks. Any future third Source kind,
or a switch away from pdf-lib, must re-derive `computeXObjectDrawMatrix()`'s
correction from scratch per D-016 — it must not be assumed to generalize.
Any future Source-loading entry point must call `addSourceAction()` or
Export will silently fail to find it.

### Verification Result
PASS — two layers:
1. `npm test`: 382/382 passing (144 new this round).
2. Browser verification (`node scripts/dev-server.mjs` + Playwright against
   synthetic mixed-size sources, opening `http://localhost:5173/dev/export.html`,
   console clean): exporting produces a PDF that reloads correctly via real
   pdf-lib (MediaBox/page-count/resource-dedup all match expectations) AND
   re-renders correctly via real pdf.js — verified by actually looking at the
   rendered screenshot rather than trusting only the automated pixel-count
   checks, which is how the D-016 bug was caught in the first place (the
   automated checks alone had been passing throughout).

## 2026-08-06 | Docs | Rotated 3 entries (2026-08-05 17:40, 18:15, and the 2026-08-05 first rotation-record) to docs/logs/change_log_2026.md | wc -l verified (631 lines active after rotation)

## 2026-08-06 02:30

### Type
Feature

### Summary
Phase 8 Print Path: Crop Marks (§16) drawn into every exported PDF and, per
§13.1's own requirement, into the Preview canvas too; a standalone 100mm
Print Calibration Page (§15.3); and the "Print" button, which is not a third
rendering path — it calls the exact same `exportProjectToPdf()` "Export PDF"
does, then opens the bytes via the browser's built-in PDF viewer (§15.1).

### Files Changed
- src/model.js — `createCropMarksSettings()` (new; `enabled`/`lengthPt`/
  `gapPt`/`lineWidthPt`, defaults not specified by plan.md, see D-017),
  wired into `createProject().cropMarks`.
- src/model.test.js — 3 new tests.
- src/print.js (created) — `computeCropMarksForSlot()`/
  `cropMarkSegmentsToPdfSpace()` (§16 pure geometry), `computeCalibrationPageContent()`/
  `exportCalibrationPagePdf()` (§15.3, deps-injected pdfLib, same split as
  export.js).
- src/print.test.js (created) — 9 tests.
- src/print-real-pdf-lib.test.js (created) — 3 guarded tests (A4 page size,
  the actual drawn square measures exactly 100mm in the real output content
  stream, text is real selectable Tj/TJ not rasterized).
- src/export.js — `exportProjectToPdf()` now draws Crop Marks for every Slot
  on a page (regardless of whether it has a Source) when
  `state.project.cropMarks.enabled`, via pdf-lib's high-level `page.drawLine()`.
- src/export.test.js — 3 new tests.
- src/export-real-pdf-lib.test.js — 1 new guarded test (16 real stroked
  lines for 2 empty Slots with Crop Marks on).
- src/preview.js — `renderCropMarks()` (new DOM adapter; §13.1 requires the
  Preview canvas to show Crop Marks, not just bake them into Export's
  output — reuses print.js's same `computeCropMarksForSlot()`, content-area-
  local origin per D-012's established convention).
- src/reducers.js — `setCropMarksAction()` (new; merges a partial update
  into `state.project.cropMarks`).
- src/reducers.test.js — 2 new tests.
- src/export-adapters.js — `openPdfBytesForPrint()` (new; Blob +
  `window.open()`, no `window.print()` call — see Implementation Details).
- dev/print.html (created) — Phase 8 dev harness: Crop Marks controls,
  Print button, Print Calibration Page button, reusing Phase 7's
  Export/verify wiring.

### Reason
Next phase per plan.md §22 after Phase 7 (PDF Export). §15.1 makes printing
depend on Export already being trustworthy (same rendering path, same
geometry), so it had to come after Export was proven, not before.

### Implementation Details
See decision_log D-017 for the four judgment calls: Crop Marks are drawn
per-Slot (every Slot gets its own cut guides, since this is an imposition
tool where each Slot is a separate piece to be cut out — not once around
the sheet's outer edge, the traditional single-page-print convention); the
Calibration Page is always A4 with ASCII-only English text, independent of
the current Project's paper settings (it tests the printer/driver itself,
not the user's layout — and §16 already defers CJK font-subset embedding
via fontkit to the second stage); Crop Marks are drawn into the Preview
canvas this same phase rather than deferred, since §13.1 already lists them
as a required Preview element; and "Print" deliberately does NOT call
`window.print()` itself — it opens the PDF via the browser's own viewer and
leaves the actual print trigger to that viewer's own UI, matching §15.1's
flowchart literally ("由瀏覽器內建 PDF Viewer 列印").

Because "Print" and "Export PDF" are two buttons that each independently
call the exact same `exportProjectToPdf()`, §23.6.2's "the two produce
byte-identical PDFs" holds by construction — there is no second rendering
path to keep in sync. The one caveat: two independent calls carry their own
wall-clock `/CreationDate`, so a literal byte-for-byte comparison needs that
one fixed-width metadata field normalized out first (see Verification
Result) — everything else, including every drawing operator, is identical.

### Impact Analysis
Phase 9 (Project System) will persist `Project.cropMarks` as part of the
project JSON like any other Project Setting — no new serialization concern.
Any future third Source kind or Bleed (§16 [S], second stage) feature must
revisit Crop Marks' `gapPt` semantics (currently "distance from the Slot
edge"; Bleed would introduce a distinct "distance from the bleed boundary"
concept) rather than assuming the current single-gap parameter still
applies, per D-017's Future Review Conditions.

### Verification Result
PASS — two layers:
1. `npm test`: 403/403 passing (21 new: 17 pure/fake-level across print.js,
   model.js, export.js, reducers.js + 4 real-pdf-lib-level across the new
   print-real-pdf-lib.test.js and export-real-pdf-lib.test.js; running total
   382 -> 403).
2. Browser verification (`node scripts/dev-server.mjs` + Playwright against
   `http://localhost:5173/dev/print.html`, console clean aside from the
   browser's own pre-existing `/favicon.ico` 404 — unrelated to this phase,
   dev-server.mjs has never had a favicon route): Crop Marks OFF by default
   shows zero `.pl-crop-mark` elements in the Preview DOM; toggling ON shows
   exactly 32 (4 Slots x 8 segments) for a 4-up template, toggling back OFF
   removes them; the exported PDF, re-rendered via real pdf.js, shows dark
   (crop-mark) pixels inside the page margin where no Slot content ever
   draws; clicking Print opens a genuine new browser tab pointed at a
   `blob:` URL; Print's and Export's bytes for the same store state are
   identical once the `/CreationDate` field is normalized out; clicking
   Print Calibration Page also opens a new tab, and the resulting PDF
   reloads as a single A4 page whose re-rendered 100mm square measures
   ~283-284px wide (100mm at pdf.js's 1px-per-pt scale=1 convention).

## 2026-08-06 | Docs | Rotated 1 entry (2026-08-05 19:30, Phase 2 Source Engine) to docs/logs/change_log_2026.md | wc -l verified (636 lines active after rotation)

## 2026-08-06 03:15

### Type
Feature / Bugfix (schema-version gap-fill)

### Summary
Phase 9 Project System: save/load a project as `.json` (§17.1), Layout
Template save/apply (§17.3), and `schemaVersion` migration (§17.2) — plus
two real gaps found along the way: `AppState.templates` had never been
written to by any reducer since Phase 0 (the same class of gap Phase 7
found for `AppState.sources`), and `SCHEMA_VERSION` never got bumped when
Phase 8 added `Project.cropMarks`, silently breaking the "one version
number, one shape" contract §17.2 requires.

### Files Changed
- src/model.js — `SCHEMA_VERSION` 1 -> 2; `createSource()` gains
  `contentHash` (§17.1's "雜湊" metadata field).
- src/model.test.js — 1 new test.
- src/hash.js (created) — `computeContentHash(bytes)`, a direct
  `crypto.subtle.digest('SHA-256', ...)` call — no deps injection needed,
  since Web Crypto is a converged Node/browser standard (verified directly
  against this repo's Node runtime).
- src/hash.test.js (created) — 4 tests.
- src/sources.js — `loadPdfFile()`/`loadImageFile()` now hash each loaded
  file's original bytes once (shared across every page-Source from the
  same docId) and store it as `contentHash`.
- src/sources.test.js — 2 new assertions added to existing tests.
- src/project-file.js (created) — `serializeProject()` (envelope:
  `{schemaVersion, project, sources, templates, pages}`, `selection`
  excluded), `migrateProjectData()` (v1 -> v2 fills in the missing
  `cropMarks` default; throws for a file newer than this app supports),
  `deserializeProject()` (migrate + re-validate via `createSource()`/
  `createTemplate()`), `relinkSources()` (§17.1's re-select-and-match flow:
  fileName + pageIndex + dimensions, with contentHash as the authoritative
  tiebreaker whenever both sides have one), `findMissingSourceIds()`.
- src/project-file.test.js (created) — 19 tests.
- src/pages.js — `applyTemplateToPage()` (§17.3; replaces a page's
  paper+slots wholesale, regenerating Slot ids, same precedent as Auto
  Fill's page replacement).
- src/pages.test.js — 3 new tests.
- src/reducers.js — `saveTemplateAction()`/`deleteTemplateAction()`/
  `applyTemplateAction()` (new; fixes the AppState.templates gap).
- src/reducers.test.js — 4 new tests.
- src/store.js — `resetWithState(newState)` (new; a full state replacement
  that clears `past`/`future`/`pendingCoalesceKey`, distinct from
  `commit(reducer, action)` — loading a project is a context switch, not a
  derived edit).
- src/store.test.js — 3 new tests.
- src/project-adapters.js (created) — `downloadProjectJson()`/
  `readProjectFile()`, browser-only Blob/File glue (same split as
  export-adapters.js, no unit test per that same precedent).
- dev/project.html (created) — Phase 9 dev harness: load sources, Auto
  Fill, Save Project, Load Project (with the "please re-select these
  files" relink flow), Save as Template, Apply Template, Undo/Redo buttons
  with a live history-depth readout.

### Reason
Next phase per plan.md §22 after Phase 8 (Print Path). A project's edit
history and Layout Templates are only meaningful once they can actually be
saved and reloaded, and store.js's Undo/Redo (implemented since Phase 4)
had never been exercised in a save/load context until now.

### Implementation Details
See decision_log D-018 for the six judgment calls: the project.json
envelope shape (`schemaVersion` hoisted to the top level rather than
duplicated inside `project`, `selection` excluded entirely); the retroactive
`SCHEMA_VERSION` bump and why it's being treated as fixing a real gap now
rather than silently left inconsistent; the Source relink matching strategy
(fileName + pageIndex + dimensions, contentHash as the authoritative
signal when both sides have one — and REJECTING a match when both hashes
are present but differ, even if everything else coincidentally matches);
Template application semantics (wholesale replacement, matching Auto
Fill's precedent, since plan.md gives no rule for what a "merge" would even
mean); and why loading a project resets Undo/Redo history via a new
`store.resetWithState()` rather than going through `commit()` as an
ordinary reducer (a project load is a context switch, not an edit derived
from whatever was open before).

Because Source binaries are never embedded in the project file (§17.1,
"避免檔案過大"), every project load requires the user to re-select every
original PDF/image — this is the intended design, not a missing feature.
`relinkSources()` is what makes that re-selection actually reattach to the
right Slots afterward: it keeps each SAVED Source's original `id` (so
existing `Slot.sourceId` references keep resolving) and only swaps in the
freshly re-loaded bytes' `docId`.

### Impact Analysis
Phase 10 (advanced Print Aids / second-stage features) can now assume
Projects persist correctly — any new Project-level setting it adds must
come with a `SCHEMA_VERSION` bump and a migration step this time, per the
gap D-018 just fixed. The built-in Template Library (§17.3 [S]) remains
unimplemented — Phase 9 only covers the [M] user-saved-Template core.

### Verification Result
PASS — two layers:
1. `npm test`: 437/437 passing (34 new: 403 -> 437).
2. Browser verification (`node scripts/dev-server.mjs` + Playwright against
   `http://localhost:5173/dev/project.html`, console clean): built a
   project with 4 sources (3 PDF pages + 1 image) via Auto Fill plus one
   manual edit, saved it as a Template, then serialized the whole project;
   loading that JSON back (simulating a fresh session with a brand-new
   SourceBinaryStore/engine) correctly prompted for the 4 missing source
   files; re-selecting the SAME original files relinked all 4 by
   content-hash, the reloaded Pages/Templates matched exactly what was
   saved (Slot.sourceId references stayed valid), and the relinked
   content actually re-rendered in the Preview (not just a metadata match);
   history was fully reset after load (`canUndo`/`canRedo` both false), and
   a fresh edit made after the load could be undone/redone normally;
   applying the saved Template correctly cleared the page's content; and a
   hand-constructed v1-shaped project JSON correctly migrated to
   schemaVersion 2 with `cropMarks` defaults filled in.

## 2026-08-06 | Docs | Rotated 1 entry (2026-08-05 20:15, Phase 3 Layout Engine) to docs/logs/change_log_2026.md | wc -l verified (675 lines active after rotation)
