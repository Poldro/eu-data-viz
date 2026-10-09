<script lang="ts">
  import { eur, pct } from '../../lib/format';
  import { hideTip, showTip } from '../../lib/tooltip.svelte';

  export interface AbsorptionRow {
    key: string;
    label: string;
    planned: number;
    decided: number;
    spent: number;
    accent?: boolean;
    href?: string;
  }

  interface Props {
    rows: AbsorptionRow[];
    /** Quota spesa media, tracciata come riferimento verticale. */
    average: number;
    averageLabel: string;
  }

  const { rows, average, averageLabel }: Props = $props();
  const share = (part: number, whole: number) => (whole > 0 ? Math.min(part / whole, 1) : 0);
  const TICKS = [0, 0.25, 0.5, 0.75, 1];
</script>

{#if rows.length === 0}
  <p class="empty">Nessun importo per questa combinazione di filtri.</p>
{:else}
  <div class="chart">
    <div class="legend">
      <span><i class="swatch spent"></i>Speso</span>
      <span><i class="swatch decided"></i>Assegnato a progetti</span>
      <span><i class="swatch planned"></i>Pianificato (100%)</span>
      <span><i class="swatch avg"></i>{averageLabel}: {pct(average)}</span>
    </div>

    <div class="axis row" aria-hidden="true">
      <span></span>
      <div class="scale">
        {#each TICKS as tick (tick)}<span class="figure" style:left="{tick * 100}%">{pct(tick)}</span>{/each}
      </div>
      <span></span>
    </div>

    <ol>
      {#each rows as row (row.key)}
        <li
          class="row"
          class:accent={row.accent}
          onmousemove={(e) =>
            showTip(e, row.label, [
              ['Pianificato', eur(row.planned)],
              ['Assegnato', `${eur(row.decided)} (${pct(share(row.decided, row.planned))})`],
              ['Speso', `${eur(row.spent)} (${pct(share(row.spent, row.planned))})`],
            ])}
          onmouseleave={hideTip}
        >
          <span class="label">
            {#if row.href}<a href={row.href}>{row.label}</a>{:else}{row.label}{/if}
          </span>
          <div class="track">
            <span class="decided" style:width="{share(row.decided, row.planned) * 100}%"></span>
            <span class="spent" style:width="{share(row.spent, row.planned) * 100}%"></span>
            <span class="avg" style:left="{Math.min(average, 1) * 100}%"></span>
          </div>
          <span class="value figure">{pct(share(row.spent, row.planned))}</span>
        </li>
      {/each}
    </ol>
  </div>
{/if}

<style>
  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 18px;
    margin-bottom: 14px;
    font-family: var(--font-data);
    font-size: 0.66rem;
    letter-spacing: 0.04em;
    color: var(--ink-2);
  }
  .legend span {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .swatch {
    display: inline-block;
    width: 14px;
    height: 8px;
  }
  .swatch.spent {
    background: var(--seq-6);
  }
  .swatch.decided {
    background: var(--seq-2);
  }
  .swatch.planned {
    background: var(--paper-deep);
    box-shadow: inset 0 0 0 1px var(--rule-soft);
  }
  .swatch.avg {
    width: 2px;
    height: 12px;
    background: var(--ink);
  }
  ol {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .row {
    display: grid;
    grid-template-columns: minmax(84px, 150px) minmax(0, 1fr) 3.4em;
    align-items: center;
    gap: 12px;
  }
  li.row {
    padding: 4px 0;
    border-bottom: 1px solid var(--rule-soft);
  }
  .label {
    font-size: 0.9rem;
    line-height: 1.2;
  }
  .scale {
    position: relative;
    height: 16px;
  }
  .scale span {
    position: absolute;
    transform: translateX(-50%);
    font-size: 0.6rem;
    color: var(--ink-3);
  }
  .scale span:first-child {
    transform: none;
  }
  .scale span:last-child {
    transform: translateX(-100%);
  }
  .track {
    position: relative;
    height: 14px;
    background: var(--paper-deep);
    box-shadow: inset 0 0 0 1px var(--rule-soft);
  }
  .track .decided,
  .track .spent {
    position: absolute;
    inset: 0 auto 0 0;
    border-radius: 0 3px 3px 0;
    transition: width 0.45s cubic-bezier(0.2, 0.7, 0.2, 1);
  }
  .track .decided {
    background: var(--seq-2);
  }
  .track .spent {
    background: var(--seq-6);
    box-shadow: 2px 0 0 var(--paper);
  }
  .track .avg {
    position: absolute;
    top: -3px;
    bottom: -3px;
    width: 2px;
    margin-left: -1px;
    background: var(--ink);
  }
  .value {
    text-align: right;
    font-size: 0.8rem;
  }
  .accent .label {
    font-weight: 600;
  }
  .accent .track .spent {
    background: var(--accent);
  }
  .accent .value {
    font-weight: 500;
  }
  .empty {
    padding: 32px 0;
    color: var(--ink-2);
    font-style: italic;
  }
</style>
