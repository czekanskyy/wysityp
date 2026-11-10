use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use serde::{Deserialize, Serialize};
use specta::Type;
use typst::{LibraryExt, World};
use typst_kit::datetime::Time;
use typst_kit::downloader::SystemDownloader;
use typst_kit::files::{FileLoader, FileStore, FsRoot, SystemFiles};
use typst_kit::fonts::FontStore;
use typst_kit::packages::SystemPackages;
use typst_layout::PagedDocument;
use typst_library::diag::{FileResult, Severity, SourceDiagnostic};
use typst_library::foundations::{Bytes, Datetime, Duration};
use typst_library::layout::{Frame, FrameItem};
use typst_library::text::{Font, FontBook};
use typst_library::{Library, WorldExt};
use typst_syntax::{FileId, RootedPath, Source, VirtualPath, VirtualRoot};
use typst_utils::LazyHash;

use crate::error::{AppError, AppResult};

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct RenderDiagnostic {
    pub severity: String,
    pub file: String,
    pub start: u32,
    pub end: u32,
    pub message: String,
    pub hints: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct RenderResult {
    pub revision: u32,
    pub pages: Vec<String>,
    pub diagnostics: Vec<RenderDiagnostic>,
}

/// The bundled font families come first, so they win over a system
/// family with the same name. They are the families Typst itself
/// ships: Libertinus Serif and New Computer Modern for text,
/// New Computer Modern Math for math, and Deja Vu Sans Mono for code.
/// Each ships under an open licence that allows bundling it in an app.
/// System fonts found on the machine come after the bundled set.
pub fn build_fonts() -> FontStore {
    let mut store = FontStore::new();
    store.extend(typst_kit::fonts::embedded());
    store.extend(typst_kit::fonts::system());
    store
}

struct BufferLoader {
    main_id: FileId,
    buffer: String,
    system: SystemFiles,
}

impl FileLoader for BufferLoader {
    fn load(&self, id: FileId) -> FileResult<Bytes> {
        if id == self.main_id {
            Ok(Bytes::from_string(self.buffer.clone()))
        } else {
            self.system.load(id)
        }
    }
}

struct NoteWorld {
    library: LazyHash<Library>,
    fonts: Arc<FontStore>,
    files: FileStore<BufferLoader>,
    main_id: FileId,
    time: Time,
    root: PathBuf,
    note_path: String,
    last_document: Option<PagedDocument>,
    /// Source that `last_document` was compiled from.
    /// Export reuses that document when the editor still has this source,
    /// so the PDF keeps the date pinned for that compile.
    compiled_source: Option<String>,
}

impl NoteWorld {
    fn new(fonts: Arc<FontStore>, root: &Path, note_path: &str, source: &str) -> AppResult<Self> {
        // An empty path is the editor buffer while a template is open.
        // It is not a file in the notes folder. Includes still resolve there.
        let virtual_name = if note_path.is_empty() {
            "/.wysityp-buffer.typ".to_string()
        } else {
            format!("/{note_path}")
        };
        let vpath = VirtualPath::new(virtual_name)
            .map_err(|err| AppError::Message(format!("bad note path: {err}")))?;
        let main_id = FileId::new(RootedPath::new(VirtualRoot::Project, vpath));
        let packages = SystemPackages::new(SystemDownloader::new("WYSITyp"));
        let system = SystemFiles::new(FsRoot::new(root.to_path_buf()), packages);
        Ok(Self {
            library: LazyHash::new(Library::builder().build()),
            fonts,
            files: FileStore::new(BufferLoader {
                main_id,
                buffer: source.to_string(),
                system,
            }),
            main_id,
            time: Time::system(),
            root: root.to_path_buf(),
            note_path: note_path.to_string(),
            last_document: None,
            compiled_source: None,
        })
    }

    fn update(&mut self, source: &str) {
        self.files.loader_mut().buffer = source.to_string();
        self.files.reset();
        self.time.reset();
    }
}

impl World for NoteWorld {
    fn library(&self) -> &LazyHash<Library> {
        &self.library
    }

    fn book(&self) -> &LazyHash<FontBook> {
        self.fonts.book()
    }

    fn main(&self) -> FileId {
        self.main_id
    }

    fn source(&self, id: FileId) -> FileResult<Source> {
        self.files.source(id)
    }

    fn file(&self, id: FileId) -> FileResult<Bytes> {
        self.files.file(id)
    }

    fn font(&self, index: usize) -> Option<Font> {
        self.fonts.font(index)
    }

    fn today(&self, offset: Option<Duration>) -> Option<Datetime> {
        self.time.today(offset)
    }
}

fn map_diagnostic(world: &NoteWorld, diagnostic: &SourceDiagnostic) -> RenderDiagnostic {
    let range = world.range(diagnostic.span);
    RenderDiagnostic {
        severity: match diagnostic.severity {
            Severity::Error => "error".to_string(),
            Severity::Warning => "warning".to_string(),
        },
        file: diagnostic
            .span
            .id()
            .map(|id| id.vpath().get_without_slash().to_string())
            .unwrap_or_default(),
        start: range.as_ref().map(|range| range.start as u32).unwrap_or(0),
        end: range.map(|range| range.end as u32).unwrap_or(0),
        message: diagnostic.message.to_string(),
        hints: diagnostic
            .hints
            .iter()
            .map(|hint| hint.v.to_string())
            .collect(),
    }
}

/// One engine for the app. It holds the font set and the world for the
/// open note, so work from one compile can help the next one.
pub struct Engine {
    fonts: Arc<FontStore>,
    world: Mutex<Option<NoteWorld>>,
    gate: Mutex<()>,
}

impl Engine {
    pub fn new() -> Self {
        Self {
            fonts: Arc::new(build_fonts()),
            world: Mutex::new(None),
            gate: Mutex::new(()),
        }
    }

    pub fn render(
        &self,
        root: &Path,
        note_path: &str,
        source: &str,
        revision: u32,
    ) -> AppResult<RenderResult> {
        // The gate guards nothing but turn taking, so a panicked
        // compile must not disable every later render: take it back.
        let _gate = self.gate.lock().unwrap_or_else(|err| err.into_inner());
        let mut world = {
            let mut slot = self
                .world
                .lock()
                .map_err(|_| AppError::Message("world lock was poisoned".to_string()))?;
            match slot.take() {
                Some(existing) if existing.root == root && existing.note_path == note_path => {
                    existing
                }
                _ => NoteWorld::new(self.fonts.clone(), root, note_path, source)?,
            }
        };
        world.update(source);

        let warned = typst::compile::<PagedDocument>(&world as &dyn World);
        let mut diagnostics: Vec<RenderDiagnostic> = warned
            .warnings
            .iter()
            .map(|diag| map_diagnostic(&world, diag))
            .collect();
        let pages = match warned.output {
            Ok(document) => {
                let pages: Vec<String> = document
                    .pages()
                    .iter()
                    .map(|page| typst_svg::svg(page, &typst_svg::SvgOptions::default()))
                    .collect();
                world.compiled_source = Some(source.to_string());
                world.last_document = Some(document);
                pages
            }
            Err(errors) => {
                diagnostics.extend(errors.iter().map(|diag| map_diagnostic(&world, diag)));
                world.compiled_source = None;
                world.last_document = None;
                Vec::new()
            }
        };
        comemo::evict(30);

        let mut slot = self
            .world
            .lock()
            .map_err(|_| AppError::Message("world lock was poisoned".to_string()))?;
        *slot = Some(world);
        Ok(RenderResult {
            revision,
            pages,
            diagnostics,
        })
    }

    /// Compile the editor source and return PDF bytes.
    ///
    /// When this engine already compiled that exact source, the kept document
    /// is exported and the pinned date stays. Otherwise one fresh compile runs
    /// first and its date is pinned for this export. This function does not
    /// write a file.
    pub fn export_pdf(&self, root: &Path, note_path: &str, source: &str) -> AppResult<Vec<u8>> {
        let _gate = self.gate.lock().unwrap_or_else(|err| err.into_inner());
        let mut world = {
            let mut slot = self
                .world
                .lock()
                .map_err(|_| AppError::Message("world lock was poisoned".to_string()))?;
            match slot.take() {
                Some(existing) if existing.root == root && existing.note_path == note_path => {
                    existing
                }
                _ => NoteWorld::new(self.fonts.clone(), root, note_path, source)?,
            }
        };

        let result = export_from_world(&mut world, source);
        comemo::evict(30);
        let mut slot = self
            .world
            .lock()
            .map_err(|_| AppError::Message("world lock was poisoned".to_string()))?;
        *slot = Some(world);
        result
    }

    /// Compile one tiny formula document. Does not touch the open note's world.
    ///
    /// A panic inside Typst becomes an error string. The note preview keeps
    /// the engine gate between formulas, so a bad formula cannot take it down.
    pub fn render_math_source(
        &self,
        root: &Path,
        note_path: &str,
        source: &str,
    ) -> Result<TinyRender, String> {
        let _gate = self.gate.lock().unwrap_or_else(|err| err.into_inner());
        match std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            compile_tiny(&self.fonts, root, note_path, source)
        })) {
            Ok(result) => result,
            Err(_) => Err("Typst panicked while compiling a formula".to_string()),
        }
    }
}

