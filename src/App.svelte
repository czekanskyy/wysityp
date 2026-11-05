<script lang="ts">
  import { api } from "./lib/api";
  import { createEditor, type EditorHandle } from "./lib/editor";
  import { applyLocale, currentLocale, type AppLocale } from "./lib/locale";
  import { byteOffsetToUtf16, debounce, RenderGuard } from "./lib/render";
  import { m } from "./paraglide/messages.js";
  import type { RenderDiagnostic, TreeNode } from "./bindings";

  let locale = $state<AppLocale>(currentLocale());
  let rootName = $state("");
  let tree = $state.raw<TreeNode[]>([]);
  let openFolders = $state<string[]>([]);
  let selectedFolder = $state("");
  let entryName = $state("");
  let renamingPath = $state("");
  let renameValue = $state("");
  let pendingDelete = $state("");
  let currentPath = $state("");
  let pageUrls = $state<string[]>([]);
  let diagnostics = $state<RenderDiagnostic[]>([]);
  let status = $state("");
  let rendering = $state(false);

  let editor: EditorHandle | undefined;
  let nameInput: HTMLInputElement | undefined = $state();
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
      newNote: m.new_note(),
      newFolder: m.new_folder(),
      nameLabel: m.name_label(),
      createHere: m.create_here(),
      renameOrMove: m.rename_or_move(),
      newPath: m.new_path(),
      applyPath: m.apply_path(),
      delete: m.delete(),
      confirmDelete: m.confirm_delete(),
      cancel: m.cancel(),
      expandFolder: m.expand_folder(),
      collapseFolder: m.collapse_folder(),
      useAsPlace: m.use_as_place(),
      placeIsRoot: m.place_is_root(),
      placeIsFolder: m.place_is_folder(),
      moveHint: m.move_hint(),
      actionFailed: m.action_failed(),
      emptyTree: m.empty_tree(),
      clearPlace: m.clear_place(),
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

  function clearOpenNote() {
    currentPath = "";
    editor?.setText("");
    setPages([]);
    diagnostics = [];
  }

  function noteWasRemoved(path: string) {
    return currentPath === path || currentPath.startsWith(`${path}/`);
  }

  function retargetOpenNote(from: string, to: string) {
    if (currentPath === from) currentPath = to;
    else if (currentPath.startsWith(`${from}/`)) {
      currentPath = to + currentPath.slice(from.length);
    }
  }

  async function refreshTree() {
    tree = await api.listTree();
  }

  async function openFolder() {
    try {
      const picked = await api.openWorkspace();
      if (!picked) return;
      rootName = picked.root_name;
      selectedFolder = "";
      openFolders = [];
      renamingPath = "";
      pendingDelete = "";
      clearOpenNote();
      await refreshTree();
      status = tree.length === 0 ? labels.clickNote : labels.workspaceReady;
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
      await refreshTree();
      currentPath = note.path;
      editor?.setText(note.text);
      await runRender();
    } catch (error) {
      status = `${labels.openFailed}: ${String(error)}`;
    }
  }

  async function createEntry(kind: "note" | "folder") {
    const name = entryName.trim();
    if (!name || !rootName) return;
    try {
      if (kind === "note") {
        const note = await api.createNote(selectedFolder, name);
        entryName = "";
        await refreshTree();
        if (selectedFolder && !openFolders.includes(selectedFolder)) {
          openFolders = [...openFolders, selectedFolder];
        }
        currentPath = note.path;
        editor?.setText(note.text);
        setPages([]);
        diagnostics = [];
        await runRender();
      } else {
        const created = await api.createFolder(selectedFolder, name);
        entryName = "";
        selectedFolder = created;
        if (!openFolders.includes(created))
          openFolders = [...openFolders, created];
        await refreshTree();
      }
    } catch (error) {
      status = `${labels.actionFailed}: ${String(error)}`;
    }
  }

  function startRename(path: string) {
    renamingPath = path;
    renameValue = path;
    pendingDelete = "";
  }

  async function applyRename() {
    const from = renamingPath;
    const to = renameValue.trim();
    if (!from || !to) return;
    const wasOpen = currentPath === from || currentPath.startsWith(`${from}/`);
    try {
      const next = await api.renameEntry(from, to);
      renamingPath = "";
      retargetOpenNote(from, next);
      if (selectedFolder === from || selectedFolder.startsWith(`${from}/`)) {
        selectedFolder =
          selectedFolder === from
            ? next
            : next + selectedFolder.slice(from.length);
      }
      openFolders = openFolders.map((folder) => {
        if (folder === from) return next;
        if (folder.startsWith(`${from}/`))
          return next + folder.slice(from.length);
        return folder;
      });
      await refreshTree();
      if (wasOpen && currentPath) await runRender();
    } catch (error) {
      status = `${labels.actionFailed}: ${String(error)}`;
    }
  }

  function closeDelete() {
    pendingDelete = "";
    queueMicrotask(() => nameInput?.focus());
  }

  function askDelete(path: string) {
    pendingDelete = path;
    renamingPath = "";
  }

  function onConfirmKey(event: KeyboardEvent) {
    if (event.key === "Escape" && pendingDelete) {
      event.preventDefault();
      closeDelete();
    }
  }

  function focusOnMount(node: HTMLElement) {
    node.focus();
  }

  function rememberNameInput(node: HTMLInputElement) {
    nameInput = node;
    return () => {
      nameInput = undefined;
    };
  }

  async function confirmDelete() {
    const path = pendingDelete;
    if (!path) return;
    try {
      await api.deleteEntry(path);
      closeDelete();
      if (selectedFolder === path || selectedFolder.startsWith(`${path}/`)) {
        selectedFolder = "";
      }
      openFolders = openFolders.filter(
        (folder) => folder !== path && !folder.startsWith(`${path}/`),
      );
      if (noteWasRemoved(path)) clearOpenNote();
      await refreshTree();
    } catch (error) {
      status = `${labels.actionFailed}: ${String(error)}`;
    }
  }

  function toggleFolder(path: string) {
    openFolders = openFolders.includes(path)
      ? openFolders.filter((folder) => folder !== path)
      : [...openFolders, path];
  }

  function chooseFolder(path: string) {
    selectedFolder = path;
    if (!openFolders.includes(path)) openFolders = [...openFolders, path];
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

<svelte:window onkeydown={onConfirmKey} />

{#snippet renameForm()}
  <form
    class="rename-form"
    onsubmit={(event) => {
      event.preventDefault();
      applyRename();
    }}
  >
    <label>
      <span>{labels.newPath}</span>
      <input bind:value={renameValue} autocomplete="off" spellcheck="false" />
    </label>
    <p class="muted">{labels.moveHint}</p>
    <div class="row-actions">
      <button type="submit">{labels.applyPath}</button>
      <button type="button" onclick={() => (renamingPath = "")}
        >{labels.cancel}</button
      >
    </div>
  </form>
{/snippet}

{#snippet treeNodes(nodes: TreeNode[])}
  <ul class="tree">
    {#each nodes as node (node.path)}
      <li class={node.kind === "folder" ? "tree-folder" : "tree-note"}>
        {#if node.kind === "folder"}
          <div class="tree-row">
            <button
              type="button"
              class="twist"
              aria-expanded={openFolders.includes(node.path)}
              aria-label={openFolders.includes(node.path)
                ? labels.collapseFolder
                : labels.expandFolder}
              onclick={() => toggleFolder(node.path)}
            >
              <span
                class={["chevron", { open: openFolders.includes(node.path) }]}
                aria-hidden="true"
              ></span>
            </button>
            <button
              type="button"
              class={["folder-name", { chosen: selectedFolder === node.path }]}
              aria-pressed={selectedFolder === node.path}
              aria-label={`${labels.useAsPlace} ${node.name}`}
              onclick={() => chooseFolder(node.path)}
            >
              {node.name}
            </button>
          </div>
          <div class="tree-actions">
            <button type="button" onclick={() => startRename(node.path)}>
              {labels.renameOrMove}
            </button>
            <button type="button" onclick={() => askDelete(node.path)}
              >{labels.delete}</button
            >
          </div>
          {#if renamingPath === node.path}
            {@render renameForm()}
          {/if}
          {#if openFolders.includes(node.path)}
            {#if node.children.length === 0}
              <p class="muted nested-empty">{labels.emptyTree}</p>
            {:else}
              {@render treeNodes(node.children)}
            {/if}
          {/if}
        {:else}
          <div class="tree-row">
            <button
              type="button"
              class={["note-name", { active: currentPath === node.path }]}
              aria-current={currentPath === node.path ? "true" : undefined}
              onclick={() => openNote(node.path)}
            >
              {node.name}
            </button>
          </div>
          <div class="tree-actions">
            <button type="button" onclick={() => startRename(node.path)}>
              {labels.renameOrMove}
            </button>
            <button type="button" onclick={() => askDelete(node.path)}
              >{labels.delete}</button
            >
          </div>
          {#if renamingPath === node.path}
            {@render renameForm()}
          {/if}
        {/if}
      </li>
    {/each}
  </ul>
{/snippet}

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
        <form
          class="entry-form"
          onsubmit={(event) => {
            event.preventDefault();
            createEntry("note");
          }}
        >
          <p class="form-title">{labels.createHere}</p>
          <label>
            <span>{labels.nameLabel}</span>
            <input
              {@attach rememberNameInput}
              bind:value={entryName}
              autocomplete="off"
              spellcheck="false"
            />
          </label>
          <p class="muted place-line">
            {#if selectedFolder}
              {labels.placeIsFolder} <strong>{selectedFolder}</strong>
            {:else}
              {labels.placeIsRoot}
            {/if}
          </p>
          <div class="row-actions">
            <button
              type="button"
              onclick={() => createEntry("note")}
              disabled={!entryName.trim()}
            >
              {labels.newNote}
            </button>
            <button
              type="button"
              onclick={() => createEntry("folder")}
              disabled={!entryName.trim()}
            >
              {labels.newFolder}
            </button>
          </div>
          {#if selectedFolder}
            <button type="button" onclick={() => (selectedFolder = "")}>
              {labels.clearPlace}
            </button>
          {/if}
        </form>
        {#if tree.length === 0}
          <p class="muted">{labels.emptyTree}</p>
        {:else}
          {@render treeNodes(tree)}
        {/if}
        {#if pendingDelete}
          <section class="confirm" aria-labelledby="confirm-title">
            <p id="confirm-title">{labels.confirmDelete}</p>
            <p class="path-line">{pendingDelete}</p>
            <div class="row-actions">
              <button
                type="button"
                class="danger"
                {@attach focusOnMount}
                onclick={confirmDelete}
              >
                {labels.delete}
              </button>
              <button type="button" onclick={closeDelete}
                >{labels.cancel}</button
              >
            </div>
          </section>
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
                    class={[
                      "diagnostic",
                      { error: diagnostic.severity === "error" },
                    ]}
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
