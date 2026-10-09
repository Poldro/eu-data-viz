<script lang="ts">
  import { areaName, HOME_COUNTRY } from '../../lib/countries';
  import { countryStats, filterRows, groupBy, ratio, totals } from '../../lib/cube';
  import { cubeFor, cubeSource, PERIODS } from '../../lib/data';
  import { filters, filtersQuery } from '../../lib/filters.svelte';
  import { lowerFirst, monthIt, ordinal, pct } from '../../lib/format';
  import { fundLong, fundShort, objectiveLabel } from '../../lib/labels';
  import ChartFrame from '../ChartFrame.svelte';
  import FilterBar from '../FilterBar.svelte';
  import PageHead from '../PageHead.svelte';
  import Tooltip from '../Tooltip.svelte';
  import AbsorptionBars, { type AbsorptionRow } from '../charts/AbsorptionBars.svelte';

  type SortKey = 'spent' | 'decided' | 'planned';
  const SORTS: { id: SortKey; label: string }[] = [
    { id: 'spent', label: 'Quota spesa' },
    { id: 'decided', label: 'Quota assegnata' },
    { id: 'planned', label: 'Importo' },
  ];

  const cube = $derived(cubeFor(filters.period));
  const source = $derived(cubeSource(filters.period));
  const focus = $derived(filters.area || HOME_COUNTRY);
  let sort = $state<SortKey>('spent');

  const fundRows = $derived(filterRows(cube.rows, { fund: filters.fund }));
  const stats = $derived(countryStats(fundRows).filter((s) => s.planned > 0));
  const euTotals = $derived(totals(fundRows.filter((r) => stats.some((s) => s.code === r[0]))));
  const euAverage = $derived(ratio(euTotals.spent, euTotals.planned));

  const sortValue = (row: AbsorptionRow): number =>
    sort === 'planned' ? row.planned : ratio(sort === 'spent' ? row.spent : row.decided, row.planned);
  const countryRows = $derived<AbsorptionRow[]>(
    stats
      .map((s) => ({
        key: s.code,
        label: s.name,
        planned: s.planned,
        decided: s.decided,
        spent: s.spent,
        accent: s.code === focus,
        href: `/paesi/${s.code.toLowerCase()}/${filtersQuery()}`,
      }))
      .sort((a, b) => sortValue(b) - sortValue(a)),
  );

  const bySpeed = $derived([...stats].sort((a, b) => b.absorption - a.absorption));
  const focusRank = $derived(bySpeed.findIndex((s) => s.code === focus) + 1);
  const focusStat = $derived(stats.find((s) => s.code === focus));
  const title = $derived(
    bySpeed.length > 0 && focusStat
      ? `${focusStat.name}: speso il ${pct(focusStat.absorption)}, ${ordinal(focusRank)} posto su ${bySpeed.length}. In testa ${bySpeed[0].name} (${pct(bySpeed[0].absorption)})`
      : 'Nessun importo con questi filtri',
  );

  const scopeRows = $derived(filterRows(cube.rows, { fund: filters.fund, area: filters.area }));
  const scopeAverage = $derived(ratio(totals(scopeRows).spent, totals(scopeRows).planned));
  const toRows = (dim: 'fund' | 'objective', label: (key: string) => string): AbsorptionRow[] =>
    groupBy(filterRows(cube.rows, dim === 'fund' ? { area: filters.area } : { fund: filters.fund, area: filters.area }), dim)
      .filter((g) => g.planned > 0)
      .map((g) => ({ key: g.key, label: label(g.key), planned: g.planned, decided: g.decided, spent: g.spent, accent: dim === 'fund' && g.key === filters.fund }))
      .sort((a, b) => ratio(b.spent, b.planned) - ratio(a.spent, a.planned));
  const fundBars = $derived(toRows('fund', (k) => `${fundShort(k)} — ${fundLong(k)}`));
  const objectiveBars = $derived(toRows('objective', (k) => objectiveLabel(cube, k)));

  const asTable = (rows: AbsorptionRow[], first: string) => ({
    columns: [first, 'Pianificato (€)', 'Assegnato (€)', 'Speso (€)', 'Speso (%)'],
    rows: rows.map((r) => [r.label, r.planned, r.decided, r.spent, Math.round(ratio(r.spent, r.planned) * 1000) / 10]),
  });
  const where = $derived(filters.area ? areaName(filters.area) : 'Unione europea');
  const scope = $derived(
    [filters.fund ? fundShort(filters.fund) : 'Tutti i fondi', PERIODS.find((p) => p.id === filters.period)?.label].join(' · '),
  );
</script>

<Tooltip />

<PageHead kicker="{scope} · dati a {monthIt(source.asOf)}" title="Chi spende i fondi e chi li lascia fermi">
  Avere i soldi a bilancio non significa usarli. Tra la promessa e il cantiere ci sono due passaggi: assegnare le risorse a progetti
  concreti, poi pagare le fatture. Le risorse non spese entro le scadenze tornano a Bruxelles.
</PageHead>

<FilterBar />

<section class="block">
  <ChartFrame
    kicker="La classifica della spesa"
    {title}
    note="Per ogni paese la barra intera è il pianificato. La fascia chiara è la parte già assegnata a progetti, quella scura la spesa dichiarata. Il tratto verticale segna la media dell’Unione."
    {source}
    table={asTable(countryRows, 'Paese')}
    filename="assorbimento-paesi-{filters.period}"
  >
    <div class="sort" role="group" aria-label="Ordina per">
      <span class="kicker">Ordina per</span>
      {#each SORTS as option (option.id)}
        <button type="button" class="btn" aria-pressed={sort === option.id} onclick={() => (sort = option.id)}>{option.label}</button>
      {/each}
    </div>
    <AbsorptionBars rows={countryRows} average={euAverage} averageLabel="Media UE" />
  </ChartFrame>
</section>

<section class="block two">
  <ChartFrame
    kicker="{where} · per fondo"
    title={fundBars.length > 0 ? `Il fondo più veloce è ${fundBars[0].label.split(' — ')[0]}, il più lento ${fundBars.at(-1)?.label.split(' — ')[0]}` : 'Nessun importo'}
    {source}
    table={asTable(fundBars, 'Fondo')}
    filename="assorbimento-fondi-{filters.period}"
  >
    <AbsorptionBars rows={fundBars} average={scopeAverage} averageLabel="Media" />
  </ChartFrame>

  <ChartFrame
    kicker="{where} · per obiettivo"
    title={objectiveBars.length > 0 ? `Si spende prima per ${lowerFirst(objectiveBars[0].label)}` : 'Nessun importo'}
    {source}
    table={asTable(objectiveBars, 'Obiettivo')}
    filename="assorbimento-obiettivi-{filters.period}"
  >
    <AbsorptionBars rows={objectiveBars} average={scopeAverage} averageLabel="Media" />
  </ChartFrame>
</section>

<style>
  .block {
    margin-top: 40px;
  }
  .two {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 40px;
    align-items: start;
  }
  .sort {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0;
    margin-bottom: 16px;
  }
  .sort .kicker {
    margin-right: 10px;
  }
  .sort .btn + .btn {
    border-left: 0;
  }
  @media (max-width: 900px) {
    .two {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
