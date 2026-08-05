// Browser-only glue for the Export Renderer (docs/plan.md §14.5). This is
// the concrete implementation of `deps.transcodeWebpToPng` that
// export.js's `embedSource()` expects — kept separate from
// render-adapters.js (which is specifically the Source Engine's adapters,
// §12.5/§12.6) since this is an Export-only concern, and separate from
// export.js itself for the same reason preview.js/sources.js split pure
// logic from DOM/Canvas-touching code (§4.1): `createImageBitmap`/
// `HTMLCanvasElement` don't exist in the Node test runner, so this file is
// verified live in a browser instead of node:test.

// pdf-lib cannot embed WEBP directly (§14.5) — decode it via the browser's
// own WEBP support (createImageBitmap, same as Source Engine's decodeImage)
// and re-encode as PNG through a full-resolution Canvas. Unlike
// render-adapters.js's renderImagePreview() (which deliberately downscales
// for on-screen use, §12.7), this transcodes at the image's OWN native
// resolution — it feeds the final PDF, not a preview.
export async function transcodeWebpToPng(bytes) {
  const blob = new Blob([bytes], { type: 'image/webp' });
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();

  const pngBlob = await new Promise((resolve, reject) => {
    canvas.toBlob((result) => {
      if (!result) {
        reject(new Error('transcodeWebpToPng: canvas.toBlob() returned null'));
        return;
      }
      resolve(result);
    }, 'image/png');
  });
  canvas.width = 0;
  canvas.height = 0;
  return new Uint8Array(await pngBlob.arrayBuffer());
}

// §15.1 — "Print" is NOT a third rendering path: it opens the exact same PDF
// bytes exportProjectToPdf() would produce for "Export PDF" via a Blob URL,
// letting the browser's own built-in PDF viewer handle the actual print
// (menu/keyboard-shortcut inside that viewer) — never `window.print()` on
// the app's own DOM, which plan.md explicitly rules out (§15.1's whole
// reason for existing: a DOM print path would be a second, unverified
// geometry implementation). Because the caller must pass in the SAME bytes
// it already got back from exportProjectToPdf(), §23.6.2's "列印與匯出 PDF
// 產生的 PDF byte 內容一致" is true by construction, not something this
// function needs to separately guarantee.
export function openPdfBytesForPrint(pdfBytes) {
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  return url;
}
