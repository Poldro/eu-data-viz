<script lang="ts">
  import { AUDIT_SOURCE, AUDIT_YEARS, latestAudit, MATERIALITY } from '../../lib/audit';
  import { areaName, HOME_COUNTRY } from '../../lib/countries';
  import { filterRows, ratio } from '../../lib/cube';
  import { cubeFor, cubeSource, PERIODS, type PeriodId } from '../../lib/data';
  import { filters, filtersQuery } from '../../lib/filters.svelte';
  import { decimal, eur, ordinal, pct } from '../../lib/format';
  import { fundShort } from '../../lib/labels';
  import { countryLeakage, leakage, perHundred, type Leakage } from '../../lib/leakage';
  import ChartFrame from '../ChartFrame.svelte';
  import FilterBar from '../FilterBar.svelte';
  import Kpis, { type Kpi } from '../Kpis.svelte';
  import PageHead from '../PageHead.svelte';
  import Tooltip from '../Tooltip.svelte';
  import RankBars, { type RankItem } from '../charts/RankBars.svelte';
  import RateLines, { type RateSeries } from '../charts/RateLines.svelte';
  import SplitBars, { type SplitPart, type SplitRow } from '../charts/SplitBars.svelte';

  /** Il ciclo chiuso: solo qui "non speso" è un dato quasi definitivo. */
  const CLOSED: PeriodId = '1420';
  const PARTS: SplitPart[] = [
    { key: 'projects', label: 'Ai progetti', color: '--seq-5' },
    { key: 'management', label: 'Alla gestione', color: '--cat-2' },
    { key: 'unspent', label: 'Non spesi (nel ciclo in corso: non ancora)', color: '--ink-3', hatched: true },
  ];
  const euros = (value: number): string => `${decimal(value)} €`;
  const periodLabel = (id: PeriodId): string => PERIODS.find((p) => p.id === id)?.label ?? id;

  const focus = $derived(filters.area || HOME_COUNTRY);
  const focusName = $derived(areaName(focus));
  const source = $derived(cubeSource(filters.period));
  const closedSource = cubeSource(CLOSED);
  const scope = $derived([filters.fund ? fundShort(filters.fund) : 'Tutti i fondi', periodLabel(filters.period)].join(' · '));

  const rowsFor = (period: PeriodId, area?: string) => filterRows(cubeFor(period).rows, { fund: filters.fund, area });

  /** Per ogni ciclo, l'Unione e il paese in evidenza: cento euro divisi in tre. */
  const splits = $derived(
    // Prima il ciclo chiuso: è l'unico in cui il "non speso" è (quasi) definitivo.
    [...PERIODS]
      .sort((a, b) => Number(b.id === CLOSED) - Number(a.id === CLOSED))
      .flatMap((period) =>
        [
          { key: `eu-${period.id}`, label: `Unione europea · ${period.label}`, accent: false, open: period.id !== CLOSED, value: leakage(rowsFor(period.id)) },
          { key: `${focus}-${period.id}`, label: `${focusName} · ${period.label}`, accent: true, open: period.id !== CLOSED, value: leakage(rowsFor(period.id, focus)) },
        ].filter((row) => row.value.planned > 0),
      ),
  );
  const splitRows = $derived<SplitRow[]>(
    splits.map((row) => {
      const parts = perHundred(row.value);
      return { key: row.key, label: row.label, accent: row.accent, detail: `${eur(row.value.planned)} pianificati${row.open ? ' · ciclo in corso' : ''}`, values: [parts.projects, parts.management, parts.unspent], labels: row.open ? { unspent: 'Non ancora spesi' } : { unspent: 'Non spesi' } };
    }),
  );
  const closedFocus = $derived(perHundred(leakage(rowsFor(CLOSED, focus))));
  const splitTitle = $derived(
    closedFocus.projects > 0
      ? `${focusName}, ${periodLabel(CLOSED)}: su 100 euro, ${decimal(closedFocus.projects)} ai progetti, ${decimal(closedFocus.management)} alla gestione, ${decimal(closedFocus.unspent)} non spesi`
      : 'Nessun importo con questi filtri',
  );

  const countries = $derived(countryLeakage(rowsFor(filters.period)));
  const byManagement = $derived([...countries].sort((a, b) => b.managementShare - a.managementShare));
  const eu = $derived(leakage(rowsFor(filters.period)));
  const euShare = $derived(ratio(eu.managementPlanned, eu.planned));
  const focusManagement = $derived(byManagement.find((c) => c.code === focus));
  const focusRank = $derived(byManagement.findIndex((c) => c.code === focus) + 1);
  const managementItems = $derived<RankItem[]>(
    byManagement.map((c) => ({
      key: c.code,
      label: c.name,
      value: c.managementShare,
      accent: c.code === focus,
      href: `/paesi/${c.code.toLowerCase()}/${filtersQuery()}`,
      detail: `${eur(c.managementPlanned)} su ${eur(c.planned)}`,
      tip: [['Già speso per la gestione', eur(c.management)]],
    })),
  );
  const managementTitle = $derived(
    focusManagement && byManagement.length > 0
      ? `${focusName} riserva alla gestione il ${pct(focusManagement.managementShare, 1)}: ${ordinal(focusRank)} quota più alta su ${byManagement.length}. Media UE ${pct(euShare, 1)}`
      : 'Nessun importo con questi filtri',
  );

  const closed = $derived(countryLeakage(rowsFor(CLOSED)).sort((a, b) => b.unspent - a.unspent));
  const closedEu = $derived(leakage(rowsFor(CLOSED)));
  const unspentItems = $derived<RankItem[]>(
    closed.map((c) => ({
      key: c.code,
      label: c.name,
      value: c.unspent,
      accent: c.code === focus,
      detail: `${pct(c.unspentShare, 1)} della sua quota`,
    })),
  );
  const unspentTitle = $derived(
    closed.length > 0 && closed[0].unspent > 0
      ? `${closed[0].name} ha lasciato non spesi ${eur(closed[0].unspent)}, più di chiunque altro`
      : 'Nessun importo non speso con questi filtri',
  );

  const audit = latestAudit();
  const rates: RateSeries[] = [
    { key: 'cohesion', label: 'Coesione', color: '--cat-2', values: AUDIT_YEARS.map((y) => y.cohesion) },
    { key: 'overall', label: 'Bilancio UE', color: '--cat-1', values: AUDIT_YEARS.map((y) => y.overall) },
  ];
  const auditTitle = `Nel ${audit.year} il ${decimal(audit.overall)}% della spesa europea non rispettava le regole${audit.cohesion === null ? '' : `; nella coesione il ${decimal(audit.cohesion)}%`}`;

  const share = (part: number, value: Leakage): number => ratio(part, value.planned);
  const kpis = $derived<Kpi[]>([
    { label: 'Riservato alla gestione', value: pct(euShare, 1), share: euShare, detail: `${eur(eu.managementPlanned)} in tutta l’Unione, ${periodLabel(filters.period)}` },
    ...(focusManagement
      ? [{ label: `${focusName}: gestione`, value: pct(focusManagement.managementShare, 1), share: focusManagement.managementShare, detail: `${eur(focusManagement.managementPlanned)} · ${ordinal(focusRank)} quota più alta` }]
      : []),
    { label: `Non speso ${periodLabel(CLOSED)}`, value: eur(closedEu.unspent), share: share(closedEu.unspent, closedEu), detail: `${pct(share(closedEu.unspent, closedEu), 1)} del pianificato, stima al ${closedSource.asOf}` },
    { label: `Errori rilevati nel ${audit.year}`, value: `${decimal(audit.overall)}%`, share: audit.overall / 100, detail: 'Spesa UE non conforme alle regole secondo la Corte dei conti' },
  ]);
