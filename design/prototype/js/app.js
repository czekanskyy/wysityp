/* WYSITyp prototype – state, shell, tabs, sidebar, editor, status bar and keyboard.
   Popups live in popups.js, the settings tab in settings.js. boot() runs from index.html. */
"use strict";

/* ---------- Helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = TY.esc;
function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}
const STORE_KEY = "wysityp:proto";
const store = {
  get(d) {
    try {
      const v = localStorage.getItem(STORE_KEY);
      return v ? JSON.parse(v) : d;
    } catch {
      return d;
    }
  },
  set(v) {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(v));
    } catch {
      /* private window or blocked storage: the prototype keeps working in memory */
    }
  },
  clear() {
    try {
      localStorage.removeItem(STORE_KEY);
    } catch {
      /* ignore */
    }
  },
};
const clone = (o) => JSON.parse(JSON.stringify(o));
const ACT = Object.fromEntries(ACTIONS.map((a) => [a.id, a]));
function keyOf(id) {
  const o = S.settings.keys[id];
  return o !== undefined ? o : ACT[id] ? ACT[id].key : "";
}
function kbd(key) {
  if (!key) return "";
  return `<span class="wt-kbd">${key
    .split(/\+(?=.)/)
    .map((k) => `<kbd>${esc(k)}</kbd>`)
    .join("")}</span>`;
}
function tip(id) {
  const k = keyOf(id);
  return ACT[id].label + (k ? ` (${k})` : "");
}
function slug(s) {
  return (
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/ł/g, "l")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "notatka"
  );
}
const TODAY = new Date();
const todayIso = () => TODAY.toISOString().slice(0, 10);
const todayPl = () => TODAY.toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric" });

/* ---------- Settings ---------- */
const DEFAULTS = {
  locale: "pl",
  theme: "system",
  page_color: "white",
  page_follow: false,
  accent: "blue",
  ui_size: "m",
  source_font: "JetBrains Mono",
  source_size: 13,
  ligatures: false,
  render_font: "Inter",
  render_size: 17,
  line_height: 1.65,
  align: "left",
  view: "split",
  line_numbers: true,
  wrap: true,
  autopair: true,
  list_continue: true,
  spellcheck: false,
  toolbar: "compact",
  status_bar: true,
  ui_style: "fixed",
  status_autohide: false,
  vtb_autohide: true,
  autosave: true,
  autosave_delay: 1,
  restore_tabs: true,
  preview_tabs: true,
  confirm_delete: true,
  pdf_paper: "A4",
  pdf_margin: 2.5,
  pdf_numbers: true,
  pdf_open: false,
  packages_online: true,
  drafts_dir: "~/Dokumenty/WYSITyp/Szkice",
  keys: {},
};
const SOURCE_FONTS = {
  "JetBrains Mono": '"JetBrains Mono", "Cascadia Mono", Consolas, monospace',
  "Cascadia Code": '"Cascadia Code", "Cascadia Mono", Consolas, monospace',
  "Fira Code": '"Fira Code", "Cascadia Mono", Consolas, monospace',
  Consolas: 'Consolas, "Cascadia Mono", monospace',
};
const RENDER_FONTS = {
  Inter: 'Inter, "Segoe UI Variable Text", "Segoe UI", system-ui, sans-serif',
  "Libertinus Serif": '"Libertinus Serif", "Iowan Old Style", Cambria, Georgia, serif',
  "New Computer Modern": '"New Computer Modern", "Latin Modern Roman", "CMU Serif", Cambria, serif',
  "Source Serif 4": '"Source Serif 4", "Source Serif Pro", Georgia, serif',
};
const UI_ZOOM = { s: 0.92, m: 1, l: 1.15 };
const darkMq = window.matchMedia("(prefers-color-scheme: dark)");
function resolvedTheme() {
  const t = S.settings.theme;
  return t === "system" ? (darkMq.matches ? "dark" : "light") : t;
}
function resolvedPage() {
  if (S.settings.page_follow) return resolvedTheme() === "dark" ? "graphite" : "white";
  return S.settings.page_color;
}
function applySettings() {
  const st = S.settings;
  const r = document.documentElement;
  // The app leaves data-theme off for "system"; tokens.css has no media query, so the prototype resolves it here.
  r.dataset.theme = resolvedTheme();
  r.dataset.pg = resolvedPage();
  r.dataset.accent = st.accent;
  // Two looks: "fixed" keeps bars on the window edges, "float" puts glass bars and dialogs over the content.
  r.dataset.ui = st.ui_style === "float" ? "float" : "fixed";
  r.toggleAttribute("data-status-auto", !!st.status_autohide);
  r.toggleAttribute("data-vtb-auto", !!st.vtb_autohide);
  r.lang = st.locale;
  const z = UI_ZOOM[st.ui_size] || 1;
  r.style.setProperty("--ui-zoom", z);
  if (z !== 1) r.dataset.zoom = "";
  else delete r.dataset.zoom;
  r.style.setProperty("--src-font", SOURCE_FONTS[st.source_font] || SOURCE_FONTS["JetBrains Mono"]);
  r.style.setProperty("--src-size", st.source_size + "px");
  r.style.setProperty("--src-lig", st.ligatures ? "normal" : "none");
  r.style.setProperty("--pg-font", RENDER_FONTS[st.render_font] || RENDER_FONTS.Inter);
  r.style.setProperty("--pg-size", st.render_size + "px");
  r.style.setProperty("--pg-lh", st.line_height);
  r.style.setProperty("--pg-align", st.align);
  $("#status") && ($("#status").hidden = !st.status_bar);
  if (E) requestAnimationFrame(() => applyPageView());
}
darkMq.addEventListener("change", () => {
  applySettings();
  if (S.active === "settings") renderView();
});

/* ---------- State ---------- */
function freshState() {
  return {
    settings: clone(DEFAULTS),
    ws: "sem3",
    notes: clone(NOTES),
    trees: clone(Object.fromEntries(Object.entries(WORKSPACES).map(([k, w]) => [k, w.tree]))),
    collapsed: ["f-fiz", "f-an-c"],
    deco: clone(DECO_DEFAULTS),
    tabs: ["n-w7", "n-lab2"],
    active: "n-w7",
    lastTab: "n-w7",
    tagDefs: clone(TAGS),
    pv: { split: { fit: "width", zoom: 1 }, page: { fit: null, zoom: 1 }, outside: "theme", round: true },
    split: 0.5,
    problems: { open: false, h: 200 },
    preview: null,
    closed: [],
    sidebar: true,
    sbw: 264,
    loose: [],
    drafts: [],
    recent: ["n-w7", "n-lab2", "n-w6", "n-alg2", "n-c3", "n-kin", "n-alg1", "n-l4"],
    recentWs: ["sem3", "sem2"],
    recentSyms: ["alpha", "integral", "arrow.r", "RR", "infinity", "lt.eq", "sum", "partial"],
    tagFilter: null,
    view: null,
    sec: { root: true, loose: true, drafts: true },
    settingsSection: "appearance",
    search: { open: false, q: "", rep: "", showRep: false, case: false, word: false, re: false, accent: false, current: false, loose: true },
  };
}
let S = freshState();
let E = null; // the open editor, see editorView()

function loadState() {
  const saved = store.get(null);
  if (saved && saved.v === 2) {
    const f = freshState();
    S = { ...f, ...saved.st, settings: { ...f.settings, ...saved.st.settings, keys: { ...(saved.st.settings || {}).keys } } };
    S.search = { ...f.search, ...(saved.st.search || {}), open: false };
    S.pv = { ...f.pv, ...(saved.st.pv || {}) };
    S.problems = { ...f.problems, ...(saved.st.problems || {}) };
    S.tagDefs = { ...f.tagDefs, ...(saved.st.tagDefs || {}) };
    if (!S.settings.restore_tabs) {
      S.tabs = [];
      S.active = "home";
    }
  }
  for (const id in S.notes) {
    const n = S.notes[id];
    n.disk = n.source;
    n.phase = "saved";
  }
  // The start page is a full-screen view, never a tab.
  S.tabs = S.tabs.filter((t) => t === "settings" || S.notes[t]);
  if (S.active !== "home" && !S.tabs.includes(S.active)) S.active = S.tabs[0] || "home";
}
let persistT = 0;
function persist() {
  clearTimeout(persistT);
  persistT = setTimeout(() => {
    const st = { ...S, notes: {} };
    for (const id in S.notes) {
      const { disk, phase, timer, other, ...rest } = S.notes[id];
      void phase, timer, other;
      st.notes[id] = { ...rest, source: disk };
    }
    store.set({ v: 2, st });
  }, 150);
}
function view() {
  return S.view || S.settings.view;
}

/* ---------- Workspace helpers ---------- */
const WS = () => (S.ws ? WORKSPACES[S.ws] : null);
const isFolder = (it) => it && typeof it === "object";
const rootName = (ws = S.ws) => WORKSPACES[ws].path.split("/").pop();
/* Walk a tree; calls fn(item, parentFolder|null, list, trail of folders) for every item. */
function walk(list, fn, parent = null, trail = []) {
  for (const it of list) {
    if (fn(it, parent, list, trail) === false) return false;
    if (isFolder(it) && walk(it.children, fn, it, [...trail, it]) === false) return false;
  }
}
function locate(id) {
  for (const ws in S.trees) {
    let hit = null;
    walk(S.trees[ws], (it, parent, list, trail) => {
      if (it === id) return ((hit = { ws, folder: parent, list, trail }), false);
    });
    if (hit) return hit;
  }
  return null;
}
function findFolder(fid) {
  for (const ws in S.trees) {
    let hit = null;
    walk(S.trees[ws], (it, parent, list, trail) => {
      if (isFolder(it) && it.id === fid) return ((hit = { ws, folder: it, parent, list, trail }), false);
    });
    if (hit) return hit;
  }
  return null;
}
function allFolders(ws = S.ws) {
  const out = [];
  if (ws) walk(S.trees[ws], (it, parent, list, trail) => void (isFolder(it) && out.push({ f: it, trail })));
  return out;
}
function noteKind(id) {
  const n = S.notes[id];
  if (!n) return null;
  if (n.loose) return "loose";
  if (n.draft) return "draft";
  return "ws";
}
function notePath(id) {
  const n = S.notes[id];
  if (n.loose) return n.path;
  if (n.draft) return `${S.settings.drafts_dir}/${n.file}`;
  const loc = locate(id);
  if (!loc) return n.file;
  return [WORKSPACES[loc.ws].path, ...loc.trail.map((f) => f.dir), n.file].join("/");
}
function folderPath(fid) {
  const h = findFolder(fid);
  return h ? [WORKSPACES[h.ws].path, ...h.trail.map((f) => f.dir), h.folder.dir].join("/") : "";
}
function wsNotes(ws = S.ws) {
  if (!ws) return [];
  const out = [];
  walk(S.trees[ws], (it) => void (!isFolder(it) && out.push(it)));
  return out.filter((id) => S.notes[id]);
}
function countNotes(f) {
  let c = 0;
  walk(f.children, (it) => void (!isFolder(it) && S.notes[it] && c++));
  return c;
}
function folderName(id) {
  const loc = locate(id);
  if (!loc) return noteKind(id) === "draft" ? "Szkice" : "Luźny plik";
  return loc.folder ? loc.folder.name : rootName(loc.ws);
}
/* Icon and colour of a note or folder: the student's choice, else the kind's default. */
function decoOf(id, isDir = false, open = false) {
  const d = S.deco[id] || {};
  let ic = d.icon;
  if (!ic) ic = isDir ? (open ? "folderOpen" : "folder") : noteIcon(id);
  return { icon: ic, color: d.color || "" };
}
function noteIcon(id) {
  const d = S.deco && S.deco[id];
  if (d && d.icon) return d.icon;
  const k = noteKind(id);
  return k === "loose" ? "fileLoose" : k === "draft" ? "draft" : "file";
}
/* The icon in its colour, the same markup in the tree, tabs, search and palette. */
function itemIcon(id, { isDir = false, open = false, size = "sm" } = {}) {
  const d = decoOf(id, isDir, open);
  return `<span class="kind${d.color ? " c" : ""}"${d.color ? ` style="--ic:var(--ic-${d.color})"` : ""}>${icon(d.icon, size)}</span>`;
}
function inOpenScope(id) {
  const k = noteKind(id);
  if (k !== "ws") return true;
  const loc = locate(id);
  return loc && loc.ws === S.ws;
}

/* ---------- Render all ---------- */
function renderAll() {
  applySettings();
  renderSidebar();
  renderRail();
  renderTabs();
  renderView();
  renderStatus();
}

/* ---------- Sidebar shell: collapse and the edge handle ---------- */
function renderRail() {
  const shell = $("#shell");
  shell.classList.toggle("no-sb", !S.sidebar);
  shell.style.setProperty("--sb-w", S.sbw + "px");
  const b = $("#sbEdge");
  b.setAttribute("aria-expanded", S.sidebar);
  b.title = `${S.sidebar ? "Schowaj" : "Pokaż"} pasek boczny (${keyOf("toggleSidebar")})`;
  b.innerHTML = icon(S.sidebar ? "chevronLeft" : "chevronRight", "sm");
}

