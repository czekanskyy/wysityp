# 0004. Design system and UI foundation

**Date**: 2026-11-09
**Status**: In Progress

## Summary

Papier, the visual language in `design/claude-design`, becomes the colour, spacing, focus, and shared components of the app. Fonts stay as they are, and the editor file stays as it is until feature 20. The chrome follows Windows unless you choose light or dark, and the page colour is a separate choice (white, beige, graphite, or OLED black). Both choices live in the settings file. Later screens still mount the shared components this feature builds.

## Requirements

**User stories**:

- As a student, I want the window to follow Windows light or dark, so that the app matches the rest of the desktop.
- As a student, I want a focus ring I can see, and keyboard use on shared controls, so that I can keep my hands on the keys.
- As a student, I want the app to stay still when Windows asks for less motion, so that movement never gets in the way.
- As the person building later screens, I want one set of tokens and shared components, so that each screen does not invent its own button.
- As a student, I want to choose light, dark, or follow Windows, so the chrome matches the desktop or stays put when I want it to.
- As a student, I want the note page to be white, beige, graphite, or OLED black, without that choice changing the chrome.
- As a student, I want both choices to still be there after I close the app, and I want a PDF to stay a white page.

**Acceptance criteria**:

- **AC-1**: `src/styles/tokens.css` defines the colour, syntax, tag, page colour, space, size, radius, and shadow custom properties from `design/claude-design/papier/tokens.css`, with the same values. Light values sit on `:root`. Dark values sit under `[data-theme="dark"]`. The file does not define `--font-ui`, `--font-prose`, `--font-math`, or `--font-mono`. Type classes keep the export's size, line height, and weight, and they do not set `font-family`. `src/app.css` still sets the chrome font to `"Segoe UI", system-ui, sans-serif`. `src/lib/editor.ts` stays as it is, including `Consolas, 'Cascadia Mono', monospace`, `outline: none` on `.cm-focused`, and the light editor colours that file already has. This feature does not pass `dark: true` to the editor theme.
- **AC-2**: With no `data-theme` on `html`, `prefers-color-scheme: dark` uses the dark palette and the light scheme uses the light palette. `html` then sets `color-scheme: light dark`. `data-theme="light"` forces the light palette and `color-scheme: light`. `data-theme="dark"` forces the dark palette and `color-scheme: dark`. The token files do not set `data-theme`, and they write nothing to the settings file and nothing to `localStorage`. AC-8 is what sets `data-theme`.
- **AC-3**: Page tokens exist for `white`, `beige`, `graphite`, and `oled`. Note content uses only `--page-bg`, `--page-text`, `--page-muted`, `--page-math`, and `--page-code-bg`. The default aliases are the white set, matching the export (`[data-page="white"], :root`). The shared components do not change `data-page` on their own. AC-9 is what sets it. PDF export stays as AC-11 says.
- **AC-4**: Every focusable shared control, and every raw `button`, `select`, and `input` in `src/app.css`, shows two rings on `:focus-visible`. The outer rings are `box-shadow: 0 0 0 2px var(--color-surface), 0 0 0 4px var(--color-focus-ring)`, with `outline: none` so the browser ring does not stack. Tree rows and menu items use an inner ring instead: `box-shadow: inset 0 0 0 2px var(--color-focus-ring)`. Under `forced-colors: active`, those controls do not set `outline: none`. They use `outline: 2px solid CanvasText`. The editor rule in AC-1 stays. `--motion-fast` is 90ms, `--motion-pop` is 160ms, and `--motion-slow` is 240ms. Under `prefers-reduced-motion: reduce` those three are 0ms, the card does not move, and no control fades. The contrast block is written after the theme blocks, as `@media (prefers-contrast: more)` on `:root`, `[data-theme="light"]`, and `[data-theme="dark"]`, and it sets `--color-border` to `var(--color-border-strong)` and `--color-text-muted` to `var(--color-text)`. No transition is added to `.chevron` in `src/app.css`. Nothing animates while the student types. No spinner keyframes are added.
- **AC-5**: Hand built Svelte 5 components exist for Button, IconButton, Kbd, TextField, SegmentedControl, Menu, Tag, Card, Cover, NotePage, Sidebar, Toolbar, and CommandPalette, exported from `src/lib/ui/index.ts`. Visible words and accessible names come in through required props. The components contain no Polish or English sentences. Icons live in `src/lib/ui/icons.ts` and are exactly the 35 ids in the icon table. One `<svg>` in the previews is one icon. The stroke rule from `.wt-ico` is copied into `src/styles/base.css` on `.icon` (1.75, round caps, 24 grid, `currentColor`, size from `--icon-sm`, `--icon-md`, or `--icon-lg`). No icon package is added. Spec 0005 already mounts Sidebar. This work does not unmount it. This work does not mount Toolbar or CommandPalette. CommandPalette does not register a global shortcut.
- **AC-6**: The open window's colours come from the new tokens, through the aliases in the feature design. Existing layout, padding, and corner radii in `src/app.css` stay. These labels use one line and end in an ellipsis when they do not fit: button label, tag, menu item, tree row, section title, segmented option, card title, card meta. The card description wraps. Each of those single line labels sets `title` to the same string. A long Polish label does not widen a control past the width the parent gives it.
- **AC-7**: Each row of the gap table in the feature design is true in the built CSS and components.
- **AC-8**: The settings JSON (the same file as `locale`, in the app config folder) is the only store for the theme. The key is `theme`. The only written values are `system`, `light`, and `dark`. The page does not write this file and does not use `localStorage`. A missing key, a value that is not a string, or a string outside those three is read as `system` and left unchanged on disk. `set_theme` accepts only those three strings, writes only the `theme` key, and returns the settings. Any other string is refused, the file is unchanged, and the command returns the error `unknown theme: {value}`, the same shape as `unknown language`. `system` means `html` has no `data-theme` attribute. `light` and `dark` set `data-theme` to that word. The Windows setting is read only by the `prefers-color-scheme` rule already in `src/styles/base.css`. There is no Win32 theme call and no Tauri theme listener. While the stored theme is `system`, a Windows change updates the palette without a reload and without a new command.
- **AC-9**: The same settings file stores the page colour under `page_color`. The only written values are `white`, `beige`, `graphite`, and `oled`. A missing key, a value that is not a string, or a string outside those four is read as `white` and left unchanged on disk. `set_page_color` accepts only those four strings, writes only the `page_color` key, and returns the settings. Any other string is refused, the file is unchanged, and the command returns the error `unknown page colour: {value}`. The resolved page colour is the `page` prop on every `NotePage` the app mounts, and that prop sets `data-page`. The Typst SVG in the page preview is not recolored and is not wrapped in `data-page`. `set_theme` does not change `page_color` or `data-page`. `set_page_color` does not change `theme` or `data-theme`.
- **AC-10**: The theme control is a `SegmentedControl` of three options, `system`, `light`, and `dark`, with the words in the message table. It calls `set_theme` and no other command. The page colour control is a separate radiogroup of four swatches, `white`, `beige`, `graphite`, and `oled`. Each swatch uses the matching `--page-*-bg` token for its sheet and the message table for its name. It calls `set_page_color` and no other command. Both controls sit in one appearance dialog opened by a sidebar footer button (`SidebarFooterEntry`, label plus onclick). The new entry is appended after the entries that already exist, so the language control stays after the first entry. That button does not write settings. The dialog is a native `dialog` opened with `showModal`. Focus starts on the theme control. Escape, or the button labeled `appearance_close`, closes it and returns focus to the footer button. A click outside does not close it. The dialog is not the fonts screen, and it has no accent picker, no PDF colour control, no match switch, and no sun and moon button. The dialog preview uses only the five page aliases: the ground is `--page-bg`, `appearance_preview` is `--page-text`, `page_color_hint` is `--page-muted`, the characters `a + b` are `--page-math`, and the characters `#set page` sit on `--page-code-bg`. Each swatch is a `radio` with `aria-checked`, inside a `radiogroup` named by `page_color_label`. The selection moves only after the command succeeds. While either command is in flight, the theme control has `busy` set and the swatch buttons are `disabled`. Nothing animates while the student types.
- **AC-11**: `get_settings` returns `locale`, `theme`, and `page_color`, with `theme` and `page_color` already resolved to a legal value. Fields the struct already has stay. `src/bindings.ts` is regenerated and not hand edited. A save keeps every key the command does not own, including `locale`, `recent_notes`, `display_name`, and any font key. `export_pdf` does not read `page_color` and does not inject a page fill. The message keys in the message table exist in both `messages/pl.json` and `messages/en.json` with the strings in that table.
- **AC-12**: If `set_theme` or `set_page_color` fails, the selection stays on the last resolved value and the status line uses the existing `save_failed` sentence plus the error string. If `get_settings` fails on startup, `html` has no `data-theme`, the page colour stays white, and the status line uses the existing `open_failed` sentence plus the error string. A settings file that `load_settings` already rejects still rejects. It does not gain a special theme repair. On startup, a missing `theme` follows Windows (no `data-theme`), and a missing `page_color` is white.

