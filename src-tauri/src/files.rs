use std::path::{Component, Path, PathBuf};

use serde::{Deserialize, Serialize};
use specta::Type;

use crate::error::{AppError, AppResult};

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct WorkspaceInfo {
    pub root_name: String,
    pub notes: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct Note {
    pub path: String,
    pub text: String,
}

/// One folder or note in the open workspace, as it sits on disk.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct TreeNode {
    pub name: String,
    pub path: String,
    /// `folder` or `note`.
    pub kind: String,
    pub children: Vec<TreeNode>,
}

pub const SAMPLE_PATH: &str = "wysityp-sample.typ";

pub const SAMPLE_TEXT: &str = "= Przykładowa notatka\n\nŁódź, ąęśćńóżź i polskie znaki na stronie.\n\nMatematyka w wierszu: $x^2 + y^2 = z^2$ oraz suma $sum_(k=1)^n k = (n(n+1)) / 2$.\n\n#figure(\n  rect(width: 4cm, height: 2cm, fill: rgb(\"#dde8ff\"), stroke: 1pt + rgb(\"#3355aa\")),\n  caption: [Prosty rysunek w notatce],\n)\n\nCałka: $ integral_0^1 x^2 dif x = 1/3 $.\n";

pub fn canonical_root(path: &Path) -> AppResult<PathBuf> {
    let root = std::fs::canonicalize(path).map_err(|err| AppError::io(path, err))?;
    // On Windows canonicalize adds a long path prefix. Strip it for display and joins.
    #[cfg(windows)]
    let root = strip_windows_prefix(&root);
    Ok(root)
}

#[cfg(windows)]
fn strip_windows_prefix(path: &Path) -> PathBuf {
    let text = path.to_string_lossy();
    if let Some(rest) = text.strip_prefix(r"\\?\UNC\") {
        PathBuf::from(format!(r"\\{rest}"))
    } else if let Some(rest) = text.strip_prefix(r"\\?\") {
        PathBuf::from(rest.to_string())
    } else {
        path.to_path_buf()
    }
}

/// Turn a path the page sent into a real path inside the root.
///
/// The page only ever sends paths counted from the root, with slashes
/// between parts. Absolute paths and parts that climb up are refused.
/// Links that point outside are refused once the real path is known.
pub fn resolve_inside_root(root: &Path, relative: &str) -> AppResult<PathBuf> {
    if relative.trim().is_empty() {
        return Err(AppError::OutsideRoot(relative.to_string()));
    }
    let rel_path = Path::new(relative);
    if rel_path.is_absolute() {
        return Err(AppError::OutsideRoot(relative.to_string()));
    }
    for part in rel_path.components() {
        match part {
            Component::Normal(_) | Component::CurDir => {}
            _ => return Err(AppError::OutsideRoot(relative.to_string())),
        }
    }
    let candidate = root.join(rel_path);
    // If the file or its parent exists for real, check the true shape.
    let existing = if candidate.exists() {
        Some(candidate.as_path())
    } else {
        candidate.parent().filter(|parent| parent.exists())
    };
    if let Some(existing_path) = existing {
        let true_existing = canonical_root(existing_path)?;
        let true_root = canonical_root(root)?;
        if !true_existing.starts_with(&true_root) {
            return Err(AppError::OutsideRoot(relative.to_string()));
        }
        // Rebuild the tail below the existing part inside the true root.
        if candidate.exists() {
            return Ok(true_existing);
        }
        let parent = candidate.parent().unwrap_or(root);
        let tail = candidate
            .strip_prefix(parent)
            .map_err(|_| AppError::OutsideRoot(relative.to_string()))?;
        return Ok(true_existing.join(tail));
    }
    Ok(candidate)
}

fn display_relative(path: &str) -> String {
    path.trim()
        .replace('\\', "/")
        .trim_end_matches('/')
        .to_string()
}

fn is_same_or_inside(parent: &str, child: &str) -> bool {
    let parent = parent.to_lowercase();
    let child = child.to_lowercase();
    child == parent || child.starts_with(&format!("{parent}/"))
}