/* ---------- Sidebar ---------- */
const THEME_CYCLE = { system: "light", light: "dark", dark: "system" };
const THEME_LABEL = { system: "systemowy", light: "jasny", dark: "ciemny" };
const THEME_ICON = { system: "monitor", light: "sun", dark: "moon" };
/* The fixed parts (brand, search box, footer) are built once, so typing in the search box never loses focus. */
function buildSidebar() {
  $("#sb").innerHTML = `
    <div class="head">
      <div class="brand">
        <span class="mark" aria-hidden="true">W</span><span class="name">WYSITyp</span>
        <button class="wt-ibtn sm" data-act="home" title="Strona startowa">${icon("home")}</button>
        <button class="wt-ibtn sm" data-act="newNote" title="${esc(tip("newNote"))}">${icon("plus")}</button>
      </div>
      <div class="sb-find" id="sbFind" role="search"></div>
    </div>
    <div class="body" id="sbBody"></div>
    <div class="foot" id="sbFoot"></div>`;
  renderFind();
}
function rowHtml(id, level) {
  const n = S.notes[id];
  const active = S.active === id;
  const dirty = n.phase === "unsaved" || n.phase === "failed";
  return `<button class="wt-row note${active ? " active" : ""}" style="--level:${level}" data-row="${id}" data-act="openNote" data-arg="${id}" title="${esc(notePath(id))}">
    <span class="tw"></span>${itemIcon(id)}<span class="lbl">${esc(n.title)}</span>${dirty ? '<span class="dirty" title="Niezapisane zmiany"></span>' : ""}${n.phase === "conflict" ? `<span class="badge" style="color:var(--color-warning)">${icon("warning", "sm")}</span>` : ""}</button>`;
}
function folderHtml(f, level) {
  const open = !S.collapsed.includes(f.id);
  const kids = f.children.filter((c) => isFolder(c) || S.notes[c]);
  return `<div class="grp" role="group">
    <button class="wt-row folder" style="--level:${level}" data-folder="${f.id}" data-act="toggleFolder" data-arg="${f.id}" aria-expanded="${open}" title="${esc(folderPath(f.id))}">
      <span class="tw">${icon("chevronRight", "sm")}</span>${itemIcon(f.id, { isDir: true, open })}<span class="lbl">${esc(f.name)}</span><span class="badge">${countNotes(f)}</span></button>
    ${open ? `<div class="kids" style="--level:${level}">${treeHtml(kids, level + 1) || `<div class="empty-tree" style="padding-left:calc(${level} * 16px + 28px)">Pusty folder</div>`}</div>` : ""}</div>`;
}
function treeHtml(list, level) {
  return list.map((it) => (isFolder(it) ? folderHtml(it, level) : S.notes[it] ? rowHtml(it, level) : "")).join("");
}
/* A root row: the opened folder, or the loose files and drafts groups. */
function rootHtml({ key, name, title, ic, count, body, actions = "" }) {
  const open = S.sec[key] !== false;
  return `<section class="root">
    <div class="root-row">
      <button class="wt-row root-btn" data-act="toggleSec" data-arg="${key}" aria-expanded="${open}"${key === "root" ? ' data-root="1"' : ""} title="${esc(title)}">
        <span class="tw">${icon("chevronRight", "sm")}</span><span class="lbl">${esc(name)}</span><span class="badge">${count}</span></button>
      <span class="root-act">${actions}</span>
    </div>
    ${open ? `<div class="wt-tree" role="tree">${body}</div>` : ""}</section>`;
}
function renderSidebar() {
  const body = $("#sbBody");
  if (!body) return;
  renderSbFoot();
  if (S.search.q) return renderSearchBody();
  const ws = WS();
  let h = "";
  if (ws) {
    h += rootHtml({
      key: "root",
      name: rootName(),
      title: ws.path,
      count: wsNotes().length,
      body: treeHtml(S.trees[S.ws], 1) || '<div class="empty-tree">Ten folder jest pusty. Utwórz pierwszą notatkę przyciskiem +.</div>',
      actions: `<button class="wt-ibtn xs" data-act="newNote" data-arg="" title="Nowa notatka">${icon("plus", "sm")}</button><button class="wt-ibtn xs" data-act="newFolder" title="Nowy folder">${icon("folderPlus", "sm")}</button><button class="wt-ibtn xs" data-act="collapseAll" title="Zwiń wszystkie foldery">${icon("chevronUp", "sm")}</button><button class="wt-ibtn xs" data-act="wsMenu" title="Więcej działań na folderze">${icon("more", "sm")}</button>`,
    });
  } else {
    h += `<section class="root"><div class="empty-tree">Nie otwarto żadnego folderu. Notatki możesz pisać jako szkice albo otworzyć pojedynczy plik.</div>
      <div style="display:grid;gap:6px;padding:4px 8px"><button class="wt-btn secondary sm" data-act="openFolder">${icon("folderOpen", "sm")}Otwórz folder…</button></div></section>`;
  }
  const loose = S.loose.filter((id) => S.notes[id]);
  if (loose.length) h += rootHtml({ key: "loose", name: "Luźne pliki", title: "Pliki otwarte spoza folderu", count: loose.length, body: loose.map((id) => rowHtml(id, 1)).join("") });
  const drafts = S.drafts.filter((id) => S.notes[id]);
  if (drafts.length) h += rootHtml({ key: "drafts", name: "Szkice", title: S.settings.drafts_dir, count: drafts.length, body: drafts.map((id) => rowHtml(id, 1)).join("") });
  body.innerHTML = h;
}
function renderSbFoot() {
  const th = S.settings.theme;
  $("#sbFoot").innerHTML = `
    <button class="wt-ibtn" data-act="settings" title="${esc(tip("settings"))}" aria-pressed="${S.active === "settings"}">${icon("settings")}</button>
    <span class="grow"></span>
    <button class="wt-ibtn" data-act="cycleTheme" title="Motyw: ${THEME_LABEL[th]}. Kliknij, aby przełączyć na ${THEME_LABEL[THEME_CYCLE[th]]}.">${icon(THEME_ICON[th])}</button>`;
}
function saveSummary() {
  const ns = Object.values(S.notes);
  if (ns.some((n) => n.phase === "saving")) return { text: "Zapisywanie…", cls: "saving" };
  const bad = ns.filter((n) => n.phase === "failed" || n.phase === "conflict").length;
  if (bad) return { text: bad === 1 ? "1 notatka wymaga uwagi" : `${bad} notatki wymagają uwagi`, cls: "unsaved" };
  const u = ns.filter((n) => n.phase === "unsaved").length;
  if (u) return { text: `Niezapisane zmiany: ${u}`, cls: "unsaved" };
  return { text: `${icon("check", "sm")} Wszystko zapisane`, cls: "" };
}
function refreshChrome() {
  renderSidebar();
  renderTabs();
  renderStatus();
}

/* Sidebar resize */
function bindSidebarResize() {
  const h = $("#sbResize");
  h.addEventListener("pointerdown", (e) => {
    h.setPointerCapture(e.pointerId);
    h.classList.add("drag");
    const x0 = e.clientX,
      w0 = S.sbw;
    const z = UI_ZOOM[S.settings.ui_size] || 1;
    const move = (ev) => {
      S.sbw = Math.max(200, Math.min(440, w0 + (ev.clientX - x0) / z));
      $("#shell").style.setProperty("--sb-w", S.sbw + "px");
    };
    const up = () => {
      h.classList.remove("drag");
      h.removeEventListener("pointermove", move);
      h.removeEventListener("pointerup", up);
      persist();
    };
    h.addEventListener("pointermove", move);
    h.addEventListener("pointerup", up);
  });
  h.addEventListener("dblclick", () => {
    S.sbw = 264;
    renderRail();
    persist();
  });
}

/* ---------- Tabs ---------- */
function tabLabel(t) {
  if (t === "home") return S.ws ? "Start" : "Witaj";
  if (t === "settings") return "Ustawienia";
  return S.notes[t].title;
}
function tabIcon(t) {
  if (t === "home") return `<span class="kind">${icon("home", "sm")}</span>`;
  if (t === "settings") return `<span class="kind">${icon("settings", "sm")}</span>`;
  return itemIcon(t);
}
function renderTabs() {
  const html = S.tabs
    .map((t) => {
      const active = S.active === t;
      const n = S.notes[t];
      const cls = [active ? "active" : "", t === S.preview ? "preview" : "", n && (n.phase === "unsaved" || n.phase === "failed") ? "dirty" : "", n && n.phase === "conflict" ? "dirty conflict" : "", n && n.errs ? "err" : ""].join(" ");
      const title = t === "home" ? "Strona startowa" : t === "settings" ? "Ustawienia" : notePath(t);
      return `<div class="tab ${cls}" data-tab="${t}" role="tab" aria-selected="${active}" draggable="true" title="${esc(title)}${t === S.preview ? " – podgląd (kliknij dwukrotnie, aby przypiąć)" : ""}">
        ${tabIcon(t)}<span class="lbl">${esc(tabLabel(t))}</span>
        <span class="x" data-close="${t}" title="Zamknij (${keyOf("closeTab")})"><span class="tdot"></span>${icon("close", "sm")}</span></div>`;
    })
    .join("");
  $("#tabs").innerHTML = `<div class="tabs-scroll" role="tablist">${html || '<div class="tabs-none">Brak otwartych kart</div>'}</div>
    <div class="tab-act">
      <button class="wt-ibtn sm" data-act="newNote" title="${esc(tip("newNote"))}" aria-label="Nowa notatka">${icon("plus")}</button>
      <button class="wt-ibtn sm" data-act="tabsMenu" title="Więcej działań na kartach">${icon("more")}</button>
    </div>`;
  const a = $(`.tab[data-tab="${CSS.escape(S.active)}"]`);
  if (a) a.scrollIntoView({ block: "nearest", inline: "nearest" });
}
/* Hover preview of a tab: the first page of the note, like a taskbar thumbnail. */
let peekT = 0,
  peekCur = null,
  peekMute = null;
function hidePeek() {
  clearTimeout(peekT);
  peekCur = null;
  $$(".tab-peek").forEach((p) => p.remove());
}
function showPeek(tab) {
  const id = tab.dataset.tab;
  const n = S.notes[id];
  if (!n || !tab.isConnected) return hidePeek();
  const r = TY.render(n.source);
  const dirty = n.phase === "unsaved" || n.phase === "failed" || n.phase === "conflict";
  let p = $(".tab-peek");
  if (!p) {
    p = el('<div class="tab-peek" role="tooltip"></div>');
    document.body.appendChild(p);
  }
  p.innerHTML = `<div class="pk-h">${itemIcon(id)}<span class="t">${esc(n.title)}</span>${dirty ? '<span class="pk-dot" title="Niezapisane zmiany"></span>' : ""}</div>
    <div class="pk-sheet"><div class="pg-sheet paper-scope pk-page"><article class="wt-note" lang="pl">${r.html.slice(0, 18).join("") || '<p class="muted">Pusta notatka</p>'}</article></div></div>
    <div class="pk-f"><span class="p">${esc(notePath(id))}</span>${r.diags.length ? `<span class="e">${icon("error", "sm")}${r.diags.length}</span>` : ""}</div>`;
  const tr = tab.getBoundingClientRect();
  const w = p.offsetWidth;
  p.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, tr.left + tr.width / 2 - w / 2)) + "px";
  p.style.top = tr.bottom + 6 + "px";
}
function bindTabs() {
  const tabs = $("#tabs");
  tabs.addEventListener("mouseover", (e) => {
    const t = e.target.closest(".tab");
    const id = t ? t.dataset.tab : null;
    if (id === peekCur) return;
    clearTimeout(peekT);
    if (!t || !S.notes[id] || id === peekMute || t.classList.contains("dragging")) {
      if (id !== peekMute) peekMute = null;
      if (peekCur) hidePeek();
      return;
    }
    peekMute = null;
    peekCur = id;
    if ($(".tab-peek")) showPeek(t);
    else peekT = setTimeout(() => showPeek(t), 600);
  });
  tabs.addEventListener("mouseleave", () => {
    peekMute = null;
    hidePeek();
  });
  for (const ev of ["mousedown", "dragstart", "wheel", "contextmenu"])
    tabs.addEventListener(
      ev,
      (e) => {
        const t = e.target.closest && e.target.closest(".tab");
        peekMute = t ? t.dataset.tab : null;
        hidePeek();
      },
      { passive: true },
    );
  tabs.addEventListener("click", (e) => {
    const x = e.target.closest("[data-close]");
    if (x) return closeTab(x.dataset.close);
    const t = e.target.closest(".tab");
    if (t) activate(t.dataset.tab);
  });
  tabs.addEventListener("dblclick", (e) => {
    const t = e.target.closest(".tab");
    if (t && t.dataset.tab === S.preview) {
      S.preview = null;
      renderTabs();
      persist();
    } else if (e.target.closest(".tabs-empty")) run("newNote");
  });
  tabs.addEventListener("auxclick", (e) => {
    const t = e.target.closest(".tab");
    if (e.button === 1 && t) {
      e.preventDefault();
      closeTab(t.dataset.tab);
    }
  });
  tabs.addEventListener("mousedown", (e) => {
    if (e.button === 1) e.preventDefault();
  });
  tabs.addEventListener("contextmenu", (e) => {
    const t = e.target.closest(".tab");
    if (!t) return;
    e.preventDefault();
    tabMenu(t.dataset.tab, { x: e.clientX, y: e.clientY });
  });
  let drag = null;
  tabs.addEventListener("dragstart", (e) => {
    const t = e.target.closest(".tab");
    if (!t) return;
    drag = t.dataset.tab;
    t.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", drag);
  });
  tabs.addEventListener("dragover", (e) => {
    const t = e.target.closest(".tab");
    if (!drag || !t) return;
    e.preventDefault();
    $$(".tab", tabs).forEach((x) => x.classList.remove("drop-l", "drop-r"));
    const r = t.getBoundingClientRect();
    t.classList.add(e.clientX < r.left + r.width / 2 ? "drop-l" : "drop-r");
  });
  tabs.addEventListener("drop", (e) => {
    const t = e.target.closest(".tab");
    if (!drag || !t) return;
    e.preventDefault();
    const after = t.classList.contains("drop-r");
    const from = S.tabs.indexOf(drag);
    S.tabs.splice(from, 1);
    let to = S.tabs.indexOf(t.dataset.tab) + (after ? 1 : 0);
    S.tabs.splice(to, 0, drag);
    drag = null;
    renderTabs();
    persist();
  });
  tabs.addEventListener("dragend", () => {
    drag = null;
    $$(".tab", tabs).forEach((x) => x.classList.remove("drop-l", "drop-r", "dragging"));
  });
}
function openNote(id, { preview = false, line = null } = {}) {
  if (!S.notes[id]) return;
  if (!S.tabs.includes(id)) {
    const usePreview = preview && S.settings.preview_tabs;
    if (usePreview && S.preview && S.tabs.includes(S.preview)) {
      const p = S.notes[S.preview];
      if (p && p.phase === "saved") {
        S.tabs[S.tabs.indexOf(S.preview)] = id;
      } else S.tabs.splice(S.tabs.indexOf(S.active) + 1 || S.tabs.length, 0, id);
    } else {
      const at = S.tabs.indexOf(S.active);
      S.tabs.splice(at >= 0 ? at + 1 : S.tabs.length, 0, id);
    }
    S.preview = usePreview ? id : S.preview === id ? null : S.preview;
  } else if (!preview && S.preview === id) S.preview = null;
  S.recent = [id, ...S.recent.filter((r) => r !== id)].slice(0, 12);
  activate(id);
  if (line != null) setTimeout(() => goToLine(line, 0), 30);
}
function activate(t) {
  hidePeek();
  if (t !== "home" && !S.tabs.includes(t)) S.tabs.push(t);
  if (t !== "home") S.lastTab = t;
  if (S.active === t && $("#view").childElementCount) {
    renderTabs();
    return;
  }
  if (E && E.editing) commitEdit();
  S.active = t;
  renderTabs();
  renderSidebar();
  renderView();
  renderStatus();
  persist();
}
async function closeTab(t, { force = false } = {}) {
  const n = S.notes[t];
  if (!force && n && n.phase !== "saved" && n.phase !== "saving") {
    const r = await confirmDlg({
      title: `Zapisać zmiany w „${n.title}”?`,
      text: n.phase === "conflict" ? "Plik zmienił się na dysku. Jeśli zamkniesz kartę bez zapisu, zostanie wersja z dysku." : "Jeśli nie zapiszesz, zmiany od ostatniego zapisu przepadną.",
      ok: "Zapisz",
      alt: "Nie zapisuj",
    });
    if (!r) return;
    if (r === "ok") {
      n.disk = n.source;
      n.phase = "saved";
    } else {
      n.source = n.disk;
      n.phase = "saved";
    }
    clearTimeout(n.timer);
  }
  const i = S.tabs.indexOf(t);
  if (i < 0) return;
  S.tabs.splice(i, 1);
  if (t !== "settings") S.closed.push(t);
  if (S.preview === t) S.preview = null;
  if (S.active === t) {
    if (E && E.editing) E.editing = null;
    S.active = S.tabs[i] || S.tabs[i - 1] || "home";
    renderView();
  }
  renderTabs();
  renderSidebar();
  renderStatus();
  persist();
}
async function closeMany(list) {
  for (const t of list) await closeTab(t);
}
function cycleTab(d) {
  if (!S.tabs.length) return;
  const i = S.tabs.indexOf(S.active);
  activate(S.tabs[i < 0 ? (d > 0 ? 0 : S.tabs.length - 1) : (i + d + S.tabs.length) % S.tabs.length]);
}
/* Leave the full-screen start page for the tab used last. */
function backToTabs() {
  if (!S.tabs.length) return;
  activate(S.tabs.includes(S.lastTab) ? S.lastTab : S.tabs[S.tabs.length - 1]);
}
function tabMenu(t, at) {
  const others = S.tabs.filter((x) => x !== t);
  const right = S.tabs.slice(S.tabs.indexOf(t) + 1);
  const isNote = !!S.notes[t];
  openMenu(at, [
    { label: "Zamknij", key: keyOf("closeTab"), icon: "close", run: () => closeTab(t) },
    { label: "Zamknij inne", disabled: !others.length, run: () => closeMany(others) },
    { label: "Zamknij po prawej", disabled: !right.length, run: () => closeMany(right) },
    { label: "Zamknij wszystkie", run: () => closeMany([...S.tabs]) },
    { sep: true },
    ...(t === S.preview ? [{ label: "Przypnij kartę", icon: "check", run: () => ((S.preview = null), renderTabs()) }] : []),
    { label: "Kopiuj ścieżkę", icon: "copy", disabled: !isNote, run: () => copyPath(t) },
    { label: "Pokaż w drzewie", icon: "reveal", disabled: !isNote, run: () => revealInTree(t) },
  ]);
}
function copyPath(id) {
  const p = notePath(id);
  try {
    navigator.clipboard.writeText(p).catch(() => {});
  } catch {
    /* clipboard may be blocked */
  }
  toast(`Skopiowano ścieżkę: ${p}`, { type: "info" });
}
function revealInTree(id) {
  const loc = locate(id);
  if (loc && loc.ws !== S.ws) return toast("Ta notatka jest w innym folderze.", { type: "warn" });
  if (loc) S.collapsed = S.collapsed.filter((c) => !loc.trail.some((f) => f.id === c));
  S.sidebar = true;
  if (S.search.q) clearSearch();
  S.sec.root = S.sec.loose = S.sec.drafts = true;
  renderRail();
  renderSidebar();
  const r = $(`[data-row="${CSS.escape(id)}"]`);
  if (r) {
    r.scrollIntoView({ block: "center" });
    r.classList.add("focus");
    setTimeout(() => r.classList.remove("focus"), 1400);
  }
}

