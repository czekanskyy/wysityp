import { redo as redoCommand, undo as undoCommand } from "@codemirror/commands";
import {
  EditorSelection,
  EditorState,
  Facet,
  Prec,
  RangeSetBuilder,
  StateEffect,
  StateField,
  Transaction,
} from "@codemirror/state";
import type { Extension, TransactionSpec } from "@codemirror/state";
import { Decoration, EditorView, WidgetType, keymap } from "@codemirror/view";
import type { DecorationSet } from "@codemirror/view";
import { basicSetup } from "codemirror";
import { DEFAULT_EDITOR_FONTS, fontFamilyStack } from "./fonts";
import type { EditorFonts } from "./fonts";
import {
  codeBlockSkeleton,
  dollarEdit,
  linkSkeleton,
  mathSkeleton,
  tableSkeleton,
} from "./insert";
import {
  MATH_SIZE_PT,
  MathBatcher,
  PAGE_TEXT,
  emptyMathSnapshot,
  extractMathPreamble,
  mathCacheKey,
  sizeKey,
} from "./math";
import type {
  FormulaJob,
  FormulaPaint,
  MathFormula,
  MathSnapshot,
  MathSvg,
} from "./math";
import type { EditorPlace } from "./noteSafety";
import {
  extensionForMime,
  extensionForName,
  imageFileName,
  imageInsertion,
  imageMarkup,
  noteRelativeImagePath,
  ImageLoader,
} from "./paste";
import type { ImageBytes, ImageRecord } from "./paste";
import {
  caretMoveReplacesRanges,
  classifySpans,
  editorDiagnostics,
  flattenRanges,
  integrateSpans,
  linkAt,
  mathArrowTarget,
  planDecorations,
  structureKey,
} from "./spans";
import type {
  PlanDiagnostic,
  PointWidget,
  RawDiagnostic,
  Span,
  StructureEdit,
} from "./spans";
import type { NotePageColor } from "./ui/types";

export type { EditorFonts } from "./fonts";
export type { EditorPlace } from "./noteSafety";
export { EDITOR_PLACE_START } from "./noteSafety";
export type { RawDiagnostic } from "./spans";

export interface EditorHandle {
  getText(): string;
  getPlace(): EditorPlace;
  setText(text: string): void;
  restorePlace(place: EditorPlace): void;
  setSelection(position: number): void;
  focus(): void;
  destroy(): void;
  getState(): EditorState;
  setState(state: EditorState): void;
  setRendered(rendered: boolean): void;
  setFonts(fonts: EditorFonts): void;
  setDiagnostics(
    diagnostics: RawDiagnostic[],
    sentSource: string,
    notePath: string,
    accept: boolean,
  ): void;
  wrapSelection(before: string, after: string): void;
  toggleLinePrefix(prefix: string): void;
  insertText(text: string): void;
  insertTable(rows: number, cols: number): void;
  insertCodeBlock(lang?: string): void;
  insertMath(block: boolean): void;
  insertImageFromDialog(): void;
  insertLink(): void;
  setNotePath(path: string): void;
  setPageColor(pageColor: NotePageColor): void;
  undo(): void;
  redo(): void;
}

export type EditorServices = {
  renderMath: (
    notePath: string,
    preamble: string,
    formulas: MathFormula[],
  ) => Promise<MathSvg[]>;
  saveImage: (
    notePath: string,
    fileName: string,
    bytes: Uint8Array,
  ) => Promise<{ path: string } | { error: string }>;
  loadImage: (
    notePath: string,
    imagePath: string,
  ) => Promise<ImageBytes | { error: string }>;
  openLink: (url: string) => Promise<void>;
};

/**
 * One mutable bag for every tab. The math cache and the picture cache
 * live on the single editor, and each tab's state reads this same object.
 */
export type EditorShared = {
  notePath: string;
  pageColor: NotePageColor;
  services?: EditorServices;
  onNotice?: (message: string) => void;
};

export type EditorOptions = {
  /** Decorations on. Source view passes false and keeps the same buffer. */
  rendered?: boolean;
  fonts?: EditorFonts;
  notePath?: string;
  pageColor?: NotePageColor;
  services?: EditorServices;
  onNotice?: (message: string) => void;
  /** When set, tab switches share the cache, the path, and the services. */
  shared?: EditorShared;
};

type PageState = {
  rendered: boolean;
  fonts: EditorFonts;
  notePath: string;
  math: MathSnapshot;
  images: ReadonlyMap<string, ImageRecord>;
  spans: Span[];
  diagnostics: PlanDiagnostic[];
  inline: DecorationSet;
  points: DecorationSet;
  lines: DecorationSet;
};

const pageConfig = Facet.define<
  { rendered: boolean; fonts: EditorFonts; notePath: string },
  { rendered: boolean; fonts: EditorFonts; notePath: string }
>({
  combine(values) {
    return (
      values[values.length - 1] ?? {
        rendered: true,
        fonts: DEFAULT_EDITOR_FONTS,
        notePath: "",
      }
    );
  },
});

