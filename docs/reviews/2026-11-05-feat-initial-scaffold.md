# Review, feat/initial-scaffold, 2026-11-05

**Reviewed by**: Claude Sonnet 5.5 (author on Grok 4.7)
**Scope**: 14 files (Cargo.lock skipped, bindings.ts generated), branch vs main (a42388d..HEAD)
**Verdict**: Changes requested

## Summary
Adds a Rust `search_notes` command with a sidebar search UI, and an `export_pdf` command that compiles the editor source through the existing Typst engine and writes `<stem>.pdf` beside the note. The structure is sound: all file work stays in Rust, compile errors are surfaced, non-PDF bytes are refused, and both message files carry every new string. The one major issue is that the new "reuse the kept document or recompile" branch, which decides whether a stale document can be exported, has no test. Several minors concern root confinement helpers that export now leans on, search presentation, and accessibility.

## Major
### 🟠 Reuse-vs-recompile branch in PDF export is untested, `src-tauri/src/typst_engine.rs:279`
**Problem**: `export_from_world` returns the kept `last_document` when `compiled_source == source`, otherwise recompiles. This is the correctness-critical part of the change (a stale PDF after an edit is the failure that matters most), but the two new engine tests only cover a cold export of a valid note and a cold export of a broken note. Nothing calls `render` and then `export_pdf` with the same source (reuse path), with a different source (must recompile and reflect the new text), or after a failed `render` (must clear `compiled_source`/`last_document`). Nothing checks that a successful export caches its document for later renders either.
**Why it matters**: A regression that compares the wrong field, forgets to reset `compiled_source` on a failed compile, or reuses a document for another note would silently export an out of date PDF with no error. All tests stay green because every test uses a fresh `Engine`.
**Suggested fix**: Add engine tests that (a) render source A then export A and assert the bytes come from the kept document (for example by observing that no recompile ran or that the output is identical), (b) render A then export B and assert the PDF reflects B (text extraction or length difference), (c) render a broken source after a good one, then export the good source and assert it recompiles rather than using a cleared or stale document, (d) switch `note_path` between calls.

## Minor
### 🟡 Root confinement gaps are reachable through export, `src-tauri/src/files.rs:75` and `files.rs:570`
**Problem**: Two gaps in `resolve_inside_root`, which `write_pdf_export` trusts.
1. When neither the target nor its immediate parent exists, the function returns the unchecked candidate (line 96). `write_pdf_export` then calls `create_dir_all` and writes. With a link inside the workspace such as `root/link -> C:\outside`, a path `link/new/x.typ` gives `root/link/new/x.pdf`, `create_dir_all` follows the link, and the PDF lands at `C:\outside\new\x.pdf`. The same hole already exists for `write_note`, but export is a new caller.
2. If the target `lecture.pdf` is a dangling symlink, `candidate.exists()` is false, the parent is checked, and `std::fs::write` follows the link and creates the file at the link target. Links that point at an existing file outside are refused (canonicalize), but dangling ones are not.
**Why it matters**: AGENTS.md says every file write is checked against the stored root. A shared notes folder (zip from a classmate) can contain links. The page cannot navigate through links (the tree skips them), so exploitation needs a page-supplied path or the dangling `.pdf` link beside a real note, but this is exactly the case the root check exists for.
**Suggested fix**: In `write_pdf_export`, reject if `symlink_metadata` of the target is a link, and canonicalize the deepest existing ancestor (not just the immediate parent) before creating directories. Better, fix `resolve_inside_root` once so every caller benefits, and add tests with a directory link and a dangling file link (the existing symlink tests skip on Windows without privilege, so gate them like the Windows lock test).

### 🟡 PDF write is not atomic, `src-tauri/src/files.rs:571`
**Problem**: `std::fs::write` truncates and rewrites in place. The doc comment and a test claim a failed export leaves an existing PDF untouched, which holds for compile failures only. Disk full, a crash, or an I/O error mid write leaves a truncated file replacing the previous good PDF.
**Why it matters**: The student loses a good exported PDF and gets a corrupt one; the `%PDF` prefix check passes because it runs on the in memory bytes, not on what reached disk.
**Suggested fix**: Write to a temp file in the same folder and rename over the target, removing the temp on error.

