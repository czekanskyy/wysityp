/* WYSITyp prototype – the AI assistant.
   A chat panel at the right edge of the window, full height, mirroring the sidebar. It talks to a model over an API
   (Anthropic Claude by default, an OpenAI-compatible server or a local Ollama), but only after the student turns it on
   and gives a key. The model sees only what the context chips above the message box show. It never edits a note by
   itself: it proposes a change, the student applies it, and Ctrl+Z takes it back.
   Replies here are canned and streamed with a timer; nothing leaves the browser. */
"use strict";

const AI_PROVIDERS = {
  anthropic: { name: "Anthropic (Claude)", short: "Anthropic", key: true, ph: "sk-ant-…" },
  openai: { name: "Zgodny z OpenAI", short: "serwera zgodnego z OpenAI", key: true, ph: "Klucz serwera" },
  local: { name: "Lokalny (Ollama)", short: "lokalnego modelu", key: false, ph: "" },
};
const AI_MODELS = [
  ["claude-sonnet-5-5", "Claude Sonnet 5.5", "Szybki i dokładny. Dobry na co dzień."],
  ["claude-opus-5-5", "Claude Opus 5.5", "Najmocniejszy. Trudne dowody i długie notatki."],
  ["claude-haiku-5-5", "Claude Haiku 5.5", "Najszybszy i najtańszy. Krótkie pytania."],
];
const AI_QUICK = [
  { id: "explain", icon: "bulb", label: "Wyjaśnij fragment", sub: "Krok po kroku, z intuicją" },
  { id: "fix", icon: "error", label: "Napraw błąd kompilacji", sub: "" },
  { id: "quiz", icon: "cap", label: "Pytania na egzamin", sub: "Pięć pytań z odpowiedziami" },
  { id: "summary", icon: "book", label: "Streść notatkę", sub: "Najważniejsze w kilku punktach" },
  { id: "formula", icon: "sigma", label: "Wzór słowami → Typst", sub: "Opisz wzór, dostaniesz kod" },
  { id: "style", icon: "check", label: "Sprawdź język", sub: "Literówki, interpunkcja, styl" },
];
const AI_PROMPTS = {
  explain: "Wyjaśnij mi ten fragment krok po kroku.",
  fix: "Napraw błąd kompilacji w tej notatce.",
  quiz: "Ułóż pięć pytań na egzamin z tej notatki, z krótkimi odpowiedziami.",
  summary: "Streść tę notatkę w kilku punktach.",
  style: "Sprawdź język tej notatki: literówki, interpunkcję i styl.",
};

/* Conversations live in memory until the app closes; they are never written to disk. */
let aiChats = [],
  aiCur = null,
  aiCtx = [],
  aiTimer = 0,
  aiDraft = "";

const aiOn = () => !!S.settings.ai_enabled && (S.aiKey || S.settings.ai_provider === "local");
const aiChat = () => aiChats.find((c) => c.id === aiCur) || null;
const aiStreaming = () => !!(aiChat() && aiChat().msgs.some((m) => m.streaming));
function aiModelName() {
  if (S.settings.ai_provider !== "anthropic") return S.settings.ai_provider === "local" ? "llama (lokalny)" : "Model serwera";
  return (AI_MODELS.find((m) => m[0] === S.settings.ai_model) || AI_MODELS[0])[1];
}

/* ---------- Opening and closing ---------- */
function aiTopBtn() {
  return `<button class="wt-btn ghost sm ai-tb" data-act="aiPanel" data-keep aria-pressed="${!!S.ai.open}" title="Asystent AI (${keyOf("aiPanel")})">${icon("sparkle", "sm")}Asystent</button>`;
}
function syncAiBtns() {
  $$('[data-act="aiPanel"]').forEach((b) => b.setAttribute("aria-pressed", !!S.ai.open));
}
/* With text selected in the source, the shortcut attaches it to an open panel instead of closing the panel. */
function toggleAi() {
  const srcSel = E && document.activeElement === E.ta && E.ta.selectionStart !== E.ta.selectionEnd;
  return S.ai.open && !srcSel ? closeAi() : aiOpen();
}
/* Open the panel. `sel` attaches selected text; `quick` runs a quick action at once. */
function aiOpen({ sel = null, quick = null } = {}) {
  const fresh = !S.ai.open;
  S.ai.open = true;
  persist();
  if (fresh || !aiCtx.length) aiCtx = aiDefaultCtx();
  if (!sel && E && document.activeElement === E.ta && E.ta.selectionStart !== E.ta.selectionEnd) sel = E.ta.value.slice(E.ta.selectionStart, E.ta.selectionEnd);
  if (sel && S.settings.ai_sel_ctx !== false) {
    aiCtx = aiCtx.filter((c) => c.kind !== "sel");
    aiCtx.push({ kind: "sel", text: sel.trim() });
  }
  renderAi();
  if (quick && aiOn()) return aiQuick(quick);
  setTimeout(() => {
    const ta = $("#ai .ai-comp textarea");
    if (ta) ta.focus();
  }, 0);
}
function closeAi() {
  S.ai.open = false;
  persist();
  renderAi();
  if (E && E.ta && view() !== "page") E.ta.focus({ preventScroll: true });
}
function aiDefaultCtx() {
  const c = [];
  if (E && S.notes[E.id] && S.settings.ai_note_ctx !== false) c.push({ kind: "note", id: E.id });
  return c;
}

