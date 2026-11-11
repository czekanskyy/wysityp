/* WYSITyp prototype – menus, dialogs, popovers, palette, toasts and the search panel. */
"use strict";

/* ---------- Layer stack ---------- */
const STACK = [];
let curMenu = null;
function layer() {
  return $("#layer");
}
function pushLayer(node, onClose) {
  const item = {
    node,
    close(v) {
      const i = STACK.indexOf(item);
      if (i < 0) return;
      STACK.splice(i, 1);
      node.remove();
      if (onClose) onClose(v);
      if (!STACK.length) setTimeout(restoreFocus, 0);
    },
  };
  STACK.push(item);
  layer().appendChild(node);
  return item;
}
function closeTop() {
  if (curMenu) {
    closeMenu();
    return true;
  }
  if (STACK.length) {
    STACK[STACK.length - 1].close(null);
    return true;
  }
  if ($(".float-tb")) {
    closeFloat();
    return true;
  }
  return false;
}

/* Centered modal dialog. `center` places it mid-screen, otherwise it hangs from the top like the palette. */
function openDialog(inner, { cls = "", center = true, onClose } = {}) {
  const scrim = el(`<div class="scrim${center ? " center" : ""}"></div>`);
  const dlg = typeof inner === "string" ? el(`<div class="dlg ${cls}" role="dialog" aria-modal="true">${inner}</div>`) : inner;
  scrim.appendChild(dlg);
  const item = pushLayer(scrim, onClose);
  scrim.addEventListener("mousedown", (e) => {
    if (e.target === scrim) item.close(null);
  });
  dlg.addEventListener("click", (e) => {
    const c = e.target.closest("[data-close]");
    if (c) item.close(null);
  });
  // Take focus at once, so a key press on the button that opened the dialog cannot open it twice.
  const focusFirst = () => {
    const f = $("[autofocus]", dlg) || $("input,textarea,select", dlg) || $(".wt-btn.primary,.wt-btn.danger", dlg);
    if (f) f.focus();
  };
  if (document.activeElement && !dlg.contains(document.activeElement)) document.activeElement.blur();
  focusFirst();
  setTimeout(focusFirst, 0);
  return { dlg, close: (v) => item.close(v) };
}

/* Popover hanging from a toolbar button, with an arrow. */
function openPop(anchor, inner, { cls = "", onClose } = {}) {
  const scrim = el(`<div class="scrim clear"></div>`);
  const pop = el(`<div class="pop ${cls}" role="dialog"><span class="pop-arrow"></span>${inner}</div>`);
  scrim.appendChild(pop);
  const item = pushLayer(scrim, onClose);
  scrim.addEventListener("mousedown", (e) => {
    if (e.target === scrim) item.close(null);
  });
  const place = () => {
    const r = anchor && anchor.getBoundingClientRect ? anchor.getBoundingClientRect() : null;
    const w = pop.offsetWidth,
      h = pop.offsetHeight;
    const vw = window.innerWidth,
      vh = window.innerHeight;
    const arrow = $(".pop-arrow", pop);
    if (!r || !r.width) {
      pop.style.left = Math.max(12, (vw - w) / 2) + "px";
      pop.style.top = "96px";
      arrow.hidden = true;
      return;
    }
    const left = Math.max(12, Math.min(vw - w - 12, r.left + r.width / 2 - w / 2));
    let top = r.bottom + 8;
    if (top + h > vh - 12 && r.top - h - 8 > 12) {
      top = r.top - h - 8;
      arrow.hidden = true;
    }
    pop.style.left = left + "px";
    pop.style.top = Math.max(12, Math.min(top, vh - h - 12)) + "px";
    arrow.style.left = Math.max(12, Math.min(w - 22, r.left + r.width / 2 - left - 5)) + "px";
  };
  place();
  setTimeout(() => {
    const f = $("[autofocus]", pop) || $("input", pop);
    if (f) f.focus();
  }, 0);
  return { pop, close: (v) => item.close(v), place };
}

/* ---------- Menus ---------- */
function openMenu(at, items, { cls = "", node = null } = {}) {
  if (curMenu && at && curMenu.at === at) return closeMenu();
  closeMenu();
  const m = el(`<div class="wt-menu ${cls}" role="menu"></div>`);
  if (node) m.appendChild(node);
  else
    m.innerHTML = items
      .map((it, i) => {
        if (it.sep) return '<hr class="wt-hr" style="margin:4px 0;border:0;border-top:1px solid var(--color-border)">';
        if (it.head) return `<div class="mh">${esc(it.head)}</div>`;
        const chk = it.check !== undefined ? `<span class="chk">${it.check ? icon("check", "sm") : ""}</span>` : "";
        return `<button class="wt-mi${it.danger ? " danger" : ""}" role="menuitem" data-i="${i}" data-keep ${it.disabled ? 'aria-disabled="true" tabindex="-1"' : ""} ${it.style ? `style="${it.style}"` : ""}>
          ${chk}${it.icon ? `<span class="ic">${icon(it.icon, "sm")}</span>` : it.swatch ? `<span class="ic">${it.swatch}</span>` : chk ? "" : '<span class="ic" style="width:14px"></span>'}
          <span class="l">${it.html || esc(it.label)}</span>${it.key ? `<span class="k">${esc(it.key)}</span>` : ""}</button>`;
      })
      .join("");
  document.body.appendChild(m);
  const r = at && at.getBoundingClientRect ? at.getBoundingClientRect() : at ? { left: at.x, right: at.x, top: at.y, bottom: at.y, width: 0 } : { left: 200, bottom: 100, top: 100 };
  const w = m.offsetWidth,
    h = m.offsetHeight;
  let left = at && at.getBoundingClientRect && r.left + w > window.innerWidth - 8 ? r.right - w : r.left;
  left = Math.max(8, Math.min(window.innerWidth - w - 8, left));
  let top = r.bottom + 4;
  if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 4);
  m.style.left = left + "px";
  m.style.top = top + "px";
  const opts = () => $$(".wt-mi:not([aria-disabled=true])", m);
  let fi = -1;
  const focusI = (i) => {
    const o = opts();
    if (!o.length) return;
    fi = (i + o.length) % o.length;
    o.forEach((x, k) => x.classList.toggle("focus", k === fi));
  };
  const key = (e) => {
    if (!curMenu || curMenu.m !== m) return;
    if (e.target.closest && e.target.closest(".wt-menu input")) return;
    if (e.key === "ArrowDown") (e.preventDefault(), focusI(fi + 1));
    else if (e.key === "ArrowUp") (e.preventDefault(), focusI(fi - 1));
    else if (e.key === "Enter" && fi >= 0) {
      e.preventDefault();
      e.stopPropagation();
      opts()[fi].click();
    }
  };
  const outside = (e) => {
    if (!m.contains(e.target) && !(at && at.contains && at.contains(e.target))) closeMenu();
  };
  m.addEventListener("mousedown", (e) => {
    if (!e.target.closest("input,textarea")) e.preventDefault();
  });
  m.addEventListener("click", (e) => {
    const b = e.target.closest(".wt-mi[data-i]");
    if (!b || b.getAttribute("aria-disabled") === "true") return;
    const it = items[+b.dataset.i];
    closeMenu();
    if (it && it.run) it.run();
  });
  setTimeout(() => {
    document.addEventListener("mousedown", outside, true);
  }, 0);
  document.addEventListener("keydown", key, true);
  if (at && at.setAttribute) at.setAttribute("aria-expanded", "true");
  curMenu = {
    m,
    at,
    off() {
      document.removeEventListener("mousedown", outside, true);
      document.removeEventListener("keydown", key, true);
    },
  };
  return m;
}
function closeMenu() {
  if (!curMenu) return;
  curMenu.off();
  curMenu.m.remove();
  if (curMenu.at && curMenu.at.setAttribute) curMenu.at.setAttribute("aria-expanded", "false");
  curMenu = null;
}

/* ---------- Toasts ---------- */
const TOAST_IC = { ok: "check", warn: "warning", err: "error", info: "info" };
function toast(msg, { type = "ok", ms = 4200, html = false, action = null } = {}) {
  const box = $("#toasts");
  const t = el(`<div class="toast ${type}" role="status"><span class="ic">${icon(TOAST_IC[type] || "info", "sm")}</span><span class="m"></span></div>`);
  $(".m", t)[html ? "innerHTML" : "textContent"] = msg;
  if (action) {
    const b = el(`<button class="wt-btn secondary sm">${esc(action.label)}</button>`);
    b.addEventListener("click", () => {
      action.run();
      close();
    });
    t.appendChild(b);
  }
  const x = el(`<button class="wt-ibtn sm" aria-label="Zamknij">${icon("close", "sm")}</button>`);
  x.addEventListener("click", () => close());
  t.appendChild(x);
  /* The bar drains over the toast's lifetime and stops while the pointer rests on it, together with the timer. */
  let left = ms ? (action ? ms + 2500 : ms) : 0;
  if (left) {
    const bar = el(`<span class="bar" aria-hidden="true"></span>`);
    bar.style.animationDuration = left + "ms";
    t.appendChild(bar);
  }
  box.appendChild(t);
  while (box.children.length > 4) box.firstElementChild.remove();
  let started = Date.now();
  let tm = left ? setTimeout(close, left) : 0;
  t.addEventListener("mouseenter", () => {
    if (!left) return;
    clearTimeout(tm);
    left = Math.max(400, left - (Date.now() - started));
  });
  t.addEventListener("mouseleave", () => {
    if (!left) return;
    started = Date.now();
    tm = setTimeout(close, left);
  });
  function close() {
    clearTimeout(tm);
    t.classList.add("out");
    setTimeout(() => t.remove(), 220);
  }
  return { close };
}

