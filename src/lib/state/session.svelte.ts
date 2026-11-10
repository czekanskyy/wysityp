import type { EditorState } from "@codemirror/state";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type {
  RenderDiagnostic,
  SearchHit,
  SessionRestore,
  Settings,
  TreeNode,
} from "../../bindings";
import { api } from "../api";
import {
  applyDocumentTheme,
  asPageColor,
  asTheme,
  type StartupAppearance,
} from "../appearance";
import { createEditor, type EditorHandle, type EditorOptions } from "../editor";
import {
  readEditorState,
  replaceEditorText,
  writeEditorState,
} from "../editorTabs";
import { DEFAULT_RENDER_FONT, DEFAULT_SOURCE_FONT } from "../fonts";
import { applyLocale, currentLocale, type AppLocale } from "../locale";
import {
  AUTOSAVE_WAIT_MS,
  createAutosaveTimer,
  isExternalChange,
  savedTextIsCurrent,
  shouldApplySaveResult,
  shouldRunSave,
  type NoteView,
  type OpenNote,
  type SaveOrigin,
  type SavePhase,
  type SaveTicket,
} from "../noteSafety";
import { welcomeRecents } from "../recents";
import {
  byteOffsetToUtf16,
  debounce,
  preloadImage,
  RenderGuard,
  svgBlobUrl,
  svgPagesEqual,
} from "../render";
import {
  createTab,
  draftIsDisposable,
  fileName,
  findTabByKey,
  keyWasRemoved,
  moveItem,
  neighborIndex,
  pathsMatch,
  retargetKey,
  sessionToken,
  storedEditorMatches,
  tabTitle,
  type TabKind,
  type TabModel,
} from "../tabs";
import { m } from "../../paraglide/messages.js";
import type { SegmentOptions, SidebarItem, SidebarSection } from "../ui";

export type NewChoice = {
  kind: "blank" | "shipped" | "user";
  label: string;
  stem: string;
  secondary: string;
};

type PageCache = {
  svgs: string[];
  urls: string[];
  diagnostics: RenderDiagnostic[];
};

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * One window: the open folder, the tabs, and the single editor.
 * EditorState values stay in a plain map. A Svelte proxy would break them.
 */
export class Session {
  locale = $state<AppLocale>(currentLocale());
  theme = $state(asTheme("system"));
  pageColor = $state(asPageColor("white"));
  sourceFont = $state(DEFAULT_SOURCE_FONT);
  renderFont = $state(DEFAULT_RENDER_FONT);
  appearanceOpen = $state(false);
  appearanceTrigger = $state<HTMLElement | null>(null);
  rootName = $state("");
  tree = $state.raw<TreeNode[]>([]);
  openFolders = $state<string[]>([]);
  selectedFolder = $state("");
  entryName = $state("");
  renamingPath = $state("");
  renameValue = $state("");
  pendingDelete = $state("");
  shippedStems = $state<string[]>([]);
  yourTemplates = $state<string[]>([]);
  templateFolderReady = $state(true);
  pageUrls = $state<string[]>([]);
  diagnostics = $state<RenderDiagnostic[]>([]);
  status = $state("");
  searchQuery = $state("");
  searchHits = $state<SearchHit[]>([]);
  searchTouched = $state(false);
  searchPending = $state(false);
  recentNotes = $state<string[]>([]);
  recentPending = $state(false);
  recentError = $state("");
  templatePending = $state(false);
  exporting = $state(false);
  viewMode = $state<NoteView>("rendered");
  namingFolder = $state(false);
  recentExpanded = $state(true);
  notesExpanded = $state(true);
  sidebarCollapsed = $state(false);
  newNoteOpen = $state(false);
  highlight = $state(0);
  tabs = $state<TabModel[]>([]);
  activeId = $state(0);

  private pendingStartupError = "";
  private started = false;
  private nextId = 0;
  private saveSerial = 0;
  private saveChain: Promise<void> = Promise.resolve();
  private gate: Promise<void> = Promise.resolve();
  private pendingJump: number | null = null;
  private persistTimer: ReturnType<typeof setTimeout> | undefined;
  // EditorState breaks if a Svelte proxy wraps it. The page cache and the
  // leave set are not read by the template; the visible fields are $state.
  // eslint-disable-next-line svelte/prefer-svelte-reactivity
  private readonly editorStates = new Map<number, EditorState>();
  // eslint-disable-next-line svelte/prefer-svelte-reactivity
  private readonly pages = new Map<number, PageCache>();
  // eslint-disable-next-line svelte/prefer-svelte-reactivity
  private readonly leaveApproved = new Set<number>();
  private readonly guard = new RenderGuard();
  private readonly autosave = createAutosaveTimer(AUTOSAVE_WAIT_MS);
  private readonly scheduleRender: () => void;
  private readonly scheduleSearch: () => void;
  editor: EditorHandle | undefined;
  readonly attachEditor = (node: HTMLDivElement): (() => void) =>
    this.editorAttachment(node);

  constructor(startup: StartupAppearance) {
    this.theme = startup.theme;
    this.pageColor = startup.pageColor;
    this.sourceFont = startup.sourceFont || DEFAULT_SOURCE_FONT;
    this.renderFont = startup.renderFont || DEFAULT_RENDER_FONT;
    this.pendingStartupError = startup.error;
    this.scheduleRender = debounce(() => void this.runRender(), 350);
    this.scheduleSearch = debounce(() => this.runSearch(), 200);
    this.watchStartup();
  }

  get active(): TabModel | undefined {
    return this.tabs.find((tab) => tab.id === this.activeId);
  }

  get labels() {
    void this.locale;
    return {
      appName: m.app_name(),
      openFolder: m.open_folder(),
      openFolderShort: m.open_folder_short(),
      openNote: m.open_note(),
      createSample: m.create_sample(),
      saveNote: m.save_note(),
      language: m.language(),
      noFolder: m.no_folder(),
      editor: m.editor_label(),
      preview: m.preview_label(),
      diagnostics: m.diagnostics_label(),
      noDiagnostics: m.no_diagnostics(),
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
      blankNote: m.blank_note(),
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
      moveHint: m.move_hint(),
      actionFailed: m.action_failed(),
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
      welcomeRecent: m.welcome_recent(),
      untitled: m.untitled(),
      newNoteHint: m.new_note_hint(),
      tabClose: m.tab_close(),
      sidebarCollapse: m.sidebar_collapse(),
      sidebarExpand: m.sidebar_expand(),
      templateLecture: m.template_lecture(),
      templateProblemSet: m.template_problem_set(),
      templateLab: m.template_lab(),
      templateDefinitions: m.template_definitions(),
      templateProof: m.template_proof(),
      templateExample: m.template_example(),
      templateReview: m.template_review(),
      templateReading: m.template_reading(),
      templateProject: m.template_project(),
      templateFormulas: m.template_formulas(),
      templateGroupShipped: m.template_group_shipped(),
      templateGroupYours: m.template_group_yours(),
      templateFolderUnavailable: m.template_folder_unavailable(),
      templateNamesExhausted: m.template_names_exhausted(),
      noteNamesExhausted: m.note_names_exhausted(),
      draftNamesExhausted: m.draft_names_exhausted(),
      imageRefused: m.image_refused(),
      pdfNeedsNote: m.pdf_needs_note(),
      templateStartNote: m.template_start_note(),
      templateMakeCopy: m.template_make_copy(),
      templateEditFile: m.template_edit_file(),
      templateCreated: m.template_created(),
      templateFailed: m.template_failed(),
      notesHeading: m.notes_heading(),
      rowMenu: m.row_menu(),
      appearanceLabel: m.appearance_label(),
      themeLabel: m.theme_label(),
      themeHint: m.theme_hint(),
      themeSystem: m.theme_system(),
      themeLight: m.theme_light(),
      themeDark: m.theme_dark(),
      pageColorLabel: m.page_color_label(),
      pageColorHint: m.page_color_hint(),
      pageWhite: m.page_white(),
      pageBeige: m.page_beige(),
      pageGraphite: m.page_graphite(),
      pageOled: m.page_oled(),
      appearancePreview: m.appearance_preview(),
      appearanceClose: m.appearance_close(),
      sourceFontLabel: m.source_font_label(),
      sourceFontHint: m.source_font_hint(),
      renderFontLabel: m.render_font_label(),
      renderFontHint: m.render_font_hint(),
      fontOtherLabel: m.font_other(),
      fontOtherHint: m.font_other_hint(),
    };
  }

