// Preview Renderer (docs/plan.md §13, Phase 1 subset: §8 paper/margins, §42
// zoom, Canvas/DOM sizing). All the actual math — px sizing, zoom resolution,
// content-area rect — is DOM-free and unit-tested in preview.test.js; the
// DOM-touching functions here are thin adapters that only apply numbers
// geometry.js/this module already computed (§4.1: Layout Model vs DOM stay
// separate, so deleting the DOM and rebuilding it from state must be
// lossless).

import { resolvePaperSizePt } from './model.js';

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
