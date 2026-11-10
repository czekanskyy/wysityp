import { describe, expect, it } from "vitest";
import {
  bareLinks,
  caretMoveReplacesRanges,
  classifySpans,
  editorDiagnostics,
  flattenRanges,
  isOpenableUrl,
  linkAt,
  mathArrowTarget,
  planDecorations,
  rangesOverlapEachOther,
  spanShownAsSource,
  structureKey,
  type PlanDiagnostic,
  type Span,
} from "./spans";

function kinds(source: string): Span["kind"][] {
  return classifySpans(source, 0, source.length).spans.map((span) => span.kind);
}

function spanOf(source: string, kind: Span["kind"]): Span {
  const span = classifySpans(source, 0, source.length).spans.find(
    (item) => item.kind === kind,
  );
  if (!span) throw new Error(`missing ${kind}`);
  return span;
}

function rendered(source: string, selectionFrom = -1) {
  const spans = classifySpans(source, 0, source.length).spans;
  const selection =
    selectionFrom < 0 ? [] : [{ from: selectionFrom, to: selectionFrom }];
  return planDecorations(source, spans, selection, []);
}

describe("classifySpans", () => {
  it("renders a Polish heading, emphasis, strong text, and a body", () => {
    const source = "= Zażółć gęślą jaźń\n\nTo jest _łódź_ i *źdźbło*.\n";
    const spans = classifySpans(source, 0, source.length).spans;
    const heading = spans.find((span) => span.kind === "heading");
    const emphasis = spans.find((span) => span.kind === "emphasis");
    const strong = spans.find((span) => span.kind === "strong");
    const body = spans.find((span) => span.kind === "body");
    expect(heading?.level).toBe(1);
    expect(heading?.marker).toBe("= ");
    expect(source.slice(heading!.from, heading!.to)).toContain("Zażółć");
    expect(source.slice(emphasis!.from, emphasis!.to)).toBe("_łódź_");
    expect(source.slice(strong!.from, strong!.to)).toBe("*źdźbło*");
    expect(body?.closed).toBe(true);
    expect(emphasis!.from).toBeGreaterThan(body!.from);
    expect(emphasis!.to).toBeLessThanOrEqual(body!.to);
  });

  it("keeps a heading without a space as source", () => {
    expect(kinds("=Tytuł\n")).not.toContain("heading");
  });

  it("sizes deeper headings by the equals", () => {
    expect(spanOf("== Część\n", "heading").level).toBe(2);
    expect(spanOf("=== Część\n", "heading").level).toBe(3);
  });

  it("classifies bullets, numbered items, and terms", () => {
    const source =
      "- alfa\n  - zagnieżdżone\n+ jeden\n+ dwa\n- przerwa\n+ trzy\n\n+ od nowa\n/ termin: opis\n/ bez dwukropka\n";
    const spans = classifySpans(source, 0, source.length).spans;
    const bullets = spans.filter((span) => span.kind === "bullet");
    const enums = spans.filter((span) => span.kind === "enum");
    const terms = spans.filter((span) => span.kind === "term");
    expect(bullets.map((span) => span.level)).toEqual([0, 1, 0]);
    expect(enums).toHaveLength(4);
    expect(terms).toHaveLength(1);
    expect(source.slice(terms[0]!.from, terms[0]!.to)).toContain("termin:");
    const plan = planDecorations(source, spans, [], []);
    const numbers = plan.replaces
      .filter((range) => range.className === "cm-enum-num")
      .map((range) => range.text);
    expect(numbers).toEqual(["1.", "2.", "3.", "1."]);
  });

  it("renders a quote and its attribution, and leaves other arguments as source", () => {
    const source =
      "#quote(attribution: [Źródło])[Zażółć]\n#quote(block: true)[Nie]\n";
    const spans = classifySpans(source, 0, source.length).spans;
    const quotes = spans.filter((span) => span.kind === "quote");
    expect(quotes).toHaveLength(1);
    expect(quotes[0]?.closed).toBe(true);
    const plan = planDecorations(source, spans, [], []);
    expect(plan.points.map((point) => point.text)).toContain("Źródło");
    expect(source.slice(quotes[0]!.from, quotes[0]!.to)).toContain("Zażółć");
  });

  it("does not let an unclosed quote swallow the next paragraph", () => {
    const source = "#quote[bez końca\n\nDalszy akapit łódź\n";
    const spans = classifySpans(source, 0, source.length).spans;
    const quote = spans.find((span) => span.kind === "quote");
    const body = spans.find((span) => span.kind === "body");
    expect(quote?.closed).toBe(false);
    expect(quote && source.slice(quote.from, quote.to)).not.toContain("Dalszy");
    expect(body && source.slice(body.from, body.to)).toContain("łódź");
    expect(spanShownAsSource(quote!, source, [], [])).toBe(true);
  });

  it("leaves hash calls and raw text as source", () => {
    const source =
      "#set page(width: 10cm)\n\nZwykły tekst.\n\n`= nie nagłówek`\n";
    const spans = classifySpans(source, 0, source.length).spans;
    expect(spans.some((span) => span.kind === "heading")).toBe(false);
    expect(
      spans.some(
        (span) =>
          span.kind === "body" &&
          source.slice(span.from, span.to).includes("#set"),
      ),
    ).toBe(false);
    expect(
      spans.some(
        (span) =>
          span.kind === "body" &&
          source.slice(span.from, span.to).includes("nie nagłówek"),
      ),
    ).toBe(false);
    expect(spans.some((span) => span.kind === "body")).toBe(true);
  });

  it("classifies inline and block math and leaves an unmatched dollar", () => {
    const source = "Wzór $a+b$ w zdaniu.\n\n$ x $\n\n$$\n\n$bez końca\n";
    const spans = classifySpans(source, 0, source.length).spans.filter(
      (span) => span.kind === "math",
    );
    expect(spans.map((span) => span.block)).toEqual([false, true, false]);
    expect(source.slice(spans[0]!.from, spans[0]!.to)).toBe("$a+b$");
    const plan = planDecorations(
      source,
      classifySpans(source, 0, source.length).spans,
      [],
      [],
    );
    const chips = plan.replaces.filter(
      (range) => range.text.length > 0 && range.className.startsWith("cm-math"),
    );
    expect(chips.map((chip) => chip.text)).toEqual(["a+b", " x "]);
  });

  it("opens math as source when the caret is inside and when an arrow would skip it", () => {
    const source = "Przed $x$ po\n";
    const spans = classifySpans(source, 0, source.length).spans;
    const math = spanOf(source, "math");
    const outside = planDecorations(source, spans, [], []);
    expect(outside.replaces.some((range) => range.text === "x")).toBe(true);
    const inside = planDecorations(
      source,
      spans,
      [{ from: math.from + 1, to: math.from + 1 }],
      [],
    );
    expect(
      inside.replaces.some((range) => range.className.startsWith("cm-math")),
    ).toBe(false);
    expect(mathArrowTarget(source, spans, [], math.from, math.to)).toBe(
      math.from + 1,
    );
    expect(mathArrowTarget(source, spans, [], math.to, math.from)).toBe(
      math.to - 1,
    );
  });
});

