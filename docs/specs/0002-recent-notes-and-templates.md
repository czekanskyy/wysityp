# 0002 · Recent notes and templates

**Status**: Assumed
**Date**: 2026-11-05
**Authorized by**: the engineer, during /develop

## Owed decision

Where recent notes live, and where templates live. Scope feature 3 (the data model) is still planned, so those homes are not decided yet.

## Assumption built on

Recent notes are stored by Rust in the same settings JSON file as `locale`. A new field, `recent_notes`, sits beside `locale`. It stores workspace relative note paths, most recent first, at most 10, with duplicates collapsed, plus a workspace identity Rust compares with the open folder. Rust refuses entries from a different folder. The page never sends the root, and the list the page receives is only those relative paths. The workspace identity stays in the file. The `locale` field stays the only place language lives. An old settings file without the new field still loads.

Templates are built in Typst strings held in Rust, not files on disk. No new home on disk is invented before the data model decision. The three templates are a lecture, a problem set, and a lab note. Each body is ordinary Typst. The first line is a title placeholder the student replaces. The words follow the `locale` already stored in the settings file. The page does not send a language for them.

The default file names are `lecture.typ`, `problem-set.typ`, and `lab.typ`, inside the folder the page already uses for new notes (a path counted from the root, or the open folder itself). If that name exists, Rust picks the next free name (`lecture-2.typ`, and so on) and never overwrites. The status line shows the path that was written. A path outside the open folder is refused.

Both choices are easy to reverse. The new field can move when the data model decides a home, and the strings can move into files later.

## Code area

`src/App.svelte`, `src/lib/api.ts`, `src/lib/api.test.ts`, `src-tauri/src/commands.rs`, `src-tauri/src/settings.rs`, `src-tauri/src/templates.rs`, `src-tauri/src/files.rs`, `src-tauri/src/lib.rs`, `messages/pl.json`, `messages/en.json`

## Requirements

A student can find an old proof by a word inside it during exam week. Full text search already does this and stays as it is.

A student can jump back to yesterday's lecture in two clicks. The sidebar lists notes opened recently, most recent first, at most 10, with duplicates collapsed. Opening a note records it. An entry that no longer exists, or that sits outside the open folder, is dropped or clearly refused, and the app does not crash.

A student can start today's lecture from a template that already has the right shape. At least three built in templates, named for a lecture, a problem set, and a lab note, each create a new plain `.typ` file inside the open folder through Rust only. The default file name never silently overwrites an existing file. The app picks a free name when the default is taken, and the status line says which file was written. Each template body is ordinary Typst with a title placeholder the student replaces.

## Ratify

This decision was recorded by /develop, not deliberated. Run `/architect recent notes and templates` to deliberate and ratify it. Until then it stays flagged as an owed decision. It does not block marking the feature `done`.
