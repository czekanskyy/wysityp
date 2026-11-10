//! Pictures and links the editor asks Rust to touch.
//!
//! The page never reads or writes a file itself. Image bytes are checked
//! against the open notes folder. A link opens only for http, https, or mailto.

use serde::{Deserialize, Serialize};
use specta::Type;
use tauri::State;
use tauri_plugin_opener::OpenerExt;

use crate::AppState;
use crate::error::AppError;
use crate::files;

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct NoteImageBytes {
    pub bytes: Vec<u8>,
    pub mime: String,
}

#[tauri::command]
#[specta::specta]
pub fn read_note_image(
    state: State<'_, AppState>,
    path: String,
    image_path: String,
) -> Result<NoteImageBytes, String> {
    let root = state
        .workspace_root
        .lock()
        .map_err(|_| "workspace lock was poisoned".to_string())?
        .clone()
        .ok_or_else(|| AppError::NoWorkspace.to_string())?;
    let (bytes, mime) = files::read_note_image(&root, &path, &image_path).map_err(String::from)?;
    Ok(NoteImageBytes {
        bytes,
        mime: mime.to_string(),
    })
}

/// `http`, `https`, and `mailto` only. Anything else is refused before the opener.
pub fn allowed_link(url: &str) -> bool {
    let trimmed = url.trim();
    if trimmed.is_empty() || trimmed.len() > 2000 {
        return false;
    }
    if trimmed
        .chars()
        .any(|ch| ch.is_control() || ch.is_whitespace())
    {
        return false;
    }
    let lower = trimmed.to_ascii_lowercase();
    lower.starts_with("https://") || lower.starts_with("http://") || lower.starts_with("mailto:")
}

#[tauri::command]
#[specta::specta]
pub fn open_link(app: tauri::AppHandle, url: String) -> Result<(), String> {
    if !allowed_link(&url) {
        return Err("link-refused".to_string());
    }
    app.opener()
        .open_url(url.trim(), None::<&str>)
        .map_err(|err| err.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn links_allow_only_web_and_mail() {
        assert!(allowed_link("https://example.com/a"));
        assert!(allowed_link("HTTP://example.com"));
        assert!(allowed_link("mailto:a@b.c"));
        assert!(!allowed_link("javascript:alert(1)"));
        assert!(!allowed_link("file:///c:/note.typ"));
        assert!(!allowed_link("https://bad host"));
        assert!(!allowed_link("notes/a.typ"));
    }
}