/* ---------- The panel ---------- */
function renderAi() {
  const shell = $("#shell");
  shell.classList.toggle("ai-open", !!S.ai.open);
  shell.style.setProperty("--ai-w", S.ai.w + "px");
  syncAiBtns();
  // The error box offers a fix only while the assistant is on.
  if (E && E.r && E.diag && !!$('[data-act="aiFix"]', E.diag) !== aiOn()) renderDiag();
  const box = $("#ai");
  if (!S.ai.open) return box.replaceChildren();
  const chat = aiChat();
  box.innerHTML = `
    <div class="ai-head">
      <span class="ai-mark" aria-hidden="true">${icon("sparkle", "sm")}</span><b class="ttl">Asystent</b>
      ${aiOn() ? `<button class="ai-model" data-ai="model" aria-haspopup="menu" title="Model">${esc(aiModelName())}${icon("chevronDown", "sm")}</button>` : ""}
      <span class="grow"></span>
      ${aiOn() ? `<button class="wt-ibtn sm" data-ai="new" title="Nowa rozmowa" aria-label="Nowa rozmowa">${icon("plus")}</button><button class="wt-ibtn sm" data-ai="more" aria-haspopup="menu" title="Rozmowy i ustawienia" aria-label="Więcej">${icon("more")}</button>` : ""}
      <button class="wt-ibtn sm" data-ai="close" title="Zamknij (${keyOf("aiPanel")})" aria-label="Zamknij asystenta">${icon("close")}</button>
    </div>
    <div class="ai-body" aria-live="polite">${!aiOn() ? aiSetupHtml() : `${S.aiOffline ? aiOfflineHtml() : ""}${chat && chat.msgs.length ? chat.msgs.map(aiMsgHtml).join("") : aiEmptyHtml()}`}</div>
    ${aiOn() ? aiComposerHtml() : ""}`;
  bindAiPanel(box);
  const body = $(".ai-body", box);
  body.scrollTop = body.scrollHeight;
}
function aiSetupHtml() {
  const pv = S.settings.ai_provider || "anthropic";
  const p = AI_PROVIDERS[pv];
  return `<div class="ai-setup">
    <span class="ai-mark big" aria-hidden="true">${icon("sparkle")}</span>
    <h3>Asystent AI jest wyłączony</h3>
    <p>Asystent rozmawia z modelem AI o otwartej notatce: wyjaśnia, układa pytania, poprawia błędy w Typst. Działa przez internet i z Twoim kluczem API.</p>
    <div class="ai-pvs" role="radiogroup" aria-label="Dostawca">${Object.entries(AI_PROVIDERS)
      .map(([id, x]) => `<button role="radio" data-ai="prov" data-v="${id}" aria-checked="${pv === id}"><b>${x.name}</b><small>${id === "anthropic" ? "Claude Sonnet, Opus, Haiku" : id === "openai" ? "Własny adres i klucz" : "Na Twoim komputerze, bez sieci"}</small></button>`)
      .join("")}</div>
    ${
      p.key
        ? `<label class="wt-field"><span class="lab">Klucz API</span><input class="wt-input" id="aiKey" type="password" autocomplete="off" spellcheck="false" placeholder="${p.ph}"></label>
    <p class="ai-note">${icon("shield", "sm")}<span>Klucz trafi do Menedżera poświadczeń Windows, nie do pliku ustawień ani do notatek.</span></p>`
        : `<p class="ai-note">${icon("shield", "sm")}<span>Model działa na Twoim komputerze pod <code>http://localhost:11434</code>. Notatki nie wychodzą do internetu.</span></p>`
    }
    <button class="wt-btn primary" data-ai="enable">${icon("sparkle", "sm")}Włącz asystenta</button>
    <p class="ai-fine">Notatka trafia do modelu tylko wtedy, gdy wyślesz wiadomość, i tylko w zakresie pokazanym nad polem wiadomości. Więcej w <button class="link" data-ai="settings">ustawieniach</button>.</p>
  </div>`;
}
function aiOfflineHtml() {
  return `<div class="ai-off" role="status">${icon("globe", "sm")}<div><b>Brak połączenia z siecią</b>Asystent wróci, gdy będziesz online. Notatki działają normalnie.</div></div>`;
}
function aiEmptyHtml() {
  const n = E && S.notes[E.id];
  const d = E && E.r && E.r.diags[0];
  const qs = AI_QUICK.filter((q) => q.id !== "fix" || d);
  return `<div class="ai-empty">
    <div class="ai-hello"><h3>W czym pomóc?</h3><p>${n ? `Pytaj o notatkę „${esc(n.title)}”. Zmiany w niej najpierw zobaczysz jako propozycję.` : "Otwórz notatkę, żeby pytać o jej treść, albo pytaj o cokolwiek z Typst."}</p></div>
    <div class="ai-quick">${qs
      .map((q) => `<button class="ai-q${q.id === "fix" ? " err" : ""}" data-ai="quick" data-q="${q.id}">${icon(q.icon, "sm")}<b>${q.label}</b><small>${q.id === "fix" ? `Wiersz ${d.line + 1}: ${esc(d.msg.split(".")[0])}` : q.sub}</small></button>`)
      .join("")}</div>
  </div>`;
}
function aiRefHtml(c) {
  if (c.kind === "note") return S.notes[c.id] ? `${icon("file", "sm")}<span>${esc(S.notes[c.id].title)}</span>` : "";
  if (c.kind === "sel") return `${icon("type", "sm")}<span>„${esc(c.text.replace(/\s+/g, " ").slice(0, 40))}${c.text.length > 40 ? "…" : ""}”</span>`;
  if (c.kind === "diag") return `${icon("error", "sm")}<span>Błędy kompilacji</span>`;
  return "";
}
function aiComposerHtml() {
  const busy = aiStreaming();
  return `<div class="ai-comp">
      <div class="ai-ctx" aria-label="Wysyłane razem z wiadomością">${aiCtx
        .map((c, i) => `<span class="ai-chip ${c.kind}" title="${c.kind === "note" ? "Źródło tej notatki trafi do modelu" : c.kind === "sel" ? esc(c.text) : ""}">${aiRefHtml(c)}<button class="wt-ibtn xs" data-ai="unctx" data-i="${i}" aria-label="Nie wysyłaj">${icon("close", "sm")}</button></span>`)
        .join("")}<button class="ai-add" data-ai="ctx" aria-haspopup="menu" title="Dodaj kontekst">${icon("plus", "sm")}${aiCtx.length ? "" : "Kontekst"}</button></div>
      <textarea rows="1" placeholder="${S.aiOffline ? "Asystent czeka na sieć…" : "Zapytaj o notatkę albo poproś o wzór…"}" aria-label="Wiadomość do asystenta" ${S.aiOffline ? "disabled" : ""}>${esc(aiDraft)}</textarea>
      <div class="ai-cbar"><span class="hint">${kbd("Enter")} wyślij · ${kbd("Shift+Enter")} nowy wiersz</span>
        ${busy ? `<button class="ai-send stop" data-ai="stop" title="Zatrzymaj" aria-label="Zatrzymaj odpowiedź"><span class="sq"></span></button>` : `<button class="ai-send" data-ai="send" title="Wyślij" aria-label="Wyślij" ${aiDraft.trim() && !S.aiOffline ? "" : "disabled"}>${icon("arrowLeft", "sm")}</button>`}</div>
    </div>
    <p class="ai-foot">${icon(S.settings.ai_provider === "local" ? "shield" : "globe", "sm")}<span>${S.settings.ai_provider === "local" ? "Model lokalny. Nic nie wychodzi z komputera." : `Wysyłane do ${AI_PROVIDERS[S.settings.ai_provider].short} tylko po naciśnięciu Enter.`}</span></p>`;
}

/* ---------- Messages ---------- */
/* A tiny inline formatter for replies: `code`, **bold**, and $math$ drawn by the same renderer as the page. */
function aiFmt(s) {
  return s
    .split(/(`[^`]+`|\$[^$]+\$)/)
    .map((x, i) => {
      if (i % 2 === 0) return esc(x).replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");
      if (x[0] === "`") return `<code>${esc(x.slice(1, -1))}</code>`;
      return `<span class="wt-mi-inline m">${TY.math(x.slice(1, -1).trim(), false)}</span>`;
    })
    .join("");
}
const AI_UNIT = 24; // a code block or a proposed change "costs" this many characters while streaming
function aiLen(parts) {
  return parts.reduce((a, p) => a + (p.t === "p" || p.t === "h" ? p.s.length : p.t === "ul" || p.t === "ol" ? p.items.join("").length : AI_UNIT), 0);
}
function aiPartsHtml(m) {
  let left = m.streaming ? m.shown : Infinity;
  const out = [];
  let cut = false;
  for (let pi = 0; pi < m.parts.length && !cut; pi++) {
    const p = m.parts[pi];
    if (p.t === "p" || p.t === "h") {
      const take = Math.min(left, p.s.length);
      out.push(`<${p.t === "h" ? "h4" : "p"}>${aiFmt(p.s.slice(0, take))}${take < p.s.length ? '<span class="ai-caret"></span>' : ""}</${p.t === "h" ? "h4" : "p"}>`);
      left -= take;
      cut = take < p.s.length;
    } else if (p.t === "ul" || p.t === "ol") {
      const li = [];
      for (const it of p.items) {
        const take = Math.min(left, it.length);
        if (take <= 0) {
          cut = true;
          break;
        }
        li.push(`<li>${aiFmt(it.slice(0, take))}${take < it.length ? '<span class="ai-caret"></span>' : ""}</li>`);
        left -= take;
        if (take < it.length) {
          cut = true;
          break;
        }
      }
      out.push(`<${p.t}>${li.join("")}</${p.t}>`);
    } else if (left >= AI_UNIT) {
      left -= AI_UNIT;
      out.push(p.t === "code" ? aiCodeHtml(p, pi) : aiDiffHtml(p, pi));
    } else cut = true;
  }
  return out.join("");
}
function aiCodeHtml(p, pi) {
  return `<div class="ai-code"><div class="h"><span>${esc(p.lang || "Typst")}</span><span class="grow"></span>
    <button class="wt-btn ghost sm" data-ai="copy" data-pi="${pi}">${icon("copy", "sm")}Kopiuj</button>
    <button class="wt-btn secondary sm" data-ai="insert" data-pi="${pi}" ${E ? "" : 'disabled title="Otwórz notatkę"'}>${icon("plus", "sm")}Wstaw</button></div>
    <pre>${esc(p.s)}</pre></div>`;
}
function aiDiffHtml(p, pi) {
  const n = S.notes[p.note];
  const st = p.state || "open";
  return `<div class="ai-diff ${st}"><div class="h">${icon("edit", "sm")}<span>Zmiana w „${esc(n ? n.title : "notatce")}”, wiersz ${p.line + 1}</span></div>
    <div class="dl del"><span class="sg">−</span><span>${esc(p.old)}</span></div><div class="dl add"><span class="sg">+</span><span>${esc(p.new)}</span></div>
    <div class="f">${
      st === "done"
        ? `${icon("check", "sm")}<span>Zastosowano. ${kbd("Ctrl+Z")} w źródle cofa.</span>`
        : st === "no"
          ? `<span>Odrzucono.</span>`
          : `<span class="grow"></span><button class="wt-btn ghost sm" data-ai="reject" data-pi="${pi}">Odrzuć</button><button class="wt-btn primary sm" data-ai="apply" data-pi="${pi}">${icon("check", "sm")}Zastosuj</button>`
    }</div></div>`;
}
function aiMsgHtml(m, i) {
  if (m.role === "user")
    return `<div class="ai-msg user">${m.refs.length ? `<div class="refs">${m.refs.map((c) => `<span class="ai-ref">${aiRefHtml(c)}</span>`).join("")}</div>` : ""}<div class="bub">${esc(m.text)}</div></div>`;
  return `<div class="ai-msg bot" data-mi="${i}"><span class="ai-mark" aria-hidden="true">${icon("sparkle", "sm")}</span>
    <div class="txt">${m.thinking ? '<span class="ai-dots" aria-label="Asystent pisze"><i></i><i></i><i></i></span>' : aiPartsHtml(m)}
    ${m.stopped ? '<p class="ai-stopped">Zatrzymano odpowiedź.</p>' : ""}
    ${!m.streaming && !m.thinking ? `<div class="ai-acts"><button class="wt-ibtn xs" data-ai="copyMsg" data-mi="${i}" title="Kopiuj odpowiedź" aria-label="Kopiuj odpowiedź">${icon("copy", "sm")}</button><button class="wt-ibtn xs" data-ai="retry" data-mi="${i}" title="Odpowiedz jeszcze raz" aria-label="Odpowiedz jeszcze raz">${icon("refresh", "sm")}</button><span class="mdl">${esc(m.model)}</span></div>` : ""}</div></div>`;
}
function aiRedrawMsg(i) {
  const node = $(`#ai .ai-msg.bot[data-mi="${i}"]`);
  const chat = aiChat();
  if (!node || !chat) return renderAi();
  const body = $("#ai .ai-body");
  const stick = body.scrollHeight - body.scrollTop - body.clientHeight < 40;
  node.outerHTML = aiMsgHtml(chat.msgs[i], i);
  if (stick) body.scrollTop = body.scrollHeight;
}

