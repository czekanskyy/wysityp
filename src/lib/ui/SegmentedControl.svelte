<script lang="ts">
  import Icon from "./Icon.svelte";
  import type { SegmentOptions } from "./types";

  type Props = {
    label: string;
    options: SegmentOptions;
    value?: string;
    onchange?: (value: string) => void | false;
    busy?: boolean;
    describedBy?: string;
  };

  let {
    label,
    options,
    value = $bindable(""),
    onchange,
    busy = false,
    describedBy,
  }: Props = $props();

  const selectedIndex = $derived(
    Math.max(
      0,
      options.findIndex((option) => option.value === value),
    ),
  );

  function choose(next: string) {
    if (busy || next === value) return;
    if (onchange?.(next) === false) return;
    value = next;
  }

  function onKey(event: KeyboardEvent) {
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
    if (busy) return;
    const values = options.map((option) => option.value);
    let index = values.indexOf(value);
    if (index < 0) index = 0;
    if (event.key === "Home") index = 0;
    else if (event.key === "End") index = values.length - 1;
    else if (event.key === "ArrowRight") index = (index + 1) % values.length;
    else index = (index - 1 + values.length) % values.length;
    const next = values[index];
    if (next !== undefined) choose(next);
  }
</script>

<div
  class="seg"
  role="radiogroup"
  aria-label={label}
  aria-describedby={describedBy}
  aria-busy={busy ? "true" : undefined}
  tabindex="-1"
  onkeydown={onKey}
>
  {#each options as option, index (option.value)}
    <button
      type="button"
      class="seg-option"
      role="radio"
      aria-checked={option.value === value}
      aria-label={option.iconOnly ? option.label : undefined}
      title={option.label}
      tabindex={index === selectedIndex ? 0 : -1}
      onclick={() => choose(option.value)}
    >
      {#if option.icon}
        <Icon id={option.icon} size="sm" />
      {/if}
      {#if !option.iconOnly}
        <span class="one-line">{option.label}</span>
      {/if}
    </button>
  {/each}
</div>
