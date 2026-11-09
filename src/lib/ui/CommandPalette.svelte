<script lang="ts">
  import { tick } from "svelte";
  import { filterCommands, type Command } from "./commands";
  import Icon from "./Icon.svelte";
  import Kbd from "./Kbd.svelte";

  interface Props {
    open: boolean;
    commands: Command[];
    /** Accessible name of the dialog, e.g. "Paleta poleceń". */
    label: string;
    placeholder: string;
    /** Shown when nothing matches. */
    emptyText: string;
    /** Footer hints, already translated. */
    hints: { move: string; run: string; close: string };
  }

  let {
    open = $bindable(false),
    commands,
    label,
    placeholder,
    emptyText,
    hints,
  }: Props = $props();

  const uid = $props.id();
  let dialog: HTMLDialogElement | undefined = $state();
  let input: HTMLInputElement | undefined = $state();
  let query = $state("");
  let active = $state(0);
  let returnTo: HTMLElement | null = null;
  let chosen: Command | null = null;

  const results = $derived(filterCommands(commands, query));
  // Groups keep first appearance order, so ranking still reads top down.
  const groups = $derived.by(() => {
    const out: [string, { command: Command; index: number }[]][] = [];
    results.forEach((command, index) => {
      const key = command.group ?? "";
      let entry = out.find(([name]) => name === key);
      if (!entry) {
        entry = [key, []];
        out.push(entry);
      }
      entry[1].push({ command, index });
    });
    return out;
  });
  const flat = $derived(
    groups.flatMap(([, entries]) => entries.map((e) => e.command)),
  );
  const optionId = (index: number) => `cmd-${uid}-${index}`;

  $effect(() => {
    if (!dialog) return;
    if (open && !dialog.open) {
      returnTo = document.activeElement as HTMLElement | null;
      query = "";
      active = 0;
      dialog.showModal();
      void tick().then(() => input?.focus());
    } else if (!open && dialog.open) {
      dialog.close();
    }
  });

  $effect(() => {
    // Reset the highlight when the query changes the list.
    void query;
    active = 0;
  });

  function onclose() {
    open = false;
    // Focus goes back first, so a command that moves focus wins.
    returnTo?.focus();
    const command = chosen;
    chosen = null;
    command?.run();
  }

  async function scrollActive() {
    await tick();
    document
      .getElementById(optionId(active))
      ?.scrollIntoView({ block: "nearest" });
  }

  function run(command: Command | undefined) {
    if (!command) return;
    chosen = command;
    dialog?.close();
  }

  function onkeydown(event: KeyboardEvent) {
    if (event.isComposing) return;
    const count = flat.length;
    if (event.key === "ArrowDown" && count) {
      event.preventDefault();
      active = (active + 1) % count;
      void scrollActive();
    } else if (event.key === "ArrowUp" && count) {
      event.preventDefault();
      active = (active - 1 + count) % count;
      void scrollActive();
    } else if (event.key === "Enter") {
      event.preventDefault();
      run(flat[active]);
    }
  }

  function onBackdropClick(event: MouseEvent) {
    if (event.target === dialog) open = false;
  }
</script>

<!-- Escape and focus are handled by the native dialog; the click only catches the backdrop. -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<dialog
  bind:this={dialog}
  class="palette"
  aria-label={label}
  {onclose}
  onclick={onBackdropClick}
>
  <div class="search">
    <Icon name="search" />
    <input
      bind:this={input}
      bind:value={query}
      type="text"
      role="combobox"
      aria-label={label}
      aria-expanded="true"
      aria-controls="cmd-list-{uid}"
      aria-autocomplete="list"
      aria-activedescendant={flat.length ? optionId(active) : undefined}
      autocomplete="off"
      spellcheck="false"
      {placeholder}
      {onkeydown}
    />
  </div>

  <div class="list" id="cmd-list-{uid}" role="listbox" aria-label={label}>
    {#each groups as [group, entries] (group)}
      <div role="group" aria-label={group || undefined}>
        {#if group}<div class="group" aria-hidden="true">{group}</div>{/if}
        {#each entries as { command } (command.id)}
          {@const index = flat.indexOf(command)}
          <!-- Keys go through the combobox input (aria-activedescendant). -->
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <div
            id={optionId(index)}
            role="option"
            tabindex="-1"
            class="option"
            aria-selected={index === active}
            onpointermove={() => (active = index)}
            onclick={() => run(command)}
          >
            <span class="icon">
              {#if command.icon}<Icon name={command.icon} />{/if}
            </span>
            <span class="title">{command.title}</span>
            {#if command.shortcut}<Kbd keys={command.shortcut} />{/if}
          </div>
        {/each}
      </div>
    {:else}
      <p class="empty">{emptyText}</p>
    {/each}
  </div>

  <footer class="footer" aria-hidden="true">
    <span><Kbd keys={["↑", "↓"]} /> {hints.move}</span>
    <span><Kbd keys={["Enter"]} /> {hints.run}</span>
    <span><Kbd keys={["Esc"]} /> {hints.close}</span>
  </footer>
</dialog>

<style>
  .palette {
    width: min(var(--palette-width), calc(100vw - var(--space-8)));
    max-height: min(32rem, calc(100vh - 8rem));
    margin: 12vh auto auto;
    padding: 0;
    display: none;
    flex-direction: column;
    color: var(--color-text);
    background: var(--color-surface-raised);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-lg);
    overflow: hidden;
  }

  .palette[open] {
    display: flex;
    animation: rise var(--duration-base) var(--ease-out);
  }

  .palette::backdrop {
    background: var(--color-overlay);
  }

  .search {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: 0 var(--space-4);
    color: var(--color-text-muted);
    border-bottom: 1px solid var(--color-border);
  }

  input {
    flex: 1;
    height: var(--control-lg);
    padding: var(--space-2) 0;
    font-size: var(--text-lg);
    color: var(--color-text);
    background: none;
    border: 0;
    box-sizing: content-box;
  }

  input:focus-visible {
    outline: none;
  }

  input::placeholder {
    color: var(--color-text-faint);
  }

  .list {
    flex: 1;
    overflow: auto;
    padding: var(--space-1-5);
  }

  .group {
    padding: var(--space-2) var(--space-2-5) var(--space-1);
    font-size: var(--text-2xs);
    font-weight: var(--weight-semibold);
    letter-spacing: var(--tracking-caps);
    text-transform: uppercase;
    color: var(--color-text-muted);
  }

  .option {
    display: flex;
    align-items: center;
    gap: var(--space-2-5);
    min-height: var(--control-md);
    padding: 0 var(--space-2-5);
    font-size: var(--text-md);
    border-radius: var(--radius-md);
    cursor: pointer;
  }

  .option[aria-selected="true"] {
    background: var(--color-accent-soft);
    color: var(--color-accent-soft-text);
  }

  .icon {
    display: inline-grid;
    width: var(--icon-md);
    color: var(--color-text-muted);
  }

  .option[aria-selected="true"] .icon {
    color: inherit;
  }

  .title {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .empty {
    margin: 0;
    padding: var(--space-6) var(--space-4);
    text-align: center;
    color: var(--color-text-muted);
  }

  .footer {
    display: flex;
    gap: var(--space-4);
    padding: var(--space-2) var(--space-4);
    font-size: var(--text-xs);
    color: var(--color-text-muted);
    background: var(--color-bg);
    border-top: 1px solid var(--color-border);
  }

  .footer span {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1-5);
  }

  @keyframes rise {
    from {
      opacity: 0;
      translate: 0 6px;
      scale: 0.98;
    }
  }
</style>
