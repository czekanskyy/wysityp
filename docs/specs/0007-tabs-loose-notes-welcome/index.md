# 0007. Tabs, loose notes and welcome page

**Date**: 2026-11-10
**Status**: In Progress

## Summary

Several notes can be open at once. Each tab keeps its own editor state, so switching loses nothing. A note does not have to live in the open folder: Ctrl+N with no folder writes a draft under the app data directory, and Ctrl+O opens one `.typ` file anywhere. The welcome page is shown when no tab is open.

## Requirements

**User stories**:

- As a student, I want several notes open, so that I can move between lectures without losing my place.
- As a student, I want to start writing before I have picked a folder, so that a draft is a real file I can save where I choose.
- As a student, I want a quiet welcome page, so that the editor stays the focus once a note is open.

**Acceptance criteria**:

- **AC-1**: Ctrl+N with no folder creates `untitled.typ` (then `untitled-2.typ` through `untitled-100.typ`) in `{app data}/drafts`. The tab title is the localised word Untitled. The bytes use the same blank heading as a note in a folder. Ctrl+S opens a native Save As, moves the file, and keeps the text, caret, and undo history. Closing a draft that is still only that heading, or blank, deletes the file. A draft that holds the student's text stays, and is opened as a tab on the next launch. A conflict or a failed save does not delete the file.
- **AC-2**: Ctrl+O opens a native dialog for one `.typ` file, with or without a folder. The page never touches disk and never chooses what is allowed. Rust allows a path only when it is inside the opened folder, inside the drafts folder, or on an in-memory allow list. The allow list holds files picked in a dialog and loose paths Rust itself wrote into recents or the session. Anything else is refused.
- **AC-3**: Rendering a loose note uses that file's parent as the Typst root, so an image beside the note resolves. A note inside the opened folder still uses the folder.
- **AC-4**: The tab strip keeps one CodeMirror state per tab (text, caret, scroll, undo). A dirty dot shows while the tab is unsaved. Close, middle-click, and Ctrl+W close a tab after a save flush. A conflict blocks that close. Ctrl+Tab and Ctrl+Shift+Tab cycle. Opening a note that is already open focuses its tab. Rename and delete update or close the matching tabs.
- **AC-5**: Open tabs and the active tab are stored in the settings JSON and restored on launch. A missing file is skipped. The open folder is still not restored. A restored note from a folder comes back as a loose path until that folder is opened again, and then it adopts the relative path.
- **AC-6**: With a folder open, New note opens a dialog: Blank note is preselected, then the shipped templates, then the student's templates. Enter confirms and Escape cancels. With no folder, New note creates a draft and skips the dialog. Edit and Copy stay on the template rows.
- **AC-7**: The welcome page shows the app name, New note (Ctrl+N), Open note (Ctrl+O), Open folder (Ctrl+Shift+O), and the last five notes from one global recent list. A recent note from another folder opens as a loose note. The greeting and the template cards are not on this page.
- **AC-8**: Typing saves about one second after the last change, and at once on tab switch, window blur, tab close, and app close. A save does not rebuild the editor, reload the note, refresh the tree or the recents, or move the caret. The save word fades in a fixed slot. Preview images swap only after the new SVG has loaded.

## Decision

**Chosen option**: Drafts in app data, one global recent list, tabs restored as loose paths.

The page sends a path. Rust decides. Dialogs are opened in Rust. Recents stay one list of absolute paths (`recent_files`, cap 10) while the per-folder map from spec 0003 is still written. The session stores `{ tabs, active }`. Autosave waits 1000 ms. The visible flicker came from rewriting the save line on every pause and from replacing preview blob URLs before the browser had decoded the new SVG.

A note opens on the rendered page. Source and split stay on the status bar, and the editor stays mounted in every mode. Opening a tab, switching to one, and confirming the new-note dialog focus the editor. The live document is copied onto the tab before a save or a tab switch, and a stored undo history is put back only when it is still that document. `.typ` is matched without regard to case. Rust deletes a draft only when the path resolves as a draft.

## What this does not decide

The formatting toolbar, math, and the command palette stay with their own features. The rendered page from spec 0002 is the default view of a tab. Shortcuts are window shortcuts, not operating-system global shortcuts.