/* ---------- Main view switch ---------- */
function renderView() {
  const v = $("#view");
  E = null;
  closeFloat();
  const t = S.active;
  $(".main").classList.toggle("home-mode", t === "home");
  let node;
  if (t === "home") node = S.ws ? homeView() : welcomeView();
  else if (t === "settings") node = settingsView();
  else if (S.notes[t]) node = editorView(t);
  else node = homeView();
  v.replaceChildren(node);
  if (E) {
    applyPageView();
    requestAnimationFrame(() => E && E.restoreScroll && E.restoreScroll());
  }
}
function backBtn() {
  if (!S.tabs.length) return "";
  const n = S.tabs.length;
  return `<button class="wt-btn secondary sm home-back" data-act="backToTabs" title="Wróć do ostatniej karty (Esc)">${icon("arrowLeft", "sm")}Wróć do kart<span class="cnt">${n}</span></button>`;
}

/* ---------- Home ---------- */
function greeting() {
  const h = new Date().getHours();
  return h < 5 ? "Dobry wieczór" : h < 18 ? "Dzień dobry" : "Dobry wieczór";
}
function cardHtml(id) {
  const n = S.notes[id];
  return `<div class="wt-card" role="button" tabindex="0" data-act="openNote" data-arg="${id}" data-pin="1">
    <div class="h"><span class="bd">${icon(noteIcon(id))}</span><div style="min-width:0"><div class="ti" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(n.title)}</div><div class="me">${esc(folderName(id))} · ${esc(n.date || "")}</div></div></div>
    <div class="tx">${esc(n.excerpt || "")}</div>
    ${n.tags && n.tags.length ? `<div class="tagrow">${n.tags.map((t) => tagHtml(t)).join("")}</div>` : ""}
    <span class="act"><button class="wt-ibtn sm" data-act="cardMenu" data-arg="${id}" title="Więcej">${icon("more")}</button></span></div>`;
}
function tagColor(t) {
  return (S.tagDefs && S.tagDefs[t]) || TAGS[t] || "gray";
}
function tagHtml(t, extra = "") {
  const c = tagColor(t);
  return `<span class="wt-tag ${extra}" style="--fg:var(--tag-${c}-fg);--bg:var(--tag-${c}-bg)">${esc(t)}</span>`;
}
function homeView() {
  const ids = wsNotes();
  const order = [...S.recent.filter((r) => ids.includes(r)), ...ids.filter((r) => !S.recent.includes(r))];
  const used = [...new Set(ids.flatMap((id) => S.notes[id].tags || []))];
  const shown = order.filter((id) => !S.tagFilter || (S.notes[id].tags || []).includes(S.tagFilter)).slice(0, 8);
  const d = new Date().toLocaleDateString("pl-PL", { weekday: "long", day: "numeric", month: "long" });
  return el(`<div class="home"><div class="home-in">
    <header>
      <div class="home-top"><p class="eyebrow">${esc(d)} · ${esc(WS().name)}</p>${backBtn()}</div>
      <h1>${greeting()}. Co dziś notujemy?</h1>
      <div class="btns">
        <button class="wt-btn primary" data-act="newNote">${icon("plus", "sm")}Nowa notatka ${kbd(keyOf("newNote"))}</button>
        <button class="wt-btn secondary" data-act="openFolder">${icon("folderOpen", "sm")}Otwórz inny folder</button>
        <button class="wt-btn ghost" data-act="openNote">${icon("file", "sm")}Otwórz plik…</button>
      </div>
    </header>
    <section>
      <div class="sec-h"><h2>Zacznij od szablonu</h2></div>
      <div class="grid3">${TEMPLATES.filter((t) => t.id !== "blank")
        .map(
          (t) => `<button class="wt-card" data-act="newNote" data-arg="${t.id}">
        <div class="h"><span class="bd">${icon(t.icon)}</span><div><div class="ti">${esc(t.name)}</div><div class="me">${esc(t.file)}</div></div></div>
        <div class="tx">${esc(t.desc)}</div></button>`,
        )
        .join("")}</div>
    </section>
    <section>
      <div class="sec-h"><h2>Ostatnio otwierane</h2>
        <div class="tagrow">${[`<button class="wt-tag${S.tagFilter ? "" : " sel"}" style="--fg:var(--color-text-muted);--bg:var(--color-surface-sunken)" data-act="homeTag" data-arg="">Wszystkie</button>`, ...used.map((t) => {
          const c = tagColor(t);
          return `<button class="wt-tag${S.tagFilter === t ? " sel" : ""}" style="--fg:var(--tag-${c}-fg);--bg:var(--tag-${c}-bg)" data-act="homeTag" data-arg="${esc(t)}">${esc(t)}</button>`;
        })].join("")}</div>
      </div>
      ${shown.length ? `<div class="grid2">${shown.map(cardHtml).join("")}</div>` : '<div class="empty">Brak notatek z tym tagiem.</div>'}
    </section>
  </div></div>`);
}

/* ---------- Welcome (no folder) ---------- */
function welcomeView() {
  const loose = Object.keys(S.notes).filter((id) => S.notes[id].loose);
  return el(`<div class="welcome">${S.tabs.length ? `<div class="welcome-back">${backBtn()}</div>` : ""}<div class="welcome-in">
    <div class="brand"><span class="mark">W</span><div><h1>WYSITyp</h1><p class="sub">Piszesz na stronie, która renderuje się na bieżąco. Notatki zostają zwykłymi plikami Typst.</p></div></div>
    <div class="act-list">
      <button class="act-row" data-act="newNote">${icon("plus")}<span class="l">Nowa notatka</span>${kbd(keyOf("newNote"))}</button>
      <button class="act-row" data-act="openNote">${icon("file")}<span class="l">Otwórz notatkę…</span>${kbd(keyOf("openNote"))}</button>
      <button class="act-row" data-act="openFolder">${icon("folderOpen")}<span class="l">Otwórz folder…</span>${kbd(keyOf("openFolder"))}</button>
    </div>
    <div>
      <p class="eyebrow" style="margin:0 0 6px 10px">Ostatnie</p>
      ${S.recentWs.map((w) => `<button class="recent-row" data-act="openWs" data-arg="${w}">${icon("folder")}<span>${esc(WORKSPACES[w].name)}</span><span class="p">${esc(WORKSPACES[w].path)}</span></button>`).join("")}
      ${loose.map((id) => `<button class="recent-row" data-act="openNote" data-arg="${id}" data-pin="1">${icon("fileLoose")}<span>${esc(S.notes[id].file)}</span><span class="p">${esc(S.notes[id].path)}</span></button>`).join("")}
    </div>
    <p class="muted" style="margin:0;font-size:12px">${kbd(keyOf("palette"))} paleta poleceń · ${kbd(keyOf("shortcuts"))} skróty · ${kbd(keyOf("settings"))} ustawienia</p>
  </div></div>`);
}

/* ---------- Editor ---------- */
function crumbsHtml(id) {
  const n = S.notes[id];
  const k = noteKind(id);
  let pre = "";
  if (k === "loose") pre = `<span class="loose" title="Plik spoza folderu. Zapisujemy go w tym samym miejscu.">${icon("fileLoose", "sm")}Luźny plik</span><span>/</span><span title="${esc(n.path)}">${esc(n.path.replace(/\/[^/]*$/, ""))}</span><span>/</span>`;
  else if (k === "draft") pre = `<button data-act="revealTree" data-arg="${id}">Szkice</button><span>/</span>`;
  else {
    const loc = locate(id);
    pre = `<button data-act="home">${esc(rootName(loc.ws))}</button><span>/</span>${loc.trail.map((f) => `<button data-act="revealTree" data-arg="${id}">${esc(f.name)}</button><span>/</span>`).join("")}`;
  }
  return `<nav class="crumbs" aria-label="Ścieżka">${pre}<span class="cur">${esc(n.title)}</span></nav>`;
}
function tagsBar(n) {
  return `${(n.tags || []).map((t) => tagHtml(t).replace("</span>", `<span class="x" data-act="tagRm" data-arg="${esc(t)}" title="Usuń tag">${icon("close", "sm")}</span></span>`)).join("")}
    <button class="tag-add" data-act="tagAdd" title="Dodaj tag">+ Tag</button>`;
}
function tbBtn(id, cls = "") {
  return `<button class="wt-ibtn sm ${cls}" data-act="${id}" data-keep title="${esc(tip(id))}" aria-label="${esc(ACT[id].label)}">${icon(ACT[id].icon)}</button>`;
}
/* Toolbar sections, left to right. When space runs out, whole sections move into the ⋯ menu,
   lowest `prio` first: insert, lists, maths, paragraph style, and character formatting last. */
const TB_SECS = [
  { id: "para", prio: 4, label: "Styl akapitu", items: ["tbPara"] },
  { id: "chars", prio: 5, label: "Formatowanie znaków", items: ["bold", "italic", "underline", "strike", "super", "sub", "code", "highlight", "color", "clear"] },
  { id: "lists", prio: 2, label: "Listy i akapity", items: ["bullet", "numbered", "term", "quote", "outdent", "indent", "tbAlign"] },
  { id: "math", prio: 3, label: "Matematyka i bloki", items: ["inlineMath", "blockMath", "tbBlocks"] },
  { id: "insert", prio: 1, label: "Wstawianie", items: ["symbol", "table", "image", "shape", "link", "footnote", "pagebreak", "outline"] },
];
/* Shown only with the full toolbar; the compact one keeps them in the ⋯ menu. */
const TB_FULL = new Set(["super", "sub", "term", "outdent", "indent", "footnote", "pagebreak", "outline"]);
function tbItem(id) {
  const fo = TB_FULL.has(id) ? "full-only" : "";
  if (id === "tbPara") return `<button class="dd" data-act="tbPara" data-keep title="Styl akapitu"><span class="dd-l">Zwykły akapit</span>${icon("chevronDown", "sm")}</button>`;
  if (id === "tbBlocks") return `<button class="dd sm" data-act="tbBlocks" data-keep title="Wstaw blok: definicja, twierdzenie, dowód…">${icon("blocks", "sm")}<span>Bloki</span>${icon("chevronDown", "sm")}</button>`;
  if (id === "tbAlign") return `<button class="wt-ibtn sm" data-act="tbAlign" data-keep title="Wyrównanie" aria-label="Wyrównanie">${icon("align")}</button>`;
  if (id === "color") return `<button class="wt-ibtn sm" data-act="color" data-keep title="${esc(tip("color"))}" aria-label="Kolor tekstu">${icon("textColor")}</button>`;
  return tbBtn(id, fo);
}
function toolbarHtml() {
  const v = view();
  return `<div class="wt-toolbar${S.settings.toolbar === "full" ? " full" : ""}" role="toolbar" aria-label="Formatowanie">
    <div class="tb-l">${tbBtn("undo")}${tbBtn("redo")}</div>
    <div class="tb-mid"><div class="mid-in">
      ${TB_SECS.map((sec) => `<div class="tb-sec" data-sec="${sec.id}" data-prio="${sec.prio}" role="group" aria-label="${esc(sec.label)}">${sec.items.map(tbItem).join("")}</div>`).join("")}
      <button class="wt-ibtn sm tb-more" data-act="tbMore" data-keep title="Więcej narzędzi" aria-label="Więcej narzędzi">${icon("more")}</button>
    </div></div>
    <div class="tb-r">
      <div class="wt-seg icons" role="radiogroup" aria-label="Widok">
        <button role="radio" aria-checked="${v === "source"}" data-act="viewSource" title="${esc(tip("viewSource"))}">${icon("code", "sm")}</button>
        <button role="radio" aria-checked="${v === "split"}" data-act="viewSplit" title="${esc(tip("viewSplit"))}">${icon("split", "sm")}</button>
        <button role="radio" aria-checked="${v === "page"}" data-act="viewPage" title="${esc(tip("viewPage"))}">${icon("eye", "sm")}</button>
      </div>
    </div></div>`;
}
/* Hide whole sections, least important first, until the middle fits between undo/redo and the view switch. */
function fitToolbar() {
  if (!E || !E.tb || !E.tb.isConnected) return;
  const tb = E.tb;
  const mid = $(".tb-mid", tb),
    inn = $(".mid-in", tb),
    more = $(".tb-more", tb);
  const secs = $$(".tb-sec", tb);
  secs.forEach((x) => (x.hidden = false));
  const compact = !tb.classList.contains("full");
  more.hidden = !compact;
  const order = [...secs].sort((a, b) => a.dataset.prio - b.dataset.prio);
  let k = 0;
  while (inn.offsetWidth > mid.clientWidth + 0.5 && k < order.length) {
    order[k++].hidden = true;
    more.hidden = false;
  }
  E.tbHidden = order.slice(0, k).map((x) => x.dataset.sec);
}

/* ---------- Floating view toolbar over the page (split and page views) ---------- */
const PAGE_W = 794,
  PAGE_H = 1123;
const ZOOMS = [0.25, 0.33, 0.5, 0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3];
function vtbHtml() {
  const b = (act, ic, label, cls = "") => `<button class="wt-ibtn sm ${cls}" data-act="${act}" title="${label}" aria-label="${label}">${icon(ic)}</button>`;
  return `<div class="vtb" role="toolbar" aria-orientation="vertical" aria-label="Widok strony" data-keep>
    <span class="vtb-pg" title="Strona 1 z 1">1/1</span>
    ${b("pvFitWidth", "fitWidth", "Strona na pełną szerokość")}
    ${b("pvFitPage", "fitPage", "Pokaż całą stronę")}
    <span class="wt-sep"></span>
    ${b("pvZoomIn", "plus", "Powiększ (Ctrl+kółko)")}
    <button class="vtb-pct" data-act="pvZoomMenu" title="Powiększenie" aria-haspopup="menu">100%</button>
    ${b("pvZoomOut", "minus", "Pomniejsz (Ctrl+kółko)")}
    <span class="wt-sep"></span>
    ${b("pvOutside", "surround", "Tło wokół strony w kolorze strony")}
    ${b("pvRound", "corner", "Zaokrąglone rogi strony")}
    <span class="wt-sep float-only"></span>
    ${b("pvPin", "pin", "Przypnij pasek widoku", "float-only")}
  </div>`;
}
function pvState() {
  return S.pv[view() === "page" ? "page" : "split"];
}
/* Space around the pages; "fit page" keeps a thin margin so the whole sheet shows without a scrollbar. */
const PG_PAD = 20,
  FIT_PAD = 14;
const floatUi = () => S.settings.ui_style === "float";
/* A pinned floating bar covers the content under it, so the page leaves room for it. */
function dockReserve() {
  if (!floatUi() || S.settings.status_autohide || !S.settings.status_bar) return 0;
  const s = $("#status");
  return s && !s.hidden ? s.offsetHeight + 20 : 0;
}
function vtbReserve() {
  return floatUi() && !S.settings.vtb_autohide ? 58 : 0;
}
function pageZoom() {
  const st = pvState();
  const sc = E.panePage;
  const pad = st.fit === "page" ? FIT_PAD : PG_PAD;
  const w = sc.clientWidth - 2 * pad - vtbReserve(),
    h = sc.clientHeight - 2 * FIT_PAD - dockReserve();
  let z = st.zoom || 1;
  if (st.fit === "width") z = w / PAGE_W;
  else if (st.fit === "page") z = Math.min(w / PAGE_W, h / PAGE_H);
  /* "Fit page" must always fit, so it skips the 25% floor that manual zoom keeps. */
  return Math.max(st.fit === "page" ? 0.05 : 0.25, Math.min(3, z));
}
/* Zoom, spacing, outside colour and corners; `onlyFit` skips work when nothing depends on the pane size.
   "Fit page" turns the pane into slides: one page fills it exactly, and more pages snap one at a time. */
