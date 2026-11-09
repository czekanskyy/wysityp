# 0004. Design system and UI foundation, rationale

## Context

> Premise note: The scope row asks for type to match the Papier export. You chose, twice, to leave fonts as they are. A later build that "fixes" the fonts back to Libertinus, New Computer Modern, or the UI variable font would undo that choice. This spec is the narrower contract. The scope sentence can be aligned later. It is a follow up, not a second design.

WYSITyp is a Windows desktop app (Tauri, Svelte 5, plain CSS). Spec 0001 already chose design tokens as CSS variables and left the values for this work. The app today paints one light palette from `src/app.css` and sets the chrome font to Segoe UI. The editor sets its own stack in `src/lib/editor.ts` (`Consolas`, then Cascadia Mono). There is no `src/lib/ui` and no `src/styles`. Theme and page colour are not in the settings file.

The locked look is the Papier export in `design/claude-design`. The brand notes and the token file are not the same on every point: the notes say the default theme follows Windows, and the token file only puts dark values behind an explicit attribute. Motion and stronger contrast are described in the notes and absent from the CSS. A few preview sizes drifted from the token sizes. The export also names font stacks the running app does not use.

The screen features (18 to 22) already own putting this look on the sidebar, the start surface, the editor chrome, the palette shortcut, and search. This decision is the shared layer those features need, and the smallest change that lets the open window follow Windows now.

Students use the app in lectures, in Polish and English, often from the keyboard, and sometimes with less motion requested at the system. The page never touches disk. There is no account and no network in this feature.

## Options considered

### Option 1: Hand built components, export colours, fonts left as they are

Copy colour, space, size, radius, and shadow from the token file. Build the shared components in Svelte 5 and plain CSS. Point the existing window at the new colours through aliases, and let CSS follow `prefers-color-scheme` and `prefers-reduced-motion`. Do not add font files, do not edit the editor theme, and do not rebuild the live screens.

**Pros**:

- Matches spec 0001 (plain CSS, no new UI kit) and the choices you made in this design.
- The open window can follow Windows before the settings screens exist.
- Later features mount finished components instead of restyling raw buttons.

**Cons**:

- You own menu, toolbar, and palette keyboard behavior.
- Shell components sit unused until the screen features.
- The current shell will not match the export's spacing, and note text will not be the export's serif, until later work.

### Option 2: bits-ui for the keyboard heavy parts

Use bits-ui (a headless Svelte 5 set, current as a package in November 2026) for the menu, the segmented control, and the palette, and skin them with Papier. Build the rest by hand. Same token and font rules as option 1.

**Pros**:

- Less of your own focus trap and arrow key code.
- The visuals can still match the export, because the library is unstyled.

**Cons**:

- A new dependency, and a second API to keep when Svelte or the library moves.
- You would still write every visual rule, which is most of this feature.

### Option 3: Reskin the live screens in this same spec, including the export's fonts

Treat features 18 to 22 as part of this decision, and switch chrome and note type to the export stacks (Segoe UI Variable Text, Libertinus Serif, New Computer Modern Math, Cascadia Mono).

**Pros**:

- One spec would make the running app look like the prototype, including the serif page.
- The scope row's "type matches the export" line would be literal.

**Cons**:

- It swallows five features and reopens spec 0002, which already owns the editor fonts.
- It adds the font question you asked to leave alone, and it delays the first usable token step.

## Rationale

Option 1 is the one you picked, and it is the one that fits a solo build on the stack you already have. Spec 0001 removed the reason to add a component kit. The export is a small, locked set of controls, and the preview CSS is already the skin. bits-ui would help the palette and the menu, and it would still leave the token work, the focus rings, and the screen split to you. That help is real, and it is not worth a dependency for this set.

Leaving the live screens to features 18 to 22 keeps this spec one decision: the shared layer. Building Sidebar, Toolbar, and CommandPalette now, without mounting them, is the cost of that split. You asked for the components in this feature, so they are in the build plan last, after the window itself looks right. That order is the Skateboard approach on the scope: a thin usable whole (the open window on the real colours), then the rest of the set.

The font choice is the sharp edge. The export, the running app, and spec 0002 name three different stacks. You chose the running app for this feature, and you left spec 0002 in charge of Inter and JetBrains Mono. The token file's `font-family` lines are therefore not copied. Sizes and weights still come across, because those are part of the components, not a new font. The consequence is honest: math and code in the new note wrapper inherit Segoe UI until someone picks up type again.

Where the export disagrees with itself, the gap table in the build spec names the winner so the build does not invent one. Token numbers win when the token file states them. Behavior that exists only in the brand notes (system theme, motion, stronger contrast, keyboard, a real dialog) wins when the preview is only a static picture. No new colours are introduced to paper over those gaps.

A later read of the draft asked whether to drop Sidebar, Toolbar, and CommandPalette until the screen features. You had already asked for those components here, so they stay, and the draft now names their props, matching, and keyboard instead of leaving them open. The same read caught a real limit: a dark window will not restyle the editor, because you froze `src/lib/editor.ts`. That limit is written in the consequences, and feature 20 is the follow up, rather than quietly breaking the freeze. Windows contrast themes keep a system outline, and `color-scheme` follows the same theme rules as the palette, so native scrollbars and carets are not a second guess.

## Evidence

Read only pass over the export and the current page, November 2026.

- `papier/tokens.json` and `screens/ds/wysityppapier/tokens.json` match. The two `tokens.css` files match. `design-system.json` holds no token values.
- Colour tokens in the file: 35, plus 6 syntax, 14 tag, and 20 page colour tokens. CSS also aliases `--page-bg`, `--page-text`, `--page-muted`, `--page-math`, and `--page-code-bg`, defaulting to white on `:root`.
- The token file applies light values on `:root, [data-theme="light"]` and dark values only under `[data-theme="dark"]`. It has no `prefers-color-scheme` query.
- Type classes in `tokens.css` set `font-family` to the four export stacks. Those stacks are what AC-1 leaves out. `note-h3` is already in `tokens.css` at 20px. The note preview in `bundle.css` styles `h1` and `h2` only, and paints the note with `--color-surface` rather than `--page-*`.
- `bundle.css` sets icon stroke to 1.75 on `.wt-ico`. Icons are inline SVG paths in the component previews. There is no separate icon module in the export, and the brand note's count of 42 is not a quota. The set to copy is whatever the previews actually draw.
- The current page loads one stylesheet, `src/app.css`, from `src/main.ts`. `App.svelte` has no style block. There is no `data-theme`, no `prefers-color-scheme`, and no `prefers-reduced-motion` under `src/`.
- The prototype screens store theme and page colour in `localStorage` under `wysityp:ui` and `wysityp:page`. Spec 0001 keeps settings in one JSON file. This feature copies neither store.