/* ---------- Sending and streaming ---------- */
function aiSend(text, kind = null) {
  text = text.trim();
  if (!text || S.aiOffline || aiStreaming()) return;
  let chat = aiChat();
  if (!chat) {
    chat = { id: "c" + Date.now(), title: text.slice(0, 48), msgs: [] };
    aiChats.unshift(chat);
    aiCur = chat.id;
  }
  const refs = aiCtx.map((c) => ({ ...c }));
  chat.msgs.push({ role: "user", text, refs });
  const reply = { role: "bot", parts: aiReply(kind || aiGuess(text), refs), shown: 0, thinking: true, streaming: true, model: aiModelName() };
  chat.msgs.push(reply);
  aiDraft = "";
  aiCtx = aiCtx.filter((c) => c.kind === "note");
  renderAi();
  aiStream(chat.msgs.length - 1);
}
function aiStream(i) {
  const chat = aiChat();
  const m = chat.msgs[i];
  const total = aiLen(m.parts);
  clearTimeout(aiTimer);
  aiTimer = setTimeout(() => {
    m.thinking = false;
    const tick = () => {
      m.shown += 3 + Math.floor(Math.random() * 6);
      if (m.shown >= total) {
        m.streaming = false;
        return renderAi();
      }
      aiRedrawMsg(i);
      aiTimer = setTimeout(tick, 22);
    };
    tick();
  }, 650);
}
function aiStop() {
  const chat = aiChat();
  if (!chat) return;
  clearTimeout(aiTimer);
  chat.msgs.forEach((m) => {
    if (!m.streaming) return;
    if (m.thinking) m.parts = [];
    else {
      // Keep only what was already shown.
      let left = m.shown;
      m.parts = m.parts.filter((p) => {
        const keep = left > 0;
        left -= p.t === "p" || p.t === "h" ? p.s.length : p.t === "ul" || p.t === "ol" ? p.items.join("").length : AI_UNIT;
        return keep;
      });
    }
    m.streaming = m.thinking = false;
    m.shown = Infinity;
    m.stopped = true;
  });
  renderAi();
}
function aiQuick(id) {
  if (id === "formula") {
    aiDraft = "Zapisz w Typst: ";
    renderAi();
    const ta = $("#ai .ai-comp textarea");
    ta.focus();
    ta.setSelectionRange(ta.value.length, ta.value.length);
    return;
  }
  if (id === "fix" && !aiCtx.some((c) => c.kind === "diag")) aiCtx.push({ kind: "diag" });
  aiSend(AI_PROMPTS[id], id);
}
function aiGuess(t) {
  const s = t.toLowerCase();
  if (/typst|wzór|wzor|zapisz/.test(s)) return "formula";
  if (/błąd|blad|napraw|nie kompiluje/.test(s)) return "fix";
  if (/pytani|egzamin|fiszk|quiz/.test(s)) return "quiz";
  if (/streść|stresc|podsumuj|skrót/.test(s)) return "summary";
  if (/literówk|język|jezyk|styl|popraw tekst/.test(s)) return "style";
  if (/wyjaśnij|wyjasnij|dlaczego|co to|jak /.test(s)) return "explain";
  return "chat";
}

