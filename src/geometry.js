// The ONE geometry module (docs/plan.md §4.3 / §6). Preview Renderer and
// Export Renderer must both go through these functions for every unit
// conversion, transform, fit calculation, and the PDF Y-axis flip — neither
// renderer may reimplement any of this itself. See decision_log D-002.

export const PT_PER_MM = 72 / 25.4;
export const PT_PER_IN = 72;
export const PT_PER_CM = PT_PER_MM * 10;

export function mmToPt(mm) {
  return mm * PT_PER_MM;
}

export function ptToMm(pt) {
  return pt / PT_PER_MM;
}

export function inToPt(inch) {
  return inch * PT_PER_IN;
}

export function cmToPt(cm) {
  return cm * PT_PER_CM;
}

// §6.1 — exact pt values for the preset papers.
export const PAPER_SIZES_PT = Object.freeze({
  A4: Object.freeze({ width: 595.276, height: 841.890 }),
  A3: Object.freeze({ width: 841.890, height: 1190.551 }),
  Letter: Object.freeze({ width: 612, height: 792 }),
  Legal: Object.freeze({ width: 612, height: 1008 }),
});

export function paperSizePt(name, orientation = 'portrait') {
  const base = PAPER_SIZES_PT[name];
  if (!base) throw new Error(`Unknown paper size: ${name}`);
  const { width, height } = base;
  return orientation === 'landscape'
    ? { width: height, height: width }
    : { width, height };
}

// §6.1 — round only at the PDF-writing boundary, never in intermediate math.
export function roundPt(value) {
  return Math.round(value * 1000) / 1000;
}

// --- 2D affine matrices -----------------------------------------------
// [a, b, c, d, e, f] represents
//   | a  c  e |
//   | b  d  f |
//   | 0  0  1 |
// applied as x' = a*x + c*y + e, y' = b*x + d*y + f.
// Same convention as CanvasRenderingContext2D.transform(a,b,c,d,e,f) and
// SVG's matrix(a,b,c,d,e,f), so the Preview Renderer can feed these values
// straight into Canvas without re-deriving them.

export function identity() {
  return [1, 0, 0, 1, 0, 0];
}

export function translate(tx, ty) {
  return [1, 0, 0, 1, tx, ty];
}

export function scaleXY(sx, sy) {
  return [sx, 0, 0, sy, 0, 0];
}

export function rotateDeg(deg) {
  const r = (deg * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  return [cos, sin, -sin, cos, 0, 0];
}

export function flipXY(flipX, flipY) {
  return [flipX ? -1 : 1, 0, 0, flipY ? -1 : 1, 0, 0];
}

// m1 ∘ m2: applies m2 first, then m1 (point' = m1 * (m2 * point)).
export function multiply(m1, m2) {
  const [a1, b1, c1, d1, e1, f1] = m1;
  const [a2, b2, c2, d2, e2, f2] = m2;
  return [
    a1 * a2 + c1 * b2,
    b1 * a2 + d1 * b2,
    a1 * c2 + c1 * d2,
    b1 * c2 + d1 * d2,
    a1 * e2 + c1 * f2 + e1,
    b1 * e2 + d1 * f2 + f1,
  ];
}

// compose(A, B, C) = A ∘ B ∘ C — reads left-to-right the same way the
// matrix is written mathematically; C is applied to the point first.
export function compose(...matrices) {
  return matrices.reduceRight((acc, m) => multiply(m, acc), identity());
}

export function applyToPoint(m, x, y) {
  const [a, b, c, d, e, f] = m;
  return { x: a * x + c * y + e, y: b * x + d * y + f };
}

// --- Fit calculation (§6.3, §6.6) --------------------------------------
//
// Scale (S) is applied to the content in its OWN local axes, before
// rotation (R). So when rotation is 90/270 the content's local x/y axes
// end up swapped relative to the slot's axes once rotated — the fit
// target dimensions must swap too, or a rotated wide image would be
// measured against the wrong slot axis. 180° does not change the
// bounding orientation, so it does not swap.
export function computeFitScale(contentW, contentH, slotW, slotH, fitMode, rotationDeg = 0) {
  const rot = ((rotationDeg % 360) + 360) % 360;
  const swapped = rot === 90 || rot === 270;
  const targetW = swapped ? slotH : slotW;
  const targetH = swapped ? slotW : slotH;

  switch (fitMode) {
    case 'contain': {
      const s = Math.min(targetW / contentW, targetH / contentH);
      return { sx: s, sy: s };
    }
    case 'cover': {
      const s = Math.max(targetW / contentW, targetH / contentH);
      return { sx: s, sy: s };
    }
    case 'stretch':
      return { sx: targetW / contentW, sy: targetH / contentH };
    default:
      throw new Error(`Unknown fitMode: ${fitMode}`);
  }
}

// --- The one slot-content matrix (§6.3) --------------------------------
// M = T(slotOrigin) · T(offset) · T(+slotCenter) · R(rotation)
//   · S(fitScale * scale) · F(flip) · T(-contentCenter)
export function slotContentMatrix({
  slotX,
  slotY,
  slotW,
  slotH,
  contentW,
  contentH,
  fitMode,
  scale = 1,
  rotation = 0,
  offsetX = 0,
  offsetY = 0,
  flipX = false,
  flipY = false,
}) {
  const { sx, sy } = computeFitScale(contentW, contentH, slotW, slotH, fitMode, rotation);
  return compose(
    translate(slotX, slotY),
    translate(offsetX * slotW, offsetY * slotH),
    translate(slotW / 2, slotH / 2),
    rotateDeg(rotation),
    scaleXY(sx * scale, sy * scale),
    flipXY(flipX, flipY),
    translate(-contentW / 2, -contentH / 2),
  );
}

export function boundingBoxOfTransformedRect(matrix, w, h) {
  const corners = [
    applyToPoint(matrix, 0, 0),
    applyToPoint(matrix, w, 0),
    applyToPoint(matrix, 0, h),
    applyToPoint(matrix, w, h),
  ];
  const xs = corners.map((p) => p.x);
  const ys = corners.map((p) => p.y);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

// --- PDF coordinate space (§6.2) ---------------------------------------
// The ONLY place the model's top-down Y axis flips to PDF's bottom-up Y
// axis. Nothing else in the codebase may do this conversion.
export function modelYToPdfY(modelY, elementHeightPt, paperHeightPt) {
  return paperHeightPt - modelY - elementHeightPt;
}

// --- Source /Rotate normalization (§14.3) -------------------------------
// 90/270 swap the natural width/height so `naturalWidth/Height` always
// mean "as the user actually sees the page", before any slot-level
// `rotation` (a separate, user-chosen rotation) is ever applied.
export function normalizeSourceDimensions(naturalWidth, naturalHeight, pdfRotate = 0) {
  const rot = ((pdfRotate % 360) + 360) % 360;
  if (rot === 90 || rot === 270) {
    return { width: naturalHeight, height: naturalWidth };
  }
  return { width: naturalWidth, height: naturalHeight };
}

// --- CropBox precedence (§13.5 / §14.4) --------------------------------
// Preview and Export must use the same bounding box for a PDF source page.
export function effectiveBoundingBox(source) {
  return source.cropBox ?? source.mediaBox;
}

// --- Z-order (§6.5) ------------------------------------------------------
// Stable sort by z ascending, ties broken by original array position.
// Preview and Export must draw slots in this exact order.
export function sortByZOrder(slots) {
  return slots
    .map((slot, index) => ({ slot, index }))
    .sort((a, b) => a.slot.z - b.slot.z || a.index - b.index)
    .map(({ slot }) => slot);
}
