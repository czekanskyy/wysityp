use std::collections::HashMap;
use std::path::{Component, Path, PathBuf};

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use specta::Type;

use crate::error::{AppError, AppResult};

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct WorkspaceInfo {
    pub root_name: String,
    pub notes: Vec<String>,
}

/// SHA-256 of the note bytes last read or written, plus how many bytes that was.
///
/// A later save is refused when the file on disk no longer matches this record.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
pub struct NoteFingerprint {
    pub hash: String,
    pub byte_len: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct Note {
    pub path: String,
    pub text: String,
    pub fingerprint: NoteFingerprint,
}

/// One folder or note in the open workspace, as it sits on disk.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct TreeNode {
    pub name: String,
    pub path: String,
    /// `folder` or `note`.
    pub kind: String,
    pub children: Vec<TreeNode>,
}

pub const SAMPLE_PATH: &str = "wysityp-sample.typ";

pub const SAMPLE_TEXT: &str = "= Przykładowa notatka\n\nŁódź, ąęśćńóżź i polskie znaki na stronie.\n\nMatematyka w wierszu: $x^2 + y^2 = z^2$ oraz suma $sum_(k=1)^n k = (n(n+1)) / 2$.\n\n#figure(\n  rect(width: 4cm, height: 2cm, fill: rgb(\"#dde8ff\"), stroke: 1pt + rgb(\"#3355aa\")),\n  caption: [Prosty rysunek w notatce],\n)\n\nCałka: $ integral_0^1 x^2 dif x = 1/3 $.\n";

pub fn canonical_root(path: &Path) -> AppResult<PathBuf> {
    let root = std::fs::canonicalize(path).map_err(|err| AppError::io(path, err))?;
    // On Windows canonicalize adds a long path prefix. Strip it for display and joins.
    #[cfg(windows)]
    let root = strip_windows_prefix(&root);
    Ok(root)
}

#[cfg(windows)]
fn strip_windows_prefix(path: &Path) -> PathBuf {
    let text = path.to_string_lossy();
    if let Some(rest) = text.strip_prefix(r"\\?\UNC\") {
        PathBuf::from(format!(r"\\{rest}"))
    } else if let Some(rest) = text.strip_prefix(r"\\?\") {
        PathBuf::from(rest.to_string())
    } else {
        path.to_path_buf()
    }
}

/// Turn a path the page sent into a real path inside the root.
///
/// The page only ever sends paths counted from the root, with slashes
/// between parts. Absolute paths and parts that climb up are refused.
/// Links that point outside are refused once the real path is known.
pub fn resolve_inside_root(root: &Path, relative: &str) -> AppResult<PathBuf> {
    if relative.trim().is_empty() {
        return Err(AppError::OutsideRoot(relative.to_string()));
    }
    let rel_path = Path::new(relative);
    if rel_path.is_absolute() {
        return Err(AppError::OutsideRoot(relative.to_string()));
    }
    for part in rel_path.components() {
        match part {
            Component::Normal(_) | Component::CurDir => {}
            _ => return Err(AppError::OutsideRoot(relative.to_string())),
        }
    }
    let candidate = root.join(rel_path);
    // Check the deepest part that exists for real, then rebuild the
    // tail below it. Checking only the file or its parent would let a
    // link higher up carry a new path outside the root unseen.
    let mut existing = candidate.as_path();
    while !existing.exists() {
        match existing.parent() {
            Some(parent) => existing = parent,
            None => break,
        }
    }
    let true_existing = canonical_root(existing)?;
    let true_root = canonical_root(root)?;
    if !true_existing.starts_with(&true_root) {
        return Err(AppError::OutsideRoot(relative.to_string()));
    }
    let tail = candidate
        .strip_prefix(existing)
        .map_err(|_| AppError::OutsideRoot(relative.to_string()))?;
    if tail.as_os_str().is_empty() {
        return Ok(true_existing);
    }
    Ok(true_existing.join(tail))
}

fn display_relative(path: &str) -> String {
    path.trim()
        .replace('\\', "/")
        .trim_end_matches('/')
        .to_string()
}

fn is_same_or_inside(parent: &str, child: &str) -> bool {
    let parent = parent.to_lowercase();
    let child = child.to_lowercase();
    child == parent || child.starts_with(&format!("{parent}/"))
}

pub(crate) fn is_reserved_device_name(name: &str) -> bool {
    let stem = name.split('.').next().unwrap_or(name);
    matches!(
        stem.to_ascii_uppercase().as_str(),
        "CON"
            | "PRN"
            | "AUX"
            | "NUL"
            | "COM1"
            | "COM2"
            | "COM3"
            | "COM4"
            | "COM5"
            | "COM6"
            | "COM7"
            | "COM8"
            | "COM9"
            | "LPT1"
            | "LPT2"
            | "LPT3"
            | "LPT4"
            | "LPT5"
            | "LPT6"
            | "LPT7"
            | "LPT8"
            | "LPT9"
    )
}

/// An empty relative path means the open folder itself.
pub fn resolve_place(root: &Path, relative: &str) -> AppResult<PathBuf> {
    if relative.trim().is_empty() {
        return canonical_root(root);
    }
    resolve_inside_root(root, relative)
}

fn invalid_segment(name: &str) -> bool {
    let name = name.trim();
    name.is_empty()
        || name == "."
        || name == ".."
        || name.starts_with('.')
        || name.ends_with('.')
        || name.contains('/')
        || name.contains('\\')
        || name.contains('\0')
        || is_reserved_device_name(name)
        || name
            .chars()
            .any(|ch| ch.is_control() || matches!(ch, '<' | '>' | ':' | '"' | '|' | '?' | '*'))
}

fn note_file_name(name: &str) -> AppResult<String> {
    let name = name.trim();
    if invalid_segment(name) {
        return Err(AppError::InvalidName(name.to_string()));
    }
    match Path::new(name).extension().and_then(|ext| ext.to_str()) {
        Some("typ") => Ok(name.to_string()),
        Some(_) => Err(AppError::InvalidName(name.to_string())),
        None => Ok(format!("{name}.typ")),
    }
}

fn folder_name(name: &str) -> AppResult<String> {
    let name = name.trim();
    if invalid_segment(name) {
        return Err(AppError::InvalidName(name.to_string()));
    }
    Ok(name.to_string())
}

pub(crate) fn entry_names(dir: &Path) -> AppResult<Vec<String>> {
    let mut names = Vec::new();
    let entries = std::fs::read_dir(dir).map_err(|err| AppError::io(dir, err))?;
    for entry in entries {
        let entry = entry.map_err(|err| AppError::io(dir, err))?;
        names.push(entry.file_name().to_string_lossy().to_string());
    }
    Ok(names)
}

/// A name is taken when the folder already has that file or folder, compared
/// without regard to case. When `block_assets` is set, `{stem}.assets` counts too.
pub(crate) fn name_is_taken(names: &[String], file_name: &str, block_assets: bool) -> bool {
    let want = file_name.to_lowercase();
    if names.iter().any(|name| name.to_lowercase() == want) {
        return true;
    }
    if !block_assets {
        return false;
    }
    let stem = Path::new(file_name)
        .file_stem()
        .map(|stem| stem.to_string_lossy().to_lowercase())
        .unwrap_or_default();
    let assets = format!("{stem}.assets");
    names.iter().any(|name| name.to_lowercase() == assets)
}

fn find_dir_child(dir: &Path, name: &str) -> AppResult<Option<PathBuf>> {
    let want = name.to_lowercase();
    let entries = std::fs::read_dir(dir).map_err(|err| AppError::io(dir, err))?;
    for entry in entries {
        let entry = entry.map_err(|err| AppError::io(dir, err))?;
        let found = entry.file_name().to_string_lossy().to_string();
        if found.to_lowercase() == want {
            return Ok(Some(entry.path()));
        }
    }
    Ok(None)
}

fn paths_same(left: &Path, right: &Path) -> bool {
    match (canonical_root(left), canonical_root(right)) {
        (Ok(left), Ok(right)) => left == right,
        _ => false,
    }
}

fn file_stem_string(path: &Path) -> AppResult<String> {
    path.file_stem()
        .map(|stem| stem.to_string_lossy().to_string())
        .filter(|stem| !stem.is_empty())
        .ok_or_else(|| AppError::InvalidName(path.to_string_lossy().to_string()))
}

fn is_typ_file(path: &Path) -> bool {
    path.is_file()
        && path
            .extension()
            .and_then(|ext| ext.to_str())
            .is_some_and(|ext| ext.eq_ignore_ascii_case("typ"))
}

fn is_assets_dir_name(name: &str) -> bool {
    name.to_lowercase().ends_with(".assets")
}

fn join_relative(parent: &str, name: &str) -> String {
    let parent = display_relative(parent.trim());
    if parent.is_empty() {
        name.to_string()
    } else {
        format!("{parent}/{name}")
    }
}

fn starter_heading(file_name: &str) -> String {
    let stem = Path::new(file_name)
        .file_stem()
        .map(|stem| stem.to_string_lossy().to_string())
        .unwrap_or_else(|| file_name.to_string());
    format!("= {stem}\n")
}

