<script lang="ts">
  interface Props {
    filled: number
    total?: number
  }
  const { filled, total = 8 }: Props = $props()
</script>

<div class="step-bar" role="progressbar" aria-valuenow={filled} aria-valuemax={total}>
  {#each Array(total) as _, i (i)}
    <span class="segment" class:filled={i < filled}></span>
  {/each}
</div>

<style>
  .step-bar {
    display: flex;
    gap: 3px;
  }

  .segment {
    flex: 1;
    height: 4px;
    border-radius: var(--radius-pill);
    background: var(--color-step-empty);
  }

  .segment.filled {
    background: var(--color-step-filled);
  }
</style>
