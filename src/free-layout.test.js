import test from 'node:test';
import assert from 'node:assert/strict';
import { createSlot } from './model.js';
import {
  moveSlots,
  setSlotRect,
  deleteSlots,
  duplicateSlots,
  splitSlotHorizontal,
  splitSlotVertical,
  canMergeSlots,
  mergeSlots,
  setSlotLocked,
  bringSlotForward,
  sendSlotBackward,
  bringSlotToFront,
  sendSlotToBack,
  createSlotRectFromDrag,
  computeSnapTargetsX,
  computeSnapTargetsY,
  computeSnapThresholdNormalized,
  snapValue,
  snapMoveAxis,
  snapMove,
  snapResizeAxis,
  snapResize,
} from './free-layout.js';

function slot(overrides) {
  return createSlot(overrides);
}

function assertClose(actual, expected, epsilon = 1e-9, msg) {
  assert.ok(Math.abs(actual - expected) <= epsilon, msg ?? `expected ${actual} to be close to ${expected}`);
}

// --- moveSlots ---------------------------------------------------------------

test('moveSlots translates only the targeted, unlocked slots', () => {
  const a = slot({ id: 'a', x: 0, y: 0 });
  const b = slot({ id: 'b', x: 0.5, y: 0.5 });
  const c = slot({ id: 'c', x: 0.2, y: 0.2, locked: true });
  const result = moveSlots([a, b, c], ['a', 'c'], 0.1, 0.2);
  assert.equal(result[0].x, 0.1);
  assert.equal(result[0].y, 0.2);
  assert.deepEqual(result[1], b); // untouched, not targeted
  assert.deepEqual(result[2], c); // untouched, locked
});

// --- setSlotRect ---------------------------------------------------------------

test('setSlotRect replaces the rect of one slot', () => {
  const a = slot({ id: 'a', x: 0, y: 0, w: 0.5, h: 0.5 });
  const result = setSlotRect([a], 'a', { x: 0.1, y: 0.2, w: 0.3, h: 0.4 });
  assert.deepEqual({ x: result[0].x, y: result[0].y, w: result[0].w, h: result[0].h }, { x: 0.1, y: 0.2, w: 0.3, h: 0.4 });
});

test('setSlotRect throws for a locked slot or an unknown id', () => {
  const a = slot({ id: 'a', locked: true });
  assert.throws(() => setSlotRect([a], 'a', { x: 0, y: 0, w: 1, h: 1 }), /locked/);
  assert.throws(() => setSlotRect([a], 'missing', { x: 0, y: 0, w: 1, h: 1 }), /no slot with id/);
});

// --- deleteSlots ---------------------------------------------------------------

test('deleteSlots removes the targeted slots', () => {
  const a = slot({ id: 'a' });
  const b = slot({ id: 'b' });
  const result = deleteSlots([a, b], ['a']);
  assert.deepEqual(result, [b]);
});

test('deleteSlots throws if ANY targeted slot is locked (whole op fails, no partial delete)', () => {
  const a = slot({ id: 'a' });
  const b = slot({ id: 'b', locked: true });
  assert.throws(() => deleteSlots([a, b], ['a', 'b']), /locked/);
});

test('deleteSlots is a no-op when no ids match', () => {
  const a = slot({ id: 'a' });
  assert.deepEqual(deleteSlots([a], ['missing']), [a]);
});

// --- duplicateSlots ---------------------------------------------------------------

test('duplicateSlots appends offset copies with fresh ids and z above the current max', () => {
  const a = slot({ id: 'a', x: 0.1, y: 0.1, z: 3 });
  const b = slot({ id: 'b', x: 0.5, y: 0.5, z: 1 });
  const result = duplicateSlots([a, b], ['a'], { offsetX: 0.05, offsetY: 0.05 });
  assert.equal(result.length, 3);
  assert.deepEqual(result[0], a);
  assert.deepEqual(result[1], b);
  const dup = result[2];
  assert.notEqual(dup.id, a.id);
  assertClose(dup.x, 0.15);
  assertClose(dup.y, 0.15);
  assert.equal(dup.z, 4); // maxZ(3) + 1
});

// --- split (§9.3) ---------------------------------------------------------------

