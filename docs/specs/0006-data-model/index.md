# 0006. Data model

**Date**: 2026-11-09
**Status**: In Progress

## Summary

Your notes stay plain Typst files in the folder you open. New pictures for a note go in a folder beside that note. The ten shipped templates live inside the app, in Polish and in English, and your own templates live in one folder next to the settings file. Search keeps reading the note files. There is no index and no extra file beside a note. This spec is the map later features follow, and the build makes those homes real.

## Requirements

**User stories**:

- As a student, I want to open a folder of Typst files I already have, so that nothing is converted or moved.
- As a student, I want a new note, blank or from a template, to appear immediately as `unsaved.typ`, so that I can start writing before I choose a real name.
- As a student, I want the shipped templates plus any template I add, so that I can start from a useful shape and keep my own.
- As a student, I want a picture that belongs to a note to sit beside that note, so that a rename takes the picture with it and another tool can still see the file.

**Acceptance criteria**:

- **AC-1**: Opening a folder does not convert, move, or rewrite any file already in it. A note stays a plain `.typ` file. The sample file stays `wysityp-sample.typ`.
- **AC-2**: A blank note and a note started from any template are written at once in the selected folder. The names tried, in order, are `unsaved.typ`, then `unsaved-1.typ`, then `unsaved-2.typ`, through `unsaved-99.typ`. The first free name is used. A name is taken when a file or a folder with that name already exists, compared without regard to case, or when `{stem}.assets` already exists for that stem. The check is existence on disk, not a counter in settings. An empty selected folder means the notes folder itself. When every name is taken, the command writes nothing and returns a string that starts with `note-names-exhausted:`. The page shows `note_names_exhausted`.
- **AC-3**: A blank note's text is `= Tytuł\n` when the loaded settings language is not `en`, and `= Title\n` when it is `en`. If `settings.json` cannot be read, the create fails with the existing settings error and writes nothing. A note started from a template copies that template's text once. A later edit to the template does not change the note. The note does not store which template it came from.
- **AC-4**: The app holds the 20 shipped template files named in Shipped template text, ten stems in Polish and English. `list_templates` returns those stems for the current settings language, in the order listed there, and the `.typ` file names in the templates folder. It returns no bodies and no absolute paths. The page shows the shipped group first, then yours. A yours row shows the file name, including `.typ`. Stem labels and the two group labels come from the message keys in Labels. Changing the language loads settings again and refreshes the shipped stems and the labels. Your file names do not change. `template_editing` uses the file name, including `.typ`. Each shipped row has two actions: start a note (`create_from_template` with `kind` `shipped`), and make a copy (`copy_shipped_template`), which then opens that copy. Each yours row has two actions: start a note (`kind` `user`), and edit the file (`open_template`). A shipped file is never opened for editing.
- **AC-5**: The templates folder is the directory `templates` next to `settings.json` in the app config folder. A missing folder is created on list or copy. If it cannot be created, `list_templates` still returns the shipped stems, `yours` is empty, `folder_ready` is false, and the page shows `template_folder_unavailable`. A file that is not valid UTF-8, or that cannot be read, is skipped. Subfolders are ignored. A name that starts with a dot is ignored. A listed name ends in `.typ` when compared without regard to case, and the spelling on disk is the one returned. A Windows reserved device name (`CON`, `PRN`, `AUX`, `NUL`, `COM1` through `COM9`, `LPT1` through `LPT9`), with or without an extension, is refused. Your files are sorted by file name with case folded. Fingerprint keys are the canonical path, so `Mine.typ` and `mine.typ` are one entry on Windows.
- **AC-6**: A file of yours whose name matches a shipped file is listed under yours, and the shipped stem is still listed under shipped. Neither replaces the other.
- **AC-7**: `copy_shipped_template` writes a new file in the templates folder. The names tried, in order, are `{stem}.typ`, then `{stem}-2.typ`, through `{stem}-100.typ`. The first free name is used, with the same existence and case rule as **AC-2**. A leftover `{stem}.assets` folder does not apply here, because this write is not in the notes folder. When every name is taken, the command writes nothing and returns a string that starts with `template-names-exhausted:`. The page shows `template_names_exhausted`. The shipped text is unchanged. The page calls copy only after the open note can be saved. If that save is blocked, the command is not called and nothing is written. The copy is not a note and is not added to recent notes. The editor then shows that file.
- **AC-8**: Opening or copying a template remembers a fingerprint (a short record of the file bytes) in memory, separate from note fingerprints. `save_template` refuses when the file on disk no longer matches that fingerprint, or when no fingerprint is stored yet, unless `force` is true. Both refusals use the `external-change:` prefix the page already treats as a conflict. The page calls `template_changed_on_disk` with the open template's file name when the window regains focus, the same moment it checks a note. That command uses the template fingerprint map and the templates folder. Autosave uses the same pause as notes (`AUTOSAVE_WAIT_MS`). A template path is never inside the notes folder.
- **AC-9**: While a template is open, the tree does not mark a note as open. Search still searches notes when a notes folder is open. PDF export is refused and the page shows `pdf_needs_note`. If a notes folder is open, render compiles the editor buffer and the page sends an empty path. Rust treats that empty path as a buffer that is not a file in the folder, and Typst resolves includes inside the notes folder. If no notes folder is open, the page does not call render and the preview stays empty. Opening or switching the notes folder first runs the same settle as leaving a note. If the template cannot be saved, the folder does not change. If it can, the template stays open and the preview uses the new notes folder as the Typst root.
- **AC-10**: `save_note_image` writes only inside `{note stem}.assets` beside an existing `.typ` note inside the notes folder, creating that folder if it is missing. It does not change the note text. It returns one relative path with forward slashes, such as `unsaved.assets/image.png`. An empty file name starts at `image.png`, then `image-1.png`, through `image-99.png`. A provided name keeps its spelling, and a clash inserts `-1` through `-99` before the extension (`slide.png`, then `slide-1.png`). That number is the picture file's stem, not the note stem. The first free name is used, with the same existence and case rule as **AC-2**. The extension, compared without regard to case, must be `png`, `jpg`, `jpeg`, `gif`, or `webp`. A name is refused when it has a slash, a backslash, a `"` or `'`, a `..` segment, a `: * ? < > |`, a trailing dot or space, no extension, or a Windows reserved device name from **AC-5**. A file larger than 20 × 1024 × 1024 bytes is refused. If `{note stem}.assets` exists and is not a folder, the call is refused. The 101st name is refused. A refusal writes nothing and returns a string that starts with `image-refused:`. The page shows `image_refused`.
- **AC-11**: Rename or move of a note file, which is the existing `rename_entry`, also moves `{oldStem}.assets` to the sibling `{newStem}.assets` when that folder exists. If the new note path exists, or the new assets path exists, and that destination is not the same file or folder, nothing is renamed. That includes a leftover assets folder when the note being renamed has no assets folder of its own. The assets folder is renamed first, then the note. If the note rename fails, the assets folder is renamed back and nothing else changes. When the stem changes and the note bytes are valid UTF-8, `{oldStem}.assets/` is replaced with `{newStem}.assets/` only when that prefix is at the start of the file or the character immediately before it is `"` or `'`. A slash is not enough. The write is atomic. If the write fails, both renames are rolled back. If a rollback fails, the error is the rollback error. If the note bytes are not valid UTF-8, the text rewrite is skipped and the renames still complete. After a successful rewrite, Rust stores the new fingerprint for the new note path. If that note is open in the editor, the page reads it again so the buffer matches the file. Deleting a note file leaves the assets folder and any PDF beside the note. The tree does not show a folder whose name ends in `.assets`, and those folders cannot be renamed or deleted from the tree. Deleting a parent folder still deletes them, because that delete removes the directory. Renaming a folder does not rewrite note text, because the relative picture paths stay valid.
- **AC-12**: Search has no index file. A note has no sidecar file. Settings gain no new field. Recent notes stay as spec 0003. The open folder is not stored for the next launch. The page never sends the notes folder or the config folder.
- **AC-13**: A template name or an image name that would leave its folder is refused. `save_template` and `copy_shipped_template` write only inside the templates folder. They never write a shipped file inside the app. `save_note_image` and note creates write only inside the notes folder.

