# Rationale for 0004. Design system and UI foundation

## Context

The scaffold styles screens with a dozen ad hoc variables in `app.css`, no dark theme, and no shared components. The editor, math, templates, and search features are about to add many screens. Without a shared language each one would invent its own spacing, buttons, and focus rules. The owner had no visual direction in mind and asked for a sensible style inspired by popular note apps.

The forces: the app is a Windows desktop tool for long writing sessions, often in lecture halls and at night, so a dark theme is not optional. Students type fast and use shortcuts, so keyboard and focus are design, not polish. The content is STEM, so math and code need their own type. The app is offline and has a low learning load, so no new runtime dependencies.

## Options considered

### Option 1: Hand made tokens and Svelte components (chosen)

Plain CSS custom properties and about fifteen small Svelte 5 components, in the stack the project already uses.

**Pros**: no new dependency; full control over Polish text, math, and keyboard behaviour; tokens also theme CodeMirror; easy to read for one maintainer.
**Cons**: components must be built and tested by hand; no ready made accessibility primitives.

### Option 2: Tailwind CSS with a headless component library (Bits UI or Melt UI)

**Pros**: fast to build screens; well tested popover and dialog primitives.
**Cons**: two new build dependencies and a utility class idiom the project does not use; a second way of styling beside `app.css`; theming CodeMirror still needs CSS variables anyway.

### Option 3: Fluent UI web components (native Windows look)

**Pros**: matches Windows 11 exactly.
**Cons**: heavy; looks like a settings panel rather than a writing tool; harder to bring to Mac and Linux later; still needs note typography of its own.

## Style direction

Four directions were weighed against the student use case:

- **Notion like** (neutral grey, sans everywhere): familiar, but the page reads like a database, not a lecture note.
- **Obsidian like** (dark first, purple accent, dense): good for power users, heavy for first year students, and a purple accent would clash with math colour.
- **Bear and iA Writer like** (warm paper, serif, one accent): the calmest for long reading and the closest to the PDF Typst prints.
- **Craft like** (cards, soft shadows): pleasant for overviews, too decorative for the writing surface.

Papier takes the page from the third, the sidebar density from Obsidian, the command palette from Notion and Linear, and cards only where overviews need them (templates, recent notes). It also continues the scaffold's warm background and blue accent, so the current screens change little.

## Consequences

- New UI uses tokens and components; reviewers can ask for that.
- Dark mode works now for every screen that uses the tokens, including the editor.
- Without bundled fonts, Windows shows Cambria and Cambria Math in place of Libertinus and New Computer Modern. The difference is small, and fixing it is a follow up.
- `light-dark()` requires a recent Chromium or WebKit. WebView2 is evergreen, and Safari supports it since 17.5.
