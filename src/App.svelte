<script lang="ts">
  import { untrack } from "svelte";
  import AppearanceDialog from "./lib/ui/AppearanceDialog.svelte";
  import Icon from "./lib/ui/Icon.svelte";
  import Sidebar from "./lib/ui/Sidebar.svelte";
  import NavFollow from "./lib/shell/NavFollow.svelte";
  import NewNoteDialog from "./lib/shell/NewNoteDialog.svelte";
  import NoteStage from "./lib/shell/NoteStage.svelte";
  import Welcome from "./lib/shell/Welcome.svelte";
  import { createSession } from "./lib/state/session.svelte";
  import type { StartupAppearance } from "./lib/appearance";

  let {
    startup = {
      theme: "system",
      pageColor: "white",
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
      {#if session.sidebarCollapsed}
        <button
          type="button"
          class="nav-rail"
          aria-label={session.labels.sidebarExpand}
          onclick={() => session.toggleSidebar()}
        >
          {session.workspaceMark}
        </button>
      {:else}
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
      {/if}
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
    preview={session.labels.appearancePreview}
    closeLabel={session.labels.appearanceClose}
    onClose={() => session.closeAppearance()}
    onSaved={(saved) => session.applyAppearance(saved)}
    onFailed={(error) => session.appearanceFailed(error)}
  />
</div>
