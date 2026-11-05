use std::path::PathBuf;
use std::sync::Arc;

use tauri::{AppHandle, State};
use tauri_plugin_dialog::DialogExt;

use crate::AppState;
use crate::error::AppError;
use crate::files::{self, Note, SAMPLE_PATH, SAMPLE_TEXT, SearchHit, TreeNode, WorkspaceInfo};
use crate::settings::{self, Settings};
use crate::typst_engine::RenderResult;

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
pub fn search_notes(state: State<'_, AppState>, query: String) -> Result<Vec<SearchHit>, String> {
    let root = root_or_err(&state)?;
    files::search_notes(&root, &query).map_err(String::from)
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
