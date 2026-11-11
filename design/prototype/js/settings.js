/* WYSITyp prototype – the settings tab. Every value lands in S.settings, which mirrors the app's settings JSON. */
"use strict";

const ST_NAV = [
  { grp: "Aplikacja" },
  { id: "general", label: "Ogólne", icon: "settings" },
  { id: "appearance", label: "Wygląd", icon: "palette" },
  { id: "keys", label: "Skróty klawiszowe", icon: "keyboard" },
  { grp: "Pisanie" },
  { id: "editor", label: "Edytor źródła", icon: "code" },
  { id: "page", label: "Strona", icon: "type" },
  { grp: "Pliki" },
  { id: "pdf", label: "Eksport PDF", icon: "pdf" },
  { id: "packages", label: "Pakiety Typst", icon: "package" },
  { id: "files", label: "Pliki i foldery", icon: "folder" },
  { grp: "Inne" },
  { id: "privacy", label: "Prywatność", icon: "shield" },
  { id: "about", label: "O programie", icon: "info" },
];
const PAGE_COLORS = [
  ["white", "Biała"],
  ["beige", "Beżowa"],
  ["graphite", "Grafitowa"],
  ["oled", "Czarna (OLED)"],
];
const PC_SWATCH = {
  white: ["#ffffff", "#1f1d1a"],
  beige: ["#f5eedf", "#3a2f22"],
  graphite: ["#2a2c30", "#e6e2da"],
  oled: ["#000000", "#d8d4cc"],
};
const UI_STYLES = [
  ["fixed", "Stały", "Paski przy krawędziach okna, pełne tła. Spokojne, krótkie animacje."],
  ["float", "Pływający", "Matowe szkło jak w Windows 11. Cztery panele wokół notatki: przypięte zajmują miejsce, odpięte chowają się przy krawędzi."],
];
const ACCENTS = [
  ["blue", "#2f62d0", "Niebieski"],
  ["teal", "#0e7c86", "Morski"],
  ["violet", "#7a3fc0", "Fioletowy"],
  ["amber", "#9a6400", "Bursztynowy"],
  ["green", "#1d7a46", "Zielony"],
];
const PKG_CACHE = [
  ["@preview/cetz:0.3.4", "1,8 MB"],
  ["@preview/cetz-plot:0.1.1", "640 KB"],
  ["@preview/physica:0.9.4", "210 KB"],
  ["@preview/unify:0.7.1", "96 KB"],
];
let pkgCache = PKG_CACHE.slice();
let keyFilter = "";

/* Control builders */
function stSeg(key, opts) {
  const v = String(S.settings[key]);
  return `<div class="wt-seg" role="radiogroup">${opts.map(([val, label, ic]) => `<button role="radio" data-seg="${key}" data-v="${val}" aria-checked="${v === String(val)}">${ic ? icon(ic, "sm") : ""}${esc(label)}</button>`).join("")}</div>`;
}
function stSw(key, label) {
  return `<button class="sw" role="switch" data-sw="${key}" aria-checked="${!!S.settings[key]}" aria-label="${esc(label || key)}"></button>`;
}
function stStep(key, min, max, step, fmt) {
  const v = S.settings[key];
  return `<div class="step"><button data-step="${key}" data-d="-1" data-min="${min}" data-max="${max}" data-s="${step}" ${v <= min ? "disabled" : ""} aria-label="Mniej">−</button><span>${fmt(v)}</span><button data-step="${key}" data-d="1" data-min="${min}" data-max="${max}" data-s="${step}" ${v >= max ? "disabled" : ""} aria-label="Więcej">+</button></div>`;
}
function stSel(key, opts) {
  const cur = opts.find((o) => String(o[0]) === String(S.settings[key])) || opts[0];
  return `<button class="st-select" data-sel="${key}" aria-haspopup="menu" ${cur[2] ? `style="font-family:${cur[2]}"` : ""}><span>${esc(cur[1])}</span>${icon("chevronDown", "sm")}</button>`;
}
const SEL_OPTS = {
  source_font: Object.entries(SOURCE_FONTS).map(([k, f]) => [k, k, f]),
  render_font: Object.entries(RENDER_FONTS).map(([k, f]) => [k, k, f]),
  pdf_paper: [
    ["A4", "A4 (210 × 297 mm)"],
    ["A5", "A5 (148 × 210 mm)"],
    ["Letter", "US Letter"],
  ],
  autosave_delay: [
    [0.5, "0,5 s po ostatnim znaku"],
    [1, "1 s po ostatnim znaku"],
    [2, "2 s po ostatnim znaku"],
    [5, "5 s po ostatnim znaku"],
  ],
};
function stRow(label, control, hint = "") {
  return `<div class="set"><span class="lab">${label}</span><div class="row2">${control}</div>${hint ? `<p class="hint">${hint}</p>` : ""}</div>`;
}
function stCard(rows) {
  return `<div class="cd">${rows.map(([t, sub, ctl]) => `<div class="r"><div class="t"><b>${t}</b>${sub ? `<small>${sub}</small>` : ""}</div>${ctl}</div>`).join("")}</div>`;
}
const fmtPx = (v) => v + " px";

