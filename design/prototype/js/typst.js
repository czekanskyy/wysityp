/* WYSITyp prototype – a tiny Typst-subset renderer and source highlighter.
   It is a stand-in for the real Typst engine (which runs in Rust in the app). It covers what the
   sample notes and the toolbar insert: headings, emphasis, math, lists, quotes, tables, theorem-like
   blocks, figures and shapes. An unclosed `$` is reported as a diagnostic, like the app does. */
"use strict";

const TY = (() => {
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

  /* ---------- Symbols ---------- */
  const SYM = new Map();
  for (const [g, n] of SYMBOLS) if (!SYM.has(n)) SYM.set(n, g);
  Object.entries({
    dot: "⋅", "dot.c": "⋅", times: "×", partial: "∂", oo: "∞", "arrow.r.long": "⟶", "sym.arrow.r": "→", ast: "∗",
    star: "⋆", hbar: "ℏ", dots: "…", "dots.c": "⋯", qed: "∎", "bar.v": "|", colon: ":", "lt.eq.slant": "⩽",
    "gt.eq.slant": "⩾", "eq.def": "≝", "eq.triple": "≡", tilde: "∼", "arrow.long": "⟶", implies: "⟹", iff: "⟺",
    "integral.triple": "∭", "union.big": "⋃", "sect.big": "⋂", "circle.small": "∘", "square.stroked": "□",
  }).forEach(([k, v]) => SYM.set(k, v));

  const REL = new Set("= ≠ < > ≤ ≥ ≈ ≡ ∼ ≅ ≪ ≫ ∝ ⊥ ∥ ∣ ≺ ≻ → ← ↔ ⇒ ⇐ ⇔ ↦ ⟶ ⟹ ⟺ ↪ ⇀ ⇝ ↗ ↘ ↑ ↓ ↕ ⟼ ∈ ∉ ∋ ⊂ ⊆ ⊃ ⊇ ≔ ⩽ ⩾ ≝ :".split(" "));
  const BIN = new Set("+ − ± ∓ × ÷ ⋅ · ∘ ⊕ ⊗ ∪ ∩ ∖ ∧ ∨ ∗ ⋆".split(" "));
  const BIG = new Set(["∑", "∏", "∫", "∬", "∭", "∮", "⋃", "⋂"]);
  const LIMOPS = new Set(["∑", "∏", "⋃", "⋂", "lim", "max", "min", "sup", "inf", "liminf", "limsup"]);
  const UPRIGHT = new Set(
    "sin cos tan cot sec csc arcsin arccos arctan sinh cosh tanh ln log lg exp det dim ker deg gcd lcm max min sup inf lim liminf limsup arg mod tr rank sgn Re Im".split(" "),
  );
  const ITALIC_GLYPH = /^[α-ωϵϑϕℓ]$/;
  const SHORT = { "->": "→", "=>": "⇒", "<=": "≤", ">=": "≥", "!=": "≠", ":=": "≔", "...": "…", "<<": "≪", ">>": "≫", "||": "‖", "-": "−", "*": "∗", "'": "′", "==": "⩵" };
  const BB = { R: "ℝ", N: "ℕ", Z: "ℤ", Q: "ℚ", C: "ℂ", P: "ℙ", E: "𝔼" };

  /* ---------- Math ---------- */
  function mtok(src) {
    const re = /(\s+)|("(?:[^"\\]|\\.)*")|([A-Za-z]+(?:\.[A-Za-z]+)*)|(\d+(?:\.\d+)?)|(->|=>|<=|>=|!=|:=|==|\.\.\.|\|\||<<|>>)|(\\.?)|([\s\S])/g;
    const out = [];
    let m;
    while ((m = re.exec(src))) {
      if (m[1]) out.push({ t: "sp", v: m[1] });
      else if (m[2]) out.push({ t: "str", v: m[2].slice(1, -1) });
      else if (m[3]) {
        // Typst reads `ab` as one identifier, but single Latin letters followed by digits stay apart.
        out.push({ t: "id", v: m[3] });
      } else if (m[4]) out.push({ t: "num", v: m[4] });
      else if (m[5]) out.push({ t: "op", v: m[5] });
      else if (m[6]) out.push({ t: m[6].length === 1 || m[6] === "\\ " ? "br" : "op", v: m[6].length > 1 ? m[6][1] : "\\" });
      else out.push({ t: "op", v: m[7] });
    }
    return out;
  }

  function math(src, display) {
    const toks = mtok(src);
    let p = 0;
    const peek = () => toks[p];

    function skipSp() {
      let sp = false;
      while (p < toks.length && toks[p].t === "sp") {
        p++;
        sp = true;
      }
      return sp;
    }

    function join(units) {
      let h = "";
      units.forEach((u, i) => {
        const prev = units[i - 1];
        if (u.sp && prev && isOrd(prev) && isOrd(u)) h += '<span class="ms"></span>';
        if (u.k === "bin" && (!prev || prev.k === "rel" || prev.k === "bin" || prev.k === "open" || prev.k === "punct")) h += `<span class="mo">${u.g}</span>`;
        else h += u.h;
      });
      return h;
    }
    const isOrd = (u) => u.k === "ord" || u.k === "fn" || u.k === "grp" || u.k === "big";

    function combine(units) {
      const out = [];
      for (let i = 0; i < units.length; i++) {
        const u = units[i];
        if (u.k === "slash" && out.length && units[i + 1]) {
          const a = out.pop();
          const b = units[++i];
          out.push({ k: "ord", sp: a.sp, h: frac(a.inner ?? a.h, b.inner ?? b.h) });
        } else out.push(u);
      }
      return out;
    }
    const frac = (a, b) => `<span class="mf"><span class="mf-n">${a}</span><span class="mf-d">${b}</span></span>`;

    function parseSeq(stop) {
      const units = [];
      for (;;) {
        const u = parseUnit(stop);
        if (!u) break;
        units.push(u);
      }
      return combine(units);
    }

    function parseArgs() {
      // after "(" – returns rows of cells (cells are html strings)
      const rows = [[]];
      let cur = [];
      for (;;) {
        const u = parseUnit([")", ",", ";"]);
        if (u) {
          cur.push(u);
          continue;
        }
        const t = peek();
        if (!t) break;
        p++;
        if (t.v === ",") {
          rows[rows.length - 1].push(join(combine(cur)));
          cur = [];
        } else if (t.v === ";") {
          rows[rows.length - 1].push(join(combine(cur)));
          cur = [];
          rows.push([]);
        } else break;
      }
      if (cur.length || rows[rows.length - 1].length) rows[rows.length - 1].push(join(combine(cur)));
      return rows.filter((r) => r.length);
    }

    function scriptArg() {
      skipSp();
      const t = peek();
      if (!t) return "";
      if (t.v === "(") {
        p++;
        const inner = join(parseSeq([")"]));
        if (peek() && peek().v === ")") p++;
        return inner;
      }
      p++;
      const u = atom(t, true);
      return u.h;
    }

    function fnCall(name) {
      // p points after "("
      const rows = parseArgs();
      const a = rows[0] || [""];
      const all = rows.map((r) => r.join(", ")).join("; ");
      switch (name) {
        case "sqrt":
          return { k: "ord", h: `<span class="msq"><span class="msq-r">√</span><span class="msq-b">${a[0]}</span></span>` };
        case "root":
          return { k: "ord", h: `<span class="msq"><sup class="msq-i">${a[0]}</sup><span class="msq-r">√</span><span class="msq-b">${a[1] || ""}</span></span>` };
        case "abs":
          return { k: "ord", h: `|${all}|` };
        case "norm":
          return { k: "ord", h: `‖${all}‖` };
        case "floor":
          return { k: "ord", h: `⌊${all}⌋` };
        case "ceil":
          return { k: "ord", h: `⌈${all}⌉` };
        case "frac":
          return { k: "ord", h: frac(a[0], a[1] || "") };
        case "binom":
          return { k: "ord", h: `<span class="mmat">${`<span class="mg" style="grid-template-columns:auto">${a.map((c) => `<span>${c}</span>`).join("")}</span>`}</span>` };
        case "arrow":
        case "vec":
          return { k: "ord", h: `<span class="macc">${a[0]}<span class="macc-m">→</span></span>` };
        case "hat":
          return { k: "ord", h: `<span class="macc">${a[0]}<span class="macc-m">^</span></span>` };
        case "tilde":
          return { k: "ord", h: `<span class="macc">${a[0]}<span class="macc-m">~</span></span>` };
        case "dot":
          return { k: "ord", h: `<span class="macc">${a[0]}<span class="macc-m">˙</span></span>` };
        case "bar":
        case "overline":
          return { k: "ord", h: `<span class="mover">${a[0]}</span>` };
        case "underline":
          return { k: "ord", h: `<span class="munder">${a[0]}</span>` };
        case "mat": {
          const n = Math.max(...rows.map((r) => r.length));
          const cells = rows.map((r) => r.concat(Array(n - r.length).fill("")).map((c) => `<span>${c}</span>`).join("")).join("");
          return { k: "ord", h: `<span class="mmat"><span class="mg" style="grid-template-columns:repeat(${n},auto)">${cells}</span></span>` };
        }
        case "cases":
          return { k: "ord", h: `<span class="mcases"><span class="mg" style="grid-template-columns:auto">${rows.flat().map((c) => `<span>${c}</span>`).join("")}</span></span>` };
        case "bb":
          return { k: "ord", h: BB[stripTags(a[0])] || `<b>${a[0]}</b>` };
        case "bold":
          return { k: "ord", h: `<b>${a[0]}</b>` };
        case "upright":
        case "op":
          return { k: "fn", h: `<span class="mu">${a[0]}</span>` };
        case "cal":
          return { k: "ord", h: `<span class="mcal">${a[0]}</span>` };
        case "lr":
          return { k: "ord", h: all };
        default:
          return { k: "ord", h: `${identHtml(name)}(${all})` };
      }
    }
    const stripTags = (h) => h.replace(/<[^>]+>/g, "");

    function identHtml(v) {
      if (SYM.has(v)) {
        const g = SYM.get(v);
        return ITALIC_GLYPH.test(g) ? `<i class="mi">${g}</i>` : g;
      }
      if (v.length === 1) return `<i class="mi">${esc(v)}</i>`;
      return `<i class="mi">${esc(v)}</i>`;
    }

    function atom(t, noFn) {
      if (t.t === "num") return { k: "ord", h: `<span class="mn">${t.v}</span>` };
      if (t.t === "str") return { k: "ord", h: `<span class="mt">${esc(t.v)}</span>` };
      if (t.t === "br") return { k: "punct", h: "<br>" };
      if (t.t === "id") {
        const v = t.v;
        if (!noFn && peek() && peek().v === "(" && !UPRIGHT.has(v) && !SYM.has(v) && v !== "dif") {
          p++;
          return fnCall(v);
        }
        if (!noFn && peek() && peek().v === "(" && ["arrow", "dot", "bar", "tilde", "hat", "vec", "abs"].includes(v)) {
          p++;
          return fnCall(v);
        }
        if (UPRIGHT.has(v)) return { k: "fn", h: `<span class="mu">${v}</span>`, lim: LIMOPS.has(v), name: v };
        if (v === "dif") return { k: "ord", h: '<span class="mu">d</span>' };
        if (v === "quad") return { k: "sp", h: '<span class="mq"></span>' };
        if (v === "qquad") return { k: "sp", h: '<span class="mq"></span><span class="mq"></span>' };
        if (v === "thin" || v === "med" || v === "thick") return { k: "sp", h: '<span class="ms"></span>' };
        if (SYM.has(v)) {
          const g = SYM.get(v);
          if (BIG.has(g)) return { k: "big", g, h: `<span class="mbig${g.startsWith("∫") || g === "∬" || g === "∮" ? " mint" : ""}">${g}</span>`, lim: LIMOPS.has(g) };
          if (REL.has(g)) return { k: "rel", g, h: `<span class="mr">${g}</span>` };
          if (BIN.has(g)) return { k: "bin", g, h: `<span class="mb">${g}</span>` };
          return { k: "ord", h: ITALIC_GLYPH.test(g) ? `<i class="mi">${g}</i>` : `<span class="mg1">${g}</span>` };
        }
        return { k: "ord", h: identHtml(v) };
      }
      // operators
      const v = t.v;
      if (v === "/") return { k: "slash", h: "/" };
      if (v === "&") return { k: "sp", h: "" };
      if (v === "(" || v === "[" || v === "{") return { k: "open", h: v };
      if (v === ")" || v === "]" || v === "}") return { k: "close", h: v };
      if (v === "," || v === ";") return { k: "punct", h: `<span class="mp">${v}</span>` };
      if (v === "|") return { k: "ord", h: "|" };
      const g = SHORT[v] || v;
      if (REL.has(g)) return { k: "rel", g, h: `<span class="mr">${esc(g)}</span>` };
      if (BIN.has(g)) return { k: "bin", g, h: `<span class="mb">${esc(g)}</span>` };
      return { k: "ord", h: esc(g) };
    }

    function parseUnit(stop) {
      const sp = skipSp();
      const t = peek();
      if (!t) return null;
      if (stop && stop.includes(t.v) && t.t === "op") return null;
      p++;
      let u;
      if (t.t === "op" && t.v === "(") {
        const inner = join(parseSeq([")"]));
        if (peek() && peek().v === ")") p++;
        u = { k: "grp", h: `(${inner})`, inner };
      } else u = atom(t);
      while (peek() && peek().t === "op" && peek().v === "'") {
        p++;
        u = { ...u, k: u.k === "fn" ? "fn" : "ord", h: u.h + "′" };
      }
      let sup = null,
        sub = null;
      while (peek() && peek().t === "op" && (peek().v === "^" || peek().v === "_")) {
        const which = toks[p++].v;
        const a = scriptArg();
        if (which === "^") sup = a;
        else sub = a;
      }
      if (sup !== null || sub !== null) {
        if (display && u.lim) {
          u = { k: u.k === "big" ? "big" : "fn", h: `<span class="mlim">${sup !== null ? `<span class="mlim-u">${sup}</span>` : ""}${u.h}${sub !== null ? `<span class="mlim-d">${sub}</span>` : ""}</span>` };
        } else {
          const base = u.k === "grp" ? u.h : u.h;
          u = {
            k: u.k === "big" ? "big" : u.k === "fn" ? "fn" : "ord",
            h: `${base}<span class="mss${u.k === "big" && display ? " big" : ""}">${sup !== null ? `<sup>${sup}</sup>` : "<sup></sup>"}${sub !== null ? `<sub>${sub}</sub>` : ""}</span>`,
          };
          if (sub === null) u.h = `${base}<sup class="msup">${sup}</sup>`;
          else if (sup === null) u.h = `${base}<sub class="msub">${sub}</sub>`;
        }
      }
      u.sp = sp;
      return u;
    }

    let html = "";
    let guard = 0;
    while (p < toks.length && guard++ < 1000) {
      html += join(parseSeq(null));
      if (p < toks.length) {
        // stray closer
        html += esc(toks[p].v);
        p++;
      }
    }
    return html;
  }

  /* ---------- Scanning helpers ---------- */
  function matchBracket(s, j) {
    const open = s[j];
    const close = { "(": ")", "[": "]", "{": "}" }[open];
    let depth = 0;
    for (let i = j; i < s.length; i++) {
      const c = s[i];
      if (c === "\\") {
        i++;
        continue;
      }
      if (open !== "[" && c === '"') {
        const k = s.indexOf('"', i + 1);
        if (k < 0) return -1;
        i = k;
        continue;
      }
      if (open !== "[" && c === "[" ) {
        const k = matchBracket(s, i);
        if (k < 0) return -1;
        i = k;
        continue;
      }
      if (c === open) depth++;
      else if (c === close) {
        depth--;
        if (depth === 0) return i;
      }
    }
    return -1;
  }

  function parseCall(s, i) {
    const m = /^#([a-zA-Z][\w-]*(?:\.[a-zA-Z][\w-]*)*)/.exec(s.slice(i));
    if (!m) return null;
    let j = i + m[0].length;
    let args = null;
    const bodies = [];
    if (s[j] === "(") {
      const k = matchBracket(s, j);
      if (k < 0) return { name: m[1], args: s.slice(j + 1), bodies, end: s.length, broken: true };
      args = s.slice(j + 1, k);
      j = k + 1;
    }
    while (s[j] === "[") {
      const k = matchBracket(s, j);
      if (k < 0) break;
      bodies.push(s.slice(j + 1, k));
      j = k + 1;
    }
    return { name: m[1], args, body: bodies[0], bodies, end: j };
  }

  function splitTop(s, sep = ",") {
    const out = [];
    let depth = 0,
      cur = "";
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (c === '"') {
        const k = s.indexOf('"', i + 1);
        const e = k < 0 ? s.length - 1 : k;
        cur += s.slice(i, e + 1);
        i = e;
        continue;
      }
      if (c === "[") {
        const k = matchBracket(s, i);
        const e = k < 0 ? s.length - 1 : k;
        cur += s.slice(i, e + 1);
        i = e;
        continue;
      }
      if (c === "(" || c === "{") depth++;
      if (c === ")" || c === "}") depth--;
      if (c === sep && depth === 0) {
        out.push(cur);
        cur = "";
      } else cur += c;
    }
    if (cur.trim()) out.push(cur);
    return out.map((x) => x.trim()).filter(Boolean);
  }

  function parseArgs(a) {
    const pos = [];
    const named = {};
    for (const part of splitTop(a || "")) {
      const m = /^([a-z][\w-]*)\s*:\s*([\s\S]*)$/.exec(part);
      if (m && !part.startsWith("[") && !part.startsWith('"')) named[m[1]] = m[2].trim();
      else pos.push(part);
    }
    return { pos, named };
  }
  const unquote = (v) => (v && v.startsWith('"') ? v.slice(1, -1) : v);
  const uncontent = (v) => (v && v.startsWith("[") && v.endsWith("]") ? v.slice(1, -1) : v);

  /* ---------- Colours (independent of the UI theme, readable on every page colour) ---------- */
  const INK = { red: "#d64035", orange: "#d9821a", yellow: "#d4b106", green: "#2f9a5c", teal: "#1b98a6", blue: "#3d6fd9", purple: "#8f55d0", gray: "#8a8f98", black: "var(--pg-text)" };
  function colour(v) {
    if (!v) return null;
    v = v.trim();
    if (v === "ink") return "var(--pg-text)";
    const m = /^(\w+)\.lighten\((\d+)%\)$/.exec(v);
    if (m && INK[m[1]]) return `color-mix(in srgb, ${INK[m[1]]} ${Math.max(14, 100 - +m[2]) * 1.4}%, transparent)`;
    if (INK[v]) return INK[v];
    const r = /^rgb\("(#[0-9a-f]{3,8})"\)$/i.exec(v);
    if (r) return r[1];
    return null;
  }

  /* ---------- Inline markup ---------- */
  function findDelim(s, from, d) {
    for (let i = from; i < s.length; i++) {
      if (s[i] === "\\") {
        i++;
        continue;
      }
      if (s[i] === "$") {
        const k = s.indexOf("$", i + 1);
        if (k < 0) return -1;
        i = k;
        continue;
      }
      if (s[i] === "\n" && s[i + 1] === "\n") return -1;
      if (s[i] === d) return i;
    }
    return -1;
  }
  function findMathClose(s, from) {
    for (let i = from; i < s.length; i++) {
      if (s[i] === "\\") {
        i++;
        continue;
      }
      if (s[i] === '"') {
        const k = s.indexOf('"', i + 1);
        if (k > 0 && s.indexOf("$", i + 1) > k) {
          i = k;
          continue;
        }
      }
      if (s[i] === "$") return i;
    }
    return -1;
  }

  function inline(s, ctx, off = 0) {
    let out = "";
    let i = 0;
    while (i < s.length) {
      const c = s[i];
      if (c === "\\" && i + 1 < s.length) {
        if (s[i + 1] === "\n" || s[i + 1] === " ") {
          out += "<br>";
          i += 2;
          continue;
        }
        out += esc(s[i + 1]);
        i += 2;
        continue;
      }
      if (c === "$") {
        const j = findMathClose(s, i + 1);
        if (j < 0) {
          ctx.err(off + i, "niezamknięty wzór. Dodaj $ na końcu.");
          out += `<span class="wt-mi-source wt-err">${esc(s.slice(i))}</span>`;
          break;
        }
        const body = s.slice(i + 1, j);
        const disp = /^\s/.test(body) && /\s$/.test(body) && body.trim();
        out += disp ? `<span class="wt-mi-block m">${math(body, true)}</span>` : `<span class="wt-mi-inline m">${math(body, false)}</span>`;
        i = j + 1;
        continue;
      }
      if (c === "`") {
        const j = s.indexOf("`", i + 1);
        if (j > i) {
          out += `<code>${esc(s.slice(i + 1, j))}</code>`;
          i = j + 1;
          continue;
        }
      }
      if (c === "*" || c === "_") {
        const j = findDelim(s, i + 1, c);
        if (j > i + 1) {
          const tag = c === "*" ? "strong" : "em";
          out += `<${tag}>${inline(s.slice(i + 1, j), ctx, off + i + 1)}</${tag}>`;
          i = j + 1;
          continue;
        }
      }
      if (c === "#" && /[a-zA-Z]/.test(s[i + 1] || "")) {
        const call = parseCall(s, i);
        if (call) {
          out += inlineCall(call, ctx, off + i, s.slice(i, call.end));
          i = call.end;
          continue;
        }
      }
      if (c === "@" && /[a-zA-Z]/.test(s[i + 1] || "") && (i === 0 || /\s|\(/.test(s[i - 1]))) {
        const m = /^@([\w:.-]*\w)/.exec(s.slice(i));
        const ref = ctx.labels && ctx.labels[m[1]];
        out += `<a class="tref${ref ? "" : " missing"}" title="${ref ? "" : "Brak etykiety"}">${ref ? esc(ref) : esc(m[1])}</a>`;
        i += m[0].length;
        continue;
      }
      if (c === "<" && /^<[\w:.-]+>/.test(s.slice(i))) {
        const m = /^<([\w:.-]+)>/.exec(s.slice(i));
        i += m[0].length;
        continue;
      }
      if (s.startsWith("---", i)) {
        out += "—";
        i += 3;
        continue;
      }
      if (s.startsWith("--", i)) {
        out += "–";
        i += 2;
        continue;
      }
      if (c === "~") {
        out += "&nbsp;";
        i++;
        continue;
      }
      if (c === "/" && s[i + 1] === "/" && (i === 0 || s[i - 1] !== ":")) {
        const k = s.indexOf("\n", i);
        i = k < 0 ? s.length : k;
        continue;
      }
      out += esc(c);
      i++;
    }
    return out;
  }

  function inlineCall(call, ctx, off, src) {
    const { name } = call;
    const a = parseArgs(call.args);
    const body = () => inline(call.body ?? uncontent(a.pos[0] || "") ?? "", ctx, off + src.indexOf("[") + 1);
    switch (name) {
      case "highlight": {
        const f = colour(a.named.fill);
        return `<mark${f ? ` style="background:${f}"` : ""}>${body()}</mark>`;
      }
      case "underline":
        return `<u>${body()}</u>`;
      case "strike":
        return `<s>${body()}</s>`;
      case "overline":
        return `<span style="text-decoration:overline">${body()}</span>`;
      case "super":
        return `<sup>${body()}</sup>`;
      case "sub":
        return `<sub>${body()}</sub>`;
      case "emph":
        return `<em>${body()}</em>`;
      case "strong":
        return `<strong>${body()}</strong>`;
      case "smallcaps":
        return `<span style="font-variant:small-caps">${body()}</span>`;
      case "text": {
        const f = colour(a.named.fill);
        const size = a.named.size ? `font-size:${parseFloat(a.named.size) / 11}em;` : "";
        return `<span style="${f ? `color:${f};` : ""}${size}">${body()}</span>`;
      }
      case "link": {
        const url = unquote(a.pos[0] || "");
        return `<a class="tlink" title="${esc(url)}">${call.body !== undefined ? body() : esc(url.replace(/^https?:\/\//, ""))}</a>`;
      }
      case "footnote": {
        ctx.footnotes.push(body());
        return `<sup class="tfn">${ctx.footnotes.length}</sup>`;
      }
      case "box":
        return `<span class="tbox">${body()}</span>`;
      case "h":
        return '<span style="display:inline-block;width:1em"></span>';
      case "linebreak":
        return "<br>";
      case "datetime.today":
        return esc(new Date().toLocaleDateString("pl-PL"));
      case "lorem":
        return "Lorem ipsum dolor sit amet, consectetur adipiscing elit.";
      default:
        if (name.startsWith("sym.") && SYM.has(name.slice(4))) return SYM.get(name.slice(4));
        return `<span class="wt-markup">${esc(src)}</span>`;
    }
  }

  /* ---------- Blocks ---------- */
  const PRE = /^\s*#(import|show|set|let|include)\b/;
  const isList = (l) => /^\s*([-+]|\/)\s/.test(l) || /^\s*\d+\.\s/.test(l);
  const isBlockStart = (l) => /^=+\s/.test(l) || isList(l) || /^\s*```/.test(l) || /^\s*\/\//.test(l) || /^\$(\s|$)/.test(l) || (/^#[a-zA-Z]/.test(l) && !/^#(highlight|underline|strike|text|link|emph|strong|super|sub|footnote|sym)\b/.test(l));

  function consumeBalanced(lines, i) {
    let depth = 0;
    let first = true;
    while (i < lines.length && (first || depth > 0)) {
      const L = lines[i];
      first = false;
      for (let k = 0; k < L.length; k++) {
        const c = L[k];
        if (c === "\\") {
          k++;
          continue;
        }
        if (c === '"') {
          const e = L.indexOf('"', k + 1);
          if (e > 0) k = e;
          continue;
        }
        if (c === "/" && L[k + 1] === "/" && L[k - 1] !== ":") break;
        if ("([{".includes(c)) depth++;
        else if (")]}".includes(c)) depth--;
      }
      i++;
      if (depth > 0 && i < lines.length && lines[i].trim() === "" && lines[i + 1] !== undefined && /^\S/.test(lines[i + 1]) && !/^[\])}]/.test(lines[i + 1].trim()) && depth > 3) break;
    }
    return i;
  }

  function splitBlocks(src) {
    const lines = src.split("\n");
    const blocks = [];
    let i = 0;
    while (i < lines.length) {
      const L = lines[i];
      if (L.trim() === "") {
        i++;
        continue;
      }
      const start = i;
      let kind;
      if (/^\s*```/.test(L)) {
        kind = "fence";
        i++;
        while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) i++;
        i = Math.min(i + 1, lines.length);
      } else if (PRE.test(L)) {
        kind = "pre";
        while (i < lines.length && PRE.test(lines[i])) i = consumeBalanced(lines, i);
      } else if (/^\s*\/\//.test(L)) {
        kind = "comment";
        while (i < lines.length && /^\s*\/\//.test(lines[i])) i++;
      } else if (/^=+\s/.test(L) || /^=+$/.test(L)) {
        kind = "heading";
        i++;
      } else if (isList(L)) {
        kind = "list";
        i++;
        while (i < lines.length && lines[i].trim() !== "" && (isList(lines[i]) || /^\s+\S/.test(lines[i]))) i++;
      } else if (/^\$(\s|$)/.test(L)) {
        kind = "math";
        let n = 0;
        while (i < lines.length) {
          if (lines[i].trim() === "" && i > start) break;
          n += (lines[i].replace(/\\\$/g, "").match(/\$/g) || []).length;
          i++;
          if (n % 2 === 0) break;
        }
      } else if (/^#[a-zA-Z]/.test(L) && isBlockStart(L)) {
        kind = "call";
        i = consumeBalanced(lines, i);
      } else {
        kind = "para";
        i++;
        while (i < lines.length && lines[i].trim() !== "" && !isBlockStart(lines[i])) i++;
      }
      blocks.push({ kind, start, end: i - 1, text: lines.slice(start, i).join("\n") });
    }
    return blocks;
  }

  const THM = {
    definition: { label: "Definicja", c: "#3d6fd9", n: "thm" },
    theorem: { label: "Twierdzenie", c: "#8f55d0", n: "thm" },
    lemma: { label: "Lemat", c: "#8f55d0", n: "thm" },
    corollary: { label: "Wniosek", c: "#8f55d0", n: "thm" },
    proof: { label: "Dowód", c: "#8a8f98", n: null },
    example: { label: "Przykład", c: "#2f9a5c", n: "ex" },
    note: { label: "Uwaga", c: "#d9821a", n: null },
    remark: { label: "Uwaga", c: "#d9821a", n: null },
    exercise: { label: "Zadanie", c: "#1b98a6", n: "zad" },
  };
  const SHAPE_CALLS = { polygon: "tri", "polygon.regular": "poly", rect: "rect", square: "square", circle: "circle", ellipse: "ellipse", line: "seg", "cetz.canvas": "cetz" };

  function shapeSvg(name, args) {
    const a = parseArgs(args);
    let id = SHAPE_CALLS[name];
    if (id === "cetz") {
      const s = args || "";
      id = /plot\./.test(s) ? "plot" : /angle\(/.test(s) ? "angle" : /arc\(/.test(s) ? "arc" : /\(-3/.test(s) ? "axes" : "arrow";
    }
    if (id === "tri" && a.pos.length > 3) id = "poly";
    const sh = SHAPES.find((x) => x.id === id) || SHAPES[0];
    let stroke = "var(--pg-text)",
      sw = 2,
      fill = "none",
      dash = "";
    const st = a.named.stroke;
    if (st) {
      const m = /([\d.]+)pt/.exec(st);
      if (m) sw = { 0.5: 1.25, 1: 2, 2: 3.5 }[+m[1]] || +m[1] * 2;
      const cm = /\+\s*([\w.()%]+)/.exec(st) || /^(\w+)$/.exec(st.trim());
      if (cm) stroke = colour(cm[1]) || stroke;
      if (/dash:\s*"dashed"/.test(st)) dash = "6 5";
      if (/dash:\s*"dotted"/.test(st)) dash = "1.5 4";
    }
    if (a.named.fill && a.named.fill !== "none") fill = colour(a.named.fill) || "none";
    return `<svg class="shp" viewBox="0 0 320 220" style="--s:${stroke};--sw:${sw};--fl:${fill};--dash:${dash || "none"}">${sh.svg}</svg>`;
  }

  function renderTable(args, ctx, off) {
    const a = parseArgs(args);
    let cols = 1;
    const c = a.named.columns || "1";
    if (/^\d+$/.test(c)) cols = +c;
    else if (c.startsWith("(")) cols = splitTop(c.slice(1, -1)).length;
    let head = [];
    const cells = [];
    for (const p of a.pos) {
      if (p.startsWith("table.header(")) head = splitTop(p.slice(13, -1)).map((x) => inline(uncontent(x), ctx, off));
      else if (p.startsWith("table.")) continue;
      else cells.push(inline(uncontent(p), ctx, off));
    }
    const st = (a.named.stroke || "").replace(/\s/g, "");
    const cls = st === "none" ? "tt-none" : st === "(x:none)" ? "tt-h" : "tt-grid";
    const rows = [];
    for (let i = 0; i < cells.length; i += cols) rows.push(cells.slice(i, i + cols));
    const tr = (r, tag) => `<tr>${Array.from({ length: cols }, (_, i) => `<${tag}>${r[i] ?? ""}</${tag}>`).join("")}</tr>`;
    return `<table class="ttable ${cls}">${head.length ? `<thead>${tr(head, "th")}</thead>` : ""}<tbody>${rows.map((r) => tr(r, "td")).join("")}</tbody></table>`;
  }

  function renderList(text, ctx, off) {
    const lines = text.split("\n");
    const items = [];
    let pos = 0;
    for (const L of lines) {
      const m = /^(\s*)([-+]|\/|\d+\.)\s(.*)$/.exec(L);
      if (m) items.push({ lvl: Math.floor(m[1].length / 2), type: m[2] === "-" ? "ul" : m[2] === "/" ? "dl" : "ol", text: m[3], off: pos + m[1].length + m[2].length + 1 });
      else if (items.length) items[items.length - 1].text += " " + L.trim();
      pos += L.length + 1;
    }
    let html = "";
    const stack = [];
    for (const it of items) {
      while (stack.length > it.lvl + 1 || (stack.length === it.lvl + 1 && stack[stack.length - 1] !== it.type)) html += `</${stack.pop()}>`;
      while (stack.length < it.lvl + 1) {
        stack.push(it.type);
        html += `<${it.type}>`;
      }
      if (it.type === "dl") {
        const k = it.text.indexOf(":");
        html += `<dt>${inline(it.text.slice(0, k), ctx, off + it.off)}</dt><dd>${inline(it.text.slice(k + 1).trim(), ctx, off + it.off + k + 1)}</dd>`;
      } else html += `<li>${inline(it.text, ctx, off + it.off)}</li>`;
    }
    while (stack.length) html += `</${stack.pop()}>`;
    return html;
  }

  const PY_KW = /\b(def|return|for|in|range|import|from|if|else|elif|while|class|lambda|and|or|not|None|True|False|sum|print|let|const|function)\b/g;
  function codeHl(code) {
    return esc(code)
      .replace(/(#[^\n]*|\/\/[^\n]*)/g, '<span class="c-com">$1</span>')
      .replace(PY_KW, '<span class="c-kw">$1</span>')
      .replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="c-num">$1</span>');
  }

  function blockHtml(b, ctx) {
    const off = 0;
    const t = b.text;
    switch (b.kind) {
      case "comment":
        return "";
      case "pre": {
        const date = /date:\s*"(\d{4})-(\d{2})-(\d{2})"/.exec(t);
        const tpl = /#import\s+"([^"]+)"/.exec(t);
        if (!tpl && !date) return `<div class="tpre muted">Ustawienia dokumentu</div>`;
        const d = date ? new Date(+date[1], +date[2] - 1, +date[3]).toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric" }) : "";
        return `<div class="tpre"><span>${tpl ? esc(tpl[1].replace(".typ", "")).replace("lecture", "Wykład") : ""}</span><span>${d}</span></div>`;
      }
      case "heading": {
        const m = /^(=+)\s*(.*)$/.exec(t);
        const lvl = Math.min(m[1].length, 4);
        ctx.heads.push({ lvl, text: m[2], line: b.start });
        return `<h${lvl}>${inline(m[2], ctx, m[1].length + 1)}</h${lvl}>`;
      }
      case "list":
        return renderList(t, ctx, off);
      case "fence": {
        const lines = t.split("\n");
        const lang = lines[0].trim().slice(3);
        const closed = lines.length > 1 && /^\s*```\s*$/.test(lines[lines.length - 1]);
        const code = lines.slice(1, closed ? -1 : undefined).join("\n");
        return `<pre${lang ? ` data-lang="${esc(lang)}"` : ""}><code>${codeHl(code)}</code></pre>`;
      }
      case "math": {
        const n = (t.replace(/\\\$/g, "").match(/\$/g) || []).length;
        if (n % 2) {
          ctx.err(0, "niezamknięty wzór. Dodaj $ na końcu.");
          return `<p><span class="wt-mi-source wt-err">${esc(t)}</span></p>`;
        }
        const inner = t.trim().slice(1, -1);
        const lab = /<([\w:.-]+)>\s*$/.exec(t);
        if (lab) {
          ctx.eq++;
          ctx.labels[lab[1]] = `(${ctx.eq})`;
        }
        return `<div class="wt-mi-block m">${math(inner, true)}${lab ? `<span class="eqn">(${ctx.eq})</span>` : ""}</div>`;
      }
      case "call":
        return callBlock(b, ctx);
      default:
        return `<p>${inline(t, ctx, off)}</p>`;
    }
  }

  function callBlock(b, ctx) {
    const t = b.text.trim();
    const call = parseCall(t, 0);
    if (!call) return `<p>${inline(t, ctx)}</p>`;
    if (call.broken) {
      ctx.err(t.length - 1, "brakuje nawiasu zamykającego „)”.");
      return `<p><span class="wt-markup wt-err">${esc(t)}</span></p>`;
    }
    const rest = t.slice(call.end).trim();
    const tail = rest ? ` ${inline(rest, ctx, call.end)}` : "";
    const name = call.name;
    const a = parseArgs(call.args);
    const bodyOff = t.indexOf("[") + 1;
    const body = () => inlineBlocky(call.body ?? uncontent(a.pos.find((x) => x.startsWith("[")) || ""), ctx, bodyOff);

    if (THM[name]) {
      const k = THM[name];
      let num = "";
      if (k.n) {
        ctx.cnt[k.n] = (ctx.cnt[k.n] || 0) + 1;
        num = " " + ctx.cnt[k.n];
      }
      const title = a.named.title ? ` <span class="tthm-t">(${inline(unquote(a.named.title), ctx)})</span>` : "";
      return `<div class="tthm" style="--blk:${k.c}"><span class="tthm-l">${k.label}${num}${title}.</span> ${body()}${name === "proof" ? '<span class="qed">∎</span>' : ""}</div>${tail}`;
    }
    switch (name) {
      case "quote": {
        const attr = a.named.attribution ? `<footer>— ${inline(uncontent(unquote(a.named.attribution)), ctx)}</footer>` : "";
        return `<blockquote>${body()}${attr}</blockquote>`;
      }
      case "table":
        return renderTable(call.args, ctx, 0);
      case "figure": {
        ctx.cnt.fig = (ctx.cnt.fig || 0) + 1;
        const first = a.pos[0] || "";
        let inner;
        const fc = parseCall("#" + first, 0);
        if (fc && (SHAPE_CALLS[fc.name] || fc.name === "cetz.canvas")) inner = shapeSvg(fc.name, fc.args);
        else if (fc && fc.name === "table") inner = renderTable(fc.args, ctx, 0);
        else if (fc && fc.name === "image") inner = imageBox(fc.args);
        else inner = inline(uncontent(first), ctx);
        const cap = a.named.caption ? `<figcaption>Rys. ${ctx.cnt.fig}. ${inline(uncontent(a.named.caption), ctx)}</figcaption>` : "";
        return `<figure class="tfig">${inner}${cap}</figure>`;
      }
      case "image":
        return `<figure class="tfig">${imageBox(call.args)}</figure>`;
      case "pagebreak":
        return '<div class="tpb"><span>Podział strony</span></div>';
      case "outline":
        return `<nav class="toutline" data-outline><div class="toutline-h">Spis treści</div></nav>`;
      case "align": {
        const al = (a.pos[0] || "left").replace(/\s/g, "");
        const ta = al.includes("center") ? "center" : al.includes("right") ? "right" : al.includes("justify") ? "justify" : "left";
        return `<div style="text-align:${ta}">${body()}</div>`;
      }
      case "v":
        return `<div style="height:${parseFloat(a.pos[0]) || 1}em"></div>`;
      case "block":
      case "box":
        return `<div class="tbox">${body()}</div>`;
      case "columns":
        return `<div style="columns:${a.pos[0] || 2};column-gap:2em">${body()}</div>`;
      default:
        if (SHAPE_CALLS[name]) return `<figure class="tfig">${shapeSvg(name, call.args)}</figure>${tail}`;
        return `<p>${inline(t, ctx)}</p>`;
    }
  }

  function imageBox(args) {
    const a = parseArgs(args);
    const f = unquote(a.pos[0] || "obraz.png");
    return `<div class="timg">${icon("image")}<span>${esc(f)}</span></div>`;
  }

  // Content blocks may hold several paragraphs, lists or math.
  function inlineBlocky(s, ctx, off) {
    if (!/\n\s*\n|\n\s*[-+]\s|\n\$/.test(s)) return inline(s.trim(), ctx, off);
    return splitBlocks(s.trim())
      .map((b) => blockHtml(b, ctx))
      .join("");
  }

  /* ---------- Render a whole note ---------- */
  function render(src) {
    const blocks = splitBlocks(src);
    const diags = [];
    const ctx = { footnotes: [], heads: [], labels: {}, cnt: {}, eq: 0, err: null };
    // first pass: labels for headings
    const out = blocks.map((b, idx) => {
      ctx.err = (pos, msg) => {
        const before = b.text.slice(0, Math.max(0, pos));
        const line = b.start + (before.match(/\n/g) || []).length;
        const col = pos - (before.lastIndexOf("\n") + 1);
        diags.push({ line, col: Math.max(0, col), msg, block: idx });
      };
      let h;
      try {
        h = blockHtml(b, ctx);
      } catch (e) {
        h = `<p class="wt-markup">${esc(b.text)}</p>`;
      }
      return h;
    });
    // outline
    for (let i = 0; i < out.length; i++) {
      if (out[i].includes("data-outline")) {
        const items = ctx.heads.map((h) => `<a class="toutline-i" style="--l:${h.lvl}" data-line="${h.line}">${inline(h.text, { ...ctx, err: () => {}, footnotes: [] })}</a>`).join("");
        out[i] = out[i].replace("</nav>", items + "</nav>");
      }
    }
    return { blocks, html: out, diags, footnotes: ctx.footnotes, heads: ctx.heads };
  }

  /* ---------- Source highlighter ---------- */
  const KW = new Set(["import", "show", "set", "let", "include", "if", "else", "for", "while", "return", "in", "context"]);
  function highlight(src, diags = []) {
    const lines = src.split("\n");
    const res = [];
    let inMath = false,
      inFence = false;
    const stack = ["m"]; // m = markup, c = code, k = content
    for (let ln = 0; ln < lines.length; ln++) {
      const L = lines[ln];
      const toks = [];
      const push = (t, c = "") => {
        if (t) toks.push([t, c]);
      };
      if (/^\s*```/.test(L) || inFence) {
        if (/^\s*```/.test(L)) inFence = !inFence;
        push(L, "hl-raw");
        res.push(finish(toks, ln, diags));
        continue;
      }
      if (L.trim() === "") inMath = false;
      let i = 0;
      const top = () => stack[stack.length - 1];
      if (!inMath && top() === "m") {
        let m;
        if ((m = /^(=+)(\s.*)?$/.exec(L))) {
          push(m[1], "hl-mk");
          push(m[2] || "", "hl-h");
          i = L.length;
        } else if ((m = /^(\s*)([-+]|\/|\d+\.)(\s)/.exec(L))) {
          push(m[1]);
          push(m[2], "hl-mk");
          push(m[3]);
          i = m[0].length;
        }
      }
      while (i < L.length) {
        const c = L[i];
        const mode = top();
        if (inMath) {
          let j = i;
          while (j < L.length && L[j] !== "$") {
            if (L[j] === "\\") j++;
            j++;
          }
          push(L.slice(i, j), "hl-math");
          if (j < L.length) {
            push("$", "hl-math hl-mk");
            inMath = false;
            j++;
          }
          i = j;
          continue;
        }
        if (c === "/" && L[i + 1] === "/" && L[i - 1] !== ":") {
          push(L.slice(i), "hl-com");
          break;
        }
        if (mode === "c") {
          if (c === '"') {
            let j = L.indexOf('"', i + 1);
            j = j < 0 ? L.length : j + 1;
            push(L.slice(i, j), "hl-str");
            i = j;
            continue;
          }
          const num = /^\d+(?:\.\d+)?(?:pt|cm|mm|em|fr|%|deg|in)?/.exec(L.slice(i));
          if (num && !/[\w.]/.test(L[i - 1] || "")) {
            push(num[0], "hl-num");
            i += num[0].length;
            continue;
          }
          const id = /^[a-zA-Z][\w-]*(?:\.[a-zA-Z][\w-]*)*/.exec(L.slice(i));
          if (id) {
            const after = L.slice(i + id[0].length);
            const cls = /^\s*:/.test(after) && !/^\s*:\s*:/.test(after) ? "hl-lbl" : /^\(/.test(after) ? "hl-fn" : KW.has(id[0]) ? "hl-kw" : "hl-id";
            push(id[0], cls);
            i += id[0].length;
            continue;
          }
          if (c === "(" || c === "{") stack.push("c");
          else if ((c === ")" || c === "}") && stack.length > 1) stack.pop();
          else if (c === "[") stack.push("k");
          else if (c === "$") {
            push("$", "hl-math hl-mk");
            inMath = true;
            i++;
            continue;
          }
          push(c, "hl-p");
          i++;
          continue;
        }
        // markup or content
        if (c === "\\") {
          push(L.slice(i, i + 2), "hl-mk");
          i += 2;
          continue;
        }
        if (c === "$") {
          push("$", "hl-math hl-mk");
          inMath = true;
          i++;
          continue;
        }
        if (c === "#" && /[a-zA-Z]/.test(L[i + 1] || "")) {
          const id = /^#([a-zA-Z][\w-]*(?:\.[a-zA-Z][\w-]*)*)/.exec(L.slice(i));
          push(id[0], KW.has(id[1]) ? "hl-kw" : "hl-fn");
          i += id[0].length;
          if (KW.has(id[1])) {
            // rest of a set/show/import/let line is code
            const rest = L.slice(i);
            stack.push("c");
            let depth = 0;
            const save = stack.length;
            // highlight the rest as code, then return to markup
            let j = 0;
            while (j < rest.length) {
              const ch = rest[j];
              if (ch === '"') {
                let e = rest.indexOf('"', j + 1);
                e = e < 0 ? rest.length : e + 1;
                push(rest.slice(j, e), "hl-str");
                j = e;
                continue;
              }
              const num = /^\d+(?:\.\d+)?(?:pt|cm|mm|em|fr|%)?/.exec(rest.slice(j));
              if (num && !/[\w.]/.test(rest[j - 1] || "")) {
                push(num[0], "hl-num");
                j += num[0].length;
                continue;
              }
              const w = /^[a-zA-Z][\w-]*(?:\.[a-zA-Z][\w-]*)*/.exec(rest.slice(j));
              if (w) {
                const after = rest.slice(j + w[0].length);
                push(w[0], /^\s*:(?!\s*$)/.test(after) && depth > 0 ? "hl-lbl" : /^\(/.test(after) ? "hl-fn" : KW.has(w[0]) ? "hl-kw" : "hl-id");
                j += w[0].length;
                continue;
              }
              if (ch === "(" || ch === "[") depth++;
              if (ch === ")" || ch === "]") depth--;
              push(ch, "hl-p");
              j++;
            }
            stack.length = save - 1;
            i = L.length;
            continue;
          }
          if (L[i] === "(") {
            stack.push("c");
            push("(", "hl-p");
            i++;
          } else if (L[i] === "[") {
            stack.push("k");
            push("[", "hl-p");
            i++;
          }
          continue;
        }
        if (c === "]" && mode === "k") {
          stack.pop();
          push("]", "hl-p");
          i++;
          if (L[i] === "[") {
            stack.push("k");
            push("[", "hl-p");
            i++;
          }
          continue;
        }
        if (c === "[" && mode === "k") {
          stack.push("k");
          push(c);
          i++;
          continue;
        }
        if (c === "*" || c === "_") {
          push(c, "hl-mk");
          i++;
          continue;
        }
        if (c === "`") {
          let j = L.indexOf("`", i + 1);
          j = j < 0 ? L.length : j + 1;
          push(L.slice(i, j), "hl-raw");
          i = j;
          continue;
        }
        if (c === "@" && /[a-zA-Z]/.test(L[i + 1] || "")) {
          const m = /^@[\w:.-]*\w/.exec(L.slice(i));
          push(m[0], "hl-lbl");
          i += m[0].length;
          continue;
        }
        if (c === "<" && /^<[\w:.-]+>/.test(L.slice(i))) {
          const m = /^<[\w:.-]+>/.exec(L.slice(i));
          push(m[0], "hl-lbl");
          i += m[0].length;
          continue;
        }
        // plain run
        let j = i + 1;
        while (j < L.length && !"\\$#]*_`@</[".includes(L[j])) j++;
        push(L.slice(i, j));
        i = j;
      }
      res.push(finish(toks, ln, diags));
    }
    return res;
  }

  function finish(toks, ln, diags) {
    const d = diags.find((x) => x.line === ln);
    let pos = 0;
    let h = "";
    for (const [t, c] of toks) {
      const end = pos + t.length;
      if (d && end > d.col) {
        const cut = Math.max(0, d.col - pos);
        if (cut > 0) h += span(t.slice(0, cut), c);
        h += span(t.slice(cut), (c + " wt-err").trim());
      } else h += span(t, c);
      pos = end;
    }
    return h;
  }
  const span = (t, c) => (c ? `<span class="${c}">${esc(t)}</span>` : esc(t));

  /* ---------- Misc ---------- */
  function wordCount(src) {
    const t = src
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/\/\/.*$/gm, " ")
      .replace(/^\s*#(import|show|set|let).*$/gm, " ")
      .replace(/\$[^$]*\$/g, " x ")
      .replace(/#[a-zA-Z.]+(\([^)]*\))?/g, " ")
      .replace(/[[\]*_=#`]/g, " ");
    return (t.match(/[\p{L}\p{N}]+/gu) || []).length;
  }

  return { render, highlight, splitBlocks, math, inline: (s) => inline(s, { footnotes: [], heads: [], labels: {}, cnt: {}, err: () => {} }), wordCount, esc, shapeSvg };
})();
