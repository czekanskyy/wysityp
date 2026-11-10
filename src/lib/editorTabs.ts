import type { EditorState } from "@codemirror/state";

import type { EditorHandle } from "./editor";

type StateHost = EditorHandle & {
  getState?: () => EditorState;
  setState?: (state: EditorState) => void;
  freshState?: (text: string) => EditorState;
};

function host(handle: EditorHandle): StateHost {
  return handle;
}

/** Read the live CodeMirror state. Null until the editor exposes getState. */
export function readEditorState(handle: EditorHandle): EditorState | null {
  return host(handle).getState?.() ?? null;
}

/** Put a saved state back. Returns false when the editor cannot do that yet. */
export function writeEditorState(
  handle: EditorHandle,
  state: EditorState,
): boolean {
  const editor = host(handle);
  if (!editor.setState) return false;
  editor.setState(state);
  return true;
}

/**
 * Replace the document without keeping the previous note's undo history.
 * Uses freshState when the editor has it, otherwise setText.
 */
export function replaceEditorText(handle: EditorHandle, text: string): void {
  const editor = host(handle);
  const fresh = editor.freshState?.(text);
  if (fresh && editor.setState) {
    editor.setState(fresh);
    return;
  }
  handle.setText(text);
}
