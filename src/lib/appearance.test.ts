import { describe, expect, it } from "vitest";

import { applyDocumentTheme, asPageColor, asTheme } from "./appearance";

type Root = { dataset: Record<string, string | undefined> };

function withDocument(run: (root: Root) => void) {
  const root: Root = { dataset: {} };
  const previous = globalThis.document;
  globalThis.document = { documentElement: root } as unknown as Document;
  try {
    run(root);
  } finally {
    globalThis.document = previous;
  }
}

describe("asTheme", () => {
  // covers: AC-8
  it("reads light, dark, and system as themselves", () => {
    expect(asTheme("light")).toBe("light");
    expect(asTheme("dark")).toBe("dark");
    expect(asTheme("system")).toBe("system");
  });

  // covers: AC-8
  it("reads an empty word, a wrong case, or an unknown word as system", () => {
    expect(asTheme("")).toBe("system");
    expect(asTheme("Dark")).toBe("system");
    expect(asTheme(" light")).toBe("system");
    expect(asTheme("blue")).toBe("system");
  });
});

describe("asPageColor", () => {
  // covers: AC-9
  it("reads white, beige, graphite, and oled as themselves", () => {
    expect(asPageColor("white")).toBe("white");
    expect(asPageColor("beige")).toBe("beige");
    expect(asPageColor("graphite")).toBe("graphite");
    expect(asPageColor("oled")).toBe("oled");
  });

  // covers: AC-9
  it("reads an empty word, a wrong case, or an unknown word as white", () => {
    expect(asPageColor("")).toBe("white");
    expect(asPageColor("OLED")).toBe("white");
    expect(asPageColor(" beige")).toBe("white");
    expect(asPageColor("navy")).toBe("white");
  });
});

describe("applyDocumentTheme", () => {
  // covers: AC-8
  it("sets data-theme when the choice is light or dark", () => {
    withDocument((root) => {
      applyDocumentTheme("light");
      expect(root.dataset.theme).toBe("light");
      applyDocumentTheme("dark");
      expect(root.dataset.theme).toBe("dark");
    });
  });

  // covers: AC-8
  it("removes data-theme when the choice follows Windows or is not a forced theme", () => {
    withDocument((root) => {
      applyDocumentTheme("dark");
      applyDocumentTheme("system");
      expect(root.dataset.theme).toBeUndefined();

      applyDocumentTheme("light");
      applyDocumentTheme("");
      expect(root.dataset.theme).toBeUndefined();

      applyDocumentTheme("dark");
      applyDocumentTheme("blue");
      expect(root.dataset.theme).toBeUndefined();
    });
  });
});