describe("planDecorations", () => {
  it("hides a heading marker and styles the words", () => {
    const source = "= Tytuł\n";
    const plan = rendered(source);
    const flat = flattenRanges(plan);
    expect(
      rangesOverlapEachOther(flat.filter((range) => range.from !== range.to)),
    ).toBe(false);
    expect(
      flat.some((range) => range.kind === "replace" && range.text === ""),
    ).toBe(true);
    expect(
      flat.some(
        (range) => range.kind === "mark" && range.className === "cm-h1",
      ),
    ).toBe(true);
  });

  it("keeps an errored heading as source and draws the compiler message once", () => {
    const source = "= Tytuł\n";
    const spans = classifySpans(source, 0, source.length).spans;
    const heading = spanOf(source, "heading");
    const diagnostics: PlanDiagnostic[] = [
      {
        from: heading.from,
        to: heading.to,
        severity: "error",
        message: "unknown variable: tytuł",
        hints: ["sprawdź nazwę"],
      },
    ];
    const plan = planDecorations(source, spans, [], diagnostics);
    expect(plan.styles.some((style) => style.className === "cm-h1")).toBe(
      false,
    );
    expect(plan.points.map((point) => point.text)).toEqual([
      "unknown variable: tytuł sprawdź nazwę",
    ]);
    expect(
      plan.styles.some((style) => style.className === "cm-error-range"),
    ).toBe(true);
  });

  it("does not force a span back to source for a warning", () => {
    const source = "= Tytuł\n";
    const spans = classifySpans(source, 0, source.length).spans;
    const heading = spanOf(source, "heading");
    const plan = planDecorations(
      source,
      spans,
      [],
      [
        {
          from: heading.from,
          to: heading.to,
          severity: "warning",
          message: "unused",
          hints: [],
        },
      ],
    );
    expect(plan.styles.some((style) => style.className === "cm-h1")).toBe(true);
    expect(plan.points).toHaveLength(0);
  });

  it("replaces no decoration ranges when the caret stays inside an open span", () => {
    const source = "= Tytuł dłuższy\n\nDrugi akapit.\n";
    const spans = classifySpans(source, 0, source.length).spans;
    const heading = spanOf(source, "heading");
    const inside = heading.from + heading.marker.length + 1;
    expect(
      caretMoveReplacesRanges(
        source,
        spans,
        [{ from: inside, to: inside }],
        [{ from: inside + 1, to: inside + 1 }],
        [],
      ),
    ).toBe(0);
  });
});

