<script lang="ts">
  import Icon from "./Icon.svelte";
  import type { IconId } from "./icons";

  type Props = {
    variant: "primary" | "secondary" | "ghost" | "danger";
    size?: "sm" | "md";
    label: string;
    icon?: IconId;
    disabled?: boolean;
    busy?: boolean;
    onclick?: () => void;
  };

  let {
    variant,
    size = "md",
    label,
    icon,
    disabled = false,
    busy = false,
    onclick,
  }: Props = $props();

  const blocked = $derived(disabled || busy);

  function onClick(event: MouseEvent) {
    if (blocked) {
      event.preventDefault();
      return;
    }
    onclick?.();
  }
</script>

<button
  type="button"
  class="btn {variant} {size}"
  disabled={blocked}
  aria-busy={busy ? "true" : undefined}
  aria-disabled={blocked ? "true" : undefined}
  title={label}
  onclick={onClick}
>
  {#if icon}
    <Icon id={icon} size={size === "sm" ? "sm" : "md"} />
  {/if}
  <span class="one-line">{label}</span>
</button>
