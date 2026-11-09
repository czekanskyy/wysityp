# 0004. Design system and UI foundation

**Date**: 2026-11-09
**Status**: Proposed

## Summary

WYSITyp gets one visual language, called Papier: a warm paper surface, one ink blue accent, a serif for the note, its own face for math, and small, quiet chrome. It lives as CSS custom properties in `src/styles/tokens.css`, a base layer in `src/styles/base.css`, and a small set of Svelte 5 components in `src/lib/ui/`. The living reference is [docs/design.md](../../design.md).

## Requirements

From scope feature 4: `design.md` covers type, colour, spacing and base components in both app languages, and base components handle focus and keyboard use well.

- **R-1**: Every colour, size, radius, shadow, and duration used by new UI comes from a token. Light and dark themes are one token set, following Windows by default, with an override.
- **R-2**: Text meets WCAG 2.2 AA contrast in both themes (4.5:1 for text, 3:1 for placeholders and borders that carry meaning).
- **R-3**: Note typography covers prose, headings, lists, quotes, inline and block math, inline code and code blocks, and math or markup shown as source, so spec 0002 decorations have a defined look.
- **R-4**: The base components are a button, an icon button, a text field, a toolbar, a sidebar with a note tree, a menu, a command palette, a card, a tag, and a segmented control.
- **R-5**: Every component has a visible focus state and a keyboard path. Groups use one tab stop and arrow keys.
- **R-6**: Components hold no app text. Every string is a prop, so Polish and English stay in `messages/*.json`.
- **R-7**: No network. No web fonts are fetched and no icon or UI package is added.

## Decision

**Chosen option**: Option 1, a hand made token set and components in plain CSS and Svelte, styled after calm note apps. See [rationale](rationale.md).

The look borrows on purpose from note apps students already know. The page and serif come from Bear and iA Writer, the dense, quiet sidebar and tree from Obsidian, the command palette and slash style actions from Notion and Linear, and the soft cards from Craft. The accent is ink blue rather than Typst's teal so that it reads as "pen on paper" and keeps strong contrast with white text.

## Feature design

- `src/styles/tokens.css`: tokens written once with `light-dark()`. `color-scheme: light dark` on `:root`, overridden by `data-theme` on `<html>`. Reduced motion and high contrast media queries adjust tokens, not components.
- `src/styles/base.css`: box sizing, focus, selection, scrollbars, and the `.note-*` classes for note content.
- `src/lib/ui/`: components, `roving.ts` (one tab stop, arrows move), `commands.ts` (palette matching that ignores case and Polish accents), `theme.ts`, `icons.ts`. Unit tests in `src/lib/ui/ui.test.ts`.
- `design.html` and `src/design/`: a dev only gallery. `vite build` bundles only `index.html`, so the gallery never ships. Its sample words are content, not app strings.
- `src/main.ts` loads tokens and base before `app.css`. `app.css` keeps its short names as aliases of the tokens, so current screens follow the palette and dark mode with no markup change. The CodeMirror theme reads the tokens.

Nothing is stored on disk. Notes and settings are unchanged.

## Out of scope

- Storing the theme choice. It belongs in the settings JSON beside `locale` and needs a Rust change.
- Rewriting `App.svelte` onto the components. That happens screen by screen in later features.
- Bundling Libertinus Serif and New Computer Modern Math as page fonts.
