use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
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

/// One folder's recent notes. `stored_key` is the map key as it sits in
/// the file. `key` is that string normalized for lookup. `paths` is the
/// normalized list. `raw_list` is the array as stored, so a write that
/// touches a different folder can put this one back unchanged.
#[derive(Debug, Clone)]
struct FolderRecent {
    stored_key: String,
    key: String,
    paths: Vec<String>,
    raw_list: Vec<Value>,
    changed: bool,
}

impl FolderRecent {
    fn mark_changed(&mut self) {
        // A list we rewrite is stored under the normalized key.
        self.stored_key = self.key.clone();
        self.changed = true;
    }
}

/// Recents loaded from the settings file.
///
/// Accepted shapes are the `workspaces` map and the old single list
/// (`workspace` + `paths`). A missing field is an empty map.
/// `bad_shape` is set for every other value. The list read is the only
/// caller that reports it. Writers that own a different field leave the
/// original JSON in [`SettingsFile::object`].
#[derive(Debug, Clone)]
struct RecentNotes {
    bad_shape: bool,
    folders: Vec<FolderRecent>,
}

impl RecentNotes {
    fn valid_empty() -> Self {
        Self {
            bad_shape: false,
            folders: Vec::new(),
        }
    }

    fn bad() -> Self {
        Self {
            bad_shape: true,
            folders: Vec::new(),
        }
    }

    fn index_of(&self, key: &str) -> Option<usize> {
        self.folders.iter().position(|folder| folder.key == key)
    }

    /// The on-disk `recent_notes` object. Untouched folders keep the
    /// array they were loaded with, including entries this folder's
    /// writer is not allowed to clean.
    fn to_value(&self) -> Value {
        let mut workspaces = Map::new();
        for folder in &self.folders {
            let list = if folder.changed {
                Value::Array(folder.paths.iter().cloned().map(Value::String).collect())
            } else {
                Value::Array(folder.raw_list.clone())
            };
            let _ = workspaces.insert(folder.stored_key.clone(), list);
        }
        let mut recent = Map::new();
        let _ = recent.insert("workspaces".to_string(), Value::Object(workspaces));
        Value::Object(recent)
    }
}

/// The settings file as one JSON object.
///
/// Every writer loads this, changes only the fields it owns, and writes
/// the object back through [`files::write_atomically`]. `locale` and
/// `recent_notes` are the fields this module understands. Font fields
/// and anything else stay in `object` and ride along on every save.
#[derive(Debug, Clone)]
struct SettingsFile {
    locale: String,
    object: Map<String, Value>,
    recent: RecentNotes,
}

impl SettingsFile {
    fn new_default() -> Self {
        let mut object = Map::new();
        let _ = object.insert(
            "locale".to_string(),
            Value::String(DEFAULT_LOCALE.to_string()),
        );
        Self {
            locale: DEFAULT_LOCALE.to_string(),
            object,
            recent: RecentNotes::valid_empty(),
        }
    }
}

pub fn settings_path(config_dir: &Path) -> PathBuf {
    config_dir.join("settings.json")
}

pub fn load_settings(path: &Path) -> AppResult<Settings> {
    Ok(Settings {
        locale: load_file(path)?.locale,
    })
}

pub fn set_locale(path: &Path, locale: &str) -> AppResult<Settings> {
    if !LOCALES.contains(&locale) {
        return Err(AppError::BadLocale(locale.to_string()));
    }
    let mut file = load_file(path)?;
    file.locale = locale.to_string();
    let _ = file
        .object
        .insert("locale".to_string(), Value::String(file.locale.clone()));
    save_file(path, &file)?;
    Ok(Settings {
        locale: file.locale,
    })
}

/// Remember a note the student just opened. Newest first, duplicates
/// collapsed, capped at [`RECENT_LIMIT`]. Only the open folder's list
/// changes. An unknown recents shape counts as an empty map, so this
/// write still records the note.
pub fn record_recent(settings_path: &Path, root: &Path, relative: &str) -> AppResult<Vec<String>> {
    let relative = normalize_note(relative)?;
    let resolved = files::resolve_inside_root(root, &relative)?;
    if !is_typ_file(&resolved) {
        return Err(AppError::InvalidName(relative));
    }
    let mut file = load_file(settings_path)?;
    if file.recent.bad_shape {
        file.recent = RecentNotes::valid_empty();
    }
    let key = workspace_key(root)?;
    let listed = {
        let index = folder_index(&mut file.recent, &key);
        let folder = &mut file.recent.folders[index];
        folder.paths.retain(|path| !same_note(path, &relative));
        folder.paths.insert(0, relative);
        folder.paths.truncate(RECENT_LIMIT);
        folder.mark_changed();
        folder.paths.clone()
    };
    store_recent(&mut file);
    save_file(settings_path, &file)?;
    Ok(listed)
}

