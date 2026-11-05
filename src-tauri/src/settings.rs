use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use specta::Type;

use crate::error::{AppError, AppResult};

pub const DEFAULT_LOCALE: &str = "pl";
pub const LOCALES: [&str; 2] = ["pl", "en"];

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

pub fn settings_path(config_dir: &Path) -> PathBuf {
    config_dir.join("settings.json")
}

pub fn load_settings(path: &Path) -> AppResult<Settings> {
    match std::fs::read_to_string(path) {
        Ok(text) => {
            let parsed: Settings = serde_json::from_str(&text)
                .map_err(|err| AppError::Message(format!("settings file is broken: {err}")))?;
            if LOCALES.contains(&parsed.locale.as_str()) {
                Ok(parsed)
            } else {
                Ok(Settings::default())
            }
        }
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => {
            let settings = Settings::default();
            save_settings(path, &settings)?;
            Ok(settings)
        }
        Err(err) => Err(AppError::io(path, err)),
    }
}

pub fn save_settings(path: &Path, settings: &Settings) -> AppResult<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|err| AppError::io(parent, err))?;
    }
    let text =
        serde_json::to_string_pretty(settings).map_err(|err| AppError::Message(err.to_string()))?;
    std::fs::write(path, format!("{text}\n")).map_err(|err| AppError::io(path, err))
}

pub fn set_locale(path: &Path, locale: &str) -> AppResult<Settings> {
    if !LOCALES.contains(&locale) {
        return Err(AppError::BadLocale(locale.to_string()));
    }
    let settings = Settings {
        locale: locale.to_string(),
    };
    save_settings(path, &settings)?;
    Ok(settings)
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
}