pub fn list_tree(root: &Path) -> AppResult<Vec<TreeNode>> {
    read_tree(root, root)
}

fn read_tree(root: &Path, dir: &Path) -> AppResult<Vec<TreeNode>> {
    let entries = match std::fs::read_dir(dir) {
        Ok(entries) => entries,
        Err(err) => return Err(AppError::io(dir, err)),
    };
    let mut nodes = Vec::new();
    for entry in entries.flatten() {
        let path = entry.path();
        let file_type = match entry.file_type() {
            Ok(kind) => kind,
            Err(_) => continue,
        };
        if file_type.is_symlink() {
            continue;
        }
        let Ok(rel) = path.strip_prefix(root) else {
            continue;
        };
        let relative = display_relative(&rel.to_string_lossy());
        let name = entry.file_name().to_string_lossy().to_string();
        // Hidden names stay out of the tree. The flat note list still sees them.
        if name.starts_with('.') {
            continue;
        }
        // Picture folders stay on disk and stay out of the tree.
        if file_type.is_dir() && is_assets_dir_name(&name) {
            continue;
        }
        if file_type.is_dir() {
            let children = read_tree(root, &path)?;
            nodes.push(TreeNode {
                name,
                path: relative,
                kind: "folder".to_string(),
                children,
            });
        } else if path.extension().is_some_and(|ext| ext == "typ") {
            nodes.push(TreeNode {
                name,
                path: relative,
                kind: "note".to_string(),
                children: Vec::new(),
            });
        }
    }
    nodes.sort_by(|left, right| {
        let left_rank = if left.kind == "folder" { 0 } else { 1 };
        let right_rank = if right.kind == "folder" { 0 } else { 1 };
        left_rank
            .cmp(&right_rank)
            .then_with(|| left.name.to_lowercase().cmp(&right.name.to_lowercase()))
    });
    Ok(nodes)
}

pub fn create_note(root: &Path, parent: &str, name: &str) -> AppResult<Note> {
    let file_name = note_file_name(name)?;
    let text = starter_heading(&file_name);
    create_new_note(root, parent, &file_name, &text)
}

/// Write a new `.typ` file that does not exist yet.
///
/// The parent is a path counted from the root. An existing file is
/// refused, and a path that leaves the root is refused.
pub fn create_new_note(root: &Path, parent: &str, file_name: &str, text: &str) -> AppResult<Note> {
    let parent_path = resolve_place(root, parent)?;
    if !parent_path.is_dir() {
        return Err(AppError::InvalidName(parent.to_string()));
    }
    let file_name = note_file_name(file_name)?;
    let relative = join_relative(parent, &file_name);
    let path = resolve_inside_root(root, &relative)?;
    if path.exists() {
        return Err(AppError::AlreadyExists(relative));
    }
    write_new_file(&path, &relative, text)?;
    Ok(note_from_text(relative, text.to_string()))
}

fn write_new_file(path: &Path, relative: &str, text: &str) -> AppResult<()> {
    let mut file = std::fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(path)
        .map_err(|err| {
            if err.kind() == std::io::ErrorKind::AlreadyExists {
                AppError::AlreadyExists(relative.to_string())
            } else {
                AppError::io(path, err)
            }
        })?;
    use std::io::Write;
    file.write_all(text.as_bytes())
        .map_err(|err| AppError::io(path, err))
}

pub fn create_folder(root: &Path, parent: &str, name: &str) -> AppResult<String> {
    let parent_path = resolve_place(root, parent)?;
    if !parent_path.is_dir() {
        return Err(AppError::InvalidName(parent.to_string()));
    }
    let folder = folder_name(name)?;
    let relative = join_relative(parent, &folder);
    let path = resolve_inside_root(root, &relative)?;
    if path.exists() {
        return Err(AppError::AlreadyExists(relative));
    }
    std::fs::create_dir(&path).map_err(|err| AppError::io(&path, err))?;
    Ok(relative)
}

const IMAGE_CAP: usize = 20 * 1024 * 1024;

/// Write picture bytes into `{note stem}.assets` beside an existing note.
///
/// The note text is left alone. A refusal writes nothing.
pub fn save_note_image(
    root: &Path,
    note_path: &str,
    file_name: &str,
    bytes: &[u8],
) -> AppResult<String> {
    if bytes.len() > IMAGE_CAP {
        return Err(AppError::ImageRefused(
            "file is larger than 20 MB".to_string(),
        ));
    }
    let note_rel = display_relative(note_path);
    let note_abs = resolve_inside_root(root, &note_rel)?;
    if !is_typ_file(&note_abs) {
        return Err(AppError::ImageRefused("the note is not there".to_string()));
    }
    let stem = file_stem_string(&note_abs)?;
    let parent = note_abs
        .parent()
        .ok_or_else(|| AppError::ImageRefused("the note is not there".to_string()))?;
    let assets_label = format!("{stem}.assets");
    let existing = find_dir_child(parent, &assets_label)?;
    if let Some(found) = &existing
        && !found.is_dir()
    {
        return Err(AppError::ImageRefused(
            "assets path is not a folder".to_string(),
        ));
    }
    if !file_name.is_empty() {
        validate_image_name(file_name)?;
    }
    let assets_dir = existing.unwrap_or_else(|| parent.join(&assets_label));
    if !assets_dir.exists() {
        std::fs::create_dir(&assets_dir).map_err(|err| AppError::io(&assets_dir, err))?;
    }
    let chosen = pick_image_name(&assets_dir, file_name)?;
    let target = assets_dir.join(&chosen);
    write_new_bytes(&target, bytes).map_err(|err| match err {
        AppError::Io { source, .. } if source.kind() == std::io::ErrorKind::AlreadyExists => {
            AppError::ImageRefused("that image name is taken".to_string())
        }
        other => other,
    })?;
    let folder = match note_rel.rsplit_once('/') {
        Some((dir, _)) => format!("{dir}/{assets_label}"),
        None => assets_label,
    };
    Ok(format!("{folder}/{chosen}"))
}

fn pick_image_name(dir: &Path, file_name: &str) -> AppResult<String> {
    let candidates = image_candidates(file_name)?;
    let names = entry_names(dir)?;
    for candidate in candidates {
        if !name_is_taken(&names, &candidate, true) {
            return Ok(candidate);
        }
    }
    Err(AppError::ImageRefused(
        "every image name is taken".to_string(),
    ))
}

fn image_candidates(file_name: &str) -> AppResult<Vec<String>> {
    if file_name.is_empty() {
        let mut names = Vec::with_capacity(100);
        names.push("image.png".to_string());
        for number in 1..=99 {
            names.push(format!("image-{number}.png"));
        }
        return Ok(names);
    }
    validate_image_name(file_name)?;
    let path = Path::new(file_name);
    let stem = path
        .file_stem()
        .map(|stem| stem.to_string_lossy().to_string())
        .unwrap_or_default();
    let ext = path
        .extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or_default();
    let mut names = Vec::with_capacity(100);
    names.push(file_name.to_string());
    for number in 1..=99 {
        names.push(format!("{stem}-{number}.{ext}"));
    }
    Ok(names)
}

fn validate_image_name(name: &str) -> AppResult<()> {
    let refused = |reason: &str| AppError::ImageRefused(reason.to_string());
    if name.contains('/')
        || name.contains('\\')
        || name.contains('"')
        || name.contains('\'')
        || name.split(['/', '\\']).any(|part| part == "..")
    {
        return Err(refused("name leaves the folder"));
    }
    if name.ends_with('.') || name.ends_with(' ') {
        return Err(refused("name ends with a dot or a space"));
    }
    if name
        .chars()
        .any(|ch| matches!(ch, ':' | '*' | '?' | '<' | '>' | '|'))
    {
        return Err(refused("name has a character that is not allowed"));
    }
    let ext = Path::new(name)
        .extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or("");
    if ext.is_empty() {
        return Err(refused("name has no extension"));
    }
    if !matches!(
        ext.to_ascii_lowercase().as_str(),
        "png" | "jpg" | "jpeg" | "gif" | "webp"
    ) {
        return Err(refused("that image type is not allowed"));
    }
    if is_reserved_device_name(name) {
        return Err(refused("that name is reserved"));
    }
    Ok(())
}

fn write_new_bytes(path: &Path, bytes: &[u8]) -> AppResult<()> {
    use std::io::Write;
    let mut file = std::fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(path)
        .map_err(|err| AppError::io(path, err))?;
    file.write_all(bytes).map_err(|err| AppError::io(path, err))
}

