<script lang="ts">
  import type { HTMLInputAttributes } from "svelte/elements";
  import Icon from "./Icon.svelte";
  import type { IconName } from "./icons";

  interface Props extends Omit<HTMLInputAttributes, "value"> {
    label: string;
    value?: string;
    /** Shown under the field. Replaced by `error` when that is set. */
    hint?: string;
    error?: string;
    icon?: IconName;
    /** Keep the label for screen readers only (search boxes). */
    hideLabel?: boolean;
    input?: HTMLInputElement;
  }

  let {
    label,
    value = $bindable(""),
    hint,
    error,
    icon,
    hideLabel = false,
    input = $bindable(),
    id,
    ...rest
  }: Props = $props();

  const uid = $props.id();
  const fieldId = $derived(id ?? `field-${uid}`);
  const noteId = $derived(`${fieldId}-note`);
  const note = $derived(error || hint);
</script>

<div class="field" class:invalid={!!error}>
  <label class="label" class:visually-hidden={hideLabel} for={fieldId}>
    {label}
  </label>
  <div class="control">
    {#if icon}
      <span class="lead"><Icon name={icon} size="sm" /></span>
    {/if}
    <input
      {...rest}
      bind:this={input}
      bind:value
      id={fieldId}
      class:has-icon={!!icon}
      aria-invalid={error ? "true" : undefined}
      aria-describedby={note ? noteId : undefined}
    />
  </div>
  {#if note}
    <p class="message" id={noteId} role={error ? "alert" : undefined}>
      {#if error}<Icon name="alert" size="sm" />{/if}
      {note}
    </p>
  {/if}
</div>

<style>
  .field {
    display: grid;
    gap: var(--space-1);
    min-width: 0;
  }

  .label {
    font-size: var(--text-xs);
    font-weight: var(--weight-medium);
    color: var(--color-text-muted);
  }

  .control {
    position: relative;
  }

  .lead {
    position: absolute;
    inset-block: 0;
    left: var(--space-2-5);
    display: grid;
    place-items: center;
    color: var(--color-text-faint);
    pointer-events: none;
  }

  input {
    width: 100%;
    height: var(--control-md);
    padding: 0 var(--space-2-5);
    font-family: var(--font-ui);
    font-size: var(--text-md);
    color: var(--color-text);
    background: var(--color-surface-raised);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-xs) inset;
    transition:
      border-color var(--duration-fast) var(--ease-standard),
      box-shadow var(--duration-fast) var(--ease-standard);
  }

  input.has-icon {
    padding-left: calc(var(--space-2-5) + var(--icon-sm) + var(--space-2));
  }

  input::placeholder {
    color: var(--color-text-faint);
  }

  input:hover:not(:disabled) {
    border-color: var(--color-border-strong);
  }

  input:focus-visible {
    outline: none;
    border-color: var(--color-focus-ring);
    box-shadow: 0 0 0 3px
      color-mix(in srgb, var(--color-focus-ring), transparent 75%);
  }

  input:disabled {
    opacity: 0.55;
    background: var(--color-surface-sunken);
  }

  .invalid input {
    border-color: var(--color-danger);
  }

  .invalid input:focus-visible {
    box-shadow: 0 0 0 3px
      color-mix(in srgb, var(--color-danger), transparent 75%);
  }

  .message {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    margin: 0;
    font-size: var(--text-xs);
    color: var(--color-text-muted);
  }

  .invalid .message {
    color: var(--color-danger);
  }
</style>
