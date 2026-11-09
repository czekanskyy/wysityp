# Verify: App shell and start surface · spec 0005 · updated 2026-11-09
_Steps derived from spec 0005 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

## UI / manual

- [ ] Open the app before any folder is open. The mark is W. The workspace name is the existing no folder sentence. New note, search, the template cards, and New folder are inactive. Recent still has its heading, and the body is the empty sentence. The sample action is absent. The footer save phrase is the saved sentence. There is one heading, the greeting. The date is the local long date. With no spoken name the greeting is the phrase and a full stop. → AC-12, AC-14, AC-16, AC-18, AC-20
- [ ] Open a folder. The workspace name becomes `root_name` and the mark becomes its first character. The place is the open folder itself. Recent and Notes both start expanded. The sample action appears in the footer. → AC-1, AC-11, AC-12
- [ ] Create a blank note from the sidebar and from the start surface. The first file is `note.typ` with the heading `= note`. The next free name is `note-2.typ`, and an existing file is not overwritten. The new note opens. With a folder selected, the file lands in that folder and the folder opens if it was closed. → AC-6, AC-7
- [ ] Click a folder row, and press Enter or Space on it. The folder becomes the place and opens if it was closed. It does not close when it is already open. The twist only opens and closes, and does not change the place. Right opens a closed folder. Left closes an open folder. Neither changes the place. → AC-7
- [ ] Click the workspace name. The place returns to the open folder itself and the open note stays open. → AC-7
- [ ] On a notes tree row, the menu button is its own tab stop after the row. Arrow keys move between rows and do not open the menu. The menu offers rename and delete, and those run the forms you already have, including their refusals. Recent rows have no menu. Recent cards have no more menu, no tag, no preview, and no time. → AC-3, AC-8
- [ ] New folder on the Notes section opens a name field under the sidebar. Create stays inactive while the name is empty. Cancel closes the field and writes nothing. A submitted name is created in the selected place, then that folder becomes the place and is expanded. → AC-8, AC-7
- [ ] A folder row shows a badge equal to the number of direct children already in the tree, including 0. A note row has no badge. → AC-9
- [ ] Each template card shows the existing title, the default file name (`lecture.typ`, `problem-set.typ`, or `lab.typ`), and the locked description for the active language. Creating one writes that note in the selected place and opens it. → AC-5
- [ ] Recent cards and the sidebar recent rows show the same paths for the open folder, newest first, at most 10. A card title is the last path segment. The line under the title is the path. A sidebar row shows the file name, and its tooltip is the path. The cards hide while a note is open. The sidebar recent section stays. → AC-3, AC-4
- [ ] Search shows hits under the sidebar, each with the path, the line, and the snippet on their own. Choosing a hit opens that note and does not jump to the line. An empty query clears the hits. A failure uses the search failed sentence on the status line. There is no Ctrl+K hint. → AC-10, AC-20
- [ ] Close note runs the leave rules. A clean note leaves the file in place, clears the editor, and shows the start surface. A conflict or a failed save keeps the note and the existing banner. → AC-2, AC-21
- [ ] Footer order is Open a folder, the language select, Close note while a note is open, the sample action while a folder is open, then the save phrase. The unsaved dot sits on the tree row and the Recent row while the phase is unsaved, saving, or conflict. A saved note has no dot. Manual save and PDF export stay on the note stage. → AC-13
- [ ] Switch language between Polish and English. The date, the daily phrase, and the template descriptions redraw at once. Weekday and month names come from the date formatter, not from the message files. The same local calendar day keeps the same phrase. → AC-14, AC-5, AC-17
- [ ] With a folder and an empty recent list, both surfaces say the empty sentence. While the list is loading, that sentence is replaced by the loading sentence and stale rows are not kept. When the read fails, both surfaces show the failed sentence plus the error, and the tree can still open a note. → AC-16
- [ ] With a saved display name, the greeting is the phrase, a comma, a space, the first word (at most 40 characters), and a full stop. A missing, blank, broken, or non string saved name falls through to the account display name. If that lookup fails, the phrase stands alone and the greeting shows no error. The name is not on the status line. → AC-14, AC-15
- [ ] Saving the language or recording a recent note keeps `display_name`, including a value that is not a string, and does not drop other unknown settings fields. This feature never writes `display_name`. → AC-19
- [ ] Rename retargets the place and the open folders the way the app already does. Delete clears the place only when the deleted path is the place or the place sits inside it. Deleting a child inside the place does not clear the place. Opening another folder clears the place and which folders are open, and it returns before that clear if the picker is cancelled. → AC-7
- [ ] New note, a template, a new folder, the sample, close, and open folder each run the leave rules first. If leave fails, they write nothing and the note stays, with the existing banner. → AC-21
- [ ] The status line under the sidebar shows action results and is absent when there is no status. The footer does not carry those sentences. Toolbar and CommandPalette stay unmounted. The page does not set `data-theme`. → AC-18, AC-20
- [ ] Light and dark still follow the system. The shell uses the existing tokens. At a narrow width the sidebar stacks above the start surface. → AC-17

