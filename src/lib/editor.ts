import { EditorState } from "@codemirror/state";
import {
  EditorView,
  highlightActiveLine,
  keymap,
  lineNumbers,
} from "@codemirror/view";
import { basicSetup } from "codemirror";

export interface EditorHandle {
  getText(): string;
  setText(text: string): void;
  setSelection(position: number): void;
  focus(): void;
  destroy(): void;
}

export function createEditor(
  parent: HTMLElement,
  initial: string,
  onChange: (text: string) => void,
): EditorHandle {
  const view = new EditorView({
    parent,
    state: EditorState.create({
      doc: initial,
      extensions: [
        basicSetup,
        lineNumbers(),
        highlightActiveLine(),
        EditorView.lineWrapping,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) onChange(update.state.doc.toString());
        }),
        EditorView.theme({
          "&": { height: "100%", fontSize: "14px" },
          ".cm-scroller": {
            fontFamily: "Consolas, 'Cascadia Mono', monospace",
            lineHeight: "1.55",
          },
          ".cm-content": { padding: "16px 0" },
          "&.cm-focused": { outline: "none" },
        }),
        keymap.of([]),
      ],
    }),
  });

  return {
    getText: () => view.state.doc.toString(),
    setText: (text: string) => {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: text },
        selection: { anchor: 0 },
      });
    },
    setSelection: (position: number) => {
      const clamped = Math.max(0, Math.min(position, view.state.doc.length));
      view.dispatch({ selection: { anchor: clamped } });
      view.dispatch({
        effects: EditorView.scrollIntoView(clamped, { y: "center" }),
      });
    },
    focus: () => view.focus(),
    destroy: () => view.destroy(),
  };
}
