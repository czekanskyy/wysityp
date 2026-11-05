<script lang="ts">
  import { api } from "./lib/api";
  import { createEditor, type EditorHandle } from "./lib/editor";
  import { applyLocale, currentLocale, type AppLocale } from "./lib/locale";
  import { byteOffsetToUtf16, debounce, RenderGuard } from "./lib/render";
  import { m } from "./paraglide/messages.js";
  import type { RenderDiagnostic } from "./bindings";

  let locale = $state<AppLocale>(currentLocale());
  let rootName = $state("");
  let notes = $state<string[]>([]);
  let currentPath = $state("");
  let pageUrls = $state<string[]>([]);
  let diagnostics = $state<RenderDiagnostic[]>([]);
  let status = $state("");
  let rendering = $state(false);

  let editor: EditorHandle | undefined;
  const guard = new RenderGuard();

  function setPages(svgs: string[]) {
    for (const url of pageUrls) URL.revokeObjectURL(url);
    pageUrls = svgs.map((svg) =>
      URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" })),
    );
  }

  const labels = $derived.by(() => {
    // Reading locale here makes every label draw again when it changes.
    void locale;
    return {
      appName: m.app_name(),
      tagline: m.app_tagline(),
      openFolder: m.open_folder(),
      createSample: m.create_sample(),
      saveNote: m.save_note(),
      language: m.language(),
      noFolder: m.no_folder(),
      noNote: m.no_note(),
      notesInFolder: m.notes_in_folder(),
      editor: m.editor_label(),
      preview: m.preview_label(),
      diagnostics: m.diagnostics_label(),
      noDiagnostics: m.no_diagnostics(),
      rendering: m.rendering(),
      saved: m.saved(),
      saveFailed: m.save_failed(),
      openFailed: m.open_failed(),
      renderFailed: m.render_failed(),
      workspaceReady: m.workspace_ready(),
      clickNote: m.click_note(),
      lastGoodKept: m.last_good_kept(),
    };
  });

  const hasError = $derived(diagnostics.some((d) => d.severity === "error"));

  async function runRender() {
    if (!editor || !currentPath) return;
    const revision = guard.next();
    const source = editor.getText();
    const path = currentPath;
    rendering = true;
    try {
      const result = await api.renderNote(path, source, revision);
      if (!guard.isCurrent(result.revision)) return;
      diagnostics = result.diagnostics;
      // A failed draw keeps the last good page on screen.
      if (result.pages.length > 0) setPages(result.pages);
      if (
        result.diagnostics.some((d) => d.severity === "error") &&
        pageUrls.length > 0
      ) {
        status = labels.lastGoodKept;
      }
    } catch (error) {
      if (guard.isCurrent(revision)) {
        status = `${labels.renderFailed}: ${String(error)}`;
      }
    } finally {
      if (guard.isCurrent(revision)) rendering = false;
    }
  }

  const scheduleRender = debounce(() => void runRender(), 350);

  async function openFolder() {
    try {
      const picked = await api.openWorkspace();
      if (!picked) return;
      rootName = picked.root_name;
      notes = picked.notes;
      status = labels.workspaceReady;
      if (notes.length === 0) status = labels.clickNote;
    } catch (error) {
      status = `${labels.openFailed}: ${String(error)}`;
    }
  }

  async function openNote(path: string) {
    try {
      const note = await api.openNote(path);
      currentPath = note.path;
      setPages([]);
      diagnostics = [];
      editor?.setText(note.text);
      await runRender();
    } catch (error) {
      status = `${labels.openFailed}: ${String(error)}`;
    }
  }

  async function createSample() {
    try {
      const note = await api.createSampleNote();
      notes = await api.listNotes();
      currentPath = note.path;
      editor?.setText(note.text);
      await runRender();
    } catch (error) {
      status = `${labels.openFailed}: ${String(error)}`;
    }
  }

  async function saveNote() {
    if (!editor || !currentPath) return;
    try {
      await api.saveNote(currentPath, editor.getText());
      status = labels.saved;
    } catch (error) {
      status = `${labels.saveFailed}: ${String(error)}`;
    }
  }

  async function changeLocale(next: AppLocale) {
    try {
      const saved = await api.setLocale(next);
      locale = saved.locale === "en" ? "en" : "pl";
      applyLocale(locale);
    } catch (error) {
      status = `${labels.saveFailed}: ${String(error)}`;
    }
  }

  function jumpToDiagnostic(diagnostic: RenderDiagnostic) {
    if (!editor) return;
    const source = editor.getText();
    editor.setSelection(byteOffsetToUtf16(source, diagnostic.start));
    editor.focus();
  }

  function editorAttachment(node: HTMLDivElement) {
    editor = createEditor(node, "", () => scheduleRender());
    return () => {
      editor?.destroy();
      editor = undefined;
    };
  }
