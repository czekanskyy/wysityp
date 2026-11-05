use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use specta::Type;

use crate::error::{AppError, AppResult};
use crate::files;

pub const DEFAULT_LOCALE: &str = "pl";
pub const LOCALES: [&str; 2] = ["pl", "en"];
pub const RECENT_LIMIT: usize = 10;

/// What the page is allowed to see. Language lives only in `locale`.
/// Recent notes are a separate command so the workspace identity never
/// travels to the page.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct Settings {
    pub locale: String,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            locale: DEFAULT_LOCALE.to_string(),
        }
    }
}

/// On disk beside `locale`. `workspace` is the open folder's identity.
/// Rust compares it with the stored root and never hands it to the page.
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq)]
struct RecentNotesFile {
    #[serde(default)]
    workspace: String,
    #[serde(default)]
    paths: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct SettingsFile {
    locale: String,
    #[serde(default)]
    recent_notes: RecentNotesFile,
}

impl Default for SettingsFile {
    fn default() -> Self {
        Self {
            locale: DEFAULT_LOCALE.to_string(),
            recent_notes: RecentNotesFile::default(),
        }
    }
}

impl From<SettingsFile> for Settings {
    fn from(file: SettingsFile) -> Self {
        Self {
            locale: file.locale,
        }
    }
}

pub fn settings_path(config_dir: &Path) -> PathBuf {
    config_dir.join("settings.json")
}

pub fn load_settings(path: &Path) -> AppResult<Settings> {
    Ok(load_file(path)?.into())
}

pub fn set_locale(path: &Path, locale: &str) -> AppResult<Settings> {
    if !LOCALES.contains(&locale) {
        return Err(AppError::BadLocale(locale.to_string()));
    }
    let mut file = load_file(path)?;
    file.locale = locale.to_string();
    save_file(path, &file)?;
    Ok(file.into())
}

/// Remember a note the student just opened. Newest first, duplicates
/// collapsed, capped. A different open folder starts a fresh list so
/// paths from the previous folder are not mixed in.
pub fn record_recent(settings_path: &Path, root: &Path, relative: &str) -> AppResult<Vec<String>> {
    let relative = normalize_note(relative)?;
    let resolved = files::resolve_inside_root(root, &relative)?;
    if !is_typ_file(&resolved) {
        return Err(AppError::InvalidName(relative));
    }
    let mut file = load_file(settings_path)?;
    let key = workspace_key(root)?;
    if file.recent_notes.workspace != key {
        file.recent_notes = RecentNotesFile {
            workspace: key,
            paths: Vec::new(),
        };
    }
    file.recent_notes
        .paths
        .retain(|path| !same_note(path, &relative));
    file.recent_notes.paths.insert(0, relative);
    file.recent_notes.paths.truncate(RECENT_LIMIT);
    save_file(settings_path, &file)?;
    Ok(file.recent_notes.paths)
}

/// Recent notes for the open folder, newest first.
///
/// A list stored for a different folder is refused (an empty list, and
/// the file is left as it was). A path that is missing or that escapes
/// the open folder is dropped.
pub fn list_recent(settings_path: &Path, root: &Path) -> AppResult<Vec<String>> {
    let mut file = load_file(settings_path)?;
    let key = workspace_key(root)?;
    if file.recent_notes.workspace != key {
        return Ok(Vec::new());
    }
    let original = file.recent_notes.paths.clone();
    let mut kept = Vec::new();
    for path in &original {
        let Ok(normalized) = normalize_note(path) else {
            continue;
        };
        let Ok(resolved) = files::resolve_inside_root(root, &normalized) else {
            continue;
        };
        if !is_typ_file(&resolved) {
            continue;
        }
        if kept
            .iter()
            .any(|item: &String| same_note(item, &normalized))
        {
            continue;
        }
        kept.push(normalized);
    }
    kept.truncate(RECENT_LIMIT);
    if kept != file.recent_notes.paths {
        file.recent_notes.paths = kept.clone();
        save_file(settings_path, &file)?;
    }
    Ok(kept)
}

fn load_file(path: &Path) -> AppResult<SettingsFile> {
    match std::fs::read_to_string(path) {
        Ok(text) => {
            let mut parsed: SettingsFile = serde_json::from_str(&text)
                .map_err(|err| AppError::Message(format!("settings file is broken: {err}")))?;
            if !LOCALES.contains(&parsed.locale.as_str()) {
                parsed.locale = DEFAULT_LOCALE.to_string();
            }
            Ok(parsed)
        }
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => {
            let file = SettingsFile::default();
            save_file(path, &file)?;
            Ok(file)
        }
        Err(err) => Err(AppError::io(path, err)),
    }
}

fn save_file(path: &Path, file: &SettingsFile) -> AppResult<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|err| AppError::io(parent, err))?;
    }
    let text =
        serde_json::to_string_pretty(file).map_err(|err| AppError::Message(err.to_string()))?;
    std::fs::write(path, format!("{text}\n")).map_err(|err| AppError::io(path, err))
}