</script>

<Tooltip />

<PageHead kicker="{scope} · gestione, residui, errori" title="Cento euro stanziati: quanti arrivano a un progetto">
  Tra lo stanziamento e il cantiere il denaro si assottiglia in tre modi che si possono contare: una parte paga la macchina che
  gestisce i fondi, una parte non viene spesa in tempo, una parte viene spesa fuori dalle regole. Un quarto modo, il più citato,
  non è scritto in nessun archivio: il tempo e i soldi che servono a chi partecipa.
</PageHead>

<FilterBar />

<Kpis items={kpis} />

<section class="block">
  <ChartFrame
    kicker="Che fine fanno cento euro"
    title={splitTitle}
    note="Ogni barra vale 100 euro pianificati. “Alla gestione” è l’assistenza tecnica già spesa: uffici, controlli, consulenze. Nel ciclo {periodLabel('2127')}, ancora in corso, “non spesi” significa non ancora spesi; nel {periodLabel(CLOSED)} è una stima con i dati al {closedSource.asOf}, prima della chiusura definitiva dei programmi."
    {source}
    table={{
      columns: ['Area e ciclo', 'Pianificato (€)', 'Ai progetti (€ su 100)', 'Alla gestione (€ su 100)', 'Non spesi (€ su 100)'],
      rows: splits.map((row, i) => [row.label, Math.round(row.value.planned), ...splitRows[i].values.map((v) => Math.round(v * 10) / 10)]),
    }}
    filename="cento-euro-{focus.toLowerCase()}"
  >
    <SplitBars parts={PARTS} rows={splitRows} format={euros} />
  </ChartFrame>
