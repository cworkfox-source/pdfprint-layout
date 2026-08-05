import test from 'node:test';
import assert from 'node:assert/strict';
import { createSlot } from './model.js';
import {
  FIT_MODES,
  MVP_ROTATIONS,
  setSlotSource,
  setSlotFitMode,
  setSlotScale,
  setSlotRotation,
  rotateSlotContent,
  setSlotOffset,
  setSlotFlip,
  clearSlotContent,
} from './slot-content.js';

function slot(overrides) {
  return createSlot(overrides);
}

// --- setSlotSource -------------------------------------------------------

test('setSlotSource assigns a sourceId to the targeted slot only', () => {
  const a = slot({ id: 'a' });
  const b = slot({ id: 'b' });
  const result = setSlotSource([a, b], 'a', 'src-1');
  assert.equal(result[0].sourceId, 'src-1');
  assert.deepEqual(result[1], b);
});

test('setSlotSource accepts null to clear just the association', () => {
  const a = slot({ id: 'a', sourceId: 'src-1' });
  const result = setSlotSource([a], 'a', null);
  assert.equal(result[0].sourceId, null);
});

test('setSlotSource throws for an unknown slot id', () => {
  assert.throws(() => setSlotSource([slot({ id: 'a' })], 'missing', 'src-1'), /no slot with id/);
});

// --- setSlotFitMode --------------------------------------------------------

test('setSlotFitMode accepts contain/cover/stretch', () => {
  const a = slot({ id: 'a' });
  for (const mode of FIT_MODES) {
    const result = setSlotFitMode([a], 'a', mode);
    assert.equal(result[0].fitMode, mode);
  }
});

test('setSlotFitMode rejects an unknown mode', () => {
  assert.throws(() => setSlotFitMode([slot({ id: 'a' })], 'a', 'fill'), /unknown fitMode/);
});

// --- setSlotScale ----------------------------------------------------------

test('setSlotScale sets a positive multiplier', () => {
  const result = setSlotScale([slot({ id: 'a' })], 'a', 2.5);
  assert.equal(result[0].scale, 2.5);
});

test('setSlotScale rejects zero and negative values', () => {
  assert.throws(() => setSlotScale([slot({ id: 'a' })], 'a', 0), /positive number/);
  assert.throws(() => setSlotScale([slot({ id: 'a' })], 'a', -1), /positive number/);
});

// --- setSlotRotation / rotateSlotContent ------------------------------------

test('setSlotRotation accepts the MVP set 0/90/180/270', () => {
  const a = slot({ id: 'a' });
  for (const deg of MVP_ROTATIONS) {
    const result = setSlotRotation([a], 'a', deg);
    assert.equal(result[0].rotation, deg);
  }
});

test('setSlotRotation normalizes out-of-range but equivalent angles', () => {
  assert.equal(setSlotRotation([slot({ id: 'a' })], 'a', -90)[0].rotation, 270);
  assert.equal(setSlotRotation([slot({ id: 'a' })], 'a', 450)[0].rotation, 90);
});

test('setSlotRotation rejects a non-MVP angle', () => {
  assert.throws(() => setSlotRotation([slot({ id: 'a' })], 'a', 45), /MVP only supports/);
});

test('rotateSlotContent cycles forward through the MVP set', () => {
  let slots = [slot({ id: 'a', rotation: 0 })];
  slots = rotateSlotContent(slots, 'a', 90);
  assert.equal(slots[0].rotation, 90);
  slots = rotateSlotContent(slots, 'a', 90);
  assert.equal(slots[0].rotation, 180);
  slots = rotateSlotContent(slots, 'a', 90);
  assert.equal(slots[0].rotation, 270);
  slots = rotateSlotContent(slots, 'a', 90);
  assert.equal(slots[0].rotation, 0); // wraps
});

// --- setSlotOffset / setSlotFlip --------------------------------------------

test('setSlotOffset sets both axes, unclamped', () => {
  const result = setSlotOffset([slot({ id: 'a' })], 'a', 0.3, -0.2);
  assert.equal(result[0].offsetX, 0.3);
  assert.equal(result[0].offsetY, -0.2);
});

test('setSlotFlip sets both flip flags independently', () => {
  const result = setSlotFlip([slot({ id: 'a' })], 'a', true, false);
  assert.equal(result[0].flipX, true);
  assert.equal(result[0].flipY, false);
});

// --- clearSlotContent --------------------------------------------------------

test('clearSlotContent resets sourceId and every transform field to defaults', () => {
  const a = slot({
    id: 'a', sourceId: 'src-1', fitMode: 'cover', scale: 2, rotation: 180,
    offsetX: 0.4, offsetY: 0.1, flipX: true, flipY: true,
  });
  const result = clearSlotContent([a], 'a');
  assert.deepEqual(
    { sourceId: result[0].sourceId, fitMode: result[0].fitMode, scale: result[0].scale, rotation: result[0].rotation, offsetX: result[0].offsetX, offsetY: result[0].offsetY, flipX: result[0].flipX, flipY: result[0].flipY },
    { sourceId: null, fitMode: 'contain', scale: 1, rotation: 0, offsetX: 0, offsetY: 0, flipX: false, flipY: false },
  );
});

test('clearSlotContent leaves geometry (x/y/w/h/z/locked) untouched', () => {
  const a = slot({ id: 'a', x: 0.1, y: 0.2, w: 0.3, h: 0.4, z: 5, locked: true, sourceId: 'src-1' });
  const result = clearSlotContent([a], 'a');
  assert.equal(result[0].x, 0.1);
  assert.equal(result[0].y, 0.2);
  assert.equal(result[0].w, 0.3);
  assert.equal(result[0].h, 0.4);
  assert.equal(result[0].z, 5);
  assert.equal(result[0].locked, true);
});