pub fn rename_entry(root: &Path, from: &str, to: &str) -> AppResult<String> {
    let from_display = display_relative(from.trim());
    let to_display = display_relative(to.trim());
    if from_display.is_empty() || to_display.is_empty() {
        return Err(AppError::InvalidName(to_display));
    }
    if is_symlink_path(&root.join(Path::new(&from_display))) {
        return Err(AppError::OutsideRoot(from_display));
    }
    let source = resolve_inside_root(root, &from_display)?;
    if !source.exists() {
        return Err(AppError::io(
            &source,
            std::io::Error::new(std::io::ErrorKind::NotFound, "missing"),
        ));
    }
    if source
        .symlink_metadata()
        .is_ok_and(|meta| meta.file_type().is_symlink())
    {
        return Err(AppError::OutsideRoot(from_display));
    }
    let source_is_dir = source.is_dir();
    if from_display == to_display {
        return Ok(from_display);
    }
    if source_is_dir
        && is_assets_dir_name(
            from_display
                .rsplit(['/', '\\'])
                .next()
                .unwrap_or(&from_display),
        )
    {
        return Err(AppError::InvalidName(from_display));
    }
    if source_is_dir && is_same_or_inside(&from_display, &to_display) {
        return Err(AppError::MoveIntoSelf(to_display));
    }
    validate_destination(&to_display, source_is_dir)?;
    let destination = resolve_inside_root(root, &to_display)?;
    if destination.exists() {
        let same = canonical_root(&destination).ok() == canonical_root(&source).ok()
            && canonical_root(&source).is_ok();
        if !same {
            return Err(AppError::AlreadyExists(to_display));
        }
    }
    if let Some(parent) = destination.parent() {
        if !parent.exists() {
            return Err(AppError::MissingParent(to_display));
        }
        if source_is_dir {
            let true_parent = canonical_root(parent)?;
            let true_source = canonical_root(&source)?;
            if true_parent == true_source || true_parent.starts_with(&true_source) {
                return Err(AppError::MoveIntoSelf(to_display));
            }
        }
    }
    if !source_is_dir && is_typ_file(&source) {
        rename_note_file(&source, &destination, &to_display)?;
        return Ok(to_display);
    }
    std::fs::rename(&source, &destination).map_err(|err| AppError::io(&destination, err))?;
    Ok(to_display)
}

/// Move `{oldStem}.assets` with the note, then the note, then rewrite quoted paths.
///
/// The assets folder moves first. A failed note rename puts it back. A failed
/// text write puts both back. A failed rollback is the error the caller sees.
fn rename_note_file(source: &Path, destination: &Path, to_display: &str) -> AppResult<()> {
    let old_stem = file_stem_string(source)?;
    let new_stem = file_stem_string(destination)?;
    let old_parent = source
        .parent()
        .ok_or_else(|| AppError::InvalidName(source.to_string_lossy().to_string()))?;
    let new_parent = destination
        .parent()
        .ok_or_else(|| AppError::InvalidName(destination.to_string_lossy().to_string()))?;
    let old_assets = find_dir_child(old_parent, &format!("{old_stem}.assets"))?;
    let new_assets_name = format!("{new_stem}.assets");
    let new_assets_existing = find_dir_child(new_parent, &new_assets_name)?;
    let new_assets_path = new_parent.join(&new_assets_name);
    let same_assets = match (&old_assets, &new_assets_existing) {
        (Some(old), Some(new_path)) => paths_same(old, new_path),
        _ => false,
    };
    // A leftover assets folder blocks the rename even when this note has none.
    if new_assets_existing.is_some() && !same_assets {
        return Err(AppError::AlreadyExists(to_display.to_string()));
    }
    let move_assets = match &old_assets {
        Some(old) if old.is_dir() && !same_assets => Some(old.clone()),
        _ => None,
    };
    if let Some(old) = &move_assets {
        std::fs::rename(old, &new_assets_path)
            .map_err(|err| AppError::io(&new_assets_path, err))?;
    }
    if let Err(err) = std::fs::rename(source, destination) {
        if let Some(old) = &move_assets
            && let Err(back) = std::fs::rename(&new_assets_path, old)
        {
            return Err(AppError::io(old, back));
        }
        return Err(AppError::io(destination, err));
    }
    if old_stem == new_stem {
        return Ok(());
    }
    let bytes = match std::fs::read(destination) {
        Ok(bytes) => bytes,
        Err(err) => {
            rollback_note_rename(
                destination,
                source,
                move_assets.as_deref(),
                &new_assets_path,
            )?;
            return Err(AppError::io(destination, err));
        }
    };
    let Ok(text) = String::from_utf8(bytes) else {
        return Ok(());
    };
    let rewritten = rewrite_assets_prefix(&text, &old_stem, &new_stem);
    if rewritten == text {
        return Ok(());
    }
    if let Err(err) = write_atomically(destination, rewritten.as_bytes()) {
        rollback_note_rename(
            destination,
            source,
            move_assets.as_deref(),
            &new_assets_path,
        )?;
        return Err(err);
    }
    Ok(())
}

fn rollback_note_rename(
    note_now: &Path,
    note_was: &Path,
    assets_was: Option<&Path>,
    assets_now: &Path,
) -> AppResult<()> {
    if let Err(err) = std::fs::rename(note_now, note_was) {
        return Err(AppError::io(note_was, err));
    }
    if let Some(assets_was) = assets_was
        && let Err(err) = std::fs::rename(assets_now, assets_was)
    {
        return Err(AppError::io(assets_was, err));
    }
    Ok(())
}

/// Replace `{old}.assets/` with `{new}.assets/` only at the start of the file
/// or when the character just before the prefix is a quote.
fn rewrite_assets_prefix(text: &str, old_stem: &str, new_stem: &str) -> String {
    let needle = format!("{old_stem}.assets/");
    let replacement = format!("{new_stem}.assets/");
    let mut out = String::with_capacity(text.len());
    let mut cursor = 0;
    while let Some(found) = text[cursor..].find(&needle) {
        let index = cursor + found;
        let allowed = index == 0 || matches!(text[..index].chars().next_back(), Some('"' | '\''));
        out.push_str(&text[cursor..index]);
        if allowed {
            out.push_str(&replacement);
        } else {
            out.push_str(&needle);
        }
        cursor = index + needle.len();
    }
    out.push_str(&text[cursor..]);
    out
}

fn validate_destination(relative: &str, source_is_dir: bool) -> AppResult<()> {
    let path = Path::new(relative);
    if path.is_absolute() {
        return Err(AppError::OutsideRoot(relative.to_string()));
    }
    let mut parts = Vec::new();
    for part in path.components() {
        match part {
            Component::Normal(name) => parts.push(name.to_string_lossy().to_string()),
            Component::CurDir => {}
            _ => return Err(AppError::OutsideRoot(relative.to_string())),
        }
    }
    if parts.is_empty() {
        return Err(AppError::InvalidName(relative.to_string()));
    }
    for part in &parts {
        if invalid_segment(part) {
            return Err(AppError::InvalidName(relative.to_string()));
        }
    }
    if !source_is_dir {
        let file_name = parts.last().map(String::as_str).unwrap_or("");
        note_file_name(file_name)?;
        // A note destination must keep the .typ ending, not gain one silently.
        if Path::new(file_name).extension().is_none() {
            return Err(AppError::InvalidName(relative.to_string()));
        }
    }
    Ok(())
}

pub fn delete_entry(root: &Path, relative: &str) -> AppResult<()> {
    if relative.trim().is_empty() || relative.trim() == "." {
        return Err(AppError::RootDelete);
    }
    if is_symlink_path(&root.join(Path::new(relative.trim()))) {
        return Err(AppError::OutsideRoot(relative.to_string()));
    }
    let path = resolve_inside_root(root, relative)?;
    let true_path = canonical_root(&path)?;
    let true_root = canonical_root(root)?;
    if true_path == true_root {
        return Err(AppError::RootDelete);
    }
    let meta = path
        .symlink_metadata()
        .map_err(|err| AppError::io(&path, err))?;
    if meta.file_type().is_symlink() {
        return Err(AppError::OutsideRoot(relative.to_string()));
    }
    if meta.is_dir() {
        if path
            .file_name()
            .is_some_and(|name| is_assets_dir_name(&name.to_string_lossy()))
        {
            return Err(AppError::InvalidName(relative.to_string()));
        }
        std::fs::remove_dir_all(&path).map_err(|err| AppError::io(&path, err))?;
    } else {
        std::fs::remove_file(&path).map_err(|err| AppError::io(&path, err))?;
    }
    Ok(())
}

fn is_symlink_path(path: &Path) -> bool {
    path.symlink_metadata()
        .is_ok_and(|meta| meta.file_type().is_symlink())
}

pub fn list_notes(root: &Path) -> AppResult<Vec<String>> {
    let mut notes = Vec::new();
    collect_notes(root, root, &mut notes)?;
    notes.sort();
    Ok(notes)
}

/// One matching line inside a note. `line` is 1 based.
#[derive(Debug, Clone, Serialize, Deserialize, Type, PartialEq, Eq)]
pub struct SearchHit {
    pub path: String,
    pub line: u32,
    pub snippet: String,
}

/// Stop after this many hits so a broad query cannot flood the sidebar.
pub const SEARCH_RESULT_CAP: usize = 100;

/// Trimmed matching line, cut to this many characters.
const SNIPPET_CHARS: usize = 120;

