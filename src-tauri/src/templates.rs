use std::path::Path;

use crate::error::{AppError, AppResult};
use crate::files::{self, Note};

const NAME_TRIES: u32 = 100;

/// Create a new note from a built in template.
///
/// The body is a Typst string held here, not a file on disk. The name is
/// chosen in Rust. An existing file is never overwritten: the next free
/// name is used, and the returned path is the one that was written.
pub fn create_from_template(
    root: &Path,
    parent: &str,
    kind: &str,
    locale: &str,
) -> AppResult<Note> {
    let stem = stem_for(kind)?;
    let text = body_for(kind, locale);
    let mut last_taken = None;
    for file_name in candidate_names(stem) {
        match files::create_new_note(root, parent, &file_name, &text) {
            Ok(note) => return Ok(note),
            Err(AppError::AlreadyExists(path)) => last_taken = Some(path),
            Err(err) => return Err(err),
        }
    }
    Err(AppError::AlreadyExists(
        last_taken.unwrap_or_else(|| format!("{stem}.typ")),
    ))
}

fn stem_for(kind: &str) -> AppResult<&'static str> {
    match kind {
        "lecture" => Ok("lecture"),
        "problem-set" => Ok("problem-set"),
        "lab" => Ok("lab"),
        _ => Err(AppError::Message(format!("unknown template: {kind}"))),
    }
}

fn body_for(kind: &str, locale: &str) -> String {
    let polish = locale != "en";
    match kind {
        "problem-set" if polish => "= Tytuł zestawu zadań\n\n== Zadanie 1\n\n",
        "problem-set" => "= Problem set title\n\n== Problem 1\n\n",
        "lab" if polish => "= Tytuł notatki laboratoryjnej\n\n== Cel\n\n== Metoda\n\n== Wyniki\n\n",
        "lab" => "= Lab note title\n\n== Aim\n\n== Method\n\n== Results\n\n",
        _ if polish => "= Tytuł wykładu\n\n== Zagadnienia\n\n-\n",
        _ => "= Lecture title\n\n== Topics\n\n-\n",
    }
    .to_string()
}

fn candidate_names(stem: &str) -> impl Iterator<Item = String> {
    let stem = stem.to_string();
    (0..NAME_TRIES).map(move |index| {
        if index == 0 {
            format!("{stem}.typ")
        } else {
            let number = index + 1;
            format!("{stem}-{number}.typ")
        }
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    // covers: feature 10, a template writes a new typ file and will not overwrite
    #[test]
    fn a_template_picks_a_free_name_and_keeps_the_existing_file() {
        let root = tempfile::tempdir().unwrap();
        let first = create_from_template(root.path(), "", "lecture", "en").unwrap();
        assert_eq!(first.path, "lecture.typ");
        assert!(first.text.starts_with("= Lecture title\n"));
        let bytes = std::fs::read(root.path().join("lecture.typ")).unwrap();
        assert_eq!(bytes, first.text.as_bytes());

        let second = create_from_template(root.path(), "", "lecture", "en").unwrap();
        assert_eq!(second.path, "lecture-2.typ");
        assert_eq!(
            std::fs::read(root.path().join("lecture.typ")).unwrap(),
            bytes
        );
        assert!(root.path().join("lecture-2.typ").is_file());
        assert_ne!(first.path, second.path);
    }

    #[test]
    fn each_template_is_ordinary_typst_with_a_title_placeholder() {
        let root = tempfile::tempdir().unwrap();
        let lecture = create_from_template(root.path(), "", "lecture", "pl").unwrap();
        let problems = create_from_template(root.path(), "", "problem-set", "en").unwrap();
        let lab = create_from_template(root.path(), "", "lab", "pl").unwrap();
        assert!(lecture.text.contains("= Tytuł wykładu"));
        assert_eq!(problems.path, "problem-set.typ");
        assert!(problems.text.contains("= Problem set title"));
        assert!(lab.text.contains("= Tytuł notatki laboratoryjnej"));
        for note in [&lecture, &problems, &lab] {
            assert!(note.path.ends_with(".typ"));
            assert!(note.text.starts_with("= "));
            let on_disk = std::fs::read_to_string(root.path().join(&note.path)).unwrap();
            assert_eq!(on_disk, note.text);
        }
    }

    // covers: feature 10, a template path outside the open folder is refused
    #[test]
    fn a_template_refuses_a_path_outside_the_open_folder() {
        let scratch = tempfile::tempdir().unwrap();
        let root = scratch.path().join("notes");
        std::fs::create_dir(&root).unwrap();
        let outside = scratch.path().join("secret.typ");

        assert!(create_from_template(&root, "..", "lecture", "en").is_err());
        assert!(create_from_template(&root, "../secret.typ", "lecture", "en").is_err());
        assert!(create_from_template(&root, "C:/outside", "lab", "en").is_err());
        assert!(create_from_template(&root, "", "lecture/../../secret", "en").is_err());
        assert!(!outside.exists());
        assert!(std::fs::read_dir(&root).unwrap().next().is_none());
    }

    // covers: features 9 and 10 together, a template note saves without force once its fingerprint is remembered
    #[test]
    fn a_template_note_saves_without_force_once_remembered() {
        let root = tempfile::tempdir().unwrap();
        let note = create_from_template(root.path(), "", "lecture", "en").unwrap();
        let mut baselines = files::NoteBaselines::default();
        baselines.remember(&note.path, note.fingerprint.clone());

        let saved = baselines
            .save(root.path(), &note.path, "= Lecture title\n\nTyped live.\n", false)
            .unwrap();

        assert_eq!(
            files::read_note(root.path(), &note.path).unwrap().text,
            "= Lecture title\n\nTyped live.\n"
        );
        assert_eq!(
            files::read_note(root.path(), &note.path)
                .unwrap()
                .fingerprint,
            saved
        );
    }

    #[test]
    fn a_template_can_land_in_a_folder_inside_the_workspace() {
        let root = tempfile::tempdir().unwrap();
        std::fs::create_dir(root.path().join("lab")).unwrap();
        let note = create_from_template(root.path(), "lab", "lab", "en").unwrap();
        assert_eq!(note.path, "lab/lab.typ");
        assert!(note.text.contains("= Lab note title"));
        assert!(root.path().join("lab").join("lab.typ").is_file());
    }
}
