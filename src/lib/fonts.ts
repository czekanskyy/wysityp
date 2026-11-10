/** Shipped editor fonts. The note file never receives these names. */

export const DEFAULT_SOURCE_FONT = "JetBrains Mono";
export const DEFAULT_RENDER_FONT = "Inter";

export const SOURCE_FONT_CHOICES = ["JetBrains Mono", "Consolas"] as const;
export const RENDER_FONT_CHOICES = ["Inter", "Segoe UI"] as const;

export type EditorFonts = {
  source: string;
  render: string;
};

export const DEFAULT_EDITOR_FONTS: EditorFonts = {
  source: DEFAULT_SOURCE_FONT,
  render: DEFAULT_RENDER_FONT,
};

/**
 * One CSS family, quoted. Rust refuses quotes, commas, and control
 * characters, so the saved name is a single family.
 */
export function quoteFontFamily(name: string): string {
  return `"${name.replaceAll("\\", "\\\\").replaceAll('"', "")}"`;
}

/**
 * Source text falls through JetBrains Mono, then Consolas, then a
 * generic fixed width font. Rendered prose falls through Inter, then
 * Segoe UI, then a generic sans font.
 */
export function fontFamilyStack(
  kind: "source" | "render",
  name: string,
): string {
  const chosen = quoteFontFamily(name);
  if (kind === "source") {
    return `${chosen}, "JetBrains Mono", Consolas, monospace`;
  }
  return `${chosen}, Inter, "Segoe UI", sans-serif`;
}
