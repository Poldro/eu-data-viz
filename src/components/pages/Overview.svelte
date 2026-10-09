<script lang="ts">
  import { areaName, countryByCode, HOME_COUNTRY } from '../../lib/countries';
  import { buildFlows, countryStats, filterRows, groupBy, rankOf, ratio, totals } from '../../lib/cube';
  import { cubeFor, cubeSource, PERIODS } from '../../lib/data';
  import { filters, filtersQuery, toggleArea, toggleFund } from '../../lib/filters.svelte';
  import { eur, monthIt, ordinal, pct, perHead } from '../../lib/format';
  import { fundLong, fundShort, objectiveLabel } from '../../lib/labels';
  import { SECTIONS, type Section } from '../../lib/sections';
  import type { Teaser } from '../../lib/teasers';
  import ChartFrame from '../ChartFrame.svelte';
  import FilterBar from '../FilterBar.svelte';
  import Kpis, { type Kpi } from '../Kpis.svelte';
  import SectionCard from '../SectionCard.svelte';
  import Tooltip from '../Tooltip.svelte';
  import MiniBars from '../charts/mini/MiniBars.svelte';
  import Sankey from '../charts/Sankey.svelte';
  import TileMap from '../charts/TileMap.svelte';

  /** Anticipazioni calcolate a build time per le sezioni che non seguono i filtri. */
  const { teasers }: { teasers: Record<string, Teaser> } = $props();

  const MINI_OBJECTIVES = 8;
  const NO_CARD = new Set(['panoramica', 'metodo']);

  const cube = $derived(cubeFor(filters.period));
  const source = $derived(cubeSource(filters.period));
  const periodLabel = $derived(PERIODS.find((p) => p.id === filters.period)?.label ?? '');

  const rows = $derived(filterRows(cube.rows, { fund: filters.fund, area: filters.area }));
  const sum = $derived(totals(rows));
  // La mappa confronta i paesi: ignora il filtro paese, che serve solo a evidenziare.
  const stats = $derived(countryStats(filterRows(cube.rows, { fund: filters.fund })));
  const flows = $derived(buildFlows(rows));
  const objectives = $derived(groupBy(rows, 'objective'));

  const focus = $derived(filters.area || HOME_COUNTRY);
  const focusStat = $derived(stats.find((s) => s.code === focus));
  const ranked = $derived([...stats].filter((s) => s.planned > 0).sort((a, b) => b.perCapita - a.perCapita));
  const euPerCapita = $derived(
    ratio(
      stats.reduce((s, c) => s + c.planned, 0),
      stats.reduce((s, c) => s + (countryByCode(c.code)?.population ?? 0) * 1e6, 0),
    ),
  );

  const scope = $derived(
    [filters.area ? areaName(filters.area) : 'Unione europea', filters.fund ? fundShort(filters.fund) : null, periodLabel]
      .filter(Boolean)
      .join(' · '),
  );
  const spentPer100 = $derived(Math.round(ratio(sum.spent, sum.planned) * 100));

  const kpis = $derived<Kpi[]>([
    { label: 'Pianificato', value: eur(sum.planned), detail: 'Quota UE messa a bilancio nei programmi' },
    {
      label: 'Assegnato a progetti',
      value: pct(ratio(sum.decided, sum.planned)),
      share: ratio(sum.decided, sum.planned),
      detail: `${eur(sum.decided)} già destinati a operazioni selezionate`,
    },
    {
      label: 'Speso',
      value: pct(ratio(sum.spent, sum.planned)),
      share: ratio(sum.spent, sum.planned),
      detail: `${eur(sum.spent)} di spesa dichiarata dai beneficiari`,
    },
    ...(sum.climate > 0
      ? [{ label: 'Per il clima', value: pct(ratio(sum.climate, sum.planned)), share: ratio(sum.climate, sum.planned), detail: `${eur(sum.climate)} conteggiati come azione climatica` }]
      : []),
  ]);

  const flowTitle = $derived(
    objectives.length > 0
      ? `${objectiveLabel(cube, objectives[0].key)} è la prima voce: ${pct(ratio(objectives[0].planned, sum.planned))} del totale`
      : 'Nessun importo con questi filtri',
  );
  const flowTable = $derived({
    columns: ['Da', 'A', 'Pianificato (€)'],
    rows: flows.links.map((l) => {
      const name = (id: string) =>
        id.startsWith('f:') ? fundLong(id.slice(2)) : id.startsWith('o:') ? objectiveLabel(cube, id.slice(2)) : id === 'a:__other__' ? 'Altri' : areaName(id.slice(2));
      return [name(l.source), name(l.target), Math.round(l.value)];
    }),
  });

  const mapTitle = $derived(
    ranked.length > 0 && focusStat
      ? `${ranked[0].name}: ${perHead(ranked[0].perCapita)} per abitante${focusStat.code === ranked[0].code ? ', più di chiunque altro' : `. ${focusStat.name}: ${perHead(focusStat.perCapita)}`}`
      : 'Nessun importo con questi filtri',
  );
  const bySpeed = $derived([...stats].filter((s) => s.planned > 0).sort((a, b) => b.absorption - a.absorption));
  const byAmount = $derived([...stats].filter((s) => s.planned > 0).sort((a, b) => b.planned - a.planned));

  /** Le anticipazioni delle sezioni che reagiscono ai filtri, calcolate sugli stessi dati dei grafici. */
  const liveTeasers = $derived<Record<string, Teaser>>({
    temi: {
      headline: objectives.length > 0 ? `${objectiveLabel(cube, objectives[0].key)}: ${pct(ratio(objectives[0].planned, sum.planned))} delle risorse` : 'Nessun importo',
      values: objectives.slice(0, MINI_OBJECTIVES).map((o) => o.planned),
      highlight: -1,
      chartLabel: 'Importo pianificato per obiettivo',
    },
    assorbimento: {
      headline: focusStat ? `${focusStat.name}: speso il ${pct(focusStat.absorption)}, ${ordinal(rankOf(stats, focus, 'absorption'))} posto su ${bySpeed.length}` : 'Nessun importo',
      values: bySpeed.map((s) => s.absorption),
      highlight: bySpeed.findIndex((s) => s.code === focus),
      chartLabel: 'Quota spesa per paese, dal più veloce al più lento',
    },
    paesi: {
      headline: byAmount.length > 0 ? `${byAmount[0].name} riceve più di tutti: ${eur(byAmount[0].planned)}` : 'Nessun importo',
      values: byAmount.map((s) => s.planned),
      highlight: byAmount.findIndex((s) => s.code === focus),
      chartLabel: 'Importo pianificato per paese',
    },
  });
  const cards = $derived(
    SECTIONS.filter((s) => !NO_CARD.has(s.id))
      .map((section): { section: Section; teaser: Teaser | undefined; live: boolean } => ({
        section,
        teaser: liveTeasers[section.id] ?? teasers[section.id],
        live: section.id in liveTeasers,
      }))
      .filter((c): c is { section: Section; teaser: Teaser; live: boolean } => c.teaser !== undefined),
  );

  const mapTable = $derived({
    columns: ['Paese', '€ per abitante', 'Pianificato (€)', 'Speso (€)', 'Speso (%)'],
    rows: ranked.map((s) => [s.name, Math.round(s.perCapita), s.planned, s.spent, Math.round(s.absorption * 1000) / 10]),
  });
