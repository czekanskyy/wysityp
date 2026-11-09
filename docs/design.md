# WYSITyp design system: Papier

Papier is the visual language of WYSITyp. It is a calm, paper like workspace with one ink blue accent, a serif for the note itself, its own face for math, and dense, quiet chrome around the page. The decision behind it is [spec 0004](specs/0004-design-system/index.md).

- Tokens: `src/styles/tokens.css`
- Base layer and note typography: `src/styles/base.css`
- Components: `src/lib/ui/` (import from `src/lib/ui/index.ts`)
- Live preview: run `bun run dev` and open `http://127.0.0.1:1420/design.html` (dev only, not in the app build)

## Principles

1. **The page is the product.** Chrome is small, grey, and recedes. The note gets the light surface, the serif, and the generous measure. Nothing in the chrome competes with a formula.
2. **One accent.** Ink blue (`--color-accent`) marks the one thing that is active or primary: the open note, the pressed toggle, the primary button, the caret. Colour beyond that carries meaning (math, status, tags), never decoration.
3. **Keyboard first.** Every component has a visible focus state and a keyboard path. Groups (toolbar, tree, menu) use one tab stop and arrow keys. The command palette (`Ctrl+K`) reaches every action.
4. **Two languages, one layout.** Polish strings run 20–40% longer than English. Every label either wraps or ends in an ellipsis, and layouts are checked with Polish first.
5. **Offline and native.** No web fonts are fetched. Type comes from Windows and from the fonts Typst already bundles.

## Colour

All colours are tokens written once with `light-dark()`. The theme follows Windows by default. `data-theme="light"` or `data-theme="dark"` on `<html>` forces one (`theme.apply()` in `src/lib/ui/theme.ts`). Storing the choice belongs in the settings JSON beside `locale` and is a follow up.

| Group | Tokens | Use |
|---|---|---|
| Surfaces | `--color-bg`, `--color-surface`, `--color-surface-raised`, `--color-surface-sunken`, `--color-overlay` | Chrome and sidebar sit on `bg`. The note sits on `surface`. Menus, palette, inputs on `surface-raised`. Code blocks and wells on `surface-sunken`. |
| States | `--color-hover`, `--color-pressed` | Translucent layers, so they work on any surface. |
| Text | `--color-text`, `--color-text-muted`, `--color-text-faint` | `faint` is for placeholders and disabled text only, never for content. |
| Lines | `--color-border`, `--color-border-strong` | Hairlines between regions; `strong` on hover and for quotes. |
| Accent | `--color-accent`, `--color-accent-hover`, `--color-on-accent`, `--color-accent-text`, `--color-accent-soft`, `--color-accent-soft-text`, `--color-focus-ring`, `--color-selection` | Primary action, active row, focus, selection. |
| Status | `--color-danger*`, `--color-warning*`, `--color-success*` | Errors, Typst warnings, saved state. Always paired with text or an icon. |
| Note content | `--color-math`, `--color-math-soft`, `--color-code-text`, `--color-code-bg`, `--color-highlight`, `--color-markup` | Math is a quiet violet so a formula is easy to find. Visible Typst markers use `markup`. |
| Syntax | `--syntax-keyword`, `-function`, `-string`, `-number`, `-comment`, `-label` | For a Typst highlighter in the source view, later. |
| Tags | `--tag-{gray,blue,green,amber,red,violet,teal}-{fg,bg}` | Subjects and courses. |

Contrast, checked against WCAG 2.2: body text is 15.5:1 (light) and 12.9:1 (dark) on the page. Muted text is at least 5.1:1 on every surface. White on the accent is 7.1:1. Every tag pair and status pair is at least 4.5:1. Under `prefers-contrast: more`, borders and muted text get darker.

## Typography

