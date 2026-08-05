import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createAppState, createProject, createPage, createSlot, createSource, createTemplate,
  createCropMarksSettings, SCHEMA_VERSION,
} from './model.js';
import {
  serializeProject, migrateProjectData, deserializeProject, relinkSources, findMissingSourceIds,
} from './project-file.js';

// --- serializeProject --------------------------------------------------------

test('serializeProject hoists schemaVersion to the top level and drops selection', () => {
  const state = createAppState({ selection: ['slot-1', 'slot-2'] });
  const json = serializeProject(state);
  assert.equal(json.schemaVersion, SCHEMA_VERSION);
  assert.equal(json.project.schemaVersion, undefined); // not duplicated inside project
  assert.equal(json.selection, undefined);
  assert.deepEqual(json.pages, state.pages);
  assert.deepEqual(json.sources, state.sources);
  assert.deepEqual(json.templates, state.templates);
});

test('serializeProject output is JSON round-trippable (JSON.stringify/parse survives)', () => {
  const source = createSource({ kind: 'image', fileName: 'a.png', naturalWidth: 10, naturalHeight: 10, docId: 'doc-1' });
  const state = createAppState({ sources: [source] });
  const json = serializeProject(state);
  const roundTripped = JSON.parse(JSON.stringify(json));
  assert.deepEqual(roundTripped, json);
});

// --- migrateProjectData ------------------------------------------------------

test('migrateProjectData throws for a file with no schemaVersion', () => {
  assert.throws(() => migrateProjectData({ project: {} }), /missing schemaVersion/);
  assert.throws(() => migrateProjectData(null), /missing schemaVersion/);
});

test('migrateProjectData throws for a file NEWER than this app supports', () => {
  assert.throws(
    () => migrateProjectData({ schemaVersion: SCHEMA_VERSION + 1, project: {} }),
    /newer than this app supports/,
  );
});

test('migrateProjectData passes a current-version file through unchanged', () => {
  const json = { schemaVersion: SCHEMA_VERSION, project: { name: 'x' }, sources: [], templates: [], pages: [] };
  assert.deepEqual(migrateProjectData(json), json);
});

test('migrateProjectData v1 -> v2: fills in the missing cropMarks default (D-018)', () => {
  // A hand-constructed v1-shaped file — exactly what createProject() used to
  // produce before Phase 8 added cropMarks, i.e. no cropMarks key at all.
  const v1Json = {
    schemaVersion: 1,
    project: { name: '舊專案', paper: { size: 'A4', orientation: 'portrait' } },
    sources: [],
    templates: [],
    pages: [],
  };
  const migrated = migrateProjectData(v1Json);
  assert.equal(migrated.schemaVersion, 2);
  assert.deepEqual(migrated.project.cropMarks, createCropMarksSettings());
  assert.equal(migrated.project.name, '舊專案'); // untouched fields survive
});

test('migrateProjectData v1 -> v2 does NOT clobber an already-present cropMarks (defensive, shouldn\'t happen for a real v1 file but must not silently overwrite user data if it did)', () => {
  const customCropMarks = { enabled: true, lengthPt: 99, gapPt: 1, lineWidthPt: 2 };
  const v1Json = { schemaVersion: 1, project: { name: 'x', cropMarks: customCropMarks }, sources: [], templates: [], pages: [] };
  const migrated = migrateProjectData(v1Json);
  assert.deepEqual(migrated.project.cropMarks, customCropMarks);
});

// --- deserializeProject -------------------------------------------------------

test('deserializeProject round-trips a serialized state back to an equivalent shape', () => {
  const slot = createSlot({ sourceId: 'src-1' });
  const source = createSource({ id: 'src-1', kind: 'image', fileName: 'a.png', naturalWidth: 10, naturalHeight: 10, docId: 'doc-1' });
  const page = createPage({ slots: [slot] });
  const template = createTemplate({ name: 'A4_2up', slots: [createSlot()] });
  const state = createAppState({ sources: [source], templates: [template], pages: [page] });

  const json = serializeProject(state);
  const restored = deserializeProject(json);

  assert.equal(restored.project.name, state.project.name);
  assert.deepEqual(restored.project.cropMarks, state.project.cropMarks);
  assert.equal(restored.sources.length, 1);
  assert.equal(restored.sources[0].id, 'src-1'); // id preserved — Slot.sourceId references must keep resolving
  assert.equal(restored.templates.length, 1);
  assert.equal(restored.templates[0].name, 'A4_2up');
  assert.equal(restored.pages.length, 1);
  assert.equal(restored.pages[0].slots[0].sourceId, 'src-1');
});

test('deserializeProject migrates an old v1 file and the result is usable by createAppState()', () => {
  const v1Json = {
    schemaVersion: 1,
    project: { name: '舊專案', paper: { size: 'A3', orientation: 'landscape', marginTopPt: 0, marginBottomPt: 0, marginLeftPt: 0, marginRightPt: 0, gapHorizontalPt: 0, gapVerticalPt: 0, customWidthPt: null, customHeightPt: null } },
    sources: [],
    templates: [],
    pages: [createPage()],
  };
  const restored = deserializeProject(v1Json);
  assert.deepEqual(restored.project.cropMarks, createCropMarksSettings());
  const appState = createAppState({ ...restored, selection: [] });
  assert.equal(appState.project.schemaVersion, SCHEMA_VERSION);
  assert.equal(appState.pages.length, 1);
});