/* Canned replies, written as parts: paragraphs, headings, lists, Typst code to insert and changes to apply. */
function aiReply(kind, refs) {
  const nid = (refs.find((c) => c.kind === "note") || {}).id || (E && E.id);
  const n = nid && S.notes[nid];
  const sel = refs.find((c) => c.kind === "sel");
  const title = n ? n.title : "notatki";
  if (kind === "fix") {
    const d = E && E.id === nid && E.r && E.r.diags[0];
    if (!d) return [{ t: "p", s: `Notatka „${title}” kompiluje się bez błędów. Nie mam czego poprawiać.` }];
    const old = n.source.split("\n")[d.line];
    const fixed = /niezamknięty wzór/.test(d.msg) ? old.replace(/\s*$/, "") + (/[+\-=*/]$/.test(old.trim()) ? " ...$" : "$") : old;
    return [
      { t: "p", s: `W wierszu ${d.line + 1} wzór otwiera się znakiem \`$\`, ale się nie zamyka, więc Typst czyta resztę pliku jako matematykę.` },
      { t: "p", s: "Wzór kończy się też na `+`, czyli brakuje drugiego składnika. Domykam go i zostawiam `...` w miejscu, które uzupełnisz:" },
      { t: "diff", note: nid, line: d.line, old, new: fixed },
      { t: "p", s: "Jeśli chodziło Ci o resztę we wzorze Taylora, pełny warunek to zwykle $|R_n(x)| <= M |x - a|^(n+1) / (n+1)!$." },
    ];
  }
  if (kind === "explain") {
    const what = sel ? `„${sel.text.replace(/\s+/g, " ").slice(0, 60)}${sel.text.length > 60 ? "…" : ""}”` : "najważniejsze pojęcie z notatki, czyli całkę Riemanna";
    return [
      { t: "p", s: `Wyjaśniam ${what}.` },
      { t: "h", s: "Intuicja" },
      { t: "p", s: "Dzielisz przedział $[a, b]$ na małe kawałki, na każdym bierzesz wartość funkcji w dowolnym punkcie i mnożysz przez szerokość kawałka. Suma takich prostokątów przybliża całkę." },
      { t: "h", s: "Krok po kroku" },
      {
        t: "ol",
        items: [
          "Podział: punkty $a = x_0 < x_1 < … < x_n = b$, szerokości $Delta x_i = x_i - x_(i-1)$.",
          "Suma Riemanna: $S_n = sum f(xi_i) Delta x_i$, gdzie $xi_i$ leży w $i$-tym kawałku.",
          "Średnica podziału to największe $Delta x_i$. Gdy dąży do zera, sumy zbiegają do jednej liczby – to jest całka.",
          "**Ważne:** wynik nie może zależeć od wyboru punktów $xi_i$. Jeśli zależy, funkcja nie jest całkowalna.",
        ],
      },
      { t: "p", s: "Chcesz, żebym dopisał do notatki krótki przykład z funkcją $f(x) = x^2$ na $[0, 1]$?" },
    ];
  }
  if (kind === "quiz")
    return [
      { t: "p", s: `Pięć pytań z notatki „${title}”. Odpowiedzi są krótkie, w sam raz na fiszki.` },
      {
        t: "ol",
        items: [
          "Czym jest suma Riemanna? – Suma $f(xi_i) Delta x_i$ po kawałkach podziału.",
          "Kiedy funkcja jest całkowalna w sensie Riemanna? – Gdy sumy górne i dolne mają wspólną granicę.",
          "Czy każda funkcja ciągła na $[a, b]$ jest całkowalna? – Tak, to kryterium z notatki.",
          "Co mówi podstawowe twierdzenie rachunku całkowego? – $integral_a^b f = F(b) - F(a)$.",
          "Czym jest średnica podziału? – Długość najdłuższego kawałka podziału.",
        ],
      },
      { t: "p", s: "Mogę wstawić je na końcu notatki jako sekcję:" },
      {
        t: "code",
        s: "== Pytania kontrolne\n\n+ Czym jest suma Riemanna?\n+ Kiedy funkcja jest całkowalna w sensie Riemanna?\n+ Czy każda funkcja ciągła na $[a, b]$ jest całkowalna?\n+ Co mówi podstawowe twierdzenie rachunku całkowego?\n+ Czym jest średnica podziału?",
      },
    ];
  if (kind === "summary")
    return [
      { t: "p", s: `Najważniejsze z „${title}”:` },
      {
        t: "ul",
        items: [
          "Całka Riemanna to granica sum $f(xi_i) Delta x_i$, gdy średnica podziału dąży do zera.",
          "Funkcja jest całkowalna, gdy sumy górne i dolne mają wspólną granicę.",
          "Każda funkcja ciągła na przedziale domkniętym jest całkowalna.",
          "Podstawowe twierdzenie: $integral_a^b f(x) dif x = F(b) - F(a)$.",
          "Numerycznie całkę przybliża suma prostokątów, jak w `integrate()`.",
        ],
      },
      { t: "p", s: "Notatka urywa się na warunku dla reszty i ma TODO o kryterium Cauchy'ego – te dwa miejsca warto dokończyć." },
    ];
  if (kind === "style") {
    const ls = n ? n.source.split("\n") : [];
    const li = ls.findIndex((l) => l.includes("pole – pole to tylko"));
    const parts = [{ t: "p", s: "Literówek nie widzę. Interpunkcja jest poprawna." }];
    if (li >= 0)
      parts.push(
        { t: "p", s: "Jedna sugestia stylu: w cytacie „pole” powtarza się dwa razy z rzędu. Można to rozdzielić:" },
        { t: "diff", note: nid, line: li, old: ls[li], new: ls[li].replace("pole – pole to tylko interpretacja", "pole – pole jest tylko jej interpretacją") },
      );
    return parts;
  }
  if (kind === "formula")
    return [
      { t: "p", s: "Tak zapiszesz całkę jako granicę sum Riemanna:" },
      { t: "code", s: "$ integral_a^b f(x) dif x = lim_(n -> oo) sum_(i=1)^n f(xi_i) Delta x_i $" },
      { t: "p", s: "Spacje po `$` i przed zamykającym `$` robią z tego wzór w osobnym wierszu. Bez nich wzór stanie w tekście." },
    ];
  return [
    { t: "p", s: n ? `Patrzę na „${title}”. Notatka prowadzi od definicji całki Riemanna przez kryterium całkowalności do przybliżenia numerycznego.` : "Chętnie pomogę. Otwórz notatkę, a będę mógł odnieść się do jej treści." },
    { t: "p", s: "Mogę ją streścić, ułożyć pytania na egzamin, wyjaśnić wybrany fragment albo zapisać opisany słowami wzór w Typst. Zaznacz tekst na stronie, żeby zapytać o konkretne miejsce." },
  ];
}