test('splitSlotHorizontal produces a TOP slot then a BOTTOM slot at the given ratio', () => {
  const a = slot({ id: 'a', x: 0, y: 0, w: 1, h: 1, sourceId: 'src-1' });
  const result = splitSlotHorizontal([a], 'a', 0.25);
  assert.equal(result.length, 2);
  assert.deepEqual({ x: result[0].x, y: result[0].y, w: result[0].w, h: result[0].h }, { x: 0, y: 0, w: 1, h: 0.25 });
  assert.deepEqual({ x: result[1].x, y: result[1].y, w: result[1].w, h: result[1].h }, { x: 0, y: 0.25, w: 1, h: 0.75 });
  // content doesn't cleanly carry over onto sub-regions, so it's cleared
  assert.equal(result[0].sourceId, null);
  assert.equal(result[1].sourceId, null);
});

test('splitSlotVertical produces a LEFT slot then a RIGHT slot at the given ratio', () => {
  const a = slot({ id: 'a', x: 0, y: 0, w: 1, h: 1 });
  const result = splitSlotVertical([a], 'a', 0.5);
  assert.deepEqual({ x: result[0].x, y: result[0].y, w: result[0].w, h: result[0].h }, { x: 0, y: 0, w: 0.5, h: 1 });
  assert.deepEqual({ x: result[1].x, y: result[1].y, w: result[1].w, h: result[1].h }, { x: 0.5, y: 0, w: 0.5, h: 1 });
});

test('splitSlot* rejects a locked slot, an out-of-range ratio, and an unknown id', () => {
  const locked = slot({ id: 'a', locked: true });
  assert.throws(() => splitSlotHorizontal([locked], 'a'), /locked/);

  const a = slot({ id: 'a' });
  assert.throws(() => splitSlotHorizontal([a], 'a', 0));
  assert.throws(() => splitSlotHorizontal([a], 'a', 1));
  assert.throws(() => splitSlotHorizontal([a], 'a', -0.1));
  assert.throws(() => splitSlotHorizontal([a], 'missing'), /no slot with id/);
});

// --- merge (§9.3 / §23.4.2) ---------------------------------------------------------------

test('canMergeSlots: true for the bottom two cells of a 2x2 grid (§9.3 worked example: -> 上2下1 shape)', () => {
  const bottomLeft = { x: 0, y: 0.5, w: 0.5, h: 0.5 };
  const bottomRight = { x: 0.5, y: 0.5, w: 0.5, h: 0.5 };
  assert.equal(canMergeSlots([bottomLeft, bottomRight]), true);
});

test('canMergeSlots: true for all 4 cells of a 2x2 grid (fills the full square)', () => {
  const cells = [
    { x: 0, y: 0, w: 0.5, h: 0.5 },
    { x: 0.5, y: 0, w: 0.5, h: 0.5 },
    { x: 0, y: 0.5, w: 0.5, h: 0.5 },
    { x: 0.5, y: 0.5, w: 0.5, h: 0.5 },
  ];
  assert.equal(canMergeSlots(cells), true);
});

test('canMergeSlots: false for an L-shape (3 of 4 quarters — union has a notch, not a rectangle)', () => {
  const cells = [
    { x: 0, y: 0, w: 0.5, h: 0.5 },
    { x: 0.5, y: 0, w: 0.5, h: 0.5 },
    { x: 0, y: 0.5, w: 0.5, h: 0.5 },
  ];
  assert.equal(canMergeSlots(cells), false);
});

test('canMergeSlots: false for overlapping rects, and false for fewer than 2 rects', () => {
  assert.equal(canMergeSlots([{ x: 0, y: 0, w: 0.6, h: 0.6 }, { x: 0.4, y: 0.4, w: 0.6, h: 0.6 }]), false);
  assert.equal(canMergeSlots([{ x: 0, y: 0, w: 1, h: 1 }]), false);
  assert.equal(canMergeSlots([]), false);
});

