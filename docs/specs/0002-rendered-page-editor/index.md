# 0002. Rendered page editor

**Date**: 2026-11-05
**Status**: Proposed

## Summary

You type in the editor the app already has, and the Typst source stays the only copy of the note. Headings, lists, quotes, and body text are drawn as structure in the same place as their source while you are not editing them. A click or an arrow key opens that source where it stands, and a part that fails to parse or compile stays visible as source with the error you already get. The page pictures from the compile stay beside the note and must not take your caret or your place on the page.

## Requirements

**User stories**:

- As a student in a lecture, I want the page to show headings, lists, quotes, and body text as structure while I type, so that I can read the note as I write it.
- As a student, I want to click a rendered part and edit its Typst source right there, so that I do not lose my cursor or my place.
- As a student, I want a broken part to stay visible with its error, so that a mistake never opens a blank hole.
- As a student, I want arrows, selection, and undo to follow the source, so that fast typing never traps me inside a picture of the page.

**Acceptance criteria**:

- **AC-1**: Decorations, the print preview, and a compile never change the editor buffer or the note file. The buffer stays plain Typst. Saving still writes that buffer, and only that buffer, through the existing save path.
- **AC-2**: A body paragraph, emphasis, strong text, a heading, a bullet item, a numbered item, a term item, and a quote that the scanner accepts are shown as structure in the editor, in the place of their source, while the selection does not touch them.
- **AC-3**: Clicking a rendered span moves the caret into that span's source and shows the source there. The editor does not scroll that span to the center. It scrolls only when the caret would leave the window, and then by the smallest move.
- **AC-4**: A span the scanner cannot close, and a span overlapped by a current error, stays visible as its own source. The editor shows the compiler message with it. The editor never draws an empty box in its place.
- **AC-5**: A math span is a placeholder. Clicking it, or moving the caret into it, shows its Typst source in place, dollars included. This feature does not typeset that math and does not add symbol entry.
- **AC-6**: Arrow keys move the caret through rendered spans and source spans in source order. The caret does not get stuck on a rendered span, and it does not jump over the words of a rendered span. A math span opens as source when an arrow would otherwise skip it.
- **AC-7**: A selection that covers rendered parts and source parts is one source selection. Copy and cut place the Typst source of that range on the clipboard. Undo reverts source edits only. A decoration change or a preview update is not an undo step.
- **AC-8**: On a note of at least 5000 words that includes math, one ordinary inserted letter does not scan the whole note, a caret move inside an already open span does not rebuild other spans, and applying a render result does not change the caret or the editor scroll. The editor thread work for that letter stays within 16ms (one display frame) on that fixture. The automated check locks the scan window and the unchanged caret. The 16ms figure is a measurement the build writes down.
- **AC-9**: Enter in a heading starts a body line. Enter in a list item that has text continues the same marker, and Enter on an empty item removes the marker. Enter in a quote that has text stays inside the quote, and Enter on an empty quote line leaves the quote. Backspace at the first content position of a heading or a list item removes the marker and does not delete the previous paragraph. Tab nests a list item by two spaces, Shift Tab removes two spaces of that indent, and Tab does not move focus out of the editor. These keys do nothing while a composition (an IME input in progress) is active.
- **AC-10**: An error place in the editor is the diagnostic start and end, counted in UTF 8 bytes in the exact source that was compiled, converted with `byteOffsetToUtf16` against that same source. Marks are applied only when the diagnostic file is the open note (or the file field is empty, which means that note). A diagnostic for some other file stays in the list and does not mark the editor. The marks and the list update only when the render revision is the latest one and that source still equals the editor buffer. Otherwise the editor marks are cleared and the list waits. Byte places from an older source are never applied to a newer buffer. A warning does not force a span back to source. Only severity `error` does.
- **AC-11**: The print preview shows the compile's SVG pages in order, as images, and replacing those images does not focus the preview or move the editor caret or the editor scroll. A render whose path is outside the opened folder is refused, and the buffer stays as it was.

## Decision

**Chosen option**: Option 1, in place source decorations

The writing surface stays the CodeMirror 6 editor from spec 0001. The Typst source in that editor is the only document. Eligible spans are drawn as structure with decorations on that source. The SVG pages from `Engine::render` stay in the print preview and are not a second document.

