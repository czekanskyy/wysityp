<script lang="ts" module>
  let sidebarSeq = 0;

  function nextSearchId(): string {
    sidebarSeq += 1;
    return `sidebar-search-${sidebarSeq}`;
  }
</script>

<script lang="ts">
  import { tick } from "svelte";
  import AppIcon from "./AppIcon.svelte";
  import Icon from "./Icon.svelte";
  import IconButton from "./IconButton.svelte";
  import Menu from "./Menu.svelte";
  import type {
    SidebarFooterEntry,
    SidebarItem,
    SidebarLanguage,
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
    mark?: string;
    brand?: boolean;
    onWorkspace?: () => void;
    newDisabled?: boolean;
    searchDisabled?: boolean;
    searchValue?: string;
    expandLabel?: string;
    collapseLabel?: string;
    onChoose?: (id: string) => void;
    language?: SidebarLanguage;
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
    mark,
    brand = false,
    onWorkspace,
    newDisabled = false,
    searchDisabled = false,
    searchValue,
    expandLabel,
    collapseLabel,
    onChoose,
    language,
  }: Props = $props();

  let activeBySection = $state<Record<string, string>>({});
  const searchId = nextSearchId();
  const shownMark = $derived(mark ?? Array.from(workspaceName)[0] ?? "");
  const twistNamed = $derived(Boolean(expandLabel && collapseLabel));

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

  function eventInsideMenu(event: Event): boolean {
    const target = event.target;
    return target instanceof Element && target.closest(".tree-menu") !== null;
  }

  function choose(item: SidebarItem) {
    if (item.kind === "note") onOpen(item.id);
    else if (onChoose) onChoose(item.id);
    else onToggle(item.id);
  }

  function twistLabel(item: SidebarItem): string {
    return item.expanded ? (collapseLabel ?? "") : (expandLabel ?? "");
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
    if (event.key === "Enter" || event.key === " ") {
      if (item.kind === "note") {
        event.preventDefault();
        onOpen(item.id);
      } else if (onChoose) {
        event.preventDefault();
        onChoose(item.id);
      }
    }
  }
</script>

{#snippet languageSelect()}
  {#if language}
    <label class="locale-select">
      <span class="visually-hidden">{language.label}</span>
      <select
        aria-label={language.label}
        value={language.value}
        onchange={(event) => {
          const select = event.currentTarget;
          language?.onChange(select.value);
          if (language) select.value = language.value;
        }}
      >
        {#each language.options as option (option.value)}
          <option value={option.value}>{option.label}</option>
        {/each}
      </select>
    </label>
  {/if}
{/snippet}

<nav class="sidebar" aria-label={navLabel}>
  <div class="sidebar-head">
    <div class="workspace">
      {#if brand}
        <AppIcon size={24} />
      {:else if shownMark}
        <span class="workspace-mark" aria-hidden="true">{shownMark}</span>
      {/if}
      {#if onWorkspace}
        <button
          type="button"
          class="workspace-name one-line"
          title={workspaceName}
          onclick={onWorkspace}
        >
          {workspaceName}
        </button>
      {:else}
        <span class="workspace-name one-line" title={workspaceName}>
          {workspaceName}
        </span>
      {/if}
      <IconButton
        label={newLabel}
        icon="plus"
        size="sm"
        disabled={newDisabled}
        onclick={onNew}
      />
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
        spellcheck="false"
        disabled={searchDisabled}
        value={searchValue}
        oninput={(event) => {
          if (searchDisabled) return;
          onSearch(event.currentTarget.value);
        }}
      />
    </div>
  </div>
  <div class="sidebar-body">
    {#each sections as section (section.id)}
      <section aria-busy={section.busy ? "true" : undefined}>
        <div class="section-head">
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
          {#if section.action}
            <button
              type="button"
              class="section-action"
              title={section.action.label}
              disabled={section.action.disabled}
              onclick={() => section.action?.onclick()}
            >
              <span class="one-line">{section.action.label}</span>
            </button>
          {/if}
        </div>
        {#if section.expanded && section.notice}
          <p class="section-notice">{section.notice}</p>
        {/if}
        {#if section.expanded}
          <div class="tree" role="tree" aria-label={section.title}>
            {#each rowsIn(section) as item (item.id)}
              <div
                class="tree-row"
                class:selected={item.selected}
                class:current={item.current}
                role="treeitem"
                data-id={item.id}
                aria-level={item.level}
                aria-selected={item.selected ? "true" : "false"}
                aria-current={item.current ? "page" : undefined}
                aria-expanded={item.kind === "folder"
                  ? item.expanded
                    ? "true"
                    : "false"
                  : undefined}
                tabindex={tabFor(section, item)}
                style:--level={item.level}
                title={item.title ?? item.label}
                onclick={(event) => {
                  if (eventInsideMenu(event)) return;
                  remember(section.id, item.id);
                  choose(item);
                }}
                onkeydown={(event) => {
                  if (eventInsideMenu(event)) return;
                  onRowKey(event, section, item);
                }}
              >
                <span class="tree-twist">
                  {#if item.kind === "folder" && twistNamed}
                    <button
                      type="button"
                      class="twist-btn"
                      tabindex="-1"
                      aria-label={twistLabel(item)}
                      aria-expanded={item.expanded ? "true" : "false"}
                      onclick={(event) => {
                        event.stopPropagation();
                        onToggle(item.id);
                      }}
                      onkeydown={(event) => event.stopPropagation()}
                    >
                      <Icon
                        id={item.expanded ? "chevronDown" : "chevronRight"}
                        size="sm"
                      />
                    </button>
                  {:else if item.kind === "folder"}
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
                {#if item.count !== undefined}
                  <span class="tree-count">{item.count}</span>
                {/if}
                {#if item.menu && item.menu.length > 0 && item.menuLabel}
                  <span class="tree-menu">
                    <Menu label={item.menuLabel} entries={item.menu} />
                  </span>
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
      {#if index === 0}
        {@render languageSelect()}
      {/if}
    {/each}
    {#if footer.length === 0}
      {@render languageSelect()}
    {/if}
    <span class="save-status one-line" title={saveStatus}>{saveStatus}</span>
  </div>
</nav>
