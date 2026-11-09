use std::path::{Path, PathBuf};
use std::sync::Arc;

use tauri::{AppHandle, State};
use tauri_plugin_dialog::DialogExt;

use crate::AppState;
use crate::error::{AppError, AppResult};
use crate::files::{self, Note, SAMPLE_PATH, SAMPLE_TEXT, SearchHit, TreeNode, WorkspaceInfo};
use crate::settings::{self, Settings};
use crate::templates;
use crate::typst_engine::{Engine, RenderResult};

fn root_or_err(state: &AppState) -> Result<PathBuf, String> {
    state
        .workspace_root
        .lock()
        .map_err(|_| "workspace lock was poisoned".to_string())?
        .clone()
        .ok_or_else(|| AppError::NoWorkspace.to_string())
}

fn baselines(state: &AppState) -> Result<std::sync::MutexGuard<'_, files::NoteBaselines>, String> {
    state
        .note_baselines
        .lock()
        .map_err(|_| "note baseline lock was poisoned".to_string())
}

fn template_baselines(
    state: &AppState,
) -> Result<std::sync::MutexGuard<'_, templates::TemplateBaselines>, String> {
    state
        .template_baselines
        .lock()
        .map_err(|_| "template baseline lock was poisoned".to_string())
}

/// A new note needs a settings file that can be read. This does not create one.
fn locale_for_create(state: &AppState) -> Result<String, String> {
    let path = settings_file(state)?;
    Ok(settings::load_settings_for_create(&path)
        .map_err(String::from)?
        .locale)
}

fn remember_note(state: &AppState, note: &Note) -> Result<(), String> {
    baselines(state)?.remember(&note.path, note.fingerprint.clone());
    Ok(())
}

fn settings_file(state: &AppState) -> Result<PathBuf, String> {
    state
        .settings_file
        .lock()
        .map_err(|_| "settings lock was poisoned".to_string())?
        .clone()
        .ok_or_else(|| AppError::SettingsNotReady.to_string())
}

/// Recording a recent note is best effort. A broken or locked settings
/// file must never fail opening or creating the note itself.
fn remember_opened(state: &AppState, root: &Path, relative: &str) {
    let Ok(path) = settings_file(state) else {
        return;
    };
    let _ = settings::record_recent(&path, root, relative);
}