## Decision

**Chosen option**: Option 1, plain files in three homes

Notes and their pictures live in the folder you open. Shipped templates are files compiled into the app. Your templates are plain `.typ` files next to settings. Search reads the notes. Nothing else is stored.

## Feature design

**Data model sketch**:

The notes folder is the folder you open. It lives in memory until you quit. Paths the page sees are counted from that folder, with forward slashes.

| Entity | Key | Fields | Required | Links |
|---|---|---|---|---|
| Note | path from the notes folder, ending in `.typ` | UTF-8 Typst text | text required | zero or one image folder, the sibling `{stem}.assets` |
| Image folder | `{note directory}/{stem}.assets` | none | created on the first image | one note, many image files |
| Image file | file name inside the image folder | bytes, extension | name and bytes required | many per image folder |
| PDF | sibling `{stem}.pdf` | bytes written by export | absent until export | not moved when the note is renamed |
| Settings | `settings.json` in the app config folder | `locale`, `theme`, `page_color`, `display_name`, `source_font`, `render_font` when present, `recent_notes` | `locale` required, as today | one file, many recent lists (spec 0003) |
| Shipped template | stem + `pl` or `en` | the text in Shipped template text | 20 files, all required | copied into a user template, no stored link |
| User template | file name in `templates/` | UTF-8 text, fingerprint in memory | file name required | none back to the note it once created |
| Recent list | folder identity in `recent_notes.workspaces` | at most 10 paths | as spec 0003 | unchanged |

