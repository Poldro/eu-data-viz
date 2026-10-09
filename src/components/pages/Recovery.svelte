<script lang="ts">
  import rrfJson from '../../data/rrf.json';
  import { areaName, COUNTRIES, HOME_COUNTRY } from '../../lib/countries';
  import { filterRows, totals } from '../../lib/cube';
  import { cubeFor, source as sourceById } from '../../lib/data';
  import { eur, ordinal, pct } from '../../lib/format';
  import type { YearPoint } from '../../lib/historic';
  import { rrfTotals, type Rrf, type RrfSplit } from '../../lib/rrf';
  import ChartFrame from '../ChartFrame.svelte';
  import Kpis, { type Kpi } from '../Kpis.svelte';
  import PageHead from '../PageHead.svelte';
  import Tooltip from '../Tooltip.svelte';
  import AbsorptionBars, { type AbsorptionRow } from '../charts/AbsorptionBars.svelte';
  import HistoricArea, { type Series } from '../charts/HistoricArea.svelte';

  const rrf = rrfJson as Rrf;
  const receivedSource = sourceById('rrf-received');
  const usesSource = sourceById('rrf-uses');

  const SERIES: Series[] = [
    { key: 'grants', label: 'Sovvenzioni (a fondo perduto)', color: '--cat-1' },
    { key: 'loans', label: 'Prestiti (da restituire)', color: '--cat-2' },
  ];
  const LABELS = { planned: 'Dotazione del piano', decided: 'Ricevuto da Bruxelles', spent: 'Speso' };

  const countries = COUNTRIES.filter((c) => c.code in rrf.countries).sort((a, b) => a.name.localeCompare(b.name, 'it'));
  let selected = $state(HOME_COUNTRY);

  const ranked = Object.entries(rrf.countries)
    .map(([code, country]) => ({ code, name: areaName(code), ...rrfTotals(country) }))
    .sort((a, b) => b.spentShare - a.spentShare);
  const eu = rrfTotals(rrf.eu);

  const current = $derived(rrf.countries[selected]);
  const sum = $derived(rrfTotals(current));
  const name = $derived(areaName(selected));
  const rank = $derived(ranked.findIndex((c) => c.code === selected) + 1);
  // Termine di paragone: la quota UE dei fondi di coesione 2021-2027 dello stesso paese.
  const cohesion = $derived(totals(filterRows(cubeFor('2127').rows, { area: selected })).planned);

  const kpis = $derived<Kpi[]>([
    {
      label: 'Dotazione del piano',
      value: eur(sum.allocation),
      detail: cohesion > 0 ? `${(sum.allocation / cohesion).toLocaleString('it-IT', { maximumFractionDigits: 1 })} volte i fondi di coesione 2021–2027` : undefined,
    },
    { label: 'Ricevuto da Bruxelles', value: pct(sum.receivedShare), share: sum.receivedShare, detail: `${eur(sum.received)} versati allo Stato` },
    { label: 'Speso', value: pct(sum.spentShare), share: sum.spentShare, detail: `${eur(sum.spent)} · ${ordinal(rank)} su ${ranked.length} · media UE ${pct(eu.spentShare)}` },
    {
      label: 'Quota in prestito',
      value: pct(sum.received > 0 ? sum.loansReceived / sum.received : 0),
      share: sum.received > 0 ? sum.loansReceived / sum.received : 0,
      detail: `${eur(sum.loansReceived)} da restituire`,
    },
  ]);

  const rows = $derived<AbsorptionRow[]>(
    ranked.map((c) => ({ key: c.code, label: c.name, planned: c.allocation, decided: c.received, spent: c.spent, accent: c.code === selected })),
  );

  const toPoints = (split: RrfSplit): YearPoint[] =>
    split.grants.map((grants, i) => ({
      year: rrf.firstYear + i,
      values: { grants, loans: split.loans[i] ?? 0 },
      total: grants + (split.loans[i] ?? 0),
    }));
  const receivedPoints = $derived(toPoints(current.received));
  const spentPoints = $derived(toPoints(current.spent));
  const peak = (points: YearPoint[]) => points.reduce((best, p) => (p.total > best.total ? p : best), points[0]);
  const yearTable = (points: YearPoint[]) => ({
    columns: ['Anno', 'Sovvenzioni (€)', 'Prestiti (€)', 'Totale (€)'],
    rows: points.map((p) => [String(p.year), p.values.grants, p.values.loans, p.total]),
  });
