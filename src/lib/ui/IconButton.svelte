<script lang="ts">
  import type { HTMLButtonAttributes } from "svelte/elements";
  import Icon from "./Icon.svelte";
  import type { IconName } from "./icons";

  interface Props extends HTMLButtonAttributes {
    icon: IconName;
    /** Required: the accessible name and the hover hint. */
    label: string;
    /** Shortcut shown in the hover hint, e.g. "Ctrl+B". */
    shortcut?: string;
    size?: "sm" | "md";
    /** A toggle (bold on/off). Leave undefined for a plain action. */
    pressed?: boolean;
  }

  let {
    icon,
    label,
    shortcut,
    size = "md",
    pressed,
    type = "button",
    ...rest
  }: Props = $props();
</script>

<button
  {...rest}
  {type}
  class="icon-btn icon-btn-{size} {rest.class ?? ''}"
  aria-label={label}
  aria-pressed={pressed}
  title={shortcut ? `${label} (${shortcut})` : label}
>
  <Icon name={icon} size={size === "sm" ? "sm" : "md"} />
</button>

<style>
  .icon-btn {
    display: inline-grid;
    place-items: center;
    width: var(--control-md);
    height: var(--control-md);
    padding: 0;
    border: 0;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--color-text-muted);
    cursor: pointer;
    transition:
      background-color var(--duration-fast) var(--ease-standard),
      color var(--duration-fast) var(--ease-standard);
  }

  .icon-btn-sm {
    width: var(--control-sm);
    height: var(--control-sm);
  }

  .icon-btn:hover:not(:disabled) {
    background: var(--color-hover);
    color: var(--color-text);
  }

  .icon-btn:active:not(:disabled) {
    background: var(--color-pressed);
  }

  .icon-btn[aria-pressed="true"] {
    background: var(--color-accent-soft);
    color: var(--color-accent-soft-text);
  }

  .icon-btn:focus-visible {
    outline: none;
    box-shadow: var(--shadow-focus);
  }

  .icon-btn:disabled {
    opacity: 0.4;
    cursor: default;
  }
</style>