Absent on purpose: a search index, a sidecar JSON file, a template id on the note, a stored last folder.

Stem is the note file name with the final `.typ` removed. `unsaved-1.typ` has stem `unsaved-1` and image folder `unsaved-1.assets`.

**State transitions**:

- No document open. You can list templates with no notes folder open. Starting a note or saving an image needs an open notes folder.
- Note open. Autosave and the conflict guard are the ones notes already use. Leaving the note (to another note, or to a template) runs the existing settle step first. If that step is blocked, the leave does not happen.
- Template open. The note tree shows no current note. Autosave and the conflict guard write the template file. You leave by opening a note. There is no stack of previous notes. PDF export stays refused until a note is open. Switching the notes folder settles the template first and leaves it open. Render runs only when a notes folder is open, with an empty path.

**API surface**:

Commands are Tauri commands. Errors are the existing short strings (`AppError`), plus the message keys the page shows. `local` means the person at this machine. There is no account.

| Command | Inputs | Outputs | Checked against | Key errors |
|---|---|---|---|---|
| `list_templates` | none | `shipped` stems, `yours` file names, `folder_ready` | config `templates/` | folder missing and not creatable: still returns shipped, `folder_ready` false |
| `create_blank_note` | `parent` relative path | `Note` (`path`, `text`, fingerprint) | notes folder | no folder open, bad parent, settings unreadable, `note-names-exhausted:` |
| `create_from_template` | `parent`, `kind` (`shipped` or `user`), `name` | `Note` | notes folder, and the templates folder when `kind` is `user` | unknown stem, user file missing or not UTF-8, settings unreadable, `note-names-exhausted:`, path leaves the folder |
| `copy_shipped_template` | `name` stem | `TemplateDoc` (`name`, `text`, fingerprint) | config `templates/` | unknown stem, folder not creatable, `template-names-exhausted:` |
| `open_template` | `name` file name | `TemplateDoc` | config `templates/` | bad name, missing, not UTF-8 |
| `save_template` | `name`, `text`, `force` | `TemplateDoc` | config `templates/`, in memory fingerprint | bad name, `external-change:` unless `force` (includes no fingerprint yet) |
| `template_changed_on_disk` | `name` file name | changed or not | config `templates/`, template fingerprint map | bad name. A change is `external-change:` |
| `save_note_image` | `path` of the note, `file_name`, `bytes` | relative path from the note | notes folder, existing `.typ` note | `image-refused:` for a missing note, a bad name, a bad extension, a size over the cap, an assets path that is a file, or all 100 names taken |
| `rename_entry` | `from`, `to` | new path | notes folder | destination exists (note or assets, including a leftover assets folder), rollback error |
| `render_note` | `path`, source, revision | pages, as today | notes folder | an empty `path` is allowed only while a template is open and a notes folder is open. It does not read or write a note file |
| `delete_entry` | `path` | nothing | notes folder | existing delete errors. A note file delete leaves assets and the PDF |

`create_from_template` no longer takes one template string. The page sends `kind` and `name` instead. `create_sample_note` is unchanged.

List, copy, open, and save of templates do not need an open notes folder. They do not record a recent note. Creating a note still records a recent note, as spec 0003.

**Value sourcing**:

