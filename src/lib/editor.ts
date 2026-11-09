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
        // Colours and fonts come from the design tokens (src/styles), so the
        // editor follows the light and dark theme without its own palette.
        EditorView.theme({
          "&": {
            height: "100%",
            fontSize: "14px",
            color: "var(--color-text)",
            backgroundColor: "var(--color-surface-raised)",
          },
          ".cm-scroller": {
            fontFamily: "var(--font-mono)",
            lineHeight: "var(--leading-code)",
          },
          ".cm-content": {
            padding: "16px 0",
            caretColor: "var(--color-accent)",
          },
          ".cm-cursor, .cm-dropCursor": {
            borderLeftColor: "var(--color-accent)",
          },
          "&.cm-focused": { outline: "none" },
          ".cm-gutters": {
            backgroundColor: "var(--color-surface-raised)",
            color: "var(--color-text-faint)",
            border: "none",
          },
          ".cm-activeLine": { backgroundColor: "var(--color-hover)" },
          ".cm-activeLineGutter": {
            backgroundColor: "var(--color-hover)",
            color: "var(--color-text-muted)",
          },
          "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection":
            { backgroundColor: "var(--color-selection)" },
          ".cm-selectionMatch": {
            backgroundColor: "var(--color-accent-soft)",
          },
          "&.cm-focused .cm-matchingBracket": {
            backgroundColor: "var(--color-accent-soft)",
            outline: "1px solid var(--color-border-strong)",
          },
          ".cm-panels": {
            backgroundColor: "var(--color-bg)",
            color: "var(--color-text)",
          },
          ".cm-tooltip": {
            backgroundColor: "var(--color-surface-raised)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-md)",
            boxShadow: "var(--shadow-md)",
          },
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
