import { byteOffsetToUtf16 } from "./render";

export type SpanKind =
  | "body"
  | "heading"
  | "bullet"
  | "enum"
  | "term"
  | "quote"
  | "math"
  | "emphasis"
  | "strong";

/** A derived range in the editor buffer. Offsets are UTF-16 code units. */
export type Span = {
  from: number;
  to: number;
  kind: SpanKind;
  level: number | null;
  marker: string;
  closed: boolean;
  block: boolean;
};

export type ClassifyResult = {
  spans: Span[];
  windowFrom: number;
  windowTo: number;
  /** Code units the scanner read. An ordinary letter reads the dirty window only. */
  charsRead: number;
};

export type TextRange = {
  from: number;
  to: number;
};

export type PlanDiagnostic = {
  from: number;
  to: number;
  severity: string;
  message: string;
  hints: string[];
};

export type RawDiagnostic = {
  file: string;
  start: number;
  end: number;
  severity: string;
  message: string;
  hints: string[];
};

export type StyleRange = {
  from: number;
  to: number;
  className: string;
};

export type ReplaceRange = {
  from: number;
  to: number;
  /** Empty hides the source. Otherwise the widget shows this text. */
  text: string;
  className: string;
};

export type PointWidget = {
  at: number;
  side: number;
  text: string;
  className: string;
};

export type LineStyle = {
  at: number;
  className: string;
};

export type DecorationPlan = {
  styles: StyleRange[];
  replaces: ReplaceRange[];
  points: PointWidget[];
  lines: LineStyle[];
};

export type StructureEdit = {
  from: number;
  to: number;
  insert: string;
  selection: number;
};

const TALL_CHANGE_LINES = 200;

type Protected = TextRange;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

function makeSpan(
  from: number,
  to: number,
  kind: SpanKind,
  level: number | null,
  marker: string,
  closed: boolean,
  block: boolean,
): Span {
  return { from, to, kind, level, marker, closed, block };
}

function isWord(ch: string | undefined): boolean {
  return ch !== undefined && /[\p{L}\p{N}]/u.test(ch);
}

function isIdentContinue(ch: string | undefined): boolean {
  return ch !== undefined && /[\p{L}\p{N}_]/u.test(ch);
}

function isSpaceChar(ch: string | undefined): boolean {
  return ch === " " || ch === "\t" || ch === "\n" || ch === "\r";
}

function lineStart(source: string, index: number): number {
  let i = clamp(index, 0, source.length);
  while (i > 0 && source.charCodeAt(i - 1) !== 10) i -= 1;
  return i;
}

function lineContentEnd(source: string, lineFrom: number): number {
  let i = lineFrom;
  while (i < source.length && source.charCodeAt(i) !== 10) i += 1;
  return i;
}

function nextLine(source: string, lineFrom: number): number | null {
  const end = lineContentEnd(source, lineFrom);
  if (end >= source.length) return null;
  return end + 1;
}

function prevLine(source: string, lineFrom: number): number | null {
  if (lineFrom <= 0) return null;
  return lineStart(source, lineFrom - 1);
}

function isBlankLine(source: string, lineFrom: number): boolean {
  const end = lineContentEnd(source, lineFrom);
  for (let i = lineFrom; i < end; i += 1) {
    const code = source.charCodeAt(i);
    if (code !== 32 && code !== 9 && code !== 13) return false;
  }
  return true;
}

function countLines(source: string, from: number, to: number): number {
  if (from >= to) return 1;
  let lines = 1;
  for (let i = from; i < to; i += 1) {
    if (source.charCodeAt(i) === 10) lines += 1;
  }
  return lines;
}

function paragraphStartOf(source: string, lineFrom: number): number {
  let line = lineFrom;
  while (true) {
    const prev = prevLine(source, line);
    if (prev === null || isBlankLine(source, prev)) return line;
    line = prev;
  }
}

function paragraphEndOf(source: string, lineFrom: number): number {
  let line = lineFrom;
  while (true) {
    const next = nextLine(source, line);
    if (next === null) return source.length;
    if (isBlankLine(source, next)) return next;
    line = next;
  }
}

function contentLineNear(source: string, pos: number): number | null {
  if (source.length === 0) return null;
  const line = lineStart(source, Math.min(pos, source.length - 1));
  if (!isBlankLine(source, line)) return line;
  let forward = nextLine(source, line);
  while (forward !== null && isBlankLine(source, forward)) {
    forward = nextLine(source, forward);
  }
  if (forward !== null) return forward;
  let back = prevLine(source, line);
  while (back !== null && isBlankLine(source, back)) {
    back = prevLine(source, back);
  }
  return back;
}

/**
 * The changed range, extended to the start of the previous paragraph and
 * the end of the next one. A paragraph break is a blank line. The walk
 * stays inside that window.
 */
export function dirtyWindow(
  source: string,
  changeFrom: number,
  changeTo: number,
): TextRange {
  if (source.length === 0) return { from: 0, to: 0 };
  const anchor = Math.min(changeFrom, source.length - 1);
  const head =
    changeTo <= changeFrom ? anchor : Math.min(changeTo - 1, source.length - 1);
  const first = contentLineNear(source, anchor);
  const last = contentLineNear(source, head);
  if (first === null || last === null) return { from: 0, to: source.length };

  const firstPara = paragraphStartOf(source, first);
  const lastParaEnd = paragraphEndOf(source, last);

  let from = firstPara;
  const before = prevLine(source, firstPara);
  if (before !== null) {
    let content: number | null = before;
    while (content !== null && isBlankLine(source, content)) {
      content = prevLine(source, content);
    }
    if (content !== null) from = paragraphStartOf(source, content);
  }

  let to = lastParaEnd;
  if (lastParaEnd < source.length) {
    let content: number | null = lastParaEnd;
    while (content !== null && isBlankLine(source, content)) {
      content = nextLine(source, content);
    }
    if (content !== null) to = paragraphEndOf(source, content);
  }
  return { from, to };
}

