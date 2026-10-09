<script lang="ts">
  import type { Snippet } from 'svelte';
  import { downloadCsv, type DataTable } from '../lib/csv';
  import type { Source } from '../lib/meta';

  interface Props {
    kicker: string;
    /** Il titolo è la notizia: una frase che dice cosa mostra il grafico. */
    title: string;
    note?: string;
    source: Source;
    /** Gli stessi dati del grafico: alimentano la vista tabellare e il CSV. */
    table: DataTable;
    filename: string;
    children: Snippet;
  }

  const { kicker, title, note, source, table, filename, children }: Props = $props();
  let showTable = $state(false);
</script>

<figure class="frame">
  <figcaption>
    <p class="kicker">{kicker}</p>
    <h2 class="headline">{title}</h2>
    {#if note}<p class="note">{note}</p>{/if}
  </figcaption>

  <div class="plot">
    {#if showTable}
      <div class="table-scroll">
        <table>
          <thead>
            <tr>{#each table.columns as column (column)}<th scope="col">{column}</th>{/each}</tr>
          </thead>
          <tbody>
            {#each table.rows as row, i (i)}
              <tr>{#each row as value, j (j)}<td class:num={typeof value === 'number'}>{typeof value === 'number' ? value.toLocaleString('it-IT') : value}</td>{/each}</tr>
            {/each}
          </tbody>
        </table>
      </div>
    {:else}
      {@render children()}
    {/if}
  </div>

  <footer>
    <p class="source">
      Fonte: <a href={source.url} rel="noopener">{source.name}</a> · riferimento {source.asOf}
    </p>
    <div class="actions">
      <button class="btn" type="button" aria-pressed={showTable} onclick={() => (showTable = !showTable)}>Tabella</button>
      <button class="btn" type="button" onclick={() => downloadCsv(table, filename)}>CSV ↓</button>
    </div>
  </footer>
</figure>

<style>
  .frame {
    margin: 0;
    padding-top: 14px;
    border-top: 1px solid var(--rule);
    min-width: 0;
  }
  .headline {
    margin-top: 6px;
    font-size: clamp(1.25rem, 2.4vw, 1.7rem);
    max-width: 30ch;
  }
  .note {
    margin-top: 8px;
    max-width: var(--measure);
    font-size: 0.93rem;
    color: var(--ink-2);
  }
  .plot {
    margin-top: 18px;
  }
  footer {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 8px 16px;
    margin-top: 14px;
    padding-top: 8px;
    border-top: 1px solid var(--rule-soft);
  }
  .source {
    font-family: var(--font-data);
    font-size: 0.64rem;
    letter-spacing: 0.02em;
    color: var(--ink-3);
  }
  .actions {
    display: flex;
    gap: 6px;
  }
  .table-scroll {
    max-height: 460px;
    overflow: auto;
    border-bottom: 1px solid var(--rule-soft);
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-family: var(--font-data);
    font-size: 0.74rem;
  }
  th {
    position: sticky;
    top: 0;
    background: var(--paper-deep);
    text-align: left;
    font-weight: 500;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    font-size: 0.62rem;
  }
  th,
  td {
    padding: 6px 10px 6px 0;
    border-bottom: 1px solid var(--rule-soft);
  }
  th:first-child,
  td:first-child {
    padding-left: 6px;
  }
  td.num {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
</style>