**Implementation skills**: `typst` (`lucifer1004/claude-skill-typst`, `.agents/skills/typst/`) · `vitest` (`antfu/skills`, `.agents/skills/vitest/`) · `svelte-code-writer` (`sveltejs/ai-tools`, `.agents/skills/svelte-code-writer/`) · `svelte-core-bestpractices` (`sveltejs/ai-tools`, `.agents/skills/svelte-core-bestpractices/`)

No CodeMirror skill is installed. Editor behavior in this spec is the contract. The CodeMirror guides are the reference for the decoration and keymap APIs.

## Feature design

**Data model sketch**:

Nothing new is stored on disk. The note file remains the plain Typst file from spec 0001. The editor buffer remains the only live copy.

The span map is derived, in memory, from that buffer. It is never saved, and it is never sent to Rust. A span has:

| Field | Required | Meaning |
|---|---|---|
| from | yes | Start offset in the editor buffer, UTF 16 code units, inclusive. This is a CodeMirror position. |
| to | yes | End offset, exclusive. The interval is half open: a caret at `to` is outside the span. |
| kind | yes | One of `body`, `heading`, `bullet`, `enum`, `term`, `quote`, `math`, `emphasis`, `strong`. |
| level | yes, may be empty | Heading level (the count of `=`), or list depth, or empty. |
| marker | yes, may be empty | The source marker text to hide or to repeat, such as `= `, `- `, `+ `, `/ `. |
| closed | yes | False when the construct does not finish. An unclosed span is not eligible to render. |
| block | yes | True for a paragraph, heading, list item, quote, or block math. False for emphasis, strong, and inline math. |

Spans of the same kind do not overlap. An emphasis or strong span may sit inside a body, list, quote, or heading span. The map is replaced for the dirty window on each edit. Spans outside that window stay, shifted by the edit.

Display state of a span, also derived, never stored:

- Source, when the selection intersects the span, or `closed` is false, or a current error overlaps it, or it is a math span with no inner text.
- Rendered, otherwise.

A selection intersects a span when some selection range has `from < span.to` and `to > span.from`.

**State transitions**:

- An edit or a caret move recomputes display state from the buffer, the selection, and the current diagnostics.
- A span leaves the map when a later scan of its window no longer produces it.
- Diagnostics replace the previous set only under AC-10. They do not edit the buffer.

**API surface**:

No new Tauri command. The compile stays `render_note` in `src-tauri/src/commands.rs`, which calls `Engine::render` in `src-tauri/src/typst_engine.rs`.

| Call | Kind | Key inputs | Key outputs | Who | Key errors |
|---|---|---|---|---|---|
| `render_note` | Existing Tauri command | path (string), source (string), revision (number) | revision, pages (SVG strings), diagnostics | The open app. Rust checks the path inside the stored root. | Path refused. Typst errors come back as diagnostics. A panicked compile must not wedge the next one (the engine already does this). |
| `classifySpans` | New page function in `src/lib/spans.ts` | source (string), change from, change to | The span list for the dirty window, plus the window bounds | The editor, on the page, during the edit | Does not throw the note away. Unclosed constructs return `closed: false`. |
| `planDecorations` | New page function in `src/lib/spans.ts` | spans, selection ranges, diagnostics already converted to UTF 16 | A decoration plan: hide ranges, style ranges, math widgets, error ranges | `createEditor` in `src/lib/editor.ts` | No empty widget. An ineligible span adds no widget. |
| Structure keymap | CodeMirror keymap inside `createEditor` | The key event, the selection, the spans | One source change, or nothing | The student | Ignored while composing. Any other key is left to CodeMirror. |

`byteOffsetToUtf16` and `RenderGuard` in `src/lib/render.ts` stay the byte conversion and the latest revision check. `jumpToDiagnostic` in `src/App.svelte` stays the error click.

**Which spans render**:

The scanner reads markup only. It does not treat a second syntax. Inside raw text (backticks), inside math, and inside a line comment (`//`), it does not look for headings or lists. A `\$` is not a math delimiter. A `#` call other than the quote form below stays source. That includes `#set`, `#let`, `#show`, tables, code, images, and links (later features).

