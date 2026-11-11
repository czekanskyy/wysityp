# WYSITyp design handoff

This document hands the approved visual design over to the agents who build the real app. The design lives in a static prototype in this folder. The student (the product owner) approved it on 2026-11-11 after six rounds of fixes and the AI assistant round.

Read this whole file before you build. Then open the prototype and click through it. The prototype is the visual source of truth. This file explains what it shows, what is new, and what the real app must decide before it copies it.

## 1. Ground rules

- **Copy the look, not the code.** The prototype is plain HTML, CSS and classic scripts with a fake Typst renderer. The real app is Tauri 2, Svelte 5 and TypeScript (spec 0001). Port the CSS and the markup structure into Svelte components. Do not port the prototype's JavaScript architecture: no global `S` state, no `innerHTML` rendering, no `localStorage`.
- **AGENTS.md invariants win.** Where the prototype seems to break one, the invariant stands until a spec changes it. The ones the prototype touches are listed in section 14.
- **Every string goes through Paraglide.** The prototype's Polish text is the approved Polish copy. Put it in `messages/pl.json` word for word, and write the English twin in `messages/en.json`. Do not hard-code any string.
- **Every setting lives in the one settings JSON**, read and written by Rust. The prototype keeps settings in `localStorage`; that is a prototype shortcut only.
- **The prototype's "Prototyp" menu and its simulations are not features.** See section 15.
- **The scope and specs come first.** Many items here are new or were listed as Deferred in `docs/scope/scope.md`. Section 13 lists which features need `/architect` and `/scope` before `/develop`.

## 2. How to run the prototype

Serve `design/prototype/` as a static folder and open `index.html`. In this repo a launch entry named `prototype` serves it on `http://localhost:5199/`. Opening the file straight from disk also works.

The state persists in `localStorage`. To start clean, open the command palette (`Ctrl+Shift+P`) and run **Przywróć prototyp do stanu początkowego**, or use the beaker menu in the status bar.

Default window for screenshots: 1440 × 900. Also check 1000 px wide (the AI panel turns into an overlay) and 760 px wide (the sidebar turns into an overlay).

## 3. File map

| File | What it holds |
|---|---|
| `index.html` | The shell markup: sidebar, sidebar resize handle and edge button, `main` (top panel, middle with the view and the right rail, dock), AI resize handle, AI panel. Script order: `icons`, `data`, `typst`, `app`, `popups`, `settings`, `ai`, then `boot()`. |
| `css/tokens.css` | Design tokens. Identical to `design/claude-design/papier/tokens.css` and to the app's `src/styles/tokens.css` lineage (spec 0004). |
| `css/app.css` | Every component style, in commented sections (see the list in section 16). The float style is one block near the end (`html[data-ui="float"]`), then the UI style drawings, the responsive rules and the AI assistant. |
| `js/icons.js` | Inline SVG icon set (stroke icons, 24 px grid). Port missing icons into `src/lib/ui/icons.ts`. |
| `js/data.js` | Sample notes and folders, deco colours, templates, shapes, block kinds, colours, and **`ACTIONS`**: every command with its id, Polish label, group, icon and default shortcut. |
| `js/typst.js` | A fake Typst renderer and source highlighter (`TY`). Prototype only. The real app renders through the Typst engine in Rust. |
| `js/app.js` | Settings defaults, state, sidebar, tabs, home, welcome, editor and page, view bar, toolbar, text actions, saving, status bar, problems panel, selection toolbar, file operations, the action dispatcher `run()`, keyboard, boot. |
| `js/popups.js` | Layer stack, dialogs, popovers, menus, toasts, confirm, palette, shortcut sheet, deco picker, new note, simulated file dialogs, about, tags, toolbar menus, link, image, symbols, table, shapes, sidebar search and replace. |
| `js/settings.js` | The settings modal: navigation, every section, the live preview, shortcut recording, the `settings.json` viewer. |
| `js/ai.js` | The AI assistant panel: providers, models, quick actions, chat state, streaming of canned replies, code and diff cards, context chips, setup and offline states, resize. |

## 4. Design foundations

### Tokens and type

Use the tokens from spec 0004 (`--color-*`, `--radius-*`, `--shadow-*`, `--font-ui`, `--font-prose`, `--font-mono`). The prototype adds no new base colours; it builds everything below from them with `color-mix`.

