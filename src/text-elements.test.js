import test from 'node:test';
import assert from 'node:assert/strict';
import { createTextBox } from './model.js';
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

function box(overrides) {
  return createTextBox(overrides);
}

// --- addTextBox ---------------------------------------------------------------

test('addTextBox appends to the array', () => {
  const a = box({ id: 'a' });
  const result = addTextBox([], a);
  assert.deepEqual(result, [a]);
});

// --- moveTextBoxes --------------------------------------------------------------

test('moveTextBoxes translates only the targeted boxes', () => {
  const a = box({ id: 'a', x: 0, y: 0 });
  const b = box({ id: 'b', x: 0.5, y: 0.5 });
  const result = moveTextBoxes([a, b], ['a'], 0.1, 0.2);
  assert.equal(result[0].x, 0.1);
  assert.equal(result[0].y, 0.2);
  assert.deepEqual(result[1], b);
});

// --- setTextBoxRect ---------------------------------------------------------------

test('setTextBoxRect replaces the rect of one box', () => {
  const a = box({ id: 'a', x: 0, y: 0, w: 0.3, h: 0.1 });
  const result = setTextBoxRect([a], 'a', { x: 0.1, y: 0.2, w: 0.4, h: 0.15 });
  assert.deepEqual({ x: result[0].x, y: result[0].y, w: result[0].w, h: result[0].h }, { x: 0.1, y: 0.2, w: 0.4, h: 0.15 });
});

test('setTextBoxRect throws for an unknown id', () => {
  assert.throws(() => setTextBoxRect([], 'missing', { x: 0, y: 0, w: 1, h: 1 }), /no text box with id/);
});

// --- setTextBoxContent ---------------------------------------------------------------

test('setTextBoxContent merges partial content overrides (§16)', () => {
  const a = box({ id: 'a', text: 'old', fontSizePt: 12, bold: false, align: 'left', rotationDeg: 0 });
  const result = setTextBoxContent([a], 'a', { text: 'new', bold: true });
  assert.equal(result[0].text, 'new');
  assert.equal(result[0].bold, true);
  assert.equal(result[0].fontSizePt, 12); // untouched field survives
  assert.equal(result[0].align, 'left');
});

test('setTextBoxContent throws for an unknown id', () => {
  assert.throws(() => setTextBoxContent([], 'missing', { text: 'x' }), /no text box with id/);
});

// --- deleteTextBoxes ---------------------------------------------------------------

test('deleteTextBoxes removes only the targeted boxes', () => {
  const a = box({ id: 'a' });
  const b = box({ id: 'b' });
  const result = deleteTextBoxes([a, b], ['a']);
  assert.deepEqual(result, [b]);
});

// --- duplicateTextBoxes ---------------------------------------------------------------

test('duplicateTextBoxes clones targeted boxes with fresh ids, offset position, and a raised z', () => {
  const a = box({ id: 'a', x: 0.1, y: 0.1, z: 0 });
  const result = duplicateTextBoxes([a], ['a']);
  assert.equal(result.length, 2);
  const clone = result[1];
  assert.notEqual(clone.id, 'a');
  assertClose(clone.x, 0.12);
  assertClose(clone.y, 0.12);
  assert.equal(clone.z, 1);
});

function assertClose(actual, expected, epsilon = 1e-9) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `expected ${actual} to be close to ${expected}`);
}

// --- Z-order ---------------------------------------------------------------

test('bringTextBoxForward swaps with the box immediately above; no-op if already topmost', () => {
  const a = box({ id: 'a', z: 0 });
  const b = box({ id: 'b', z: 1 });
  const result = bringTextBoxForward([a, b], 'a');
  assert.equal(result.find((x) => x.id === 'a').z, 1);
  assert.equal(result.find((x) => x.id === 'b').z, 0);

  const noop = bringTextBoxForward(result, 'a'); // 'a' now on top, already forward-most
  assert.deepEqual(noop.find((x) => x.id === 'a'), result.find((x) => x.id === 'a'));
});

test('sendTextBoxBackward swaps with the box immediately below; no-op if already bottommost', () => {
  const a = box({ id: 'a', z: 0 });
  const b = box({ id: 'b', z: 1 });
  const result = sendTextBoxBackward([a, b], 'b');
  assert.equal(result.find((x) => x.id === 'a').z, 1);
  assert.equal(result.find((x) => x.id === 'b').z, 0);
});

test('bringTextBoxToFront moves to the very top, others keep relative order', () => {
  const a = box({ id: 'a', z: 0 });
  const b = box({ id: 'b', z: 1 });
  const c = box({ id: 'c', z: 2 });
  const result = bringTextBoxToFront([a, b, c], 'a');
  assert.equal(result.find((x) => x.id === 'a').z, 2);
  assert.equal(result.find((x) => x.id === 'b').z, 0);
  assert.equal(result.find((x) => x.id === 'c').z, 1);
});

test('sendTextBoxToBack moves to the very bottom, others keep relative order', () => {
  const a = box({ id: 'a', z: 0 });
  const b = box({ id: 'b', z: 1 });
  const c = box({ id: 'c', z: 2 });
  const result = sendTextBoxToBack([a, b, c], 'c');
  assert.equal(result.find((x) => x.id === 'c').z, 0);
  assert.equal(result.find((x) => x.id === 'a').z, 1);
  assert.equal(result.find((x) => x.id === 'b').z, 2);
});

test('z-order ops throw for an unknown id', () => {
  assert.throws(() => bringTextBoxForward([], 'missing'), /no text box with id/);
});
