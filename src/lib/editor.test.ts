import { describe, expect, it } from "vitest";
import {
  applyEditorDiagnostics,
  createEditorState,
  editorSnapshot,
  structureResult,
} from "./editor";

describe("rendered editor state", () => {
  it("draws a Polish heading in rendered mode and hides it in source mode", () => {
    const source = "= Zażółć gęślą jaźń\n";
    const rendered = editorSnapshot(
      createEditorState(source, { rendered: true }),
    );
    const sourceMode = editorSnapshot(
      createEditorState(source, { rendered: false }),
    );
    expect(rendered.rendered).toBe(true);
    expect(rendered.inline).toBeGreaterThan(0);
    expect(sourceMode.rendered).toBe(false);
    expect(sourceMode.inline).toBe(0);
  });

  it("opens math inside the chip when an arrow would skip it", () => {
    const source = "Przed $x$ po\n";
    const mathFrom = source.indexOf("$");
    const mathTo = source.indexOf("$", mathFrom + 1) + 1;
    const state = createEditorState(source, { rendered: true });
    const next = state.update({ selection: { anchor: mathTo } }).state;
    expect(next.selection.main.head).toBe(mathFrom + 1);
    expect(next.selection.main.anchor).toBe(mathFrom + 1);
  });

  it("keeps the caret when diagnostics are applied and clears them on the next edit", () => {
    const source = "łódź = x\n";
    const state = createEditorState(source, { rendered: true });
    const head = state.selection.main.head;
    const marked = applyEditorDiagnostics(
      state,
      [
        {
          file: "",
          start: 0,
          end: new TextEncoder().encode("łódź").length,
          severity: "error",
          message: "złe równanie",
          hints: ["sprawdź znak"],
        },
        {
          file: "inne.typ",
          start: 0,
          end: 1,
          severity: "error",
          message: "cudze",
          hints: [],
        },
      ],
      source,
      "notatka.typ",
      true,
    );
    expect(editorSnapshot(marked).diagnostics).toBe(1);
    expect(editorSnapshot(marked).head).toBe(head);
    const stale = applyEditorDiagnostics(
      state,
      [
        {
          file: "",
          start: 0,
          end: 1,
          severity: "error",
          message: "stare",
          hints: [],
        },
      ],
      `${source}a`,
      "notatka.typ",
      true,
    );
    expect(editorSnapshot(stale).diagnostics).toBe(0);
    const edited = marked.update({
      changes: { from: 1, to: 1, insert: "a" },
    }).state;
    expect(editorSnapshot(edited).diagnostics).toBe(0);
  });

  it("continues a list with Enter and consumes Tab outside a list", () => {
    const list = createEditorState("- alfa\n", { rendered: true });
    const enter = structureResult(list, "Enter", false, false);
    expect(enter.consume).toBe(true);
    expect(enter.edit?.insert).toBe("\n- ");
    const prose = createEditorState("Zwykły tekst\n", { rendered: true });
    const tab = structureResult(prose, "Tab", false, false);
    expect(tab.consume).toBe(true);
    expect(tab.edit).toBeNull();
    expect(structureResult(prose, "Tab", false, true).consume).toBe(false);
  });
});
