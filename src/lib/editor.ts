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
import type { EditorPlace } from "./noteSafety";
import {
  caretMoveReplacesRanges,
  classifySpans,
  editorDiagnostics,
  flattenRanges,
  integrateSpans,
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
  undo(): void;
  redo(): void;
}

export type EditorOptions = {
  /** Decorations on. Source view passes false and keeps the same buffer. */
  rendered?: boolean;
  fonts?: EditorFonts;
};

type PageState = {
  rendered: boolean;
  fonts: EditorFonts;
  spans: Span[];
  diagnostics: PlanDiagnostic[];
  inline: DecorationSet;
  points: DecorationSet;
  lines: DecorationSet;
};

const pageConfig = Facet.define<
  { rendered: boolean; fonts: EditorFonts },
  { rendered: boolean; fonts: EditorFonts }
>({
  combine(values) {
    return (
      values[values.length - 1] ?? {
        rendered: true,
        fonts: DEFAULT_EDITOR_FONTS,
      }
    );
  },
});

const setRenderedEffect = StateEffect.define<boolean>();
const setFontsEffect = StateEffect.define<EditorFonts>();
const setDiagnosticsEffect = StateEffect.define<PlanDiagnostic[]>();

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
  ) {
    super();
  }

  eq(other: WidgetType): boolean {
    return (
      other instanceof TextChip &&
      other.text === this.text &&
      other.className === this.className &&
      other.openAt === this.openAt
    );
  }

  toDOM(): HTMLElement {
    const chip = document.createElement("span");
    if (this.className) chip.className = this.className;
    chip.appendChild(document.createTextNode(this.text));
    if (isMathClass(this.className)) {
      chip.dataset.source = String(this.openAt);
    }
    return chip;
  }

  ignoreEvent(event: Event): boolean {
    if (!isMathClass(this.className)) return false;
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
            widget: new TextChip(range.text, range.className, openAt),
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
): PageState {
  const source = doc.toString();
  const spans = classifySpans(source, 0, source.length).spans;
  const drawn = rendered
    ? decorate(source, spans, [{ from: 0, to: 0 }], [])
    : emptyDecorations;
  return {
    rendered,
    fonts,
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
  let modeChanged = false;
  let fontsChanged = false;
  let diagnosticsChanged = false;
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
    !selectionMoved
  ) {
    return value;
  }

  if (!rendered) {
    if (
      !value.rendered &&
      value.inline.size === 0 &&
      !fontsChanged &&
      !tr.docChanged &&
      !diagnosticsChanged
    ) {
      return { ...value, rendered, fonts, spans, diagnostics };
    }
    return {
      rendered,
      fonts,
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
    !selectionMoved
  ) {
    return { ...value, fonts };
  }

  const source = tr.newDoc.toString();
  return {
    rendered,
    fonts,
    spans,
    diagnostics,
    ...decorate(source, spans, selectionRanges(tr.newSelection), diagnostics),
  };
}

const pageField = StateField.define<PageState>({
  create(state) {
    const config = state.facet(pageConfig);
    return createPage(state.doc, config.rendered, config.fonts);
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

function editorExtensions(options?: EditorOptions): Extension[] {
  const rendered = options?.rendered ?? true;
  const fonts = options?.fonts ?? DEFAULT_EDITOR_FONTS;
  return [
    pageConfig.of({ rendered, fonts }),
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
    EditorView.domEventHandlers({ mousedown: onMathMouseDown }),
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
  let notifying = true;
  const view = new EditorView({
    parent,
    state: createEditorState(initial, options),
    dispatchTransactions(transactions, editorView) {
      editorView.update(transactions);
      if (
        notifying &&
        transactions.some((transaction) => transaction.docChanged)
      ) {
        onChange(editorView.state.doc.toString());
      }
    },
  });

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
    destroy: () => view.destroy(),
    getState: () => view.state,
    setState: (state) => {
      withoutNotice(() => {
        view.setState(state);
      });
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
    undo: () => {
      undoCommand(view);
    },
    redo: () => {
      redoCommand(view);
    },
  };
}