### Page colours

The note page has its own palette, independent of the UI theme: `white`, `beige`, `graphite`, `oled`, set by `data-pg` on `html` and read through `--pg-*` variables (`app.css`, "Page colours"). A dark UI can show a white page. The new `page_follow` setting picks white for a light UI and graphite for a dark one. PDF export never reads the page colour.

### Accent colours (new)

Five accents: blue `#2f62d0` (default), teal `#0e7c86`, violet `#7a3fc0`, amber `#9a6400`, green `#1d7a46`. Set by `data-accent` on `html`, which overrides `--color-accent` and its derived tokens (`app.css`, "Accent colours"). The picker is a row of dots in Settings › Wygląd.

### UI size (new)

`ui_size` is `s`, `m` or `l`, applied as `--ui-zoom` 0.92 / 1 / 1.15 on the chrome only (sidebar, tabs, menus). The note text has its own size. Drag handles divide pointer deltas by the zoom.

### Fonts

Source fonts: JetBrains Mono (default), Cascadia Code, Fira Code, Consolas. Page fonts: Inter (default), Libertinus Serif, New Computer Modern, Source Serif 4. The prototype maps each name to a fallback stack (`SOURCE_FONTS`, `RENDER_FONTS` in `app.js`). Font names never go into a note.

### Motion

- Fixed style: short, calm transitions (about 0.18 s ease).
- Float style: springs. `--spring: cubic-bezier(.3, 1.22, .6, 1)` for panels that overshoot a little (the dock); `--spring-soft: cubic-bezier(.16, 1, .3, 1)` for everything else. Panels slide 0.36–0.42 s; dialogs and popovers grow in 0.18–0.28 s (`glass-in`, `glass-pop`).
- `prefers-reduced-motion: reduce` cuts every transition and animation to near zero (end of the float block and of the AI block).

### Scrollbars

Thin and quiet, a little wider and darker under the pointer (`app.css`, "Scrollbars").

### Icons

Stroke icons on a 24 px grid, sizes `sm` and default, from `icons.js`. The note and folder icons in the tree come from the deco picker (section 9).

## 5. Two UI styles: fixed and float (new)

The student picks the look in Settings › Wygląd › Styl interfejsu, with a small drawing of each option (`.uis`, `.ui-opt`, `.ui-pv`). The palette command `uiStyle` toggles it. Setting key: `ui_style` = `fixed` (default) or `float`, mirrored as `data-ui` on `html`.

### Fixed

The bars sit on the window edges with solid backgrounds and 1 px borders. The shell is a flex row:

```
[ sidebar | resize | edge button | main: top panel / (view + right rail) / dock | AI resize | AI panel ]
```

### Float

Windows 11 acrylic over a Mica backdrop. The note is a card. The shell becomes a grid with 8 px padding and 8 px gaps:

| Column | 1 | 2 | 3 | 4 |
|---|---|---|---|---|
| width | `auto` | `minmax(0, 1fr)` | `auto` | `auto` |

| Element | Grid area (row / col / row-end / col-end) |
|---|---|
| Sidebar `.sb` | `1 / 1 / -1 / 2` (full height) |
| Top panel `.top` | `1 / 2 / 2 / 4` |
| Note `#view` | `2 / 2` |
| Right rail `.rail` (view bar) | `2 / 3` |
| Dock `.dock` (problems and status) | `3 / 2 / 4 / 4` |
| AI panel `.ai` | `1 / 4 / -1 / 5` (full height) |

Glass tokens live on `html[data-ui="float"]`: `--glass-base`, `--glass-bg` (86 %), `--glass-bg-strong` (94 %), `--glass-tint`, `--glass-line`, `--glass-blur` (`blur(30px) saturate(125%)`), `--glass-noise` (an SVG fractal noise tile), `--glass-shadow`, `--card-shadow`, `--glass-r` (8 px), `--mica` (two accent-tinted radial gradients). Dark mode has its own set. The panels with `backdrop-filter` are listed in one selector: `.top`, the sidebar, `.vtb`, `.dock`, `.float-tb`, `.tab-peek`, `.wt-menu`, `.pop`, `.dlg`, `.toast`, `.diag-box`, `.ai`.

Popups in float style (menus, popovers, dialogs, the settings modal, toasts, the error box) are acrylic too, with spring entrances.

