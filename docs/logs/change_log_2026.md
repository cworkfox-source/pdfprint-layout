# Change Log Archive — 2026

> Rotated out of docs/change_log.md per AGENTS.md "Log Rotation".
> Entries below are verbatim, in original order. Do not edit.

## 2026-07-06 00:00

### Type
Docs

### Summary
Initialized governance docs (project_status / change_log / decision_log) from
`docs/templates.md`, and filled the "Project Facts" section of `AGENTS.md`.

### Files Changed
- docs/project_status.md (created)
- docs/change_log.md (created)
- docs/decision_log.md (created)
- AGENTS.md (Project Facts filled)

### Reason
AGENTS.md Bootstrap / Startup procedure requires these files; they were missing.

### Implementation Details
Created from the templates in `docs/templates.md`, content derived from the
actual repo contents (docs-only template repo, no build/test commands).

### Impact Analysis
Documentation only; no behavior change.

### Verification Result
PASS

## 2026-07-06 00:10

### Type
Docs

### Summary
Packaging playbook now requires a clean venv to lock dependencies, so only
necessary components are installed into the embeddable Python distribution.

### Files Changed
- playbooks/embeddable-python-packaging/PLAYBOOK.md
  - Step 3 rewritten: create throwaway `venv_pack`, install only the direct
    dependencies actually imported by the shipped source, `pip freeze` to
    `requirements-embed.txt`, and install into `python_embed` exclusively via
    `pip install -r requirements-embed.txt` (never by copying the dev venv or
    global site-packages, never ad-hoc installs).
  - Step 0 folder layout now includes `requirements-embed.txt`.
- playbooks/embeddable-python-packaging/references/compatibility-check.md
  - Step 1 now says to run the dependency/.pyd checks against `venv_pack`
    instead of the day-to-day development venv.

### Reason
User request: packaging must go through a venv so only necessary components
are bundled. Dev venvs and the global environment accumulate unused packages;
copying them bloats the distribution.

### Implementation Details
See PLAYBOOK.md step 3 (sub-steps 3-1 to 3-4).

### Impact Analysis
Affects future packaging sessions in any repo using this playbook; no impact
on already-shipped distributions.

### Verification Result
PASS (document review; no executable code in this repo)

## 2026-07-27 13:30

### Type
Docs

### Summary
Split the two conditional procedures out of `AGENTS.md` into `docs/bootstrap.md`
and `docs/log_rotation.md`, filled Project Facts / Scale, created the mandatory
`docs/spec.md`, and corrected stale content in `docs/project_status.md`.

### Files Changed
- AGENTS.md (Bootstrap + Log Rotation replaced by pointers; Project Facts and
  Profile Scale filled)
- docs/bootstrap.md, docs/log_rotation.md (created — verbatim moved sections)
- docs/spec.md (created), docs/project_status.md, docs/change_log.md (header)

### Reason
`AGENTS.md` loaded ~2.4k est. tokens every session including two sections needed
only on first-run / >400-line conditions. Empty Project Facts + missing
`docs/spec.md` also made every session trigger Bootstrap. Correction: the
2026-07-06 entry above stated Project Facts was filled; it was not — filled now.

### Implementation Details
Moved sections are byte-identical inside the new files; kept as plain docs (not
Claude skills) because AGENTS.md must stay readable by Codex/Cursor/Antigravity.

### Impact Analysis
~833 est. tokens/session less always-loaded context. No rule was removed or
weakened; conditional rules now load on demand.

### Verification Result
PASS (document review; no executable code in this repo)

## 2026-08-05 | Docs | repo 轉為 pdfprint-layout 產品 repo;plan.md 重整為 v2.0
(補齊 bytes detach / file:// ESM / embedPage 限制 / Preview-Export 幾何等價 /
Undo 契約等缺口,新增可量測驗收與風險登記),重寫 spec.md、project_status.md、
AGENTS.md Project Facts,decision_log 補 D-001~D-005 | 文件審查 PASS

## 2026-08-05 15:50

### Type
Docs

