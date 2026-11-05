use std::path::PathBuf;

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("io error at {path}: {source}")]
    Io {
        path: PathBuf,
        #[source]
        source: std::io::Error,
    },
    #[error("no folder is open")]
    NoWorkspace,
    #[error("path stays outside the open folder: {0}")]
    OutsideRoot(String),
    #[error("a file or folder already has that name: {0}")]
    AlreadyExists(String),
    #[error("that name is not allowed: {0}")]
    InvalidName(String),
    #[error("a folder cannot move into itself: {0}")]
    MoveIntoSelf(String),
    #[error("the open folder itself cannot be deleted")]
    RootDelete,
    #[error("the folder you named is not there yet: {0}")]
    MissingParent(String),
    #[error("unknown language: {0}")]
    BadLocale(String),
    #[error("settings are not ready yet")]
    SettingsNotReady,
    #[error("{0}")]
    Message(String),
}

impl AppError {
    pub fn io(path: impl Into<PathBuf>, source: std::io::Error) -> Self {
        Self::Io {
            path: path.into(),
            source,
        }
    }
}

pub type AppResult<T> = Result<T, AppError>;

impl From<AppError> for String {
    fn from(error: AppError) -> Self {
        error.to_string()
    }
}