### Pins and autohide (new)

Each of the four panels around the note has a pin button. A pinned panel takes room in the grid. An unpinned panel goes `position: absolute`, hides at its window edge, and slides in when the pointer comes near; a thin edge hint shows where it waits. The pins are four settings:

| Setting | Panel | Default |
|---|---|---|
| `top_autohide` | Top panel (tabs, breadcrumb, toolbar) | `false` |
| `sb_autohide` | Sidebar | `false` |
| `status_autohide` | Dock (status bar and problems) | `false` |
| `vtb_autohide` | Page view bar | `true` |

They are mirrored as `data-top-auto`, `data-sb-auto`, `data-status-auto`, `data-vtb-auto` on `html`. Rules the student asked for explicitly:

- A pinned sidebar always runs the full window height.
- Floating (unpinned) top and bottom panels sit beside pinned side panels, never under them. The prototype passes the offsets as `--top-off` and `--dock-off`.
- Autohide works in both styles; the float style is where it looks native.

### Responsive

- At 760 px and below, the sidebar becomes an overlay with a shadow, the breadcrumb tags hide, and the page gets narrower padding.
- At 1000 px and below, the AI panel covers the note instead of taking room.

## 6. Shell regions

### Sidebar

`app.js`, "Sidebar" and "Sidebar shell"; `app.css`, "Shell" and "Tree".

- Head: the brand (a "W" mark plus "WYSITyp"), then icon buttons for the start page, a new note, and the pin. Under it, the search box (section 9, search and replace).
- Body: root sections, each a collapsible row with a count badge:
  - the opened folder, with row actions on hover: new note, new folder, collapse all, more (folder menu);
  - **Luźne pliki** (loose files), only when there are any;
  - **Szkice** (drafts), only when there are any.
- Without an opened folder the body shows a short explanation and an **Otwórz folder…** button.
- Tree rows indent 16 px per level. Folders show a chevron, their icon (open or closed) and a note count. Notes show their icon, title, a dot for unsaved changes, and a warning badge for a disk conflict.
- The body fades out at the top and bottom edges when it scrolls (round 6).
- Foot: a settings button (pressed while the settings modal is open) and a theme button that cycles system → light → dark.
- Width: default 264 px, minimum 240 px (the narrowest width still shows the whole name and the head buttons), maximum 440 px. Drag the resize handle; double-click returns to 264. An edge button with a chevron hides or shows the sidebar (`Ctrl+Alt+B`).

### Top panel

Tabs, breadcrumb and toolbar are one panel (round 5).

**Tabs** (`app.css`, "Tabs"): rounded, 30 px high, minimum 6.5 rem wide, always sharing the full width. A **+** button at the end makes a new note. Preview tabs (single click in the tree) show in italics and get replaced by the next preview; editing or a double-click pins them (`preview_tabs`). Hovering a tab shows a **tab peek**: the first page of the note like a taskbar thumbnail. A tabs menu lists every open tab. The start page is never a tab.

**Top bar** (`app.css`, "Top bar"): the breadcrumb (folder path and the note), the note's tags as coloured chips with an add button, a **PDF** export button, and the AI assistant button (section 11).

**Toolbar** (`app.css`, "Toolbar"): a three-column grid `112px 1fr 112px`. Left: undo and redo. Middle: the formatting sections, centred. Right: the view switch as three icon buttons (source, split, page). When space runs out, whole sections move into the ⋯ menu, least important first. `toolbar` = `compact` (default) keeps rarer tools in ⋯ from the start; `full` shows them all. Toolbar menus: paragraph style, alignment, blocks (definition, theorem, lemma, proof, example, note, exercise, page break), text colour, reference, more.

**Banners** sit under the top panel for a disk conflict or a loose-file notice.

### Editor and page

`app.js`, "Editor" and "Floating view toolbar"; `app.css`, "Editor", "Page", "Fit page", "View bar", "Page counter fraction", "Rendered Typst".