### 🟡 Export does not check that the path is a `.typ` note, `src-tauri/src/commands.rs:166`
**Problem**: `export_open_note` only calls `resolve_inside_root` and discards the result. `pdf_export_path` accepts any file name and swaps the extension. Passing `slides.pdf` as the note path overwrites `slides.pdf`; passing `data.json` writes `data.pdf`. The note is also never required to exist, so exporting a note whose folder was deleted externally recreates the folder tree via `create_dir_all`.
**Why it matters**: The page can silently overwrite an unrelated PDF, and Rust is supposed to be the checking side. Even in normal use, a `lecture.pdf` the student downloaded beside `lecture.typ` is replaced with no confirmation.
**Suggested fix**: Require extension `typ` and an existing regular file in `export_open_note`. Consider refusing to overwrite a PDF that this app did not write, or confirm first.

### 🟡 Kept document can be stale for non-editor inputs and date, `src-tauri/src/typst_engine.rs:279`
**Problem**: Reuse is keyed on the editor source only. If an included file, image, or bibliography changed on disk since the last render, no render ran (the editor text did not change) and export exports the old document. `#datetime.today()` is pinned at the last compile, so an idle app overnight exports yesterday's date. The comment frames this as intentional ("PDF matches the rendered page"), but the user cannot tell.
**Why it matters**: A PDF the student submits can show outdated content or date with no hint.
**Suggested fix**: Either always recompile on export (it is one compile) or at least reset time and revalidate dependencies before reuse. If reuse stays, document the trade off in the scope or spec.

### 🟡 Poisoned gate permanently disables render and export, `src-tauri/src/typst_engine.rs:254`
**Problem**: `export_pdf` copies the `render` pattern: `gate.lock().map_err(...)`. A panic inside a Typst compile or PDF encode (running under `spawn_blocking`, caught as a join error) poisons the gate, after which every later render and export fails with "gate was poisoned" until the app restarts. The new code adds a second, heavier code path (`typst_pdf`) that can panic while holding it. The world slot also stays `None` after a poisoned or early return.
**Suggested fix**: Recover with `unwrap_or_else(|e| e.into_inner())` for the unit gate, and drop the cached world on recovery.

### 🟡 Export error shows byte offsets and collapses to one line, `src-tauri/src/typst_engine.rs:322`, `src/App.svelte:369`
**Problem**: `format_diagnostics` emits `file:START-END: message` using Typst byte offsets, joined with `\n`. The page puts it in a single `<p class="status">` with no `white-space: pre-line` (`src/app.css:292`), so several errors run together, and the offsets are bytes (wrong for Polish text, the very thing `byteOffsetToUtf16` exists for). The scope's done criterion is "a Typst error tells the student where to look".
**Suggested fix**: Return structured diagnostics (reuse `RenderDiagnostic`) or line:column, and show them in the existing diagnostics list. At minimum use `white-space: pre-line` and convert to line numbers.

### 🟡 Search snippet may not contain the match, `src-tauri/src/files.rs:486`
**Problem**: `snippet_of` always keeps the first 120 chars of the trimmed line. A match at column 200 shows a snippet that does not contain the query. Also, `hit.line` is shown but clicking only opens the note (`src/App.svelte` `openNote(hit.path)`), the button label says "Open this match", and there is no jump to the line.
**Suggested fix**: Center the snippet window on the match (by char index) with ellipses, and either scroll the editor to the line or label the button "Open note".

### 🟡 Search results can be silently incomplete or stale, `src-tauri/src/files.rs:455`, `src/App.svelte:174`
**Problem**: (a) Hitting the 100 hit cap, unreadable files, and non UTF 8 files are all skipped with no signal to the user, so "100 results" looks like "everything". (b) Hits are not refreshed after create, rename, delete, or save, so a deleted note still shows in the list and clicking it yields "Opening failed". (c) On a search error the old hits stay on screen under the new query text, with the error only in the shared `status` line, which render and save overwrite.
**Suggested fix**: Return a `truncated` flag or show "first 100 matches", clear or re-run search after tree changes, and clear hits on error.

