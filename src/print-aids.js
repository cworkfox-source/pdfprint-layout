// Print Aids — Bleed / Safe Area / Header / Footer / Page Number / Watermark
// (docs/plan.md §16, Phase 10). Same convention as print.js's Crop Marks
// section: PURE geometry only (no DOM, no pdf-lib) so Preview and Export
// both call these same functions and can never drift apart (§4.3). Text
// metrics (measured string width for center/right alignment) are NOT
// computed here — that needs a real font (Canvas in Preview, pdf-lib's
// StandardFonts in Export), so every text-positioning function below takes
// the already-measured width as a plain number and leaves "how wide is this
// string" to the caller, same split as computeFitScale() leaving "what is
// this Source's natural size" to its own caller.

import { compose, translate, rotateDeg } from './geometry.js';

// --- Bleed / Safe Area (§16) -----------------------------------------------
// One shared primitive: a positive `amount` expands a rect outward on all
// four sides (Bleed, at Export time only — the trim line/Crop Marks never
// move); a negative `amount` insets it (Safe Area, Preview-only guide).
// Clamped so a Safe Area inset can never invert width/height for a tiny
// Slot with an oversized margin.
export function offsetRect(rect, amount) {
  const w = Math.max(0, rect.w + amount * 2);
  const h = Math.max(0, rect.h + amount * 2);
  // Centered either way: the unclamped case reduces to x - amount / y -
  // amount; a clamped (w or h hit 0) case instead collapses to the rect's
  // own center point, rather than producing a negative-size rect.
  return {
    x: rect.x + (rect.w - w) / 2,
    y: rect.y + (rect.h - h) / 2,
    w,
    h,
  };
}

// §16 Bleed — the Slot's Export clip rect, expanded by `bleedPt` outward.
// Content position/fit-scale is deliberately computed against the
// UNEXPANDED Slot rect (only the clip boundary moves) — see decision_log
// D-019: a 'cover'-fit Slot already has overflow that this newly reveals,
// while a 'contain'-fit Slot has none to reveal, a known/documented
// limitation rather than an attempt to also rescale content into the bleed.
export function computeBleedExpandedRect(slotRect, bleedSize) {
  if (!(bleedSize > 0)) return slotRect;
  return offsetRect(slotRect, bleedSize);
}

// §16 Safe Area — PREVIEW-ONLY inset guide, `marginSize` inward from the
// Slot's trim edge. Never called by export.js/print.js (§16: "不列印、不匯出").
export function computeSafeAreaRect(slotRect, marginSize) {
  if (!(marginSize > 0)) return slotRect;
  return offsetRect(slotRect, -marginSize);
}

// --- Header / Footer / Page Number bands (§16) ------------------------------
// Header lives in the top margin band (between the paper's top edge and the
// content area), footer in the bottom margin band — both span the content
// area's full width. A zero-height band (zero margin) is valid input; text
// drawn into it will simply overlap the content area, which is the user's
// own margin choice to fix, not something this function should guard against.
export function computeHeaderFooterBandsPt(paperWidthPt, paperHeightPt, contentAreaPt) {
  return {
    header: { x: contentAreaPt.x, y: 0, w: contentAreaPt.width, h: contentAreaPt.y },
    footer: {
      x: contentAreaPt.x,
      y: contentAreaPt.y + contentAreaPt.height,
      w: contentAreaPt.width,
      h: paperHeightPt - (contentAreaPt.y + contentAreaPt.height),
    },
  };
}

// Vertically centers within `band`; horizontally anchors per `align` — the
// caller (which has the measured text width) still has to subtract that
// width for 'center'/'right' to get the actual left-edge draw x. Returned
// `align` is passed straight through so callers don't need a second switch.
export function computeTextAnchorInBand(band, align = 'left') {
  const y = band.y + band.h / 2;
  if (align === 'center') return { x: band.x + band.w / 2, y, align };
  if (align === 'right') return { x: band.x + band.w, y, align };
  return { x: band.x, y, align: 'left' };
}

