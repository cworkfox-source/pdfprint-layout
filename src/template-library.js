// Template Library (docs/plan.md §17.3 [S], Phase 10) — a small built-in
// collection of ready-made Templates, generated at MODULE LOAD time from the
// same pure §9 Layout Engine presets (layout.js) and §17.3 Template factory
// (model.js) every user-created Template goes through — no separate
// hand-authored geometry, so these can never drift from what "apply this
// preset yourself" would produce for the same paper/margins/gap.
//
// The 4 examples named in §22.1's Phase 10 line (`A4_上2下1`、`A4_照片4格`、
// `A3_6格`、`證件照8格`) are what this builds; margins/gaps for each are a
// Phase 10 judgment call (decision_log D-019) — plan.md names the preset
// shapes, not specific pt values. 證件照8格 (ID Photo 8-up) is a plain even
// 4x2 grid, NOT laid out at real 1-inch/2-inch ID-photo physical dimensions
// — an intentional simplification, noted as a known gap rather than a
// silent approximation.

import { createTemplate, createPaperSettings } from './model.js';
import { mmToPt } from './geometry.js';
import { generatePresetSlots, generateGridSlots, createSlotsFromRects } from './layout.js';
import { computeContentAreaPt } from './preview.js';

function contentAreaArgsFor(paper) {
  const contentAreaPt = computeContentAreaPt(paper);
  return {
    contentAreaWidthPt: contentAreaPt.width,
    contentAreaHeightPt: contentAreaPt.height,
    gapHorizontalPt: paper.gapHorizontalPt,
    gapVerticalPt: paper.gapVerticalPt,
  };
}

function buildTemplate(name, paper, presetId) {
  const rects = generatePresetSlots(presetId, contentAreaArgsFor(paper));
  return createTemplate({ name, paper, slots: createSlotsFromRects(rects) });
}

// 證件照8格 (ID Photo 8-up) needs an 8-cell grid, which isn't one of §9.1's
// named presets (only 1/2/4/6/9/16-up are) — built via generateGridSlots()
// directly (rows x cols), the SAME primitive §9.2's custom-grid feature
// uses, rather than inventing a new named preset id.
function buildGridTemplate(name, paper, rows, cols) {
  const rects = generateGridSlots({ rows, cols, ...contentAreaArgsFor(paper) });
  return createTemplate({ name, paper, slots: createSlotsFromRects(rects) });
}

const A4_MARGIN_PT = mmToPt(15);
const A3_MARGIN_PT = mmToPt(15);
const GAP_PT = mmToPt(4);

function a4Paper(overrides = {}) {
  return createPaperSettings({
    size: 'A4', orientation: 'portrait',
    marginTopPt: A4_MARGIN_PT, marginBottomPt: A4_MARGIN_PT, marginLeftPt: A4_MARGIN_PT, marginRightPt: A4_MARGIN_PT,
    gapHorizontalPt: GAP_PT, gapVerticalPt: GAP_PT,
    ...overrides,
  });
}

function a3Paper(overrides = {}) {
  return createPaperSettings({
    size: 'A3', orientation: 'portrait',
    marginTopPt: A3_MARGIN_PT, marginBottomPt: A3_MARGIN_PT, marginLeftPt: A3_MARGIN_PT, marginRightPt: A3_MARGIN_PT,
    gapHorizontalPt: GAP_PT, gapVerticalPt: GAP_PT,
    ...overrides,
  });
}

// Built fresh (not memoized) each time getBuiltInTemplates() is called, so
// callers that mutate a returned Template's own fields (e.g. renaming it
// via "Save As") never corrupt the library's own defaults for later callers.
export function getBuiltInTemplates() {
  const idPhotoMargin = mmToPt(10);
  return [
    buildTemplate('A4_上2下1', a4Paper(), 'top2-bottom1'),
    buildTemplate('A4_照片4格', a4Paper(), '4up'),
    buildTemplate('A3_6格', a3Paper(), '6up-3x2'),
    buildGridTemplate(
      '證件照8格',
      a4Paper({ marginTopPt: idPhotoMargin, marginBottomPt: idPhotoMargin, marginLeftPt: idPhotoMargin, marginRightPt: idPhotoMargin }),
      2, 4,
    ),
  ];
}
