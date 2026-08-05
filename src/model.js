// Data model factories (docs/plan.md §5). These build plain, serializable
// objects only — no DOM, no class instances, no behavior. §4.1 requires the
// Layout Model to be fully independent of the DOM; a factory returning a
// plain object is what makes that checkable.

import { paperSizePt, mmToPt } from './geometry.js';

export const SCHEMA_VERSION = 1;

function makeId(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

// §5.2 Source — a single PDF page, image, blank page, color fill, or (future)
// text box. `naturalWidth/Height` are in pt and already normalized for the
// source's own /Rotate (§14.3) — i.e. "as the user sees it", before any
// Slot-level `rotation` is applied.
export function createSource(overrides = {}) {
  if (!overrides.kind) {
    throw new Error('createSource requires a `kind`');
  }
  return {
    id: overrides.id ?? makeId('src'),
    kind: overrides.kind, // 'pdf-page' | 'image' | 'blank' | 'color' | 'text'
    fileName: overrides.fileName ?? null,
    pageIndex: overrides.pageIndex ?? null, // 0-based, kind === 'pdf-page'
    naturalWidth: overrides.naturalWidth ?? 0,
    naturalHeight: overrides.naturalHeight ?? 0,
    pageRotate: overrides.pageRotate ?? 0, // source PDF's own /Rotate
    cropBox: overrides.cropBox ?? null,
    mediaBox: overrides.mediaBox ?? null,
    thumbUrl: overrides.thumbUrl ?? null,
    // §12.3 — key into SourceBinaryStore for this Source's original file
    // bytes. Every page-Source parsed from the same PDF file shares one
    // docId (one set of original bytes per file, not per page); an
    // image Source's docId is its own id (1:1 file-to-source).
    docId: overrides.docId ?? null,
  };
}

// §5.3 Slot — a placement region on a page. Coordinates are normalized
// (0..1) relative to the page's content area (paper minus margins), NEVER
// screen pixels (§5.3 note) so one Template applies unchanged across paper
// sizes (§23.4).
export function createSlot(overrides = {}) {
  return {
    id: overrides.id ?? makeId('slot'),
    x: overrides.x ?? 0,
    y: overrides.y ?? 0,
    w: overrides.w ?? 0.5,
    h: overrides.h ?? 0.5,
    sourceId: overrides.sourceId ?? null,
    fitMode: overrides.fitMode ?? 'contain', // 'contain' | 'cover' | 'stretch'
    scale: overrides.scale ?? 1,
    rotation: overrides.rotation ?? 0, // 0 | 90 | 180 | 270 (or free angle, §15.2 [S])
    offsetX: overrides.offsetX ?? 0, // fraction of slot width (§6.4)
    offsetY: overrides.offsetY ?? 0, // fraction of slot height
    flipX: overrides.flipX ?? false,
    flipY: overrides.flipY ?? false,
    locked: overrides.locked ?? false,
    z: overrides.z ?? 0,
  };
}

// §8 paper settings, reused by both Page (can override) and Project (default).
export function createPaperSettings(overrides = {}) {
  return {
    size: overrides.size ?? 'A4', // 'A4' | 'A3' | 'Letter' | 'Legal' | 'custom'
    customWidthPt: overrides.customWidthPt ?? null, // only when size === 'custom'
    customHeightPt: overrides.customHeightPt ?? null,
    orientation: overrides.orientation ?? 'portrait', // 'portrait' | 'landscape'
    marginTopPt: overrides.marginTopPt ?? 0,
    marginBottomPt: overrides.marginBottomPt ?? 0,
    marginLeftPt: overrides.marginLeftPt ?? 0,
    marginRightPt: overrides.marginRightPt ?? 0,
    gapHorizontalPt: overrides.gapHorizontalPt ?? 0,
    gapVerticalPt: overrides.gapVerticalPt ?? 0,
  };
}

// Resolves a paper-settings object to concrete pt dimensions, going
// through the one geometry module (§4.3) rather than reimplementing the
// preset lookup / landscape swap here.
export function resolvePaperSizePt(paper) {
  if (paper.size === 'custom') {
    if (paper.customWidthPt == null || paper.customHeightPt == null) {
      throw new Error('custom paper size requires customWidthPt/customHeightPt');
    }
    return paper.orientation === 'landscape'
      ? { width: paper.customHeightPt, height: paper.customWidthPt }
      : { width: paper.customWidthPt, height: paper.customHeightPt };
  }
  return paperSizePt(paper.size, paper.orientation);
}

// §5.4 Page — one output sheet: paper settings (may just inherit Project's)
// plus its Slots.
export function createPage(overrides = {}) {
  return {
    id: overrides.id ?? makeId('page'),
    paper: overrides.paper ?? null, // null = inherit Project.paper
    slots: overrides.slots ?? [],
  };
}

// §5.4 / §21 Template — paper + margins + gap + slots ONLY, never a Source
// reference, so the same Template applies to any PDF/image set later.
export function createTemplate(overrides = {}) {
  if (!overrides.name) {
    throw new Error('createTemplate requires a `name`');
  }
  return {
    id: overrides.id ?? makeId('tmpl'),
    name: overrides.name,
    paper: overrides.paper ?? createPaperSettings(),
    slots: (overrides.slots ?? []).map((s) => stripSourceRef(s)),
  };
}

function stripSourceRef(slot) {
  const { sourceId, ...rest } = slot;
  return { ...rest, sourceId: null };
}

// §16 Crop Marks — length/gap/line-width are all plan.md-mandated [M]
// controls but plan.md names no defaults, so these three are a Phase 8
// judgment call (decision_log D-017): 5mm length, 3mm gap ("與內容距離",
// i.e. how far outside the Slot the mark starts — there is no Bleed
// concept in MVP, §16's Bleed row is [S]/second-stage, so this gap is the
// mark's only standoff from the Slot edge), 0.5pt line width (a visible
// but still hairline-weight stroke). Off by default — a Project with no
// print-aid needs should not gain marks on export/print just by existing.
export function createCropMarksSettings(overrides = {}) {
  return {
    enabled: overrides.enabled ?? false,
    lengthPt: overrides.lengthPt ?? mmToPt(5),
    gapPt: overrides.gapPt ?? mmToPt(3),
    lineWidthPt: overrides.lineWidthPt ?? 0.5,
  };
}

// §5.1 / §17.2 Project — the persisted unit (project.json). Carries
// schemaVersion so a future format change can migrate instead of silently
// dropping fields (§17.2).
export function createProject(overrides = {}) {
  return {
    schemaVersion: SCHEMA_VERSION,
    name: overrides.name ?? '未命名專案',
    paper: overrides.paper ?? createPaperSettings(),
    cropMarks: overrides.cropMarks ?? createCropMarksSettings(),
  };
}

// §5.1 AppState — the full in-memory application state. This is what
// store.js's history snapshots and what Preview/Export both read from;
// neither renderer may hold its own copy of any of this.
export function createAppState(overrides = {}) {
  return {
    project: overrides.project ?? createProject(),
    sources: overrides.sources ?? [],
    templates: overrides.templates ?? [],
    pages: overrides.pages ?? [createPage()],
    selection: overrides.selection ?? [],
  };
}
