# 0005. App shell and start surface

**Date**: 2026-11-09
**Status**: In Progress

## Summary

The Papier sidebar and the start surface take over the window you already have. You open a folder, start a note from a template, a recent file, or a blank note, and organise the tree in that shell, in Polish and English, following Windows light or dark. The greeting uses a daily phrase and, when a name is available, one word of that name. Subject tags, preview paragraphs, the theme control, and the search screen stay with later features.

## Requirements

**User stories**:

- As a student, I want the folder, a new note, and my recent notes in one shell, so that I can start today's lecture without hunting through the old layout.
- As a student, I want to close a note and land back on templates and recent notes, so that the next note starts from the same place.
- As a student, I want the greeting to use a short phrase and my name when the computer has one, so that the start surface feels like mine.
- As a student, I want rename, delete, and a new folder to stay on the tree, so that organising a folder does not wait for a later screen.

**Acceptance criteria**:

- **AC-1**: The start surface fills the main area whenever no note is open, including before a folder is open. Opening a note shows the editor you already have. The surface does not sit beside an open note.
- **AC-2**: Close note is a sidebar footer control, shown only while a note is open. It runs the leave rules you already have. A conflict or a failed save keeps the note open and shows the banner you already have. A clean close clears the editor, leaves the file on disk, and brings the start surface back. Deleting the open note still clears the editor.
- **AC-3**: Recent cards and the sidebar recent section show the same paths for the open folder, newest first, at most 10, from `list_recent_notes`. A card title is the last segment of that path. The line under the title is the path itself. A sidebar row shows the file name, and its `title` attribute is the path. Cards have no subject tag, no preview paragraph, no time, and no more menu.
- **AC-4**: The sidebar section order is Recent, then Notes. Recent stays visible while a note is open. The cards hide with the start surface.
- **AC-5**: The start surface shows three template cards: lecture, problem set, and lab. Each card shows the template title you already have, the default file name (`lecture.typ`, `problem-set.typ`, or `lab.typ`), and the description sentence in the feature design. A click calls `create_from_template` for the selected place. A failure uses the existing template failed status. The create rules in spec 0003 still hold, including no overwrite.
- **AC-6**: Both New note controls (the sidebar header and the start surface) call `create_blank_note` with the selected place. Rust tries `note.typ`, then `note-2.typ`, through `note-100.typ`, and writes the existing starter heading, which uses the file stem. `note.typ` contains `= note`. `note-2.typ` contains `= note-2`. The new note opens in the editor and is recorded as a recent note, the same way `create_note` records one. When all 100 names exist, the command returns `AlreadyExists`, writes nothing, and the status line in AC-20 shows the existing action failed label plus the existing error text (`a file or folder already has that name: …`).
- **AC-7**: The twist icon on a folder toggles open and closed and does not change the place. The rest of the row marks that folder as the place and opens it if it was closed. It does not close an open folder. Enter or Space on the row does the same as that row click. Right opens and Left closes, and neither changes the place. The marked folder uses `selected`. The open note row, in the tree and in Recent, sets `current` and does not steal `selected` unless that note's folder is also the place. A click on the workspace name sets the place back to the open folder itself and does not close the note. With no folder marked, the place is the open folder itself. New notes and templates use that place. A new folder is created there, then becomes the place, and is expanded. The place and which folders are open live in memory for this window. Opening another folder clears both. Rename retargets the place and the open set the same way the app already retargets them. Delete clears a place or an open entry that equals the deleted path or sits inside it.
- **AC-8**: Every tree row has a menu button after the row, as its own tab stop, not inside the roving tree stop. Arrow keys move between rows and do not open the menu. The menu, once open, follows the menu keys in spec 0004. The entries are rename and delete, and they run the rename form and the delete confirm you already have, including their refusals. Enter on the row still opens a note, or marks a folder as AC-7 says. New folder is a control on the Notes section. It opens a name field under the sidebar. The create control in that field is inactive while the name is empty. Cancel closes the field and creates nothing. A submitted name is created in the selected place through `create_folder`.
- **AC-9**: A folder row shows a badge whose number is the count of direct children already in the tree. A note row has no badge. The count is not stored.
- **AC-10**: The sidebar search field keeps today's note text search, including the existing empty query (hits clear), the `search_searching` sentence, and the `search_empty` sentence. The hit list is the first block under the `Sidebar` component, in the same column, including while a note is open. Each hit shows the path, the line, and the snippet you already return. Choosing a hit opens the note and does not jump to the line. A failure uses the existing search failed sentence on the status line in AC-20. The field does not filter the tree. The `Ctrl+K` hint is not drawn. Rename, delete, and a tree refresh keep the search refresh behaviour `App.svelte` already has.
- **AC-11**: The language control is a select in the sidebar footer, with Polish and English, and it saves through `set_locale`. The settings gear and the theme button are not drawn. This feature does not set `data-theme`.
- **AC-12**: Open another folder is in the sidebar footer and on the start surface. Both run the existing leave rules first. If leave fails, the picker does not open and the current folder stays. If leave succeeds, the existing open command runs. Cancelling the picker leaves the current folder and the current note. The workspace name is `root_name` from `WorkspaceInfo`, and the mark is the first character of that name. With no folder open, the workspace name is `no_folder`, and the mark is the first character of `app_name` (W).
- **AC-13**: The footer save text uses `save_state_saved`, `save_state_saving`, `save_state_unsaved`, and `save_state_conflict`. With no note open, the footer uses `save_state_saved`. The tree row and the Recent row for the open note show the unsaved dot while the phase is unsaved, saving, or conflict. A saved note has no dot. Conflict actions stay on the note stage. The old top bar is gone. Manual save and PDF export stay on the note stage. The sample action sits in the footer when a folder is open, and it is absent when no folder is open. Sample, like every other open or create, runs the leave rules in AC-21 first.
- **AC-14**: The start surface shows the local date and one daily phrase. The date uses `Intl.DateTimeFormat` on the page, with the active locale (`pl` or `en`), the computer's local time zone, and the options weekday long, day numeric, and month long. Weekday and month names come from that formatter, not from the message files. The phrase comes from the locked list in the feature design. The index is how many days have passed since 1 January of the local year, with 29 February counted in a leap year, and the remainder after dividing by 7. 1 January is index 0. The count uses the local year, month, and day, not a millisecond span, so a daylight saving change does not move it. The same local calendar day keeps the same phrase. Switching language redraws the date and the phrase at once. With a spoken name, the sentence is the phrase, a comma, a space, the name, and a full stop. With no name, the sentence is the phrase and a full stop.
- **AC-15**: `greeting_name` returns the spoken word, or an empty string. A saved `display_name` wins: trim it, take the text up to the first Unicode whitespace, and keep at most 40 Unicode scalar values (`chars` in Rust). If that is empty, use the same rule on `whoami::realname()` from crate `whoami` 2.1.3, whose return is `Result<String>`. A missing settings file is not created. An unreadable or broken settings file counts as no saved name. In both cases the command still calls `realname()`. If that call fails, or the string is empty after trim, the command returns an empty string and does not show an error on the greeting. If `realname()` succeeds with the account name, that first word is still spoken. The command never calls `username()`, never writes the settings file, and never logs the name. The page does not receive the raw Windows string or the raw saved field.
- **AC-16**: With no folder open, New note, the template cards, New folder, and search are inactive, and recent notes are not requested. Open folder and the greeting still work. The recent heading stays, and the body shows `recent_empty`, both in the sidebar and on the cards. With a folder open and an empty list, the body is also `recent_empty`. While the read is in flight, both places show `recent_loading`. When the list cannot be read, `recent_failed` plus the error replaces the list in both places, and the heading stays. The tree, the templates, and the greeting still work.
- **AC-17**: Light and dark follow the Windows setting, as spec 0004 already does. Every new app string exists in both `messages/pl.json` and `messages/en.json`. Weekday and month names from `Intl.DateTimeFormat` are not message keys.
- **AC-18**: `App.svelte` mounts `Sidebar`. Toolbar and CommandPalette stay unmounted. The sidebar component gains only the optional pieces named in the feature design. Focus, one line labels, and tokens stay as spec 0004 defined them. When an optional piece is absent, the component behaves as spec 0004 built it.
- **AC-19**: This feature never writes `display_name`. A settings file that already has that field keeps it when locale or recent notes are saved. A missing field, a blank field, or a value that is not a string loads as no saved name and leaves locale, fonts, and recent notes alone.
- **AC-20**: A status line sits under the sidebar, separate from the save phrase in the footer. It shows action results with the labels you already have (`template_created`, `template_failed`, `action_failed`, `search_failed`, and the rest of today's status prefixes) plus the existing error or path text. It is absent when there is no status. The footer never carries these sentences.
- **AC-21**: Any action that opens a note, creates a note or folder, or opens another folder runs the existing leave rules first. If leave fails, the action does not run and no file is written. That covers header New note, the start surface New note, template cards, recent rows, tree rows, search hits, the sample action, and Open another folder.

## Decision

**Chosen option**: Option 1, mount the Papier shell on the commands you already have

The sidebar and the start surface become the window. Recent notes and templates stay stored as spec 0003 left them. The only new stored read is an optional `display_name`, and this step never writes it.

**Implementation skills**: `svelte-code-writer` (`sveltejs/ai-tools`, `.agents/skills/svelte-code-writer/`) · `svelte-core-bestpractices` (`sveltejs/ai-tools`, `.agents/skills/svelte-core-bestpractices/`) · `tauri-v2` (`nodnarbnitram/claude-code-extensions`, `.agents/skills/tauri-v2/`) · `paraglide-js` (`zhuojg/agent-skills`, `.agents/skills/paraglide-js/`) · `vitest` (`antfu/skills`, `.agents/skills/vitest/`)

## Feature design

Reasoning and options: see [rationale.md](rationale.md).

**Data model sketch**:

| Entity | Key | Fields | Where it lives |
|---|---|---|---|
| Saved name | the settings file | `display_name`, optional string | On disk. This feature only reads it. |
| Windows name | none | the account display name | Not stored. Read when the greeting is built. |
| Greeting name | none | one word, at most 40 characters | Derived by `greeting_name`. |
| Recent notes | folder identity | paths, newest first, at most 10 | Unchanged, spec 0003. |
| Templates | `lecture`, `problem-set`, `lab` | Typst text in Rust | Unchanged, spec 0003. |
| Selected place | none | a folder path counted from the root, or empty for the open folder itself | Memory for this window. |
| Open folders in the tree | none | those folder paths | Memory for this window. |

No relationship links the saved name to a note. The place is not a file.

**State transitions**:

- Window: no folder and no note, then a folder and no note, then a note open. Close, after a clean leave, returns to a folder and no note. Opening another folder returns to that folder and no note after the same leave rules.
- Place: empty (the open folder itself), or one folder path. A folder click sets the place to that path and toggles open. The workspace name click sets the place back to empty. Opening another folder, or deleting the marked folder, sets the place back to empty.
- Save phase: the machine you already have (saved, saving, unsaved, conflict). The footer mirrors it. No open note is shown as saved. The dot is on for unsaved, saving, and conflict.

**API surface**:

Commands are Tauri commands. The page still never sends the folder root. Auth is the local student on this computer.

| Command | Kind | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `create_blank_note` | new command | `parent` string, required, a path counted from the root, empty means the open folder itself | `Note` (path, text, fingerprint), same as `create_note` | local | no folder open (existing root error). Bad parent (existing invalid name). All 100 names taken (`AlreadyExists`, nothing written). |
| `greeting_name` | new command | none | one string, the spoken word or empty | local | none to the page. A failed read returns empty. |
| `open_workspace` | existing | the folder picker | `WorkspaceInfo` or none when cancelled | local | picker or root errors you already surface. The picker runs only after leave succeeds (AC-21). |
| `open_note` | existing | `path` counted from the root | `Note` | local | existing read errors. Leave runs first (AC-21). A search hit does not pass a line. |
| `list_tree` | existing | none | the tree | local | existing file errors |
| `create_from_template` | existing | `parent`, `template` id | `Note` | local | existing template and path errors |
| `create_folder` | existing | `parent`, `name` | the new path | local | empty or invalid name, existing path errors |
| `rename_entry` | existing | `from`, `to` | the new path | local | existing refusals |
| `delete_entry` | existing | `path` | none | local | existing refusals |
| `list_recent_notes` | existing | none | paths | local | read failure, shown as recent failed |
| `search_notes` | existing | `query` | hits (path, line, snippet) | local | existing search failed |
| `set_locale` | existing | `pl` or `en` | settings, locale only | local | existing bad locale |
| `create_sample_note` | existing | none | `Note` | local | existing file errors |
| save, PDF export | existing | the open note | the results you already return | local | conflict and export errors stay on the note stage |

`create_blank_note` uses the same name loop as templates (`candidate_names`), with the stem `note`, then `create_note`'s remember and recent recording. `greeting_name` calls `whoami::realname()` and does not call `username()`.

**Value sourcing**:

| Action | Value produced or displayed | Source |
|---|---|---|
| Greeting sentence | the phrase | the locked list below, picked by the local day index in AC-14 |
| Greeting sentence | the spoken name | `greeting_name` (AC-15). Empty means the phrase alone. |
| Date line | weekday, day, month | `Intl.DateTimeFormat`, locale `pl` or `en`, local time zone, weekday long, day numeric, month long (AC-14) |
| Status line | action result | existing message prefixes plus the existing Rust error or path text (AC-20). Absent when empty. |
| Workspace name | the folder name | `WorkspaceInfo.root_name`. With no folder, the existing no folder message. |
| Mark | one character | the first character of `root_name`. With no folder, the first character of `app_name`. |
| Recent card title | file name | the last segment of a path from `list_recent_notes` |
| Recent card line | the path | that same path, unchanged |
| Sidebar recent row | file name, tooltip path | the same path list |
| Template card | title, default file name, description | existing template titles, the three file names in AC-5, and the sentences below |
| Folder badge | child count | the length of that node's children in `list_tree`. Not stored. |
| Save footer and unsaved dot | the phase | `save_state_saved`, `save_state_saving`, `save_state_unsaved`, `save_state_conflict`. No note uses `save_state_saved`. The dot is on the tree row and the Recent row for that path. |
| Search hits | path, line, snippet | `search_notes` |
| Place | where a new file lands | session memory (AC-7). The page sends it as `parent`. |
| Language | Polish or English | `set_locale`, stored `locale` |

Template descriptions, locked:

| Card | Polish | English |
|---|---|---|
| Lecture | Tytuł, data, prowadzący i miejsce na definicje oraz twierdzenia. | A title, a date, the lecturer, and room for definitions and theorems. |
| Problem set | Numerowane zadania z miejscem na rozwiązanie i odpowiedź. | Numbered problems with room for a solution and an answer. |
| Lab | Cel, aparatura, tabela pomiarów, niepewności i wnioski. | The aim, the equipment, a measurements table, uncertainty, and conclusions. |

Daily phrases, index 0 through 6. The name is not part of the phrase.

| Index | Polish | English |
|---|---|---|
| 0 | Hej | Howdy |
| 1 | Cześć | Hello there |
| 2 | No to piszemy | Ready when you are |
| 3 | Zaczynamy | Let us write |
| 4 | Miło cię widzieć | Good to see you |
| 5 | Notatki czekają | Your notes are waiting |
| 6 | Wchodzisz w to | Shall we begin |

Export pieces (`design/claude-design/screens/Home.dc.html`):

| Piece | This step |
|---|---|
| Workspace mark and name | In. Name is `root_name`. A click resets the place. |
| Header New note | In. Calls `create_blank_note`. |
| Search field | In. Today's search under the field. No `Ctrl+K` hint. |
| Sidebar recent section | In. File names. The export draws only the tree. The section stays so a recent note is reachable while a note is open. |
| Notes tree | In. |
| Folder count badge | In. Direct children. |
| Settings gear | Out. Feature 19. |
| Theme button | Out. Feature 19. Light and dark keep following Windows. |
| Footer save text | In. The four phrases you already have. |
| Date line | In. Local clock. |
| Greeting | In. The daily phrase and optional name. The export's morning sentence is not used. |
| Surface New note and Open another folder | In. Open another folder is also in the footer. |
| Template cards and descriptions | In. The sentences above. |
| Subject tags | Out. The app does not store subjects. |
| Preview paragraph | Out. The app does not store a preview. |
| Relative time | Out. Recent notes store paths only. |
| More menu on a recent card | Out. |
| Rename, delete, new folder | In, on the tree, even though the export does not draw them. |

Sidebar additions, all optional so spec 0004 callers stay valid:

- A row may set `title`. When it is absent, `title` stays the label.
- A folder row may set `count`. When it is set, the badge shows that number. A note does not set it.
- A row may set `current`. When it is set, the row is the open note (`aria-current`). `selected` stays the place.
- A row may set menu entries (label and action). When the list is empty or absent, the row has no menu button. The button is its own tab stop after the row. This feature passes rename and delete.
- The footer may take a language select: label, current value, the two options, and a change handler. This feature passes Polish and English.
- New note and search may be disabled. This feature disables both when no folder is open.
- A section may take an action (label, disabled, onclick). The Notes section uses it for New folder. The name field itself is rendered by `App.svelte` under the sidebar, not inside the component.
- The workspace name may take a click handler. When it is absent, the name is not a button. This feature sets the place back to the open folder itself.

Search hits are rendered by `App.svelte` under the sidebar, not inside the sidebar component. The component still only reports the query.

Recent and Notes both start expanded. The footer order is Open another folder, the language select, Close note while a note is open, the sample action while a folder is open, then the save phrase.

**Key invariants**:

- Typst source stays the truth. This feature does not change save, conflict, or PDF behaviour.
- The page never sends the folder root and never reads the Windows account itself.
- `display_name` is read, never written, by this feature. Other settings writers still change only their own fields and still keep unknown fields.
- Recent notes stay the per folder map from spec 0003. This feature does not add a time, a subject, or a preview.
- A new blank note and a template never overwrite an existing file.
- The greeting name is one word, at most 40 characters, and it is not written to the log.

**Security model**:

One student on this computer. There is no account in the app and no role. The spoken name is personal data that stays on the machine: it is shown in the greeting and it is not logged, not put on the status line, and not sent anywhere. Path checks stay in Rust, against the stored root. A saved name cannot widen those checks, because it is display text only.

**Configuration required**:

None. No new environment variable and no secret. Add crate `whoami` 2.1.3. Call `whoami::realname()`, which returns `Result<String>`.

**Critical test scenarios**:

- Happy path: open a folder, create a blank note, close it, and open a template and a recent card from the start surface, verifies **AC-1**, **AC-5**, **AC-6**, **AC-12**
- Happy path: the sidebar recent row still opens that note while another note is on screen, verifies **AC-3**, **AC-4**
- Failure case: close during a conflict keeps the note open and shows the existing banner, verifies **AC-2**
- Failure case: `note.typ` through `note-100.typ` already exist, so nothing is written and the status line shows `AlreadyExists`, verifies **AC-6**
- Failure case: a broken settings file or a failed `realname()` still opens the start surface with the phrase alone, verifies **AC-15**
- Failure case: a recent read failure shows on the sidebar section and on the cards, and the tree still opens a note, verifies **AC-16**
- Rule: saving locale or recent notes keeps a hand written `display_name`, verifies **AC-19**
- Auth and privacy: the page receives only the spoken word, and the log does not contain it, verifies **AC-15**
- Failure case: a missing settings file is not created, and `realname()` still runs, verifies **AC-15**
- Rule: rename retargets the place, and delete inside that folder clears it, verifies **AC-7**
- Failure case: leave fails, so New note and Open another folder do not run and write nothing, verifies **AC-21**
- Rule: 1 January picks phrase index 0, and a daylight saving day does not change the index, verifies **AC-14**
- Rule: with no folder, New note and search are inactive, and the mark is W, verifies **AC-12**, **AC-16**, **AC-18**

## Build plan

Skateboard: the first slice is a window you can already study in, on the commands you have. Later slices add organising, the greeting name, and the count badge. There is no settings migration. Old files have no `display_name`, and that means no saved name.

1. [x] Mount the Papier sidebar and the start surface in place of the old top bar and the old sidebar. Wire open folder, the tree, recent notes, templates, search, language, the save phrase, the status line, close, and the sample action to the commands you already have. Opening or creating runs the existing leave rules first. Recent cards show the file name and the path. Template cards show the title, the default file name, and the description. PDF export and manual save stay on the note stage. Toolbar and CommandPalette stay unmounted. Satisfies **AC-1**, **AC-2**, **AC-3**, **AC-4**, **AC-5**, **AC-10**, **AC-11**, **AC-12**, **AC-13**, **AC-16**, **AC-17**, **AC-18**, **AC-20**, **AC-21**.
2. [x] Add `create_blank_note`, the selected place, the workspace name reset, the row menus, and the new folder name field. Rename and delete keep today's retarget of the place. Satisfies **AC-6**, **AC-7**, **AC-8**, **AC-18**, **AC-21**.
3. [x] Add the date line, the daily phrases, and `greeting_name` with `whoami` 2.1.3. Read `display_name` and do not write it. A missing settings file is not created. Keep the field when locale or recent notes are saved. Satisfies **AC-14**, **AC-15**, **AC-19**.
4. [x] Show the direct child count on folder rows. Satisfies **AC-9**.

## Consequences

**Positive**:

- A student can open a folder, start a note, and organise it in the Papier shell without a new store for recents or templates.
- Recent notes stay one click away while a note is open.
- The greeting can say a name without this feature writing settings.

**Negative / tradeoffs**:

- The sidebar component grows the optional pieces in AC-18, so the shape spec 0004 froze gains additions.
- Save state sits in the footer, while the conflict banner stays on the note. One idea, two places, until feature 20 dresses the note stage.
- A failed account lookup is silent. The phrase stands alone, and there is no error to explain why the name is missing.
- The name cannot be edited until feature 19. Until then a saved name appears only when the settings file already has `display_name`.
- The tree still lists the whole folder. This step does not add paging.
- Rename and delete are on the row even though the home export does not draw them. The shell is the export plus the organising you already have.
- Search results stay under the field until feature 22.

**Neutral**:

- Feature 19 is the place that edits `display_name`, theme, and page colour.
- Feature 20 dresses the note stage, including PDF and manual save.
- Feature 21 chooses the palette shortcut. This step does not draw `Ctrl+K`.
- Feature 22 moves search onto its own screen.
- `design/claude-design` stays a reference and is not part of the Vite build.

## Follow-up

- [ ] Feature 19 should edit `display_name` with the one word rule in AC-15. This spec already reads that field and never writes it.
- [ ] Feature 21 should add the search shortcut hint. This spec leaves it off on purpose.
- [ ] Feature 22 should move the hit list onto the search screen. This spec keeps the hits under the field.
- [ ] `svelte-code-writer` conventions are not yet in root `AGENTS.md`. They apply to every Svelte file and belong at root level.
- [ ] `svelte-core-bestpractices` conventions are not yet in root `AGENTS.md`. They apply to every Svelte file and belong at root level.
- [ ] `tauri-v2` conventions are not yet in root `AGENTS.md`. They apply to the shell and the Rust commands and belong at root level.
- [ ] `paraglide-js` conventions are not yet in root `AGENTS.md`. They apply to every app string and belong at root level.
- [ ] `vitest` conventions are not yet in root `AGENTS.md`. They apply to page tests and belong at root level.

## Rationale

Reasoning and options: see [rationale.md](rationale.md).
