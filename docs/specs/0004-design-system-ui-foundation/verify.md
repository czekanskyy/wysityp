# Verify: Theme and page colour · spec 0004 · updated 2026-11-09
_Steps derived from spec 0004 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

This list locks the appearance slice (AC-8 through AC-12). AC-1 through AC-7 are the token and component slice already in the tree. `bun run test` reads `src/styles/tokens.css` for the colour names and the three motion values.

## UI / manual

- [x] Open the app with a settings file that has `locale` and no `theme` key. `html` has no `data-theme`. Switch Windows between light and dark. The chrome follows, without a reload, and the file still has no `theme` key. → AC-8
- [x] Choose Dark in Appearance. `html` has `data-theme="dark"`. Switch Windows. The chrome stays dark. The file has `theme` `dark` and the page colour key is unchanged. → AC-8, AC-9
- [x] Choose Follow Windows. `data-theme` is removed. Switch Windows. The chrome follows again. → AC-8
- [x] Choose Light, then Graphite. The dialog preview stays graphite. `theme` in the file is still `light`. `set_theme` does not change `page_color`, and `set_page_color` does not change `theme`. → AC-9, AC-10
- [x] Open Appearance from the new sidebar footer button. That button is after the entries that were already there, and the language control stays after the first entry. The button itself writes nothing. Focus starts on the theme control. Escape, and the Close button, close the dialog and return focus to that footer button. A click outside leaves it open. There is no font list, no accent picker, no match switch, and no sun and moon button. → AC-10
- [x] The theme control is three options: Follow Windows, Light, Dark (Polish: Systemowy, Jasny, Ciemny). The page control is four swatches: White, Beige, Graphite, OLED black (Polish: Biały, Beżowy, Grafitowy, Czarny (OLED)). Each swatch sheet uses the matching `--page-*-bg` token. Arrow keys move within each group. The selected option changes only after the command succeeds. While either command is in flight, the theme control ignores clicks and arrows, and the swatches are disabled. Nothing animates while you type. → AC-10, AC-4
- [x] The preview ground is `--page-bg`, the sample sentence is `--page-text`, the hint line is `--page-muted`, `a + b` is `--page-math`, and `#set page` sits on `--page-code-bg`. Switch the page colour and only that preview changes. → AC-10
- [x] Switch the app language. The dialog words match the message table in both `messages/en.json` and `messages/pl.json`. → AC-11
- [x] Export a note to PDF while the stored page colour is graphite, then again while it is OLED black. Both PDFs are white pages. The Typst picture in the note preview is not recoloured and is not wrapped in `data-page`. → AC-9, AC-11
- [x] With no `NotePage` mounted, the page colour still shows on the dialog preview. When a `NotePage` is mounted, its `page` prop is the resolved colour and that prop sets `data-page`. → AC-9

## Commands

- [x] `cargo test --manifest-path src-tauri/Cargo.toml --lib settings::` → a missing or illegal `theme` reads as `system`, a missing or illegal `page_color` reads as `white`, and the file is not rewritten. A new file stores `locale` only. `set_theme("dark")` then `set_page_color("graphite")` keeps `locale`, `display_name`, and a font key. `set_theme("system")` leaves the page colour graphite. → AC-8, AC-9, AC-11
- [x] `cargo test --manifest-path src-tauri/Cargo.toml --lib settings::` → `set_theme("blue")` returns `unknown theme: blue` and does not create a file. On an existing file, `set_theme("blue")` and `set_page_color("navy")` return `unknown theme: blue` and `unknown page colour: navy`, and the bytes stay the same. A broken settings file is still an error for both commands, and the bytes stay broken. → AC-12, AC-8
- [x] `cargo test --manifest-path src-tauri/Cargo.toml --lib settings::tests::export_pdf_does_not_read_page_colour` → `export_pdf` does not read `page_color` and the PDF path uses default PDF options. → AC-11
- [x] In the window, a refused `set_theme` or `set_page_color` leaves the selection on the last success and the status line shows the existing saving failed sentence plus the error. If `get_settings` fails as the app opens, `html` has no `data-theme`, the page colour stays white, and the status line shows the existing opening failed sentence plus the error. → AC-12

## Value sourcing

- [x] Window palette, no `data-theme` → `prefers-color-scheme` in `src/styles/base.css`, token values from the Papier token file. → AC-2, AC-8
- [x] Forced palette → `data-theme` on `html` from `get_settings` or the last successful `set_theme`. `system` removes the attribute. `light` and `dark` set it. Windows itself is not stored. → AC-8
- [x] Page surface → `page_color` from settings, passed as the `NotePage` `page` prop when one is mounted, and as `data-page` on the dialog preview. Default white. → AC-9
- [x] Theme selection and swatch → the resolved `theme` and `page_color` strings. A resolved read does not write the file. → AC-8, AC-9, AC-10
- [x] Typst picture → the existing render result. Not `page_color`, and not `data-page`. → AC-9
- [x] Dialog preview colours → the five `--page-*` aliases selected by the resolved page colour. Copy is `appearance_preview`, `page_color_hint`, the characters `a + b`, and the characters `#set page`. → AC-10
- [x] Control names → `messages/pl.json` and `messages/en.json`, the message table in spec 0004. → AC-11
- [x] PDF page fill → not read. `export_pdf` takes the note path and source only. → AC-11
- [x] Startup failure → no `data-theme`, page colour white, status line is the existing `open_failed` sentence plus the error string. → AC-12

## Acceptance-criteria coverage

- AC-8 is the Windows steps, the forced Dark step, and the settings tests for a missing or illegal theme.
- AC-9 is Graphite under Light, the untouched Typst picture, and `set_page_color` leaving `theme` alone.
- AC-10 is the dialog steps: footer button, focus, Escape, Close, click outside, both controls, busy state, and the preview.
- AC-11 is both languages, preserved keys, and a white PDF.
- AC-12 is a refused write, the saving failed status, a broken file, and a failed read on startup.
- AC-1 through AC-7 stay with the token and component slice. This file does not recheck them.