pub fn search_notes(root: &Path, query: &str) -> AppResult<Vec<SearchHit>> {
    let needle = query.trim().to_lowercase();
    if needle.is_empty() {
        return Ok(Vec::new());
    }
    let notes = list_notes(root)?;
    let mut hits = Vec::new();
    for relative in notes {
        if hits.len() >= SEARCH_RESULT_CAP {
            break;
        }
        let path = match resolve_inside_root(root, &relative) {
            Ok(path) => path,
            Err(_) => continue,
        };
        let bytes = match std::fs::read(&path) {
            Ok(bytes) => bytes,
            Err(_) => continue,
        };
        let Ok(text) = String::from_utf8(bytes) else {
            continue;
        };
        for (index, line) in text.lines().enumerate() {
            if hits.len() >= SEARCH_RESULT_CAP {
                break;
            }
            if !line.to_lowercase().contains(&needle) {
                continue;
            }
            hits.push(SearchHit {
                path: relative.clone(),
                line: (index + 1) as u32,
                snippet: snippet_of(line, &needle),
            });
        }
    }
    Ok(hits)
}

fn snippet_of(line: &str, needle: &str) -> String {
    let trimmed = line.trim();
    // Keep the match inside the window: start a little before it
    // instead of always cutting the head of a long line.
    let lowered = trimmed.to_lowercase();
    let match_start = lowered
        .find(needle)
        .map(|byte| lowered[..byte].chars().count())
        .unwrap_or(0);
    let start = match_start.saturating_sub(40);
    trimmed.chars().skip(start).take(SNIPPET_CHARS).collect()
}

fn collect_notes(root: &Path, dir: &Path, notes: &mut Vec<String>) -> AppResult<()> {
    let entries = match std::fs::read_dir(dir) {
        Ok(entries) => entries,
        Err(_) => return Ok(()),
    };
    for entry in entries.flatten() {
        let path = entry.path();
        let file_type = match entry.file_type() {
            Ok(kind) => kind,
            Err(_) => continue,
        };
        // Links are skipped in the list. Opening one is checked again later.
        if file_type.is_symlink() {
            continue;
        }
        if file_type.is_dir() {
            collect_notes(root, &path, notes)?;
        } else if path.extension().is_some_and(|ext| ext == "typ")
            && let Ok(rel) = path.strip_prefix(root)
        {
            notes.push(rel.to_string_lossy().replace('\\', "/"));
        }
    }
    Ok(())
}

pub fn read_note(root: &Path, relative: &str) -> AppResult<Note> {
    let path = resolve_inside_root(root, relative)?;
    let bytes = std::fs::read(&path).map_err(|err| AppError::io(&path, err))?;
    let fingerprint = fingerprint_bytes(&bytes);
    let text = String::from_utf8(bytes).map_err(|err| {
        AppError::io(
            &path,
            std::io::Error::new(std::io::ErrorKind::InvalidData, err),
        )
    })?;
    Ok(Note {
        path: relative.replace('\\', "/"),
        text,
        fingerprint,
    })
}

/// The PDF sits beside the note, with the note file stem and a `.pdf` extension.
///
/// `notes/lecture.typ` becomes `notes/lecture.pdf`. The page never chooses this path.
pub fn pdf_export_path(note_path: &str) -> AppResult<String> {
    let relative = note_path.trim().replace('\\', "/");
    if relative.is_empty() || relative.ends_with('/') {
        return Err(AppError::InvalidName(note_path.to_string()));
    }
    let path = Path::new(&relative);
    if path.is_absolute() {
        return Err(AppError::OutsideRoot(note_path.to_string()));
    }
    for part in path.components() {
        match part {
            Component::Normal(_) | Component::CurDir => {}
            _ => return Err(AppError::OutsideRoot(note_path.to_string())),
        }
    }
    let stem = path
        .file_stem()
        .and_then(|stem| stem.to_str())
        .filter(|stem| !stem.is_empty())
        .ok_or_else(|| AppError::InvalidName(note_path.to_string()))?;
    let file_name = format!("{stem}.pdf");
    match path.parent() {
        Some(parent) if !parent.as_os_str().is_empty() => {
            let parent = parent.to_string_lossy().replace('\\', "/");
            Ok(format!("{parent}/{file_name}"))
        }
        _ => Ok(file_name),
    }
}

/// Write PDF bytes beside the note. An existing export is replaced.
/// Bytes that are not a PDF are refused, so a failed compile cannot leave a bogus file.
pub fn write_pdf_export(root: &Path, note_path: &str, bytes: &[u8]) -> AppResult<String> {
    if bytes.is_empty() || !bytes.starts_with(b"%PDF") {
        return Err(AppError::Message(
            "refusing to write a file that is not a PDF".to_string(),
        ));
    }
    let relative = pdf_export_path(note_path)?;
    let path = resolve_inside_root(root, &relative)?;
    // Never write through a link: a dangling link would carry the
    // bytes to its target outside the root check above.
    if let Ok(meta) = std::fs::symlink_metadata(&path)
        && meta.file_type().is_symlink()
    {
        return Err(AppError::OutsideRoot(relative));
    }
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|err| AppError::io(parent, err))?;
    }
    // Write beside the target first, then swap it in, so a failed
    // write leaves the previous export whole.
    let temp = path.with_extension("pdf.tmp");
    std::fs::write(&temp, bytes).map_err(|err| AppError::io(&temp, err))?;
    if let Err(err) = std::fs::rename(&temp, &path) {
        let _ = std::fs::remove_file(&temp);
        return Err(AppError::io(&path, err));
    }
    Ok(relative)
}

pub fn write_note(root: &Path, relative: &str, text: &str) -> AppResult<()> {
    let path = resolve_inside_root(root, relative)?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|err| AppError::io(parent, err))?;
    }
    write_atomically(&path, text.as_bytes())
}

/// Write beside the target first, then swap it in, so a crash or a
/// failed write leaves the previous file whole instead of torn.
pub fn write_atomically(path: &Path, bytes: &[u8]) -> AppResult<()> {
    use std::io::Write;
    // The temp name carries the process id, so it never lands on a file
    // the student made, and two app instances never share one temp.
    let mut temp_name = path.as_os_str().to_owned();
    temp_name.push(format!(".wysityp-{}.tmp", std::process::id()));
    let temp = PathBuf::from(temp_name);
    let written = (|| -> AppResult<()> {
        let mut file = std::fs::File::create(&temp).map_err(|err| AppError::io(&temp, err))?;
        file.write_all(bytes)
            .map_err(|err| AppError::io(&temp, err))?;
        // Flush before the swap, so a power cut cannot leave the renamed
        // file empty.
        file.sync_all().map_err(|err| AppError::io(&temp, err))?;
        Ok(())
    })();
    if let Err(err) = written {
        let _ = std::fs::remove_file(&temp);
        return Err(err);
    }
    // A sync tool or scanner can hold the target for a moment on
    // Windows. A few short retries ride that out.
    let mut attempt = 0;
    loop {
        match std::fs::rename(&temp, path) {
            Ok(()) => return Ok(()),
            Err(err) => {
                attempt += 1;
                let locked = err.kind() == std::io::ErrorKind::PermissionDenied;
                if !locked || attempt >= 5 {
                    let _ = std::fs::remove_file(&temp);
                    return Err(AppError::io(path, err));
                }
                std::thread::sleep(std::time::Duration::from_millis(20));
            }
        }
    }
}

pub fn fingerprint_of(bytes: &[u8]) -> NoteFingerprint {
    fingerprint_bytes(bytes)
}

pub fn canonical_key(path: &Path) -> AppResult<String> {
    let canonical = canonical_root(path)?;
    Ok(canonical.to_string_lossy().replace('\\', "/"))
}

fn fingerprint_bytes(bytes: &[u8]) -> NoteFingerprint {
    let digest = Sha256::digest(bytes);
    NoteFingerprint {
        hash: hex_encode(&digest),
        byte_len: u32::try_from(bytes.len()).unwrap_or(u32::MAX),
    }
}

fn hex_encode(bytes: &[u8]) -> String {
    const HEX: &[u8; 16] = b"0123456789abcdef";
    let mut out = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        out.push(char::from(HEX[usize::from(byte >> 4)]));
        out.push(char::from(HEX[usize::from(byte & 0x0f)]));
    }
    out
}

fn note_from_text(path: String, text: String) -> Note {
    let fingerprint = fingerprint_bytes(text.as_bytes());
    Note {
        path,
        text,
        fingerprint,
    }
}

fn disk_fingerprint(root: &Path, relative: &str) -> AppResult<NoteFingerprint> {
    let path = resolve_inside_root(root, relative)?;
    let bytes = std::fs::read(&path).map_err(|err| AppError::io(&path, err))?;
    Ok(fingerprint_bytes(&bytes))
}

/// The fingerprint this process last read or wrote for each note path.
///
/// Saves are checked against this record. The page never supplies the
/// expected fingerprint, so a stale page cannot vouch for a file it did
/// not last read.
#[derive(Debug, Default)]
pub struct NoteBaselines {
    by_path: HashMap<String, NoteFingerprint>,
}

impl NoteBaselines {
    pub fn remember(&mut self, path: &str, fingerprint: NoteFingerprint) {
        self.by_path.insert(display_relative(path), fingerprint);
    }

    pub fn clear(&mut self) {
        self.by_path.clear();
    }

    /// Drop the record for a note or for everything inside a folder.
    pub fn forget(&mut self, path: &str) {
        let path = display_relative(path);
        let prefix = format!("{path}/");
        self.by_path
            .retain(|key, _| key != &path && !key.starts_with(&prefix));
    }