// §16 Page Number "1 / 10" format — `{page}`/`{total}` token substitution.
export function formatPageNumber(format, pageNumber1Based, totalPages) {
  return format.replace('{page}', String(pageNumber1Based)).replace('{total}', String(totalPages));
}

// Page Number's 6 anchors (`'top'|'bottom'` x `'left'|'center'|'right'`)
// reuse the exact same header/footer bands + anchor-in-band math above —
// Page Number is just another piece of text that happens to live in the
// same margin bands, not a separate layout concept.
export function computePageNumberAnchorPt(position, paperWidthPt, paperHeightPt, contentAreaPt) {
  const [vert, horiz] = position.split('-');
  if (vert !== 'top' && vert !== 'bottom') {
    throw new Error(`computePageNumberAnchorPt: unknown position "${position}"`);
  }
  const bands = computeHeaderFooterBandsPt(paperWidthPt, paperHeightPt, contentAreaPt);
  return computeTextAnchorInBand(vert === 'top' ? bands.header : bands.footer, horiz);
}

// --- Watermark (§16) --------------------------------------------------------
// Page-center point, in the SAME space contentAreaPt is expressed in (pt for
// Export, content-area-relative px for Preview — this function is unit
// agnostic, same convention as offsetRect() above).
export function computeWatermarkCenterPt(contentAreaPt) {
  return { x: contentAreaPt.x + contentAreaPt.width / 2, y: contentAreaPt.y + contentAreaPt.height / 2 };
}

// Image watermark sizing (§16 "透明度、位置、角度、大小"): fits the image's
// width to `widthFraction` of the content area's width, preserving aspect
// ratio — deliberately simpler than Slot's computeFitScale() (contain/cover/
// stretch) since a watermark has no "box" to fit into, just a target width.
export function computeWatermarkImageSizePt(contentAreaWidthPt, naturalWidth, naturalHeight, widthFraction) {
  const width = contentAreaWidthPt * widthFraction;
  const scale = width / naturalWidth;
  return { width, height: naturalHeight * scale };
}

// Approximate distance a baseline sits BELOW a text run's own vertical
// center — used to vertically center text without real font-metrics access
// (no fontkit, D-019; StandardFonts' own ascent/descent aren't exposed as a
// simple ratio pdf-lib surfaces cheaply). 0.35x the font size matches common
// Latin font proportions closely enough for print-aid text, which is never
// the sole content on a page. Same constant computeTextAnchorInBand()'s
// callers apply for the (unrotated, high-level drawText) Header/Footer/Page
// Number path — this is its sibling for the (rotatable, low-level matrix)
// Text Box/Watermark path.
export const TEXT_BASELINE_OFFSET_FACTOR = 0.35;

// Where a text run's own local origin (baseline-left, PDF's native
// convention) must sit within a `boxWidth x boxHeight` box (content-local,
// Y-down, top-left origin — same convention as computeWatermarkMatrix()
// below) so the text lands left/center/right-aligned AND vertically
// centered in the box, regardless of how much taller the box is than the
// text itself. `textWidth` is the caller's own font-measured width (§16
// text metrics stay the renderer's job, per this file's header comment).
export function computeAlignedTextOrigin(boxWidth, boxHeight, textWidth, sizePt, align = 'left') {
  let x = 0;
  if (align === 'center') x = (boxWidth - textWidth) / 2;
  else if (align === 'right') x = boxWidth - textWidth;
  return { x, y: boxHeight / 2 + sizePt * TEXT_BASELINE_OFFSET_FACTOR };
}

// The watermark's placement matrix: centered at `centerPt`, rotated by
// `rotationDeg`, for content of `contentW x contentH` (model space, Y-down,
// top-left content origin — same convention slotContentMatrix() uses).
// Export composes `pdfPageFlipMatrix(paperHeightPt)` in front of this, same
// as every other content matrix (§6.2); Preview uses it directly.
export function computeWatermarkMatrix(centerPt, rotationDeg, contentW, contentH) {
  return compose(
    translate(centerPt.x, centerPt.y),
    rotateDeg(rotationDeg),
    translate(-contentW / 2, -contentH / 2),
  );
}
