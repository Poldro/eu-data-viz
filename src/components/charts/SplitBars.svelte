<script lang="ts">
  import { hideTip, showTip } from '../../lib/tooltip.svelte';

  export interface SplitPart {
    key: string;
    label: string;
    /** Variabile CSS del colore: segue la voce, non la sua grandezza. */
    color: string;
    /** Le voci tratteggiate indicano ciò che manca, non ciò che è stato speso. */
    hatched?: boolean;
  }

  export interface SplitRow {
    key: string;
    label: string;
    detail?: string;
    accent?: boolean;
    /** Un valore per ogni voce, nello stesso ordine di `parts`. */
    values: number[];
    /** Nomi delle voci validi solo per questa riga, per chiave: sostituiscono quelli di `parts`. */
    labels?: Record<string, string>;
  }

  interface Props {
    parts: SplitPart[];
    rows: SplitRow[];
    format: (value: number) => string;
  }

  const { parts, rows, format }: Props = $props();
  const total = (row: SplitRow): number => row.values.reduce((a, b) => a + b, 0);
  const share = (row: SplitRow, i: number): number => (total(row) > 0 ? (row.values[i] / total(row)) * 100 : 0);
  const name = (row: SplitRow, part: SplitPart): string => row.labels?.[part.key] ?? part.label;
  const tipRows = (row: SplitRow): [string, string][] => parts.map((part, i) => [name(row, part), format(row.values[i])]);
</script>

<ul class="legend">
  {#each parts as part (part.key)}
    <li><i class:hatched={part.hatched} style:--c="var({part.color})"></i>{part.label}</li>
  {/each}
</ul>

<ol class="rows">
  {#each rows as row (row.key)}
    <li class:accent={row.accent} onmousemove={(e) => showTip(e, row.label, tipRows(row))} onmouseleave={hideTip}>
      <div class="head">
        <span class="label">{row.label}</span>
        {#if row.detail}<span class="detail">{row.detail}</span>{/if}
      </div>
      <div class="bar" role="img" aria-label="{row.label}: {tipRows(row).map(([k, v]) => `${k} ${v}`).join(', ')}">
        {#each parts as part, i (part.key)}
          <span class="seg" class:hatched={part.hatched} style:--c="var({part.color})" style:flex-basis="{share(row, i)}%"></span>
        {/each}
      </div>
      <dl class="values">
        {#each parts as part, i (part.key)}
          <div>
            <dt><i class:hatched={part.hatched} style:--c="var({part.color})"></i>{name(row, part)}</dt>
            <dd class="figure">{format(row.values[i])}</dd>
          </div>
        {/each}
      </dl>
    </li>
  {/each}
</ol>

<style>
  .legend,
  .rows {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 18px;
    margin-bottom: 6px;
    font-family: var(--font-data);
    font-size: 0.66rem;
    letter-spacing: 0.04em;
    color: var(--ink-2);
  }
  .legend li,
  dt {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  i {
    flex: none;
    width: 12px;
    height: 12px;
    background: var(--c);
  }
  i.hatched,
  .seg.hatched {
    background: repeating-linear-gradient(135deg, var(--c) 0 2px, transparent 2px 6px);
    box-shadow: inset 0 0 0 1px var(--c);
  }
  .rows li {
    padding: 14px 0 16px;
    border-bottom: 1px solid var(--rule-soft);
  }
  .head {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: 4px 12px;
  }
  .label {
    font-family: var(--font-display);
    font-size: 1.12rem;
  }
  .accent .label {
    color: var(--accent-ink);
    font-weight: 600;
  }
  .detail {
    font-family: var(--font-data);
    font-size: 0.68rem;
    color: var(--ink-3);
  }
  .bar {
    display: flex;
    gap: 2px;
    height: 26px;
    margin-top: 8px;
  }
  .seg {
    flex: 0 0 auto;
    min-width: 3px;
    background: var(--c);
    transition: flex-basis 0.45s cubic-bezier(0.2, 0.7, 0.2, 1);
  }
  .seg:last-child {
    flex-shrink: 1;
    border-radius: 0 3px 3px 0;
  }
  .values {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 22px;
    margin: 8px 0 0;
  }
  .values div {
    display: flex;
    align-items: baseline;
    gap: 8px;
  }
  dt {
    font-size: 0.86rem;
    color: var(--ink-2);
  }
  dt i {
    align-self: center;
    width: 9px;
    height: 9px;
  }
  dd {
    margin: 0;
    font-size: 0.86rem;
  }
</style>