function applyPageView(onlyFit = false) {
  if (!E || !E.pagePane) return;
  const st = pvState();
  const sc = E.panePage;
  if (!sc.clientWidth) return;
  if (!E.paginated && !E.editing) renderPage();
  if (onlyFit && !st.fit) return;
  const z = pageZoom();
  const old = E.zoom || z;
  const rel = sc.scrollHeight > sc.clientHeight ? sc.scrollTop / sc.scrollHeight : 0;
  E.zoom = z;
  E.pagePane.style.setProperty("--pz", z.toFixed(4));
  const slide = st.fit === "page";
  const res = dockReserve(),
    vr = vtbReserve();
  E.ed.dataset.slide = slide ? "1" : "0";
  if (slide) {
    const gap = Math.max(2 * FIT_PAD, sc.clientHeight - res - PAGE_H * z);
    E.page.style.gap = gap + "px";
    sc.style.padding = `${gap / 2}px ${FIT_PAD + vr}px ${gap / 2 + res}px ${FIT_PAD}px`;
  } else {
    E.page.style.gap = "";
    sc.style.padding = `${PG_PAD}px ${PG_PAD + vr}px ${PG_PAD + res + 8}px ${PG_PAD}px`;
  }
  sc.style.scrollPaddingBottom = res + "px";
  if (Math.abs(old - z) > 0.001 && rel) sc.scrollTop = rel * sc.scrollHeight;
  E.ed.dataset.out = S.pv.outside;
  E.ed.dataset.round = S.pv.round ? "1" : "0";
  const vtb = $(".vtb", E.pagePane);
  if (!vtb) return;
  $(".vtb-pct", vtb).textContent = Math.round(z * 100) + "%";
  $('[data-act="pvFitWidth"]', vtb).setAttribute("aria-pressed", st.fit === "width");
  $('[data-act="pvFitPage"]', vtb).setAttribute("aria-pressed", st.fit === "page");
  $('[data-act="pvOutside"]', vtb).setAttribute("aria-pressed", S.pv.outside === "page");
  $('[data-act="pvRound"]', vtb).setAttribute("aria-pressed", S.pv.round);
  const pin = $('[data-act="pvPin"]', vtb);
  pin.setAttribute("aria-pressed", !S.settings.vtb_autohide);
  pin.title = S.settings.vtb_autohide ? "Przypnij pasek widoku" : "Ukrywaj pasek widoku automatycznie";
  pin.innerHTML = icon(S.settings.vtb_autohide ? "pin" : "pinOff");
  updatePageNo();
}
/* Which page sits in the middle of the pane, shown at the top of the view bar. */
function updatePageNo() {
  if (!E || !E.pagePane) return;
  const lab = $(".vtb-pg", E.pagePane);
  if (!lab) return;
  const sheets = [...E.page.children];
  const r = E.panePage.getBoundingClientRect();
  const cy = r.top + r.height / 2;
  let cur = 1,
    best = Infinity;
  sheets.forEach((s, i) => {
    const b = s.getBoundingClientRect();
    const d = cy < b.top ? b.top - cy : cy > b.bottom ? cy - b.bottom : 0;
    if (d < best) (best = d), (cur = i + 1);
  });
  lab.textContent = `${cur}/${sheets.length}`;
  lab.title = `Strona ${cur} z ${sheets.length}`;
}
function setPageFit(fit) {
  const st = pvState();
  st.fit = st.fit === fit ? null : fit;
  if (!st.fit && E) st.zoom = E.zoom || 1;
  persist();
  applyPageView();
}
function setPageZoom(z) {
  const st = pvState();
  st.fit = null;
  st.zoom = Math.max(0.25, Math.min(3, z));
  persist();
  applyPageView();
}
function zoomStep(d) {
  if (!E) return;
  const z = E.zoom || 1;
  const next = d > 0 ? ZOOMS.find((x) => x > z + 0.005) : [...ZOOMS].reverse().find((x) => x < z - 0.005);
  if (next) setPageZoom(next);
  if (E.peekVtb) E.peekVtb();
}
function zoomMenu(a) {
  const z = E ? Math.round((E.zoom || 1) * 100) : 100;
  const st = pvState();
  openMenu(a, [
    { head: "Powiększenie" },
    ...[50, 75, 100, 125, 150, 200].map((p) => ({ label: p + "%", check: !st.fit && z === p, run: () => setPageZoom(p / 100) })),
    { sep: true },
    { icon: "fitWidth", label: "Strona na pełną szerokość", check: st.fit === "width", run: () => setPageFit("width") },
    { icon: "fitPage", label: "Pokaż całą stronę", check: st.fit === "page", run: () => setPageFit("page") },
  ]);
}
function editorView(id) {
  const n = S.notes[id];
  const st = S.settings;
  const root = el(`<div class="ed-wrap" style="flex:1;min-height:0;display:flex;flex-direction:column">
    <div class="topbar">${crumbsHtml(id)}<div class="top-end">${tagsBar(n)}
      <button class="wt-btn ghost sm" data-act="exportPdf" title="${esc(tip("exportPdf"))}">${icon("pdf", "sm")}PDF</button></div></div>
    ${toolbarHtml()}
    <div class="banners"></div>
    <div class="editor" data-view="${view()}" style="--split:${(S.split || 0.5) * 100}%">
      <div class="pane pane-src"><div class="code${st.wrap ? " wrap" : ""}${st.line_numbers ? "" : " no-ln"}"><pre aria-hidden="true"></pre><textarea spellcheck="${st.spellcheck}" autocomplete="off" autocapitalize="off" wrap="${st.wrap ? "soft" : "off"}" aria-label="Źródło Typst"></textarea></div></div>
      <div class="ed-gutter" role="separator" tabindex="0" aria-orientation="vertical" aria-label="Proporcje kodu i podglądu" title="Przeciągnij, aby zmienić proporcje. Podwójne kliknięcie przywraca pół na pół."></div>
      <div class="pane pane-page"><div class="pg-scroll"><div class="pg-pages"></div></div>${vtbHtml()}</div>
      <div class="diag-box" hidden></div>
    </div></div>`);
  E = {
    id,
    root,
    ta: $("textarea", root),
    pre: $("pre", root),
    page: $(".pg-pages", root),
    paginated: false,
    pages: 1,
    paneSrc: $(".pane-src", root),
    panePage: $(".pg-scroll", root),
    pagePane: $(".pane-page", root),
    tb: $(".wt-toolbar", root),
    diag: $(".diag-box", root),
    banners: $(".banners", root),
    ed: $(".editor", root),
    editing: null,
    bta: null,
    curLine: -1,
    r: null,
    lastSel: null,
  };
  const sc = n.scroll || [0, 0];
  E.restoreScroll = () => {
    E.paneSrc.scrollTop = sc[0];
    E.panePage.scrollTop = sc[1];
  };
  /* `E` is cleared when the editor closes, and a late scroll event can still arrive, so keep this editor's panes. */
  const { paneSrc, panePage } = E;
  paneSrc.addEventListener("scroll", () => (n.scroll = [paneSrc.scrollTop, panePage.scrollTop]), { passive: true });
  let pgRaf = 0;
  panePage.addEventListener(
    "scroll",
    () => {
      n.scroll = [paneSrc.scrollTop, panePage.scrollTop];
      cancelAnimationFrame(pgRaf);
      pgRaf = requestAnimationFrame(updatePageNo);
    },
    { passive: true },
  );
  E.ta.value = n.source;
  const ro = new ResizeObserver(() => {
    fitToolbar();
    applyPageView(true);
  });
  ro.observe(E.tb);
  ro.observe(E.pagePane);
  ro.observe(E.panePage);
  bindVtbReveal(E);
  bindSplitGutter(E);
  E.panePage.addEventListener(
    "wheel",
    (e) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      zoomStep(e.deltaY < 0 ? 1 : -1);
    },
    { passive: false },
  );
  bindSource();
  bindPage();
  recompute();
  renderSourceHl();
  renderPage();
  renderDiag();
  renderBanners();
  return root;
}
/* The floating view bar hides at the right edge and slides in when the pointer comes near it. */
function bindVtbReveal(ed) {
  const pane = ed.pagePane;
  let t = 0;
  const show = (on, ms = 450) => {
    clearTimeout(t);
    if (on) pane.classList.add("vtb-show");
    else t = setTimeout(() => pane.classList.remove("vtb-show"), ms);
  };
  pane.addEventListener("mousemove", (e) => {
    if (!floatUi() || !S.settings.vtb_autohide) return;
    const r = pane.getBoundingClientRect();
    show(r.right - e.clientX < 96 || !!e.target.closest(".vtb"));
  });
  pane.addEventListener("mouseleave", () => show(false));
  ed.peekVtb = () => {
    show(true);
    show(false, 1200);
  };
}
/* Drag the line between source and page to change the split; double-click returns to half and half. */
function bindSplitGutter(ed) {
  const g = $(".ed-gutter", ed.root);
  const set = (f) => {
    const w = ed.ed.getBoundingClientRect().width || 1;
    const min = Math.min(0.45, 240 / w);
    f = Math.max(min, Math.min(1 - min, f));
    S.split = Math.round(f * 1000) / 1000;
    ed.ed.style.setProperty("--split", S.split * 100 + "%");
    g.setAttribute("aria-valuenow", Math.round(S.split * 100));
  };
  g.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const r = ed.ed.getBoundingClientRect();
    g.classList.add("drag");
    ed.ed.classList.add("resizing");
    document.body.style.cursor = "col-resize";
    const move = (ev) => set((ev.clientX - r.left) / r.width);
    const up = () => {
      g.classList.remove("drag");
      ed.ed.classList.remove("resizing");
      document.body.style.cursor = "";
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", up);
      persist();
    };
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
  });
  g.addEventListener("dblclick", () => {
    set(0.5);
    persist();
  });
  g.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    set((S.split || 0.5) + (e.key === "ArrowLeft" ? -0.05 : 0.05));
    persist();
  });
}
function recompute() {
  const n = S.notes[E.id];
  n.source = E.ta.value;
  E.r = TY.render(n.source);
  const had = !!n.errs;
  n.errs = E.r.diags.length;
  if (had !== !!n.errs) renderTabs();
}
function renderSourceHl() {
  const lines = TY.highlight(E.ta.value, E.r.diags);
  const errs = new Set(E.r.diags.map((d) => d.line));
  E.pre.innerHTML = lines.map((h, i) => `<div class="r${errs.has(i) ? " err" : ""}${i === E.curLine ? " cur" : ""}"><span class="n">${i + 1}</span>${h}</div>`).join("");
}
function renderPage() {
  const r = E.r;
  const errB = new Set(r.diags.map((d) => d.block));
  let html = r.blocks
    .map((b, i) => `<div class="blk${b.kind === "comment" ? " comment-blk" : ""}${errB.has(i) ? " has-err" : ""}" data-s="${b.start}" data-e="${b.end}">${r.html[i]}</div>`)
    .join("");
  if (!r.blocks.length) html = '<p class="muted" style="font-style:italic">Pusta notatka. Kliknij tutaj i zacznij pisać.</p>';
  if (r.footnotes.length) html += `<section class="footnotes"><ol>${r.footnotes.map((f) => `<li>${f}</li>`).join("")}</ol></section>`;
  html += '<button class="add-end" aria-label="Pisz dalej na końcu notatki" title="Kliknij, aby pisać dalej"></button>';
  E.page.innerHTML = sheetHtml(html);
  paginate();
}
function sheetHtml(inner = "") {
  return `<div class="pg-sheet paper-scope"><article class="wt-note" lang="pl">${inner}</article></div>`;
}
/* Break the flow into A4 sheets. The blocks are laid out on one long sheet first, then whole blocks move
   to the next sheet when they would cross the bottom margin. Rects are read before anything moves, and
   the sheet's width gives the zoom, so this works at any zoom. A hidden pane waits for applyPageView. */
const PAD_T = 72,
  PAD_B = 56;
function paginate() {
  const box = E.page;
  const first = box.firstElementChild;
  const sr = first.getBoundingClientRect();
  E.paginated = !!sr.width;
  if (!sr.width) return;
  const k = sr.width / PAGE_W;
  const kids = [...first.firstElementChild.children];
  const add = kids.length && kids[kids.length - 1].classList.contains("add-end") ? kids.pop() : null;
  const avail = (PAGE_H - PAD_T - PAD_B) * k;
  const groups = [[]];
  let top = null;
  for (const c of kids) {
    const r = c.getBoundingClientRect();
    if (top === null) top = r.top;
    if (r.bottom - top > avail && groups[groups.length - 1].length) {
      groups.push([]);
      top = r.top;
    }
    groups[groups.length - 1].push(c);
  }
  for (let i = 1; i < groups.length; i++) {
    const s = el(sheetHtml());
    s.firstElementChild.append(...groups[i]);
    box.appendChild(s);
  }
  const last = box.lastElementChild;
  if (add) {
    // The rest of the last sheet is one big "write on" target.
    last.firstElementChild.appendChild(add);
    const lr = last.getBoundingClientRect(),
      ar = add.getBoundingClientRect();
    // It also covers the bottom margin, so the sheet keeps its A4 height.
    add.style.height = Math.max(0, (lr.top + (PAGE_H - PAD_B) * k - ar.top) / k) + PAD_B + "px";
    add.style.marginBottom = -PAD_B + "px";
  }
  E.pages = groups.length;
  if (S.settings.pdf_numbers && E.pages > 1) [...box.children].forEach((s, i) => s.appendChild(el(`<span class="pg-num" aria-hidden="true">${i + 1}</span>`)));
  E.ed.dataset.pages = E.pages > 1 ? "many" : "one";
  updatePageNo();
}
/* New blocks go before the "write on" target, which lives on the last sheet. */
function insertBlk(blk, ref) {
  const r = ref || $(".add-end", E.page);
  r.parentNode.insertBefore(blk, r);
}
function renderDiag() {
  const d = E.r.diags[0];
  E.diag.hidden = !d;
  if (!d) return;
  const more = E.r.diags.length > 1 ? ` (+${E.r.diags.length - 1})` : "";
  E.diag.innerHTML = `<span class="ic">${icon("error", "sm")}</span><div><b>Wiersz ${d.line + 1}, kolumna ${d.col + 1}${more}</b> – ${esc(d.msg)}<div class="muted" style="margin-top:2px">Strona pokazuje resztę notatki. Źródło na dysku zostaje bez zmian.</div></div>
    <button class="wt-btn secondary sm" data-act="goDiag">Przejdź</button>`;
}
let pageRaf = 0;
function schedulePage() {
  cancelAnimationFrame(pageRaf);
  pageRaf = requestAnimationFrame(() => {
    if (E && !E.editing) renderPage();
    if (E) renderDiag();
    if (E) renderStatusProblems();
  });
}
function lineOfIndex(text, idx) {
  let ln = 0,
    last = -1;
  for (let i = 0; i < idx; i++)
    if (text.charCodeAt(i) === 10) {
      ln++;
      last = i;
    }
  return { ln, col: idx - last };
}
function indexOfLine(text, line, col = 0) {
  const ls = text.split("\n");
  let i = 0;
  for (let k = 0; k < Math.min(line, ls.length); k++) i += ls[k].length + 1;
  return Math.min(text.length, i + col);
}