/// Recent notes for the open folder, newest first.
///
/// A path that is missing, escapes the folder, or is not a `.typ` file
/// is dropped from that folder's list. Other folders stay as stored.
/// An unknown recents shape is an error from this function only.
pub fn list_recent(settings_path: &Path, root: &Path) -> AppResult<Vec<String>> {
    let mut file = load_file(settings_path)?;
    if file.recent.bad_shape {
        return Err(AppError::Message(
            "recent notes are not in a known shape".to_string(),
        ));
    }
    let key = workspace_key(root)?;
    let Some(index) = file.recent.index_of(&key) else {
        return Ok(Vec::new());
    };
    let cleaned = clean_existing(root, &file.recent.folders[index].paths);
    if !raw_matches(&file.recent.folders[index].raw_list, &cleaned) {
        file.recent.folders[index].paths = cleaned.clone();
        file.recent.folders[index].mark_changed();
        store_recent(&mut file);
        // AC-3: the cleaned paths are already decided here. Writing them
        // back is a separate step. If that write fails, the cleaned paths
        // are still returned. `list_recent_notes` returns `Vec<String>`,
        // so the page cannot also show `recent_failed` for this write.
        // `recent_failed` stays the message for a list read that fails:
        // broken settings JSON, or a recents value that is not one of the
        // two accepted shapes.
        let _ = save_file(settings_path, &file);
    }
    Ok(cleaned)
}

/// Follow a rename or move inside the open folder. Entries in every
/// other folder stay as stored. An unknown recents shape is left
/// untouched so the list read can still report it.
pub fn retarget_recent(settings_path: &Path, root: &Path, from: &str, to: &str) -> AppResult<()> {
    let from = normalize_note(from)?;
    let to = normalize_note(to)?;
    let mut file = load_file(settings_path)?;
    if file.recent.bad_shape {
        return Ok(());
    }
    let key = workspace_key(root)?;
    let Some(index) = file.recent.index_of(&key) else {
        return Ok(());
    };
    if !retarget_list(&mut file.recent.folders[index].paths, &from, &to) {
        return Ok(());
    }
    file.recent.folders[index].mark_changed();
    store_recent(&mut file);
    save_file(settings_path, &file)
}

/// The one loader for language, recents, and later font writes.
fn load_file(path: &Path) -> AppResult<SettingsFile> {
    match std::fs::read_to_string(path) {
        Ok(text) => parse_settings(&text),
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => {
            let file = SettingsFile::new_default();
            save_file(path, &file)?;
            Ok(file)
        }
        Err(err) => Err(AppError::io(path, err)),
    }
}

fn parse_settings(text: &str) -> AppResult<SettingsFile> {
    let value: Value = serde_json::from_str(text)
        .map_err(|err| AppError::Message(format!("settings file is broken: {err}")))?;
    let mut object = match value {
        Value::Object(object) => object,
        _ => {
            return Err(AppError::Message(
                "settings file is broken: expected an object".to_string(),
            ));
        }
    };
    let mut locale = match object.get("locale") {
        Some(Value::String(locale)) => locale.clone(),
        Some(_) => {
            return Err(AppError::Message(
                "settings file is broken: locale is not a string".to_string(),
            ));
        }
        None => {
            return Err(AppError::Message(
                "settings file is broken: missing field `locale`".to_string(),
            ));
        }
    };
    if !LOCALES.contains(&locale.as_str()) {
        locale = DEFAULT_LOCALE.to_string();
        let _ = object.insert("locale".to_string(), Value::String(locale.clone()));
    }
    let recent = match object.get("recent_notes") {
        None => RecentNotes::valid_empty(),
        Some(recent) => parse_recent(recent),
    };
    Ok(SettingsFile {
        locale,
        object,
        recent,
    })
}

fn parse_recent(value: &Value) -> RecentNotes {
    let Some(object) = value.as_object() else {
        return RecentNotes::bad();
    };
    // When `workspaces` is present it is the whole map. Old fields beside
    // it are ignored, not merged in.
    if object.contains_key("workspaces") {
        return parse_workspaces(object);
    }
    parse_legacy(object)
}

fn parse_workspaces(object: &Map<String, Value>) -> RecentNotes {
    let Some(map) = object.get("workspaces").and_then(Value::as_object) else {
        return RecentNotes::bad();
    };
    let mut folders = Vec::new();
    for (stored_key, list) in map {
        let Some(entries) = list.as_array() else {
            return RecentNotes::bad();
        };
        let key = folder_key_from_stored(stored_key);
        if key.is_empty() {
            continue;
        }
        folders.push(FolderRecent {
            stored_key: stored_key.clone(),
            key,
            paths: normalize_list(entries),
            raw_list: entries.clone(),
            changed: false,
        });
    }
    RecentNotes {
        bad_shape: false,
        folders,
    }
}