## Commands

- [ ] `cargo test --manifest-path src-tauri/Cargo.toml` → a blank note uses `note.typ`, then `note-2.typ`, stops after 100 names with nothing more written, and can land in the selected folder. → AC-6
- [ ] `cargo test --manifest-path src-tauri/Cargo.toml` → reading a missing settings file does not create it. A broken file and a non string `display_name` count as no saved name and stay unchanged. The spoken word is the first word and at most 40 scalars. Saving locale or recent notes keeps `display_name`. → AC-15, AC-19
- [ ] `bun run test` → 1 January is phrase index 0, 29 February is counted, a daylight saving change does not move the index, and the same local day keeps one index. The date formatter includes the weekday and the month. → AC-14

## Value sourcing

- [ ] Greeting phrase → the locked list, index from local calendar days since 1 January, remainder 7. 1 January is 0. → AC-14
- [ ] Spoken name → `greeting_name` only. Empty means the phrase and a full stop. → AC-15
- [ ] Date line → `Intl.DateTimeFormat`, locale `pl` or `en`, local time zone, weekday long, day numeric, month long. → AC-14
- [ ] Status line → the existing message prefix plus the existing Rust error or path. Absent when empty. → AC-20
- [ ] Workspace name → `root_name`, or the existing no folder sentence. → AC-12
- [ ] Mark → first character of `root_name`, or of `app_name` when no folder is open. → AC-12
- [ ] Recent card title → last segment of a path from `list_recent_notes`. → AC-3
- [ ] Recent card line → that same path. → AC-3
- [ ] Sidebar recent row → file name, tooltip is the path. → AC-3
- [ ] Template card → existing titles, `lecture.typ`, `problem-set.typ`, `lab.typ`, and the locked descriptions. → AC-5
- [ ] Folder badge → `children.length` from `list_tree`, not a stored count. → AC-9
- [ ] Save footer and unsaved dot → the four save phrases. No open note uses the saved phrase. The dot is on the tree row and the Recent row for that path. → AC-13
- [ ] Search hits → path, line, and snippet from `search_notes`. → AC-10
- [ ] Place → window memory. The page sends it as `parent`. Empty means the open folder itself. → AC-7
- [ ] Language → `set_locale`, stored `locale`, options Polski and English. → AC-17

## Acceptance-criteria coverage

- AC-1 covered by the open folder step.
- AC-2 covered by the close note step.
- AC-3 covered by the recent card and recent row steps.
- AC-4 covered by the recent section staying while a note is open.
- AC-5 covered by the template card step and the language redraw step.
- AC-6 covered by the blank note step and the Rust blank note test.
- AC-7 covered by the place, twist, workspace name, new folder, rename, and delete steps.
- AC-8 covered by the row menu and new folder field steps.
- AC-9 covered by the folder badge step.
- AC-10 covered by the search step.
- AC-11 covered by the open folder step (Recent and Notes start expanded).
- AC-12 covered by the no folder step and the open folder step.
- AC-13 covered by the footer and unsaved dot step.
- AC-14 covered by the greeting, date, and day index steps.
- AC-15 covered by the spoken name step and the settings Rust tests.
- AC-16 covered by the recent empty, loading, and failure step.
- AC-17 covered by the language step and the light and dark step.
- AC-18 covered by the shell composition step (sidebar mounted, toolbar and palette unmounted).
- AC-19 covered by the settings keep step and the Rust keep test.
- AC-20 covered by the status line step and the search failure step.
- AC-21 covered by the leave rules step.