</script>

<div class="shell">
  <header class="topbar">
    <div class="brand">
      <p class="brand-name">{labels.appName}</p>
      <p class="brand-tag">{labels.tagline}</p>
    </div>
    <div class="actions">
      <button type="button" onclick={openFolder}>{labels.openFolder}</button>
      <button type="button" onclick={createSample} disabled={!rootName}>
        {labels.createSample}
      </button>
      <button
        type="button"
        class="primary"
        onclick={saveNote}
        disabled={!currentPath}
      >
        {labels.saveNote}
      </button>
      <label class="locale-picker">
        <span>{labels.language}</span>
        <select
          aria-label={labels.language}
          value={locale}
          onchange={(event) =>
            changeLocale(event.currentTarget.value as AppLocale)}
        >
          <option value="pl">Polski</option>
          <option value="en">English</option>
        </select>
      </label>
    </div>
  </header>

  <div class="workarea">
    <aside class="sidebar" aria-label={labels.notesInFolder}>
      <h2>{labels.notesInFolder}</h2>
      {#if !rootName}
        <p class="muted">{labels.noFolder}</p>
      {:else}
        <p class="root-name">{rootName}</p>
        {#if notes.length === 0}
          <p class="muted">{labels.clickNote}</p>
        {:else}
          <ul class="note-list">
            {#each notes as note (note)}
              <li>
                <button
                  type="button"
                  class:active={note === currentPath}
                  onclick={() => openNote(note)}
                >
                  {note}
                </button>
              </li>
            {/each}
          </ul>
        {/if}
      {/if}
      {#if status}
        <p class="status" role="status">{status}</p>
      {/if}
      {#if rendering}
        <p class="muted" role="status">{labels.rendering}</p>
      {/if}
    </aside>

    <main class="panes">
      <section class="pane editor-pane" aria-label={labels.editor}>
        <h2>
          {labels.editor}{#if currentPath}<span class="path">{currentPath}</span
            >{/if}
        </h2>
        {#if !currentPath}
          <p class="muted pad">{labels.noNote}</p>
        {/if}
        <div class="editor-host" {@attach editorAttachment}></div>
      </section>

      <section class="pane preview-pane" aria-label={labels.preview}>
        <h2>{labels.preview}</h2>
        <div class="pages">
          {#each pageUrls as pageUrl, index (index)}
            <div class="page"><img src={pageUrl} alt="" /></div>
          {/each}
        </div>
        <div class="diagnostics" aria-label={labels.diagnostics}>
          <h3>{labels.diagnostics}</h3>
          {#if diagnostics.length === 0}
            <p class="muted">{labels.noDiagnostics}</p>
          {:else}
            <ul>
              {#each diagnostics as diagnostic, index (index)}
                <li>
                  <button
                    type="button"
                    class="diagnostic"
                    class:error={diagnostic.severity === "error"}
                    onclick={() => jumpToDiagnostic(diagnostic)}
                  >
                    <strong>{diagnostic.severity}</strong>
                    <span>{diagnostic.file}:{diagnostic.start}</span>
                    <span>{diagnostic.message}</span>
                    {#each diagnostic.hints as hint (hint)}
                      <span class="hint">{hint}</span>
                    {/each}
                  </button>
                </li>
              {/each}
            </ul>
            {#if hasError && pageUrls.length > 0}
              <p class="muted">{labels.lastGoodKept}</p>
            {/if}
          {/if}
        </div>
      </section>
    </main>
  </div>
</div>