- Heading: at column 0, one or more `=`, then a space. The span is that line. `level` is the count of `=`. `marker` is the `=` run and the space. Without the space, the line stays source.
- Bullet: a line whose text after leading spaces is `-` and a space. Depth is the leading space count divided by 2, rounded down. The span runs from the marker line through continuation lines until a blank line or the next item at the same or lesser depth.
- Numbered item: the same shape with `+` and a space. Kind `enum`.
- Term item: the same shape with `/` and a space, and a colon on the marker line. Without the colon, the line stays source. Kind `term`.
- Quote: `#quote[content]`, or `#quote(attribution: [text])[content]`. The span runs from `#quote` through the matching content `]`. Brackets inside strings, raw text, and math do not count. Any other argument form stays source. A missing `]` makes `closed` false, and the unclosed attempt does not swallow the rest of the note.
- Emphasis: `_text_` that does not cross a blank line. Strong: `*text*` the same way. Unclosed marks stay source.
- Math: `$` to the matching `$`. It is block math when the opening `$` has whitespace or the start before it and whitespace after it, and the closing `$` has whitespace before it and whitespace or the end after it. Otherwise it is inline. An unmatched `$` stays source. Empty math (`$$` with nothing inside) stays source.
- Body: a paragraph that is not a heading, list item, quote, or block math. Inline emphasis and strong may sit inside it.

**How a rendered span looks**:

The words on the page are the source characters. They are not copied out of an SVG.

- A hidden marker is a small atomic range, so the caret skips the marker characters and does not stop inside them. The words themselves are not atomic.
- A heading hides its marker and is drawn larger than body text. A deeper level is visibly smaller than the level above it. Exact sizes and colours wait for the design system. Do not invent a palette here.
- A bullet hides `- `. A numbered item hides `+ ` and shows a number. That number is one plus the count of earlier `enum` siblings at the same depth in the current list run. It is not a number returned by Typst. A term item hides the `/ ` marker and shows the term text that sits before the colon.
- A quote hides `#quote`, the attribution argument when it is the simple form above, and the outer brackets. The content is indented. The attribution text, when present, is the source slice of that `[text]`, shown under the quote.
- Emphasis is italic. Strong is bold. Markers hide while rendered.
- A rendered math span is a widget whose text is the source between the dollars. The widget is not HTML parsed from the note. It is a text node. It is omitted whenever the selection intersects the span, so the dollars and the source show instead. The widget is not focusable.
- The rendered page hides line numbers and the active line highlight that the scaffold turns on in `createEditor`. The font for rendered prose is proportional and must cover Polish letters (Segoe UI on Windows is enough). Raw source that stays source may stay monospace.

**Click, arrows, selection, undo**:

- A click on document text uses CodeMirror's position at that point (`posAtCoords`). A click on a math widget uses the span `from`. The handler keeps the editor focused, sets the selection to that source position, and does not center the scroll.
- Arrow movement is CodeMirror movement over the buffer. Because markers are the only atomic ranges, Left and Right walk the words in source order.
- A math widget would otherwise be atomic and would skip the whole formula. A selection change that crosses a rendered math span in one step is corrected in that same update: moving forward places the caret at the span `from`, moving backward places it at the last position inside the span. The widget is then omitted because the selection intersects the span.
- Copy and cut use the editor document between anchor and head. There is no second selection on the preview.
- History stays the CodeMirror history already brought in by the editor setup. Only document changes enter it. Decoration updates and preview updates must not be document changes.

**Structure keys** (lecture speed, pending the ratification in Follow-up):

- Enter in a heading inserts a newline at the caret and does not copy the `=` marker onto the new line.
- Enter in a bullet, enum, or term item: if the item has text after the marker, insert a newline, the same indent, and the same marker. If the item has no text, delete the marker and the indent so the line is a body line.
- Enter in a quote: if this line has text, insert a newline at the caret, and if the caret is at the end of the content insert it before the closing `]`. If this line has no text, place the caret just after the quote span so the next typing is outside the quote.
- Backspace with an empty selection at the first content position of a heading or list item deletes the marker (and the list indent) only.
- Tab with an empty selection in a list item inserts two spaces at the start of that item line. Shift Tab removes two leading spaces when they are there. Tab anywhere in this editor does not move focus to another control.
- These handlers do nothing while the key event is composing.