/* Source pane */
function bindSource() {
  const ta = E.ta;
  ta.addEventListener("input", () => {
    recompute();
    renderSourceHl();
    schedulePage();
    markDirty(E.id);
    caretMoved();
  });
  ta.addEventListener("keydown", (e) => smartKeys(e, ta));
  for (const ev of ["keyup", "click", "select", "focus"]) ta.addEventListener(ev, caretMoved);
  ta.addEventListener("focus", () => {
    if (E.editing) commitEdit();
    E.lastTA = ta;
  });
  ta.addEventListener("blur", () => (E.lastSel = { ta, s: ta.selectionStart, e: ta.selectionEnd }));
}
function caretMoved() {
  if (!E) return;
  const ta = activeTA(false);
  if (!ta) return;
  let { ln, col } = lineOfIndex(ta.value, ta.selectionStart);
  if (ta !== E.ta && E.editing) ln += E.editing.s;
  E.caret = { ln, col };
  if (ta === E.ta && ln !== E.curLine) {
    const rows = E.pre.children;
    if (rows[E.curLine]) rows[E.curLine].classList.remove("cur");
    E.curLine = ln;
    if (rows[ln]) rows[ln].classList.add("cur");
    if (view() === "split") {
      $$(".blk.near", E.page).forEach((b) => b.classList.remove("near"));
      const b = blockAtLine(ln);
      if (b) b.classList.add("near");
    }
  }
  updateParaLabel(ta);
  renderStatusCaret();
}
function blockAtLine(ln) {
  return $$(".blk", E.page).find((b) => ln >= +b.dataset.s && ln <= +b.dataset.e);
}
function updateParaLabel(ta) {
  const lab = $(".dd-l", E.root);
  if (!lab) return;
  const v = ta.value;
  const s = v.lastIndexOf("\n", ta.selectionStart - 1) + 1;
  const line = v.slice(s, v.indexOf("\n", s) < 0 ? v.length : v.indexOf("\n", s));
  let m;
  let t = "Zwykły akapit";
  if ((m = /^(=+)\s/.exec(line))) t = `Nagłówek ${m[1].length}`;
  else if (/^\s*-\s/.test(line)) t = "Lista punktowana";
  else if (/^\s*(\+|\d+\.)\s/.test(line)) t = "Lista numerowana";
  else if (/^\s*\/\s/.test(line)) t = "Lista terminów";
  else if (/^#quote/.test(line)) t = "Cytat";
  else if (/^\$/.test(line)) t = "Wzór blokowy";
  else if (/^\s*\/\//.test(line)) t = "Komentarz";
  else if (/^#(definition|theorem|lemma|proof|example|note|exercise)/.test(line)) t = "Blok";
  lab.textContent = t;
}

/* Keys shared by the source pane and a block being edited */
const PAIRS = { $: "$", "(": ")", "[": "]", "{": "}", '"': '"' };
function insertText(ta, text, selFrom, selTo) {
  ta.focus();
  const s = ta.selectionStart;
  if (!document.execCommand("insertText", false, text)) {
    ta.setRangeText(text, ta.selectionStart, ta.selectionEnd, "end");
    ta.dispatchEvent(new Event("input"));
  }
  if (selFrom != null) ta.setSelectionRange(s + selFrom, s + (selTo != null ? selTo : selFrom));
}
function smartKeys(e, ta) {
  const st = S.settings;
  const v = ta.value,
    s = ta.selectionStart,
    en = ta.selectionEnd;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === "Tab") {
    e.preventDefault();
    if (s === en && !e.shiftKey) return insertText(ta, "  ");
    return shiftLines(ta, e.shiftKey ? -1 : 1);
  }
  if (e.key === "Enter" && st.list_continue && s === en) {
    const ls = v.lastIndexOf("\n", s - 1) + 1;
    const line = v.slice(ls, s);
    const m = /^(\s*)([-+]|\d+\.|\/)(\s+)(.*)$/.exec(line);
    if (m) {
      e.preventDefault();
      if (!m[4].trim()) {
        ta.setSelectionRange(ls, s);
        return insertText(ta, "");
      }
      let mk = m[2];
      if (/^\d+\.$/.test(mk)) mk = parseInt(mk, 10) + 1 + ".";
      return insertText(ta, "\n" + m[1] + mk + " " + (m[2] === "/" ? "" : ""));
    }
  }
  if (st.autopair) {
    const close = PAIRS[e.key];
    const next = v[s];
    if ((e.key === ")" || e.key === "]" || e.key === "}" || e.key === "$" || e.key === '"') && s === en && next === e.key) {
      e.preventDefault();
      ta.setSelectionRange(s + 1, s + 1);
      return;
    }
    if (close) {
      if (s !== en) {
        e.preventDefault();
        const sel = v.slice(s, en);
        return insertText(ta, e.key + sel + close, 1, 1 + sel.length);
      }
      if (e.key === '"' && /\w/.test(v[s - 1] || "")) return;
      if (e.key === "$" && v[s - 1] === "\\") return;
      e.preventDefault();
      return insertText(ta, e.key + close, 1);
    }
    if (e.key === "Backspace" && s === en && s > 0 && PAIRS[v[s - 1]] && PAIRS[v[s - 1]] === v[s]) {
      e.preventDefault();
      ta.setSelectionRange(s - 1, s + 1);
      return insertText(ta, "");
    }
  }
}
function shiftLines(ta, d) {
  const v = ta.value;
  const a = v.lastIndexOf("\n", ta.selectionStart - 1) + 1;
  let b = v.indexOf("\n", ta.selectionEnd - (ta.selectionEnd > ta.selectionStart && v[ta.selectionEnd - 1] === "\n" ? 1 : 0));
  if (b < 0) b = v.length;
  const block = v.slice(a, b);
  const out = block
    .split("\n")
    .map((l) => (d > 0 ? "  " + l : l.replace(/^ {1,2}/, "")))
    .join("\n");
  ta.setSelectionRange(a, b);
  insertText(ta, out);
  ta.setSelectionRange(a, a + out.length);
}

/* Page pane: click a block to edit its source in place */
function bindPage() {
  const page = E.page;
  page.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    if (E.editing && E.editing.blk.contains(e.target)) return;
    if (e.target.closest(".tlink,.tref,.toutline-i")) return;
    if (E.editing) {
      e.preventDefault();
      const tb = e.target.closest(".blk");
      const add = e.target.closest(".add-end");
      const t = tb ? +tb.dataset.s : null;
      const { s, e: oldE } = E.editing;
      const oldLen = oldE - s + 1;
      commitEdit();
      if (add) return editAtEnd();
      if (t == null) return;
      const newLen = E.editing ? 0 : null;
      void newLen, oldLen;
      // after commit the page is rebuilt; find the block whose source starts nearest the clicked one
      const target = $$(".blk", page).find((b) => +b.dataset.s >= (t > s ? t - 0 : t)) || null;
      const shifted = t > s ? nearestBlock(t, s) : $(`.blk[data-s="${t}"]`, page);
      const b = shifted || target;
      if (b) startEdit(b);
    }
  });
  page.addEventListener("mouseup", (e) => {
    if (e.button !== 0 || E.editing) return;
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed && page.contains(sel.anchorNode)) {
      const blk = sel.anchorNode.parentElement && sel.anchorNode.parentElement.closest(".blk");
      if (blk) showFloat(blk, sel);
      return;
    }
  });
  page.addEventListener("click", (e) => {
    if (E.editing) return;
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed) return;
    const ln = e.target.closest(".toutline-i");
    if (ln) return goToLine(+ln.dataset.line, 0, true);
    const tr = e.target.closest(".tref");
    if (tr) return toast(tr.classList.contains("missing") ? "Ta etykieta nie istnieje w notatce." : `Odsyłacz do ${tr.textContent}`, { type: tr.classList.contains("missing") ? "warn" : "info" });
    const tl = e.target.closest(".tlink");
    if (tl) return toast(`Otworzy się w przeglądarce: ${tl.title}`, { type: "info" });
    if (e.target.closest(".add-end") || e.target.closest(".wt-note > p.muted")) return editAtEnd();
    const blk = e.target.closest(".blk");
    if (!blk) return;
    if (blk.classList.contains("comment-blk")) return;
    let caret = null;
    try {
      const pos = document.caretRangeFromPoint ? document.caretRangeFromPoint(e.clientX, e.clientY) : null;
      if (pos && pos.startContainer.nodeType === 3) {
        const t = pos.startContainer.textContent;
        const ctx = t.slice(Math.max(0, pos.startOffset - 12), pos.startOffset);
        const lines = E.ta.value.split("\n").slice(+blk.dataset.s, +blk.dataset.e + 1).join("\n");
        if (ctx.length >= 3) {
          const i = lines.indexOf(ctx);
          if (i >= 0) caret = i + ctx.length;
        }
      }
    } catch {
      caret = null;
    }
    if (view() === "split") goToLine(+blk.dataset.s, 0, false, true);
    startEdit(blk, caret);
  });
}
function nearestBlock(t, s) {
  // blocks after the edited one may have moved; pick the first block at or after the old start of the clicked block minus the edited block's growth
  const bs = $$(".blk", E.page);
  let best = null;
  for (const b of bs) {
    if (+b.dataset.s > s) {
      if (!best) best = b;
      if (+b.dataset.s <= t) best = b;
    }
  }
  return best;
}
function editAtEnd() {
  const v = E.ta.value;
  const blocks = E.r.blocks;
  const last = blocks[blocks.length - 1];
  if (last && last.kind === "para") {
    const b = $(`.blk[data-s="${last.start}"]`, E.page);
    if (b) return startEdit(b);
  }
  const trimmed = v.replace(/\s+$/, "");
  E.ta.value = trimmed + (trimmed ? "\n\n" : "");
  const line = E.ta.value.split("\n").length - 1;
  recompute();
  renderSourceHl();
  const blk = el(`<div class="blk" data-s="${line}" data-e="${line}"></div>`);
  insertBlk(blk);
  const ph = $(".wt-note > p.muted", E.page);
  if (ph) ph.remove();
  startEdit(blk);
}
function startEdit(blk, caret = null) {
  if (E.editing) commitEdit();
  closeFloat();
  const s = +blk.dataset.s,
    e = +blk.dataset.e;
  const text = E.ta.value.split("\n").slice(s, e + 1).join("\n");
  E.editing = { s, e, blk };
  blk.classList.add("editing");
  blk.classList.remove("has-err");
  blk.innerHTML = `<textarea class="blk-ta" rows="1" spellcheck="${S.settings.spellcheck}" aria-label="Źródło bloku"></textarea><div class="blk-live"></div>
    <div class="blk-hint"><span>${kbd("Esc")} zakończ</span><span>${kbd("Ctrl+Enter")} nowy akapit</span><span class="grow"></span><span>wiersze ${s + 1}–<span class="e">${e + 1}</span> pliku</span></div>`;
  const ta = $("textarea", blk);
  ta.value = text;
  E.bta = ta;
  E.lastTA = ta;
  autosize(ta);
  blockLive();
  ta.focus({ preventScroll: true });
  const c = caret == null ? text.length : Math.min(caret, text.length);
  ta.setSelectionRange(c, c);
  ta.addEventListener("input", onBlockInput);
  ta.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape") {
      ev.preventDefault();
      ev.stopPropagation();
      commitEdit();
      return;
    }
    if (ev.key === "Enter" && (ev.ctrlKey || ev.metaKey)) {
      ev.preventDefault();
      newParagraphAfter();
      return;
    }
    smartKeys(ev, ta);
  });
  for (const ev of ["keyup", "click", "select"]) ta.addEventListener(ev, caretMoved);
  ta.addEventListener("blur", () => {
    E && (E.lastSel = { ta, s: ta.selectionStart, e: ta.selectionEnd });
    setTimeout(() => {
      if (!E || !E.editing || E.bta !== ta) return;
      if (document.activeElement === ta) return;
      if (document.activeElement && document.activeElement.closest && document.activeElement.closest(".wt-toolbar,.float-tb,.vtb")) return;
      if ($("#layer").childElementCount || $(".wt-menu")) return;
      commitEdit();
    }, 150);
  });
  caretMoved();
  blk.scrollIntoView({ block: "nearest" });
}
function onBlockInput() {
  const ta = E.bta;
  const lines = E.ta.value.split("\n");
  const nl = ta.value.split("\n");
  lines.splice(E.editing.s, E.editing.e - E.editing.s + 1, ...nl);
  E.editing.e = E.editing.s + nl.length - 1;
  E.ta.value = lines.join("\n");
  const eSpan = $(".blk-hint .e", E.editing.blk);
  if (eSpan) eSpan.textContent = E.editing.e + 1;
  recompute();
  renderSourceHl();
  renderDiag();
  autosize(ta);
  blockLive();
  markDirty(E.id);
  caretMoved();
}
function blockLive() {
  const live = $(".blk-live", E.editing.blk);
  const r = TY.render(E.bta.value);
  live.innerHTML = r.html.join("") + (r.footnotes.length ? `<section class="footnotes"><ol>${r.footnotes.map((f) => `<li>${f}</li>`).join("")}</ol></section>` : "");
}
function autosize(ta) {
  ta.style.height = "auto";
  ta.style.height = ta.scrollHeight + 2 + "px";
}
function commitEdit() {
  if (!E || !E.editing) return;
  E.editing = null;
  E.bta = null;
  if (E.lastTA && !E.lastTA.isConnected) E.lastTA = null;
  const st = E.panePage.scrollTop;
  renderPage();
  E.panePage.scrollTop = st;
}
function newParagraphAfter() {
  const { e } = E.editing;
  commitEdit();
  const lines = E.ta.value.split("\n");
  lines.splice(e + 1, 0, "", "");
  E.ta.value = lines.join("\n");
  recompute();
  renderSourceHl();
  renderPage();
  markDirty(E.id);
  const line = e + 2;
  const blk = el(`<div class="blk" data-s="${line}" data-e="${line}"></div>`);
  const next = $$(".blk", E.page).find((b) => +b.dataset.s > e);
  insertBlk(blk, next);
  startEdit(blk);
}

/* Which textarea should a toolbar action change? */
function activeTA(create = true) {
  if (!E) return null;
  if (E.bta && E.bta.isConnected) return E.bta;
  if (view() !== "page") return E.ta;
  if (!create) return null;
  editAtEnd();
  return E.bta;
}
function restoreFocus() {
  if (!E) return;
  const ls = E.lastSel;
  if (ls && ls.ta.isConnected) {
    ls.ta.focus({ preventScroll: true });
    ls.ta.setSelectionRange(ls.s, ls.e);
  }
}
function goToLine(line, col = 0, flash = false, noFocus = false) {
  if (!E) return;
  if (view() === "page") {
    const b = blockAtLine(line) || $$(".blk", E.page).find((x) => +x.dataset.s >= line);
    if (b) {
      b.scrollIntoView({ block: "center", behavior: "smooth" });
      b.classList.remove("flash");
      void b.offsetWidth;
      b.classList.add("flash");
    }
    return;
  }
  const idx = indexOfLine(E.ta.value, line, col);
  if (!noFocus) {
    E.ta.focus({ preventScroll: true });
    E.ta.setSelectionRange(idx, idx);
  }
  const row = E.pre.children[line];
  if (row) E.paneSrc.scrollTop = Math.max(0, row.offsetTop - E.paneSrc.clientHeight / 3);
  if (flash && view() === "split") {
    const b = blockAtLine(line);
    if (b) {
      b.scrollIntoView({ block: "center", behavior: "smooth" });
      b.classList.add("flash");
    }
  }
  caretMoved();
}
function selectRange(line, col, len) {
  if (!E) return;
  if (view() === "page") return goToLine(line, col);
  const idx = indexOfLine(E.ta.value, line, col);
  E.ta.focus({ preventScroll: true });
  E.ta.setSelectionRange(idx, idx + len);
  const row = E.pre.children[line];
  if (row) E.paneSrc.scrollTop = Math.max(0, row.offsetTop - E.paneSrc.clientHeight / 3);
  if (view() === "split") {
    const b = blockAtLine(line);
    if (b) b.scrollIntoView({ block: "center" });
  }
  caretMoved();
}
function setView(v) {
  if (E && E.editing) commitEdit();
  S.view = v;
  persist();
  if (!E) return;
  E.ed.dataset.view = v;
  E.ed.classList.remove("fade");
  void E.ed.offsetWidth;
  E.ed.classList.add("fade");
  $$(".wt-seg button", E.root).forEach((b) => b.setAttribute("aria-checked", b.dataset.act === "view" + v[0].toUpperCase() + v.slice(1)));
  applyPageView();
  renderStatus();
  if (v !== "page") setTimeout(() => E && E.ta.focus({ preventScroll: true }), 0);
}
function reloadEditorSource(id) {
  if (E && E.id === id) {
    const v = $("#view");
    v.replaceChildren(editorView(id));
  }
}