/// Pixel size of one compiled formula. The baseline is measured from the top.
#[derive(Debug, Clone)]
pub struct TinyRender {
    pub svg: String,
    pub width_px: f64,
    pub height_px: f64,
    pub baseline_px: f64,
}

fn pt_to_px(pt: f64) -> f64 {
    pt * 96.0 / 72.0
}

fn compile_tiny(
    fonts: &Arc<FontStore>,
    root: &Path,
    note_path: &str,
    source: &str,
) -> Result<TinyRender, String> {
    let world =
        NoteWorld::new(fonts.clone(), root, note_path, source).map_err(|err| err.to_string())?;
    let warned = typst::compile::<PagedDocument>(&world as &dyn World);
    let document = match warned.output {
        Ok(document) => document,
        Err(errors) => return Err(short_errors(&world, &errors)),
    };
    let page = document
        .pages()
        .first()
        .ok_or_else(|| "Typst produced no page".to_string())?;
    let frame = &page.frame;
    let width_px = pt_to_px(frame.width().to_pt());
    let height_px = pt_to_px(frame.height().to_pt());
    if !width_px.is_finite() || !height_px.is_finite() || width_px < 0.5 || height_px < 0.5 {
        return Err("Typst produced an empty formula".to_string());
    }
    let baseline_pt = formula_baseline(frame).unwrap_or(frame.height().to_pt());
    let mut baseline_px = pt_to_px(baseline_pt);
    if !baseline_px.is_finite() || baseline_px < 0.0 {
        baseline_px = height_px;
    }
    if baseline_px > height_px {
        baseline_px = height_px;
    }
    let svg = typst_svg::svg(page, &typst_svg::SvgOptions::default());
    Ok(TinyRender {
        svg,
        width_px,
        height_px,
        baseline_px,
    })
}