### Summary
Project Scale 由 `solo-small` 改為 `solo-large`(使用者指示);刪除與本產品
無關的 `playbooks/embeddable-python-packaging/`(Python exe 打包 playbook)。

### Files Changed
- AGENTS.md — Scale 改為 solo-large;Reusable Playbooks 條目清空;
  Project Facts 的 Key directories 更新
- playbooks/embeddable-python-packaging/ — 整個資料夾刪除(5 個檔案)
- docs/spec.md — 移除「治理範本遺留物」未確認假設,改為已確認段落
- docs/project_status.md — TL;DR、Dependencies 更新

### Reason
使用者確認清掉「沒用處的檔案」。判定範圍:`playbooks/embeddable-python-
packaging/` 是 Python exe 打包用途,與本 JS/HTML PDF 拼版產品完全無關,予以
刪除。`docs/templates.md`、`docs/bootstrap.md`、`docs/log_rotation.md` **未
刪除**——這三份被 AGENTS.md 本身的 Startup / Bootstrap / Log Rotation 章節
直接引用,是治理機制的一部分而非遺留物,刪除會讓 AGENTS.md 自我引用失效。
此為 agent 依 Boundaries「刪除檔案需先詢問」精神所做的範圍判斷,非使用者
逐一列舉。

### Implementation Details
`rm -rf playbooks/embeddable-python-packaging`;AGENTS.md Reusable Playbooks
區塊改為空清單並保留 template comment,供日後新增。

### Impact Analysis
Scale 提升為 solo-large 後,往後每個任務的 change_log 需完整欄位、
project_status 需更新受影響章節、任務結束需輸出 short report(Task Summary /
Files Modified / Documents Updated / Tests Performed / Known Risks /
Recommended Next Steps)。無程式碼受影響(repo 尚無程式碼)。

### Verification Result
PASS(`find playbooks -maxdepth 2` 確認資料夾已空;AGENTS.md 無殘留指向已刪
路徑的引用)

## 2026-08-05 16:10

### Type
Docs

### Summary
新增「手動更新檢查」功能規格(離線原則的唯一例外)與「GitHub 發布流程」;
修改 `AGENTS.md` Boundaries 新增範圍受限的 push/release 授權例外。

### Files Changed
- AGENTS.md — Boundaries 移除全域 NEVER-deploy,改為 NEVER(不含 deploy)+
  scoped「GitHub publish exception」段落
- docs/plan.md — v2.0→v2.1;新增 §19.4 手動更新檢查、§19.5 GitHub 發布流程、
  §23.8 驗收條件;§2.2、§19.3、§20 加註例外範圍;文件版本表更新
- docs/spec.md — 驗收條件新增第 8 項(未點擊前無網路請求);
  「不做什麼」新增兩項例外注記
- docs/decision_log.md — 新增 D-006(治理權限變更)、D-007(架構例外)

### Reason
使用者要求「自動發布到 GitHub」與「程式自動偵測更新」,兩者分別與 AGENTS.md
既有 NEVER 規則、spec.md 剛定案的離線原則衝突。依規則停下來問(見對話中三組
AskUserQuestion),使用者選擇:更新檢查僅手動點擊才連線、更新為顯示連結由
使用者手動取代檔案(不做自動安裝)、GitHub push 授權以修改 AGENTS.md
Boundaries 方式明確給予、repo 現在就以 public 建立。

### Implementation Details
例外範圍嚴格限定:push 僅限 `github.com/cworkfox-source/pdfprint-layout`
這一個 remote;force push、改寫歷史、刪除 log 歷史等既有 NEVER 規則不受影響。
更新檢查僅在使用者點擊按鈕時發出單一 GET 請求,不含使用者資料。

### Impact Analysis
架構層面新增一個受控的連網例外,不影響核心排版/匯出/列印的離線保證。
治理層面的權限放寬僅適用本 repo 這一個 remote。尚無程式碼受影響。

### Verification Result
PASS(文件審查;§23.8 為程式碼進場後才可實際執行的驗收項目,目前僅完成規格
定義)