## Decision

**Chosen option**: Option 1, hand built Papier components, with fonts left as they are

Copy the export's colour, space, size, radius, and shadow into plain CSS. Build the shared components by hand in Svelte 5. Point the open window at the new colours, focus, and motion. Leave font families, the editor file, and the live screens alone.

**Appearance choice**: Option A in the rationale. Store `theme` and `page_color` as two keys in the same settings JSON. Read Windows only through `prefers-color-scheme` while `theme` is `system`. A segmented control writes the theme. A swatch group writes the page colour. Neither control writes the other key.

## Feature design

Reasoning and options: see [rationale.md](rationale.md).

**Data model sketch**:

The token work adds no stored fields. Tokens stay custom properties in CSS.

The appearance choice adds two optional keys on the existing settings object (one JSON file in the app config folder, written only by Rust):

| Key | On disk | Resolved read | Legal writes |
|---|---|---|---|
| `theme` | optional string | `system` when missing, not a string, or not legal | `system`, `light`, `dark` |
| `page_color` | optional string | `white` when missing, not a string, or not legal | `white`, `beige`, `graphite`, `oled` |

There is no second file, no `localStorage` key, and no field inside the note. The two keys do not reference each other. A resolved read does not write the file. `get_settings` returns the resolved strings, so the page never receives a missing theme.