/* ---------- Confirm ---------- */
function confirmDlg({ title, text, ok = "OK", alt = null, cancel = "Anuluj", danger = false }) {
  return new Promise((resolve) => {
    let val = null;
    const d = openDialog(
      `<div class="dlg-h"><h2>${esc(title)}</h2></div>
      <div class="dlg-b"><p>${esc(text)}</p></div>
      <div class="dlg-f">${alt ? `<button class="wt-btn ghost" data-v="alt" style="margin-right:auto">${esc(alt)}</button>` : ""}
        <button class="wt-btn secondary" data-v="">${esc(cancel)}</button>
        <button class="wt-btn ${danger ? "danger" : "primary"}" data-v="ok" autofocus>${esc(ok)}</button></div>`,
      { cls: "confirm", onClose: () => resolve(val) },
    );
    d.dlg.setAttribute("role", "alertdialog");
    d.dlg.addEventListener("click", (e) => {
      const b = e.target.closest("[data-v]");
      if (!b) return;
      val = b.dataset.v || null;
      d.close();
    });
  });
}

/* ---------- Command palette ---------- */
function fuzzy(q, s) {
  if (!q) return { score: 1, html: esc(s) };
  const ls = fold(s.toLowerCase()),
    lq = fold(q.toLowerCase());
  const at = ls.indexOf(lq);
  if (at >= 0) return { score: 100 - at + (at === 0 ? 50 : 0), html: esc(s.slice(0, at)) + "<mark>" + esc(s.slice(at, at + q.length)) + "</mark>" + esc(s.slice(at + q.length)) };
  let i = 0;
  const hits = [];
  for (let k = 0; k < ls.length && i < lq.length; k++) if (ls[k] === lq[i]) (hits.push(k), i++);
  if (i < lq.length) return null;
  let html = "";
  for (let k = 0; k < s.length; k++) html += hits.includes(k) ? `<mark>${esc(s[k])}</mark>` : esc(s[k]);
  return { score: 20 - (hits[hits.length - 1] - hits[0]) / 4, html };
}
const FOLD = { ą: "a", ć: "c", ę: "e", ł: "l", ń: "n", ó: "o", ś: "s", ź: "z", ż: "z", Ą: "A", Ć: "C", Ę: "E", Ł: "L", Ń: "N", Ó: "O", Ś: "S", Ź: "Z", Ż: "Z" };
function fold(s) {
  let o = "";
  for (const ch of s) o += FOLD[ch] || (ch.charCodeAt(0) > 127 ? ch.normalize("NFD")[0] : ch);
  return o;
}
function paletteItems(raw) {
  const mode = /^[>@#:]/.test(raw) ? raw[0] : "";
  const q = (mode ? raw.slice(1) : raw).trim();
  const groups = [];
  const add = (name, list) => {
    const scored = list
      .map((it) => {
        const f = fuzzy(q, it.label);
        const fs = !f && it.sub ? fuzzy(q, it.sub) : null;
        return f ? { ...it, html: f.html, score: f.score } : fs ? { ...it, html: esc(it.label), score: fs.score - 30 } : null;
      })
      .filter(Boolean);
    if (q) scored.sort((a, b) => b.score - a.score);
    if (scored.length) groups.push({ name, items: scored.slice(0, 40) });
  };
  if (mode === ">") {
    const byGroup = {};
    for (const a of ACTIONS) (byGroup[a.group] = byGroup[a.group] || []).push({ icon: a.icon, label: a.label, sub: a.group, key: keyOf(a.id), run: () => run(a.id) });
    if (q) add("Polecenia", Object.values(byGroup).flat());
    else for (const g in byGroup) add(g, byGroup[g]);
  } else if (mode === "@") {
    if (!E) return { groups, empty: "Otwórz notatkę, żeby przejść do nagłówka." };
    add(
      "Nagłówki w tej notatce",
      E.r.heads.map((h) => ({ icon: "heading", label: h.text, sub: `wiersz ${h.line + 1}`, indent: h.lvl - 1, run: () => goToLine(h.line, 0, true) })),
    );
    if (!E.r.heads.length) return { groups, empty: "Ta notatka nie ma nagłówków. Dodaj je znakiem = na początku wiersza." };
  } else if (mode === "#") {
    const ids = [...wsNotes(), ...S.loose, ...S.drafts].filter((id) => S.notes[id]);
    const tags = [...new Set(ids.flatMap((id) => S.notes[id].tags || []))];
    add(
      "Tagi",
      tags.map((t) => ({
        swatch: `<span class="swl" style="background:var(--tag-${TAGS[t] || "gray"}-bg);color:var(--tag-${TAGS[t] || "gray"}-fg)"></span>`,
        label: t,
        sub: `${ids.filter((id) => (S.notes[id].tags || []).includes(t)).length} notatek`,
        run: () => {
          S.tagFilter = t;
          activate("home");
          renderView();
        },
      })),
    );
  } else if (mode === ":") {
    if (!E) return { groups, empty: "Otwórz notatkę, żeby przejść do wiersza." };
    const total = E.ta.value.split("\n").length;
    const m = /^(\d+)(?:[:,](\d+))?$/.exec(q);
    if (!m) return { groups, empty: `Wpisz numer wiersza od 1 do ${total}. Wiersz:kolumna też działa, np. 12:4.` };
    const ln = Math.min(total, Math.max(1, +m[1]));
    groups.push({ name: "Wiersz", items: [{ icon: "arrowLeft", html: `Przejdź do wiersza <b>${ln}</b>${m[2] ? `, kolumny ${m[2]}` : ""}`, sub: `z ${total}`, run: () => goToLine(ln - 1, m[2] ? +m[2] - 1 : 0, true) }] });
  } else {
    const ids = [...new Set([...S.recent, ...wsNotes(), ...S.loose, ...S.drafts])].filter((id) => S.notes[id] && inOpenScope(id));
    add(
      q ? "Notatki" : "Ostatnio otwierane",
      ids.map((id) => ({ icon: noteIcon(id), label: S.notes[id].title, sub: notePath(id).replace(/^.*?(?=[^/]+\/[^/]+$)/, ""), run: () => openNote(id) })),
    );
    if (q) {
      add(
        "Polecenia",
        ACTIONS.filter((a) => a.group !== "Prototyp").map((a) => ({ icon: a.icon, label: a.label, sub: a.group, key: keyOf(a.id), run: () => run(a.id) })),
      );
      groups.push({ name: "", items: [{ icon: "plus", html: `Utwórz notatkę „<b>${esc(q)}</b>”`, run: () => newNoteDlg({ title: q }) }] });
    }
  }
  return { groups, empty: "Nic nie pasuje. Spróbuj innego słowa." };
}
function openPalette(prefix = "") {
  if (STACK.some((s) => $(".wt-palette", s.node))) {
    const inp = $(".wt-palette input");
    inp.value = prefix;
    inp.dispatchEvent(new Event("input"));
    inp.focus();
    return;
  }
  const d = openDialog(
    `<div class="q">${icon("search")}<input aria-label="Szukaj notatki lub polecenia" autocomplete="off" spellcheck="false"></div>
    <div class="list" role="listbox"></div>
    <div class="foot"><span>${kbd("↑")}${kbd("↓")} wybór</span><span>${kbd("Enter")} otwórz</span><span><b>&gt;</b> polecenia</span><span><b>@</b> nagłówki</span><span><b>#</b> tagi</span><span><b>:</b> wiersz</span></div>`,
    { cls: "wt-palette", center: false },
  );
  d.dlg.classList.remove("dlg");
  const inp = $("input", d.dlg);
  const list = $(".list", d.dlg);
  inp.placeholder = "Szukaj notatki… (> polecenia, @ nagłówki, # tagi, : wiersz)";
  let flat = [],
    sel = 0;
  const draw = () => {
    const { groups, empty } = paletteItems(inp.value);
    flat = groups.flatMap((g) => g.items);
    sel = Math.min(sel, Math.max(0, flat.length - 1));
    let k = 0;
    list.innerHTML = flat.length
      ? groups
          .map(
            (g) =>
              (g.name ? `<div class="grp">${esc(g.name)}</div>` : "") +
              g.items
                .map((it) => {
                  const i = k++;
                  return `<div class="wt-opt" role="option" data-i="${i}" aria-selected="${i === sel}" ${it.indent ? `style="padding-left:${10 + it.indent * 16}px"` : ""}>
                  <span class="ic">${it.swatch || icon(it.icon || "file", "sm")}</span><span class="t">${it.html}</span>${it.sub ? `<span class="s">${esc(it.sub)}</span>` : ""}${it.key ? kbd(it.key) : ""}</div>`;
                })
                .join(""),
          )
          .join("")
      : `<div class="none">${esc(empty)}</div>`;
  };
  const mark = () => {
    $$(".wt-opt", list).forEach((o) => o.setAttribute("aria-selected", +o.dataset.i === sel));
    const o = $(`.wt-opt[data-i="${sel}"]`, list);
    if (o) o.scrollIntoView({ block: "nearest" });
  };
  const pick = (i) => {
    const it = flat[i];
    if (!it) return;
    d.close();
    setTimeout(() => it.run(), 0);
  };
  inp.value = prefix;
  inp.addEventListener("input", () => {
    sel = 0;
    draw();
  });
  inp.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") (e.preventDefault(), (sel = Math.min(flat.length - 1, sel + 1)), mark());
    else if (e.key === "ArrowUp") (e.preventDefault(), (sel = Math.max(0, sel - 1)), mark());
    else if (e.key === "Enter") (e.preventDefault(), pick(sel));
  });
  list.addEventListener("mousemove", (e) => {
    const o = e.target.closest(".wt-opt");
    if (o && +o.dataset.i !== sel) ((sel = +o.dataset.i), mark());
  });
  list.addEventListener("click", (e) => {
    const o = e.target.closest(".wt-opt");
    if (o) pick(+o.dataset.i);
  });
  draw();
  setTimeout(() => {
    inp.focus();
    inp.setSelectionRange(inp.value.length, inp.value.length);
  }, 0);
}

