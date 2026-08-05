// Output Pages management (docs/plan.md §11.3, Phase 6): add / delete /
// duplicate / reorder. Pure `Page[]` array operations — no DOM, no
// store.js — same layering as free-layout.js (Slot[] ops) and pages.js's
// sibling auto-fill.js; reducers.js wires these to `store.commit()`.

import { createPage, createSlot } from './model.js';

export function addPage(pages, newPage, index = pages.length) {
  const clamped = Math.max(0, Math.min(index, pages.length));
  const next = [...pages];
  next.splice(clamped, 0, newPage);
  return next;
}

// A Project always needs at least one Page — deleting the last one would
// leave AppState with nothing to show/export, so this throws rather than
// silently emptying the array (same defense-in-depth convention as
// free-layout.js's locked-slot throws).
export function deletePage(pages, pageId) {
  const index = pages.findIndex((p) => p.id === pageId);
  if (index === -1) throw new Error(`deletePage: no page with id ${pageId}`);
  if (pages.length <= 1) {
    throw new Error('Cannot delete the last remaining page');
  }
  return pages.filter((p) => p.id !== pageId);
}

// Duplicates a page's paper settings AND its Slots (including whatever
// Source content they hold, unlike Template's §17.3 sourceId-stripping —
// a page duplicate is a working copy, not a reusable Layout Template),
// with fresh ids throughout, inserted immediately after the original.
export function duplicatePage(pages, pageId) {
  const index = pages.findIndex((p) => p.id === pageId);
  if (index === -1) throw new Error(`duplicatePage: no page with id ${pageId}`);
  const original = pages[index];
  const clonedSlots = original.slots.map((slot) => createSlot({ ...slot, id: undefined }));
  const clone = createPage({ paper: original.paper, slots: clonedSlots });
  const next = [...pages];
  next.splice(index + 1, 0, clone);
  return next;
}

// Reorders one Page to a new position; `toIndex` is clamped into range
// rather than throwing, so a UI drag-reorder never has to pre-clamp.
export function movePage(pages, pageId, toIndex) {
  const fromIndex = pages.findIndex((p) => p.id === pageId);
  if (fromIndex === -1) throw new Error(`movePage: no page with id ${pageId}`);
  const clampedTo = Math.max(0, Math.min(toIndex, pages.length - 1));
  const next = [...pages];
  const [page] = next.splice(fromIndex, 1);
  next.splice(clampedTo, 0, page);
  return next;
}
