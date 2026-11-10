//! Which files the page may read or write.
//!
//! A path is allowed when it sits inside the opened folder, inside the
//! drafts folder, or on the in-memory allow list. The page never adds to
//! that list. Dialog picks, drafts this module creates, and paths Rust
//! stored in recents or the session are the only entries.

use std::collections::HashSet;
use std::path::{Path, PathBuf};

use serde::Serialize;
use specta::Type;

use crate::error::{AppError, AppResult};
use crate::files::{self, Note, NoteFingerprint};
use crate::templates;

/// A note the page may show. `path` is the key later commands must send
/// back: a workspace-relative path, or a canonical absolute path.
#[derive(Debug, Clone, Serialize, Type)]
pub struct PlacedNote {
    pub path: String,
    pub text: String,
    pub fingerprint: NoteFingerprint,
    pub draft: bool,
}

/// One file restored on launch. A template uses `path` as its file name.
#[derive(Debug, Clone, Serialize, Type)]
pub struct SessionFile {
    pub path: String,
    pub text: String,
    pub fingerprint: NoteFingerprint,
    pub draft: bool,
    pub template: bool,
}

#[derive(Debug, Clone, Serialize, Type)]
pub struct SessionRestore {
    pub files: Vec<SessionFile>,
    pub active: String,
}

/// Where a checked path lives, and the root Typst should compile against.
#[derive(Debug, Clone)]
pub struct ResolvedNote {
    /// Key the page keeps. Relative inside the open folder, otherwise canonical.
    pub key: String,
    /// Typst project root. The open folder, or the note's parent for a loose file.
    pub root: PathBuf,
    /// Path counted from `root`.
    pub relative: String,
    pub file: PathBuf,
    pub draft: bool,
    pub in_workspace: bool,
}

#[derive(Debug)]
pub struct AccessGate {
    workspace: Option<PathBuf>,
    drafts: PathBuf,
    allow: HashSet<String>,
}

impl AccessGate {
    pub fn new(drafts: PathBuf) -> Self {
        Self {
            workspace: None,
            drafts,
            allow: HashSet::new(),
        }
    }

    pub fn set_drafts(&mut self, drafts: PathBuf) {
        self.drafts = drafts;
    }

    pub fn drafts_dir(&self) -> &Path {
        &self.drafts
    }

    pub fn set_workspace(&mut self, root: Option<PathBuf>) {
        self.workspace = root;
    }

    pub fn workspace(&self) -> Option<&Path> {
        self.workspace.as_deref()
    }

    /// Remember a file the student picked, or one Rust itself stored.
    pub fn allow_file(&mut self, path: &Path) -> AppResult<String> {
        let file = canonical_file(path)?;
        if !is_typ_file(&file) {
            return Err(AppError::InvalidName(path.to_string_lossy().to_string()));
        }
        let key = files::canonical_key(&file)?;
        self.allow.insert(key.clone());
        Ok(key)
    }

    /// Trust paths Rust previously wrote. Missing files are skipped.
    pub fn seed_allowed(&mut self, paths: &[String]) {
        for path in paths {
            if path.starts_with("template:") {
                continue;
            }
            let _ = self.allow_file(Path::new(path));
        }
    }

    pub fn resolve(&self, path: &str) -> AppResult<ResolvedNote> {
        let trimmed = path.trim();
        if trimmed.is_empty() || trimmed.starts_with("template:") {
            return Err(AppError::NotAllowed(path.to_string()));
        }
        let as_path = Path::new(trimmed);
        if as_path.is_absolute() {
            return self.resolve_absolute(as_path);
        }
        let Some(root) = self.workspace.as_ref() else {
            return Err(AppError::NoWorkspace);
        };
        let file = files::resolve_inside_root(root, trimmed)?;
        let relative = files::display_relative(trimmed);
        Ok(ResolvedNote {
            key: relative.clone(),
            root: files::canonical_root(root)?,
            relative,
            file,
            draft: false,
            in_workspace: true,
        })
    }
}

