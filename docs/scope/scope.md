# Scope: WYSITyp

WYSITyp (What You See Is Typst) is a Windows app where Polish university STEM students take lecture notes on a page that renders as they type, while every note stays a plain Typst file on their own disk. It is free and public under the MIT licence, works fully offline with no account, and speaks Polish and English from the start.

**Build approach:** Skateboard (the thinnest usable whole first, then grow it piece by piece).
**Workflow:** Beta (after `/develop`, run `/check verify`, then `/test`). This is the project default level of care. `/architect` is the recommended first stop for a feature with a real decision, but you may skip it when you already know the build. Any feature can carry its own tag to do more or less.

_These are recommendations to keep your build orderly, not requirements. Skip anything that does not fit: if you already know how to build a feature, use `/develop` and skip `/architect`. You decide when a feature is `done`._

## At a glance

| # | Feature | Phase | Status |
|---|---------|-------|--------|
| 1 | Stack and architecture | Foundation | in-progress |
| 2 | Coding standards and tooling | Foundation | in-progress |
| 3 | Data model | Foundation | planned |
| 4 | Design system and UI foundation | Foundation | in-progress |
| 5 | Workspace and note files | Release 1 | in-progress |
| 6 | Rendered page editor | Release 1 | in-progress |
| 7 | Math editing | Release 1 | planned |
| 8 | Tables, code, images and links | Release 1 | planned |
| 9 | Source view and file safety | Release 1 | in-progress |
| 10 | Search, recent notes and templates | Release 1 | in-progress |
| 11 | Spell checking in Polish and English | Release 1 | planned |
| 12 | PDF export | Release 1 | in-progress |
| 18 | App shell and start surface | Release 1 | done |
| 19 | Theme and page colour | Release 1 | in-progress |
| 20 | Working editor chrome | Release 1 | planned |
| 21 | Command palette and shortcut sheet | Release 1 | planned |
| 22 | Search screen | Release 1 | planned |
| 13 | Smart suggestions for Typst and math | Release 2 | planned |
| 14 | Visual geometry and diagrams | Release 3 | planned |
| 15 | Markdown import | Release 4 | planned |
| 16 | LaTeX import | Release 4 | planned |
| 17 | Public Windows release | Release 5 | planned |

## Foundations

### 1. Stack and architecture
Decide how the native Windows app is built, including the Rust and Tauri question you raised, how Typst is rendered and compiled inside the app, and how choices stay friendly to Mac and Linux versions later without building them now.
**Done when:** the stack is recorded in a spec, the empty scaffold builds and opens a window on Windows, and the choice of editing and rendering path is written down plainly enough for every later feature to follow.
**Spec:** [0001. Stack and architecture](../specs/0001-stack-architecture/index.md)
**Code:** `src/` and `src-tauri/`
- [x] Decide the stack (spec): `/architect stack and architecture`
- [x] Scaffold from the decision: `/develop stack and architecture`
- [x] Smoke check it runs: `/test stack and architecture`

### 2. Coding standards and tooling
Capture how code in this project is written and checked, then set up the tools that enforce it, so later work stays consistent for one person building in spare time.
**Done when:** the root `AGENTS.md` reflects the real scaffolded project, and lint, format and checks run clean.
**Code:** `AGENTS.md`, `package.json`, `.github/workflows/ci.yml`
- [x] Capture conventions and tooling choices: `/audit`
- [x] Install the tooling: `/develop tooling`
- [x] Check it runs clean: `/test tooling`

### 3. Data model · needs a decision
Decide where things live on disk: the folder a student picks, notes as plain Typst files inside it, images that belong to a note, templates, app settings, and any index the app keeps to search fast, all in a shape other tools can still read.
**Done when:** a student can point the app at a folder of Typst files they already own and nothing needs converting, images and templates have one clear home, and the app can rebuild any index it keeps from the files alone.
- [ ] Design it (spec): `/architect data model`

### 4. Design system and UI foundation
Bring Papier, the visual language in `design/claude-design`, into the app as tokens, spacing, focus, and the shared components. Font families stay as the app has them today. The export is the locked look for colour, space, and components. You may fix small gaps where the export falls short or disagrees with itself. Record each fix in the spec. Do not reopen colour or spacing for a new design.
**Done when:** light and dark tokens, spacing, and the shared components match the export. Font families stay as they are today. Focus and keyboard work, Polish labels fit, and the app respects the system setting for less motion. The spec lists every small fix.
**Spec:** [0004. Design system and UI foundation](../specs/0004-design-system-ui-foundation/index.md)
**Code:** `src/styles/`, `src/lib/ui/`
- [x] Design it (spec): `/architect design system and UI foundation`
- [x] Build it: `/develop design system and UI foundation`
  - [x] Tokens on the open window, covers AC-1, AC-2, AC-3, AC-4, AC-6
  - [x] Icons and the small controls, covers AC-5, AC-6, AC-7
  - [x] Note page and cover, covers AC-3, AC-5, AC-7
  - [x] Sidebar, toolbar, and command palette components, not mounted on the live screens, covers AC-5
