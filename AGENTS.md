# AGENTS.md — Universal AI Governance Template (v3.1)

Single source of truth for ALL AI coding agents (Claude Code, Antigravity, Codex, Cursor, ...).
Tool-specific files (`CLAUDE.md`, `.antigravity_rules.md`) only point here. Never duplicate rules.

This template is project-agnostic. Copy it into any repo unchanged; the agent fills in
project specifics by reading the project's own spec documents (see Bootstrap).

## Project Profile (set once at bootstrap)

- Scale: `solo-large`                            <!-- controls documentation strictness, see Completion -->
- Spec file: `docs/spec.md`                      <!-- mandatory; created by Bootstrap if missing -->

## Bootstrap (first session in a new project)

Run when "Project Facts" below is empty, or when `docs/spec.md` is missing.
Full procedure (requirements interview + filling Project Facts): `docs/bootstrap.md`
— read it ONLY when that condition holds, never at routine startup.

## Project Facts (agent-maintained — keep under 15 lines)

<!-- FILLED BY AGENT DURING BOOTSTRAP. Update whenever it drifts from reality. -->
<!-- NOTE: this repo is the template's OWN home. When copying AGENTS.md into a
     real project, blank this section back out so Bootstrap triggers there. -->
- Spec source: docs/spec.md · Plan: docs/plan.md (v2.0, 章節編號即需求編號)
- Product: Visual Page Imposition Designer — 純前端單檔 HTML,PDF/圖片拼版與列印
- Stack: Vanilla HTML5 + ES6+ · PDF.js (parse/preview) · pdf-lib (export) ·
  esbuild → IIFE 單檔 (file:// 不支援原生 ESM,見 plan §19.2)
- Build: 尚未建立 (Phase 11 才產出正式 build;此行須在建立後立即更新)
- Test (single) / (full): 尚未建立;目前僅文件審查。程式碼進場後首要測試為
  plan §23.3 Preview↔Export 等價性腳本
- Lint / Format: 尚未設定 · Dev server: 尚未建立 (產物須實測 file://)
- Key directories: `docs/` 規格與文件;`src/` 尚未建立;
  `playbooks/` 空(範本結構保留,供日後新增可重用 playbook)
- 三條不可違反的架構規則: Layout Model 與 DOM 分離 / Slot 與 Source 分離 /
  Preview 與 Export 分離但幾何等價(唯一 geometry 模組),見 plan §4

## Boundaries

- **NEVER**: force push; rewrite git history; print, log, or hardcode any API key,
  password, or personal data; delete or rewrite change_log / decision_log history
  (moving entries verbatim to `docs/logs/` per the Log Rotation rule is archiving,
  NOT deletion, and is allowed).
- **GitHub publish exception** (user-authorized 2026-08-05, decision_log D-006):
  the agent MAY run `git push` (non-force) and `gh release create` / `gh repo
  create`, but **only** against the designated remote
  `https://github.com/cworkfox-source/pdfprint-layout` set up under this decision.
  Any other remote, any force push, or any history-rewriting push remains
  covered by the NEVER rule above. After each push/release, state in chat what
  was pushed and the resulting URL.
- **ASK FIRST**: delete files; add a third-party dependency; change database schema
  or file formats other tools depend on; any action outside the repo directory;
  changing the GitHub repo's visibility (public/private) after initial creation.
- **ALWAYS**: after code changes, run the Test command from Project Facts;
  state clearly when a change was NOT verified.

## Startup (before any task)

Progressive loading — do not read everything every session:

1. Read the **"Current State TL;DR"** block (max 5 lines) at the top of
   `docs/project_status.md`. Read the full file only if the task requires it.
2. Read `docs/decision_log.md` **titles only** — extract them mechanically
   (`grep -E '^## ' docs/decision_log.md`), do NOT load the whole file into
   context. Open a full entry only when the current task touches that area.
   Never undo intentional design decisions.
3. Read the **active** `docs/change_log.md` in full. This is cheap because
   the Log Rotation rule below keeps the active file bounded (≤ ~400 lines).
   **NEVER read the archive files under `docs/logs/`** unless the task
   explicitly requires history older than the active log; when it does,
   locate the relevant archive by filename year and read only that file.
4. **Rotation check**: if `wc -l < docs/change_log.md` exceeds 400, run the
   Log Rotation procedure below BEFORE starting the task.
5. If any of these files is missing, create it from `docs/templates.md`.

Never assume project state from memory or conversation history. Documentation in the
repo is the context source; a fresh session must be able to continue without loss.

## Log Rotation (archive ≠ delete)

Trigger: active `docs/change_log.md` exceeds **400 lines**
(verify with `wc -l < docs/change_log.md`; checked at Startup step 4).
Full procedure: `docs/log_rotation.md` — read it ONLY when the trigger fires.
Archiving is a verbatim move to `docs/logs/`; it is NOT deletion.

## While Working

- Prefer incremental changes over large refactors.
- Verify structural changes against `docs/decision_log.md` first.
- Bug fix: identify root cause → fix → verify. Record root cause, affected files,
  verification method, and remaining risks in the change log entry.
- Refactor: confirm behavior is unchanged, assess compatibility/migration impact,
  and document old vs. new design + risks (decision_log + change_log).
- If the task conflicts with `docs/spec.md` (scope creep or contradiction),
  STOP and ask the user whether to update the spec first.

## Completion (tiered by Project Profile → Scale)

| Scale | change_log | project_status | decision_log | End-of-task report |
|---|---|---|---|---|
| solo-small | 1-line entry per task | update TL;DR block only | only for architecture/API/DB/security/deploy changes | 2 lines: what changed + how verified |
| solo-large | full entry per task | update affected sections | same trigger list | short report (see below) |
| team | full entry per task | full update | same trigger list | full report (see below) |

Full report format (solo-large / team):

```
Task Summary:
Files Modified:
Documents Updated:
Tests Performed:
Known Risks:
Recommended Next Steps:
```

If the spec or project understanding changed, update `docs/spec.md` and
"Project Facts" above. A task is NOT complete until the required documentation
tier is done. Code without documentation is incomplete.

## Source of Truth Priority

1. Actual source code
2. docs/spec.md
3. docs/decision_log.md
4. docs/project_status.md
5. docs/change_log.md
6. Conversation context

On conflict: verify source code first, then fix the documentation.

## Hard Rules

- Every project MUST have a `docs/spec.md`, even if only 10 lines.
- NEVER delete or rewrite change_log / decision_log history. Archiving via the
  Log Rotation rule (verbatim move to `docs/logs/`) is the ONLY permitted way
  to move entries out of the active change_log.
- NEVER remove documentation silently or modify records without explanation.
- No undocumented shortcuts, hidden dependencies, or magic values.
- Any file created/deleted/renamed, feature added/removed, or API/DB/architecture
  change requires a documentation update at the current Scale tier. No exceptions.
- Each change_log field: max 3 lines. Logs are indexes, not essays.

## Reusable Playbooks

Cross-project, tool-agnostic playbooks live under this repo's `playbooks/`
folder (same location as this file). Check this list before solving a problem
from scratch — someone may have already worked out the gotchas. Read the
referenced `PLAYBOOK.md` in full before acting on it.

(none yet — `embeddable-python-packaging` removed 2026-08-05, unrelated to
this JS/HTML product; see change_log)

<!-- Add new entries here as playbooks are created. One line + path per playbook. -->
