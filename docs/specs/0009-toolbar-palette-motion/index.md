# 0009. Toolbar, palette, and motion

**Date**: 2026-11-10
**Status**: Proposed

## Summary

The formatting toolbar sits under the tab strip. One action registry drives the command palette, the shortcut sheet, and the window chords. Chrome eases. Typing does not.

The owner was asleep, so the choices below were made here.

## Decisions

- Working controls edit the Typst buffer through `EditorHandle`. The toolbar and the palette call `insertMath`, `insertCodeBlock`, `insertLink`, `insertTable`, and `insertImageFromDialog`. The image button is enabled. `src/lib/toolbarActions.ts` still has the same skeletons as a fallback for a handle that lacks those methods.
- Controls with no feature (superscript, colour, blocks, and the rest of that row) render disabled, with a "coming soon" tooltip. They are not in the palette.
- The style menu sets body or heading 1–3 by replacing a leading `=` run. Its label stays "Paragraph style" because the editor does not notify Svelte on every caret move.
- Toolbar clicks call `preventDefault` on mousedown so the caret and selection stay. The paragraph menu returns focus to the editor.
- Sidebar toggle is Ctrl+\. The export used that chord for "clear formatting", which is not a feature. Ctrl+B is bold.
- Ctrl+Shift+S is Save as. The export used it for the symbol picker, which is not a feature. A draft opens the native dialog. A note that already has a path saves in place.
- Palette: Ctrl+Shift+P and F1. Go to note: Ctrl+P (open tabs, then recents and folder notes that are not already open). Shortcut sheet: Ctrl+/. The sheet is generated from `src/lib/actions.ts`, including the extra F1 row. Arrow keys, Enter, and Escape. Focus returns to the editor on close.
- Search in notes focuses the sidebar field when a folder is open. With no folder, the status line says to open one.
- Motion tokens are 120ms, 180ms, and 240ms, plus standard, enter, and exit curves. Dialogs fade and scale in and out. The sidebar width eases and the tree stays mounted. Tabs fade in and the active tab grows an accent bar. Switching tabs dips the page opacity and does not flash white. Split view eases the second column. `prefers-reduced-motion: reduce` collapses durations to nothing.
- Rendered spans, math chips, and diagnostic underlines do not animate. A loose note's diagnostic matches when one path is absolute and the other is the file name. A template buffer matches `.wysityp-buffer.typ`. Two different relative paths still do not match.
- The status bar keeps the save state and the path. View, save, and export live on the toolbar and in the palette.

## Code

`src/lib/toolbarActions.ts`, `src/lib/actions.ts`, `src/lib/shell/EditorToolbar.svelte`, `src/lib/shell/ShortcutSheet.svelte`, `src/lib/ui/CommandPalette.svelte`, `src/styles/base.css`.