</section>

<section class="block two">
  <ChartFrame
    kicker="Il costo della macchina · {periodLabel(filters.period)}"
    title={managementTitle}
    note="Quota del pianificato riservata all’assistenza tecnica. È il costo di gestione che i programmi mettono a carico dei fondi europei: non comprende il personale pagato dai bilanci nazionali."
    {source}
    table={{
      columns: ['Paese', 'Pianificato (€)', 'Gestione pianificata (€)', 'Gestione spesa (€)', 'Quota gestione (%)'],
      rows: byManagement.map((c) => [c.name, Math.round(c.planned), Math.round(c.managementPlanned), Math.round(c.management), Math.round(c.managementShare * 1000) / 10]),
    }}
    filename="gestione-paesi-{filters.period}"
  >
    <RankBars items={managementItems} format={(v) => pct(v, 1)} valueLabel="Quota per la gestione" numbered />
  </ChartFrame>

  <ChartFrame
    kicker="I soldi rimasti fermi · {periodLabel(CLOSED)}"
    title={unspentTitle}
    note="Differenza tra il pianificato e la spesa dichiarata, quota dell’Unione. La spesa è stimata e i dati si fermano al {closedSource.asOf}: il residuo definitivo, dopo la chiusura dei programmi, è più basso."
    source={closedSource}
    table={{
      columns: ['Paese', 'Pianificato (€)', 'Non speso (€)', 'Non speso (%)'],
      rows: closed.map((c) => [c.name, Math.round(c.planned), Math.round(c.unspent), Math.round(c.unspentShare * 1000) / 10]),
    }}
    filename="non-speso-paesi-{CLOSED}"
  >
    <RankBars items={unspentItems} format={eur} valueLabel="Non speso" numbered />
  </ChartFrame>
</section>

<section class="block narrow">
  <ChartFrame
    kicker="Spesi, ma non secondo le regole"
    title={auditTitle}
    note="Livello di errore stimato dalla Corte dei conti europea su un campione di pagamenti: costi non ammissibili, appalti irregolari, documenti mancanti. Non misura le frodi né gli sprechi: un progetto irregolare può essere utile, uno in regola può essere inutile. Sopra il {MATERIALITY}% la Corte giudica l’errore “rilevante”."
    source={AUDIT_SOURCE}
    table={{ columns: ['Anno', 'Bilancio UE (%)', 'Coesione (%)'], rows: AUDIT_YEARS.map((y) => [y.year, y.overall, y.cohesion ?? '']) }}
    filename="errori-corte-dei-conti"
  >
    <RateLines
      years={AUDIT_YEARS.map((y) => y.year)}
      series={rates}
      threshold={MATERIALITY}
      thresholdLabel="Soglia {MATERIALITY}%"
      format={(v) => `${decimal(v)}%`}
      label="Livello di errore stimato dalla Corte dei conti europea, per anno"
    />
  </ChartFrame>
</section>

<section class="block narrow prose">
  <h2>Quello che questi numeri non dicono</h2>
  <ul>
    <li>
      <strong>La burocrazia a carico di chi partecipa.</strong> Scrivere un bando, rispondere, rendicontare ogni fattura costa
      tempo e consulenti a ministeri, regioni, comuni e imprese. Nessuna fonte pubblica lo misura in modo sistematico, e non
      compare in nessuna delle barre qui sopra.
    </li>
    <li>
      <strong>Il personale pagato dagli Stati.</strong> L’assistenza tecnica è solo la parte di gestione messa a carico dei fondi
      europei. Gli uffici finanziati dai bilanci nazionali e regionali restano fuori.
    </li>
    <li>
      <strong>Se il progetto è servito.</strong> “Speso” vuol dire che la fattura è stata rendicontata, non che l’opera funzioni o
      che fosse la scelta migliore.
    </li>
    <li>
      <strong>Le tre misure non si sommano.</strong> L’errore della Corte riguarda denaro già contato tra lo speso, e in parte
      viene poi recuperato con le correzioni finanziarie.
    </li>
  </ul>
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
  .narrow {
    max-width: 860px;
  }
  @media (max-width: 900px) {
    .two {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
