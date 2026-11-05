use std::path::{Path, PathBuf};
use std::sync::Arc;

use tauri::{AppHandle, State};
use tauri_plugin_dialog::DialogExt;

use crate::AppState;
use crate::error::{AppError, AppResult};
use crate::files::{self, Note, SAMPLE_PATH, SAMPLE_TEXT, SearchHit, TreeNode, WorkspaceInfo};
use crate::settings::{self, Settings};
use crate::typst_engine::{Engine, RenderResult};

fn root_or_err(state: &AppState) -> Result<PathBuf, String> {
    state
        .workspace_root
        .lock()
        .map_err(|_| "workspace lock was poisoned".to_string())?
        .clone()
        .ok_or_else(|| AppError::NoWorkspace.to_string())
}

fn settings_file(state: &AppState) -> Result<PathBuf, String> {
    state
        .settings_file
        .lock()
        .map_err(|_| "settings lock was poisoned".to_string())?
        .clone()
        .ok_or_else(|| AppError::SettingsNotReady.to_string())
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
    let mut slot = state
        .workspace_root
        .lock()
        .map_err(|_| "workspace lock was poisoned".to_string())?;
    *slot = Some(root);
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
    files::create_note(&root, &parent, &name).map_err(String::from)
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
    files::rename_entry(&root, &from, &to).map_err(String::from)
}

#[tauri::command]
#[specta::specta]
pub fn delete_entry(state: State<'_, AppState>, path: String) -> Result<(), String> {
    let root = root_or_err(&state)?;
    files::delete_entry(&root, &path).map_err(String::from)
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
pub fn open_note(state: State<'_, AppState>, path: String) -> Result<Note, String> {
    let root = root_or_err(&state)?;
    files::read_note(&root, &path).map_err(String::from)
}

#[tauri::command]
#[specta::specta]
pub fn create_sample_note(state: State<'_, AppState>) -> Result<Note, String> {
    let root = root_or_err(&state)?;
    let target = files::resolve_inside_root(&root, SAMPLE_PATH).map_err(String::from)?;
    if !target.exists() {
        files::write_note(&root, SAMPLE_PATH, SAMPLE_TEXT).map_err(String::from)?;
    }
    files::read_note(&root, SAMPLE_PATH).map_err(String::from)
}

#[tauri::command]
#[specta::specta]
pub fn save_note(state: State<'_, AppState>, path: String, text: String) -> Result<(), String> {
    let root = root_or_err(&state)?;
    files::write_note(&root, &path, &text).map_err(String::from)
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
    // The path is checked again here, so a render can never read
    // included files from outside the open folder through its main path.
    files::resolve_inside_root(&root, &path).map_err(String::from)?;
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

#[cfg(test)]
mod tests {
    use super::export_open_note;
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
