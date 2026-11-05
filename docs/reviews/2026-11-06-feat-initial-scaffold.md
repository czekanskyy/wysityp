# Review, t3/ff14492c (integrated feat/initial-scaffold), 2026-11-06

**Reviewed by**: Claude Opus 5.5 (author on Grok 4.7 builders, integrated by a different model)
**Scope**: 22 files, branch `9906769..HEAD` (features 9 and 10, spec 0002 docs, spec 0003 renumber, atomic write fix)
**Verdict**: Blocked

## Summary

This range adds autosave with a Rust held save baseline and an external change guard (feature 9), recent notes and three built in templates (feature 10), the rendered page editor spec, and atomic writes for notes and settings. The Rust side is careful and well tested: the baseline lives only in Rust, the page never sends a root or a fingerprint, paths are checked against the stored root, and the settings file keeps `locale` as the only language field. The headline problem is on the page, where the separate builders could not see each other: creating a note from a template skips the whole note switching protocol that feature 9 built, so unsaved typing in the open note is silently dropped. A second cross feature problem is that a failure to record a recent note now makes opening or creating a note fail.

## Blockers

### 🔴 Creating from a template drops unsaved edits of the open note, `src/App.svelte:451`

**Problem**: `createFromTemplate` changes `currentPath` and calls `editor.setText` directly. It does not call `settleBeforeLeave` first, and it does not go through `applyLoadedNote`. So `noteEpoch` does not rise, the pending autosave timer is not cancelled, `savePhase` and `conflict` carry over from the previous note, and `sourceText` is not refreshed. Every other note switch (`openNote`, `createSample`, `createEntry`, `openFolder`) settles first.

**Why it matters**: You type in lecture A, then within the 750 ms autosave pause (or at any time while A is `unsaved`, in conflict, or after a failed save) you click a template. The pending ticket for A then fires, `shouldRunSave` sees that the open path is now the template path, and skips it. A's typing is gone, with no warning, which breaks the feature 9 promise that nothing already typed is lost. Further effects: if A was in conflict, the conflict banner now sits on the new template note; if a save of A was in flight, its result is dropped and `savePhase` stays `saving` on the new note, which also switches off the focus check in `onWindowFocus` until the next keystroke. `editor.setText` suppresses `onChange`, so nothing resets the state afterwards.

**Suggested fix**: Make the template path follow the same protocol as `createSample`: `await settleBeforeLeave()` and stop if it returns false, then after Rust returns the note, clear pages and diagnostics and call `applyLoadedNote(note)` before rendering. Add a page level test (see Test coverage) that switches notes by every route while an autosave is pending.

## Major

### 🟠 A failure to record a recent note fails opening and creating notes, `src-tauri/src/commands.rs:44`

**Problem**: `open_note`, `create_note`, `create_from_template`, and `create_sample_note` all call `remember_opened(...)?` after the real work. `record_recent` loads and rewrites `settings.json`. Any error there (settings file with broken JSON, settings not ready, the atomic rename of `settings.json.tmp` refused by antivirus or a sync tool on Windows) turns into an error from the command.

**Why it matters**: Before this range, a damaged settings file did not stop a student from opening notes. Now every note open fails with an unrelated settings error. Worse, for the create paths the file has already been written to disk and the baseline already remembered when the error comes back, so the page shows "The template did not create a note" or "action failed" for a note that exists, and a retry produces `lecture-2.typ`. Spec 0003 asks that a bad recent entry is dropped "and the app does not crash"; the same spirit applies to recording.

**Suggested fix**: Treat recording as best effort. Log or ignore the `record_recent` error in these commands and still return the note. Keep strict errors only in `list_recent`, where the page already shows `recent_failed`. Add a command level test with a broken settings file that still opens a note.

### 🟠 Closing the window, or killing the app, loses up to the last 750 ms of typing, `src/lib/noteSafety.ts:2`

**Problem**: Saves happen only after a 750 ms pause (`AUTOSAVE_WAIT_MS`). There is no flush on window close (no `onCloseRequested`, `beforeunload`, or Rust side close hook anywhere in `src/` or `src-tauri/src/`) and no crash journal. The scope still ticks feature 9 Build as done (`docs/scope/scope.md`, feature 9).

**Why it matters**: The feature 9 Done when says "killing the app mid sentence loses nothing already typed" and the description promises to "recover gracefully after a crash". A student who types the last words of a sentence and immediately closes the window loses them. That is a common habit at the end of a lecture.

**Suggested fix**: At minimum, flush on close: listen for the Tauri close request, cancel the timer, run `settleBeforeLeave`, and only then allow the close (with the conflict banner kept visible if it refuses). For the kill case, either write a small recovery copy on every change (Rust side, outside the note file, so the Typst source stays the truth) or record in the scope or a spec that a sub second window is accepted. Until one of those lands, the feature 9 Build checkbox overstates what is met.

### 🟠 The note switching and save logic in `App.svelte` has no tests, `src/App.svelte:201`

**Problem**: The pure helpers in `noteSafety.ts` are well tested, but the orchestration that decides when they are called (`enqueueSave`, `runSave`, `settleBeforeLeave`, `applyLoadedNote`, and every switch route) is untested. That is branching logic around data safety.

**Why it matters**: The blocker above lives exactly in that untested layer. Each new route that changes the open note (search hit, recent note, template, future features) can repeat the mistake.

**Suggested fix**: Pull the open note state and the switch protocol into a small store module (for example in `noteSafety.ts`) with one `switchTo(loader)` entry point that every route uses, and test it with Vitest against mocked `api` calls: pending autosave then switch, conflict then switch, save in flight then switch, and failed save then switch.

