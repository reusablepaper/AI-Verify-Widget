<script lang="ts">
  import type { ActionOption } from '../actions'

  interface Props {
    options: ActionOption[]
    onSelect: (action: ActionOption, note?: string) => void
    onClose: () => void
  }
  const { options, onSelect, onClose }: Props = $props()

  let note = $state('')

  function pick(action: ActionOption): void {
    onSelect(action, note.trim() || undefined)
  }
</script>

<div class="backdrop" onclick={onClose} role="presentation"></div>
<div class="menu" role="menu">
  {#if options.length > 0}
    <div class="section">
      {#each options as action}
        <button class="option" onclick={() => pick(action)}>{action.label}</button>
      {/each}
    </div>
  {:else}
    <div class="empty">지금 할 수 있는 특수사항이 없습니다</div>
  {/if}

  <div class="note-row">
    <input type="text" placeholder="메모 (선택)" bind:value={note} />
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 10;
  }

  .menu {
    position: absolute;
    top: 100%;
    right: 0;
    margin-top: 4px;
    min-width: 170px;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 10px;
    box-shadow: var(--shadow-popover);
    z-index: 11;
    padding: 6px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .section {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .option {
    text-align: left;
    background: none;
    border: none;
    border-radius: 6px;
    padding: 6px 8px;
    font-size: 12.5px;
    color: var(--color-text-primary);
    white-space: nowrap;
  }

  .option:hover {
    background: var(--color-surface-muted);
  }

  .empty {
    font-size: 12px;
    color: var(--color-text-muted);
    padding: 8px;
    text-align: center;
  }

  .note-row {
    border-top: 1px solid var(--color-border);
    padding-top: 4px;
  }

  .note-row input {
    width: 100%;
    font-family: inherit;
    font-size: 11.5px;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    padding: 4px 6px;
  }
</style>
