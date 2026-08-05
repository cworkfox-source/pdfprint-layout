// Preview Renderer (docs/plan.md §13, Phase 1 subset: §8 paper/margins, §42
// zoom, Canvas/DOM sizing). All the actual math — px sizing, zoom resolution,
// content-area rect — is DOM-free and unit-tested in preview.test.js; the
// DOM-touching functions here are thin adapters that only apply numbers
// geometry.js/this module already computed (§4.1: Layout Model vs DOM stay
// separate, so deleting the DOM and rebuilding it from state must be
// lossless).

import { resolvePaperSizePt } from './model.js';
import { sortByZOrder } from './geometry.js';

// Preview-only convention: at zoom 1.0, 1pt = 1 CSS px. This is purely a
// Preview Renderer choice — Export (pdf-lib) never sees pixels, only pt
// (§6.1), so changing this later cannot affect exported output (§23.2.4).
export const PX_PER_PT_AT_ZOOM_1 = 1;

const NAMED_ZOOM_PRESETS = {
  '25%': 0.25,
  '50%': 0.5,
  '75%': 0.75,
  '100%': 1,
  '150%': 1.5,
  '200%': 2,
};

// §42 — resolves a zoom preset (named % or 'fit-page' / 'fit-width') plus a
// raw numeric zoom, against the container size actually available.
export function resolveZoom(preset, { containerWidthPx, containerHeightPx, paperWidthPt, paperHeightPt }) {
  if (typeof preset === 'number') {
    if (!(preset > 0)) throw new Error(`zoom must be a positive number, got ${preset}`);
    return preset;
  }
  if (preset in NAMED_ZOOM_PRESETS) {
    return NAMED_ZOOM_PRESETS[preset];
  }
  if (preset === 'fit-page') {
    const byWidth = containerWidthPx / (paperWidthPt * PX_PER_PT_AT_ZOOM_1);
    const byHeight = containerHeightPx / (paperHeightPt * PX_PER_PT_AT_ZOOM_1);
    return Math.min(byWidth, byHeight);
  }
  if (preset === 'fit-width') {
    return containerWidthPx / (paperWidthPt * PX_PER_PT_AT_ZOOM_1);
  }
  throw new Error(`Unknown zoom preset: ${preset}`);
}

// §8.3 — content area is the paper minus the four margins, in pt, BEFORE
// any zoom is applied. Slot normalized coordinates (§5.3) are relative to
// this rect, not the full paper.
export function computeContentAreaPt(paper) {
  const { width, height } = resolvePaperSizePt(paper);
  const x = paper.marginLeftPt;
  const y = paper.marginTopPt;
  const w = width - paper.marginLeftPt - paper.marginRightPt;
  const h = height - paper.marginTopPt - paper.marginBottomPt;
  if (w <= 0 || h <= 0) {
    throw new Error('Margins leave zero or negative content area');
  }
  return { x, y, width: w, height: h };
}

// Full Phase-1 layout: paper size + content area, in both pt and preview
// px at the given zoom. This is the one function both a Canvas-based and a
// DOM-based Preview implementation would call — §23.2's "A4 Canvas 比例正確"
// and "mm 計算正確" are properties of this function's output, not of
// whatever actually draws it.
export function computePaperPreviewLayout(paper, zoom) {
  const sizePt = resolvePaperSizePt(paper);
  const contentPt = computeContentAreaPt(paper);
  const pxPerPt = PX_PER_PT_AT_ZOOM_1 * zoom;

  return {
    zoom,
    paperPt: sizePt,
    contentAreaPt: contentPt,
    paperPx: {
      width: sizePt.width * pxPerPt,
      height: sizePt.height * pxPerPt,
    },
    contentAreaPx: {
      x: contentPt.x * pxPerPt,
      y: contentPt.y * pxPerPt,
      width: contentPt.width * pxPerPt,
      height: contentPt.height * pxPerPt,
    },
  };
}

// --- DOM adapters --------------------------------------------------------
// Thin on purpose: every number here already came from
// computePaperPreviewLayout(). No layout math belongs below this line.