function coveredAt(ranges: Protected[], index: number): Protected | null {
  for (const range of ranges) {
    if (range.from > index) return null;
    if (index >= range.from && index < range.to) return range;
  }
  return null;
}

function skipSpaces(source: string, index: number, limit: number): number {
  let i = index;
  while (i < limit && isSpaceChar(source[i])) i += 1;
  return i;
}

function matchBracket(
  source: string,
  open: number,
  limit: number,
  protectedRanges: Protected[],
): number | null {
  let depth = 1;
  let i = open + 1;
  while (i < limit) {
    const cover = coveredAt(protectedRanges, i);
    if (cover) {
      i = cover.to;
      continue;
    }
    const code = source.charCodeAt(i);
    if (code === 92) {
      i += 2;
      continue;
    }
    if (code === 91) depth += 1;
    else if (code === 93) {
      depth -= 1;
      if (depth === 0) return i;
    }
    i += 1;
  }
  return null;
}

function findClosing(
  source: string,
  from: number,
  limit: number,
  needle: string,
): number {
  const last = limit - needle.length;
  for (let i = from; i <= last; i += 1) {
    if (source.startsWith(needle, i)) return i;
  }
  return -1;
}

function scanProtected(
  source: string,
  from: number,
  to: number,
): { protectedRanges: Protected[]; math: Span[] } {
  const protectedRanges: Protected[] = [];
  const math: Span[] = [];
  let i = from;
  while (i < to) {
    const code = source.charCodeAt(i);
    if (code === 92) {
      i += 2;
      continue;
    }
    if (code === 47 && source.charCodeAt(i + 1) === 47) {
      const end = lineContentEnd(source, i);
      protectedRanges.push({ from: i, to: Math.min(end, to) });
      i = Math.min(end, to);
      continue;
    }
    if (code === 96) {
      let count = 0;
      while (i + count < to && source.charCodeAt(i + count) === 96) count += 1;
      const needle = "`".repeat(count);
      const close = findClosing(source, i + count, to, needle);
      if (close === -1) {
        const end = Math.min(lineContentEnd(source, i), to);
        protectedRanges.push({ from: i, to: end });
        i = end;
      } else {
        const end = close + count;
        protectedRanges.push({ from: i, to: end });
        i = end;
      }
      continue;
    }
    if (code === 34) {
      let j = i + 1;
      let closed = false;
      while (j < to) {
        if (source.charCodeAt(j) === 92) {
          j += 2;
          continue;
        }
        if (source.charCodeAt(j) === 34) {
          j += 1;
          closed = true;
          break;
        }
        if (source.charCodeAt(j) === 10) break;
        j += 1;
      }
      const end = closed ? j : Math.min(lineContentEnd(source, i), to);
      protectedRanges.push({ from: i, to: end });
      i = end;
      continue;
    }
    if (code === 36) {
      let j = i + 1;
      let close = -1;
      while (j < to) {
        if (source.charCodeAt(j) === 92) {
          j += 2;
          continue;
        }
        if (source.charCodeAt(j) === 36) {
          close = j;
          break;
        }
        j += 1;
      }
      if (close === -1) {
        i += 1;
        continue;
      }
      const spanTo = close + 1;
      const block = isBlockMath(source, i, close, from, to);
      math.push(makeSpan(i, spanTo, "math", null, "$", true, block));
      protectedRanges.push({ from: i, to: spanTo });
      i = spanTo;
      continue;
    }
    i += 1;
  }
  protectedRanges.sort((a, b) => a.from - b.from || a.to - b.to);
  return { protectedRanges, math };
}

function boundarySpace(
  source: string,
  index: number,
  windowFrom: number,
  windowTo: number,
): boolean {
  if (index < windowFrom || index >= windowTo) return true;
  return isSpaceChar(source[index]);
}

function isBlockMath(
  source: string,
  open: number,
  close: number,
  windowFrom: number,
  windowTo: number,
): boolean {
  return (
    boundarySpace(source, open - 1, windowFrom, windowTo) &&
    boundarySpace(source, open + 1, windowFrom, windowTo) &&
    boundarySpace(source, close - 1, windowFrom, windowTo) &&
    boundarySpace(source, close + 1, windowFrom, windowTo)
  );
}

type QuoteHit = {
  span: Span;
  attribution: {
    from: number;
    to: number;
    textFrom: number;
    textTo: number;
  } | null;
  contentFrom: number;
  contentTo: number;
};

function matchAttribution(
  source: string,
  openParen: number,
  limit: number,
  protectedRanges: Protected[],
): { end: number; textFrom: number; textTo: number } | null {
  let i = skipSpaces(source, openParen + 1, limit);
  if (!source.startsWith("attribution", i)) return null;
  i += "attribution".length;
  if (isIdentContinue(source[i])) return null;
  i = skipSpaces(source, i, limit);
  if (source[i] !== ":") return null;
  i = skipSpaces(source, i + 1, limit);
  if (source[i] !== "[") return null;
  const textOpen = i;
  const textClose = matchBracket(source, i, limit, protectedRanges);
  if (textClose === null) return null;
  i = skipSpaces(source, textClose + 1, limit);
  if (source[i] !== ")") return null;
  return { end: i + 1, textFrom: textOpen + 1, textTo: textClose };
}

