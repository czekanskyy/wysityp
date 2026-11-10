<script lang="ts">
  import { tick } from "svelte";
  import Icon from "./Icon.svelte";
  import Kbd from "./Kbd.svelte";
  import type { MenuEntry, MenuItem } from "./types";

  let {
    label,
    entries,
    compact = false,
    wide = false,
    returnFocus = true,
    onClose,
  }: {
    label: string;
    entries: readonly MenuEntry[];
    compact?: boolean;
    wide?: boolean;
    returnFocus?: boolean;
    onClose?: () => void;
  } = $props();

  let open = $state(false);
  let placed = $state(false);
  let topPx = $state(0);
  let leftPx = $state(0);
  let triggerEl = $state<HTMLButtonElement | null>(null);
  let menuEl = $state<HTMLDivElement | null>(null);

  function isItem(entry: MenuEntry): entry is MenuItem {
    return entry.separator !== true;
  }

  function canOpen(): boolean {
    return entries.some((entry) => isItem(entry) && !entry.disabled);
  }

  function place() {
    if (!triggerEl || !menuEl) return;
    const trigger = triggerEl.getBoundingClientRect();
    const menu = menuEl.getBoundingClientRect();
    const rtl = getComputedStyle(triggerEl).direction === "rtl";
    let left = rtl ? trigger.right - menu.width : trigger.left;
    const pastEnd = rtl ? left < 8 : left + menu.width > window.innerWidth - 8;
    if (pastEnd)
      left = rtl ? trigger.left : Math.max(8, trigger.right - menu.width);
    const spaceBelow = window.innerHeight - trigger.bottom;
    const placeAbove = spaceBelow < menu.height && trigger.top > menu.height;
    topPx = placeAbove
      ? Math.max(8, trigger.top - menu.height)
      : trigger.bottom;
    leftPx = left;
    placed = true;
  }

  function close(restore: boolean) {
    const wasOpen = open;
    open = false;
    placed = false;
    if (restore && returnFocus) triggerEl?.focus();
    if (wasOpen) onClose?.();
  }

  function toggle() {
    if (open) {
      close(true);
      return;
    }
    if (!canOpen()) return;
    open = true;
  }

  function run(entry: MenuItem) {
    if (entry.disabled) return;
    entry.onclick();
    close(true);
  }

  function onMenuKey(event: KeyboardEvent) {
    if (!menuEl) return;
    const items = [
      ...menuEl.querySelectorAll<HTMLButtonElement>(
        "button.menu-item:not(:disabled)",
      ),
    ];
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (items.length === 0) return;
      const next =
        event.key === "ArrowDown"
          ? items[(index + 1) % items.length]
          : items[(index - 1 + items.length) % items.length];
      next?.focus();
      return;
    }
    if (event.key === "Escape" || event.key === "Tab") {
      event.preventDefault();
      close(true);
    }
  }

  $effect(() => {
    if (!open || !menuEl || !triggerEl) return;
    place();
    // placed flips visibility on the next flush. A hidden item cannot take focus.
    let alive = true;
    tick().then(() => {
      if (!alive || !menuEl?.isConnected) return;
      const first = menuEl.querySelector<HTMLButtonElement>(
        "button.menu-item:not(:disabled)",
      );
      if (first && !menuEl.contains(document.activeElement)) first.focus();
    });

    const onPointer = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (triggerEl?.contains(target) || menuEl?.contains(target)) return;
      close(false);
    };
    const onResize = () => place();
    document.addEventListener("pointerdown", onPointer, true);
    window.addEventListener("resize", onResize);
    return () => {
      alive = false;
      document.removeEventListener("pointerdown", onPointer, true);
      window.removeEventListener("resize", onResize);
    };
  });
</script>

<span class="menu-wrap">
  <button
    type="button"
    class={compact ? "menu-trigger" : "btn ghost"}
    aria-haspopup="menu"
    aria-expanded={open}
    title={label}
    bind:this={triggerEl}
    onclick={toggle}
  >
    <span class="one-line">{label}</span>
    <Icon id="chevronDown" size="sm" />
  </button>
  {#if open}
    <div
      class={["menu", { wide }]}
      role="menu"
      tabindex="-1"
      style:top="{topPx}px"
      style:left="{leftPx}px"
      style:visibility={placed ? "visible" : "hidden"}
      bind:this={menuEl}
      onkeydown={onMenuKey}
    >
      {#each entries as entry, index (index)}
        {#if isItem(entry)}
          <button
            type="button"
            class="menu-item"
            class:danger={entry.danger}
            role="menuitem"
            title={entry.label}
            disabled={entry.disabled}
            aria-disabled={entry.disabled ? "true" : undefined}
            onclick={() => run(entry)}
          >
            {#if entry.icon}
              <Icon id={entry.icon} size="sm" />
            {/if}
            <span class="one-line">{entry.label}</span>
            {#if entry.shortcut?.length}
              <Kbd keys={entry.shortcut} />
            {/if}
          </button>
        {:else}
          <div class="menu-sep" role="separator"></div>
        {/if}
      {/each}
    </div>
  {/if}
</span>
