//! Typeset one batch of formulas with the embedded Typst engine.
//!
//! Each formula is its own tiny page: auto size, no margin, transparent
//! fill. The note's top level definitions are prepended when they compile.
//! A broken formula is an error string, never a panic.

use std::path::Path;

use serde::{Deserialize, Serialize};
use specta::Type;
use tauri::State;

use crate::AppState;
use crate::error::AppError;
use crate::typst_engine::{Engine, TinyRender};

const MAX_FORMULAS: usize = 64;
const MAX_SOURCE: usize = 20_000;

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct MathFormula {
    pub id: String,
    pub source: String,
    pub block: bool,
    pub color: String,
    pub size_pt: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct MathSvg {
    pub id: String,
    pub svg: String,
    pub width_px: f64,
    pub height_px: f64,
    pub baseline_px: f64,
    pub error: String,
}

/// Drop top level `#set page` so a note page size cannot blow up a formula.
pub fn filter_preamble(preamble: &str) -> String {
    let mut kept = Vec::new();
    for statement in preamble_statements(preamble) {
        if is_set_page(&statement) {
            continue;
        }
        let trimmed = statement.trim();
        if !trimmed.is_empty() {
            kept.push(trimmed.to_string());
        }
    }
    kept.join("\n")
}

fn is_set_page(statement: &str) -> bool {
    let rest = statement.trim_start();
    let Some(rest) = rest.strip_prefix("#set") else {
        return false;
    };
    let rest = rest.trim_start();
    let name = rest
        .split(|ch: char| !ch.is_ascii_alphanumeric() && ch != '-' && ch != '_')
        .next()
        .unwrap_or("");
    name == "page"
}

fn preamble_statements(preamble: &str) -> Vec<String> {
    let mut out = Vec::new();
    let chars: Vec<char> = preamble.chars().collect();
    let mut i = 0;
    while i < chars.len() {
        if chars[i] == '\n' {
            i += 1;
            continue;
        }
        if chars[i] == '#' && (i == 0 || chars[i - 1] == '\n') {
            let end = statement_end(&chars, i);
            let text: String = chars[i..end].iter().collect();
            out.push(text);
            i = end;
            continue;
        }
        while i < chars.len() && chars[i] != '\n' {
            i += 1;
        }
    }
    out
}

fn statement_end(chars: &[char], start: usize) -> usize {
    let mut i = start;
    let mut depth = 0i32;
    while i < chars.len() {
        let ch = chars[i];
        if ch == '/' && chars.get(i + 1) == Some(&'/') && depth == 0 {
            while i < chars.len() && chars[i] != '\n' {
                i += 1;
            }
            continue;
        }
        if ch == '/' && chars.get(i + 1) == Some(&'*') {
            i += 2;
            while i + 1 < chars.len() && !(chars[i] == '*' && chars[i + 1] == '/') {
                i += 1;
            }
            i = (i + 2).min(chars.len());
            continue;
        }
        if ch == '"' || ch == '\'' {
            i = skip_string(chars, i);
            continue;
        }
        if ch == '`' {
            let mut n = 0;
            while i + n < chars.len() && chars[i + n] == '`' {
                n += 1;
            }
            i += n;
            let mut matched = 0;
            while i < chars.len() {
                if chars[i] == '`' {
                    matched += 1;
                    if matched == n {
                        i += 1;
                        break;
                    }
                } else {
                    matched = 0;
                }
                i += 1;
            }
            continue;
        }
        if ch == '\\' {
            i = (i + 2).min(chars.len());
            continue;
        }
        if matches!(ch, '(' | '[' | '{') {
            depth += 1;
        } else if matches!(ch, ')' | ']' | '}') {
            depth = depth.saturating_sub(1);
        } else if ch == '\n' && depth == 0 {
            return i;
        }
        i += 1;
    }
    chars.len()
}

fn skip_string(chars: &[char], start: usize) -> usize {
    let quote = chars[start];
    let mut i = start + 1;
    while i < chars.len() {
        if chars[i] == '\\' {
            i = (i + 2).min(chars.len());
            continue;
        }
        if chars[i] == quote {
            return i + 1;
        }
        if chars[i] == '\n' {
            return i;
        }
        i += 1;
    }
    chars.len()
}

fn hex_color(color: &str) -> Option<&str> {
    let bytes = color.as_bytes();
    if bytes.len() == 7
        && bytes[0] == b'#'
        && bytes[1..].iter().all(|byte| byte.is_ascii_hexdigit())
    {
        Some(color)
    } else {
        None
    }
}

fn clamped_size(size_pt: f64) -> f64 {
    if !size_pt.is_finite() {
        return 12.75;
    }
    size_pt.clamp(6.0, 96.0)
}

pub fn formula_document(
    preamble: &str,
    source: &str,
    block: bool,
    color: &str,
    size_pt: f64,
) -> String {
    let body = if block {
        format!("$ {} $", source.trim())
    } else {
        format!("${source}$")
    };
    let head = filter_preamble(preamble);
    let definitions = if head.is_empty() {
        String::new()
    } else {
        format!("{head}\n")
    };
    format!(
        "#set page(width: auto, height: auto, margin: 0pt, fill: none)\n\
         {definitions}\
         #set text(size: {size_pt}pt, fill: rgb(\"{color}\"))\n\
         #set par(leading: 0pt, spacing: 0pt)\n\
         #set block(spacing: 0pt)\n\
         {body}\n"
    )
}

fn usable(render: &TinyRender) -> bool {
    render.width_px.is_finite()
        && render.height_px.is_finite()
        && render.width_px >= 0.5
        && render.height_px >= 0.5
        && render.svg.contains("<svg")
}

fn paint_of(id: &str, render: TinyRender) -> MathSvg {
    MathSvg {
        id: id.to_string(),
        svg: sanitize_svg(&render.svg),
        width_px: render.width_px,
        height_px: render.height_px,
        baseline_px: render.baseline_px,
        error: String::new(),
    }
}

fn error_of(id: &str, message: impl Into<String>) -> MathSvg {
    MathSvg {
        id: id.to_string(),
        svg: String::new(),
        width_px: 0.0,
        height_px: 0.0,
        baseline_px: 0.0,
        error: message.into(),
    }
}

/// Remove script tags and script URLs. The page also draws the SVG as an image.
pub fn sanitize_svg(svg: &str) -> String {
    let lower = svg.to_ascii_lowercase();
    if !lower.contains("<script") && !lower.contains("javascript:") {
        return svg.to_string();
    }
    let without_scripts = strip_folded(svg, "<script", "</script>");
    without_scripts.replace("javascript:", "")
}

fn strip_folded(input: &str, start: &str, end: &str) -> String {
    let lower = input.to_ascii_lowercase();
    let mut out = String::new();
    let mut i = 0;
    while let Some(found) = lower[i..].find(start) {
        let at = i + found;
        out.push_str(&input[i..at]);
        let after = at + start.len();
        if let Some(close) = lower[after..].find(end) {
            i = after + close + end.len();
        } else {
            i = input.len();
        }
    }
    out.push_str(&input[i..]);
    out
}

fn compile_one(
    engine: &Engine,
    root: &Path,
    note_path: &str,
    preamble: &str,
    formula: &MathFormula,
) -> MathSvg {
    if formula.source.trim().is_empty() {
        return error_of(&formula.id, "empty formula");
    }
    if formula.source.len() > MAX_SOURCE {
        return error_of(&formula.id, "formula is too long");
    }
    let Some(color) = hex_color(formula.color.trim()) else {
        return error_of(&formula.id, "formula colour is not a page colour");
    };
    let size = clamped_size(formula.size_pt);
    let with_defs = formula_document(preamble, &formula.source, formula.block, color, size);
    match engine.render_math_source(root, note_path, &with_defs) {
        Ok(render) if usable(&render) => paint_of(&formula.id, render),
        first => {
            if preamble.trim().is_empty() {
                return error_of(
                    &formula.id,
                    first.err().unwrap_or_else(|| "empty formula".to_string()),
                );
            }
            let bare = formula_document("", &formula.source, formula.block, color, size);
            match engine.render_math_source(root, note_path, &bare) {
                Ok(render) if usable(&render) => paint_of(&formula.id, render),
                Ok(_) => error_of(&formula.id, "Typst produced an empty formula"),
                Err(message) => error_of(&formula.id, message),
            }
        }
    }
}

pub fn render_math_batch(
    engine: &Engine,
    root: &Path,
    note_path: &str,
    preamble: &str,
    formulas: &[MathFormula],
) -> Vec<MathSvg> {
    let mut paints = Vec::with_capacity(formulas.len());
    for (index, formula) in formulas.iter().enumerate() {
        if index >= MAX_FORMULAS {
            paints.push(error_of(&formula.id, "too many formulas in one batch"));
            continue;
        }
        paints.push(compile_one(engine, root, note_path, preamble, formula));
    }
    comemo::evict(30);
    paints
}

#[tauri::command]
#[specta::specta]
pub async fn render_math(
    state: State<'_, AppState>,
    path: String,
    preamble: String,
    formulas: Vec<MathFormula>,
) -> Result<Vec<MathSvg>, String> {
    let (root, note_path) = if path.trim().is_empty() {
        (std::env::temp_dir(), "formula.typ".to_string())
    } else {
        let gate = state
            .access
            .lock()
            .map_err(|_| "access lock was poisoned".to_string())?;
        let resolved = gate.resolve(&path).map_err(String::from)?;
        (resolved.root.clone(), resolved.relative.clone())
    };
    let engine = state.engine.clone();
    tauri::async_runtime::spawn_blocking(move || {
        render_math_batch(&engine, &root, &note_path, &preamble, &formulas)
    })
    .await
    .map_err(|err| AppError::Message(err.to_string()).to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn formula(id: &str, source: &str, block: bool) -> MathFormula {
        MathFormula {
            id: id.to_string(),
            source: source.to_string(),
            block,
            color: "#1f1d1a".to_string(),
            size_pt: 12.75,
        }
    }

    #[test]
    fn a_valid_formula_is_an_svg_with_a_baseline() {
        let dir = tempfile::tempdir().unwrap();
        let engine = Engine::new();
        let paints = render_math_batch(
            &engine,
            dir.path(),
            "note.typ",
            "",
            &[formula("a", "x^2 + 1/2", false)],
        );
        assert_eq!(paints.len(), 1);
        assert!(paints[0].error.is_empty(), "error: {}", paints[0].error);
        assert!(paints[0].svg.contains("<svg"));
        assert!(paints[0].svg.contains("1f1d1a") || paints[0].svg.contains("1F1D1A"));
        assert!(paints[0].width_px > 1.0);
        assert!(paints[0].height_px > 1.0);
        assert!(paints[0].baseline_px > 0.0);
        assert!(paints[0].baseline_px <= paints[0].height_px);
        assert!(!paints[0].svg.to_ascii_lowercase().contains("<script"));
    }

    #[test]
    fn a_broken_formula_is_an_error_and_not_a_panic() {
        let dir = tempfile::tempdir().unwrap();
        let engine = Engine::new();
        let paints = render_math_batch(
            &engine,
            dir.path(),
            "note.typ",
            "",
            &[formula("bad", "nosuch(1)", false)],
        );
        assert!(
            paints[0].svg.is_empty(),
            "svg started {} error {}",
            paints[0].svg.chars().take(180).collect::<String>(),
            paints[0].error
        );
        assert!(
            !paints[0].error.is_empty(),
            "broken math should explain itself"
        );
    }

    #[test]
    fn a_formula_can_use_a_note_let() {
        let dir = tempfile::tempdir().unwrap();
        let engine = Engine::new();
        let paints = render_math_batch(
            &engine,
            dir.path(),
            "note.typ",
            "#let twice(x) = x + x",
            &[formula("let", "twice(4)", false)],
        );
        assert!(
            paints[0].error.is_empty(),
            "let should compile, got {}",
            paints[0].error
        );
        assert!(paints[0].svg.contains("<svg"));
    }

    #[test]
    fn a_broken_preamble_falls_back_to_the_formula() {
        let dir = tempfile::tempdir().unwrap();
        let engine = Engine::new();
        let paints = render_math_batch(
            &engine,
            dir.path(),
            "note.typ",
            "#let =",
            &[formula("x", "x", false)],
        );
        assert!(
            paints[0].error.is_empty(),
            "fallback should render x, got {}",
            paints[0].error
        );
    }

    #[test]
    fn a_note_page_set_does_not_stretch_the_formula() {
        let dir = tempfile::tempdir().unwrap();
        let engine = Engine::new();
        let paints = render_math_batch(
            &engine,
            dir.path(),
            "note.typ",
            "#set page(paper: \"a4\", margin: 2cm)",
            &[formula("x", "x", false)],
        );
        assert!(paints[0].error.is_empty(), "{}", paints[0].error);
        assert!(
            paints[0].width_px < 200.0,
            "width {} looks like a full page",
            paints[0].width_px
        );
    }

    #[test]
    fn block_math_with_alignment_compiles() {
        let dir = tempfile::tempdir().unwrap();
        let engine = Engine::new();
        let paints = render_math_batch(
            &engine,
            dir.path(),
            "note.typ",
            "",
            &[formula("align", "a &= b + c \\ d &= e", true)],
        );
        assert!(paints[0].error.is_empty(), "{}", paints[0].error);
        assert!(paints[0].height_px > paints[0].width_px * 0.2);
    }

    #[test]
    fn sanitize_svg_drops_a_script() {
        let cleaned = sanitize_svg("<svg><script>alert(1)</script><path d=\"M0 0\"/></svg>");
        assert!(!cleaned.to_ascii_lowercase().contains("<script"));
        assert!(cleaned.contains("<path"));
    }
}