function tryParseQuote(
  source: string,
  start: number,
  limit: number,
  protectedRanges: Protected[],
): QuoteHit | null {
  if (!source.startsWith("#quote", start)) return null;
  const afterName = start + 6;
  if (isIdentContinue(source[afterName])) return null;
  let i = skipSpaces(source, afterName, limit);
  let attribution: QuoteHit["attribution"] = null;
  if (source[i] === "(") {
    const matched = matchAttribution(source, i, limit, protectedRanges);
    if (!matched) return null;
    attribution = {
      from: i,
      to: matched.end,
      textFrom: matched.textFrom,
      textTo: matched.textTo,
    };
    i = skipSpaces(source, matched.end, limit);
  }
  if (source[i] !== "[") return null;
  const contentOpen = i;
  const close = matchBracket(source, i, limit, protectedRanges);
  if (close === null) {
    const lineEnd = Math.min(lineContentEnd(source, start), limit);
    const spanTo = Math.max(lineEnd, start + 6);
    return {
      span: makeSpan(
        start,
        Math.min(spanTo, limit),
        "quote",
        null,
        "#quote",
        false,
        true,
      ),
      attribution: null,
      contentFrom: contentOpen,
      contentTo: contentOpen,
    };
  }
  return {
    span: makeSpan(start, close + 1, "quote", null, "#quote", true, true),
    attribution,
    contentFrom: contentOpen + 1,
    contentTo: close,
  };
}

function scanQuotes(
  source: string,
  from: number,
  to: number,
  protectedRanges: Protected[],
): QuoteHit[] {
  const quotes: QuoteHit[] = [];
  let i = from;
  while (i < to) {
    const found = findClosing(source, i, to, "#quote");
    if (found === -1) break;
    const cover = coveredAt(protectedRanges, found);
    if (cover) {
      i = cover.to;
      continue;
    }
    const parsed = tryParseQuote(source, found, to, protectedRanges);
    if (!parsed) {
      i = found + 6;
      continue;
    }
    quotes.push(parsed);
    i = Math.max(parsed.span.to, found + 6);
  }
  return quotes;
}

type LineInfo = {
  from: number;
  to: number;
  newline: boolean;
  text: string;
};

function linesOf(source: string, from: number, to: number): LineInfo[] {
  const lines: LineInfo[] = [];
  let i = from;
  while (i < to) {
    let end = i;
    while (end < to && source.charCodeAt(end) !== 10) end += 1;
    const newline = end < to && source.charCodeAt(end) === 10;
    lines.push({
      from: i,
      to: end,
      newline,
      text: source.slice(i, end),
    });
    if (!newline) break;
    i = end + 1;
  }
  return lines;
}

function leadingSpaces(text: string): number {
  let i = 0;
  while (i < text.length && text.charCodeAt(i) === 32) i += 1;
  return i;
}

function headingMarker(text: string): { level: number; marker: string } | null {
  const match = /^(=+) (.*)$/.exec(text);
  if (!match) return null;
  const marks = match[1] ?? "";
  return { level: marks.length, marker: `${marks} ` };
}

type ListMarker = {
  kind: "bullet" | "enum" | "term";
  marker: string;
  depth: number;
  indent: number;
};

function listMarker(text: string): ListMarker | null {
  const indent = leadingSpaces(text);
  const rest = text.slice(indent);
  let kind: ListMarker["kind"] | null = null;
  let marker = "";
  if (rest.startsWith("- ")) {
    kind = "bullet";
    marker = "- ";
  } else if (rest.startsWith("+ ")) {
    kind = "enum";
    marker = "+ ";
  } else if (rest.startsWith("/ ") && rest.includes(":")) {
    kind = "term";
    marker = "/ ";
  }
  if (kind === null) return null;
  return { kind, marker, depth: Math.floor(indent / 2), indent };
}

function lineIsHashCall(text: string): boolean {
  const trimmed = text.trimStart();
  if (!trimmed.startsWith("#")) return false;
  if (trimmed.startsWith("#quote") && !isIdentContinue(trimmed[6]))
    return false;
  return isIdentContinue(trimmed[1]);
}

function blockEnd(line: LineInfo): number {
  return line.newline ? line.to + 1 : line.to;
}

function scanListsAndHeadings(
  source: string,
  lines: LineInfo[],
  protectedRanges: Protected[],
): Span[] {
  const spans: Span[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line) continue;
    if (coveredAt(protectedRanges, line.from)) continue;
    if (isBlankLine(source, line.from)) continue;
    const heading = headingMarker(line.text);
    if (heading && leadingSpaces(line.text) === 0) {
      spans.push(
        makeSpan(
          line.from,
          blockEnd(line),
          "heading",
          heading.level,
          heading.marker,
          true,
          true,
        ),
      );
      continue;
    }
    const marker = listMarker(line.text);
    if (!marker) continue;
    const markerAt = line.from + marker.indent;
    if (coveredAt(protectedRanges, markerAt)) continue;
    let end = index + 1;
    while (end < lines.length) {
      const next = lines[end];
      if (!next) break;
      if (isBlankLine(source, next.from)) break;
      if (headingMarker(next.text) && leadingSpaces(next.text) === 0) break;
      const nested = listMarker(next.text);
      if (nested && nested.depth <= marker.depth) break;
      end += 1;
    }
    const last = lines[end - 1] ?? line;
    spans.push(
      makeSpan(
        line.from,
        blockEnd(last),
        marker.kind,
        marker.depth,
        marker.marker,
        true,
        true,
      ),
    );
  }
  return spans;
}

function lineOverlaps(line: LineInfo, span: Span): boolean {
  const end = blockEnd(line);
  return span.from < end && span.to > line.from;
}