fn parse_legacy(object: &Map<String, Value>) -> RecentNotes {
    let workspace = match object.get("workspace") {
        None => "",
        Some(Value::String(workspace)) => workspace.as_str(),
        Some(_) => return RecentNotes::bad(),
    };
    // An empty or missing folder value is an empty map. Paths are not
    // read, so a bad `paths` value here is not a broken shape.
    let key = folder_key_from_stored(workspace);
    if key.is_empty() {
        return RecentNotes::valid_empty();
    }
    let entries = match object.get("paths") {
        None => Vec::new(),
        Some(Value::Array(entries)) => entries.clone(),
        Some(_) => return RecentNotes::bad(),
    };
    RecentNotes {
        bad_shape: false,
        folders: vec![FolderRecent {
            stored_key: key.clone(),
            key,
            paths: normalize_list(&entries),
            raw_list: entries,
            changed: false,
        }],
    }
}

fn store_recent(file: &mut SettingsFile) {
    let _ = file
        .object
        .insert("recent_notes".to_string(), file.recent.to_value());
}

fn save_file(path: &Path, file: &SettingsFile) -> AppResult<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|err| AppError::io(parent, err))?;
    }
    let text = serde_json::to_string_pretty(&file.object)
        .map_err(|err| AppError::Message(err.to_string()))?;
    files::write_atomically(path, format!("{text}\n").as_bytes())
}

fn folder_index(recent: &mut RecentNotes, key: &str) -> usize {
    if let Some(index) = recent.index_of(key) {
        return index;
    }
    recent.folders.push(FolderRecent {
        stored_key: key.to_string(),
        key: key.to_string(),
        paths: Vec::new(),
        raw_list: Vec::new(),
        changed: false,
    });
    recent.folders.len() - 1
}

/// Live folder identity. Canonicalize first so the key is absolute,
/// then apply the same string rule as a stored key.
fn workspace_key(root: &Path) -> AppResult<String> {
    let canonical = files::canonical_root(root)?;
    Ok(folder_key_from_stored(&canonical.to_string_lossy()))
}

/// Folder identity from a path string, with no disk access.
///
/// Slashes are made forward, a trailing slash is removed, a `\\?\`
/// prefix is removed, and ASCII letters are lowercased. This does not
/// turn a relative string into an absolute path and does not resolve
/// `.` or `..`, so a folder that is gone can still be keyed from the
/// text the file stored. A live folder is canonicalized first
/// ([`workspace_key`]).
fn folder_key_from_stored(raw: &str) -> String {
    let forward = raw.trim().replace('\\', "/");
    let without_prefix = strip_verbatim_prefix(&forward);
    let mut text = without_prefix;
    while text.len() > 1 && text.ends_with('/') {
        text.pop();
    }
    text.to_ascii_lowercase()
}

fn strip_verbatim_prefix(forward: &str) -> String {
    let unc = "//?/unc/";
    let verbatim = "//?/";
    if forward.len() >= unc.len() && forward[..unc.len()].eq_ignore_ascii_case(unc) {
        return format!("//{}", &forward[unc.len()..]);
    }
    if forward.len() >= verbatim.len() && forward[..verbatim.len()].eq_ignore_ascii_case(verbatim) {
        return forward[verbatim.len()..].to_string();
    }
    forward.to_string()
}

fn normalize_list(entries: &[Value]) -> Vec<String> {
    let mut kept = Vec::new();
    for entry in entries {
        let Some(text) = entry.as_str() else {
            continue;
        };
        let Ok(normalized) = normalize_note(text) else {
            continue;
        };
        if kept
            .iter()
            .any(|item: &String| same_note(item, &normalized))
        {
            continue;
        }
        kept.push(normalized);
        if kept.len() == RECENT_LIMIT {
            break;
        }
    }
    kept
}

fn raw_matches(raw_list: &[Value], cleaned: &[String]) -> bool {
    raw_list.len() == cleaned.len()
        && raw_list
            .iter()
            .zip(cleaned)
            .all(|(value, path)| value.as_str() == Some(path.as_str()))
}

fn clean_existing(root: &Path, paths: &[String]) -> Vec<String> {
    let mut kept = Vec::new();
    for path in paths {
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
        if kept.len() == RECENT_LIMIT {
            break;
        }
    }
    kept
}

fn retarget_list(paths: &mut Vec<String>, from: &str, to: &str) -> bool {
    let prefix = format!("{from}/");
    let mut changed = false;
    for path in paths.iter_mut() {
        if same_note(path, from) {
            if *path != to {
                *path = to.to_string();
                changed = true;
            }
            continue;
        }
        let Some(rest) = strip_prefix_ignore_ascii_case(path, &prefix) else {
            continue;
        };
        let next = format!("{to}/{rest}");
        if *path != next {
            *path = next;
            changed = true;
        }
    }
    let deduped = dedupe_capped(paths);
    if deduped != *paths {
        *paths = deduped;
        changed = true;
    }
    changed
}

fn dedupe_capped(paths: &[String]) -> Vec<String> {
    let mut kept = Vec::new();
    for path in paths {
        if kept.iter().any(|item: &String| same_note(item, path)) {
            continue;
        }
        kept.push(path.clone());
        if kept.len() == RECENT_LIMIT {
            break;
        }
    }
    kept
}