| Token | Stack | Why |
|---|---|---|
| `--font-ui` | Segoe UI Variable, Segoe UI, system-ui | Native Windows chrome. Full Polish coverage. |
| `--font-prose` | Libertinus Serif, Iowan Old Style, Cambria, Georgia | Libertinus is what Typst prints with, so the page in the editor reads like the PDF. Cambria is the Windows fallback. |
| `--font-math` | New Computer Modern Math, Cambria Math, STIX Two Math | Typst's default math face first; Cambria Math ships with every Windows. |
| `--font-mono` | Cascadia Mono, Consolas, DejaVu Sans Mono | Typst source and code blocks. Ligatures off, so source stays literal. |

Libertinus Serif and New Computer Modern Math are bundled in the Rust side by Typst Kit but not yet exposed to the web view. Until they are, Windows shows Cambria and Cambria Math, which are close in colour and x-height. Shipping both as page fonts is a follow up (they are OFL licensed).

**Chrome scale** (dense, does not grow with the note): `--text-2xs` 11, `--text-xs` 12, `--text-sm` 13 (sidebar, menus, buttons), `--text-md` 14 (inputs, dialogs), `--text-lg` 16.

**Note scale** (ratio about 1.25): body `--note-text` 17px at `--leading-note` 1.65, `--note-h1` 30, `--note-h2` 24, `--note-h3` 20, `--note-h4` 17 bold, `--note-small` 15. The measure is `--note-measure` (44rem, about 75 characters).