function scanBodies(
  source: string,
  lines: LineInfo[],
  blocks: Span[],
  protectedRanges: Protected[],
): Span[] {
  const spans: Span[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (!line) break;
    const blocked =
      isBlankLine(source, line.from) ||
      lineIsHashCall(line.text) ||
      blocks.some((span) => lineOverlaps(line, span)) ||
      (line.to > line.from &&
        protectedRanges.some(
          (range) => range.from <= line.from && range.to >= line.to,
        ));
    if (blocked) {
      index += 1;
      continue;
    }
    let end = index + 1;
    while (end < lines.length) {
      const next = lines[end];
      if (!next) break;
      if (isBlankLine(source, next.from)) break;
      if (lineIsHashCall(next.text)) break;
      if (blocks.some((span) => lineOverlaps(next, span))) break;
      if (
        next.to > next.from &&
        protectedRanges.some(
          (range) => range.from <= next.from && range.to >= next.to,
        )
      ) {
        break;
      }
      end += 1;
    }
    const last = lines[end - 1] ?? line;
    if (last.to > line.from) {
      spans.push(
        makeSpan(line.from, blockEnd(last), "body", null, "", true, true),
      );
    }
    index = end;
  }
  return spans;
}

function canOpen(source: string, index: number, marker: string): boolean {
  if (source[index] !== marker) return false;
  if (index > 0 && source.charCodeAt(index - 1) === 92) return false;
  const next = source[index + 1];
  if (next === undefined || isSpaceChar(next) || next === marker) return false;
  if (isIdentContinue(source[index - 1])) return false;
  return true;
}

function canClose(source: string, index: number, marker: string): boolean {
  if (source[index] !== marker) return false;
  if (index > 0 && source.charCodeAt(index - 1) === 92) return false;
  const prev = source[index - 1];
  if (prev === undefined || isSpaceChar(prev)) return false;
  if (isIdentContinue(source[index + 1])) return false;
  return true;
}

function findDelimiter(
  source: string,
  start: number,
  limit: number,
  marker: string,
  protectedRanges: Protected[],
): number | null {
  let j = start;
  while (j < limit) {
    const cover = coveredAt(protectedRanges, j);
    if (cover) {
      j = cover.to;
      continue;
    }
    if (source.charCodeAt(j) === 10) {
      const next = j + 1;
      if (next >= source.length || isBlankLine(source, next)) return null;
    }
    if (source.charCodeAt(j) === 92) {
      j += 2;
      continue;
    }
    if (canClose(source, j, marker)) return j;
    j += 1;
  }
  return null;
}

function scanDelimited(
  source: string,
  from: number,
  to: number,
  marker: "_" | "*",
  kind: "emphasis" | "strong",
  protectedRanges: Protected[],
): Span[] {
  const spans: Span[] = [];
  let i = from;
  while (i < to) {
    const cover = coveredAt(protectedRanges, i);
    if (cover) {
      i = Math.min(cover.to, to);
      continue;
    }
    if (source.charCodeAt(i) === 92) {
      i += 2;
      continue;
    }
    if (!canOpen(source, i, marker)) {
      i += 1;
      continue;
    }
    const close = findDelimiter(source, i + 1, to, marker, protectedRanges);
    if (close === null) {
      const end = Math.min(lineContentEnd(source, i), to);
      if (end > i) {
        spans.push(makeSpan(i, end, kind, null, marker, false, false));
      }
      i = Math.max(i + 1, end);
      continue;
    }
    spans.push(makeSpan(i, close + 1, kind, null, marker, true, false));
    i = close + 1;
  }
  return spans;
}

function contentHost(
  source: string,
  span: Span,
  quotes: QuoteHit[],
): TextRange | null {
  if (!span.closed) return null;
  if (span.kind === "body") return { from: span.from, to: span.to };
  if (span.kind === "heading") {
    return { from: span.from + span.marker.length, to: span.to };
  }
  if (span.kind === "bullet" || span.kind === "enum" || span.kind === "term") {
    let i = span.from;
    while (source.charCodeAt(i) === 32) i += 1;
    return { from: i + span.marker.length, to: span.to };
  }
  if (span.kind === "quote") {
    const quote = quotes.find((hit) => hit.span.from === span.from);
    if (!quote || quote.contentTo <= quote.contentFrom) return null;
    return { from: quote.contentFrom, to: quote.contentTo };
  }
  return null;
}

function scanWindow(source: string, from: number, to: number): Span[] {
  if (from >= to) return [];
  const { protectedRanges, math } = scanProtected(source, from, to);
  const quotes = scanQuotes(source, from, to, protectedRanges);
  const lines = linesOf(source, from, to);
  const blocks = [
    ...quotes.map((hit) => hit.span),
    ...math.filter((span) => span.block),
    ...scanListsAndHeadings(source, lines, protectedRanges),
  ];
  const bodies = scanBodies(source, lines, blocks, protectedRanges);
  const hosts = [...blocks, ...bodies];
  const inline: Span[] = [];
  for (const span of hosts) {
    const host = contentHost(source, span, quotes);
    if (!host || host.from >= host.to) continue;
    inline.push(
      ...scanDelimited(
        source,
        host.from,
        host.to,
        "_",
        "emphasis",
        protectedRanges,
      ),
      ...scanDelimited(
        source,
        host.from,
        host.to,
        "*",
        "strong",
        protectedRanges,
      ),
    );
  }
  const inlineMath = math.filter((span) => !span.block);
  const spans = [...hosts, ...inline, ...inlineMath].filter(
    (span) => span.from >= from && span.to <= to && span.from < span.to,
  );
  spans.sort((a, b) => a.from - b.from || b.to - a.to);
  return spans;
}

