<script lang="ts">
  import type { ProductView } from '../../../../main/productsService'
  import { getCardActions, type ActionOption } from '../actions'
  import StepBar from './StepBar.svelte'
  import HistoryPanel from './HistoryPanel.svelte'
  import ActionMenu from './ActionMenu.svelte'

  interface Props {
    view: ProductView
    onAction: (id: string, action: ActionOption, note?: string) => void
    onUndo: (id: string) => void
    onEditHistory: (id: string, entryId: string, patch: { at?: string; note?: string }) => void
    onDeleteHistory: (id: string, entryId: string) => void
  }
  const { view, onAction, onUndo, onEditHistory, onDeleteHistory }: Props = $props()

  let expanded = $state(false)
  let specialOpen = $state(false)

  const turnClass = $derived(
    view.state.turn === '내 차례' ? 'turn-mine' : view.state.turn === '업체 차례' ? 'turn-company' : 'turn-review'
  )

  const cardActions = $derived(getCardActions(view))

  const pendingExclude = $derived(view.state.completed && !view.state.completionConfirmed)

  function fireMain(): void {
    if (cardActions.mainButton) onAction(view.id, cardActions.mainButton.action)
  }

  function handleSpecialSelect(action: ActionOption, note?: string): void {
    specialOpen = false
    onAction(view.id, action, note)
  }

  function confirmExclude(): void {
    onAction(view.id, { kind: 'confirmExclude', label: '목록에서 제외' })
  }
</script>

<article class="card {turnClass}" class:deadline={view.deadlineImminent}>
  <div class="card-main">
    <div class="title-row">
      <span class="title">{view.companyName} · {view.productName}</span>
    </div>
    {#if !pendingExclude}
      <div class="stage-label">{view.state.stageLabel}</div>
      <StepBar filled={view.state.stepBarFilled} />
    {/if}
  </div>

  {#if pendingExclude}
    <div class="complete-banner">
      <p>완료(적합)으로 확정되었습니다.<br />목록에서 제외할까요?</p>
      <button class="confirm-btn" onclick={confirmExclude}>목록에서 제외</button>
    </div>
  {/if}

  {#if view.state.badges.length > 0}
    <div class="badges">
      {#each view.state.badges as badge}
        <span class="badge">{badge}</span>
      {/each}
    </div>
  {/if}

  <div class="action-row">
    <div class="action-buttons">
      {#if cardActions.mainButton}
        <button class="btn-primary" onclick={fireMain}>{cardActions.mainButton.label}</button>
      {/if}
      {#if cardActions.specialOptions.length > 0}
        <div class="special-wrap">
          <button
            class="btn-outline"
            aria-label="특수사항 메뉴 열기"
            onclick={() => (specialOpen = !specialOpen)}
          >
            특수사항 ▾
          </button>
          {#if specialOpen}
            <ActionMenu
              options={cardActions.specialOptions}
              onSelect={handleSpecialSelect}
              onClose={() => (specialOpen = false)}
            />
          {/if}
        </div>
      {/if}
    </div>

    <div class="icon-buttons">
      <button
        class="icon-btn"
        title="바로 전 기록 되돌리기"
        aria-label="바로 전 기록 되돌리기"
        disabled={view.history.length === 0}
        onclick={() => onUndo(view.id)}
      >
        ↺
      </button>
      <button
        class="icon-btn"
        title={expanded ? '히스토리 접기' : '히스토리 펼치기'}
        aria-label={expanded ? '히스토리 접기' : '히스토리 펼치기'}
        onclick={() => (expanded = !expanded)}
      >
        {expanded ? '▲' : '▼'}
      </button>
    </div>
  </div>

  {#if expanded}
    <div class="history-wrap">
      <HistoryPanel
        history={view.history}
        onEdit={(entryId, patch) => onEditHistory(view.id, entryId, patch)}
        onDelete={(entryId) => onDeleteHistory(view.id, entryId)}
      />
    </div>
  {/if}
</article>

<style>
  .card {
    position: relative;
    border-radius: var(--radius-card);
    box-shadow: var(--shadow-card);
    border: 1px solid var(--color-border);
    background: var(--turn-bg);
    overflow: visible;
  }

  .card.turn-mine {
    --turn-bg: var(--color-turn-mine-bg);
    --turn-text: var(--color-turn-mine-text);
    border-color: var(--color-turn-mine-border);
  }
  .card.turn-company {
    --turn-bg: var(--color-turn-company-bg);
    --turn-text: var(--color-turn-company-text);
    border-color: var(--color-turn-company-border);
  }
  .card.turn-review {
    --turn-bg: var(--color-turn-review-bg);
    --turn-text: var(--color-turn-review-text);
    border-color: var(--color-turn-review-border);
  }

  .card.deadline {
    box-shadow:
      0 0 0 1.5px var(--color-deadline-accent),
      var(--shadow-card);
  }

  .card-main {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 10px 12px 8px;
  }

  .title-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .title {
    font-size: 13px;
    font-weight: 600;
    color: var(--color-text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .stage-label {
    font-size: 11.5px;
    color: var(--color-text-secondary);
  }

  .badges {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    padding: 0 12px 10px;
  }

  .badge {
    font-size: 10.5px;
    padding: 2px 7px;
    border-radius: var(--radius-pill);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    color: var(--color-text-secondary);
  }

  .complete-banner {
    margin: 0 12px 10px;
    padding: 12px 14px;
    border-radius: 10px;
    background: var(--color-step-filled);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    text-align: center;
  }

  .complete-banner p {
    margin: 0;
    font-size: 12.5px;
    line-height: 1.5;
    color: #fff;
  }

  .confirm-btn {
    background: #fff;
    color: var(--color-step-filled);
    border: none;
    border-radius: var(--radius-pill);
    padding: 6px 22px;
    font-size: 12.5px;
    font-weight: 700;
  }

  .confirm-btn:hover {
    opacity: 0.9;
  }

  .action-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
    padding: 0 12px 12px;
  }

  .action-buttons {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }

  .special-wrap {
    position: relative;
  }

  .btn-primary {
    background: var(--turn-text);
    color: #fff;
    border: none;
    border-radius: var(--radius-pill);
    padding: 7px 16px;
    font-size: 12px;
    font-weight: 700;
    white-space: nowrap;
  }

  .btn-primary:hover {
    opacity: 0.92;
  }

  .btn-outline {
    background: var(--color-surface);
    color: var(--turn-text);
    border: 1.5px solid var(--turn-text);
    border-radius: var(--radius-pill);
    padding: 6px 14px;
    font-size: 12px;
    font-weight: 600;
    white-space: nowrap;
  }

  .btn-outline:hover {
    background: color-mix(in srgb, var(--turn-text) 10%, var(--color-surface));
  }

  .icon-buttons {
    display: flex;
    gap: 2px;
    flex-shrink: 0;
  }

  .icon-btn {
    background: none;
    border: none;
    font-size: 11px;
    color: var(--color-text-muted);
    padding: 2px 6px;
    border-radius: 6px;
  }

  .icon-btn:hover:not(:disabled) {
    background: var(--color-surface);
    color: var(--color-text-secondary);
  }

  .icon-btn:disabled {
    opacity: 0.35;
    cursor: default;
  }

  .history-wrap {
    border-top: 1px solid var(--color-border);
    padding: 6px 12px 10px;
    background: var(--color-surface);
    border-bottom-left-radius: var(--radius-card);
    border-bottom-right-radius: var(--radius-card);
  }
</style>
