/** How long typing must pause before the note is written. */
export const AUTOSAVE_WAIT_MS = 750;

export type SavePhase = "saved" | "saving" | "unsaved";

export type SaveOrigin = "auto" | "manual" | "force";

export type NoteView = "source" | "rendered" | "split";

/** Identity of the note open in the page. `revision` rises on each edit. */
export type OpenNote = {
  id: number;
  path: string;
  revision: number;
};

export type SaveTicket = OpenNote & {
  text: string;
};

/** Prefix that tells a template save from a note save. */
export const TEMPLATE_PATH_PREFIX = "template:";

/**
 * The path that names what is open, for a note or a template. A template has
 * no note path, so it is named `template:<file>`. The open note and every save
 * ticket must use this one rule, or `shouldRunSave` refuses the save.
 */
export function openIdentityPath(
  currentPath: string,
  openTemplate: string,
): string {
  return openTemplate ? `${TEMPLATE_PATH_PREFIX}${openTemplate}` : currentPath;
}

export type EditorPlace = {
  anchor: number;
  head: number;
  scrollTop: number;
  scrollLeft: number;
};

export const EDITOR_PLACE_START: EditorPlace = {
  anchor: 0,
  head: 0,
  scrollTop: 0,
  scrollLeft: 0,
};

export function showsSource(view: NoteView): boolean {
  return view !== "rendered";
}

export function showsRendered(view: NoteView): boolean {
  return view !== "source";
}

/**
 * A save may run only for the note that is open, and an autosave must
 * not run while a disk conflict is unresolved or for a stale revision.
 * `force` is the explicit overwrite. It still cannot target another note.
 */
export function shouldRunSave(
  open: OpenNote | null,
  ticket: SaveTicket,
  conflict: boolean,
  phase: SavePhase,
  origin: SaveOrigin,
): boolean {
  if (open === null) return false;
  if (open.id !== ticket.id || open.path !== ticket.path) return false;
  if (origin === "force") return true;
  if (open.revision !== ticket.revision) return false;
  if (origin === "auto" && (conflict || phase === "saved")) return false;
  return true;
}

/** Ignore a save result that belongs to an older request or another note. */
export function shouldApplySaveResult(
  open: OpenNote | null,
  ticket: SaveTicket,
  serial: number,
  latestSerial: number,
): boolean {
  return (
    serial === latestSerial &&
    open !== null &&
    open.id === ticket.id &&
    open.path === ticket.path
  );
}

export function savedTextIsCurrent(
  open: OpenNote,
  ticket: SaveTicket,
  textNow: string,
): boolean {
  return open.revision === ticket.revision && textNow === ticket.text;
}

/** Rust refuses an overwrite with an error whose text starts with this. */
export function isExternalChange(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.startsWith("external-change");
}

export function createAutosaveTimer(waitMs: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: SaveTicket | undefined;
  let pendingRun: ((ticket: SaveTicket) => void) | undefined;

  return {
    schedule(ticket: SaveTicket, run: (ticket: SaveTicket) => void) {
      pending = ticket;
      pendingRun = run;
      if (timer !== undefined) clearTimeout(timer);
      timer = setTimeout(() => {
        const current = pending;
        const fire = pendingRun;
        pending = undefined;
        pendingRun = undefined;
        timer = undefined;
        if (current && fire) fire(current);
      }, waitMs);
    },
    cancel() {
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
      pending = undefined;
      pendingRun = undefined;
    },
  };
}