const setRenderedEffect = StateEffect.define<boolean>();
const setFontsEffect = StateEffect.define<EditorFonts>();
const setDiagnosticsEffect = StateEffect.define<PlanDiagnostic[]>();
const setMathEffect = StateEffect.define<MathSnapshot>();
const setImagesEffect = StateEffect.define<ReadonlyMap<string, ImageRecord>>();
const setNotePathEffect = StateEffect.define<string>();

const emptyDecorations = {
  inline: Decoration.none,
  points: Decoration.none,
  lines: Decoration.none,
};

class TextChip extends WidgetType {
  constructor(
    readonly text: string,
    readonly className: string,
    readonly openAt: number,
    readonly title = "",
    readonly box: { width: number; height: number } | null = null,
  ) {
    super();
  }

  eq(other: WidgetType): boolean {
    return (
      other instanceof TextChip &&
      other.text === this.text &&
      other.className === this.className &&
      other.openAt === this.openAt &&
      other.title === this.title &&
      other.box?.width === this.box?.width &&
      other.box?.height === this.box?.height
    );
  }

  toDOM(): HTMLElement {
    const chip = document.createElement("span");
    if (this.className) chip.className = this.className;
    chip.appendChild(document.createTextNode(this.text));
    if (isMathClass(this.className) || this.className.includes("cm-image")) {
      chip.dataset.source = String(this.openAt);
    }
    if (this.title) chip.title = this.title;
    if (this.box && this.box.width > 0 && this.box.height > 0) {
      chip.style.minWidth = `${this.box.width}px`;
      chip.style.minHeight = `${this.box.height}px`;
      chip.style.display = "inline-block";
    }
    return chip;
  }

  ignoreEvent(event: Event): boolean {
    const opens =
      isMathClass(this.className) || this.className.includes("cm-image");
    if (!opens) return false;
    return (
      event.type === "mousedown" ||
      event.type === "mouseup" ||
      event.type === "click"
    );
  }
}

function isMathClass(className: string): boolean {
  return className.split(" ").some((name) => name.startsWith("cm-math"));
}

class FormulaWidget extends WidgetType {
  constructor(
    readonly openAt: number,
    readonly block: boolean,
    readonly url: string,
    readonly widthPx: number,
    readonly heightPx: number,
    readonly baselinePx: number,
    readonly label: string,
  ) {
    super();
  }

  eq(other: WidgetType): boolean {
    return (
      other instanceof FormulaWidget &&
      other.url === this.url &&
      other.block === this.block &&
      other.openAt === this.openAt &&
      other.widthPx === this.widthPx &&
      other.heightPx === this.heightPx
    );
  }

  toDOM(): HTMLElement {
    const host = document.createElement(this.block ? "div" : "span");
    host.className = this.block
      ? "cm-math-formula cm-math-formula-block"
      : "cm-math-formula";
    host.dataset.source = String(this.openAt);
    const image = document.createElement("img");
    image.src = this.url;
    image.alt = this.label;
    image.draggable = false;
    const width = Math.max(1, this.widthPx);
    const height = Math.max(1, this.heightPx);
    image.style.width = `${width}px`;
    image.style.height = `${height}px`;
    if (!this.block) {
      image.style.verticalAlign = `${this.baselinePx - height}px`;
    }
    host.appendChild(image);
    return host;
  }

  ignoreEvent(event: Event): boolean {
    return (
      event.type === "mousedown" ||
      event.type === "mouseup" ||
      event.type === "click"
    );
  }
}

class MathPreviewWidget extends WidgetType {
  constructor(
    readonly url: string,
    readonly widthPx: number,
    readonly heightPx: number,
    readonly error: string,
    readonly pending: string,
  ) {
    super();
  }

  eq(other: WidgetType): boolean {
    return (
      other instanceof MathPreviewWidget &&
      other.url === this.url &&
      other.error === this.error &&
      other.pending === this.pending &&
      other.widthPx === this.widthPx
    );
  }

  toDOM(): HTMLElement {
    const host = document.createElement("div");
    host.className = "cm-math-preview";
    if (this.url) {
      const image = document.createElement("img");
      image.src = this.url;
      image.alt = "";
      image.draggable = false;
      image.style.width = `${Math.max(1, this.widthPx)}px`;
      image.style.height = `${Math.max(1, this.heightPx)}px`;
      host.appendChild(image);
      return host;
    }
    host.classList.add("cm-math-preview-error");
    host.appendChild(document.createTextNode(this.error || this.pending));
    return host;
  }

  ignoreEvent(): boolean {
    return true;
  }
}

class PictureWidget extends WidgetType {
  constructor(
    readonly openAt: number,
    readonly url: string,
    readonly width: number,
    readonly block: boolean,
  ) {
    super();
  }

  eq(other: WidgetType): boolean {
    return (
      other instanceof PictureWidget &&
      other.url === this.url &&
      other.openAt === this.openAt &&
      other.width === this.width
    );
  }