/** Spans for the dirty window around a change, plus how much source was read. */
export function classifySpans(
  source: string,
  changeFrom: number,
  changeTo: number,
): ClassifyResult {
  const length = source.length;
  let from = clamp(changeFrom, 0, length);
  let to = clamp(changeTo, 0, length);
  if (from > to) {
    const swap = from;
    from = to;
    to = swap;
  }
  const window =
    countLines(source, from, to) > TALL_CHANGE_LINES
      ? { from: 0, to: length }
      : dirtyWindow(source, from, to);
  return {
    spans: scanWindow(source, window.from, window.to),
    windowFrom: window.from,
    windowTo: window.to,
    charsRead: window.to - window.from,
  };
}

export function mapSpanPosition(
  pos: number,
  from: number,
  to: number,
  insertLength: number,
): number | null {
  if (pos <= from) return pos;
  if (pos >= to) return pos + insertLength - (to - from);
  return null;
}

/**
 * Keep spans outside the dirty window, shifted by the edit, and replace
 * the ones the new scan produced. A stored span that overlaps the edit
 * widens the window so a quote opener outside the paragraph is not lost.
 */
export function integrateSpans(
  previous: Span[],
  source: string,
  changeFrom: number,
  changeTo: number,
  mapPos: (pos: number, assoc: -1 | 1) => number,
): ClassifyResult {
  const mapped: Span[] = [];
  let widenFrom = changeFrom;
  let widenTo = changeTo;
  for (const span of previous) {
    const from = mapPos(span.from, 1);
    const to = mapPos(span.to, -1);
    if (from >= to) continue;
    const next = { ...span, from, to };
    if (next.from < changeTo && next.to > changeFrom) {
      widenFrom = Math.min(widenFrom, next.from);
      widenTo = Math.max(widenTo, next.to);
    }
    mapped.push(next);
  }
  const classified = classifySpans(source, widenFrom, widenTo);
  const kept = mapped.filter(
    (span) =>
      span.to <= classified.windowFrom || span.from >= classified.windowTo,
  );
  const spans = [...kept, ...classified.spans].sort(
    (a, b) => a.from - b.from || b.to - a.to,
  );
  return { ...classified, spans };
}

function rangesOverlap(left: TextRange, right: TextRange): boolean {
  return left.from < right.to && left.to > right.from;
}

function selectionIntersects(span: Span, selection: TextRange[]): boolean {
  return selection.some((range) => rangesOverlap(span, range));
}

export function spanShownAsSource(
  span: Span,
  source: string,
  selection: TextRange[],
  diagnostics: PlanDiagnostic[],
): boolean {
  if (!span.closed) return true;
  if (
    span.kind === "math" &&
    source.slice(span.from + 1, Math.max(span.from + 1, span.to - 1)).length ===
      0
  ) {
    return true;
  }
  if (selectionIntersects(span, selection)) return true;
  return diagnostics.some(
    (diagnostic) =>
      diagnostic.severity === "error" && rangesOverlap(span, diagnostic),
  );
}

function hashCallRanges(source: string, from: number, to: number): TextRange[] {
  const holes: TextRange[] = [];
  let i = from;
  while (i < to) {
    if (source.charCodeAt(i) === 92) {
      i += 2;
      continue;
    }
    const call =
      source[i] === "#" &&
      isIdentContinue(source[i + 1]) &&
      (i === from || !isWord(source[i - 1]));
    if (!call) {
      i += 1;
      continue;
    }
    if (source.startsWith("#quote", i) && !isIdentContinue(source[i + 6])) {
      i += 6;
      continue;
    }
    let j = i + 1;
    while (j < to && isIdentContinue(source[j])) j += 1;
    let depth = 0;
    while (j < to) {
      const code = source.charCodeAt(j);
      if (code === 92) {
        j += 2;
        continue;
      }
      if (code === 40 || code === 91 || code === 123) depth += 1;
      else if (code === 41 || code === 93 || code === 125) {
        if (depth === 0) break;
        depth -= 1;
      } else if (depth === 0 && (code === 10 || code === 32 || code === 9)) {
        break;
      }
      j += 1;
    }
    if (j > i) holes.push({ from: i, to: j });
    i = Math.max(j, i + 1);
  }
  return holes;
}

function subtractRanges(
  from: number,
  to: number,
  holes: TextRange[],
): TextRange[] {
  let cursor = from;
  const pieces: TextRange[] = [];
  const cuts = holes
    .filter((hole) => hole.from < to && hole.to > from)
    .sort((a, b) => a.from - b.from);
  for (const hole of cuts) {
    const cutFrom = Math.max(hole.from, from);
    const cutTo = Math.min(hole.to, to);
    if (cursor < cutFrom) pieces.push({ from: cursor, to: cutFrom });
    cursor = Math.max(cursor, cutTo);
  }
  if (cursor < to) pieces.push({ from: cursor, to });
  return pieces;
}

function quoteHitFor(source: string, span: Span): QuoteHit | null {
  if (span.kind !== "quote" || !span.closed) return null;
  const parsed = tryParseQuote(source, span.from, span.to, []);
  if (!parsed || !parsed.span.closed) return null;
  return parsed;
}

function headingClass(level: number): string {
  if (level <= 1) return "cm-h1";
  if (level === 2) return "cm-h2";
  if (level === 3) return "cm-h3";
  if (level === 4) return "cm-h4";
  return "cm-h5";
}

function depthClass(level: number | null): string {
  const depth = Math.max(0, Math.min(level ?? 0, 8));
  return `cm-depth-${depth}`;
}

function hasBlankLineBetween(
  source: string,
  from: number,
  to: number,
): boolean {
  let i = from;
  while (i < to) {
    const start = lineStart(source, i);
    const end = lineContentEnd(source, start);
    if (start >= from && end <= to && isBlankLine(source, start)) return true;
    if (end >= source.length) break;
    i = end + 1;
    if (i <= start) break;
  }
  return false;
}