fn is_reserved_device_name(name: &str) -> bool {
    let stem = name.split('.').next().unwrap_or(name);
    matches!(
        stem.to_ascii_uppercase().as_str(),
        "CON"
            | "PRN"
            | "AUX"
            | "NUL"
            | "COM1"
            | "COM2"
            | "COM3"
            | "COM4"
            | "COM5"
            | "COM6"
            | "COM7"
            | "COM8"
            | "COM9"
            | "LPT1"
            | "LPT2"
            | "LPT3"
            | "LPT4"
            | "LPT5"
            | "LPT6"
            | "LPT7"
            | "LPT8"
            | "LPT9"
    )
}

/// An empty relative path means the open folder itself.
pub fn resolve_place(root: &Path, relative: &str) -> AppResult<PathBuf> {
    if relative.trim().is_empty() {
        return canonical_root(root);
    }
    resolve_inside_root(root, relative)
}

fn invalid_segment(name: &str) -> bool {
    let name = name.trim();
    name.is_empty()
        || name == "."
        || name == ".."
        || name.starts_with('.')
        || name.ends_with('.')
        || name.contains('/')
        || name.contains('\\')
        || name.contains('\0')
        || is_reserved_device_name(name)
        || name
            .chars()
            .any(|ch| ch.is_control() || matches!(ch, '<' | '>' | ':' | '"' | '|' | '?' | '*'))
}

fn note_file_name(name: &str) -> AppResult<String> {
    let name = name.trim();
    if invalid_segment(name) {
        return Err(AppError::InvalidName(name.to_string()));
    }
    match Path::new(name).extension().and_then(|ext| ext.to_str()) {
        Some("typ") => Ok(name.to_string()),
        Some(_) => Err(AppError::InvalidName(name.to_string())),
        None => Ok(format!("{name}.typ")),
    }
}

fn folder_name(name: &str) -> AppResult<String> {
    let name = name.trim();
    if invalid_segment(name) {
        return Err(AppError::InvalidName(name.to_string()));
    }
    Ok(name.to_string())
}

fn join_relative(parent: &str, name: &str) -> String {
    let parent = display_relative(parent.trim());
    if parent.is_empty() {
        name.to_string()
    } else {
        format!("{parent}/{name}")
    }
}

fn starter_heading(file_name: &str) -> String {
    let stem = Path::new(file_name)
        .file_stem()
        .map(|stem| stem.to_string_lossy().to_string())
        .unwrap_or_else(|| file_name.to_string());
    format!("= {stem}\n")
}

pub fn list_tree(root: &Path) -> AppResult<Vec<TreeNode>> {
    read_tree(root, root)
}

fn read_tree(root: &Path, dir: &Path) -> AppResult<Vec<TreeNode>> {
    let entries = match std::fs::read_dir(dir) {
        Ok(entries) => entries,
        Err(err) => return Err(AppError::io(dir, err)),
    };
    let mut nodes = Vec::new();
    for entry in entries.flatten() {
        let path = entry.path();
        let file_type = match entry.file_type() {
            Ok(kind) => kind,
            Err(_) => continue,
        };
        if file_type.is_symlink() {
            continue;
        }
        let Ok(rel) = path.strip_prefix(root) else {
            continue;
        };
        let relative = display_relative(&rel.to_string_lossy());
        let name = entry.file_name().to_string_lossy().to_string();
        // Hidden names stay out of the tree. The flat note list still sees them.
        if name.starts_with('.') {
            continue;
        }
        if file_type.is_dir() {
            let children = read_tree(root, &path)?;
            nodes.push(TreeNode {
                name,
                path: relative,
                kind: "folder".to_string(),
                children,
            });
        } else if path.extension().is_some_and(|ext| ext == "typ") {
            nodes.push(TreeNode {
                name,
                path: relative,
                kind: "note".to_string(),
                children: Vec::new(),
            });
        }
    }
    nodes.sort_by(|left, right| {
        let left_rank = if left.kind == "folder" { 0 } else { 1 };
        let right_rank = if right.kind == "folder" { 0 } else { 1 };
        left_rank
            .cmp(&right_rank)
            .then_with(|| left.name.to_lowercase().cmp(&right.name.to_lowercase()))
    });
    Ok(nodes)
}