  toDOM(): HTMLElement {
    const host = document.createElement(this.block ? "div" : "span");
    host.className = "cm-image-frame";
    host.dataset.source = String(this.openAt);
    const image = document.createElement("img");
    image.src = this.url;
    image.alt = "";
    image.draggable = false;
    if (this.width > 0) image.style.width = `${Math.min(this.width, 720)}px`;
    image.style.maxWidth = "100%";
    image.style.height = "auto";
    host.appendChild(image);
    return host;
  }

  ignoreEvent(event: Event): boolean {
    return (
      event.type === "mousedown" ||
      event.type === "mouseup" ||
      event.type === "click"
    );
  }
}

function formulaPaint(
  source: string,
  block: boolean,
  math: MathSnapshot,
): FormulaPaint | undefined {
  return math.paints.get(
    mathCacheKey(
      { source, block, color: math.color, sizePt: math.sizePt },
      math.preamble,
    ),
  );
}

function widgetForRange(
  range: { text: string; className: string },
  openAt: number,
  math: MathSnapshot,
  images: ReadonlyMap<string, ImageRecord>,
  notePath: string,
): WidgetType {
  if (isMathClass(range.className)) {
    const block = range.className.includes("cm-math-block");
    const paint = formulaPaint(range.text, block, math);
    const reserved = math.sizes.get(sizeKey(range.text, block));
    if (paint?.url && !paint.error) {
      return new FormulaWidget(
        openAt,
        block,
        paint.url,
        paint.widthPx,
        paint.heightPx,
        paint.baselinePx,
        range.text,
      );
    }
    return new TextChip(
      range.text,
      range.className,
      openAt,
      paint?.error ?? "",
      reserved ? { width: reserved.widthPx, height: reserved.heightPx } : null,
    );
  }
  if (range.className.includes("cm-image")) {
    const record = images.get(`${notePath}\0${range.text}`);
    const block = range.className.includes("cm-image-block");
    if (record?.url && !record.error) {
      return new PictureWidget(openAt, record.url, record.width, block);
    }
    return new TextChip(
      range.text,
      range.className,
      openAt,
      record?.error ?? "",
    );
  }
  return new TextChip(range.text, range.className, openAt);
}

function addMathPreview(
  points: RangeSetBuilder<Decoration>,
  source: string,
  spans: Span[],
  selection: { from: number; to: number }[],
  math: MathSnapshot,
): void {
  if (selection.length !== 1) return;
  const caret = selection[0];
  if (!caret || caret.from !== caret.to) return;
  const pos = caret.from;
  const span = spans.find(
    (item) =>
      item.kind === "math" && item.closed && pos > item.from && pos < item.to,
  );
  if (!span) return;
  const inner = source.slice(span.from + 1, span.to - 1);
  if (!inner) return;
  const paint = formulaPaint(inner, span.block, math);
  const newline = source.indexOf("\n", pos);
  const lineEnd = newline === -1 ? source.length : newline;
  const ready = Boolean(paint?.url && !paint.error);
  points.add(
    lineEnd,
    lineEnd,
    Decoration.widget({
      widget: new MathPreviewWidget(
        ready ? (paint?.url ?? "") : "",
        paint?.widthPx ?? 0,
        paint?.heightPx ?? 0,
        paint?.error ?? "",
        "…",
      ),
      side: 1,
      block: true,
    }),
  );
}

function mergePoints(points: PointWidget[]): PointWidget[] {
  const sorted = [...points].sort((a, b) => a.at - b.at || a.side - b.side);
  const merged: PointWidget[] = [];
  for (const point of sorted) {
    const last = merged[merged.length - 1];
    if (last && last.at === point.at && last.side === point.side) {
      last.text = `${last.text}\n${point.text}`;
      if (
        point.className &&
        !last.className.split(" ").includes(point.className)
      ) {
        last.className = `${last.className} ${point.className}`.trim();
      }
      continue;
    }
    merged.push({ ...point });
  }
  return merged;
}

function decorate(
  source: string,
  spans: Span[],
  selection: { from: number; to: number }[],
  diagnostics: PlanDiagnostic[],
  math: MathSnapshot,
  images: ReadonlyMap<string, ImageRecord>,
  notePath: string,
) {
  const plan = planDecorations(source, spans, selection, diagnostics);
  const inline = new RangeSetBuilder<Decoration>();
  for (const range of flattenRanges(plan)) {
    if (range.from >= range.to) continue;
    if (range.kind === "replace") {
      if (range.text.length > 0) {
        const openAt = isMathClass(range.className)
          ? range.from + 1
          : range.from;
        inline.add(
          range.from,
          range.to,
          Decoration.replace({
            widget: widgetForRange(range, openAt, math, images, notePath),
          }),
        );
      } else {
        inline.add(range.from, range.to, Decoration.replace({}));
      }
      continue;
    }
    if (!range.className) continue;
    inline.add(
      range.from,
      range.to,
      Decoration.mark({ class: range.className }),
    );
  }

  const points = new RangeSetBuilder<Decoration>();
  for (const point of mergePoints(plan.points)) {
    if (!point.text) continue;
    points.add(
      point.at,
      point.at,
      Decoration.widget({
        widget: new TextChip(point.text, point.className, point.at),
        side: point.side,
      }),
    );
  }

  addMathPreview(points, source, spans, selection, math);

  const lines = new RangeSetBuilder<Decoration>();
  for (const line of plan.lines) {
    if (!line.className) continue;
    lines.add(line.at, line.at, Decoration.line({ class: line.className }));
  }

  return {
    inline: inline.finish(),
    points: points.finish(),
    lines: lines.finish(),
  };
}

