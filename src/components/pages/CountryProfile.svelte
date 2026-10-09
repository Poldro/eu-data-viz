<script lang="ts">
  import historicJson from '../../data/historic.json';
  import { COUNTRIES, countryByCode } from '../../lib/countries';
  import { countryStats, filterRows, groupBy, rankOf, ratio, totals } from '../../lib/cube';
  import { cubeFor, cubeSource, PERIODS, source as sourceById } from '../../lib/data';
  import { filters, filtersQuery } from '../../lib/filters.svelte';
  import { eur, lowerFirst, monthIt, ordinal, pct, perHead } from '../../lib/format';
  import { countrySeries, type Historic, type YearPoint } from '../../lib/historic';
  import { categoryLabel, fundLong, fundShort, objectiveLabel } from '../../lib/labels';
  import ChartFrame from '../ChartFrame.svelte';
  import FilterBar from '../FilterBar.svelte';
  import Kpis, { type Kpi } from '../Kpis.svelte';
  import PageHead from '../PageHead.svelte';
  import Tooltip from '../Tooltip.svelte';
  import HistoricArea, { type Series } from '../charts/HistoricArea.svelte';
  import RankBars, { type RankItem } from '../charts/RankBars.svelte';
  import RegionMap, { type RegionDatum } from '../charts/RegionMap.svelte';

  const { code }: { code: string } = $props();

  const historic = historicJson as unknown as Historic;
  const TOP_REGIONS = 12;
  const TOP_CATEGORIES = 10;

  /** I sette fondi storici ricondotti a quattro famiglie, in ordine fisso. */
  const FAMILIES: (Series & { funds: string[] })[] = [
    { key: 'regional', label: 'Sviluppo regionale (FESR)', color: '--cat-1', funds: ['ERDF'] },
    { key: 'rural', label: 'Sviluppo rurale e pesca', color: '--cat-2', funds: ['EAFRD', 'EMFF'] },
    { key: 'social', label: 'Sociale (FSE, giovani, indigenti)', color: '--cat-3', funds: ['ESF', 'YEI', 'FEAD'] },
    { key: 'cohesion', label: 'Fondo di coesione', color: '--cat-4', funds: ['CF'] },
  ];

  const country = $derived(countryByCode(code));
  const name = $derived(country?.name ?? code);
  const cube = $derived(cubeFor(filters.period));
  const source = $derived(cubeSource(filters.period));
  const historicSource = sourceById('historic');
  const periodLabel = $derived(PERIODS.find((p) => p.id === filters.period)?.label ?? '');

  const stats = $derived(countryStats(filterRows(cube.rows, { fund: filters.fund })));
  const stat = $derived(stats.find((s) => s.code === code));
  const rows = $derived(filterRows(cube.rows, { fund: filters.fund, area: code }));
  const sum = $derived(totals(rows));
  const euTotals = $derived(totals(filterRows(cube.rows, { fund: filters.fund }).filter((r) => countryByCode(r[0]))));
  const euAbsorption = $derived(ratio(euTotals.spent, euTotals.planned));

  const kpis = $derived<Kpi[]>(
    stat
      ? [
          { label: 'Pianificato', value: eur(stat.planned), detail: `${ordinal(rankOf(stats, code, 'planned'))} su 27 in valore assoluto` },
          { label: 'Per abitante', value: perHead(stat.perCapita), detail: `${ordinal(rankOf(stats, code, 'perCapita'))} su 27` },
          {
            label: 'Assegnato a progetti',
            value: pct(ratio(stat.decided, stat.planned)),
            share: ratio(stat.decided, stat.planned),
            detail: eur(stat.decided),
          },
          {
            label: 'Speso',
            value: pct(stat.absorption),
            share: stat.absorption,
            detail: `${ordinal(rankOf(stats, code, 'absorption'))} su 27 · media UE ${pct(euAbsorption)}`,
          },
        ]
      : [],
  );

  const toItems = (dim: 'objective' | 'fund' | 'category', label: (key: string) => string, limit = Infinity): RankItem[] =>
    groupBy(rows, dim)
      .filter((g) => g.planned > 0)
      .slice(0, limit)
      .map((g) => ({
        key: g.key,
        label: label(g.key),
        value: g.planned,
        detail: `${pct(ratio(g.planned, sum.planned), 1)} del totale · speso ${pct(ratio(g.spent, g.planned))}`,
      }));
  const objectives = $derived(toItems('objective', (k) => objectiveLabel(cube, k)));
  const funds = $derived(toItems('fund', (k) => `${fundShort(k)} — ${fundLong(k)}`));
  const hasCategories = $derived(Object.keys(cube.categories).length > 0);
  const categories = $derived(hasCategories ? toItems('category', (k) => categoryLabel(cube, k) || 'Non classificato', TOP_CATEGORIES) : []);

  const points = $derived<YearPoint[]>(
    countrySeries(historic, code).map((p) => {
      const values = Object.fromEntries(FAMILIES.map((f) => [f.key, f.funds.reduce((s, fund) => s + (p.values[fund] ?? 0), 0)]));
      return { year: p.year, values, total: p.total };
    }),
  );
  const peak = $derived(points.reduce((best, p) => (p.total > best.total ? p : best), points[0]));
  const lifetime = $derived(points.reduce((s, p) => s + p.total, 0));
  const historyTable = $derived({
    columns: ['Anno', ...FAMILIES.map((f) => f.label), 'Totale (€)'],
    rows: points.map((p) => [String(p.year), ...FAMILIES.map((f) => p.values[f.key]), p.total]),
  });

  const regions = $derived(historic.regions[code] ?? []);
  const regionItems = $derived<RankItem[]>(
    regions.slice(0, TOP_REGIONS).map((r) => ({
      key: r.id,
      label: r.name || r.id,
      value: r.total,
      detail: [r.population ? `${perHead(r.total / r.population)} per abitante` : null, `2014–2020: ${eur(r.byPeriod['2014-2020'] ?? 0)}`]
        .filter(Boolean)
        .join(' · '),
    })),
  );
  const regionMap = $derived<RegionDatum[]>(
    regions.map((r) => {
      const perCapita = r.population ? r.total / r.population : null;
      return {
        id: r.id,
        name: r.name || r.id,
        country: code,
        value: perCapita,
        tip: [
          ['Pagamenti UE', eur(r.total)],
          ['Per abitante', perCapita === null ? 'n.d.' : perHead(perCapita)],
        ],
      };
    }),
  );

  const neighbours = [...COUNTRIES].sort((a, b) => a.name.localeCompare(b.name, 'it'));