/* ---------- Applying replies to the note ---------- */
function aiPart(pi, mi) {
  const chat = aiChat();
  const m = mi != null ? chat.msgs[mi] : chat.msgs.findLast((x) => x.role === "bot" && x.parts[pi]);
  return m && m.parts[pi];
}
function aiInsert(code) {
  if (!E) return toast("Otwórz notatkę, żeby wstawić kod.", { type: "info" });
  if (view() === "page") return toast("Wstawianie działa w widoku ze źródłem. Przełącz widok na źródło albo podział.", { type: "info" });
  const ta = E.ta;
  const v = ta.value,
    s = ta.selectionStart;
  const atStart = s === 0 || v[s - 1] === "\n";
  ta.setSelectionRange(s, ta.selectionEnd);
  insertText(ta, (atStart ? "" : "\n\n") + code + "\n");
  toast("Wstawiono w miejscu kursora. Ctrl+Z cofa.", { type: "ok", ms: 2600 });
}
function aiApply(p) {
  const n = S.notes[p.note];
  if (!n) return toast("Tej notatki już nie ma.", { type: "warn" });
  if (!E || E.id !== p.note) {
    activate(p.note);
    if (!E) return;
  }
  const ls = E.ta.value.split("\n");
  const line = ls[p.line] === p.old ? p.line : ls.indexOf(p.old);
  if (line < 0) return toast("Ten wiersz zmienił się od propozycji. Poproś o nową.", { type: "warn" });
  const from = indexOfLine(E.ta.value, line);
  E.ta.setSelectionRange(from, from + p.old.length);
  insertText(E.ta, p.new);
  p.state = "done";
  renderAi();
}

