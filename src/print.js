// Print Path (docs/plan.md §15, §16, Phase 8). Two independent pieces of
// content, both computed here as PURE functions (no pdf-lib import at
// module scope, same deps-injection split as export.js) with a pdf-lib-
// dependent orchestration section at the bottom:
//
//   1. Crop Marks (§16 [M]) — small L-shaped marks at each Slot's four
//      corners, drawn straight into exportProjectToPdf()'s output (export.js
//      imports computeCropMarksForSlot/cropMarkSegmentsToPdfSpace from this
//      file) so both "Export PDF" and "Print" share the exact same marks,
//      with no separate code path to drift out of sync (§23.6.2).
//
//   2. The Print Calibration Page (§15.3 [M]) — a standalone, Project-
//      independent single-page PDF with a precise 100mm x 100mm square the
//      user measures with a physical ruler after printing at "Actual Size"
//      to confirm the printer/driver isn't silently rescaling.
//
// §15.1's actual "Print" button is NOT a third rendering path: it just calls
// exportProjectToPdf() (the exact same function "Export PDF" calls) and
// opens the resulting bytes via the browser's built-in PDF viewer
// (export-adapters.js's openPdfBytesForPrint(), browser-only) — that
// identity is what makes §23.6.2 ("列印" and "匯出 PDF" byte-identical)
// trivially true, so there is nothing to compute for it here.

import { mmToPt, modelYToPdfY, paperSizePt } from './geometry.js';

// --- Crop Marks (§16) ------------------------------------------------------
// Judgment call (decision_log D-017): marks are drawn per-SLOT, not once
// around the page's outer edge — this is an imposition tool where each Slot
// is itself a separate piece the user will cut out of the printed sheet, so
// every Slot needs its own cut guides, not just the sheet as a whole.
//
// For each of the Slot's 4 corners this returns 2 line segments (one
// horizontal, one vertical) that start `gapPt` away from the corner — a
// clear standoff so the mark never touches the Slot's own trim edge — and
// extend a further `lengthPt` outward, away from the Slot. All coordinates
// are in MODEL space (top-left origin, Y-down, pt) — the same space
// computeSlotAbsoluteRectPt() returns — so this composes directly with
// export.js's existing per-Slot rect math; cropMarkSegmentsToPdfSpace()
// below does the one sanctioned Y-flip (§6.2) afterward.
export function computeCropMarksForSlot(slotAbsRectPt, cropMarks) {
  const { lengthPt: len, gapPt: gap } = cropMarks;
  const { x, y, w, h } = slotAbsRectPt;
  // dx/dy point AWAY from the Slot at each corner (model space, Y-down).
  const corners = [
    { cx: x, cy: y, dx: -1, dy: -1 }, // top-left
    { cx: x + w, cy: y, dx: 1, dy: -1 }, // top-right
    { cx: x, cy: y + h, dx: -1, dy: 1 }, // bottom-left
    { cx: x + w, cy: y + h, dx: 1, dy: 1 }, // bottom-right
  ];
  const segments = [];
  for (const { cx, cy, dx, dy } of corners) {
    segments.push({ x1: cx + dx * gap, y1: cy, x2: cx + dx * (gap + len), y2: cy }); // horizontal
    segments.push({ x1: cx, y1: cy + dy * gap, x2: cx, y2: cy + dy * (gap + len) }); // vertical
  }
  return segments;
}

// Converts a list of model-space line segments to PDF space (bottom-left
// origin, Y-up). Segments have zero "height" (they're points, not rects),
// so this is modelYToPdfY() with elementHeightPt=0 applied to each endpoint
// — no full matrix is needed since these lines are always axis-aligned and
// never rotated (crop marks track the Slot's rect, which per export.js's
// own convention is never itself rotated — only its CONTENT is).
export function cropMarkSegmentsToPdfSpace(segments, paperHeightPt) {
  return segments.map((seg) => ({
    x1: seg.x1,
    y1: modelYToPdfY(seg.y1, 0, paperHeightPt),
    x2: seg.x2,
    y2: modelYToPdfY(seg.y2, 0, paperHeightPt),
  }));
}

// --- Print Calibration Page (§15.3) ----------------------------------------
// Fixed layout constants. The calibration page is intentionally NOT tied to
// the current Project's paper size — it's a one-off device/driver test, and
// always fits comfortably on A4 (see exportCalibrationPagePdf() below).
export const CALIBRATION_SQUARE_SIZE_PT = mmToPt(100);
export const CALIBRATION_TICK_INTERVAL_PT = mmToPt(10);
export const CALIBRATION_TICK_LENGTH_PT = mmToPt(2);
export const CALIBRATION_MARGIN_PT = mmToPt(20);

