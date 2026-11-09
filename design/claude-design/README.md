# Claude Design export

This folder is a snapshot of the two Claude Design artifacts made for WYSITyp on 2026-11-09. The code in `src/styles/` and `src/lib/ui/` stays the source of truth: these files are reference designs, not app code, and nothing in the build imports them.

- `papier/` is the **Design System** artifact "WYSITyp Papier" ([claude.ai](https://claude.ai/artifact/TmhaUk7uyvQezC7rxAqhp3)). `tokens.json` lists every token with its value per theme and its usage, `tokens.css` is generated from it, `components/*/preview.html` are static previews of the `src/lib/ui` components and `README.md` is the brand book (Polish).
- `screens/` is the **Design** canvas "WYSITyp – ekrany aplikacji" ([claude.ai](https://claude.ai/artifact/F1fi4jCgkRcNCtKjCpMqoL)). `canvas.json` places the boards, and each `*.dc.html` is one screen. `screens/ds/wysityppapier/` is the copy of the design system the screens link to.

## Screens

| File | Screen |
| --- | --- |
| `Main.dc.html` | Editor, the start of the clickable prototype (theme toggle, view switch, palette, shortcuts) |
| `Dark.dc.html`, `Split.dc.html`, `Palette.dc.html`, `Shortcuts.dc.html` | Editor variants: dark, split view, command palette, text editing shortcuts (Ctrl+/) |
| `Home.dc.html` | Start screen with templates and recent notes |
| `Search.dc.html` | Search folders, file names and note text, with replace (Ctrl+Shift+F) |
| `Toolbar.dc.html` | Full toolbar, paragraph style and block menus, colours, floating and narrow toolbars |
| `Symbols.dc.html` | Symbol picker in sections (Greek, operators, relations, arrows, sets and logic, analysis) with Typst names |
| `Table.dc.html` | Word like rows × columns grid picker with preview and generated `#table` |
| `Shapes.dc.html` | Geometric shapes (lines, polygons, curves, angle, axes, function plot) with stroke and fill |
| `Settings.dc.html` | Appearance and fonts: UI theme and page colour (white, beige, graphite, OLED black) set independently |
| `SettingsMore.dc.html` | Editor, files and backups, PDF export, shortcuts, Typst packages, language, privacy, about |

## Opening the screens

The screens are Claude Design component files. They need the runtime script `support.js` that Claude Design serves next to them, so opened straight from disk they show their markup and styles but not their interactivity. To click through the prototype, open the canvas link above. The screens remember the chosen theme and page colour in `localStorage` under `wysityp:ui` and `wysityp:page`.

## Not in the app yet

The page colour tokens (`page-white-*`, `page-beige-*`, `page-graphite-*`, `page-oled-*` in `papier/tokens.json`) and the screens above are designs only. Bringing them into `src/` is follow up work.