/* ---------- Panel events ---------- */
function bindAiPanel(box) {
  box.onclick = async (e) => {
    const b = e.target.closest("[data-ai]");
    if (!b || b.disabled) return;
    const d = b.dataset;
    switch (d.ai) {
      case "close":
        return closeAi();
      case "new":
        aiStop();
        aiCur = null;
        aiCtx = aiDefaultCtx();
        return renderAi();
      case "model":
        return openMenu(
          b,
          S.settings.ai_provider === "anthropic"
            ? [{ head: "Model" }, ...AI_MODELS.map(([id, name, sub]) => ({ html: `${name}<small class="mi-sub">${sub}</small>`, check: S.settings.ai_model === id, run: () => ((S.settings.ai_model = id), persist(), renderAi()) }))]
            : [{ head: "Model" }, { label: aiModelName(), check: true }, { sep: true }, { label: "Zmień w ustawieniach…", icon: "settings", run: () => openSettings("ai") }],
        );
      case "more":
        return openMenu(b, [
          { label: "Nowa rozmowa", icon: "plus", run: () => box.querySelector('[data-ai="new"]').click() },
          ...(aiChats.length ? [{ head: "Rozmowy z tej sesji" }, ...aiChats.slice(0, 6).map((c) => ({ label: c.title, check: c.id === aiCur, run: () => ((aiCur = c.id), renderAi()) }))] : []),
          { sep: true },
          { label: "Ustawienia asystenta", icon: "settings", run: () => openSettings("ai") },
          { label: "Usuń rozmowy z tej sesji", icon: "trash", danger: true, disabled: !aiChats.length, run: () => (aiStop(), (aiChats = []), (aiCur = null), renderAi()) },
        ]);
      case "prov":
        S.settings.ai_provider = d.v;
        persist();
        return renderAi();
      case "enable": {
        const k = $("#aiKey", box);
        if (k && !k.value.trim()) {
          k.focus();
          return toast("Wklej klucz API. Znajdziesz go w panelu dostawcy.", { type: "info" });
        }
        if (k) S.aiKey = true; // the prototype keeps only the fact that a key exists, never the key
        S.settings.ai_enabled = true;
        persist();
        aiCtx = aiDefaultCtx();
        renderAi();
        $("#ai .ai-comp textarea").focus();
        return toast("Asystent włączony. Klucz zapisany w Menedżerze poświadczeń.", { type: "ok" });
      }
      case "settings":
        return openSettings("ai");
      case "quick":
        return aiQuick(d.q);
      case "unctx":
        aiCtx.splice(+d.i, 1);
        return renderAi();
      case "ctx": {
        const has = (k) => aiCtx.some((c) => c.kind === k);
        const sel = window.getSelection().toString() || (E && E.ta.value.slice(E.ta.selectionStart, E.ta.selectionEnd));
        return openMenu(b, [
          { head: "Wyślij razem z wiadomością" },
          { label: E ? `Otwarta notatka: ${S.notes[E.id].title}` : "Otwarta notatka", icon: "file", disabled: !E || has("note"), run: () => (aiCtx.unshift({ kind: "note", id: E.id }), renderAi()) },
          { label: sel ? "Zaznaczony tekst" : "Zaznaczony tekst (najpierw zaznacz)", icon: "type", disabled: !sel || has("sel"), run: () => (aiCtx.push({ kind: "sel", text: sel }), renderAi()) },
          { label: "Błędy kompilacji", icon: "error", disabled: !(E && E.r && E.r.diags.length) || has("diag"), run: () => (aiCtx.push({ kind: "diag" }), renderAi()) },
          { label: "Inna notatka…", icon: "search", run: () => toast("Tu otworzy się wyszukiwarka notatek, jak w Ctrl+P.", { type: "info" }) },
        ]);
      }
      case "send":
        return aiSend($(".ai-comp textarea", box).value);
      case "stop":
        return aiStop();
      case "copy":
      case "copyMsg": {
        const chat = aiChat();
        const txt = d.ai === "copy" ? aiPart(+d.pi, +b.closest("[data-mi]").dataset.mi).s : chat.msgs[+d.mi].parts.map((p) => p.s || (p.items ? p.items.map((x) => "- " + x).join("\n") : p.new || "")).join("\n\n");
        try {
          await navigator.clipboard.writeText(txt);
          toast("Skopiowano.", { type: "ok", ms: 1600 });
        } catch {
          toast("Schowek jest niedostępny w tej przeglądarce.", { type: "warn" });
        }
        return;
      }
      case "insert":
        return aiInsert(aiPart(+d.pi, +b.closest("[data-mi]").dataset.mi).s);
      case "apply":
        return aiApply(aiPart(+d.pi, +b.closest("[data-mi]").dataset.mi));
      case "reject":
        aiPart(+d.pi, +b.closest("[data-mi]").dataset.mi).state = "no";
        return renderAi();
      case "retry": {
        const chat = aiChat();
        const m = chat.msgs[+d.mi];
        Object.assign(m, { shown: 0, thinking: true, streaming: true, stopped: false });
        m.parts.forEach((p) => delete p.state);
        renderAi();
        return aiStream(+d.mi);
      }
    }
  };
  const ta = $(".ai-comp textarea", box);
  if (!ta) return;
  const fit = () => {
    ta.style.height = "auto";
    ta.style.height = Math.min(160, ta.scrollHeight) + "px";
  };
  fit();
  ta.addEventListener("input", () => {
    aiDraft = ta.value;
    fit();
    const s = $('[data-ai="send"]', box);
    if (s) s.disabled = !aiDraft.trim() || S.aiOffline;
  });
  ta.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      aiSend(ta.value);
    } else if (e.key === "Escape" && !aiDraft) {
      e.stopPropagation();
      closeAi();
    }
  });
}