function selectionRanges(
  selection: EditorSelection,
): { from: number; to: number }[] {
  return selection.ranges.map((range) => ({ from: range.from, to: range.to }));
}

function createPage(
  doc: { toString(): string; length: number },
  rendered: boolean,
  fonts: EditorFonts,
  notePath: string,
): PageState {
  const source = doc.toString();
  const spans = classifySpans(source, 0, source.length).spans;
  const math = emptyMathSnapshot(PAGE_TEXT.white, MATH_SIZE_PT);
  const images = new Map<string, ImageRecord>();
  const drawn = rendered
    ? decorate(source, spans, [{ from: 0, to: 0 }], [], math, images, notePath)
    : emptyDecorations;
  return {
    rendered,
    fonts,
    notePath,
    math,
    images,
    spans,
    diagnostics: [],
    ...drawn,
  };
}

function changedRange(tr: Transaction): { from: number; to: number } {
  let from = tr.newDoc.length;
  let to = 0;
  let saw = false;
  tr.changes.iterChanges((_fromA, _toA, fromB, toB) => {
    saw = true;
    from = Math.min(from, fromB);
    to = Math.max(to, toB);
  });
  if (!saw) return { from: 0, to: tr.newDoc.length };
  return { from, to };
}

function updatePage(value: PageState, tr: Transaction): PageState {
  let rendered = value.rendered;
  let fonts = value.fonts;
  let diagnostics = value.diagnostics;
  let math = value.math;
  let images = value.images;
  let notePath = value.notePath;
  let modeChanged = false;
  let fontsChanged = false;
  let diagnosticsChanged = false;
  let paintChanged = false;
  for (const effect of tr.effects) {
    if (effect.is(setRenderedEffect)) {
      rendered = effect.value;
      modeChanged = true;
    } else if (effect.is(setFontsEffect)) {
      fonts = effect.value;
      fontsChanged = true;
    } else if (effect.is(setDiagnosticsEffect)) {
      diagnostics = effect.value;
      diagnosticsChanged = true;
    } else if (effect.is(setMathEffect)) {
      math = effect.value;
      paintChanged = true;
    } else if (effect.is(setImagesEffect)) {
      images = effect.value;
      paintChanged = true;
    } else if (effect.is(setNotePathEffect)) {
      notePath = effect.value;
      paintChanged = true;
    }
  }

  let spans = value.spans;
  if (tr.docChanged) {
    const source = tr.newDoc.toString();
    const change = changedRange(tr);
    spans = integrateSpans(
      spans,
      source,
      change.from,
      change.to,
      (pos, assoc) => tr.changes.mapPos(pos, assoc),
    ).spans;
    diagnostics = [];
    diagnosticsChanged = true;
  }

  const selectionMoved = !tr.newSelection.eq(tr.startState.selection);
  if (
    !tr.docChanged &&
    !diagnosticsChanged &&
    !modeChanged &&
    !fontsChanged &&
    !selectionMoved &&
    !paintChanged
  ) {
    return value;
  }

  if (!rendered) {
    if (
      !value.rendered &&
      value.inline.size === 0 &&
      !fontsChanged &&
      !tr.docChanged &&
      !diagnosticsChanged &&
      !paintChanged
    ) {
      return {
        ...value,
        rendered,
        fonts,
        notePath,
        math,
        images,
        spans,
        diagnostics,
      };
    }
    return {
      ...value,
      rendered,
      fonts,
      notePath,
      math,
      images,
      spans,
      diagnostics,
      ...emptyDecorations,
    };
  }

  if (
    !tr.docChanged &&
    !diagnosticsChanged &&
    !modeChanged &&
    !fontsChanged &&
    !paintChanged &&
    selectionMoved &&
    caretMoveReplacesRanges(
      tr.newDoc.toString(),
      spans,
      selectionRanges(tr.startState.selection),
      selectionRanges(tr.newSelection),
      diagnostics,
    ) === 0
  ) {
    return value;
  }

  if (
    fontsChanged &&
    !tr.docChanged &&
    !diagnosticsChanged &&
    !modeChanged &&
    !selectionMoved &&
    !paintChanged
  ) {
    return { ...value, fonts };
  }

  const source = tr.newDoc.toString();
  return {
    ...value,
    rendered,
    fonts,
    notePath,
    math,
    images,
    spans,
    diagnostics,
    ...decorate(
      source,
      spans,
      selectionRanges(tr.newSelection),
      diagnostics,
      math,
      images,
      notePath,
    ),
  };
}

