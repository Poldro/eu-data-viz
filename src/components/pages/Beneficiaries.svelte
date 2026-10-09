<script lang="ts">
  import ftsJson from '../../data/fts.json';
  import { areaName, COUNTRIES, HOME_COUNTRY, isMemberState } from '../../lib/countries';
  import { source as sourceById } from '../../lib/data';
  import { eur, int, pct } from '../../lib/format';
  import type { FtsSummary } from '../../lib/fts';
  import { ftsProgrammeLabel, ftsTypeLabel } from '../../lib/labels';
  import ChartFrame from '../ChartFrame.svelte';
  import Kpis, { type Kpi } from '../Kpis.svelte';
  import PageHead from '../PageHead.svelte';
  import Tooltip from '../Tooltip.svelte';
  import RankBars, { type RankItem } from '../charts/RankBars.svelte';

  const fts = ftsJson as FtsSummary;
  const source = sourceById('fts');
  const TOP_PROGRAMMES = 12;
  const PAGE_SIZE = 40;
  const MIN_QUERY = 2;

  const countries = [...COUNTRIES].sort((a, b) => a.name.localeCompare(b.name, 'it'));
  const types = [...new Set(fts.top.map((b) => b.type))].sort((a, b) => ftsTypeLabel(a).localeCompare(ftsTypeLabel(b), 'it'));
  const countryLabel = (key: string) => (isMemberState(key) ? areaName(key) : key);

  let country = $state(HOME_COUNTRY);
  let type = $state('');
  let query = $state('');
  let shown = $state(PAGE_SIZE);

  const needle = $derived(query.trim().toUpperCase());
  const matches = $derived(
    fts.top.filter(
      (b) =>
        (!country || b.country === country) &&
        (!type || b.type === type) &&
        (needle.length < MIN_QUERY || b.name.toUpperCase().includes(needle)),
    ),
  );
  const visible = $derived(matches.slice(0, shown));

  function resetPaging(): void {
    shown = PAGE_SIZE;
  }

  const home = fts.byCountry.find((b) => b.key === HOME_COUNTRY);
  const memberCountries = fts.byCountry.filter((b) => isMemberState(b.key));
  const homeRank = memberCountries.findIndex((b) => b.key === HOME_COUNTRY) + 1;

  const kpis: Kpi[] = [
    { label: `Impegnato nel ${fts.year}`, value: eur(fts.total), detail: 'Fondi gestiti direttamente dalla Commissione e dalle sue agenzie' },
    { label: 'Impegni di spesa', value: int(fts.commitments), detail: 'Sovvenzioni, appalti e contributi registrati' },
    { label: 'Beneficiari', value: int(fts.beneficiaries), detail: 'Enti e imprese distinti, escluse le persone fisiche' },
    ...(home
      ? [{ label: 'A beneficiari italiani', value: eur(home.amount), share: home.amount / fts.total, detail: `${pct(home.amount / fts.total, 1)} del totale · ${homeRank}º paese UE` }]
      : []),
  ];

  const programmes: RankItem[] = fts.byProgramme.slice(0, TOP_PROGRAMMES).map((p) => ({
    key: p.key,
    label: ftsProgrammeLabel(p.key),
    value: p.amount,
    detail: `${int(p.commitments)} impegni · ${pct(p.amount / fts.total, 1)} del totale`,
  }));
  const byCountry: RankItem[] = memberCountries.map((c) => ({
    key: c.key,
    label: areaName(c.key),
    value: c.amount,
    accent: c.key === HOME_COUNTRY,
    detail: `${int(c.commitments)} impegni`,
  }));
  const byType: RankItem[] = fts.byType.slice(0, 8).map((t) => ({
    key: t.key,
    label: ftsTypeLabel(t.key),
    value: t.amount,
    detail: `${pct(t.amount / fts.total, 1)} del totale`,
  }));

  const listTable = $derived({
    columns: ['Beneficiario', 'Paese', 'Tipo', 'Programma principale', 'Impegni', 'Importo (€)'],
    rows: matches.map((b) => [b.name, countryLabel(b.country), ftsTypeLabel(b.type), ftsProgrammeLabel(b.programme), b.commitments, b.amount]),
  });
</script>

<Tooltip />

<PageHead kicker="Gestione diretta · bilancio {fts.year}" title="Chi incassa i fondi gestiti da Bruxelles">
  Non tutto passa dalle regioni. Ricerca, Erasmus, grandi reti, aiuti esterni: qui la Commissione firma direttamente con università,
  imprese, agenzie e governi. Ogni contratto è pubblico, con nome e importo.
</PageHead>

<Kpis items={kpis} />

<section class="block two">
  <ChartFrame
    kicker="Per programma"
    title="{programmes[0].label} pesa per {pct(programmes[0].value / fts.total)}"
    note="La prima voce raccoglie i trasferimenti ad agenzie e istituzioni europee: non sono sovvenzioni a terzi, ma il loro bilancio di funzionamento."
    {source}
    table={{ columns: ['Programma', 'Importo (€)', 'Impegni'], rows: fts.byProgramme.map((p) => [ftsProgrammeLabel(p.key), p.amount, p.commitments]) }}
    filename="fts-{fts.year}-programmi"
  >
    <RankBars items={programmes} format={eur} valueLabel="Impegnato" />
  </ChartFrame>

  <div class="stack">
    <ChartFrame
      kicker="Per tipo di beneficiario"
      title="{byType[0].label}: {pct(byType[0].value / fts.total)} degli impegni"
      {source}
      table={{ columns: ['Tipo', 'Importo (€)'], rows: fts.byType.map((t) => [ftsTypeLabel(t.key), t.amount]) }}
      filename="fts-{fts.year}-tipi"
    >
      <RankBars items={byType} format={eur} valueLabel="Impegnato" />
    </ChartFrame>
  </div>
