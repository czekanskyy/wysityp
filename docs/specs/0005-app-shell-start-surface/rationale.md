# 0005. App shell and start surface, rationale

## Context

The app already opens a folder, lists notes in a tree, creates and renames and deletes, saves as you type, switches Polish and English, lists recent notes for each folder, and creates three templates. That behaviour lives in the page and in Rust, and specs 0001 and 0003 already lock the storage. Spec 0004 built the Papier sidebar, cards, and menus, and left them unmounted. The window the student sees is still the earlier layout: a top bar, a plain sidebar, and an editor stage.

Scope feature 18 asks for that Papier shell on the pieces you already have, in both languages and in light and dark. The home export in `design/claude-design/screens/Home.dc.html` also draws subject tags, preview paragraphs, relative times, a settings gear, a theme button, and a search field that looks like a command shortcut. The app does not store subjects, previews, or open times. Theme and the search screen belong to later features. The student still needs a way back to the start surface, a place for language, and the organising actions the export does not draw.

The greeting on that export is a fixed morning sentence. You wanted a livelier phrase, and a name when the computer has one, with any saved name waiting for the settings screen.

Leaving this undecided means the next build either mounts the whole export, including data you do not have, or invents a second layout beside spec 0004.

## Options considered

### Option 1: Mount the Papier shell on the commands you already have

The sidebar and the start surface replace the top bar and the old sidebar. Recent notes, templates, search, save, and language keep their current commands. Two new commands cover a blank note name and the spoken greeting name. `display_name` is read and never written. Tags, previews, times, the theme button, and the search screen wait.

**Pros**:

- The student can study in the new shell without a new store for notes or recents.
- Later features receive a window that already matches the export where the data exists.

**Cons**:

- The sidebar component gains optional pieces spec 0004 did not have.
- The home export is not copied in full. Organising is added, and several drawn pieces are left out.

### Option 2: Copy the home export as drawn

Mount every block on the home screen, including tags, previews, times, the settings gear, and the theme button. Invent the missing data or show sample text.

**Pros**:

- The window matches the picture on the first try.

**Cons**:

- Sample subjects and preview text would teach a student to trust data the app does not have.
- Theme storage and the settings screen belong to feature 19. Building them here splits that feature.

### Option 3: Restyle the old sidebar and skip the start surface

Keep recents and templates in the sidebar. Apply Papier colour to the current layout. Leave the main area as the editor, empty until a note opens.

**Pros**:

- The smallest change. No new commands and no greeting.

**Cons**:

- The done when for feature 18 asks for a start surface with templates and recent notes.
- While no note is open, the main area stays a blank editor.

## Rationale

Option 1 is the one that fits the forces in the context. The storage decisions are already made, so a new shell should call the commands you have. The export is the look, and the pieces it draws without data wait, because showing them would be a promise the files cannot keep. Option 2 matches the picture and breaks that promise. Option 3 is smaller and misses the start surface the scope row asks for.

The greeting name stays a read. You asked for a saved name and also asked that the editor wait for settings. Reading `display_name` now means feature 19 can add the field editor without a second storage decision. Writing it here would build that settings control early.

The Windows name uses the `whoami` crate and `realname()`, because the same call can serve a later Mac or Linux build, which spec 0001 leaves open. A direct Windows call would be one less dependency and more platform specific code. The account name from the environment is the wrong string: you asked for the display name. A search on 2026-11-09 found no Agent Skill and no MCP server for this crate. The name collisions were other projects that only share the word whoami.

The phrase list is locked in the build spec so the build does not invent copy. You can change a line in that table if a phrase is wrong. The index uses the local calendar day so a refresh does not shuffle the sentence, and so daylight saving does not move it.

A fresh read of the draft found places a build would have had to invent: where action errors go, which save phrase keys to use, whether leave runs before a new note, and how a folder click can mark an already open folder. Those are now in the acceptance criteria. The status line stays under the sidebar. The save phrase stays in the footer. A folder's twist icon opens and closes it, and the rest of the row marks the place.

## Export inventory

The home screen and the sidebar readme were read on 2026-11-09. The build spec's table is the decision. These are the notes behind it.

The sidebar readme says the section order is Recent, then the folder tree. The home screen draws only the tree, and puts recent notes on the start surface as rich cards. Both stay: cards when no note is open, and a short recent section so the list still exists while a note is open. Spec 0003 already requires the sidebar list.

The home search field links to the search screen and paints `Ctrl+K`. Feature 21 owns that shortcut, and feature 22 owns the search screen. This step keeps the search you have, under the field, and leaves the hint off.

The footer in the export is a settings link, a theme button, and a saved phrase. Language has no home in that footer. This step puts language, open folder, close, the sample action, and the save phrase there, and leaves settings and theme for feature 19.