/* ---------- Hooks from the rest of the app ---------- */
SEL_OPTS.ai_model = AI_MODELS.map(([id, name]) => [id, name]);
/* Another note opened: the note chip follows it, and an empty chat greets the new note. */
function aiNoteSwitch() {
  if (!S.ai.open) return;
  const had = aiCtx.some((c) => c.kind === "note");
  aiCtx = aiCtx.filter((c) => c.kind !== "note" && c.kind !== "diag");
  if ((had || !aiChat()) && E && S.settings.ai_note_ctx !== false) aiCtx.unshift({ kind: "note", id: E.id });
  renderAi();
}
/* Errors came or went while typing: refresh the quick actions of an empty chat without touching the message box. */
function aiDiagChanged() {
  if (!S.ai.open || !aiOn() || (aiChat() && aiChat().msgs.length)) return;
  const node = $("#ai .ai-empty");
  if (node) node.outerHTML = aiEmptyHtml();
}
/* Settings: add or replace the key. The prototype keeps only the fact that a key exists. */
function aiKeyDlg(done) {
  const p = AI_PROVIDERS[S.settings.ai_provider];
  const d = openDialog(
    `${dlgHead("shield", "Klucz API", `Dla: ${esc(p.name)}`)}
    <div class="dlg-b"><label class="wt-field"><span class="lab">Klucz</span><input class="wt-input" type="password" autocomplete="off" spellcheck="false" placeholder="${p.ph}"></label>
      <p class="muted" style="margin:10px 0 0;font-size:12px">Klucz trafi do Menedżera poświadczeń Windows. Nie zapisujemy go w pliku ustawień ani w notatkach i nie pokazujemy go ponownie.</p></div>
    <div class="dlg-f"><button class="wt-btn secondary" data-close>Anuluj</button><button class="wt-btn primary" data-v="ok">Zapisz klucz</button></div>`,
    { cls: "confirm" },
  );
  const inp = $("input", d.dlg);
  const save = () => {
    if (!inp.value.trim()) return inp.focus();
    S.aiKey = true;
    persist();
    d.close();
    done();
    renderAi();
    toast("Zapisano klucz w Menedżerze poświadczeń.", { type: "ok" });
  };
  $('[data-v="ok"]', d.dlg).addEventListener("click", save);
  inp.addEventListener("keydown", (e) => e.key === "Enter" && save());
}

/* Drag the left edge to resize; a double click restores the default width. */
function bindAiResize() {
  const h = $("#aiResize");
  h.addEventListener("pointerdown", (e) => {
    h.setPointerCapture(e.pointerId);
    h.classList.add("drag");
    const x0 = e.clientX,
      w0 = S.ai.w;
    const z = UI_ZOOM[S.settings.ui_size] || 1;
    const move = (ev) => {
      S.ai.w = Math.round(Math.max(320, Math.min(640, w0 - (ev.clientX - x0) / z)));
      $("#shell").style.setProperty("--ai-w", S.ai.w + "px");
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
    S.ai.w = 380;
    renderAi();
    persist();
  });
}
