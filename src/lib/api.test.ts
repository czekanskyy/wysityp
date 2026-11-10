import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../bindings", () => ({
  commands: {
    openWorkspace: vi.fn(),
    listTree: vi.fn(),
    createNote: vi.fn(),
    createBlankNote: vi.fn(),
    createFolder: vi.fn(),
    renameEntry: vi.fn(),
    deleteEntry: vi.fn(),
    listNotes: vi.fn(),
    searchNotes: vi.fn(),
    listRecentNotes: vi.fn(),
    openNote: vi.fn(),
    createFromTemplate: vi.fn(),
    listTemplates: vi.fn(),
    copyShippedTemplate: vi.fn(),
    openTemplate: vi.fn(),
    saveTemplate: vi.fn(),
    templateChangedOnDisk: vi.fn(),
    saveNoteImage: vi.fn(),
    createSampleNote: vi.fn(),
    saveNote: vi.fn(),
    noteChangedOnDisk: vi.fn(),
    renderNote: vi.fn(),
    exportPdf: vi.fn(),
    renderMath: vi.fn(),
    readNoteImage: vi.fn(),
    openLink: vi.fn(),
    getSettings: vi.fn(),
    setLocale: vi.fn(),
    setTheme: vi.fn(),
    setPageColor: vi.fn(),
    setFonts: vi.fn(),
    greetingName: vi.fn(),
  },
}));

import { commands } from "../bindings";
import { api } from "./api";
import { isExternalChange } from "./noteSafety";

const mocked = vi.mocked(commands);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("workspace api", () => {
  it("returns the folder tree Rust sends", async () => {
    const tree = [
      {
        name: "lab",
        path: "lab",
        kind: "folder",
        children: [
          { name: "one.typ", path: "lab/one.typ", kind: "note", children: [] },
        ],
      },
    ];
    mocked.listTree.mockResolvedValue(tree as never);

    await expect(api.listTree()).resolves.toEqual(tree);
    expect(mocked.listTree).toHaveBeenCalledTimes(1);
  });

  it("creates a note in the chosen folder and hands back its words", async () => {
    mocked.createNote.mockResolvedValue({
      path: "lab/one.typ",
      text: "= one\n",
    } as never);

    await expect(api.createNote("lab", "one")).resolves.toEqual({
      path: "lab/one.typ",
      text: "= one\n",
    });
    expect(mocked.createNote).toHaveBeenCalledWith("lab", "one");
  });

  it("creates a blank note in the chosen folder and hands back its words", async () => {
    mocked.createBlankNote.mockResolvedValue({
      path: "lab/note.typ",
      text: "= note\n",
    } as never);

    await expect(api.createBlankNote("lab")).resolves.toEqual({
      path: "lab/note.typ",
      text: "= note\n",
    });
    expect(mocked.createBlankNote).toHaveBeenCalledWith("lab");
  });

  it("asks Rust for the greeting name and hands the word back", async () => {
    mocked.greetingName.mockResolvedValue("Ada" as never);

    await expect(api.greetingName()).resolves.toBe("Ada");
    expect(mocked.greetingName).toHaveBeenCalledTimes(1);
  });

  it("creates a folder and returns its path from the root", async () => {
    mocked.createFolder.mockResolvedValue("lab" as never);

    await expect(api.createFolder("", "lab")).resolves.toBe("lab");
    expect(mocked.createFolder).toHaveBeenCalledWith("", "lab");
  });

  it("renames or moves an entry and returns the new path", async () => {
    mocked.renameEntry.mockResolvedValue("dest/new.typ" as never);

    await expect(api.renameEntry("old.typ", "dest/new.typ")).resolves.toBe(
      "dest/new.typ",
    );
    expect(mocked.renameEntry).toHaveBeenCalledWith("old.typ", "dest/new.typ");
  });

  it("searches notes with the query string only", async () => {
    const hits = [{ path: "lab/one.typ", line: 3, snippet: "a proof" }];
    mocked.searchNotes.mockResolvedValue(hits as never);

    await expect(api.searchNotes("proof")).resolves.toEqual(hits);
    expect(mocked.searchNotes).toHaveBeenCalledWith("proof");
  });

  it("lists recent notes as paths counted from the root", async () => {
    mocked.listRecentNotes.mockResolvedValue(["b.typ", "a.typ"] as never);

    await expect(api.listRecentNotes()).resolves.toEqual(["b.typ", "a.typ"]);
    expect(mocked.listRecentNotes).toHaveBeenCalledTimes(1);
  });

  it("creates a note from a template in the chosen folder", async () => {
    mocked.createFromTemplate.mockResolvedValue({
      path: "lab/unsaved.typ",
      text: "= Lecture title\n",
    } as never);

    await expect(
      api.createFromTemplate("lab", "shipped", "lecture"),
    ).resolves.toEqual({
      path: "lab/unsaved.typ",
      text: "= Lecture title\n",
    });
    expect(mocked.createFromTemplate).toHaveBeenCalledWith(
      "lab",
      "shipped",
      "lecture",
    );
  });

  it("deletes the entry at the given path", async () => {
    mocked.deleteEntry.mockResolvedValue(null as never);

    await expect(api.deleteEntry("lab/one.typ")).resolves.toBeNull();
    expect(mocked.deleteEntry).toHaveBeenCalledWith("lab/one.typ");
  });

  it("turns a Rust error answer into a thrown error with its words", async () => {
    mocked.createNote.mockResolvedValue({
      status: "error",
      error: "that name is already taken",
    } as never);

    await expect(api.createNote("", "one.typ")).rejects.toThrow(
      "that name is already taken",
    );
  });

  it("saves the note and can force the write", async () => {
    const fingerprint = { hash: "abc", byte_len: 4 };
    mocked.saveNote.mockResolvedValue(fingerprint as never);

    await expect(
      api.saveNote("notes/one.typ", "= A\n", false),
    ).resolves.toEqual(fingerprint);
    expect(mocked.saveNote).toHaveBeenCalledWith(
      "notes/one.typ",
      "= A\n",
      false,
    );

    await api.saveNote("notes/one.typ", "= B\n", true);
    expect(mocked.saveNote).toHaveBeenCalledWith(
      "notes/one.typ",
      "= B\n",
      true,
    );
  });

  it("asks Rust whether the open note changed on disk", async () => {
    mocked.noteChangedOnDisk.mockResolvedValue(true as never);

    await expect(api.noteChangedOnDisk("notes/one.typ")).resolves.toBe(true);
    expect(mocked.noteChangedOnDisk).toHaveBeenCalledWith("notes/one.typ");
  });

  it("exports the open note and returns the PDF path from the root", async () => {
    mocked.exportPdf.mockResolvedValue("notes/lecture.pdf" as never);

    await expect(
      api.exportPdf("notes/lecture.typ", "= Wykład\n"),
    ).resolves.toBe("notes/lecture.pdf");
    expect(mocked.exportPdf).toHaveBeenCalledWith(
      "notes/lecture.typ",
      "= Wykład\n",
    );
  });

  it("unwraps a good answer that arrives in an envelope", async () => {
    mocked.renameEntry.mockResolvedValue({
      status: "ok",
      data: "new.typ",
    } as never);

    await expect(api.renameEntry("old.typ", "new.typ")).resolves.toBe(
      "new.typ",
    );
  });
});

