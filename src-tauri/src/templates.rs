use std::collections::HashMap;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use specta::Type;

use crate::error::{AppError, AppResult};
use crate::files::{self, Note, NoteFingerprint};

const SHIPPED_STEMS: [&str; 10] = [
    "lecture",
    "problem-set",
    "lab",
    "definitions",
    "proof",
    "example",
    "review",
    "reading",
    "project",
    "formulas",
];

/// Shipped stems for one language, your `.typ` file names, and whether
/// the templates folder could be used.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct TemplateList {
    pub shipped: Vec<String>,
    pub yours: Vec<String>,
    pub folder_ready: bool,
}

/// One template open in the editor. `name` is the file name, including `.typ`.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct TemplateDoc {
    pub name: String,
    pub text: String,
    pub fingerprint: NoteFingerprint,
}

/// Fingerprints for template files. Kept apart from note fingerprints so a
/// shared file name cannot collide.
#[derive(Debug, Default)]
pub struct TemplateBaselines {
    by_key: HashMap<String, NoteFingerprint>,
}

impl TemplateBaselines {
    pub fn remember(&mut self, file: &Path, fingerprint: NoteFingerprint) -> AppResult<()> {
        let key = files::canonical_key(file)?;
        self.by_key.insert(key, fingerprint);
        Ok(())
    }

    fn expected(&self, file: &Path) -> AppResult<Option<NoteFingerprint>> {
        let key = match files::canonical_key(file) {
            Ok(key) => key,
            Err(AppError::Io { source, .. }) if source.kind() == std::io::ErrorKind::NotFound => {
                return Ok(None);
            }
            Err(err) => return Err(err),
        };
        Ok(self.by_key.get(&key).cloned())
    }

    fn store(&mut self, file: &Path, fingerprint: NoteFingerprint) -> AppResult<()> {
        let key = files::canonical_key(file)?;
        self.by_key.insert(key, fingerprint);
        Ok(())
    }
}

pub fn templates_dir(settings_file: &Path) -> PathBuf {
    settings_file
        .parent()
        .unwrap_or_else(|| Path::new(""))
        .join("templates")
}

pub fn list_templates(dir: &Path, _locale: &str) -> TemplateList {
    let shipped = shipped_stems();
    match ensure_templates_dir(dir) {
        Ok(()) => match list_yours(dir) {
            Ok(yours) => TemplateList {
                shipped,
                yours,
                folder_ready: true,
            },
            Err(_) => TemplateList {
                shipped,
                yours: Vec::new(),
                folder_ready: false,
            },
        },
        Err(_) => TemplateList {
            shipped,
            yours: Vec::new(),
            folder_ready: false,
        },
    }
}

fn shipped_stems() -> Vec<String> {
    SHIPPED_STEMS
        .iter()
        .map(|stem| (*stem).to_string())
        .collect()
}

/// A blank note named `unsaved.typ`, then `unsaved-1.typ`, through `unsaved-99.typ`.
///
/// The heading comes from the loaded language. An existing file, folder, or
/// `{stem}.assets` folder blocks that name. When every name is taken, nothing
/// is written.
pub fn create_blank_note(root: &Path, parent: &str, locale: &str) -> AppResult<Note> {
    write_unsaved_note(root, parent, blank_heading(locale))
}

/// A note started from a shipped stem or from one of your template files.
///
/// The note is still named `unsaved`, not after the template. The template
/// text is copied once.
pub fn create_from_template(
    root: &Path,
    parent: &str,
    kind: &str,
    name: &str,
    locale: &str,
    templates_dir: &Path,
) -> AppResult<Note> {
    let text = match kind {
        "shipped" => shipped_text(name, locale)
            .ok_or_else(|| AppError::Message(format!("unknown template: {name}")))?
            .to_string(),
        "user" => read_user_template(templates_dir, name)?,
        _ => return Err(AppError::Message(format!("unknown template kind: {kind}"))),
    };
    write_unsaved_note(root, parent, &text)
}