pub fn create_note(root: &Path, parent: &str, name: &str) -> AppResult<Note> {
    let parent_path = resolve_place(root, parent)?;
    if !parent_path.is_dir() {
        return Err(AppError::InvalidName(parent.to_string()));
    }
    let file_name = note_file_name(name)?;
    let relative = join_relative(parent, &file_name);
    let path = resolve_inside_root(root, &relative)?;
    if path.exists() {
        return Err(AppError::AlreadyExists(relative));
    }
    let text = starter_heading(&file_name);
    write_new_file(&path, &relative, &text)?;
    Ok(Note {
        path: relative,
        text,
    })
}

fn write_new_file(path: &Path, relative: &str, text: &str) -> AppResult<()> {
    let mut file = std::fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(path)
        .map_err(|err| {
            if err.kind() == std::io::ErrorKind::AlreadyExists {
                AppError::AlreadyExists(relative.to_string())
            } else {
                AppError::io(path, err)
            }
        })?;
    use std::io::Write;
    file.write_all(text.as_bytes())
        .map_err(|err| AppError::io(path, err))
}

pub fn create_folder(root: &Path, parent: &str, name: &str) -> AppResult<String> {
    let parent_path = resolve_place(root, parent)?;
    if !parent_path.is_dir() {
        return Err(AppError::InvalidName(parent.to_string()));
    }
    let folder = folder_name(name)?;
    let relative = join_relative(parent, &folder);
    let path = resolve_inside_root(root, &relative)?;
    if path.exists() {
        return Err(AppError::AlreadyExists(relative));
    }
    std::fs::create_dir(&path).map_err(|err| AppError::io(&path, err))?;
    Ok(relative)
}

pub fn rename_entry(root: &Path, from: &str, to: &str) -> AppResult<String> {
    let from_display = display_relative(from.trim());
    let to_display = display_relative(to.trim());
    if from_display.is_empty() || to_display.is_empty() {
        return Err(AppError::InvalidName(to_display));
    }
    if is_symlink_path(&root.join(Path::new(&from_display))) {
        return Err(AppError::OutsideRoot(from_display));
    }
    let source = resolve_inside_root(root, &from_display)?;
    if !source.exists() {
        return Err(AppError::io(
            &source,
            std::io::Error::new(std::io::ErrorKind::NotFound, "missing"),
        ));
    }
    if source
        .symlink_metadata()
        .is_ok_and(|meta| meta.file_type().is_symlink())
    {
        return Err(AppError::OutsideRoot(from_display));
    }
    let source_is_dir = source.is_dir();
    if from_display == to_display {
        return Ok(from_display);
    }
    if source_is_dir && is_same_or_inside(&from_display, &to_display) {
        return Err(AppError::MoveIntoSelf(to_display));
    }
    validate_destination(&to_display, source_is_dir)?;
    let destination = resolve_inside_root(root, &to_display)?;
    if destination.exists() {
        let same = canonical_root(&destination).ok() == canonical_root(&source).ok()
            && canonical_root(&source).is_ok();
        if !same {
            return Err(AppError::AlreadyExists(to_display));
        }
    }
    if let Some(parent) = destination.parent() {
        if !parent.exists() {
            return Err(AppError::MissingParent(to_display));
        }
        if source_is_dir {
            let true_parent = canonical_root(parent)?;
            let true_source = canonical_root(&source)?;
            if true_parent == true_source || true_parent.starts_with(&true_source) {
                return Err(AppError::MoveIntoSelf(to_display));
            }
        }
    }
    std::fs::rename(&source, &destination).map_err(|err| AppError::io(&destination, err))?;
    Ok(to_display)
}