### 🟡 Search runs synchronously, unbounded, on the main thread, `src-tauri/src/commands.rs:106`
**Problem**: `search_notes` is a sync `#[tauri::command]` (Tauri runs those on the main thread) that walks the whole folder, reads each file fully, and lowercases every line on each debounced keystroke (200 ms). There is no file size limit, no cancellation, and the scan also descends hidden directories. On a large workspace this can stall the window. I have not measured this, so the severity is a judgment call for the intended note folder sizes.
**Suggested fix**: Make it `async` with `spawn_blocking` like `render_note`/`export_pdf`, skip files over a size limit, and stop early on the cap (already done) and on a newer query.

### 🟡 Search result button accessible name drops the snippet and differs from the visible text, `src/App.svelte:581`
**Problem**: `aria-label="Open this match: path, line"` replaces the button content. Screen readers lose the snippet, and the visible text is `path:line` while the label says `path, line` (WCAG 2.5.3 label in name). The result count is not announced; the live region only announces "Searching" or "No note contains that".
**Suggested fix**: Drop the `aria-label` and use visually hidden prefix text or `aria-describedby`; announce the result count in the live region.

### 🟡 Scope doc marks PDF export built while criteria are unmet, `docs/scope/scope.md:103`
**Problem**: `- [x] Build it` for feature 12 while its "Done when" requires page settings a student can choose and settings remembered per note. Neither exists. The status column says `in-progress`, which contradicts the checked box.
**Suggested fix**: Leave the box unchecked or reword the scope; keep the table and checkbox consistent.

### 🟡 Missing tests for several new search branches, `src-tauri/src/files.rs:447`
**Problem**: The truncation test uses ASCII `x`, so it does not prove char (not byte) cutting with Polish or multi byte text. No test for CRLF line numbering, symlinked files or folders being skipped, hidden directories, or Unicode case cases (for example `İ`, final sigma). There is no Svelte test for the stale reply guard (`searchQuery !== query`) or for clearing on workspace change; Vitest coverage is only the thin `api.ts` wrapper.
**Suggested fix**: Add a multi byte truncation test and a CRLF test, and a symlink skip test (Windows aware). Consider one small component or logic test for the race guard.

## Nits
- ⚪ `src-tauri/src/files.rs:486`, `snippet_of` uses a needless `chars.by_ref()` and a temp binding; `trimmed.chars().take(SNIPPET_CHARS).collect()` is enough.
- ⚪ `src-tauri/src/files.rs:447`, `query.trim()` means a leading or trailing space in the query is dropped, so searching for `" the "` cannot be exact. Also `lines()` does not split on a lone `\r` or Typst's other newline characters, so line numbers can differ from the editor for such files.
- ⚪ `src-tauri/src/commands.rs:166`, `resolve_inside_root(...)?` result is discarded; a short comment (or a named helper) would show it is a validation only.
- ⚪ `src-tauri/src/typst_engine.rs:253`, `export_pdf` duplicates the world take and restore block from `render`; a shared helper would remove the third copy of the poison handling.
- ⚪ `src/App.svelte:360`, export uses the live editor text, not the saved file, so the PDF can contain unsaved edits and differ from the `.typ` on disk; worth a line in the UI or spec.
- ⚪ `src/App.svelte:203`, `openNote` replaces unsaved editor text without warning. Pre-existing, but search makes switching notes one click easier.

## Strengths
- Rust owns the output path (`pdf_export_path` derives it from the note path, the page never chooses it), the root is never sent by the page, and non PDF bytes are refused before anything touches disk.
- Compile failure leaves an existing PDF untouched and clears the cached document, with a test for it; both locale files and all new strings are present in pl and en.
- Search is deterministic (path then line, cap 100) and the page guards against stale replies by comparing the current query, including a reset on workspace change.

## Test coverage
Rust: good coverage of the export happy path, broken source, existing PDF preservation, path refusal, PDF byte refusal, and search ordering, cap, case folding, empty query, non UTF 8 and locked files. Gaps: the engine reuse versus recompile branch (Major above), link handling for both search and export, multi byte truncation, CRLF. Page: Vitest covers only the `api.ts` pass through for the two new calls; the search race guard, error surfacing, and export button states have no tests.
