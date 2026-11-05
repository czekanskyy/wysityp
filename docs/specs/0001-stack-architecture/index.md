# 0001. Stack and architecture

**Date**: 2026-11-05
**Status**: In Progress

## Summary

WYSITyp will be built as a Windows desktop app with Tauri, a Svelte page written in TypeScript, and a small Rust part that holds the Typst engine. You type Typst source in a CodeMirror editor, and that source stays the truth, while the Rust part compiles the whole note and sends back a rendered page. This keeps notes as plain Typst files, keeps typing fast, and keeps the whole app working with no account and no network.

## Decision

**Chosen option**: Option 1, Tauri with Svelte and the Typst Rust library

One repo holds the whole app. Page code lives in `src/`. Rust code lives in `src-tauri/` as one crate with clear modules for file work, the Typst engine, settings, errors, and the commands the page calls. The scaffold that follows this spec must prove the full path once, thinly, before any later feature builds on it.

**Implementation skills**: `tauri-v2` (`nodnarbnitram/claude-code-extensions`, `.agents/skills/tauri-v2/`) · `svelte-code-writer` (`sveltejs/ai-tools`, `.agents/skills/svelte-code-writer/`) · `svelte-core-bestpractices` (`sveltejs/ai-tools`, `.agents/skills/svelte-core-bestpractices/`) · `vitest` (`antfu/skills`, `.agents/skills/vitest/`) · `bun-runtime` (`affaan-m/ecc`, `.agents/skills/bun-runtime/`) · `typst` (`lucifer1004/claude-skill-typst`, `.agents/skills/typst/`) · `paraglide-js` (`zhuojg/agent-skills`, `.agents/skills/paraglide-js/`)

No CodeMirror skill is installed. The search found only skills with a handful of installs, and none earned trust. Editor work leans on CodeMirror docs instead.

## Proposed stack

| Layer | Choice | Reason |
|---|---|---|
| Desktop shell | Tauri 2 | On Windows the page runs in WebView2, which is Chromium based, so typing feel matches the main rival. The app stays small for students to download, and Mac and Linux versions stay possible later. |
| Page language | TypeScript | The editor libraries this product needs are TypeScript first, and one language across the page keeps the learning load low for a solo builder. |
| Page framework | Svelte 5 with Vite, as a plain local app | A small amount of code, fast page updates, and no server or web routing concepts to carry. SvelteKit is not used. |
| Page state | Svelte built in reactivity, called runes, plus small stores you own | Nothing extra to learn or depend on, and updates stay close to the typing path. |
| Editor base | CodeMirror 6 | It works from flat source text, with strong typing speed, undo, and selection. See the editing path below. |
| Typst engine | The Typst Rust library, used inside the Rust part | It compiles source in memory, gives SVG for the page and PDF from the same engine, and reports errors with a place in the source. |
| Rust shape | One crate in `src-tauri/`, split into named modules | The fewest moving parts to learn and build. A module may become its own crate later only if it earns that split. |
| Talk between page and Rust | Tauri commands for asks and answers, Rust events only for things Rust notices first, shared types generated with `tauri-specta` | Generated types stop the TypeScript side and the Rust side from quietly drifting apart. |
| Package tool for page code | Bun, with Vite building the page and `bun.lock` committed | This was your pick over `npm`. It is younger tooling, so a guard is written in the follow up list below. |
| Settings storage | One plain JSON file in the app config folder, written by Rust. No database | Plain text a student can inspect, and it matches the plain files promise of the whole app. |
| Fonts | A small set of bundled open fonts covering Polish letters and including the Typst default text and math families, plus fonts already on the Windows machine, loaded through `typst-kit` | A fresh install renders the same for everyone and matches the plain Typst tool for notes that name no font, and notes that name a font a student owns still work. |
| Typst packages | Follow the standard Typst cache, through `typst-kit` pointed at the same default cache the Typst tool uses. A package may be fetched the first time a note imports it while online, then works offline from the cache | Student files stay portable to the plain Typst tool and back. A missing package while offline gives a clear error, never a blank page. |
| App languages | Paraglide, with Polish and English checked at build time. The chosen language lives in the settings JSON as `locale`, defaults to Polish, and applies at run time | A missing word in either language becomes a build error, and Polish plural rules are handled by the tool. There is no web address in this app for Paraglide to read a language from, and no second store may hold the language. |
| Styling | Plain CSS, with design tokens held in CSS variables | No extra build tooling, and full control over focus and keyboard states. The design system work fills in token values later. |
| File access | Rust only. One open command runs the folder picker, resolves the folder to its true form, and stores it in Rust. Rust may then touch that stored folder, the app config folder, and the Typst package cache. The page gets no direct file access and never sends a root folder | Every file action is checked in one place against a root the page cannot widen, which matches the trust promise made to students. Paths that climb out, follow links out, or name an absolute place outside the root are refused, and Typst reads inside a note follow the same rule. |
| Tests | Vitest for TypeScript, the Rust test runner for Rust, and a few full app smoke tests only where a unit test cannot reach | Fast tests a solo builder will actually run, with costly full app tests kept few. |
| Logging and privacy | A local log file in the app config folder. No usage data ever leaves the machine | The app makes a no tracking promise, and a local log still gives you something to read when a student reports a fault. |
| Installer shape | An NSIS installer from the Tauri bundler, installed per student with no admin account needed | The common Windows shape students know. Signing and updates are decided in the public release work, not here. |
| Accounts, hosting, and jobs | None | This is an offline desktop app. There is no server, no account system, and no background job queue to build or run. |