fn validate_destination(relative: &str, source_is_dir: bool) -> AppResult<()> {
    let path = Path::new(relative);
    if path.is_absolute() {
        return Err(AppError::OutsideRoot(relative.to_string()));
    }
    let mut parts = Vec::new();
    for part in path.components() {
        match part {
            Component::Normal(name) => parts.push(name.to_string_lossy().to_string()),
            Component::CurDir => {}
            _ => return Err(AppError::OutsideRoot(relative.to_string())),
        }
    }
    if parts.is_empty() {
        return Err(AppError::InvalidName(relative.to_string()));
    }
    for part in &parts {
        if invalid_segment(part) {
            return Err(AppError::InvalidName(relative.to_string()));
        }
    }
    if !source_is_dir {
        let file_name = parts.last().map(String::as_str).unwrap_or("");
        note_file_name(file_name)?;
        // A note destination must keep the .typ ending, not gain one silently.
        if Path::new(file_name).extension().is_none() {
            return Err(AppError::InvalidName(relative.to_string()));
        }
    }
    Ok(())
}

pub fn delete_entry(root: &Path, relative: &str) -> AppResult<()> {
    if relative.trim().is_empty() || relative.trim() == "." {
        return Err(AppError::RootDelete);
    }
    if is_symlink_path(&root.join(Path::new(relative.trim()))) {
        return Err(AppError::OutsideRoot(relative.to_string()));
    }
    let path = resolve_inside_root(root, relative)?;
    let true_path = canonical_root(&path)?;
    let true_root = canonical_root(root)?;
    if true_path == true_root {
        return Err(AppError::RootDelete);
    }
    let meta = path
        .symlink_metadata()
        .map_err(|err| AppError::io(&path, err))?;
    if meta.file_type().is_symlink() {
        return Err(AppError::OutsideRoot(relative.to_string()));
    }
    if meta.is_dir() {
        std::fs::remove_dir_all(&path).map_err(|err| AppError::io(&path, err))?;
    } else {
        std::fs::remove_file(&path).map_err(|err| AppError::io(&path, err))?;
    }
    Ok(())
}

fn is_symlink_path(path: &Path) -> bool {
    path.symlink_metadata()
        .is_ok_and(|meta| meta.file_type().is_symlink())
}

pub fn list_notes(root: &Path) -> AppResult<Vec<String>> {
    let mut notes = Vec::new();
    collect_notes(root, root, &mut notes)?;
    notes.sort();
    Ok(notes)
}

fn collect_notes(root: &Path, dir: &Path, notes: &mut Vec<String>) -> AppResult<()> {
    let entries = match std::fs::read_dir(dir) {
        Ok(entries) => entries,
        Err(_) => return Ok(()),
    };
    for entry in entries.flatten() {
        let path = entry.path();
        let file_type = match entry.file_type() {
            Ok(kind) => kind,
            Err(_) => continue,
        };
        // Links are skipped in the list. Opening one is checked again later.
        if file_type.is_symlink() {
            continue;
        }
        if file_type.is_dir() {
            collect_notes(root, &path, notes)?;
        } else if path.extension().is_some_and(|ext| ext == "typ")
            && let Ok(rel) = path.strip_prefix(root)
        {
            notes.push(rel.to_string_lossy().replace('\\', "/"));
        }
    }
    Ok(())
}

pub fn read_note(root: &Path, relative: &str) -> AppResult<Note> {
    let path = resolve_inside_root(root, relative)?;
    let text = std::fs::read_to_string(&path).map_err(|err| AppError::io(&path, err))?;
    Ok(Note {
        path: relative.replace('\\', "/"),
        text,
    })
}

