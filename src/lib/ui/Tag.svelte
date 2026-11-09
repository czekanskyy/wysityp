<script lang="ts">
  import Icon from "./Icon.svelte";
  import type { TagColor } from "./types";

  type Base = {
    label: string;
    color: TagColor;
    pressed?: boolean;
    onclick?: () => void;
  };

  type Props = Base &
    (
      | { onremove: () => void; removeLabel: string }
      | { onremove?: undefined; removeLabel?: undefined }
    );

  let { label, color, pressed, onclick, onremove, removeLabel }: Props =
    $props();
</script>

<span class="tag {color}" class:pressed={pressed === true}>
  {#if onclick}
    <button
      type="button"
      class="tag-main"
      title={label}
      aria-pressed={pressed === undefined
        ? undefined
        : pressed
          ? "true"
          : "false"}
      {onclick}
    >
      <span class="one-line">{label}</span>
    </button>
  {:else}
    <span class="tag-text one-line" title={label}>{label}</span>
  {/if}
  {#if onremove !== undefined && removeLabel !== undefined}
    <button
      type="button"
      class="tag-remove"
      aria-label={removeLabel}
      title={removeLabel}
      onclick={onremove}
    >
      <Icon id="close" size="sm" />
    </button>
  {/if}
</span>