/* Sections */
const ST_SECTIONS = {
  general: () => `
    <h2>Ogólne</h2><p class="lead">Wszystkie ustawienia zapisujemy w jednym pliku JSON w folderze konfiguracji aplikacji.</p>
    <section class="st-sec"><h3>Język</h3>
      ${stRow("Język interfejsu", stSeg("locale", [["pl", "Polski"], ["en", "English"]]), "Pole <code>locale</code>. Domyślnie polski. Zmiana działa od razu, bez restartu.")}
    </section>
    <section class="st-sec"><h3>Karty</h3>
      ${stCard([
        ["Przywracaj karty po uruchomieniu", "Otworzymy te same notatki i przewiniemy je w to samo miejsce.", stSw("restore_tabs")],
        ["Karty podglądu", "Pojedyncze kliknięcie w drzewie otwiera kartę kursywą, którą zastąpi następna. Edycja albo podwójne kliknięcie ją przypina.", stSw("preview_tabs")],
        ["Pytaj przed usunięciem notatki", "Plik i tak trafia do kosza systemu.", stSw("confirm_delete")],
      ])}
    </section>
    <section class="st-sec"><h3>Prototyp</h3>
      ${stCard([["Przywróć stan początkowy", "Kasuje zmiany w notatkach, karty i ustawienia zapisane w tej przeglądarce.", `<button class="wt-btn secondary sm" data-st="reset">Przywróć</button>`]])}
    </section>`,
  appearance: () => {
    const st = S.settings;
    return `
    <h2>Wygląd</h2><p class="lead">Motyw okna i kolor strony ustawiasz osobno. Ciemny interfejs może mieć białą kartkę.</p>
    <section class="st-sec"><h3>Motyw</h3>
      ${stRow("Motyw interfejsu", stSeg("theme", [["system", "Systemowy", "monitor"], ["light", "Jasny", "sun"], ["dark", "Ciemny", "moon"]]), `Pole <code>theme</code>. „Systemowy” idzie za ustawieniem Windows (teraz: ${darkMq.matches ? "ciemny" : "jasny"}).`)}
      ${stRow("Kolor akcentu", `<div class="dots">${ACCENTS.map(([id, c, n]) => `<button class="dot" data-accent="${id}" aria-pressed="${st.accent === id}" title="${n}" style="background:${c}"></button>`).join("")}</div>`)}
      ${stRow("Rozmiar interfejsu", stSeg("ui_size", [["s", "Mały"], ["m", "Średni"], ["l", "Duży"]]), "Skaluje pasek boczny, karty i menu. Tekst notatki ma osobny rozmiar w sekcji Strona.")}
    </section>
    <section class="st-sec"><h3>Kolor strony</h3>
      <div class="pcs${st.page_follow ? " dim" : ""}">${PAGE_COLORS.map(([id, n]) => {
        const [bg, fg] = PC_SWATCH[id];
        return `<button class="pc" data-pc="${id}" aria-pressed="${resolvedPage() === id}"><span class="sheet" style="background:${bg};color:${fg}">Aa<span class="ln" style="background:${fg};width:80%"></span><span class="ln" style="background:${fg};width:60%"></span></span>${n}</button>`;
      }).join("")}</div>
      ${stCard([["Dopasuj do motywu", "Jasny motyw dostaje białą kartkę, ciemny grafitową.", stSw("page_follow")]])}
      <p class="muted" style="margin:0;font-size:12px">Pole <code>page_color</code>. Eksport PDF zawsze ma białą kartkę.</p>
    </section>
    <section class="st-sec"><h3>Styl interfejsu</h3>
      <div class="uis" role="radiogroup" aria-label="Styl interfejsu">${UI_STYLES.map(
        ([id, n, sub]) => `<button class="ui-opt" role="radio" data-uistyle="${id}" aria-checked="${st.ui_style === id}">
          <span class="ui-pv ${id}" aria-hidden="true"><i class="t"></i><i class="sd"></i><i class="pg"></i><i class="vb"></i><i class="st"></i></span>
          <span class="nm">${n}</span><small>${sub}</small></button>`,
      ).join("")}</div>
      ${
        st.ui_style === "float"
          ? `<p class="muted" style="margin:0;font-size:12px">Przypięty panel zajmuje miejsce przy krawędzi okna. Odpięty unosi się nad notatką i chowa. Każdy panel ma też własną pinezkę.</p>` +
            stCard([
              ["Ukrywaj górny panel", "Karty, ścieżka i pasek narzędzi wysuwają się przy górnej krawędzi okna.", stSw("top_autohide")],
              ["Ukrywaj panel boczny", "Lista notatek wysuwa się przy lewej krawędzi i unosi nad notatką.", stSw("sb_autohide")],
              ["Ukrywaj dolny pasek", "Pasek stanu wysuwa się przy dolnej krawędzi okna.", stSw("status_autohide")],
              ["Ukrywaj pasek widoku strony", "Zoom i dopasowanie strony wysuwają się przy prawej krawędzi podglądu.", stSw("vtb_autohide")],
            ])
          : ""
      }
    </section>
    <section class="st-sec"><h3>Układ</h3>
      ${stRow("Pasek narzędzi", stSeg("toolbar", [["compact", "Zwarty"], ["full", "Pełny"]]), "Zwarty chowa rzadziej używane narzędzia pod przyciskiem ⋯.")}
      ${stRow("Pasek stanu", stSw("status_bar", "Pasek stanu"))}
    </section>`;
  },
  editor: () => `
    <h2>Edytor źródła</h2><p class="lead">Lewa strona widoku z podziałem: zwykły tekst Typst, który trafia na dysk.</p>
    <section class="st-sec"><h3>Font</h3>
      ${stRow("Font źródła", stSel("source_font", SEL_OPTS.source_font), "Pole <code>source_font</code>. Nazwa fontu nigdy nie trafia do notatki.")}
      ${stRow("Rozmiar", stStep("source_size", 11, 20, 1, fmtPx))}
      ${stRow("Ligatury", stSw("ligatures", "Ligatury"), "Łączy np. <code>=&gt;</code> i <code>!=</code> w jeden znak, jeśli font to umie.")}
    </section>
    <section class="st-sec"><h3>Pisanie</h3>
      ${stRow("Widok po otwarciu", stSeg("view", [["source", "Źródło"], ["split", "Podział"], ["page", "Strona"]]))}
      ${stCard([
        ["Numery wierszy", "", stSw("line_numbers")],
        ["Zawijaj długie wiersze", "", stSw("wrap")],
        ["Domykaj nawiasy i znaki $", "Wpisanie <code>$</code>, <code>(</code>, <code>[</code> lub <code>\"</code> wstawia też znak zamykający.", stSw("autopair")],
        ["Kontynuuj listy po Enter", "Nowy wiersz dostaje <code>-</code>, <code>+</code> albo następny numer. Pusty punkt kończy listę.", stSw("list_continue")],
        ["Sprawdzanie pisowni", "Używa słownika Windows dla języka notatki.", stSw("spellcheck")],
      ])}
    </section>
    <section class="st-sec"><h3>Zapisywanie</h3>
      ${stCard([
        ["Zapisuj automatycznie", "Plik na dysku zmienia się dopiero po przerwie w pisaniu.", stSw("autosave")],
        ["Opóźnienie", "", stSel("autosave_delay", SEL_OPTS.autosave_delay)],
      ])}
    </section>`,
  page: () => `
    <h2>Strona</h2><p class="lead">Wygląd renderowanej kartki w aplikacji. Nie zmienia pliku ani PDF, który używa ustawień z samej notatki.</p>
    <section class="st-sec"><h3>Tekst</h3>
      ${stRow("Font strony", stSel("render_font", SEL_OPTS.render_font), "Pole <code>render_font</code>. Notatka z własnym <code>#set text(font: …)</code> ma pierwszeństwo.")}
      ${stRow("Rozmiar tekstu", stStep("render_size", 13, 24, 1, fmtPx))}
      ${stRow("Interlinia", stStep("line_height", 1.3, 2, 0.05, (v) => v.toFixed(2).replace(".", ",")))}
      ${stRow("Wyrównanie akapitów", stSeg("align", [["left", "Do lewej"], ["justify", "Wyjustowane"]]))}
    </section>`,
  keys: () => {
    const q = fold(keyFilter.toLowerCase());
    const list = ACTIONS.filter((a) => a.group !== "Prototyp" && (!q || fold(a.label.toLowerCase()).includes(q) || fold(keyOf(a.id).toLowerCase()).includes(q)));
    const groups = {};
    for (const a of list) (groups[a.group] = groups[a.group] || []).push(a);
    const changed = Object.keys(S.settings.keys).length;
    return `
    <h2>Skróty klawiszowe</h2><p class="lead">Kliknij skrót i naciśnij nową kombinację. Esc anuluje, Backspace usuwa skrót.</p>
    <div class="row2"><div class="inbox" style="flex:0 1 20rem">${icon("search", "sm")}<input id="kF" placeholder="Filtruj po nazwie albo klawiszu" value="${esc(keyFilter)}"></div>
      <span class="grow"></span>${changed ? `<span class="muted" style="font-size:12px">Zmienione: ${changed}</span><button class="wt-btn ghost sm" data-st="keysReset">Przywróć domyślne</button>` : ""}</div>
    ${
      Object.entries(groups)
        .map(
          ([g, acts]) => `<section class="st-sec"><h3>${esc(g)}</h3><div class="cd">${acts
            .map((a) => {
              const ch = S.settings.keys[a.id] !== undefined;
              return `<div class="krow${ch ? " changed" : ""}"><span>${esc(a.label)}</span><span class="row2" style="gap:8px">${ch ? `<span class="def">domyślnie ${esc(a.key || "brak")}</span><button class="wt-ibtn sm" data-st="keyUndo" data-id="${a.id}" title="Przywróć domyślny">${icon("undo", "sm")}</button>` : ""}
              <span data-rec="${a.id}" role="button" tabindex="0" title="Kliknij, aby zmienić">${kbd(keyOf(a.id)) || '<span class="wt-kbd"><kbd>brak</kbd></span>'}</span></span></div>`;
            })
            .join("")}</div></section>`,
        )
        .join("") || '<p class="muted">Brak skrótów pasujących do filtra.</p>'
    }`;
  },
  pdf: () => `
    <h2>Eksport PDF</h2><p class="lead">PDF powstaje w tym samym folderze co notatka, z tą samą nazwą.</p>
    <section class="st-sec">
      ${stRow("Format papieru", stSel("pdf_paper", SEL_OPTS.pdf_paper), "Używany, gdy notatka nie ma własnego <code>#set page(paper: …)</code>.")}
      ${stRow("Marginesy", stStep("pdf_margin", 1, 4, 0.5, (v) => String(v).replace(".", ",") + " cm"))}
      ${stCard([
        ["Numeruj strony", "Numer na dole każdej strony.", stSw("pdf_numbers")],
        ["Otwórz PDF po eksporcie", "W domyślnej przeglądarce PDF systemu.", stSw("pdf_open")],
      ])}
      <p class="muted" style="margin:0;font-size:12px">Eksport nie czyta koloru strony ani fontów edytora. Kartka jest biała, jak na wydruku.</p>
    </section>`,
  packages: () => `
    <h2>Pakiety Typst</h2><p class="lead">Jedyne połączenie z siecią w aplikacji: pobranie pakietu, gdy notatka pierwszy raz go importuje.</p>
    <section class="st-sec">
      ${stCard([["Pobieraj pakiety z sieci", "Wyłączone: import nowego pakietu pokaże błąd, a pobrane wcześniej działają dalej.", stSw("packages_online")]])}
    </section>
    <section class="st-sec"><h3>Pobrane pakiety</h3>
      ${pkgCache.length ? `<div class="pk">${pkgCache.map(([n, s]) => `<span title="${s}">${esc(n)}</span>`).join("")}</div>` : '<p class="muted" style="margin:0">Pamięć pakietów jest pusta.</p>'}
      <div class="row2"><span class="muted" style="font-size:12px">Folder: %LOCALAPPDATA%\\typst\\packages</span><span class="grow"></span><button class="wt-btn secondary sm" data-st="clearPkg" ${pkgCache.length ? "" : "disabled"}>${icon("trash", "sm")}Wyczyść pamięć</button></div>
    </section>`,
  files: () => `
    <h2>Pliki i foldery</h2><p class="lead">Aplikacja czyta i zapisuje tylko w folderach, które sam wskażesz.</p>
    <section class="st-sec">
      ${stRow("Folder szkiców", `<code style="font:12px var(--font-mono)">${esc(S.settings.drafts_dir)}</code><button class="wt-btn secondary sm" data-st="draftsDir">Zmień…</button>`, "Tu trafiają notatki utworzone bez otwartego folderu.")}
      ${stRow("Plik ustawień", `<code style="font:12px var(--font-mono)">%APPDATA%\\pl.wysityp.app\\settings.json</code><button class="wt-btn ghost sm" data-st="json">Pokaż zawartość</button>`)}
      ${stRow("Kodowanie i końce wierszy", '<span class="muted">UTF-8, zachowujemy końce wierszy z pliku (CRLF albo LF)</span>')}
    </section>`,
  privacy: () => `
    <h2>Prywatność</h2><p class="lead">WYSITyp działa offline i niczego o Tobie nie zbiera.</p>
    <section class="st-sec">${stCard([
      ["Telemetria", "Brak. Aplikacja nie wysyła statystyk, raportów błędów ani identyfikatorów.", `<span class="wt-tag" style="--fg:var(--tag-green-fg);--bg:var(--tag-green-bg)">wyłączona na stałe</span>`],
      ["Połączenia sieciowe", "Tylko pobranie pakietu Typst przy pierwszym imporcie i tylko, gdy jesteś online.", `<button class="wt-btn ghost sm" data-st="goPkg">Ustawienia pakietów</button>`],
      ["Twoje notatki", "Zostają zwykłymi plikami .typ na Twoim dysku. Bez konta i chmury.", ""],
    ])}</section>`,
  about: () => `
    <h2>O programie</h2>
    <section class="st-sec">${stCard([
      ["WYSITyp 0.4.0", "Prototyp HTML. Aplikacja: Tauri 2, Svelte 5, Typst 0.13.1.", `<button class="wt-btn secondary sm" data-st="about">Licencje</button>`],
      ["Licencja MIT", "Za darmo, także do nauki i pracy.", ""],
      ["Aktualizacje", "Aplikacja sama nie sprawdza aktualizacji, żeby nie łączyć się z siecią.", `<button class="wt-btn ghost sm" data-st="upd">Sprawdź teraz</button>`],
    ])}</section>
    <section class="st-sec"><h3>Skróty</h3>${stRow("Ściągawka", `<button class="wt-btn secondary sm" data-act="shortcuts">${icon("keyboard", "sm")}Pokaż skróty ${kbd(keyOf("shortcuts"))}</button>`)}</section>`,
};