const pageField = StateField.define<PageState>({
  create(state) {
    const config = state.facet(pageConfig);
    return createPage(
      state.doc,
      config.rendered,
      config.fonts,
      config.notePath,
    );
  },
  update: updatePage,
});

function mathSelection(
  tr: Transaction,
): TransactionSpec | readonly TransactionSpec[] {
  const page = tr.startState.field(pageField, false);
  if (!page?.rendered || tr.docChanged || tr.newSelection.ranges.length !== 1) {
    return tr;
  }
  if (tr.startState.selection.ranges.length !== 1) return tr;
  const next = tr.newSelection.main;
  const target = mathArrowTarget(
    tr.startState.doc.toString(),
    page.spans,
    page.diagnostics,
    tr.startState.selection.main.head,
    next.head,
  );
  if (target === null || target === next.head) return tr;
  const caret = next.anchor === next.head;
  return {
    changes: tr.changes,
    effects: tr.effects,
    selection: caret
      ? { anchor: target }
      : { anchor: next.anchor, head: target },
    scrollIntoView: tr.scrollIntoView,
    userEvent: tr.annotation(Transaction.userEvent),
    filter: false,
  };
}

function onMathMouseDown(event: MouseEvent, view: EditorView): boolean {
  const node = event.target;
  if (!(node instanceof Node)) return false;
  const element = node instanceof Element ? node : node.parentElement;
  const chip = element?.closest<HTMLElement>("[data-source]");
  if (!chip || !view.dom.contains(chip)) return false;
  const parsed = Number(chip.dataset.source);
  if (!Number.isInteger(parsed)) return false;
  event.preventDefault();
  const pos = Math.max(0, Math.min(parsed, view.state.doc.length));
  view.dispatch({ selection: { anchor: pos } });
  view.focus();
  return true;
}

export type StructureResult = {
  consume: boolean;
  edit: StructureEdit | null;
};

/** Enter, Backspace, and Tab against the spans stored on this state. */
export function structureResult(
  state: EditorState,
  key: "Enter" | "Backspace" | "Tab",
  shift: boolean,
  composing: boolean,
): StructureResult {
  if (composing) return { consume: false, edit: null };
  const page = state.field(pageField, false);
  if (!page) return { consume: key === "Tab", edit: null };
  if (state.selection.ranges.length !== 1) {
    return { consume: key === "Tab", edit: null };
  }
  const range = state.selection.main;
  const edit = structureKey(
    state.doc.toString(),
    range.from,
    range.to,
    page.spans,
    key,
    shift,
    false,
  );
  if (key === "Tab") return { consume: true, edit };
  return { consume: edit !== null, edit };
}

function runStructure(key: "Enter" | "Backspace" | "Tab", shift: boolean) {
  return (view: EditorView): boolean => {
    const result = structureResult(view.state, key, shift, view.composing);
    if (!result.consume || !result.edit) return result.consume;
    const edit = result.edit;
    view.dispatch({
      changes: { from: edit.from, to: edit.to, insert: edit.insert },
      selection: { anchor: edit.selection },
    });
    return true;
  };
}

type LiveEditor = EditorShared;

function liveFrom(options?: EditorOptions): LiveEditor {
  if (options?.shared) {
    if (options.notePath !== undefined)
      options.shared.notePath = options.notePath;
    if (options.pageColor !== undefined) {
      options.shared.pageColor = options.pageColor;
    }
    if (options.services) options.shared.services = options.services;
    if (options.onNotice) options.shared.onNotice = options.onNotice;
    return options.shared;
  }
  return {
    notePath: options?.notePath ?? "",
    pageColor: options?.pageColor ?? "white",
    services: options?.services,
    onNotice: options?.onNotice,
  };
}

function fileFromTransfer(data: DataTransfer | null): File | null {
  if (!data) return null;
  for (const file of Array.from(data.files)) {
    if (extensionForMime(file.type) || extensionForName(file.name)) return file;
  }
  for (const item of Array.from(data.items)) {
    if (item.kind !== "file" || !extensionForMime(item.type)) continue;
    const file = item.getAsFile();
    if (file) return file;
  }
  return null;
}

async function insertImageFile(
  view: EditorView,
  file: File,
  from: number,
  to: number,
  live: LiveEditor,
): Promise<void> {
  const services = live.services;
  if (!services) return;
  try {
    const name = imageFileName(file.type, file.name);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const saved = await services.saveImage(live.notePath, name, bytes);
    if ("error" in saved) {
      live.onNotice?.(saved.error);
      return;
    }
    if (!view.dom.isConnected) return;
    const relative = noteRelativeImagePath(live.notePath, saved.path);
    const edit = imageInsertion(
      view.state.doc.toString(),
      from,
      to,
      imageMarkup(relative),
    );
    view.dispatch({
      changes: { from, to, insert: edit.text },
      selection: { anchor: edit.cursor },
    });
  } catch (error) {
    live.onNotice?.(error instanceof Error ? error.message : String(error));
  }
}