/* ---------- Keyboard shortcuts sheet ---------- */
function openShortcuts() {
  const d = openDialog(
    `<div class="kh"><h2>Skróty klawiszowe</h2><div class="inbox">${icon("search", "sm")}<input placeholder="Filtruj skróty" aria-label="Filtruj skróty"></div>
      <button class="wt-ibtn sm" data-close title="Zamknij">${icon("close")}</button></div>
    <div class="kc"></div>
    <div class="kf"><span>${kbd("Ctrl+Tab")} następna karta</span><span>${kbd("Ctrl+1")}…${kbd("9")} karta o numerze</span><span>${kbd("Esc")} zamknij okno</span><a data-k="edit">Zmień skróty w Ustawieniach</a></div>`,
    { cls: "kp" },
  );
  const kc = $(".kc", d.dlg);
  const inp = $("input", d.dlg);
  const draw = () => {
    const q = fold(inp.value.trim().toLowerCase());
    const groups = {};
    for (const a of ACTIONS) {
      if (a.group === "Prototyp") continue;
      const k = keyOf(a.id);
      if (!k && !a.typst) continue;
      if (q && !fold(a.label.toLowerCase()).includes(q) && !fold(k.toLowerCase()).includes(q) && !(a.typst || "").toLowerCase().includes(q)) continue;
      (groups[a.group] = groups[a.group] || []).push(a);
    }
    const html = Object.entries(groups)
      .map(([g, list]) => `<div><h4>${esc(g)}</h4>${list.map((a) => `<div class="kr"><span class="ks">${esc(a.label)}</span><span class="kt">${esc(a.typst || "")}</span>${kbd(keyOf(a.id)) || '<span class="kt">–</span>'}</div>`).join("")}</div>`)
      .join("");
    kc.innerHTML = html || '<p class="muted" style="grid-column:1/-1;padding:20px;text-align:center">Brak skrótów pasujących do filtra.</p>';
  };
  inp.addEventListener("input", draw);
  $("[data-k=edit]", d.dlg).addEventListener("click", () => {
    d.close();
    S.settingsSection = "keys";
    activate("settings");
    renderView();
  });
  draw();
}

/* ---------- Icon and colour of a note or folder ---------- */
function decoPop(id, isDir, at) {
  const anchor = $(isDir ? `[data-folder="${CSS.escape(id)}"]` : `[data-row="${CSS.escape(id)}"]`) || at;
  const name = isDir ? findFolder(id).folder.name : S.notes[id].title;
  const draw = () => {
    const d = S.deco[id] || {};
    const cur = decoOf(id, isDir);
    return `<div class="deco-h"><span class="t">${esc(name)}</span><button class="wt-btn ghost sm" data-deco-reset ${!d.icon && !d.color ? "disabled" : ""}>Domyślne</button></div>
      <div class="deco-l">Kolor</div>
      <div class="deco-colors" role="radiogroup" aria-label="Kolor">${DECO_COLORS.map((c) => `<button class="dsw${c.id ? "" : " none"}" role="radio" aria-checked="${(d.color || "") === c.id}" data-color="${c.id}" title="${esc(c.label)}" style="${c.id ? `--ic:var(--ic-${c.id})` : ""}"></button>`).join("")}</div>
      <div class="deco-l">Ikona</div>
      <div class="deco-icons" role="radiogroup" aria-label="Ikona">${DECO_ICONS[isDir ? "folder" : "note"]
        .map((ic) => `<button class="wt-ibtn sm${cur.color ? " c" : ""}" role="radio" aria-checked="${cur.icon === ic || (!d.icon && ((isDir && ic === "folder") || (!isDir && ic === noteIcon(id))))}" data-icon="${ic}" style="${cur.color ? `--ic:var(--ic-${cur.color})` : ""}">${icon(ic)}</button>`)
        .join("")}</div>`;
  };
  const { pop } = openPop(anchor, `<div class="deco-pop" role="dialog" aria-label="Ikona i kolor">${draw()}</div>`);
  const box = $(".deco-pop", pop) || pop;
  const apply = (patch) => {
    const d = { ...(S.deco[id] || {}), ...patch };
    Object.keys(d).forEach((k) => !d[k] && delete d[k]);
    if (Object.keys(d).length) S.deco[id] = d;
    else delete S.deco[id];
    box.innerHTML = draw();
    refreshChrome();
    persist();
  };
  box.addEventListener("click", (e) => {
    const c = e.target.closest("[data-color]");
    if (c) return apply({ color: c.dataset.color });
    const i = e.target.closest("[data-icon]");
    if (i) {
      const isDefault = (isDir && i.dataset.icon === "folder") || (!isDir && i.dataset.icon === "file");
      return apply({ icon: isDefault ? "" : i.dataset.icon });
    }
    if (e.target.closest("[data-deco-reset]")) {
      delete S.deco[id];
      box.innerHTML = draw();
      refreshChrome();
      persist();
    }
  });
}

/* ---------- New note ---------- */
function newNoteDlg({ tpl = "lecture", where = null, title = "" } = {}) {
  const folders = allFolders();
  if (!where) {
    const loc = S.notes[S.active] && locate(S.active);
    where = !S.ws ? "drafts" : loc && loc.folder && loc.ws === S.ws ? loc.folder.id : "root";
  }
  const d = openDialog(
    `<div class="dlg-h"><h2>Nowa notatka</h2><button class="wt-ibtn sm" data-close title="Zamknij">${icon("close")}</button></div>
    <div class="dlg-b">
      <div class="wt-field"><label for="nnT">Tytuł</label><input id="nnT" class="wt-input" autocomplete="off" placeholder="np. Wykład 8 – Szeregi potęgowe" value="${esc(title)}" autofocus><span class="wt-msg"></span></div>
      <div class="tpl-grp">Szablon</div>
      <div class="tpl-grid">${TEMPLATES.map((t) => `<button class="tpl" data-tpl="${t.id}" aria-pressed="${t.id === tpl}"><span class="t">${icon(t.icon, "sm")}${esc(t.name)}</span><span class="muted" style="font-size:12px;line-height:1.4">${esc(t.desc)}</span></button>`).join("")}</div>
      <div class="where">${icon("folder", "sm")}<span>Zapisz w</span>
        <select class="wt-input" style="width:auto;height:30px;font-size:13px">
          ${S.ws ? `<option value="root">${esc(rootName())}</option>${folders.map(({ f, trail }) => `<option value="${f.id}">${esc([rootName(), ...trail.map((t) => t.name), f.name].join(" / "))}</option>`).join("")}` : ""}
          <option value="drafts">Szkice (${esc(S.settings.drafts_dir)})</option>
        </select>
        <span class="grow"></span><code class="fn" style="font:12px var(--font-mono);color:var(--color-text-faint)"></code></div>
    </div>
    <div class="dlg-f"><span class="hint">Enter zatwierdza. Escape anuluje.</span><button class="wt-btn secondary" data-close>Anuluj</button><button class="wt-btn primary" data-ok>Utwórz notatkę</button></div>`,
    { cls: "nn" },
  );
  const inp = $("#nnT", d.dlg),
    selW = $("select", d.dlg),
    fn = $(".fn", d.dlg),
    field = $(".wt-field", d.dlg),
    msg = $(".wt-msg", d.dlg);
  selW.value = where;
  let cur = tpl;
  const check = () => {
    const t = inp.value.trim() || "Bez tytułu";
    const file = slug(t) + ".typ";
    fn.textContent = file;
    const w = selW.value;
    const siblings = w === "drafts" ? S.drafts : w === "root" ? S.trees[S.ws].filter((x) => typeof x === "string") : (folders.find((x) => x.f.id === w) || { f: { children: [] } }).f.children;
    const dup = siblings.some((id) => S.notes[id] && S.notes[id].file === file);
    field.classList.toggle("invalid", dup);
    msg.textContent = dup ? `W tym miejscu jest już plik ${file}. Zmień tytuł.` : "";
    return !dup;
  };
  const submit = () => {
    if (!check()) return inp.focus();
    d.close();
    createNote({ title: inp.value.trim() || "Bez tytułu", tpl: cur, where: selW.value });
  };
  d.dlg.addEventListener("click", (e) => {
    const t = e.target.closest("[data-tpl]");
    if (t) {
      cur = t.dataset.tpl;
      $$(".tpl", d.dlg).forEach((b) => b.setAttribute("aria-pressed", b === t));
      if (!inp.value.trim()) {
        const tp = TEMPLATES.find((x) => x.id === cur);
        inp.placeholder = cur === "blank" ? "Bez tytułu" : `np. ${tp.name} – ${todayPl()}`;
      }
    }
    if (e.target.closest("[data-ok]")) submit();
  });
  inp.addEventListener("input", check);
  selW.addEventListener("change", check);
  d.dlg.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.target.matches("button")) (e.preventDefault(), submit());
  });
  check();
}