function enumNumbers(source: string, spans: Span[]): Map<Span, number> {
  const numbers = new Map<Span, number>();
  const enums = spans
    .filter((span) => span.kind === "enum" && span.closed)
    .sort((a, b) => a.from - b.from);
  const counts = new Map<number, number>();
  let lastEnd = 0;
  let started = false;
  for (const span of enums) {
    if (started && hasBlankLineBetween(source, lastEnd, span.from)) {
      counts.clear();
    }
    const depth = span.level ?? 0;
    const next = (counts.get(depth) ?? 0) + 1;
    counts.set(depth, next);
    numbers.set(span, next);
    lastEnd = span.to;
    started = true;
  }
  return numbers;
}

function firstError(
  span: Span,
  diagnostics: PlanDiagnostic[],
): PlanDiagnostic | null {
  let best: PlanDiagnostic | null = null;
  for (const diagnostic of diagnostics) {
    if (diagnostic.severity !== "error") continue;
    if (!rangesOverlap(span, diagnostic)) continue;
    if (
      best === null ||
      diagnostic.from < best.from ||
      (diagnostic.from === best.from && diagnostic.to < best.to)
    ) {
      best = diagnostic;
    }
  }
  return best;
}

function errorNote(diagnostic: PlanDiagnostic): string {
  const hints = diagnostic.hints.map((hint) => hint.trim()).filter(Boolean);
  if (hints.length === 0) return diagnostic.message;
  return `${diagnostic.message} ${hints.join(" ")}`;
}

function pushStyle(
  styles: StyleRange[],
  from: number,
  to: number,
  className: string,
  holes: TextRange[],
) {
  for (const piece of subtractRanges(from, to, holes)) {
    if (piece.from < piece.to) {
      styles.push({ from: piece.from, to: piece.to, className });
    }
  }
}

function lineStarts(source: string, from: number, to: number): number[] {
  const starts: number[] = [];
  let i = lineStart(source, from);
  if (i < from) {
    const next = nextLine(source, i);
    i = next ?? to;
  }
  while (i < to) {
    starts.push(i);
    const next = nextLine(source, i);
    if (next === null) break;
    i = next;
  }
  return starts;
}

/** Hide markers, style the words, and place math chips and error notes. */
export function planDecorations(
  source: string,
  spans: Span[],
  selection: TextRange[],
  diagnostics: PlanDiagnostic[],
): DecorationPlan {
  const styles: StyleRange[] = [];
  const replaces: ReplaceRange[] = [];
  const points: PointWidget[] = [];
  const lineMap = new Map<number, string[]>();
  const numbers = enumNumbers(source, spans);

  const addLine = (at: number, className: string) => {
    const list = lineMap.get(at) ?? [];
    if (!list.includes(className)) list.push(className);
    lineMap.set(at, list);
  };

  for (const span of spans) {
    if (spanShownAsSource(span, source, selection, diagnostics)) continue;
    const holes = hashCallRanges(source, span.from, span.to);
    if (span.kind === "heading") {
      const markerTo = span.from + span.marker.length;
      replaces.push({
        from: span.from,
        to: Math.min(markerTo, span.to),
        text: "",
        className: "",
      });
      pushStyle(styles, span.from, span.to, headingClass(span.level ?? 1), [
        ...holes,
        { from: span.from, to: markerTo },
      ]);
    } else if (
      span.kind === "bullet" ||
      span.kind === "enum" ||
      span.kind === "term"
    ) {
      let markerFrom = span.from;
      while (source.charCodeAt(markerFrom) === 32) markerFrom += 1;
      const markerTo = Math.min(span.to, markerFrom + span.marker.length);
      const number = numbers.get(span);
      replaces.push({
        from: span.from,
        to: markerTo,
        text: span.kind === "enum" && number !== undefined ? `${number}.` : "",
        className: span.kind === "enum" ? "cm-enum-num" : "",
      });
      const itemClass =
        span.kind === "bullet"
          ? "cm-bullet"
          : span.kind === "enum"
            ? "cm-enum"
            : "cm-term";
      pushStyle(styles, markerTo, span.to, itemClass, holes);
      if (span.kind === "term") {
        const content = source.slice(markerTo, span.to);
        const colon = content.indexOf(":");
        if (colon > 0) {
          pushStyle(styles, markerTo, markerTo + colon, "cm-term-label", holes);
        }
      }
      for (const at of lineStarts(source, span.from, span.to)) {
        addLine(at, depthClass(span.level));
      }
    } else if (span.kind === "quote") {
      const quote = quoteHitFor(source, span);
      if (!quote) continue;
      replaces.push({
        from: span.from,
        to: span.from + 6,
        text: "",
        className: "",
      });
      if (quote.attribution) {
        replaces.push({
          from: quote.attribution.from,
          to: quote.attribution.to,
          text: "",
          className: "",
        });
      }
      const openBracket = quote.contentFrom - 1;
      const closeBracket = quote.contentTo;
      if (openBracket >= span.from && openBracket < span.to) {
        replaces.push({
          from: openBracket,
          to: openBracket + 1,
          text: "",
          className: "",
        });
      }
      if (closeBracket >= span.from && closeBracket < span.to) {
        replaces.push({
          from: closeBracket,
          to: closeBracket + 1,
          text: "",
          className: "",
        });
      }
      pushStyle(styles, quote.contentFrom, quote.contentTo, "cm-quote", holes);
      for (const at of lineStarts(source, quote.contentFrom, span.to)) {
        addLine(at, "cm-quote-line");
      }
      if (quote.attribution) {
        const text = source.slice(
          quote.attribution.textFrom,
          quote.attribution.textTo,
        );
        if (text.length > 0) {
          points.push({
            at: span.to,
            side: 1,
            text,
            className: "cm-quote-attr",
          });
        }
      }
    } else if (span.kind === "body") {
      pushStyle(styles, span.from, span.to, "cm-prose", holes);
    } else if (span.kind === "emphasis" || span.kind === "strong") {
      replaces.push(
        { from: span.from, to: span.from + 1, text: "", className: "" },
        { from: span.to - 1, to: span.to, text: "", className: "" },
      );
      pushStyle(
        styles,
        span.from + 1,
        span.to - 1,
        span.kind === "emphasis" ? "cm-em" : "cm-strong",
        holes,
      );
    } else if (span.kind === "math") {
      const inner = source.slice(span.from + 1, span.to - 1);
      if (inner.length === 0) continue;
      replaces.push({
        from: span.from,
        to: span.to,
        text: inner,
        className: span.block ? "cm-math-block" : "cm-math-chip",
      });
    }
  }

  for (const diagnostic of diagnostics) {
    if (diagnostic.from >= diagnostic.to) continue;
    if (diagnostic.severity === "warning") {
      pushStyle(styles, diagnostic.from, diagnostic.to, "cm-warning-range", []);
    }
    if (diagnostic.severity === "error") {
      pushStyle(styles, diagnostic.from, diagnostic.to, "cm-error-range", []);
    }
  }

  const overlapping = spans.filter((span) => firstError(span, diagnostics));
  const hosts = overlapping.filter(
    (span) =>
      !overlapping.some(
        (other) =>
          other !== span && other.from <= span.from && other.to >= span.to,
      ),
  );
  for (const span of hosts) {
    const diagnostic = firstError(span, diagnostics);
    if (!diagnostic) continue;
    const text = errorNote(diagnostic);
    if (!text.trim()) continue;
    points.push({
      at: span.to,
      side: 1,
      text,
      className: "cm-error-note",
    });
  }

  const lines: LineStyle[] = [];
  for (const [at, classes] of lineMap) {
    lines.push({ at, className: classes.join(" ") });
  }
  lines.sort((a, b) => a.at - b.at);
  return { styles, replaces, points, lines };
}

