// Free Layout Designer (docs/plan.md §9.3-§9.5, Phase 4). Pure Slot[]
// editing primitives — no DOM, no store.js — so every operation (move,
// resize, split, merge, delete, duplicate, snap) is unit-testable with
// plain arrays. store.js wiring (action creators that target
// AppState.pages[i].slots) lives in reducers.js, one layer up; this module
// never imports store.js.
//
// Locked Slots (§10.3 "鎖定後不得 Move / Resize / Delete"): move silently
// skips locked targets (so a mixed-selection drag still moves the
// unlocked ones), while resize/delete/split/merge THROW when the target
// is locked — those are more consequential/irreversible-feeling actions
// that deserve a hard stop rather than a silent no-op.

import { createSlot } from './model.js';
import { sortByZOrder } from './geometry.js';

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// --- Move / Resize / Delete / Duplicate (§9.3) ----------------------------

export function moveSlots(slots, slotIds, dx, dy) {
  const idSet = new Set(slotIds);
  return slots.map((slot) => {
    if (!idSet.has(slot.id) || slot.locked) return slot;
    return { ...slot, x: slot.x + dx, y: slot.y + dy };
  });
}

export function setSlotRect(slots, slotId, rect) {
  const index = slots.findIndex((s) => s.id === slotId);
  if (index === -1) throw new Error(`setSlotRect: no slot with id ${slotId}`);
  if (slots[index].locked) throw new Error('Cannot resize a locked slot (§10.3)');
  const next = [...slots];
  next[index] = { ...next[index], x: rect.x, y: rect.y, w: rect.w, h: rect.h };
  return next;
}

export function deleteSlots(slots, slotIds) {
  const idSet = new Set(slotIds);
  const targets = slots.filter((s) => idSet.has(s.id));
  if (targets.length === 0) return slots;
  if (targets.some((s) => s.locked)) throw new Error('Cannot delete a locked slot (§10.3)');
  return slots.filter((s) => !idSet.has(s.id));
}

export function duplicateSlots(slots, slotIds, { offsetX = 0.02, offsetY = 0.02 } = {}) {
  const idSet = new Set(slotIds);
  const targets = slots.filter((s) => idSet.has(s.id));
  const maxZ = slots.reduce((m, s) => Math.max(m, s.z), 0);
  const duplicates = targets.map((s, i) => createSlot({
    ...s,
    id: undefined,
    x: s.x + offsetX,
    y: s.y + offsetY,
    z: maxZ + 1 + i,
  }));
  return [...slots, ...duplicates];
}

// --- Split (§9.3) ------------------------------------------------------------
// "水平分割"/"垂直分割" naming is ambiguous in plan.md (no diagram) — this
// implementation follows the common editor convention (Word/Excel "split
// cell"): the split LINE's orientation names the operation, so a
// "horizontal split" draws a horizontal line and produces a TOP + BOTTOM
// pair, and a "vertical split" produces a LEFT + RIGHT pair. Recorded as
// an assumption, see decision_log.

function splitSlotAlongAxis(slots, slotId, axis, ratio) {
  if (!(ratio > 0 && ratio < 1)) {
    throw new Error(`split ratio must be between 0 and 1 (exclusive), got ${ratio}`);
  }
  const index = slots.findIndex((s) => s.id === slotId);
  if (index === -1) throw new Error(`splitSlot: no slot with id ${slotId}`);
  const target = slots[index];
  if (target.locked) throw new Error('Cannot split a locked slot (§10.3)');

  let firstOverrides;
  let secondOverrides;
  if (axis === 'y') {
    const splitH = target.h * ratio;
    firstOverrides = { ...target, id: undefined, h: splitH, sourceId: null };
    secondOverrides = { ...target, id: undefined, y: target.y + splitH, h: target.h - splitH, sourceId: null };
  } else {
    const splitW = target.w * ratio;
    firstOverrides = { ...target, id: undefined, w: splitW, sourceId: null };
    secondOverrides = { ...target, id: undefined, x: target.x + splitW, w: target.w - splitW, sourceId: null };
  }

  const result = [...slots];
  result.splice(index, 1, createSlot(firstOverrides), createSlot(secondOverrides));
  return result;
}