- [ ] Verify it: `/check verify design system and UI foundation`
- [ ] Test it: `/test design system and UI foundation`

## Release 1: The thinnest usable whole

One folder of notes, a page you type on that renders in place, full math, spell checking in Polish and English, and a PDF at the end. A student could take this into a real lecture.

Features 18 to 22 put the Papier look on the parts of this release the app already does. Screens that belong to later work stay with those features.

### 5. Workspace and note files
Open a folder on disk, show its folders and notes as a tree, and let students create, rename, move and delete notes and folders, open notes they already have, and switch the app language between Polish and English in settings.
**Done when:** a student can open an existing folder of Typst files, organise it from inside the app, and see the same truth in any file tool afterwards, because the app only ever changed the files themselves.
**Code:** `src/App.svelte`, `src/lib/api.ts`, `src-tauri/src/files.rs`, `src-tauri/src/commands.rs`
- [x] Build it: `/develop workspace and note files`

### 6. Rendered page editor
The heart of WYSITyp: you type on a page that renders in place for text, headings, lists and quotes, typing shortcuts turn marks into structure as you go, and clicking any rendered part lets you edit its Typst source right there without the page losing your place or your cursor.
**Done when:** a student can write a full lecture note by typing on the rendered page, every edit lands correctly in the Typst file on disk, opening that file again shows the same page, and long notes stay responsive while typing.
**Spec:** [0002. Rendered page editor](../specs/0002-rendered-page-editor/index.md)
- [x] Design it (spec): `/architect rendered page editor`
- [ ] Build it: `/develop rendered page editor`
  - [ ] Rendered prose page (headings, lists, quotes, body, click, arrows, selection, undo), covers AC-1, AC-2, AC-3, AC-6, AC-7
  - [ ] Errors, a steady caret, and a print preview that does not take focus, covers AC-4, AC-8, AC-10, AC-11
  - [ ] Math placeholders you can click through, covers AC-5, AC-6
  - [ ] Structure keys and the long note check, covers AC-9, AC-8
  - [ ] Editable fonts (source and rendered, shipped with the app), covers AC-12
- [ ] Verify it: `/check verify rendered page editor`
- [ ] Test it: `/test rendered page editor`

### 7. Math editing · needs a decision
Full math support that feels quick in a lecture: insert math inline or as its own block, type it with helpful symbol entry, see it render as you go, and click rendered math to change its source.
**Done when:** a student can write equations, fractions, sums, integrals and aligned working at typing speed, spot a broken formula from a clear error rather than a blank space, and fix it in place.
- [ ] Design it (spec): `/architect math editing`

### 8. Tables, code, images and links
Grow the page beyond prose and math with tables you can edit on the page, code blocks with clear structure, images you paste or drop into a note, and links that open where they promise.
**Done when:** a student can paste a slide screenshot into a note and find the image file beside the note on disk, build a small table without touching source, and include a readable code block in the same note.
- [ ] Build it: `/develop tables, code, images and links`

### 9. Source view and file safety
Let students switch the whole note between the rendered page and its Typst source with both views always in step, save work as they type, recover gracefully after a crash, and stay safe when another tool changes the same file.
**Done when:** switching views never loses a character or a cursor place, killing the app mid sentence loses nothing already typed, and a change made in another tool is surfaced to the student rather than silently overwritten.
**Code:** `src/App.svelte`, `src/lib/editor.ts`, `src/lib/noteSafety.ts`, `src/lib/api.ts`, `src-tauri/src/files.rs`, `src-tauri/src/commands.rs`
Closing the window writes typing still inside the autosave pause first. Killing the process can still lose typing from that pause (under a second). That window is accepted for now and stays visible here until a recovery copy exists.
- [x] Build it: `/develop source view and file safety`

### 10. Search, recent notes and templates
Help students find and start notes fast: search across the text of every note in the folder, a list of notes opened recently, and ready made templates for lectures, problem sets and lab notes that create a new Typst file in the folder.
**Done when:** a student can find an old proof by a word inside it during exam week, jump back to yesterday's lecture in two clicks, and start today's lecture from a template that already has the right shape.
**Spec:** [0003. Recent notes and templates](../specs/0003-recent-notes-and-templates.md) (assumed decision, spec 0003)
**Code:** `src/App.svelte`, `src/lib/api.ts`, `src-tauri/src/commands.rs`, `src-tauri/src/files.rs`, `src-tauri/src/settings.rs`, `src-tauri/src/templates.rs`
- [x] Build it: `/develop search, recent notes and templates`
  - [x] One recent list per folder (spec 0003 build plan), covers AC-1, AC-2, AC-3, AC-4, AC-8, AC-10
