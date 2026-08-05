#!/usr/bin/env bash
# Fetch the pinned third-party builds used by the Phase -1 spike.
# These are NOT committed (see .gitignore) — this script reproduces
# vendor/ deterministically. Run from the repo root.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VENDOR="$ROOT/vendor"
mkdir -p "$VENDOR/pdfjs" "$VENDOR/pdf-lib"

PDFJS_VERSION="v6.2.108"
PDFLIB_VERSION="1.17.1"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

curl -sL -o "$TMP/pdfjs-dist.zip" \
  "https://github.com/mozilla/pdf.js/releases/download/${PDFJS_VERSION}/pdfjs-${PDFJS_VERSION#v}-dist.zip"
unzip -q "$TMP/pdfjs-dist.zip" -d "$TMP/pdfjs"
cp "$TMP/pdfjs/build/pdf.mjs" "$VENDOR/pdfjs/pdf.mjs"
cp "$TMP/pdfjs/build/pdf.worker.mjs" "$VENDOR/pdfjs/pdf.worker.mjs"

curl -sL -o "$VENDOR/pdf-lib/pdf-lib.min.js" \
  "https://unpkg.com/pdf-lib@${PDFLIB_VERSION}/dist/pdf-lib.min.js"

echo "Fetched. Verify against spike/README.md checksums with:"
echo "  sha256sum vendor/pdfjs/pdf.mjs vendor/pdfjs/pdf.worker.mjs vendor/pdf-lib/pdf-lib.min.js"