describe("editor diagnostics", () => {
  const sent = "łódź = x\n";
  const wordBytes = new TextEncoder().encode("łódź").length;

  it("converts bytes only for the open note when the source still matches", () => {
    const applied = editorDiagnostics(
      [
        {
          file: "",
          start: 0,
          end: wordBytes,
          severity: "error",
          message: "bad",
          hints: [],
        },
        {
          file: "inne.typ",
          start: 0,
          end: 1,
          severity: "error",
          message: "other",
          hints: [],
        },
        {
          file: "notatka.typ",
          start: 0,
          end: wordBytes,
          severity: "warning",
          message: "soft",
          hints: [],
        },
      ],
      sent,
      sent,
      "notatka.typ",
      true,
    );
    expect(applied.map((item) => item.message)).toEqual(["bad", "soft"]);
    expect(applied[0]?.to).toBe("łódź".length);
  });

  it("drops marks when the buffer moved on after the compile", () => {
    expect(
      editorDiagnostics(
        [
          {
            file: "",
            start: 0,
            end: 2,
            severity: "error",
            message: "stale",
            hints: [],
          },
        ],
        sent,
        `${sent}a`,
        "",
        true,
      ),
    ).toEqual([]);
    expect(
      editorDiagnostics(
        [
          {
            file: "",
            start: 0,
            end: 1,
            severity: "error",
            message: "old",
            hints: [],
          },
        ],
        sent,
        sent,
        "",
        false,
      ),
    ).toEqual([]);
  });
});

describe("structure keys", () => {
  function edit(
    source: string,
    caret: number,
    key: "Enter" | "Backspace" | "Tab",
    shift = false,
    composing = false,
  ) {
    const spans = classifySpans(source, 0, source.length).spans;
    return structureKey(source, caret, caret, spans, key, shift, composing);
  }

  it("starts a body line from a heading without copying the marker", () => {
    const source = "= Zażółć\n";
    const caret = source.indexOf("\n");
    expect(edit(source, caret, "Enter")).toEqual({
      from: caret,
      to: caret,
      insert: "\n",
      selection: caret + 1,
    });
  });

  it("continues a list item that has text and clears an empty one", () => {
    const filled = "- łódź\n";
    const caret = filled.indexOf("ł") + 1;
    expect(edit(filled, caret, "Enter")?.insert).toBe("\n- ");
    const empty = "  - \n";
    const emptyCaret = 4;
    expect(edit(empty, emptyCaret, "Enter")).toEqual({
      from: 0,
      to: 4,
      insert: "",
      selection: 0,
    });
  });

  it("stays in a quote that has text and leaves an empty quote line", () => {
    const source = "#quote[łódź]";
    const caret = source.length - 1;
    expect(edit(source, caret, "Enter")).toEqual({
      from: caret,
      to: caret,
      insert: "\n",
      selection: caret + 1,
    });
    const blank = "#quote[\n\n]";
    const emptyCaret = blank.indexOf("\n") + 1;
    expect(edit(blank, emptyCaret, "Enter")?.selection).toBe(blank.length);
    expect(edit(blank, emptyCaret, "Enter")?.insert).toBe("");
  });

  it("removes a marker with Backspace and indents only a list item with Tab", () => {
    const heading = "= Tytuł\n";
    expect(edit(heading, 2, "Backspace")).toEqual({
      from: 0,
      to: 2,
      insert: "",
      selection: 0,
    });
    const item = "- alfa\n";
    expect(edit(item, 4, "Tab")).toEqual({
      from: 0,
      to: 0,
      insert: "  ",
      selection: 6,
    });
    const nested = "  - alfa\n";
    expect(edit(nested, 6, "Tab", true)).toEqual({
      from: 0,
      to: 2,
      insert: "",
      selection: 4,
    });
    expect(edit("Zwykły tekst\n", 3, "Tab")).toBeNull();
    expect(edit(item, 4, "Tab", false, true)).toBeNull();
    expect(edit(item, 2, "Backspace")).toEqual({
      from: 0,
      to: 2,
      insert: "",
      selection: 0,
    });
  });

  it("does nothing for a selection or while composing", () => {
    const source = "= Tytuł\n";
    const spans = classifySpans(source, 0, source.length).spans;
    expect(structureKey(source, 2, 4, spans, "Enter", false, false)).toBeNull();
    expect(structureKey(source, 2, 2, spans, "Enter", false, true)).toBeNull();
  });
});

