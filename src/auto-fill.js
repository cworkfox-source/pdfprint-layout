// Auto Imposition (docs/plan.md §11, Phase 6). Pure functions only — no DOM,
// no store.js — mirroring free-layout.js/slot-content.js's split: the
// reducers.js layer wires these to AppState.pages.
//
// §11.2 fill-rule reading: plan.md lists "順序填入、逆序填入、僅奇數頁、
// 僅偶數頁、每頁重複、每張重複 N 次" as if they were six independent modes,
// but "每頁重複" (repeat each page) and "每張重複 N 次" (repeat each sheet N
// times) read as the SAME feature described twice — the §11.2 worked
// example ("一張圖片 → 重複 8 次 → 填滿 A4") only ever shows one source
// repeated a fixed count, never a separate un-numbered "repeat" mode. This
// module treats order/filter/repeat as three ORTHOGONAL knobs rather than
// six mutually exclusive named modes — see decision_log for the reasoning.

import { createSlot, createPage } from './model.js';

export const FILL_ORDERS = Object.freeze(['sequential', 'reverse']);
export const FILL_FILTERS = Object.freeze(['all', 'odd', 'even']);

// §11.2 — reorders/filters/repeats a list of Source ids into the exact
// sequence Auto Fill will drop into Slots, one entry per Slot. `filter` is
// applied to the 1-based POSITION in the (possibly already reversed) list —
// not the Source's own PDF pageIndex — since the list being auto-filled may
// mix pages from multiple files or plain images with no pageIndex at all.
export function applyFillRule(sourceIds, { order = 'sequential', filter = 'all', repeatCount = 1 } = {}) {
  if (!FILL_ORDERS.includes(order)) {
    throw new Error(`applyFillRule: unknown order "${order}" (expected one of ${FILL_ORDERS.join(', ')})`);
  }
  if (!FILL_FILTERS.includes(filter)) {
    throw new Error(`applyFillRule: unknown filter "${filter}" (expected one of ${FILL_FILTERS.join(', ')})`);
  }
  if (!Number.isInteger(repeatCount) || repeatCount < 1) {
    throw new Error(`applyFillRule: repeatCount must be a positive integer, got ${repeatCount}`);
  }

  let ids = order === 'reverse' ? [...sourceIds].reverse() : [...sourceIds];

  if (filter === 'odd') ids = ids.filter((_, i) => i % 2 === 0); // 1-based odd positions
  else if (filter === 'even') ids = ids.filter((_, i) => i % 2 === 1);

  if (repeatCount > 1) {
    ids = ids.flatMap((id) => Array(repeatCount).fill(id));
  }

  return ids;
}

// §11.1/§11.3 — spreads `sourceIds` (already run through applyFillRule)
// across as many copies of `templateSlots`' layout as needed, one array of
// fresh Slot objects per generated Output Page. Every Slot in the layout
// keeps the template's geometry/fit/transform (x/y/w/h/fitMode/scale/
// rotation/offset/flip/z) — only `id` (fresh per page) and `sourceId`
// change — so a user's chosen look for this layout applies uniformly across
// the whole batch, not just the first page.
//
// Leftover Slots on the last page keep `sourceId: null` (§11.1's worked
// example: 30-page PDF + 4-up -> 8 pages, last page 2 Sources + 2 Empty
// Slots). An empty `sourceIds` still produces exactly ONE page (all Slots
// empty) rather than zero pages — Auto Fill-ing nothing should clear the
// page's content, not delete the page out from under the caller.
export function generateAutoFillPages(templateSlots, sourceIds) {
  if (!Array.isArray(templateSlots) || templateSlots.length === 0) {
    throw new Error('generateAutoFillPages requires a non-empty templateSlots layout');
  }
  const slotsPerPage = templateSlots.length;
  const numPages = Math.max(1, Math.ceil(sourceIds.length / slotsPerPage));

  const pages = [];
  for (let p = 0; p < numPages; p += 1) {
    const slots = templateSlots.map((templateSlot, s) => {
      const globalIndex = p * slotsPerPage + s;
      const sourceId = globalIndex < sourceIds.length ? sourceIds[globalIndex] : null;
      return createSlot({ ...templateSlot, id: undefined, sourceId });
    });
    pages.push(slots);
  }
  return pages;
}

// Convenience wrapper bridging generateAutoFillPages()'s Slot[][] into full
// Page objects sharing the template page's paper settings (§11.1 doesn't
// touch paper/margins, only content) — used by reducers.js.
export function generateAutoFillPageObjects(templatePaper, templateSlots, sourceIds) {
  return generateAutoFillPages(templateSlots, sourceIds).map((slots) => createPage({ paper: templatePaper, slots }));
}

// §11.4 — "當來源 PDF 各頁尺寸不一...此行為需在 UI 顯示提示": a pure check
// so the UI can show that hint. Compares each Source's own /Rotate-
// normalized natural size (§14.3 — already what `naturalWidth/Height`
// store), rounded to 0.01 to ignore float noise; true iff more than one
// distinct size is present. This performs NO rescaling itself — fit is
// already computed per-Slot from its own assigned Source's size (§6.3),
// nothing here or in geometry.js applies a global scale factor.
export function detectMixedSourceSizes(sources) {
  const sizes = new Set(
    sources.map((s) => `${Math.round(s.naturalWidth * 100)}x${Math.round(s.naturalHeight * 100)}`),
  );
  return sizes.size > 1;
}
