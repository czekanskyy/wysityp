# 0008. Typeset math and paste

**Date**: 2026-11-10
**Status**: Proposed

## Summary

A math span whose selection is elsewhere is the formula Typst typeset, not a chip of source. Clicking or arrowing into it still shows the source in place (spec 0002 AC-5 and AC-6). Pasted pictures are files beside the note. Code and links are drawn on the page. A table stays source.

The owner was asleep, so the choices below were made here instead of an architect round. Symbol entry and a table grid editor are out of this slice.

## Decisions

- The buffer stays plain Typst. Rendering never edits it. The caret stays a source offset. Nothing slow runs on the keystroke.
- `render_math` compiles each formula as its own tiny page (`width: auto`, `height: auto`, `fill: none`). It does not use the open note's world. The engine gate is held per formula so fonts do not race the note compile. A panic becomes an error string.
- The preamble is the note's top-level `#let`, `#import`, `#set`, and `#show`, minus `#set page`. If that document fails, the formula is compiled again with no preamble.
- Glyph colour is the page text token (`#1f1d1a`, `#3a2f22`, `#e6e2da`, `#d8d4cc`), at 12.75pt (17px body). Cache key is source, block, colour, size, and preamble. Debounce is 80ms. A batch holds at most 32. An unchanged formula is not sent again.
- The SVG is drawn as an `<img>` blob URL after a script strip. It is never parsed as HTML. While a formula is pending or broken, the source chip stays, with the error as its title. The last good size is reserved. A caret inside math shows a preview under that line; a broken formula shows the Typst error there.
- Typing `$` inserts `$$` with the caret inside. Typing `$` on the closer steps over it. `\$` stays one character.
- A pasted or dropped image goes to `save_note_image` and the note gains `#image("…")` with a path relative to the note. No `#figure`. A note with no file yet shows `image_needs_note`. The page never reads the disk. `read_note_image` and `render_math` resolve the path through the same access gate as the shell: a folder note, a loose note, or a draft. A draft's pictures sit in `{stem}.assets` beside the draft. Save As moves that folder with the file and keeps its name, so the `#image` paths in the buffer stay valid.
- Raw spans (fenced and inline) use the source font and `--page-code-bg`. `#table` stays source. `insertTable`, `insertCodeBlock`, `insertMath`, `insertImageFromDialog`, and `insertLink` sit on `EditorHandle` for a later toolbar.
- A bare `http`/`https`/`mailto` URL and `#link("url")[text]` draw as a link. Ctrl+click opens it through `open_link`. Other schemes are refused. The webview does not get the opener permission.
- `createEditor` takes `services: { renderMath, saveImage, loadImage, openLink }` plus one shared object. The session in `src/lib/state/session.svelte.ts` owns that object. There is one math cache and one picture cache for every tab. A tab switch writes the cached paints into the next state before it is shown. `App.svelte` does not touch the editor.

## Code

`src/lib/math.ts`, `src/lib/paste.ts`, `src/lib/insert.ts`, `src/lib/editor.ts`, `src/lib/spans.ts`, `src/lib/editorServices.ts`, `src-tauri/src/math_render.rs`, `src-tauri/src/media.rs`, `src-tauri/src/files.rs`
