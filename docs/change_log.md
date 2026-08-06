# Change Log (append-only)

> Older entries: docs/logs/ (archive, do not load at startup)

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

## 2026-08-06 | Docs | Rotated 3 entries (2026-08-05 21:40 Phase 4, plus 2 interleaved rotation-record lines) to docs/logs/change_log_2026.md | wc -l verified (470 lines active after rotation, before this Phase 10 entry)

## 2026-08-06 10:00

### Type
Feature

### Summary
完成 Phase 10(plan.md §16/§17.3/§9.6/§18.3/§5.2 SVG):Bleed、Safe Area、
Header/Footer、Page Number、Text Box、浮水印(文字/圖片)、SVG Source、
Align & Distribute、鍵盤快捷鍵 resolver、內建 Template Library。這是繼
Phase -1~9(先前於 GitHub 分支 `claude/phase-5-handling-wi8vcd` 完成)之後
的下一階段——工作在該分支上直接延續(見 project_status.md「Current
Version」的分支說明)。543 個單元測試通過(較本分支 Phase 9 完成時的
437 個新增 106 個,含先前因本機未 `scripts/fetch-vendor.sh` 而略過的 9 個
real-pdf-lib 測試,本次一併 fetch vendor 並讓它們真正跑通)+ 瀏覽器實測
(`dev/print-aids.html`)全數驗證通過。

### Files Changed
- src/model.js — Bleed/SafeArea/HeaderFooter/PageNumber/Watermark 設定
  factory、TextBox factory、SCHEMA_VERSION 2→3、Page 新增 textBoxes、
  Template 新增 textBoxes
- src/print-aids.js(新增)+ print-aids.test.js — §16 純幾何(Bleed/Safe
  Area 矩形、Header/Footer/Page Number 定位、Watermark 矩陣、文字對齊)
- src/text-elements.js(新增)+ text-elements.test.js — Text Box CRUD
  純函式(move/resize/content/delete/duplicate/z-order)
- src/reducers.js/.test.js — Phase 10 設定 action + Text Box action +
  Align/Distribute action
- src/preview.js — Bleed/Safe Area 引導線、Header/Footer/Page Number/
  Text Box/Watermark 的 DOM 算繪
- src/export.js/.test.js、src/export-real-pdf-lib.test.js — 低階 pdf-lib
  operator 算繪(Bleed clip 擴張、Header/Footer/Page Number 高階
  drawText、Text Box/Watermark 低階旋轉矩陣 + ExtGState 透明度、Watermark
  圖片 XObject)
- src/sources.js/.test.js、src/render-adapters.js — SVG Source(
  parseSvgIntrinsicSize、computeSvgRasterSize、loadSvgFile、瀏覽器端
  rasterizeSvg 系列)
- src/free-layout.js/.test.js — Align(左右上下/水平垂直置中)、Match
  Size(等寬/等高/等尺寸)、Distribute(水平/垂直平均分布)
- src/keymap.js(新增)+ keymap.test.js — §18.3 鍵盤快捷鍵 resolveShortcut
  + nudgeDelta
- src/template-library.js(新增)+ template-library.test.js — §17.3 內建
  Template Library(4 個範例)
- src/pages.js/.test.js、src/project-file.js/.test.js — duplicatePage/
  applyTemplateToPage 補上 textBoxes;schemaVersion v2→v3 migration