    /// Keep the record when a note or folder moves to a new path.
    pub fn retarget(&mut self, from: &str, to: &str) {
        let from = display_relative(from);
        let to = display_relative(to);
        if from.is_empty() || from == to {
            return;
        }
        let prefix = format!("{from}/");
        let keys: Vec<String> = self
            .by_path
            .keys()
            .filter(|key| *key == &from || key.starts_with(&prefix))
            .cloned()
            .collect();
        for key in keys {
            let Some(fingerprint) = self.by_path.remove(&key) else {
                continue;
            };
            let next = if key == from {
                to.clone()
            } else {
                format!("{to}{}", &key[from.len()..])
            };
            self.by_path.insert(next, fingerprint);
        }
    }

    /// True when the file on disk is not the bytes last read or written.
    ///
    /// A path this process has never read is treated as changed, so a save
    /// cannot invent a baseline. This does not update the record.
    pub fn changed_on_disk(&self, root: &Path, path: &str) -> AppResult<bool> {
        let key = display_relative(path);
        let Some(expected) = self.by_path.get(&key) else {
            return Ok(true);
        };
        match disk_fingerprint(root, &key) {
            Ok(current) => Ok(&current != expected),
            Err(AppError::Io { source, .. }) if source.kind() == std::io::ErrorKind::NotFound => {
                Ok(true)
            }
            Err(err) => Err(err),
        }
    }

