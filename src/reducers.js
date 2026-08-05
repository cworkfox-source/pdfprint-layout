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

function updatePageSlots(state, pageId, updateFn) {
  const pageIndex = state.pages.findIndex((p) => p.id === pageId);
  if (pageIndex === -1) throw new Error(`No page with id ${pageId}`);
  const pages = state.pages.slice();
  pages[pageIndex] = { ...pages[pageIndex], slots: updateFn(pages[pageIndex].slots) };
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

// §7.3 — selection never enters History; callers MUST pass
// `{ historyEntry: false }` to store.commit() alongside this action.
export function setSelectionAction(selection) {
  return (state) => ({ ...state, selection });
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