// Horizontal split line -> TOP slot then BOTTOM slot.
export function splitSlotHorizontal(slots, slotId, ratio = 0.5) {
  return splitSlotAlongAxis(slots, slotId, 'y', ratio);
}

// Vertical split line -> LEFT slot then RIGHT slot.
export function splitSlotVertical(slots, slotId, ratio = 0.5) {
  return splitSlotAlongAxis(slots, slotId, 'x', ratio);
}

// --- Merge (§9.3 / §23.4.2) --------------------------------------------------

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

const MERGE_AREA_EPSILON = 1e-6;

// §9.3 — "僅允許合併「聯集後為矩形」的選取集合". True iff the selected
// rects are pairwise non-overlapping AND their union exactly tiles their
// own bounding box (no gaps). Both conditions together are what makes the
// union itself a clean rectangle.
export function canMergeSlots(rects) {
  if (rects.length < 2) return false;
  for (let i = 0; i < rects.length; i += 1) {
    for (let j = i + 1; j < rects.length; j += 1) {
      if (rectsOverlap(rects[i], rects[j])) return false;
    }
  }
  const minX = Math.min(...rects.map((r) => r.x));
  const minY = Math.min(...rects.map((r) => r.y));
  const maxX = Math.max(...rects.map((r) => r.x + r.w));
  const maxY = Math.max(...rects.map((r) => r.y + r.h));
  const boundingArea = (maxX - minX) * (maxY - minY);
  const sumArea = rects.reduce((sum, r) => sum + r.w * r.h, 0);
  return Math.abs(boundingArea - sumArea) < MERGE_AREA_EPSILON;
}

// Throws with a UI-displayable message when the selection can't be merged
// (§23.4.2 "合併非矩形選取時操作被禁用並顯示提示") — callers should check
// canMergeSlots() first to disable the button proactively; this throw is
// the defense-in-depth backstop.
export function mergeSlots(slots, slotIds) {
  const idSet = new Set(slotIds);
  const targets = slots.filter((s) => idSet.has(s.id));
  if (targets.length < 2) {
    throw new Error('mergeSlots requires at least 2 target slots');
  }
  if (targets.some((s) => s.locked)) {
    throw new Error('Cannot merge a locked slot (§10.3)');
  }
  if (!canMergeSlots(targets)) {
    throw new Error('Selected slots do not form a rectangle when merged (§9.3)');
  }

  const minX = Math.min(...targets.map((s) => s.x));
  const minY = Math.min(...targets.map((s) => s.y));
  const maxX = Math.max(...targets.map((s) => s.x + s.w));
  const maxY = Math.max(...targets.map((s) => s.y + s.h));
  const merged = createSlot({
    x: minX,
    y: minY,
    w: maxX - minX,
    h: maxY - minY,
    z: Math.min(...targets.map((s) => s.z)),
  });

  let inserted = false;
  const result = [];
  for (const slot of slots) {
    if (idSet.has(slot.id)) {
      if (!inserted) {
        result.push(merged);
        inserted = true;
      }
    } else {
      result.push(slot);
    }
  }
  return result;
}

// --- Lock / Unlock (§10.3) -------------------------------------------------
// Toggling the flag itself is unrestricted — you must be able to lock a
// Slot and later unlock it, or locking would be a one-way trap. The
// restrictions THIS flag triggers already exist above (moveSlots' silent
// skip; setSlotRect/deleteSlots/splitSlot*/mergeSlots's throw).

export function setSlotLocked(slots, slotId, locked) {
  const index = slots.findIndex((s) => s.id === slotId);
  if (index === -1) throw new Error(`setSlotLocked: no slot with id ${slotId}`);
  const next = [...slots];
  next[index] = { ...next[index], locked };
  return next;
}

// --- Z-order (§6.5) ---------------------------------------------------------
// "Layer" means POSITION IN THE §6.5 DRAW ORDER (sortByZOrder: z ascending,
// array-index tiebreak) — not the raw `z` number, which duplicateSlots()/
// mergeSlots() already mint above/below the existing range rather than
// keeping contiguous. Every op below re-derives a full 0..n-1 ranking from
// the reordered id list, so the result is never sensitive to whatever the
// previous z numbers happened to be, and ties are gone afterward too.
//
// Single Slot only (not a multi-select batch) — plan.md's wording ("上移一
// 層／下移一層／移到最上／移到最下") reads as a per-object action the way
// every mainstream design tool (PowerPoint/Illustrator/Figma) treats it;
// "reorder a whole multi-selection while preserving its internal order" is
// a distinct, fussier operation plan.md never actually asks for.
//
// Locked Slots are NOT blocked here — §10.3 only names Move/Resize/Delete;
// changing draw order doesn't move/resize/delete anything.

