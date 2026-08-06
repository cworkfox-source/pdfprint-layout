// AppState-level action creators (docs/plan.md §7.1 single mutation entry
// point) for Phase 4's Free Layout Designer. Each function returns a
// `(state) => newState` reducer — the exact shape store.js's `commit()`
// expects (same convention store.test.js's own `setCount`/`increment`
// helpers use) — that targets ONE page's `slots` array via the pure
// free-layout.js primitives. This is the first place those primitives are
// actually wired to the store; free-layout.js itself never imports
// store.js, so it stays independently testable.
//
// Coalescing/historyEntry choices are the CALLER's responsibility (passed
// as store.commit()'s 3rd argument), not baked in here — e.g. a drag
// handler commits every pointermove with the same `coalesceKey` so §7.2
// collapses the whole gesture into one undo step; a Delete keypress
// commits once with the default (a real, uncoalesced history entry).

import {
  moveSlots,
  setSlotRect,
  deleteSlots,
  duplicateSlots,
  splitSlotHorizontal,
  splitSlotVertical,
  mergeSlots,
  setSlotLocked,
  bringSlotForward,
  sendSlotBackward,
  bringSlotToFront,
  sendSlotToBack,
  alignSlotsLeft,
  alignSlotsRight,
  alignSlotsTop,
  alignSlotsBottom,
  alignSlotsCenterHorizontal,
  alignSlotsCenterVertical,
  matchSlotsWidth,
  matchSlotsHeight,
  matchSlotsSize,
  distributeSlotsHorizontal,
  distributeSlotsVertical,
} from './free-layout.js';
import {
  setSlotSource,
  setSlotFitMode,
  setSlotScale,
  setSlotRotation,
  rotateSlotContent,
  setSlotOffset,
  setSlotFlip,
  clearSlotContent,
} from './slot-content.js';
import { applyFillRule, generateAutoFillPageObjects } from './auto-fill.js';
import { addPage, deletePage, duplicatePage, movePage, applyTemplateToPage } from './pages.js';
import {
  addTextBox,
  moveTextBoxes,
  setTextBoxRect,
  setTextBoxContent,
  deleteTextBoxes,
  duplicateTextBoxes,
  bringTextBoxForward,
  sendTextBoxBackward,
  bringTextBoxToFront,
  sendTextBoxToBack,
} from './text-elements.js';

function updatePageSlots(state, pageId, updateFn) {
  const pageIndex = state.pages.findIndex((p) => p.id === pageId);
  if (pageIndex === -1) throw new Error(`No page with id ${pageId}`);
  const pages = state.pages.slice();
  pages[pageIndex] = { ...pages[pageIndex], slots: updateFn(pages[pageIndex].slots) };
  return { ...state, pages };
}

// Phase 10 sibling of updatePageSlots() above, targeting one page's
// `textBoxes` array instead — same "find page, replace one field" shape.
function updatePageTextBoxes(state, pageId, updateFn) {
  const pageIndex = state.pages.findIndex((p) => p.id === pageId);
  if (pageIndex === -1) throw new Error(`No page with id ${pageId}`);
  const pages = state.pages.slice();
  pages[pageIndex] = { ...pages[pageIndex], textBoxes: updateFn(pages[pageIndex].textBoxes) };
  return { ...state, pages };
}

// §9.3/§9.4 — replaces a page's whole slot list, e.g. applying a Phase 3
// preset/custom grid, or committing a freshly drag-created Slot (§9.4).
export function setPageSlotsAction(pageId, slots) {
  return (state) => updatePageSlots(state, pageId, () => slots);
}

export function moveSlotsAction(pageId, slotIds, dx, dy) {
  return (state) => updatePageSlots(state, pageId, (slots) => moveSlots(slots, slotIds, dx, dy));
}

export function resizeSlotAction(pageId, slotId, rect) {
  return (state) => updatePageSlots(state, pageId, (slots) => setSlotRect(slots, slotId, rect));
}

export function deleteSlotsAction(pageId, slotIds) {
  return (state) => updatePageSlots(state, pageId, (slots) => deleteSlots(slots, slotIds));
}

export function duplicateSlotsAction(pageId, slotIds, offsetOpts) {
  return (state) => updatePageSlots(state, pageId, (slots) => duplicateSlots(slots, slotIds, offsetOpts));
}

export function splitSlotHorizontalAction(pageId, slotId, ratio) {
  return (state) => updatePageSlots(state, pageId, (slots) => splitSlotHorizontal(slots, slotId, ratio));
}

export function splitSlotVerticalAction(pageId, slotId, ratio) {
  return (state) => updatePageSlots(state, pageId, (slots) => splitSlotVertical(slots, slotId, ratio));
}

