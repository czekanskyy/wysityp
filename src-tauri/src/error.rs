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
    /// The page named a file that was not picked, is not a draft, and is
    /// not inside the open folder.
    #[error("that file is not open for editing: {0}")]
    NotAllowed(String),
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
    #[error("unknown theme: {0}")]
    BadTheme(String),
    #[error("unknown page colour: {0}")]
    BadPageColor(String),
    #[error("invalid font name: {0}")]
    BadFont(String),
    #[error("settings are not ready yet")]
    SettingsNotReady,
    /// The page matches this prefix. The words after it are for logs.
    #[error("external-change: the note on disk was changed by another tool")]
    ExternalChange,
    /// Every `unsaved` name through `unsaved-99` is taken.
    #[error("note-names-exhausted: every unsaved name is taken")]
    NoteNamesExhausted,
    /// Every copy name from `{stem}.typ` through `{stem}-100.typ` is taken.
    #[error("template-names-exhausted: every template copy name is taken")]
    TemplateNamesExhausted,
    /// The page matches this prefix and shows `image_refused`.
    #[error("image-refused: {0}")]
    ImageRefused(String),
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