  get viewOptions(): SegmentOptions {
    return [
      { value: "source", label: this.labels.viewSource },
      { value: "split", label: this.labels.viewSplit },
      { value: "rendered", label: this.labels.viewRendered },
    ];
  }

  get workspaceMark(): string {
    const source = this.rootName || this.labels.appName;
    return Array.from(source)[0] ?? "";
  }

  get saveStateLabel(): string {
    const tab = this.active;
    if (!tab) return this.labels.saveStateSaved;
    if (tab.conflict) return this.labels.saveStateConflict;
    if (tab.savePhase === "saving") return this.labels.saveStateSaving;
    if (tab.savePhase === "unsaved") return this.labels.saveStateUnsaved;
    return this.labels.saveStateSaved;
  }

  get savePhase(): SavePhase {
    return this.active?.savePhase ?? "saved";
  }

  get hasError(): boolean {
    return this.diagnostics.some((item) => item.severity === "error");
  }

  get welcomeItems(): string[] {
    return welcomeRecents(this.recentNotes);
  }

  get choices(): NewChoice[] {
    const labels = this.labels;
    const shipped = this.shippedStems.map((stem) => ({
      kind: "shipped" as const,
      label: this.shippedTitle(stem),
      stem,
      secondary: labels.templateMakeCopy,
    }));
    const yours = this.yourTemplates.map((name) => ({
      kind: "user" as const,
      label: name,
      stem: name,
      secondary: labels.templateEditFile,
    }));
    return [
      { kind: "blank", label: labels.blankNote, stem: "", secondary: "" },
      ...shipped,
      ...yours,
    ];
  }

  get showFollow(): boolean {
    return (
      (this.rootName !== "" && (this.searchPending || this.searchTouched)) ||
      this.namingFolder ||
      this.renamingPath !== "" ||
      this.pendingDelete !== "" ||
      this.status !== ""
    );
  }

  get sidebarModel(): { sections: SidebarSection[]; items: SidebarItem[] } {
    const notes: SidebarItem[] = [];
    const walk = (nodes: TreeNode[], level: number) => {
      for (const node of nodes) {
        const isFolder = node.kind === "folder";
        const expanded = isFolder && this.openFolders.includes(node.path);
        notes.push({
          id: node.path,
          sectionId: "notes",
          label: node.name,
          title: node.path,
          level,
          kind: isFolder ? "folder" : "note",
          expanded: isFolder ? expanded : undefined,
          selected: isFolder && this.selectedFolder === node.path,
          current: !isFolder && this.tabIsCurrent(node.path),
          unsaved: !isFolder && this.tabIsDirty(node.path),
          count: isFolder ? node.children.length : undefined,
          ...this.entryMenu(node.path, node.name),
        });
        if (isFolder && expanded) walk(node.children, level + 1);
      }
    };
    if (this.rootName) walk(this.tree, 1);

    const recentReady = !this.recentPending && this.recentError === "";
    const recent: SidebarItem[] = recentReady
      ? this.recentNotes.map((path) => ({
          id: path,
          sectionId: "recent",
          label: fileName(path),
          title: path,
          level: 1,
          kind: "note" as const,
          current: this.tabIsCurrent(path),
          unsaved: this.tabIsDirty(path),
        }))
      : [];

    let notice: string | undefined;
    if (this.recentError) notice = this.recentError;
    else if (this.recentPending) notice = this.labels.recentLoading;
    else if (this.recentNotes.length === 0) notice = this.labels.recentEmpty;

    const sections: SidebarSection[] = [
      {
        id: "recent",
        title: this.labels.recentNotes,
        expanded: this.recentExpanded,
        onToggle: () => {
          this.recentExpanded = !this.recentExpanded;
        },
        notice,
        busy: this.recentPending,
      },
      {
        id: "notes",
        title: this.labels.notesHeading,
        expanded: this.notesExpanded,
        onToggle: () => {
          this.notesExpanded = !this.notesExpanded;
        },
        action: {
          label: this.labels.newFolder,
          disabled: this.rootName === "",
          onclick: () => this.openNameField(),
        },
      },
    ];
    return { sections, items: [...recent, ...notes] };
  }

  get footerEntries(): { label: string; onclick: () => void }[] {
    const entries: { label: string; onclick: () => void }[] = [
      { label: this.labels.openFolder, onclick: () => void this.openFolder() },
    ];
    if (this.rootName) {
      entries.push({
        label: this.labels.createSample,
        onclick: () => void this.createSample(),
      });
    }
    entries.push({
      label: this.labels.appearanceLabel,
      onclick: () => this.openAppearance(),
    });
    return entries;
  }

  editorAttachment(node: HTMLDivElement): () => void {
    const tabId = this.activeId;
    const initial = this.active?.text ?? "";
    const editor = createEditor(
      node,
      initial,
      (text) => this.onEditorChange(text),
      this.editorOptions(),
    );
    this.editor = editor;
    const saved = tabId ? this.editorStates.get(tabId) : undefined;
    if (saved && storedEditorMatches(saved.doc.toString(), initial)) {
      writeEditorState(editor, saved);
    } else if (tabId && saved) {
      this.editorStates.delete(tabId);
    }
    this.applyEditorChrome();
    this.rememberEditor(tabId);
    if (this.pendingJump !== null) {
      editor.setSelection(this.pendingJump);
      this.pendingJump = null;
    }
    this.focusEditor();
    void this.runRender();
    return () => {
      if (this.activeId === tabId) this.snapshotActive();
      if (this.editor === editor) {
        editor.destroy();
        this.editor = undefined;
      }
    };
  }

  onEditorChange(text: string): void {
    const tab = this.active;
    if (!tab || !this.editor) return;
    this.patch(tab.id, {
      text,
      revision: tab.revision + 1,
      dirty: true,
      savePhase: "unsaved",
    });
    this.editorStates.set(tab.id, readEditorState(this.editor));
    if (!tab.conflict) this.scheduleAutosave();
    this.scheduleRender();
  }

  tabLabel(tab: TabModel): string {
    return tabTitle(tab.kind, tab.key, this.labels.untitled);
  }

