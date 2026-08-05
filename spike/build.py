#!/usr/bin/env python3
"""Assemble spike/dist/index.html from template.html + vendor/ + app.js.

This is a throwaway concatenation script for the Phase -1 feasibility spike
ONLY (docs/plan.md Phase -1). It is NOT the real build pipeline -- the
production build is esbuild per decision_log D-004, once Node.js is
available in this environment (currently it is not; see change_log).
"""
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
SPIKE = ROOT / "spike"
VENDOR = ROOT / "vendor"
DIST = SPIKE / "dist"


def read(path: pathlib.Path) -> str:
    return path.read_text(encoding="utf-8")


def main() -> None:
    template = read(SPIKE / "template.html")
    pdflib_src = read(VENDOR / "pdf-lib" / "pdf-lib.min.js")
    pdfjs_src = read(VENDOR / "pdfjs" / "pdf.mjs")
    pdfjs_worker_src = read(VENDOR / "pdfjs" / "pdf.worker.mjs")
    app_src = read(SPIKE / "app.js")

    out = template
    out = out.replace("__PDFLIB_SOURCE__", pdflib_src)
    out = out.replace("__PDFJS_SOURCE_JSON__", json.dumps(pdfjs_src))
    out = out.replace("__PDFJS_WORKER_SOURCE_JSON__", json.dumps(pdfjs_worker_src))
    out = out.replace("__APP_SOURCE__", app_src)

    DIST.mkdir(parents=True, exist_ok=True)
    out_path = DIST / "index.html"
    out_path.write_text(out, encoding="utf-8")
    print(f"Wrote {out_path} ({out_path.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
