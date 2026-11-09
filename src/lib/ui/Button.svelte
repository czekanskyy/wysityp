<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLButtonAttributes } from "svelte/elements";
  import Icon from "./Icon.svelte";
  import type { IconName } from "./icons";

  interface Props extends HTMLButtonAttributes {
    variant?: "primary" | "secondary" | "ghost" | "danger";
    size?: "sm" | "md";
    icon?: IconName;
    /** Shows a spinner, keeps the width, and blocks clicks. */
    busy?: boolean;
    children: Snippet;
  }

  let {
    variant = "secondary",
    size = "md",
    icon,
    busy = false,
    type = "button",
    disabled,
    children,
    ...rest
  }: Props = $props();
</script>

<button
  {...rest}
  {type}
  class="btn btn-{variant} btn-{size} {rest.class ?? ''}"
  disabled={disabled || busy}
  aria-busy={busy || undefined}
>
  {#if busy}
    <span class="spinner" aria-hidden="true"></span>
  {:else if icon}
    <Icon name={icon} size={size === "sm" ? "sm" : "md"} />
  {/if}
  <span class="label">{@render children()}</span>
</button>

<style>
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-1-5);
    height: var(--control-md);
    padding: 0 var(--space-3);
    border: 1px solid transparent;
    border-radius: var(--radius-md);
    font-family: var(--font-ui);
    font-size: var(--text-sm);
    font-weight: var(--weight-medium);
    line-height: 1;
    white-space: nowrap;
    cursor: pointer;
    user-select: none;
    transition:
      background-color var(--duration-fast) var(--ease-standard),
      border-color var(--duration-fast) var(--ease-standard),
      box-shadow var(--duration-fast) var(--ease-standard);
  }

  .btn-sm {
    height: var(--control-sm);
    padding: 0 var(--space-2);
    font-size: var(--text-xs);
    gap: var(--space-1);
  }

  .btn:focus-visible {
    outline: none;
    box-shadow: var(--shadow-focus);
  }

  .btn:disabled {
    cursor: default;
    opacity: 0.5;
  }

  .btn-primary {
    background: var(--color-accent);
    color: var(--color-on-accent);
    box-shadow: var(--shadow-xs);
  }

  .btn-primary:hover:not(:disabled) {
    background: var(--color-accent-hover);
  }

  .btn-secondary {
    background: var(--color-surface-raised);
    color: var(--color-text);
    border-color: var(--color-border);
    box-shadow: var(--shadow-xs);
  }

  .btn-secondary:hover:not(:disabled) {
    border-color: var(--color-border-strong);
    background: color-mix(
      in srgb,
      var(--color-surface-raised),
      var(--color-text) 4%
    );
  }

  .btn-ghost {
    background: transparent;
    color: var(--color-text-muted);
  }

  .btn-ghost:hover:not(:disabled) {
    background: var(--color-hover);
    color: var(--color-text);
  }

  .btn-danger {
    background: var(--color-danger-fill);
    color: var(--color-on-danger);
  }

  .btn-danger:hover:not(:disabled) {
    background: color-mix(in srgb, var(--color-danger-fill), black 12%);
  }

  .btn:active:not(:disabled) {
    translate: 0 0.5px;
  }

  .spinner {
    width: var(--icon-sm);
    height: var(--icon-sm);
    border: 2px solid currentColor;
    border-right-color: transparent;
    border-radius: var(--radius-full);
    animation: spin 0.7s linear infinite;
  }

  @keyframes spin {
    to {
      rotate: 1turn;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .spinner {
      animation-duration: 2s;
    }
  }
</style>
