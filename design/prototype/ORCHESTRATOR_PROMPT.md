## Goal

Turn the approved WYSITyp design into the working app. The design is a static HTML prototype in `design/prototype/`; `design/prototype/HANDOFF.md` describes everything it shows, the design decisions, and the features that are new. Ship it as a series of reviewed feature branches in the real Tauri 2 + Svelte 5 + Rust app, each one matching the prototype visually and keeping every project invariant.

## Context

- Read first, in this order: `AGENTS.md`, `CONTRIBUTING.md`, `design/prototype/HANDOFF.md` (whole file), `docs/scope/scope.md`, then the specs in `docs/specs/` that HANDOFF section 13 points to (0002, 0004, 0005, 0006, 0007, 0009 at least).
- HANDOFF.md is the source of truth for the look and the feature list. Its sections you will use most: 5 (fixed and float UI styles, pins, autohide), 10 (settings modal), 11 (AI assistant), 12 (settings keys), 13 (what is new against the scope and which skill each item needs), 14 (invariants the design touches), 15 (prototype-only things not to build), 17 (shortcuts, with a known `Ctrl+,` clash), 18 (build order).
- The prototype must be on the branch you start from. If `design/prototype/HANDOFF.md` is missing, stop and ask; it was written on `docs/design-prototype`.
- Run the prototype for side-by-side comparison by serving `design/prototype/` as a static folder (a `prototype` entry in `.claude/launch.json` serves it on port 5199; check it exists). Reset its state through the palette command "Przywróć prototyp do stanu początkowego".
- The repo has project skills that own the workflow: `/scope` (enrolls features, owns `docs/scope/`), `/architect` (writes specs in `docs/specs/`), `/develop` (builds from a spec), `/check verify` and `/check review` (write to `docs/reviews/`), `/test`, `/sync`. Use them rather than doing their job by hand.
- The app already has components under `src/lib/` (for example `ui/Sidebar.svelte`, `shell/TabStrip.svelte`, `shell/EditorToolbar.svelte`, `ui/CommandPalette.svelte`, `ui/AppearanceDialog.svelte`) and settings in `src-tauri/src/settings.rs`. Restyle and extend them; do not build a parallel set.
- If the Bash tool fails on this Windows machine with a profile syntax error, use PowerShell instead.

## Scope and constraints

- In scope: every item in HANDOFF section 13, in the order of section 18, except the AI assistant (see below).
- Out of scope: everything in HANDOFF section 15 (the "Prototyp" menu and simulations, `localStorage`, the fake renderer in `typst.js`, simulated file dialogs, canned AI replies, sample notes).
- Copy the look, not the prototype's code. Port CSS and markup structure into Svelte components; no global state object, no `innerHTML` rendering.
- Per slice: if HANDOFF section 13 says the item is new or deferred, run `/scope` to enroll it (you are allowed to move items out of the Deferred list that this design covers), then `/architect` to write its spec, then `/develop`, `/test`, `/check verify`, `/check review`, and `/sync` at the end. Restyles of features that already have specs go straight to `/develop`, but record any visual change that contradicts the spec.
- Invariants (from `AGENTS.md`, keep them even where the prototype seems not to):
  - Every app string goes in both `messages/pl.json` and `messages/en.json`. The prototype's Polish text is the approved Polish copy; write a matching English twin.
  - Every setting lives in the one settings JSON, read and written by Rust, with the existing rule that a missing or illegal value stays on disk and reads as the default.
  - The page never touches disk; Rust checks every path.
  - `system` theme leaves `data-theme` off `html`. PDF export never reads `page_color`.
  - Never hand-edit `src/bindings.ts` or `src/paraglide/`.
- **AI assistant: stop before it.** It adds network use beyond Typst packages, which breaks the offline-first invariant in `AGENTS.md`, and stores an API key in the Windows Credential Manager. Do not write its spec, change `AGENTS.md`, or build it until the user approves in chat. When you reach it, ask with a short summary of what the spec would decide (network from Rust only, key storage, providers, streaming, chats in memory only).
- Resolve the `Ctrl+,` clash (Settings vs Subscript) in the relevant spec; Settings keeps `Ctrl+,`.
- Git: one branch per slice with a `feat/` prefix (or the prefix `CONTRIBUTING.md` gives for the change type), Conventional Commits, one logical change per commit, no generated output. Do not push, open pull requests, or merge into `main` without the user's approval; leave each finished branch for them.
- Stop and ask the user whenever a decision is theirs: anything that changes an invariant, drops or adds a feature beyond HANDOFF, or chooses between visibly different designs the prototype does not settle.

## Done criteria and verification

For each slice, before calling it done:
- `bun run check`, `bun run lint`, `bun run format:check`, `bun run test`, `bun run build`, `bun run rust:fmt:check`, `bun run rust:clippy`, `bun run rust:test` all pass.
- `/check verify` passes against the slice's spec, and `/check review` has no open blocking findings.
- A visual comparison with the prototype at 1440 × 900 in light and dark theme, and in both fixed and float UI styles once the float slice exists, shows no differences beyond those the spec records. Also check the narrow breakpoints from HANDOFF section 5 (760 px, and 1000 px for the AI panel).
- Both message files contain every new string.
- The scope file reflects the slice's state.

## Autonomy and reporting

Work through the slices without asking, except at the stop points above. When something is ambiguous and not the user's call, pick the default closest to the prototype and HANDOFF, note it in the spec, and continue. After each slice, report in a few lines: the branch name, what was built, what was verified and how, assumptions made, and anything left undone. At the end, give the list of branches ready for review and the decisions waiting for the user.