export function mergeSlotsAction(pageId, slotIds) {
  return (state) => updatePageSlots(state, pageId, (slots) => mergeSlots(slots, slotIds));
}

// §10.3 — lock/unlock toggle (gap found during a Phase 5 completeness audit;
// see decision_log D-013 — the flag existed and was enforced since Phase 4,
// but nothing could actually set it until now).
export function setSlotLockedAction(pageId, slotId, locked) {
  return (state) => updatePageSlots(state, pageId, (slots) => setSlotLocked(slots, slotId, locked));
}

// §6.5 — Z-order (same gap/D-013: Preview/Export already share sortByZOrder()
// since Phase 0, but there was no way to actually change a Slot's z).
export function bringSlotForwardAction(pageId, slotId) {
  return (state) => updatePageSlots(state, pageId, (slots) => bringSlotForward(slots, slotId));
}

export function sendSlotBackwardAction(pageId, slotId) {
  return (state) => updatePageSlots(state, pageId, (slots) => sendSlotBackward(slots, slotId));
}

export function bringSlotToFrontAction(pageId, slotId) {
  return (state) => updatePageSlots(state, pageId, (slots) => bringSlotToFront(slots, slotId));
}

export function sendSlotToBackAction(pageId, slotId) {
  return (state) => updatePageSlots(state, pageId, (slots) => sendSlotToBack(slots, slotId));
}

// §7.3 — selection never enters History; callers MUST pass
// `{ historyEntry: false }` to store.commit() alongside this action.
export function setSelectionAction(selection) {
  return (state) => ({ ...state, selection });
}

// --- Align & Distribute (§9.6, Phase 10) ------------------------------------

export function alignSlotsLeftAction(pageId, slotIds) {
  return (state) => updatePageSlots(state, pageId, (slots) => alignSlotsLeft(slots, slotIds));
}
export function alignSlotsRightAction(pageId, slotIds) {
  return (state) => updatePageSlots(state, pageId, (slots) => alignSlotsRight(slots, slotIds));
}
export function alignSlotsTopAction(pageId, slotIds) {
  return (state) => updatePageSlots(state, pageId, (slots) => alignSlotsTop(slots, slotIds));
}
export function alignSlotsBottomAction(pageId, slotIds) {
  return (state) => updatePageSlots(state, pageId, (slots) => alignSlotsBottom(slots, slotIds));
}
export function alignSlotsCenterHorizontalAction(pageId, slotIds) {
  return (state) => updatePageSlots(state, pageId, (slots) => alignSlotsCenterHorizontal(slots, slotIds));
}
export function alignSlotsCenterVerticalAction(pageId, slotIds) {
  return (state) => updatePageSlots(state, pageId, (slots) => alignSlotsCenterVertical(slots, slotIds));
}
export function matchSlotsWidthAction(pageId, slotIds) {
  return (state) => updatePageSlots(state, pageId, (slots) => matchSlotsWidth(slots, slotIds));
}
export function matchSlotsHeightAction(pageId, slotIds) {
  return (state) => updatePageSlots(state, pageId, (slots) => matchSlotsHeight(slots, slotIds));
}
export function matchSlotsSizeAction(pageId, slotIds) {
  return (state) => updatePageSlots(state, pageId, (slots) => matchSlotsSize(slots, slotIds));
}
export function distributeSlotsHorizontalAction(pageId, slotIds) {
  return (state) => updatePageSlots(state, pageId, (slots) => distributeSlotsHorizontal(slots, slotIds));
}
export function distributeSlotsVerticalAction(pageId, slotIds) {
  return (state) => updatePageSlots(state, pageId, (slots) => distributeSlotsVertical(slots, slotIds));
}

// --- Source Placement (§10.1/§10.2, Phase 5) -----------------------------
// Same wiring pattern as the Free Layout actions above: each creator targets
// one page's `slots` array via a slot-content.js pure primitive. Coalescing
// is again the caller's job — e.g. an Offset X/Y slider drag should pass a
// `coalesceKey` the same way a Free Layout drag does (§7.2).

export function setSlotSourceAction(pageId, slotId, sourceId) {
  return (state) => updatePageSlots(state, pageId, (slots) => setSlotSource(slots, slotId, sourceId));
}

export function setSlotFitModeAction(pageId, slotId, fitMode) {
  return (state) => updatePageSlots(state, pageId, (slots) => setSlotFitMode(slots, slotId, fitMode));
}

export function setSlotScaleAction(pageId, slotId, scale) {
  return (state) => updatePageSlots(state, pageId, (slots) => setSlotScale(slots, slotId, scale));
}

