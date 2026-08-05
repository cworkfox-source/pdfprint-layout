// Source Placement (docs/plan.md §10.1/§10.2, Phase 5). Pure Slot[]-editing
// primitives for assigning/clearing a Slot's `sourceId` and adjusting its
// content transform (fitMode/scale/rotation/offset/flip) — same shape and
// conventions as free-layout.js's Phase 4 primitives (no DOM, no store.js;
// store.js wiring lives one layer up in reducers.js).
//
// The actual fit/rotate/offset/flip MATH (computeFitScale, slotContentMatrix)
// already lives in geometry.js (§6.3, written ahead of schedule in Phase 0)
// — this module only validates and writes the Slot fields that feed that
// matrix. Preview (and later Export) read those fields back out; nothing
// here touches rendering.
//
// Locked Slots (§10.3): plan.md only says locking blocks Move/Resize/Delete
// ("鎖定後不得 Move / Resize / Delete") — it does not mention content
// edits, so unlike free-layout.js's resize/delete, the functions below do
// NOT check `locked`. Documented here rather than guessed silently.

export const FIT_MODES = Object.freeze(['contain', 'cover', 'stretch']);

// §10.2 — "Rotation MVP 支援 0°/90°/180°/270°；[S] 任意角度".
export const MVP_ROTATIONS = Object.freeze([0, 90, 180, 270]);

function findSlotIndex(slots, slotId) {
  const index = slots.findIndex((s) => s.id === slotId);
  if (index === -1) throw new Error(`slot-content: no slot with id ${slotId}`);
  return index;
}

function updateSlot(slots, slotId, patch) {
  const index = findSlotIndex(slots, slotId);
  const next = [...slots];
  next[index] = { ...next[index], ...patch };
  return next;
}

// §10.1 — Source Gallery drag-into-Slot association. `sourceId: null` is a
// valid value (clears just the association; see clearSlotContent() below for
// clearing the whole transform back to defaults too).
export function setSlotSource(slots, slotId, sourceId) {
  return updateSlot(slots, slotId, { sourceId });
}

// §10.2 / §6.6 — Fit(Contain) / Fill(Cover) / Stretch.
export function setSlotFitMode(slots, slotId, fitMode) {
  if (!FIT_MODES.includes(fitMode)) {
    throw new Error(`setSlotFitMode: unknown fitMode ${fitMode} (expected one of ${FIT_MODES.join(', ')})`);
  }
  return updateSlot(slots, slotId, { fitMode });
}

// §10.2 — the extra multiplier on top of the fitMode-computed base scale
// (geometry.js's `scale * fitScale`, §6.3).
export function setSlotScale(slots, slotId, scale) {
  if (!(scale > 0)) throw new Error(`setSlotScale: scale must be a positive number, got ${scale}`);
  return updateSlot(slots, slotId, { scale });
}

function normalizeRotation(rotation) {
  return ((rotation % 360) + 360) % 360;
}

// §10.2 MVP — only 0/90/180/270 (accepts any input angle and normalizes it
// first, so e.g. -90 or 450 both resolve to a valid MVP value).
export function setSlotRotation(slots, slotId, rotation) {
  const normalized = normalizeRotation(rotation);
  if (!MVP_ROTATIONS.includes(normalized)) {
    throw new Error(`setSlotRotation: MVP only supports 0/90/180/270 (§10.2), got ${rotation}`);
  }
  return updateSlot(slots, slotId, { rotation: normalized });
}

// Convenience for a "rotate 90° CW/CCW" button — cycles within the MVP set.
export function rotateSlotContent(slots, slotId, deltaDeg = 90) {
  const slot = slots[findSlotIndex(slots, slotId)];
  return setSlotRotation(slots, slotId, slot.rotation + deltaDeg);
}

// §10.2 / §6.4 — offsetX/offsetY are fractions of the Slot's own width/height
// (not mm, not px), so a placement stays proportionally correct across
// paper sizes. No range clamp here: an offset that pushes content out of
// the Slot is a valid (if unusual) placement — clipping (§6.6) handles the
// visual result, not a validation error.
export function setSlotOffset(slots, slotId, offsetX, offsetY) {
  return updateSlot(slots, slotId, { offsetX, offsetY });
}

export function setSlotFlip(slots, slotId, flipX, flipY) {
  return updateSlot(slots, slotId, { flipX, flipY });
}

// §10.3 "清除內容" — removes the Source association AND resets the
// transform fields back to their model.js createSlot() defaults, so a
// freshly-placed new Source starts from a clean Fit/Scale/Rotation/Offset/
// Flip rather than inheriting the previous content's adjustments.
export function clearSlotContent(slots, slotId) {
  return updateSlot(slots, slotId, {
    sourceId: null,
    fitMode: 'contain',
    scale: 1,
    rotation: 0,
    offsetX: 0,
    offsetY: 0,
    flipX: false,
    flipY: false,
  });
}