  requestNewNote(): Promise<void> {
    return this.run(async () => {
      if (this.newNoteOpen) return;
      if (!this.rootName) {
        await this.createDraft();
        return;
      }
      await this.refreshTemplates();
      this.highlight = 0;
      this.newNoteOpen = true;
    });
  }

  closeNewNote(): void {
    this.newNoteOpen = false;
  }

  moveHighlight(delta: number): void {
    const count = this.choices.length;
    if (count === 0) return;
    this.highlight = (this.highlight + delta + count) % count;
  }

  confirmNewNote(): Promise<void> {
    return this.run(async () => {
      const choice = this.choices[this.highlight];
      if (!choice) return;
      this.newNoteOpen = false;
      if (choice.kind === "blank") await this.createBlankNote();
      else if (choice.kind === "shipped") {
        await this.createFromTemplate("shipped", choice.stem);
      } else {
        await this.createFromTemplate("user", choice.stem);
      }
    });
  }

  secondaryChoice(index: number): Promise<void> {
    return this.run(async () => {
      const choice = this.choices[index];
      if (!choice || choice.kind === "blank") return;
      this.newNoteOpen = false;
      if (choice.kind === "shipped")
        await this.copyShippedTemplate(choice.stem);
      else await this.editYourTemplate(choice.stem);
    });
  }

  openLoose(): Promise<void> {
    return this.run(() => this.openLooseNow());
  }

  openFolder(): Promise<void> {
    return this.run(() => this.openFolderNow());
  }

  openNote(path: string): Promise<void> {
    return this.run(() => this.openNoteNow(path));
  }

  focusTab(id: number): Promise<void> {
    return this.run(() => this.focusTabNow(id));
  }

  closeTab(id: number): Promise<void> {
    return this.run(() => this.closeTabNow(id));
  }

  cycleTabs(backward: boolean): Promise<void> {
    return this.run(async () => {
      const index = this.tabs.findIndex((tab) => tab.id === this.activeId);
      const next = this.tabs[this.cycle(index, backward)];
      if (!next || next.id === this.activeId) return;
      await this.focusTabNow(next.id);
    });
  }

  reorderTabs(from: number, to: number): void {
    this.tabs = moveItem(this.tabs, from, to);
    this.persist();
  }

  toggleSidebar(): void {
    this.sidebarCollapsed = !this.sidebarCollapsed;
  }

  saveActive(): Promise<void> {
    return this.run(() => this.saveActiveNow(true));
  }

  setView(next: NoteView): void {
    if (next === this.viewMode) return;
    this.viewMode = next;
    this.editor?.setRendered(next !== "source");
    if (this.pendingJump !== null && this.editor) {
      this.editor.setSelection(this.pendingJump);
      this.editor.focus();
      this.pendingJump = null;
    }
  }

  jumpToDiagnostic(diagnostic: RenderDiagnostic): void {
    const tab = this.active;
    if (!tab) return;
    const path = this.renderPath(tab);
    if (
      diagnostic.file !== "" &&
      diagnostic.file !== path &&
      !pathsMatch(diagnostic.file, path)
    ) {
      return;
    }
    const source = this.editor?.getText() ?? tab.text;
    const position = byteOffsetToUtf16(source, diagnostic.start);
    if (!this.editor) {
      this.pendingJump = position;
      return;
    }
    this.editor.setSelection(position);
    this.editor.focus();
  }

  requestReload(): void {
    if (this.active?.savePhase === "unsaved") {
      this.patch(this.active.id, { reloadArmed: true });
      return;
    }
    void this.run(() => this.reloadFromDisk());
  }

  cancelReload(): void {
    if (this.active) this.patch(this.active.id, { reloadArmed: false });
  }

  reloadFromDisk(): Promise<void> {
    return this.run(() => this.reloadActive());
  }

  overwriteFromEditor(): Promise<void> {
    return this.run(async () => {
      const ticket = this.ticketFor(this.active);
      if (!ticket) return;
      this.autosave.cancel();
      await this.enqueueSave(ticket, "force");
    });
  }

  leaveWithoutSaving(): void {
    const tab = this.active;
    if (!tab) return;
    this.leaveApproved.add(tab.id);
    this.patch(tab.id, { saveFailed: false });
    this.status = "";
  }

  exportPdf(): Promise<void> {
    return this.run(() => this.exportPdfNow());
  }

  openAppearance(): void {
    const active = document.activeElement;
    this.appearanceTrigger = active instanceof HTMLElement ? active : null;
    this.appearanceOpen = true;
  }

  closeAppearance(): void {
    this.appearanceOpen = false;
  }

  applyAppearance(saved: Settings): void {
    this.theme = asTheme(saved.theme);
    this.pageColor = asPageColor(saved.page_color);
    this.sourceFont = saved.source_font || DEFAULT_SOURCE_FONT;
    this.renderFont = saved.render_font || DEFAULT_RENDER_FONT;
    applyDocumentTheme(this.theme);
    this.editor?.setFonts({
      source: this.sourceFont,
      render: this.renderFont,
    });
  }

  appearanceFailed(error: unknown): void {
    this.status = `${this.labels.saveFailed}: ${messageOf(error)}`;
  }

  changeLocale(next: AppLocale): Promise<void> {
    return this.run(async () => {
      try {
        const saved = await api.setLocale(next);
        this.locale = saved.locale === "en" ? "en" : "pl";
        applyLocale(this.locale);
        await this.refreshTemplates();
      } catch (error) {
        this.status = `${this.labels.saveFailed}: ${messageOf(error)}`;
      }
    });
  }

  onSearchInput(value: string): void {
    if (!this.rootName) return;
    this.searchQuery = value;
    if (!value.trim()) {
      this.searchHits = [];
      this.searchTouched = false;
      this.searchPending = false;
    }
    this.scheduleSearch();
  }

  toggleFolder(path: string): void {
    this.openFolders = this.openFolders.includes(path)
      ? this.openFolders.filter((folder) => folder !== path)
      : [...this.openFolders, path];
  }

  chooseFolder(path: string): void {
    this.selectedFolder = path;
    if (!this.openFolders.includes(path)) {
      this.openFolders = [...this.openFolders, path];
    }
  }

  clearPlace(): void {
    this.selectedFolder = "";
  }

  openNameField(): void {
    if (!this.rootName) return;
    this.namingFolder = true;
    this.entryName = "";
    this.renamingPath = "";
    this.pendingDelete = "";
    this.sidebarCollapsed = false;
  }

  cancelNewFolder(): void {
    this.namingFolder = false;
    this.entryName = "";
  }

  submitNewFolder(): Promise<void> {
    return this.run(() => this.submitNewFolderNow());
  }

  startRename(path: string): void {
    this.renamingPath = path;
    this.renameValue = path;
    this.pendingDelete = "";
    this.namingFolder = false;
    this.sidebarCollapsed = false;
  }

  cancelRename(): void {
    this.renamingPath = "";
  }

  applyRename(): Promise<void> {
    return this.run(() => this.applyRenameNow());
  }

  askDelete(path: string): void {
    this.pendingDelete = path;
    this.renamingPath = "";
    this.namingFolder = false;
    this.sidebarCollapsed = false;
  }

  closeDelete(): void {
    this.pendingDelete = "";
  }

  confirmDelete(): Promise<void> {
    return this.run(() => this.confirmDeleteNow());
  }

  onWindowFocus(): Promise<void> {
    return this.checkExternalChange();
  }

