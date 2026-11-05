import { commands } from "../bindings";

type SpectaResult<T> =
  | { status: "ok"; data: T }
  | { status: "error"; error: string };

function unwrap<T>(value: T | SpectaResult<T>): T {
  if (
    typeof value === "object" &&
    value !== null &&
    "status" in value &&
    ((value as SpectaResult<T>).status === "ok" ||
      (value as SpectaResult<T>).status === "error")
  ) {
    const result = value as SpectaResult<T>;
    if (result.status === "error") throw new Error(result.error);
    return result.data;
  }
  return value as T;
}

export const api = {
  async openWorkspace() {
    return unwrap(await commands.openWorkspace());
  },
  async listNotes() {
    return unwrap(await commands.listNotes());
  },
  async openNote(path: string) {
    return unwrap(await commands.openNote(path));
  },
  async createSampleNote() {
    return unwrap(await commands.createSampleNote());
  },
  async saveNote(path: string, text: string) {
    return unwrap(await commands.saveNote(path, text));
  },
  async renderNote(path: string, source: string, revision: number) {
    return unwrap(await commands.renderNote(path, source, revision));
  },
  async getSettings() {
    return unwrap(await commands.getSettings());
  },
  async setLocale(locale: string) {
    return unwrap(await commands.setLocale(locale));
  },
};
