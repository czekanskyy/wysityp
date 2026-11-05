# Rationale for 0001. Stack and architecture

## Context

> ⚠️ Premise note: The rendered page editor is a hard decision of its own, covering cursor movement, selection, and which parts of a note render in place of their source. This spec does not settle those rules. It fixes the floor under them, source as truth on a CodeMirror base with the Typst Rust engine behind it, and leaves the editor rules to the rendered page editor spec in your scope. Building the editor before that spec exists would put the most fragile work on unexamined ground.

WYSITyp is a Windows app where Polish university STEM students take lecture notes on a page that renders as they type, while every note stays a plain Typst file on their own disk. It is free and public under the MIT licence, works fully offline with no account, and speaks Polish and English from the start. There is no code yet. Every later feature, the workspace, the editor, math, spell checking, PDF export, stands on this choice, so a wrong call here is paid for many times over.

The forces that shaped the choice are plain. You build alone in spare time, and you picked a low learning load, so the stack must be learnable in pieces and rich in guidance you can search for. You ranked typing and rendering feel first, above download size and above ease of building, so the editor base and the compile loop matter more than installer weight. You had no firm pull toward Rust and Tauri, so the stack had to win on what serves the product, not on loyalty to a tool. Notes must stay plain Typst files that other tools can read, which rules out any design where a private document model becomes the truth and Typst becomes an export format. Windows comes first, and Mac and Linux must stay possible without being built now.

Not deciding would block everything. Your scope names this as the first foundation feature, and the scaffold, the coding standards work, and the data model all wait on it.

## Options considered

### Option 1: Tauri with Svelte and the Typst Rust library

A Tauri 2 shell holds a Svelte and TypeScript page and a thin Rust part. The page edits Typst source in CodeMirror 6. Rust keeps a Typst world for the open note, compiles the whole note with the Typst Rust library shortly after typing pauses, and returns SVG pages and structured errors. The same engine will export PDF (basis: Typst crate docs, which list PDF, SVG, PNG, and HTML output from one compile).

**Pros**:

- On Windows the page runs in WebView2, which is Chromium based, so the typing feel you ranked first is on the same engine family as the main rival, while the download stays small (basis: Tauri docs on using the system web view).
- The Typst engine is the real Typst, in process, compiling in memory. There is no file round trip per render, and page and PDF share one engine.
- Any Typst file opens as written, because source stays the truth. The plain files promise survives contact with files made by other tools.

**Cons**:

- Some Rust must be learned. There is no path in this option where Rust stays out.
- CodeMirror renders source text, so a page you type on must be built on top of it with care in the editor feature.
- The web view differs by operating system, so later Mac and Linux versions need their own rendering tests.

### Option 2: Electron with TypeScript throughout and Typst in the page

An Electron shell with TypeScript on both sides. The page edits source in CodeMirror, and Typst runs inside the page through WebAssembly using typst.ts, or the app ships the Typst command line tool and calls it.

**Pros**:

- The gentlest learning path of all. One language, the most guidance to search for, and the same Chromium on every system.
- No Rust at all, which fits a wish to move fast in a known language.

**Cons**:

- Typst in WebAssembly puts font loading, included files, images, and package access in the page, where offline behaviour is hardest to keep honest, and long notes carry more risk (basis: typst.ts project docs, where font assets need explicit handling to avoid network fetches).
- Calling the Typst tool per keystroke means files and processes in the render loop, with weaker error detail.
- The download is well over 100 MB and memory use is higher, on the modest laptops students own.

### Option 3: A document tree editor with Typst as output

A Tauri or Electron shell where ProseMirror holds a document tree, the page edits the tree, and the app writes the tree out as Typst source.

**Pros**:

- The cleanest page feel of any option. Math, tables, and figures become proper tree nodes a student can click and change (basis: ProseMirror guide, which describes a custom document model under full control of your code).
- Structure is always valid, since the tree only allows what its schema allows.

**Cons**:

- Every Typst construct in a file a student already owns must map into the tree and back out without loss. Real Typst uses code, variables, and imports that a fixed tree will not hold, so files would break or lose meaning on open. This cuts the plain files promise at the root.
- It is by far the most code to build and keep correct, for a solo builder who picked a low learning load.

### Option 4: A Microsoft native shell with the editor in WebView2

A C sharp shell using WPF or WinUI, with CodeMirror inside WebView2 for the page, and Typst reached through its command line tool or a called library.

**Pros**:

- Strong Windows tooling and a fully native shell, with good access to Windows itself.
- C sharp is a comfortable language with deep guidance behind it.

**Cons**:

- A later Mac or Linux version becomes a near rewrite, which your scope asks this choice to keep open.
- The editor is still web tech inside a web view, so the hard editor work is unchanged, while the Typst path loses the in process Rust engine and its structured errors.

