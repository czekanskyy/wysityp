<script lang="ts">
  import Button from "../ui/Button.svelte";
  import TextField from "../ui/TextField.svelte";
  import type { Session } from "../state/session.svelte";

  let { session }: { session: Session } = $props();

  function focusOnMount(node: HTMLElement) {
    const target = node.matches("input, button, select, textarea")
      ? node
      : node.querySelector<HTMLElement>("input, button, select, textarea");
    (target ?? node).focus();
  }
</script>

{#if session.showFollow}
  <div class="nav-follow">
    {#if session.rootName && (session.searchPending || session.searchTouched)}
      <div aria-busy={session.searchPending ? "true" : undefined}>
        <div aria-live="polite">
          {#if session.searchPending}
            <p class="muted">{session.labels.searchSearching}</p>
          {:else if session.searchHits.length === 0}
            <p class="muted">{session.labels.searchEmpty}</p>
          {/if}
        </div>
        {#if session.searchHits.length > 0}
          <ul class="search-results">
            {#each session.searchHits as hit (`${hit.path}:${hit.line}`)}
              <li>
                <button
                  type="button"
                  class="search-hit"
                  onclick={() => void session.openNote(hit.path)}
                >
                  <span class="path-line">{hit.path}</span>
                  <span>{hit.line}</span>
                  <span class="search-snippet">{hit.snippet}</span>
                </button>
              </li>
            {/each}
          </ul>
        {/if}
      </div>
    {/if}

    {#if session.namingFolder}
      <form
        class="rename-form"
        {@attach focusOnMount}
        onsubmit={(event) => {
          event.preventDefault();
          void session.submitNewFolder();
        }}
      >
        <TextField
          label={session.labels.nameLabel}
          bind:value={session.entryName}
        />
        <div class="row-actions">
          <Button
            variant="primary"
            size="sm"
            label={session.labels.createHere}
            disabled={!session.entryName.trim()}
            onclick={() => void session.submitNewFolder()}
          />
          <Button
            variant="ghost"
            size="sm"
            label={session.labels.cancel}
            onclick={() => session.cancelNewFolder()}
          />
        </div>
      </form>
    {/if}

    {#if session.renamingPath}
      <form
        class="rename-form"
        {@attach focusOnMount}
        onsubmit={(event) => {
          event.preventDefault();
          void session.applyRename();
        }}
      >
        <TextField
          label={session.labels.newPath}
          hint={session.labels.moveHint}
          bind:value={session.renameValue}
        />
        <div class="row-actions">
          <Button
            variant="primary"
            size="sm"
            label={session.labels.applyPath}
            onclick={() => void session.applyRename()}
          />
          <Button
            variant="ghost"
            size="sm"
            label={session.labels.cancel}
            onclick={() => session.cancelRename()}
          />
        </div>
      </form>
    {/if}

    {#if session.pendingDelete}
      <section
        class="confirm"
        aria-labelledby="confirm-title"
        {@attach focusOnMount}
      >
        <p id="confirm-title">{session.labels.confirmDelete}</p>
        <p class="path-line">{session.pendingDelete}</p>
        <div class="row-actions">
          <Button
            variant="danger"
            size="sm"
            label={session.labels.delete}
            onclick={() => void session.confirmDelete()}
          />
          <Button
            variant="ghost"
            size="sm"
            label={session.labels.cancel}
            onclick={() => session.closeDelete()}
          />
        </div>
      </section>
    {/if}

    {#if session.status}
      <p class="status" role="status">{session.status}</p>
    {/if}
  </div>
{/if}