</script>

<Tooltip />

<PageHead kicker="Dispositivo per la ripresa e la resilienza · dati al {rrf.lastYear}" title="{name}: {eur(sum.spent)} spesi su {eur(sum.allocation)}">
  Il piano di ripresa nato con la pandemia vale {eur(eu.allocation)} per i Ventisette e funziona al contrario dei fondi di coesione:
  Bruxelles paga quando un paese raggiunge gli obiettivi concordati, non quando presenta le fatture. Per questo conta sia quanto è
  arrivato sia quanto è stato davvero speso.
</PageHead>

<div class="picker">
  <label>
    <span class="kicker">Paese</span>
    <select bind:value={selected}>
      {#each countries as country (country.code)}<option value={country.code}>{country.name}</option>{/each}
    </select>
  </label>
</div>

<Kpis items={kpis} />

<section class="block">
  <ChartFrame
    kicker="La classifica della spesa"
    title="{name}: speso il {pct(sum.spentShare)} del piano, {ordinal(rank)} posto su {ranked.length}. In testa {ranked[0].name} ({pct(ranked[0].spentShare)})"
    note="La barra intera è la dotazione del piano nazionale. La fascia chiara è quanto la Commissione ha già versato, quella scura quanto lo Stato ha speso. Alcuni paesi hanno speso più di quanto ricevuto: hanno anticipato con risorse proprie."
    source={usesSource}
    table={{
      columns: ['Paese', 'Dotazione (€)', 'Ricevuto (€)', 'Speso (€)', 'Speso (%)'],
      rows: ranked.map((c) => [c.name, c.allocation, c.received, c.spent, Math.round(c.spentShare * 1000) / 10]),
    }}
    filename="pnrr-paesi"
  >
    <AbsorptionBars {rows} average={eu.spentShare} averageLabel="Media UE" labels={LABELS} />
  </ChartFrame>
</section>

<section class="block two">
  <ChartFrame
    kicker="{name} · incassato anno per anno"
    title="Il versamento più grande nel {peak(receivedPoints).year}: {eur(peak(receivedPoints).total)}"
    source={receivedSource}
    table={yearTable(receivedPoints)}
    filename="pnrr-{selected}-ricevuto"
  >
    <HistoricArea points={receivedPoints} series={SERIES} />
  </ChartFrame>

  <ChartFrame
    kicker="{name} · speso anno per anno"
    title="L’anno di spesa più intensa è il {peak(spentPoints).year}: {eur(peak(spentPoints).total)}"
    source={usesSource}
    table={yearTable(spentPoints)}
    filename="pnrr-{selected}-speso"
  >
    <HistoricArea points={spentPoints} series={SERIES} />
  </ChartFrame>
</section>

<p class="caveat">
  <strong>Che cosa manca.</strong> Eurostat pubblica quanto ogni paese ha ricevuto e speso, non per che cosa: la ripartizione per
  missioni e singoli progetti non è in questa fonte. La dotazione è ricavata dal rapporto tra fondi ricevuti e quota percentuale
  dell’allocazione, e può differire di qualche decimale dai documenti ufficiali.
</p>

<style>
  .picker {
    padding: 0 0 14px;
  }
  label {
    display: inline-flex;
    flex-direction: column;
    gap: 5px;
  }
  select {
    min-height: 36px;
    min-width: 200px;
    padding: 0 10px;
    border: 1px solid var(--rule);
    border-radius: 0;
    background: var(--paper);
    font-family: var(--font-data);
    font-size: 0.78rem;
    color: var(--ink);
  }
  .block {
    margin-top: 40px;
  }
  .two {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 40px;
    align-items: start;
  }
  .caveat {
    max-width: var(--measure);
    margin-top: 40px;
    padding: 14px 16px;
    background: var(--paper-deep);
    border-left: 3px solid var(--accent);
    font-size: 0.95rem;
  }
  @media (max-width: 900px) {
    .two {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