**Typing latency**:

Two clocks stay separate.

- The typing clock runs on the editor thread, inside the edit. It may classify the dirty window and patch decorations. It must not call Rust, must not compile, and must not walk the whole note on an ordinary letter.
- The render clock stays the one in spec 0001. `scheduleRender` in `src/App.svelte` waits 350ms after typing pauses, then `render_note` compiles the whole note on a blocking thread. This feature must not start a second compile, and must not move that compile onto the keystroke.

The dirty window is the changed range, extended back to the start of the previous paragraph and forward to the end of the next paragraph. A paragraph break is a blank line. A change taller than 200 lines may scan the whole buffer once. That path is for a large paste, not for one letter.

Decoration patch: map the previous plan through the edit, then replace plan entries that overlap the dirty window or whose display state flipped. A caret move that stays inside a span already shown as source replaces nothing.

What to measure, on a fixture of at least 5000 words with Polish letters, headings, a list, a quote, and at least 20 math spans:

- Characters read by `classifySpans` for one inserted letter in the middle. Expected: the dirty window only.
- Decoration ranges replaced when the caret moves inside an already open span. Expected: none.
- Selection anchor, selection head, and the editor scroll top, before and after applying a render result whose source matches. Expected: equal.
- Editor thread time for that inserted letter, on Windows, during the build. Budget: 16ms. Write the number down with the build. Do not fail a unit test on a timer.

**Value sourcing**:

| Action | Value produced or displayed | Source |
|---|---|---|
| Classify spans | `from` and `to` | Offsets into the editor buffer the scanner just read. The buffer is the CodeMirror document. There is no second coordinate system and no SVG hit map. |
| Classify spans | kind, level, marker, closed, block | The scanner rules in this spec, applied to that buffer over the dirty window. |
| Show a rendered prose span | The words | The source characters in that span. Mark decorations hide markers and style the rest. Not taken from `RenderResult.pages`. |
| Show a numbered item | The number | One plus the count of earlier `enum` siblings at the same depth in the span map. Not a Typst layout result. |
| Show a math placeholder | The stand in text | The editor buffer slice between the two dollar marks. Shown as a text widget only while the span is rendered. |
| Map a click to source | The caret offset | `posAtCoords` when the click lands on document text. The span `from` when it lands on a math widget. |
| Paint the print preview | The SVG pages and their order | `RenderResult.pages` from `render_note`, in array order. Each string is one page from `typst_svg::svg` inside `Engine::render`. |
| Paint the print preview | Where those pictures sit | The existing preview pane in `src/App.svelte` (the `.pages` block), each SVG as an image blob URL, stacked in order. They are not inserted into the editor document and are not used to place the caret. |
| Apply a render result | The caret afterwards | The CodeMirror selection already on the editor. The apply step must not set `selection`. |
| Apply a render result | The scroll afterwards | The editor scroller position already on screen. The apply step must not call `scrollIntoView`. A decoration update may let the view keep the caret's pixels stable when height above it changes. It must not center the caret. |
| Open a span by click or by a diagnostic | How far to scroll | Only if the caret would leave the window, using the nearest edge, not `y: "center"`. This replaces the center scroll in `EditorHandle.setSelection` for these jumps. Opening a note may still place the caret at the start. |
| Show an error | The message and the hints | `RenderDiagnostic.message` and `hints`, produced by `map_diagnostic` in `typst_engine.rs` from the Typst compiler. Not translated. |
| Show an error | The place in the editor | `RenderDiagnostic.start` and `end`, UTF 8 bytes in the source sent with that render. Convert with `byteOffsetToUtf16` against that sent source. Apply only when `RenderGuard.isCurrent` is true for that revision and the sent source still equals `editor.getText()`. |
| Show an error | Whether a span must stay source | A diagnostic in that applied set with severity `error` whose converted range overlaps the span. Severity `warning` does not do this. |
| Show an error | Whether the bytes belong in this editor | `RenderDiagnostic.file`. Mark the editor only when that file is the open note, or the field is empty (the main source). Any other file is an included file. Its message may sit in the list, and its bytes are not offsets into this buffer. |
| Paste | The characters inserted | Plain text into the editor buffer at the selection, then a classify of the dirty window. HTML or another rich form is not parsed into Typst. |
| Drop a stale render | Whether to paint pages | `RenderResult.revision` against `RenderGuard.isCurrent`. Pages still follow spec 0001: a failed compile with no pages keeps the last good pictures. |
| Decide the sent source still matches | The comparison | String equality between the source passed into that `render_note` call and the current editor buffer. The page already has both. No new field on `RenderResult`. |
| Copy or cut | Clipboard text | The editor document from the selection anchor to the head. |
| Undo | The restored text | CodeMirror history of document changes only. |
| Enter, Backspace, Tab | The characters inserted or deleted | The rules in this spec, using the span `marker`, `level`, and `kind` for the span that contains the caret. |
| Compile | The source that is compiled | The editor buffer sent with `render_note`, as spec 0001 already fixes. |
| Save | The bytes on disk | The editor buffer, through the existing save command, after Rust checks the path. |