Versions of every tool are pinned in the lock files, `Cargo.lock` and `bun.lock`, and both files are committed. Upgrades happen one tool at a time, on purpose, never as a side effect of other work.

## Editing and rendering path

This is the path every later editor feature must follow, written plainly as your scope asks.

1. Typst source is the truth. The note file on disk is a plain Typst file, and the editor buffer in the page holds the current source while a student types. No second document model is kept that could drift from the source.
2. CodeMirror 6 shows that source. In the finished editor, rendered parts will stand in place of their source spans until a student clicks one to edit its source right there. The detailed rules for cursor movement, selection, and which spans render are the job of the rendered page editor spec, not this one. This spec fixes only the base, CodeMirror with source as truth, so that work starts from a settled floor.
3. Opening a note goes through Rust too. A Rust command reads the file inside the stored root and returns its words as the first editor buffer, since the page cannot read disk.
4. Shortly after typing pauses, the page sends the current source, the note path inside the stored root, and a rising revision number the page owns, to Rust through a Tauri command.
5. Rust keeps one Typst world alive for the open note, built with `typst-kit` for fonts and packages. The world takes its main source from the editor buffer, so unsaved typing renders at once, resolves paths the way Typst resolves them, and reads included files and images from disk inside the stored root. Rust compiles the whole note, since styles, labels, and references reach across a whole note. The compile date is pinned to the local date of that compile, so the words a note takes from the current date have a named source. One compile runs at a time on a blocking thread, away from the page thread.
6. Rust sends back the same revision number, untouched, plus one SVG page image per page. Each SVG stands alone, with images carried inside it and glyphs embedded or drawn as shapes, and never a file path or font name the page would have to resolve. Rust also sends any errors in a fixed structure holding how serious the problem is, the file, the start and end of the place counted in UTF 8 bytes in the exact source that was compiled, and the compilers own message and hints as plain text. The page converts byte places to its own editor positions, drops any answer whose revision is no longer the latest, and on a failed render keeps the last good page on screen beside the error.
7. PDF export, when that feature is built, reuses the compiled result Rust kept from the render compile, through the same Typst engine, so the PDF and the page can never disagree about layout or date. If the source has moved on since that compile, one fresh compile happens first and its date is pinned for that export.
8. Saving writes the editor buffer to the note path, after Rust has checked the path sits inside the stored root.

**Value sourcing** (where each value the path produces comes from):

