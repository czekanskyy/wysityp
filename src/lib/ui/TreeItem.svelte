<script lang="ts">
  import type { Snippet } from "svelte";
  import Icon from "./Icon.svelte";

  interface Props {
    label: string;
    kind: "folder" | "note";
    /** 1 for the top level. Drives the indent and aria-level. */
    level?: number;
    /** Folders only. */
    expanded?: boolean;
    /** The note open in the editor, or the folder new notes go to. */
    active?: boolean;
    /** Shown on the right in quiet text (e.g. an unsaved dot or a count). */
    badge?: string;
    onselect?: () => void;
    ontoggle?: (expanded: boolean) => void;
    /** Row actions (rename, delete), shown on hover and focus. */
    actions?: Snippet;
    /** Nested TreeItems of an expanded folder. */
    children?: Snippet;
  }

  let {
    label,
    kind,
    level = 1,
    expanded = false,
    active = false,
    badge,
    onselect,
    ontoggle,
    actions,
    children,
  }: Props = $props();

  const isFolder = $derived(kind === "folder");

  function onkeydown(event: KeyboardEvent) {
    if (event.target !== event.currentTarget) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (isFolder) ontoggle?.(!expanded);
      onselect?.();
    } else if (isFolder && event.key === "ArrowRight" && !expanded) {
      event.preventDefault();
      ontoggle?.(true);
    } else if (isFolder && event.key === "ArrowLeft" && expanded) {
      event.preventDefault();
      ontoggle?.(false);
    }
  }

  function onclick() {
    if (isFolder) ontoggle?.(!expanded);
    onselect?.();
  }
</script>

<!-- A flat tree: hierarchy is carried by aria-level, so each row is the
     treeitem itself and takes focus directly. -->
<div
  role="treeitem"
  class="row"
  class:active
  style:--level={level}
  aria-level={level}
  aria-expanded={isFolder ? expanded : undefined}
  aria-selected={active}
  tabindex="-1"
  {onclick}
  {onkeydown}
>
  <span class="twist" class:open={expanded} aria-hidden="true">
    {#if isFolder}<Icon name="chevronRight" size="sm" />{/if}
  </span>
  <span class="kind" aria-hidden="true">
    <Icon
      name={isFolder ? (expanded ? "folderOpen" : "folder") : "fileText"}
      size="sm"
    />
  </span>
  <span class="label">{label}</span>
  {#if badge}<span class="badge">{badge}</span>{/if}
  {#if actions}
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <span class="actions" onclick={(event) => event.stopPropagation()}>
      {@render actions()}
    </span>
  {/if}
</div>
{#if isFolder && expanded && children}
  {@render children()}
{/if}

<style>
  .row {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    height: var(--control-sm);
    padding-left: calc(var(--space-1) + (var(--level) - 1) * var(--space-4));
    padding-right: var(--space-1);
    color: var(--color-text);
    border-radius: var(--radius-sm);
    cursor: pointer;
    user-select: none;
  }

  .row:hover {
    background: var(--color-hover);
  }

  .row.active {
    background: var(--color-accent-soft);
    color: var(--color-accent-soft-text);
    font-weight: var(--weight-medium);
  }

  .row:focus-visible {
    outline: none;
    box-shadow: inset 0 0 0 2px var(--color-focus-ring);
  }

  .twist {
    display: inline-grid;
    place-items: center;
    width: var(--icon-sm);
    flex: none;
    color: var(--color-text-faint);
    transition: rotate var(--duration-fast) var(--ease-standard);
  }

  .twist.open {
    rotate: 90deg;
  }

  .kind {
    display: inline-grid;
    flex: none;
    color: var(--color-text-muted);
  }

  .active .kind {
    color: inherit;
  }

  .label {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .badge {
    font-size: var(--text-2xs);
    color: var(--color-text-muted);
    font-variant-numeric: tabular-nums;
  }

  .actions {
    display: none;
    gap: var(--space-0-5);
  }

  .row:hover .actions,
  .row:focus-within .actions,
  .row:focus-visible .actions {
    display: flex;
  }
</style>
