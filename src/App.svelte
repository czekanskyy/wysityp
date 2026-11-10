<script lang="ts">
  import { untrack } from "svelte";
  import AppearanceDialog from "./lib/ui/AppearanceDialog.svelte";
  import CommandPalette from "./lib/ui/CommandPalette.svelte";
  import Icon from "./lib/ui/Icon.svelte";
  import Sidebar from "./lib/ui/Sidebar.svelte";
  import NavFollow from "./lib/shell/NavFollow.svelte";
  import NewNoteDialog from "./lib/shell/NewNoteDialog.svelte";
  import NoteStage from "./lib/shell/NoteStage.svelte";
  import ShortcutSheet from "./lib/shell/ShortcutSheet.svelte";
  import Welcome from "./lib/shell/Welcome.svelte";
  import { createSession } from "./lib/state/session.svelte";
  import type { StartupAppearance } from "./lib/appearance";
  import { DEFAULT_RENDER_FONT, DEFAULT_SOURCE_FONT } from "./lib/fonts";

  let {
    startup = {
      theme: "system",
      pageColor: "white",
      sourceFont: DEFAULT_SOURCE_FONT,
      renderFont: DEFAULT_RENDER_FONT,
      error: "",
    },
  }: {
    startup?: StartupAppearance;
  } = $props();

  const session = createSession(untrack(() => startup));
</script>

<svelte:window
  onkeydowncapture={(event) => session.onWindowKey(event)}
  onfocus={() => void session.onWindowFocus()}
  onblur={() => session.onWindowBlur()}
/>

<div class={["shell", { "nav-collapsed": session.sidebarCollapsed }]}>
  <div class="workarea">
    <div class="nav-column">
      <button
        type="button"
        class="nav-rail"
        aria-label={session.labels.sidebarExpand}
        aria-hidden={session.sidebarCollapsed ? undefined : "true"}
        tabindex={session.sidebarCollapsed ? 0 : -1}
        onclick={() => session.toggleSidebar()}
      >
        {session.workspaceMark}
      </button>
      <div
        class="nav-rest"
        inert={session.sidebarCollapsed}
        aria-hidden={session.sidebarCollapsed ? "true" : undefined}
      >
        <div class="nav-tools">
          <button
            type="button"
            class="nav-collapse"
            aria-label={session.labels.sidebarCollapse}
            onclick={() => session.toggleSidebar()}
          >
            <Icon id="panel" size="sm" />
          </button>
        </div>
        <Sidebar
          navLabel={session.labels.appName}
          workspaceName={session.rootName || session.labels.noFolder}
          mark={session.workspaceMark}
          brand={!session.rootName}
          onWorkspace={() => session.clearPlace()}
          newLabel={session.labels.newNote}
          onNew={() => void session.requestNewNote()}
          searchLabel={session.labels.searchLabel}
          searchDisabled={!session.rootName}
          searchValue={session.searchQuery}
          onSearch={(value) => session.onSearchInput(value)}
          sections={session.sidebarModel.sections}
          items={session.sidebarModel.items}
          onOpen={(id) => void session.openNote(id)}
          onToggle={(id) => session.toggleFolder(id)}
          onChoose={(id) => session.chooseFolder(id)}
          expandLabel={session.labels.expandFolder}
          collapseLabel={session.labels.collapseFolder}
          saveStatus=""
          footer={session.footerEntries}
          language={{
            label: session.labels.language,
            value: session.locale,
            options: [
              { value: "pl", label: "Polski" },
              { value: "en", label: "English" },
            ],
            onChange: (value) => {
              if (value === "pl" || value === "en")
                void session.changeLocale(value);
            },
          }}
        />
        <NavFollow {session} />
      </div>
    </div>

    <main class="stage">
      {#if session.active}
        <NoteStage {session} />
      {:else}
        <Welcome {session} />
      {/if}
    </main>
  </div>

  <NewNoteDialog {session} />
  {#if session.palette !== "closed"}
    {#key session.palette}
      <CommandPalette
        commands={session.palette === "notes"
          ? session.goCommands
          : session.commands}
        label={session.palette === "notes"
          ? session.actionCopy.go.label
          : session.actionCopy.palette.label}
        placeholder={session.palette === "notes"
          ? session.actionCopy.go.placeholder
          : session.actionCopy.palette.placeholder}
        emptyText={session.palette === "notes"
          ? session.actionCopy.go.empty
          : session.actionCopy.palette.empty}
        hints={session.actionCopy.palette.hints}
        open={true}
        onOpenChange={(open) => {
          if (!open) session.closePalette();
        }}
        onRun={(id) => session.perform(id)}
      />
    {/key}
  {/if}
  <ShortcutSheet
    rows={session.shortcutEntries}
    label={session.actionCopy.sheet.label}
    placeholder={session.actionCopy.sheet.placeholder}
    emptyText={session.actionCopy.sheet.empty}
    closeLabel={session.actionCopy.sheet.close}
    open={session.shortcutsOpen}
    onOpenChange={(open) => {
      if (!open) session.closeShortcuts();
    }}
  />
  <AppearanceDialog
    open={session.appearanceOpen}
    restore={session.appearanceTrigger}
    theme={session.theme}
    pageColor={session.pageColor}
    title={session.labels.appearanceLabel}
    themeLabel={session.labels.themeLabel}
    themeHint={session.labels.themeHint}
    systemLabel={session.labels.themeSystem}
    lightLabel={session.labels.themeLight}
    darkLabel={session.labels.themeDark}
    pageColorLabel={session.labels.pageColorLabel}
    pageColorHint={session.labels.pageColorHint}
    whiteLabel={session.labels.pageWhite}
    beigeLabel={session.labels.pageBeige}
    graphiteLabel={session.labels.pageGraphite}
    oledLabel={session.labels.pageOled}
    sourceFont={session.sourceFont}
    renderFont={session.renderFont}
    sourceFontLabel={session.labels.sourceFontLabel}
    sourceFontHint={session.labels.sourceFontHint}
    renderFontLabel={session.labels.renderFontLabel}
    renderFontHint={session.labels.renderFontHint}
    fontOtherLabel={session.labels.fontOtherLabel}
    fontOtherHint={session.labels.fontOtherHint}
    preview={session.labels.appearancePreview}
    closeLabel={session.labels.appearanceClose}
    onClose={() => session.closeAppearance()}
    onSaved={(saved) => session.applyAppearance(saved)}
    onFailed={(error) => session.appearanceFailed(error)}
  />
</div>