| Action | Value produced | Source |
|---|---|---|
| Open a note | First words in the editor buffer | The note file on disk, read and returned by a Rust command that checked the path inside the stored root |
| Open a folder | The root every later path is checked against | The folder picker run by Rust, resolved to its true form and stored in Rust. The page never sends this value |
| Render a note | SVG page images | The Typst Rust library compiling the world Rust holds for the open note, exported so each SVG stands alone with images inside it and glyphs embedded or drawn as shapes |
| Render a note | Source that gets compiled | The editor buffer, sent with the render command, so unsaved typing is included |
| Render a note | Revision a result belongs to | A rising counter the page owns and sends with each render request, returned by Rust untouched. The page drops results that are no longer the latest |
| Render a note | Included files and images | Files on disk inside the stored root, read by the Typst world with paths resolved the way Typst resolves them |
| Render a note | Fonts used for layout | The bundled font set plus the Windows machine font list, both loaded by Rust through `typst-kit` at startup |
| Render a note | The current date a note may use | The local date at the moment of that compile, pinned in the Typst world for that compile |
| Render a note | Error words shown to the student | The Typst compilers own message and hints, returned as plain text. Paraglide never translates compiler words, only the apps own words |
| Render a note | Error places shown to the student | Typst diagnostics, returned by Rust as a file plus a start and end counted in UTF 8 bytes in the exact source that was compiled. The page converts bytes to editor positions |
| Save a note | Bytes written to disk | The editor buffer, written only to a path Rust checked inside the stored root |
| Export PDF later | PDF bytes | The compiled result Rust kept from the render compile, through the Typst PDF output of the same engine, with the same pinned date |

**Key invariants**:

- A note file that Typst itself can read must open in WYSITyp, and a file WYSITyp saves must stay readable by Typst and by plain text tools.
- Rendering never changes the source. Only typing and saving change what is on disk.
- The page never touches the disk directly. All file work goes through Rust commands with the opened folder checked.
- No part of the core loop needs a network connection. The only network use in this stack is fetching a Typst package a note imports for the first time, and only while the machine is online.
- An error from Typst is shown with its place in the source. It is never swallowed into a blank or silently stale page.
- A render result that arrives after newer typing is dropped by revision number, never painted. A failed render keeps the last good page on screen beside the error.
- The chosen app language lives only in the settings JSON, under `locale`. Nothing may store it in a second place.
- Typst compiler words are shown as Typst wrote them, in English, whatever language the app is speaking. The apps own words around them are translated as usual.