function settingsPreview() {
  const sample = `= Szeregi potęgowe\n\n*Twierdzenie* (Cauchy–Hadamard).\nPromień zbieżności $R$:\n\n$ 1/R = limsup root(n, |a_n|) $\n\n- zbieżny dla $|x| < R$ // ważne`;
  const hl = TY.highlight(sample, []);
  return `<p class="cap">Podgląd na żywo. Zmiany od razu widać też w otwartych notatkach.</p>
    <div class="mini" aria-hidden="true">
      <div class="sbm"><div style="font-weight:600;color:var(--color-text)">Semestr 3</div><div class="on">Wykład 7</div><div>Wykład 6</div><div>Lab 2</div><div>Algebra</div></div>
      <div class="ed"><div class="tbm"><span class="on">Wykład 7</span><span>Lab 2</span></div><div class="tb"><i></i><i></i><i></i><i style="width:20px"></i><i></i><i></i></div>
        <div class="desk"><div class="mini-paper" style="text-align:${S.settings.align}">
          <h4>Szeregi potęgowe</h4>
          <p><b>Twierdzenie</b> (Cauchy–Hadamard). Promień zbieżności <span class="m">R</span> spełnia</p>
          <div class="blkm">1/R = lim sup ⁿ√|aₙ|</div>
          <div class="box">Szereg jest zbieżny dla <span class="m">|x| &lt; R</span> i rozbieżny dla <span class="m">|x| &gt; R</span>.</div>
          <p class="mut">Na brzegu trzeba sprawdzić osobno, np. <code>x = R</code>. <mark>Na egzamin!</mark></p>
        </div></div></div>
    </div>
    <p class="cap">Źródło</p>
    <pre class="src-prev">${hl.map((l, i) => (S.settings.line_numbers ? `<span style="color:var(--color-text-faint);display:inline-block;width:2ch;text-align:right;margin-right:12px">${i + 1}</span>` : "") + l).join("\n")}</pre>`;
}
function settingsView() {
  const node = el(`<div class="settings">
    <nav class="st-nav" aria-label="Sekcje ustawień">
      <button class="back" data-st="back">${icon("arrowLeft", "sm")}Wróć do notatek</button>
      ${ST_NAV.map((n) => (n.grp ? `<div class="grp">${n.grp}</div>` : `<button data-sec="${n.id}" ${S.settingsSection === n.id ? 'aria-current="page"' : ""}>${icon(n.icon, "sm")}${n.label}</button>`)).join("")}
    </nav>
    <div class="st-main"></div>
    <aside class="st-pv"></aside></div>`);
  const main = $(".st-main", node),
    pv = $(".st-pv", node);
  const draw = (keepScroll = true) => {
    const top = main.scrollTop;
    main.innerHTML = (ST_SECTIONS[S.settingsSection] || ST_SECTIONS.general)();
    pv.innerHTML = settingsPreview();
    if (keepScroll) main.scrollTop = top;
  };
  const set = (k, v) => {
    S.settings[k] = v;
    applySettings();
    persist();
    draw();
    if (k === "status_bar") renderStatus();
    if (k.endsWith("_autohide")) syncPins();
  };
  node.addEventListener("click", async (e) => {
    const t = e.target.closest("[data-sec],[data-seg],[data-sw],[data-step],[data-sel],[data-pc],[data-accent],[data-uistyle],[data-st],[data-rec]");
    if (!t) return;
    const d = t.dataset;
    if (d.sec) {
      S.settingsSection = d.sec;
      $$("[data-sec]", node).forEach((b) => (b === t ? b.setAttribute("aria-current", "page") : b.removeAttribute("aria-current")));
      persist();
      return draw(false);
    }
    if (d.seg) {
      const old = S.settings[d.seg];
      const v = typeof old === "number" ? +d.v : d.v;
      if (d.seg === "view") S.view = null;
      set(d.seg, v);
      if (d.seg === "locale" && v === "en") toast("Prototyp ma tylko teksty polskie. W aplikacji interfejs przełączy się na angielski od razu.", { type: "info" });
      if (d.seg === "toolbar" || d.seg === "view") return;
      return;
    }
    if (d.sw) return set(d.sw, !S.settings[d.sw]);
    if (d.step) {
      const s = +d.s;
      let v = Math.round((S.settings[d.step] + s * +d.d) * 100) / 100;
      v = Math.max(+d.min, Math.min(+d.max, v));
      return set(d.step, v);
    }
    if (d.sel) {
      const key = d.sel;
      return openMenu(
        t,
        SEL_OPTS[key].map(([v, l, f]) => ({ label: l, check: String(S.settings[key]) === String(v), style: f ? `font-family:${f}` : "", run: () => set(key, v) })),
      );
    }
    if (d.pc) {
      S.settings.page_follow = false;
      return set("page_color", d.pc);
    }
    if (d.accent) return set("accent", d.accent);
    if (d.uistyle) {
      set("ui_style", d.uistyle);
      return renderStatus();
    }
    if (d.rec) return recordKey(t, d.rec, draw);
    switch (d.st) {
      case "back": {
        const prev = S.tabs.filter((x) => x !== "settings");
        await closeTab("settings");
        if (S.active === "settings") activate(prev[prev.length - 1] || "home");
        return;
      }
      case "reset":
        return run("resetProto");
      case "keysReset":
        S.settings.keys = {};
        persist();
        return draw();
      case "keyUndo":
        delete S.settings.keys[d.id];
        persist();
        return draw();
      case "clearPkg": {
        const ok = await confirmDlg({ title: "Wyczyścić pamięć pakietów?", text: "Pakiety pobiorą się ponownie, gdy notatka je zaimportuje i będziesz online.", ok: "Wyczyść", danger: true });
        if (!ok) return;
        pkgCache = [];
        draw();
        return toast("Wyczyszczono pamięć pakietów (2,7 MB).", { type: "ok" });
      }
      case "goPkg":
        S.settingsSection = "packages";
        return renderView();
      case "draftsDir":
        return toast("Tu otworzy się systemowe okno wyboru folderu.", { type: "info" });
      case "json":
        return showSettingsJson();
      case "about":
        return aboutDlg();
      case "upd":
        return toast("Najnowsze wydania są na stronie projektu. Aplikacja nie sprawdza ich sama.", { type: "info" });
    }
  });
  node.addEventListener("input", (e) => {
    if (e.target.id !== "kF") return;
    keyFilter = e.target.value;
    const pos = e.target.selectionStart;
    draw();
    const f = $("#kF", node);
    f.focus();
    f.setSelectionRange(pos, pos);
  });
  node.addEventListener("keydown", (e) => {
    const r = e.target.closest("[data-rec]");
    if (r && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      recordKey(r, r.dataset.rec, draw);
    }
  });
  draw(false);
  return node;
}
function recordKey(span, id, redraw) {
  if (window.recordingKey) return;
  const k = $(".wt-kbd", span);
  k.classList.add("rec");
  k.innerHTML = "<kbd>Naciśnij skrót…</kbd>";
  window.recordingKey = true;
  const stop = () => {
    window.recordingKey = false;
    window.removeEventListener("keydown", onKey, true);
    document.removeEventListener("mousedown", onDown, true);
  };
  const onDown = () => {
    stop();
    redraw();
  };
  const onKey = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (["Control", "Shift", "Alt", "Meta"].includes(e.key)) return;
    if (e.key === "Escape") return (stop(), redraw());
    if (e.key === "Backspace" || e.key === "Delete") {
      S.settings.keys[id] = "";
    } else {
      const combo = comboOf(e);
      if (!combo || !/Ctrl|Alt/.test(combo)) {
        toast("Skrót musi zawierać Ctrl albo Alt.", { type: "warn", ms: 2500 });
        return;
      }
      const other = ACTIONS.find((a) => a.id !== id && keyOf(a.id) === combo);
      if (other) {
        S.settings.keys[other.id] = "";
        toast(`${combo} był przypisany do „${other.label}”. Tam usunęliśmy skrót.`, { type: "warn" });
      }
      S.settings.keys[id] = combo === ACT[id].key ? undefined : combo;
      if (S.settings.keys[id] === undefined) delete S.settings.keys[id];
    }
    for (const a of ACTIONS) if (S.settings.keys[a.id] === a.key) delete S.settings.keys[a.id];
    stop();
    persist();
    redraw();
    renderRail();
  };
  window.addEventListener("keydown", onKey, true);
  setTimeout(() => document.addEventListener("mousedown", onDown, true), 0);
}
function showSettingsJson() {
  const st = S.settings;
  const json = {
    locale: st.locale,
    theme: st.theme,
    page_color: st.page_color,
    source_font: st.source_font,
    render_font: st.render_font,
    accent: st.accent,
    ui_size: st.ui_size,
    editor: { view: st.view, line_numbers: st.line_numbers, wrap: st.wrap, autopair: st.autopair, autosave: st.autosave, autosave_delay: st.autosave_delay },
    pdf: { paper: st.pdf_paper, margin_cm: st.pdf_margin, page_numbers: st.pdf_numbers },
    keybindings: st.keys,
  };
  openDialog(
    `<div class="dlg-h">${icon("code")}<h2>settings.json</h2><button class="wt-ibtn sm" data-close title="Zamknij">${icon("close")}</button></div>
    <div class="dlg-b"><p class="muted" style="font-size:12px">Ten plik zapisuje Rust. Brakująca albo błędna wartość zostaje na dysku, a aplikacja czyta wartość domyślną.</p>
      <pre class="codebox" style="max-height:24rem">${esc(JSON.stringify(json, null, 2))}</pre></div>
    <div class="dlg-f"><button class="wt-btn primary" data-close>Zamknij</button></div>`,
    { cls: "fs" },
  );
}
