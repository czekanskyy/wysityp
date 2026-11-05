# Contributing to WYSITyp

WYSITyp is a Windows app for lecture notes: you type on a rendered page, and
every note stays a plain Typst file on your own disk. It is free and open
source under the MIT licence, works fully offline, and speaks Polish and
English.

This document is the single source of truth for how work is committed and
reviewed. If this file and a pull request disagree, this file wins — or the
pull request should update this file.

## Before you start

- Read [the scope](docs/scope/scope.md). It lists what is planned, in what
  order, and what is deliberately deferred. Work should map to a feature
  there, or the PR should explain why it does not.
- For a feature marked **needs a decision** in the scope, a spec in
  `docs/specs/` comes first. Do not build it on guesses.
- Keep changes small. One feature or one fix per pull request.

## Development setup

You need [Bun](https://bun.sh), [Rust](https://rustup.rs), and the Tauri
prerequisites for Windows (Visual Studio Build Tools with the C++ workload
and WebView2) — see the
[Tauri prerequisites](https://v2.tauri.app/start/prerequisites/).

```sh
bun install
bun run tauri dev
```

## Checks

Run all of these before opening a pull request. CI and reviewers will ask
for them.

```sh
bun run check                                     # svelte-check / TypeScript
bun run test                                      # vitest
cargo test --manifest-path src-tauri/Cargo.toml   # Rust
```

## Branches

Branch off `main` and name the branch by the kind of work:

| Prefix      | For                                       |
| ----------- | ----------------------------------------- |
| `feat/`     | A new feature, e.g. `feat/pdf-export`     |
| `fix/`      | A bug fix, e.g. `fix/save-on-crash`       |
| `docs/`     | Documentation only, e.g. `docs/readme-pl` |
| `refactor/` | Behaviour-preserving restructuring        |
| `test/`     | Tests only                                |
| `chore/`    | Tooling, dependencies, housekeeping       |

Keep branch names short, lowercase, and hyphenated.

## Commits

Commits follow [Conventional Commits](https://www.conventionalcommits.org):

```
<type>(<optional scope>): <short summary in the imperative mood>
```

Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `build`, `ci`.

Examples:

```
feat(editor): render headings in place
fix(files): do not overwrite a note changed on disk
docs: add Polish README section
test(render): cover broken math source
```

Rules:

- One logical change per commit; a commit should build and pass checks.
- Write the summary in English, imperative mood, no full stop, under ~72
  characters. Code and commit messages are English; the app itself is
  Polish and English.
- Use the commit body to explain *why*, not *what* — the diff shows what.
- Reference issues and scope features where relevant, e.g. `Refs #12` or
  `Scope: 12. PDF export`.
- Never commit generated output (`dist/`, `src-tauri/target/`,
  `src/paraglide/`, `project.inlang/cache/`), secrets, or `.env` files.
  They are gitignored — if one shows up in `git status`, stop and fix
  `.gitignore` first.

## Pull requests

1. Open the PR against `main`. Fill in the pull request template — do not
   delete sections, write "n/a" if one truly does not apply.
2. Link the issue or scope feature the PR serves.
3. Keep the PR small enough to review in one sitting. If it is growing,
   split it.
4. All checks (`bun run check`, `bun run test`, `cargo test`) must pass.
   Note the results in the template.
5. At least one review approval is required before merging. Reviewers
   check: does it do what the linked feature's "Done when" says, does it
   keep the promise that notes stay plain Typst files on disk, and are
   Polish and English strings both present for new UI text?
6. Merge with **squash and merge**. The squashed commit message follows
   the commit rules above. Delete the branch after merging.

Notes are the user's files, never the app's: any change to how files are
read, written, moved, or deleted deserves extra care in review, and the PR
description must say what happens to existing notes on disk.

## Reporting bugs and suggesting features

Use the GitHub issue templates. For bugs, include what you did, what you
expected, what happened, and — if Typst rendering is involved — the
smallest Typst source that reproduces it.