fn short_errors(world: &NoteWorld, errors: &[SourceDiagnostic]) -> String {
    if errors.is_empty() {
        return "Typst could not compile this formula".to_string();
    }
    errors
        .iter()
        .map(|diagnostic| {
            let mapped = map_diagnostic(world, diagnostic);
            if mapped.hints.is_empty() {
                mapped.message
            } else {
                format!("{} ({})", mapped.message, mapped.hints.join("; "))
            }
        })
        .collect::<Vec<_>>()
        .join("\n")
}

/// The deepest frame baseline, in points from the top of `frame`.
fn formula_baseline(frame: &Frame) -> Option<f64> {
    fn walk(frame: &Frame, origin: f64) -> Option<f64> {
        let mut found = frame
            .has_baseline()
            .then(|| origin + frame.baseline().to_pt());
        for (pos, item) in frame.items() {
            let FrameItem::Group(group) = item else {
                continue;
            };
            let y = origin + pos.y.to_pt() + group.transform.ty.to_pt();
            if let Some(child) = walk(&group.frame, y) {
                found = Some(child);
                break;
            }
        }
        found
    }
    walk(frame, 0.0)
}

fn export_from_world(world: &mut NoteWorld, source: &str) -> AppResult<Vec<u8>> {
    if world.compiled_source.as_deref() == Some(source)
        && let Some(document) = world.last_document.as_ref()
    {
        return pdf_bytes(world, document);
    }

    world.update(source);
    let warned = typst::compile::<PagedDocument>(world as &dyn World);
    match warned.output {
        Ok(document) => {
            let bytes = pdf_bytes(world, &document)?;
            world.compiled_source = Some(source.to_string());
            world.last_document = Some(document);
            Ok(bytes)
        }
        Err(errors) => {
            world.compiled_source = None;
            world.last_document = None;
            Err(AppError::Message(format_diagnostics(world, &errors)))
        }
    }
}