/* ---------- Simulated native file dialogs ---------- */
const FAKE_FILES = [
  { name: "kolokwium-2025.typ", size: "4 KB", date: "wczoraj", note: "n-loose" },
  { name: "notatki-od-kasi.typ", size: "11 KB", date: "3 dni temu", title: "Notatki od Kasi – termodynamika", body: "= Termodynamika – notatki od Kasi\n\n== I zasada\n\n$ Delta U = Q - W $\n\nEnergia wewnętrzna rośnie o ciepło dostarczone i maleje o pracę wykonaną przez układ.\n\n== Procesy\n\n- izotermiczny: $T = \"const\"$\n- izobaryczny: $p = \"const\"$\n- adiabatyczny: $Q = 0$\n" },
  { name: "lista-zadan-5.pdf", size: "220 KB", date: "tydzień temu", pdf: true },
  { name: "Zdjęcia", folder: true },
];
function openFileDlg() {
  let sel = 0;
  const d = openDialog(
    `<div class="dlg-h">${icon("folderOpen")}<h2>Otwórz notatkę</h2><button class="wt-ibtn sm" data-close title="Zamknij">${icon("close")}</button></div>
    <div class="dlg-b">
      <p class="muted" style="font-size:12px">Okno systemowe Windows. Pliki spoza otwartego folderu trafią do sekcji „Luźne pliki”, a aplikacja zapamięta tylko te, które tu wybierzesz.</p>
      <div class="fs-path">${icon("folder", "sm")}Ten komputer<span>›</span>Użytkownik<span>›</span><b style="color:var(--color-text);font-weight:500">Pobrane</b><span class="grow"></span><span>Pliki Typst (*.typ)</span></div>
      <div class="fs-list" role="listbox">${FAKE_FILES.map((f, i) => `<button class="fs-row" data-i="${i}" aria-selected="${i === sel}" ${f.pdf || f.folder ? 'disabled style="opacity:.45;cursor:default"' : ""}>${icon(f.folder ? "folder" : f.pdf ? "pdf" : "file", "sm")}<span>${esc(f.name)}</span><span class="m">${f.folder ? "folder" : `${f.size} · ${f.date}`}</span></button>`).join("")}</div>
    </div>
    <div class="dlg-f"><span class="hint">Podwójne kliknięcie otwiera plik.</span><button class="wt-btn secondary" data-close>Anuluj</button><button class="wt-btn primary" data-ok>Otwórz</button></div>`,
    { cls: "fs" },
  );
  const open = () => {
    const f = FAKE_FILES[sel];
    d.close();
    let id = f.note;
    if (!id) {
      id = Object.keys(S.notes).find((k) => S.notes[k].path === "~/Pobrane/" + f.name);
      if (!id) {
        id = "n-" + Date.now().toString(36);
        S.notes[id] = { title: f.title, file: f.name, tags: [], date: "teraz", excerpt: "", source: f.body, disk: f.body, phase: "saved", loose: true, path: "~/Pobrane/" + f.name };
      }
    }
    if (!S.loose.includes(id)) S.loose.unshift(id);
    S.sec.loose = true;
    openNote(id);
    persist();
  };
  d.dlg.addEventListener("click", (e) => {
    const r = e.target.closest(".fs-row");
    if (r && !r.disabled) {
      sel = +r.dataset.i;
      $$(".fs-row", d.dlg).forEach((x) => x.setAttribute("aria-selected", x === r));
    }
    if (e.target.closest("[data-ok]")) open();
  });
  d.dlg.addEventListener("dblclick", (e) => {
    const r = e.target.closest(".fs-row");
    if (r && !r.disabled) open();
  });
  d.dlg.addEventListener("keydown", (e) => {
    if (e.key === "Enter") (e.preventDefault(), open());
  });
}
function openFolderDlg() {
  const ids = Object.keys(WORKSPACES);
  let sel = ids.find((w) => w !== S.ws) || ids[0];
  const d = openDialog(
    `<div class="dlg-h">${icon("folderOpen")}<h2>Otwórz folder</h2><button class="wt-ibtn sm" data-close title="Zamknij">${icon("close")}</button></div>
    <div class="dlg-b">
      <div class="fs-path">${icon("folder", "sm")}Ten komputer<span>›</span>Dokumenty<span>›</span><b style="color:var(--color-text);font-weight:500">WYSITyp</b></div>
      <div class="fs-list">${ids.map((w) => `<button class="fs-row" data-w="${w}" aria-selected="${w === sel}">${icon("folder", "sm")}<span>${esc(WORKSPACES[w].path.split("/").pop())}</span><span class="m">${wsNotes(w).length} notatek${w === S.ws ? " · otwarty" : ""}</span></button>`).join("")}
        <button class="fs-row" disabled style="opacity:.45;cursor:default">${icon("folder", "sm")}<span>Archiwum</span><span class="m">pusty</span></button></div>
      <p class="muted" style="font-size:12px">Aplikacja czyta i zapisuje tylko pliki w wybranym folderze. Nic nie wysyłamy do sieci.</p>
    </div>
    <div class="dlg-f"><button class="wt-btn secondary" data-close>Anuluj</button><button class="wt-btn primary" data-ok>Wybierz folder</button></div>`,
    { cls: "fs" },
  );
  const go = () => {
    d.close();
    openWorkspace(sel);
  };
  d.dlg.addEventListener("click", (e) => {
    const r = e.target.closest("[data-w]");
    if (r) {
      sel = r.dataset.w;
      $$("[data-w]", d.dlg).forEach((x) => x.setAttribute("aria-selected", x === r));
    }
    if (e.target.closest("[data-ok]")) go();
  });
  d.dlg.addEventListener("dblclick", (e) => e.target.closest("[data-w]") && go());
}

/* ---------- About ---------- */
function aboutDlg() {
  const libs = [
    ["Typst", "Apache-2.0"],
    ["Tauri", "MIT / Apache-2.0"],
    ["Svelte", "MIT"],
    ["CodeMirror", "MIT"],
    ["Paraglide JS", "MIT"],
    ["serde", "MIT / Apache-2.0"],
    ["Inter", "OFL-1.1"],
    ["JetBrains Mono", "OFL-1.1"],
    ["New Computer Modern", "GUST Font License"],
    ["Libertinus", "OFL-1.1"],
  ];
  openDialog(
    `<div class="dlg-h"><h2>O programie</h2><button class="wt-ibtn sm" data-close title="Zamknij">${icon("close")}</button></div>
    <div class="dlg-b">
      <div class="brand"><span class="mark">W</span><div><b style="font-size:16px">WYSITyp</b><div class="muted">Wersja 0.4.0 (prototyp HTML) · Typst 0.13.1</div></div></div>
      <p>What You See Is Typst. Notatki z wykładów, które renderują się na bieżąco i zostają zwykłymi plikami <code>.typ</code> na Twoim dysku.</p>
      <p class="muted">Licencja MIT. Działa offline. Bez śledzenia i telemetrii.</p>
      <div class="tpl-grp">Biblioteki i fonty</div>
      <div class="lic">${libs.map(([a, b]) => `<div><span>${esc(a)}</span><span>${esc(b)}</span></div>`).join("")}</div>
    </div>
    <div class="dlg-f"><button class="wt-btn primary" data-close>Zamknij</button></div>`,
    { cls: "about" },
  );
}

/* ---------- Tags ---------- */
function tagMenu(anchor) {
  const n = S.notes[S.active];
  if (!n) return;
  const all = [...new Set([...Object.keys(TAGS), ...Object.values(S.notes).flatMap((x) => x.tags || [])])];
  const node = el(`<div class="cmenu"><input class="wt-input" placeholder="Nowy tag i Enter" aria-label="Nowy tag" style="height:30px;font-size:13px"><div class="lab">Tagi</div><div class="row tl"></div><p class="note">Tagi zapisujemy w komentarzu na początku pliku, więc zostają w źródle Typst.</p></div>`);
  const draw = () => {
    $(".tl", node).innerHTML = all.map((t) => tagHtml(t, (n.tags || []).includes(t) ? "sel" : "").replace("<span", `<span data-t="${esc(t)}" role="button"`)).join("");
  };
  const sync = () => {
    if (E && E.id === S.active) $(".top-end", E.root).innerHTML = tagsBar(n) + `<button class="wt-btn ghost sm" data-act="exportPdf" title="${esc(tip("exportPdf"))}">${icon("pdf", "sm")}PDF</button>`;
    persist();
  };
  node.addEventListener("click", (e) => {
    const t = e.target.closest("[data-t]");
    if (!t) return;
    const name = t.dataset.t;
    n.tags = (n.tags || []).includes(name) ? n.tags.filter((x) => x !== name) : [...(n.tags || []), name];
    draw();
    sync();
  });
  const inp = $("input", node);
  inp.addEventListener("keydown", (e) => {
    e.stopPropagation();
    if (e.key === "Escape") return closeMenu();
    if (e.key !== "Enter") return;
    const v = inp.value.trim().toLowerCase();
    if (!v) return;
    if (!all.includes(v)) all.push(v);
    if (!(n.tags || []).includes(v)) n.tags = [...(n.tags || []), v];
    inp.value = "";
    draw();
    sync();
  });
  draw();
  openMenu(anchor, [], { node });
  setTimeout(() => inp.focus(), 0);
}