function reassignZFromOrder(slots, orderedIds) {
  const zById = new Map(orderedIds.map((id, i) => [id, i]));
  return slots.map((s) => ({ ...s, z: zById.get(s.id) }));
}

function reorderSlotZ(slots, slotId, label, reorderIds) {
  const orderedIds = sortByZOrder(slots).map((s) => s.id);
  const pos = orderedIds.indexOf(slotId);
  if (pos === -1) throw new Error(`${label}: no slot with id ${slotId}`);
  return reassignZFromOrder(slots, reorderIds(orderedIds, pos));
}

// "上移一層" — swaps with the slot immediately above; no-op if already topmost.
export function bringSlotForward(slots, slotId) {
  return reorderSlotZ(slots, slotId, 'bringSlotForward', (ids, pos) => {
    if (pos >= ids.length - 1) return ids;
    const next = [...ids];
    [next[pos], next[pos + 1]] = [next[pos + 1], next[pos]];
    return next;
  });
}

// "下移一層" — swaps with the slot immediately below; no-op if already bottommost.
export function sendSlotBackward(slots, slotId) {
  return reorderSlotZ(slots, slotId, 'sendSlotBackward', (ids, pos) => {
    if (pos <= 0) return ids;
    const next = [...ids];
    [next[pos], next[pos - 1]] = [next[pos - 1], next[pos]];
    return next;
  });
}

// "移到最上" — moves to the very top, all others keep their relative order.
export function bringSlotToFront(slots, slotId) {
  return reorderSlotZ(slots, slotId, 'bringSlotToFront', (ids, pos) => {
    const next = [...ids];
    const [id] = next.splice(pos, 1);
    next.push(id);
    return next;
  });
}

// "移到最下" — moves to the very bottom, all others keep their relative order.
export function sendSlotToBack(slots, slotId) {
  return reorderSlotZ(slots, slotId, 'sendSlotToBack', (ids, pos) => {
    const next = [...ids];
    const [id] = next.splice(pos, 1);
    next.unshift(id);
    return next;
  });
}

// --- Free-drag creation (§9.4) ------------------------------------------

// Normalizes an arbitrary-direction drag gesture (Mouse Down -> drag ->
// Mouse Up, in the same 0..1 content-area-normalized space Slots use) into
// a valid Slot rect, clamped to the content area. Returns null when the
// drag was too small to count as an intentional Slot (accidental click).
export function createSlotRectFromDrag(x1, y1, x2, y2, { minSizeNormalized = 0.01 } = {}) {
  let x = clamp(Math.min(x1, x2), 0, 1);
  let y = clamp(Math.min(y1, y2), 0, 1);
  let w = clamp(Math.abs(x2 - x1), 0, 1 - x);
  let h = clamp(Math.abs(y2 - y1), 0, 1 - y);
  if (w < minSizeNormalized || h < minSizeNormalized) return null;
  return { x, y, w, h };
}

// --- Snap (§9.5) -----------------------------------------------------------
// Snap targets are collected in the SAME 0..1 normalized space Slots use
// (content-area-relative), so they're zoom-independent by construction —
// only the THRESHOLD (a fixed screen-px distance, §9.5) needs a
// zoom-aware conversion, done once via computeSnapThresholdNormalized().
//
// Scope note: only paper edges/center and other Slots' edges/midlines are
// implemented (§9.5's [M] targets). Ruler guides and a snap-to-grid option
// are also listed in §9.5 but need a Guides data model that doesn't exist
// in AppState yet (out of Phase 4 scope) — left as a documented gap.