pub fn copy_shipped_template(dir: &Path, stem: &str, locale: &str) -> AppResult<TemplateDoc> {
    let text = shipped_text(stem, locale)
        .ok_or_else(|| AppError::Message(format!("unknown template: {stem}")))?;
    ensure_templates_dir(dir)?;
    for file_name in copy_names(stem) {
        let names = files::entry_names(dir)?;
        if files::name_is_taken(&names, &file_name, false) {
            continue;
        }
        let path = dir.join(&file_name);
        match write_new_bytes(&path, text.as_bytes()) {
            Ok(()) => {
                return Ok(TemplateDoc {
                    name: file_name,
                    text: text.to_string(),
                    fingerprint: files::fingerprint_of(text.as_bytes()),
                });
            }
            Err(AppError::Io { source, .. })
                if source.kind() == std::io::ErrorKind::AlreadyExists =>
            {
                continue;
            }
            Err(err) => return Err(err),
        }
    }
    Err(AppError::TemplateNamesExhausted)
}

pub fn open_template(dir: &Path, name: &str) -> AppResult<TemplateDoc> {
    let path = template_file(dir, name)?;
    let bytes = std::fs::read(&path).map_err(|err| AppError::io(&path, err))?;
    let text = String::from_utf8(bytes.clone()).map_err(|err| {
        AppError::io(
            &path,
            std::io::Error::new(std::io::ErrorKind::InvalidData, err),
        )
    })?;
    let disk_name = path
        .file_name()
        .map(|file_name| file_name.to_string_lossy().to_string())
        .unwrap_or_else(|| name.to_string());
    Ok(TemplateDoc {
        name: disk_name,
        text,
        fingerprint: files::fingerprint_of(&bytes),
    })
}

pub fn save_template(
    baselines: &mut TemplateBaselines,
    dir: &Path,
    name: &str,
    text: &str,
    force: bool,
) -> AppResult<TemplateDoc> {
    ensure_templates_dir(dir)?;
    let path = template_file(dir, name)?;
    if !force {
        match baselines.expected(&path)? {
            Some(expected) => {
                let bytes = match std::fs::read(&path) {
                    Ok(bytes) => bytes,
                    Err(err) if err.kind() == std::io::ErrorKind::NotFound => {
                        return Err(AppError::ExternalChange);
                    }
                    Err(err) => return Err(AppError::io(&path, err)),
                };
                if files::fingerprint_of(&bytes) != expected {
                    return Err(AppError::ExternalChange);
                }
            }
            None => return Err(AppError::ExternalChange),
        }
    }
    files::write_atomically(&path, text.as_bytes())?;
    let fingerprint = files::fingerprint_of(text.as_bytes());
    baselines.store(&path, fingerprint.clone())?;
    Ok(TemplateDoc {
        name: name.to_string(),
        text: text.to_string(),
        fingerprint,
    })
}

pub fn template_changed_on_disk(
    baselines: &TemplateBaselines,
    dir: &Path,
    name: &str,
) -> AppResult<bool> {
    let path = template_file(dir, name)?;
    let Some(expected) = baselines.expected(&path)? else {
        return Ok(true);
    };
    match std::fs::read(&path) {
        Ok(bytes) => Ok(files::fingerprint_of(&bytes) != expected),
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => Ok(true),
        Err(err) => Err(AppError::io(&path, err)),
    }
}

fn write_unsaved_note(root: &Path, parent: &str, text: &str) -> AppResult<Note> {
    let parent_path = files::resolve_place(root, parent)?;
    if !parent_path.is_dir() {
        return Err(AppError::InvalidName(parent.to_string()));
    }
    for file_name in unsaved_names() {
        let names = files::entry_names(&parent_path)?;
        if files::name_is_taken(&names, &file_name, true) {
            continue;
        }
        match files::create_new_note(root, parent, &file_name, text) {
            Ok(note) => return Ok(note),
            Err(AppError::AlreadyExists(_)) => continue,
            Err(err) => return Err(err),
        }
    }
    Err(AppError::NoteNamesExhausted)
}