**Math.** Inline math uses `--font-math` at `--math-scale` (1.08em, so its x-height meets the serif's), lining figures, and never breaks across lines. Block math is centred, slightly larger, and scrolls sideways instead of overflowing. When a math span is open as source it switches to the mono face in `--color-math` on `--color-math-soft`, so the student always sees where the formula starts and ends.

**Code.** Inline code is mono at `--code-scale` (0.88em) on `--color-code-bg`. Code blocks use 14px mono at 1.55 leading, a hairline border, `--radius-lg`, and scroll sideways.

**Polish text.** Prose uses `hyphens: auto` with `lang` set on `<html>` (the app sets it from `locale`). Quotes in Polish samples use „…”. Prose uses old style figures; math and tables use lining figures.

The classes for rendered note content live in `base.css`: `.note-prose` (container), `.note-math-inline`, `.note-math-block`, `.note-math-source`, `.note-code-inline`, `.note-code-block`, `.note-markup`, `.note-error`, `.note-warning`. Spec 0002 decorations should use these.

## Space, size, radius, elevation, motion

- **Space**: a 4px grid, `--space-1` (4) to `--space-16` (64), plus `--space-0-5`, `--space-1-5`, `--space-2-5` for tight chrome.
- **Controls**: `--control-sm` 28px (toolbar, sidebar rows, menu items), `--control-md` 32px (buttons, inputs), `--control-lg` 40px (palette input). Icons are 14, 16, or 20px.
- **Layout**: `--sidebar-width` 264px (13–26rem), `--titlebar-height` 44px, `--palette-width` 38rem.
- **Radius**: `xs` 3 (kbd, inline code), `sm` 5 (rows, tags), `md` 7 (buttons, inputs), `lg` 10 (cards, menus, code blocks), `xl` 14 (dialogs). Small radii keep the tool feel; nothing is pill shaped except `--radius-full` for dots.
- **Elevation**: `--shadow-xs` (buttons), `sm` (selected segment), `md` (menus, hovered cards), `lg` (palette, dialogs). Dark theme shadows are stronger, since borders do most of the work there. `--shadow-focus` is a two ring focus outline.
- **Motion**: `--duration-fast` 90ms for hover, `--duration-base` 160ms for popups, `--duration-slow` 240ms. All drop to 0 under `prefers-reduced-motion`. Nothing animates while typing.
- **Layers**: `--z-sticky`, `--z-dropdown`, `--z-overlay`, `--z-dialog`, `--z-toast`.

## Components

Components never contain app text. Every visible or accessible string is a prop, so callers pass Paraglide messages (`m.some_key()`) and both languages stay in `messages/*.json`.

| Component | Purpose | Keyboard and a11y |
|---|---|---|
| `Button` | `primary`, `secondary`, `ghost`, `danger`; `sm` or `md`; optional icon; `busy` shows a spinner and blocks clicks. | Native button. `aria-busy` while busy. One `primary` per view. |
| `IconButton` | Toolbar and row actions. `pressed` makes it a toggle. | `label` is required and becomes `aria-label` and the hover hint, with the shortcut appended. |
| `Kbd` | Shortcut caps, e.g. `["Ctrl", "K"]`. | Plain text. |
| `TextField` | Label, value (bindable), hint, error, leading icon, `hideLabel` for search boxes. | Label is always present for screen readers. Hint and error are tied with `aria-describedby`; an error sets `aria-invalid` and is announced. |
| `Toolbar`, `ToolbarSeparator` | Editor formatting bar with an `end` area for the view switch. | `role="toolbar"`. One tab stop; Left, Right, Home, End move between buttons. |
| `SegmentedControl` | Two to four exclusive choices (view mode, theme, language). | `role="radiogroup"`; arrows move and select. Icon only options keep their label as the accessible name. |
| `Sidebar`, `SidebarSection` | The note navigation column with fixed header and footer; foldable sections with hover actions. | `<nav>` landmark with a label. Section titles are buttons with `aria-expanded`. |
| `Tree`, `TreeItem` | Folders and notes. `active` marks the open note; `badge` shows an unsaved dot; `actions` holds row actions. | Flat ARIA tree with `aria-level`. Up and Down move, Right opens a folder, Left closes it, Enter or Space opens. |
| `Menu`, `MenuButton` | Row and overflow menus. Entries carry an icon, a shortcut hint, `danger`, or `disabled`, and separators. | `role="menu"`; focus moves to the first item; arrows move; Escape and Tab close and return focus to the trigger. Outside click closes. |
| `CommandPalette` | `Ctrl+K`. Grouped commands with icons and shortcuts. Matching ignores case and Polish accents ("zrodlo" finds "Źródło") and also searches `keywords`, so English words find Polish commands. | Native modal `<dialog>` (focus trap, Escape). The input is a combobox with `aria-activedescendant`; Up, Down, Enter. Focus returns to where it was, then the command runs. |
| `Card` | Templates, recent notes, search hits. Optional icon badge, meta line, body, and header actions. | When clickable, the whole card is one button; actions sit outside it. |
| `Tag` | Subject labels in seven colours. Optional `onclick` (filter, `aria-pressed`) and `onremove`. | The remove button needs `removeLabel`. |
| `Icon` | 42 line icons on a 24px grid in `icons.ts`, drawn for the app. No icon package. | Decorative by default (`aria-hidden`); pass `label` when it stands alone. |

### Patterns

- **Editor toolbar order**: undo, redo | heading, bold, italic, strike | lists, quote | inline math, block math, code, link, table, image | view switch at the end.
- **Sidebar**: workspace name and new note at the top, a search field that opens the palette, then Recent, then the folder tree, then settings and theme in the footer.
- **Unsaved and saved**: a dot badge on the tree row and the word in the footer, never colour alone.
- **Errors in the note**: a wavy underline in `--color-danger` (warnings in `--color-warning`) plus the message in the diagnostics list. A broken span stays visible as source, as spec 0002 asks.
- **Destructive actions**: red text in menus, then a confirmation with a `danger` button.

## Using it in the app

`src/main.ts` loads `tokens.css` and `base.css` before `app.css`. The short names in `app.css` (`--ink`, `--line`, `--accent`, ...) are now aliases of the tokens, so the current screens already follow the palette and dark mode. The CodeMirror theme in `src/lib/editor.ts` reads the same tokens. New screens should use the components and `--color-*` tokens directly; the existing markup in `App.svelte` moves to them screen by screen.

## Follow ups

- Store the theme choice (`system`, `light`, `dark`) in the settings JSON beside `locale`.
- Ship Libertinus Serif and New Computer Modern Math as page fonts so the editor matches the PDF exactly.
- Move `App.svelte` onto the components: sidebar and tree first, then the toolbar with the view switch, then the palette.
- A Typst highlighter for the source view using the `--syntax-*` tokens.
