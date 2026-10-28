<script lang="ts">
  import type { ProductView } from '../../../../main/productsService'
  import type { ActionOption } from '../actions'
  import Card from './Card.svelte'

  interface Props {
    products: ProductView[]
    onAction: (id: string, action: ActionOption, note?: string) => void
    onUndo: (id: string) => void
    onEditHistory: (id: string, entryId: string, patch: { at?: string; note?: string }) => void
    onDeleteHistory: (id: string, entryId: string) => void
  }
  const { products, onAction, onUndo, onEditHistory, onDeleteHistory }: Props = $props()
</script>

<div class="list">
  {#each products as view (view.id)}
    <Card {view} {onAction} {onUndo} {onEditHistory} {onDeleteHistory} />
  {/each}
  {#if products.length === 0}
    <div class="empty">표시할 제품이 없습니다</div>
  {/if}
</div>

<style>
  .list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 10px;
  }

  .empty {
    text-align: center;
    color: var(--color-text-muted);
    font-size: 12.5px;
    padding: 32px 0;
  }
</style>
