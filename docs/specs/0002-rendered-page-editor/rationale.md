# 0002. Rendered page editor, rationale

## Context

> ⚠️ Premise note: It is tempting to type on the Typst page picture, because that picture already matches the PDF. The picture has no caret, and the compile does not return a box for each source span, so a click would have nowhere honest to land. The writing surface stays the source editor. The page pictures stay a print preview.

A Polish STEM student types fast during a lecture and mostly uses the keyboard. The page has to show structure as they go, and it must not take the caret or the scroll place when a compile finishes. Losing the place mid sentence is a failed lecture note, even if the file is correct.

Spec 0001 already fixed the floor. CodeMirror 6 holds the Typst source. That source is the only document. Rust compiles the whole note after a short pause and returns SVG pages plus diagnostics whose places are UTF 8 bytes in the source that was compiled. The scaffold proves that path with a source pane and a preview pane. It does not yet put rendered parts in the place of source spans. Spec 0001 leaves cursor movement, selection, and which spans render to this spec.

The scope asks for a page where body text, headings, lists, and quotes render in place, shortcuts turn marks into structure, and a click edits the Typst right there. Math in this feature only has to be a placeholder you can click through. Full math editing, including symbol entry, is a later feature. Tables, code, images, links, a whole note source view, and spell checking are later features too. The design system has no spec yet, so colours and exact type sizes are not available here.

If this stays undecided, the build will invent a second document, or it will put the caret on the SVG, or it will guess how arrows cross a rendered span. Any of those will drift from the source or jump the page during typing.

The note can be long, on the order of 5000 words with math. The whole note compile is allowed to stay the paused compile from spec 0001. Typing itself cannot wait for that compile. The span work on a keystroke has to stay small, and the spec has to say what to measure so a smooth scaffold is not mistaken for a smooth lecture note.

## Options considered

### Option 1: In place source decorations

Keep the CodeMirror document as the only document. A page side scanner finds the release spans in the dirty window. Decorations hide markers and style the words. A math span, and only a math span, uses a text widget while the caret is outside it. The SVG pages stay in the preview pane.

**Pros**:

- The caret, the selection, and undo are the ones CodeMirror already has, on the real source.
- Span work does not call Rust, so the typing clock stays separate from the compile.
- A failed span is just source. There is no empty widget to size.

**Cons**:

- The writing page will not share line breaks or list numbers with the PDF. The preview and the PDF still share the Typst layout.
- The scanner will miss Typst it was not taught, and those parts stay source.

### Option 2: Type on the Typst page picture

Keep compiling to SVG as today, and make that picture the surface you click. A click would map a point on the picture back to a source span, and a small source editor would open there.

**Pros**:

- What you see while reading would match the PDF, because it is the PDF's layout.
- The compile path would stay the one seam.

**Cons**:

- `RenderResult` has page SVGs and byte diagnostics. It has no box for each span, so the click has no source to compute from.
- Arrow keys, selection, and undo would be a second caret on top of CodeMirror, which is the trap this feature is here to avoid.

### Option 3: Leave the split source and preview

Keep today's source pane and preview pane. Improve the link between them so a click in the preview moves the source caret, and do not render spans inside the editor.

**Pros**:

- The smallest change. The scaffold already does most of this.
- The preview matches the PDF, and the source pane is honest.

**Cons**:

- You are still typing in a source listing, not on the rendered page. That misses the feature the scope calls the heart of the app.
- The caret still lives far from the picture you are reading, which is the place a lecture note should not make you hunt for.

## Rationale

Option 1 is the one that fits the floor spec 0001 already poured. Source stays the document, so a rendered span cannot drift, and undo cannot grow a second history. The student types fast, so the work on a key has to be a bounded scan on the page, not a compile and not a new Rust command. The engine returns whole page pictures, not span boxes, which is exactly why option 2 has no honest click target today. Option 3 is calmer to build and fails the job: the scope asks you to type on the rendered page and edit a part in place.

The runner up for the span source was to return syntax spans from `Engine::render` beside the SVG. That would track Typst more closely, and it loses because the result arrives on the 350ms render clock, so the page would lag every letter, or a per letter call would sit on the typing clock. The page scanner fails closed instead: what it cannot close stays source, and the compiler error still marks the place.

The runner up for math was to crop the page SVG into the placeholder. That loses because no span box comes back with the SVG, and typeset math belongs to the later math feature. The placeholder text is the source between the dollars, which is enough to see the place and to click through.

The runner up for selection was to copy the visible words without markers. That is nicer when pasting into a chat, and worse when pasting back into a note. Lecture notes get pasted back into notes, and the source is the truth, so copy stays source.

Structure keys are the part only you can really want a certain way. The recommendation is the lecture speed set written in the spec: Enter after a heading starts a body line, a list continues until an empty item, a quote continues until an empty line, and Tab nests instead of leaving the editor. They are specified so a build does not invent them, and they are flagged for you to ratify.