test('mergeSlots replaces the bottom two of a 2x2 grid with one full-width slot (matches plan §9.3 example)', () => {
  const topLeft = slot({ id: 'tl', x: 0, y: 0, w: 0.5, h: 0.5, z: 0 });
  const topRight = slot({ id: 'tr', x: 0.5, y: 0, w: 0.5, h: 0.5, z: 1 });
  const bottomLeft = slot({ id: 'bl', x: 0, y: 0.5, w: 0.5, h: 0.5, z: 2 });
  const bottomRight = slot({ id: 'br', x: 0.5, y: 0.5, w: 0.5, h: 0.5, z: 3 });
  const result = mergeSlots([topLeft, topRight, bottomLeft, bottomRight], ['bl', 'br']);

  assert.equal(result.length, 3);
  assert.equal(result[0].id, 'tl');
  assert.equal(result[1].id, 'tr');
  const merged = result[2];
  assert.deepEqual({ x: merged.x, y: merged.y, w: merged.w, h: merged.h }, { x: 0, y: 0.5, w: 1, h: 0.5 });
  assert.equal(merged.z, 2); // min(z) of the merged set
});

test('mergeSlots throws with a UI-displayable message for a non-rectangular union (§23.4.2)', () => {
  const a = slot({ id: 'a', x: 0, y: 0, w: 0.5, h: 0.5 });
  const b = slot({ id: 'b', x: 0.5, y: 0, w: 0.5, h: 0.5 });
  const c = slot({ id: 'c', x: 0, y: 0.5, w: 0.5, h: 0.5 });
  assert.throws(() => mergeSlots([a, b, c], ['a', 'b', 'c']), /do not form a rectangle/);
});

test('mergeSlots throws for a locked target or fewer than 2 targets', () => {
  const a = slot({ id: 'a', x: 0, y: 0, w: 0.5, h: 1, locked: true });
  const b = slot({ id: 'b', x: 0.5, y: 0, w: 0.5, h: 1 });
  assert.throws(() => mergeSlots([a, b], ['a', 'b']), /locked/);
  assert.throws(() => mergeSlots([a, b], ['a']), /at least 2/);
});

// --- setSlotLocked (§10.3) ---------------------------------------------------------------

test('setSlotLocked sets the flag true and false, leaving other fields untouched', () => {
  const a = slot({ id: 'a', x: 0.1, y: 0.2 });
  const locked = setSlotLocked([a], 'a', true);
  assert.equal(locked[0].locked, true);
  assert.equal(locked[0].x, 0.1);
  const unlocked = setSlotLocked(locked, 'a', false);
  assert.equal(unlocked[0].locked, false);
});

test('setSlotLocked throws for an unknown id', () => {
  assert.throws(() => setSlotLocked([slot({ id: 'a' })], 'missing', true), /no slot with id/);
});

test('setSlotLocked + moveSlots: locking a slot makes a subsequent move silently skip it (§10.3 enforcement, integration)', () => {
  const a = slot({ id: 'a', x: 0, y: 0 });
  const locked = setSlotLocked([a], 'a', true);
  const moved = moveSlots(locked, ['a'], 0.1, 0.1);
  assert.equal(moved[0].x, 0); // still skipped, locked took effect
});

// --- Z-order (§6.5) ---------------------------------------------------------------

function zOrderIds(slots) {
  return [...slots].sort((a, b) => a.z - b.z).map((s) => s.id);
}

test('bringSlotForward swaps with the next slot up; no-op when already topmost', () => {
  const a = slot({ id: 'a', z: 0 });
  const b = slot({ id: 'b', z: 1 });
  const c = slot({ id: 'c', z: 2 });
  const result = bringSlotForward([a, b, c], 'a');
  assert.deepEqual(zOrderIds(result), ['b', 'a', 'c']);
  const noop = bringSlotForward(result, 'c'); // c is already topmost
  assert.deepEqual(zOrderIds(noop), ['b', 'a', 'c']);
});

test('sendSlotBackward swaps with the next slot down; no-op when already bottommost', () => {
  const a = slot({ id: 'a', z: 0 });
  const b = slot({ id: 'b', z: 1 });
  const c = slot({ id: 'c', z: 2 });
  const result = sendSlotBackward([a, b, c], 'c');
  assert.deepEqual(zOrderIds(result), ['a', 'c', 'b']);
  const noop = sendSlotBackward(result, 'a'); // a is already bottommost
  assert.deepEqual(zOrderIds(noop), ['a', 'c', 'b']);
});

