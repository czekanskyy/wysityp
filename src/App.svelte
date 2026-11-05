<script lang="ts">
  import { getCurrentWindow } from "@tauri-apps/api/window";
  import { api } from "./lib/api";
  import {
    createEditor,
    type EditorHandle,
    type EditorPlace,
  } from "./lib/editor";
  import { applyLocale, currentLocale, type AppLocale } from "./lib/locale";
  import {
    AUTOSAVE_WAIT_MS,
    createAutosaveTimer,
    EDITOR_PLACE_START,
    isExternalChange,
    savedTextIsCurrent,
    shouldApplySaveResult,
    shouldRunSave,
    showsRendered,
    showsSource,
    type NoteView,
    type OpenNote,
    type SaveOrigin,
    type SavePhase,
    type SaveTicket,
  } from "./lib/noteSafety";
  import { byteOffsetToUtf16, debounce, RenderGuard } from "./lib/render";
  import { m } from "./paraglide/messages.js";
  import type { RenderDiagnostic, SearchHit, TreeNode } from "./bindings";

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
  let searchQuery = $state("");
  let searchHits = $state<SearchHit[]>([]);
  let searchTouched = $state(false);
  let searchPending = $state(false);
  let recentNotes = $state<string[]>([]);
  let recentPending = $state(false);
  let recentError = $state("");
  let templatePending = $state(false);
  let rendering = $state(false);
  let exporting = $state(false);
  let viewMode = $state<NoteView>("split");
  let savePhase = $state<SavePhase>("saved");
  let conflict = $state(false);
  let reloadArmed = $state(false);
  let saveFailed = $state(false);
  let leaveApproved = $state(false);

  let editor: EditorHandle | undefined;
  let nameInput: HTMLInputElement | undefined = $state();
  let sourceText = "";
  let noteEpoch = 0;
  let noteRevision = 0;
  let saveSerial = 0;
  let saveChain: Promise<void> = Promise.resolve();
  let heldPlace: EditorPlace = { ...EDITOR_PLACE_START };
  let pendingJump: number | null = null;
  const guard = new RenderGuard();
  const autosave = createAutosaveTimer(AUTOSAVE_WAIT_MS);

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
      exportPdf: m.export_pdf(),
      exportingPdf: m.exporting_pdf(),
      exportedPdf: m.exported_pdf(),
      exportFailed: m.export_failed(),
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
      searchLabel: m.search_label(),
      searchPlaceholder: m.search_placeholder(),
      searchEmpty: m.search_empty(),
      searchFailed: m.search_failed(),
      searchSearching: m.search_searching(),
      viewSwitch: m.view_switch(),
      viewSource: m.view_source(),
      viewRendered: m.view_rendered(),
      viewSplit: m.view_split(),
      saveStateSaved: m.save_state_saved(),
      saveStateSaving: m.save_state_saving(),
      saveStateUnsaved: m.save_state_unsaved(),
      saveStateConflict: m.save_state_conflict(),
      conflictBody: m.conflict_body(),
      reloadDisk: m.reload_disk(),
      reloadWarning: m.reload_warning(),
      reloadConfirm: m.reload_confirm(),
      overwriteDisk: m.overwrite_disk(),
      saveFailedBody: m.save_failed_body(),
      retrySave: m.retry_save(),
      leaveWithoutSaving: m.leave_without_saving(),
      recentNotes: m.recent_notes(),
      recentEmpty: m.recent_empty(),
      recentLoading: m.recent_loading(),
      recentFailed: m.recent_failed(),
      templatesLabel: m.templates_label(),
      templateLecture: m.template_lecture(),
      templateProblemSet: m.template_problem_set(),
      templateLab: m.template_lab(),
      templateCreated: m.template_created(),
      templateFailed: m.template_failed(),
    };
  });

  const templateChoices = $derived([
    { id: "lecture", label: labels.templateLecture },
    { id: "problem-set", label: labels.templateProblemSet },
    { id: "lab", label: labels.templateLab },
  ]);

  const saveStateLabel = $derived(
    conflict
      ? labels.saveStateConflict
      : savePhase === "saving"
        ? labels.saveStateSaving
        : savePhase === "unsaved"
          ? labels.saveStateUnsaved
          : labels.saveStateSaved,
  );

  const hasError = $derived(diagnostics.some((d) => d.severity === "error"));

  function phaseNow(): SavePhase {
    return savePhase;
  }

  function currentOpen(): OpenNote | null {
    if (!currentPath) return null;
    return { id: noteEpoch, path: currentPath, revision: noteRevision };
  }

  function currentTicket(): SaveTicket {
    const text = editor?.getText() ?? sourceText;
    sourceText = text;
    return {
      id: noteEpoch,
      path: currentPath,
      revision: noteRevision,
      text,
    };
  }

  function scheduleAutosave() {
    if (conflict || !currentPath) return;
    const ticket = currentTicket();
    autosave.schedule(ticket, (pending) => {
      void enqueueSave(pending, "auto");
    });
  }

  function enqueueSave(ticket: SaveTicket, origin: SaveOrigin): Promise<void> {
    const run = saveChain.then(() => runSave(ticket, origin));
    saveChain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  async function runSave(ticket: SaveTicket, origin: SaveOrigin) {
    if (!shouldRunSave(currentOpen(), ticket, conflict, savePhase, origin))
      return;
    const serial = ++saveSerial;
    const phaseBefore = savePhase;
    savePhase = "saving";
    try {
      await api.saveNote(ticket.path, ticket.text, origin === "force");
      const openNow = currentOpen();
      if (
        !shouldApplySaveResult(openNow, ticket, serial, saveSerial) ||
        !openNow
      )
        return;
      conflict = false;
      reloadArmed = false;
      saveFailed = false;
      if (
        savedTextIsCurrent(openNow, ticket, editor?.getText() ?? sourceText)
      ) {
        sourceText = ticket.text;
        savePhase = "saved";
        if (origin !== "auto") status = labels.saved;
      } else {
        savePhase = "unsaved";
        scheduleAutosave();
      }
    } catch (error) {
      const openNow = currentOpen();
      if (!shouldApplySaveResult(openNow, ticket, serial, saveSerial)) return;
      if (isExternalChange(error)) {
        conflict = true;
        reloadArmed = false;
        autosave.cancel();
        const textNow = editor?.getText() ?? sourceText;
        const stillThatWrite =
          openNow !== null && savedTextIsCurrent(openNow, ticket, textNow);
        savePhase =
          stillThatWrite && phaseBefore !== "unsaved" ? "saved" : "unsaved";
        return;
      }
      savePhase = "unsaved";
      saveFailed = true;
      status = `${labels.saveFailed}: ${String(error)}`;
    }
  }

  async function settleBeforeLeave(): Promise<boolean> {
    if (!currentPath) return true;
    if (leaveApproved) {
      leaveApproved = false;
      autosave.cancel();
      return true;
    }
    autosave.cancel();
    await saveChain;
    if (conflict) return false;
    if (phaseNow() !== "saved") {
      await enqueueSave(currentTicket(), "manual");
    }
    return !conflict && phaseNow() === "saved";
  }

  function leaveWithoutSaving() {
    // The next settleBeforeLeave lets one switch or close through.
    leaveApproved = true;
    saveFailed = false;
    status = "";
  }

  function applyLoadedNote(note: { path: string; text: string }) {
    noteEpoch += 1;
    noteRevision = 0;
    conflict = false;
    reloadArmed = false;
    saveFailed = false;
    leaveApproved = false;
    autosave.cancel();
    savePhase = "saved";
    currentPath = note.path;
    sourceText = note.text;
    heldPlace = { ...EDITOR_PLACE_START };
    pendingJump = null;
    editor?.setText(note.text);
  }

  function captureEditorPlace() {
    if (!editor) return;
    heldPlace = editor.getPlace();
    sourceText = editor.getText();
  }

  function setView(next: NoteView) {
    if (next === viewMode) return;
    const enteringSource = !showsSource(viewMode) && showsSource(next);
    if (showsSource(viewMode) && !showsSource(next)) captureEditorPlace();
    viewMode = next;
    if (!enteringSource) return;
    queueMicrotask(() => {
      editor?.restorePlace(heldPlace);
      if (pendingJump !== null && editor) {
        editor.setSelection(pendingJump);
        editor.focus();
        pendingJump = null;
      }
    });
  }

  async function runRender() {
    if (!currentPath) return;
    const revision = guard.next();
    const source = editor?.getText() ?? sourceText;
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
    noteEpoch += 1;
    noteRevision = 0;
    conflict = false;
    reloadArmed = false;
    saveFailed = false;
    leaveApproved = false;
    autosave.cancel();
    savePhase = "saved";
    currentPath = "";
    sourceText = "";
    heldPlace = { ...EDITOR_PLACE_START };
    pendingJump = null;
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

  async function refreshRecent() {
    recentPending = true;
    recentError = "";
    try {
      recentNotes = await api.listRecentNotes();
    } catch (error) {
      recentNotes = [];
      recentError = `${labels.recentFailed}: ${String(error)}`;
    } finally {
      recentPending = false;
    }
  }

  async function refreshTree() {
    tree = await api.listTree();
    // Tree changes can remove or rename a note a hit points at.
    searchHits = [];
    searchTouched = false;
    await refreshRecent();
  }

  async function openFolder() {
    const left = await settleBeforeLeave();
    if (!left) return;
    try {
      const picked = await api.openWorkspace();
      if (!picked) return;
      rootName = picked.root_name;
      searchQuery = "";
      searchHits = [];
      searchTouched = false;
      searchPending = false;
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

  const runSearch = debounce(() => {
    const query = searchQuery;
    if (!query.trim()) {
      searchPending = false;
      return;
    }
    searchPending = true;
    void (async () => {
      try {
        const hits = await api.searchNotes(query);
        if (searchQuery !== query) return;
        searchHits = hits;
        searchTouched = true;
      } catch (error) {
        if (searchQuery !== query) return;
        searchHits = [];
        status = `${labels.searchFailed}: ${String(error)}`;
      } finally {
        if (searchQuery === query) searchPending = false;
      }
    })();
  }, 200);

  function onSearchInput(value: string) {
    searchQuery = value;
    if (!value.trim()) {
      searchHits = [];
      searchTouched = false;
      searchPending = false;
    }
    runSearch();
  }

  async function openNote(path: string) {
    if (path === currentPath) return;
    const left = await settleBeforeLeave();
    if (!left) return;
    try {
      const note = await api.openNote(path);
      // Typing that landed while Rust read the note is saved first.
      if (!(await settleBeforeLeave())) return;
      setPages([]);
      diagnostics = [];
      applyLoadedNote(note);
      await runRender();
      await refreshRecent();
    } catch (error) {
      status = `${labels.openFailed}: ${String(error)}`;
    }
  }

  async function createFromTemplate(template: string) {
    if (!rootName || templatePending) return;
    const left = await settleBeforeLeave();
    if (!left) return;
    templatePending = true;
    try {
      const note = await api.createFromTemplate(selectedFolder, template);
      if (!(await settleBeforeLeave())) return;
      await refreshTree();
      setPages([]);
      diagnostics = [];
      applyLoadedNote(note);
      await runRender();
      status = `${labels.templateCreated}: ${note.path}`;
    } catch (error) {
      status = `${labels.templateFailed}: ${String(error)}`;
    } finally {
      templatePending = false;
    }
  }

  async function createSample() {
    const left = await settleBeforeLeave();
    if (!left) return;
    try {
      const note = await api.createSampleNote();
      if (!(await settleBeforeLeave())) return;
      await refreshTree();
      applyLoadedNote(note);
      await runRender();
    } catch (error) {
      status = `${labels.openFailed}: ${String(error)}`;
    }
  }

  async function createEntry(kind: "note" | "folder") {
    const name = entryName.trim();
    if (!name || !rootName) return;
    if (kind === "note") {
      const left = await settleBeforeLeave();
      if (!left) return;
    }
    try {
      if (kind === "note") {
        const note = await api.createNote(selectedFolder, name);
        if (!(await settleBeforeLeave())) return;
        entryName = "";
        await refreshTree();
        if (selectedFolder && !openFolders.includes(selectedFolder)) {
          openFolders = [...openFolders, selectedFolder];
        }
        setPages([]);
        diagnostics = [];
        applyLoadedNote(note);
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
    if (wasOpen) {
      const left = await settleBeforeLeave();
      if (!left) return;
    }
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
    const removingOpen = noteWasRemoved(path);
    if (removingOpen) autosave.cancel();
    try {
      if (removingOpen) await saveChain;
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
      if (currentPath && savePhase === "unsaved" && !conflict)
        scheduleAutosave();
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
    if (!currentPath) return;
    autosave.cancel();
    await enqueueSave(currentTicket(), "manual");
  }

  function requestReload() {
    if (savePhase === "unsaved") {
      reloadArmed = true;
      return;
    }
    void reloadFromDisk();
  }

  async function reloadFromDisk() {
    if (!currentPath) return;
    const path = currentPath;
    const epoch = noteEpoch;
    autosave.cancel();
    await saveChain;
    if (epoch !== noteEpoch || currentPath !== path) return;
    try {
      const note = await api.openNote(path);
      if (epoch !== noteEpoch || currentPath !== path) return;
      setPages([]);
      diagnostics = [];
      applyLoadedNote(note);
      await runRender();
    } catch (error) {
      status = `${labels.openFailed}: ${String(error)}`;
    }
  }

  async function overwriteFromEditor() {
    if (!currentPath) return;
    autosave.cancel();
    await enqueueSave(currentTicket(), "force");
  }

  async function onWindowFocus() {
    if (!currentPath || conflict || phaseNow() === "saving") return;
    const path = currentPath;
    const epoch = noteEpoch;
    try {
      const changed = await api.noteChangedOnDisk(path);
      if (
        epoch !== noteEpoch ||
        currentPath !== path ||
        conflict ||
        phaseNow() === "saving"
      ) {
        return;
      }
      if (changed) {
        conflict = true;
        reloadArmed = false;
        autosave.cancel();
      }
    } catch (error) {
      if (epoch !== noteEpoch || currentPath !== path) return;
      status = `${labels.actionFailed}: ${String(error)}`;
    }
  }

  // Closing the window first writes typing still inside the autosave
  // pause. A conflict or a failed save keeps the window open, where the
  // banners above the editor offer the way out.
  $effect(() => {
    let unlisten: (() => void) | undefined;
    let disposed = false;
    try {
      void getCurrentWindow()
        .onCloseRequested(async (event) => {
          event.preventDefault();
          if (await settleBeforeLeave()) {
            await getCurrentWindow().destroy();
          }
        })
        .then((fn) => {
          if (disposed) fn();
          else unlisten = fn;
        })
        .catch(() => undefined);
    } catch {
      // Outside Tauri (a plain browser preview) there is no window to guard.
    }
    return () => {
      disposed = true;
      unlisten?.();
    };
  });

  async function exportPdf() {
    if (!currentPath || exporting) return;
    const path = currentPath;
    const source = editor?.getText() ?? sourceText;
    exporting = true;
    status = labels.exportingPdf;
    try {
      const written = await api.exportPdf(path, source);
      status = `${labels.exportedPdf}: ${written}`;
    } catch (error) {
      status = `${labels.exportFailed}: ${String(error)}`;
    } finally {
      exporting = false;
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
    const source = editor?.getText() ?? sourceText;
    const position = byteOffsetToUtf16(source, diagnostic.start);
    if (!showsSource(viewMode)) {
      pendingJump = position;
      setView("split");
      return;
    }
    editor?.setSelection(position);
    editor?.focus();
  }

  function onEditorChange(text: string) {
    sourceText = text;
    if (!currentPath) return;
    noteRevision += 1;
    savePhase = "unsaved";
    if (!conflict) scheduleAutosave();
    scheduleRender();
  }

  function editorAttachment(node: HTMLDivElement) {
    editor = createEditor(node, sourceText, onEditorChange);
    editor.restorePlace(heldPlace);
    return () => {
      if (editor) {
        heldPlace = editor.getPlace();
        sourceText = editor.getText();
      }
      editor?.destroy();
      editor = undefined;
    };
  }
</script>

<svelte:window onkeydown={onConfirmKey} onfocus={onWindowFocus} />

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
      <button
        type="button"
        onclick={exportPdf}
        disabled={!currentPath || exporting}
      >
        {labels.exportPdf}
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
          class="search-form"
          role="search"
          aria-busy={searchPending}
          onsubmit={(event) => event.preventDefault()}
        >
          <label>
            <span>{labels.searchLabel}</span>
            <input
              type="search"
              value={searchQuery}
              placeholder={labels.searchPlaceholder}
              autocomplete="off"
              spellcheck="false"
              oninput={(event) => onSearchInput(event.currentTarget.value)}
            />
          </label>
          <div aria-live="polite">
            {#if searchPending}
              <p class="muted">{labels.searchSearching}</p>
            {:else if searchTouched && searchHits.length === 0}
              <p class="muted">{labels.searchEmpty}</p>
            {/if}
          </div>
          {#if searchTouched && searchHits.length > 0}
            <ul class="search-results">
              {#each searchHits as hit (`${hit.path}:${hit.line}`)}
                <li>
                  <button
                    type="button"
                    class="search-hit"
                    onclick={() => openNote(hit.path)}
                  >
                    <span class="path-line">{hit.path}:{hit.line}</span>
                    <span class="search-snippet">{hit.snippet}</span>
                  </button>
                </li>
              {/each}
            </ul>
          {/if}
        </form>
        <section
          class="recent-block"
          aria-labelledby="recent-heading"
          aria-busy={recentPending}
        >
          <h3 id="recent-heading">{labels.recentNotes}</h3>
          {#if recentError}
            <p class="muted">{recentError}</p>
          {:else if recentPending}
            <p class="muted">{labels.recentLoading}</p>
          {:else if recentNotes.length === 0}
            <p class="muted">{labels.recentEmpty}</p>
          {:else}
            <ul class="recent-list">
              {#each recentNotes as path (path)}
                <li>
                  <button
                    type="button"
                    class="recent-hit"
                    onclick={() => openNote(path)}
                  >
                    {path}
                  </button>
                </li>
              {/each}
            </ul>
          {/if}
        </section>
        <section class="template-block" aria-labelledby="templates-heading">
          <h3 id="templates-heading">{labels.templatesLabel}</h3>
          <div class="row-actions">
            {#each templateChoices as template (template.id)}
              <button
                type="button"
                disabled={templatePending}
                onclick={() => createFromTemplate(template.id)}
              >
                {template.label}
              </button>
            {/each}
          </div>
        </section>
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

    <main class="stage">
      <div class="stage-bar">
        <div class="view-cluster">
          <div class="view-switch" role="group" aria-label={labels.viewSwitch}>
            <button
              type="button"
              aria-pressed={viewMode === "source"}
              onclick={() => setView("source")}
            >
              {labels.viewSource}
            </button>
            <button
              type="button"
              aria-pressed={viewMode === "split"}
              onclick={() => setView("split")}
            >
              {labels.viewSplit}
            </button>
            <button
              type="button"
              aria-pressed={viewMode === "rendered"}
              onclick={() => setView("rendered")}
            >
              {labels.viewRendered}
            </button>
          </div>
          {#if currentPath}
            <p class="path-line">{currentPath}</p>
          {/if}
        </div>
        {#if currentPath}
          <p class={["save-state", savePhase, { conflict }]} role="status">
            {saveStateLabel}
          </p>
        {/if}
      </div>

      {#if conflict}
        <section class="conflict-banner" role="alert">
          <h2>{labels.saveStateConflict}</h2>
          <p>{labels.conflictBody}</p>
          {#if reloadArmed}
            <p>{labels.reloadWarning}</p>
          {/if}
          <div class="row-actions">
            {#if reloadArmed}
              <button type="button" class="danger" onclick={reloadFromDisk}>
                {labels.reloadConfirm}
              </button>
              <button type="button" onclick={() => (reloadArmed = false)}>
                {labels.cancel}
              </button>
            {:else}
              <button type="button" onclick={requestReload}
                >{labels.reloadDisk}</button
              >
              <button
                type="button"
                class="primary"
                onclick={overwriteFromEditor}
              >
                {labels.overwriteDisk}
              </button>
            {/if}
          </div>
        </section>
      {/if}

      {#if saveFailed && !conflict}
        <section class="conflict-banner" role="alert">
          <h2>{labels.saveFailed}</h2>
          <p>{labels.saveFailedBody}</p>
          <div class="row-actions">
            <button type="button" class="primary" onclick={saveNote}>
              {labels.retrySave}
            </button>
            <button type="button" class="danger" onclick={leaveWithoutSaving}>
              {labels.leaveWithoutSaving}
            </button>
          </div>
        </section>
      {/if}

      <div class={["panes", viewMode]}>
        <section
          class="pane editor-pane"
          aria-label={labels.editor}
          hidden={!showsSource(viewMode)}
        >
          <h2>{labels.editor}</h2>
          {#if !currentPath}
            <p class="muted pad">{labels.noNote}</p>
          {/if}
          <div class="editor-host" {@attach editorAttachment}></div>
        </section>

        <section
          class="pane preview-pane"
          aria-label={labels.preview}
          hidden={!showsRendered(viewMode)}
        >
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
      </div>
    </main>
  </div>
</div>