function longNote(): string {
  const parts: string[] = ["= Wykład\n\n"];
  parts.push("- pierwsza\n- druga pozycja\n\n");
  parts.push("#quote(attribution: [Skrypt])[Cytat z łodzią]\n\n");
  for (let index = 0; index < 520; index += 1) {
    const polish = index % 2 === 0 ? "zażółć gęślą jaźń" : "łódź i źródło";
    const math = index % 25 === 0 ? " wzór $a+b$ dalej" : "";
    parts.push(
      `Akapit ${index} ${polish} słowa notatki studenta na marginesie zeszytu.${math}\n\n`,
    );
  }
  return parts.join("");
}

describe("long note window", () => {
  it("reads only the dirty window for one inserted letter", () => {
    const source = longNote();
    const words = source.split(/\s+/).filter(Boolean);
    expect(words.length).toBeGreaterThanOrEqual(5000);
    expect(source.match(/\$a\+b\$/g)?.length ?? 0).toBeGreaterThanOrEqual(20);
    expect(source).toContain("zażółć");
    const needle = "Akapit 260";
    const at = source.indexOf(needle);
    expect(at).toBeGreaterThan(0);
    const change = at + needle.length;
    const result = classifySpans(source, change, change + 1);
    expect(result.charsRead).toBe(result.windowTo - result.windowFrom);
    expect(result.charsRead).toBeLessThan(source.length / 10);
    expect(result.windowFrom).toBeGreaterThan(0);
    expect(result.windowTo).toBeLessThan(source.length);
    for (const span of result.spans) {
      expect(span.from).toBeGreaterThanOrEqual(result.windowFrom);
      expect(span.to).toBeLessThanOrEqual(result.windowTo);
    }
    expect(result.spans.some((span) => span.from < 10)).toBe(false);
  });
});

describe("code, images, and links", () => {
  it("draws inline code and a fenced block", () => {
    const inline = spanOf("Wynik `x` jest.", "raw");
    expect(inline.block).toBe(false);
    expect(inline.marker).toBe("`");
    const fenced = "```rust\nlet x = 1\n```\n";
    const block = spanOf(fenced, "raw");
    expect(block.block).toBe(true);
    expect(block.marker).toBe("rust");
    const plan = rendered(fenced);
    const marks = flattenRanges(plan).filter((range) => range.kind === "mark");
    expect(marks.some((range) => range.className.includes("cm-raw"))).toBe(
      true,
    );
    expect(plan.points.some((point) => point.text === "rust")).toBe(true);
    expect(spanShownAsSource(block, fenced, [], [])).toBe(false);
  });

  it("shows an image path and keeps a table as source", () => {
    const source = '#image("lecture.assets/slide.png")\n';
    const image = spanOf(source, "image");
    expect(image.block).toBe(true);
    expect(image.marker).toBe("lecture.assets/slide.png");
    const plan = rendered(source);
    const replaced = flattenRanges(plan).find(
      (range) =>
        range.kind === "replace" && range.className.includes("cm-image"),
    );
    expect(replaced && replaced.kind === "replace" ? replaced.text : "").toBe(
      "lecture.assets/slide.png",
    );
    const table = "#table(\n  columns: (1fr),\n  [a],\n)\n";
    expect(kinds(table)).not.toContain("image");
    expect(kinds('Zobacz #image("a.png") tu.')).toContain("image");
  });

  it("draws a link call and a bare url", () => {
    const source = '#link("https://example.com/a")[wzór]\n';
    const link = spanOf(source, "link");
    expect(link.marker).toBe("https://example.com/a");
    const plan = rendered(source);
    const marked = flattenRanges(plan).find(
      (range) => range.kind === "mark" && range.className === "cm-link",
    );
    expect(marked ? source.slice(marked.from, marked.to) : "").toBe("wzór");
    const bare = "Zobacz https://example.com/b.\n";
    expect(
      bareLinks(bare, classifySpans(bare, 0, bare.length).spans)[0]?.url,
    ).toBe("https://example.com/b");
    expect(
      linkAt(
        source,
        classifySpans(source, 0, source.length).spans,
        link.from + 8,
      ),
    ).toBe("https://example.com/a");
    expect(isOpenableUrl("javascript:alert(1)")).toBe(false);
    expect(isOpenableUrl("mailto:a@b.c")).toBe(true);
  });
});
