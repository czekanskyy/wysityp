import { api } from "./api";
import type { EditorServices } from "./editor";
import type { MathSvg } from "./math";
import { m } from "../paraglide/messages.js";

function textOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** The page asks Rust for math, pictures, and links. It never touches disk. */
export function createAppEditorServices(): EditorServices {
  return {
    async renderMath(notePath, preamble, formulas) {
      const paints = await api.renderMath(notePath, preamble, formulas);
      return paints.map((paint): MathSvg => ({
        id: paint.id,
        svg: paint.svg,
        width_px: paint.width_px ?? 0,
        height_px: paint.height_px ?? 0,
        baseline_px: paint.baseline_px ?? 0,
        error: paint.error,
      }));
    },
    async saveImage(notePath, fileName, bytes) {
      if (!notePath.trim()) return { error: m.image_needs_note() };
      try {
        const path = await api.saveNoteImage(notePath, fileName, [...bytes]);
        return { path };
      } catch (error) {
        if (textOf(error) === "no folder is open") {
          return { error: m.image_needs_note() };
        }
        return { error: m.image_refused() };
      }
    },
    async loadImage(notePath, imagePath) {
      try {
        const loaded = await api.readNoteImage(notePath, imagePath);
        return { bytes: Uint8Array.from(loaded.bytes), mime: loaded.mime };
      } catch {
        return { error: m.image_refused() };
      }
    },
    async openLink(url) {
      try {
        await api.openLink(url);
      } catch (error) {
        if (textOf(error).startsWith("link-refused")) {
          throw new Error(m.link_refused(), { cause: error });
        }
        if (error instanceof Error) throw error;
        throw new Error(textOf(error), { cause: error });
      }
    },
  };
}