**State transitions**:

- Theme: `system` (no `data-theme` on `html`), `light`, or `dark`. `set_theme` jumps straight from any one to any other. A Windows change is not a stored state. It only repaints the palette while the stored theme is `system`.
- Page colour: `white`, `beige`, `graphite`, or `oled`. `set_page_color` jumps straight from any one to any other. It does not move the theme.
- Menu and command palette: closed, then open, then closed. Opening a menu focuses the first enabled item. If every entry is disabled, the menu stays closed and focus stays on the trigger. Closing returns focus to the trigger. Escape and Tab close. A click outside closes. Enter or Space on an item runs it and closes the menu.
- Segmented control: one option selected. Arrow keys move the selection and select it immediately. `value` is bindable. `onchange` receives the new value. While `busy` is true, clicks and arrow keys do nothing.
- Button busy: the caller sets `busy`. The button is disabled, sets `aria-busy`, and does not fire `onclick`. It does not spin.
- Command palette query: each time `open` becomes true, the query is empty and the active row is the first command. A query change moves the active row to the first match.

**API surface**:

Words in props are the caller's strings. This feature adds no keys to `messages/pl.json` or `messages/en.json`. Required props have no default. Omitting one is a type error.

Heights, padding, radius, and variant colour come from `design/claude-design/papier/components/bundle.css`, except where the gap table names a different number. A primary button hovers with `--color-accent-hover`. Ghost, secondary, and danger hover with `--color-hover`. Every variant presses with `--color-pressed`. The danger fill stays `--color-danger`. Disabled and `aria-disabled` do not take the hover style.

Background and border colour fade over `--motion-fast`. A card hover also uses a stronger border, `shadow-md`, and `translateY(-1px)` over `--motion-fast`. Menu and palette use `--motion-pop` for opacity. Under reduced motion, none of those run.

A menu opens under the trigger, aligned to the inline start, and flips above if it would leave the window. `--z-menu` is 20 and `--z-palette` is 30, both in `src/styles/base.css`.

