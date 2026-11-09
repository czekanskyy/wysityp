<script lang="ts" module>
  let fieldSeq = 0;

  function nextFieldId(): string {
    fieldSeq += 1;
    return `field-${fieldSeq}`;
  }
</script>

<script lang="ts">
  import Icon from "./Icon.svelte";
  import type { IconId } from "./icons";

  type Props = {
    label: string;
    value?: string;
    hint?: string;
    error?: string;
    placeholder?: string;
    hideLabel?: boolean;
    icon?: IconId;
  };

  let {
    label,
    value = $bindable(""),
    hint,
    error,
    placeholder,
    hideLabel = false,
    icon,
  }: Props = $props();

  const fieldId = nextFieldId();
  const hintId = `${fieldId}-hint`;
  const errorId = `${fieldId}-error`;
  const describedBy = $derived(
    [hint ? hintId : "", error ? errorId : ""].filter(Boolean).join(" ") ||
      undefined,
  );
</script>

<div class="field" class:invalid={Boolean(error)}>
  <label class="field-label" class:visually-hidden={hideLabel} for={fieldId}>
    {label}
  </label>
  <div class="control">
    {#if icon}
      <span class="lead"><Icon id={icon} size="sm" /></span>
    {/if}
    <input
      id={fieldId}
      class="input"
      class:has-icon={icon !== undefined}
      bind:value
      {placeholder}
      aria-invalid={error ? "true" : undefined}
      aria-describedby={describedBy}
    />
  </div>
  {#if hint}
    <p class="msg" id={hintId}>{hint}</p>
  {/if}
  {#if error}
    <p class="msg" id={errorId} role="alert">
      <Icon id="warning" size="sm" />
      {error}
    </p>
  {/if}
</div>
