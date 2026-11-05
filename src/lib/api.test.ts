import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../bindings", () => ({
  commands: {
    openWorkspace: vi.fn(),
    listTree: vi.fn(),
    createNote: vi.fn(),
    createFolder: vi.fn(),
    renameEntry: vi.fn(),
    deleteEntry: vi.fn(),
    listNotes: vi.fn(),
    searchNotes: vi.fn(),
    listRecentNotes: vi.fn(),
    openNote: vi.fn(),
    createFromTemplate: vi.fn(),
    createSampleNote: vi.fn(),
    saveNote: vi.fn(),
    noteChangedOnDisk: vi.fn(),
    renderNote: vi.fn(),
    exportPdf: vi.fn(),
    getSettings: vi.fn(),
    setLocale: vi.fn(),
  },
}));

import { commands } from "../bindings";
import { api } from "./api";

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
      path: "lab/lecture-2.typ",
      text: "= Lecture title\n",
    } as never);

    await expect(api.createFromTemplate("lab", "lecture")).resolves.toEqual({
      path: "lab/lecture-2.typ",
      text: "= Lecture title\n",
    });
    expect(mocked.createFromTemplate).toHaveBeenCalledWith("lab", "lecture");
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