impl AccessGate {
    fn resolve_absolute(&self, path: &Path) -> AppResult<ResolvedNote> {
        let file = canonical_file(path)?;
        if !is_typ_file(&file) && file.exists() && !file.is_file() {
            return Err(AppError::InvalidName(path.to_string_lossy().to_string()));
        }
        if file
            .extension()
            .is_none_or(|ext| !ext.eq_ignore_ascii_case("typ"))
        {
            return Err(AppError::InvalidName(file.to_string_lossy().to_string()));
        }
        let name = file
            .file_name()
            .map(|name| name.to_string_lossy().to_string())
            .unwrap_or_default();
        if files::is_reserved_device_name(&name) {
            return Err(AppError::InvalidName(name));
        }
        let key = files::canonical_key(&file)?;
        if let Some(root) = self.workspace.as_ref() {
            let root = files::canonical_root(root)?;
            if file.starts_with(&root) {
                let relative = file
                    .strip_prefix(&root)
                    .map_err(|_| AppError::OutsideRoot(key.clone()))?
                    .to_string_lossy()
                    .replace('\\', "/");
                return Ok(ResolvedNote {
                    key: relative.clone(),
                    root,
                    relative,
                    file,
                    draft: false,
                    in_workspace: true,
                });
            }
        }
        let drafts = files::canonical_root(&self.drafts).unwrap_or_else(|_| self.drafts.clone());
        let draft = file.starts_with(&drafts);
        if !draft && !self.allow.contains(&key) {
            return Err(AppError::NotAllowed(key));
        }
        let root = file
            .parent()
            .map(Path::to_path_buf)
            .filter(|parent| !parent.as_os_str().is_empty())
            .ok_or_else(|| AppError::NotAllowed(key.clone()))?;
        Ok(ResolvedNote {
            key,
            root,
            relative: name,
            file,
            draft,
            in_workspace: false,
        })
    }
}

pub fn placed_from_resolved(resolved: &ResolvedNote) -> AppResult<PlacedNote> {
    let note = files::read_note(&resolved.root, &resolved.relative)?;
    Ok(PlacedNote {
        path: resolved.key.clone(),
        text: note.text,
        fingerprint: note.fingerprint,
        draft: resolved.draft,
    })
}

pub fn note_from_placed(placed: &PlacedNote) -> Note {
    Note {
        path: placed.path.clone(),
        text: placed.text.clone(),
        fingerprint: placed.fingerprint.clone(),
    }
}

/// Create `untitled.typ`, then `untitled-2.typ`, through `untitled-100.typ`.
pub fn create_draft_file(drafts: &Path, locale: &str) -> AppResult<PlacedNote> {
    std::fs::create_dir_all(drafts).map_err(|err| AppError::io(drafts, err))?;
    let names = files::entry_names(drafts)?;
    let file_name = next_draft_name(&names).ok_or(AppError::Message(
        "draft-names-exhausted: every draft name is taken".to_string(),
    ))?;
    let path = drafts.join(&file_name);
    let text = templates::blank_heading(locale).to_string();
    files::write_atomically(&path, text.as_bytes())?;
    let file = canonical_file(&path)?;
    let key = files::canonical_key(&file)?;
    Ok(PlacedNote {
        path: key,
        fingerprint: files::fingerprint_of(text.as_bytes()),
        text,
        draft: true,
    })
}

fn next_draft_name(names: &[String]) -> Option<String> {
    for index in 0..100 {
        let name = if index == 0 {
            "untitled.typ".to_string()
        } else {
            format!("untitled-{}.typ", index + 1)
        };
        if !files::name_is_taken(names, &name, false) {
            return Some(name);
        }
    }
    None
}