| Action | Value produced or displayed | Source |
|---|---|---|
| New note name | first free name from `unsaved.typ` through `unsaved-99.typ` | existence of that file, that folder, or `{stem}.assets` in `parent`, compared without regard to case. Empty `parent` is the notes folder |
| Names exhausted | `note-names-exhausted:` or `template-names-exhausted:` | the name loop in **AC-2** or **AC-7** found no free name |
| Image refused | `image-refused:` | the checks in **AC-10**. The page maps the prefix to `image_refused` |
| Template changed on focus | `external-change:` or not changed | `template_changed_on_disk` compares the template fingerprint map with the file in `templates/` |
| Blank note text | `= Tytuł\n` or `= Title\n` | `locale` in a loaded `settings.json`. A loaded value other than `en` is Polish. An unreadable file fails the create |
| Template note text | the template body | shipped file for stem + `locale`, or the user file named by `name` |
| Shipped stems in the list | ten stems, spec order, current language | the 20 compiled files, filtered by `locale` |
| Your names in the list | file names | directory listing of `templates/`, `.typ` only, one level, sorted with case folded |
| Group labels and stem labels | the words in Labels | `messages/pl.json` and `messages/en.json` for the keys in Labels |
| `folder_ready` | true or false | whether `templates/` exists after the create attempt |
| Copy file name | first free name from `{stem}.typ` through `{stem}-100.typ` | existence of that file or folder in `templates/`, compared without regard to case |
| Template fingerprint | hash and byte length | the bytes just read or written, same `NoteFingerprint` as notes, stored in a separate in memory map keyed by the canonical template path |
| Image relative path | `{stem}.assets/{file}` | note path's stem, plus the accepted file name |
| Image sequence | `image.png`, or the picture stem plus `-1` before the extension, through `-99` | file names already in the assets folder. Empty `file_name` uses the picture stem `image` and the extension `.png`. This stem is not the note stem |
| Render while a template is open | SVG pages, or an empty preview | editor buffer. Empty `path` plus the open notes folder as the Typst root. No call when no notes folder is open |
| Yours row label | the file name including `.typ` | the `yours` list from `list_templates` |
| 20 MB cap | refuse when `bytes` is longer | 20 × 1024 × 1024, compared to the input length |
| Allowed types | `png`, `jpg`, `jpeg`, `gif`, `webp` | the extension of `file_name`, compared without regard to case |
| Rewritten picture paths | `{newStem}.assets/` | the note file after the rename, exact prefix rule in **AC-11** |
| Buffer after rename | the note text | a fresh read of the renamed file, only when that note is open |
| PDF refusal | `pdf_needs_note` | page state: a template is open, so export is not called |
| Conflict on template save | `external-change:` | in memory template fingerprint versus the file on disk |

**Key invariants**:

- Typst source stays the text of the note. Saving an image does not edit it. Rename edits it only for the `{stem}.assets/` prefix in **AC-11**.
- The page never sends either root. Rust checks note paths against the open folder and template paths against `templates/`.
- A template save and a note save cannot share a fingerprint map. The keys would collide when a template and a note share a file name.
- Settings writers still load the file, change only their own fields, and write atomically. This feature adds no field.
- Shipped text is compiled in from `src-tauri/templates/`. It is not copied into `templates/` until you copy one template.
- New notes use the first free name from `unsaved` through `unsaved-99`, and a leftover `{stem}.assets` folder blocks that name. Template copies use the first free name from `{stem}` through `{stem}-100`. Picture files use the first free name from the picture stem through `-99`. These three sequences are different on purpose.

**Security model**:

One person uses the app on this machine. There is no account and no second role. Rust may touch the open notes folder, the app config folder (settings, the templates folder, the log), and the Typst package cache, as spec 0001 already allows. The templates folder is inside the config folder. The page cannot name a path that climbs out of the notes folder or out of `templates/`. Image bytes are stored as files. They are not run as programs. The type list and the size cap are the checks.

**Configuration required**:

None. No new setting, no environment variable, no key.

**Shipped template text**:

These files live in `src-tauri/templates/` and are compiled into the app. Line endings are LF, as the strings the app already uses for the first three.

`lecture.pl.typ`

```
= Tytuł wykładu

== Zagadnienia

-
```

`lecture.en.typ`

```
= Lecture title

== Topics

-
```

`problem-set.pl.typ`

```
= Tytuł zestawu zadań

== Zadanie 1

```

`problem-set.en.typ`

