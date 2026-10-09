<script lang="ts">
  import { HOME_COUNTRY } from '../../lib/countries';
  import { countryStats, filterRows, type CountryStat } from '../../lib/cube';
  import { cubeFor, cubeSource, PERIODS } from '../../lib/data';
  import { filters, filtersQuery } from '../../lib/filters.svelte';
  import { eur, monthIt, pct, perHead } from '../../lib/format';
  import { fundShort } from '../../lib/labels';
  import FilterBar from '../FilterBar.svelte';
  import PageHead from '../PageHead.svelte';

  type SortKey = 'name' | 'planned' | 'perCapita' | 'absorption';
  const COLUMNS: { id: SortKey; label: string }[] = [
    { id: 'name', label: 'Paese' },
    { id: 'planned', label: 'Pianificato' },
    { id: 'perCapita', label: 'Per abitante' },
    { id: 'absorption', label: 'Speso' },
  ];

  const cube = $derived(cubeFor(filters.period));
  const source = $derived(cubeSource(filters.period));
  let sort = $state<SortKey>('planned');

  const compare = (a: CountryStat, b: CountryStat): number =>
    sort === 'name' ? a.name.localeCompare(b.name, 'it') : b[sort] - a[sort];
  const stats = $derived(countryStats(filterRows(cube.rows, { fund: filters.fund })).sort(compare));
  const scope = $derived(
    [filters.fund ? fundShort(filters.fund) : 'Tutti i fondi', PERIODS.find((p) => p.id === filters.period)?.label].join(' · '),
  );
</script>

<PageHead kicker="{scope} · dati a {monthIt(source.asOf)}" title="Ventisette paesi, ventisette conti">
  Ogni Stato membro ha la sua scheda: quanto riceve, per che cosa, a che punto è la spesa, quali regioni hanno incassato di più dal 1986.
</PageHead>

<FilterBar showArea={false} />

<div class="scroll">
  <table>
    <thead>
      <tr>
        {#each COLUMNS as column (column.id)}
          <th scope="col" class:num={column.id !== 'name'} aria-sort={sort === column.id ? (column.id === 'name' ? 'ascending' : 'descending') : 'none'}>
            <button type="button" onclick={() => (sort = column.id)}>{column.label}{sort === column.id ? ' ↓' : ''}</button>
          </th>
        {/each}
      </tr>
    </thead>
    <tbody>
      {#each stats as stat (stat.code)}
        <tr class:home={stat.code === HOME_COUNTRY}>
          <th scope="row"><a href="/paesi/{stat.code.toLowerCase()}/{filtersQuery()}">{stat.name}</a></th>
          <td class="figure">{eur(stat.planned)}</td>
          <td class="figure">{perHead(stat.perCapita)}</td>
          <td class="figure">{pct(stat.absorption)}</td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>

<style>
  .scroll {
    margin-top: 28px;
    overflow-x: auto;
  }
  table {
    width: 100%;
    max-width: 860px;
    border-collapse: collapse;
  }
  thead th {
    padding: 0 0 8px;
    border-bottom: 1px solid var(--rule);
    text-align: left;
  }
  thead button {
    border: 0;
    background: none;
    padding: 4px 0;
    font-family: var(--font-data);
    font-size: 0.66rem;
    font-weight: 500;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--ink-2);
    cursor: pointer;
  }
  thead button:hover,
  th[aria-sort]:not([aria-sort='none']) button {
    color: var(--ink);
  }
  .num,
  td {
    text-align: right;
  }
  tbody th,
  td {
    padding: 9px 0;
    border-bottom: 1px solid var(--rule-soft);
  }
  tbody th {
    text-align: left;
    font-family: var(--font-display);
    font-weight: 500;
    font-size: 1.12rem;
  }
  td {
    font-size: 0.86rem;
    white-space: nowrap;
    padding-left: 16px;
  }
  tbody tr:hover {
    background: var(--paper-deep);
  }
  .home th a {
    color: var(--accent-ink);
  }
  .home {
    box-shadow: inset 3px 0 0 var(--accent);
  }
  .home th {
    padding-left: 10px;
  }
</style>