/* ---------- Toolbar menus ---------- */
function paraMenu(a) {
  const it = (id, label, style, key) => ({ html: `<span style="${style}">${label}</span>`, label, key: key !== undefined ? key : keyOf(id), run: () => run(id) });
  openMenu(
    a,
    [
      it("h0", "Zwykły akapit", "font-family:var(--font-prose)"),
      it("h1", "Nagłówek 1", "font:700 18px var(--font-prose)"),
      it("h2", "Nagłówek 2", "font:700 15.5px var(--font-prose)"),
      it("h3", "Nagłówek 3", "font:600 14px var(--font-prose)"),
      { sep: true },
      { icon: "bullets", label: "Lista punktowana", key: keyOf("bullet"), run: () => run("bullet") },
      { icon: "numbers", label: "Lista numerowana", key: keyOf("numbered"), run: () => run("numbered") },
      { icon: "terms", label: "Lista terminów", key: keyOf("term"), run: () => run("term") },
      { icon: "quote", label: "Cytat", key: keyOf("quote"), run: () => run("quote") },
      { icon: "codeBlock", label: "Blok kodu", key: keyOf("codeBlock"), run: () => run("codeBlock") },
    ],
    { cls: "hmenu" },
  );
}
function alignLine(kind) {
  const ta = activeTA();
  if (!ta) return;
  if (kind === "justify") return insertBlock("#set par(justify: true)");
  const v = ta.value;
  const a = v.lastIndexOf("\n", ta.selectionStart - 1) + 1;
  let b = v.indexOf("\n", ta.selectionEnd);
  if (b < 0) b = v.length;
  let line = v.slice(a, b);
  const m = /^#align\((left|center|right)\)\[(.*)\]$/s.exec(line);
  if (m) line = m[2];
  ta.setSelectionRange(a, b);
  insertText(ta, kind === "left" ? line : `#align(${kind})[${line || "Tekst"}]`);
}
function alignMenu(a) {
  openMenu(a, [
    { icon: "align", label: "Do lewej", run: () => alignLine("left") },
    { icon: "alignCenter", label: "Do środka", run: () => alignLine("center") },
    { icon: "alignRight", label: "Do prawej", run: () => alignLine("right") },
    { icon: "alignJustify", label: "Wyjustuj całą notatkę", run: () => alignLine("justify") },
  ]);
}
function blocksMenu(a) {
  openMenu(
    a,
    BLOCKS.map((b) =>
      b.head
        ? { head: b.head }
        : b.plain
          ? { icon: "pagebreak", label: b.name, run: () => run("block", { arg: b.id }) }
          : { swatch: `<span class="swl" style="background:var(--tag-${b.tag}-bg);color:var(--tag-${b.tag}-fg)"></span>`, label: b.name, key: `#${b.id}`, run: () => run("block", { arg: b.id }) },
    ),
  );
}
function moreMenu(a) {
  const ids = ["strike", "super", "sub", "clear", "term", "quote", "outdent", "indent", "image", "link", "footnote", "codeBlock", "reference", "date", "pagebreak", "outline"];
  const narrow = window.innerWidth < 1100;
  openMenu(a, [
    { head: "Formatowanie" },
    ...ids.slice(0, 4).map((id) => ({ icon: ACT[id].icon, label: ACT[id].label, key: keyOf(id), run: () => run(id) })),
    { head: "Akapity" },
    ...ids.slice(4, 8).map((id) => ({ icon: ACT[id].icon, label: ACT[id].label, key: keyOf(id), run: () => run(id) })),
    ...(narrow ? [{ icon: "align", label: "Wyrównanie…", run: () => alignMenu(a) }] : []),
    { head: "Wstaw" },
    ...ids.slice(8).map((id) => ({ icon: ACT[id].icon, label: ACT[id].label, key: keyOf(id), run: () => run(id) })),
    { sep: true },
    { icon: "settings", label: "Pełny pasek narzędzi", check: S.settings.toolbar === "full", run: () => ((S.settings.toolbar = S.settings.toolbar === "full" ? "compact" : "full"), persist(), renderView()) },
  ]);
}
function colorMenu(a) {
  const node = el(`<div class="cmenu">
    <div class="lab">Kolor tekstu</div>
    <div class="row">${COLORS.map((c) => `<button class="c" data-fg="${c.id}" title="${esc(c.name)}" style="color:${c.fg};background:var(--color-surface)">A</button>`).join("")}</div>
    <div class="lab">Wyróżnienie</div>
    <div class="row">${COLORS.map((c) => `<button class="c" data-bg="${c.id}" title="${esc(c.name)}" style="background:${c.id ? c.bg : "var(--color-surface)"};color:var(--color-text)">${c.id ? "" : icon("close", "sm")}</button>`).join("")}</div>
    <p class="note">Wstawia <code>#text(fill: …)[…]</code> albo <code>#highlight(fill: …)[…]</code>.</p></div>`);
  node.addEventListener("mousedown", (e) => e.preventDefault());
  node.addEventListener("click", (e) => {
    const f = e.target.closest("[data-fg]"),
      b = e.target.closest("[data-bg]");
    if (!f && !b) return;
    closeMenu();
    const c = COLORS.find((x) => x.id === (f ? f.dataset.fg : b.dataset.bg));
    if (!c.id) return clearFormatting();
    if (f) wrapSel(`#text(fill: ${c.typst})[`, "]", "kolorowy tekst");
    else wrapSel(`#highlight(fill: ${c.typst}.lighten(60%))[`, "]", "wyróżnienie");
  });
  openMenu(a, [], { node });
}
function refMenu(a) {
  if (!E) return;
  const src = E.ta.value;
  const labels = [...new Set([...src.matchAll(/<([\w:.-]+)>/g)].map((m) => m[1]))];
  openMenu(a, [
    { head: "Odsyłacz do etykiety" },
    ...(labels.length ? labels.map((l) => ({ icon: "at", label: "@" + l, run: () => insertText(activeTA(), "@" + l) })) : [{ label: "Brak etykiet w tej notatce", disabled: true }]),
    { sep: true },
    { icon: "tag", label: "Dodaj etykietę w kursorze", run: () => insertText(activeTA(), " <etykieta>", 2, 10) },
  ]);
}

/* ---------- Link and image ---------- */
function linkDlg() {
  const sel = selectedText();
  const isUrl = /^https?:\/\//.test(sel);
  const d = openDialog(
    `<div class="dlg-h">${icon("link")}<h2>Wstaw odnośnik</h2></div>
    <div class="dlg-b">
      <div class="wt-field"><label>Adres</label><input class="wt-input" id="lU" placeholder="https://" value="${isUrl ? esc(sel) : ""}" autofocus></div>
      <div class="wt-field"><label>Tekst (opcjonalnie)</label><input class="wt-input" id="lT" value="${isUrl ? "" : esc(sel)}" placeholder="Bez tekstu pokażemy sam adres"></div>
      <pre class="codebox"></pre>
    </div>
    <div class="dlg-f"><span class="hint">Linki otwierają się w przeglądarce systemowej.</span><button class="wt-btn secondary" data-close>Anuluj</button><button class="wt-btn primary" data-ok>Wstaw</button></div>`,
    { cls: "confirm" },
  );
  const u = $("#lU", d.dlg),
    t = $("#lT", d.dlg),
    cb = $(".codebox", d.dlg);
  const code = () => `#link("${u.value.trim() || "https://"}")${t.value.trim() ? `[${t.value.trim()}]` : ""}`;
  const upd = () => (cb.textContent = code());
  u.addEventListener("input", upd);
  t.addEventListener("input", upd);
  upd();
  const ok = () => {
    const c = code();
    d.close();
    setTimeout(() => {
      restoreFocus();
      insertText(activeTA(), c);
    }, 0);
  };
  $("[data-ok]", d.dlg).addEventListener("click", ok);
  d.dlg.addEventListener("keydown", (e) => e.key === "Enter" && (e.preventDefault(), ok()));
}
function imageDlg() {
  const files = [
    ["img/wykres-zbieznosci.png", "1600×900 · 184 KB"],
    ["img/schemat-obwodu.svg", "wektor · 12 KB"],
    ["img/tablica-2025-11-04.jpg", "4032×3024 · 2,1 MB"],
  ];
  let sel = 0;
  const d = openDialog(
    `<div class="dlg-h">${icon("image")}<h2>Wstaw obraz</h2><button class="wt-ibtn sm" data-close title="Zamknij">${icon("close")}</button></div>
    <div class="dlg-b">
      <p class="muted" style="font-size:12px">Obraz musi leżeć w otwartym folderze. Plik spoza folderu skopiujemy do <code>img/</code>.</p>
      <div class="fs-list">${files.map(([f, m], i) => `<button class="fs-row" data-i="${i}" aria-selected="${i === sel}">${icon("image", "sm")}<span>${esc(f)}</span><span class="m">${esc(m)}</span></button>`).join("")}
        <button class="fs-row" data-pick>${icon("folderOpen", "sm")}<span>Wybierz z dysku…</span></button></div>
      <div class="row2"><div class="wt-field" style="width:110px"><label>Szerokość</label><select class="wt-input" id="iW"><option>100%</option><option selected>70%</option><option>50%</option><option>8cm</option></select></div>
        <div class="wt-field grow"><label>Podpis</label><input class="wt-input" id="iC" placeholder="np. Wykres zbieżności szeregu"></div></div>
      <pre class="codebox"></pre>
    </div>
    <div class="dlg-f"><button class="wt-btn secondary" data-close>Anuluj</button><button class="wt-btn primary" data-ok>Wstaw obraz</button></div>`,
    { cls: "fs" },
  );
  const cb = $(".codebox", d.dlg);
  const code = () => {
    const w = $("#iW", d.dlg).value,
      c = $("#iC", d.dlg).value.trim();
    const img = `image("${files[sel][0]}", width: ${w})`;
    return c ? `#figure(${img}, caption: [${c}])` : `#${img}`;
  };
  const upd = () => (cb.textContent = code());
  d.dlg.addEventListener("input", upd);
  d.dlg.addEventListener("click", (e) => {
    const r = e.target.closest(".fs-row[data-i]");
    if (r) {
      sel = +r.dataset.i;
      $$(".fs-row", d.dlg).forEach((x) => x.setAttribute("aria-selected", x === r));
      upd();
    }
    if (e.target.closest("[data-pick]")) toast("Tu otworzy się systemowe okno wyboru pliku.", { type: "info" });
    if (e.target.closest("[data-ok]")) {
      const c = code();
      d.close();
      setTimeout(() => insertBlock(c), 0);
    }
  });
  upd();
}