## Rationale

Option 1 wins on the forces you named, in the order you ranked them. Typing feel came first, and on Windows both leading shells put the page on a Chromium based engine, so that force did not separate them. The next force did. Rendering must be fast, correct for a whole note, offline, and able to point at the place in the source that caused an error. Only the Typst Rust library gives all of that in process, with the same engine left over for PDF export later. That single fact carries the shell choice with it, since the Rust library needs a Rust home, and Tauri is the shell that provides one while keeping the download small and later ports possible. You accepted learning some Rust in that trade, and this spec bounds the cost by keeping Rust thin, in one crate, with the page in TypeScript where most building time will go.

Source as truth beat the document tree on the product promise, not on editor feel. The tree would feel cleaner, and it would quietly break the promise that a folder of Typst files a student already owns opens with nothing converted and nothing lost. For a notes app whose whole pitch is that your files stay yours, that break is fatal, so CodeMirror on source is the base, and the editor feature will earn the rendered feel on top of it.

Two picks deserve a plain note. You chose Bun over the recommended `npm`, knowing it is younger and that most Tauri and Svelte guidance assumes `npm`. That is a fair trade for speed, and it is cheap to reverse, since Vite builds the page either way, so the spec records a clear exit rather than pretending the risk away. You also chose to let Typst packages behave exactly as Typst itself behaves, cache and first fetch included. That keeps student files portable between this app and the plain Typst tool, at the cost of one network moment when a note first imports a package the machine has never seen. Given that the app itself needs no account and no network, that cost sits in the right place, on a thing the students own source asked for.

The landscape check behind this reasoning ran during the conversation on 2026-11-05, covering desktop shells, ways to run Typst inside an app, and editor cores, with official docs first. Its findings are summarised here so the reasoning can be checked without fetching anything again.

**Landscape evidence**:

- Tauri 2 uses the web view already on the machine, WebView2 on Windows, WKWebView on Mac, and WebKitGTK on Linux, and a minimal app can be under 600 KB before your own code (basis: Tauri start and app size docs).
- Electron ships its own Chromium and Node with every app, so packaged apps run past 100 MB (basis: Electron packager docs and measured comparisons found in search).
- The Typst crate compiles source and exports PDF, SVG, PNG, and HTML, with a World trait the host app implements for files and fonts (basis: Typst crate docs on docs.rs).
- typst.ts brings Typst to JavaScript through WebAssembly and can render SVG in the page, with font assets that must be bundled on purpose to stay offline (basis: typst.ts project page).
- CodeMirror 6 is a text editor working from flat source, built as composable modules (basis: CodeMirror system guide). ProseMirror is a rich text toolkit working from a custom document tree (basis: ProseMirror guide).
- The Svelte team runs an official MCP server for Svelte docs and code checking (basis: Svelte AI docs).

## References

**Project sources** (verifiable, in this repo):

- `docs/scope/scope.md`, feature 1, Stack and architecture, including the done when line this spec must satisfy, the Rust and Tauri question recorded there, the Skateboard build approach, and the Beta workflow level
- Installed agent skills in `.agents/skills/`, named in the Decision of `index.md`, found through the skills registry search you approved during this run

**Practices & standards**:

- Monolith first. One app, one repo, modules before any split, since a solo builder gains nothing from parts that must be deployed or versioned apart
- Boring technology where it serves. Each pick favours the tool with the deeper guidance and the clearer failure behaviour, with Bun as the one knowing step away from that rule
- Files as the truth, indexes and caches as things that can be rebuilt. Nothing in this stack lets app state become the only copy of student work
- Prove the risky path thinly and early, which is the Skateboard approach your scope already names

**Links** (web verified only, sources plus links level):

- Tauri, What is Tauri: https://v2.tauri.app/start/
- Tauri, App Size: https://v2.tauri.app/concept/size/
- Typst crate docs: https://docs.rs/typst/latest/typst/
- Typst SVG export docs: https://docs.rs/typst-svg/latest/typst_svg/fn.svg.html
- typst.ts project: https://github.com/Myriad-Dreamin/typst.ts
- CodeMirror system guide: https://codemirror.net/docs/guide/
- ProseMirror guide: https://prosemirror.net/docs/guide/
- Svelte MCP overview: https://svelte.dev/docs/ai/mcp
- Tauri skill page, for the installed `tauri-v2` skill: https://skills.sh/nodnarbnitram/claude-code-extensions/tauri-v2
- Svelte code writer skill page, for the installed skill: https://skills.sh/sveltejs/ai-tools/svelte-code-writer
- Vitest skill page, for the installed skill: https://skills.sh/antfu/skills/vitest