| Component | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|
| Button | `variant` (`primary`, `secondary`, `ghost`, `danger`), `size` (`sm`, `md`, default `md`), `label` (req), `icon` (opt, an id from the icon table), `disabled` (opt), `busy` (opt), `onclick` (opt) | button. `busy` also sets `disabled` | local UI | missing `label` does not compile. An unknown icon id does not compile |
| IconButton | `label` (req), `icon` (req), `size` (`sm`, `md`), `pressed` (opt), `disabled` (opt), `shortcut` (opt, list of key names), `onclick` (opt) | `aria-label` is `label`. `title` is `label`, plus the keys when `shortcut` is set. `aria-keyshortcuts` is the keys joined by `+`. `aria-pressed` when `pressed` is set. No separate tooltip component | local UI | missing `label` or `icon` does not compile |
| Kbd | `keys` (req, list of strings) | the key names | local UI | empty `keys` renders nothing |
| TextField | `label` (req), `value` (bindable), `hint` (opt), `error` (opt), `placeholder` (opt), `hideLabel` (opt), `icon` (opt) | input, `aria-invalid`, `aria-describedby`, error has `role="alert"` | local UI | missing `label` does not compile |
| SegmentedControl | `label` (req), `options` (req, a tuple of 2, 3, or 4: `value`, `label`, opt `icon`, opt `iconOnly`), `value` (bindable), `onchange` (opt), `busy` (opt) | `radiogroup`, one `radio` selected. While `busy` is true, clicks and arrow keys do not change `value` and do not call `onchange` | local UI | a count other than 2, 3, or 4 does not compile |
| Menu | `label` (req), `entries` (req). An entry is `{ separator: true }` or `{ label, onclick, opt icon, opt shortcut, opt danger, opt disabled }` | menu button and menu | local UI | missing `label` does not compile. All entries disabled: the menu does not open |
| Tag | `label` (req), `color` (req: `gray`, `blue`, `green`, `amber`, `red`, `violet`, `teal`), `pressed` (opt), `onclick` (opt), `onremove` (opt), `removeLabel` (req when `onremove` is set) | The chip is a button only when `onclick` is set. The remove control is a sibling button, never inside the chip button. `aria-pressed` when `pressed` is set | local UI | `onremove` without `removeLabel` does not compile |
| Card | `title` (req), `meta` (opt), `description` (opt), `icon` (opt), `onclick` (opt), `actions` snippet (opt) | If `onclick` is set and `actions` is absent, the card is one button. If `actions` is set, the title is its own button and the actions are siblings, not nested inside it. With neither, the card is a static tile | local UI | missing `title` does not compile |
| Cover | `title` (req), `subtitle` (opt) | title lockup, title at 72px | local UI | missing `title` does not compile |
| NotePage | `page` (opt, default `white`), children | `data-page` on the wrapper | local UI | unknown `page` does not compile |
| Sidebar | `navLabel` (req), `workspaceName` (req), `onNew` (req), `searchLabel` (req), `onSearch` (req, receives the query string, does not filter the tree), `sections` (req), `items` (req), `onOpen` (req, note id), `onToggle` (req, folder id), `saveStatus` (req text), `footer` (req) | nav column, not mounted by `App.svelte`. Tree uses a roving tab stop | local UI | missing `saveStatus` does not compile |
| Toolbar | `label` (req), `items` (req: `id`, `label`, `icon`, opt `pressed`, opt `disabled`), `onAction` (req, receives the item id), `viewOptions` (req, same shape as segmented options), `viewValue` (req), `onViewChange` (req) | `role="toolbar"`, not mounted by `App.svelte`. The view switch is a segmented control. While focus is inside it, its arrow keys win and the toolbar does not also move | local UI | missing `label` does not compile |
| CommandPalette | `commands` (req: `id`, `label`, opt `icon`, opt `shortcut`, opt `group`), `label` (req), `placeholder` (req), `emptyText` (req), `hints` (req, list of strings), `open` (req), `onOpenChange` (req), `onRun` (req, receives the command id) | native `dialog`, not mounted, no global shortcut | local UI | missing copy props do not compile |

Sidebar section fields: `id`, `title`, `expanded`, `onToggle`. Footer entries: `label`, `onclick`. Tree item fields: `id`, `label`, `level`, `kind` (`folder` or `note`), opt `expanded`, opt `selected`, opt `unsaved`. An unsaved row still shows its label as text. A dot may sit beside that text. Colour is never the only signal. `saveStatus` is the footer text.

A command matches when the query, after trimming, is a case insensitive substring of `label`. Polish marks fold both ways: ą and a, ć and c, ę and e, ł and l, ń and n, ó and o, ś and s, ź and z, ż and z. An empty query shows every command, in array order, with `group` as a heading when it changes. `emptyText` shows when nothing matches.

**Commands** (the appearance dialog is the only new caller):

| Command | Kind | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `get_settings` | existing, widened | none | `locale`, `theme`, `page_color` (resolved) | local app | settings not ready, broken file |
| `set_theme` | new | `theme` string | the same settings object | local app | `unknown theme: {value}`. Settings not ready. Broken file. Disk error. File unchanged on refusal |
| `set_page_color` | new | `page_color` string | the same settings object | local app | `unknown page colour: {value}`. Same readiness, file, and disk errors. File unchanged on refusal |