fn workspace_key(root: &Path) -> AppResult<String> {
    let canonical = files::canonical_root(root)?;
    Ok(canonical
        .to_string_lossy()
        .replace('\\', "/")
        .to_ascii_lowercase())
}

fn normalize_note(relative: &str) -> AppResult<String> {
    let text = relative.trim().replace('\\', "/");
    let text = text.trim_matches('/').to_string();
    if text.is_empty()
        || text
            .split('/')
            .any(|part| part.is_empty() || part == "." || part == "..")
    {
        return Err(AppError::OutsideRoot(relative.to_string()));
    }
    Ok(text)
}

fn same_note(left: &str, right: &str) -> bool {
    // Windows treats these spellings as one file.
    left.eq_ignore_ascii_case(right)
}

fn is_typ_file(path: &Path) -> bool {
    path.is_file() && path.extension().is_some_and(|ext| ext == "typ")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_locale_is_polish() {
        assert_eq!(Settings::default().locale, "pl");
    }

    #[test]
    fn bad_locale_is_refused() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("settings.json");
        assert!(set_locale(&path, "de").is_err());
    }

    #[test]
    fn locale_round_trip() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("settings.json");
        set_locale(&path, "en").unwrap();
        assert_eq!(load_settings(&path).unwrap().locale, "en");
    }

    // covers: the language lives in one plain file a student can inspect
    #[test]
    fn a_missing_settings_file_is_written_with_polish() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("settings.json");
        let loaded = load_settings(&path).unwrap();
        assert_eq!(loaded.locale, "pl");
        let on_disk = std::fs::read_to_string(&path).unwrap();
        assert!(on_disk.contains("\"pl\""), "file was: {on_disk}");
    }

    #[test]
    fn a_broken_settings_file_is_an_error_not_a_silent_guess() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("settings.json");
        std::fs::write(&path, "{ broken").unwrap();
        assert!(load_settings(&path).is_err());
    }

    #[test]
    fn an_unknown_language_in_the_file_falls_back_to_polish() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("settings.json");
        std::fs::write(&path, "{\"locale\":\"de\"}\n").unwrap();
        assert_eq!(load_settings(&path).unwrap().locale, "pl");
    }

    // covers: feature 10, an old settings file has no recent notes field
    #[test]
    fn an_old_settings_file_still_loads() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("settings.json");
        let original = "{\"locale\":\"en\"}\n";
        std::fs::write(&path, original).unwrap();
        let root = tempfile::tempdir().unwrap();
        assert_eq!(load_settings(&path).unwrap().locale, "en");
        assert!(list_recent(&path, root.path()).unwrap().is_empty());
        assert_eq!(std::fs::read_to_string(&path).unwrap(), original);
        set_locale(&path, "pl").unwrap();
        assert_eq!(load_settings(&path).unwrap().locale, "pl");
    }

    fn write_note(root: &Path, relative: &str) {
        files::write_note(root, relative, "= Hi\n").unwrap();
    }

    // covers: feature 10, recording order, dedup, and the cap of 10
    #[test]
    fn recent_notes_are_newest_first_deduped_and_capped() {
        let root = tempfile::tempdir().unwrap();
        let settings_dir = tempfile::tempdir().unwrap();
        let path = settings_dir.path().join("settings.json");
        std::fs::write(&path, "{\"locale\":\"pl\"}\n").unwrap();
        write_note(root.path(), "a.typ");
        write_note(root.path(), "b.typ");
        write_note(root.path(), "c.typ");

        record_recent(&path, root.path(), "a.typ").unwrap();
        record_recent(&path, root.path(), "b.typ").unwrap();
        let listed = record_recent(&path, root.path(), "c.typ").unwrap();
        assert_eq!(listed, vec!["c.typ", "b.typ", "a.typ"]);

        let again = record_recent(&path, root.path(), "a.typ").unwrap();
        assert_eq!(again, vec!["a.typ", "c.typ", "b.typ"]);

        let on_disk = std::fs::read_to_string(&path).unwrap();
        let mut value: serde_json::Value = serde_json::from_str(&on_disk).unwrap();
        value["recent_notes"]["paths"] = serde_json::json!(["A.typ", "a.typ", "b.typ"]);
        std::fs::write(&path, format!("{value}\n")).unwrap();
        let deduped = list_recent(&path, root.path()).unwrap();
        assert_eq!(deduped.len(), 2);
        assert!(deduped.iter().any(|item| same_note(item, "a.typ")));
        assert!(deduped.iter().any(|item| item == "b.typ"));

        for index in 1..=12 {
            let name = format!("n{index:02}.typ");
            write_note(root.path(), &name);
            record_recent(&path, root.path(), &name).unwrap();
        }
        let capped = list_recent(&path, root.path()).unwrap();
        assert_eq!(capped.len(), RECENT_LIMIT);
        assert_eq!(capped[0], "n12.typ");
        assert_eq!(capped[9], "n03.typ");
        assert!(
            !capped
                .iter()
                .any(|item| item == "n01.typ" || item == "n02.typ")
        );
        assert_eq!(load_settings(&path).unwrap().locale, "pl");
    }

    // covers: feature 10, a missing note is dropped and a path that climbs out is dropped
    #[test]
    fn stale_and_escaping_recent_entries_are_dropped() {
        let root = tempfile::tempdir().unwrap();
        let settings_dir = tempfile::tempdir().unwrap();
        let path = settings_dir.path().join("settings.json");
        write_note(root.path(), "keep.typ");
        write_note(root.path(), "gone.typ");
        record_recent(&path, root.path(), "keep.typ").unwrap();
        record_recent(&path, root.path(), "gone.typ").unwrap();
        std::fs::remove_file(root.path().join("gone.typ")).unwrap();

        let on_disk = std::fs::read_to_string(&path).unwrap();
        let mut value: serde_json::Value = serde_json::from_str(&on_disk).unwrap();
        value["recent_notes"]["paths"]
            .as_array_mut()
            .unwrap()
            .insert(0, serde_json::Value::String("../secret.typ".to_string()));
        std::fs::write(&path, format!("{value}\n")).unwrap();

        let listed = list_recent(&path, root.path()).unwrap();
        assert_eq!(listed, vec!["keep.typ"]);
        let cleaned = std::fs::read_to_string(&path).unwrap();
        assert!(!cleaned.contains("gone.typ"), "{cleaned}");
        assert!(!cleaned.contains("../secret.typ"), "{cleaned}");
        assert!(!root.path().parent().unwrap().join("secret.typ").exists());
    }

    // covers: feature 10, entries from a different folder are refused
    #[test]
    fn recent_notes_from_another_folder_are_refused() {
        let folder_a = tempfile::tempdir().unwrap();
        let folder_b = tempfile::tempdir().unwrap();
        let settings_dir = tempfile::tempdir().unwrap();
        let path = settings_dir.path().join("settings.json");
        write_note(folder_a.path(), "a.typ");
        write_note(folder_b.path(), "b.typ");
        record_recent(&path, folder_a.path(), "a.typ").unwrap();
        let before = std::fs::read_to_string(&path).unwrap();

        assert!(list_recent(&path, folder_b.path()).unwrap().is_empty());
        assert_eq!(std::fs::read_to_string(&path).unwrap(), before);
        assert_eq!(
            list_recent(&path, folder_a.path()).unwrap(),
            vec!["a.typ".to_string()]
        );

        record_recent(&path, folder_b.path(), "b.typ").unwrap();
        assert_eq!(
            list_recent(&path, folder_b.path()).unwrap(),
            vec!["b.typ".to_string()]
        );
        assert!(list_recent(&path, folder_a.path()).unwrap().is_empty());
    }

    #[test]
    fn changing_the_language_keeps_recent_notes() {
        let root = tempfile::tempdir().unwrap();
        let settings_dir = tempfile::tempdir().unwrap();
        let path = settings_dir.path().join("settings.json");
        write_note(root.path(), "a.typ");
        record_recent(&path, root.path(), "a.typ").unwrap();
        set_locale(&path, "en").unwrap();
        assert_eq!(load_settings(&path).unwrap().locale, "en");
        assert_eq!(
            list_recent(&path, root.path()).unwrap(),
            vec!["a.typ".to_string()]
        );
    }
}
