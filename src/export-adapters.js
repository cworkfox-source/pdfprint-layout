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