describe("template and image api", () => {
  const doc = {
    name: "lecture.typ",
    text: "= Lecture title\n",
    fingerprint: { hash: "abc", byte_len: 16 },
  };

  // covers: spec 0006 AC-4, the page gets stems, your names and the folder flag
  it("lists the shipped stems, your names and whether the folder is ready", async () => {
    const list = {
      shipped: ["lecture", "lab"],
      yours: ["mine.typ"],
      folder_ready: true,
    };
    mocked.listTemplates.mockResolvedValue(list as never);

    await expect(api.listTemplates()).resolves.toEqual(list);
    expect(mocked.listTemplates).toHaveBeenCalledWith();
  });

  // covers: spec 0006 AC-7, a copy sends only the stem
  it("copies a shipped template by stem and returns the new file", async () => {
    mocked.copyShippedTemplate.mockResolvedValue(doc as never);

    await expect(api.copyShippedTemplate("lecture")).resolves.toEqual(doc);
    expect(mocked.copyShippedTemplate).toHaveBeenCalledWith("lecture");
  });

  // covers: spec 0006 AC-7, the page sees the exhausted prefix and the Rust words
  it("throws the Rust words when every copy name is taken", async () => {
    mocked.copyShippedTemplate.mockResolvedValue({
      status: "error",
      error: "template-names-exhausted: every copy name is taken",
    } as never);

    await expect(api.copyShippedTemplate("lecture")).rejects.toThrow(
      /^template-names-exhausted:/,
    );
  });

  it("opens one of your templates by file name", async () => {
    mocked.openTemplate.mockResolvedValue(doc as never);

    await expect(api.openTemplate("lecture.typ")).resolves.toEqual(doc);
    expect(mocked.openTemplate).toHaveBeenCalledWith("lecture.typ");
  });

  // covers: spec 0006 AC-8, a template save can be forced and a refusal reads as a conflict
  it("saves a template and can force the write", async () => {
    mocked.saveTemplate.mockResolvedValue(doc as never);

    await expect(
      api.saveTemplate("lecture.typ", "= A\n", false),
    ).resolves.toEqual(doc);
    await api.saveTemplate("lecture.typ", "= B\n", true);

    expect(mocked.saveTemplate).toHaveBeenNthCalledWith(
      1,
      "lecture.typ",
      "= A\n",
      false,
    );
    expect(mocked.saveTemplate).toHaveBeenNthCalledWith(
      2,
      "lecture.typ",
      "= B\n",
      true,
    );
  });

  it("turns the external change refusal of a template save into a thrown error", async () => {
    mocked.saveTemplate.mockResolvedValue({
      status: "error",
      error: "external-change: the note on disk was changed by another tool",
    } as never);

    const error = await api
      .saveTemplate("lecture.typ", "= A\n", false)
      .catch((caught: unknown) => caught);

    expect(isExternalChange(error)).toBe(true);
  });

  // covers: spec 0006 AC-8, focus asks about the template by file name
  it("asks Rust whether the open template changed on disk", async () => {
    mocked.templateChangedOnDisk.mockResolvedValue(true as never);

    await expect(api.templateChangedOnDisk("lecture.typ")).resolves.toBe(true);
    expect(mocked.templateChangedOnDisk).toHaveBeenCalledWith("lecture.typ");
  });

  // covers: spec 0006 AC-10, the path comes back relative and a refusal keeps its prefix
  it("saves a note image and returns the relative path", async () => {
    mocked.saveNoteImage.mockResolvedValue("unsaved.assets/image.png" as never);

    await expect(api.saveNoteImage("unsaved.typ", "", [1, 2, 3])).resolves.toBe(
      "unsaved.assets/image.png",
    );
    expect(mocked.saveNoteImage).toHaveBeenCalledWith(
      "unsaved.typ",
      "",
      [1, 2, 3],
    );
  });

  it("throws an image refusal with its prefix", async () => {
    mocked.saveNoteImage.mockResolvedValue({
      status: "error",
      error: "image-refused: that image type is not allowed",
    } as never);

    await expect(
      api.saveNoteImage("unsaved.typ", "draw.svg", [1]),
    ).rejects.toThrow(/^image-refused:/);
  });
});

