# Verify: Data model · spec 0006 · updated 2026-11-09
_Steps derived from spec 0006 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

## UI / manual

- [x] Open a folder of Typst files you already have. Every file stays where it is, still a plain `.typ` file. The sample file stays `wysityp-sample.typ`. → AC-1
- [x] In an empty notes folder, start a blank note from the sidebar and from the start surface. The file is `unsaved.typ`. Put a file, a folder named `unsaved-1.typ`, or a folder `unsaved-1.assets` in the way, and start again. The next free name from `unsaved-1.typ` through `unsaved-99.typ` is used. The comparison ignores case. An empty selected place is the notes folder itself. → AC-2
- [x] Take every name from `unsaved.typ` through `unsaved-99.typ`. Start a note. The page shows `note_names_exhausted`. Nothing new is written. → AC-2
- [x] With language Polish, a blank note is `= Tytuł` and a newline. With language English, a blank note is `= Title` and a newline. If `settings.json` cannot be read, the create fails with the existing settings error and writes nothing. → AC-3
- [x] Start a note from a shipped template and from one of yours. The note copies that template's text once and stores no template id. A later edit to the template leaves the note as it was. → AC-3
- [x] On the start surface the shipped group is first, then yours. Shipped cards use the stem labels. Yours cards show the file name, including `.typ`. Each shipped card has Start a note and Make a copy. Each yours card has Start a note and Edit the file. Make a copy opens that copy. A shipped file is never opened for editing. → AC-4
- [x] Change the language. Shipped stems and the labels refresh. Your file names stay spelled as on disk. While a template is open, the title is `template_editing` with the file name, including `.typ`. → AC-4
- [x] In `templates/` next to settings, add a readable `.typ` file, a file that is not valid UTF-8, a subfolder, a name that starts with a dot, and `CON.typ`. The list keeps only the readable `.typ` names, sorted without regard to case, spelled as on disk. → AC-5
- [x] When `templates/` cannot be created, the shipped stems are still listed, yours is empty, and the page shows `template_folder_unavailable`. → AC-5
- [x] Put `lecture.typ` in your templates. It is listed under yours, and the shipped lecture stem is still listed under shipped. → AC-6
- [x] Make a copy of a shipped template. The names tried are `{stem}.typ`, then `{stem}-2.typ`, through `{stem}-100.typ`. The copy opens in the editor and is not added to recent notes. If an open note cannot be saved, the copy command is not called and nothing is written. When every copy name is taken, the page shows `template_names_exhausted` and nothing is written. The shipped text is unchanged. → AC-7
- [x] Open a template, change that file on disk, then focus the window. The page treats it as the same conflict as a note. Autosave waits the same pause as notes (750 ms). Save without force is refused with `external-change:`. Save with force writes the file. → AC-8
- [x] With a template open, the tree marks no note. With a notes folder open, search still searches notes and the preview renders the editor buffer. PDF export shows `pdf_needs_note` and writes no PDF. With no notes folder, the preview stays empty and render is not called. Switching folder settles the template first. If that save is blocked, the folder stays. If it succeeds, the template stays open and the preview uses the new folder. → AC-9
- [ ] There is no paste button in this build. `save_note_image` for an existing `.typ` note creates `{stem}.assets` if needed and does not change the note text. An empty name writes `image.png`, then `image-1.png` through `image-99.png`. A provided name keeps its spelling, and a clash inserts `-1` through `-99` before the extension. The page shows `image_refused` when the command returns `image-refused:`. A refusal writes nothing. → AC-10
- [x] Rename `unsaved.typ` to `lecture.typ` when `unsaved.assets` exists. The assets folder moves first. `{oldStem}.assets/` becomes `{newStem}.assets/` only at the start of the file or when the character just before it is `"` or `'`. A slash alone is not enough. If the new note or the new assets folder already exists and is not the same item, nothing moves. That includes a leftover assets folder when the note has none. If the note is open, the editor reloads so the buffer matches the file. Bytes that are not valid UTF-8 still rename, and the text rewrite is skipped. Delete the note and the assets folder and any PDF remain. The tree hides a folder whose name ends in `.assets`, and those folders cannot be renamed or deleted from the tree. Deleting a parent folder still removes them. Renaming a folder does not rewrite note text. → AC-11
- [x] After these commands there is no search index file, no sidecar beside a note, and no new field in `settings.json`. Recent notes stay as spec 0003. The open folder is not stored for the next launch. The page never sends the notes folder or the config folder. → AC-12
- [x] A template name or an image name that would leave its folder is refused and writes nothing. Copy and save write only inside `templates/`. They never write a shipped file inside the app. Image writes and new notes stay inside the notes folder. → AC-13

## Commands