/* ---------- Symbols ---------- */
function symbolsPop(anchor) {
  if (!E) return;
  let sec = "recent",
    q = "",
    cur = null;
  const p = openPop(
    anchor,
    `<div class="sym-top"><div class="inbox grow">${icon("search", "sm")}<input placeholder="Szukaj: alpha, strzałka, całka…" aria-label="Szukaj symbolu" autofocus></div></div>
    <div class="sym-tabs" role="tablist">${SYMBOL_SECTIONS.map(([id, l]) => `<button role="tab" data-sec="${id}" aria-selected="${id === sec}">${esc(l)}</button>`).join("")}</div>
    <div class="sym-body"><div class="sym-grid" role="listbox"></div><div class="sym-det"></div></div>
    <div class="pop-f"><span>${kbd("Enter")} wstaw</span><span>${kbd("←")}${kbd("→")} wybór</span><span class="grow"></span><span>W trybie matematycznym wstawiamy nazwę Typst, w tekście znak.</span></div>`,
    { cls: "sym" },
  );
  const grid = $(".sym-grid", p.pop),
    det = $(".sym-det", p.pop),
    inp = $("input", p.pop);
  const SYN = { całka: "integral", suma: "sum", strzałka: "arrow", nieskończoność: "infinity", pierwiastek: "sqrt", należy: "in", mniejsze: "lt", większe: "gt", rzeczywiste: "RR", naturalne: "NN", pochodna: "diff", "dla każdego": "forall", istnieje: "exists" };
  const list = () => {
    if (q) {
      const fq = fold(q.toLowerCase());
      const syn = Object.entries(SYN)
        .filter(([k]) => fold(k).startsWith(fq))
        .map(([, v]) => v);
      return SYMBOLS.filter(([g, n]) => n.toLowerCase().includes(fq) || g === q || syn.some((s) => n.startsWith(s)));
    }
    if (sec === "recent") return S.recentSyms.map((n) => SYMBOLS.find((s) => s[1] === n)).filter(Boolean);
    return SYMBOLS.filter((s) => s[2] === sec);
  };
  let items = [];
  const drawDet = () => {
    if (!cur) {
      det.innerHTML = '<p class="muted" style="margin:auto;text-align:center;font-size:12px">Wskaż symbol, żeby zobaczyć jego nazwę w Typst.</p>';
      return;
    }
    const [g, n] = cur;
    det.innerHTML = `<div class="big">${esc(g)}</div><div class="nm">${esc(n)}</div>
      <dl><dt>Matematyka</dt><dd>$${esc(n)}$</dd><dt>Tekst</dt><dd>${esc(g)}</dd><dt>Unicode</dt><dd>U+${g.codePointAt(0).toString(16).toUpperCase().padStart(4, "0")}</dd></dl>
      <button class="wt-btn primary sm" data-ins>Wstaw</button>`;
  };
  const draw = () => {
    items = list();
    if (!items.includes(cur)) cur = items[0] || null;
    grid.innerHTML = items.length ? items.map(([g, n], i) => `<button class="cell" data-i="${i}" aria-selected="${items[i] === cur}" title="${esc(n)}"><span class="g">${esc(g)}</span><span class="n">${esc(n)}</span></button>`).join("") : `<div class="sym-empty">Brak symbolu „${esc(q)}”. Spróbuj nazwy z Typst, np. <code>arrow</code>.</div>`;
    drawDet();
  };
  const ins = (s) => {
    if (!s) return;
    p.close();
    setTimeout(() => insertSymbol(s[1], s[0]), 0);
  };
  p.pop.addEventListener("click", (e) => {
    const t = e.target.closest("[data-sec]");
    if (t) {
      sec = t.dataset.sec;
      q = inp.value = "";
      $$("[data-sec]", p.pop).forEach((b) => b.setAttribute("aria-selected", b === t));
      draw();
    }
    const c = e.target.closest(".cell");
    if (c) {
      cur = items[+c.dataset.i];
      $$(".cell", grid).forEach((x) => x.setAttribute("aria-selected", x === c));
      drawDet();
    }
    if (e.target.closest("[data-ins]")) ins(cur);
  });
  grid.addEventListener("dblclick", (e) => {
    const c = e.target.closest(".cell");
    if (c) ins(items[+c.dataset.i]);
  });
  grid.addEventListener("mouseover", (e) => {
    const c = e.target.closest(".cell");
    if (c && items[+c.dataset.i] !== cur) {
      cur = items[+c.dataset.i];
      $$(".cell", grid).forEach((x) => x.setAttribute("aria-selected", x === c));
      drawDet();
    }
  });
  inp.addEventListener("input", () => {
    q = inp.value.trim();
    draw();
  });
  p.pop.addEventListener("keydown", (e) => {
    const i = items.indexOf(cur);
    const mv = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 7, ArrowUp: -7 }[e.key];
    if (mv && items.length && !(e.target === inp && (e.key === "ArrowLeft" || e.key === "ArrowRight") && inp.value)) {
      e.preventDefault();
      cur = items[Math.max(0, Math.min(items.length - 1, i + mv))];
      $$(".cell", grid).forEach((x) => x.setAttribute("aria-selected", items[+x.dataset.i] === cur));
      const c = $(`.cell[aria-selected=true]`, grid);
      if (c) c.scrollIntoView({ block: "nearest" });
      drawDet();
    }
    if (e.key === "Enter") (e.preventDefault(), ins(cur));
  });
  draw();
}

/* ---------- Table ---------- */
function tablePop(anchor) {
  if (!E) return;
  let rows = 3,
    cols = 3,
    header = true,
    style = "grid";
  const p = openPop(
    anchor,
    `<div class="tbl-body">
      <div><div class="tgrid" role="grid" aria-label="Rozmiar tabeli">${Array.from({ length: 80 }, (_, i) => `<button class="tc" data-r="${Math.floor(i / 10) + 1}" data-c="${(i % 10) + 1}" tabindex="-1"></button>`).join("")}</div>
        <p class="size"></p>
        <div class="opts">
          <div class="nums"><label>Wiersze <input type="number" min="1" max="40" id="tR"></label><label>Kolumny <input type="number" min="1" max="12" id="tC"></label></div>
          <label><input type="checkbox" id="tH" checked> Wiersz nagłówka</label>
          <label><input type="radio" name="tS" value="grid" checked> Pełna siatka</label>
          <label><input type="radio" name="tS" value="h"> Tylko linie poziome</label>
          <label><input type="radio" name="tS" value="none"> Bez linii</label>
        </div></div>
      <div class="tbl-prev"><div class="sheet pv"></div><pre class="codebox"></pre>
        <div class="btns"><button class="wt-btn secondary sm" data-x>Anuluj</button><button class="wt-btn primary sm" data-ok>Wstaw tabelę</button></div></div>
    </div>
    <div class="pop-f"><span>Najedź na siatkę, żeby wybrać rozmiar, i kliknij.</span><span class="grow"></span><span>Tabela to zwykły <code>#table(…)</code> w źródle.</span></div>`,
    { cls: "tbl" },
  );
  const code = () => {
    const ln = [`#table(`, `  columns: ${cols},`];
    if (style === "h") ln.push("  stroke: (x: none),");
    if (style === "none") ln.push("  stroke: none,");
    if (header) ln.push(`  table.header(${Array.from({ length: cols }, (_, i) => `[*Kolumna ${i + 1}*]`).join(", ")}),`);
    for (let r = 0; r < rows - (header ? 1 : 0); r++) ln.push("  " + Array.from({ length: cols }, () => "[ ]").join(", ") + ",");
    ln.push(")");
    return ln.join("\n");
  };
  const upd = (hr, hc) => {
    const R = hr || rows,
      C = hc || cols;
    $$(".tc", p.pop).forEach((c) => c.classList.toggle("on", +c.dataset.r <= R && +c.dataset.c <= C));
    $(".size", p.pop).innerHTML = `<b>${C} × ${R}</b> (kolumny × wiersze)`;
    if (!hr) {
      $("#tR", p.pop).value = rows;
      $("#tC", p.pop).value = cols;
      const c = code();
      $(".codebox", p.pop).textContent = c;
      $(".pv", p.pop).innerHTML = TY.render(c.replace(/\[ \]/g, "[–]")).html.join("");
    }
  };
  const grid = $(".tgrid", p.pop);
  grid.addEventListener("mouseover", (e) => {
    const c = e.target.closest(".tc");
    if (c) upd(+c.dataset.r, +c.dataset.c);
  });
  grid.addEventListener("mouseleave", () => upd());
  grid.addEventListener("click", (e) => {
    const c = e.target.closest(".tc");
    if (!c) return;
    rows = +c.dataset.r;
    cols = +c.dataset.c;
    upd();
  });
  p.pop.addEventListener("input", (e) => {
    if (e.target.id === "tR") rows = Math.max(1, Math.min(40, +e.target.value || 1));
    if (e.target.id === "tC") cols = Math.max(1, Math.min(12, +e.target.value || 1));
    if (e.target.id === "tH") header = e.target.checked;
    if (e.target.name === "tS") style = e.target.value;
    upd();
  });
  p.pop.addEventListener("click", (e) => {
    if (e.target.closest("[data-x]")) p.close();
    if (e.target.closest("[data-ok]")) {
      const c = code();
      p.close();
      setTimeout(() => {
        const firstCell = c.indexOf("[ ]");
        insertBlock(c, firstCell + 1);
      }, 0);
    }
  });
  upd();
}