</script>

<Tooltip />

<PageHead kicker="Scheda paese · {periodLabel} · dati a {monthIt(source.asOf)}" title="{name}: {eur(sum.planned)} dall’Europa">
  {#if stat}
    Sono {perHead(stat.perCapita)} per abitante. Finora è stato speso il {pct(stat.absorption)} delle risorse, contro una media
    europea del {pct(euAbsorption)}.
  {/if}
</PageHead>

<FilterBar showArea={false} />

<Kpis items={kpis} />

<section class="block two">
  <ChartFrame
    kicker="Per fare cosa"
    title={objectives.length > 0 ? `La priorità è ${lowerFirst(objectives[0].label)}` : 'Nessun importo con questi filtri'}
    {source}
    table={{ columns: ['Obiettivo', 'Pianificato (€)'], rows: objectives.map((i) => [i.label, i.value]) }}
    filename="{code}-obiettivi-{filters.period}"
  >
    <RankBars items={objectives} format={eur} valueLabel="Pianificato" />
  </ChartFrame>

  <ChartFrame
    kicker="Da quali fondi"
    title={funds.length > 0 ? `${funds[0].label.split(' — ')[0]} è il canale principale` : 'Nessun importo con questi filtri'}
    {source}
    table={{ columns: ['Fondo', 'Pianificato (€)'], rows: funds.map((i) => [i.label, i.value]) }}
    filename="{code}-fondi-{filters.period}"
  >
    <RankBars items={funds} format={eur} valueLabel="Pianificato" />
  </ChartFrame>
</section>

{#if categories.length > 0}
  <section class="block narrow">
    <ChartFrame
      kicker="Le dieci voci più finanziate"
      title="La singola voce più grande vale {eur(categories[0].value)}"
      note="Campi d’intervento del regolamento europeo, resi in italiano corrente."
      {source}
      table={{ columns: ['Voce', 'Pianificato (€)'], rows: categories.map((i) => [i.label, i.value]) }}
      filename="{code}-voci-{filters.period}"
    >
      <RankBars items={categories} format={eur} valueLabel="Pianificato" numbered />
    </ChartFrame>
  </section>
{/if}

{#if lifetime > 0}
  <section class="block">
    <ChartFrame
      kicker="I pagamenti anno per anno · {historic.firstYear}–{historic.lastYear}"
      title="Dal {historic.firstYear} sono arrivati {eur(lifetime)}; il picco nel {peak.year}"
      note="Pagamenti annuali effettivi dell’UE, a prezzi correnti. Questa serie non risente dei filtri in alto e si ferma al {historic.lastYear}, ultimo anno pubblicato."
      source={historicSource}
      table={historyTable}
      filename="{code}-storico"
    >
      <HistoricArea {points} series={FAMILIES} />
    </ChartFrame>
  </section>
{/if}

{#if regionItems.length > 0}
  <section class="block narrow">
    <ChartFrame
      kicker="Le regioni · totale {historic.firstYear}–{historic.lastYear}"
      title="{regionItems[0].label} è la regione che ha ricevuto di più"
      note="Pagamenti UE cumulati per regione (NUTS 2, confini del 2010), stimati dalla Commissione a partire dai programmi. La mappa è in euro per abitante, la classifica in importi assoluti."
      source={historicSource}
      table={{ columns: ['Regione', 'Totale (€)'], rows: regions.map((r) => [r.name || r.id, r.total]) }}
      filename="{code}-regioni"
    >
      {#if regions.length > 1}
        <div class="region-map">
          <RegionMap regions={regionMap} focus={code} legendLabel="€ per abitante, intera serie" format={perHead} />
        </div>
      {/if}
      <RankBars items={regionItems} format={eur} valueLabel="Totale" numbered />
    </ChartFrame>
  </section>
{/if}

<nav class="others" aria-label="Altri paesi">
  <p class="kicker">Altri paesi</p>
  <ul>
    {#each neighbours as other (other.code)}
      <li>
        <a href="/paesi/{other.code.toLowerCase()}/{filtersQuery()}" aria-current={other.code === code ? 'page' : undefined}>{other.name}</a>
      </li>
    {/each}
  </ul>
</nav>

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
  .narrow {
    max-width: 820px;
  }
  .region-map {
    max-width: 560px;
    margin-bottom: 20px;
  }
  .others {
    margin-top: 56px;
    padding-top: 14px;
    border-top: 1px solid var(--rule);
  }
  .others ul {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 16px;
    margin: 8px 0 0;
    padding: 0;
    list-style: none;
    font-size: 0.95rem;
  }
  .others a[aria-current='page'] {
    color: var(--accent-ink);
    font-weight: 600;
    text-decoration: none;
  }
  @media (max-width: 900px) {
    .two {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