```
= Problem set title

== Problem 1

```

`lab.pl.typ`

```
= Tytuł notatki laboratoryjnej

== Cel

== Metoda

== Wyniki

```

`lab.en.typ`

```
= Lab note title

== Aim

== Method

== Results

```

`definitions.pl.typ`

```
= Tytuł definicji

== Pojęcie

== Znaczenie

== Przykład

```

`definitions.en.typ`

```
= Definition title

== Term

== Meaning

== Example

```

`proof.pl.typ`

```
= Tytuł dowodu

== Twierdzenie

== Dowód

```

`proof.en.typ`

```
= Proof title

== Statement

== Proof

```

`example.pl.typ`

```
= Tytuł przykładu

== Zadanie

== Rozwiązanie

```

`example.en.typ`

```
= Example title

== Problem

== Solution

```

`review.pl.typ`

```
= Tytuł powtórki

== Co umiem

== Do poćwiczenia

== Pytania

```

`review.en.typ`

```
= Review title

== What I know

== What to practice

== Open questions

```

`reading.pl.typ`

```
= Tytuł lektury

== Źródło

== Tezy

== Pytania

```

`reading.en.typ`

```
= Reading title

== Source

== Claims

== Questions

```

`project.pl.typ`

```
= Tytuł projektu

== Cel

== Dziennik

== Następny krok

```

`project.en.typ`

```
= Project title

== Goal

== Log

== Next step

```

`formulas.pl.typ`

```
= Tytuł wzorów

== Wzory

```

`formulas.en.typ`

```
= Formula sheet title

== Formulas

```

The first three bodies are the strings in `src-tauri/src/templates.rs` today. The other seven follow that shape: a title and a few headings, no sample paragraph.

**Labels**:

| Key | Polish | English |
|---|---|---|
| `template_group_shipped` | Z aplikacji | From the app |
| `template_group_yours` | Twoje | Yours |
| `template_lecture` | Wykład | Lecture |
| `template_problem_set` | Zestaw zadań | Problem set |
| `template_lab` | Laboratorium | Lab |
| `template_definitions` | Definicje | Definitions |
| `template_proof` | Dowód | Proof |
| `template_example` | Przykład | Example |
| `template_review` | Powtórka | Review |
| `template_reading` | Lektura | Reading |
| `template_project` | Projekt | Project |
| `template_formulas` | Wzory | Formulas |
| `template_folder_unavailable` | Nie można użyć folderu szablonów. Szablony z aplikacji nadal działają. | The templates folder cannot be used. Templates from the app still work. |
| `template_names_exhausted` | Brak wolnej nazwy na kopię szablonu. | No free name for a template copy. |
| `note_names_exhausted` | Brak wolnej nazwy unsaved. | No free unsaved name. |
| `image_refused` | Nie zapisano obrazu. | The image was not written. |
| `pdf_needs_note` | Eksport PDF dotyczy notatki, nie szablonu. | PDF export needs a note, not a template. |
| `template_editing` | Szablon {name} | Template {name} |

`{name}` is the template file name returned by Rust.

**Critical test scenarios**:

- Happy path: open a folder of existing `.typ` files and see them unchanged. Create a blank note and get `unsaved.typ` whose text is the language title. Start a lecture and get `unsaved-1.typ` with the lecture text. Verifies **AC-1**, **AC-2**, **AC-3**.
- Happy path: list templates in Polish and see the ten stems and no user files. Add `mine.typ` in the templates folder and see it under yours. Copy the Polish proof and get `proof.typ` open in the editor, with the shipped file unchanged. Verifies **AC-4**, **AC-5**, **AC-6**, **AC-7**.
- Failure case: a second copy when `proof.typ` exists becomes `proof-2.typ`. When `unsaved.typ` is gone and `unsaved.assets` remains, the next note is `unsaved-1.typ`. A template edited outside the app is refused on save and on focus until `force`. Verifies **AC-2**, **AC-7**, **AC-8**.
- Failure case: with a template open, search still returns note hits and PDF export shows `pdf_needs_note`. Verifies **AC-9**.
- Happy path: save a png for `unsaved.typ` and get `unsaved.assets/image.png` back. The note text is unchanged. Rename the note to `lecture.typ` and the folder becomes `lecture.assets`, the quoted path inside the note updates, the fingerprint matches the new bytes, and the open buffer matches. The tree does not list `lecture.assets`. Delete the note and that folder remains on disk, still hidden. Verifies **AC-10**, **AC-11**.
- Failure case: a 20 MB plus one byte file, a `.gif` is allowed, a `.svg` is refused, and `../x.png` is refused. An assets path that is a file blocks the write and blocks a rename. Verifies **AC-10**, **AC-11**, **AC-13**.
- Auth and boundary: `save_template` with a name that contains a slash writes nothing. Settings JSON gains no field from these commands. Verifies **AC-12**, **AC-13**.