fn strip_prefix_ignore_ascii_case<'a>(path: &'a str, prefix: &str) -> Option<&'a str> {
    let head = path.get(..prefix.len())?;
    if head.eq_ignore_ascii_case(prefix) {
        Some(&path[prefix.len()..])
    } else {
        None
    }
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

    // covers: AC-10, broken settings JSON is still an error for every reader
    #[test]
    fn a_broken_settings_file_is_an_error_not_a_silent_guess() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("settings.json");
        let root = tempfile::tempdir().unwrap();
        let broken = "{ broken";
        std::fs::write(&path, broken).unwrap();
        write_note(root.path(), "a.typ");
        assert!(load_settings(&path).is_err());
        assert!(list_recent(&path, root.path()).is_err());
        assert!(set_locale(&path, "en").is_err());
        assert!(record_recent(&path, root.path(), "a.typ").is_err());
        assert_eq!(std::fs::read_to_string(&path).unwrap(), broken);
    }

    #[test]
    fn an_unknown_language_in_the_file_falls_back_to_polish() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("settings.json");
        std::fs::write(&path, "{\"locale\":\"de\"}\n").unwrap();
        assert_eq!(load_settings(&path).unwrap().locale, "pl");
    }

    // covers: AC-8, AC-10, a settings file with no recent_notes field still loads
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

    fn read_settings(path: &Path) -> serde_json::Value {
        serde_json::from_str(&std::fs::read_to_string(path).unwrap()).unwrap()
    }

    // covers: AC-8, a stored folder string is keyed without touching disk
    #[test]
    fn a_stored_folder_string_normalizes_without_canonicalizing() {
        assert_eq!(
            folder_key_from_stored("\\\\?\\C:\\Users\\DOMINIK\\Notes\\"),
            "c:/users/dominik/notes"
        );
        assert_eq!(
            folder_key_from_stored("C:/Users/Dominik/Notes/"),
            "c:/users/dominik/notes"
        );
        assert_eq!(
            folder_key_from_stored("//?/C:/Users/Dominik/Notes/"),
            "c:/users/dominik/notes"
        );
        assert_eq!(
            folder_key_from_stored("\\\\?\\UNC\\Server\\Share\\Notes\\"),
            "//server/share/notes"
        );
        assert_eq!(folder_key_from_stored("   "), "");
        assert_eq!(folder_key_from_stored(""), "");
    }

    // covers: AC-1, recording order, dedup, newest spelling, and the cap of 10
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

        write_note(root.path(), "Dir/Note.typ");
        let slashed = record_recent(&path, root.path(), "Dir\\Note.typ").unwrap();
        assert_eq!(slashed[0], "Dir/Note.typ");
        let folded = record_recent(&path, root.path(), "dir/note.typ").unwrap();
        assert_eq!(folded[0], "dir/note.typ");
        assert_eq!(
            folded
                .iter()
                .filter(|item| same_note(item, "dir/note.typ"))
                .count(),
            1
        );

        let key = workspace_key(root.path()).unwrap();
        let mut value = read_settings(&path);
        value["recent_notes"]["workspaces"][&key] = serde_json::json!(["A.typ", "a.typ", "b.typ"]);
        std::fs::write(&path, format!("{value}\n")).unwrap();
        let deduped = list_recent(&path, root.path()).unwrap();
        assert_eq!(deduped, vec!["A.typ", "b.typ"]);

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

    // covers: AC-1, each folder is capped at 10 on its own
    #[test]
    fn each_folder_list_is_capped_at_ten() {
        let folder_a = tempfile::tempdir().unwrap();
        let folder_b = tempfile::tempdir().unwrap();
        let settings_dir = tempfile::tempdir().unwrap();
        let path = settings_dir.path().join("settings.json");
        std::fs::write(&path, "{\"locale\":\"pl\"}\n").unwrap();
        for index in 1..=12 {
            let name = format!("a{index:02}.typ");
            write_note(folder_a.path(), &name);
            record_recent(&path, folder_a.path(), &name).unwrap();
        }
        let mut names_b = Vec::new();
        for index in 1..=15 {
            let name = format!("b{index:02}.typ");
            write_note(folder_b.path(), &name);
            names_b.push(Value::String(name));
        }
        names_b.reverse();
        let mut value = read_settings(&path);
        let key_b = workspace_key(folder_b.path()).unwrap();
        value["recent_notes"]["workspaces"][&key_b] = Value::Array(names_b);
        std::fs::write(&path, format!("{value}\n")).unwrap();

        let listed_b = list_recent(&path, folder_b.path()).unwrap();
        assert_eq!(listed_b.len(), RECENT_LIMIT);
        assert_eq!(listed_b[0], "b15.typ");
        assert_eq!(listed_b[9], "b06.typ");

        let listed_a = list_recent(&path, folder_a.path()).unwrap();
        assert_eq!(listed_a.len(), RECENT_LIMIT);
        assert_eq!(listed_a[0], "a12.typ");
        assert_eq!(listed_a[9], "a03.typ");
    }

    // covers: AC-3, a missing note, a non-note, and a path that climbs out are dropped
    #[test]
    fn stale_and_escaping_recent_entries_are_dropped() {
        let root = tempfile::tempdir().unwrap();
        let settings_dir = tempfile::tempdir().unwrap();
        let path = settings_dir.path().join("settings.json");
        write_note(root.path(), "keep.typ");
        write_note(root.path(), "gone.typ");
        std::fs::write(root.path().join("notes.txt"), "x").unwrap();
        record_recent(&path, root.path(), "keep.typ").unwrap();
        record_recent(&path, root.path(), "gone.typ").unwrap();
        std::fs::remove_file(root.path().join("gone.typ")).unwrap();

        let key = workspace_key(root.path()).unwrap();
        let mut value = read_settings(&path);
        let list = value["recent_notes"]["workspaces"][&key]
            .as_array_mut()
            .unwrap();
        list.insert(0, serde_json::json!("../secret.typ"));
        list.insert(1, serde_json::json!(12));
        list.push(serde_json::json!("notes.txt"));
        value["recent_notes"]["workspaces"]["C:\\Other\\Subject\\"] =
            serde_json::json!(["gone.typ", "Gone.typ"]);
        std::fs::write(&path, format!("{value}\n")).unwrap();

        let listed = list_recent(&path, root.path()).unwrap();
        assert_eq!(listed, vec!["keep.typ"]);
        let cleaned = read_settings(&path);
        let open = &cleaned["recent_notes"]["workspaces"][&key];
        assert_eq!(open, &serde_json::json!(["keep.typ"]));
        assert_eq!(
            cleaned["recent_notes"]["workspaces"]["C:\\Other\\Subject\\"],
            serde_json::json!(["gone.typ", "Gone.typ"])
        );
        assert!(!root.path().parent().unwrap().join("secret.typ").exists());
    }

    // covers: AC-3, a failed write back still returns the cleaned paths
    #[test]
    fn listing_returns_cleaned_paths_when_the_write_back_fails() {
        let root = tempfile::tempdir().unwrap();
        let settings_dir = tempfile::tempdir().unwrap();
        let path = settings_dir.path().join("settings.json");
        write_note(root.path(), "keep.typ");
        write_note(root.path(), "gone.typ");
        record_recent(&path, root.path(), "keep.typ").unwrap();
        record_recent(&path, root.path(), "gone.typ").unwrap();
        std::fs::remove_file(root.path().join("gone.typ")).unwrap();

        let mut value = read_settings(&path);
        value["source_font"] = serde_json::json!("Kept Font");
        value["recent_notes"]["workspaces"]["D:\\Other\\Subject\\"] =
            serde_json::json!(["stay.typ"]);
        std::fs::write(&path, format!("{value}\n")).unwrap();
        let before = std::fs::read(&path).unwrap();

        let mut perms = std::fs::metadata(&path).unwrap().permissions();
        perms.set_readonly(true);
        std::fs::set_permissions(&path, perms).unwrap();
        let _clear = ClearReadonly(path.clone());

        if !replace_is_refused(&path) {
            eprintln!("skip: this platform did not refuse a write over a read only settings file");
            return;
        }

        let listed = list_recent(&path, root.path()).unwrap();
        assert_eq!(listed, vec!["keep.typ"]);
        assert_eq!(
            std::fs::read(&path).unwrap(),
            before,
            "a failed write back must leave the settings file unchanged"
        );
    }

    // covers: AC-1, AC-2, AC-10, recording in one folder must not wipe the other
    #[test]
    fn each_folder_keeps_its_own_recent_list() {
        let folder_a = tempfile::tempdir().unwrap();
        let folder_b = tempfile::tempdir().unwrap();
        let settings_dir = tempfile::tempdir().unwrap();
        let path = settings_dir.path().join("settings.json");
        std::fs::write(
            &path,
            "{\"locale\":\"pl\",\"source_font\":\"Kept Font\",\"render_font\":\"Inter\"}\n",
        )
        .unwrap();
        write_note(folder_a.path(), "a1.typ");
        write_note(folder_a.path(), "a2.typ");
        write_note(folder_b.path(), "b1.typ");
        write_note(folder_b.path(), "b2.typ");

        record_recent(&path, folder_a.path(), "a1.typ").unwrap();
        let before = std::fs::read_to_string(&path).unwrap();
        assert!(list_recent(&path, folder_b.path()).unwrap().is_empty());
        assert_eq!(std::fs::read_to_string(&path).unwrap(), before);
        assert_eq!(list_recent(&path, folder_a.path()).unwrap(), vec!["a1.typ"]);

        record_recent(&path, folder_b.path(), "b1.typ").unwrap();
        record_recent(&path, folder_a.path(), "a2.typ").unwrap();
        assert_eq!(
            list_recent(&path, folder_a.path()).unwrap(),
            vec!["a2.typ", "a1.typ"]
        );
        assert_eq!(list_recent(&path, folder_b.path()).unwrap(), vec!["b1.typ"]);

        record_recent(&path, folder_b.path(), "b2.typ").unwrap();
        assert_eq!(
            list_recent(&path, folder_a.path()).unwrap(),
            vec!["a2.typ", "a1.typ"]
        );
        assert_eq!(
            list_recent(&path, folder_b.path()).unwrap(),
            vec!["b2.typ", "b1.typ"]
        );

        let value = read_settings(&path);
        assert_eq!(value["locale"], "pl");
        assert_eq!(value["source_font"], "Kept Font");
        assert_eq!(value["render_font"], "Inter");
        assert!(value["recent_notes"].get("paths").is_none());
        assert!(value["recent_notes"].get("workspace").is_none());
        let key_a = workspace_key(folder_a.path()).unwrap();
        let key_b = workspace_key(folder_b.path()).unwrap();
        assert_ne!(key_a, key_b);
        assert_eq!(
            value["recent_notes"]["workspaces"][&key_a],
            serde_json::json!(["a2.typ", "a1.typ"])
        );
        assert_eq!(
            value["recent_notes"]["workspaces"][&key_b],
            serde_json::json!(["b2.typ", "b1.typ"])
        );

        set_locale(&path, "en").unwrap();
        assert_eq!(load_settings(&path).unwrap().locale, "en");
        assert_eq!(
            list_recent(&path, folder_a.path()).unwrap(),
            vec!["a2.typ", "a1.typ"]
        );
        assert_eq!(
            list_recent(&path, folder_b.path()).unwrap(),
            vec!["b2.typ", "b1.typ"]
        );
        let value = read_settings(&path);
        assert_eq!(value["source_font"], "Kept Font");
        assert_eq!(value["render_font"], "Inter");
    }

    // covers: AC-8, AC-10, the old single list migrates under its folder
    #[test]
    fn an_old_single_list_migrates_under_its_folder() {
        let root = tempfile::tempdir().unwrap();
        let other = tempfile::tempdir().unwrap();
        let settings_dir = tempfile::tempdir().unwrap();
        let path = settings_dir.path().join("settings.json");
        write_note(root.path(), "Sub/A.typ");
        write_note(root.path(), "b.typ");

        let canonical = files::canonical_root(root.path()).unwrap();
        let native = canonical.to_string_lossy().replace('/', "\\");
        let stored_workspace = format!("\\\\?\\{}\\", native.to_ascii_uppercase());
        assert_eq!(
            folder_key_from_stored(&stored_workspace),
            workspace_key(root.path()).unwrap()
        );
        let body = serde_json::json!({
            "locale": "en",
            "source_font": "Kept Font",
            "render_font": "Inter",
            "recent_notes": {
                "workspace": stored_workspace,
                "paths": ["Sub\\A.typ", "sub/a.typ", 4, "", "../nope.typ", "b.typ", "missing.typ"]
            }
        });
        std::fs::write(&path, format!("{body}\n")).unwrap();

        assert_eq!(load_settings(&path).unwrap().locale, "en");
        let before = std::fs::read_to_string(&path).unwrap();
        assert!(list_recent(&path, other.path()).unwrap().is_empty());
        assert_eq!(std::fs::read_to_string(&path).unwrap(), before);

        let listed = list_recent(&path, root.path()).unwrap();
        assert_eq!(listed, vec!["Sub/A.typ", "b.typ"]);
        let saved = read_settings(&path);
        assert_eq!(saved["locale"], "en");
        assert_eq!(saved["source_font"], "Kept Font");
        assert_eq!(saved["render_font"], "Inter");
        let key = workspace_key(root.path()).unwrap();
        assert_eq!(
            saved["recent_notes"]["workspaces"][&key],
            serde_json::json!(["Sub/A.typ", "b.typ"])
        );
        assert!(saved["recent_notes"].get("paths").is_none());
        assert!(saved["recent_notes"].get("workspace").is_none());

        set_locale(&path, "pl").unwrap();
        assert_eq!(load_settings(&path).unwrap().locale, "pl");
        assert_eq!(
            list_recent(&path, root.path()).unwrap(),
            vec!["Sub/A.typ", "b.typ"]
        );
        let saved = read_settings(&path);
        assert_eq!(saved["source_font"], "Kept Font");
        assert_eq!(saved["render_font"], "Inter");
    }

    // covers: AC-8, an old list with no folder value is an empty map
    #[test]
    fn an_old_shape_without_a_folder_is_an_empty_map() {
        let root = tempfile::tempdir().unwrap();
        let settings_dir = tempfile::tempdir().unwrap();
        let path = settings_dir.path().join("settings.json");
        let original = "{\"locale\":\"en\",\"source_font\":\"Kept\",\"recent_notes\":{\"paths\":[\"a.typ\"]}}\n";
        std::fs::write(&path, original).unwrap();
        assert_eq!(load_settings(&path).unwrap().locale, "en");
        assert!(list_recent(&path, root.path()).unwrap().is_empty());
        assert_eq!(std::fs::read_to_string(&path).unwrap(), original);

        let blank = "{\"locale\":\"en\",\"recent_notes\":{\"workspace\":\"\",\"paths\":{\"not\":\"a list\"}}}\n";
        std::fs::write(&path, blank).unwrap();
        assert!(list_recent(&path, root.path()).unwrap().is_empty());
        assert_eq!(load_settings(&path).unwrap().locale, "en");
        assert_eq!(std::fs::read_to_string(&path).unwrap(), blank);
    }

    // covers: AC-8, AC-2, a stored map key matches after the string rule
    #[test]
    fn a_stored_folder_key_matches_after_the_string_rule() {
        let root = tempfile::tempdir().unwrap();
        let settings_dir = tempfile::tempdir().unwrap();
        let path = settings_dir.path().join("settings.json");
        write_note(root.path(), "a.typ");
        write_note(root.path(), "next.typ");
        let key = workspace_key(root.path()).unwrap();
        let weird = format!("{}\\", key.replace('/', "\\").to_ascii_uppercase());
        let body = serde_json::json!({
            "locale": "pl",
            "source_font": "Kept Font",
            "recent_notes": {
                "workspaces": { weird.clone(): ["a.typ"] }
            }
        });
        std::fs::write(&path, format!("{body}\n")).unwrap();

        assert_eq!(list_recent(&path, root.path()).unwrap(), vec!["a.typ"]);
        let saved = read_settings(&path);
        assert!(saved["recent_notes"]["workspaces"].get(&weird).is_some());

        record_recent(&path, root.path(), "next.typ").unwrap();
        let saved = read_settings(&path);
        assert!(saved["recent_notes"]["workspaces"].get(&weird).is_none());
        assert_eq!(
            saved["recent_notes"]["workspaces"][&key],
            serde_json::json!(["next.typ", "a.typ"])
        );
        assert_eq!(saved["source_font"], "Kept Font");
    }

    // covers: AC-10, workspaces is the whole map and is not merged with old fields
    #[test]
    fn a_workspaces_map_is_not_merged_with_old_fields() {
        let folder_a = tempfile::tempdir().unwrap();
        let folder_b = tempfile::tempdir().unwrap();
        let settings_dir = tempfile::tempdir().unwrap();
        let path = settings_dir.path().join("settings.json");
        write_note(folder_a.path(), "a.typ");
        write_note(folder_b.path(), "b.typ");
        let key_a = workspace_key(folder_a.path()).unwrap();
        let key_b = workspace_key(folder_b.path()).unwrap();
        let body = serde_json::json!({
            "locale": "pl",
            "recent_notes": {
                "workspaces": { key_a: ["a.typ"] },
                "workspace": key_b,
                "paths": ["b.typ"]
            }
        });
        std::fs::write(&path, format!("{body}\n")).unwrap();
        assert_eq!(list_recent(&path, folder_a.path()).unwrap(), vec!["a.typ"]);
        assert!(list_recent(&path, folder_b.path()).unwrap().is_empty());
    }

    // covers: AC-10, a recents value other than the two shapes
    #[test]
    fn a_third_recent_shape_is_reported_only_by_the_list_read() {
        let shapes = [
            serde_json::json!("nope"),
            serde_json::json!(["a.typ"]),
            serde_json::json!(1),
            serde_json::json!(null),
            serde_json::json!({"workspaces": ["a.typ"]}),
            serde_json::json!({"workspaces": {"c:/temp": "a.typ"}}),
            serde_json::json!({"workspace": "C:/Notes", "paths": "a.typ"}),
            serde_json::json!({"workspace": 4, "paths": ["a.typ"]}),
        ];
        for recent in shapes {
            let root = tempfile::tempdir().unwrap();
            let settings_dir = tempfile::tempdir().unwrap();
            let path = settings_dir.path().join("settings.json");
            let body = serde_json::json!({
                "locale": "en",
                "source_font": "Kept Font",
                "render_font": "Inter",
                "future_field": {"kept": true},
                "recent_notes": recent.clone(),
            });
            let original = format!("{body}\n");
            std::fs::write(&path, &original).unwrap();
            assert_eq!(load_settings(&path).unwrap().locale, "en", "{recent}");
            assert_eq!(std::fs::read_to_string(&path).unwrap(), original);
            assert!(list_recent(&path, root.path()).is_err(), "{recent}");
            assert_eq!(std::fs::read_to_string(&path).unwrap(), original);
            set_locale(&path, "pl").unwrap();
            let saved = read_settings(&path);
            assert_eq!(saved["locale"], "pl", "{recent}");
            assert_eq!(saved["source_font"], "Kept Font", "{recent}");
            assert_eq!(saved["render_font"], "Inter", "{recent}");
            assert_eq!(saved["future_field"]["kept"], true, "{recent}");
            assert_eq!(saved["recent_notes"], recent, "{recent}");
            assert!(list_recent(&path, root.path()).is_err(), "{recent}");
        }

        let root = tempfile::tempdir().unwrap();
        let settings_dir = tempfile::tempdir().unwrap();
        let path = settings_dir.path().join("settings.json");
        write_note(root.path(), "a.typ");
        let body = serde_json::json!({
            "locale": "en",
            "source_font": "Kept Font",
            "render_font": "Inter",
            "recent_notes": ["nope"],
        });
        std::fs::write(&path, format!("{body}\n")).unwrap();
        assert_eq!(
            record_recent(&path, root.path(), "a.typ").unwrap(),
            vec!["a.typ"]
        );
        assert_eq!(load_settings(&path).unwrap().locale, "en");
        assert_eq!(list_recent(&path, root.path()).unwrap(), vec!["a.typ"]);
        let saved = read_settings(&path);
        assert_eq!(saved["source_font"], "Kept Font");
        assert_eq!(saved["render_font"], "Inter");
        let key = workspace_key(root.path()).unwrap();
        assert_eq!(
            saved["recent_notes"]["workspaces"][&key],
            serde_json::json!(["a.typ"])
        );
    }

    // covers: feature 9, a settings write replaces the whole file and leaves no temp file
    #[test]
    fn a_settings_write_leaves_no_temp_file() {
        let root = tempfile::tempdir().unwrap();
        let settings_dir = tempfile::tempdir().unwrap();
        let path = settings_dir.path().join("settings.json");
        write_note(root.path(), "a.typ");
        record_recent(&path, root.path(), "a.typ").unwrap();
        assert!(!settings_dir.path().join("settings.json.tmp").exists());
        assert_eq!(load_settings(&path).unwrap().locale, "pl");
    }

    // covers: AC-4, a rename retargets only the open folder
    #[test]
    fn recent_notes_follow_a_rename() {
        let root = tempfile::tempdir().unwrap();
        let other = tempfile::tempdir().unwrap();
        let settings_dir = tempfile::tempdir().unwrap();
        let path = settings_dir.path().join("settings.json");
        write_note(root.path(), "old.typ");
        write_note(root.path(), "keep.typ");
        write_note(root.path(), "Dir/Child.typ");
        write_note(other.path(), "stay.typ");
        record_recent(&path, root.path(), "old.typ").unwrap();
        record_recent(&path, root.path(), "keep.typ").unwrap();
        record_recent(&path, root.path(), "Dir/Child.typ").unwrap();
        record_recent(&path, other.path(), "stay.typ").unwrap();

        let weird = "D:\\Courses\\OLD\\";
        let mut value = read_settings(&path);
        value["recent_notes"]["workspaces"][weird] =
            serde_json::json!(["stay-raw.typ", "stay-raw.typ"]);
        std::fs::write(&path, format!("{value}\n")).unwrap();

        retarget_recent(&path, other.path(), "keep.typ", "moved.typ").unwrap();
        assert_eq!(
            list_recent(&path, root.path()).unwrap(),
            vec!["Dir/Child.typ", "keep.typ", "old.typ"]
        );
        assert_eq!(list_recent(&path, other.path()).unwrap(), vec!["stay.typ"]);

        retarget_recent(&path, root.path(), "old.typ", "nested/new.typ").unwrap();
        retarget_recent(&path, root.path(), "dir", "renamed").unwrap();
        write_note(root.path(), "nested/new.typ");
        write_note(root.path(), "renamed/Child.typ");
        assert_eq!(
            list_recent(&path, root.path()).unwrap(),
            vec![
                "renamed/Child.typ".to_string(),
                "keep.typ".to_string(),
                "nested/new.typ".to_string()
            ]
        );
        assert_eq!(list_recent(&path, other.path()).unwrap(), vec!["stay.typ"]);
        let saved = read_settings(&path);
        assert_eq!(
            saved["recent_notes"]["workspaces"][weird],
            serde_json::json!(["stay-raw.typ", "stay-raw.typ"])
        );
    }

    // covers: AC-10, changing the language keeps recent notes
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

    /// Clears the read only bit on drop so the temp directory can be removed.
    struct ClearReadonly(PathBuf);

    impl Drop for ClearReadonly {
        fn drop(&mut self) {
            let Ok(meta) = std::fs::metadata(&self.0) else {
                return;
            };
            let mut perms = meta.permissions();
            // Windows uses this bit as the read only attribute. Clearing it
            // lets the temp directory remove the file. Clippy's warning is
            // about Unix mode bits, which this app does not run on.
            #[allow(clippy::permissions_set_readonly_false)]
            {
                perms.set_readonly(false);
            }
            let _ = std::fs::set_permissions(&self.0, perms);
        }
    }

    /// True when replacing `path` is refused. A platform that allows the
    /// replace cannot force the write back failure this test needs.
    fn replace_is_refused(path: &Path) -> bool {
        let mut temp_name = path.as_os_str().to_owned();
        temp_name.push(format!(".probe-{}.tmp", std::process::id()));
        let probe = PathBuf::from(temp_name);
        if std::fs::write(&probe, b"probe").is_err() {
            return false;
        }
        let refused = std::fs::rename(&probe, path).is_err();
        let _ = std::fs::remove_file(&probe);
        refused
    }
}
