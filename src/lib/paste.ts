const IMAGE_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
};

export function extensionForMime(type: string): string | null {
  return IMAGE_TYPES[type.toLowerCase()] ?? null;
}

export function extensionForName(name: string): string | null {
  const base = name.split(/[/\\]/u).pop() ?? "";
  const dot = base.lastIndexOf(".");
  if (dot <= 0) return null;
  const ext = base.slice(dot + 1).toLowerCase();
  if (
    ext === "png" ||
    ext === "jpg" ||
    ext === "jpeg" ||
    ext === "gif" ||
    ext === "webp"
  ) {
    return ext === "jpeg" ? "jpg" : ext;
  }
  return null;
}

/** A file name Rust will accept. Empty clipboard names become `image.png`. */
export function imageFileName(type: string, name: string): string {
  const ext = extensionForMime(type) ?? extensionForName(name) ?? "png";
  const base = (name.split(/[/\\]/u).pop() ?? "").replace(/["']/g, "").trim();
  if (
    base &&
    extensionForName(base) &&
    !base.endsWith(".") &&
    !base.endsWith(" ")
  ) {
    return base;
  }
  return `image.${ext}`;
}

/** Path counted from the note file, which is what `#image` resolves. */
export function noteRelativeImagePath(
  notePath: string,
  savedPath: string,
): string {
  const note = notePath.replaceAll("\\", "/");
  const saved = savedPath.replaceAll("\\", "/");
  const slash = note.lastIndexOf("/");
  const dir = slash === -1 ? "" : note.slice(0, slash + 1);
  if (dir && saved.startsWith(dir)) return saved.slice(dir.length);
  return saved;
}

/** The data model stores the file beside the note. The note only gains this call. */
export function imageMarkup(relativePath: string): string {
  const safe = relativePath.replaceAll("\\", "/").replaceAll('"', "");
  return `#image("${safe}")`;
}

export function imageInsertion(
  source: string,
  from: number,
  to: number,
  markup: string,
): { text: string; cursor: number } {
  const atLineStart = from === 0 || source[from - 1] === "\n";
  const atLineEnd = to >= source.length || source[to] === "\n";
  let text = markup;
  if (!atLineStart) text = `\n${text}`;
  if (!atLineEnd) text = `${text}\n`;
  return { text, cursor: from + text.length };
}

export type ImageRecord =
  | { url: string; width: number; height: number; error: "" }
  | { url: ""; width: number; height: number; error: string };

export type ImageBytes = { bytes: Uint8Array; mime: string };

/**
 * One load per picture path. A later want for the same path does not fetch again.
 */
export class ImageLoader {
  private readonly records = new Map<string, ImageRecord>();
  private readonly inflight = new Set<string>();

  constructor(
    private readonly load: (
      notePath: string,
      imagePath: string,
    ) => Promise<ImageBytes | { error: string }>,
    private readonly toRecord: (bytes: ImageBytes) => Promise<ImageRecord>,
    private readonly onUpdate: () => void,
  ) {}

  snapshot(): ReadonlyMap<string, ImageRecord> {
    return this.records;
  }

  clear(): void {
    this.records.clear();
    this.inflight.clear();
  }

  want(notePath: string, imagePath: string): void {
    if (!notePath || !imagePath) return;
    const key = `${notePath}\0${imagePath}`;
    if (this.records.has(key) || this.inflight.has(key)) return;
    this.inflight.add(key);
    void this.fetch(key, notePath, imagePath);
  }

  private async fetch(
    key: string,
    notePath: string,
    imagePath: string,
  ): Promise<void> {
    try {
      const loaded = await this.load(notePath, imagePath);
      if ("error" in loaded) {
        this.records.set(key, {
          url: "",
          width: 0,
          height: 0,
          error: loaded.error,
        });
      } else {
        this.records.set(key, await this.toRecord(loaded));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.records.set(key, { url: "", width: 0, height: 0, error: message });
    } finally {
      this.inflight.delete(key);
    }
    this.onUpdate();
  }
}
