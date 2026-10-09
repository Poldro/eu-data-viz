<script lang="ts">
  import { hideTip, showTip } from '../../lib/tooltip.svelte';

  export interface RankItem {
    key: string;
    label: string;
    value: number;
    /** Testo secondario sotto l'etichetta. */
    detail?: string;
    accent?: boolean;
    href?: string;
    /** Righe aggiuntive per il riquadro al passaggio. */
    tip?: [string, string][];
  }

  interface Props {
    items: RankItem[];
    format: (value: number) => string;
    valueLabel: string;
    /** Numera le righe: da usare solo quando l'ordine è una classifica. */
    numbered?: boolean;
  }

  const { items, format, valueLabel, numbered = false }: Props = $props();
  const max = $derived(Math.max(0, ...items.map((i) => i.value)));
</script>

{#if items.length === 0}
  <p class="empty">Nessun importo per questa combinazione di filtri.</p>
{:else}
  <ol class="bars" class:numbered>
    {#each items as item, i (item.key)}
      <li
        class:accent={item.accent}
        onmousemove={(e) => showTip(e, item.label, [[valueLabel, format(item.value)], ...(item.tip ?? [])])}
        onmouseleave={hideTip}
      >
        {#if numbered}<span class="rank figure">{i + 1}</span>{/if}
        <div class="body">
          <div class="head">
            <span class="label">
              {#if item.href}<a href={item.href}>{item.label}</a>{:else}{item.label}{/if}
            </span>
            <span class="value figure">{format(item.value)}</span>
          </div>
          <div class="track"><span class="bar" style:width="{max > 0 ? (item.value / max) * 100 : 0}%"></span></div>
          {#if item.detail}<span class="detail">{item.detail}</span>{/if}
        </div>
      </li>
    {/each}
  </ol>
{/if}

<style>
  .bars {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  li {
    display: flex;
    gap: 10px;
    padding: 7px 0 8px;
    border-bottom: 1px solid var(--rule-soft);
  }
  .rank {
    flex: 0 0 1.6em;
    font-size: 0.7rem;
    line-height: 1.7;
    color: var(--ink-3);
  }
  .body {
    flex: 1;
    min-width: 0;
  }
  .head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
  }
  .label {
    font-size: 0.92rem;
    line-height: 1.25;
    overflow-wrap: anywhere;
  }
  .value {
    flex: none;
    font-size: 0.8rem;
  }
  .track {
    margin-top: 5px;
    height: 6px;
  }
  .bar {
    display: block;
    height: 100%;
    min-width: 1px;
    background: var(--seq-5);
    border-radius: 0 3px 3px 0;
    transition: width 0.45s cubic-bezier(0.2, 0.7, 0.2, 1);
  }
  .accent .bar {
    background: var(--accent);
  }
  .accent .label {
    font-weight: 600;
  }
  .detail {
    display: block;
    margin-top: 3px;
    font-family: var(--font-data);
    font-size: 0.62rem;
    letter-spacing: 0.03em;
    color: var(--ink-3);
  }
  .empty {
    padding: 32px 0;
    color: var(--ink-2);
    font-style: italic;
  }
</style>
