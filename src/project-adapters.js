// Browser-only glue for the Project System (docs/plan.md §17, Phase 9).
// Same split as export-adapters.js: project-file.js stays pure/serializable
// (Node-testable), this file is the thin DOM layer around it, verified live
// in a browser rather than node:test (§4.1).

// §17.1 — triggers a save-as-file download of the project JSON. Browsers
// have no direct "write to a chosen path" API without extra permissions
// this app has no reason to request; a Blob + `<a download>` click is the
// standard, dependency-free way to hand the user a file.
export function downloadProjectJson(jsonObject, filename = 'project.json') {
  const text = JSON.stringify(jsonObject, null, 2);
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

// Reads a user-selected .json File (from an <input type="file"> change
// event) and parses it — the one place project-file.js's pure functions
// receive their raw input from an actual filesystem file.
export async function readProjectFile(file) {
  const text = await file.text();
  return JSON.parse(text);
}
