// §17.1 Source Metadata's "雜湊" (hash) field. Uses the Web Crypto API
// (`crypto.subtle.digest`) directly — unlike pdf.js/pdf-lib, this is a
// converged standard both Node (18+, verified against this repo's runtime)
// and every browser implement identically, so no deps-injection split or
// vendor fetch is needed here (see decision_log D-018): this file is
// Node-testable AND browser-usable as-is, with the exact same code path in
// both environments — a first for this project's third-party-boundary
// files.

export async function computeContentHash(bytes) {
  const buffer = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