## Minor

### 🟡 Atomic write has no flush to disk and no retry for Windows locks, `src-tauri/src/files.rs:633`

**Problem**: `write_atomically` writes the temp file with `std::fs::write` and renames it without `sync_all`. On NTFS the rename can reach the journal before the data, so after a power loss the note can be empty or garbage. Separately, on Windows `std::fs::rename` (MoveFileEx with replace) fails with access denied or a sharing violation while another program (OneDrive, Dropbox, antivirus, a Typst preview) briefly holds the target, and the code gives up at once.

**Why it matters**: The fix protects against an app crash but not a power cut, and transient locks are common in student folders that sync to the cloud. A failed save also traps the student on the note (next finding).

**Suggested fix**: Open the temp file, write, call `sync_all`, then rename. Retry the rename a few times with a short pause when the error is access denied or a sharing violation.

### 🟡 A failed save that is not a conflict leaves no way to leave the note, `src/App.svelte:255`

**Problem**: `settleBeforeLeave` returns false whenever the phase is not `saved`. If the save keeps failing for a reason other than an external change (disk full, permissions, a locked file), opening another note, opening a folder, or creating a note does nothing, and only the status line explains why.

**Why it matters**: The safe default is right, but there is no escape route like the conflict banner offers (no "keep trying" or "leave without saving" choice).

**Suggested fix**: Show the save failure next to the save state with a retry button and an explicit "leave without saving" confirm, mirroring the conflict banner.

### 🟡 Typing while a note is being opened is lost, `src/App.svelte:435`

**Problem**: After `settleBeforeLeave` succeeds, `openNote` (and `createSample`, `createEntry`) awaits a Rust call. Keystrokes in that window mark the old note `unsaved` and schedule an autosave, which `applyLoadedNote` then cancels before replacing the text.

**Why it matters**: The window is short, but on a large folder or a slow disk a few characters can vanish.

**Suggested fix**: After the Rust call returns, check whether `noteRevision` moved since the settle and settle again before applying the new note, or make the editor read only while a switch is in flight.

### 🟡 A failed delete leaves the open note without autosave, `src/App.svelte:585`

**Problem**: `confirmDelete` cancels the autosave timer before `deleteEntry`. If the delete fails, the note stays open and `unsaved`, but no autosave is scheduled until the next keystroke.

**Suggested fix**: In the catch path, call `scheduleAutosave()` when the note is still open and unsaved.

### 🟡 Recent notes do not follow a rename, `src-tauri/src/commands.rs:114`

**Problem**: `rename_entry` retargets the save baseline but not `recent_notes`, so a renamed or moved note silently drops out of the recent list on the next `list_recent`.

**Suggested fix**: Retarget the recent paths the same way `NoteBaselines::retarget` does, and add a test.

### 🟡 Scope marks feature 9 built while its Done when is not met, `docs/scope/scope.md:98`

**Problem**: Feature 9 has `[x] Build it` but the crash and close guarantee is not met (see the Major above), and there is no spec recording the 750 ms window as accepted.

**Suggested fix**: Leave the box unticked, or add a short assumed decision spec like 0003 that records the accepted window.

## Nits

- ⚪ `src-tauri/src/files.rs:635`, the fixed temp name `note.typ.tmp` would overwrite a student file with that exact name, and a crash leaves it in the synced folder. A name with a random part, or a dot prefixed name the tree already hides, is safer.
- ⚪ `src-tauri/src/settings.rs:112`, `list_recent` rewrites the settings file while listing. A read that writes is surprising; consider cleaning only on `record_recent`.
- ⚪ `src-tauri/src/files.rs:24`, `Note.fingerprint` is sent to the page but the page never reads it. Harmless, but it widens the contract for no use.
- ⚪ `src-tauri/src/settings.rs`, `workspace_key` stores the absolute, lowercased root path in `settings.json`. That fits spec 0003, but it is worth one line in the spec that the settings file now holds a folder path.

## Strengths

- The save baseline lives only in Rust, and the page cannot vouch for a file it did not read. A save with no baseline or a missing file is refused, and `force` is the only override. This is a sound design.
- `changed_on_disk` never adopts outside bytes as the baseline, and the test proves it.
- The settings file keeps `locale` as the only language field, an old file without `recent_notes` loads unchanged, and changing the language keeps recent notes. All tested.
- Templates never overwrite: `create_new_note` uses `create_new(true)`, and the name search stops at 100 tries. Paths outside the root are refused and tested.
- `bindings.ts` matches the Rust commands (`save_note` with `force` returning `NoteFingerprint`, `note_changed_on_disk`, `list_recent_notes`, `create_from_template`), and every new string exists in both `messages/pl.json` and `messages/en.json`.
- Spec numbering is consistent: 0002 is the rendered page editor, 0003 is recent notes and templates, and the scope links resolve.

## Test coverage

Rust coverage is good: baselines (save, refuse, force, retarget, forget, missing file, outside root), atomic replace without a leftover temp, fingerprint, recent notes order, dedup, cap, stale and escaping entries, other folder refusal, old settings files, and templates (free name, body shape, outside root, nested folder). Page coverage is limited to the pure helpers in `noteSafety.ts` and thin `api.ts` pass throughs. Untested: the `App.svelte` switch and save orchestration (where the blocker lives), the command layer interaction between recording a recent note and opening a note, and atomic write failure paths (rename refused, temp left behind).