- Three views: source, split, page. `view` sets the one a note opens in.
- Split: a draggable divider between source and page; double-click returns to half and half. The ratio is kept per session.
- Source: a gutter with line numbers (`line_numbers`), syntax highlighting, wrap (`wrap`), auto-pairing of `$ ( [ "` (`autopair`), list continuation on Enter (`list_continue`).
- Page: the flow breaks into **A4 sheets** with gaps between them. Whole blocks move to the next sheet. The rest of the last sheet is one "write on" target. Clicking a block opens its source in place.
- **Fit page** shows each sheet whole, like slides, with a thin margin and no scrollbar. **Fit width** fills the pane width. Manual zoom keeps a 25 % floor; fit page skips it.
- **View bar** (`.vtb`): a vertical bar in the right rail, 44 px wide. From the top: the current page as a slanted fraction (`3⁄7`), fit width, fit page, zoom in, zoom value (menu), zoom out, outside colour (`theme` or page-matched), rounded page corners on or off, and the pin. Unpinned (`vtb_autohide`, default on), it hides at the right edge of the preview and slides in.
- **Selection toolbar** (`.float-tb`): selecting text on the page shows a floating bar with formatting buttons, **Edytuj źródło**, and **Zapytaj** (asks the assistant, section 11).
- In float style the note is a card with `--card-shadow` on the Mica backdrop.

### Dock: problems panel and status bar

`app.js`, "Status bar" and "Problems panel"; `app.css`, "Status bar" and "Problems panel".

- **Status bar**: left, the save state with a coloured dot (saved, unsaved, saving, disk conflict, save failed; clicking saves) and the note path (clicking copies it). Right, the cursor line and column (clicking opens go to line), the word count with Polish plural forms, the Typst version, the error and warning counts that open the problems panel, and the pin. With no note open it shows an overall save summary, the folder path and the language. `status_bar` hides it.
- **Problems panel**, like VS Code: it unrolls upwards from the status bar (`Ctrl+J`). Its content is pinned to the bottom. Height default 200 px, resizable by dragging its top edge. Rows group by file; clicking one jumps to the line. In float style the dock is one glass panel and the problems content rises with a spring.
- **Error box** (`.diag-box`): the first compile error floats over the page with **Przejdź** (go to the line) and, when the assistant is on, **Napraw** (ask the assistant to fix it).

### Saving

Coloured save states in the sidebar rows, the tabs and the status bar. `autosave` with `autosave_delay` (seconds). Failures and disk conflicts show a banner and a toast with an action.

## 7. Start page and welcome

- **Start page** (`app.css`, "Home" and "Start page"): a full-screen view with no tabs and no status bar. A greeting header, buttons for a new note and opening a folder or file, recent notes as cards (with a card menu), recent folders, templates, and tags to filter by. A **back to tabs** button with a count returns to the editor.
- **Welcome** (no folder open): the same calm full-screen layout with open-folder and drafts actions.

## 8. Overlays and the layer stack

`popups.js`, "Layer stack". Every overlay pushes onto one stack; Esc and a click outside close the top one.

- **Dialogs** (`openDialog`): centred, or hanging from the top like the palette. They share one head (`dlgHead`: icon, title, subtitle, close) and one foot (`dlgFoot`: a hint on the left, buttons on the right).
- **Popovers** (`openPop`): hang from a toolbar button with an arrow.
- **Menus** (`openMenu`): items with icons, shortcuts, checks, separators and submenus.
- **Toasts**: bottom right, above the status bar. Types ok, warn, err, info, each with a coloured round icon. A 3 px bar at the bottom drains over 4.2 s and pauses under the pointer. Optional action button. They slide in from the right.
- **Confirm** (`confirmDlg`): title, text, OK, an optional alternative, Cancel; a danger variant.
- **Command palette** (`Ctrl+Shift+P`, `Ctrl+P`): universal by default. A leading character switches mode and disappears: `>` commands, `?` full text in all notes, `@` headings in the note, `#` notes with a tag, `:` go to line (`12` or `12:4`). An empty field lists the modes. Backspace on an empty field returns to universal mode. Fuzzy matching that folds Polish diacritics. Full-text hits show a snippet with the hit marked.
- **Shortcut sheet** (`Ctrl+/`).
- **Settings modal** (section 10).

In float style all of them are acrylic.

## 9. Dialogs and panels by feature