/* ---------- Shapes ---------- */
function shapesDlg() {
  if (!E) return;
  const STROKES = [
    ["ink", "var(--pg-text)", "Atrament"],
    ["blue", "#3d6fd9", "Niebieski"],
    ["red", "#d64035", "Czerwony"],
    ["green", "#2f9a5c", "Zielony"],
    ["purple", "#8f55d0", "Fioletowy"],
  ];
  const FILLS = [
    ["none", "", "Brak"],
    ["blue.lighten(80%)", "color-mix(in srgb, #3d6fd9 28%, transparent)", "Niebieskie tło"],
    ["red.lighten(80%)", "color-mix(in srgb, #d64035 28%, transparent)", "Czerwone tło"],
    ["green.lighten(80%)", "color-mix(in srgb, #2f9a5c 28%, transparent)", "Zielone tło"],
    ["yellow.lighten(70%)", "color-mix(in srgb, #d4b106 35%, transparent)", "Żółte tło"],
  ];
  const st = { id: "tri", stroke: 0, fill: 1, w: 1, dash: "solid", width: 5, height: 3, caption: "" };
  const groups = [...new Set(SHAPES.map((s) => s.group))];
  const d = openDialog(
    `<div class="dlg-h">${icon("shape")}<h2>Wstaw kształt</h2><span class="muted" style="font-size:12px">Kształty to kod Typst (wbudowane funkcje albo pakiet cetz).</span><button class="wt-ibtn sm" data-close title="Zamknij">${icon("close")}</button></div>
    <div class="shapes-body">
      <nav class="lib">${groups.map((g) => `<h4>${esc(g)}</h4>${SHAPES.filter((s) => s.group === g).map((s) => `<button data-sh="${s.id}" aria-selected="${s.id === st.id}"><svg class="wt-ico" viewBox="0 0 24 24">${s.icon}</svg>${esc(s.name)}</button>`).join("")}`).join("")}</nav>
      <div class="stage"><div class="stage-page" style="background-color:var(--pg-bg)"><figure style="margin:0"><div class="sel-box"><span class="sv"></span><i style="left:-5px;top:-5px"></i><i style="right:-5px;top:-5px"></i><i style="left:-5px;bottom:-5px"></i><i style="right:-5px;bottom:-5px"></i></div><figcaption></figcaption></figure></div>
        <div class="stage-meta"><span class="nm"></span><span class="dm"></span></div></div>
      <div class="props">
        <div class="pl"><span>Obrys</span><div class="swatches">${STROKES.map((s, i) => `<button class="swatch" data-st="${i}" title="${s[2]}" style="background:${s[1]}"></button>`).join("")}</div></div>
        <div class="pl"><span>Grubość</span><div class="wt-seg" role="radiogroup">${[
          [0.5, "Cienka"],
          [1, "Zwykła"],
          [2, "Gruba"],
        ]
          .map(([v, l]) => `<button role="radio" data-w="${v}">${l}</button>`)
          .join("")}</div></div>
        <div class="pl"><span>Linia</span><div class="wt-seg" role="radiogroup">${[
          ["solid", "Ciągła"],
          ["dashed", "Kreskowana"],
          ["dotted", "Kropkowana"],
        ]
          .map(([v, l]) => `<button role="radio" data-dash="${v}">${l}</button>`)
          .join("")}</div></div>
        <div class="pl"><span>Wypełnienie</span><div class="swatches">${FILLS.map((f, i) => `<button class="swatch${i ? "" : " none"}" data-fl="${i}" title="${f[2]}" ${i ? `style="background:${f[1]}"` : ""}></button>`).join("")}</div></div>
        <div class="pl"><span>Rozmiar (cm)</span><div class="dims"><input class="wt-input" type="number" step="0.5" min="1" max="16" id="shW" aria-label="Szerokość"><span>×</span><input class="wt-input" type="number" step="0.5" min="1" max="16" id="shH" aria-label="Wysokość"></div></div>
        <div class="pl"><span>Podpis</span><input class="wt-input" id="shC" placeholder="np. Trójkąt prostokątny ABC"></div>
        <div class="pl"><span>Kod Typst</span><pre class="codebox"></pre></div>
      </div>
    </div>
    <div class="dlg-f"><span class="hint">Po wstawieniu zmienisz kształt w źródle albo klikając go na stronie.</span><button class="wt-btn secondary" data-close>Anuluj</button><button class="wt-btn primary" data-ok>Wstaw kształt</button></div>`,
    { cls: "shapes" },
  );
  const code = () => {
    const sh = SHAPES.find((s) => s.id === st.id);
    const stroke = `${st.w}pt + ${STROKES[st.stroke][0]}` + (st.dash !== "solid" ? "" : "");
    const strokeFull = st.dash === "solid" ? stroke : `(paint: ${STROKES[st.stroke][0]}, thickness: ${st.w}pt, dash: "${st.dash}")`;
    let c = sh.code
      .replace(/^#/, "")
      .replace(/stroke: 1pt \+ ink/, `stroke: ${strokeFull}`)
      .replace(/fill: tint/, st.fill ? `fill: ${FILLS[st.fill][0]}` : "fill: none")
      .replace(/width: [\d.]+cm/, `width: ${st.width}cm`)
      .replace(/height: [\d.]+cm/, `height: ${st.height}cm`)
      .replace(/size: [\d.]+cm/, `size: ${st.width}cm`);
    return st.caption ? `#figure(${c}, caption: [${st.caption}])` : "#" + c;
  };
  const draw = () => {
    const sh = SHAPES.find((s) => s.id === st.id);
    const dash = { solid: "none", dashed: "6 5", dotted: "1.5 4" }[st.dash];
    const sw = { 0.5: 1.25, 1: 2, 2: 3.5 }[st.w];
    $(".sv", d.dlg).innerHTML = `<svg class="shp" viewBox="0 0 320 220" style="--s:${STROKES[st.stroke][1]};--sw:${sw};--fl:${st.fill ? FILLS[st.fill][1] : "none"};--dash:${dash}">${sh.svg}</svg>`;
    $("figcaption", d.dlg).textContent = st.caption ? `Rysunek 1: ${st.caption}` : "";
    $(".stage-meta .nm", d.dlg).textContent = sh.name;
    $(".stage-meta .dm", d.dlg).textContent = `${String(st.width).replace(".", ",")} × ${String(st.height).replace(".", ",")} cm`;
    $(".codebox", d.dlg).textContent = code();
    $$("[data-sh]", d.dlg).forEach((b) => b.setAttribute("aria-selected", b.dataset.sh === st.id));
    $$("[data-st]", d.dlg).forEach((b) => b.setAttribute("aria-pressed", +b.dataset.st === st.stroke));
    $$("[data-fl]", d.dlg).forEach((b) => b.setAttribute("aria-pressed", +b.dataset.fl === st.fill));
    $$("[data-w]", d.dlg).forEach((b) => b.setAttribute("aria-checked", +b.dataset.w === st.w));
    $$("[data-dash]", d.dlg).forEach((b) => b.setAttribute("aria-checked", b.dataset.dash === st.dash));
  };
  $("#shW", d.dlg).value = st.width;
  $("#shH", d.dlg).value = st.height;
  d.dlg.addEventListener("click", (e) => {
    const t = e.target.closest("[data-sh],[data-st],[data-fl],[data-w],[data-dash],[data-ok]");
    if (!t) return;
    if (t.dataset.sh) st.id = t.dataset.sh;
    if (t.dataset.st) st.stroke = +t.dataset.st;
    if (t.dataset.fl) st.fill = +t.dataset.fl;
    if (t.dataset.w) st.w = +t.dataset.w;
    if (t.dataset.dash) st.dash = t.dataset.dash;
    if (t.hasAttribute("data-ok")) {
      const c = code();
      d.close();
      setTimeout(() => insertBlock(c), 0);
      return;
    }
    draw();
  });
  d.dlg.addEventListener("input", (e) => {
    if (e.target.id === "shW") st.width = +e.target.value || 1;
    if (e.target.id === "shH") st.height = +e.target.value || 1;
    if (e.target.id === "shC") st.caption = e.target.value.trim();
    draw();
  });
  setTimeout(() => $("[data-sh][aria-selected=true]", d.dlg).focus(), 0);
  draw();
}

/* ---------- Search and replace in the sidebar ---------- */
/* Focus the search box under the logo. Ctrl+F only focuses it, Ctrl+H also opens the replace line. */
function focusSearch(withReplace = false) {
  const sel = selectedText();
  if (!S.sidebar) {
    S.sidebar = true;
    renderRail();
  }
  if (withReplace && !S.search.showRep) {
    S.search.showRep = true;
    renderFind();
  }
  if (sel && !sel.includes("\n") && sel !== S.search.q) {
    S.search.q = sel;
    $("#spQ").value = sel;
    renderSidebar();
  }
  const i = $("#spQ");
  i.focus();
  i.select();
  persist();
}
function clearSearch() {
  S.search.q = "";
  const i = $("#spQ");
  if (i) i.value = "";
  spCur = -1;
  renderSidebar();
  persist();
}
function renderFind() {
  const s = S.search;
  const tog = (k, label, title) => `<button class="tog" data-tog="${k}" aria-pressed="${s[k]}" title="${title}">${label}</button>`;
  $("#sbFind").innerHTML = `
    <div class="sf-line">
      <button class="wt-ibtn xs sf-tw" data-sp="rep" aria-expanded="${s.showRep}" title="${s.showRep ? "Schowaj" : "Pokaż"} zamianę (Ctrl+H)">${icon("chevronRight", "sm")}</button>
      <div class="inbox"><span class="ic">${icon("search", "sm")}</span><input id="spQ" placeholder="Szukaj w notatkach" value="${esc(s.q)}" spellcheck="false" autocomplete="off" aria-label="Szukaj w notatkach" title="Szukaj (Ctrl+F). Enter: następny wynik, Esc: wyczyść">${tog("case", "Aa", "Uwzględniaj wielkość liter")}${tog("word", "ab", "Całe słowa")}${tog("re", ".*", "Wyrażenie regularne")}</div>
    </div>
    ${
      s.showRep
        ? `<div class="sf-line">
      <span class="sf-tw"></span>
      <div class="inbox"><span class="ic">${icon("replace", "sm")}</span><input id="spR" placeholder="Zamień na" value="${esc(s.rep)}" spellcheck="false" autocomplete="off" aria-label="Zamień na"></div>
      <button class="wt-ibtn sm" data-sp="repOne" title="Zamień bieżące">${icon("replace", "sm")}</button><button class="wt-ibtn sm" data-sp="repAll" title="Zamień wszystkie (Ctrl+Enter)">${icon("replaceAll", "sm")}</button>
    </div>`
        : ""
    }`;
}
function searchRegex() {
  const s = S.search;
  if (!s.q) return null;
  let src = s.re ? s.q : s.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (s.accent && !s.re) src = fold(src);
  if (s.word) src = `(?<![\\p{L}\\p{N}_])(?:${src})(?![\\p{L}\\p{N}_])`;
  try {
    return new RegExp(src, "gu" + (s.case ? "" : "i"));
  } catch (e) {
    return { error: e.message };
  }
}
function searchResults() {
  const re = searchRegex();
  if (!re || re.error) return { re, files: [], total: 0 };
  const s = S.search;
  let ids = s.current && S.notes[S.active] ? [S.active] : [...wsNotes(), ...(s.loose ? [...S.loose, ...S.drafts] : [])];
  ids = [...new Set(ids)].filter((id) => S.notes[id]);
  const files = [];
  let total = 0;
  for (const id of ids) {
    const lines = S.notes[id].source.split("\n");
    const hits = [];
    lines.forEach((line, ln) => {
      const hay = s.accent ? fold(line) : line;
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(hay)) && hits.length < 200) {
        if (!m[0].length) {
          re.lastIndex++;
          continue;
        }
        hits.push({ ln, col: m.index, len: m[0].length, line, text: line.slice(m.index, m.index + m[0].length), groups: m });
      }
    });
    if (hits.length) {
      files.push({ id, hits });
      total += hits.length;
    }
  }
  return { re, files, total };
}
let spCur = -1;
/* While the box holds a phrase, the sidebar body shows the results instead of the tree. */
function renderSearchBody() {
  const s = S.search;
  const chk = (k, label) => `<label class="chk"><input type="checkbox" data-opt="${k}" ${s[k] ? "checked" : ""}> ${label}</label>`;
  $("#sbBody").innerHTML = `<section class="sp-body">
    <div class="sp-opts">${chk("current", "Tylko bieżąca notatka")}${chk("loose", "Także luźne pliki i szkice")}${chk("accent", "Ignoruj polskie znaki (ą = a)")}</div>
    <div class="sp-sum"></div>
    <div class="sp-res" role="tree"></div></section>`;
  updateSearch();
}
let spCollapsed = new Set();
function updateSearch() {
  const sb = $("#sbBody");
  if (!S.search.q || !$(".sp-res", sb)) return;
  const { re, files, total } = searchResults();
  const sum = $(".sp-sum", sb),
    res = $(".sp-res", sb);
  const s = S.search;
  if (re && re.error) {
    sum.innerHTML = `<span style="color:var(--color-danger)">Błędne wyrażenie regularne: ${esc(re.error)}</span>`;
    res.innerHTML = "";
    return;
  }
  sum.innerHTML = total
    ? `<span class="grow">${total} ${total === 1 ? "wynik" : total % 10 >= 2 && total % 10 <= 4 && (total % 100 < 10 || total % 100 >= 20) ? "wyniki" : "wyników"} w ${files.length} ${files.length === 1 ? "notatce" : "notatkach"}</span>
      <button class="wt-ibtn xs" data-sp="prev" title="Poprzedni (Shift+Enter)">${icon("chevronUp", "sm")}</button><button class="wt-ibtn xs" data-sp="next" title="Następny (Enter)">${icon("chevronDown", "sm")}</button><button class="wt-ibtn xs" data-sp="collapse" title="Zwiń albo rozwiń wyniki">${icon("list", "sm")}</button>`
    : `<span class="grow">Brak wyników. Sprawdź pisownię albo wyłącz przełączniki.</span>`;
  let k = 0;
  const repl = (h) => {
    if (!s.showRep) return "";
    try {
      return s.re ? h.text.replace(new RegExp(re.source, re.flags.replace("g", "")), s.rep) : s.rep;
    } catch {
      return s.rep;
    }
  };
  res.innerHTML = files
    .map(({ id, hits }) => {
      const open = !spCollapsed.has(id);
      return `<button class="fileh" data-file="${id}" aria-expanded="${open}"><span style="display:inline-grid;transform:rotate(${open ? 0 : -90}deg);transition:transform .12s">${icon("chevronDown", "sm")}</span>${itemIcon(id)}<span>${esc(S.notes[id].title)}</span><span class="p">${esc(folderName(id))}</span><span class="cnt">${hits.length}</span></button>
      ${open
        ? hits
            .map((h) => {
              const i = k++;
              const a = Math.max(0, h.col - 24);
              const pre = (a > 0 ? "…" : "") + esc(h.line.slice(a, h.col).replace(/^\s+/, ""));
              const hit = s.showRep ? `<span class="del">${esc(h.text)}</span><span class="ins">${esc(repl(h))}</span>` : `<span class="hit">${esc(h.text)}</span>`;
              return `<button class="res${i === spCur ? " cur" : ""}" data-r="${i}" data-id="${id}" data-ln="${h.ln}" data-col="${h.col}" data-len="${h.len}"><span class="ln">${h.ln + 1}</span><span class="tx">${pre}${hit}${esc(h.line.slice(h.col + h.len, h.col + h.len + 60))}</span></button>`;
            })
            .join("")
        : ((k += hits.length), "")}`;
    })
    .join("");
}
function gotoResult(i) {
  const rs = $$("#sbBody .res");
  if (!rs.length) return;
  spCur = (i + rs.length) % rs.length;
  rs.forEach((r) => r.classList.toggle("cur", +r.dataset.r === spCur));
  const r = rs.find((x) => +x.dataset.r === spCur) || rs[0];
  r.scrollIntoView({ block: "nearest" });
  const id = r.dataset.id;
  if (S.active !== id) openNote(id, { preview: true });
  setTimeout(() => {
    if (view() === "page") setView("split");
    selectRange(+r.dataset.ln, +r.dataset.col, +r.dataset.len);
    const q = $("#spQ");
    if (q && document.activeElement !== q && !document.activeElement.matches("#spR")) r.focus({ preventScroll: true });
  }, 30);
}
function replaceIn(id, onlyHit) {
  const re = searchRegex();
  if (!re || re.error) return 0;
  const s = S.search;
  const n = S.notes[id];
  const lines = n.source.split("\n");
  let count = 0;
  const one = new RegExp(re.source, re.flags.replace("g", ""));
  lines.forEach((line, ln) => {
    if (onlyHit && onlyHit.ln !== ln) return;
    const hay = s.accent ? fold(line) : line;
    let out = "",
      last = 0,
      m;
    re.lastIndex = 0;
    while ((m = re.exec(hay))) {
      if (!m[0].length) {
        re.lastIndex++;
        continue;
      }
      if (onlyHit && m.index !== onlyHit.col) continue;
      const orig = line.slice(m.index, m.index + m[0].length);
      out += line.slice(last, m.index) + (s.re ? orig.replace(one, s.rep) : s.rep);
      last = m.index + m[0].length;
      count++;
    }
    lines[ln] = out + line.slice(last);
  });
  if (!count) return 0;
  n.source = lines.join("\n");
  if (E && E.id === id) {
    const ta = E.ta;
    const st = E.paneSrc.scrollTop;
    ta.focus({ preventScroll: true });
    ta.select();
    insertText(ta, n.source);
    E.paneSrc.scrollTop = st;
  } else markDirty(id);
  return count;
}
function bindSearch() {
  const sb = $("#sb");
  sb.addEventListener("input", (e) => {
    if (e.target.id === "spQ") {
      const had = !!S.search.q;
      S.search.q = e.target.value;
      spCur = -1;
      if (had !== !!S.search.q) renderSidebar();
      else updateSearch();
    } else if (e.target.id === "spR") {
      S.search.rep = e.target.value;
      updateSearch();
    } else return;
    persist();
  });
  sb.addEventListener("change", (e) => {
    const o = e.target.dataset.opt;
    if (!o) return;
    S.search[o] = e.target.checked;
    spCur = -1;
    updateSearch();
    persist();
  });
  sb.addEventListener("keydown", (e) => {
    if (!e.target.matches("#spQ,#spR")) return;
    const combo = comboOf(e);
    if (combo === "Ctrl+H") return e.preventDefault(), focusSearch(true);
    if (combo === "Ctrl+F") return e.preventDefault(), $("#spQ").select();
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      if (S.search.q) clearSearch();
      else e.target.blur();
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (e.target.id === "spR" && (e.ctrlKey || e.metaKey)) return doReplaceAll();
      gotoResult(spCur + (e.shiftKey ? -1 : 1));
    }
  });
  sb.addEventListener("click", async (e) => {
    const t = e.target.closest("[data-tog]");
    if (t) {
      S.search[t.dataset.tog] = !S.search[t.dataset.tog];
      t.setAttribute("aria-pressed", S.search[t.dataset.tog]);
      spCur = -1;
      updateSearch();
      return persist();
    }
    const f = e.target.closest("[data-file]");
    if (f) {
      const id = f.dataset.file;
      spCollapsed.has(id) ? spCollapsed.delete(id) : spCollapsed.add(id);
      return updateSearch();
    }
    const r = e.target.closest(".res");
    if (r) return gotoResult(+r.dataset.r);
    const b = e.target.closest("[data-sp]");
    if (!b) return;
    const act = b.dataset.sp;
    if (act === "collapse") {
      const { files } = searchResults();
      if (files.every((x) => spCollapsed.has(x.id))) spCollapsed.clear();
      else files.forEach((x) => spCollapsed.add(x.id));
      return updateSearch();
    }
    if (act === "rep") {
      S.search.showRep = !S.search.showRep;
      renderFind();
      updateSearch();
      persist();
      $(S.search.showRep ? "#spR" : "#spQ").focus();
      return;
    }
    if (act === "next") return gotoResult(spCur + 1);
    if (act === "prev") return gotoResult(spCur - 1);
    if (act === "repOne") {
      const rs = $$("#sbBody .res");
      if (!rs.length) return toast(S.search.q ? "Brak wyników do zamiany." : "Najpierw wpisz, czego szukasz.", { type: "info", ms: 2500 });
      const r0 = rs.find((x) => +x.dataset.r === spCur) || rs[0];
      const n = replaceIn(r0.dataset.id, { ln: +r0.dataset.ln, col: +r0.dataset.col });
      if (n) toast("Zamieniono 1 wystąpienie.", { type: "ok", ms: 2000 });
      updateSearch();
      return gotoResult(Math.max(0, spCur));
    }
    if (act === "repAll") return doReplaceAll();
  });
}
async function doReplaceAll() {
  const { files, total } = searchResults();
  if (!total) return toast(S.search.q ? "Brak wyników do zamiany." : "Najpierw wpisz, czego szukasz.", { type: "info", ms: 2500 });
  const ok = await confirmDlg({ title: `Zamienić ${total} wystąpień?`, text: `Zmiana obejmie ${files.length} ${files.length === 1 ? "notatkę" : "notatki"}. W każdej możesz ją cofnąć przez Ctrl+Z, dopóki karta jest otwarta.`, ok: "Zamień wszystkie" });
  if (!ok) return;
  let n = 0;
  for (const fl of files) n += replaceIn(fl.id);
  updateSearch();
  refreshChrome();
  toast(`Zamieniono ${n} wystąpień w ${files.length} ${files.length === 1 ? "notatce" : "notatkach"}.`, { type: "ok" });
}