**Configuration required**: none. This stack needs no environment variables, no keys, and no accounts. Tool settings live in `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, and `package.json` once the scaffold creates them.

## Scaffold proof bar

The scaffold task that follows this spec is done when all of this holds on Windows. This is the proof bar you picked, a thin thread through every risky boundary, in line with the Skateboard approach in your scope.

1. The app builds and a window opens.
2. A student can open a folder.
3. A student can type Typst source in a plain CodeMirror editor.
4. The rendered page appears as SVG from the Rust Typst engine shortly after typing pauses.
5. The file saves back to disk inside the opened folder.
6. The type checks, the Vitest tests, and the Rust tests that ship with the scaffold pass.
7. One sample note with Polish letters and math renders with its glyphs and figures visible in the SVG, with no file read by the page, and a Typst error in that sample after Polish letters marks the right place in the source.

The scaffold note is short, so this proof bar proves the pipeline, not smooth typing at real lecture length. Nobody should read a smooth scaffold as proof that the finished editor will feel smooth on a long note. That question belongs to the rendered page editor work, with real notes.

The full rendered page editor, where rendered parts replace source on the page, is a later feature with its own spec. The scaffold proves the pipeline that editor will stand on.

## Consequences

**Positive**:

- The hardest risks, Tauri, CodeMirror, the Typst engine, and the talk between page and Rust, all get proven by one thin scaffold before real features pile on top.
- Notes stay plain Typst files with no conversion, which is the promise the whole product stands on.
- One small Rust crate and one page language keep the system in one head, which suits a solo builder in spare time.
- The same Typst engine renders the page and will export PDF, so the two can never drift apart.

**Negative / tradeoffs**:

- You will learn some Rust. The Tauri shell, file safety, and the Typst engine all live there, and there is no way around that in this stack. The pick keeps that Rust thin and in one crate to bound the cost.
- CodeMirror was built for source text, not for a rendered page. Making rendered parts feel natural to move through and edit will be careful work in the editor feature, and some of it will be slow to get right.
- Bun is younger than `npm`. Most Tauri and Svelte guidance assumes `npm`, so you may meet small mismatches that the larger tool would not give you. You picked this with that cost in view.
- Whole note compilation is simple and correct, and Typst reuses prior work well. A truly huge note could still make rendering feel heavy, and that would be handled in the editor work only if real notes prove it.
- Windows comes first in practice. WebView2 on Windows is Chromium based, while later Mac and Linux versions will render through other web views, so pages will need testing there when those versions come.
- Typst compiler errors stay in English, as Typst wrote them, even when the app itself is speaking Polish. The labels and guidance around an error can be Polish. The error sentence itself cannot, since Typst composes those sentences freely and no translation list can hold them.

**Neutral**:

- Typst packages follow Typst itself, cache and all. Students moving between WYSITyp and the plain Typst tool will find the same behaviour on both sides.
- The app carries bundled fonts, which adds some size in exchange for the same rendering on every machine.

## Follow-up

- [ ] Connect the Svelte MCP server, run by the Svelte team, at `https://mcp.svelte.dev/mcp` in your agent settings. It gives current Svelte docs and a Svelte code checker. Connecting is a settings step only you can do.
- [ ] Connect the community Tauri MCP server, `hypothesi/mcp-server-tauri`, in your agent settings if you want an agent to see the running app, read logs, and watch the talk between page and Rust during checks. It is not from the Tauri team, its own page says it may contain bugs, and it needs a debug only plugin in the app, so add that plugin only after weighing the risk.
- [ ] Connect the community Typst MCP server, `johannesbrandenburger/typst-mcp`, in your agent settings if you want Typst docs lookup and snippet checking for the agent. It helps the agent only. The app itself never uses it.
- [ ] `tauri-v2` conventions are not yet in any `AGENTS.md`, since the project has none yet. They are project wide and belong in the root `AGENTS.md` when `/audit` creates it.
- [ ] `svelte-code-writer` conventions are not yet in any `AGENTS.md`. They are project wide and belong in the root `AGENTS.md` when `/audit` creates it.
- [ ] `svelte-core-bestpractices` conventions are not yet in any `AGENTS.md`. They are project wide and belong in the root `AGENTS.md` when `/audit` creates it.
- [ ] `vitest` conventions are not yet in any `AGENTS.md`. They are project wide and belong in the root `AGENTS.md` when `/audit` creates it.
- [ ] `bun-runtime` conventions are not yet in any `AGENTS.md`. They are project wide and belong in the root `AGENTS.md` when `/audit` creates it. Note that the Bun skill listed under the Bun project name could not be installed, since its registry name did not resolve, so `bun-runtime` from `affaan-m/ecc` was installed in its place.
- [ ] `paraglide-js` conventions are not yet in any `AGENTS.md`. They are project wide and belong in the root `AGENTS.md` when `/audit` creates it. This skill has a low install count, so treat its word as a hint and the Paraglide docs as the truth.
- [ ] `typst` conventions are not yet in any `AGENTS.md`. This skill teaches writing Typst documents, so its home is the root `AGENTS.md` for now, and it may move next to the Typst engine code once `src-tauri/` exists. It does not teach embedding the Typst Rust library.
- [ ] Pick the exact bundled font families during the scaffold. Each must carry an open licence that allows bundling, cover Polish letters well, and suit STEM notes. The picks must include the Typst default text and math families, so a note that names no font matches the plain Typst tool. Where a Windows font shares a name with one of those defaults, the bundled family wins. Record the picks and their licences in the scaffold work.
- [ ] If Bun blocks Tauri or Svelte tooling in a way that costs real time, move the page tooling to `npm` and record the change in this spec. The rest of the stack does not depend on Bun, since Vite builds the page either way.
- [ ] If `tauri-specta` blocks the scaffold, move the shared types to hand written TypeScript types that mirror the Rust ones, or to `ts-rs`, and record the change in this spec. The commands are few, so this exit is cheap, and the rest of the stack does not depend on type generation.
- [ ] Run `/architect rendered page editor` before building the in place rendered editing beyond the scaffold preview. That spec must settle cursor movement, selection, and which source spans render, on top of the base fixed here.
- [ ] Signing, updates, and the public installer story belong to the public Windows release feature in your scope, not to this spec.

## Rationale

Reasoning and options: see [rationale.md](rationale.md).