fn pdf_bytes(world: &NoteWorld, document: &PagedDocument) -> AppResult<Vec<u8>> {
    match typst_pdf::pdf(document, &typst_pdf::PdfOptions::default()) {
        Ok(bytes) if !bytes.is_empty() && bytes.starts_with(b"%PDF") => Ok(bytes),
        Ok(_) => Err(AppError::Message("Typst did not produce a PDF".to_string())),
        Err(errors) => Err(AppError::Message(format_diagnostics(world, &errors))),
    }
}

fn format_diagnostics(world: &NoteWorld, errors: &[SourceDiagnostic]) -> String {
    if errors.is_empty() {
        return format!("{}: Typst could not compile this note", world.note_path);
    }
    errors
        .iter()
        .map(|diagnostic| {
            let mapped = map_diagnostic(world, diagnostic);
            let file = if mapped.file.is_empty() {
                world.note_path.clone()
            } else {
                mapped.file
            };
            let mut line = format!("{file}:{}-{}: {}", mapped.start, mapped.end, mapped.message);
            if !mapped.hints.is_empty() {
                line.push(' ');
                line.push_str(&mapped.hints.join(" "));
            }
            line
        })
        .collect::<Vec<_>>()
        .join("\n")
}

impl Default for Engine {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::files::SAMPLE_TEXT;

    #[test]
    fn renders_polish_and_math_to_svg() {
        let dir = tempfile::tempdir().unwrap();
        let engine = Engine::new();
        let result = engine
            .render(dir.path(), "note.typ", SAMPLE_TEXT, 1)
            .unwrap();
        assert_eq!(
            result.pages.len(),
            1,
            "diagnostics: {:?}",
            result.diagnostics
        );
        let svg = &result.pages[0];
        assert!(svg.contains("<svg"), "svg should be a page image");
        assert!(
            svg.contains("<path"),
            "glyphs and the figure should be drawn as paths"
        );
        assert!(
            !svg.contains("file://"),
            "the page must not read files by itself"
        );
    }

    #[test]
    fn error_after_polish_letters_marks_the_right_place() {
        let dir = tempfile::tempdir().unwrap();
        let engine = Engine::new();
        let source = "= Łódź ąę\n\n#brak()\n";
        let expected = source.find("brak").unwrap() as u32;
        let result = engine.render(dir.path(), "note.typ", source, 1).unwrap();
        assert!(result.pages.is_empty());
        assert!(
            result.diagnostics.iter().any(|diag| diag.start == expected),
            "expected a diagnostic at byte {expected}, got {:?}",
            result.diagnostics
        );
    }