/// Move a draft to the path the student picked. Bytes are not rewritten.
pub fn move_draft_file(from: &Path, dest: &Path) -> AppResult<PathBuf> {
    let from = canonical_file(from)?;
    if !from.is_file() {
        return Err(AppError::NotAllowed(from.to_string_lossy().to_string()));
    }
    let dest = ensure_typ(dest);
    if let Some(name) = dest.file_name().and_then(|name| name.to_str())
        && (files::is_reserved_device_name(name) || name.starts_with('.'))
    {
        return Err(AppError::InvalidName(name.to_string()));
    }
    if let Some(parent) = dest.parent() {
        std::fs::create_dir_all(parent).map_err(|err| AppError::io(parent, err))?;
    }
    if dest.exists() {
        let meta = std::fs::symlink_metadata(&dest).map_err(|err| AppError::io(&dest, err))?;
        if meta.file_type().is_symlink() || !meta.is_file() {
            return Err(AppError::AlreadyExists(dest.to_string_lossy().to_string()));
        }
        if canonical_file(&dest).ok().as_ref() != Some(&from) {
            std::fs::remove_file(&dest).map_err(|err| AppError::io(&dest, err))?;
        }
    }
    if canonical_file(&dest).ok().as_ref() == Some(&from) {
        return Ok(from);
    }
    let assets_move = kept_assets_move(&from, &dest);
    if let Some((assets, dest_assets)) = &assets_move
        && dest_assets.exists()
        && canonical_file(dest_assets).ok() != canonical_file(assets).ok()
    {
        return Err(AppError::AlreadyExists(
            dest_assets.to_string_lossy().to_string(),
        ));
    }
    match std::fs::rename(&from, &dest) {
        Ok(()) => {}
        Err(_) => {
            std::fs::copy(&from, &dest).map_err(|err| AppError::io(&dest, err))?;
            // The copy landed. A missing source means another save already
            // moved it; the destination still holds the note.
            match std::fs::remove_file(&from) {
                Ok(()) => {}
                Err(err) if err.kind() == std::io::ErrorKind::NotFound => {}
                Err(err) => return Err(AppError::io(&from, err)),
            }
        }
    }
    if let Some((assets, dest_assets)) = assets_move
        && assets.is_dir()
    {
        move_dir(&assets, &dest_assets)?;
    }
    canonical_file(&dest)
}

/// The assets folder keeps the draft's stem, so `#image("untitled.assets/…")`
/// still resolves after Save As renames the note.
fn kept_assets_move(from_note: &Path, dest_note: &Path) -> Option<(PathBuf, PathBuf)> {
    let stem = from_note.file_stem()?.to_str()?;
    let name = format!("{stem}.assets");
    Some((
        from_note.parent()?.join(&name),
        dest_note.parent()?.join(name),
    ))
}

fn move_dir(from: &Path, dest: &Path) -> AppResult<()> {
    if canonical_file(from).ok().as_ref() == canonical_file(dest).ok().as_ref() {
        return Ok(());
    }
    match std::fs::rename(from, dest) {
        Ok(()) => Ok(()),
        Err(_) => {
            copy_dir(from, dest)?;
            std::fs::remove_dir_all(from).map_err(|err| AppError::io(from, err))
        }
    }
}

fn copy_dir(from: &Path, dest: &Path) -> AppResult<()> {
    std::fs::create_dir_all(dest).map_err(|err| AppError::io(dest, err))?;
    for entry in std::fs::read_dir(from).map_err(|err| AppError::io(from, err))? {
        let entry = entry.map_err(|err| AppError::io(from, err))?;
        let target = dest.join(entry.file_name());
        let kind = entry
            .file_type()
            .map_err(|err| AppError::io(entry.path(), err))?;
        if kind.is_dir() {
            copy_dir(&entry.path(), &target)?;
        } else {
            std::fs::copy(entry.path(), &target).map_err(|err| AppError::io(&target, err))?;
        }
    }
    Ok(())
}

/// Delete a draft the student never wrote in. A note, a picked file, and a
/// path that was never allowed stay on disk.
pub fn discard_draft_file(gate: &AccessGate, path: &str) -> AppResult<()> {
    let resolved = gate.resolve(path)?;
    if !resolved.draft {
        return Err(AppError::NotAllowed(path.to_string()));
    }
    let meta = match std::fs::symlink_metadata(&resolved.file) {
        Ok(meta) => meta,
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => return Ok(()),
        Err(err) => return Err(AppError::io(&resolved.file, err)),
    };
    if meta.file_type().is_symlink() || !meta.is_file() {
        return Err(AppError::NotAllowed(resolved.key));
    }
    match std::fs::remove_file(&resolved.file) {
        Ok(()) => Ok(()),
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(err) => Err(AppError::io(&resolved.file, err)),
    }
}

