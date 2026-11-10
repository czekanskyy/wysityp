# 0003. Recent notes and templates

**Date**: 2026-11-06
**Status**: In Progress

## Summary

Your recent notes and the three ready made templates live in small, plain places you can inspect. Recent notes sit in the same settings file as your language, with one short list for each folder you open. Templates are Typst text held in the app itself, and using one writes a new plain Typst file in your folder and never writes over a note that is already there.

Spec 0006 replaces the template home and the template note names below. Recent notes in this spec stay as written.

## Context

Feature 10 shipped on an assumed decision recorded by `/develop`, because scope feature 3 (the data model) is still planned and no home for recents or templates had been chosen. The build put recents in the settings JSON and templates in Rust strings. One part of that build is wrong for real use: the settings file holds one list for one folder, so opening a second folder and a note there wipes the first folder list. A student with a folder per subject loses a list by visiting another subject. The rest of the assumption has held up in review: the file loads when the field is missing, the language field is untouched by recency, and a broken settings file must not stop a note from opening.

## Requirements

**User stories**:

- As a student, I want yesterday lecture to be one or two clicks away, so that I can pick up where I left off.
- As a student with a folder per subject, I want each folder to keep its own recent list, so that visiting one subject never erases another.
- As a student, I want a lecture, a problem set, and a lab note ready made, so that a new note starts with the right shape.

**Acceptance criteria**:

- **AC-1**: Opening, creating, using a template for, or making the sample of a note records it. The sidebar lists recent notes for the open folder, newest first, at most 10, with duplicates collapsed. Paths compare after slashes are made forward and case is folded (the same file under a different case or slash spelling counts once on Windows); the newest spelling is kept, at the front, and the tail past 10 is dropped.
- **AC-2**: Each opened folder keeps its own list. Opening another folder shows that folder list (empty when none), and the first folder list is unchanged when you come back.
- **AC-3**: An entry that no longer exists, or that climbs out of the open folder, is dropped from that folder list. The app does not crash, and nothing outside the folder is read or written. Listing returns the cleaned paths even when writing the cleaned list back fails. That write failure is not shown to the student; the list is cleaned again on the next read. The `recent_failed` message (in both message files) is shown only when the list cannot be read at all, for example a broken settings file or a recents value that is neither accepted shape. Nothing else changes.
- **AC-4**: A rename or a move retargets recent entries for the open note and for notes inside a renamed folder, the same retarget the save baseline does. Only the open folder list is touched and every other folder key is left as stored. A failed recents write never changes the rename result, which stays the file command result.
- **AC-5**: Recording a recent note is best effort. A broken or locked settings file never fails opening, creating, templating, or sampling a note. Reading the recent list itself may report its error in the sidebar.
- **AC-6**: The three built in templates (a lecture, a problem set, a lab note) each create a new plain `.typ` file inside the open folder through Rust only. The body is ordinary Typst whose first line is a title placeholder, and the words follow the stored language.
- **AC-7**: A template never overwrites. The default names are `lecture.typ`, `problem-set.typ`, and `lab.typ`; when a name is taken the next free name is used. The tries are the plain name, then the numbered forms up to 100 (`lecture-2.typ` to `lecture-100.typ`, and the same for the other stems). When all 100 exist, the command refuses with the existing path refusal error and writes no file. The status line shows the path that was written.
- **AC-8**: A settings file written before this spec still loads. The old shape is a `recent_notes` object with a `workspace` string and a `paths` list of paths counted from the root. That folder value becomes a map key by the same rule as the stored root (made absolute, slashes forward, no trailing slash, no `\\?\` prefix, lowercased), and its list becomes that folder list, with entries stored counted from the root with forward slashes. A file with no recents field, or an old shape with no folder value, loads with an empty map. The language in the file is unchanged.
- **AC-9**: The page never sends the workspace root and never receives a folder path. It receives only paths counted from the root.
- **AC-10**: The recents value is accepted in exactly two shapes: the old object above, or an object with a `workspaces` map from folder identity to a path list. Any other recents value keeps `locale` and the font fields (spec 0002, AC-12), uses an empty map, and is reported only by the recent list read. On every read, bad entries drop, case duplicates collapse, and each list is cut to 10. When `workspaces` is present it is the whole map; nothing is merged from anywhere else. Every writer of the settings file (recents, language, fonts) loads the file first, changes only its own fields, and writes through the existing atomic write, so one save can never drop another field.

## Options considered

### Option 1: Recents in the settings JSON, one list per folder; templates as strings in Rust

The file the app already writes gains a map from folder identity to a short path list. Templates stay text in Rust.

**Pros**:

- One small file the student can open and read, beside the language they already know lives there.
- Nothing new is written into student folders, so other tools see only notes.
- Old settings files keep working with a small shape step.

**Cons**:

- The settings file grows a little with each new folder a student ever opens.
- Templates cannot be edited by the student.

### Option 2: A separate recents JSON file in the app config folder

**Pros**:

- The settings file stays about settings only.

**Cons**:

- A second file to find, with the same content and the same writer, and no gain for the student.
- Two files can disagree about which app state is current.

### Option 3: Recents and templates inside each notes folder

**Pros**:

- They travel with the notes to another machine.

**Cons**:

- The app writes its own files into folders of plain notes, which other tools and sync tools then carry around.
- A folder of notes a student already owns gains files they never made.

### Option 4: Template files in the app config folder

**Pros**:

- A student could edit a template.

**Cons**:

- An upgrade must not clobber edited templates, which is a second small feature.
- No student has asked to edit one yet. This can come later without moving recents.

## Decision

**Chosen option**: Option 1: recents in the settings JSON, one list per folder; templates as strings in Rust

Ratified on 2026-11-06. The one correction to the shipped build is AC-2: the file holds a small map, one list per folder, not one list overall. Everything else the build assumed is confirmed as built, including best effort recording (AC-5).

AC-3 was amended on 2026-11-06 after verify found the two halves could not both hold with the unchanged command shape. The cleaned list shown is correct and only its persistence is deferred, so a warning would be a false alarm; the list is cleaned again on the next read, in the same best effort spirit as AC-5, and a settings file that stays unwritable still surfaces when the student saves language or fonts through the same atomic write.

**Implementation skills**: `vitest` (`antfu/skills`, `.agents/skills/vitest/`) · `svelte-code-writer` (`sveltejs/ai-tools`, `.agents/skills/svelte-code-writer/`)

## Rationale

The settings file is the one place the app already writes beside the notes, the student can read it, and Rust already guards every write of it with the atomic write. Keeping recents there costs no new home on disk, which matters while feature 3 is still open. The per folder map fixes the only real harm found, a wiped list, with a small change in one Rust file. Templates as strings keep the promise that a folder holds only student notes, and an editable template home can be added later without moving anything the student can see.

## Feature design

**Data model sketch**:

The settings file (`settings.json` in the app config folder, written by Rust only):

| Field | Required | Meaning |
|---|---|---|
| `locale` | yes | The app language, `pl` or `en`. The only place language lives. |
| `recent_notes.workspaces` | no, defaults to empty | A map from folder identity to that folder list of paths counted from the root, newest first, at most 10 each. |
| folder identity | (a map key) | The canonical folder path, slashes forward, lowercased. It stays in the file and never goes to the page. |

No other file changes. Templates are three Typst strings per language in `src-tauri/src/templates.rs` (six bodies: three kinds, Polish and English words).

**State transitions**:

Opening a note moves its path to the front of the open folder list. A rename retargets entries. Listing drops entries that fail the checks in AC-3 and writes the cleaned list back.

**API surface**:

| Call | Kind | Key inputs | Key outputs | Who | Key errors |
|---|---|---|---|---|---|
| `list_recent_notes` | Existing Tauri command | none (Rust holds the root) | Paths counted from the root, newest first | The open app | A broken settings file is reported by this call only |
| `create_from_template` | Existing Tauri command | parent (counted from the root), template kind | The created note (path, text, fingerprint) | The open app | A path outside the folder is refused; a taken name is never an error, the next free name is used |
| `open_note`, `create_note`, `create_sample_note` | Existing Tauri commands | as today | The note | The open app | Recording a recent note adds no error to these calls |

**Value sourcing**:

| Action | Value produced or displayed | Source |
|---|---|---|
| Show the recent list | The paths, in order | The map entry for the stored root, cleaned by AC-3 in Rust |
| Record a note | Which list, and the path at its front | The stored root in Rust names the list; the note path the command just opened or created names the entry |
| Refuse another folder list | Whether a list belongs here | The canonical stored root, compared in Rust with the map key |
| Make a template note | The body words | The template kind plus the `locale` Rust reads from the settings file. The page sends no language |
| Make a template note | The file name written | The first free name from `lecture.typ`, `problem-set.typ`, or `lab.typ`, then the numbered forms, checked with a create that fails when the file exists |
| Show what was written | The status line path | The path on the note the command returns |

**Key invariants**:

- Typst source is the truth. Templates become plain `.typ` files and are notes from then on.
- The page never touches disk and never sends the root. Every file action is checked in Rust against the stored root.
- The `locale` field stays the only place language lives.
- Every app string exists in both `messages/pl.json` and `messages/en.json`.

**Security model**:

One student, one opened folder, no accounts. Paths that climb out of the folder are refused before any read or write, and symlinks that leave the folder are refused by the same root check as every other command.

**Configuration required**:

None. No new setting the student must make, no variable, no secret.

**Critical test scenarios**:

- Happy path: open three notes in two folders in turn, and each folder shows its own list in the right order. Verifies **AC-1**, **AC-2**.
- Failure case: break the settings JSON, then open and create notes; both work, and only the recent list read reports a fault. Verifies **AC-5**.
- Migration case: a settings file in the old single list shape loads, keeps its list for its folder, and keeps its language. Verifies **AC-8**.
- Template case: use the lecture template twice in one folder; the second note is `lecture-2.typ` and the first file is byte for byte as it was. Verifies **AC-6**, **AC-7**.

## Build plan

Skateboard: the shipped feature already works end to end. One slice corrects the list shape and proves the migration, and nothing else moves.

1. Change `recent_notes` in `src-tauri/src/settings.rs` to the per folder map. Reading accepts the two shapes in AC-10 and the missing field, and normalizes on read (bad entries out, case duplicates collapsed, 10 per list). Recording, listing, cleaning, and retargeting work per folder, and one settings loader serves the recents, language, and font writers. Rust tests cover two folders in turn, the old shape, a third shape, the missing field, case duplicates, and the cap per folder, satisfies **AC-1**, **AC-2**, **AC-3**, **AC-4**, **AC-8**, **AC-10**
2. Confirm the shipped behaviour this ratification confirms stays as built: recording stays best effort, templates keep their names, words, and no overwrite rule, and no page change is needed. The commands keep their shapes and `src/bindings.ts` is regenerated only if Rust signatures move (they do not), satisfies **AC-5**, **AC-6**, **AC-7**, **AC-9**

## Consequences

**Positive**:

- A folder per subject keeps a recent list per subject, which matches how students file lectures.
- There is still exactly one settings file to inspect, back up, or delete.

**Negative / tradeoffs**:

- The map keeps a list for every folder ever opened. It grows slowly and has no cleanup yet. Ten short paths per folder keeps this small for years of study.
- Templates stay fixed. A student who wants their own template shape edits the note after creating it.

**Neutral**:

- Feature 3 (the data model) can still move this file later. The shape here is plain JSON with a version free layout, so a move is a small loader change, not a rescue.

## Migration plan

**Strategy**: no migration needed as a separate step. The loader accepts both shapes from the first run of the new code.

**Phases**:

1. The loader reads the old shape into the map under the folder it names. The next write stores the map shape.

**Rollback**: reverting the code is safe. The old loader ignores what it does not know only when the field shape matches what it wrote, so a rollback after a map write needs the old file kept in mind: the worst case is the recent list starts empty. Notes and the language are never at risk.

**Risks**: a settings file hand edited into a third shape reports itself broken, as it does today.

## Follow-up

- [ ] Feature 3 (the data model) may reopen where recents and templates live. This spec is the home until then, and its loader shape makes a move small.
- [ ] The map has no cleanup for folders a student deletes. Add pruning only if the settings file ever grows past a size a student would notice.