**Key invariants**:

- Typst source is the only document. The span map is derived from it and can be thrown away.
- Rendering never changes the source. Only typing, the structure keys, and save change what will be written.
- The page never touches disk, and this feature adds no file command.
- A span that fails stays source. There is no blank gap.
- The caret is always a source offset. Render apply does not move it.
- One selection, in source offsets, even when it crosses rendered and source parts.
- Undo is source history only.
- An error place is computed from the source that was compiled, or it is not shown.
- Compiler words stay in English, as Typst wrote them. App words around them stay in both message files. This feature adds no app string of its own. A string added later must exist in both `messages/pl.json` and `messages/en.json`.
- No note text is written to the log.

**Security model**:

One student, one opened folder, no accounts. This feature does not widen that. `render_note` still refuses a path outside the stored root. Widgets and diagnostic text are text nodes, not HTML parsed from the note. Preview SVGs stay image blob URLs, as they are now, so a script inside an SVG does not run. Note source is not logged.

**Configuration required**:

None. No new setting, variable, or secret. The 350ms pause stays the `scheduleRender` call already in `src/App.svelte`.

**Critical test scenarios**:

- Happy path: type a heading, a sentence with emphasis, a list, and a `#quote[...]`, see them rendered while the caret is elsewhere, click the heading, change a word, and read that Typst back from the buffer. Verifies **AC-1**, **AC-2**, **AC-3**.
- Failure case: an unclosed quote stays source, a compile error overlapping a heading keeps that heading as source with the compiler message, and a letter typed after the compile was sent does not leave the old byte place on the new text. Verifies **AC-4**, **AC-10**.
- Arrows and selection: arrow into a math placeholder shows the dollars, a selection from a rendered list item into a source line copies Typst source, and undo restores that source and does not undo the preview. Verifies **AC-5**, **AC-6**, **AC-7**.
- Steady caret: applying a matching render result leaves the selection and the editor scroll top unchanged, and the preview images do not take focus. A path outside the folder is refused and the buffer is unchanged. Verifies **AC-8**, **AC-11**.
- Structure keys: Enter on a heading, Enter on a list item with text, Enter on an empty item, Tab, and Backspace on a marker. Each does the one change named in **AC-9**, including while the surrounding spans are rendered.
- Long note: a fixture of at least 5000 words, one inserted letter, and the scanner window is the dirty window only. Verifies **AC-8**.

## Build plan

Skateboard: the first slice is a prose page a student could take into a lecture. Later slices add the math placeholder, the structure keys, and the long note proof. Each slice leaves the page usable.