fn blank_heading(locale: &str) -> &'static str {
    if locale == "en" {
        "= Title\n"
    } else {
        "= Tytuł\n"
    }
}

fn unsaved_names() -> impl Iterator<Item = String> {
    (0..100).map(|index| {
        if index == 0 {
            "unsaved.typ".to_string()
        } else {
            format!("unsaved-{index}.typ")
        }
    })
}

/// `{stem}.typ`, then `{stem}-2.typ`, through `{stem}-100.typ`.
/// This sequence is not the unsaved note sequence and not the picture sequence.
fn copy_names(stem: &str) -> impl Iterator<Item = String> {
    let stem = stem.to_string();
    (0..100).map(move |index| {
        if index == 0 {
            format!("{stem}.typ")
        } else {
            format!("{stem}-{}.typ", index + 1)
        }
    })
}

fn shipped_text(stem: &str, locale: &str) -> Option<&'static str> {
    let polish = locale != "en";
    Some(match (stem, polish) {
        ("lecture", true) => include_str!("../templates/lecture.pl.typ"),
        ("lecture", false) => include_str!("../templates/lecture.en.typ"),
        ("problem-set", true) => include_str!("../templates/problem-set.pl.typ"),
        ("problem-set", false) => include_str!("../templates/problem-set.en.typ"),
        ("lab", true) => include_str!("../templates/lab.pl.typ"),
        ("lab", false) => include_str!("../templates/lab.en.typ"),
        ("definitions", true) => include_str!("../templates/definitions.pl.typ"),
        ("definitions", false) => include_str!("../templates/definitions.en.typ"),
        ("proof", true) => include_str!("../templates/proof.pl.typ"),
        ("proof", false) => include_str!("../templates/proof.en.typ"),
        ("example", true) => include_str!("../templates/example.pl.typ"),
        ("example", false) => include_str!("../templates/example.en.typ"),
        ("review", true) => include_str!("../templates/review.pl.typ"),
        ("review", false) => include_str!("../templates/review.en.typ"),
        ("reading", true) => include_str!("../templates/reading.pl.typ"),
        ("reading", false) => include_str!("../templates/reading.en.typ"),
        ("project", true) => include_str!("../templates/project.pl.typ"),
        ("project", false) => include_str!("../templates/project.en.typ"),
        ("formulas", true) => include_str!("../templates/formulas.pl.typ"),
        ("formulas", false) => include_str!("../templates/formulas.en.typ"),
        _ => return None,
    })
}

fn list_yours(dir: &Path) -> AppResult<Vec<String>> {
    let mut names = Vec::new();
    let entries = std::fs::read_dir(dir).map_err(|err| AppError::io(dir, err))?;
    for entry in entries {
        let entry = entry.map_err(|err| AppError::io(dir, err))?;
        let file_type = match entry.file_type() {
            Ok(kind) => kind,
            Err(_) => continue,
        };
        if file_type.is_symlink() || file_type.is_dir() {
            continue;
        }
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with('.') || !name.to_lowercase().ends_with(".typ") {
            continue;
        }
        if files::is_reserved_device_name(&name) {
            continue;
        }
        let path = entry.path();
        let bytes = match std::fs::read(&path) {
            Ok(bytes) => bytes,
            Err(_) => continue,
        };
        if String::from_utf8(bytes).is_err() {
            continue;
        }
        names.push(name);
    }
    names.sort_by_key(|name| name.to_lowercase());
    Ok(names)
}

fn ensure_templates_dir(dir: &Path) -> AppResult<()> {
    if dir.is_dir() {
        return Ok(());
    }
    if dir.exists() {
        return Err(AppError::io(
            dir,
            std::io::Error::new(std::io::ErrorKind::AlreadyExists, "not a folder"),
        ));
    }
    std::fs::create_dir_all(dir).map_err(|err| AppError::io(dir, err))
}