| Feature | Where | Notes |
|---|---|---|
| Note and folder icon and colour | `decoPop` | Pick an icon and one of nine colours (default, red, orange, amber, green, teal, blue, violet, pink) per note or folder. Shown in the tree, tabs and cards. |
| New note | `newNoteDlg` | Title, template cards (`TEMPLATES` in `data.js`), where to save. |
| Open note / folder | `openFileDlg`, `openFolderDlg` | Simulated native dialogs. The real app uses the native Tauri dialogs. |
| Tags | `tagDlg` | Centred. The note's tags on top; one box below filters the list or creates a new tag with a colour. A tag bar shows in the top bar. |
| Link | `linkDlg` | Text and address. |
| Image | `imageDlg` | Pick a file from disk; preview; width. |
| Symbols | `symbolsDlg` | Search, categories, recent symbols, Typst names. |
| Table | `tableDlg` | A grid picker for rows and columns, header row option. |
| Shapes | `shapesDlg` | Line, arrow, arc, rectangle, square, triangle, regular polygon, circle, ellipse, angle, axes, function plot. Each has a drawing and the Typst or CeTZ code it inserts. |
| About | `aboutDlg` | Version, licence, credits. |
| Search and replace | sidebar search box | `Ctrl+F` focuses the box, `Ctrl+H` also opens the replace line, `Ctrl+Shift+F` searches all notes. Options: match case, whole word, regex, ignore accents, current note only, include loose files. While the box holds a phrase, the sidebar body shows results grouped by note instead of the tree. Replace one or all per note. |

## 10. Settings modal (new layout)

`settings.js`; `app.css`, "Settings". Settings open as a large modal over the whole window: the window dims and blurs behind it (`.st-scrim`). Esc, a click outside, the close button or `Ctrl+,` closes it. The note behind redraws on close if a setting changed.

Layout: a grid of three columns, `232px` navigation, the section in the middle, `456px` live preview on the right (a miniature window with a sidebar, tabs, toolbar and a page, plus a source sample with highlighting). Maximum width 1560 px. Rows use shared builders: a row with a label, control and hint (`stRow`), a card of rows (`stCard`), a segmented control (`stSeg`), a switch (`stSw`), a stepper (`stStep`), a select (`stSel`).

