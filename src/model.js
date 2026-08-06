// Data model factories (docs/plan.md §5). These build plain, serializable
// objects only — no DOM, no class instances, no behavior. §4.1 requires the
// Layout Model to be fully independent of the DOM; a factory returning a
// plain object is what makes that checkable.

import { paperSizePt, mmToPt } from './geometry.js';

// v1 -> v2: Project gained `cropMarks` (Phase 8, §16) — bumped here because
// that addition shipped without a version bump at the time, which is
// exactly the "silently changed shape under the same version number" §17.2
// warns against. See decision_log D-018 and project-file.js's migration.
// v2 -> v3: Project gained `bleed`/`safeArea`/`headerFooter`/`pageNumber`/
// `watermark` (Phase 10, §16) and Page gained `textBoxes` — see decision_log
// D-019 and project-file.js's migration.
export const SCHEMA_VERSION = 3;

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
    kind: overrides.kind, // 'pdf-page' | 'image' | 'svg' | 'blank' | 'color' | 'text'
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
    // §17.1 Source Metadata's "雜湊" (hash) field — a SHA-256 hex digest of
    // the ORIGINAL FILE's bytes (src/hash.js), computed once at load time
    // and saved in the project JSON (never the bytes themselves, per
    // §17.1's "Source 二進位不內嵌"). Used on project reload to confirm a
    // user-reselected file is really the same one, not just a same-named/
    // same-sized coincidence (Phase 9, decision_log D-018).
    contentHash: overrides.contentHash ?? null,
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

// §16 Text Box — a page-level annotation element (Phase 10), NOT a Source
// placed in a Slot: text layout (wrap/align at a fixed font size) has
// different fit semantics than an image/PDF page being scaled to fill a
// box, so it gets its own array on Page rather than reusing
// slotContentMatrix()'s fit-scale pipeline. §5.2 already reserves a `'text'`
// Source `kind` for a *future*, still-unbuilt idea (a typed-text page used
// AS one of the imposed source pages, like `blank`/`color`) — that is a
// different feature from this one and stays unimplemented; see decision_log
// D-019. Coordinates are normalized (0..1) relative to the content area,
// same convention as Slot (§5.3), so one Template's text boxes also survive
// a paper-size change unchanged.
export function createTextBox(overrides = {}) {
  return {
    id: overrides.id ?? makeId('text'),
    x: overrides.x ?? 0,
    y: overrides.y ?? 0,
    w: overrides.w ?? 0.3,
    h: overrides.h ?? 0.1,
    text: overrides.text ?? '',
    fontSizePt: overrides.fontSizePt ?? 12,
    bold: overrides.bold ?? false,
    align: overrides.align ?? 'left', // 'left' | 'center' | 'right'
    rotationDeg: overrides.rotationDeg ?? 0,
    z: overrides.z ?? 0,
  };
}

// §5.4 Page — one output sheet: paper settings (may just inherit Project's)
// plus its Slots and (Phase 10) Text Boxes.
export function createPage(overrides = {}) {
  return {
    id: overrides.id ?? makeId('page'),
    paper: overrides.paper ?? null, // null = inherit Project.paper
    slots: overrides.slots ?? [],
    textBoxes: overrides.textBoxes ?? [],
  };
}

// §5.4 / §21 Template — paper + margins + gap + slots + text boxes ONLY,
// never a Source reference, so the same Template applies to any PDF/image
// set later.
export function createTemplate(overrides = {}) {
  if (!overrides.name) {
    throw new Error('createTemplate requires a `name`');
  }
  return {
    id: overrides.id ?? makeId('tmpl'),
    name: overrides.name,
    paper: overrides.paper ?? createPaperSettings(),
    slots: (overrides.slots ?? []).map((s) => stripSourceRef(s)),
    textBoxes: (overrides.textBoxes ?? []).map((t) => createTextBox({ ...t, id: undefined })),
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

// §16 Bleed 出血 (Phase 10) — expands every Slot's paint/clip rect outward
// by `sizePt` on all four sides at Export/Print time; the trim line (and
// Crop Marks, which still mark the ORIGINAL Slot rect) does not move. Off
// by default, same "must opt in" convention as Crop Marks. `sizePt` rather
// than a fixed enum: the UI offers 0/1/2/3mm presets plus 自訂 (custom),
// but the model only needs one resolved point value (decision_log D-019).
export function createBleedSettings(overrides = {}) {
  return {
    enabled: overrides.enabled ?? false,
    sizePt: overrides.sizePt ?? mmToPt(3),
  };
}

// §16 Safe Area (Phase 10) — a PREVIEW-ONLY inset guide, `marginPt` inward
// from each Slot's trim edge (never drawn by Export or Print — §16's own
// wording: "僅畫面預覽，不列印、不匯出"). 5mm default is a Phase 10 judgment
// call (decision_log D-019), not spec-mandated.
export function createSafeAreaSettings(overrides = {}) {
  return {
    enabled: overrides.enabled ?? false,
    marginPt: overrides.marginPt ?? mmToPt(5),
  };
}

// §16 Header / Footer (Phase 10) — plain text content drawn once per page,
// centered in the top/bottom margin band. ASCII-only for now (decision_log
// D-019 — no fontkit yet, ties to the user's Phase 10 scoping decision).
export function createHeaderFooterSettings(overrides = {}) {
  return {
    header: { enabled: false, text: '', align: 'center', ...overrides.header },
    footer: { enabled: false, text: '', align: 'center', ...overrides.footer },
    fontSizePt: overrides.fontSizePt ?? 9,
  };
}

// §16 Page Number (Phase 10) — supports the "1 / 10" (page / total) format
// via `{page}`/`{total}` tokens in `format`, drawn at one of 6 page-corner/
// edge anchors within the margin band.
export function createPageNumberSettings(overrides = {}) {
  return {
    enabled: overrides.enabled ?? false,
    format: overrides.format ?? '{page} / {total}',
    position: overrides.position ?? 'bottom-center', // 'bottom-left'|'bottom-center'|'bottom-right'|'top-left'|'top-center'|'top-right'
    fontSizePt: overrides.fontSizePt ?? 9,
  };
}

// §16 浮水印 Watermark (Phase 10) — text or image, centered on the page and
// rotated, at a fixed opacity. Position is deliberately NOT configurable in
// this MVP (always page-center) — every example content in §16 ("草稿、
// COPY、案件編號、日期") is a diagonal center stamp, not a corner badge; see
// decision_log D-019. `imageSourceId` (only used when `type === 'image'`)
// points into AppState.sources, reusing the existing Source Engine / Export
// embed pipeline rather than a second image-storage mechanism.
export function createWatermarkSettings(overrides = {}) {
  return {
    enabled: overrides.enabled ?? false,
    type: overrides.type ?? 'text', // 'text' | 'image'
    text: overrides.text ?? 'COPY',
    imageSourceId: overrides.imageSourceId ?? null,
    opacity: overrides.opacity ?? 0.3,
    rotationDeg: overrides.rotationDeg ?? -45,
    fontSizePt: overrides.fontSizePt ?? 72,
    widthFraction: overrides.widthFraction ?? 0.6, // image only: fraction of content-area width
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
    bleed: overrides.bleed ?? createBleedSettings(),
    safeArea: overrides.safeArea ?? createSafeAreaSettings(),
    headerFooter: overrides.headerFooter ?? createHeaderFooterSettings(),
    pageNumber: overrides.pageNumber ?? createPageNumberSettings(),
    watermark: overrides.watermark ?? createWatermarkSettings(),
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