pub fn list_draft_files(drafts: &Path) -> Vec<PathBuf> {
    let Ok(entries) = std::fs::read_dir(drafts) else {
        return Vec::new();
    };
    let mut files = Vec::new();
    for entry in entries.flatten() {
        let path = entry.path();
        if is_typ_file(&path) {
            files.push(path);
        }
    }
    files.sort();
    files
}

fn ensure_typ(path: &Path) -> PathBuf {
    match path.extension().and_then(|ext| ext.to_str()) {
        Some(ext) if ext.eq_ignore_ascii_case("typ") => path.to_path_buf(),
        _ => {
            let mut name = path
                .file_name()
                .map(|name| name.to_os_string())
                .unwrap_or_default();
            name.push(".typ");
            path.with_file_name(name)
        }
    }
}

fn is_typ_file(path: &Path) -> bool {
    path.is_file()
        && path
            .extension()
            .is_some_and(|ext| ext.eq_ignore_ascii_case("typ"))
}

fn canonical_file(path: &Path) -> AppResult<PathBuf> {
    if path.exists() {
        return files::canonical_root(path);
    }
    let name = path
        .file_name()
        .ok_or_else(|| AppError::InvalidName(path.to_string_lossy().to_string()))?;
    let parent = path
        .parent()
        .filter(|parent| parent.exists())
        .ok_or_else(|| AppError::NotAllowed(path.to_string_lossy().to_string()))?;
    Ok(files::canonical_root(parent)?.join(name))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn write_typ(dir: &Path, name: &str, text: &str) -> PathBuf {
        std::fs::create_dir_all(dir).unwrap();
        let path = dir.join(name);
        std::fs::write(&path, text).unwrap();
        path
    }

    #[test]
    fn refuses_a_path_that_was_never_picked() {
        let drafts = tempfile::tempdir().unwrap();
        let outside = tempfile::tempdir().unwrap();
        let secret = write_typ(outside.path(), "secret.typ", "= no\n");
        let gate = AccessGate::new(drafts.path().to_path_buf());
        let err = gate
            .resolve(&secret.to_string_lossy())
            .unwrap_err()
            .to_string();
        assert!(
            err.contains("not open for editing"),
            "refused path should say it is not open: {err}"
        );
        assert!(gate.resolve("../secret.typ").is_err());
    }

    #[test]
    fn allows_a_picked_file_a_draft_and_a_save_as_move() {
        let drafts = tempfile::tempdir().unwrap();
        let picked_dir = tempfile::tempdir().unwrap();
        let dest_dir = tempfile::tempdir().unwrap();
        let mut gate = AccessGate::new(drafts.path().to_path_buf());

        let placed = create_draft_file(drafts.path(), "en").unwrap();
        assert!(placed.draft);
        assert!(placed.text.starts_with("= Title"));
        let resolved = gate.resolve(&placed.path).unwrap();
        assert!(resolved.draft);
        assert_eq!(resolved.relative, "untitled.typ");
        assert_eq!(
            files::canonical_key(&resolved.root).unwrap(),
            files::canonical_key(drafts.path()).unwrap()
        );

        let picked = write_typ(picked_dir.path(), "lecture.typ", "= lecture\n");
        assert!(gate.resolve(&picked.to_string_lossy()).is_err());
        gate.allow_file(&picked).unwrap();
        let loose = gate.resolve(&picked.to_string_lossy()).unwrap();
        assert!(!loose.draft);
        assert!(!loose.in_workspace);
        assert_eq!(loose.relative, "lecture.typ");
        assert_eq!(
            files::canonical_key(&loose.root).unwrap(),
            files::canonical_key(picked_dir.path()).unwrap()
        );

        let dest = dest_dir.path().join("saved.typ");
        let moved = move_draft_file(&resolved.file, &dest).unwrap();
        assert!(!resolved.file.exists());
        assert_eq!(std::fs::read_to_string(&moved).unwrap(), "= Title\n");
        gate.allow_file(&moved).unwrap();
        let saved = gate.resolve(&moved.to_string_lossy()).unwrap();
        assert!(!saved.draft);
        assert_eq!(std::fs::read_to_string(&saved.file).unwrap(), "= Title\n");

        let never = write_typ(dest_dir.path(), "other.typ", "= no\n");
        assert!(gate.resolve(&never.to_string_lossy()).is_err());
    }

    #[test]
    fn a_draft_picture_moves_with_save_as_and_keeps_its_folder_name() {
        let drafts = tempfile::tempdir().unwrap();
        let dest_dir = tempfile::tempdir().unwrap();
        let mut gate = AccessGate::new(drafts.path().to_path_buf());
        let placed = create_draft_file(drafts.path(), "pl").unwrap();
        let resolved = gate.resolve(&placed.path).unwrap();
        let saved = files::save_note_image(
            &resolved.root,
            &resolved.relative,
            "slide.png",
            b"png-bytes",
        )
        .unwrap();
        assert_eq!(saved, "untitled.assets/slide.png");
        let dest = dest_dir.path().join("lecture.typ");
        let moved = move_draft_file(&resolved.file, &dest).unwrap();
        assert!(!drafts.path().join("untitled.assets").exists());
        assert_eq!(
            std::fs::read(dest_dir.path().join("untitled.assets").join("slide.png")).unwrap(),
            b"png-bytes"
        );
        gate.allow_file(&moved).unwrap();
        let saved_note = gate.resolve(&moved.to_string_lossy()).unwrap();
        let (bytes, mime) = files::read_note_image(
            &saved_note.root,
            &saved_note.relative,
            "untitled.assets/slide.png",
        )
        .unwrap();
        assert_eq!(bytes, b"png-bytes");
        assert_eq!(mime, "image/png");
    }

    #[test]
    fn an_open_folder_accepts_relative_paths_and_adopts_its_own_files() {
        let drafts = tempfile::tempdir().unwrap();
        let folder = tempfile::tempdir().unwrap();
        let note = write_typ(folder.path(), "note.typ", "= note\n");
        let mut gate = AccessGate::new(drafts.path().to_path_buf());
        gate.set_workspace(Some(folder.path().to_path_buf()));

        let relative = gate.resolve("note.typ").unwrap();
        assert!(relative.in_workspace);
        assert_eq!(relative.key, "note.typ");
        assert!(!relative.draft);

        let absolute = gate.resolve(&note.to_string_lossy()).unwrap();
        assert!(absolute.in_workspace);
        assert_eq!(absolute.key, "note.typ");
        assert_eq!(absolute.relative, "note.typ");
    }

    #[test]
    fn a_second_draft_uses_the_next_name_and_a_full_folder_writes_nothing() {
        let drafts = tempfile::tempdir().unwrap();
        create_draft_file(drafts.path(), "pl").unwrap();
        let second = create_draft_file(drafts.path(), "pl").unwrap();
        assert!(second.path.ends_with("untitled-2.typ"));
        assert!(second.text.starts_with("= Tytuł"));
        for index in 3..=100 {
            std::fs::write(drafts.path().join(format!("untitled-{index}.typ")), "x").unwrap();
        }
        assert!(create_draft_file(drafts.path(), "en").is_err());
        assert!(drafts.path().join("untitled.typ").is_file());
    }

    #[test]
    fn discard_removes_a_created_draft_and_refuses_other_files() {
        let drafts = tempfile::tempdir().unwrap();
        let folder = tempfile::tempdir().unwrap();
        let outside = tempfile::tempdir().unwrap();
        let mut gate = AccessGate::new(drafts.path().to_path_buf());
        let placed = create_draft_file(drafts.path(), "en").unwrap();
        discard_draft_file(&gate, &placed.path).unwrap();
        assert!(!Path::new(&placed.path).exists());

        let note = write_typ(folder.path(), "note.typ", "= note\n");
        gate.set_workspace(Some(folder.path().to_path_buf()));
        let refused = discard_draft_file(&gate, "note.typ")
            .unwrap_err()
            .to_string();
        assert!(
            refused.contains("not open for editing"),
            "a workspace note stays: {refused}"
        );
        assert!(note.is_file());

        let secret = write_typ(outside.path(), "secret.typ", "= no\n");
        let never = discard_draft_file(&gate, &secret.to_string_lossy())
            .unwrap_err()
            .to_string();
        assert!(
            never.contains("not open for editing"),
            "a path that was never picked stays: {never}"
        );
        assert!(secret.is_file());
    }
}
