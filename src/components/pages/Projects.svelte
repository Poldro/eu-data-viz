<script lang="ts">
  import projectsJson from '../../data/projects.json';
  import { source as sourceById } from '../../lib/data';
  import { eur, int, lowerFirst, monthIt, pct } from '../../lib/format';
  import { CYCLES, filterProjects, projectUrl, titleCase, type Projects } from '../../lib/projects';
  import ChartFrame from '../ChartFrame.svelte';
  import Kpis, { type Kpi } from '../Kpis.svelte';
  import PageHead from '../PageHead.svelte';
  import Tooltip from '../Tooltip.svelte';
  import RankBars, { type RankItem } from '../charts/RankBars.svelte';

  const data = projectsJson as Projects;
  const source = sourceById('projects');
  const PAGE_SIZE = 25;

  let cycle = $state(CYCLES[0].id);
  let region = $state('');
  let theme = $state('');
  let query = $state('');
  let shown = $state(PAGE_SIZE);

  const summary = $derived(data.cycles[cycle]);
  const cycleLabel = $derived(CYCLES.find((c) => c.id === cycle)?.label ?? '');
  const share = (part: number, whole: number) => (whole > 0 ? part / whole : 0);

  const kpis = $derived<Kpi[]>([
    { label: 'Progetti', value: int(summary.projects), detail: `monitorati nel ciclo ${cycleLabel}` },
    { label: 'Finanziamento pubblico', value: eur(summary.cost), detail: 'Risorse europee e nazionali insieme' },
    { label: 'Pagato', value: pct(share(summary.paid, summary.cost)), share: share(summary.paid, summary.cost), detail: `${eur(summary.paid)} già erogati` },
    {
      label: 'Importo medio',
      value: eur(share(summary.cost, summary.projects)),
      detail: 'Per progetto: pochi grandi cantieri, moltissimi piccoli interventi',
    },
  ]);

  const toItems = (buckets: typeof summary.themes, label: (text: string) => string): RankItem[] =>
    buckets.map((b) => ({
      key: b.key,
      label: label(b.label),
      value: b.cost,
      detail: `${int(b.projects)} progetti · pagato ${pct(share(b.paid, b.cost))}`,
      tip: [['Pagato', eur(b.paid)]],
    }));
  const themes = $derived(toItems(summary.themes, (t) => t));
  const regions = $derived(toItems(summary.regions, titleCase));
  const states = $derived(toItems(summary.states, (t) => t));

  // Le opzioni dei menu vengono dai progetti in elenco, così ogni scelta ha almeno un risultato possibile.
  const inCycle = $derived(data.projects.filter((p) => p.cycle === cycle));
  const themeOptions = $derived([...new Set(inCycle.map((p) => p.theme))].sort((a, b) => a.localeCompare(b, 'it')));
  const regionOptions = $derived(summary.regions.map((r) => ({ key: r.key, label: titleCase(r.label) })).sort((a, b) => a.label.localeCompare(b.label, 'it')));
  const regionLabel = (key: string) => regionOptions.find((r) => r.key === key)?.label ?? key;

  // La fonte non fornisce la classifica dei progetti per tutti i cicli (vedi Metodo).
  const hasList = $derived(inCycle.length > 0);
  const matches = $derived(filterProjects(data.projects, { cycle, region, theme, query }));
  const visible = $derived(matches.slice(0, shown));

  function resetPaging(): void {
    shown = PAGE_SIZE;
  }

  function pickCycle(id: string): void {
    cycle = id;
    theme = '';
    resetPaging();
  }

  const where = (keys: string[]): string =>
    keys.length === 0 ? 'Ambito nazionale' : keys.length > 3 ? `${keys.length} regioni` : keys.map(regionLabel).join(', ');
  const listTable = $derived({
    columns: ['Progetto', 'Beneficiario', 'Tema', 'Stato', 'Regioni', 'Finanziamento pubblico (€)', 'Pagato (€)'],
    rows: matches.map((p) => [p.title, p.beneficiary, p.theme, p.state, p.regions.map(regionLabel).join(', '), p.cost, p.paid]),
  });
</script>

<Tooltip />

<PageHead kicker="Italia · ciclo {cycleLabel} · dati a {monthIt(source.asOf)}" title="Dal capitolo di spesa al cantiere">
  Dietro i miliardi ci sono {int(summary.projects)} progetti con un nome, un responsabile e uno stato di avanzamento: una ferrovia,
  un depuratore, un bonus per chi assume. Sono i dati di OpenCoesione, il portale del governo italiano, e comprendono anche le
  risorse nazionali per la coesione oltre a quelle europee.
</PageHead>

