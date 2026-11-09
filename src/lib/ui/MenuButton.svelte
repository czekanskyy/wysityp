<script lang="ts">
  import { tick } from "svelte";
  import Icon from "./Icon.svelte";
  import type { IconName } from "./icons";
  import Menu from "./Menu.svelte";
  import type { MenuEntry } from "./menu";

  interface Props {
    /** Accessible name of the trigger and the menu. */
    label: string;
    entries: MenuEntry[];
    icon?: IconName;
    /** Visible trigger text. Without it, the trigger is icon only. */
    text?: string;
    align?: "start" | "end";
  }

  let {
    label,
    entries,
    icon = "more",
    text,
    align = "start",
  }: Props = $props();

  let open = $state(false);
  let trigger: HTMLButtonElement | undefined = $state();
  let wrapper: HTMLSpanElement | undefined = $state();
  const uid = $props.id();

  async function show() {
    open = true;
    await tick();
  }

  function close(returnFocus = true) {
    if (!open) return;
    open = false;
    if (returnFocus) trigger?.focus();
  }

  function onTriggerKeydown(event: KeyboardEvent) {
    if (
      event.key === "ArrowDown" ||
      event.key === "Enter" ||
      event.key === " "
    ) {
      event.preventDefault();
      void show();
    }
  }

  function onWindowPointerdown(event: PointerEvent) {
    if (open && wrapper && !wrapper.contains(event.target as Node))
      close(false);
  }
</script>

<svelte:window onpointerdown={onWindowPointerdown} />

<span class="menu-button" bind:this={wrapper}>
  <button
    bind:this={trigger}
    type="button"
    class="trigger"
    class:icon-only={!text}
    aria-haspopup="menu"
    aria-expanded={open}
    aria-controls={open ? `menu-${uid}` : undefined}
    aria-label={text ? undefined : label}
    title={text ? undefined : label}
    onclick={() => (open ? close() : show())}
    onkeydown={onTriggerKeydown}
  >
    <Icon name={icon} size="sm" />
    {#if text}<span>{text}</span><Icon name="chevronDown" size="sm" />{/if}
  </button>
  {#if open}
    <div class="popover align-{align}" id="menu-{uid}">
      <Menu {label} {entries} onclose={() => close()} />
    </div>
  {/if}
</span>

<style>
  .menu-button {
    position: relative;
    display: inline-flex;
  }

  .trigger {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    height: var(--control-sm);
    padding: 0 var(--space-2);
    font-size: var(--text-sm);
    color: var(--color-text-muted);
    background: transparent;
    border: 0;
    border-radius: var(--radius-sm);
    cursor: pointer;
  }

  .trigger.icon-only {
    width: var(--control-sm);
    padding: 0;
    justify-content: center;
  }

  .trigger:hover,
  .trigger[aria-expanded="true"] {
    background: var(--color-hover);
    color: var(--color-text);
  }

  .trigger:focus-visible {
    outline: none;
    box-shadow: var(--shadow-focus);
  }

  .popover {
    position: absolute;
    top: calc(100% + var(--space-1));
    z-index: var(--z-dropdown);
    animation: pop var(--duration-base) var(--ease-out);
  }

  .align-start {
    left: 0;
  }

  .align-end {
    right: 0;
  }

  @keyframes pop {
    from {
      opacity: 0;
      translate: 0 -4px;
    }
  }
</style>