- [x] Verify it: `/check verify search, recent notes and templates`
- [x] Test it: `/test search, recent notes and templates`

### 11. Spell checking in Polish and English · needs a decision
Check spelling as students type, in Polish and in English, underline mistakes on the rendered page, offer corrections, respect math and Typst commands, and let students teach the checker words from their own subjects.
**Done when:** a Polish paragraph and an English paragraph in one note are each checked in their own language, symbols and commands are never flagged, and a word a student adds stays accepted across notes.
- [ ] Design it (spec): `/architect spell checking in Polish and English`

### 12. PDF export
Turn the open note into a PDF through Typst itself, with page settings a student can choose, and when Typst reports an error, point back to the place in the note that caused it.
**Done when:** a finished note exports to a PDF that matches the rendered page, export settings are remembered per note or per student, and a Typst error tells the student where to look instead of failing in silence.
**Code:** `src/App.svelte`, `src/lib/api.ts`, `src-tauri/src/commands.rs`, `src-tauri/src/files.rs`, `src-tauri/src/typst_engine.rs`
- [x] Build it: `/develop PDF export`

### 18. App shell and start surface · done
Put the Papier shell on the app you already have: the sidebar, the folder tree, a new note, save state, language, and the start surface with templates and recent notes.
**Done when:** a student can open a folder, start from a template or a recent note, and organise notes in a shell that matches the export, in Polish and English, in light and dark. Recent notes show only what the app already remembers. Subject tags and preview paragraphs wait.
**Spec:** [0005. App shell and start surface](../specs/0005-app-shell-start-surface/index.md)
**Code:** `src/App.svelte`, `src/lib/ui/Sidebar.svelte`, `src/lib/greeting.ts`, `src/lib/api.ts`, `src-tauri/src/commands.rs`, `src-tauri/src/templates.rs`, `src-tauri/src/settings.rs`
- [x] Design it (spec): `/architect app shell and start surface`
- [x] Build it: `/develop app shell and start surface`
  - [x] Shell, start surface, and the actions you already have, covers AC-1, AC-2, AC-3, AC-4, AC-5, AC-10, AC-11, AC-12, AC-13, AC-16, AC-17, AC-18, AC-20, AC-21
  - [x] Blank notes, the place, and organising, covers AC-6, AC-7, AC-8, AC-18, AC-21
  - [x] Greeting, date, and the spoken name, covers AC-14, AC-15, AC-19
  - [x] Folder counts, covers AC-9
- [x] Verify it: `/check verify app shell and start surface` (skipped)
- [x] Test it: `/test app shell and start surface` (skipped)

### 19. Theme and page colour
Let the student set the interface theme and the note page colour apart from each other, as the export draws. The page uses the page colour tokens only. A PDF export stays a white page. Font choices stay with the rendered page editor.
**Done when:** a student can choose light, dark, or follow Windows, and a page colour of white, beige, graphite, or OLED black, without one forcing the other. Typing is not animated. Export to PDF is still a white page.
**Spec:** [0004. Design system and UI foundation](../specs/0004-design-system-ui-foundation/index.md)
**Code:** `src/lib/appearance.ts`, `src/lib/ui/AppearanceDialog.svelte`, `src/App.svelte`, `src/main.ts`, `src-tauri/src/settings.rs`, `src-tauri/src/commands.rs`
- [x] Design it (spec): `/architect theme and page colour`
- [x] Build it: `/develop theme and page colour`
  - [x] Settings keys, the two commands, and applying them when the app opens, covers AC-8, AC-9, AC-11
  - [x] Appearance dialog and the two controls, covers AC-10
  - [x] A refused write, the status line, and a PDF that stays white, covers AC-11, AC-12
- [x] Verify it: `/check verify theme and page colour`
- [x] Test it: `/test theme and page colour`

### 20. Working editor chrome · needs a decision
Dress the views the app already has: the rendered page, the source, and the side by side view, plus Typst warnings and the save conflict path. Leave out toolbar controls for work the app cannot do yet.
**Done when:** a student can switch those views, read a warning, and resolve a save conflict in the new chrome, in both languages and both themes, and no control promises an action that does not exist yet.
- [ ] Design it (spec): `/architect working editor chrome`

### 21. Command palette and shortcut sheet · needs a decision
Reach the actions the app already has from the keyboard, through a command palette and a shortcut sheet. The export names two different palette shortcuts. The spec picks one, and both surfaces list only real actions.
**Done when:** a student can open the palette, run an existing action, and open a sheet that shows the same shortcuts, in Polish and English.
- [ ] Design it (spec): `/architect command palette and shortcut sheet`