export function setSlotRotationAction(pageId, slotId, rotation) {
  return (state) => updatePageSlots(state, pageId, (slots) => setSlotRotation(slots, slotId, rotation));
}

export function rotateSlotContentAction(pageId, slotId, deltaDeg) {
  return (state) => updatePageSlots(state, pageId, (slots) => rotateSlotContent(slots, slotId, deltaDeg));
}

export function setSlotOffsetAction(pageId, slotId, offsetX, offsetY) {
  return (state) => updatePageSlots(state, pageId, (slots) => setSlotOffset(slots, slotId, offsetX, offsetY));
}

export function setSlotFlipAction(pageId, slotId, flipX, flipY) {
  return (state) => updatePageSlots(state, pageId, (slots) => setSlotFlip(slots, slotId, flipX, flipY));
}

export function clearSlotContentAction(pageId, slotId) {
  return (state) => updatePageSlots(state, pageId, (slots) => clearSlotContent(slots, slotId));
}

// --- Auto Imposition (§11, Phase 6) ---------------------------------------
// Auto Fill replaces one "template" page (its Slot layout, NOT its current
// content) with as many generated pages as needed to place every id in
// `sourceIds` (already run through applyFillRule's order/filter/repeat) —
// this is a different shape than updatePageSlots() above since it can grow
// or shrink the number of PAGES, not just one page's slots.
export function autoFillAction(templatePageId, sourceIds, fillOptions) {
  return (state) => {
    const pageIndex = state.pages.findIndex((p) => p.id === templatePageId);
    if (pageIndex === -1) throw new Error(`No page with id ${templatePageId}`);
    const templatePage = state.pages[pageIndex];
    const expandedIds = applyFillRule(sourceIds, fillOptions);
    const generatedPages = generateAutoFillPageObjects(templatePage.paper, templatePage.slots, expandedIds);

    const pages = [...state.pages];
    pages.splice(pageIndex, 1, ...generatedPages);
    return { ...state, pages };
  };
}

// --- Output Pages management (§11.3, Phase 6) -----------------------------

export function addPageAction(newPage, index) {
  return (state) => ({ ...state, pages: addPage(state.pages, newPage, index) });
}

export function deletePageAction(pageId) {
  return (state) => ({ ...state, pages: deletePage(state.pages, pageId) });
}

export function duplicatePageAction(pageId) {
  return (state) => ({ ...state, pages: duplicatePage(state.pages, pageId) });
}

export function movePageAction(pageId, toIndex) {
  return (state) => ({ ...state, pages: movePage(state.pages, pageId, toIndex) });
}

// --- Sources (§5.1/§5.2) ---------------------------------------------------
// A gap found while implementing Phase 7 Export: every dev harness through
// Phase 6 kept its OWN local Map of loaded Source objects for Preview
// lookups (keyed by sourceId, resolved client-side) and never actually
// wrote them into `AppState.sources` — Preview never needed to, since it
// always had that local Map handy. Export (`export.js`'s
// exportProjectToPdf()) is the first consumer that reads Source objects
// straight off AppState itself (as the single source of truth §5.1
// describes), which is what surfaced this as a real, previously-invisible
// gap rather than a Phase 7-specific need. Phase 9 (Project Save/Load) will
// need this same array populated to serialize a project at all.
export function addSourceAction(source) {
  return (state) => ({ ...state, sources: [...state.sources, source] });
}

export function removeSourceAction(sourceId) {
  return (state) => ({ ...state, sources: state.sources.filter((s) => s.id !== sourceId) });
}

// --- Project settings (§5.1/§8, Phase 12 12c) -------------------------------
// §8 Paper — merges a partial update into state.project.paper, same
// merge-a-partial-update convention as setCropMarksAction below (that
// function's own comment already anticipated this: "mirroring how the
// paper-settings UI would merge a single changed field"). A Page whose own
// `paper` is non-null (rather than inheriting Project.paper, see
// model.js's createPage()) is untouched by this action — Phase 12's
// Properties Panel only edits the Project-level default; per-Page paper
// overrides have no UI yet and are out of this reducer's scope.
export function setPaperAction(overrides) {
  return (state) => ({ ...state, project: { ...state.project, paper: { ...state.project.paper, ...overrides } } });
}

export function setProjectNameAction(name) {
  return (state) => ({ ...state, project: { ...state.project, name } });
}

// §16 Crop Marks (Phase 8) — merges a partial update into
// state.project.cropMarks, mirroring how the paper-settings UI would merge
// a single changed field rather than requiring the whole settings object.
export function setCropMarksAction(overrides) {
  return (state) => ({
    ...state,
    project: { ...state.project, cropMarks: { ...state.project.cropMarks, ...overrides } },
  });
}

