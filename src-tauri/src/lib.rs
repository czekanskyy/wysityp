mod access;
mod close_guard;
mod commands;
mod error;
mod files;
mod math_render;
mod media;
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
    /// Separate from note baselines so a template and a note can share a file name.
    pub template_baselines: Mutex<templates::TemplateBaselines>,
    /// Open folder, drafts folder, and files the student picked.
    pub access: Mutex<access::AccessGate>,
    /// Makes sure a close request always ends in a closed window.
    pub close_guard: close_guard::CloseGuard,
}

impl AppState {
    fn new() -> Self {
        Self {
            workspace_root: Mutex::new(None),
            settings_file: Mutex::new(None),
            engine: Arc::new(Engine::new()),
            note_baselines: Mutex::new(files::NoteBaselines::default()),
            template_baselines: Mutex::new(templates::TemplateBaselines::default()),
            access: Mutex::new(access::AccessGate::new(PathBuf::new())),
            close_guard: close_guard::CloseGuard::default(),
        }
    }
}

fn specta_builder() -> tauri_specta::Builder<tauri::Wry> {
    tauri_specta::Builder::new().commands(tauri_specta::collect_commands![
        commands::open_workspace,
        commands::list_tree,
        commands::create_note,
        commands::create_blank_note,
        commands::create_folder,
        commands::rename_entry,
        commands::delete_entry,
        commands::list_notes,
        commands::search_notes,
        commands::list_recent_notes,
        commands::open_note,
        commands::create_from_template,
        commands::list_templates,
        commands::copy_shipped_template,
        commands::open_template,
        commands::save_template,
        commands::template_changed_on_disk,
        commands::save_note_image,
        commands::create_sample_note,
        commands::save_note,
        commands::note_changed_on_disk,
        commands::render_note,
        commands::export_pdf,
        math_render::render_math,
        media::read_note_image,
        media::open_link,
        commands::get_settings,
        commands::set_locale,
        commands::set_theme,
        commands::set_page_color,
        commands::set_fonts,
        commands::greeting_name,
        commands::create_draft,
        commands::open_loose_file,
        commands::save_draft_as,
        commands::discard_draft,
        commands::list_global_recents,
        commands::restore_session,
        commands::save_session,
        commands::release_workspace_paths,
        commands::adopt_open_paths,
        commands::hold_close
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
        .plugin(tauri_plugin_opener::init())
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
                *slot = Some(settings_file.clone());
            }
            let data_dir = app.path().app_data_dir().unwrap_or(config_dir);
            let drafts = data_dir.join("drafts");
            let _ = std::fs::create_dir_all(&drafts);
            if let Ok(mut gate) = state.access.lock() {
                gate.set_drafts(drafts);
                gate.seed_allowed(&settings::stored_loose_paths(&settings_file));
            }
            if let Some(window) = app.get_webview_window("main") {
                silence_browser_keys(&window);
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                arm_close_fallback(window);
            }
        })
        .invoke_handler(builder.invoke_handler())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

/// The page flushes saves before it closes the window. If it does not do so
/// in time (broken page, hung flush, missing permission), close it from here.
fn arm_close_fallback(window: &tauri::Window) {
    if window.label() != "main" {
        return;
    }
    let ticket = window.state::<AppState>().close_guard.arm();
    let window = window.clone();
    std::thread::spawn(move || {
        std::thread::sleep(close_guard::CLOSE_TIMEOUT);
        if window
            .state::<AppState>()
            .close_guard
            .may_force_close(ticket)
        {
            let _ = window.destroy();
        }
    });
}

/// WebView2 prints on Ctrl+P and F1 before the page can handle them.
#[cfg(windows)]
fn silence_browser_keys(window: &tauri::WebviewWindow) {
    let _ = window.with_webview(|platform| unsafe {
        use webview2_com::Microsoft::Web::WebView2::Win32::ICoreWebView2Settings3;
        use windows::core::Interface;
        let Ok(core) = platform.controller().CoreWebView2() else {
            return;
        };
        let Ok(settings) = core.Settings() else {
            return;
        };
        let Ok(settings3) = settings.cast::<ICoreWebView2Settings3>() else {
            return;
        };
        let _ = settings3.SetAreBrowserAcceleratorKeysEnabled(false);
    });
}

#[cfg(not(windows))]
fn silence_browser_keys(_window: &tauri::WebviewWindow) {}

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
