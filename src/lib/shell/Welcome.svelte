<script lang="ts">
  import { fileName } from "../tabs";
  import Kbd from "../ui/Kbd.svelte";
  import type { Session } from "../state/session.svelte";

  let { session }: { session: Session } = $props();
</script>

<div class="welcome">
  <p class="welcome-mark">{session.labels.appName}</p>
  <ul class="welcome-actions">
    <li>
      <button
        type="button"
        class="welcome-action"
        onclick={() => void session.requestNewNote()}
      >
        <span>{session.labels.newNote}</span>
        <Kbd keys={["Ctrl", "N"]} />
      </button>
    </li>
    <li>
      <button
        type="button"
        class="welcome-action"
        onclick={() => void session.openLoose()}
      >
        <span>{session.labels.openNote}</span>
        <Kbd keys={["Ctrl", "O"]} />
      </button>
    </li>
    <li>
      <button
        type="button"
        class="welcome-action"
        onclick={() => void session.openFolder()}
      >
        <span>{session.labels.openFolderShort}</span>
        <Kbd keys={["Ctrl", "Shift", "O"]} />
      </button>
    </li>
  </ul>
  <section class="welcome-recent" aria-labelledby="welcome-recent-heading">
    <h2 id="welcome-recent-heading">{session.labels.welcomeRecent}</h2>
    {#if session.recentError}
      <p class="muted">{session.recentError}</p>
    {:else if session.recentPending}
      <p class="muted">{session.labels.recentLoading}</p>
    {:else if session.welcomeItems.length === 0}
      <p class="muted">{session.labels.recentEmpty}</p>
    {:else}
      <ul>
        {#each session.welcomeItems as path (path)}
          <li>
            <button
              type="button"
              class="recent-row"
              onclick={() => void session.openNote(path)}
            >
              <span>{fileName(path)}</span>
              <span class="recent-path">{path}</span>
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  </section>
</div>