Register both new commands beside `set_locale`. Do not hand edit `src/bindings.ts`.

**Message table** (AC-11). The dialog receives these strings. It does not hard code them.

| Key | English | Polish |
|---|---|---|
| `appearance_label` | Appearance | Wygląd |
| `theme_label` | Interface theme | Motyw interfejsu |
| `theme_system` | Follow Windows | Systemowy |
| `theme_light` | Light | Jasny |
| `theme_dark` | Dark | Ciemny |
| `theme_hint` | Sidebar, toolbar, menus, and dialogs. | Pasek boczny, pasek narzędzi, menu i okna dialogowe. |
| `page_color_label` | Page colour | Kolor strony |
| `page_white` | White | Biały |
| `page_beige` | Beige | Beżowy |
| `page_graphite` | Graphite | Grafitowy |
| `page_oled` | OLED black | Czarny (OLED) |
| `page_color_hint` | The page keeps this colour inside a dark window. | Strona zostaje w tym kolorze także przy ciemnym oknie. |
| `appearance_preview` | A short sample on the page. | Krótka próbka na stronie. |
| `appearance_close` | Close | Zamknij |

**Keyboard** (from the Papier component notes, which win where a static preview is only a picture):

- Segmented control: one tab stop. Left and Right move and select. Home and End go to the ends. While `busy` is true, those keys do nothing.
- Menu: first enabled item is focused on open. Up and Down move. Disabled rows are skipped. Enter and Space run the item and close. Escape and Tab close and return focus to the trigger. A click outside closes.
- Toolbar: one tab stop for the item row. Left and Right move inside that row. Home and End go to the ends. The view switch handles its own arrows and does not bubble them to the toolbar.
- Command palette: focus stays inside the dialog while it is open. Escape closes and returns focus to the caller. The query is a real input. Up and Down move the active command (`aria-activedescendant`). Enter runs it, then closes. This component does not listen for Ctrl+K or any other global shortcut. Feature 21 chooses that shortcut.
- Sidebar tree: Up and Down move. Right opens a folder. Left closes it. Enter and Space open a note. Section titles are buttons with `aria-expanded`.

**Value sourcing**:

| Action | Value produced or displayed | Source |
|---|---|---|
| Paint the window light or dark | palette | `prefers-color-scheme` when `data-theme` is absent. Token values from `design/claude-design/papier/tokens.css` |
| Force a palette | `data-theme` on `html` | settings key `theme` from `get_settings` or the last successful `set_theme`. `system` removes the attribute. `light` and `dark` set it. Windows itself is not stored |
| Read Windows | light or dark palette while `theme` is `system` | the `prefers-color-scheme` media query in `src/styles/base.css`. The webview supplies it. No other reader |
| Paint a note surface | `--page-*` | settings key `page_color`, passed as the `NotePage` `page` prop. Token aliases in `src/styles/tokens.css`. Default white |
| Show the theme selection | which of the three options is checked | resolved `theme` |
| Show the page swatch | which of the four swatches is pressed | resolved `page_color` |
| Leave the Typst preview alone | the SVG pages | the existing render result. Not `page_color`, and not `data-page` |
| Paint the dialog preview | `--page-bg`, `--page-text`, `--page-muted`, `--page-math`, `--page-code-bg` | resolved `page_color` selects the token set. Text is `appearance_preview`. Muted text is `page_color_hint`. Math characters are `a + b`. Code characters are `#set page` |
| Name the controls | the message table | `messages/pl.json` and `messages/en.json` |
| Show a label, hint, error, empty palette, or save status | text | the required prop. No message key is added here |
| Show an icon | SVG path and id | the icon table below. The path is the preview `<svg>`. The id is the table id. The preview words sit in a comment |
| Paint a control | height, padding, radius, variant colour | `design/claude-design/papier/components/bundle.css`, then the gap table where it overrides |
| Hover and press a button | fill | primary hover `--color-accent-hover`. Other hovers `--color-hover`. Press `--color-pressed`. Danger fill `--color-danger` |
| Draw focus | ring colours | `--color-surface` and `--color-focus-ring`, or `CanvasText` under `forced-colors` |
| Time a hover or a popover | duration | `--motion-fast` 90ms for colour and for the card lift. `--motion-pop` 160ms for menu and palette opacity. `--motion-slow` 240ms is defined and unused by these components. Zero under `prefers-reduced-motion` |
| Chrome font | family | existing rule in `src/app.css` (`Segoe UI`) |
| Editor font and editor colours | family and theme | existing rules in `src/lib/editor.ts`. Spec 0002 still owns Inter and JetBrains Mono. Feature 20 owns a dark editor theme |
| Native scrollbar, field caret, dialog backdrop | scheme | `color-scheme` on `html`, from AC-2 |
| Stronger contrast | border and muted text | `--color-border-strong` and `--color-text`, in the media block named in AC-4 |
| Filter palette commands | match list | the fold and substring rule under the API table. Commands array order |
| Place a menu | side and stack | under the trigger, start aligned, flip above at the window edge. `--z-menu` 20 |

