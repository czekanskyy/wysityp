# WYSITyp

WYSITyp is a Windows app for lecture notes. Every note stays a plain Typst file on your own disk.

This first scaffold proves one thin path. You open a folder, type Typst source, see the drawn page, and save the file back to the same folder.

## Run it while you build

```sh
bun install
bun run tauri dev
```

## Check it

```sh
bun run check
bun run test
cargo test --manifest-path src-tauri/Cargo.toml
```

## Shape of the code

Page code lives in `src/`. Rust code lives in `src-tauri/`. Rust does all file work and holds the Typst engine. The page never reads the disk by itself.

The fonts Typst itself ships are bundled through Typst Kit. They are Libertinus Serif, New Computer Modern, New Computer Modern Math, and Deja Vu Sans Mono. Each one ships under an open licence that allows it to travel with an app. Fonts on the machine come after the bundled set.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the development setup, commit
conventions, and the pull request process. The plan lives in
[docs/scope/scope.md](docs/scope/scope.md).

## Licence

MIT — see [LICENSE](LICENSE).