type FlatMark = { kind: "mark"; from: number; to: number; className: string };
type FlatReplace = {
  kind: "replace";
  from: number;
  to: number;
  text: string;
  className: string;
};

export type FlatRange = FlatMark | FlatReplace;

function disjointReplaces(replaces: ReplaceRange[]): ReplaceRange[] {
  const sorted = replaces
    .filter((range) => range.from < range.to)
    .sort((a, b) => a.from - b.from || b.to - a.to);
  const kept: ReplaceRange[] = [];
  let end = -1;
  for (const range of sorted) {
    if (range.from < end) continue;
    kept.push(range);
    end = range.to;
  }
  return kept;
}

/** Marks and replaces with no overlaps, so CodeMirror can build one set. */
export function flattenRanges(plan: DecorationPlan): FlatRange[] {
  const replaces = disjointReplaces(plan.replaces);
  type Event = { pos: number; order: number; className: string; delta: number };
  const events: Event[] = [];
  for (const style of plan.styles) {
    for (const piece of subtractRanges(style.from, style.to, replaces)) {
      if (piece.from >= piece.to) continue;
      events.push({
        pos: piece.from,
        order: 1,
        className: style.className,
        delta: 1,
      });
      events.push({
        pos: piece.to,
        order: 0,
        className: style.className,
        delta: -1,
      });
    }
  }
  events.sort((a, b) => a.pos - b.pos || a.order - b.order);
  const active = new Map<string, number>();
  const marks: FlatMark[] = [];
  let cursor = events[0]?.pos ?? 0;
  for (const event of events) {
    if (event.pos > cursor && active.size > 0) {
      const className = [...active.keys()].sort().join(" ");
      marks.push({ kind: "mark", from: cursor, to: event.pos, className });
    }
    const count = (active.get(event.className) ?? 0) + event.delta;
    if (count <= 0) active.delete(event.className);
    else active.set(event.className, count);
    cursor = event.pos;
  }
  const flat: FlatRange[] = [
    ...replaces.map((range) => ({
      kind: "replace" as const,
      from: range.from,
      to: range.to,
      text: range.text,
      className: range.className,
    })),
    ...marks,
  ];
  flat.sort((a, b) => a.from - b.from || a.to - b.to);
  return flat;
}

export function rangesOverlapEachOther(
  ranges: { from: number; to: number }[],
): boolean {
  const sorted = [...ranges].sort((a, b) => a.from - b.from || a.to - b.to);
  let end = -1;
  for (const range of sorted) {
    if (range.from < end && range.from !== range.to) return true;
    end = Math.max(end, range.to);
  }
  return false;
}

export function caretMoveReplacesRanges(
  source: string,
  spans: Span[],
  before: TextRange[],
  after: TextRange[],
  diagnostics: PlanDiagnostic[],
): number {
  const left = flattenRanges(
    planDecorations(source, spans, before, diagnostics),
  );
  const right = flattenRanges(
    planDecorations(source, spans, after, diagnostics),
  );
  if (left.length !== right.length) return Math.max(left.length, right.length);
  for (let i = 0; i < left.length; i += 1) {
    const a = left[i];
    const b = right[i];
    if (!a || !b) return 1;
    if (
      a.kind !== b.kind ||
      a.from !== b.from ||
      a.to !== b.to ||
      a.className !== b.className
    ) {
      return left.length;
    }
    if (a.kind === "replace" && b.kind === "replace" && a.text !== b.text) {
      return left.length;
    }
  }
  return 0;
}

