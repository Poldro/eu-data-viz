<script lang="ts">
  import historicJson from '../../data/historic.json';
  import { areaName, COUNTRIES, HOME_COUNTRY } from '../../lib/countries';
  import { source as sourceById } from '../../lib/data';
  import { eur, perHead } from '../../lib/format';
  import { programmingPeriods, regionValues, type Historic, type RegionValue } from '../../lib/historic';
  import ChartFrame from '../ChartFrame.svelte';
  import PageHead from '../PageHead.svelte';
  import Tooltip from '../Tooltip.svelte';
  import RankBars, { type RankItem } from '../charts/RankBars.svelte';
  import RegionMap, { type RegionDatum } from '../charts/RegionMap.svelte';

  type Metric = 'perCapita' | 'amount';
  const METRICS: { id: Metric; label: string }[] = [
    { id: 'perCapita', label: 'Per abitante' },
    { id: 'amount', label: 'Importo totale' },
  ];
  const TOP = 15;
  const DEFAULT_PERIOD = '2014-2020';

  const historic = historicJson as unknown as Historic;
  const source = sourceById('historic');
  const periods = programmingPeriods(historic);
  const countries = [...COUNTRIES].sort((a, b) => a.name.localeCompare(b.name, 'it'));

  let period = $state(periods.includes(DEFAULT_PERIOD) ? DEFAULT_PERIOD : '');
  let metric = $state<Metric>('perCapita');
  let country = $state('');

  const valueOf = (r: RegionValue): number | null => (metric === 'perCapita' ? r.perCapita : r.amount);
  const format = $derived(metric === 'perCapita' ? perHead : eur);
  const periodLabel = $derived(period ? period.replace('-', '–') : `${historic.firstYear}–${historic.lastYear}`);

  const values = $derived(regionValues(historic, period).filter((r) => r.amount > 0));
  const mapData = $derived<RegionDatum[]>(
    values.map((r) => ({
      id: r.id,
      name: `${r.name} (${areaName(r.country)})`,
      country: r.country,
      value: valueOf(r),
      tip: [
        ['Pagamenti UE', eur(r.amount)],
        ['Per abitante', r.perCapita === null ? 'n.d.' : perHead(r.perCapita)],
      ],
    })),
  );

  const ranked = $derived(
    values
      .filter((r) => (!country || r.country === country) && valueOf(r) !== null)
      .sort((a, b) => (valueOf(b) ?? 0) - (valueOf(a) ?? 0)),
  );
  const items = $derived<RankItem[]>(
    ranked.slice(0, TOP).map((r) => ({
      key: r.id,
      label: country ? r.name : `${r.name} · ${areaName(r.country)}`,
      value: valueOf(r) ?? 0,
      accent: r.country === HOME_COUNTRY && !country,
      detail: metric === 'perCapita' ? `${eur(r.amount)} in totale` : r.perCapita === null ? undefined : `${perHead(r.perCapita)} per abitante`,
    })),
  );
  const home = $derived(ranked.findIndex((r) => r.country === HOME_COUNTRY));

  const where = $derived(country ? areaName(country) : 'Unione europea');
  const mapTitle = $derived(
    ranked.length > 0
      ? `${ranked[0].name} in testa: ${format(valueOf(ranked[0]) ?? 0)}${metric === 'perCapita' ? ' per abitante' : ''}`
      : 'Nessun pagamento in questo periodo',
  );
  const table = $derived({
    columns: ['Regione', 'Paese', 'Pagamenti UE (€)', '€ per abitante', 'Abitanti'],
    rows: ranked.map((r) => [r.name, areaName(r.country), r.amount, r.perCapita === null ? 'n.d.' : Math.round(r.perCapita), r.population ?? 'n.d.']),
  });
</script>

<Tooltip />

<PageHead kicker="{where} · periodo {periodLabel}" title="La geografia dei fondi, regione per regione">
  La politica di coesione nasce per ridurre i divari tra territori: per questo il denaro si concentra a est e a sud. Qui i pagamenti
  dell’Unione dal {historic.firstYear} sono riportati alle regioni in cui sono stati spesi.
</PageHead>

<div class="controls" role="group" aria-label="Opzioni della mappa">
  <label>
    <span class="kicker">Periodo</span>
    <select bind:value={period}>
      <option value="">Tutta la serie</option>
      {#each periods as p (p)}<option value={p}>{p.replace('-', '–')}</option>{/each}
    </select>
  </label>
  <div class="group">
    <span class="kicker">Misura</span>
    <div class="segmented">
      {#each METRICS as m (m.id)}
        <button type="button" class="btn" aria-pressed={metric === m.id} onclick={() => (metric = m.id)}>{m.label}</button>
      {/each}
    </div>
  </div>
  <label>
    <span class="kicker">Inquadra</span>
    <select bind:value={country}>
      <option value="">Tutta l’UE</option>
      {#each countries as c (c.code)}<option value={c.code}>{c.name}</option>{/each}
    </select>
  </label>
</div>

<section class="block two">
  <ChartFrame
    kicker="{where} · {metric === 'perCapita' ? 'euro per abitante' : 'importo totale'}"
    title={mapTitle}
    note="Pagamenti dell’Unione attribuiti alle regioni (stima della Commissione), divisi per gli abitanti del 2023. Regioni nei confini del 2010. Le regioni d’oltremare e le isole atlantiche compaiono solo in classifica."
    {source}
    {table}
    filename="regioni-{period || 'totale'}"
  >
    <RegionMap regions={mapData} focus={country} highlight={country ? '' : HOME_COUNTRY} legendLabel={metric === 'perCapita' ? '€ per abitante' : 'Pagamenti UE'} {format} />
  </ChartFrame>

  <ChartFrame
    kicker="Le prime {Math.min(TOP, ranked.length)} regioni · {where}"
    title={!country && home >= 0
      ? `La prima regione italiana è ${ranked[home].name}, ${home + 1}ª su ${ranked.length}`
      : ranked.length > 0
        ? `${ranked[0].name} guida la classifica`
        : 'Nessun dato'}
    {source}
    {table}
    filename="regioni-classifica-{period || 'totale'}"
  >
    <RankBars {items} {format} valueLabel={metric === 'perCapita' ? 'Per abitante' : 'Pagamenti UE'} numbered />
  </ChartFrame>
</section>

<style>
  .controls {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 12px 22px;
    padding: 10px 0;
    border-bottom: 1px solid var(--rule);
  }
  label,
  .group {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  .segmented {
    display: flex;
  }
  .segmented .btn + .btn {
    border-left: 0;
  }
  select {
    min-height: 32px;
    padding: 0 10px;
    border: 1px solid var(--rule);
    border-radius: 0;
    background: var(--paper);
    font-family: var(--font-data);
    font-size: 0.72rem;
    color: var(--ink);
  }
  .block {
    margin-top: 36px;
  }
  .two {
    display: grid;
    grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr);
    gap: 40px;
    align-items: start;
  }
  @media (max-width: 960px) {
    .two {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
