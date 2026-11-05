mod commands;
mod error;
mod files;
mod settings;
mod templates;
mod typst_engine;

use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use tauri::Manager;
use typst_engine::Engine;

pub struct AppState {
    pub workspace_root: Mutex<Option<PathBuf>>,
    pub settings_file: Mutex<Option<PathBuf>>,
    pub engine: Arc<Engine>,
    /// What this process last read or wrote, per note path, so a save can
    /// refuse a file another tool changed.
    pub note_baselines: Mutex<files::NoteBaselines>,
}

impl AppState {
    fn new() -> Self {
        Self {
            workspace_root: Mutex::new(None),
            settings_file: Mutex::new(None),
            engine: Arc::new(Engine::new()),
            note_baselines: Mutex::new(files::NoteBaselines::default()),
        }
    }
}

fn specta_builder() -> tauri_specta::Builder<tauri::Wry> {
    tauri_specta::Builder::new().commands(tauri_specta::collect_commands![
        commands::open_workspace,
        commands::list_tree,
        commands::create_note,
        commands::create_folder,
        commands::rename_entry,
        commands::delete_entry,
        commands::list_notes,
        commands::search_notes,
        commands::list_recent_notes,
        commands::open_note,
        commands::create_from_template,
        commands::create_sample_note,
        commands::save_note,
        commands::note_changed_on_disk,
        commands::render_note,
        commands::export_pdf,
        commands::get_settings,
        commands::set_locale
    ])
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = specta_builder();

    #[cfg(debug_assertions)]
    builder
        .export(
            specta_typescript::Typescript::default(),
            "../src/bindings.ts",
        )
        .expect("failed to export typescript bindings");

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState::new())
        .setup(|app| {
            let config_dir = app
                .path()
                .app_config_dir()
                .expect("app config dir should exist");
            std::fs::create_dir_all(&config_dir).ok();
            // A plain local log. Nothing ever leaves the machine.
            let log_path = config_dir.join("wysityp.log");
            let line = format!("WYSITyp start {}\n", settings::DEFAULT_LOCALE);
            let _ = std::fs::OpenOptions::new()
                .create(true)
                .append(true)
                .open(&log_path)
                .and_then(|mut file| {
                    use std::io::Write;
                    file.write_all(line.as_bytes())
                });
            let settings_file = settings::settings_path(&config_dir);
            // Write the default settings once, so the file a student
            // can inspect exists from the first run.
            let _ = settings::load_settings(&settings_file);
            let state = app.state::<AppState>();
            if let Ok(mut slot) = state.settings_file.lock() {
                *slot = Some(settings_file);
            }
            Ok(())
        })
        .invoke_handler(builder.invoke_handler())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod bindings_export {
    #[test]
    fn export_bindings() {
        super::specta_builder()
            .export(
                specta_typescript::Typescript::default(),
                "../src/bindings.ts",
            )
            .expect("failed to export typescript bindings");
    }
}
