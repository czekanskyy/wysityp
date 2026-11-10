// The app does not depend on Node types. Vitest runs this file in Node.
// @ts-expect-error node:fs is available at test time and is not a project dependency.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { commandMatches, foldPolish } from "./fold";
import { icons } from "./icons";

const tokens = readFileSync(
  new URL("../../styles/tokens.css", import.meta.url),
  "utf8",
);
const base = readFileSync(
  new URL("../../styles/base.css", import.meta.url),
  "utf8",
);
const exportTokens = readFileSync(
  new URL("../../../design/claude-design/papier/tokens.css", import.meta.url),
  "utf8",
);

function declarations(css: string): string[] {
  return [...css.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map(
    (match) => `${match[1]}: ${match[2].trim()}`,
  );
}

const iconIds = [
  "search",
  "code",
  "light",
  "bulletList",
  "export",
  "page",
  "split",
  "rename",
  "folder",
  "inlineMath",
  "redo",
  "settings",
  "chevronDown",
  "delete",
  "dark",
  "save",
  "table",
  "undo",
  "plus",
  "close",
  "italic",
  "bold",
  "more",
  "heading",
  "note",
  "panel",
  "quote",
  "image",
  "chevronRight",
  "link",
  "openFolder",
  "blockMath",
  "strike",
  "numberedList",
  "warning",
  "underline",
  "superscript",
  "subscript",
  "highlight",
  "textColor",
  "termList",
  "outdent",
  "indent",
  "align",
  "symbol",
  "shape",
  "footnote",
  "mention",
  "blocks",
  "codeBlock",
];

describe("papier tokens", () => {
  it("keeps the export colour names and values, and leaves font families out", () => {
    const exported = declarations(exportTokens).filter(
      (line) => !line.startsWith("--font-"),
    );
    for (const line of exported) {
      expect(tokens).toContain(line);
    }
    expect(tokens).not.toContain("--font-ui");
    expect(tokens).not.toContain("--font-prose");
    expect(tokens).not.toContain("--font-math");
    expect(tokens).not.toContain("--font-mono");
    expect(tokens).not.toContain("font-family");
    expect(tokens).toContain('[data-theme="dark"]');
    expect(tokens).toContain("--page-bg: var(--page-white-bg)");
  });

  it("records the three motion values as text", () => {
    expect(base).toContain("--motion-fast: 120ms");
    expect(base).toContain("--motion-mid: 180ms");
    expect(base).toContain("--motion-pop: 180ms");
    expect(base).toContain("--motion-slow: 240ms");
    expect(base).toContain("--ease-standard:");
    expect(base).toContain("--motion-fast: 0ms");
    expect(base).toContain("--motion-mid: 0ms");
    expect(base).toContain("--motion-pop: 0ms");
    expect(base).toContain("--motion-slow: 0ms");
    expect(base).toContain("prefers-reduced-motion");
    expect(base).toContain("prefers-color-scheme: dark");
    expect(base).toContain("prefers-contrast: more");
    expect(base).toContain("--color-bg: #1a1b1e");
  });
});

describe("icons", () => {
  it("draws the shared icons, including the formatting toolbar", () => {
    expect(Object.keys(icons).sort()).toEqual([...iconIds].sort());
  });
});

describe("command matching", () => {
  it("folds Polish marks both ways and ignores case", () => {
    expect(foldPolish("Źródło")).toBe("zrodlo");
    expect(commandMatches("Całka", "calka")).toBe(true);
    expect(commandMatches("Całka", "CAŁKA")).toBe(true);
    expect(commandMatches("Zbiór", "zbior")).toBe(true);
    expect(commandMatches("Notatka", "  ")).toBe(true);
    expect(commandMatches("Notatka", "xyz")).toBe(false);
  });
});
