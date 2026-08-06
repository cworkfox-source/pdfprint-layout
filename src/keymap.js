// Keyboard Shortcuts (docs/plan.md §18.3, Phase 10). Pure — resolveShortcut()
// maps a keyboard event's essential fields to a semantic action descriptor;
// no `addEventListener` lives here (that DOM binding is the dev harness's/
// future app shell's own thin adapter, same split as preview.js's pure math
// vs DOM adapters, §4.1). `nudgeDelta()` is likewise pure: the actual
// normalized step size is a fixed constant here, but WHERE that delta gets
// applied (which Slot(s)/Text Box(es), current selection) is entirely the
// caller's job — this module has no concept of AppState.

// `event` only needs to duck-type a KeyboardEvent's 4 relevant fields, so
// this is trivially unit-testable with a plain object, no DOM required.
export function resolveShortcut({ key, ctrlKey = false, metaKey = false, shiftKey = false }) {
  const mod = ctrlKey || metaKey; // Cmd on macOS fills the same "primary modifier" role Ctrl does elsewhere

  if (key === 'Delete' || key === 'Backspace') return { type: 'delete' };
  if (mod && !shiftKey && (key === 'z' || key === 'Z')) return { type: 'undo' };
  // Both Ctrl+Y (Windows convention) and Ctrl+Shift+Z (Mac/many web apps'
  // convention) resolve to redo — §18.3 only lists "Ctrl+Y" but a single
  // fixed binding would be a worse UX gap than covering both.
  if (mod && ((key === 'y' || key === 'Y') || (shiftKey && (key === 'z' || key === 'Z')))) return { type: 'redo' };
  if (mod && (key === 'c' || key === 'C')) return { type: 'copy' };
  if (mod && (key === 'v' || key === 'V')) return { type: 'paste' };
  if (mod && (key === 'a' || key === 'A')) return { type: 'selectAll' };
  if (key === 'ArrowLeft') return { type: 'nudge', direction: 'left', large: shiftKey };
  if (key === 'ArrowRight') return { type: 'nudge', direction: 'right', large: shiftKey };
  if (key === 'ArrowUp') return { type: 'nudge', direction: 'up', large: shiftKey };
  if (key === 'ArrowDown') return { type: 'nudge', direction: 'down', large: shiftKey };
  return null;
}

// §18.3 "Arrow 微移 / Shift+Arrow 大幅微移" — plan.md names no step sizes, so
// these are a Phase 10 judgment call (decision_log D-019): a 0.2% content-
// area microstep, 10x (2%) with Shift. Normalized (same 0..1 space Slot/
// TextBox x/y/w/h use, §5.3) so the step is independent of zoom/paper size.
export const NUDGE_STEP_NORMALIZED = 0.002;
export const NUDGE_STEP_LARGE_NORMALIZED = 0.02;

export function nudgeDelta(direction, large = false) {
  const step = large ? NUDGE_STEP_LARGE_NORMALIZED : NUDGE_STEP_NORMALIZED;
  switch (direction) {
    case 'left': return { dx: -step, dy: 0 };
    case 'right': return { dx: step, dy: 0 };
    case 'up': return { dx: 0, dy: -step };
    case 'down': return { dx: 0, dy: step };
    default: throw new Error(`nudgeDelta: unknown direction "${direction}"`);
  }
}
