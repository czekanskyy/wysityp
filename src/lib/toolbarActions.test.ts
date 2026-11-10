import { describe, expect, it } from "vitest";
import { applyRange, formatEdit, tableSkeleton } from "./toolbarActions";

function edited(
  source: string,
  from: number,
  to: number,
  action: Parameters<typeof formatEdit>[3],
  options?: { rows?: number; cols?: number },
): { text: string; selected: string } {
  const edit = formatEdit(source, from, to, action, options);
  const text = applyRange(source, edit);
  return { text, selected: text.slice(edit.anchor, edit.head) };
}

describe("toolbar actions", () => {
  it("wraps a Polish selection and leaves the word selected", () => {
    const word = "całką";
    const source = `Przed ${word} po`;
    const from = source.indexOf(word);
    const to = from + word.length;
    expect(edited(source, from, to, "bold")).toEqual({
      text: "Przed *całką* po",
      selected: "całką",
    });
    expect(edited(source, from, to, "italic").text).toBe("Przed _całką_ po");
    expect(edited(source, from, to, "underline").text).toBe(
      "Przed #underline[całką] po",
    );
    expect(edited(source, from, to, "strike").text).toBe(
      "Przed #strike[całką] po",
    );
    expect(edited(source, from, to, "code").text).toBe("Przed `całką` po");
    expect(edited(source, from, to, "quote").text).toBe(
      "Przed #quote[całką] po",
    );
  });

  it("puts the caret inside an empty wrap", () => {
    const source = "Łódź";
    const edit = formatEdit(source, 4, 4, "bold");
    expect(applyRange(source, edit)).toBe("Łódź**");
    expect(edit.anchor).toBe(5);
    expect(edit.head).toBe(5);
  });

  it("replaces a heading marker and keeps the caret on the same letter", () => {
    const source = "Łódź jest całką";
    const caret = source.indexOf("jest");
    const edit = formatEdit(source, caret, caret, "heading-1");
    const text = applyRange(source, edit);
    expect(text).toBe("= Łódź jest całką");
    expect(text[edit.anchor]).toBe("j");
    expect(edited("== Całka w Łodzi", 0, 0, "heading-3").text).toBe(
      "=== Całka w Łodzi",
    );
    expect(edited("= Całka\n", 0, 0, "heading-0").text).toBe("Całka\n");
    expect(edited("==== Zbędny\ntekst", 0, 0, "heading-2").text).toBe(
      "== Zbędny\ntekst",
    );
  });

  it("toggles list markers on Polish lines, including a selection", () => {
    const source = "Łódź\ncałka";
    expect(edited(source, 0, source.length, "bullet").text).toBe(
      "- Łódź\n- całka",
    );
    expect(edited("- Łódź\n- całka", 0, 14, "bullet").text).toBe("Łódź\ncałka");
    expect(edited("Zbiór", 0, 5, "numbered").text).toBe("+ Zbiór");
  });

  it("inserts math, a link, a code block, and a table around Polish text", () => {
    expect(edited("całka", 0, 5, "math-inline").text).toBe("$całka$");
    const block = formatEdit("całka", 0, 5, "math-block");
    expect(applyRange("całka", block)).toBe("$\n  całka\n$");
    const link = edited("całka", 0, 5, "link");
    expect(link.text).toBe('#link("https://")[całka]');
    expect(link.selected).toBe("https://");
    const code = formatEdit("łódź", 0, 4, "code-block");
    expect(applyRange("łódź", code)).toBe("```\nłódź\n```");
    expect(code.anchor).toBe(4 + "łódź".length);
    const table = formatEdit("x", 1, 1, "table", { rows: 2, cols: 3 });
    expect(table.insert).toBe(
      [
        "#table(",
        "  columns: (1fr, 1fr, 1fr),",
        "  [], [], [],",
        "  [], [], [],",
        ")",
      ].join("\n"),
    );
  });

  it("clamps the table size", () => {
    expect(tableSkeleton(0, 99)).toContain(
      "columns: (1fr, 1fr, 1fr, 1fr, 1fr, 1fr, 1fr, 1fr, 1fr, 1fr, 1fr, 1fr)",
    );
    expect(
      tableSkeleton(0, 99)
        .split("\n")
        .filter((line) => line.includes("[]")),
    ).toHaveLength(1);
  });
});
