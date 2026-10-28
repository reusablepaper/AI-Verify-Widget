<script lang="ts">
  import type { HistoryEntry } from '../../../../main/data/schema'
  import { historyEntryLabel, formatHistoryDate } from '../historyLabels'

  interface Props {
    history: HistoryEntry[]
    onEdit: (entryId: string, patch: { at?: string; note?: string }) => void
    onDelete: (entryId: string) => void
  }
  const { history, onEdit, onDelete }: Props = $props()

  let editingId = $state<string | null>(null)
  let draftDate = $state('')
  let draftNote = $state('')

  const sorted = $derived([...history].sort((a, b) => a.at.localeCompare(b.at)))

  function startEdit(entry: HistoryEntry): void {
    editingId = entry.id
    draftDate = entry.at.slice(0, 10)
    draftNote = entry.note ?? ''
  }

  function saveEdit(entry: HistoryEntry): void {
    const at = draftDate ? new Date(`${draftDate}T${entry.at.slice(11)}`).toISOString() : undefined
    onEdit(entry.id, { at, note: draftNote || undefined })
    editingId = null
  }
</script>

<ul class="history">
  {#each sorted as entry (entry.id)}
    <li>
      {#if editingId === entry.id}
        <div class="edit-row">
          <input type="date" bind:value={draftDate} />
          <input type="text" placeholder="메모 (선택)" bind:value={draftNote} />
          <button class="link" onclick={() => saveEdit(entry)}>저장</button>
          <button class="link danger" onclick={() => onDelete(entry.id)}>삭제</button>
          <button class="link" onclick={() => (editingId = null)}>취소</button>
        </div>
      {:else}
        <button class="entry-row" onclick={() => startEdit(entry)}>
          <span class="label">{historyEntryLabel(entry)}</span>
          <span class="date">{formatHistoryDate(entry.at)}</span>
        </button>
        {#if entry.note}
          <div class="note">{entry.note}</div>
        {/if}
      {/if}
    </li>
  {/each}
  {#if sorted.length === 0}
    <li class="empty">기록 없음</li>
  {/if}
</ul>

<style>
  .history {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .entry-row {
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    background: none;
    border: none;
    padding: 4px 2px;
    text-align: left;
    border-radius: 6px;
  }

  .entry-row:hover {
    background: var(--color-surface-muted);
  }

  .label {
    font-size: 12.5px;
    color: var(--color-text-primary);
  }

  .date {
    font-size: 11px;
    color: var(--color-text-muted);
    white-space: nowrap;
    margin-left: 12px;
  }

  .note {
    font-size: 11.5px;
    color: var(--color-text-secondary);
    padding: 0 2px 4px 10px;
  }

  .empty {
    font-size: 12px;
    color: var(--color-text-muted);
    padding: 4px 2px;
  }

  .edit-row {
    display: flex;
    gap: 6px;
    align-items: center;
    padding: 4px 2px;
    flex-wrap: wrap;
  }

  .edit-row input[type='date'] {
    font-family: inherit;
    font-size: 11.5px;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    padding: 2px 4px;
  }

  .edit-row input[type='text'] {
    flex: 1;
    min-width: 60px;
    font-family: inherit;
    font-size: 11.5px;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    padding: 2px 6px;
  }

  .link {
    background: none;
    border: none;
    font-size: 11px;
    color: var(--color-turn-company-text);
    padding: 2px 4px;
  }

  .link.danger {
    color: var(--color-deadline-accent);
  }
</style>