### 22. Search screen · needs a decision
Restyle search to match the export. Search still finds text inside notes, with the path, line, and snippet it already returns. Replace, and a separate search of folder names or file names, wait.
**Done when:** a student can search note text and open a hit from a screen that matches the export, in both languages and both themes, and replace is not offered.
- [ ] Design it (spec): `/architect search screen`

## Release 2: Faster typing

### 13. Smart suggestions for Typst and math · needs a decision
As a student types, offer Typst functions, math symbols, ready made pieces of content, and pointers to headings, labels and figures in their own notes, ranked so the likely thing comes first and the list never gets in the way of fast typing.
**Done when:** a student can complete a command or symbol without leaving the keyboard, insert a reference to an earlier figure from the same folder of notes, and dismiss suggestions instantly when they just want to write.
- [ ] Design it (spec): `/architect smart suggestions for Typst and math`

## Release 3: Figures

### 14. Visual geometry and diagrams · needs a decision
Build diagrams on the page with shapes, lines, angles, labels, grids and function plots, while the app writes the Typst drawing code for the figure, so the result stays editable as plain Typst forever.
**Done when:** a student can draw a labelled triangle or a plotted function without writing drawing code by hand, reopen the note and adjust the figure on the page, and read the figure as ordinary Typst in source view.
- [ ] Design it (spec): `/architect visual geometry and diagrams`

## Release 4: Bringing work in

### 15. Markdown import · needs a decision
Bring Markdown notes into a folder as Typst files, keeping headings, lists, links, images and math as faithful as the design finds honestly possible, and telling the student plainly about anything that could not come across.
**Done when:** a student can point the app at Markdown notes and keep studying from the Typst results, with a short list of anything that changed meaning or was left behind.
- [ ] Design it (spec): `/architect Markdown import`

### 16. LaTeX import · needs a decision
Bring LaTeX notes into a folder as Typst files, with the same promise as Markdown import and extra care for math, where LaTeX and Typst differ most.
**Done when:** a student can bring a LaTeX problem set across and trust its equations, with a short list of anything that changed meaning or was left behind.
- [ ] Design it (spec): `/architect LaTeX import`

## Release 5: Into students hands

### 17. Public Windows release · needs a decision
Package WYSITyp so other students can install it on Windows with no fuss, learn it from help written in Polish and English, and update it safely, while the app keeps its promises of no account, no tracking and notes that stay plain files.
**Done when:** a student who has never seen the project can install it from a public release under the MIT licence, take a first lecture note from the help alone, and update later without risking a single note.
- [ ] Design it (spec): `/architect public Windows release`

## Deferred

Kept on purpose, so the plan stays honest about what waits.

- **Mac and Linux versions**: Windows comes first, and foundation choices stay friendly to them.
- **Cloud sync and accounts**: students sync their folder with tools they already trust.
- **Live work together on one note**: group study help that waits until the offline core is loved.
- **AI drafting, explaining and rewriting**: the suggestions in Release 2 complete what you type; writing for you is a later question.
- **Living geometry in the style of GeoGebra**: Release 3 draws figures; dragging points with live constraints is a bigger promise for later.
- **Free drawing with a pen**: quick ink waits behind precise diagrams.
- **Help with sentences beyond spelling**: grammar and style help in Polish and English waits behind spell checking.
- **Files of any kind stored inside a note**: images belong in Release 1; general attachments wait.
- **Full toolbar controls from the export**: styles, marks, lists, math, code, links, tables, images, and colours. They wait with the editor, math, and tables features, so the toolbar never offers a dead control.
- **Subject tags and preview paragraphs** on the start screen.
- **Search replace, and search by folder name or file name**, drawn on the search screen.
- **Symbol picker, table grid, and shapes**: they wait with math editing, tables, and visual geometry.
- **Longer settings screens**: backups, packages, shortcut editing, privacy, and about. Language stays where it is. Theme and page colour belong to feature 19.
- **Saved greeting name** (from spec 0005): one word the student can set. The shell already reads `display_name`. The editor waits, and it does not block the shell.

## Legend

- **Next step** is always the first unticked box in a feature. Boxes you choose to skip should be marked as skipped rather than deleted, so the plan stays honest.
- **needs a decision** means you run `/architect` first for that feature. Once its spec exists, the tag drops and the feature gains its build, verify and test boxes from the spec.
- **Status** moves from `planned` to `in-progress` to `done` as you work. You decide when a feature is `done`; at the Beta workflow default, after `/test` is the suggested moment.
- **Phase** shows the release a feature belongs to. Every release leaves you with a whole app a student could use, just a more useful one each time.
- A **spec pointer** line appears under a feature once `/architect` has written its spec, and a **code pointer** once `/develop` has built it. Neither is guessed in advance.