/* ---------- Text actions ---------- */
function wrapSel(before, after, ph) {
  const ta = activeTA();
  if (!ta) return;
  const v = ta.value,
    s = ta.selectionStart,
    e = ta.selectionEnd;
  const sel = v.slice(s, e);
  // toggle off when the selection is already wrapped
  if (sel && v.slice(s - before.length, s) === before && v.slice(e, e + after.length) === after) {
    ta.setSelectionRange(s - before.length, e + after.length);
    insertText(ta, sel, 0, sel.length);
    return;
  }
  if (sel.startsWith(before) && sel.endsWith(after) && sel.length >= before.length + after.length) {
    const inner = sel.slice(before.length, sel.length - after.length);
    return insertText(ta, inner, 0, inner.length);
  }
  const t = sel || ph;
  insertText(ta, before + t + after, before.length, before.length + t.length);
}
function linePrefix(prefix) {
  const ta = activeTA();
  if (!ta) return;
  const v = ta.value;
  const a = v.lastIndexOf("\n", ta.selectionStart - 1) + 1;
  let b = v.indexOf("\n", ta.selectionEnd);
  if (b < 0) b = v.length;
  const lines = v.slice(a, b).split("\n");
  const strip = (l) => l.replace(/^(=+\s|\s*[-+]\s|\s*\d+\.\s|\s*\/\s)/, "");
  const all = lines.every((l) => l.startsWith(prefix) || !l.trim());
  const out = lines.map((l) => (!l.trim() && lines.length > 1 ? l : all && prefix ? strip(l) : prefix + strip(l))).join("\n");
  ta.setSelectionRange(a, b);
  insertText(ta, out);
  const caret = a + out.length;
  ta.setSelectionRange(caret, caret);
}
function insertBlock(text, caretOffset = null) {
  const ta = activeTA();
  if (!ta) return;
  const v = ta.value;
  const s = ta.selectionStart;
  let ls = v.lastIndexOf("\n", s - 1) + 1;
  let le = v.indexOf("\n", s);
  if (le < 0) le = v.length;
  const line = v.slice(ls, le);
  let pre = "",
    at = s;
  if (line.trim()) {
    at = le;
    pre = "\n\n";
  } else if (ls > 0 && v[ls - 2] !== "\n" && v.slice(0, ls).trim()) pre = "\n";
  ta.setSelectionRange(at, ta.selectionEnd > at ? ta.selectionEnd : at);
  const post = v.slice(at).trim() ? "\n\n" : "\n";
  const c = caretOffset == null ? text.length : caretOffset;
  insertText(ta, pre + text + post, pre.length + c);
}
function selectedText() {
  const ta = activeTA(false);
  return ta ? ta.value.slice(ta.selectionStart, ta.selectionEnd) : "";
}
function insideMath(ta) {
  const before = ta.value.slice(0, ta.selectionStart).replace(/\\\$/g, "");
  return (before.match(/\$/g) || []).length % 2 === 1;
}
function insertSymbol(name, glyph) {
  const ta = activeTA();
  if (!ta) return;
  if (insideMath(ta)) insertText(ta, (/[\w)]$/.test(ta.value.slice(0, ta.selectionStart)) ? " " : "") + name + " ");
  else insertText(ta, glyph);
  S.recentSyms = [name, ...S.recentSyms.filter((x) => x !== name)].slice(0, 14);
  persist();
}
function clearFormatting() {
  const ta = activeTA();
  if (!ta) return;
  let t = ta.value.slice(ta.selectionStart, ta.selectionEnd);
  if (!t) return toast("Zaznacz tekst, z którego chcesz usunąć formatowanie.", { type: "info" });
  for (let k = 0; k < 4; k++) t = t.replace(/#(highlight|underline|strike|super|sub|text|emph|strong)(\([^)]*\))?\[([^\]]*)\]/g, "$3");
  t = t.replace(/(^|[^\\])[*_`]/g, "$1").replace(/(^|[^\\])[*_`]/g, "$1");
  insertText(ta, t, 0, t.length);
}

/* ---------- Saving ---------- */
function markDirty(id) {
  const n = S.notes[id];
  if (!n) return;
  if (n.phase === "conflict") {
    n.source = n.source;
  } else {
    const was = n.phase;
    n.phase = n.source === n.disk ? "saved" : "unsaved";
    if (was !== n.phase) refreshChrome();
    else renderStatus();
  }
  if (S.preview === id) {
    S.preview = null;
    renderTabs();
  }
  clearTimeout(n.timer);
  if (S.settings.autosave && n.phase === "unsaved") n.timer = setTimeout(() => saveNote(id), S.settings.autosave_delay * 1000);
}
let failNext = false;
function saveNote(id, manual = false) {
  const n = S.notes[id];
  if (!n) return;
  clearTimeout(n.timer);
  if (n.phase === "conflict") {
    if (manual) toast("Plik zmienił się na dysku. Wybierz w pasku nad notatką, którą wersję zostawić.", { type: "warn" });
    return;
  }
  if (n.phase === "saved" && !manual) return;
  n.phase = "saving";
  refreshChrome();
  setTimeout(() => {
    if (failNext) {
      failNext = false;
      n.phase = "failed";
      refreshChrome();
      if (E && E.id === id) renderBanners();
      return;
    }
    n.disk = n.source;
    n.phase = n.source === n.disk ? "saved" : "unsaved";
    refreshChrome();
    if (E && E.id === id) renderBanners();
    persist();
  }, 420);
}
function renderBanners() {
  if (!E) return;
  const n = S.notes[E.id];
  let h = "";
  if (n.phase === "conflict")
    h = `<div class="banner" role="alert"><span class="ic">${icon("warning")}</span><div><b>Zmieniono na dysku</b>Inny program zmienił „${esc(n.file)}”, a ta karta ma własną wersję. Wybierz, którą zostawić.</div>
      <div class="act"><button class="wt-btn secondary sm" data-act="conflictLoad">Wczytaj z dysku</button><button class="wt-btn danger sm" data-act="conflictKeep">Nadpisz</button></div></div>`;
  else if (n.phase === "failed")
    h = `<div class="banner danger" role="alert"><span class="ic">${icon("error")}</span><div><b>Nie udało się zapisać</b>Dysk odmówił zapisu „${esc(n.file)}” (plik tylko do odczytu albo brak miejsca). Zmiany są nadal w tej karcie.</div>
      <div class="act"><button class="wt-btn secondary sm" data-act="saveAs">Zapisz jako…</button><button class="wt-btn primary sm" data-act="save">Spróbuj ponownie</button></div></div>`;
  else if (noteKind(E.id) === "loose" && !n.looseAck)
    h = `<div class="banner" style="background:var(--color-surface-sunken)"><span class="ic" style="color:var(--color-text-muted)">${icon("info")}</span><div><b>Plik spoza folderu</b>Ten plik wybrałeś w oknie systemowym. Zapisujemy go tam, gdzie leży: ${esc(n.path)}.</div>
      <div class="act"><button class="wt-btn ghost sm" data-act="looseAck">Rozumiem</button></div></div>`;
  E.banners.innerHTML = h;
}

/* ---------- Status bar ---------- */
const PHASE = { saved: "Zapisano", unsaved: "Nie zapisano", saving: "Zapisuję…", conflict: "Konflikt z dyskiem", failed: "Błąd zapisu" };
function renderStatus() {
  const s = $("#status");
  s.hidden = !S.settings.status_bar;
  const t = S.active;
  const n = S.notes[t];
  const proto = `<button data-act="protoMenu" title="Symulacje dla prototypu">${icon("package", "sm")}Prototyp</button>`;
  if (!n) {
    const sum = saveSummary();
    s.dataset.save = sum.cls ? "unsaved" : "saved";
    s.innerHTML = `<span class="si save"><span class="save-dot"></span>${sum.cls ? sum.text : "Wszystko zapisane"}</span>
      <span class="si path">${esc(WS() ? WS().path : "Brak otwartego folderu")}</span><span class="gap"></span>${proto}
      <span class="si">Typst 0.13.1</span><span class="si">${S.settings.locale === "pl" ? "Polski" : "English"}</span>${problemsBtn()}${pinBtn()}`;
    renderProblems();
    return;
  }
  s.dataset.save = n.phase;
  const words = TY.wordCount(n.source);
  s.innerHTML = `<button class="save" data-act="save" title="${esc(tip("save"))}"><span class="save-dot"></span>${PHASE[n.phase]}</button>
    <button class="path" data-act="copyPath" data-arg="${t}" title="Kopiuj ścieżkę">${esc(notePath(t))}</button>
    <span class="gap"></span>
    <button class="caret" data-act="gotoLine" title="Przejdź do wiersza">Wr ${E && E.caret ? E.caret.ln + 1 : 1}, kol ${E && E.caret ? E.caret.col : 1}</button>
    <span class="si">${words} ${words === 1 ? "słowo" : words % 10 >= 2 && words % 10 <= 4 && (words % 100 < 10 || words % 100 >= 20) ? "słowa" : "słów"}</span>
    ${proto}
    <span class="si">Typst 0.13.1</span>${problemsBtn()}${pinBtn()}`;
  renderProblems();
}

/* ---------- Problems panel (like VS Code's) ---------- */
const diagCache = new WeakMap();
function diagsOf(id) {
  const n = S.notes[id];
  if (E && E.id === id && E.r) return E.r.diags;
  const c = diagCache.get(n);
  if (c && c.src === n.source) return c.d;
  const d = TY.render(n.source).diags;
  diagCache.set(n, { src: n.source, d });
  return d;
}
function problemsList() {
  return S.tabs.filter((t) => S.notes[t]).map((t) => ({ id: t, diags: diagsOf(t) }));
}
function plErr(k) {
  return k === 1 ? "błąd" : k % 10 >= 2 && k % 10 <= 4 && (k % 100 < 10 || k % 100 >= 20) ? "błędy" : "błędów";
}
function problemsBtn() {
  const total = problemsList().reduce((a, g) => a + g.diags.length, 0);
  const open = S.problems.open;
  const label = total ? `${icon("error", "sm")}${total} ${plErr(total)}` : `${icon("check", "sm")}Bez błędów`;
  return `<button class="pb-btn ${total ? "err-cnt" : "ok-cnt"}" data-act="problems" aria-expanded="${open}" title="${open ? "Zwiń" : "Rozwiń"} panel problemów (${esc(keyOf("problems"))})">${label}${icon(open ? "chevronDown" : "chevronUp", "sm")}</button>`;
}
function pinBtn() {
  const on = !S.settings.status_autohide;
  return `<button class="st-pin float-only" data-act="statusPin" aria-pressed="${on}" title="${on ? "Ukrywaj pasek automatycznie" : "Przypnij pasek, żeby był zawsze widoczny"}" aria-label="Przypnij dolny pasek">${icon(on ? "pin" : "pinOff", "sm")}</button>`;
}
/* A floating bar set to hide comes back when the pointer nears the bottom edge. */
function bindDock() {
  const main = $(".main"),
    dock = $("#dock");
  let t = 0;
  const show = (on) => {
    clearTimeout(t);
    if (on) main.classList.add("dock-show");
    else t = setTimeout(() => main.classList.remove("dock-show"), 500);
  };
  main.addEventListener("mousemove", (e) => {
    if (!floatUi() || !S.settings.status_autohide) return;
    const r = main.getBoundingClientRect();
    const reach = main.classList.contains("dock-show") ? dock.offsetHeight + 28 : 36;
    show(r.bottom - e.clientY < reach);
  });
  main.addEventListener("mouseleave", () => show(false));
}
function renderStatusProblems() {
  const b = $("#status .pb-btn");
  if (b) b.outerHTML = problemsBtn();
  renderProblems();
}
function renderProblems() {
  const p = $("#problems");
  if (!p) return;
  const open = S.problems.open;
  $("#dock").classList.toggle("pb-open", open);
  p.inert = !open;
  p.style.setProperty("--pb-h", S.problems.h + "px");
  // A closed panel keeps its last content, so it can shrink away instead of going blank.
  if (!open) return;
  const list = problemsList();
  const withErr = list.filter((g) => g.diags.length);
  const total = withErr.reduce((a, g) => a + g.diags.length, 0);
  const closed = new Set($$(".pb-grp.closed", p).map((g) => g.dataset.id));
  const keep = $(".pb-list", p) ? $(".pb-list", p).scrollTop : 0;
  p.innerHTML = `<div class="pb-resize" title="Przeciągnij, aby zmienić wysokość"></div>
    <div class="pb-h"><span class="t">Problemy</span><span class="cnt${total ? " on" : ""}">${total}</span>
      <span class="sc">w otwartych notatkach (${list.length})</span><span class="grow"></span>
      <button class="wt-ibtn xs" data-act="problems" title="Zwiń panel (${esc(keyOf("problems"))})" aria-label="Zwiń panel">${icon("chevronDown", "sm")}</button></div>
    <div class="pb-list" role="tree">${
      withErr.length
        ? withErr
            .map(
              (g) => `<div class="pb-grp${closed.has(g.id) ? " closed" : ""}" data-id="${g.id}">
          <button class="pb-file" data-act="pbFile" role="treeitem">${icon("chevronDown", "sm")}${itemIcon(g.id)}<span class="nm">${esc(S.notes[g.id].title)}</span><span class="p">${esc(notePath(g.id))}</span><span class="pb-n">${g.diags.length}</span></button>
          ${g.diags.map((d, i) => `<button class="pb-row" data-act="pbGo" data-arg="${g.id}:${i}" role="treeitem">${icon("error", "sm")}<span class="pb-msg">${esc(d.msg)}</span><span class="loc">Wr ${d.line + 1}, kol ${d.col + 1}</span></button>`).join("")}
        </div>`,
            )
            .join("")
        : `<div class="pb-none">${icon("check", "sm")}${list.length ? "Brak problemów w otwartych notatkach." : "Brak otwartych notatek."}</div>`
    }</div>`;
  $(".pb-list", p).scrollTop = keep;
}
function toggleProblems() {
  S.problems.open = !S.problems.open;
  persist();
  renderStatus();
}
function goProblem(id, i) {
  const d = diagsOf(id)[i];
  if (!d) return;
  if (S.active !== id) openNote(id);
  setTimeout(() => {
    if (!E || E.id !== id) return;
    if (view() === "page") goToLine(d.line, d.col);
    else selectRange(d.line, d.col, 1);
  }, 40);
}
function bindProblems() {
  const p = $("#problems");
  p.addEventListener("mousedown", (e) => {
    const h = e.target.closest(".pb-resize");
    if (!h || e.button !== 0) return;
    e.preventDefault();
    const z = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--ui-zoom")) || 1;
    const y0 = e.clientY,
      h0 = p.offsetHeight;
    const max = () => Math.max(120, $(".main").clientHeight - 160);
    h.classList.add("drag");
    $("#dock").classList.add("dragging");
    document.body.style.cursor = "row-resize";
    const move = (ev) => {
      S.problems.h = Math.round(Math.max(90, Math.min(max(), h0 + (y0 - ev.clientY) / z)));
      p.style.setProperty("--pb-h", S.problems.h + "px");
    };
    const up = () => {
      h.classList.remove("drag");
      $("#dock").classList.remove("dragging");
      document.body.style.cursor = "";
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", up);
      persist();
    };
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
  });
  p.addEventListener("dblclick", (e) => {
    if (!e.target.closest(".pb-resize")) return;
    S.problems.h = 200;
    p.style.setProperty("--pb-h", "200px");
    persist();
  });
}
function renderStatusCaret() {
  const c = $("#status .caret");
  if (c && E && E.caret) c.textContent = `Wr ${E.caret.ln + 1}, kol ${E.caret.col}`;
}

/* ---------- Floating toolbar for a selection on the page ---------- */
function showFloat(blk, sel) {
  closeFloat();
  const r = sel.getRangeAt(0).getBoundingClientRect();
  const text = sel.toString();
  const f = el(`<div class="float-tb" role="toolbar" aria-label="Formatuj zaznaczenie">
    ${["bold", "italic", "underline", "highlight", "code", "inlineMath", "link"].map((a) => `<button class="wt-ibtn sm" data-f="${a}" title="${esc(tip(a))}">${icon(ACT[a].icon)}</button>`).join("")}
    <span class="wt-sep"></span><button class="wt-btn ghost sm" data-f="edit">${icon("code", "sm")}Edytuj źródło</button></div>`);
  document.body.appendChild(f);
  const fw = f.offsetWidth;
  f.style.left = Math.max(8, Math.min(window.innerWidth - fw - 8, r.left + r.width / 2 - fw / 2)) + "px";
  f.style.top = Math.max(8, r.top - f.offsetHeight - 8) + "px";
  f.addEventListener("mousedown", (e) => e.preventDefault());
  f.addEventListener("click", (e) => {
    const b = e.target.closest("[data-f]");
    if (!b) return;
    const s = +blk.dataset.s,
      en = +blk.dataset.e;
    const src = E.ta.value.split("\n").slice(s, en + 1).join("\n");
    const i = src.indexOf(text);
    closeFloat();
    window.getSelection().removeAllRanges();
    startEdit(blk, i >= 0 ? i + text.length : null);
    if (i >= 0) E.bta.setSelectionRange(i, i + text.length);
    if (b.dataset.f !== "edit") {
      if (i < 0) toast("Zaznaczony fragment ma w źródle formatowanie. Zaznacz go jeszcze raz w polu źródła.", { type: "info" });
      else run(b.dataset.f);
    }
  });
  setTimeout(() => document.addEventListener("mousedown", closeFloatOutside), 0);
}
function closeFloatOutside(e) {
  if (!e.target.closest(".float-tb")) closeFloat();
}
function closeFloat() {
  $$(".float-tb").forEach((f) => f.remove());
  document.removeEventListener("mousedown", closeFloatOutside);
}

/* ---------- Workspaces, notes, tree ---------- */
function openWorkspace(ws) {
  if (S.ws === ws) return activate("home");
  S.ws = ws;
  S.recentWs = [ws, ...S.recentWs.filter((w) => w !== ws)];
  S.tabs = S.tabs.filter((t) => t === "settings" || inOpenScope(t));
  S.active = "home";
  S.tagFilter = null;
  renderAll();
  persist();
  toast(`Otwarto folder ${WORKSPACES[ws].name}`, { type: "info" });
}
async function closeWorkspace() {
  const open = S.tabs.filter((t) => S.notes[t] && noteKind(t) === "ws");
  for (const t of open) await closeTab(t);
  if (S.tabs.some((t) => S.notes[t] && noteKind(t) === "ws")) return;
  S.ws = null;
  S.active = "home";
  renderAll();
  persist();
}
function createNote({ title, tpl, where }) {
  const t = TEMPLATES.find((x) => x.id === tpl) || TEMPLATES[0];
  const id = "n-" + Date.now().toString(36);
  const file = slug(title) + ".typ";
  const src = t.body.replace(/\{title\}/g, title).replace(/\{date\}/g, todayIso());
  S.notes[id] = { title, file, tags: [], date: "teraz", excerpt: t.desc, source: src, disk: src, phase: "saved" };
  if (where === "drafts" || !S.ws) {
    S.notes[id].draft = true;
    S.drafts.unshift(id);
    S.sec.drafts = true;
  } else {
    const h = where && where !== "root" ? findFolder(where) : null;
    if (h) {
      h.folder.children.unshift(id);
      expandTrail([...h.trail, h.folder]);
    } else S.trees[S.ws].push(id);
    S.sec.root = true;
  }
  openNote(id);
  persist();
  setTimeout(() => {
    if (!E) return;
    if (view() !== "page") {
      const i = E.ta.value.length;
      E.ta.focus();
      E.ta.setSelectionRange(i, i);
    } else editAtEnd();
  }, 40);
  toast(`Utworzono ${file}`, { type: "ok" });
}
function treeItemMenu(id, at) {
  const n = S.notes[id];
  openMenu(at, [
    { label: "Otwórz", icon: "file", run: () => openNote(id) },
    { label: "Otwórz w podglądzie", icon: "eye", run: () => openNote(id, { preview: true }) },
    { sep: true },
    { label: "Zmień nazwę", icon: "edit", key: "F2", run: () => renameInline(id) },
    { label: "Zmień ikonę i kolor…", icon: "star", run: () => decoPop(id, false, at) },
    { label: "Duplikuj", icon: "copy", run: () => duplicateNote(id) },
    { label: "Kopiuj ścieżkę", icon: "copy", run: () => copyPath(id) },
    { label: "Pokaż w Eksploratorze", icon: "folderOpen", run: () => toast(`Eksplorator otworzy ${notePath(id).replace(/\/[^/]*$/, "")}`, { type: "info" }) },
    { label: "Eksportuj do PDF", icon: "pdf", run: () => exportPdf(id) },
    { sep: true },
    ...(n.loose ? [{ label: "Zamknij plik", icon: "close", run: () => forgetLoose(id) }] : []),
    { label: "Usuń", icon: "trash", danger: true, run: () => deleteNote(id) },
  ]);
}
function folderMenu(fid, at) {
  const h = findFolder(fid);
  if (!h) return;
  const f = h.folder;
  openMenu(at, [
    { label: "Nowa notatka tutaj", icon: "plus", run: () => newNoteDlg({ where: fid }) },
    { label: "Nowy podfolder", icon: "folderPlus", run: () => newFolder(fid) },
    { sep: true },
    { label: "Zmień nazwę", icon: "edit", key: "F2", run: () => renameFolderInline(fid) },
    { label: "Zmień ikonę i kolor…", icon: "star", run: () => decoPop(fid, true, at) },
    { label: "Zwiń wszystkie", icon: "chevronUp", run: () => collapseAll() },
    { label: "Pokaż w Eksploratorze", icon: "folderOpen", run: () => toast(`Eksplorator otworzy ${folderPath(fid)}`, { type: "info" }) },
    { sep: true },
    { label: f.children.length ? "Usuń folder (najpierw opróżnij)" : "Usuń folder", icon: "trash", danger: true, disabled: f.children.length > 0, run: () => (h.list.splice(h.list.indexOf(f), 1), delete S.deco[fid], renderSidebar(), persist()) },
  ]);
}
function rootMenu(at) {
  openMenu(at, [
    { label: "Nowa notatka", icon: "plus", run: () => newNoteDlg({ where: "root" }) },
    { label: "Nowy folder", icon: "folderPlus", run: () => newFolder() },
    { label: "Zwiń wszystkie", icon: "chevronUp", run: () => collapseAll() },
    { sep: true },
    { label: "Pokaż w Eksploratorze", icon: "folderOpen", run: () => toast(`Eksplorator otworzy ${WS().path}`, { type: "info" }) },
    { label: "Zamknij folder", icon: "close", run: () => closeWorkspace() },
  ]);
}
function expandTrail(folders) {
  const ids = folders.map((f) => f.id);
  S.collapsed = S.collapsed.filter((c) => !ids.includes(c));
}
function collapseAll() {
  S.collapsed = allFolders().map((x) => x.f.id);
  renderSidebar();
  persist();
}
function newFolder(parentId) {
  if (!S.ws) return toast("Najpierw otwórz folder.", { type: "info" });
  const h = parentId ? findFolder(parentId) : null;
  const list = h ? h.folder.children : S.trees[S.ws];
  const taken = new Set(list.filter(isFolder).map((f) => f.name));
  let name = "Nowy folder";
  for (let i = 2; taken.has(name); i++) name = `Nowy folder ${i}`;
  const f = { id: "f-" + Date.now().toString(36), name, dir: name, children: [] };
  const at = list.findIndex((it) => !isFolder(it));
  list.splice(at < 0 ? list.length : at, 0, f);
  if (h) expandTrail([...h.trail, h.folder]);
  S.sec.root = true;
  S.sidebar = true;
  if (S.search.q) clearSearch();
  renderRail();
  renderSidebar();
  persist();
  renameFolderInline(f.id);
}
function renameInline(id) {
  revealInTree(id);
  const row = $(`[data-row="${CSS.escape(id)}"]`);
  if (!row) return;
  const n = S.notes[id];
  const lbl = $(".lbl", row);
  const inp = el(`<input value="${esc(n.title)}" aria-label="Nowa nazwa">`);
  lbl.replaceWith(inp);
  inp.focus();
  inp.select();
  let done = false;
  const finish = (ok) => {
    if (done) return;
    done = true;
    const v = inp.value.trim();
    if (ok && v && v !== n.title) {
      n.title = v;
      if (!n.loose) n.file = slug(v) + ".typ";
      persist();
      toast(n.loose ? `Zmieniono nazwę na „${v}”` : `Plik ma teraz nazwę ${n.file}`, { type: "ok" });
    }
    renderSidebar();
    renderTabs();
    renderStatus();
    if (E && E.id === id) $(".crumbs", E.root).outerHTML = crumbsHtml(id);
  };
  inp.addEventListener("keydown", (e) => {
    e.stopPropagation();
    if (e.key === "Enter") finish(true);
    if (e.key === "Escape") finish(false);
  });
  inp.addEventListener("click", (e) => e.stopPropagation());
  inp.addEventListener("blur", () => finish(true));
}
function renameFolderInline(fid) {
  const row = $(`[data-folder="${fid}"]`);
  const h = findFolder(fid);
  if (!row || !h) return;
  const f = h.folder;
  const inp = el(`<input value="${esc(f.name)}" aria-label="Nowa nazwa folderu">`);
  $(".lbl", row).replaceWith(inp);
  inp.focus();
  inp.select();
  let done = false;
  const finish = (ok) => {
    if (done) return;
    done = true;
    if (ok && inp.value.trim()) {
      f.name = inp.value.trim();
      f.dir = f.name;
      persist();
    }
    renderSidebar();
  };
  inp.addEventListener("keydown", (e) => {
    e.stopPropagation();
    if (e.key === "Enter") finish(true);
    if (e.key === "Escape") finish(false);
  });
  inp.addEventListener("click", (e) => e.stopPropagation());
  inp.addEventListener("blur", () => finish(true));
}
function duplicateNote(id) {
  const n = S.notes[id];
  const nid = "n-" + Date.now().toString(36);
  S.notes[nid] = { ...clone({ ...n, timer: 0 }), title: n.title + " (kopia)", file: n.file.replace(/\.typ$/, "-kopia.typ"), disk: n.source, phase: "saved", loose: false, path: undefined };
  const loc = locate(id);
  if (loc) loc.list.splice(loc.list.indexOf(id) + 1, 0, nid);
  else {
    S.notes[nid].draft = true;
    S.drafts.unshift(nid);
  }
  renderSidebar();
  persist();
  toast(`Utworzono ${S.notes[nid].file}`, { type: "ok" });
}
async function deleteNote(id) {
  const n = S.notes[id];
  if (S.settings.confirm_delete) {
    const r = await confirmDlg({ title: `Usunąć „${n.title}”?`, text: `Plik ${n.file} trafi do kosza systemu. Możesz go stamtąd przywrócić.`, ok: "Przenieś do kosza", danger: true });
    if (!r) return;
  }
  const loc = locate(id);
  const snapshot = { list: loc ? loc.list : null, idx: loc ? loc.list.indexOf(id) : -1, draft: S.drafts.indexOf(id), loose: S.loose.indexOf(id), note: n };
  if (S.tabs.includes(id)) await closeTab(id, { force: true });
  if (loc) loc.list.splice(loc.list.indexOf(id), 1);
  S.drafts = S.drafts.filter((d) => d !== id);
  S.loose = S.loose.filter((d) => d !== id);
  delete S.notes[id];
  renderSidebar();
  if (S.active === "home") renderView();
  persist();
  toast(`Przeniesiono ${n.file} do kosza`, {
    type: "ok",
    action: {
      label: "Cofnij",
      run: () => {
        S.notes[id] = snapshot.note;
        if (snapshot.list) snapshot.list.splice(snapshot.idx, 0, id);
        if (snapshot.draft >= 0) S.drafts.splice(snapshot.draft, 0, id);
        if (snapshot.loose >= 0) S.loose.splice(snapshot.loose, 0, id);
        renderSidebar();
        if (S.active === "home") renderView();
        persist();
      },
    },
  });
}
function forgetLoose(id) {
  closeTab(id).then(() => {
    if (S.tabs.includes(id)) return;
    S.loose = S.loose.filter((x) => x !== id);
    renderSidebar();
    persist();
  });
}
function bindSidebar() {
  const sb = $("#sb");
  sb.addEventListener("contextmenu", (e) => {
    const r = e.target.closest("[data-row]");
    const f = e.target.closest("[data-folder]");
    const root = e.target.closest("[data-root]");
    if (!r && !f && !root) return;
    e.preventDefault();
    const at = { x: e.clientX, y: e.clientY };
    if (r) treeItemMenu(r.dataset.row, at);
    else if (f) folderMenu(f.dataset.folder, at);
    else rootMenu(at);
  });
  sb.addEventListener("dblclick", (e) => {
    const r = e.target.closest("[data-row]");
    if (r && S.preview === r.dataset.row) {
      S.preview = null;
      renderTabs();
      persist();
    }
  });
  sb.addEventListener("keydown", (e) => {
    const r = e.target.closest("[data-row]");
    if (r && e.key === "F2") {
      e.preventDefault();
      renameInline(r.dataset.row);
    }
    if (r && e.key === "Delete") {
      e.preventDefault();
      deleteNote(r.dataset.row);
    }
    const f = e.target.closest("[data-folder]");
    if (f && e.key === "F2") {
      e.preventDefault();
      renameFolderInline(f.dataset.folder);
    }
  });
}

/* ---------- PDF export ---------- */
async function exportPdf(id = S.active) {
  const n = S.notes[id];
  if (!n) return toast("Otwórz notatkę, żeby wyeksportować ją do PDF.", { type: "info" });
  const errs = TY.render(n.source).diags.length;
  if (errs) {
    const r = await confirmDlg({ title: "Notatka ma błędy", text: `Typst zgłasza ${errs === 1 ? "1 błąd" : errs + " błędy"}. PDF powstanie z ostatniej poprawnej wersji tych bloków. Eksportować mimo to?`, ok: "Eksportuj" });
    if (!r) return;
  }
  const t = toast(`<span class="wt-spin">${icon("refresh", "sm")}</span> Eksportuję ${esc(n.file.replace(".typ", ".pdf"))}…`, { type: "info", ms: 0, html: true });
  setTimeout(() => {
    t.close();
    toast(`Zapisano ${n.file.replace(".typ", ".pdf")} (${S.settings.pdf_paper}, ${String(S.settings.pdf_margin).replace(".", ",")} cm marginesu)`, {
      type: "ok",
      action: { label: "Pokaż w folderze", run: () => toast(`Eksplorator otworzy ${notePath(id).replace(/\/[^/]*$/, "")}`, { type: "info" }) },
    });
  }, 1100);
}

/* ---------- Dispatcher ---------- */
function run(id, ctx = {}) {
  const arg = ctx.arg;
  const a = ctx.el;
  const editorAct = ACT[id] && ["Formatowanie znaków", "Akapity i nagłówki", "Wstawianie"].includes(ACT[id].group);
  if (editorAct && !E) return toast("Otwórz notatkę, żeby użyć tego polecenia.", { type: "info" });
  switch (id) {
    // app
    case "palette":
    case "goto":
      return openPalette("");
    case "backToTabs":
      return backToTabs();
    case "problems":
      return toggleProblems();
    case "pbGo": {
      const [nid, i] = arg.split(":");
      return goProblem(nid, +i);
    }
    case "pbFile":
      return a.parentElement.classList.toggle("closed");
    case "pvFitWidth":
      return setPageFit("width");
    case "pvFitPage":
      return setPageFit("page");
    case "pvZoomIn":
      return zoomStep(1);
    case "pvZoomOut":
      return zoomStep(-1);
    case "pvZoomMenu":
      return zoomMenu(a);
    case "pvPin":
      S.settings.vtb_autohide = !S.settings.vtb_autohide;
      applySettings();
      persist();
      if (E && E.pagePane) E.pagePane.classList.toggle("vtb-show", !S.settings.vtb_autohide);
      return;
    case "statusPin":
      S.settings.status_autohide = !S.settings.status_autohide;
      applySettings();
      persist();
      renderStatus();
      $(".main").classList.toggle("dock-show", S.settings.status_autohide);
      return;
    case "uiStyle":
      S.settings.ui_style = floatUi() ? "fixed" : "float";
      applySettings();
      persist();
      renderStatus();
      if (S.active === "settings") renderView();
      return toast(floatUi() ? "Styl pływający: szklane paski i okna nad treścią." : "Styl stały: paski przy krawędziach okna.", { type: "info", ms: 2600 });
    case "pvOutside":
      S.pv.outside = S.pv.outside === "page" ? "theme" : "page";
      persist();
      return applyPageView();
    case "pvRound":
      S.pv.round = !S.pv.round;
      persist();
      return applyPageView();
    case "search":
    case "find":
      return focusSearch();
    case "replace":
      return focusSearch(true);
    case "settings":
      return activate("settings");
    case "shortcuts":
      return openShortcuts();
    case "toggleSidebar":
      S.sidebar = !S.sidebar;
      renderRail();
      return persist();
    case "toggleTheme":
      S.settings.theme = resolvedTheme() === "dark" ? "light" : "dark";
      applySettings();
      persist();
      renderSbFoot();
      if (S.active === "settings") renderView();
      return toast(`Motyw: ${S.settings.theme === "dark" ? "ciemny" : "jasny"}`, { type: "info" });
    case "cycleTheme":
      S.settings.theme = THEME_CYCLE[S.settings.theme] || "system";
      applySettings();
      renderSbFoot();
      persist();
      if (S.active === "settings") renderView();
      return;
    case "home":
      if (S.active === "home" && S.tabs.length) return backToTabs();
      return activate("home");
    case "newNote":
      return newNoteDlg(arg === "" ? { where: "root" } : { tpl: arg });
    case "newFolder":
      return newFolder();
    case "collapseAll":
      return collapseAll();
    case "newNoteDbl":
      return;
    case "openNote":
      if (arg) return openNote(arg, { preview: !(a && a.dataset.pin) && !!(a && a.closest(".wt-tree")) });
      return openFileDlg();
    case "openFolder":
      return openFolderDlg();
    case "openWs":
      return openWorkspace(arg);
    case "save":
      if (!S.notes[S.active]) return toast("Wszystko jest zapisane.", { type: "ok" });
      return saveNote(S.active, true);
    case "saveAs":
      return toast("Okno systemowe „Zapisz jako” – w prototypie bez zmian na dysku.", { type: "info" });
    case "exportPdf":
      return exportPdf();
    case "closeTab":
      return closeTab(S.active);
    case "reopenTab": {
      const t = S.closed.pop();
      if (t && S.notes[t]) return openNote(t);
      return toast("Brak zamkniętych kart do przywrócenia.", { type: "info" });
    }
    case "nextTab":
      return cycleTab(1);
    case "prevTab":
      return cycleTab(-1);
    case "viewSource":
      return setView("source");
    case "viewSplit":
      return setView("split");
    case "viewPage":
      return setView("page");
    case "tabsMenu":
      return openMenu(a, [
        { label: "Otwórz ponownie zamkniętą kartę", key: keyOf("reopenTab"), icon: "history", disabled: !S.closed.length, run: () => run("reopenTab") },
        { label: "Zamknij wszystkie karty", icon: "close", run: () => closeMany([...S.tabs]) },
        { label: "Zamknij zapisane karty", run: () => closeMany(S.tabs.filter((x) => S.notes[x] && S.notes[x].phase === "saved")) },
        { sep: true },
        { label: "Karty podglądu (kursywa)", check: S.settings.preview_tabs, run: () => ((S.settings.preview_tabs = !S.settings.preview_tabs), persist()) },
      ]);
    // sidebar
    case "toggleFolder":
      S.collapsed = S.collapsed.includes(arg) ? S.collapsed.filter((c) => c !== arg) : [...S.collapsed, arg];
      renderSidebar();
      return persist();
    case "toggleSec":
      S.sec[arg] = !S.sec[arg];
      renderSidebar();
      return persist();
    case "wsMenu":
      return openMenu(a, [
        { head: "Ostatnie foldery" },
        ...S.recentWs.map((w) => ({ label: WORKSPACES[w].name, icon: "folder", check: S.ws === w, run: () => openWorkspace(w) })),
        { sep: true },
        { label: "Otwórz folder…", icon: "folderOpen", key: keyOf("openFolder"), run: () => openFolderDlg() },
        { label: "Otwórz plik…", icon: "file", key: keyOf("openNote"), run: () => openFileDlg() },
        { label: "Zamknij folder", icon: "close", disabled: !S.ws, run: () => closeWorkspace() },
      ]);
    case "revealTree":
      return revealInTree(arg);
    case "copyPath":
      return copyPath(arg);
    // home
    case "homeTag":
      S.tagFilter = arg || null;
      return renderView();
    case "cardMenu":
      return openMenu(a, [
        { label: "Otwórz", icon: "file", run: () => openNote(arg) },
        { label: "Pokaż w drzewie", icon: "reveal", run: () => revealInTree(arg) },
        { label: "Kopiuj ścieżkę", icon: "copy", run: () => copyPath(arg) },
        { label: "Eksportuj do PDF", icon: "pdf", run: () => exportPdf(arg) },
        { sep: true },
        { label: "Usuń", icon: "trash", danger: true, run: () => deleteNote(arg) },
      ]);
    // editor chrome
    case "tagAdd":
      return tagDlg();
    case "tagRm": {
      const n = S.notes[S.active];
      n.tags = n.tags.filter((t) => t !== arg);
      $(".top-end", E.root).innerHTML = tagsBar(n) + `<button class="wt-btn ghost sm" data-act="exportPdf" title="${esc(tip("exportPdf"))}">${icon("pdf", "sm")}PDF</button>`;
      return persist();
    }
    case "goDiag": {
      if (!E || !E.r.diags.length) return;
      const d = E.r.diags[0];
      if (view() === "page") setView("split");
      return setTimeout(() => selectRange(d.line, d.col, 1), 20);
    }
    case "gotoLine":
      return openPalette(":");
    case "conflictLoad":
      return resolveConflict(true);
    case "conflictKeep":
      return resolveConflict(false);
    case "looseAck":
      S.notes[S.active].looseAck = true;
      return renderBanners();
    case "protoMenu":
      return openMenu(a, [
        { head: "Symulacje prototypu" },
        { label: ACT.simConflict.label, icon: "warning", run: () => run("simConflict") },
        { label: ACT.simSaveFail.label, icon: "error", run: () => run("simSaveFail") },
        { label: "Pokaż ekran powitalny (zamknij folder)", icon: "home", disabled: !S.ws, run: () => closeWorkspace() },
        { sep: true },
        { label: ACT.resetProto.label, icon: "undo", danger: true, run: () => run("resetProto") },
      ]);
    case "simConflict": {
      const n = S.notes[S.active];
      if (!n) return toast("Najpierw otwórz notatkę.", { type: "info" });
      n.phase = "conflict";
      clearTimeout(n.timer);
      n.other = n.disk.replace(/\s*$/, "") + "\n\n// Dopisane w innym edytorze\nTen akapit dodał inny program, gdy notatka była otwarta.\n";
      refreshChrome();
      return renderBanners();
    }
    case "simSaveFail": {
      failNext = true;
      const n = S.notes[S.active];
      if (n) {
        n.phase = n.phase === "conflict" ? "conflict" : "unsaved";
        saveNote(S.active, true);
      } else toast("Następny zapis się nie uda.", { type: "warn" });
      return;
    }
    case "resetProto":
      return confirmDlg({ title: "Przywrócić prototyp?", text: "Ustawienia, karty i zmiany w notatkach wrócą do stanu początkowego.", ok: "Przywróć", danger: true }).then((r) => {
        if (!r) return;
        store.clear();
        S = freshState();
        loadState();
        renderAll();
        toast("Przywrócono stan początkowy.", { type: "ok" });
      });
    // toolbar menus
    case "tbPara":
      return paraMenu(a);
    case "tbAlign":
      return alignMenu(a);
    case "tbBlocks":
      return blocksMenu(a);
    case "tbMore":
      return moreMenu(a);
    // formatting
    case "undo":
    case "redo": {
      const ta = activeTA(false) || (E && E.ta);
      if (!ta) return;
      ta.focus();
      document.execCommand(id);
      return;
    }
    case "bold":
      return wrapSel("*", "*", "pogrubiony tekst");
    case "italic":
      return wrapSel("_", "_", "kursywa");
    case "underline":
      return wrapSel("#underline[", "]", "podkreślenie");
    case "strike":
      return wrapSel("#strike[", "]", "przekreślenie");
    case "super":
      return wrapSel("#super[", "]", "2");
    case "sub":
      return wrapSel("#sub[", "]", "2");
    case "code":
      return wrapSel("`", "`", "kod");
    case "highlight":
      return wrapSel("#highlight[", "]", "ważne");
    case "color":
      return colorMenu(a || $('[data-act="color"]'));
    case "clear":
      return clearFormatting();
    case "h0":
      return linePrefix("");
    case "h1":
      return linePrefix("= ");
    case "h2":
      return linePrefix("== ");
    case "h3":
      return linePrefix("=== ");
    case "bullet":
      return linePrefix("- ");
    case "numbered":
      return linePrefix("+ ");
    case "term": {
      const sel = selectedText();
      return sel ? linePrefix("/ ") : insertBlock("/ Termin: opis", 2);
    }
    case "quote": {
      const sel = selectedText();
      return insertBlock(`#quote[${sel || "Cytat"}]`, 7);
    }
    case "indent":
      return shiftLines(activeTA(), 1);
    case "outdent":
      return shiftLines(activeTA(), -1);
    case "inlineMath":
      return wrapSel("$", "$", "x^2");
    case "blockMath": {
      const sel = selectedText();
      const t = sel || "x^2";
      return insertBlock(`$ ${t} $`, 2);
    }
    case "link":
      return linkDlg();
    case "footnote":
      return wrapSel("#footnote[", "]", "Treść przypisu");
    case "symbol":
      return symbolsDlg();
    case "table":
      return tableDlg();
    case "codeBlock":
      return insertBlock("```python\n\n```", 10);
    case "image":
      return imageDlg();
    case "shape":
      return shapesDlg();
    case "reference":
      return refMenu(a || $('[data-act="tbMore"]:not([hidden])') || $(".wt-toolbar .tb-mid"));
    case "date":
      return insertText(activeTA(), todayPl());
    case "pagebreak":
      return insertBlock("#pagebreak()");
    case "outline":
      return insertBlock("#outline()");
    case "block":
      return insertTheorem(arg);
    case "about":
      return aboutDlg();
    default:
      if (window.runExtra && window.runExtra(id, ctx) !== false) return;
      console.warn("Nieznane działanie", id);
  }
}
function insertTheorem(kind) {
  if (kind === "pagebreak") return insertBlock("#pagebreak()");
  const sel = selectedText();
  const ph = { definition: "Treść definicji.", theorem: "Treść twierdzenia.", lemma: "Treść lematu.", proof: "Dowód.", example: "Przykład.", note: "Na egzaminie.", exercise: "Treść zadania." }[kind] || "Treść.";
  const t = sel || ph;
  const head = `#${kind}[`;
  insertBlock(`${head}${t}]`, head.length);
  const ta = activeTA(false);
  if (ta && !sel) ta.setSelectionRange(ta.selectionStart, ta.selectionStart + t.length);
}
async function resolveConflict(load) {
  const n = S.notes[S.active];
  if (load) {
    if (n.source !== n.disk) {
      const r = await confirmDlg({ title: "Odrzucić zmiany w tej karcie?", text: "Wczytamy wersję z dysku. Zmiany, których nie zapisano, przepadną.", ok: "Wczytaj z dysku", danger: true });
      if (!r) return;
    }
    n.source = n.disk = n.other;
    n.phase = "saved";
    reloadEditorSource(S.active);
    toast("Wczytano wersję z dysku.", { type: "ok" });
  } else {
    const r = await confirmDlg({ title: "Nadpisać plik na dysku?", text: "Zmiany z innego programu przepadną. Zostanie wersja z tej karty.", ok: "Nadpisz", danger: true });
    if (!r) return;
    n.disk = n.source;
    n.phase = "saved";
    renderBanners();
    toast(`Zapisano ${n.file}`, { type: "ok" });
  }
  delete n.other;
  refreshChrome();
  renderBanners();
  persist();
}

/* ---------- Keyboard ---------- */
const CODE_KEYS = { Comma: ",", Period: ".", Slash: "/", Backslash: "\\", Tab: "Tab", Enter: "Enter", Escape: "Esc", Space: "Space", BracketLeft: "[", BracketRight: "]", Minus: "-", Equal: "=", PageUp: "PageUp", PageDown: "PageDown", F2: "F2" };
function comboOf(e) {
  let k = null;
  if (/^Key[A-Z]$/.test(e.code)) k = e.code.slice(3);
  else if (/^Digit\d$/.test(e.code)) k = e.code.slice(5);
  else if (/^Numpad\d$/.test(e.code)) k = e.code.slice(6);
  else if (CODE_KEYS[e.code]) k = CODE_KEYS[e.code];
  else if (/^F\d+$/.test(e.key)) k = e.key;
  if (!k) return null;
  return [e.ctrlKey || e.metaKey ? "Ctrl" : "", e.altKey ? "Alt" : "", e.shiftKey ? "Shift" : "", k].filter(Boolean).join("+");
}
function bindKeys() {
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && closeTop()) {
      e.preventDefault();
      return;
    }
    if (e.key === "Escape" && S.active === "home" && S.tabs.length && !(e.target.matches && e.target.matches("input,textarea,select"))) {
      e.preventDefault();
      return backToTabs();
    }
    if (window.recordingKey) return;
    const combo = comboOf(e);
    if (!combo || !/Ctrl|Alt/.test(combo)) return;
    const inField = e.target.matches && e.target.matches("input,select,textarea:not(.blk-ta):not(.code textarea)");
    if (inField) return;
    if (/^Ctrl\+[1-9]$/.test(combo)) {
      e.preventDefault();
      const i = +combo.slice(-1);
      const t = i === 9 ? S.tabs[S.tabs.length - 1] : S.tabs[i - 1];
      if (t) activate(t);
      return;
    }
    if (combo === "Ctrl+PageDown") return e.preventDefault(), cycleTab(1);
    if (combo === "Ctrl+PageUp") return e.preventDefault(), cycleTab(-1);
    if (combo === "Ctrl+F") return e.preventDefault(), run("find");
    if (combo === "Ctrl+H") return e.preventDefault(), run("replace");
    if (combo === "Ctrl+Z" || combo === "Ctrl+Y" || combo === "Ctrl+Shift+Z") return; // native undo stack
    const act = ACTIONS.find((x) => keyOf(x.id) === combo);
    if (!act) return;
    e.preventDefault();
    if ($("#layer").childElementCount && !["palette", "goto", "shortcuts", "settings"].includes(act.id)) return;
    closeMenu();
    run(act.id);
  });
}

/* ---------- Global clicks ---------- */
function bindClicks() {
  document.addEventListener("mousedown", (e) => {
    if (e.target.closest("[data-keep]")) e.preventDefault();
  });
  document.addEventListener("click", (e) => {
    const a = e.target.closest("[data-act]");
    if (!a || a.disabled || a.getAttribute("aria-disabled") === "true") return;
    if (a.closest(".wt-menu") || a.closest("#tabs .tab")) return;
    if (e.target.closest(".act") && a.dataset.act === "openNote" && a.classList.contains("wt-card")) return;
    e.stopPropagation();
    run(a.dataset.act, { el: a, ev: e, arg: a.dataset.arg });
  });
  document.addEventListener("keydown", (e) => {
    if ((e.key === "Enter" || e.key === " ") && e.target.matches(".wt-card[role=button]")) {
      e.preventDefault();
      e.target.click();
    }
  });
}

/* ---------- Boot ---------- */
function boot() {
  loadState();
  bindTabs();
  bindSidebar();
  bindSidebarResize();
  bindClicks();
  bindKeys();
  buildSidebar();
  bindSearch();
  bindProblems();
  bindDock();
  renderAll();
  window.addEventListener("beforeunload", persist);
}