    // covers: proof 4, the revision comes back untouched
    #[test]
    fn returns_the_revision_untouched_with_one_image_per_page() {
        let dir = tempfile::tempdir().unwrap();
        let engine = Engine::new();
        let result = engine
            .render(
                dir.path(),
                "note.typ",
                "= One\n\n#pagebreak()\n\n= Two\n",
                42,
            )
            .unwrap();
        assert_eq!(result.revision, 42);
        assert_eq!(result.pages.len(), 2);
    }

    // covers: proof 7, an error carries its file, range and own words
    #[test]
    fn a_diagnostic_carries_file_range_and_words() {
        let dir = tempfile::tempdir().unwrap();
        let engine = Engine::new();
        let source = "= Łódź ąę\n\n#brak()\n";
        let expected = source.find("brak").unwrap() as u32;
        let result = engine.render(dir.path(), "note.typ", source, 1).unwrap();
        let diag = result
            .diagnostics
            .iter()
            .find(|diag| diag.start == expected)
            .expect("a diagnostic at the bad word");
        assert_eq!(diag.severity, "error");
        assert_eq!(diag.file, "note.typ");
        assert!(diag.end > diag.start);
        assert!(
            diag.message.contains("brak"),
            "message was: {}",
            diag.message
        );
    }

    #[test]
    fn an_empty_path_compiles_the_buffer_and_includes_from_the_folder() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("included.typ"), "= Included\n").unwrap();
        let engine = Engine::new();
        let result = engine
            .render(dir.path(), "", "#include \"included.typ\"\n", 1)
            .unwrap();
        assert!(
            result
                .diagnostics
                .iter()
                .all(|diag| diag.severity != "error"),
            "diagnostics: {:?}",
            result.diagnostics
        );
        assert_eq!(result.pages.len(), 1);
        assert!(!dir.path().join(".wysityp-buffer.typ").exists());
    }

    // covers: proof 4, included files come from disk inside the folder
    #[test]
    fn reads_an_included_file_from_inside_the_folder() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(
            dir.path().join("included.typ"),
            "= From the included file\n",
        )
        .unwrap();
        let engine = Engine::new();
        let result = engine
            .render(dir.path(), "note.typ", "#include \"included.typ\"\n", 1)
            .unwrap();
        assert_eq!(
            result.pages.len(),
            1,
            "diagnostics: {:?}",
            result.diagnostics
        );
        assert!(
            result
                .diagnostics
                .iter()
                .all(|diag| diag.severity != "error"),
            "diagnostics: {:?}",
            result.diagnostics
        );
    }

    // covers: the root rule, Typst reads cannot climb out of the folder
    #[test]
    fn an_included_file_outside_the_folder_is_refused() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path().join("root");
        std::fs::create_dir_all(&root).unwrap();
        std::fs::write(dir.path().join("outside.typ"), "= Outside\n").unwrap();
        let engine = Engine::new();
        let result = engine
            .render(&root, "note.typ", "#include \"../outside.typ\"\n", 1)
            .unwrap();
        assert!(result.pages.is_empty(), "pages: {:?}", result.pages);
        assert!(
            result
                .diagnostics
                .iter()
                .any(|diag| diag.severity == "error"),
            "diagnostics: {:?}",
            result.diagnostics
        );
    }

    // covers: proof 4, a world that stays alive still uses the new buffer
    #[test]
    fn a_second_render_uses_the_new_buffer() {
        let dir = tempfile::tempdir().unwrap();
        let engine = Engine::new();
        let first = engine.render(dir.path(), "note.typ", "= One\n", 1).unwrap();
        assert_eq!(first.pages.len(), 1);
        let second = engine
            .render(dir.path(), "note.typ", "= One\n\n#brak()\n", 2)
            .unwrap();
        assert_eq!(second.revision, 2);
        assert!(second.pages.is_empty());
        assert!(
            second
                .diagnostics
                .iter()
                .any(|diag| diag.severity == "error")
        );
    }

    #[test]
    fn exports_pdf_bytes_for_a_valid_note() {
        let dir = tempfile::tempdir().unwrap();
        let engine = Engine::new();
        let bytes = engine
            .export_pdf(dir.path(), "notes/lecture.typ", SAMPLE_TEXT)
            .unwrap();
        assert!(!bytes.is_empty());
        assert!(bytes.starts_with(b"%PDF"));
        assert!(
            std::fs::read_dir(dir.path()).unwrap().next().is_none(),
            "exporting bytes must not touch the folder"
        );
    }

    // covers: feature 12, export reuses the kept document for the same source
    #[test]
    fn export_reuses_the_rendered_document_when_the_source_is_unchanged() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("inc.typ"), "= Included\n").unwrap();
        let engine = Engine::new();
        let source = "#include \"inc.typ\"\n";
        let rendered = engine.render(dir.path(), "note.typ", source, 1).unwrap();
        assert_eq!(rendered.pages.len(), 1);
        // Break the included file on disk. A recompile would now fail,
        // so a good export proves the kept document was reused.
        std::fs::write(dir.path().join("inc.typ"), "#brak()\n").unwrap();
        let bytes = engine.export_pdf(dir.path(), "note.typ", source).unwrap();
        assert!(bytes.starts_with(b"%PDF"));
    }

    // covers: feature 12, a changed source is compiled again on export
    #[test]
    fn export_recompiles_when_the_source_changed() {
        let dir = tempfile::tempdir().unwrap();
        let engine = Engine::new();
        engine.render(dir.path(), "note.typ", "= One\n", 1).unwrap();
        let message = engine
            .export_pdf(dir.path(), "note.typ", "= One\n\n#brak()\n")
            .unwrap_err()
            .to_string();
        assert!(message.contains("brak"), "{message}");
        let bytes = engine
            .export_pdf(dir.path(), "note.typ", "= Two\n")
            .unwrap();
        assert!(bytes.starts_with(b"%PDF"));
    }

    // covers: feature 12, a failed render clears the kept document
    #[test]
    fn export_after_a_failed_render_recompiles_instead_of_reusing() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("inc.typ"), "= Included\n").unwrap();
        let engine = Engine::new();
        let source = "#include \"inc.typ\"\n";
        engine.render(dir.path(), "note.typ", source, 1).unwrap();
        let failed = engine
            .render(dir.path(), "note.typ", "#brak()\n", 2)
            .unwrap();
        assert!(failed.pages.is_empty());
        // With the cache cleared, exporting the good source compiles
        // again and meets the now broken included file.
        std::fs::write(dir.path().join("inc.typ"), "#brak()\n").unwrap();
        assert!(engine.export_pdf(dir.path(), "note.typ", source).is_err());
    }

    // covers: feature 12, export never reuses a document from another note
    #[test]
    fn export_for_another_note_does_not_reuse_the_first_document() {
        let dir = tempfile::tempdir().unwrap();
        let engine = Engine::new();
        engine.render(dir.path(), "a.typ", "= One\n", 1).unwrap();
        assert!(engine.export_pdf(dir.path(), "b.typ", "#brak()\n").is_err());
        let bytes = engine.export_pdf(dir.path(), "b.typ", "= Two\n").unwrap();
        assert!(bytes.starts_with(b"%PDF"));
    }

    #[test]
    fn a_broken_note_fails_with_the_place_in_the_source() {
        let dir = tempfile::tempdir().unwrap();
        let engine = Engine::new();
        let source = "= Łódź ąę\n\n#brak()\n";
        let expected = source.find("brak").unwrap().to_string();
        let message = engine
            .export_pdf(dir.path(), "notes/lecture.typ", source)
            .unwrap_err()
            .to_string();
        assert!(message.contains(&expected), "{message}");
        assert!(message.contains("brak"), "{message}");
        assert!(message.contains("notes/lecture.typ"), "{message}");
        assert!(
            std::fs::read_dir(dir.path()).unwrap().next().is_none(),
            "a failed export must not touch the folder"
        );
    }
}
