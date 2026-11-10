import type { EditorState } from "@codemirror/state";

import {
  createEditorState,
  type EditorHandle,
  type EditorOptions,
} from "./editor";

/** Read the live CodeMirror state, including that tab's undo history. */
export function readEditorState(handle: EditorHandle): EditorState {
  return handle.getState();
}

/** Put one tab's state back. The document change does not notify the page. */
export function writeEditorState(
  handle: EditorHandle,
  state: EditorState,
): void {
  handle.setState(state);
}

/**
 * Replace the document without keeping the previous note's undo history.
 * setText would keep that history, so a tab switch uses a fresh state.
 */
export function replaceEditorText(
  handle: EditorHandle,
  text: string,
  options?: EditorOptions,
): void {
  handle.setState(createEditorState(text, options));
}
