import { describe, expect, it } from "vitest";
import { filterCommands, foldText, type Command } from "./commands";
import { nextRovingIndex } from "./roving";

const noop = () => {};
const commands: Command[] = [
  { id: "new", title: "Nowa notatka", keywords: ["new note"], run: noop },
  { id: "source", title: "Pokaż źródło", keywords: ["source"], run: noop },
  {
    id: "math",
    title: "Wstaw wzór",
    keywords: ["math", "equation"],
    run: noop,
  },
  { id: "pdf", title: "Eksportuj do PDF", run: noop },
];

describe("foldText", () => {
  it("drops case and Polish accents", () => {
    expect(foldText("Źródło ŁÓDŹ żółć")).toBe("zrodlo lodz zolc");
  });
});

describe("filterCommands", () => {
  it("keeps the order for an empty query", () => {
    expect(filterCommands(commands, "  ")).toEqual(commands);
  });

  it("matches without accents", () => {
    expect(filterCommands(commands, "zrodlo").map((c) => c.id)).toEqual([
      "source",
    ]);
  });

  it("matches keywords in the other language", () => {
    expect(filterCommands(commands, "equation").map((c) => c.id)).toEqual([
      "math",
    ]);
  });

  it("needs every word and ranks title prefixes first", () => {
    expect(filterCommands(commands, "no").map((c) => c.id)).toEqual(["new"]);
    expect(filterCommands(commands, "eks pdf").map((c) => c.id)).toEqual([
      "pdf",
    ]);
    expect(filterCommands(commands, "pdf wzór")).toEqual([]);
  });
});

describe("nextRovingIndex", () => {
  it("moves and wraps along the orientation", () => {
    expect(nextRovingIndex("ArrowRight", 0, 3, "horizontal")).toBe(1);
    expect(nextRovingIndex("ArrowRight", 2, 3, "horizontal")).toBe(0);
    expect(nextRovingIndex("ArrowLeft", 0, 3, "horizontal")).toBe(2);
    expect(nextRovingIndex("ArrowDown", 1, 3, "vertical")).toBe(2);
    expect(nextRovingIndex("ArrowUp", 0, 3, "vertical")).toBe(2);
  });

  it("ignores the cross axis and other keys", () => {
    expect(nextRovingIndex("ArrowDown", 0, 3, "horizontal")).toBeNull();
    expect(nextRovingIndex("ArrowRight", 0, 3, "vertical")).toBeNull();
    expect(nextRovingIndex("a", 0, 3, "vertical")).toBeNull();
  });

  it("jumps to the ends and handles an empty group", () => {
    expect(nextRovingIndex("Home", 2, 3, "vertical")).toBe(0);
    expect(nextRovingIndex("End", 0, 3, "vertical")).toBe(2);
    expect(nextRovingIndex("ArrowDown", 0, 0, "vertical")).toBeNull();
  });
});
