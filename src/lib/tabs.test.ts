import { describe, expect, it } from "vitest";

import {
  blankTitleSelection,
  createTab,
  cycleIndex,
  draftIsDisposable,
  findTabByKey,
  keyWasRemoved,
  moveItem,
  neighborIndex,
  pathsMatch,
  retargetKey,
  sessionToken,
  storedEditorMatches,
  tabTitle,
} from "./tabs";

describe("tabs", () => {
  it("names a draft Untitled and a note by its file", () => {
    expect(tabTitle("draft", "C:/drafts/untitled.typ", "Untitled")).toBe(
      "Untitled",
    );
    expect(tabTitle("note", "week/lecture.typ", "Untitled")).toBe(
      "lecture.typ",
    );
    expect(tabTitle("template", "proof.typ", "Untitled")).toBe("proof.typ");
  });

  it("focuses a note that is already open, ignoring case", () => {
    const tabs = [
      createTab(1, "note", "Week/A.typ", "", "Untitled"),
      createTab(2, "draft", "C:/drafts/untitled.typ", "", "Untitled"),
    ];
    expect(findTabByKey(tabs, "note", "week/a.typ")).toBe(0);
    expect(findTabByKey(tabs, "note", "C:/drafts/untitled.typ")).toBe(-1);
    expect(findTabByKey(tabs, "draft", "c:/drafts/untitled.typ")).toBe(1);
  });

  it("cycles forward and backward and reorders", () => {
    expect(cycleIndex(3, 0, false)).toBe(1);
    expect(cycleIndex(3, 2, false)).toBe(0);
    expect(cycleIndex(3, 0, true)).toBe(2);
    expect(moveItem(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
    expect(moveItem(["a", "b"], 5, 0)).toEqual(["a", "b"]);
  });

  it("retargets a renamed note and closes a deleted folder", () => {
    expect(retargetKey("week/a.typ", "week", "term")).toBe("term/a.typ");
    expect(retargetKey("week", "week", "term")).toBe("term");
    expect(retargetKey("other.typ", "week", "term")).toBe("other.typ");
    expect(keyWasRemoved("week/a.typ", "week")).toBe(true);
    expect(keyWasRemoved("week", "week")).toBe(true);
    expect(keyWasRemoved("weekly.typ", "week")).toBe(false);
  });

  it("names a template for the session and picks a neighbor when one closes", () => {
    expect(sessionToken({ kind: "template", key: "proof.typ" })).toBe(
      "template:proof.typ",
    );
    expect(sessionToken({ kind: "note", key: "a.typ" })).toBe("a.typ");
    expect(neighborIndex(3, 1)).toBe(1);
    expect(neighborIndex(3, 2)).toBe(1);
    expect(neighborIndex(1, 0)).toBe(-1);
  });

  it("selects the blank heading word so the first key replaces it", () => {
    expect(blankTitleSelection("= Tytuł\n")).toEqual({ anchor: 2, head: 7 });
    expect(blankTitleSelection("= Title\n")).toEqual({ anchor: 2, head: 7 });
    expect("= Tytuł\n".slice(2, 7)).toBe("Tytuł");
    expect(blankTitleSelection("= Analiza\n")).toBeNull();
    expect(blankTitleSelection("= Tytuł\n\nnotatka\n")).toBeNull();
  });

  it("treats an untouched or blank draft as disposable and keeps written text", () => {
    const blank = createTab(
      1,
      "draft",
      "C:/drafts/untitled.typ",
      "= Tytuł\n",
      "Untitled",
    );
    expect(draftIsDisposable(blank)).toBe(true);
    expect(draftIsDisposable({ ...blank, text: "  \n" })).toBe(true);
    expect(draftIsDisposable({ ...blank, text: "= Title\n" })).toBe(true);
    expect(draftIsDisposable({ ...blank, text: "= Tytuł\n\nnotatka\n" })).toBe(
      false,
    );
    const restored = createTab(
      2,
      "draft",
      "C:/drafts/untitled-2.typ",
      "= wykład\n",
      "Untitled",
    );
    expect(restored.origin).toBe("");
    expect(draftIsDisposable(restored)).toBe(false);
    const note = createTab(3, "note", "a.typ", "= Tytuł\n", "Untitled");
    expect(draftIsDisposable(note)).toBe(false);
  });

  it("keeps undo history only when it is still the tab document", () => {
    expect(
      storedEditorMatches("= Tytuł\n\nnotatka\n", "= Tytuł\n\nnotatka\n"),
    ).toBe(true);
    expect(storedEditorMatches("= Tytuł\n", "= Tytuł\n\nnotatka\n")).toBe(
      false,
    );
    expect(storedEditorMatches(undefined, "= Tytuł\n")).toBe(false);
  });

  it("treats a relative note and its absolute path as the same file", () => {
    expect(pathsMatch("week/a.typ", "C:/Notes/week/a.typ")).toBe(true);
    expect(pathsMatch("C:/Notes/week/a.typ", "week/a.typ")).toBe(true);
    expect(pathsMatch("week/a.typ", "C:/Other/a.typ")).toBe(false);
    expect(pathsMatch("a.typ", "a.typ")).toBe(true);
  });
});