test('deserializeProject throws a clear error for a corrupt Template (missing required name)', () => {
  const json = { schemaVersion: SCHEMA_VERSION, project: {}, sources: [], templates: [{ slots: [] }], pages: [] };
  assert.throws(() => deserializeProject(json), /requires a `name`/);
});

// --- relinkSources (§17.1) ---------------------------------------------------

function savedSource(overrides) {
  return createSource({ kind: 'pdf-page', fileName: 'report.pdf', pageIndex: 0, naturalWidth: 200, naturalHeight: 100, docId: 'old-doc-1', contentHash: 'hash-a', ...overrides });
}
function freshSource(overrides) {
  return createSource({ kind: 'pdf-page', fileName: 'report.pdf', pageIndex: 0, naturalWidth: 200, naturalHeight: 100, docId: 'new-doc-1', contentHash: 'hash-a', ...overrides });
}

test('relinkSources matches by fileName + pageIndex + dimensions + contentHash, keeping the SAVED id and adopting the FRESH docId', () => {
  const saved = savedSource({ id: 'saved-src-1' });
  const fresh = freshSource({ id: 'fresh-src-9' });
  const { relinked, unresolved } = relinkSources([saved], [fresh]);
  assert.equal(unresolved.length, 0);
  assert.equal(relinked.length, 1);
  assert.equal(relinked[0].id, 'saved-src-1'); // Slot.sourceId references must keep resolving
  assert.equal(relinked[0].docId, 'new-doc-1'); // but binary lookup now points at the fresh bytes
});

test('relinkSources rejects a match when both sides have a contentHash and they DIFFER, even if filename/dims/pageIndex all match', () => {
  const saved = savedSource({ id: 'saved-1', contentHash: 'hash-a' });
  const fresh = freshSource({ id: 'fresh-1', contentHash: 'hash-b' }); // different file content
  const { relinked, unresolved } = relinkSources([saved], [fresh]);
  assert.equal(relinked.length, 0);
  assert.equal(unresolved.length, 1);
});

test('relinkSources falls back to fileName+dims+pageIndex when either side lacks a contentHash', () => {
  const saved = savedSource({ id: 'saved-1', contentHash: null });
  const fresh = freshSource({ id: 'fresh-1', contentHash: 'hash-a' });
  const { relinked } = relinkSources([saved], [fresh]);
  assert.equal(relinked.length, 1);
});

test('relinkSources leaves an unmatched saved Source in `unresolved`', () => {
  const saved = savedSource({ id: 'saved-1', fileName: 'missing.pdf' });
  const { relinked, unresolved } = relinkSources([saved], []);
  assert.equal(relinked.length, 0);
  assert.equal(unresolved.length, 1);
  assert.equal(unresolved[0].id, 'saved-1');
});

test('relinkSources does not double-match: two saved Sources needing different fresh Sources each get their own match', () => {
  const savedA = savedSource({ id: 'saved-a', pageIndex: 0 });
  const savedB = savedSource({ id: 'saved-b', pageIndex: 1 });
  const freshA = freshSource({ id: 'fresh-a', pageIndex: 0 });
  const freshB = freshSource({ id: 'fresh-b', pageIndex: 1 });
  const { relinked } = relinkSources([savedA, savedB], [freshA, freshB]);
  assert.equal(relinked.length, 2);
  assert.equal(relinked.find((r) => r.id === 'saved-a').docId, freshA.docId);
  assert.equal(relinked.find((r) => r.id === 'saved-b').docId, freshB.docId);
});

test('relinkSources does not reuse the same fresh Source for two different saved Sources', () => {
  const savedA = savedSource({ id: 'saved-a' });
  const savedB = savedSource({ id: 'saved-b' });
  const onlyFresh = freshSource({ id: 'fresh-only' });
  const { relinked, unresolved } = relinkSources([savedA, savedB], [onlyFresh]);
  assert.equal(relinked.length, 1);
  assert.equal(unresolved.length, 1);
});

test('relinkSources: an image Source (no pageIndex) matches by fileName+dims+hash alone', () => {
  const saved = createSource({ kind: 'image', fileName: 'photo.png', naturalWidth: 400, naturalHeight: 300, docId: 'old-doc', contentHash: 'h1', id: 'saved-img' });
  const fresh = createSource({ kind: 'image', fileName: 'photo.png', naturalWidth: 400, naturalHeight: 300, docId: 'new-doc', contentHash: 'h1', id: 'fresh-img' });
  const { relinked } = relinkSources([saved], [fresh]);
  assert.equal(relinked.length, 1);
  assert.equal(relinked[0].docId, 'new-doc');
});

// --- findMissingSourceIds -----------------------------------------------------

test('findMissingSourceIds returns sourceIds referenced by Slots but not in the available set', () => {
  const pages = [
    createPage({ slots: [createSlot({ sourceId: 'a' }), createSlot({ sourceId: 'b' }), createSlot({ sourceId: null })] }),
    createPage({ slots: [createSlot({ sourceId: 'c' })] }),
  ];
  const missing = findMissingSourceIds(pages, ['a']);
  assert.deepEqual(new Set(missing), new Set(['b', 'c']));
});

test('findMissingSourceIds returns an empty array when every referenced source is available', () => {
  const pages = [createPage({ slots: [createSlot({ sourceId: 'a' })] })];
  assert.deepEqual(findMissingSourceIds(pages, ['a', 'b']), []);
});
