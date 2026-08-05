// Phase -1 feasibility spike — validates the three hard file:// constraints
// from docs/plan.md §19.2 and the ArrayBuffer-detach rule from §12.3:
//   1. ESM (pdf.js) can be loaded under file:// via a Blob-URL dynamic import.
//   2. PDF.js's worker can run under file:// via a Blob-URL module Worker.
//   3. The original PDF bytes survive PDF.js parsing intact enough for
//      pdf-lib to re-embed the page afterward (i.e. we never hand PDF.js the
//      buffer we intend to keep — see §12.3 SourceBinaryStore rule).
//
// This file is inlined verbatim into spike/dist/index.html by build.py.
// It expects two globals to already be defined by the surrounding page:
//   PDFJS_SOURCE        - full text of vendor/pdfjs/pdf.mjs
//   PDFJS_WORKER_SOURCE  - full text of vendor/pdfjs/pdf.worker.mjs
// pdf-lib is loaded as a plain classic script before this one runs, so
// window.PDFLib is already available (it's a UMD build, no ESM needed).

const log = (msg, ok) => {
  const el = document.getElementById('log');
  const line = document.createElement('div');
  line.className = ok === undefined ? 'info' : (ok ? 'pass' : 'fail');
  const prefix = ok === undefined ? '·' : (ok ? '[PASS]' : '[FAIL]');
  line.textContent = `${prefix} ${msg}`;
  el.appendChild(line);
  console.log(prefix, msg);
};

const setStatus = (text) => {
  document.getElementById('status').textContent = text;
};

async function loadPdfJsViaBlobImport() {
  const blob = new Blob([PDFJS_SOURCE], { type: 'text/javascript' });
  const url = URL.createObjectURL(blob);
  try {
    const pdfjsLib = await import(/* webpackIgnore: true */ url);
    log('pdf.js ESM 透過 Blob URL dynamic import() 載入成功（file:// 下無需 <script type=module src=...>）', true);
    return pdfjsLib;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function setupWorkerViaBlobUrl(pdfjsLib) {
  const blob = new Blob([PDFJS_WORKER_SOURCE], { type: 'text/javascript' });
  const url = URL.createObjectURL(blob);
  pdfjsLib.GlobalWorkerOptions.workerSrc = url;
  log('pdf.worker.mjs 已包成 Blob URL 並指定為 GlobalWorkerOptions.workerSrc', true);
  return url;
}

async function renderFirstPage(pdfjsLib, pdfBytesForPreview) {
  const t0 = performance.now();
  const loadingTask = pdfjsLib.getDocument({ data: pdfBytesForPreview });
  const pdfDoc = await loadingTask.promise;
  log(`PDF.js 解析完成，共 ${pdfDoc.numPages} 頁`, true);

  const page = await pdfDoc.getPage(1);
  const viewport = page.getViewport({ scale: 1.5 });
  const canvas = document.getElementById('preview');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d');
  await page.render({ canvasContext: ctx, viewport }).promise;

  const elapsed = performance.now() - t0;
  log(`第 1 頁已 render 至 Canvas，耗時 ${elapsed.toFixed(0)} ms`, elapsed < 3000);

  // pdf.js v6: PDFDocumentProxy has no .destroy() (only .cleanup()).
  // Full teardown of the worker/doc goes through the loading task instead.
  await loadingTask.destroy();
  return { numPages: pdfDoc.numPages, elapsedMs: elapsed };
}

async function exportViaPdfLib(originalBytes) {
  // This is the §12.3 / §23.1 crux: `originalBytes` here must be a buffer
  // that was NEVER handed to pdfjsLib.getDocument(), because PDF.js/its
  // worker detaches (transfers) whatever ArrayBuffer it's given.
  const srcDoc = await PDFLib.PDFDocument.load(originalBytes);
  const outDoc = await PDFLib.PDFDocument.create();
  const [copiedPage] = await outDoc.copyPages(srcDoc, [0]);
  outDoc.addPage(copiedPage);
  const outBytes = await outDoc.save();
  log(`pdf-lib 以「未被 PDF.js 使用過」的原始 bytes 重新載入並複製第 1 頁成功，輸出 ${outBytes.byteLength} bytes`, true);
  return outBytes;
}

function offerDownload(bytes, filename) {
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.getElementById('download-link');
  a.href = url;
  a.download = filename;
  a.textContent = `下載驗證用輸出檔（${filename}，${bytes.byteLength} bytes）`;
  a.style.display = 'inline';
}

async function handleFile(file) {
  document.getElementById('log').textContent = '';
  setStatus(`處理中：${file.name} (${file.size} bytes)`);

  try {
    // Read once. Keep `originalBuffer` untouched for pdf-lib; give PDF.js a
    // COPY. This is the §12.3 rule being exercised, not just described.
    const originalBuffer = await file.arrayBuffer();
    const previewCopy = originalBuffer.slice(0);
    log(`檔案讀入，複製一份給 PDF.js（原始 ${originalBuffer.byteLength} bytes → 複本 ${previewCopy.byteLength} bytes）`);

    const pdfjsLib = await loadPdfJsViaBlobImport();
    setupWorkerViaBlobUrl(pdfjsLib);

    await renderFirstPage(pdfjsLib, previewCopy);

    // The real test: is `originalBuffer` still usable, i.e. NOT detached?
    let detached = false;
    try {
      new Uint8Array(originalBuffer); // throws if detached
    } catch (e) {
      detached = true;
    }
    log('原始 ArrayBuffer 是否被 detach', !detached);
    if (detached) {
      throw new Error('原始 buffer 已被 detach —— §12.3 規則失效，需要重新設計資料流');
    }

    const outBytes = await exportViaPdfLib(originalBuffer);
    offerDownload(outBytes, `spike-export-${Date.now()}.pdf`);

    setStatus('✅ Phase −1 Spike 全部檢查通過');
    document.getElementById('status').className = 'pass';
  } catch (err) {
    log(`例外：${err.message}`, false);
    console.error(err);
    setStatus('❌ Spike 失敗，見上方紀錄與 Console');
    document.getElementById('status').className = 'fail';
  }
}

document.getElementById('file-input').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) handleFile(file);
});

// Test-only hooks: browser automation in this environment cannot drive a
// native OS file-picker dialog, so expose the same code path used by the
// real <input type=file>, plus the loaded pdfjsLib namespace, for scripted
// verification. Not part of the product UI/API.
window.__spikeHandleFile = handleFile;
window.__loadPdfJsViaBlobImport = loadPdfJsViaBlobImport;
window.__setupWorkerViaBlobUrl = setupWorkerViaBlobUrl;

log(`頁面協定：${location.protocol}`, location.protocol === 'file:');
log(`window.PDFLib 是否存在（classic script 內嵌，無需 ESM）`, typeof window.PDFLib !== 'undefined');
setStatus('請選擇一個本機 PDF 檔案開始測試');
