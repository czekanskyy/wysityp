import { EditorState } from "@codemirror/state";
import {
  EditorView,
  highlightActiveLine,
  keymap,
  lineNumbers,
} from "@codemirror/view";
import { basicSetup } from "codemirror";
import type { EditorPlace } from "./noteSafety";

export type { EditorPlace } from "./noteSafety";
export { EDITOR_PLACE_START } from "./noteSafety";

export interface EditorHandle {
  getText(): string;
  getPlace(): EditorPlace;
  setText(text: string): void;
  restorePlace(place: EditorPlace): void;
  setSelection(position: number): void;
  focus(): void;
  destroy(): void;
}

export function createEditor(
  parent: HTMLElement,
  initial: string,
  onChange: (text: string) => void,
): EditorHandle {
  let notifying = true;
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
          if (update.docChanged && notifying) {
            onChange(update.state.doc.toString());
          }
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

  function clamp(position: number): number {
    return Math.max(0, Math.min(position, view.state.doc.length));
  }

  return {
    getText: () => view.state.doc.toString(),
    getPlace: () => {
      const range = view.state.selection.main;
      return {
        anchor: range.anchor,
        head: range.head,
        scrollTop: view.scrollDOM.scrollTop,
        scrollLeft: view.scrollDOM.scrollLeft,
      };
    },
    setText: (text: string) => {
      notifying = false;
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: text },
        selection: { anchor: 0 },
      });
      notifying = true;
    },
    restorePlace: (place: EditorPlace) => {
      const anchor = clamp(place.anchor);
      const head = clamp(place.head);
      view.dispatch({ selection: { anchor, head } });
      view.requestMeasure();
      const applyScroll = () => {
        view.scrollDOM.scrollTop = place.scrollTop;
        view.scrollDOM.scrollLeft = place.scrollLeft;
      };
      applyScroll();
      requestAnimationFrame(applyScroll);
    },
    setSelection: (position: number) => {
      const clamped = clamp(position);
      view.dispatch({ selection: { anchor: clamped } });
      view.dispatch({
        effects: EditorView.scrollIntoView(clamped, { y: "center" }),
      });
    },
    focus: () => view.focus(),
    destroy: () => view.destroy(),
  };
}