test('bringSlotToFront moves to the top, preserving the relative order of everything else', () => {
  const a = slot({ id: 'a', z: 0 });
  const b = slot({ id: 'b', z: 1 });
  const c = slot({ id: 'c', z: 2 });
  const result = bringSlotToFront([a, b, c], 'a');
  assert.deepEqual(zOrderIds(result), ['b', 'c', 'a']);
});

test('sendSlotToBack moves to the bottom, preserving the relative order of everything else', () => {
  const a = slot({ id: 'a', z: 0 });
  const b = slot({ id: 'b', z: 1 });
  const c = slot({ id: 'c', z: 2 });
  const result = sendSlotToBack([a, b, c], 'c');
  assert.deepEqual(zOrderIds(result), ['c', 'a', 'b']);
});

test('Z-order ops re-derive a full contiguous 0..n-1 ranking, independent of the original (possibly non-contiguous) z values', () => {
  // b (z:5) draws BEFORE a (z:100) — sortByZOrder is ascending, so the
  // draw order is [b, a] (b at the bottom, a on top). bringSlotForward('b')
  // swaps b up past a, landing on ['a', 'b'].
  const a = slot({ id: 'a', z: 100 });
  const b = slot({ id: 'b', z: 5 });
  const result = bringSlotForward([a, b], 'b');
  assert.deepEqual(zOrderIds(result), ['a', 'b']);
  // the wide original gap (5 vs 100) must NOT survive — z is re-ranked to
  // a clean, contiguous 0..n-1 matching the new draw order.
  const bySlotId = Object.fromEntries(result.map((s) => [s.id, s.z]));
  assert.deepEqual(bySlotId, { a: 0, b: 1 });
});

test('Z-order ops are NOT blocked by a locked slot (§10.3 only names Move/Resize/Delete)', () => {
  const a = slot({ id: 'a', z: 0, locked: true });
  const b = slot({ id: 'b', z: 1 });
  const result = bringSlotToFront([a, b], 'a');
  assert.deepEqual(zOrderIds(result), ['b', 'a']);
});

test('Z-order ops throw for an unknown id', () => {
  const slots = [slot({ id: 'a' })];
  assert.throws(() => bringSlotForward(slots, 'missing'), /no slot with id/);
  assert.throws(() => sendSlotBackward(slots, 'missing'), /no slot with id/);
  assert.throws(() => bringSlotToFront(slots, 'missing'), /no slot with id/);
  assert.throws(() => sendSlotToBack(slots, 'missing'), /no slot with id/);
});

// --- createSlotRectFromDrag (§9.4) ---------------------------------------------------------------

test('createSlotRectFromDrag normalizes any drag direction into a min-origin rect', () => {
  // dragged from bottom-right to top-left
  const rect = createSlotRectFromDrag(0.6, 0.6, 0.2, 0.3);
  assert.equal(rect.x, 0.2);
  assert.equal(rect.y, 0.3);
  assertClose(rect.w, 0.4);
  assertClose(rect.h, 0.3);
});

test('createSlotRectFromDrag returns null for a too-small (accidental click) drag', () => {
  assert.equal(createSlotRectFromDrag(0.5, 0.5, 0.501, 0.501), null);
});

test('createSlotRectFromDrag clamps origin AND size so the rect never exceeds the 0..1 content area', () => {
  const rect = createSlotRectFromDrag(-0.3, -0.3, 1.3, 1.3);
  assert.equal(rect.x, 0);
  assert.equal(rect.y, 0);
  assert.equal(rect.w, 1);
  assert.equal(rect.h, 1);
});

// --- snap targets / threshold (§9.5) ---------------------------------------------------------------

test('computeSnapTargetsX includes paper edges/center plus other slots’ edges and midline, excluding self', () => {
  const a = slot({ id: 'a', x: 0.2, y: 0, w: 0.3, h: 1 });
  const b = slot({ id: 'b', x: 0.7, y: 0, w: 0.2, h: 1 });
  const targets = computeSnapTargetsX([a, b], { excludeSlotId: 'a' });
  // 0, 0.5, 1 (paper) + b's left(0.7), right(0.9), center(0.8) — a excluded
  assert.equal(targets.length, 6);
  [0, 0.5, 0.7, 0.8, 0.9, 1].forEach((expected, i) => assertClose(targets[i], expected));
});