**Colour aliases** (old names keep working, values track the new tokens, including when the system theme changes):

| Old variable in `src/app.css` | New token |
|---|---|
| `--bg` | `--color-bg` |
| `--surface` | `--color-surface` |
| `--surface-strong` | `--color-surface-raised` |
| `--ink` | `--color-text` |
| `--ink-soft` | `--color-text-muted` |
| `--line` | `--color-border` |
| `--accent` | `--color-accent` |
| `--accent-soft` | `--color-accent-soft` |
| `--accent-ink` | `--color-on-accent` |
| `--danger` | `--color-danger` |
| `--danger-bg` | `--color-danger-soft` |
| `--warn-bg` | `--color-warning-soft` |

`--radius` in `src/app.css` stays 12px. Do not point it at a Papier radius. Existing padding and corner radii in that file stay.

**Gap table** (AC-7). Where the token file and the brand notes disagree, the token file wins for a number it actually states. Where only the notes state a behavior, the notes win. Preview CSS that drifted loses.

| Gap | What you build |
|---|---|
| Token file has no system theme. The notes say the default follows Windows | Dark values also apply under `prefers-color-scheme: dark` on `:root` when `data-theme` is absent |
| Motion times are only in the notes | The three `--motion-*` tokens above, and 0ms under reduced motion |
| Stronger contrast is only in the notes | The contrast overrides in AC-4. No new hex values |
| `.text-sm` is weight 400, and the notes say buttons are 500 | Both. The size class stays 400. Button labels are 500 |
| Small button text in the preview is 12px | 13px, the `text-sm` size |
| Segmented control in the preview is 22px tall | `--control-sm` (28px) |
| Palette field in the preview is 48px | `--control-lg` (40px) |
| Disabled and danger buttons miss hover or press | Primary hover is `--color-accent-hover`. Ghost, secondary, and danger use `--color-hover`. Press uses `--color-pressed`. Danger fill stays `--color-danger`. Disabled and `aria-disabled` do not take the hover style |
| Note preview uses `--color-surface` and `--color-text` | Note content uses only the `--page-*` aliases |
| Note preview has no third heading | An `h3` in the note uses the `note-h3` size, 20px, weight 700, line height 1.25 |
| Block math in the preview is 1.15em and does not scroll | 20px from `.math-block`, centered, `overflow-x: auto`. Inline math is 18px from `.math-inline` |
| Unsaved mark in the preview is only a dot | `saveStatus` text is required. A dot may accompany it |
| Cover title is 72px and the type scale has no 72px step | 72px stays, on Cover only. It is not a new token |
| Preview focus is a `.focus` class on some parts | `:focus-visible` is the real focus style, including tag, card, palette option, sidebar search, and section titles |
| Preview palette is a static list | A native `dialog` and a real input, as the component notes describe |
| Spinner class has no keyframes | Do not add a spin animation |
| Font stacks in the export | Do not copy them. See AC-1 |
| Chevron in `src/app.css` has no transition | Do not add one |

**Icon table** (AC-5). Thirty five drawings. The comment is the preview word the id came from. `code` is also the drawing the preview uses for Źródło.

| Id | Comment |
|---|---|
| `search` | Szukaj |
| `code` | Kod, also Źródło |
| `light` | Jasny |
| `bulletList` | Lista |
| `export` | Eksportuj do PDF |
| `page` | Strona |
| `split` | Podział |
| `rename` | Zmień nazwę |
| `folder` | Przenieś do |
| `inlineMath` | Wzór, Wzór w linii |
| `redo` | Ponów |
| `settings` | Ustawienia |
| `chevronDown` | disclosure chevron |
| `delete` | Usuń |
| `dark` | Ciemny |
| `save` | Zapisz |
| `table` | Tabela |
| `undo` | Cofnij |
| `plus` | Nowa notatka |
| `close` | close mark |
| `italic` | Kursywa |
| `bold` | Pogrubienie |
| `more` | Więcej |
| `heading` | Nagłówek |
| `note` | note file |
| `panel` | Panel |
| `quote` | Cytat |
| `image` | Obraz |
| `chevronRight` | disclosure chevron, right |
| `link` | Odnośnik |
| `openFolder` | Otwórz folder |
| `blockMath` | Wzór blokowy |
| `strike` | Przekreślenie |
| `numberedList` | Lista numerowana |
| `warning` | warning mark |