</script>

<Tooltip />

<section class="lede">
  <p class="kicker rise">{scope} · dati a {monthIt(source.asOf)}</p>
  <h1 class="display rise" style:--i={1}>
    Su 100 euro promessi, <em>{spentPer100}</em> sono stati spesi
  </h1>
  <p class="standfirst rise" style:--i={2}>
    {#if filters.period === '2127'}
      Il ciclo 2021–2027 dei fondi europei a gestione condivisa vale {eur(sum.planned)} di risorse dell’Unione. Qui si vede da quale
      fondo partono, che cosa finanziano, in quale paese arrivano e quanta strada hanno già fatto.
    {:else}
      Il ciclo 2014–2020 si è chiuso con {eur(sum.planned)} di risorse dell’Unione nei programmi a gestione condivisa. È il termine di
      paragone per capire a che punto è quello in corso.
    {/if}
  </p>
</section>

<FilterBar />

<Kpis items={kpis} />

<section class="index" aria-labelledby="index-title">
  <h2 id="index-title" class="kicker">In questo numero</h2>
  <div class="cards">
    {#each cards as card (card.section.id)}
      <SectionCard section={card.section} headline={card.teaser.headline} query={card.live ? filtersQuery() : ''}>
        <MiniBars values={card.teaser.values} highlight={card.teaser.highlight} label={card.teaser.chartLabel} />
      </SectionCard>
    {/each}
  </div>
</section>

<section class="block">
  <ChartFrame
    kicker="Il percorso del denaro"
    title={flowTitle}
    note="Lo spessore di ogni nastro è proporzionale alla quota UE pianificata. Clicca un fondo o un paese per filtrare tutta la pagina."
    {source}
    table={flowTable}
    filename="flussi-fondi-{filters.period}"
  >
    <Sankey
      {flows}
      {cube}
      total={sum.planned}
      selectedFund={filters.fund}
      selectedArea={filters.area}
      onPickFund={toggleFund}
      onPickArea={toggleArea}
    />
  </ChartFrame>
</section>

<section class="block split">
  <ChartFrame
    kicker="Quanto pesa per chi ci vive"
    title={mapTitle}
    note="Ogni tessera è uno Stato membro: più è scura, più euro pianificati per abitante. In cifre assolute vincono i paesi grandi; divisi per la popolazione, la geografia cambia."
    {source}
    table={mapTable}
    filename="fondi-per-abitante-{filters.period}"
  >
    <TileMap {stats} selected={filters.area} onPick={toggleArea} />
  </ChartFrame>

  {#if focusStat}
    <aside class="focus">
      <p class="kicker">In primo piano</p>
      <h2 class="headline">{focusStat.name}</h2>
      <dl>
        <div>
          <dt>Pianificato</dt>
          <dd class="figure">{eur(focusStat.planned)}</dd>
          <dd class="rank">{ordinal(rankOf(stats, focus, 'planned'))} su 27 in valore assoluto</dd>
        </div>
        <div>
          <dt>Per abitante</dt>
          <dd class="figure">{perHead(focusStat.perCapita)}</dd>
          <dd class="rank">{ordinal(rankOf(stats, focus, 'perCapita'))} su 27 · media UE {perHead(euPerCapita)}</dd>
        </div>
        <div>
          <dt>Speso</dt>
          <dd class="figure">{pct(focusStat.absorption)}</dd>
          <dd class="rank">{ordinal(rankOf(stats, focus, 'absorption'))} su 27 per velocità di spesa</dd>
        </div>
      </dl>
      <a class="more" href="/paesi/{focus.toLowerCase()}/{filtersQuery()}">Apri la scheda {focusStat.name} →</a>
    </aside>
  {/if}
</section>

<style>
  .lede {
    padding: 8px 0 26px;
  }
  h1 {
    margin: 10px 0 16px;
    font-size: clamp(2.3rem, 6.4vw, 5rem);
    max-width: 16ch;
  }
  h1 em {
    font-style: italic;
    color: var(--accent);
  }
  .index {
    margin-top: 28px;
  }
  .cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
    gap: 16px;
    margin-top: 10px;
  }
  .block {
    margin-top: 44px;
  }
  .split {
    display: grid;
    grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr);
    gap: 40px;
    align-items: start;
  }
  .focus {
    padding: 18px 20px 20px;
    background: var(--paper-deep);
    border-top: 3px solid var(--accent);
  }
  .focus h2 {
    margin-top: 4px;
    font-size: 2rem;
  }
  dl {
    margin: 12px 0 0;
  }
  dl div {
    padding: 11px 0;
    border-top: 1px solid var(--rule-soft);
  }
  dt {
    font-family: var(--font-data);
    font-size: 0.64rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--ink-2);
  }
  dd {
    margin: 0;
  }
  dd.figure {
    font-size: 1.55rem;
    font-weight: 500;
    line-height: 1.2;
  }
  .rank {
    font-size: 0.86rem;
    color: var(--ink-2);
  }
  .more {
    display: inline-block;
    margin-top: 12px;
    font-family: var(--font-data);
    font-size: 0.72rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  @media (max-width: 860px) {
    .split {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