test('computeSnapThresholdNormalized: 6 screen-px at zoom 1 over a 600pt content area is 0.01 (hand-computed)', () => {
  assert.equal(computeSnapThresholdNormalized(6, 1, 600), 0.01);
});

test('computeSnapThresholdNormalized scales inversely with zoom (screen-px stays visually constant)', () => {
  const at1x = computeSnapThresholdNormalized(6, 1, 600);
  const at2x = computeSnapThresholdNormalized(6, 2, 600);
  assert.equal(at2x, at1x / 2);
});

test('snapValue snaps to the nearest target within threshold, else passes through unchanged', () => {
  assert.equal(snapValue(0.503, [0.5, 0.9], 0.01), 0.5);
  assert.equal(snapValue(0.52, [0.5, 0.9], 0.01), 0.52); // too far from both
});

// --- snapMove / snapResize (§9.5) ---------------------------------------------------------------

test('snapMoveAxis snaps whichever of start/end/center needs the smallest adjustment', () => {
  // start=0.49 (needs +0.01 to hit 0.5), size=0.2 -> end=0.69, center=0.59:
  // neither end nor center is within 0.02 of any target here, so start wins.
  const targets = [0, 0.5, 1];
  assert.equal(snapMoveAxis(0.49, 0.2, targets, 0.02), 0.5);
});

test('snapMoveAxis prefers the smaller-delta candidate when multiple are in range', () => {
  // start=0.48 (delta 0.02 to reach 0.5), center = 0.48+0.1=0.58 (far).
  // end = 0.68 (far). Only start is within threshold -> snaps via start.
  const targets = [0, 0.5, 1];
  const snappedStart = snapMoveAxis(0.48, 0.2, targets, 0.03);
  assert.equal(snappedStart, 0.5);
});

test('snapMove translates the whole rect (w/h unchanged) using independent X/Y snapping', () => {
  const rect = { x: 0.49, y: 0.31, w: 0.2, h: 0.2 };
  const targetsX = [0, 0.5, 1];
  const targetsY = [0, 0.3, 1];
  const snapped = snapMove(rect, targetsX, targetsY, 0.02, 0.02);
  assert.equal(snapped.x, 0.5);
  assert.equal(snapped.y, 0.3);
  assert.equal(snapped.w, 0.2);
  assert.equal(snapped.h, 0.2);
});

test('snapResizeAxis "start": snaps the start edge, keeping the END edge fixed (size changes)', () => {
  // pos=0.19 size=0.31 -> end=0.5 (fixed). Snapping start to 0.2 -> size becomes 0.3.
  const result = snapResizeAxis(0.19, 0.31, 'start', [0, 0.2, 1], 0.02);
  assert.equal(result.pos, 0.2);
  assert.ok(Math.abs(result.size - 0.3) < 1e-9);
});

test('snapResizeAxis "end": snaps the end edge, keeping the START edge fixed (size changes)', () => {
  // pos=0.1 (fixed) size=0.39 -> end=0.49, snap end to 0.5 -> size becomes 0.4.
  const result = snapResizeAxis(0.1, 0.39, 'end', [0, 0.5, 1], 0.02);
  assert.equal(result.pos, 0.1);
  assert.ok(Math.abs(result.size - 0.4) < 1e-9);
});

test('snapResizeAxis rejects an edge that is neither "start" nor "end"', () => {
  assert.throws(() => snapResizeAxis(0, 1, 'middle', [0.5], 0.1));
});

test('snapResize resizes a bottom-right handle by snapping x:end and y:end together', () => {
  const rect = { x: 0.1, y: 0.1, w: 0.39, h: 0.29 }; // end = (0.49, 0.39)
  const result = snapResize(rect, { x: 'end', y: 'end' }, [0, 0.5, 1], [0, 0.4, 1], 0.02, 0.02);
  assert.equal(result.x, 0.1); // start edges untouched
  assert.equal(result.y, 0.1);
  assert.ok(Math.abs(result.w - 0.4) < 1e-9); // end snapped 0.49 -> 0.5
  assert.ok(Math.abs(result.h - 0.3) < 1e-9); // end snapped 0.39 -> 0.4
});