**Key invariants**:

- The value source for colour, space, size, radius, shadow, and page colour is `design/claude-design/papier/tokens.css`. Do not restyle those values.
- The value source for component skin, other than the gap table, is `design/claude-design/papier/components/bundle.css`.
- `design/` is a reference. The app build does not import it.
- Components render text as text. They do not use `{@html}`.
- Icon paths are data in `icons.ts`, not addresses loaded from the network.
- The page still never touches disk. Shared components do not call Rust. The appearance dialog calls `get_settings`, `set_theme`, and `set_page_color` only.
- `theme` and `page_color` are written by different commands. Neither command reads the Windows setting.
- One open menu or palette at a time is not required. Each instance closes itself. The appearance dialog closes itself on Escape.

**Security model**:

Local UI only. There is no account, no role, and no new permission. Note text is not rendered by these components from a string of HTML. A caller passes Svelte children or plain props.

**Configuration required**:

None. No new environment variable or secret. The appearance choice uses the settings file you already have.

**Critical test scenarios**:

- Happy path: with no `data-theme`, a dark colour scheme paints `--color-bg` with the dark value, and a light scheme paints the light value. `color-scheme` follows that same choice. A Button label that is longer than the button ends in an ellipsis and its `title` is the full label. This scene is for `/check verify` in the real window. Verifies **AC-1**, **AC-2**, **AC-6**.
- Appearance path: choose dark and white. `html` has `data-theme="dark"`. The preview and every mounted `NotePage` stay white. The file has both keys. A Windows change does not flip the chrome. Set theme back to `system`, remove any forced attribute, and a Windows change does flip the chrome. Set graphite and confirm `theme` is still `system`. Verifies **AC-8**, **AC-9**, **AC-10**.
- Failure case: `prefers-reduced-motion: reduce` yields 0ms motion and a card that does not move. A disabled Button does not take the hover fill. A busy Button does not fire `onclick`. Under `forced-colors: active` the shared controls keep a system outline. `set_theme("blue")` leaves the file and the selection unchanged, and the status line shows the save failed sentence. Verifies **AC-4**, **AC-7**, **AC-12**.
- Auth and permission: there is no auth surface. The stand in check is that CommandPalette, given `open` false, registers no global key and writes no storage, and the appearance dialog writes no `localStorage` key. Verifies **AC-2**, **AC-5**, **AC-8**.
- File check: a Vitest test reads `src/styles/tokens.css` as text and asserts the colour names from the export and the three motion values. It does not compute media queries. Rust tests cover a round trip, a refused value, a missing key read as the default without rewriting the file, and a `set_page_color` that leaves `theme`, `locale`, and an unknown key alone. No new test library is added. Verifies **AC-1**, **AC-4**, **AC-8**, **AC-9**, **AC-11**.

## Build plan

Skateboard: the thinnest usable whole is the open window on the new colours, then the controls, then the shells that later screens will mount.