- [x] `bun run rust:test` → a blank note uses `unsaved.typ`, then `unsaved-1.typ`, and stops after 100 names with nothing more written. A leftover `{stem}.assets` folder blocks that name. A missing or unreadable settings file fails the create and is not rewritten. A template note is named `unsaved` and copies the body once. A user template copies its own text. → AC-2, AC-3
- [x] `bun run rust:test` → `list_templates` returns the shipped stems and your `.typ` files, with no bodies and no absolute paths. A copy uses `{stem}.typ`, then `{stem}-2.typ`, and does not change the shipped text. A name that leaves the templates folder writes nothing. Saving a template refuses a disk change until force. → AC-4, AC-5, AC-7, AC-8, AC-13
- [x] `bun run rust:test` → an empty render path compiles the buffer and includes from the notes folder, and does not leave `.wysityp-buffer.typ` on disk. → AC-9
- [x] `bun run rust:test` → `save_note_image` writes beside the note and refuses a bad file without leaving an empty assets folder. An assets path that is a file blocks the write. Rename moves the assets folder and rewrites a quoted path. A leftover assets folder blocks the rename. Deleting a note leaves its assets folder, and the tree hides it. → AC-10, AC-11, AC-13
- [x] `bun run test` → creating from a template calls `createFromTemplate` with kind `shipped` or `user` and a name, and the note path is an `unsaved` name. → AC-3, AC-4

## Value sourcing

- [x] New note name → the first free name from `unsaved.typ` through `unsaved-99.typ`. A file, a folder, or `{stem}.assets` blocks it, compared without regard to case. `Unsaved.typ` blocks `unsaved.typ`. An empty parent is the notes folder. → AC-2
- [x] Names exhausted → the name loop found no free name. Notes return `note-names-exhausted:`. Template copies return `template-names-exhausted:`. Nothing is written. → AC-2, AC-7
- [ ] Image refused → the checks in AC-10. A bad name is refused before the assets folder is created, so a refusal leaves no empty folder. The page maps the `image-refused:` prefix to `image_refused`. → AC-10
- [x] Template changed on focus → `template_changed_on_disk` compares the template fingerprint map with the file in `templates/`. A note with the same file name does not satisfy that check. → AC-8
- [x] Blank note text → `locale` in a loaded `settings.json`. `en` is `= Title` and a newline. Any other loaded value is `= Tytuł` and a newline. An unreadable file fails the create. → AC-3
- [x] Template note text → the shipped file for that stem and `locale`, or the user file named by `name`. Not the blank title. → AC-3
- [x] Shipped stems in the list → ten stems, spec order, current language, from the 20 compiled files. No bodies and no absolute paths. → AC-4
- [x] Your names in the list → `.typ` files in `templates/`, one level, sorted without regard to case, spelling as on disk. Subfolders, dot names, reserved device names, and files that cannot be read are absent. → AC-5
- [x] Group labels and stem labels → `messages/pl.json` and `messages/en.json`. `template_lab` is Laboratorium in Polish and Lab in English. → AC-4
- [x] `folder_ready` → true when `templates/` exists after the create attempt. False when it cannot be created. Shipped stems are still returned. → AC-5
- [x] Copy file name → the first free name from `{stem}.typ` through `{stem}-100.typ` in `templates/`, compared without regard to case. A leftover `{stem}.assets` folder in the notes folder does not block the copy. → AC-7
- [x] Template fingerprint → hash and byte length of the bytes just read or written, in a map separate from note fingerprints, keyed by the canonical template path. → AC-8
- [x] Image relative path → `{note stem}.assets/{file}` with forward slashes, from the note path. The page does not send either root. → AC-10
- [x] Image sequence → empty `file_name` uses the picture stem `image` and `.png`, then `-1` through `-99`. A note named `unsaved-1.typ` still gets `image.png` first. The number is the picture stem, not the note stem. → AC-10
- [x] Render while a template is open → the editor buffer. An empty path plus the open notes folder as the Typst root. No render call when no notes folder is open, and the preview stays empty. → AC-9
- [x] Yours row label → the file name from `yours`, including `.typ`, not the shipped stem label. → AC-4
- [x] 20 MB cap → refuse when `bytes` is longer than 20 × 1024 × 1024. That length is allowed. One byte more is `image-refused:`. → AC-10
- [x] Allowed types → the extension of `file_name`, compared without regard to case: `png`, `jpg`, `jpeg`, `gif`, `webp`. `.svg` is refused. → AC-10
- [x] Rewritten picture paths → `{newStem}.assets/` in the note after rename, only for the prefix rule in AC-11. → AC-11
- [x] Buffer after rename → a fresh read of the renamed file, only when that note is open. A note that is not open is not loaded into the editor. → AC-11
- [x] PDF refusal → a template is open, so the page shows `pdf_needs_note` and does not call export. → AC-9
- [x] Conflict on template save → the in memory template fingerprint versus the file on disk. No fingerprint yet, or a mismatch, is `external-change:` unless `force` is true. → AC-8

## Acceptance-criteria coverage

- AC-1 covered by the open folder step.
- AC-2 covered by the unsaved name steps, the exhausted names step, and the Rust blank note test.
- AC-3 covered by the blank title step, the template copy step, and the Rust template body test.
- AC-4 covered by the start surface step, the language step, and the list test.
- AC-5 covered by the templates folder steps and `folder_ready`.
- AC-6 covered by the lecture.typ under yours step.
- AC-7 covered by the make a copy step and the Rust copy test.
- AC-8 covered by the focus conflict step and the template fingerprint row.
- AC-9 covered by the template editor step, the empty path test, and the PDF refusal row.
- AC-10 covered by the image command step and the Rust image test.
- AC-11 covered by the rename step and the Rust rename and delete tests.
- AC-12 covered by the no index, no sidecar, and no new settings field step.
- AC-13 covered by the path refusal step and the Rust escape tests.