1. Rendered prose page. Add `classifySpans` and `planDecorations` in `src/lib/spans.ts`, and apply them from `createEditor` in `src/lib/editor.ts`. Cover body, emphasis, strong, headings, bullets, numbered items, term items, and quotes. Click opens the source in place. Arrows walk source order. Copy, cut, and undo stay on the source. Hide line numbers on this page. Vitest covers the scanner and the plan, including Polish letters. Satisfies **AC-1**, **AC-2**, **AC-3**, **AC-6**, **AC-7**.
2. Errors and a steady caret. Overlap with an error keeps the span as source. Convert diagnostic bytes only when the revision is current and the sent source equals the buffer. Clear editor marks otherwise. Keep the last good preview pictures when a compile returns no pages. Diagnostic click and span click use nearest scroll, not center. Applying a result does not set the selection and does not call `scrollIntoView`. Satisfies **AC-4**, **AC-8**, **AC-10**.
3. Print preview stays a preview. Keep painting `RenderResult.pages` in the existing preview pane, in order, as image blob URLs. Updating them must not focus the preview or move the editor caret or scroll. Do not add a file command. A refused path leaves the buffer alone. Satisfies **AC-1**, **AC-11**.
4. Math placeholders. Classify math, show the inner source as a text widget while the caret is outside, open the source when a click or an arrow enters, and leave empty or unclosed math as source. No symbol list and no typeset formula. Satisfies **AC-5**, **AC-6**.
5. Structure keys. Add the keymap in `createEditor` for Enter, Backspace, and Tab as AC-9 states, and ignore those handlers while composing. Satisfies **AC-9**.
6. Long note proof. Add the fixture and the automated window check. Measure the editor thread time for one letter and write that number down against the 16ms budget. Satisfies **AC-8**.

## Consequences

**Positive**:

- A student can write headings, lists, quotes, and body text on one page and fix any part in place, without a second copy of the note.
- The caret, the selection, and undo stay the CodeMirror ones the scaffold already uses.
- A bad span stays readable, with the same compiler message the app already returns.
- The compile stays off the keystroke, so a long note does not wait on Rust in order to type.

**Negative / tradeoffs**:

- The writing page and the PDF will not share line breaks. The writing page lays out in the editor width. The PDF and the print preview share the Typst layout from spec 0001. A student who expects the typing page to be the printed page will see a difference.
- Numbered items on the writing page are counted from sibling markers. A note that changes Typst numbering will not show those numbers until the PDF or the print preview.
- The scanner is not a full Typst parser. Markup it does not recognize stays source. That is safe, and it means some real Typst will look unrendered until a later feature.
- Math on this page is the source text in a chip, not a typeset formula. Typeset math waits for the math editing feature.
- The structure keys and the hidden line numbers are lecture speed choices. They are written down so the build can proceed, and they are listed for you to ratify. If you reject one, update this spec before relying on that key.

**Neutral**:

- The split between the editor pane and the preview pane stays. The preview is for the page pictures. The caret lives in the editor only.
- No new Rust command, no new setting, and no new app string are required.

## Follow-up

- [ ] Ratify the structure keys. Until you change them, the build uses these lecture speed choices. Enter in a heading starts a body line. Enter in a list item with text continues that marker, and Enter on an empty item removes the marker. Enter in a quote with text stays inside the quote, and Enter on an empty quote line leaves the quote. Backspace at the start of a heading or list item removes the marker and does not eat the previous paragraph. Tab nests a list item by two spaces, Shift Tab removes that indent, and Tab never moves focus out of the editor.
- [ ] Ratify that typing `#` does not become a heading. Headings stay Typst `=` marks. A Markdown style shortcut is a later import question, not this feature.
- [ ] Ratify the page feel. The rendered page hides line numbers and the active line highlight, and it uses a proportional font. The print preview is unchanged.
- [ ] The math editing feature should replace the math placeholder with typeset math and symbol entry. Keep this span range and this click to source rule. Do not design symbol entry in this spec.
- [ ] The design system feature should restyle rendered spans. This spec sets no palette and no exact type sizes.
- [ ] The source view feature should turn these decorations off on this same editor buffer. It should not keep a second copy of the note.
- [ ] `typst` conventions not yet in root `AGENTS.md` `## Rules`; these apply to every file in the project and belong at root level
- [ ] `vitest` conventions not yet in root `AGENTS.md` `## Rules`; these apply to every file in the project and belong at root level
- [ ] `svelte-code-writer` conventions not yet in root `AGENTS.md` `## Rules`; these apply to every file in the project and belong at root level
- [ ] `svelte-core-bestpractices` conventions not yet in root `AGENTS.md` `## Rules`; these apply to every file in the project and belong at root level
- [ ] Consider installing a CodeMirror community skill for editor conventions, once one is clearly maintained. None is installed now, and the guides plus this spec are the contract.

## Rationale

Reasoning and options: see [rationale.md](rationale.md).
