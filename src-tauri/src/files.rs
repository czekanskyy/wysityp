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
        } else if path.extension().is_some_and(|ext| ext == "typ") {
            if let Ok(rel) = path.strip_prefix(root) {
                notes.push(rel.to_string_lossy().replace('\\', "/"));
            }
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
}