    /// Write `text` to the note when the file still matches the baseline.
    ///
    /// `force` writes even when the file changed, then records the new bytes.
    /// A refused save leaves the file untouched.
    pub fn save(
        &mut self,
        root: &Path,
        path: &str,
        text: &str,
        force: bool,
    ) -> AppResult<NoteFingerprint> {
        let key = display_relative(path);
        if !force {
            let Some(expected) = self.by_path.get(&key).cloned() else {
                return Err(AppError::ExternalChange);
            };
            let current = match disk_fingerprint(root, &key) {
                Ok(current) => current,
                Err(AppError::Io { source, .. })
                    if source.kind() == std::io::ErrorKind::NotFound =>
                {
                    return Err(AppError::ExternalChange);
                }
                Err(err) => return Err(err),
            };
            if current != expected {
                return Err(AppError::ExternalChange);
            }
        }
        write_note(root, &key, text)?;
        let fingerprint = fingerprint_bytes(text.as_bytes());
        self.by_path.insert(key, fingerprint.clone());
        Ok(fingerprint)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn refuses_paths_that_climb_out() {
        let dir = tempfile::tempdir().unwrap();
        assert!(resolve_inside_root(dir.path(), "../secret.typ").is_err());
        assert!(resolve_inside_root(dir.path(), "a/../../secret.typ").is_err());
    }

    #[test]
    fn refuses_absolute_paths() {
        let dir = tempfile::tempdir().unwrap();
        assert!(resolve_inside_root(dir.path(), "C:/secret.typ").is_err());
    }

    #[test]
    fn writes_and_reads_inside_root() {
        let dir = tempfile::tempdir().unwrap();
        write_note(dir.path(), "notes/one.typ", "= Cześć\n").unwrap();
        let note = read_note(dir.path(), "notes/one.typ").unwrap();
        assert_eq!(note.text, "= Cześć\n");
        assert_eq!(list_notes(dir.path()).unwrap(), vec!["notes/one.typ"]);
    }

    // covers: feature 9, a save replaces the whole file and leaves no temp file
    #[test]
    fn write_note_replaces_atomically_without_leaving_a_temp() {
        let dir = tempfile::tempdir().unwrap();
        write_note(dir.path(), "notes/one.typ", "= One\n").unwrap();
        write_note(dir.path(), "notes/one.typ", "= Two, longer\n").unwrap();
        let note = read_note(dir.path(), "notes/one.typ").unwrap();
        assert_eq!(note.text, "= Two, longer\n");
        assert!(!dir.path().join("notes/one.typ.tmp").exists());
    }

    #[test]
    fn fingerprint_is_sha256_of_the_bytes() {
        let empty = fingerprint_bytes(b"");
        assert_eq!(empty.byte_len, 0);
        assert_eq!(
            empty.hash,
            "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        );
        let polish = fingerprint_bytes("Łódź".as_bytes());
        assert_eq!(polish.byte_len, u32::try_from("Łódź".len()).unwrap());
        assert_ne!(polish, empty);
    }

    // covers: feature 9, save when the file is unchanged, refuse an outside write, force, then the record moves
    #[test]
    fn save_refuses_an_outside_write_until_forced() {
        let dir = tempfile::tempdir().unwrap();
        let mut baselines = NoteBaselines::default();
        write_note(dir.path(), "notes/one.typ", "one\n").unwrap();
        let opened = read_note(dir.path(), "notes/one.typ").unwrap();
        baselines.remember(&opened.path, opened.fingerprint.clone());
        assert_eq!(opened.fingerprint, fingerprint_bytes(b"one\n"));
        assert!(
            !baselines
                .changed_on_disk(dir.path(), "notes/one.typ")
                .unwrap()
        );

        let saved = baselines
            .save(dir.path(), "notes/one.typ", "two\n", false)
            .unwrap();
        assert_eq!(
            read_note(dir.path(), "notes/one.typ").unwrap().text,
            "two\n"
        );
        assert_eq!(saved, fingerprint_bytes(b"two\n"));
        assert_eq!(
            read_note(dir.path(), "notes/one.typ").unwrap().fingerprint,
            saved
        );
        assert_ne!(saved, opened.fingerprint);
        assert!(
            !baselines
                .changed_on_disk(dir.path(), "notes/one.typ")
                .unwrap()
        );

        std::fs::write(dir.path().join("notes").join("one.typ"), "other\n").unwrap();
        assert!(
            baselines
                .changed_on_disk(dir.path(), "notes/one.typ")
                .unwrap()
        );
        let refused = baselines
            .save(dir.path(), "notes/one.typ", "mine\n", false)
            .unwrap_err();
        assert!(matches!(refused, AppError::ExternalChange));
        assert_eq!(
            std::fs::read_to_string(dir.path().join("notes").join("one.typ")).unwrap(),
            "other\n"
        );
        // Looking again must not adopt the outside bytes as the baseline.
        assert!(
            baselines
                .changed_on_disk(dir.path(), "notes/one.typ")
                .unwrap()
        );

        let forced = baselines
            .save(dir.path(), "notes/one.typ", "mine\n", true)
            .unwrap();
        assert_eq!(
            std::fs::read_to_string(dir.path().join("notes").join("one.typ")).unwrap(),
            "mine\n"
        );
        assert_eq!(forced, fingerprint_bytes(b"mine\n"));
        let reopened = read_note(dir.path(), "notes/one.typ").unwrap();
        baselines.remember(&reopened.path, reopened.fingerprint.clone());
        assert_eq!(reopened.fingerprint, forced);
        let again = baselines
            .save(dir.path(), "notes/one.typ", "mine again\n", false)
            .unwrap();
        assert_eq!(again, fingerprint_bytes(b"mine again\n"));
        assert_eq!(
            read_note(dir.path(), "notes/one.typ").unwrap().text,
            "mine again\n"
        );
    }

    // covers: features 9 and 10 together, a created note saves without force once its fingerprint is remembered
    #[test]
    fn a_created_note_saves_without_force_once_remembered() {
        let dir = tempfile::tempdir().unwrap();
        let mut baselines = NoteBaselines::default();
        let created = create_note(dir.path(), "", "Lecture").unwrap();
        baselines.remember(&created.path, created.fingerprint.clone());
        assert!(
            !baselines
                .changed_on_disk(dir.path(), &created.path)
                .unwrap()
        );

        baselines
            .save(
                dir.path(),
                &created.path,
                "= Lecture\n\nTyped live.\n",
                false,
            )
            .unwrap();

        assert_eq!(
            read_note(dir.path(), &created.path).unwrap().text,
            "= Lecture\n\nTyped live.\n"
        );
    }

    #[test]
    fn save_without_a_baseline_is_refused_and_a_missing_file_is_a_conflict() {
        let dir = tempfile::tempdir().unwrap();
        let mut baselines = NoteBaselines::default();
        write_note(dir.path(), "a.typ", "keep\n").unwrap();
        let err = baselines
            .save(dir.path(), "a.typ", "nope\n", false)
            .unwrap_err();
        assert!(matches!(err, AppError::ExternalChange));
        assert_eq!(
            std::fs::read_to_string(dir.path().join("a.typ")).unwrap(),
            "keep\n"
        );

        let opened = read_note(dir.path(), "a.typ").unwrap();
        baselines.remember(&opened.path, opened.fingerprint.clone());
        std::fs::remove_file(dir.path().join("a.typ")).unwrap();
        assert!(baselines.changed_on_disk(dir.path(), "a.typ").unwrap());
        let missing = baselines
            .save(dir.path(), "a.typ", "back\n", false)
            .unwrap_err();
        assert!(matches!(missing, AppError::ExternalChange));
        assert!(!dir.path().join("a.typ").exists());

        let forced = baselines.save(dir.path(), "a.typ", "back\n", true).unwrap();
        assert_eq!(forced, fingerprint_bytes(b"back\n"));
        assert_eq!(
            std::fs::read_to_string(dir.path().join("a.typ")).unwrap(),
            "back\n"
        );
    }

    #[test]
    fn a_save_for_one_note_does_not_write_another_and_a_move_keeps_the_baseline() {
        let dir = tempfile::tempdir().unwrap();
        let mut baselines = NoteBaselines::default();
        write_note(dir.path(), "a.typ", "aaa\n").unwrap();
        write_note(dir.path(), "b.typ", "bbb\n").unwrap();
        let note_a = read_note(dir.path(), "a.typ").unwrap();
        let note_b = read_note(dir.path(), "b.typ").unwrap();
        baselines.remember(&note_a.path, note_a.fingerprint.clone());
        baselines.remember(&note_b.path, note_b.fingerprint);
        baselines
            .save(dir.path(), "a.typ", "aaa changed\n", false)
            .unwrap();
        assert_eq!(read_note(dir.path(), "b.typ").unwrap().text, "bbb\n");

        baselines.retarget("a.typ", "nested/a.typ");
        // The file itself is moved by the caller. The record must follow the new path.
        std::fs::create_dir(dir.path().join("nested")).unwrap();
        std::fs::rename(
            dir.path().join("a.typ"),
            dir.path().join("nested").join("a.typ"),
        )
        .unwrap();
        assert!(
            !baselines
                .changed_on_disk(dir.path(), "nested/a.typ")
                .unwrap()
        );
        baselines
            .save(dir.path(), "nested/a.typ", "moved\n", false)
            .unwrap();
        assert_eq!(
            read_note(dir.path(), "nested/a.typ").unwrap().text,
            "moved\n"
        );

        baselines.forget("nested");
        let forgotten = baselines
            .save(dir.path(), "nested/a.typ", "again\n", false)
            .unwrap_err();
        assert!(matches!(forgotten, AppError::ExternalChange));
        assert!(
            baselines
                .save(dir.path(), "../outside.typ", "x\n", true)
                .is_err()
        );
        assert!(!dir.path().parent().unwrap().join("outside.typ").exists());
    }

    #[test]
    fn search_finds_a_line_with_path_number_and_snippet() {
        let dir = tempfile::tempdir().unwrap();
        write_note(
            dir.path(),
            "notes/proof.typ",
            "intro\n  The Proof sits here and also Proof again\n",
        )
        .unwrap();
        let hits = search_notes(dir.path(), "proof").unwrap();
        assert_eq!(
            hits,
            vec![SearchHit {
                path: "notes/proof.typ".to_string(),
                line: 2,
                snippet: "The Proof sits here and also Proof again".to_string(),
            }]
        );
    }

    #[test]
    fn search_is_case_insensitive_and_empty_query_is_empty() {
        let dir = tempfile::tempdir().unwrap();
        write_note(dir.path(), "a.typ", "Całka\n").unwrap();
        let hits = search_notes(dir.path(), "całka").unwrap();
        assert_eq!(hits.len(), 1);
        assert_eq!(hits[0].snippet, "Całka");
        assert!(search_notes(dir.path(), "").unwrap().is_empty());
        assert!(search_notes(dir.path(), "   ").unwrap().is_empty());
    }

    #[test]
    fn search_skips_unreadable_text_and_non_typst_files() {
        let dir = tempfile::tempdir().unwrap();
        write_note(dir.path(), "good.typ", "needle\n").unwrap();
        std::fs::write(dir.path().join("skip.txt"), "needle").unwrap();
        std::fs::write(dir.path().join("bad.typ"), [0xff, 0xfe, b'n']).unwrap();
        let hits = search_notes(dir.path(), "needle").unwrap();
        assert_eq!(hits.len(), 1);
        assert_eq!(hits[0].path, "good.typ");
    }

    #[test]
    #[cfg(windows)]
    fn search_skips_a_note_that_cannot_be_read() {
        use std::os::windows::fs::OpenOptionsExt;
        let dir = tempfile::tempdir().unwrap();
        let locked = dir.path().join("locked.typ");
        std::fs::write(&locked, "needle\n").unwrap();
        write_note(dir.path(), "open.typ", "needle\n").unwrap();
        let _hold = std::fs::OpenOptions::new()
            .read(true)
            .share_mode(0)
            .open(&locked)
            .unwrap();
        let hits = search_notes(dir.path(), "needle").unwrap();
        assert_eq!(
            hits,
            vec![SearchHit {
                path: "open.typ".to_string(),
                line: 1,
                snippet: "needle".to_string(),
            }]
        );
    }

    #[test]
    fn search_truncates_a_long_matching_line() {
        let dir = tempfile::tempdir().unwrap();
        let long = "x".repeat(SNIPPET_CHARS + 40);
        write_note(dir.path(), "long.typ", &format!("  {long}\n")).unwrap();
        let hits = search_notes(dir.path(), "x").unwrap();
        assert_eq!(hits.len(), 1);
        assert_eq!(hits[0].snippet.chars().count(), SNIPPET_CHARS);
        assert!(hits[0].snippet.chars().all(|ch| ch == 'x'));
    }

    // covers: feature 10, the snippet window keeps the match in view
    #[test]
    fn search_snippet_keeps_a_late_match_and_cuts_by_characters() {
        let dir = tempfile::tempdir().unwrap();
        let line = format!("{} igła", "ą".repeat(200));
        write_note(dir.path(), "late.typ", &format!("{line}\n")).unwrap();
        let hits = search_notes(dir.path(), "igła").unwrap();
        assert_eq!(hits.len(), 1);
        assert!(hits[0].snippet.contains("igła"), "{}", hits[0].snippet);
        assert!(hits[0].snippet.chars().count() <= SNIPPET_CHARS);
    }

    // covers: feature 10, CRLF notes keep editor line numbers
    #[test]
    fn search_counts_lines_in_a_crlf_note() {
        let dir = tempfile::tempdir().unwrap();
        write_note(dir.path(), "crlf.typ", "one\r\nneedle\r\nthree\r\n").unwrap();
        let hits = search_notes(dir.path(), "needle").unwrap();
        assert_eq!(hits.len(), 1);
        assert_eq!(hits[0].line, 2);
    }

    #[test]
    fn search_orders_by_path_then_line_and_stops_at_the_cap() {
        let dir = tempfile::tempdir().unwrap();
        write_note(dir.path(), "b.typ", "hit\nhit\n").unwrap();
        write_note(dir.path(), "a/z.typ", "no\nhit\n").unwrap();
        let hits = search_notes(dir.path(), "hit").unwrap();
        assert_eq!(
            hits.iter()
                .map(|hit| (hit.path.as_str(), hit.line))
                .collect::<Vec<_>>(),
            vec![("a/z.typ", 2), ("b.typ", 1), ("b.typ", 2)]
        );

        let mut many = String::new();
        for _ in 0..(SEARCH_RESULT_CAP + 5) {
            many.push_str("hit\n");
        }
        write_note(dir.path(), "many.typ", &many).unwrap();
        assert_eq!(
            search_notes(dir.path(), "hit").unwrap().len(),
            SEARCH_RESULT_CAP
        );
    }

    // covers: proof 2, a folder with subfolders lists every note once
    #[test]
    fn lists_notes_in_folders_in_sorted_order() {
        let dir = tempfile::tempdir().unwrap();
        write_note(dir.path(), "z.typ", "= Z\n").unwrap();
        write_note(dir.path(), "notes/b.typ", "= B\n").unwrap();
        write_note(dir.path(), "a.typ", "= A\n").unwrap();
        write_note(dir.path(), "notes/readme.txt", "not a note\n").unwrap();
        assert_eq!(
            list_notes(dir.path()).unwrap(),
            vec!["a.typ", "notes/b.typ", "z.typ"]
        );
    }

    // covers: proof 5, saving writes the new words over the old ones
    #[test]
    fn saving_again_writes_the_new_words() {
        let dir = tempfile::tempdir().unwrap();
        write_note(dir.path(), "one.typ", "= Old\n").unwrap();
        write_note(dir.path(), "one.typ", "= New\n").unwrap();
        assert_eq!(read_note(dir.path(), "one.typ").unwrap().text, "= New\n");
        let on_disk = std::fs::read_to_string(dir.path().join("one.typ")).unwrap();
        assert_eq!(on_disk, "= New\n");
    }

    #[test]
    fn reading_a_missing_note_is_an_error() {
        let dir = tempfile::tempdir().unwrap();
        assert!(read_note(dir.path(), "missing.typ").is_err());
    }

    #[test]
    fn an_empty_path_is_refused() {
        let dir = tempfile::tempdir().unwrap();
        assert!(resolve_inside_root(dir.path(), "").is_err());
        assert!(resolve_inside_root(dir.path(), "   ").is_err());
    }

    // covers: proof 7, the sample carries what the proof asks it to carry
    #[test]
    fn sample_note_carries_polish_math_and_a_figure() {
        assert!(SAMPLE_PATH.ends_with(".typ"));
        assert!(SAMPLE_TEXT.contains("Łódź"));
        assert!(SAMPLE_TEXT.contains("$x^2 + y^2 = z^2$"));
        assert!(SAMPLE_TEXT.contains("#figure("));
    }

    #[test]
    fn creates_a_note_with_a_heading_from_its_name() {
        let dir = tempfile::tempdir().unwrap();
        let note = create_note(dir.path(), "", "Wykład").unwrap();
        assert_eq!(note.path, "Wykład.typ");
        assert_eq!(note.text, "= Wykład\n");
        let nested = create_note(dir.path(), "lab", "one.typ");
        assert!(nested.is_err());
        create_folder(dir.path(), "", "lab").unwrap();
        let nested = create_note(dir.path(), "lab", "one.typ").unwrap();
        assert_eq!(nested.path, "lab/one.typ");
        assert!(create_note(dir.path(), "lab", "one.typ").is_err());
        assert!(create_note(dir.path(), "", "notes.txt").is_err());
        assert!(create_note(dir.path(), "", "../x.typ").is_err());
        assert!(create_note(dir.path(), "", "C:/x.typ").is_err());
        assert!(create_note(dir.path(), "", "").is_err());
    }

    #[test]
    fn creates_a_folder_and_refuses_a_collision() {
        let dir = tempfile::tempdir().unwrap();
        assert_eq!(create_folder(dir.path(), "", "lab").unwrap(), "lab");
        assert!(create_folder(dir.path(), "", "lab").is_err());
        assert!(create_folder(dir.path(), "", "..").is_err());
        assert!(create_folder(dir.path(), "", "CON").is_err());
        assert!(dir.path().join("lab").is_dir());
    }

    #[test]
    fn renames_and_moves_without_overwriting() {
        let dir = tempfile::tempdir().unwrap();
        create_note(dir.path(), "", "old.typ").unwrap();
        create_folder(dir.path(), "", "dest").unwrap();
        create_note(dir.path(), "dest", "kept.typ").unwrap();
        let moved = rename_entry(dir.path(), "old.typ", "dest/new.typ").unwrap();
        assert_eq!(moved, "dest/new.typ");
        assert!(dir.path().join("dest/new.typ").is_file());
        assert!(!dir.path().join("old.typ").exists());
        assert!(rename_entry(dir.path(), "dest/new.typ", "dest/kept.typ").is_err());
        assert!(rename_entry(dir.path(), "dest/new.typ", "dest/new").is_err());
        assert!(rename_entry(dir.path(), "dest/new.typ", "missing/new.typ").is_err());
        assert!(
            read_note(dir.path(), "dest/kept.typ")
                .unwrap()
                .text
                .starts_with("= kept")
        );
    }

    #[test]
    fn refuses_moving_a_folder_into_itself() {
        let dir = tempfile::tempdir().unwrap();
        create_folder(dir.path(), "", "outer").unwrap();
        create_folder(dir.path(), "outer", "inner").unwrap();
        assert!(rename_entry(dir.path(), "outer", "outer/inner/outer").is_err());
        assert!(rename_entry(dir.path(), "outer", "OUTER/child").is_err());
        assert!(dir.path().join("outer/inner").is_dir());
        assert!(dir.path().join("outer").join("inner").is_dir());
    }

    #[test]
    fn deletes_a_note_or_folder_but_not_the_root() {
        let dir = tempfile::tempdir().unwrap();
        create_note(dir.path(), "", "gone.typ").unwrap();
        create_folder(dir.path(), "", "box").unwrap();
        create_note(dir.path(), "box", "inside.typ").unwrap();
        delete_entry(dir.path(), "gone.typ").unwrap();
        assert!(!dir.path().join("gone.typ").exists());
        delete_entry(dir.path(), "box").unwrap();
        assert!(!dir.path().join("box").exists());
        assert!(delete_entry(dir.path(), "").is_err());
        assert!(delete_entry(dir.path(), ".").is_err());
        assert!(dir.path().exists());
    }

    #[test]
    fn new_operations_refuse_paths_that_escape() {
        let dir = tempfile::tempdir().unwrap();
        create_note(dir.path(), "", "stay.typ").unwrap();
        assert!(create_note(dir.path(), "..", "x.typ").is_err());
        assert!(create_folder(dir.path(), "a/../../", "x").is_err());
        assert!(rename_entry(dir.path(), "stay.typ", "../leave.typ").is_err());
        assert!(rename_entry(dir.path(), "stay.typ", "C:/leave.typ").is_err());
        assert!(delete_entry(dir.path(), "../stay.typ").is_err());
        assert!(dir.path().join("stay.typ").is_file());
    }

    #[test]
    fn tree_lists_folders_then_notes() {
        let dir = tempfile::tempdir().unwrap();
        create_note(dir.path(), "", "b.typ").unwrap();
        create_folder(dir.path(), "", "a").unwrap();
        create_note(dir.path(), "a", "c.typ").unwrap();
        let tree = list_tree(dir.path()).unwrap();
        assert_eq!(tree[0].kind, "folder");
        assert_eq!(tree[0].path, "a");
        assert_eq!(tree[0].children[0].path, "a/c.typ");
        assert_eq!(tree[1].kind, "note");
        std::fs::create_dir(dir.path().join(".git")).unwrap();
        std::fs::write(dir.path().join(".git").join("hidden.typ"), "= H\n").unwrap();
        let tree = list_tree(dir.path()).unwrap();
        assert!(tree.iter().all(|node| !node.name.starts_with('.')));
        assert_eq!(tree.len(), 2);
    }

    #[test]
    fn pdf_export_path_sits_beside_the_note() {
        assert_eq!(
            pdf_export_path("notes/lecture.typ").unwrap(),
            "notes/lecture.pdf"
        );
        assert_eq!(pdf_export_path("lecture.typ").unwrap(), "lecture.pdf");
        assert_eq!(
            pdf_export_path("notes/my.lecture.typ").unwrap(),
            "notes/my.lecture.pdf"
        );
        assert!(pdf_export_path("../lecture.typ").is_err());
        assert!(pdf_export_path("C:/lecture.typ").is_err());
    }

    #[test]
    fn writes_the_pdf_beside_the_note_and_overwrites_it() {
        let dir = tempfile::tempdir().unwrap();
        let first = write_pdf_export(dir.path(), "notes/lecture.typ", b"%PDF-1.7\nfirst").unwrap();
        assert_eq!(first, "notes/lecture.pdf");
        write_pdf_export(dir.path(), "notes/lecture.typ", b"%PDF-1.7\nsecond").unwrap();
        let bytes = std::fs::read(dir.path().join("notes").join("lecture.pdf")).unwrap();
        assert_eq!(bytes, b"%PDF-1.7\nsecond");
    }

    #[test]
    fn refuses_to_write_bytes_that_are_not_a_pdf() {
        let dir = tempfile::tempdir().unwrap();
        assert!(write_pdf_export(dir.path(), "notes/lecture.typ", b"not a pdf").is_err());
        assert!(write_pdf_export(dir.path(), "notes/lecture.typ", b"").is_err());
        assert!(!dir.path().join("notes").join("lecture.pdf").exists());
    }

    #[test]
    fn rename_moves_the_assets_folder_and_rewrites_a_quoted_path() {
        let dir = tempfile::tempdir().unwrap();
        create_note(dir.path(), "", "unsaved.typ").unwrap();
        let assets = dir.path().join("unsaved.assets");
        std::fs::create_dir(&assets).unwrap();
        std::fs::write(assets.join("image.png"), b"png").unwrap();
        write_note(
            dir.path(),
            "unsaved.typ",
            "#image(\"unsaved.assets/image.png\")\nsee /unsaved.assets/image.png\n",
        )
        .unwrap();
        rename_entry(dir.path(), "unsaved.typ", "lecture.typ").unwrap();
        assert!(
            dir.path()
                .join("lecture.assets")
                .join("image.png")
                .is_file()
        );
        assert!(!dir.path().join("unsaved.assets").exists());
        let text = read_note(dir.path(), "lecture.typ").unwrap().text;
        assert!(text.contains("#image(\"lecture.assets/image.png\")"));
        assert!(text.contains("see /unsaved.assets/image.png"));
    }

    #[test]
    fn a_leftover_assets_folder_blocks_the_rename() {
        let dir = tempfile::tempdir().unwrap();
        create_note(dir.path(), "", "unsaved.typ").unwrap();
        std::fs::create_dir(dir.path().join("lecture.assets")).unwrap();
        let err = rename_entry(dir.path(), "unsaved.typ", "lecture.typ").unwrap_err();
        assert!(matches!(err, AppError::AlreadyExists(_)));
        assert!(dir.path().join("unsaved.typ").is_file());
        assert!(dir.path().join("lecture.assets").is_dir());
    }

    #[test]
    fn deleting_a_note_leaves_its_assets_folder_and_the_tree_hides_it() {
        let dir = tempfile::tempdir().unwrap();
        create_note(dir.path(), "", "lecture.typ").unwrap();
        std::fs::create_dir(dir.path().join("lecture.assets")).unwrap();
        std::fs::write(dir.path().join("lecture.pdf"), b"%PDF").unwrap();
        delete_entry(dir.path(), "lecture.typ").unwrap();
        assert!(!dir.path().join("lecture.typ").exists());
        assert!(dir.path().join("lecture.assets").is_dir());
        assert!(dir.path().join("lecture.pdf").is_file());
        assert!(delete_entry(dir.path(), "lecture.assets").is_err());
        assert!(rename_entry(dir.path(), "lecture.assets", "other.assets").is_err());
        let tree = list_tree(dir.path()).unwrap();
        assert!(
            tree.iter()
                .all(|node| !node.name.to_lowercase().ends_with(".assets"))
        );
        create_folder(dir.path(), "", "week").unwrap();
        std::fs::create_dir(dir.path().join("week").join("lecture.assets")).unwrap();
        delete_entry(dir.path(), "week").unwrap();
        assert!(!dir.path().join("week").exists());
    }

    #[test]
    fn save_note_image_writes_beside_the_note_and_refuses_a_bad_file() {
        let dir = tempfile::tempdir().unwrap();
        create_note(dir.path(), "", "unsaved.typ").unwrap();
        let before = std::fs::read(dir.path().join("unsaved.typ")).unwrap();
        let written = save_note_image(dir.path(), "unsaved.typ", "", b"png").unwrap();
        assert_eq!(written, "unsaved.assets/image.png");
        assert_eq!(
            std::fs::read(dir.path().join("unsaved.typ")).unwrap(),
            before
        );
        let gif = save_note_image(dir.path(), "unsaved.typ", "slide.gif", b"gif").unwrap();
        assert_eq!(gif, "unsaved.assets/slide.gif");
        let clash = save_note_image(dir.path(), "unsaved.typ", "slide.gif", b"gif2").unwrap();
        assert_eq!(clash, "unsaved.assets/slide-1.gif");
        assert!(save_note_image(dir.path(), "unsaved.typ", "../x.png", b"no").is_err());
        assert!(save_note_image(dir.path(), "unsaved.typ", "draw.svg", b"no").is_err());
        let huge = vec![0_u8; 20 * 1024 * 1024 + 1];
        let err = save_note_image(dir.path(), "unsaved.typ", "big.png", &huge).unwrap_err();
        assert!(err.to_string().starts_with("image-refused:"));
        assert!(!dir.path().join("x.png").exists());
        assert!(!dir.path().join("unsaved.assets").join("draw.svg").exists());
        assert!(!dir.path().join("unsaved.assets").join("big.png").exists());
    }

    #[test]
    fn an_assets_path_that_is_a_file_blocks_the_image_write() {
        let dir = tempfile::tempdir().unwrap();
        create_note(dir.path(), "", "unsaved.typ").unwrap();
        std::fs::write(dir.path().join("unsaved.assets"), b"not a folder").unwrap();
        let err = save_note_image(dir.path(), "unsaved.typ", "", b"png").unwrap_err();
        assert!(err.to_string().starts_with("image-refused:"));
        assert!(dir.path().join("unsaved.assets").is_file());
    }

    // covers: spec 0006 AC-10, every allowed type in any case, and nothing else
    #[test]
    fn image_types_are_allowed_in_any_case_and_the_rest_leave_no_folder() {
        let dir = tempfile::tempdir().unwrap();
        create_note(dir.path(), "", "unsaved.typ").unwrap();
        for name in ["a.PNG", "b.Jpg", "c.jpeg", "d.GIF", "e.webp"] {
            let written = save_note_image(dir.path(), "unsaved.typ", name, b"x").unwrap();
            assert_eq!(written, format!("unsaved.assets/{name}"));
        }

        let other = tempfile::tempdir().unwrap();
        create_note(other.path(), "", "unsaved.typ").unwrap();
        for name in [
            "x.svg",
            "x.bmp",
            "noext",
            "x.png.",
            "x.png ",
            "a/b.png",
            "..\\b.png",
            "a\"b.png",
            "a'b.png",
            "a:b.png",
            "a*b.png",
            "a?b.png",
            "a<b.png",
            "a>b.png",
            "a|b.png",
            "CON.png",
            "nul.png",
        ] {
            let err = save_note_image(other.path(), "unsaved.typ", name, b"x").unwrap_err();
            assert!(
                err.to_string().starts_with("image-refused:"),
                "{name} gave {err}"
            );
        }
        assert!(!other.path().join("unsaved.assets").exists());
    }

    // covers: spec 0006 AC-10, an empty name runs image.png then image-1 to image-99, the 101st is refused
    #[test]
    fn the_image_sequence_ends_after_one_hundred_names() {
        let dir = tempfile::tempdir().unwrap();
        create_note(dir.path(), "", "unsaved.typ").unwrap();
        let first = save_note_image(dir.path(), "unsaved.typ", "", b"x").unwrap();
        assert_eq!(first, "unsaved.assets/image.png");
        for number in 1..=99 {
            let written = save_note_image(dir.path(), "unsaved.typ", "", b"x").unwrap();
            assert_eq!(written, format!("unsaved.assets/image-{number}.png"));
        }
        let err = save_note_image(dir.path(), "unsaved.typ", "", b"x").unwrap_err();
        assert!(err.to_string().starts_with("image-refused:"));
        let count = std::fs::read_dir(dir.path().join("unsaved.assets"))
            .unwrap()
            .count();
        assert_eq!(count, 100);
    }

    // covers: spec 0006 AC-10, 20 MB exactly is allowed and a non Typst note is refused
    #[test]
    fn the_image_size_cap_is_inclusive_and_only_a_typ_note_takes_pictures() {
        let dir = tempfile::tempdir().unwrap();
        create_note(dir.path(), "", "unsaved.typ").unwrap();
        let exact = vec![0_u8; 20 * 1024 * 1024];
        save_note_image(dir.path(), "unsaved.typ", "edge.png", &exact).unwrap();
        std::fs::write(dir.path().join("readme.txt"), b"hi").unwrap();
        let err = save_note_image(dir.path(), "readme.txt", "a.png", b"x").unwrap_err();
        assert!(err.to_string().starts_with("image-refused:"));
        assert!(!dir.path().join("readme.assets").exists());
        let missing = save_note_image(dir.path(), "gone.typ", "a.png", b"x").unwrap_err();
        assert!(missing.to_string().starts_with("image-refused:"));
    }

    // covers: spec 0006 AC-11, only a quote or the start of the file lets the prefix move
    #[test]
    fn rewrite_changes_a_prefix_only_after_a_quote_or_at_the_start() {
        let text = "old.assets/a.png\n\"old.assets/b.png\"\n'old.assets/c.png'\n/old.assets/d.png\nsub/old.assets/e.png\nxold.assets/f.png\n";
        let out = rewrite_assets_prefix(text, "old", "new");
        assert_eq!(
            out,
            "new.assets/a.png\n\"new.assets/b.png\"\n'new.assets/c.png'\n/old.assets/d.png\nsub/old.assets/e.png\nxold.assets/f.png\n"
        );
    }

    // covers: spec 0006 AC-11, bytes that are not UTF-8 still rename and are left as they were
    #[test]
    fn a_note_that_is_not_utf8_still_renames_with_its_assets() {
        let dir = tempfile::tempdir().unwrap();
        create_note(dir.path(), "", "draft.typ").unwrap();
        let bytes = [0xff_u8, 0xfe, b'"', b'd', b'r', b'a', b'f', b't'];
        std::fs::write(dir.path().join("draft.typ"), bytes).unwrap();
        std::fs::create_dir(dir.path().join("draft.assets")).unwrap();
        rename_entry(dir.path(), "draft.typ", "final.typ").unwrap();
        assert_eq!(std::fs::read(dir.path().join("final.typ")).unwrap(), bytes);
        assert!(dir.path().join("final.assets").is_dir());
        assert!(!dir.path().join("draft.assets").exists());
    }

    // covers: spec 0006 AC-11, a taken new note name moves nothing
    #[test]
    fn a_taken_new_note_name_leaves_the_assets_where_they_were() {
        let dir = tempfile::tempdir().unwrap();
        create_note(dir.path(), "", "draft.typ").unwrap();
        create_note(dir.path(), "", "final.typ").unwrap();
        std::fs::create_dir(dir.path().join("draft.assets")).unwrap();
        let err = rename_entry(dir.path(), "draft.typ", "final.typ").unwrap_err();
        assert!(matches!(err, AppError::AlreadyExists(_)));
        assert!(dir.path().join("draft.typ").is_file());
        assert!(dir.path().join("draft.assets").is_dir());
        assert!(!dir.path().join("final.assets").exists());
    }

    // covers: spec 0006 AC-11, renaming a folder does not rewrite note text
    #[test]
    fn renaming_a_folder_does_not_rewrite_the_notes_inside() {
        let dir = tempfile::tempdir().unwrap();
        create_folder(dir.path(), "", "week").unwrap();
        create_note(dir.path(), "week", "lecture.typ").unwrap();
        let text = "#image(\"lecture.assets/a.png\")\n";
        write_note(dir.path(), "week/lecture.typ", text).unwrap();
        rename_entry(dir.path(), "week", "term").unwrap();
        assert_eq!(
            read_note(dir.path(), "term/lecture.typ").unwrap().text,
            text
        );
    }
}
