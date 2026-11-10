<script lang="ts">
  import Icon from "../ui/Icon.svelte";
  import type { Session } from "../state/session.svelte";

  let { session }: { session: Session } = $props();
  let dragFrom = -1;

  function onDrop(index: number) {
    if (dragFrom < 0) return;
    session.reorderTabs(dragFrom, index);
    dragFrom = -1;
  }
</script>

<div class="tab-strip" role="tablist" aria-label={session.labels.appName}>
  {#each session.tabs as tab, index (tab.id)}
    <div
      class={["tab", { active: tab.id === session.activeId }]}
      role="tab"
      aria-selected={tab.id === session.activeId}
      draggable="true"
      title={session.tabLabel(tab)}
      onmousedown={(event) => {
        if (event.button === 1) event.preventDefault();
      }}
      onclick={() => void session.focusTab(tab.id)}
      onauxclick={(event) => {
        if (event.button !== 1) return;
        event.preventDefault();
        void session.closeTab(tab.id);
      }}
      ondragstart={() => {
        dragFrom = index;
      }}
      ondragover={(event) => event.preventDefault()}
      ondrop={() => onDrop(index)}
      onkeydown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          void session.focusTab(tab.id);
        }
      }}
      tabindex="0"
    >
      {#if tab.dirty || tab.savePhase !== "saved" || tab.conflict}
        <span class="dirty-dot"></span>
      {/if}
      <span class="tab-label">{session.tabLabel(tab)}</span>
      <button
        type="button"
        class="tab-close"
        aria-label={session.labels.tabClose}
        onclick={(event) => {
          event.stopPropagation();
          void session.closeTab(tab.id);
        }}
      >
        <Icon id="close" size="sm" />
      </button>
    </div>
  {/each}
</div>