  onWindowBlur(): void {
    this.snapshotActive();
    const tab = this.active;
    if (!tab || tab.conflict || tab.savePhase === "saved") return;
    const pending = this.autosave.take();
    const ticket = pending ?? this.ticketFor(tab);
    if (ticket) void this.enqueueSave(ticket, "auto");
  }

  onWindowKey(event: KeyboardEvent): void {
    if (this.newNoteOpen) {
      if (event.key === "Escape") {
        event.preventDefault();
        this.closeNewNote();
      } else if (event.key === "Enter") {
        event.preventDefault();
        void this.confirmNewNote();
      } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        this.moveHighlight(event.key === "ArrowDown" ? 1 : -1);
      }
      return;
    }
    if (event.key === "Escape" && this.pendingDelete) {
      event.preventDefault();
      this.closeDelete();
      return;
    }
    if (!event.ctrlKey || event.altKey || event.metaKey) return;
    if (event.code === "KeyN" && !event.shiftKey) {
      event.preventDefault();
      void this.requestNewNote();
    } else if (event.code === "KeyO" && event.shiftKey) {
      event.preventDefault();
      void this.openFolder();
    } else if (event.code === "KeyO" && !event.shiftKey) {
      event.preventDefault();
      void this.openLoose();
    } else if (event.code === "KeyS" && !event.shiftKey) {
      event.preventDefault();
      void this.saveActive();
    } else if (event.code === "KeyW" && !event.shiftKey) {
      event.preventDefault();
      if (this.active) void this.closeTab(this.active.id);
    } else if (event.code === "Backslash" && !event.shiftKey) {
      event.preventDefault();
      this.toggleSidebar();
    } else if (event.code === "Tab") {
      event.preventDefault();
      void this.cycleTabs(event.shiftKey);
    }
  }

  private watchStartup(): void {
    $effect(() => {
      if (this.pendingStartupError === "") return;
      this.status = `${this.labels.openFailed}: ${this.pendingStartupError}`;
      this.pendingStartupError = "";
    });
    $effect(() => {
      if (this.started) return;
      this.started = true;
      void this.boot();
      return this.listenForClose();
    });
  }

  private listenForClose(): () => void {
    let unlisten: (() => void) | undefined;
    let disposed = false;
    try {
      void getCurrentWindow()
        .onCloseRequested(async (event) => {
          event.preventDefault();
          const ok = await this.run(() => this.settleAll());
          if (!ok) return;
          await this.writeSession();
          await getCurrentWindow().destroy();
        })
        .then((fn) => {
          if (disposed) fn();
          else unlisten = fn;
        })
        .catch(() => undefined);
    } catch {
      // A plain browser preview has no Tauri window.
    }
    return () => {
      disposed = true;
      unlisten?.();
    };
  }

  private async boot(): Promise<void> {
    await this.refreshTemplates();
    await this.refreshRecents();
    if (this.tabs.length > 0) return;
    try {
      this.installRestored(await api.restoreSession());
    } catch {
      // A broken session opens the welcome page and shows no error.
    }
  }

  private installRestored(restored: SessionRestore): void {
    if (this.tabs.length > 0) return;
    const untitled = this.labels.untitled;
    const tabs = restored.files.map((file) => {
      this.nextId += 1;
      const kind: TabKind = file.template
        ? "template"
        : file.draft
          ? "draft"
          : "note";
      return createTab(this.nextId, kind, file.path, file.text, untitled);
    });
    this.tabs = tabs;
    const active =
      tabs.find(
        (tab) =>
          sessionToken(tab).toLowerCase() === restored.active.toLowerCase(),
      ) ?? tabs[0];
    this.activeId = active?.id ?? 0;
  }

  private run<T>(task: () => Promise<T>): Promise<T> {
    const run = this.gate.then(task, task);
    this.gate = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private cycle(index: number, backward: boolean): number {
    const length = this.tabs.length;
    if (length <= 0) return -1;
    const current = index < 0 ? 0 : index;
    const step = backward ? -1 : 1;
    return (current + step + length) % length;
  }

  private tabById(id: number): TabModel | undefined {
    return this.tabs.find((tab) => tab.id === id);
  }

  private tabForTicket(ticket: SaveTicket): TabModel | undefined {
    return this.tabs.find(
      (tab) => tab.epoch === ticket.id && sessionToken(tab) === ticket.path,
    );
  }

  private patch(id: number, change: Partial<TabModel>): void {
    this.tabs = this.tabs.map((tab) =>
      tab.id === id ? { ...tab, ...change } : tab,
    );
  }

  private findNote(path: string): number {
    return this.tabs.findIndex(
      (tab) => tab.kind !== "template" && pathsMatch(tab.key, path),
    );
  }

  private tabIsCurrent(path: string): boolean {
    const tab = this.active;
    return Boolean(tab && tab.kind !== "template" && pathsMatch(tab.key, path));
  }

  private tabIsDirty(path: string): boolean {
    return this.tabs.some(
      (tab) =>
        tab.kind !== "template" &&
        pathsMatch(tab.key, path) &&
        (tab.dirty || tab.conflict || tab.savePhase !== "saved"),
    );
  }

  private entryMenu(path: string, name: string) {
    return {
      menuLabel: `${this.labels.rowMenu} ${name}`,
      menu: [
        {
          label: this.labels.renameOrMove,
          icon: "rename" as const,
          onclick: () => this.startRename(path),
        },
        {
          label: this.labels.delete,
          icon: "delete" as const,
          danger: true,
          onclick: () => this.askDelete(path),
        },
      ],
    };
  }

  private shippedTitle(stem: string): string {
    switch (stem) {
      case "lecture":
        return this.labels.templateLecture;
      case "problem-set":
        return this.labels.templateProblemSet;
      case "lab":
        return this.labels.templateLab;
      case "definitions":
        return this.labels.templateDefinitions;
      case "proof":
        return this.labels.templateProof;
      case "example":
        return this.labels.templateExample;
      case "review":
        return this.labels.templateReview;
      case "reading":
        return this.labels.templateReading;
      case "project":
        return this.labels.templateProject;
      case "formulas":
        return this.labels.templateFormulas;
      default:
        return stem;
    }
  }

  private commandStatus(error: unknown, fallback: string): string {
    const message = messageOf(error);
    if (message.startsWith("note-names-exhausted:")) {
      return this.labels.noteNamesExhausted;
    }
    if (message.startsWith("template-names-exhausted:")) {
      return this.labels.templateNamesExhausted;
    }
    if (message.startsWith("draft-names-exhausted:")) {
      return this.labels.draftNamesExhausted;
    }
    if (message.startsWith("image-refused:")) return this.labels.imageRefused;
    return `${fallback}: ${message}`;
  }

  private ticketFor(tab: TabModel | undefined): SaveTicket | null {
    if (!tab) return null;
    const text =
      tab.id === this.activeId
        ? (this.editor?.getText() ?? tab.text)
        : tab.text;
    return {
      id: tab.epoch,
      path: sessionToken(tab),
      revision: tab.revision,
      text,
    };
  }

  private scheduleAutosave(): void {
    const ticket = this.ticketFor(this.active);
    if (!ticket || this.active?.conflict) return;
    this.autosave.schedule(ticket, (pending) => {
      void this.enqueueSave(pending, "auto");
    });
  }

  private enqueueSave(ticket: SaveTicket, origin: SaveOrigin): Promise<void> {
    const run = this.saveChain.then(() => this.runSave(ticket, origin));
    this.saveChain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private async runSave(ticket: SaveTicket, origin: SaveOrigin): Promise<void> {
    const tab = this.tabForTicket(ticket);
    if (!tab) return;
    const open = this.openOf(tab);
    if (!shouldRunSave(open, ticket, tab.conflict, tab.savePhase, origin)) {
      return;
    }
    const serial = ++this.saveSerial;
    const phaseBefore = tab.savePhase;
    this.patch(tab.id, { savePhase: "saving" });
    try {
      if (tab.kind === "template") {
        await api.saveTemplate(tab.key, ticket.text, origin === "force");
      } else {
        await api.saveNote(ticket.path, ticket.text, origin === "force");
      }
      const saved = this.tabForTicket(ticket);
      if (!saved) return;
      const openNow = this.openOf(saved);
      if (!shouldApplySaveResult(openNow, ticket, serial, this.saveSerial)) {
        return;
      }
      const textNow =
        saved.id === this.activeId
          ? (this.editor?.getText() ?? saved.text)
          : saved.text;
      if (savedTextIsCurrent(openNow, ticket, textNow)) {
        this.patch(saved.id, {
          text: ticket.text,
          conflict: false,
          reloadArmed: false,
          saveFailed: false,
          dirty: false,
          savePhase: "saved",
        });
        if (origin !== "auto" && this.activeId === saved.id) {
          this.status = this.labels.saved;
        }
      } else {
        this.patch(saved.id, {
          text: textNow,
          conflict: false,
          reloadArmed: false,
          saveFailed: false,
          savePhase: "unsaved",
          dirty: true,
        });
        if (saved.id === this.activeId) {
          this.rememberEditor(saved.id);
          this.scheduleAutosave();
        }
      }
    } catch (error) {
      const failed = this.tabForTicket(ticket);
      if (!failed) return;
      const openNow = this.openOf(failed);
      if (!shouldApplySaveResult(openNow, ticket, serial, this.saveSerial)) {
        return;
      }
      if (isExternalChange(error)) {
        const textNow =
          failed.id === this.activeId
            ? (this.editor?.getText() ?? failed.text)
            : failed.text;
        const stillThatWrite = savedTextIsCurrent(openNow, ticket, textNow);
        this.patch(failed.id, {
          conflict: true,
          reloadArmed: false,
          savePhase:
            stillThatWrite && phaseBefore !== "unsaved" ? "saved" : "unsaved",
        });
        if (failed.id === this.activeId) this.autosave.cancel();
        return;
      }
      this.patch(failed.id, {
        savePhase: "unsaved",
        saveFailed: true,
        dirty: true,
      });
      if (failed.id === this.activeId) {
        this.status = `${this.labels.saveFailed}: ${messageOf(error)}`;
      }
    }
  }

  private openOf(tab: TabModel): OpenNote {
    return {
      id: tab.epoch,
      path: sessionToken(tab),
      revision: tab.revision,
    };
  }

  private async flushActive(block: boolean): Promise<boolean> {
    this.snapshotActive();
    const tab = this.active;
    if (!tab) return true;
    if (block && this.leaveApproved.has(tab.id)) {
      this.leaveApproved.delete(tab.id);
      this.autosave.cancel();
      return true;
    }
    if (tab.conflict) return !block;
    const pending = this.autosave.take();
    if (pending) await this.enqueueSave(pending, "auto");
    await this.saveChain;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const latest = this.tabById(tab.id);
      if (!latest || latest.conflict || latest.savePhase === "saved") break;
      const ticket = this.ticketFor(latest);
      if (!ticket) break;
      await this.enqueueSave(ticket, "auto");
    }
    const done = this.tabById(tab.id);
    if (!done) return true;
    if (
      block &&
      (done.conflict || done.saveFailed || done.savePhase !== "saved")
    ) {
      return false;
    }
    return true;
  }

  private async flushAll(): Promise<void> {
    for (const id of this.tabs.map((tab) => tab.id)) {
      const tab = this.tabById(id);
      if (!tab || tab.conflict || tab.savePhase === "saved") continue;
      if (this.disposable(tab)) continue;
      if (tab.id === this.activeId) await this.flushActive(false);
      else {
        await this.enqueueSave(
          {
            id: tab.epoch,
            path: sessionToken(tab),
            revision: tab.revision,
            text: tab.text,
          },
          "auto",
        );
      }
    }
  }

  private async settleAll(): Promise<boolean> {
    for (const tab of this.tabs) {
      if (tab.conflict || tab.saveFailed) {
        if (this.activeId !== tab.id) await this.focusTabNow(tab.id);
        return false;
      }
    }
    for (const tab of [...this.tabs]) {
      if (!this.disposable(tab)) continue;
      const removed = await this.dropDraft(tab.id);
      const still = this.tabById(tab.id);
      if (
        !removed &&
        still &&
        (still.conflict || still.saveFailed || this.disposable(still))
      ) {
        if (this.activeId !== still.id) await this.focusTabNow(still.id);
        return false;
      }
    }
    await this.flushAll();
    const blocked = this.tabs.find(
      (tab) => tab.conflict || tab.saveFailed || tab.savePhase !== "saved",
    );
    if (!blocked) return true;
    if (this.activeId !== blocked.id) await this.focusTabNow(blocked.id);
    return false;
  }

  private editorOptions(): EditorOptions {
    return {
      rendered: this.viewMode !== "source",
      fonts: { source: this.sourceFont, render: this.renderFont },
    };
  }

  private applyEditorChrome(): void {
    this.editor?.setRendered(this.viewMode !== "source");
    this.editor?.setFonts({
      source: this.sourceFont,
      render: this.renderFont,
    });
  }

  /** The new-note dialog can move focus after it closes, so focus again. */
  private focusEditor(): void {
    const editor = this.editor;
    if (!editor) return;
    editor.focus();
    requestAnimationFrame(() => {
      if (this.editor === editor) editor.focus();
    });
  }

  private renderPath(tab: TabModel): string {
    return tab.kind === "template" ? "" : tab.key;
  }

  private liveText(tab: TabModel): string {
    if (tab.id === this.activeId && this.editor) return this.editor.getText();
    return tab.text;
  }

  private disposable(tab: TabModel): boolean {
    if (tab.conflict || tab.saveFailed) return false;
    return draftIsDisposable({ ...tab, text: this.liveText(tab) });
  }

  private async dropDraft(id: number): Promise<boolean> {
    this.autosave.cancel();
    await this.saveChain;
    const tab = this.tabById(id);
    if (!tab || !this.disposable(tab)) return false;
    try {
      await api.discardDraft(tab.key);
    } catch (error) {
      this.status = `${this.labels.actionFailed}: ${messageOf(error)}`;
      return false;
    }
    if (!this.tabById(id)) return true;
    this.removeTab(id);
    return true;
  }

  /** The editor's undo history, when it still shows this tab. */
  private rememberEditor(id: number): void {
    if (!id || this.activeId !== id || !this.editor) return;
    const tab = this.tabById(id);
    const state = readEditorState(this.editor);
    if (!tab || !storedEditorMatches(state.doc.toString(), tab.text)) return;
    this.editorStates.set(id, state);
  }

  private snapshotActive(): void {
    const tab = this.active;
    if (!tab || !this.editor) return;
    const state = readEditorState(this.editor);
    const text = state.doc.toString();
    const changed = text !== tab.text;
    this.patch(tab.id, {
      text,
      place: this.editor.getPlace(),
      ...(changed
        ? {
            dirty: true,
            savePhase: "unsaved" as const,
            revision: tab.revision + 1,
          }
        : {}),
    });
    this.editorStates.set(tab.id, state);
    if (changed && !tab.conflict) this.scheduleAutosave();
  }

  private restoreEditor(id: number): void {
    const tab = this.tabById(id);
    if (!tab || !this.editor) return;
    const state = this.editorStates.get(id);
    if (state && storedEditorMatches(state.doc.toString(), tab.text)) {
      writeEditorState(this.editor, state);
    } else {
      this.editorStates.delete(id);
      replaceEditorText(this.editor, tab.text, this.editorOptions());
    }
    this.applyEditorChrome();
    this.rememberEditor(id);
  }

  private showCached(id: number): void {
    const cached = this.pages.get(id);
    this.pageUrls = cached?.urls ?? [];
    this.diagnostics = cached?.diagnostics ?? [];
  }

  private dropPages(id: number): void {
    const cached = this.pages.get(id);
    if (!cached) return;
    for (const url of cached.urls) URL.revokeObjectURL(url);
    this.pages.delete(id);
    if (this.activeId === id) {
      this.pageUrls = [];
      this.diagnostics = [];
    }
  }

  private async focusTabNow(id: number): Promise<void> {
    if (id === this.activeId) {
      this.snapshotActive();
      this.focusEditor();
      return;
    }
    const next = this.tabById(id);
    if (!next) return;
    await this.flushActive(false);
    if (!this.tabById(id) || this.activeId === id) return;
    this.activeId = id;
    this.restoreEditor(id);
    this.showCached(id);
    this.focusEditor();
    this.persist();
    void this.runRender();
  }

  private async closeTabNow(id: number): Promise<void> {
    if (this.activeId === id) this.snapshotActive();
    let tab = this.tabById(id);
    if (!tab) return;
    if (this.disposable(tab)) {
      const removed = await this.dropDraft(id);
      const latest = this.tabById(id);
      if (removed || !latest || this.disposable(latest)) return;
      tab = latest;
    }
    if (this.activeId !== id) {
      if (tab.conflict || tab.saveFailed) {
        await this.focusTabNow(id);
        return;
      }
      if (tab.savePhase !== "saved") {
        await this.enqueueSave(
          {
            id: tab.epoch,
            path: sessionToken(tab),
            revision: tab.revision,
            text: tab.text,
          },
          "auto",
        );
      }
      const latest = this.tabById(id);
      if (
        !latest ||
        latest.conflict ||
        latest.saveFailed ||
        latest.savePhase !== "saved"
      ) {
        await this.focusTabNow(id);
        return;
      }
    } else if (!(await this.flushActive(true))) {
      return;
    }
    this.removeTab(id);
  }

  private removeTab(id: number): void {
    const index = this.tabs.findIndex((tab) => tab.id === id);
    if (index < 0) return;
    const wasActive = this.activeId === id;
    const next = neighborIndex(this.tabs.length, index);
    this.dropPages(id);
    this.editorStates.delete(id);
    this.leaveApproved.delete(id);
    this.tabs = this.tabs.filter((tab) => tab.id !== id);
    if (wasActive) {
      const neighbor = next >= 0 ? this.tabs[next] : undefined;
      this.activeId = neighbor?.id ?? 0;
      if (neighbor) {
        this.restoreEditor(neighbor.id);
        this.showCached(neighbor.id);
        this.focusEditor();
        void this.runRender();
      }
    }
    this.persist();
  }

  private async addTab(
    kind: TabKind,
    key: string,
    text: string,
    status?: string,
  ): Promise<void> {
    const existing =
      kind === "template"
        ? findTabByKey(this.tabs, "template", key)
        : this.findNote(key);
    if (existing >= 0) {
      const found = this.tabs[existing];
      if (found) await this.focusTabNow(found.id);
      return;
    }
    this.nextId += 1;
    const tab = createTab(this.nextId, kind, key, text, this.labels.untitled);
    this.tabs = [...this.tabs, tab];
    await this.focusTabNow(tab.id);
    if (status) this.status = status;
    this.persist();
  }

  private async createDraft(): Promise<void> {
    try {
      const note = await api.createDraft();
      await this.addTab(note.draft ? "draft" : "note", note.path, note.text);
    } catch (error) {
      this.status = this.commandStatus(error, this.labels.actionFailed);
    }
  }

  private async openLooseNow(): Promise<void> {
    try {
      const note = await api.openLooseFile();
      if (!note) return;
      await this.addTab(note.draft ? "draft" : "note", note.path, note.text);
      if (!note.draft) await this.refreshRecents();
    } catch (error) {
      this.status = `${this.labels.openFailed}: ${messageOf(error)}`;
    }
  }

  private async openNoteNow(path: string): Promise<void> {
    const existing = this.findNote(path);
    if (existing >= 0) {
      const found = this.tabs[existing];
      if (found) await this.focusTabNow(found.id);
      return;
    }
    await this.flushActive(false);
    try {
      const note = await api.openNote(path);
      await this.addTab("note", note.path, note.text);
      await this.refreshRecents();
    } catch (error) {
      this.status = `${this.labels.openFailed}: ${messageOf(error)}`;
    }
  }

  private async createBlankNote(): Promise<void> {
    if (!this.rootName) {
      await this.createDraft();
      return;
    }
    await this.flushActive(false);
    try {
      const note = await api.createBlankNote(this.selectedFolder);
      await this.refreshTree();
      if (
        this.selectedFolder &&
        !this.openFolders.includes(this.selectedFolder)
      ) {
        this.openFolders = [...this.openFolders, this.selectedFolder];
      }
      await this.addTab("note", note.path, note.text);
    } catch (error) {
      this.status = this.commandStatus(error, this.labels.actionFailed);
    }
  }

  private async createFromTemplate(kind: string, name: string): Promise<void> {
    if (!this.rootName || this.templatePending) return;
    this.templatePending = true;
    try {
      await this.flushActive(false);
      const note = await api.createFromTemplate(
        this.selectedFolder,
        kind,
        name,
      );
      await this.refreshTree();
      await this.addTab(
        "note",
        note.path,
        note.text,
        `${this.labels.templateCreated}: ${note.path}`,
      );
    } catch (error) {
      this.status = this.commandStatus(error, this.labels.templateFailed);
    } finally {
      this.templatePending = false;
    }
  }

  private async copyShippedTemplate(stem: string): Promise<void> {
    if (this.templatePending) return;
    this.templatePending = true;
    try {
      await this.flushActive(false);
      const doc = await api.copyShippedTemplate(stem);
      await this.refreshTemplates();
      await this.addTab("template", doc.name, doc.text);
      this.status = "";
    } catch (error) {
      this.status = this.commandStatus(error, this.labels.templateFailed);
    } finally {
      this.templatePending = false;
    }
  }

  private async editYourTemplate(name: string): Promise<void> {
    if (this.templatePending) return;
    this.templatePending = true;
    try {
      await this.flushActive(false);
      const doc = await api.openTemplate(name);
      await this.addTab("template", doc.name, doc.text);
      this.status = "";
    } catch (error) {
      this.status = `${this.labels.openFailed}: ${messageOf(error)}`;
    } finally {
      this.templatePending = false;
    }
  }

  private async createSample(): Promise<void> {
    await this.flushActive(false);
    try {
      const note = await api.createSampleNote();
      await this.refreshTree();
      await this.addTab("note", note.path, note.text);
    } catch (error) {
      this.status = `${this.labels.openFailed}: ${messageOf(error)}`;
    }
  }

  private async saveActiveNow(explicit: boolean): Promise<void> {
    const tab = this.active;
    if (!tab) return;
    if (tab.kind === "draft") {
      await this.flushActive(false);
      await this.saveDraftAs(tab.id);
      return;
    }
    this.autosave.cancel();
    const ticket = this.ticketFor(this.tabById(tab.id));
    if (!ticket) return;
    await this.enqueueSave(ticket, explicit ? "manual" : "auto");
  }

  private async saveDraftAs(id: number): Promise<void> {
    const tab = this.tabById(id);
    if (!tab || tab.kind !== "draft") return;
    try {
      const placed = await api.saveDraftAs(tab.key);
      if (!placed) return;
      const kind: TabKind = placed.draft ? "draft" : "note";
      this.patch(id, {
        kind,
        key: placed.path,
        title: tabTitle(kind, placed.path, this.labels.untitled),
      });
      const live = this.editor?.getText() ?? placed.text;
      if (live !== placed.text && this.activeId === id) {
        this.patch(id, { text: live, dirty: true, savePhase: "unsaved" });
        this.scheduleAutosave();
      } else {
        this.patch(id, {
          text: placed.text,
          dirty: false,
          savePhase: "saved",
          conflict: false,
          saveFailed: false,
        });
      }
      if (!placed.draft) await this.refreshRecents();
      if (this.rootName) await this.refreshTree();
      this.persist();
      await this.runRender();
    } catch (error) {
      this.status = this.commandStatus(error, this.labels.actionFailed);
    }
  }

  private async openFolderNow(): Promise<void> {
    const active = this.active;
    if (active && (active.conflict || active.saveFailed)) {
      if (!(await this.flushActive(true))) return;
    } else {
      await this.flushAll();
    }
    try {
      const released = await api.releaseWorkspacePaths(
        this.tabs.map((tab) => sessionToken(tab)),
      );
      this.applyKeys(released);
    } catch (error) {
      this.status = `${this.labels.openFailed}: ${messageOf(error)}`;
      return;
    }
    try {
      const picked = await api.openWorkspace();
      if (!picked) {
        await this.adoptBack();
        return;
      }
      this.rootName = picked.root_name;
      this.searchQuery = "";
      this.searchHits = [];
      this.searchTouched = false;
      this.searchPending = false;
      this.selectedFolder = "";
      this.openFolders = [];
      this.renamingPath = "";
      this.pendingDelete = "";
      this.namingFolder = false;
      this.entryName = "";
      await this.adoptBack();
      await this.refreshTree();
      this.status =
        this.tree.length === 0
          ? this.labels.clickNote
          : this.labels.workspaceReady;
      await this.runRender();
    } catch (error) {
      try {
        await this.adoptBack();
      } catch {
        // The keys stay absolute, which is still a path the gate allows.
      }
      this.status = `${this.labels.openFailed}: ${messageOf(error)}`;
    }
  }

  private async adoptBack(): Promise<void> {
    const adopted = await api.adoptOpenPaths(
      this.tabs.map((tab) => sessionToken(tab)),
    );
    this.applyKeys(adopted);
    this.persist();
  }

  private applyKeys(next: string[]): void {
    this.tabs = this.tabs.map((tab, index) => {
      const key = next[index];
      if (!key || tab.kind === "template" || key === tab.key) return tab;
      return {
        ...tab,
        key,
        title: tabTitle(tab.kind, key, this.labels.untitled),
      };
    });
  }

  private async reloadActive(): Promise<void> {
    const tab = this.active;
    if (!tab) return;
    const epoch = tab.epoch;
    const key = tab.key;
    const kind = tab.kind;
    this.autosave.cancel();
    await this.saveChain;
    const current = this.active;
    if (!current || current.id !== tab.id || current.epoch !== epoch) return;
    try {
      if (kind === "template") {
        const doc = await api.openTemplate(key);
        if (this.active?.id !== tab.id || this.active.epoch !== epoch) return;
        this.replaceTabText(tab.id, doc.text);
      } else {
        const note = await api.openNote(key);
        if (this.active?.id !== tab.id || this.active.epoch !== epoch) return;
        this.replaceTabText(tab.id, note.text);
      }
      this.dropPages(tab.id);
      await this.runRender();
    } catch (error) {
      this.status = `${this.labels.openFailed}: ${messageOf(error)}`;
    }
  }

  private replaceTabText(id: number, text: string): void {
    const tab = this.tabById(id);
    if (!tab) return;
    this.editorStates.delete(id);
    this.patch(id, {
      text,
      revision: 0,
      epoch: tab.epoch + 1,
      dirty: false,
      savePhase: "saved",
      conflict: false,
      reloadArmed: false,
      saveFailed: false,
    });
    if (this.activeId === id && this.editor) {
      replaceEditorText(this.editor, text, this.editorOptions());
      this.applyEditorChrome();
    }
  }

  private async submitNewFolderNow(): Promise<void> {
    const name = this.entryName.trim();
    if (!name || !this.rootName) return;
    try {
      const created = await api.createFolder(this.selectedFolder, name);
      this.entryName = "";
      this.namingFolder = false;
      this.selectedFolder = created;
      if (!this.openFolders.includes(created)) {
        this.openFolders = [...this.openFolders, created];
      }
      await this.refreshTree();
    } catch (error) {
      this.status = `${this.labels.actionFailed}: ${messageOf(error)}`;
    }
  }

  private async applyRenameNow(): Promise<void> {
    const from = this.renamingPath;
    const to = this.renameValue.trim();
    if (!from || !to) return;
    const affected = this.tabs.filter(
      (tab) => tab.kind !== "template" && keyWasRemoved(tab.key, from),
    );
    if (affected.some((tab) => tab.id === this.activeId)) {
      if (!(await this.flushActive(true))) return;
    }
    try {
      const next = await api.renameEntry(from, to);
      this.renamingPath = "";
      this.tabs = this.tabs.map((tab) => {
        if (tab.kind === "template") return tab;
        const key = retargetKey(tab.key, from, next);
        if (key === tab.key) return tab;
        return {
          ...tab,
          key,
          title: tabTitle(tab.kind, key, this.labels.untitled),
        };
      });
      if (
        this.selectedFolder === from ||
        this.selectedFolder.startsWith(`${from}/`)
      ) {
        this.selectedFolder =
          this.selectedFolder === from
            ? next
            : next + this.selectedFolder.slice(from.length);
      }
      this.openFolders = this.openFolders.map((folder) => {
        if (folder === from) return next;
        if (folder.startsWith(`${from}/`))
          return next + folder.slice(from.length);
        return folder;
      });
      await this.refreshTree();
      for (const tab of affected) {
        const current = this.tabById(tab.id);
        if (!current) continue;
        const note = await api.openNote(current.key);
        this.replaceTabText(current.id, note.text);
        this.dropPages(current.id);
      }
      this.persist();
      await this.runRender();
    } catch (error) {
      this.status = `${this.labels.actionFailed}: ${messageOf(error)}`;
    }
  }

  private async confirmDeleteNow(): Promise<void> {
    const path = this.pendingDelete;
    if (!path) return;
    const removed = this.tabs.filter(
      (tab) => tab.kind !== "template" && keyWasRemoved(tab.key, path),
    );
    if (removed.some((tab) => tab.id === this.activeId)) {
      this.autosave.cancel();
      await this.saveChain;
    }
    try {
      await api.deleteEntry(path);
      this.pendingDelete = "";
      if (
        this.selectedFolder === path ||
        this.selectedFolder.startsWith(`${path}/`)
      ) {
        this.selectedFolder = "";
      }
      this.openFolders = this.openFolders.filter(
        (folder) => folder !== path && !folder.startsWith(`${path}/`),
      );
      for (const tab of removed) this.removeTab(tab.id);
      await this.refreshTree();
    } catch (error) {
      this.status = `${this.labels.actionFailed}: ${messageOf(error)}`;
      const active = this.active;
      if (active && active.savePhase === "unsaved" && !active.conflict) {
        this.scheduleAutosave();
      }
    }
  }

  private async checkExternalChange(): Promise<void> {
    const tab = this.active;
    if (!tab || tab.conflict || tab.savePhase === "saving") return;
    const epoch = tab.epoch;
    const key = tab.key;
    const kind = tab.kind;
    try {
      const changed =
        kind === "template"
          ? await api.templateChangedOnDisk(key)
          : await api.noteChangedOnDisk(key);
      const current = this.active;
      if (
        !current ||
        current.id !== tab.id ||
        current.epoch !== epoch ||
        current.conflict ||
        current.savePhase === "saving"
      ) {
        return;
      }
      if (changed) {
        this.patch(current.id, { conflict: true, reloadArmed: false });
        this.autosave.cancel();
      }
    } catch (error) {
      const current = this.active;
      if (!current || current.id !== tab.id || current.epoch !== epoch) return;
      if (isExternalChange(error)) {
        this.patch(current.id, { conflict: true, reloadArmed: false });
        this.autosave.cancel();
        return;
      }
      this.status = `${this.labels.actionFailed}: ${messageOf(error)}`;
    }
  }

  private async exportPdfNow(): Promise<void> {
    const tab = this.active;
    if (!tab || this.exporting) return;
    if (tab.kind === "template") {
      this.status = this.labels.pdfNeedsNote;
      return;
    }
    const source = this.editor?.getText() ?? tab.text;
    this.exporting = true;
    this.status = this.labels.exportingPdf;
    try {
      const written = await api.exportPdf(tab.key, source);
      this.status = `${this.labels.exportedPdf}: ${written}`;
    } catch (error) {
      this.status = `${this.labels.exportFailed}: ${messageOf(error)}`;
    } finally {
      this.exporting = false;
    }
  }

  private async runRender(): Promise<void> {
    const tab = this.active;
    if (!tab) return;
    const tabId = tab.id;
    if (tab.kind === "template" && !this.rootName) {
      this.dropPages(tabId);
      this.diagnostics = [];
      this.editor?.setDiagnostics([], "", "", false);
      return;
    }
    const token = this.guard.next();
    const source = this.editor?.getText() ?? tab.text;
    const path = this.renderPath(tab);
    try {
      const result = await api.renderNote(path, source, token);
      if (!this.guard.isCurrent(result.revision) || !this.tabById(tabId))
        return;
      const live =
        this.activeId === tabId ? (this.editor?.getText() ?? source) : source;
      const accept = live === source;
      if (this.activeId === tabId) {
        this.editor?.setDiagnostics(
          accept ? result.diagnostics : [],
          source,
          path,
          accept,
        );
        if (accept) this.diagnostics = result.diagnostics;
      }
      const listed = accept
        ? result.diagnostics
        : (this.pages.get(tabId)?.diagnostics ?? []);
      await this.swapPages(tabId, result.pages, listed, token);
    } catch (error) {
      if (this.guard.isCurrent(token) && this.activeId === tabId) {
        this.status = `${this.labels.renderFailed}: ${messageOf(error)}`;
      }
    }
  }

  private async swapPages(
    tabId: number,
    svgs: string[],
    diagnostics: RenderDiagnostic[],
    token: number,
  ): Promise<void> {
    const previous = this.pages.get(tabId);
    if (previous && svgPagesEqual(previous.svgs, svgs)) {
      previous.diagnostics = diagnostics;
      if (this.activeId === tabId) this.diagnostics = diagnostics;
      return;
    }
    if (svgs.length === 0) {
      if (previous) previous.diagnostics = diagnostics;
      if (this.activeId === tabId) this.diagnostics = diagnostics;
      return;
    }
    const urls = svgs.map((svg) => svgBlobUrl(svg));
    await Promise.all(urls.map((url) => preloadImage(url)));
    if (!this.guard.isCurrent(token) || !this.tabById(tabId)) {
      for (const url of urls) URL.revokeObjectURL(url);
      return;
    }
    const old = previous?.urls ?? [];
    this.pages.set(tabId, { svgs: [...svgs], urls, diagnostics });
    if (this.activeId === tabId) {
      this.pageUrls = urls;
      this.diagnostics = diagnostics;
    }
    requestAnimationFrame(() => {
      for (const url of old) URL.revokeObjectURL(url);
    });
  }

  private runSearch(): void {
    const query = this.searchQuery;
    if (!query.trim()) {
      this.searchPending = false;
      return;
    }
    this.searchPending = true;
    void (async () => {
      try {
        const hits = await api.searchNotes(query);
        if (this.searchQuery !== query) return;
        this.searchHits = hits;
        this.searchTouched = true;
      } catch (error) {
        if (this.searchQuery !== query) return;
        this.searchHits = [];
        this.status = `${this.labels.searchFailed}: ${messageOf(error)}`;
      } finally {
        if (this.searchQuery === query) this.searchPending = false;
      }
    })();
  }

  private async refreshRecents(): Promise<void> {
    this.recentPending = true;
    this.recentError = "";
    try {
      this.recentNotes = await api.listGlobalRecents();
    } catch (error) {
      this.recentNotes = [];
      this.recentError = `${this.labels.recentFailed}: ${messageOf(error)}`;
    } finally {
      this.recentPending = false;
    }
  }

  private async refreshTree(): Promise<void> {
    if (!this.rootName) return;
    this.tree = await api.listTree();
    this.searchHits = [];
    this.searchTouched = false;
    await this.refreshRecents();
  }

  private async refreshTemplates(): Promise<void> {
    try {
      const list = await api.listTemplates();
      this.shippedStems = list.shipped;
      this.yourTemplates = list.yours;
      this.templateFolderReady = list.folder_ready;
    } catch (error) {
      this.status = `${this.labels.templateFailed}: ${messageOf(error)}`;
    }
  }

  private persist(): void {
    if (this.persistTimer !== undefined) clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(() => void this.writeSession(), 300);
  }

  private async writeSession(): Promise<void> {
    const tabs = this.tabs.map((tab) => sessionToken(tab));
    const active = this.active ? sessionToken(this.active) : "";
    try {
      await api.saveSession(tabs, active);
    } catch {
      // The next successful write stores the tabs. Launch still opens drafts.
    }
  }
}

export function createSession(startup: StartupAppearance): Session {
  return new Session(startup);
}