function editorExtensions(
  options?: EditorOptions,
  live: LiveEditor = liveFrom(options),
): Extension[] {
  const rendered = options?.rendered ?? true;
  const fonts = options?.fonts ?? DEFAULT_EDITOR_FONTS;
  return [
    pageConfig.of({
      rendered,
      fonts,
      notePath: options?.notePath ?? live.notePath,
    }),
    basicSetup,
    EditorView.lineWrapping,
    pageField,
    EditorView.decorations.compute(
      [pageField],
      (state) => state.field(pageField).inline,
    ),
    EditorView.decorations.compute(
      [pageField],
      (state) => state.field(pageField).points,
    ),
    EditorView.decorations.compute(
      [pageField],
      (state) => state.field(pageField).lines,
    ),
    EditorView.editorAttributes.compute([pageField], (state) => {
      const page = state.field(pageField);
      return {
        class: page.rendered ? "cm-rendered" : "",
        style: `--editor-source-font: ${fontFamilyStack("source", page.fonts.source)}; --editor-render-font: ${fontFamilyStack("render", page.fonts.render)}`,
      };
    }),
    EditorState.transactionFilter.of(mathSelection),
    Prec.highest(
      keymap.of([
        { key: "Enter", run: runStructure("Enter", false) },
        { key: "Backspace", run: runStructure("Backspace", false) },
        { key: "Tab", run: runStructure("Tab", false) },
        { key: "Shift-Tab", run: runStructure("Tab", true) },
      ]),
    ),
    EditorView.inputHandler.of((view, from, to, text) => {
      if (text !== "$" || view.composing) return false;
      if (view.state.selection.ranges.length !== 1) return false;
      const page = view.state.field(pageField, false);
      const edit = dollarEdit(
        view.state.doc.toString(),
        from,
        to,
        page?.spans ?? [],
      );
      if (!edit) return false;
      view.dispatch({
        changes: { from: edit.from, to: edit.to, insert: edit.insert },
        selection: { anchor: edit.selection },
        userEvent: "input.type",
      });
      return true;
    }),
    EditorView.domEventHandlers({
      mousedown(event, view) {
        if (
          (event.ctrlKey || event.metaKey) &&
          !event.altKey &&
          live.services
        ) {
          const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
          if (pos !== null) {
            const page = view.state.field(pageField, false);
            const url = page
              ? linkAt(view.state.doc.toString(), page.spans, pos)
              : null;
            if (url) {
              event.preventDefault();
              void live.services.openLink(url).catch((error: unknown) => {
                const message =
                  error instanceof Error ? error.message : String(error);
                live.onNotice?.(message);
              });
              return true;
            }
          }
        }
        return onMathMouseDown(event, view);
      },
      paste(event, view) {
        const file = fileFromTransfer(event.clipboardData);
        if (!file || !live.services) return false;
        event.preventDefault();
        const range = view.state.selection.main;
        void insertImageFile(view, file, range.from, range.to, live);
        return true;
      },
      dragover(event) {
        if (!live.services?.saveImage || !event.dataTransfer) return false;
        if (!Array.from(event.dataTransfer.types).includes("Files"))
          return false;
        event.preventDefault();
        return true;
      },
      drop(event, view) {
        const file = fileFromTransfer(event.dataTransfer);
        if (!file || !live.services) return false;
        event.preventDefault();
        const coords = view.posAtCoords({
          x: event.clientX,
          y: event.clientY,
        });
        const pos = coords ?? view.state.selection.main.from;
        void insertImageFile(view, file, pos, pos, live);
        return true;
      },
    }),
    EditorView.theme({
      "&": { height: "100%" },
      "&.cm-focused": { outline: "none" },
    }),
  ];
}

export function createEditorState(
  doc: string,
  options?: EditorOptions,
): EditorState {
  return EditorState.create({
    doc,
    extensions: editorExtensions(options),
  });
}

export function editorSnapshot(state: EditorState): {
  rendered: boolean;
  inline: number;
  diagnostics: number;
  head: number;
} {
  const page = state.field(pageField);
  return {
    rendered: page.rendered,
    inline: page.inline.size,
    diagnostics: page.diagnostics.length,
    head: state.selection.main.head,
  };
}

export function applyEditorDiagnostics(
  state: EditorState,
  diagnostics: RawDiagnostic[],
  sentSource: string,
  notePath: string,
  accept: boolean,
): EditorState {
  const applied = editorDiagnostics(
    diagnostics,
    sentSource,
    state.doc.toString(),
    notePath,
    accept,
  );
  return state.update({ effects: setDiagnosticsEffect.of(applied) }).state;
}

