<script lang="ts">
  import { tick } from "svelte";
  import IconButton from "./IconButton.svelte";
  import SegmentedControl from "./SegmentedControl.svelte";
  import type { SegmentOptions, ToolbarItem } from "./types";

  type Props = {
    label: string;
    items: readonly ToolbarItem[];
    onAction: (id: string) => void;
    viewOptions: SegmentOptions;
    viewValue: string;
    onViewChange: (value: string) => void;
  };

  let { label, items, onAction, viewOptions, viewValue, onViewChange }: Props =
    $props();

  let cursor = $state(0);
  let rowEl = $state<HTMLDivElement | null>(null);

  const stopIndex = $derived.by(() => {
    if (items[cursor] && !items[cursor].disabled) return cursor;
    const enabled = items.findIndex((item) => !item.disabled);
    return enabled === -1 ? 0 : enabled;
  });

  async function move(next: number) {
    cursor = next;
    await tick();
    const buttons = rowEl?.querySelectorAll<HTMLButtonElement>("button");
    buttons?.[next]?.focus();
  }

  function onRowKey(event: KeyboardEvent) {
    if (!rowEl?.contains(event.target as Node)) return;
    if (
      event.key !== "ArrowLeft" &&
      event.key !== "ArrowRight" &&
      event.key !== "Home" &&
      event.key !== "End"
    ) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const indexes = items.flatMap((item, index) =>
      item.disabled ? [] : [index],
    );
    if (indexes.length === 0) return;
    const place = Math.max(0, indexes.indexOf(cursor));
    const last = indexes.length - 1;
    const next =
      event.key === "Home"
        ? indexes[0]
        : event.key === "End"
          ? indexes[last]
          : event.key === "ArrowRight"
            ? indexes[(place + 1) % indexes.length]
            : indexes[(place - 1 + indexes.length) % indexes.length];
    if (next !== undefined) void move(next);
  }
</script>

<div
  class="toolbar"
  role="toolbar"
  aria-label={label}
  tabindex="-1"
  onkeydown={onRowKey}
>
  <div class="toolbar-items" bind:this={rowEl}>
    {#each items as item, index (item.id)}
      <IconButton
        label={item.label}
        icon={item.icon}
        size="sm"
        pressed={item.pressed}
        disabled={item.disabled}
        tabindex={index === stopIndex ? 0 : -1}
        onclick={() => onAction(item.id)}
      />
    {/each}
  </div>
  <SegmentedControl
    {label}
    options={viewOptions}
    value={viewValue}
    onchange={onViewChange}
  />
</div>
