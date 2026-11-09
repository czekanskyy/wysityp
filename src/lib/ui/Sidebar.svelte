<script lang="ts" module>
  let sidebarSeq = 0;

  function nextSearchId(): string {
    sidebarSeq += 1;
    return `sidebar-search-${sidebarSeq}`;
  }
</script>

<script lang="ts">
  import { tick } from "svelte";
  import Icon from "./Icon.svelte";
  import IconButton from "./IconButton.svelte";
  import type {
    SidebarFooterEntry,
    SidebarItem,
    SidebarSection,
  } from "./types";

  type Props = {
    navLabel: string;
    workspaceName: string;
    newLabel: string;
    onNew: () => void;
    searchLabel: string;
    onSearch: (query: string) => void;
    sections: readonly SidebarSection[];
    items: readonly SidebarItem[];
    onOpen: (id: string) => void;
    onToggle: (id: string) => void;
    saveStatus: string;
    footer: readonly SidebarFooterEntry[];
  };

  let {
    navLabel,
    workspaceName,
    newLabel,
    onNew,
    searchLabel,
    onSearch,
    sections,
    items,
    onOpen,
    onToggle,
    saveStatus,
    footer,
  }: Props = $props();

  let activeBySection = $state<Record<string, string>>({});
  const searchId = nextSearchId();
  const mark = $derived(Array.from(workspaceName)[0] ?? "");

  function rowsIn(section: SidebarSection): SidebarItem[] {
    if (!section.expanded) return [];
    return items.filter((item) => item.sectionId === section.id);
  }

  function tabFor(section: SidebarSection, item: SidebarItem): number {
    const rows = rowsIn(section);
    const current = activeBySection[section.id];
    const chosen = rows.find((row) => row.id === current) ?? rows[0];
    return chosen?.id === item.id ? 0 : -1;
  }

  function remember(sectionId: string, itemId: string) {
    activeBySection = { ...activeBySection, [sectionId]: itemId };
  }

  function activate(item: SidebarItem) {
    if (item.kind === "note") onOpen(item.id);
    else onToggle(item.id);
  }

  async function onRowKey(
    event: KeyboardEvent,
    section: SidebarSection,
    item: SidebarItem,
  ) {
    const rows = rowsIn(section);
    const index = rows.findIndex((row) => row.id === item.id);
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const next =
        event.key === "ArrowDown"
          ? rows[Math.min(rows.length - 1, index + 1)]
          : rows[Math.max(0, index - 1)];
      if (!next) return;
      const row = event.currentTarget;
      if (!(row instanceof HTMLElement)) return;
      remember(section.id, next.id);
      await tick();
      const tree = row.closest("[role='tree']");
      tree
        ?.querySelector<HTMLElement>(`[data-id="${CSS.escape(next.id)}"]`)
        ?.focus();
      return;
    }
    if (
      event.key === "ArrowRight" &&
      item.kind === "folder" &&
      !item.expanded
    ) {
      event.preventDefault();
      onToggle(item.id);
      return;
    }
    if (event.key === "ArrowLeft" && item.kind === "folder" && item.expanded) {
      event.preventDefault();
      onToggle(item.id);
      return;
    }
    if ((event.key === "Enter" || event.key === " ") && item.kind === "note") {
      event.preventDefault();
      onOpen(item.id);
    }
  }
</script>

<nav class="sidebar" aria-label={navLabel}>
  <div class="sidebar-head">
    <div class="workspace">
      {#if mark}
        <span class="workspace-mark" aria-hidden="true">{mark}</span>
      {/if}
      <span class="workspace-name one-line" title={workspaceName}>
        {workspaceName}
      </span>
      <IconButton label={newLabel} icon="plus" size="sm" onclick={onNew} />
    </div>
    <div class="search-wrap">
      <Icon id="search" size="sm" />
      <label class="visually-hidden" for={searchId}>{searchLabel}</label>
      <input
        id={searchId}
        class="sidebar-search"
        type="search"
        placeholder={searchLabel}
        title={searchLabel}
        autocomplete="off"
        oninput={(event) => onSearch(event.currentTarget.value)}
      />
    </div>
  </div>
  <div class="sidebar-body">
    {#each sections as section (section.id)}
      <section>
        <button
          type="button"
          class="section-title"
          aria-expanded={section.expanded}
          title={section.title}
          onclick={() => section.onToggle()}
        >
          <Icon
            id={section.expanded ? "chevronDown" : "chevronRight"}
            size="sm"
          />
          <span class="one-line">{section.title}</span>
        </button>
        {#if section.expanded}
          <div class="tree" role="tree" aria-label={section.title}>
            {#each rowsIn(section) as item (item.id)}
              <div
                class="tree-row"
                class:selected={item.selected}
                role="treeitem"
                data-id={item.id}
                aria-level={item.level}
                aria-selected={item.selected ? "true" : "false"}
                aria-expanded={item.kind === "folder"
                  ? item.expanded
                    ? "true"
                    : "false"
                  : undefined}
                tabindex={tabFor(section, item)}
                style:--level={item.level}
                title={item.label}
                onclick={() => {
                  remember(section.id, item.id);
                  activate(item);
                }}
                onkeydown={(event) => onRowKey(event, section, item)}
              >
                <span class="tree-twist">
                  {#if item.kind === "folder"}
                    <Icon
                      id={item.expanded ? "chevronDown" : "chevronRight"}
                      size="sm"
                    />
                  {/if}
                </span>
                <span class="tree-kind">
                  <Icon
                    id={item.kind === "folder"
                      ? item.expanded
                        ? "openFolder"
                        : "folder"
                      : "note"}
                    size="sm"
                  />
                </span>
                <span class="tree-label one-line">{item.label}</span>
                {#if item.unsaved}
                  <span class="unsaved-dot" aria-hidden="true">●</span>
                {/if}
              </div>
            {/each}
          </div>
        {/if}
      </section>
    {/each}
  </div>
  <div class="sidebar-foot">
    {#each footer as entry, index (index)}
      <button
        type="button"
        class="foot-btn"
        title={entry.label}
        onclick={() => entry.onclick()}
      >
        <span class="one-line">{entry.label}</span>
      </button>
    {/each}
    <span class="save-status one-line" title={saveStatus}>{saveStatus}</span>
  </div>
</nav>