// Pure geometry for the calibration page: the 100mm square's rect (model
// space) plus a set of 2mm tick marks every 10mm along its top and left
// edges (a visual ruler so a partial misprint is easy to spot even before
// reaching for a physical ruler). Throws if the fixed layout doesn't fit the
// given paper (a defensive check, not expected to fire for the fixed A4
// page exportCalibrationPagePdf() always uses).
export function computeCalibrationPageContent(paperWidthPt, paperHeightPt) {
  const size = CALIBRATION_SQUARE_SIZE_PT;
  const originX = CALIBRATION_MARGIN_PT;
  const originY = CALIBRATION_MARGIN_PT;
  if (originX + size + CALIBRATION_MARGIN_PT > paperWidthPt || originY + size + CALIBRATION_MARGIN_PT > paperHeightPt) {
    throw new Error('computeCalibrationPageContent: the fixed 100mm calibration layout does not fit the given paper size');
  }

  const squareRectModel = { x: originX, y: originY, w: size, h: size };
  const ticks = [];
  for (let i = 0; i <= 10; i += 1) {
    const offset = i * CALIBRATION_TICK_INTERVAL_PT;
    // top-edge tick: short vertical stroke just above the square's top edge
    ticks.push({
      x1: originX + offset, y1: originY - CALIBRATION_TICK_LENGTH_PT,
      x2: originX + offset, y2: originY,
    });
    // left-edge tick: short horizontal stroke just left of the square's left edge
    ticks.push({
      x1: originX - CALIBRATION_TICK_LENGTH_PT, y1: originY + offset,
      x2: originX, y2: originY + offset,
    });
  }
  return { squareRectModel, ticks };
}

// --- pdf-lib-dependent orchestration --------------------------------------
// Same deps-injection convention as export.js: `deps.pdfLib` is the injected
// PDFLib module namespace, so this stays Node-testable via a fake and loads
// fine before vendor/pdf-lib has been fetched.

// §15.3 — produces a standalone single-page PDF (always A4 portrait,
// independent of any Project) with the 100mm test square, its tick-mark
// ruler, and English-only instructional text. English, not Chinese, is a
// deliberate Phase 8 scope decision (decision_log D-017): pdf-lib's
// StandardFonts have no CJK glyphs, and embedding a CJK subset needs
// `fontkit`, which plan.md §16 explicitly defers to the second stage — so
// this page's text stays ASCII rather than pulling that dependency in early
// for one calibration page.
export async function exportCalibrationPagePdf(deps) {
  const { pdfLib } = deps;
  if (!pdfLib) throw new Error('exportCalibrationPagePdf requires deps.pdfLib');

  const { width, height } = paperSizePt('A4', 'portrait');
  const outDoc = await pdfLib.PDFDocument.create();
  const outPage = outDoc.addPage([width, height]);
  const font = await outDoc.embedFont(pdfLib.StandardFonts.Helvetica);
  const black = pdfLib.rgb(0, 0, 0);

  const { squareRectModel, ticks } = computeCalibrationPageContent(width, height);
  const squareRectPdf = {
    x: squareRectModel.x,
    y: modelYToPdfY(squareRectModel.y, squareRectModel.h, height),
    w: squareRectModel.w,
    h: squareRectModel.h,
  };

  outPage.drawRectangle({
    x: squareRectPdf.x,
    y: squareRectPdf.y,
    width: squareRectPdf.w,
    height: squareRectPdf.h,
    borderColor: black,
    borderWidth: 1,
  });

  for (const tick of ticks) {
    const y1 = modelYToPdfY(tick.y1, 0, height);
    const y2 = modelYToPdfY(tick.y2, 0, height);
    outPage.drawLine({ start: { x: tick.x1, y: y1 }, end: { x: tick.x2, y: y2 }, thickness: 0.5, color: black });
  }

  const textY1 = modelYToPdfY(squareRectModel.y - mmToPt(10), 0, height);
  const textY2 = modelYToPdfY(squareRectModel.y - mmToPt(5), 0, height);
  outPage.drawText('Print Calibration Page - print at 100% / Actual Size (disable "Fit to Page")', {
    x: squareRectModel.x, y: textY1, size: 10, font, color: black,
  });
  outPage.drawText('Measure the square below: it must be exactly 100mm x 100mm on both edges.', {
    x: squareRectModel.x, y: textY2, size: 10, font, color: black,
  });

  return outDoc.save();
}
