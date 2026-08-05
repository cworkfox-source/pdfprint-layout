# Phase −1 Feasibility Spike

驗證 [`docs/plan.md`](../docs/plan.md) §19.2 / §23.1：pdf.js 的 ESM 建置能否在
`file://` 下透過 Blob URL 載入、PDF.js Worker 能否透過 Blob URL 運作、原始 PDF
bytes 是否在交給 PDF.js 後仍可完好地交給 pdf-lib 匯出（§12.3 的 detach 規則）。

**結果：PASS。** 詳見 `docs/change_log.md` 2026-08-05 條目與 `docs/decision_log.md`
D-008。

## 為何沒有用 esbuild

正式 build（Phase 11）指定使用 esbuild（decision_log D-004），但這台開發機沒有
安裝 Node.js / npm。本 spike 改為直接下載 pdf.js 與 pdf-lib 的官方預建產物,用
一個很簡單的 Python 腳本（`build.py`,不需要 Node）把它們串接成單一 HTML,足以
驗證 `file://` 的可行性問題,但**不是**最終的打包方案。Phase 11 仍需要 Node +
esbuild 才能做到 minify / tree-shaking / 版本鎖定(`package-lock.json`)。

## 如何重現

```bash
bash spike/fetch-vendor.sh          # 下載 vendor/（不進 git,見 .gitignore）
python spike/build.py               # 產生 spike/dist/index.html
```

用 Chrome 或 Edge 直接開啟 `spike/dist/index.html`(雙擊,或網址列貼
`file://` 路徑),選一個本機 PDF 檔案,畫面下方會即時列出每項檢查的
PASS/FAIL。

## 已鎖定版本 / Checksums

| 檔案 | 版本 | SHA-256 |
| --- | --- | --- |
| `vendor/pdfjs/pdf.mjs` | pdf.js v6.2.108 | `e0ccc62fbfa69942eb7dd46c89d4b3ea8fc08f61b234e65f32e6d5c76efc04c8` |
| `vendor/pdfjs/pdf.worker.mjs` | pdf.js v6.2.108 | `1a7607f28cfbc63f0e4e0a41927c89f991e353e4f3fb4565ecfd621ac5975089` |
| `vendor/pdf-lib/pdf-lib.min.js` | pdf-lib 1.17.1 | `0f9a5cad07941f0826586c94e089d89b918c46e5c17cf2d5a3c6f666e3bc694f` |

## 技術手法(供 Phase 0 之後參考)

- **ESM under `file://`**：不要用 `<script type="module" src="...">`（外部檔案
  fetch 在 file:// 下會被 Chrome 當成跨來源請求擋掉）。改成把整份 `.mjs` 原始碼
  當純文字內嵌進頁面,執行期包成 `Blob` 產生 `blob:` URL,再用動態
  `import(blobUrl)` 載入——`blob:` URL 不受 file:// 的 CORS 限制。
- **PDF.js Worker under `file://`**：同樣把 `pdf.worker.mjs` 內嵌成文字,包成
  `Blob` → `blob:` URL,設給 `pdfjsLib.GlobalWorkerOptions.workerSrc`,
  `new Worker(url, {type:'module'})` 會自動被 pdf.js 使用。
- **pdf-lib**：直接用官方 UMD build(`pdf-lib.min.js`)當一般 classic
  `<script>` 內嵌,不涉及 ESM,沒有 file:// 的問題。
- **§12.3 detach 規則的實測**：`file.arrayBuffer()` 讀入後立刻
  `buffer.slice(0)` 複製一份給 PDF.js,原始 buffer 全程不碰 PDF.js,匯出時
  才用原始 buffer 給 pdf-lib——驗證原始 buffer 全程未被 detach。
- **pdf.js v6 API 提醒**：`PDFDocumentProxy` 已無 `.destroy()`,只剩
  `.cleanup()`;完整釋放要呼叫 `loadingTask.destroy()`。舊教學/範例常見的
  `pdfDoc.destroy()` 在這個版本會直接丟例外,見 `app.js` 註解。
