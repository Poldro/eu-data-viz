<script lang="ts">
  import { tip } from '../lib/tooltip.svelte';

  const WIDTH = 240;
  let viewport = $state(1200);
  // Tiene il riquadro dentro la finestra anche vicino al bordo destro.
  const left = $derived(Math.max(8, Math.min(tip.x + 14, viewport - WIDTH - 8)));
</script>

<svelte:window bind:innerWidth={viewport} />

{#if tip.visible}
  <div class="tip" role="status" style:left="{left}px" style:top="{tip.y + 16}px" style:width="{WIDTH}px">
    <strong>{tip.title}</strong>
    {#each tip.rows as [label, value] (label)}
      <div class="row"><span>{label}</span><span class="figure">{value}</span></div>
    {/each}
  </div>
{/if}

<style>
  .tip {
    position: fixed;
    z-index: 50;
    padding: 9px 11px;
    background: var(--ink);
    color: var(--paper);
    font-size: 0.8rem;
    line-height: 1.3;
    pointer-events: none;
    box-shadow: 4px 4px 0 rgb(27 26 23 / 0.18);
  }
  strong {
    display: block;
    margin-bottom: 4px;
    font-family: var(--font-display);
    font-weight: 600;
    font-size: 0.92rem;
  }
  .row {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    padding-top: 3px;
    border-top: 1px solid rgb(245 240 230 / 0.18);
    margin-top: 3px;
    color: #d9d2c3;
  }
  .figure {
    color: var(--paper);
    white-space: nowrap;
  }
</style>