pub fn write_note(root: &Path, relative: &str, text: &str) -> AppResult<()> {
    let path = resolve_inside_root(root, relative)?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|err| AppError::io(parent, err))?;
    }
    std::fs::write(&path, text).map_err(|err| AppError::io(&path, err))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn refuses_paths_that_climb_out() {
        let dir = tempfile::tempdir().unwrap();
        assert!(resolve_inside_root(dir.path(), "../secret.typ").is_err());
        assert!(resolve_inside_root(dir.path(), "a/../../secret.typ").is_err());
    }

    #[test]
    fn refuses_absolute_paths() {
        let dir = tempfile::tempdir().unwrap();
        assert!(resolve_inside_root(dir.path(), "C:/secret.typ").is_err());
    }

    #[test]
    fn writes_and_reads_inside_root() {
        let dir = tempfile::tempdir().unwrap();
        write_note(dir.path(), "notes/one.typ", "= Cześć\n").unwrap();
        let note = read_note(dir.path(), "notes/one.typ").unwrap();
        assert_eq!(note.text, "= Cześć\n");
        assert_eq!(list_notes(dir.path()).unwrap(), vec!["notes/one.typ"]);
    }

    // covers: proof 2, a folder with subfolders lists every note once
    #[test]
    fn lists_notes_in_folders_in_sorted_order() {
        let dir = tempfile::tempdir().unwrap();
        write_note(dir.path(), "z.typ", "= Z\n").unwrap();
        write_note(dir.path(), "notes/b.typ", "= B\n").unwrap();
        write_note(dir.path(), "a.typ", "= A\n").unwrap();
        write_note(dir.path(), "notes/readme.txt", "not a note\n").unwrap();
        assert_eq!(
            list_notes(dir.path()).unwrap(),
            vec!["a.typ", "notes/b.typ", "z.typ"]
        );
    }

    // covers: proof 5, saving writes the new words over the old ones
    #[test]
    fn saving_again_writes_the_new_words() {
        let dir = tempfile::tempdir().unwrap();
        write_note(dir.path(), "one.typ", "= Old\n").unwrap();
        write_note(dir.path(), "one.typ", "= New\n").unwrap();
        assert_eq!(read_note(dir.path(), "one.typ").unwrap().text, "= New\n");
        let on_disk = std::fs::read_to_string(dir.path().join("one.typ")).unwrap();
        assert_eq!(on_disk, "= New\n");
    }

    #[test]
    fn reading_a_missing_note_is_an_error() {
        let dir = tempfile::tempdir().unwrap();
        assert!(read_note(dir.path(), "missing.typ").is_err());
    }

    #[test]
    fn an_empty_path_is_refused() {
        let dir = tempfile::tempdir().unwrap();
        assert!(resolve_inside_root(dir.path(), "").is_err());
        assert!(resolve_inside_root(dir.path(), "   ").is_err());
    }

    // covers: proof 7, the sample carries what the proof asks it to carry
    #[test]
    fn sample_note_carries_polish_math_and_a_figure() {
        assert!(SAMPLE_PATH.ends_with(".typ"));
        assert!(SAMPLE_TEXT.contains("Łódź"));
        assert!(SAMPLE_TEXT.contains("$x^2 + y^2 = z^2$"));
        assert!(SAMPLE_TEXT.contains("#figure("));
    }

    #[test]
    fn creates_a_note_with_a_heading_from_its_name() {
        let dir = tempfile::tempdir().unwrap();
        let note = create_note(dir.path(), "", "Wykład").unwrap();
        assert_eq!(note.path, "Wykład.typ");
        assert_eq!(note.text, "= Wykład\n");
        let nested = create_note(dir.path(), "lab", "one.typ");
        assert!(nested.is_err());
        create_folder(dir.path(), "", "lab").unwrap();
        let nested = create_note(dir.path(), "lab", "one.typ").unwrap();
        assert_eq!(nested.path, "lab/one.typ");
        assert!(create_note(dir.path(), "lab", "one.typ").is_err());
        assert!(create_note(dir.path(), "", "notes.txt").is_err());
        assert!(create_note(dir.path(), "", "../x.typ").is_err());
        assert!(create_note(dir.path(), "", "C:/x.typ").is_err());
        assert!(create_note(dir.path(), "", "").is_err());
    }

    #[test]
    fn creates_a_folder_and_refuses_a_collision() {
        let dir = tempfile::tempdir().unwrap();
        assert_eq!(create_folder(dir.path(), "", "lab").unwrap(), "lab");
        assert!(create_folder(dir.path(), "", "lab").is_err());
        assert!(create_folder(dir.path(), "", "..").is_err());
        assert!(create_folder(dir.path(), "", "CON").is_err());
        assert!(dir.path().join("lab").is_dir());
    }

    #[test]
    fn renames_and_moves_without_overwriting() {
        let dir = tempfile::tempdir().unwrap();
        create_note(dir.path(), "", "old.typ").unwrap();
        create_folder(dir.path(), "", "dest").unwrap();
        create_note(dir.path(), "dest", "kept.typ").unwrap();
        let moved = rename_entry(dir.path(), "old.typ", "dest/new.typ").unwrap();
        assert_eq!(moved, "dest/new.typ");
        assert!(dir.path().join("dest/new.typ").is_file());
        assert!(!dir.path().join("old.typ").exists());
        assert!(rename_entry(dir.path(), "dest/new.typ", "dest/kept.typ").is_err());
        assert!(rename_entry(dir.path(), "dest/new.typ", "dest/new").is_err());
        assert!(rename_entry(dir.path(), "dest/new.typ", "missing/new.typ").is_err());
        assert!(
            read_note(dir.path(), "dest/kept.typ")
                .unwrap()
                .text
                .starts_with("= kept")
        );
    }

    #[test]
    fn refuses_moving_a_folder_into_itself() {
        let dir = tempfile::tempdir().unwrap();
        create_folder(dir.path(), "", "outer").unwrap();
        create_folder(dir.path(), "outer", "inner").unwrap();
        assert!(rename_entry(dir.path(), "outer", "outer/inner/outer").is_err());
        assert!(rename_entry(dir.path(), "outer", "OUTER/child").is_err());
        assert!(dir.path().join("outer/inner").is_dir());
        assert!(dir.path().join("outer").join("inner").is_dir());
    }

    #[test]
    fn deletes_a_note_or_folder_but_not_the_root() {
        let dir = tempfile::tempdir().unwrap();
        create_note(dir.path(), "", "gone.typ").unwrap();
        create_folder(dir.path(), "", "box").unwrap();
        create_note(dir.path(), "box", "inside.typ").unwrap();
        delete_entry(dir.path(), "gone.typ").unwrap();
        assert!(!dir.path().join("gone.typ").exists());
        delete_entry(dir.path(), "box").unwrap();
        assert!(!dir.path().join("box").exists());
        assert!(delete_entry(dir.path(), "").is_err());
        assert!(delete_entry(dir.path(), ".").is_err());
        assert!(dir.path().exists());
    }

    #[test]
    fn new_operations_refuse_paths_that_escape() {
        let dir = tempfile::tempdir().unwrap();
        create_note(dir.path(), "", "stay.typ").unwrap();
        assert!(create_note(dir.path(), "..", "x.typ").is_err());
        assert!(create_folder(dir.path(), "a/../../", "x").is_err());
        assert!(rename_entry(dir.path(), "stay.typ", "../leave.typ").is_err());
        assert!(rename_entry(dir.path(), "stay.typ", "C:/leave.typ").is_err());
        assert!(delete_entry(dir.path(), "../stay.typ").is_err());
        assert!(dir.path().join("stay.typ").is_file());
    }

    #[test]
    fn tree_lists_folders_then_notes() {
        let dir = tempfile::tempdir().unwrap();
        create_note(dir.path(), "", "b.typ").unwrap();
        create_folder(dir.path(), "", "a").unwrap();
        create_note(dir.path(), "a", "c.typ").unwrap();
        let tree = list_tree(dir.path()).unwrap();
        assert_eq!(tree[0].kind, "folder");
        assert_eq!(tree[0].path, "a");
        assert_eq!(tree[0].children[0].path, "a/c.typ");
        assert_eq!(tree[1].kind, "note");
        std::fs::create_dir(dir.path().join(".git")).unwrap();
        std::fs::write(dir.path().join(".git").join("hidden.typ"), "= H\n").unwrap();
        let tree = list_tree(dir.path()).unwrap();
        assert!(tree.iter().all(|node| !node.name.starts_with('.')));
        assert_eq!(tree.len(), 2);
    }
}