describe("appearance api", () => {
  const settings = {
    locale: "pl",
    theme: "dark",
    page_color: "graphite",
  };

  // covers: AC-8, AC-9
  it("sends the theme and does not send the page colour", async () => {
    mocked.setTheme.mockResolvedValue(settings as never);

    await expect(api.setTheme("dark")).resolves.toEqual(settings);
    expect(mocked.setTheme).toHaveBeenCalledTimes(1);
    expect(mocked.setTheme).toHaveBeenCalledWith("dark");
    expect(mocked.setPageColor).not.toHaveBeenCalled();
  });

  // covers: AC-9
  it("sends the page colour and does not send the theme", async () => {
    const next = { locale: "pl", theme: "light", page_color: "oled" };
    mocked.setPageColor.mockResolvedValue(next as never);

    await expect(api.setPageColor("oled")).resolves.toEqual(next);
    expect(mocked.setPageColor).toHaveBeenCalledTimes(1);
    expect(mocked.setPageColor).toHaveBeenCalledWith("oled");
    expect(mocked.setTheme).not.toHaveBeenCalled();
  });

  // covers: AC-11
  it("returns locale, theme, and page colour from settings", async () => {
    mocked.getSettings.mockResolvedValue(settings as never);

    await expect(api.getSettings()).resolves.toEqual(settings);
    expect(mocked.getSettings).toHaveBeenCalledTimes(1);
    expect(mocked.setTheme).not.toHaveBeenCalled();
    expect(mocked.setPageColor).not.toHaveBeenCalled();
  });

  // covers: AC-12
  it("throws the Rust words when the theme is refused", async () => {
    mocked.setTheme.mockResolvedValue({
      status: "error",
      error: "unknown theme: blue",
    } as never);

    await expect(api.setTheme("blue")).rejects.toThrow("unknown theme: blue");
    expect(mocked.setPageColor).not.toHaveBeenCalled();
  });

  // covers: AC-12
  it("throws the Rust words when the page colour is refused", async () => {
    mocked.setPageColor.mockResolvedValue({
      status: "error",
      error: "unknown page colour: navy",
    } as never);

    await expect(api.setPageColor("navy")).rejects.toThrow(
      "unknown page colour: navy",
    );
    expect(mocked.setTheme).not.toHaveBeenCalled();
  });

  it("sends both editor fonts and does not send the theme", async () => {
    const saved = {
      locale: "pl",
      theme: "dark",
      page_color: "graphite",
      source_font: "Consolas",
      render_font: "Segoe UI",
    };
    mocked.setFonts.mockResolvedValue(saved as never);

    await expect(api.setFonts("Consolas", "Segoe UI")).resolves.toEqual(saved);
    expect(mocked.setFonts).toHaveBeenCalledWith("Consolas", "Segoe UI");
    expect(mocked.setTheme).not.toHaveBeenCalled();
    expect(mocked.setPageColor).not.toHaveBeenCalled();
  });
});