fn template_file(dir: &Path, name: &str) -> AppResult<PathBuf> {
    validate_template_name(name)?;
    files::resolve_inside_root(dir, name)
}

fn validate_template_name(name: &str) -> AppResult<()> {
    if name.contains('/') || name.contains('\\') || name.contains("..") || name.starts_with('.') {
        return Err(AppError::InvalidName(name.to_string()));
    }
    if !name.to_lowercase().ends_with(".typ") || files::is_reserved_device_name(name) {
        return Err(AppError::InvalidName(name.to_string()));
    }
    Ok(())
}

fn read_user_template(dir: &Path, name: &str) -> AppResult<String> {
    let path = template_file(dir, name)?;
    let bytes = std::fs::read(&path).map_err(|err| AppError::io(&path, err))?;
    String::from_utf8(bytes).map_err(|err| {
        AppError::io(
            &path,
            std::io::Error::new(std::io::ErrorKind::InvalidData, err),
        )
    })
}

fn write_new_bytes(path: &Path, bytes: &[u8]) -> AppResult<()> {
    use std::io::Write;
    let mut file = std::fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(path)
        .map_err(|err| AppError::io(path, err))?;
    file.write_all(bytes).map_err(|err| AppError::io(path, err))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn shipped_note(root: &Path, kind: &str, name: &str, locale: &str) -> Note {
        let templates = root.join("unused-templates");
        create_from_template(root, "", "shipped", name, locale, &templates).unwrap_or_else(|err| {
            panic!("create {kind} {name}: {err}");
        })
    }

    #[test]
    fn a_blank_note_uses_unsaved_then_a_number_and_stops_after_100() {
        let root = tempfile::tempdir().unwrap();
        let first = create_blank_note(root.path(), "", "pl").unwrap();
        assert_eq!(first.path, "unsaved.typ");
        assert_eq!(first.text, "= Tytuł\n");
        let second = create_blank_note(root.path(), "", "en").unwrap();
        assert_eq!(second.path, "unsaved-1.typ");
        assert_eq!(second.text, "= Title\n");
        assert_eq!(
            std::fs::read_to_string(root.path().join("unsaved.typ")).unwrap(),
            "= Tytuł\n"
        );

        for _ in 2..100 {
            create_blank_note(root.path(), "", "en").unwrap();
        }
        let before = std::fs::read_dir(root.path()).unwrap().count();
        let err = create_blank_note(root.path(), "", "en").unwrap_err();
        assert!(matches!(err, AppError::NoteNamesExhausted));
        assert!(err.to_string().starts_with("note-names-exhausted:"));
        assert_eq!(std::fs::read_dir(root.path()).unwrap().count(), before);
        assert_eq!(before, 100);
    }

    #[test]
    fn a_leftover_assets_folder_blocks_that_unsaved_name() {
        let root = tempfile::tempdir().unwrap();
        std::fs::create_dir(root.path().join("unsaved.assets")).unwrap();
        let note = create_blank_note(root.path(), "", "en").unwrap();
        assert_eq!(note.path, "unsaved-1.typ");
        assert!(root.path().join("unsaved.assets").is_dir());
        assert!(!root.path().join("unsaved.typ").exists());
    }

    #[test]
    fn a_blank_note_can_land_in_the_selected_folder() {
        let root = tempfile::tempdir().unwrap();
        std::fs::create_dir(root.path().join("week")).unwrap();
        let note = create_blank_note(root.path(), "week", "pl").unwrap();
        assert_eq!(note.path, "week/unsaved.typ");
        assert_eq!(note.text, "= Tytuł\n");
    }

    #[test]
    fn a_template_note_is_named_unsaved_and_copies_the_body_once() {
        let root = tempfile::tempdir().unwrap();
        let first = shipped_note(root.path(), "lecture", "lecture", "en");
        assert_eq!(first.path, "unsaved.typ");
        assert!(first.text.starts_with("= Lecture title\n"));
        let second = shipped_note(root.path(), "lecture", "lecture", "pl");
        assert_eq!(second.path, "unsaved-1.typ");
        assert!(second.text.starts_with("= Tytuł wykładu\n"));
        assert_eq!(
            std::fs::read_to_string(root.path().join("unsaved.typ")).unwrap(),
            first.text
        );
    }

    #[test]
    fn each_shipped_template_is_ordinary_typst_with_a_title() {
        let root = tempfile::tempdir().unwrap();
        for stem in SHIPPED_STEMS {
            let polish = shipped_text(stem, "pl").unwrap();
            let english = shipped_text(stem, "en").unwrap();
            assert!(polish.starts_with("= "));
            assert!(english.starts_with("= "));
            assert!(!polish.contains('\r'));
            assert!(!english.contains('\r'));
            assert_ne!(polish, english);
        }
        let note = shipped_note(root.path(), "lab", "lab", "pl");
        assert!(note.text.contains("= Tytuł notatki laboratoryjnej"));
        assert_eq!(note.path, "unsaved.typ");
    }

    #[test]
    fn a_template_refuses_a_path_outside_the_open_folder() {
        let scratch = tempfile::tempdir().unwrap();
        let root = scratch.path().join("notes");
        std::fs::create_dir(&root).unwrap();
        let templates = scratch.path().join("templates");
        let outside = scratch.path().join("secret.typ");

        assert!(create_from_template(&root, "..", "shipped", "lecture", "en", &templates).is_err());
        assert!(
            create_from_template(
                &root,
                "../secret.typ",
                "shipped",
                "lecture",
                "en",
                &templates
            )
            .is_err()
        );
        assert!(
            create_from_template(&root, "C:/outside", "shipped", "lab", "en", &templates).is_err()
        );
        assert!(!outside.exists());
        assert!(std::fs::read_dir(&root).unwrap().next().is_none());
    }

    #[test]
    fn a_template_note_saves_without_force_once_remembered() {
        let root = tempfile::tempdir().unwrap();
        let note = shipped_note(root.path(), "lecture", "lecture", "en");
        let mut baselines = files::NoteBaselines::default();
        baselines.remember(&note.path, note.fingerprint.clone());

        let saved = baselines
            .save(
                root.path(),
                &note.path,
                "= Lecture title\n\nTyped live.\n",
                false,
            )
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
        let templates = root.path().join("unused-templates");
        let note =
            create_from_template(root.path(), "lab", "shipped", "lab", "en", &templates).unwrap();
        assert_eq!(note.path, "lab/unsaved.typ");
        assert!(note.text.contains("= Lab note title"));
    }

    #[test]
    fn list_returns_shipped_stems_and_your_typ_files() {
        let dir = tempfile::tempdir().unwrap();
        let templates = dir.path().join("templates");
        let missing = list_templates(&templates, "pl");
        assert_eq!(missing.shipped.len(), 10);
        assert_eq!(missing.shipped[0], "lecture");
        assert_eq!(missing.shipped[9], "formulas");
        assert!(missing.yours.is_empty());
        assert!(missing.folder_ready);
        assert!(templates.is_dir());

        std::fs::write(templates.join("mine.typ"), "= Mine\n").unwrap();
        std::fs::write(templates.join("lecture.typ"), "= Custom\n").unwrap();
        std::fs::write(templates.join("skip.txt"), "no").unwrap();
        std::fs::write(templates.join("bad.typ"), [0xff, 0xfe]).unwrap();
        std::fs::create_dir(templates.join("nested")).unwrap();
        std::fs::write(templates.join(".hidden.typ"), "= H\n").unwrap();
        let listed = list_templates(&templates, "en");
        assert_eq!(listed.shipped[0], "lecture");
        assert_eq!(
            listed.yours,
            vec!["lecture.typ".to_string(), "mine.typ".to_string()]
        );
        assert!(listed.folder_ready);
        assert!(listed.shipped.iter().any(|stem| stem == "lecture"));
    }

    #[test]
    fn a_copy_uses_the_stem_then_a_later_number_and_does_not_touch_shipped_text() {
        let dir = tempfile::tempdir().unwrap();
        let templates = dir.path().join("templates");
        let first = copy_shipped_template(&templates, "proof", "pl").unwrap();
        assert_eq!(first.name, "proof.typ");
        assert!(first.text.starts_with("= Tytuł dowodu\n"));
        let shipped = shipped_text("proof", "pl").unwrap();
        assert_eq!(first.text, shipped);
        let second = copy_shipped_template(&templates, "proof", "pl").unwrap();
        assert_eq!(second.name, "proof-2.typ");
        assert_eq!(
            std::fs::read_to_string(templates.join("proof.typ")).unwrap(),
            shipped
        );
    }

    #[test]
    fn saving_a_template_refuses_a_disk_change_until_force() {
        let dir = tempfile::tempdir().unwrap();
        let templates = dir.path().join("templates");
        let copied = copy_shipped_template(&templates, "lecture", "en").unwrap();
        let mut baselines = TemplateBaselines::default();
        let path = templates.join(&copied.name);
        baselines
            .remember(&path, copied.fingerprint.clone())
            .unwrap();

        std::fs::write(&path, "= Edited outside\n").unwrap();
        let refused = save_template(&mut baselines, &templates, &copied.name, "= Mine\n", false);
        assert!(matches!(refused, Err(AppError::ExternalChange)));
        assert_eq!(
            std::fs::read_to_string(&path).unwrap(),
            "= Edited outside\n"
        );
        assert!(template_changed_on_disk(&baselines, &templates, &copied.name).unwrap());

        let saved =
            save_template(&mut baselines, &templates, &copied.name, "= Mine\n", true).unwrap();
        assert_eq!(saved.text, "= Mine\n");
        assert!(!template_changed_on_disk(&baselines, &templates, &copied.name).unwrap());
    }

    #[test]
    fn a_template_name_that_leaves_the_folder_writes_nothing() {
        let dir = tempfile::tempdir().unwrap();
        let templates = dir.path().join("templates");
        std::fs::create_dir_all(&templates).unwrap();
        let mut baselines = TemplateBaselines::default();
        assert!(save_template(&mut baselines, &templates, "../x.typ", "= X\n", true).is_err());
        assert!(open_template(&templates, "a/b.typ").is_err());
        assert!(!dir.path().join("x.typ").exists());
    }

    // covers: spec 0006 AC-5, only readable .typ files, folded sort, spelling kept
    #[test]
    fn your_list_keeps_readable_typ_files_sorted_without_regard_to_case() {
        let dir = tempfile::tempdir().unwrap();
        let templates = dir.path().join("templates");
        std::fs::create_dir_all(&templates).unwrap();
        std::fs::write(templates.join("Zeta.typ"), "= Z\n").unwrap();
        std::fs::write(templates.join("alpha.TYP"), "= A\n").unwrap();
        std::fs::write(templates.join("Mid.typ"), "= M\n").unwrap();
        std::fs::write(templates.join("notes.txt"), "no").unwrap();
        std::fs::write(
            templates.join("badutf8.typ"),
            [0xff, 0xfe, 0xfa, 0x20, 0x62],
        )
        .unwrap();
        std::fs::write(templates.join(".hidden.typ"), "= H\n").unwrap();
        std::fs::create_dir(templates.join("folder.typ")).unwrap();
        let listed = list_templates(&templates, "pl");
        assert_eq!(
            listed.yours,
            vec![
                "alpha.TYP".to_string(),
                "Mid.typ".to_string(),
                "Zeta.typ".to_string()
            ]
        );
        assert!(listed.folder_ready);
    }

    // covers: spec 0006 AC-5, a templates path that is a file still lists the shipped stems
    #[test]
    fn a_templates_path_that_is_a_file_leaves_the_shipped_list_and_flags_the_folder() {
        let dir = tempfile::tempdir().unwrap();
        let templates = dir.path().join("templates");
        std::fs::write(&templates, "not a folder").unwrap();
        let listed = list_templates(&templates, "en");
        assert_eq!(listed.shipped.len(), 10);
        assert!(listed.yours.is_empty());
        assert!(!listed.folder_ready);
        assert!(templates.is_file());
    }

    // covers: spec 0006 AC-5, AC-13, a reserved device name or a wrong ending is refused
    #[test]
    fn a_reserved_device_name_or_a_wrong_ending_is_refused_for_a_template() {
        let dir = tempfile::tempdir().unwrap();
        let templates = dir.path().join("templates");
        std::fs::create_dir_all(&templates).unwrap();
        let mut baselines = TemplateBaselines::default();
        for name in [
            "CON.typ",
            "prn.typ",
            "AUX.typ",
            "NUL.typ",
            "COM1.typ",
            "com9.typ",
            "LPT1.typ",
            "lpt9.typ",
            "notes.txt",
            "noext",
            "",
        ] {
            assert!(
                matches!(
                    open_template(&templates, name),
                    Err(AppError::InvalidName(_))
                ),
                "open {name}"
            );
            assert!(
                matches!(
                    save_template(&mut baselines, &templates, name, "= X\n", true),
                    Err(AppError::InvalidName(_))
                ),
                "save {name}"
            );
        }
        assert!(std::fs::read_dir(&templates).unwrap().next().is_none());
    }

    // covers: spec 0006 AC-7, the copy names run to -100 and then the command writes nothing
    #[test]
    fn a_copy_stops_after_stem_100_and_writes_nothing_more() {
        let dir = tempfile::tempdir().unwrap();
        let templates = dir.path().join("templates");
        let first = copy_shipped_template(&templates, "lab", "en").unwrap();
        assert_eq!(first.name, "lab.typ");
        for number in 2..=100 {
            let copy = copy_shipped_template(&templates, "lab", "en").unwrap();
            assert_eq!(copy.name, format!("lab-{number}.typ"));
        }
        let before = std::fs::read_dir(&templates).unwrap().count();
        let err = copy_shipped_template(&templates, "lab", "en").unwrap_err();
        assert!(matches!(err, AppError::TemplateNamesExhausted));
        assert!(err.to_string().starts_with("template-names-exhausted:"));
        assert_eq!(std::fs::read_dir(&templates).unwrap().count(), before);
        assert_eq!(before, 100);
    }

    // covers: spec 0006 AC-7, a taken name is judged without regard to case
    #[test]
    fn a_copy_skips_a_name_taken_in_another_case() {
        let dir = tempfile::tempdir().unwrap();
        let templates = dir.path().join("templates");
        std::fs::create_dir_all(&templates).unwrap();
        std::fs::write(templates.join("LECTURE.typ"), "= Mine\n").unwrap();
        let copy = copy_shipped_template(&templates, "lecture", "en").unwrap();
        assert_eq!(copy.name, "lecture-2.typ");
        assert_eq!(
            std::fs::read_to_string(templates.join("LECTURE.typ")).unwrap(),
            "= Mine\n"
        );
    }

    // covers: spec 0006 AC-7, an unknown stem writes no file
    #[test]
    fn copying_an_unknown_or_climbing_stem_writes_nothing() {
        let dir = tempfile::tempdir().unwrap();
        let templates = dir.path().join("templates");
        for stem in ["nosuch", "../lecture", "lecture/../../x"] {
            assert!(copy_shipped_template(&templates, stem, "en").is_err());
        }
        assert!(!templates.exists() || std::fs::read_dir(&templates).unwrap().next().is_none());
    }

    // covers: spec 0006 AC-8, no remembered fingerprint means a save needs force
    #[test]
    fn a_template_with_no_remembered_fingerprint_is_refused_until_force() {
        let dir = tempfile::tempdir().unwrap();
        let templates = dir.path().join("templates");
        std::fs::create_dir_all(&templates).unwrap();
        std::fs::write(templates.join("mine.typ"), "= Mine\n").unwrap();
        let mut baselines = TemplateBaselines::default();
        let refused = save_template(&mut baselines, &templates, "mine.typ", "= New\n", false);
        assert!(matches!(refused, Err(AppError::ExternalChange)));
        assert!(
            refused
                .unwrap_err()
                .to_string()
                .starts_with("external-change:")
        );
        assert_eq!(
            std::fs::read_to_string(templates.join("mine.typ")).unwrap(),
            "= Mine\n"
        );
        assert!(template_changed_on_disk(&baselines, &templates, "mine.typ").unwrap());

        save_template(&mut baselines, &templates, "mine.typ", "= New\n", true).unwrap();
        assert!(!template_changed_on_disk(&baselines, &templates, "mine.typ").unwrap());
        save_template(&mut baselines, &templates, "mine.typ", "= Again\n", false).unwrap();
    }

    // covers: spec 0006 AC-8, a template that vanished counts as changed
    #[test]
    fn a_deleted_template_counts_as_changed_and_refuses_a_plain_save() {
        let dir = tempfile::tempdir().unwrap();
        let templates = dir.path().join("templates");
        let copy = copy_shipped_template(&templates, "proof", "en").unwrap();
        let path = templates.join(&copy.name);
        let mut baselines = TemplateBaselines::default();
        baselines.remember(&path, copy.fingerprint.clone()).unwrap();
        std::fs::remove_file(&path).unwrap();
        assert!(template_changed_on_disk(&baselines, &templates, &copy.name).unwrap());
        let refused = save_template(&mut baselines, &templates, &copy.name, "= X\n", false);
        assert!(matches!(refused, Err(AppError::ExternalChange)));
        assert!(!path.exists());
    }

    // covers: spec 0006 AC-8, a template file that is not UTF-8 cannot be opened
    #[test]
    fn opening_a_template_that_is_not_utf8_is_an_error() {
        let dir = tempfile::tempdir().unwrap();
        let templates = dir.path().join("templates");
        std::fs::create_dir_all(&templates).unwrap();
        std::fs::write(templates.join("bad.typ"), [0xff, 0xfe]).unwrap();
        assert!(open_template(&templates, "bad.typ").is_err());
    }

    // covers: spec 0006 AC-3, editing the template later leaves the note as it was
    #[test]
    fn a_later_template_edit_leaves_the_note_alone() {
        let root = tempfile::tempdir().unwrap();
        let templates = root.path().join("templates");
        std::fs::create_dir(&templates).unwrap();
        std::fs::write(templates.join("mine.typ"), "= One\n").unwrap();
        let note =
            create_from_template(root.path(), "", "user", "mine.typ", "en", &templates).unwrap();
        let mut baselines = TemplateBaselines::default();
        save_template(&mut baselines, &templates, "mine.typ", "= Two\n", true).unwrap();
        assert_eq!(
            std::fs::read_to_string(root.path().join(&note.path)).unwrap(),
            "= One\n"
        );
    }

    #[test]
    fn a_user_template_copies_its_text_into_an_unsaved_note() {
        let root = tempfile::tempdir().unwrap();
        let templates = root.path().join("templates");
        std::fs::create_dir(&templates).unwrap();
        std::fs::write(templates.join("mine.typ"), "= Mine\n").unwrap();
        let note =
            create_from_template(root.path(), "", "user", "mine.typ", "en", &templates).unwrap();
        assert_eq!(note.path, "unsaved.typ");
        assert_eq!(note.text, "= Mine\n");
        assert_eq!(
            std::fs::read_to_string(templates.join("mine.typ")).unwrap(),
            "= Mine\n"
        );
    }
}