1. Add `src/styles/tokens.css` and `src/styles/base.css` (motion, contrast after the theme blocks, system dark, `color-scheme`, shared focus, `forced-colors`, `.icon` stroke, `--z-menu`, `--z-palette`). Import them from `src/main.ts` before `src/app.css`. Alias the old colour variables. Replace the 3px outline on raw `button`, `select`, and `input` with the two rings. Do not edit `src/lib/editor.ts`, do not add a chevron transition, and do not change layout rules in `src/app.css`. Satisfies **AC-1**, **AC-2**, **AC-3** (tokens and white default), **AC-4**, **AC-6** (colour aliases).
2. Add `src/lib/ui/icons.ts` with the 35 ids, then Button, IconButton, Kbd, TextField, SegmentedControl, Menu, Tag, and Card, plus `index.ts`. Apply the gap table, the hover rules, and the card and menu behavior. Add the Vitest text check of the token file. Satisfies **AC-5** (those components), **AC-6** (ellipsis and wrap), **AC-7**.
3. Add NotePage and Cover. Note content uses `--page-*`. Cover stays 72px. Satisfies **AC-3**, **AC-5**, **AC-7**.
4. Add Sidebar, Toolbar, and CommandPalette with the keyboard behavior above. Do not mount them from `App.svelte`. Do not bind a global shortcut. Satisfies **AC-5**.
5. [x] The usable appearance whole. Add `theme` and `page_color` to the settings read and to `Settings`. Add `set_theme` and `set_page_color` beside `set_locale`. A missing or illegal value resolves on read and is not written back. Register the commands and regenerate bindings. On startup the page applies the resolved theme to `html` and passes the resolved page colour into every `NotePage`. Add `busy` to `SegmentedControl`. Add `src/lib/ui/AppearanceDialog.svelte` with labels as props and no hard coded sentences. `App.svelte` passes the message strings, opens it from a new footer entry, and calls the commands. Add the preview and the message table in both language files. Satisfies **AC-8**, **AC-9**, **AC-10**, **AC-11**.
6. [x] Failure and the edges. Refuse an illegal write without touching the file. Keep the selection on the last success and use the existing save failed status. Rust tests for the round trip, the preserved keys, and the defaults. Confirm `export_pdf` still does not read `page_color`. Satisfies **AC-11**, **AC-12**.

## Consequences

**Positive**:

- Later screens can share one button, one field, and one focus rule.
- Light, dark, and less motion work before a settings screen exists. After the appearance steps, a chosen theme and a chosen page colour survive a restart.
- A dark window can keep a white or beige page, because the two keys never write each other.
- The editor font work in spec 0002 stays where it is.
- Focus still shows under a Windows contrast theme, because the system outline comes back.

**Negative / tradeoffs**:

- Sidebar, Toolbar, and CommandPalette sit unused until features 18, 20, and 21.
- The current shell takes on Papier colours while keeping its old spacing, so it will not match the export pixel for pixel. That match is the later screen features.
- Note text, math, and code in these components inherit Segoe UI. They will not look like the serif page in the export until a later type decision.
- In a dark window the editor stays on its current light colours, because `src/lib/editor.ts` is left as it is. Feature 20 is the place that themes it. Until then a dark window can make the caret and the selection hard to see.
- You own the keyboard behavior for menus, the toolbar, and the palette, because no component library is added.
- The typing surface does not take the page colour, because `src/lib/editor.ts` stays as it is. The dialog preview and `NotePage` show it. Feature 20 is the place that paints the editor.
- The first paint can follow Windows for a moment before `get_settings` returns. A stored light or dark theme applies when that call finishes. A stored `system` needs no correction.
- The sidebar footer gains an Appearance button. Spec 0005 said the shell feature does not draw a settings gear. This spec draws a text button, not that gear, and not a sun and moon toggle.
- The prototype's match switch (dark chrome paired with a graphite page) and its PDF choice "like the screen" are not built. A student cannot tie the page colour to the theme.

**Neutral**:

- `design/claude-design` stays in the repo as the reference and is not part of the Vite build.
- The token work adds no package and no settings field. The appearance work adds the message table and two settings keys, and no package.
- One spec now holds the token work and the appearance choice. Check the criteria for the part you built. A token check does not prove the controls.

## Follow-up

- [ ] The scope row still says type matches the export. This spec leaves font families as they are. When you next touch `docs/scope/scope.md`, you may align that sentence with AC-1.
- [ ] Feature 19 in the scope should point at this spec. The storage, the Windows read, and the two controls are decided here (AC-8 through AC-12).
- [ ] Spec 0005 says the shell does not draw a settings gear or a theme button, and it does not set `data-theme`. This spec adds the Appearance footer button and then sets `data-theme`. When you next touch spec 0005, note that split.
- [ ] Spec 0002 widens `get_settings` with font fields. Those fields stay compatible with `theme` and `page_color`. This spec does not add the font controls.
- [ ] The saved greeting name stays where spec 0005 left it. This spec does not edit `display_name`.
- [ ] Feature 21 chooses the command palette shortcut. This component stays closed until the caller sets `open`.
- [ ] Features 18, 20, and 22 are the place to mount Sidebar, Toolbar, and the search screen.
- [ ] Spec 0002 still brings Inter and JetBrains Mono for the editor. This spec does not do that work.
- [ ] Feature 20 themes the editor for a dark window and paints the typing surface with the stored page colour. This spec leaves `src/lib/editor.ts` unchanged on purpose.

## Rationale

Reasoning and options: see [rationale.md](rationale.md).
