import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveShortcut, nudgeDelta, NUDGE_STEP_NORMALIZED, NUDGE_STEP_LARGE_NORMALIZED } from './keymap.js';

test('resolveShortcut: Delete/Backspace both resolve to delete', () => {
  assert.deepEqual(resolveShortcut({ key: 'Delete' }), { type: 'delete' });
  assert.deepEqual(resolveShortcut({ key: 'Backspace' }), { type: 'delete' });
});

test('resolveShortcut: Ctrl+Z is undo, Ctrl+Y and Ctrl+Shift+Z are both redo', () => {
  assert.deepEqual(resolveShortcut({ key: 'z', ctrlKey: true }), { type: 'undo' });
  assert.deepEqual(resolveShortcut({ key: 'y', ctrlKey: true }), { type: 'redo' });
  assert.deepEqual(resolveShortcut({ key: 'Z', ctrlKey: true, shiftKey: true }), { type: 'redo' });
});

test('resolveShortcut: metaKey (Cmd on macOS) fills the same role as ctrlKey', () => {
  assert.deepEqual(resolveShortcut({ key: 'c', metaKey: true }), { type: 'copy' });
  assert.deepEqual(resolveShortcut({ key: 'a', metaKey: true }), { type: 'selectAll' });
});

test('resolveShortcut: Ctrl+C / Ctrl+V / Ctrl+A resolve to copy/paste/selectAll', () => {
  assert.deepEqual(resolveShortcut({ key: 'c', ctrlKey: true }), { type: 'copy' });
  assert.deepEqual(resolveShortcut({ key: 'v', ctrlKey: true }), { type: 'paste' });
  assert.deepEqual(resolveShortcut({ key: 'a', ctrlKey: true }), { type: 'selectAll' });
});

test('resolveShortcut: a bare "c"/"v"/"a" (no modifier) is NOT a shortcut — must not swallow normal typing', () => {
  assert.equal(resolveShortcut({ key: 'c' }), null);
  assert.equal(resolveShortcut({ key: 'v' }), null);
  assert.equal(resolveShortcut({ key: 'a' }), null);
});

test('resolveShortcut: Arrow keys nudge, Shift+Arrow is the "large" variant', () => {
  assert.deepEqual(resolveShortcut({ key: 'ArrowLeft' }), { type: 'nudge', direction: 'left', large: false });
  assert.deepEqual(resolveShortcut({ key: 'ArrowRight', shiftKey: true }), { type: 'nudge', direction: 'right', large: true });
  assert.deepEqual(resolveShortcut({ key: 'ArrowUp' }), { type: 'nudge', direction: 'up', large: false });
  assert.deepEqual(resolveShortcut({ key: 'ArrowDown' }), { type: 'nudge', direction: 'down', large: false });
});

test('resolveShortcut: an unrecognized key resolves to null', () => {
  assert.equal(resolveShortcut({ key: 'F5' }), null);
  assert.equal(resolveShortcut({ key: 'Enter' }), null);
});

test('nudgeDelta: small step in each of the 4 directions', () => {
  assert.deepEqual(nudgeDelta('left'), { dx: -NUDGE_STEP_NORMALIZED, dy: 0 });
  assert.deepEqual(nudgeDelta('right'), { dx: NUDGE_STEP_NORMALIZED, dy: 0 });
  assert.deepEqual(nudgeDelta('up'), { dx: 0, dy: -NUDGE_STEP_NORMALIZED });
  assert.deepEqual(nudgeDelta('down'), { dx: 0, dy: NUDGE_STEP_NORMALIZED });
});

test('nudgeDelta: large=true uses the 10x large step', () => {
  assert.deepEqual(nudgeDelta('right', true), { dx: NUDGE_STEP_LARGE_NORMALIZED, dy: 0 });
});

test('nudgeDelta: throws for an unknown direction', () => {
  assert.throws(() => nudgeDelta('diagonal'), /unknown direction/);
});
