// Project System (docs/plan.md §17, Phase 9). Pure functions only — no
// File/Blob/DOM API here (that's project-adapters.js, browser-only, same
// split as export.js/export-adapters.js, §4.1).
//
// §17.1's project.json envelope: `{ schemaVersion, project, sources,
// templates, pages }`. `schemaVersion` is hoisted to the TOP level (the one
// canonical version marker §17.2 requires) rather than duplicated inside
// `project` — `Project.schemaVersion` (model.js) is always re-stamped to
// the CURRENT SCHEMA_VERSION by createProject() itself, so keeping a
// second copy inside the nested object would just be a second value that
// could drift out of sync with the first. AppState's `selection` is
// deliberately NOT serialized — like Zoom/Pan, it's ephemeral UI state
// excluded from History by §7.3, and has no meaning across a save/load
// round-trip (see decision_log D-018).

import { createProject, createSource, createTemplate, createCropMarksSettings, SCHEMA_VERSION } from './model.js';

export function serializeProject(state) {
  const { schemaVersion, ...projectRest } = state.project;
  return {
    schemaVersion,
    project: projectRest,
    sources: state.sources,
    templates: state.templates,
    pages: state.pages,
  };
}

// §17.2 — walks a loaded file's data forward to the CURRENT schema, one
// version step at a time. Throws (rather than silently proceeding) for a
// file from a NEWER version than this app build understands — the "must
// not silently ignore unknown fields" mandate applies to THAT direction;
// migrating an OLDER file forward by filling in defaults for fields it
// never had is the expected, required behavior for the other direction.
export function migrateProjectData(json) {
  if (json == null || typeof json !== 'object' || json.schemaVersion == null) {
    throw new Error('migrateProjectData: missing schemaVersion — not a valid project file');
  }
  if (json.schemaVersion > SCHEMA_VERSION) {
    throw new Error(
      `migrateProjectData: project file is schemaVersion ${json.schemaVersion}, newer than this app supports (${SCHEMA_VERSION}). Please update the app before opening it.`,
    );
  }

  let data = json;
  if (data.schemaVersion === 1) {
    // v1 -> v2 (Phase 8, D-017/D-018): Project gained `cropMarks`.
    data = {
      ...data,
      schemaVersion: 2,
      project: { ...data.project, cropMarks: data.project.cropMarks ?? createCropMarksSettings() },
    };
  }
  return data;
}

// Migrates + validates a loaded project.json into the shape createAppState()
// expects (minus `selection`, which the caller always starts fresh — see
// module comment). Sources are reconstructed via createSource() (and
// Templates via createTemplate()) as a normalization/validation pass — the
// saved shape already matches what those factories produce, so this mainly
// catches corrupt/hand-edited files (a Template missing its required `name`
// throws here, rather than surfacing as a confusing error much later) and
// fills in any still-missing defaults migrateProjectData() didn't already
// handle. Pages/Slots pass through as-is: no Slot/Page field has changed
// shape since Phase 0, so there is nothing yet for a migration step to do
// there.
export function deserializeProject(json) {
  const migrated = migrateProjectData(json);
  const project = createProject(migrated.project);
  const sources = (migrated.sources ?? []).map((s) => createSource(s));
  const templates = (migrated.templates ?? []).map((t) => createTemplate(t));
  const pages = migrated.pages ?? [];
  return { project, sources, templates, pages };
}

// §17.1 — "載入時若找不到來源,提示使用者重新指定原始 PDF/圖片,並以檔名＋
// 頁數＋尺寸比對". Since Source binaries never persist (§17.1's "Source
// 二進位不內嵌"), EVERY project load needs the user to re-select the
// original files; this matches each freshly re-loaded Source (new id, new
// docId, from re-running the normal Source Engine load path on the
// re-selected file) against the SAVED Source metadata it corresponds to —
// by fileName + pageIndex + dimensions, and — the strongest signal,
// preferred whenever both sides have one — contentHash (§17.1's "雜湊").
// The SAVED id is kept (so existing Slot.sourceId references in the loaded
// Pages keep resolving); only its docId (the SourceBinaryStore key) is
// swapped to the freshly-loaded bytes' docId.
export function relinkSources(savedSources, freshlyLoadedSources) {
  const relinked = [];
  const unresolved = [];
  const usedFreshIds = new Set();

  for (const saved of savedSources) {
    const match = freshlyLoadedSources.find((fresh) => {
      if (usedFreshIds.has(fresh.id)) return false;
      if (fresh.fileName !== saved.fileName) return false;
      if (fresh.naturalWidth !== saved.naturalWidth || fresh.naturalHeight !== saved.naturalHeight) return false;
      if (saved.kind === 'pdf-page' && fresh.pageIndex !== saved.pageIndex) return false;
      if (saved.contentHash && fresh.contentHash && saved.contentHash !== fresh.contentHash) return false;
      return true;
    });
    if (match) {
      usedFreshIds.add(match.id);
      relinked.push({ ...saved, docId: match.docId, contentHash: match.contentHash ?? saved.contentHash });
    } else {
      unresolved.push(saved);
    }
  }

  return { relinked, unresolved };
}

// Pure helper for the "please re-select these files" UI prompt: every
// sourceId any Slot across any Page actually references, that isn't
// present in `availableSourceIds` (the relinked set).
export function findMissingSourceIds(pages, availableSourceIds) {
  const available = new Set(availableSourceIds);
  const missing = new Set();
  for (const page of pages) {
    for (const slot of page.slots) {
      if (slot.sourceId && !available.has(slot.sourceId)) missing.add(slot.sourceId);
    }
  }
  return [...missing];
}
