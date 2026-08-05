// SourceBinaryStore (docs/plan.md §12.3 / decision_log D-005). Original file
// bytes live here, keyed by `docId` (one entry per loaded FILE — an N-page
// PDF is N Source objects sharing one docId, see model.js `createSource`).
// This is deliberately NOT part of AppState/store.js: it's large binary
// data with no undo semantics, and store.js deep-freezes + snapshots its
// whole tree on every commit (§7.2), which is the wrong behavior for a
// multi-hundred-MB PDF's original bytes.
//
// The hard rule this module exists to enforce: `pdfjs.getDocument({data})`
// transfers (detaches) whatever ArrayBuffer it's given. Export (pdf-lib)
// needs the pristine original afterward. So PDF.js must NEVER receive the
// buffer kept here directly — only a fresh copy, taken fresh every time via
// getCopyForPdfJs(). Never cache or reuse that copy either.

export function createBinaryStore() {
  const bytesByDocId = new Map();

  function put(docId, originalBytes) {
    if (!(originalBytes instanceof ArrayBuffer)) {
      throw new Error('SourceBinaryStore.put requires an ArrayBuffer');
    }
    bytesByDocId.set(docId, originalBytes);
  }

  function get(docId) {
    return bytesByDocId.get(docId) ?? null;
  }

  function has(docId) {
    return bytesByDocId.has(docId);
  }

  // §12.3 — the ONLY sanctioned way to hand this store's bytes to PDF.js
  // (or anything else that might detach/mutate them): a fresh slice(0)
  // copy, independent of the stored original, every single call.
  function getCopyForPdfJs(docId) {
    const original = bytesByDocId.get(docId);
    return original ? original.slice(0) : null;
  }

  function remove(docId) {
    return bytesByDocId.delete(docId);
  }

  function clear() {
    bytesByDocId.clear();
  }

  function size() {
    return bytesByDocId.size;
  }

  // Rough resident-bytes total, for §23.5 memory bookkeeping / dev-harness
  // readouts — not exact process memory, just "how much original-bytes data
  // are we holding".
  function totalBytes() {
    let sum = 0;
    for (const buffer of bytesByDocId.values()) sum += buffer.byteLength;
    return sum;
  }

  return { put, get, has, getCopyForPdfJs, remove, clear, size, totalBytes };
}

// Cross-engine "is this ArrayBuffer still usable" check (§23.1.3's manual
// verification, made reusable). Modern engines expose `.detached`; where
// that's unavailable, constructing a view throws on a detached buffer.
export function isArrayBufferDetached(buffer) {
  if (typeof buffer.detached === 'boolean') return buffer.detached;
  try {
    // eslint-disable-next-line no-new
    new Uint8Array(buffer);
    return false;
  } catch {
    return true;
  }
}
