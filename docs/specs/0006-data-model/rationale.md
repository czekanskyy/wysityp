# 0006. Data model, rationale

## Context

> Premise note: The editor will open two kinds of file, a note in the folder you chose and a template next to settings. If one save path serves both, a template can be written into the notes folder or a note into the templates folder, and the fingerprint of one can block the other. The right framing is two commands and two in memory fingerprint maps, which this spec requires. The two numbering styles (notes, template copies, pictures) are easy to "clean up" into one during the build. They were chosen separately and the spec names each one so the build does not merge them.

WYSITyp already stores a lot, and the rest of Release 1 needs one map before it invents more homes. Spec 0001 put notes in the folder you open, settings in one JSON file in the app config folder, and every file read and write in Rust. Spec 0003 put recent notes in that settings file, one list per folder, and put the three template texts inside the program. Search reads the `.typ` files when you ask. Pictures have no home yet. Feature 8 will paste a slide into a note, and its done when says you find that file beside the note.

You are one person building this in spare time, for one student on Windows, offline, with no account. The files have to stay readable by other tools. A second copy of the note text, or a hidden file per note, would break that promise the moment it drifts. Search has not been measured as slow. The template texts cannot stay only inside the program if you are allowed to add your own and to change a copy without losing it on the next update.

If this stays undecided, the next feature will pick a folder, a file name, and a numbering rule on its own. Rename would then leave pictures behind, or would rewrite the note in a way the editor buffer does not see.

## Options considered

### Option 1: Plain files in three homes

Notes stay `.typ` files. New pictures go in `{stem}.assets` beside the note. The ten shipped templates, in both languages, are files compiled into the app. Your templates are `.typ` files in `templates/` next to `settings.json`. Search keeps reading the notes. A new note is always `unsaved.typ` and the numbered names after it. A copy of a shipped template keeps the shipped text untouched.

**Pros**:

- Other tools see the same files the app sees. There is nothing to rebuild.
- An update can change the shipped texts without writing into your template folder.
- Rename can take the picture folder with the note because the folder name is tied to the note name.

**Cons**:

- You get three numbering styles, because notes, copies, and pictures were each chosen on their own.
- The editor must know whether it is saving a note or a template.
- Picture folders and old PDFs remain after you delete a note.

### Option 2: A search index next to settings

Keep the plain notes, and add an index file in the app config folder. Search reads the index. If the index is missing or stale, rebuild it from the `.typ` files.

**Pros**:

- Search can stay fast if a folder grows to many long notes.
- The index is outside the notes folder, so other tools do not see an app owned file among the notes.

**Cons**:

- Nothing has shown that a scan is slow. The index is a second copy of the words and it can be stale.
- Every save, rename, and delete has to update it or the search lies.

### Option 3: A sidecar file per note

Store picture names, the template id, and later PDF settings in a small JSON file next to each note.

**Pros**:

- The note file stays pure Typst, and the app still has a place for facts that are not Typst.
- The template a note came from can be remembered.

**Cons**:

- You asked for no sidecar. Another tool can delete or edit that JSON and the app has a new conflict to explain.
- The facts that matter here (where the picture is, the template text) already have a plain file home.

### Option 4: Leave the new homes for later features

Keep the three template strings in Rust. Let feature 8 pick the picture folder when the paste button is built. Do not add your own templates yet.

**Pros**:

- The smallest change. Today's commands keep working.
- No second editor mode to get wrong.

**Cons**:

- You cannot add a template or change a copy without a new build.
- Feature 8 would choose the picture folder alone, and rename would not know to follow it.
- The scope row for this feature would stay open, and the map would still be missing.

## Rationale

Option 1 is the one that matches the forces in Context. The notes folder must open without conversion, which rules out a private database and a sidecar the app requires. Search has no measured problem, which rules out an index until a scan is shown to be slow. Templates have to survive an update and accept files you add, which rules out keeping the only copy inside Rust strings. Pictures have to sit beside the note and move with a rename, which is `{stem}.assets` plus a path rewrite the editor reloads.

The numbering split is the cost of taking your answers as given. Notes use `unsaved-1`. Copies keep the rule the app already uses for `note-2`. Pictures use `-1` like notes, on whatever file name you dropped. Writing all three down is safer than picking a favourite during the build.

Compiling the shipped files in from `src-tauri/templates/` keeps them as real files in the repo without a second copy on disk and without a new package. The runner up was files sitting beside the installed program, which you could open in Explorer and which need more install wiring. Rust strings, which is what the app does today, lose the "files in the app" choice.

A review suggested a simpler template path: list your files and start notes from them, and edit those files only outside the app. That would drop the second editor mode. It was not taken. You chose to open the copy in the app, so the spec keeps `open_template`, `save_template`, and the separate fingerprint map, and it names the render path, the focus check, and the folder switch so that mode has a source for every value.

Existing notes and the settings file are not migrated. The old template command shape is replaced in the same change, because the only caller is this app.

## Current homes, as the code works today

This is the inventory the decision starts from. It is not a second spec.

- The open folder is a path in memory (`workspace_root` in `src-tauri/src/lib.rs`). It is not written for the next launch.
- Notes are `.typ` files. `create_blank_note` uses `note.typ`, then `note-2.typ`, through `note-100.typ`, and the heading is the stem (`src-tauri/src/templates.rs`, `starter_heading` in `files.rs`).
- The three template bodies are Rust strings. `create_from_template` reads `locale` from settings and returns a `Note`.
- `rename_entry` renames one path. It does not know about pictures. The page saves the open note before the rename, then keeps the editor buffer and only changes the path.
- `delete_entry` deletes the file or the folder you named.
- Search (`files.rs` `search_notes`) reads `.typ` files and skips other files. There is no index.
- Settings fields the code understands are `locale`, `theme`, `page_color`, and `recent_notes`. `display_name`, `source_font`, and `render_font` are kept when present. Writers change only their own fields.
- PDF export writes `{stem}.pdf` beside the note and overwrites that file. It does not read `page_color`.