export function renderPaper(container, layout) {
  let paperEl = container.querySelector(':scope > .pl-paper');
  if (!paperEl) {
    paperEl = document.createElement('div');
    paperEl.className = 'pl-paper';
    const contentEl = document.createElement('div');
    contentEl.className = 'pl-content-area';
    paperEl.appendChild(contentEl);
    container.appendChild(paperEl);
  }

  paperEl.style.position = 'relative';
  paperEl.style.width = `${layout.paperPx.width}px`;
  paperEl.style.height = `${layout.paperPx.height}px`;
  paperEl.style.background = '#fff';
  paperEl.style.boxShadow = '0 0 0 1px rgba(0,0,0,0.2)';

  const contentEl = paperEl.querySelector(':scope > .pl-content-area');
  contentEl.style.position = 'absolute';
  contentEl.style.left = `${layout.contentAreaPx.x}px`;
  contentEl.style.top = `${layout.contentAreaPx.y}px`;
  contentEl.style.width = `${layout.contentAreaPx.width}px`;
  contentEl.style.height = `${layout.contentAreaPx.height}px`;
  contentEl.style.outline = '1px dashed rgba(0,100,255,0.6)';

  return paperEl;
}

// §13.1 — a Slot's Normalized rect (§5.3, 0..1 relative to the content
// area) converted to content-area-relative preview px. Pure so it's
// unit-testable without a DOM; Export will one day need the pt equivalent
// of this same idea, but that's a separate function per §4.3 (this one is
// Preview-only, px, and never consulted by Export).
export function computeSlotPx(slot, contentAreaWidthPx, contentAreaHeightPx) {
  return {
    x: slot.x * contentAreaWidthPx,
    y: slot.y * contentAreaHeightPx,
    width: slot.w * contentAreaWidthPx,
    height: slot.h * contentAreaHeightPx,
  };
}

// DOM adapter: draws one outlined box per Slot inside the content-area
// element renderPaper() created. Rebuilds the `.pl-slot` children from
// scratch on every call rather than diffing — Phase 3/4 change the slot
// list wholesale often enough (new preset, split/merge) that reuse isn't
// worth the bookkeeping yet. Draw order follows §6.5's shared
// sortByZOrder() — the same function Export will use — not array order.
export function renderSlots(contentEl, slots, contentAreaWidthPx, contentAreaHeightPx) {
  for (const el of contentEl.querySelectorAll(':scope > .pl-slot')) el.remove();

  for (const slot of sortByZOrder(slots)) {
    const { x, y, width, height } = computeSlotPx(slot, contentAreaWidthPx, contentAreaHeightPx);
    const el = document.createElement('div');
    el.className = 'pl-slot';
    el.dataset.slotId = slot.id;
    el.style.position = 'absolute';
    el.style.boxSizing = 'border-box';
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.width = `${width}px`;
    el.style.height = `${height}px`;
    el.style.outline = '1px solid rgba(200,0,0,0.85)';
    el.style.background = 'rgba(200,0,0,0.05)';
    contentEl.appendChild(el);
  }
  return contentEl;
}

// §35/§36 — the ONE place `@page size` is set, so the browser's native
// print dialog reproduces the same paper size Preview/Export use. mm here
// only because CSS @page doesn't accept `pt` reliably across browsers;
// convert right at this boundary, not anywhere else.
export function applyPrintPageSize(paperWidthPt, paperHeightPt, doc = document) {
  const mm = (pt) => (pt / 72) * 25.4;
  let styleEl = doc.getElementById('pl-print-page-size');
  if (!styleEl) {
    styleEl = doc.createElement('style');
    styleEl.id = 'pl-print-page-size';
    doc.head.appendChild(styleEl);
  }
  styleEl.textContent = `@page { size: ${mm(paperWidthPt).toFixed(2)}mm ${mm(paperHeightPt).toFixed(2)}mm; margin: 0; }`;
  return styleEl;
}
