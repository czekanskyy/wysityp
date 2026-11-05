# WYSITyp

WYSITyp (What You See Is Typst) is a Windows desktop app for lecture notes. You type on a page that renders as you type. Every note stays a plain Typst file on your own disk. The app is free under the MIT licence, works offline, and speaks Polish and English.

## Stack

The shell is Tauri 2. The page is Svelte 5 and TypeScript, built with Vite (not SvelteKit). Rust lives in one crate under `src-tauri/`: files, the Typst engine, settings, errors, and the commands the page calls. The page talks to Rust through Tauri commands. Shared types are generated with `tauri-specta` into `src/bindings.ts`.

Page packages are installed with Bun. `bun.lock` is committed. Rust versions are pinned in `src-tauri/Cargo.lock`.

Settings are one JSON file in the app config folder, written by Rust. The chosen language is the `locale` field in that file (Polish by default).

## Layout

- `src/` is the page (Svelte, TypeScript, plain CSS).
- `src-tauri/` is the Rust crate.
- `messages/pl.json` and `messages/en.json` hold every app string. Paraglide checks both at build time and writes `src/paraglide/`.
- `docs/scope/` is the feature list. `docs/specs/` holds decisions. Stack and architecture is spec 0001.
- `CONTRIBUTING.md` is the source for how work is committed and reviewed.

## Commands

```sh
bun install
bun run tauri dev
bun run check
bun run lint
bun run format
bun run format:check
bun run test
bun run build
cargo test --manifest-path src-tauri/Cargo.toml
bun run rust:fmt
bun run rust:fmt:check
bun run rust:clippy
bun run rust:test
```

`bun run messages` compiles Paraglide into `src/paraglide/` (that directory is gitignored). `check` runs that compile, then `svelte-check`, because the checker reads the generated files and does not start Vite. `test` is Vitest (`src/**/*.test.ts`). `build` is the Vite page build. `lint` is ESLint (flat config) with `typescript-eslint` and `eslint-plugin-svelte`. `format` writes with Prettier and `prettier-plugin-svelte`. `format:check` only reports drift. Prettier keeps each file's existing line endings (`endOfLine: "auto"`), so a Windows checkout is not rewritten from CRLF to LF.

Rust is not formatted or linted by those page tools. `bun run rust:fmt` applies `cargo fmt --manifest-path src-tauri/Cargo.toml`. `bun run rust:fmt:check` is that command plus `-- --check`. `bun run rust:clippy` is `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`. `bun run rust:test` is `cargo test --manifest-path src-tauri/Cargo.toml`. Install the `rustfmt` and `clippy` components before those Rust checks (`rustup component add rustfmt clippy`). GitHub Actions runs the page checks and these Rust checks on `windows-latest` (`.github/workflows/ci.yml`).

`src/paraglide/`, `src/bindings.ts`, `dist/`, and `node_modules/` are generated or installed. Do not hand edit them, and do not lint or reformat them. Prettier also skips `docs/` and Markdown, so scope and spec files stay hand formatted.

## Invariants

These come from spec 0001 and the scaffold. Later features keep them.

- Typst source is the truth. The note on disk is a plain Typst file. Rendering never changes that source.
- The page never touches disk. All file work is checked in Rust against the stored root (the folder the student opened). The page does not send that root.
- The app language lives only in the settings JSON, under `locale`. Do not store it anywhere else.
- Every app string exists in both `messages/pl.json` and `messages/en.json`.
- Do not hand edit `src/bindings.ts` or `src/paraglide/`.
- No tracking. The app is offline first. The only network use in this stack is fetching a Typst package the first time a note imports it, and only while online.

## Commits

Follow `CONTRIBUTING.md`. Commits use Conventional Commits: `<type>(<optional scope>): <short summary in the imperative mood>`. Types include `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `build`, and `ci`. Branch prefixes there are `feat/`, `fix/`, `docs/`, `refactor/`, `test/`, and `chore/`. One logical change per commit. The summary is English, imperative, with no full stop. Do not commit generated output, secrets, or `.env` files.
