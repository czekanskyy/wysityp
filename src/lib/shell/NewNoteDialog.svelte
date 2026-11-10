<script lang="ts">
  import type { Session } from "../state/session.svelte";

  let { session }: { session: Session } = $props();

  function focusDialog(node: HTMLElement) {
    node.focus();
  }
</script>

{#if session.newNoteOpen}
  <div class="modal-backdrop">
    <button
      type="button"
      class="modal-dismiss"
      aria-label={session.labels.cancel}
      onclick={() => session.closeNewNote()}
    ></button>
    <div
      class="new-note-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-note-title"
      tabindex="-1"
      {@attach focusDialog}
    >
      <h2 id="new-note-title">{session.labels.newNote}</h2>
      <p class="muted">{session.labels.newNoteHint}</p>
      {#if !session.templateFolderReady}
        <p class="muted">{session.labels.templateFolderUnavailable}</p>
      {/if}
      <ul class="new-choices">
        {#each session.choices as choice, index (`${choice.kind}:${choice.stem}`)}
          <li class="new-choice">
            <button
              type="button"
              class={{ selected: index === session.highlight }}
              aria-current={index === session.highlight ? "true" : undefined}
              onclick={() => {
                session.highlight = index;
                void session.confirmNewNote();
              }}
            >
              {choice.label}
            </button>
            {#if choice.secondary}
              <button
                type="button"
                class="ghost"
                onclick={() => void session.secondaryChoice(index)}
              >
                {choice.secondary}
              </button>
            {/if}
          </li>
        {/each}
      </ul>
    </div>
  </div>
{/if}