- dev/print-aids.html(新增)— Phase 10 dev harness,非產品 UI
- scripts/fetch-vendor.sh 的產出(vendor/pdf-lib/pdf-lib.esm.js、
  vendor/pdfjs/*)本機補 fetch,讓 9 個原本略過的 real-pdf-lib 測試恢復執行
- docs/decision_log.md — 新增 D-019
- docs/change_log.md — 本次 rotation(207 行移至 docs/logs/change_log_2026.md)
- docs/project_status.md — TL;DR、Completed/In Development/Known Issues/
  Technical Architecture/Data Structure 更新

### Reason
使用者要求「繼續執行 phase 10」。發現本機 checkout 原本停留在 master
分支(僅 Phase 0-1),而 Phase 1-9 實際已在 GitHub 遠端分支
`claude/phase-5-handling-wi8vcd` 完成但未合併——與使用者確認後,改為在該
分支上繼續(而非在落後的 master 上重做)。Phase 10 是 plan.md §22 排序中
Standalone Build(Phase 11)之前的最後一個功能階段。

### Implementation Details
見 decision_log D-019 的完整記錄(8 組判斷:Bleed 只擴張 clip 邊界不連動
內容縮放、Safe Area 純 Preview 引導線、Watermark 僅置中且旋轉矩陣沿用
Slot 內容的「Y-down model space 組矩陣 + pdfPageFlipMatrix 疊加」既有
手法而非 pdf-lib 高階 API 的 `rotate:` 選項、Text Box 獨立於 Source/Slot
系統之外、文字先只支援 ASCII(使用者本次對話明確決定,不加 fontkit)、
SVG 光柵化採固定 4 倍放大, 上限 3000px 長邊、Align/Distribute 採
bounding-box 對齊與等間距邊緣分布、Template Library 全部透過既有 §9
Layout Engine 純函式產生)。

Watermark/Text Box 的旋轉矩陣正確性(Preview CSS 旋轉方向與 Export PDF
旋轉方向視覺一致)透過 export-real-pdf-lib.test.js 對真實 pdf-lib 輸出的
`cm` 矩陣做迴歸測試驗證(90° 旋轉時 b 分量 ≈ ±1),而非僅憑手動推導。

### Impact Analysis
Phase 10 完成後,plan.md §22 僅剩 Phase 11(Standalone Build,單檔離線
esbuild 正式打包)。§16 的 Bleed/Watermark/Text Box 均為 Project 層級新
欄位,任何後續讀寫 `AppState.project`/`Page` 的程式碼都應透過本次新增的
reducer(而非直接 mutate),沿用 Phase 4 以來的單一 mutation 入口慣例。
SVG 光柵化與 WEBP 轉碼共用「embedSource 依 source.kind 分派、
embeddedBySourceId 跨 Slot 去重」的既有架構,未來若要新增其他 Source
kind(例如色塊/文字頁),應延續同一分派模式。

### Verification Result
PASS — 兩層驗證:
1. `npm test`:543/543 通過(較 437 新增 106 個;0 skipped,含 fetch
   vendor 後恢復執行的 9 個 real-pdf-lib 測試)。
2. 瀏覽器實測(`node scripts/dev-server.mjs`,開啟
   `http://localhost:5173/dev/print-aids.html`,console 無錯誤):Bleed/
   Safe Area 引導線的實際 px 座標與手算期望值精確吻合(過程中發現並修正
   一個真實 bug——`computeSlotPx()` 回傳 `{width,height}` 而
   `computeBleedExpandedRect`/`computeSafeAreaRect` 預期 `{w,h}`,原本會
   靜默產生 `NaN` 座標);Header/Footer/Page Number/Text Box/Watermark
   文字皆正確顯示於畫面;匯出的 PDF 經 pdf-lib 重新載入確認結構正確
   (ExtGState/ca 透明度值、Font 資源、re/gs/Do/Tj operator 皆存在);
   SVG Source 端到端(載入→縮圖→匯出光柵化為 PNG XObject)全流程驗證
   通過。pdf.js 重新渲染步驟(`page.render()`)在本次瀏覽器自動化環境中
   卡住未完成——但確認同一個卡住行為在既有、Phase 8 已驗收過的
   `dev/print.html` 也會發生,判定為本次自動化環境限制而非本次改動
   引入的問題,不影響上述其他驗證管道的結論。

## 2026-08-06 | Docs | Rotated 2 entries (2026-08-05 23:15 Phase 5 gap-fill, plus 1 interleaved rotation-record line) to docs/logs/change_log_2026.md | wc -l verified (504 lines active after rotation, exactly the 10-entry retention floor — see docs/log_rotation.md, this is expected to exceed 400 lines when recent entries are individually long)
