const encoder = new TextEncoder();
const decoder = new TextDecoder();

/**
 * Typst counts places in a source in UTF 8 bytes. CodeMirror counts in
 * UTF 16 units. This turns a byte place into an editor place in the
 * exact source that was compiled.
 */
export function byteOffsetToUtf16(source: string, byteOffset: number): number {
  const bytes = encoder.encode(source);
  const clamped = Math.max(0, Math.min(byteOffset, bytes.length));
  return decoder.decode(bytes.slice(0, clamped)).length;
}

/** Tracks which render request is the newest one. */
export class RenderGuard {
  #latest = 0;

  next(): number {
    this.#latest += 1;
    return this.#latest;
  }

  isCurrent(revision: number): boolean {
    return revision === this.#latest;
  }

  get latest(): number {
    return this.#latest;
  }
}

/** True when two compiled page lists are the same SVG text. */
export function svgPagesEqual(
  previous: readonly string[],
  next: readonly string[],
): boolean {
  if (previous.length !== next.length) return false;
  return previous.every((page, index) => page === next[index]);
}

export function svgBlobUrl(svg: string): string {
  return URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
}

/** Resolve once the browser has decoded the image, or if it cannot. */
export function preloadImage(url: string): Promise<void> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve();
    image.onerror = () => resolve();
    image.src = url;
  });
}

export function debounce<A extends unknown[]>(
  fn: (...args: A) => void,
  waitMs: number,
): (...args: A) => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return (...args: A) => {
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), waitMs);
  };
}
