#!/usr/bin/env bash
# Fetch the pdf.js build used by Phase 2+ development/dev-harnesses (NOT
# spike/fetch-vendor.sh, which is a frozen record of the exact build the
# Phase -1 feasibility spike was verified against — don't repoint that one).
#
# Not committed (see .gitignore /vendor/) — reproduce with this script.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VENDOR="$ROOT/vendor"
mkdir -p "$VENDOR/pdfjs" "$VENDOR/pdf-lib"

# Pinned to v5.4.149, NOT the newer v6.2.108 the spike used: v6.2.108's
# pdf.mjs calls the brand-new (Stage 2/3 TC39 "Map upsert") method
# `Map.prototype.getOrInsertComputed` directly with no fallback, which
# throws `TypeError: ...getOrInsertComputed is not a function` on every
# page.render() call in this project's dev/test Chromium (Playwright's
# pinned build, Chromium 141 — the method isn't shipped yet). v5.4.149 has
# no reference to that API and renders cleanly. Revisit once the dev
# Chromium build is updated past whichever version ships it (see
# decision_log D-009).
PDFJS_VERSION="v5.4.149"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

curl -sL -o "$TMP/pdfjs-dist.zip" \
  "https://github.com/mozilla/pdf.js/releases/download/${PDFJS_VERSION}/pdfjs-${PDFJS_VERSION#v}-dist.zip"
unzip -q "$TMP/pdfjs-dist.zip" -d "$TMP/pdfjs"
cp "$TMP/pdfjs/build/pdf.mjs" "$VENDOR/pdfjs/pdf.mjs"
cp "$TMP/pdfjs/build/pdf.worker.mjs" "$VENDOR/pdfjs/pdf.worker.mjs"

echo "Fetched pdf.js ${PDFJS_VERSION} into $VENDOR/pdfjs/"

# pdf-lib for Phase 7+ (Export Renderer) — same version the Phase -1 spike
# used (spike/fetch-vendor.sh keeps its own frozen copy; this is the
# separate Phase 2+/7+ dev-and-TEST copy, same split as the pdf.js versions
# above). Unlike pdf.js, pdf-lib.esm.js has ZERO import statements (every
# dependency — pako, tslib, @pdf-lib/standard-fonts, @pdf-lib/upng — is
# already rolled into this one file) and needs no Worker/DOM at load time,
# so it runs directly under plain Node — this is what lets src/export.test.js
# exercise the REAL library instead of only fakes (see decision_log D-015).
PDF_LIB_VERSION="1.17.1"
curl -sL -o "$TMP/pdf-lib.tgz" \
  "https://registry.npmjs.org/pdf-lib/-/pdf-lib-${PDF_LIB_VERSION}.tgz"
tar -xzf "$TMP/pdf-lib.tgz" -C "$TMP" package/dist/pdf-lib.esm.js
cp "$TMP/package/dist/pdf-lib.esm.js" "$VENDOR/pdf-lib/pdf-lib.esm.js"

echo "Fetched pdf-lib ${PDF_LIB_VERSION} into $VENDOR/pdf-lib/"