| Section | Contents |
|---|---|
| Ogólne | Interface language (`locale`). Tabs: restore tabs on start, preview tabs, confirm before deleting a note. |
| Wygląd | Theme (`theme`), accent colour (`accent`), UI size (`ui_size`). Page colour (`page_color`) with swatches, and "match the theme" (`page_follow`). UI style (`ui_style`) with drawings, and the four autohide switches. Layout: toolbar compact or full (`toolbar`), status bar (`status_bar`). |
| Skróty klawiszowe | Every action by group. Click a shortcut and press a new combination; Esc cancels, Backspace removes. A filter box on top. Stored in `keys` as overrides. |
| Edytor źródła | Source font, size 11–20 px, ligatures. Writing: the view a note opens in, line numbers, wrap, auto-pairing, list continuation, spell checking. Saving: autosave and its delay. |
| Strona | Page font, size 13–24 px, line height 1.30–2.00, paragraph alignment (left or justified). A note's own `#set text(font: …)` wins. |
| Eksport PDF | Paper (A4, Letter), margins 1–4 cm, page numbers, open the PDF after export. Used only when the note sets nothing itself. |
| Pakiety Typst | Download packages from the network (`packages_online`), and the list of downloaded packages. |
| Pliki i foldery | Drafts folder, the settings file path with a viewer, encoding and line endings (UTF-8, keep the file's CRLF or LF). |
| Asystent AI | Section 11. |
| Prywatność | No telemetry; network use (packages, and the assistant when on); your notes stay plain files. Links to the package and assistant sections. |
| O programie | Version, MIT licence, updates (the app never checks by itself), shortcut sheet. |

The "Prototyp" group in Ogólne is prototype only.

## 11. AI assistant panel (new)

`ai.js`; `app.css`, "AI assistant"; the AI hooks in `app.js` and `settings.js`. Commit `9dd6a1f`.

### Place and form

A chat panel on the **right edge, full window height**, like the sidebar on the left. In fixed style it takes room beside the note. In float style it is a full-height glass panel in grid column 4. In windows 1000 px wide or less it covers the note. Width default 380 px, 320–640 px by dragging its left edge; double-click returns to 380.

### Ways in

- The sparkle button in the top bar (pressed while open).
- `Ctrl+L` (`aiPanel`). With a selection in the source it attaches the selection instead of closing.
- **Zapytaj** in the selection toolbar on the page.
- **Napraw** in the error box.
- The command palette.

### Panel parts

- **Head**: a gradient sparkle badge, the title, a model chip that opens a model menu, a new chat button, a more menu (chat list, settings), close.
- **Empty state**: a short greeting and six quick actions in two columns: explain, fix errors (spans both columns and shows in red when the note has errors), quiz me, summarise, write a formula, check style.
- **Messages**: the student's message is a bubble in the soft accent colour (radius 14 14 4 14), right-aligned. The assistant's message is plain text on a 22 px grid with a small mark, Markdown-like formatting, and inline math typeset like the page. Under each reply: copy, retry.
- **Code card** (`.ai-code`): Typst code with **Kopiuj** and **Wstaw** (insert at the cursor; a toast says Ctrl+Z undoes it).
- **Diff card** (`.ai-diff`): removed and added lines with **Odrzuć** and **Zastosuj**; after a click it shows its done or rejected state.
- **Streaming**: three dots while waiting, then text appears in small bursts with a caret; a stop button replaces send.
- **Composer**: context chips above the input that say what goes with the message (the open note, the selection, compile errors), each removable, plus an add button. The textarea grows to 160 px. Enter sends, Shift+Enter breaks a line, Esc in an empty composer closes the panel. Under it: the model and a short privacy line.
- **Setup state** (assistant off or no key): provider radio cards (Anthropic, OpenAI-compatible, local) and a button to add a key.
- **Offline state**: a warning banner; the composer is disabled.

### Rules the design commits to

- Off by default (`ai_enabled: false`).
- Nothing changes in the note without a click. Every change is a proposal shown as a diff or code card. Ctrl+Z in the source undoes it like any edit.
- The note and the selection go with a message only when their switches are on (`ai_note_ctx`, `ai_sel_ctx`), and each chip can be removed per message.
- The API key lives in the **Windows Credential Manager**, never in the settings file or a note. The settings file holds only whether a key exists, if anything.
- Chats live in memory only, until the app closes. Nothing is written to disk.
- Providers: Anthropic (models `claude-sonnet-5-5` default, `claude-opus-5-5`, `claude-haiku-5-5`), any OpenAI-compatible server by address, and a local server (Ollama at `http://localhost:11434` by default, notes never leave the computer).
- The panel follows the open note: switching notes updates the note chip.

## 12. Settings keys

Existing keys (`src-tauri/src/settings.rs` today): `locale`, `theme`, `page_color`, `source_font`, `render_font`, plus the recent lists and `display_name`.

New keys the design adds, with their prototype defaults (`DEFAULTS` in `app.js`). Each needs a spec decision before it lands in Rust, with the same rule as today: a missing or illegal value stays on disk and reads as the default.

| Key | Values | Default |
|---|---|---|
| `page_follow` | bool | `false` |
| `accent` | `blue`, `teal`, `violet`, `amber`, `green` | `blue` |
| `ui_size` | `s`, `m`, `l` | `m` |
| `ui_style` | `fixed`, `float` | `fixed` |
| `top_autohide`, `sb_autohide`, `status_autohide` | bool | `false` |
| `vtb_autohide` | bool | `true` |
| `source_size` | 11–20 | 13 |
| `ligatures` | bool | `false` |
| `render_size` | 13–24 | 17 |
| `line_height` | 1.3–2.0, step 0.05 | 1.65 |
| `align` | `left`, `justify` | `left` |
| `view` | `source`, `split`, `page` | `split` |
| `line_numbers`, `wrap`, `autopair`, `list_continue` | bool | `true` |
| `spellcheck` | bool | `false` |
| `toolbar` | `compact`, `full` | `compact` |
| `status_bar` | bool | `true` |
| `autosave` | bool | `true` |
| `autosave_delay` | seconds | 1 |
| `restore_tabs`, `preview_tabs`, `confirm_delete` | bool | `true` |
| `pdf_paper` | `A4`, `Letter` | `A4` |
| `pdf_margin` | 1–4 cm, step 0.5 | 2.5 |
| `pdf_numbers` | bool | `true` |
| `pdf_open` | bool | `false` |
| `packages_online` | bool | `true` |
| `drafts_dir` | path | `~/Dokumenty/WYSITyp/Szkice` |
| `ai_enabled` | bool | `false` |
| `ai_provider` | `anthropic`, `openai`, `local` | `anthropic` |
| `ai_model` | model id | `claude-sonnet-5-5` |
| `ai_url` | URL | `http://localhost:11434` |
| `ai_note_ctx`, `ai_sel_ctx` | bool | `true` |
| `keys` | map of action id to shortcut | `{}` |

Session state that is not a setting (the prototype keeps it in `localStorage`; the real app decides where, spec 0006 territory): open tabs and the active tab, closed tabs for reopening, collapsed folders, note and folder deco, tag definitions, split ratio, sidebar width and visibility, problems panel height and open state, page view fit and zoom per view, outside colour, rounded corners, AI panel width and open state, recent symbols, search options.

## 13. Feature list: what is new against the scope

The design branch history is the round-by-round record (`git log main..docs/design-prototype`).

| Item | Scope today | Action |
|---|---|---|
| Restyled shell: rounded tabs, top panel, sidebar with brand and search, coloured save states, toasts with a draining bar, tab peek | 18, 20, 23 (specs 0005, 0007, 0009) | Restyle. `/develop` against the existing specs; note the visual changes in those specs if they contradict them. |
| Start page as a full-screen view | 18 (spec 0005) | Restyle, check against 0005. |
| Universal palette with `> ? @ # :` modes, shortcut sheet | 21 (spec 0009) | Extend; the modes may need a spec addition. |
| Toolbar with centred sections and overflow into ⋯; compact and full | 20 (spec 0009); full controls are Deferred | Needs `/scope` to move "Full toolbar controls" out of Deferred, and `/architect` for the overflow rule. |
| Split view divider, A4 sheets, fit page and fit width, view bar with page fraction, zoom, outside colour, rounded corners | 6 (spec 0002) | New. `/architect` page view, then `/develop`. |
| Problems panel like VS Code, error box | 6, 9 | New. `/architect`. |
| **Two UI styles (fixed and float), acrylic, Mica, pins and autohide** | none | New feature. `/scope` enroll, `/architect`, `/develop`. |
| **Settings as a large modal with sections and live preview** | 19 owns theme and page colour; "Longer settings screens" is Deferred | New feature. `/scope` enroll (pull from Deferred), `/architect`. Replaces `AppearanceDialog.svelte`. |
| Accent colour, UI size, page follows theme | none | Part of the settings feature. |
| Shortcut editing | Deferred | Part of the settings feature, or its own. |
| Note and folder icon and colour | none | New. `/architect` where deco is stored (never in the note). |
| Tags dialog and tag bar, tags on the start page | Deferred ("Subject tags") | `/scope` enroll, `/architect` storage. |
| Search and replace in the sidebar | 22 needs a decision; replace is Deferred | `/architect search screen` with this design as input. |
| Symbols, table picker, shapes | 7, 8, 14; Deferred until those land | Build with those features. |
| Link and image dialogs | 8 | Build with feature 8. |
| New note dialog with templates | 10 (spec 0003) | Restyle. |
| **AI assistant panel** | Deferred ("AI drafting, explaining and rewriting"); breaks the offline-first invariant | New feature. Needs the student's decision, `/scope` enroll, `/architect` (network, key storage, providers, streaming), and an AGENTS.md invariant update. Build last. |

## 14. Invariants the design touches

- **Offline first.** AGENTS.md says the only network use is fetching a Typst package. The assistant adds a second, opt-in use. A spec must record it, and AGENTS.md must change in the same pull request. Requests go from Rust, not the page, so the key never reaches the webview.
- **Settings only in the settings JSON.** All new keys go there. The API key is the one exception and goes to the Windows Credential Manager.
- **The page never touches disk.** Image picking, the drafts folder, the settings file viewer and the package list go through Rust commands.
- **Typst source is the truth.** The assistant's insert and apply edit the source like the student would; the page never edits the rendering.
- **Theme and page colour.** `system` still leaves `data-theme` off `html`. The prototype sets it to the resolved value only because its tokens file has no media query; the app keeps its current behaviour.
- **PDF never reads `page_color`.**

## 15. Prototype only: do not build

- The **Prototyp** group in the palette, the beaker menu, and Settings › Ogólne › Prototyp: reset, simulate a disk change, simulate a save failure, assistant without network.
- `localStorage` persistence.
- The fake renderer and highlighter in `typst.js`.
- The simulated native file dialogs.
- The canned assistant replies and the fake streaming timer.
- The sample notes and folders in `data.js`.

## 16. Where to find each style

`app.css` sections, top to bottom: page colours, accent colours, base, shell, tree, deco picker, tabs, top bar, toolbar, banners, editor, page, fit page, view bar, page counter fraction, rendered Typst, status bar, problems panel, home, welcome, search panel, overlays, palette, shortcuts, popovers, symbols, table picker, shapes, menus, toasts, new and open dialogs, settings modal, start page, tab peek, palette modes, tags dialog, scrollbars, float UI style, acrylic popups, UI style drawings, responsive, AI assistant.

## 17. Actions and default shortcuts

From `ACTIONS` in `data.js`. Reconcile with the actions the app already has (`src/lib/actions.ts`, spec 0009).

| Group | Action | Shortcut |
|---|---|---|
| Aplikacja | Command palette | `Ctrl+Shift+P` |
| | Go to note | `Ctrl+P` |
| | Search in notes | `Ctrl+Shift+F` |
| | Settings | `Ctrl+,` |
| | AI assistant | `Ctrl+L` |
| | Shortcut sheet | `Ctrl+/` |
| | Show or hide the sidebar | `Ctrl+Alt+B` |
| | Toggle light and dark theme, start page | none |
| Plik | New note | `Ctrl+N` |
| | Open note | `Ctrl+O` |
| | Open folder | `Ctrl+Shift+O` |
| | Save | `Ctrl+S` |
| | Export to PDF | `Ctrl+Shift+E` |
| Karty | Close tab | `Ctrl+W` |
| | Reopen closed tab | `Ctrl+Shift+W` |
| | Next and previous tab | `Ctrl+Tab`, `Ctrl+Shift+Tab` |
| Widok | Source, split, page | `Ctrl+Alt+S`, `Ctrl+Alt+D`, `Ctrl+Alt+R` |
| | Problems panel | `Ctrl+J` |
| | Toggle UI style | none |
| Formatowanie znaków | Bold, italic, underline | `Ctrl+B`, `Ctrl+I`, `Ctrl+U` |
| | Strikethrough | `Ctrl+Shift+X` |
| | Superscript, subscript | `Ctrl+.`, `Ctrl+,` |
| | Inline code | `Ctrl+E` |
| | Highlight | `Ctrl+Shift+H` |
| | Text colour | `Ctrl+Shift+C` |
| | Clear formatting | `Ctrl+\` |
| Edycja | Undo, redo | `Ctrl+Z`, `Ctrl+Y` |
| Akapity i nagłówki | Paragraph, heading 1–3 | `Ctrl+Alt+0` to `Ctrl+Alt+3` |
| | Bulleted, numbered list | `Ctrl+Shift+8`, `Ctrl+Shift+7` |
| | Quote | `Ctrl+Shift+Q` |
| | Term list, indent, outdent | none |
| Wstawianie | Inline math, block math | `Ctrl+M`, `Ctrl+Shift+M` |
| | Link | `Ctrl+K` |
| | Footnote | `Ctrl+Alt+F` |
| | Symbol | `Ctrl+Shift+S` |
| | Table | `Ctrl+Shift+T` |
| | Code block | `Ctrl+Shift+K` |
| | Shape | `Ctrl+Shift+G` |
| | Image, reference, date, page break, outline | none |
| Sidebar search | Find, replace | `Ctrl+F`, `Ctrl+H` |

**Known clash:** `Ctrl+,` is both Settings and Subscript in the prototype. Settings keeps `Ctrl+,` (the Windows convention); subscript needs another default. Decide it in the spec.

## 18. Suggested build order

1. Settings keys and the settings modal shell, because almost every later slice reads a new key.
2. Fixed style restyle of the shell: sidebar, top panel, tabs, toolbar, status bar, toasts, overlays.
3. Page view: A4 sheets, split divider, fit modes, view bar, problems panel, error box.
4. Float style, pins and autohide.
5. Palette modes, deco picker, tags, search and replace.
6. Insert dialogs, with their scope features (7, 8, 14).
7. AI assistant, after its spec and the invariant change.

Each slice ends with `/check verify` against its spec, comparing the running app with the prototype side by side at 1440 × 900 in light and dark, fixed and float.
