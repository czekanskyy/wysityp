<script lang="ts">
  import Icon from "./Icon.svelte";
  import type { IconId } from "./icons";

  type Props = {
    label: string;
    icon: IconId;
    size?: "sm" | "md";
    pressed?: boolean;
    disabled?: boolean;
    shortcut?: readonly string[];
    tabindex?: number;
    onclick?: () => void;
  };

  let {
    label,
    icon,
    size = "md",
    pressed,
    disabled = false,
    shortcut,
    tabindex = 0,
    onclick,
  }: Props = $props();

  const keys = $derived(shortcut?.length ? shortcut.join("+") : "");
  const tip = $derived(keys ? `${label} (${keys})` : label);
</script>

<button
  type="button"
  class="ibtn {size}"
  aria-label={label}
  title={tip}
  aria-keyshortcuts={keys || undefined}
  aria-pressed={pressed === undefined ? undefined : pressed ? "true" : "false"}
  aria-disabled={disabled ? "true" : undefined}
  {disabled}
  tabindex={disabled ? -1 : tabindex}
  onclick={() => {
    if (disabled) return;
    onclick?.();
  }}
>
  <Icon id={icon} size={size === "sm" ? "sm" : "md"} />
</button>
