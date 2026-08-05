import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SCHEMA_VERSION,
  createSource,
  createSlot,
  createPaperSettings,
  resolvePaperSizePt,
  createPage,
  createTemplate,
  createProject,
  createAppState,
} from './model.js';
import { paperSizePt } from './geometry.js';

test('createSource requires a kind and fills defaults', () => {
  assert.throws(() => createSource({}));

  const src = createSource({ kind: 'image', fileName: 'photo.png' });
  assert.equal(src.kind, 'image');
  assert.equal(src.fileName, 'photo.png');
  assert.equal(src.pageRotate, 0);
  assert.equal(src.cropBox, null);
  assert.match(src.id, /^src-/);
});

test('createSlot has the exact defaults from plan.md §5.3', () => {
  const slot = createSlot();
  assert.equal(slot.x, 0);
  assert.equal(slot.y, 0);
  assert.equal(slot.w, 0.5);
  assert.equal(slot.h, 0.5);
  assert.equal(slot.sourceId, null);
  assert.equal(slot.fitMode, 'contain');
  assert.equal(slot.scale, 1);
  assert.equal(slot.rotation, 0);
  assert.equal(slot.offsetX, 0);
  assert.equal(slot.offsetY, 0);
  assert.equal(slot.flipX, false);
  assert.equal(slot.flipY, false);
  assert.equal(slot.locked, false);
  assert.equal(slot.z, 0);
});

test('createSlot overrides merge cleanly', () => {
  const slot = createSlot({ w: 0.25, h: 0.25, sourceId: 'src-1', locked: true });
  assert.equal(slot.w, 0.25);
  assert.equal(slot.sourceId, 'src-1');
  assert.equal(slot.locked, true);
  // untouched fields still default
  assert.equal(slot.fitMode, 'contain');
});

test('two factory calls never collide on id', () => {
  const a = createSlot();
  const b = createSlot();
  assert.notEqual(a.id, b.id);
});

test('createPaperSettings defaults to A4 portrait, zero margins', () => {
  const paper = createPaperSettings();
  assert.equal(paper.size, 'A4');
  assert.equal(paper.orientation, 'portrait');
  assert.equal(paper.marginTopPt, 0);
  assert.equal(paper.gapHorizontalPt, 0);
});

test('resolvePaperSizePt matches geometry.paperSizePt for presets', () => {
  const paper = createPaperSettings({ size: 'A3', orientation: 'landscape' });
  const resolved = resolvePaperSizePt(paper);
  const expected = paperSizePt('A3', 'landscape');
  assert.deepEqual(resolved, expected);
});

test('resolvePaperSizePt handles custom size and landscape swap', () => {
  const portrait = createPaperSettings({ size: 'custom', customWidthPt: 100, customHeightPt: 200 });
  assert.deepEqual(resolvePaperSizePt(portrait), { width: 100, height: 200 });

  const landscape = createPaperSettings({ size: 'custom', customWidthPt: 100, customHeightPt: 200, orientation: 'landscape' });
  assert.deepEqual(resolvePaperSizePt(landscape), { width: 200, height: 100 });
});

test('resolvePaperSizePt throws for incomplete custom size', () => {
  const paper = createPaperSettings({ size: 'custom' });
  assert.throws(() => resolvePaperSizePt(paper));
});

test('createPage defaults to inherited paper (null) and no slots', () => {
  const page = createPage();
  assert.equal(page.paper, null);
  assert.deepEqual(page.slots, []);
});

test('createTemplate requires a name and never carries a sourceId (§21)', () => {
  assert.throws(() => createTemplate({}));

  const slotWithSource = createSlot({ sourceId: 'src-should-be-stripped' });
  const tmpl = createTemplate({ name: 'A4_上2下1', slots: [slotWithSource] });
  assert.equal(tmpl.name, 'A4_上2下1');
  assert.equal(tmpl.slots[0].sourceId, null);
  // everything else about the slot survives the strip
  assert.equal(tmpl.slots[0].id, slotWithSource.id);
});

test('createProject carries the current schemaVersion (§17.2)', () => {
  const project = createProject();
  assert.equal(project.schemaVersion, SCHEMA_VERSION);
  assert.equal(project.paper.size, 'A4');
});

test('createAppState wires sensible defaults for a fresh session', () => {
  const state = createAppState();
  assert.equal(state.pages.length, 1);
  assert.deepEqual(state.sources, []);
  assert.deepEqual(state.templates, []);
  assert.deepEqual(state.selection, []);
  assert.equal(state.project.schemaVersion, SCHEMA_VERSION);
});