#[tauri::command]
#[specta::specta]
pub fn open_workspace(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<Option<WorkspaceInfo>, String> {
    let picked = app.dialog().file().blocking_pick_folder();
    let Some(picked) = picked else {
        return Ok(None);
    };
    let path = picked
        .into_path()
        .map_err(|err| AppError::Message(err.to_string()).to_string())?;
    let root = files::canonical_root(&path).map_err(String::from)?;
    let notes = files::list_notes(&root).map_err(String::from)?;
    let root_name = root
        .file_name()
        .map(|name| name.to_string_lossy().to_string())
        .unwrap_or_else(|| root.to_string_lossy().to_string());
    {
        let mut slot = state
            .workspace_root
            .lock()
            .map_err(|_| "workspace lock was poisoned".to_string())?;
        *slot = Some(root);
    }
    baselines(&state)?.clear();
    Ok(Some(WorkspaceInfo { root_name, notes }))
}

#[tauri::command]
#[specta::specta]
pub fn list_tree(state: State<'_, AppState>) -> Result<Vec<TreeNode>, String> {
    let root = root_or_err(&state)?;
    files::list_tree(&root).map_err(String::from)
}

#[tauri::command]
#[specta::specta]
pub fn create_note(
    state: State<'_, AppState>,
    parent: String,
    name: String,
) -> Result<Note, String> {
    let root = root_or_err(&state)?;
    let note = files::create_note(&root, &parent, &name).map_err(String::from)?;
    remember_note(&state, &note)?;
    remember_opened(&state, &root, &note.path);
    Ok(note)
}

#[tauri::command]
#[specta::specta]
pub fn create_blank_note(state: State<'_, AppState>, parent: String) -> Result<Note, String> {
    let root = root_or_err(&state)?;
    let locale = locale_for_create(&state)?;
    let note = templates::create_blank_note(&root, &parent, &locale).map_err(String::from)?;
    remember_note(&state, &note)?;
    remember_opened(&state, &root, &note.path);
    Ok(note)
}

#[tauri::command]
#[specta::specta]
pub fn create_folder(
    state: State<'_, AppState>,
    parent: String,
    name: String,
) -> Result<String, String> {
    let root = root_or_err(&state)?;
    files::create_folder(&root, &parent, &name).map_err(String::from)
}

#[tauri::command]
#[specta::specta]
pub fn rename_entry(
    state: State<'_, AppState>,
    from: String,
    to: String,
) -> Result<String, String> {
    let root = root_or_err(&state)?;
    let next = files::rename_entry(&root, &from, &to).map_err(String::from)?;
    let mut baselines = baselines(&state)?;
    baselines.retarget(&from, &next);
    // A rewritten picture path changes the bytes, so the stored fingerprint follows.
    if let Ok(note) = files::read_note(&root, &next) {
        baselines.remember(&note.path, note.fingerprint);
    }
    // Recent notes follow the rename too, best effort like recording.
    if let Ok(path) = settings_file(&state) {
        let _ = settings::retarget_recent(&path, &root, &from, &next);
    }
    Ok(next)
}

#[tauri::command]
#[specta::specta]
pub fn delete_entry(state: State<'_, AppState>, path: String) -> Result<(), String> {
    let root = root_or_err(&state)?;
    files::delete_entry(&root, &path).map_err(String::from)?;
    baselines(&state)?.forget(&path);
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn search_notes(
    state: State<'_, AppState>,
    query: String,
) -> Result<Vec<SearchHit>, String> {
    let root = root_or_err(&state)?;
    // The scan reads every note, so it runs off the page thread.
    tauri::async_runtime::spawn_blocking(move || {
        files::search_notes(&root, &query).map_err(String::from)
    })
    .await
    .map_err(|err| AppError::Message(err.to_string()).to_string())?
}

#[tauri::command]
#[specta::specta]
pub fn list_notes(state: State<'_, AppState>) -> Result<Vec<String>, String> {
    let root = root_or_err(&state)?;
    files::list_notes(&root).map_err(String::from)
}

#[tauri::command]
#[specta::specta]
pub fn list_recent_notes(state: State<'_, AppState>) -> Result<Vec<String>, String> {
    let root = root_or_err(&state)?;
    let path = settings_file(&state)?;
    settings::list_recent(&path, &root).map_err(String::from)
}

#[tauri::command]
#[specta::specta]
pub fn open_note(state: State<'_, AppState>, path: String) -> Result<Note, String> {
    let root = root_or_err(&state)?;
    let note = files::read_note(&root, &path).map_err(String::from)?;
    remember_note(&state, &note)?;
    remember_opened(&state, &root, &note.path);
    Ok(note)
}

#[tauri::command]
#[specta::specta]
pub fn create_from_template(
    state: State<'_, AppState>,
    parent: String,
    kind: String,
    name: String,
) -> Result<Note, String> {
    let root = root_or_err(&state)?;
    let locale = locale_for_create(&state)?;
    let settings_path = settings_file(&state)?;
    let templates_dir = templates::templates_dir(&settings_path);
    let note =
        templates::create_from_template(&root, &parent, &kind, &name, &locale, &templates_dir)
            .map_err(String::from)?;
    remember_note(&state, &note)?;
    remember_opened(&state, &root, &note.path);
    Ok(note)
}

#[tauri::command]
#[specta::specta]
pub fn list_templates(state: State<'_, AppState>) -> Result<templates::TemplateList, String> {
    let settings_path = settings_file(&state)?;
    let locale = settings::load_settings(&settings_path)
        .map_err(String::from)?
        .locale;
    let dir = templates::templates_dir(&settings_path);
    Ok(templates::list_templates(&dir, &locale))
}

#[tauri::command]
#[specta::specta]
pub fn copy_shipped_template(
    state: State<'_, AppState>,
    name: String,
) -> Result<templates::TemplateDoc, String> {
    let settings_path = settings_file(&state)?;
    let locale = settings::load_settings(&settings_path)
        .map_err(String::from)?
        .locale;
    let dir = templates::templates_dir(&settings_path);
    let doc = templates::copy_shipped_template(&dir, &name, &locale).map_err(String::from)?;
    let path = dir.join(&doc.name);
    template_baselines(&state)?
        .remember(&path, doc.fingerprint.clone())
        .map_err(String::from)?;
    Ok(doc)
}

#[tauri::command]
#[specta::specta]
pub fn open_template(
    state: State<'_, AppState>,
    name: String,
) -> Result<templates::TemplateDoc, String> {
    let settings_path = settings_file(&state)?;
    let dir = templates::templates_dir(&settings_path);
    let doc = templates::open_template(&dir, &name).map_err(String::from)?;
    let path = dir.join(&doc.name);
    template_baselines(&state)?
        .remember(&path, doc.fingerprint.clone())
        .map_err(String::from)?;
    Ok(doc)
}

#[tauri::command]
#[specta::specta]
pub fn save_template(
    state: State<'_, AppState>,
    name: String,
    text: String,
    force: bool,
) -> Result<templates::TemplateDoc, String> {
    let settings_path = settings_file(&state)?;
    let dir = templates::templates_dir(&settings_path);
    let mut baselines = template_baselines(&state)?;
    templates::save_template(&mut baselines, &dir, &name, &text, force).map_err(String::from)
}

#[tauri::command]
#[specta::specta]
pub fn template_changed_on_disk(state: State<'_, AppState>, name: String) -> Result<bool, String> {
    let settings_path = settings_file(&state)?;
    let dir = templates::templates_dir(&settings_path);
    let baselines = template_baselines(&state)?;
    templates::template_changed_on_disk(&baselines, &dir, &name).map_err(String::from)
}

#[tauri::command]
#[specta::specta]
pub fn save_note_image(
    state: State<'_, AppState>,
    path: String,
    file_name: String,
    bytes: Vec<u8>,
) -> Result<String, String> {
    let root = root_or_err(&state)?;
    files::save_note_image(&root, &path, &file_name, &bytes).map_err(String::from)
}

#[tauri::command]
#[specta::specta]
pub fn create_sample_note(state: State<'_, AppState>) -> Result<Note, String> {
    let root = root_or_err(&state)?;
    let target = files::resolve_inside_root(&root, SAMPLE_PATH).map_err(String::from)?;
    if !target.exists() {
        files::write_note(&root, SAMPLE_PATH, SAMPLE_TEXT).map_err(String::from)?;
    }
    let note = files::read_note(&root, SAMPLE_PATH).map_err(String::from)?;
    remember_note(&state, &note)?;
    remember_opened(&state, &root, &note.path);
    Ok(note)
}

#[tauri::command]
#[specta::specta]
pub fn save_note(
    state: State<'_, AppState>,
    path: String,
    text: String,
    force: bool,
) -> Result<files::NoteFingerprint, String> {
    let root = root_or_err(&state)?;
    baselines(&state)?
        .save(&root, &path, &text, force)
        .map_err(String::from)
}

/// Compare the open note with the bytes on disk. Does not change the baseline.
#[tauri::command]
#[specta::specta]
pub fn note_changed_on_disk(state: State<'_, AppState>, path: String) -> Result<bool, String> {
    let root = root_or_err(&state)?;
    baselines(&state)?
        .changed_on_disk(&root, &path)
        .map_err(String::from)
}

#[tauri::command]
#[specta::specta]
pub async fn render_note(
    state: State<'_, AppState>,
    path: String,
    source: String,
    revision: u32,
) -> Result<RenderResult, String> {
    let root = root_or_err(&state)?;
    // An empty path is the buffer while a template is open. It is not a
    // file, and includes still resolve inside the open folder.
    if !path.trim().is_empty() {
        files::resolve_inside_root(&root, &path).map_err(String::from)?;
    }
    let engine: Arc<crate::typst_engine::Engine> = state.engine.clone();
    let result = tauri::async_runtime::spawn_blocking(move || {
        engine.render(&root, &path, &source, revision)
    })
    .await
    .map_err(|err| AppError::Message(err.to_string()).to_string())?;
    result.map_err(String::from)
}

/// The page sends the note path and the editor source.
/// Rust writes the PDF beside that note, inside the stored root, and returns
/// the path counted from the root.
fn export_open_note(engine: &Engine, root: &Path, path: &str, source: &str) -> AppResult<String> {
    // Only a real note may be exported: anything else could make the
    // derived PDF path overwrite an unrelated file beside it.
    let resolved = files::resolve_inside_root(root, path)?;
    if resolved.extension().is_none_or(|ext| ext != "typ") || !resolved.is_file() {
        return Err(crate::error::AppError::InvalidName(path.to_string()));
    }
    let bytes = engine.export_pdf(root, path, source)?;
    files::write_pdf_export(root, path, &bytes)
}

#[tauri::command]
#[specta::specta]
pub async fn export_pdf(
    state: State<'_, AppState>,
    path: String,
    source: String,
) -> Result<String, String> {
    let root = root_or_err(&state)?;
    let engine = state.engine.clone();
    tauri::async_runtime::spawn_blocking(move || {
        export_open_note(&engine, &root, &path, &source).map_err(String::from)
    })
    .await
    .map_err(|err| AppError::Message(err.to_string()).to_string())?
}

#[tauri::command]
#[specta::specta]
pub fn get_settings(state: State<'_, AppState>) -> Result<Settings, String> {
    let path = settings_file(&state)?;
    settings::load_settings(&path).map_err(String::from)
}

#[tauri::command]
#[specta::specta]
pub fn set_locale(state: State<'_, AppState>, locale: String) -> Result<Settings, String> {
    let path = settings_file(&state)?;
    settings::set_locale(&path, &locale).map_err(String::from)
}

#[tauri::command]
#[specta::specta]
pub fn set_theme(state: State<'_, AppState>, theme: String) -> Result<Settings, String> {
    let path = settings_file(&state)?;
    settings::set_theme(&path, &theme).map_err(String::from)
}

#[tauri::command]
#[specta::specta]
pub fn set_page_color(state: State<'_, AppState>, page_color: String) -> Result<Settings, String> {
    let path = settings_file(&state)?;
    settings::set_page_color(&path, &page_color).map_err(String::from)
}

/// The spoken greeting word, or an empty string. Never an error on the page.
///
/// A saved `display_name` wins. Otherwise the account display name is
/// read. The raw strings stay here. Nothing is written and nothing is logged.
#[tauri::command]
#[specta::specta]
pub fn greeting_name(state: State<'_, AppState>) -> Result<String, String> {
    let saved = settings_file(&state)
        .ok()
        .and_then(|path| settings::saved_display_name(&path))
        .and_then(|raw| settings::spoken_word(&raw));
    if let Some(word) = saved {
        return Ok(word);
    }
    Ok(match whoami::realname() {
        Ok(name) => settings::spoken_word(&name).unwrap_or_default(),
        Err(_) => String::new(),
    })
}

#[cfg(test)]
mod tests {
    use super::{export_open_note, remember_opened};
    use crate::AppState;

    // covers: features 9 and 10 together, a broken settings file cannot block a note
    #[test]
    fn recording_a_recent_note_is_best_effort() {
        let root = tempfile::tempdir().unwrap();
        let settings_dir = tempfile::tempdir().unwrap();
        let settings_path = settings_dir.path().join("settings.json");
        std::fs::write(&settings_path, "{ broken").unwrap();
        crate::files::write_note(root.path(), "a.typ", "= Hi\n").unwrap();

        let state = AppState::new();
        *state.settings_file.lock().unwrap() = Some(settings_path);
        // Must not panic or fail the caller: it returns nothing.
        remember_opened(&state, root.path(), "a.typ");
    }
    use crate::files::SAMPLE_TEXT;
    use crate::typst_engine::Engine;

    #[test]
    fn writes_a_pdf_beside_the_note() {
        let dir = tempfile::tempdir().unwrap();
        let engine = Engine::new();
        crate::files::write_note(dir.path(), "notes/lecture.typ", SAMPLE_TEXT).unwrap();
        let relative =
            export_open_note(&engine, dir.path(), "notes/lecture.typ", SAMPLE_TEXT).unwrap();
        assert_eq!(relative, "notes/lecture.pdf");
        let pdf = dir.path().join("notes").join("lecture.pdf");
        let bytes = std::fs::read(&pdf).unwrap();
        assert!(!bytes.is_empty());
        assert!(bytes.starts_with(b"%PDF"));
        // Export must not change the note on disk.
        let note = crate::files::read_note(dir.path(), "notes/lecture.typ").unwrap();
        assert_eq!(note.text, SAMPLE_TEXT);
    }

    // covers: feature 12, only a real Typst note may be exported
    #[test]
    fn refuses_to_export_a_missing_or_non_note_path() {
        let dir = tempfile::tempdir().unwrap();
        let engine = Engine::new();
        assert!(export_open_note(&engine, dir.path(), "notes/missing.typ", "= Hi\n").is_err());
        std::fs::write(dir.path().join("data.json"), "{}").unwrap();
        assert!(export_open_note(&engine, dir.path(), "data.json", "= Hi\n").is_err());
        assert!(!dir.path().join("data.pdf").exists());
    }

    #[test]
    fn a_broken_note_does_not_write_a_pdf() {
        let dir = tempfile::tempdir().unwrap();
        let engine = Engine::new();
        crate::files::write_note(dir.path(), "notes/lecture.typ", "= Dobrze\n").unwrap();
        let source = "= Łódź ąę\n\n#brak()\n";
        let expected = source.find("brak").unwrap().to_string();
        let message = export_open_note(&engine, dir.path(), "notes/lecture.typ", source)
            .unwrap_err()
            .to_string();
        assert!(message.contains(&expected), "{message}");
        assert!(message.contains("brak"), "{message}");
        assert!(!dir.path().join("notes").join("lecture.pdf").exists());
    }

    #[test]
    fn a_failed_export_leaves_an_existing_pdf_in_place() {
        let dir = tempfile::tempdir().unwrap();
        let engine = Engine::new();
        crate::files::write_note(dir.path(), "notes/lecture.typ", "= Dobrze\n").unwrap();
        export_open_note(&engine, dir.path(), "notes/lecture.typ", "= Dobrze\n").unwrap();
        let pdf = dir.path().join("notes").join("lecture.pdf");
        let before = std::fs::read(&pdf).unwrap();
        assert!(export_open_note(&engine, dir.path(), "notes/lecture.typ", "#brak()\n").is_err());
        assert_eq!(std::fs::read(&pdf).unwrap(), before);
    }

    #[test]
    fn a_path_outside_the_folder_is_refused() {
        let dir = tempfile::tempdir().unwrap();
        let engine = Engine::new();
        assert!(export_open_note(&engine, dir.path(), "../lecture.typ", "= Hi\n").is_err());
    }
}