/**
 * Forward arrow that would skip a rendered math chip lands on the first
 * position inside it. Backward lands on the last position inside it.
 * Both are strictly inside, so the chip is omitted and the dollars show.
 */
export function mathArrowTarget(
  source: string,
  spans: Span[],
  diagnostics: PlanDiagnostic[],
  oldHead: number,
  newHead: number,
): number | null {
  if (oldHead === newHead) return null;
  const forward = newHead > oldHead;
  for (const span of spans) {
    if (span.kind !== "math" || !span.closed) continue;
    if (
      spanShownAsSource(
        span,
        source,
        [{ from: oldHead, to: oldHead }],
        diagnostics,
      )
    ) {
      continue;
    }
    const crossed = forward
      ? oldHead <= span.from && newHead >= span.to
      : oldHead >= span.to && newHead <= span.from;
    if (!crossed) continue;
    if (forward) return Math.min(span.from + 1, span.to - 1);
    return Math.max(span.from, span.to - 1);
  }
  return null;
}

export function editorDiagnostics(
  diagnostics: RawDiagnostic[],
  sentSource: string,
  buffer: string,
  notePath: string,
  accept: boolean,
): PlanDiagnostic[] {
  if (!accept || sentSource !== buffer) return [];
  const applied: PlanDiagnostic[] = [];
  for (const diagnostic of diagnostics) {
    if (diagnostic.file !== "" && diagnostic.file !== notePath) continue;
    const from = byteOffsetToUtf16(sentSource, diagnostic.start);
    const to = byteOffsetToUtf16(sentSource, diagnostic.end);
    applied.push({
      from: Math.min(from, to),
      to: Math.max(from, to),
      severity: diagnostic.severity,
      message: diagnostic.message,
      hints: diagnostic.hints,
    });
  }
  return applied;
}

function innermostBlock(
  spans: Span[],
  caret: number,
  sourceLength: number,
): Span | null {
  let best: Span | null = null;
  for (const span of spans) {
    if (!span.block || !span.closed) continue;
    if (span.kind === "math") continue;
    const atEnd =
      caret === sourceLength && span.to === sourceLength && caret > span.from;
    const inside = (caret >= span.from && caret < span.to) || atEnd;
    if (!inside) continue;
    if (
      best === null ||
      span.to - span.from < best.to - best.from ||
      (span.to - span.from === best.to - best.from && span.from >= best.from)
    ) {
      best = span;
    }
  }
  return best;
}

function markerContentStart(source: string, span: Span): number {
  if (span.kind === "heading") return span.from + span.marker.length;
  let i = span.from;
  while (source.charCodeAt(i) === 32) i += 1;
  return i + span.marker.length;
}

function itemHasText(source: string, span: Span): boolean {
  const start = markerContentStart(source, span);
  return source.slice(start, span.to).trim().length > 0;
}

function quoteLineHasText(source: string, caret: number, span: Span): boolean {
  const start = Math.max(lineStart(source, caret), span.from);
  const end = Math.min(lineContentEnd(source, caret), span.to);
  let text = source.slice(start, end);
  text = text.replaceAll("#quote", "");
  if (text.includes("attribution")) text = text.replace(/\([^)]*\)/, "");
  text = text.replaceAll("[", "").replaceAll("]", "");
  return text.trim().length > 0;
}

/**
 * The one source edit for Enter, Backspace, or Tab. `null` means the key
 * is left to CodeMirror. Tab still must not move focus; the keymap owns that.
 */
export function structureKey(
  source: string,
  selectionFrom: number,
  selectionTo: number,
  spans: Span[],
  key: "Enter" | "Backspace" | "Tab",
  shift: boolean,
  composing: boolean,
): StructureEdit | null {
  if (composing) return null;
  if (selectionFrom !== selectionTo) return null;
  const caret = selectionFrom;
  const span = innermostBlock(spans, caret, source.length);
  if (!span) return null;

  if (key === "Tab") {
    if (
      span.kind !== "bullet" &&
      span.kind !== "enum" &&
      span.kind !== "term"
    ) {
      return null;
    }
    if (shift) {
      if (source.slice(span.from, span.from + 2) !== "  ") return null;
      return {
        from: span.from,
        to: span.from + 2,
        insert: "",
        selection: Math.max(span.from, caret - 2),
      };
    }
    return {
      from: span.from,
      to: span.from,
      insert: "  ",
      selection: caret + 2,
    };
  }

  if (key === "Backspace") {
    if (
      span.kind !== "heading" &&
      span.kind !== "bullet" &&
      span.kind !== "enum" &&
      span.kind !== "term"
    ) {
      return null;
    }
    const content = markerContentStart(source, span);
    if (caret !== content || content <= span.from) return null;
    return { from: span.from, to: content, insert: "", selection: span.from };
  }

  if (key !== "Enter") return null;
  if (span.kind === "heading") {
    return { from: caret, to: caret, insert: "\n", selection: caret + 1 };
  }
  if (span.kind === "bullet" || span.kind === "enum" || span.kind === "term") {
    if (!itemHasText(source, span)) {
      const content = markerContentStart(source, span);
      return { from: span.from, to: content, insert: "", selection: span.from };
    }
    let indent = 0;
    while (source.charCodeAt(span.from + indent) === 32) indent += 1;
    const insert = `\n${" ".repeat(indent)}${span.marker}`;
    return { from: caret, to: caret, insert, selection: caret + insert.length };
  }
  if (span.kind === "quote") {
    if (!quoteLineHasText(source, caret, span)) {
      return { from: caret, to: caret, insert: "", selection: span.to };
    }
    let at = caret;
    if (source[span.to - 1] === "]" && caret >= span.to - 1) at = span.to - 1;
    return { from: at, to: at, insert: "\n", selection: at + 1 };
  }
  return null;
}