export function createEditor(
  parent: HTMLElement,
  initial: string,
  onChange: (text: string) => void,
  options?: EditorOptions,
): EditorHandle {
  const live = liveFrom(options);
  let notifying = true;
  let applyingPaint = false;
  const blobUrls = new Map<string, string>();

  const batcher = new MathBatcher(
    (path, preamble, formulas) => {
      if (!live.services) {
        return Promise.resolve(
          formulas.map((formula) => ({
            id: formula.id,
            svg: "",
            width_px: 0,
            height_px: 0,
            baseline_px: 0,
            error: "",
          })),
        );
      }
      return live.services.renderMath(path, preamble, formulas);
    },
    () => publishMath(),
  );

  function measureImage(
    url: string,
  ): Promise<{ width: number; height: number }> {
    return new Promise((resolve) => {
      const image = new Image();
      image.onload = () =>
        resolve({ width: image.naturalWidth, height: image.naturalHeight });
      image.onerror = () => resolve({ width: 0, height: 0 });
      image.src = url;
    });
  }

  const imageLoader = new ImageLoader(
    (path, imagePath) => {
      if (!live.services) return Promise.resolve({ error: "" });
      return live.services.loadImage(path, imagePath);
    },
    async (loaded) => {
      const copy = new Uint8Array(loaded.bytes.byteLength);
      copy.set(loaded.bytes);
      const blob = new Blob([copy.buffer], {
        type: loaded.mime || "application/octet-stream",
      });
      const url = URL.createObjectURL(blob);
      const size = await measureImage(url);
      return { url, width: size.width, height: size.height, error: "" };
    },
    () => publishImages(),
  );

  function paintsFrom(snap: MathSnapshot): Map<string, FormulaPaint> {
    const paints = new Map<string, FormulaPaint>();
    for (const [key, paint] of snap.paints) {
      let url = "";
      if (paint.svg) {
        url = blobUrls.get(key) ?? "";
        if (!url) {
          url = URL.createObjectURL(
            new Blob([paint.svg], { type: "image/svg+xml" }),
          );
          blobUrls.set(key, url);
        }
      }
      paints.set(key, { ...paint, url });
    }
    return paints;
  }

  function publishMath() {
    if (applyingPaint) return;
    const snap = batcher.snapshot();
    applyingPaint = true;
    try {
      view.dispatch({
        effects: setMathEffect.of({ ...snap, paints: paintsFrom(snap) }),
      });
    } finally {
      applyingPaint = false;
    }
  }

  function publishImages() {
    if (applyingPaint) return;
    applyingPaint = true;
    try {
      view.dispatch({ effects: setImagesEffect.of(imageLoader.snapshot()) });
    } finally {
      applyingPaint = false;
    }
  }

  function collectMath(state: EditorState) {
    if (!live.services || applyingPaint) return;
    const page = state.field(pageField, false);
    if (!page?.rendered) return;
    const source = state.doc.toString();
    const selection = selectionRanges(state.selection);
    const preamble = extractMathPreamble(source);
    const color = PAGE_TEXT[live.pageColor];
    const jobs: FormulaJob[] = [];
    const seen = new Set<string>();
    for (const span of page.spans) {
      if (span.kind === "image" && span.closed && span.marker) {
        const touched = selection.some(
          (range) => range.from < span.to && range.to > span.from,
        );
        if (!touched) imageLoader.want(live.notePath, span.marker);
        continue;
      }
      if (span.kind !== "math" || !span.closed) continue;
      const inner = source.slice(
        span.from + 1,
        Math.max(span.from + 1, span.to - 1),
      );
      if (!inner) continue;
      const caretInside = selection.some(
        (range) =>
          range.from === range.to &&
          range.from > span.from &&
          range.from < span.to,
      );
      const touched = selection.some(
        (range) => range.from < span.to && range.to > span.from,
      );
      if (touched && !caretInside) continue;
      const job: FormulaJob = {
        source: inner,
        block: span.block,
        color,
        sizePt: MATH_SIZE_PT,
      };
      const key = `${job.block}\0${job.source}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (caretInside) jobs.unshift(job);
      else jobs.push(job);
    }
    batcher.schedule(jobs, preamble, color, MATH_SIZE_PT, live.notePath);
  }

  const view = new EditorView({
    parent,
    state: EditorState.create({
      doc: initial,
      extensions: editorExtensions(options, live),
    }),
    dispatchTransactions(transactions, editorView) {
      editorView.update(transactions);
      if (
        notifying &&
        transactions.some((transaction) => transaction.docChanged)
      ) {
        onChange(editorView.state.doc.toString());
      }
      if (!applyingPaint) collectMath(editorView.state);
    },
  });
  collectMath(view.state);

  function clamp(position: number): number {
    return Math.max(0, Math.min(position, view.state.doc.length));
  }

  function withoutNotice(run: () => void) {
    notifying = false;
    try {
      run();
    } finally {
      notifying = true;
    }
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
    setText: (text) => {
      withoutNotice(() => {
        view.dispatch({
          changes: { from: 0, to: view.state.doc.length, insert: text },
          selection: { anchor: 0 },
        });
      });
    },
    restorePlace: (place) => {
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
    setSelection: (position) => {
      const clamped = clamp(position);
      view.dispatch({
        selection: { anchor: clamped },
        effects: EditorView.scrollIntoView(clamped, { y: "nearest" }),
      });
    },
    focus: () => view.focus(),
    destroy: () => {
      for (const url of blobUrls.values()) URL.revokeObjectURL(url);
      blobUrls.clear();
      for (const record of imageLoader.snapshot().values()) {
        if (record.url) URL.revokeObjectURL(record.url);
      }
      imageLoader.clear();
      view.destroy();
    },
    getState: () => view.state,
    setState: (state) => {
      const snap = batcher.snapshot();
      const next = state.field(pageField, false)
        ? state.update({
            effects: [
              setMathEffect.of({ ...snap, paints: paintsFrom(snap) }),
              setImagesEffect.of(imageLoader.snapshot()),
              setNotePathEffect.of(live.notePath),
            ],
          }).state
        : state;
      withoutNotice(() => {
        view.setState(next);
      });
      collectMath(view.state);
    },
    setRendered: (rendered) => {
      view.dispatch({ effects: setRenderedEffect.of(rendered) });
    },
    setFonts: (fonts) => {
      view.dispatch({ effects: setFontsEffect.of(fonts) });
    },
    setDiagnostics: (diagnostics, sentSource, notePath, accept) => {
      const applied = editorDiagnostics(
        diagnostics,
        sentSource,
        view.state.doc.toString(),
        notePath,
        accept,
      );
      view.dispatch({ effects: setDiagnosticsEffect.of(applied) });
    },
    wrapSelection: (before, after) => {
      view.dispatch(
        view.state.changeByRange((range) => {
          const selected = view.state.sliceDoc(range.from, range.to);
          return {
            changes: {
              from: range.from,
              to: range.to,
              insert: before + selected + after,
            },
            range: EditorSelection.range(
              range.from + before.length,
              range.to + before.length,
            ),
          };
        }),
      );
    },
    toggleLinePrefix: (prefix) => {
      if (!prefix) return;
      const doc = view.state.doc;
      const numbers = new Set<number>();
      for (const range of view.state.selection.ranges) {
        const start = doc.lineAt(range.from).number;
        const endLine = doc.lineAt(range.to);
        const end =
          range.to === endLine.from && range.to > range.from
            ? endLine.number - 1
            : endLine.number;
        for (let number = start; number <= Math.max(start, end); number += 1) {
          numbers.add(number);
        }
      }
      const lines = [...numbers].sort((a, b) => a - b);
      const remove = lines.every((number) =>
        doc.line(number).text.startsWith(prefix),
      );
      view.dispatch({
        changes: lines.map((number) => {
          const line = doc.line(number);
          if (remove) {
            return {
              from: line.from,
              to: line.from + prefix.length,
              insert: "",
            };
          }
          return { from: line.from, to: line.from, insert: prefix };
        }),
      });
    },
    insertText: (text) => {
      view.dispatch(
        view.state.changeByRange((range) => ({
          changes: { from: range.from, to: range.to, insert: text },
          range: EditorSelection.cursor(range.from + text.length),
        })),
      );
    },
    insertTable: (rows, cols) => {
      const range = view.state.selection.main;
      const text = tableSkeleton(rows, cols);
      view.dispatch({
        changes: { from: range.from, to: range.to, insert: text },
        selection: { anchor: range.from + text.length },
      });
    },
    insertCodeBlock: (lang) => {
      const range = view.state.selection.main;
      const skeleton = codeBlockSkeleton(lang);
      view.dispatch({
        changes: { from: range.from, to: range.to, insert: skeleton.text },
        selection: { anchor: range.from + skeleton.cursor },
      });
    },
    insertMath: (block) => {
      const range = view.state.selection.main;
      const selected = view.state.sliceDoc(range.from, range.to);
      const skeleton = mathSkeleton(block, selected);
      view.dispatch({
        changes: { from: range.from, to: range.to, insert: skeleton.text },
        selection: { anchor: range.from + skeleton.cursor },
      });
    },
    insertImageFromDialog: () => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/png,image/jpeg,image/gif,image/webp";
      input.onchange = () => {
        const file = input.files?.[0];
        if (!file) return;
        const range = view.state.selection.main;
        void insertImageFile(view, file, range.from, range.to, live);
      };
      input.click();
    },
    insertLink: () => {
      const range = view.state.selection.main;
      const selected = view.state.sliceDoc(range.from, range.to);
      const skeleton = linkSkeleton(selected);
      view.dispatch({
        changes: { from: range.from, to: range.to, insert: skeleton.text },
        selection: {
          anchor: range.from + skeleton.selectFrom,
          head: range.from + skeleton.selectTo,
        },
      });
    },
    setNotePath: (path) => {
      live.notePath = path;
      if (!view.state.field(pageField, false)) return;
      view.dispatch({ effects: setNotePathEffect.of(path) });
      collectMath(view.state);
    },
    setPageColor: (pageColor) => {
      live.pageColor = pageColor;
      collectMath(view.state);
    },
    undo: () => {
      undoCommand(view);
    },
    redo: () => {
      redoCommand(view);
    },
  };
}
