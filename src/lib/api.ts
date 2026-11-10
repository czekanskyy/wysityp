import { commands } from "../bindings";

type SpectaResult<T> =
  { status: "ok"; data: T } | { status: "error"; error: string };

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
  async listTree() {
    return unwrap(await commands.listTree());
  },
  async createNote(parent: string, name: string) {
    return unwrap(await commands.createNote(parent, name));
  },
  async createBlankNote(parent: string) {
    return unwrap(await commands.createBlankNote(parent));
  },
  async createFolder(parent: string, name: string) {
    return unwrap(await commands.createFolder(parent, name));
  },
  async renameEntry(from: string, to: string) {
    return unwrap(await commands.renameEntry(from, to));
  },
  async deleteEntry(path: string) {
    return unwrap(await commands.deleteEntry(path));
  },
  async listNotes() {
    return unwrap(await commands.listNotes());
  },
  async searchNotes(query: string) {
    return unwrap(await commands.searchNotes(query));
  },
  async listRecentNotes() {
    return unwrap(await commands.listRecentNotes());
  },
  async createFromTemplate(parent: string, kind: string, name: string) {
    return unwrap(await commands.createFromTemplate(parent, kind, name));
  },
  async listTemplates() {
    return unwrap(await commands.listTemplates());
  },
  async copyShippedTemplate(name: string) {
    return unwrap(await commands.copyShippedTemplate(name));
  },
  async openTemplate(name: string) {
    return unwrap(await commands.openTemplate(name));
  },
  async saveTemplate(name: string, text: string, force: boolean) {
    return unwrap(await commands.saveTemplate(name, text, force));
  },
  async templateChangedOnDisk(name: string) {
    return unwrap(await commands.templateChangedOnDisk(name));
  },
  async saveNoteImage(path: string, fileName: string, bytes: number[]) {
    return unwrap(await commands.saveNoteImage(path, fileName, bytes));
  },
  async openNote(path: string) {
    return unwrap(await commands.openNote(path));
  },
  async createSampleNote() {
    return unwrap(await commands.createSampleNote());
  },
  async saveNote(path: string, text: string, force: boolean) {
    return unwrap(await commands.saveNote(path, text, force));
  },
  async noteChangedOnDisk(path: string) {
    return unwrap(await commands.noteChangedOnDisk(path));
  },
  async renderNote(path: string, source: string, revision: number) {
    return unwrap(await commands.renderNote(path, source, revision));
  },
  async exportPdf(path: string, source: string) {
    return unwrap(await commands.exportPdf(path, source));
  },
  async getSettings() {
    return unwrap(await commands.getSettings());
  },
  async setLocale(locale: string) {
    return unwrap(await commands.setLocale(locale));
  },
  async setTheme(theme: string) {
    return unwrap(await commands.setTheme(theme));
  },
  async setPageColor(pageColor: string) {
    return unwrap(await commands.setPageColor(pageColor));
  },
  async setFonts(sourceFont: string, renderFont: string) {
    return unwrap(await commands.setFonts(sourceFont, renderFont));
  },
  async greetingName() {
    return unwrap(await commands.greetingName());
  },
};