</section>

<section class="block narrow">
  <ChartFrame
    kicker="Per paese del beneficiario"
    title="{byCountry[0].label} in testa; Italia {homeRank}ª tra i Ventisette"
    note="Conta la sede legale di chi firma, non il luogo in cui il denaro viene speso. Belgio e Lussemburgo ospitano istituzioni e fornitori dell’UE: per questo salgono in classifica."
    {source}
    table={{ columns: ['Paese', 'Importo (€)', 'Impegni'], rows: fts.byCountry.map((c) => [countryLabel(c.key), c.amount, c.commitments]) }}
    filename="fts-{fts.year}-paesi"
  >
    <RankBars items={byCountry} format={eur} valueLabel="Impegnato" numbered />
  </ChartFrame>
</section>

<section class="block">
  <ChartFrame
    kicker="Cerca un beneficiario"
    title="{int(matches.length)} nomi corrispondono ai filtri"
    note="L’elenco contiene i primi 800 beneficiari per importo e, in più, i primi 60 di ogni Stato membro. Le persone fisiche non sono mai elencate. Per la ricerca completa c’è il sito della Commissione."
    {source}
    table={listTable}
    filename="fts-{fts.year}-beneficiari"
  >
    <div class="controls">
      <label>
        <span class="kicker">Nome</span>
        <input type="search" placeholder="es. università, Leonardo, comune…" bind:value={query} oninput={resetPaging} />
      </label>
      <label>
        <span class="kicker">Paese</span>
        <select bind:value={country} onchange={resetPaging}>
          <option value="">Tutti</option>
          {#each countries as c (c.code)}<option value={c.code}>{c.name}</option>{/each}
        </select>
      </label>
      <label>
        <span class="kicker">Tipo</span>
        <select bind:value={type} onchange={resetPaging}>
          <option value="">Tutti</option>
          {#each types as t (t)}<option value={t}>{ftsTypeLabel(t)}</option>{/each}
        </select>
      </label>
    </div>

    {#if matches.length === 0}
      <p class="empty">Nessun beneficiario in elenco con questi criteri.</p>
    {:else}
      <ol class="list">
        {#each visible as b, i (`${b.name}|${b.country}|${i}`)}
          <li>
            <span class="rank figure">{i + 1}</span>
            <div class="who">
              <span class="name">{b.name}</span>
              <span class="meta">{countryLabel(b.country)} · {ftsTypeLabel(b.type)} · {ftsProgrammeLabel(b.programme)}</span>
            </div>
            <div class="amount">
              <span class="figure">{eur(b.amount)}</span>
              <span class="meta">{int(b.commitments)} {b.commitments === 1 ? 'impegno' : 'impegni'}</span>
            </div>
          </li>
        {/each}
      </ol>
      {#if matches.length > shown}
        <button type="button" class="btn more" onclick={() => (shown += PAGE_SIZE)}>Mostra altri {Math.min(PAGE_SIZE, matches.length - shown)}</button>
      {/if}
    {/if}
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
  .narrow {
    max-width: 820px;
  }
  .controls {
    display: grid;
    grid-template-columns: minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1fr);
    gap: 12px;
    margin-bottom: 14px;
  }
  label {
    display: flex;
    flex-direction: column;
    gap: 5px;
    min-width: 0;
  }
  input,
  select {
    min-height: 38px;
    width: 100%;
    padding: 0 10px;
    border: 1px solid var(--rule);
    border-radius: 0;
    background: var(--paper);
    font-family: var(--font-data);
    font-size: 0.78rem;
    color: var(--ink);
  }
  input::placeholder {
    color: var(--ink-3);
  }
  .list {
    margin: 0;
    padding: 0;
    list-style: none;
    border-top: 1px solid var(--rule);
  }
  .list li {
    display: grid;
    grid-template-columns: 2.4em minmax(0, 1fr) auto;
    gap: 10px;
    align-items: baseline;
    padding: 9px 0;
    border-bottom: 1px solid var(--rule-soft);
  }
  .rank {
    font-size: 0.7rem;
    color: var(--ink-3);
  }
  .name {
    display: block;
    font-family: var(--font-display);
    font-weight: 500;
    font-size: 1.02rem;
    line-height: 1.2;
    overflow-wrap: anywhere;
  }
  .meta {
    display: block;
    margin-top: 2px;
    font-family: var(--font-data);
    font-size: 0.62rem;
    letter-spacing: 0.03em;
    color: var(--ink-3);
  }
  .amount {
    text-align: right;
    white-space: nowrap;
  }
  .amount .figure {
    font-size: 0.92rem;
    font-weight: 500;
  }
  .more {
    margin-top: 14px;
  }
  .empty {
    padding: 28px 0;
    color: var(--ink-2);
    font-style: italic;
  }
  @media (max-width: 900px) {
    .two {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  @media (max-width: 640px) {
    .controls {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