<div class="controls" role="group" aria-label="Ciclo di programmazione">
  <span class="kicker">Ciclo</span>
  <div class="segmented">
    {#each CYCLES as c (c.id)}
      <button type="button" class="btn" aria-pressed={cycle === c.id} onclick={() => pickCycle(c.id)}>{c.label}</button>
    {/each}
  </div>
</div>

<Kpis items={kpis} />

<section class="block two">
  <ChartFrame
    kicker="Per tema"
    title={themes.length > 0 ? `${themes[0].label} è il primo capitolo: ${eur(themes[0].value)}` : 'Nessun dato'}
    {source}
    table={{ columns: ['Tema', 'Finanziamento pubblico (€)', 'Pagato (€)', 'Progetti'], rows: summary.themes.map((b) => [b.label, b.cost, b.paid, b.projects]) }}
    filename="progetti-temi-{cycle}"
  >
    <RankBars items={themes} format={eur} valueLabel="Finanziamento pubblico" />
  </ChartFrame>

  <ChartFrame
    kicker="Per regione"
    title={regions.length > 0 ? `${regions[0].label} in testa con ${eur(regions[0].value)}` : 'Nessun dato'}
    note="Un progetto che interessa più regioni è contato in ciascuna: la somma delle regioni supera il totale nazionale."
    {source}
    table={{ columns: ['Regione', 'Finanziamento pubblico (€)', 'Pagato (€)', 'Progetti'], rows: summary.regions.map((b) => [titleCase(b.label), b.cost, b.paid, b.projects]) }}
    filename="progetti-regioni-{cycle}"
  >
    <RankBars items={regions} format={eur} valueLabel="Finanziamento pubblico" numbered />
  </ChartFrame>
</section>

<section class="block narrow">
  <ChartFrame
    kicker="A che punto sono"
    title={states.length > 0 ? `La quota maggiore delle risorse è nei progetti ${lowerFirst(states[0].label)}` : 'Nessun dato'}
    {source}
    table={{ columns: ['Stato', 'Finanziamento pubblico (€)', 'Progetti'], rows: summary.states.map((b) => [b.label, b.cost, b.projects]) }}
    filename="progetti-stati-{cycle}"
  >
    <RankBars items={states} format={eur} valueLabel="Finanziamento pubblico" />
  </ChartFrame>
</section>

{#if !hasList}
  <p class="caveat">
    <strong>Elenco non disponibile per questo ciclo.</strong> Per il {cycleLabel} OpenCoesione pubblica quasi un milione di
    progetti e la sua interfaccia non restituisce la classifica per costo. I singoli progetti si possono consultare su
    <a href="https://opencoesione.gov.it/it/progetti/" rel="noopener">opencoesione.gov.it</a>.
  </p>
{:else}
<section class="block">
  <ChartFrame
    kicker="I progetti più grandi"
    title="{int(matches.length)} progetti corrispondono ai filtri"
    note="In elenco ci sono i 250 progetti più costosi d’Italia e i 30 più costosi di ogni regione. Per tutti gli altri c’è la ricerca completa su OpenCoesione."
    {source}
    table={listTable}
    filename="progetti-{cycle}"
  >
    <div class="filters">
      <label class="wide">
        <span class="kicker">Titolo o beneficiario</span>
        <input type="search" placeholder="es. depuratore, ferrovia, università…" bind:value={query} oninput={resetPaging} />
      </label>
      <label>
        <span class="kicker">Regione</span>
        <select bind:value={region} onchange={resetPaging}>
          <option value="">Tutte</option>
          {#each regionOptions as r (r.key)}<option value={r.key}>{r.label}</option>{/each}
        </select>
      </label>
      <label>
        <span class="kicker">Tema</span>
        <select bind:value={theme} onchange={resetPaging}>
          <option value="">Tutti</option>
          {#each themeOptions as t (t)}<option value={t}>{t}</option>{/each}
        </select>
      </label>
    </div>

    {#if matches.length === 0}
      <p class="empty">Nessun progetto in elenco con questi criteri.</p>
    {:else}
      <ol class="list">
        {#each visible as p, i (`${p.cycle}|${p.id}`)}
          <li>
            <span class="rank figure">{i + 1}</span>
            <div class="what">
              <a class="title" href={projectUrl(p.id)} rel="noopener">{p.title}</a>
              <span class="meta">{[p.beneficiary, where(p.regions), p.theme].filter(Boolean).join(' · ')}</span>
              <span class="progress" aria-hidden="true"><span style:width="{Math.min(share(p.paid, p.cost), 1) * 100}%"></span></span>
            </div>
            <div class="amount">
              <span class="figure">{eur(p.cost)}</span>
              <span class="meta">{p.state} · pagato {pct(Math.min(share(p.paid, p.cost), 1))}</span>
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
{/if}

<style>
  .controls {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 0 0 14px;
  }
  .segmented {
    display: flex;
  }
  .segmented .btn + .btn {
    border-left: 0;
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
  .narrow {
    max-width: 820px;
  }
  .filters {
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
    align-items: start;
    padding: 10px 0;
    border-bottom: 1px solid var(--rule-soft);
  }
  .rank {
    font-size: 0.7rem;
    line-height: 2;
    color: var(--ink-3);
  }
  .title {
    display: block;
    font-family: var(--font-display);
    font-weight: 500;
    font-size: 1.02rem;
    line-height: 1.22;
    overflow-wrap: anywhere;
  }
  .meta {
    display: block;
    margin-top: 3px;
    font-family: var(--font-data);
    font-size: 0.62rem;
    letter-spacing: 0.03em;
    line-height: 1.45;
    color: var(--ink-3);
  }
  .progress {
    display: block;
    max-width: 320px;
    height: 4px;
    margin-top: 6px;
    background: var(--rule-soft);
  }
  .progress span {
    display: block;
    height: 100%;
    background: var(--seq-5);
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
  .caveat {
    max-width: var(--measure);
    margin-top: 40px;
    padding: 14px 16px;
    background: var(--paper-deep);
    border-left: 3px solid var(--accent);
    font-size: 0.95rem;
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
    .filters {
      grid-template-columns: minmax(0, 1fr);
    }
    .list li {
      grid-template-columns: 1.8em minmax(0, 1fr);
    }
    .amount {
      grid-column: 2;
      text-align: left;
    }
  }
</style>