export function computeSnapTargetsX(slots, { excludeSlotId } = {}) {
  const targets = new Set([0, 0.5, 1]); // content-area left edge, center, right edge
  for (const slot of slots) {
    if (slot.id === excludeSlotId) continue;
    targets.add(slot.x);
    targets.add(slot.x + slot.w);
    targets.add(slot.x + slot.w / 2);
  }
  return Array.from(targets).sort((a, b) => a - b);
}

export function computeSnapTargetsY(slots, { excludeSlotId } = {}) {
  const targets = new Set([0, 0.5, 1]);
  for (const slot of slots) {
    if (slot.id === excludeSlotId) continue;
    targets.add(slot.y);
    targets.add(slot.y + slot.h);
    targets.add(slot.y + slot.h / 2);
  }
  return Array.from(targets).sort((a, b) => a - b);
}

// §9.5 default: 6 screen-px snap distance, independent of zoom. Preview.js
// convention is 1pt = 1 CSS px at zoom 1 (PX_PER_PT_AT_ZOOM_1), so
// pt-threshold = screenPx / zoom, then normalize by the content area's own
// size on that axis.
export function computeSnapThresholdNormalized(screenPx, zoom, contentAreaSizePt) {
  if (!(zoom > 0)) throw new Error(`computeSnapThresholdNormalized requires a positive zoom, got ${zoom}`);
  if (!(contentAreaSizePt > 0)) {
    throw new Error(`computeSnapThresholdNormalized requires a positive contentAreaSizePt, got ${contentAreaSizePt}`);
  }
  const ptThreshold = screenPx / zoom;
  return ptThreshold / contentAreaSizePt;
}

// Nearest target within `threshold`, or `value` unchanged if none qualify.
export function snapValue(value, targets, threshold) {
  let best = null;
  for (const target of targets) {
    const distance = Math.abs(value - target);
    if (distance <= threshold && (best === null || distance < best.distance)) {
      best = { value: target, distance };
    }
  }
  return best ? best.value : value;
}

// Moving (translating) a rect along one axis: try snapping the start edge,
// end edge, and center independently against `targets`, and take whichever
// snap requires the SMALLEST adjustment — the whole rect translates by
// that one delta, so size never changes during a move.
export function snapMoveAxis(pos, size, targets, threshold) {
  const candidates = [pos, pos + size, pos + size / 2];
  let bestDelta = null;
  for (const edge of candidates) {
    const snapped = snapValue(edge, targets, threshold);
    if (snapped !== edge) {
      const delta = snapped - edge;
      if (bestDelta === null || Math.abs(delta) < Math.abs(bestDelta)) bestDelta = delta;
    }
  }
  return bestDelta === null ? pos : pos + bestDelta;
}

export function snapMove(rect, targetsX, targetsY, thresholdX, thresholdY) {
  return {
    ...rect,
    x: snapMoveAxis(rect.x, rect.w, targetsX, thresholdX),
    y: snapMoveAxis(rect.y, rect.h, targetsY, thresholdY),
  };
}

// Resizing one edge (dragging a handle): snap just that edge, keeping the
// OPPOSITE edge fixed and recomputing size — unlike a move, size DOES
// change here by design.
export function snapResizeAxis(pos, size, edge, targets, threshold) {
  if (edge === 'start') {
    const newStart = snapValue(pos, targets, threshold);
    const end = pos + size;
    return { pos: newStart, size: end - newStart };
  }
  if (edge === 'end') {
    const end = pos + size;
    const newEnd = snapValue(end, targets, threshold);
    return { pos, size: newEnd - pos };
  }
  throw new Error(`snapResizeAxis: edge must be 'start' or 'end', got ${edge}`);
}

// `edges`: { x: 'start' | 'end' | null, y: 'start' | 'end' | null } — which
// edges the current resize handle is dragging (e.g. a bottom-right handle
// drags x:'end', y:'end'; a left-edge handle drags x:'start', y: null).
export function snapResize(rect, edges, targetsX, targetsY, thresholdX, thresholdY) {
  let { x, y, w, h } = rect;
  if (edges.x) {
    const r = snapResizeAxis(x, w, edges.x, targetsX, thresholdX);
    x = r.pos;
    w = r.size;
  }
  if (edges.y) {
    const r = snapResizeAxis(y, h, edges.y, targetsY, thresholdY);
    y = r.pos;
    h = r.size;
  }
  return { x, y, w, h };
}
