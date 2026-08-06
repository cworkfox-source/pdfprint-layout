// Text Box CRUD primitives (docs/plan.md §16, Phase 10). Pure `TextBox[]`
// array operations on one Page's `textBoxes` — no DOM, no store.js — same
// layering as free-layout.js's Slot[] primitives, deliberately NOT built on
// top of that file: a Text Box has no `locked`/`sourceId`/fit-mode concept,
// and its own z-order stays independent of Slot z-order (draw order between
// the two element kinds is a fixed "Slots then Text Boxes" per renderer, not
// an interleaved stack — see decision_log D-019). reducers.js wires these to
// `store.commit()`, mirroring free-layout.js's own wiring.

import { createTextBox } from './model.js';
import { sortByZOrder } from './geometry.js';

export function addTextBox(textBoxes, newBox) {
  return [...textBoxes, newBox];
}

export function moveTextBoxes(textBoxes, boxIds, dx, dy) {
  const idSet = new Set(boxIds);
  return textBoxes.map((box) => (idSet.has(box.id) ? { ...box, x: box.x + dx, y: box.y + dy } : box));
}

export function setTextBoxRect(textBoxes, boxId, rect) {
  const index = textBoxes.findIndex((b) => b.id === boxId);
  if (index === -1) throw new Error(`setTextBoxRect: no text box with id ${boxId}`);
  const next = [...textBoxes];
  next[index] = { ...next[index], x: rect.x, y: rect.y, w: rect.w, h: rect.h };
  return next;
}

// Merges a partial update into one Text Box's content properties (§16:
// "文字、字型、大小、粗體、對齊、旋轉") — same "merge, don't replace"
// convention as setCropMarksAction's project-level merge.
export function setTextBoxContent(textBoxes, boxId, overrides) {
  const index = textBoxes.findIndex((b) => b.id === boxId);
  if (index === -1) throw new Error(`setTextBoxContent: no text box with id ${boxId}`);
  const next = [...textBoxes];
  next[index] = { ...next[index], ...overrides };
  return next;
}

export function deleteTextBoxes(textBoxes, boxIds) {
  const idSet = new Set(boxIds);
  return textBoxes.filter((b) => !idSet.has(b.id));
}

export function duplicateTextBoxes(textBoxes, boxIds, { offsetX = 0.02, offsetY = 0.02 } = {}) {
  const idSet = new Set(boxIds);
  const targets = textBoxes.filter((b) => idSet.has(b.id));
  const maxZ = textBoxes.reduce((m, b) => Math.max(m, b.z), 0);
  const duplicates = targets.map((b, i) => createTextBox({
    ...b,
    id: undefined,
    x: b.x + offsetX,
    y: b.y + offsetY,
    z: maxZ + 1 + i,
  }));
  return [...textBoxes, ...duplicates];
}

// --- Z-order — same reassign-from-order approach as free-layout.js's Slot
// z-order ops, just targeting textBoxes' own independent z sequence.

function reassignZFromOrder(textBoxes, orderedIds) {
  const zById = new Map(orderedIds.map((id, i) => [id, i]));
  return textBoxes.map((b) => ({ ...b, z: zById.get(b.id) }));
}

function reorderTextBoxZ(textBoxes, boxId, label, reorderIds) {
  const orderedIds = sortByZOrder(textBoxes).map((b) => b.id);
  const pos = orderedIds.indexOf(boxId);
  if (pos === -1) throw new Error(`${label}: no text box with id ${boxId}`);
  return reassignZFromOrder(textBoxes, reorderIds(orderedIds, pos));
}

export function bringTextBoxForward(textBoxes, boxId) {
  return reorderTextBoxZ(textBoxes, boxId, 'bringTextBoxForward', (ids, pos) => {
    if (pos >= ids.length - 1) return ids;
    const next = [...ids];
    [next[pos], next[pos + 1]] = [next[pos + 1], next[pos]];
    return next;
  });
}

export function sendTextBoxBackward(textBoxes, boxId) {
  return reorderTextBoxZ(textBoxes, boxId, 'sendTextBoxBackward', (ids, pos) => {
    if (pos <= 0) return ids;
    const next = [...ids];
    [next[pos], next[pos - 1]] = [next[pos - 1], next[pos]];
    return next;
  });
}

export function bringTextBoxToFront(textBoxes, boxId) {
  return reorderTextBoxZ(textBoxes, boxId, 'bringTextBoxToFront', (ids, pos) => {
    const next = [...ids];
    const [id] = next.splice(pos, 1);
    next.push(id);
    return next;
  });
}

export function sendTextBoxToBack(textBoxes, boxId) {
  return reorderTextBoxZ(textBoxes, boxId, 'sendTextBoxToBack', (ids, pos) => {
    const next = [...ids];
    const [id] = next.splice(pos, 1);
    next.unshift(id);
    return next;
  });
}