// §17.3 Layout Template management (Phase 9) — no reducer had ever written
// to AppState.templates since Phase 0 (createAppState() defaults it to
// `[]` and nothing ever appended); the exact same class of gap Phase 7
// found for AppState.sources. See decision_log D-018.
export function saveTemplateAction(template) {
  return (state) => ({ ...state, templates: [...state.templates, template] });
}

export function deleteTemplateAction(templateId) {
  return (state) => ({ ...state, templates: state.templates.filter((t) => t.id !== templateId) });
}

export function applyTemplateAction(pageId, template) {
  return (state) => {
    const pageIndex = state.pages.findIndex((p) => p.id === pageId);
    if (pageIndex === -1) throw new Error(`No page with id ${pageId}`);
    const pages = state.pages.slice();
    pages[pageIndex] = applyTemplateToPage(pages[pageIndex], template);
    return { ...state, pages };
  };
}

// --- Print Aids (§16, Phase 10) ---------------------------------------------
// Same project-level merge convention as setCropMarksAction above.

export function setBleedAction(overrides) {
  return (state) => ({ ...state, project: { ...state.project, bleed: { ...state.project.bleed, ...overrides } } });
}

export function setSafeAreaAction(overrides) {
  return (state) => ({ ...state, project: { ...state.project, safeArea: { ...state.project.safeArea, ...overrides } } });
}

// header/footer are nested one level deeper — merging `overrides.header`/
// `overrides.footer` (if present) into the existing sub-object, same as
// createHeaderFooterSettings()'s own merge shape, rather than requiring the
// whole header or footer object on every call.
export function setHeaderFooterAction(overrides) {
  return (state) => ({
    ...state,
    project: {
      ...state.project,
      headerFooter: {
        ...state.project.headerFooter,
        ...overrides,
        header: { ...state.project.headerFooter.header, ...overrides.header },
        footer: { ...state.project.headerFooter.footer, ...overrides.footer },
      },
    },
  });
}

export function setPageNumberAction(overrides) {
  return (state) => ({ ...state, project: { ...state.project, pageNumber: { ...state.project.pageNumber, ...overrides } } });
}

export function setWatermarkAction(overrides) {
  return (state) => ({ ...state, project: { ...state.project, watermark: { ...state.project.watermark, ...overrides } } });
}

// --- Text Boxes (§16, Phase 10) ---------------------------------------------
// Same wiring pattern as the Free Layout Slot actions above: each creator
// targets one page's `textBoxes` array via a text-elements.js primitive.

export function addTextBoxAction(pageId, newBox) {
  return (state) => updatePageTextBoxes(state, pageId, (boxes) => addTextBox(boxes, newBox));
}

export function moveTextBoxesAction(pageId, boxIds, dx, dy) {
  return (state) => updatePageTextBoxes(state, pageId, (boxes) => moveTextBoxes(boxes, boxIds, dx, dy));
}

export function resizeTextBoxAction(pageId, boxId, rect) {
  return (state) => updatePageTextBoxes(state, pageId, (boxes) => setTextBoxRect(boxes, boxId, rect));
}

export function setTextBoxContentAction(pageId, boxId, overrides) {
  return (state) => updatePageTextBoxes(state, pageId, (boxes) => setTextBoxContent(boxes, boxId, overrides));
}

export function deleteTextBoxesAction(pageId, boxIds) {
  return (state) => updatePageTextBoxes(state, pageId, (boxes) => deleteTextBoxes(boxes, boxIds));
}

export function duplicateTextBoxesAction(pageId, boxIds, offsetOpts) {
  return (state) => updatePageTextBoxes(state, pageId, (boxes) => duplicateTextBoxes(boxes, boxIds, offsetOpts));
}

export function bringTextBoxForwardAction(pageId, boxId) {
  return (state) => updatePageTextBoxes(state, pageId, (boxes) => bringTextBoxForward(boxes, boxId));
}

export function sendTextBoxBackwardAction(pageId, boxId) {
  return (state) => updatePageTextBoxes(state, pageId, (boxes) => sendTextBoxBackward(boxes, boxId));
}

export function bringTextBoxToFrontAction(pageId, boxId) {
  return (state) => updatePageTextBoxes(state, pageId, (boxes) => bringTextBoxToFront(boxes, boxId));
}

export function sendTextBoxToBackAction(pageId, boxId) {
  return (state) => updatePageTextBoxes(state, pageId, (boxes) => sendTextBoxToBack(boxes, boxId));
}