## Build plan

Skateboard: the first slice is a note you can start, the second adds your templates, the third makes the picture folder real. Each slice leaves the app usable.

[x] 1. Shipped files and new note names. Add the 20 files under `src-tauri/templates/` and compile them into the app. Change `create_blank_note` and `create_from_template` to the first free `unsaved` name, including the leftover assets rule, the blank title, and `note-names-exhausted:`. A missing or unreadable settings file fails the create. `list_templates` returns the shipped stems for the current language, and each shipped row can start a note. Labels go in both message files. Do not add a settings field. Satisfies **AC-1**, **AC-2**, **AC-3**, **AC-4**, **AC-12**.
[x] 2. Your templates. Create and read `templates/` next to settings, with the name rules in **AC-5**. Copy, open, and save, with a fingerprint map separate from notes. Add `template_changed_on_disk` and call it when the window regains focus. Each yours row can start a note or edit the file. The editor can show a template, autosave it, refuse PDF export, and render with an empty path only when a notes folder is open. Switching folder settles the template first. The page does not call copy until the open note can be left. Satisfies **AC-4**, **AC-5**, **AC-6**, **AC-7**, **AC-8**, **AC-9**, **AC-13**.
[x] 3. Pictures beside the note. Add `save_note_image` with the name, type, size, and `image-refused:` rules. Teach `rename_entry` and `delete_entry` the assets folder rules: refuse before any move, assets first, roll back, skip the rewrite when the bytes are not UTF-8, rewrite only after a quote or at the start of the file, and store the new fingerprint. Hide folders whose names end in `.assets`. The page reloads an open note after that rename. No paste button in this slice. Satisfies **AC-10**, **AC-11**, **AC-13**.

## Consequences

**Positive**:

- A folder you already have opens as it is.
- You can add a template by putting a `.typ` file in one known folder, and an app update does not overwrite it.
- A renamed note keeps its pictures, and the Typst paths keep working.
- Search cannot drift from the files, because there is no second copy of the words.

**Negative / tradeoffs**:

- New notes are all called `unsaved` until you rename them. A folder full of `unsaved-12.typ` is harder to scan than names taken from the template.
- Template copies number as `proof.typ`, `proof-2.typ`. New notes number as `unsaved.typ`, `unsaved-1.typ`. Image files number as `slide.png`, `slide-1.png`. Three sequences, chosen on purpose. A build must not unify them.
- The editor now has two kinds of open document. A mistake in that mode would save a template into the notes folder, or a note into the templates folder. The separate commands and the separate fingerprint map are what prevent that.
- Rename can change bytes inside a note, for the assets prefix only. A sentence that contains that exact prefix after a quote or a slash changes too.
- Deleting a note leaves the picture folder and the PDF behind. Disk use grows until you delete those yourself in Explorer. The tree hides the picture folder. The next `unsaved` name skips a stem whose picture folder is still there, so a new note does not inherit the old pictures.
- There is still no paste button. Feature 8 has to call `save_note_image` and insert the path.

**Neutral**:

- Existing notes, settings, and recent lists are not rewritten.
- Spec 0003 still owns recent notes. Its template sentences (texts only inside the app, and note names taken from the template) no longer match this spec.
- PDF page settings are still not stored. Feature 12 owns that later decision.

## Follow-up

- [x] Add one line to spec 0003 that the template home and the template note names now come from spec 0006. Leave the recent notes decision as it is.
- [ ] Feature 8 (tables, code, images, and links) should call `save_note_image` and insert the returned path into the note. This spec does not add the button. Do not send a 20 MB file as a JSON array of numbers. If that paste is slow, change the command so Rust reads a path inside the notes folder. The size cap stays.
- [ ] Do not store per note PDF settings in a new file. That choice stays with feature 12.

## Rationale

Reasoning and options: see [rationale.md](rationale.md).
