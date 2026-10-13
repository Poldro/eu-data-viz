<script lang="ts">
  import ftsJson from '../../data/fts.json';
  import lobbyJson from '../../data/lobby.json';
  import { actById, actKind, actNumber, ACT_THEMES, eurlexUrl } from '../../lib/acts';
  import { areaName, COUNTRIES, HOME_COUNTRY, isMemberState } from '../../lib/countries';
  import { source as sourceById } from '../../lib/data';
  import { dateIt, eur, int, monthIt, pct } from '../../lib/format';
  import type { FtsSummary } from '../../lib/fts';
  import {
    atLeast,
    LOBBY_GROUPS,
    lobbyCategoryLabel,
    lobbyGroup,
    matchBeneficiaries,
    MAX_COST_PER_FTE,
    rangeLabel,
    type LobbyOrg,
    type LobbySummary,
  } from '../../lib/lobby';
  import { matchesQuery } from '../../lib/search';
  import ChartFrame from '../ChartFrame.svelte';
  import Kpis, { type Kpi } from '../Kpis.svelte';
  import PageHead from '../PageHead.svelte';
  import Tooltip from '../Tooltip.svelte';
  import RankBars, { type RankItem } from '../charts/RankBars.svelte';
  import SplitBars, { type SplitPart, type SplitRow } from '../charts/SplitBars.svelte';

  const lobby = lobbyJson as LobbySummary;
  const fts = ftsJson as FtsSummary;
  const source = sourceById('lobby');
  const ftsSource = sourceById('fts');
  const REGISTER_PAGE = 'https://transparency-register.europa.eu/search-register-or-update/organisation-detail_en?id=';
  const TOP_SPENDERS = 15;
  const TOP_COUNTRIES = 12;
  const TOP_ACTS = 14;
  const TOP_FUNDED = 15;
  const PAGE_SIZE = 40;

  const countryLabel = (key: string) => (isMemberState(key) ? areaName(key) : key);
  const countries = [...COUNTRIES].sort((a, b) => a.name.localeCompare(b.name, 'it'));
  const categories = [...new Set(lobby.top.map((o) => o.category))].sort((a, b) => lobbyCategoryLabel(a).localeCompare(lobbyCategoryLabel(b), 'it'));
  /** Ogni atto dell'elenco con l'anagrafica e il conteggio di chi lo nomina, dal più seguito. */
  const acts = lobby.acts.flatMap((summary) => {
    const act = actById(summary.id);
    return act ? [{ ...summary, act }] : [];
  });

  // Le classifiche escludono le cifre fuori scala; nella ricerca restano, con un avviso.
  const spenders = lobby.top.filter((o) => o.kind === 'own' && o.range && !o.doubtful);
  const home = lobby.byCountry.find((b) => b.key === HOME_COUNTRY);
  const homeRank = lobby.byCountry.findIndex((b) => b.key === HOME_COUNTRY) + 1;

  const kpis: Kpi[] = [
    { label: 'Organizzazioni iscritte', value: int(lobby.organisations), detail: `Nel Registro per la trasparenza a ${monthIt(source.asOf)}` },
    {
      label: 'Spesa annua dichiarata',
      value: `≥ ${eur(lobby.min)}`,
      detail: `Tra ${eur(lobby.min)} e ${eur(lobby.max)}, secondo ${int(lobby.withCosts)} iscritti che indicano una fascia di costo`,
    },
    { label: 'Addetti a tempo pieno', value: int(lobby.fte), detail: `${int(lobby.passes)} persone hanno un accesso accreditato al Parlamento europeo` },
    ...(home ? [{ label: 'Iscritti con sede in Italia', value: int(home.organisations), detail: `Dichiarano almeno ${eur(home.min)} · ${homeRank}º paese per spesa` }] : []),
  ];

  const byCategory: RankItem[] = lobby.byCategory
    .filter((c) => c.min > 0)
    .map((c) => ({
      key: c.key,
      label: lobbyCategoryLabel(c.key),
      value: c.min,
      detail: `${int(c.organisations)} iscritti · fino a ${eur(c.max)}`,
    }));
  const businessShare = lobby.byCategory.filter((c) => lobbyGroup(c.key) === 'business').reduce((sum, c) => sum + c.min, 0) / lobby.min;
  const byCountry: RankItem[] = lobby.byCountry.slice(0, TOP_COUNTRIES).map((c) => ({
    key: c.key,
    label: countryLabel(c.key),
    value: c.min,
    accent: c.key === HOME_COUNTRY,
    detail: `${int(c.organisations)} iscritti`,
  }));
  const topSpenders: RankItem[] = spenders.slice(0, TOP_SPENDERS).map((o) => ({
    key: o.id,
    label: o.name,
    value: o.range?.min ?? 0,
    href: REGISTER_PAGE + o.id,
    detail: `${countryLabel(o.country)} · ${lobbyCategoryLabel(o.category)} · ${int(o.fte)} addetti`,
    tip: [['Fascia dichiarata', rangeLabel(o.range)]],
  }));

  const GROUP_PARTS: SplitPart[] = LOBBY_GROUPS.map((g, i) => ({ key: g.key, label: g.label, color: `--cat-${i + 1}` }));
  const groupCounts = (byCat: { key: string; organisations: number }[]): number[] =>
    LOBBY_GROUPS.map((g) => byCat.filter((c) => lobbyGroup(c.key) === g.key).reduce((sum, c) => sum + c.organisations, 0));
  const actRows: SplitRow[] = acts.slice(0, TOP_ACTS).map((a) => ({
    key: a.id,
    label: a.act.name,
    detail: `${int(a.organisations)} iscritti`,
    values: groupCounts(a.byCategory),
  }));

  let actId = $state(acts[0].id);
  const selected = $derived(acts.find((a) => a.id === actId) ?? acts[0]);
  const followers: RankItem[] = $derived(
    selected.top.map((o) => ({
      key: o.id,
      label: o.name,
      value: o.range?.min ?? 0,
      href: REGISTER_PAGE + o.id,
      detail: `${countryLabel(o.country)} · ${lobbyCategoryLabel(o.category)}`,
      tip: [['Fascia dichiarata', rangeLabel(o.range)]],
    })),
  );

  const ftsAmounts = matchBeneficiaries(lobby.top, fts.top);
  const funded = lobby.top
    .flatMap((o) => {
      const amount = ftsAmounts.get(o.id);
      return amount !== undefined && o.kind === 'own' && o.range && !o.doubtful ? [{ org: o, amount }] : [];
    })
    .sort((a, b) => b.amount - a.amount);
  const fundedItems: RankItem[] = funded.slice(0, TOP_FUNDED).map(({ org, amount }) => ({
    key: org.id,
    label: org.name,
    value: amount,
    href: REGISTER_PAGE + org.id,
    detail: `${countryLabel(org.country)} · ${lobbyCategoryLabel(org.category)} · lobbying: ${rangeLabel(org.range)}`,
  }));

  let query = $state('');
  let country = $state('');
  let category = $state('');
  let follows = $state('');
  let shown = $state(PAGE_SIZE);

  const matches = $derived(
    lobby.top.filter(
      (o) => (!country || o.country === country) && (!category || o.category === category) && (!follows || o.acts.includes(follows)) && matchesQuery(o.name, query),
    ),
  );
  const visible = $derived(matches.slice(0, shown));

  function resetPaging(): void {
    shown = PAGE_SIZE;
  }

  /** Che cosa dichiara l'iscritto, nella forma breve usata in elenco e nel CSV. */
  function declared(o: LobbyOrg): string {
    if (o.kind === 'budget') return 'nessuna spesa di lobbying';
    return o.range ? rangeLabel(o.range) : 'non dichiarato';
  }
  const measure = (o: LobbyOrg): string => (o.kind === 'clients' ? 'ricavi dai clienti' : o.kind === 'own' ? 'costi di lobbying' : 'dichiara solo il bilancio');

  const listTable = $derived({
    columns: ['Organizzazione', 'Numero di iscrizione', 'Paese', 'Categoria', 'Misura', 'Minimo (€)', 'Massimo (€)', 'Addetti', 'Accessi al Parlamento', 'Cifra anomala', 'Atti nominati'],
    rows: matches.map((o) => [
      o.name,
      o.id,
      countryLabel(o.country),
      lobbyCategoryLabel(o.category),
      measure(o),
      o.range?.min ?? '',
      o.range?.max ?? '',
      o.fte,
      o.passes,
      o.doubtful ? 'sì' : 'no',
      o.acts.map((id) => actById(id)?.name ?? id).join(' | '),
    ]),
  });
</script>

<Tooltip />

<PageHead kicker="Registro per la trasparenza · dati a {monthIt(source.asOf)}" title="Chi fa lobbying a Bruxelles, e su quali leggi">
  A Bruxelles non si finanziano i partiti come a Washington: si pagano uffici, consulenti e associazioni per farsi ascoltare. Chi vuole
  incontrare commissari ed eurodeputati deve iscriversi a un registro pubblico e dire quanto spende e quali leggi segue.
</PageHead>

<aside class="caveat" aria-labelledby="caveat-title">
  <h2 id="caveat-title" class="kicker">Prima di leggere i numeri</h2>
  <ul>
    <li><strong>Sono autodichiarazioni.</strong> Ogni cifra è scritta dall’organizzazione stessa, per fasce, e nessuna autorità la verifica.</li>
    <li>
      <strong>Seguire una legge non vuol dire averla scritta.</strong> Il Registro dice chi ha dichiarato interesse per un atto, non chi ha
      ottenuto che cosa. Nessun numero di questa pagina dimostra un’influenza.
    </li>
    <li><strong>Non sono donazioni.</strong> Sono i costi che ciascuno sostiene per la propria attività di rappresentanza: stipendi, uffici, consulenze.</li>
  </ul>
  <p><a href="/metodo/#lobby">Come sono fatti questi numeri →</a></p>
</aside>

<Kpis items={kpis} />

<section class="block two">
  <ChartFrame
    kicker="Per tipo di organizzazione"
    title="Imprese e loro associazioni dichiarano {pct(businessShare)} della spesa"
    note="Somma dei minimi delle fasce di costo. Le società di consulenza e gli studi legali dichiarano i ricavi dai clienti, che sono già nei costi di chi li paga: qui non sono sommati. Le ONG dichiarano il bilancio intero, non una spesa di lobbying, e compaiono solo se rappresentano i propri iscritti."
    {source}
    table={{
      columns: ['Categoria', 'Iscritti', 'Spesa minima (€)', 'Spesa massima (€)'],
      rows: lobby.byCategory.map((c) => [lobbyCategoryLabel(c.key), c.organisations, c.min, c.max]),
    }}
    filename="lobby-categorie"
  >
    <RankBars items={byCategory} format={eur} valueLabel="Almeno" />
  </ChartFrame>

  <ChartFrame
    kicker="Per paese della sede"
    title="{byCountry[0].label} in testa{home ? `; Italia ${homeRank}ª` : ''}"
    note="Conta la sede legale, non dove si fa lobbying. Il Belgio ospita le associazioni europee di categoria; Stati Uniti, Regno Unito e Svizzera compaiono perché il Registro è aperto a chiunque."
    {source}
    table={{
      columns: ['Paese', 'Iscritti', 'Spesa minima (€)', 'Spesa massima (€)'],
      rows: lobby.byCountry.map((c) => [countryLabel(c.key), c.organisations, c.min, c.max]),
    }}
    filename="lobby-paesi"
  >
    <RankBars items={byCountry} format={eur} valueLabel="Almeno" numbered />
  </ChartFrame>
</section>

<section class="block narrow">
  <ChartFrame
    kicker="Chi dichiara di più"
    title="{topSpenders[0].label} in cima: {rangeLabel(spenders[0].range)} l’anno"
    note="La barra è il minimo della fascia dichiarata per l’ultimo esercizio chiuso; a parità di fascia viene prima chi ha più addetti. Sono esclusi {int(lobby.doubtful)} iscritti che dichiarano oltre {eur(MAX_COST_PER_FTE)} per addetto: quasi sempre hanno indicato il bilancio dell’intera organizzazione."
    {source}
    table={{
      columns: ['Organizzazione', 'Paese', 'Categoria', 'Minimo (€)', 'Massimo (€)', 'Addetti'],
      rows: spenders.slice(0, 100).map((o) => [o.name, countryLabel(o.country), lobbyCategoryLabel(o.category), o.range?.min ?? '', o.range?.max ?? '', o.fte]),
    }}
    filename="lobby-primi-per-spesa"
  >
    <RankBars items={topSpenders} format={(v) => `≥ ${eur(v)}`} valueLabel="Costi dichiarati" numbered />
  </ChartFrame>
</section>

<section class="block">
  <ChartFrame
    kicker="Quali leggi seguono"
    title="{acts[0].act.name}: lo nominano {int(acts[0].organisations)} iscritti"
    note="Per {int(acts.length)} atti approvati dal 2019, quanti iscritti li nominano tra i dossier che dichiarano di seguire, e di che tipo sono. Il campo è testo libero: l’atto è riconosciuto per nome, sigla o numero, quindi il conteggio è per difetto. Solo il {pct(lobby.matched / lobby.organisations)} degli iscritti nomina almeno uno di questi atti."
    {source}
    table={{
      columns: ['Atto', 'Numero', 'Data', 'Tema', 'Iscritti', ...LOBBY_GROUPS.map((g) => g.label), 'Spesa minima di chi lo segue (€)'],
      rows: acts.map((a) => [a.act.name, actNumber(a.act.celex), a.act.date, ACT_THEMES[a.act.theme], a.organisations, ...groupCounts(a.byCategory), a.min]),
    }}
    filename="lobby-atti"
  >
    <SplitBars parts={GROUP_PARTS} rows={actRows} format={int} />
  </ChartFrame>
</section>

<section class="block narrow">
  <ChartFrame
    kicker="Un atto alla volta"
    title="{selected.act.name}: i primi per spesa tra chi lo segue"
    note="La spesa è quella complessiva dell’organizzazione, non quella dedicata a questo atto: chi segue dieci dossier compare in tutti e dieci con la stessa cifra. Dice quanto pesa chi si è interessato alla legge, non quanto è costato influenzarla."
    {source}
    table={{
      columns: ['Organizzazione', 'Paese', 'Categoria', 'Minimo (€)', 'Massimo (€)'],
      rows: selected.top.map((o) => [o.name, countryLabel(o.country), lobbyCategoryLabel(o.category), o.range?.min ?? '', o.range?.max ?? '']),
    }}
    filename="lobby-atto-{selected.id}"
  >
    <div class="controls one">
      <label>
        <span class="kicker">Atto</span>
        <select bind:value={actId}>
          {#each acts as a (a.id)}<option value={a.id}>{a.act.name} ({int(a.organisations)})</option>{/each}
        </select>
      </label>
    </div>
    <p class="act">
      {actKind(selected.act.celex)} (UE) {actNumber(selected.act.celex)} del {dateIt(selected.act.date)} · {ACT_THEMES[selected.act.theme]} ·
      <a href={eurlexUrl(selected.act.celex)} rel="noopener">testo su EUR-Lex</a><br />
      Lo nominano {int(selected.organisations)} iscritti, che in tutto dichiarano tra {eur(selected.min)} e {eur(selected.max)} l’anno per l’intera attività.
    </p>
    <RankBars items={followers} format={(v) => `≥ ${eur(v)}`} valueLabel="Costi dichiarati" numbered />
  </ChartFrame>
</section>

{#if fundedItems.length > 0}
  <section class="block narrow">
    <ChartFrame
      kicker="Lobby e fondi europei"
      title="{int(funded.length)} iscritti sono anche tra i primi beneficiari dei fondi diretti"
      note="Chi dichiara costi di lobbying e nel {fts.year} ha firmato impegni di spesa con la Commissione. La barra è l’importo impegnato; sotto, la fascia di lobbying dichiarata. I due archivi non hanno un codice comune: l’abbinamento è per nome identico e stesso paese, e riguarda solo i beneficiari elencati nella sezione Beneficiari. Ricevere fondi e fare lobbying sono entrambi leciti: nel Registro {int(lobby.grantees)} iscritti ({pct(lobby.grantees / lobby.organisations)}) dichiarano sovvenzioni dell’Unione."
      source={ftsSource}
      table={{
        columns: ['Organizzazione', 'Paese', 'Categoria', `Impegni FTS ${fts.year} (€)`, 'Lobbying minimo (€)', 'Lobbying massimo (€)', 'Sovvenzioni UE dichiarate al Registro (€)'],
        rows: funded.map(({ org, amount }) => [org.name, countryLabel(org.country), lobbyCategoryLabel(org.category), amount, org.range?.min ?? '', org.range?.max ?? '', org.grants]),
      }}
      filename="lobby-e-fondi-{fts.year}"
    >
      <RankBars items={fundedItems} format={eur} valueLabel="Impegnato nel {fts.year}" numbered />
    </ChartFrame>
  </section>
{/if}

<section class="block">
  <ChartFrame
    kicker="Cerca un’organizzazione"
    title="{int(matches.length)} iscritti corrispondono ai filtri"
    note="L’elenco contiene i primi iscritti per fascia dichiarata e per numero di addetti, i primi di ogni Stato membro e chi compare anche tra i beneficiari dei fondi diretti: non tutti i {int(lobby.organisations)}. Le persone fisiche non sono mai elencate. Il nome rimanda alla scheda completa sul Registro."
    {source}
    table={listTable}
    filename="lobby-iscritti"
  >
    <div class="controls">
      <label>
        <span class="kicker">Nome</span>
        <input type="search" placeholder="es. Eni, Confindustria, Meta…" bind:value={query} oninput={resetPaging} />
      </label>
      <label>
        <span class="kicker">Paese</span>
        <select bind:value={country} onchange={resetPaging}>
          <option value="">Tutti</option>
          {#each countries as c (c.code)}<option value={c.code}>{c.name}</option>{/each}
        </select>
      </label>
      <label>
        <span class="kicker">Categoria</span>
        <select bind:value={category} onchange={resetPaging}>
          <option value="">Tutte</option>
          {#each categories as c (c)}<option value={c}>{lobbyCategoryLabel(c)}</option>{/each}
        </select>
      </label>
      <label>
        <span class="kicker">Segue</span>
        <select bind:value={follows} onchange={resetPaging}>
          <option value="">Qualsiasi atto</option>
          {#each acts as a (a.id)}<option value={a.id}>{a.act.name}</option>{/each}
        </select>
      </label>
    </div>

    {#if matches.length === 0}
      <p class="empty">Nessun iscritto in elenco con questi criteri.</p>
    {:else}
      <ol class="list">
        {#each visible as o, i (o.id)}
          <li>
            <span class="rank figure">{i + 1}</span>
            <div class="who">
              <a class="name" href={REGISTER_PAGE + o.id} rel="noopener">{o.name}</a>
              <span class="meta">
                {countryLabel(o.country)} · {lobbyCategoryLabel(o.category)} · {int(o.fte)} addetti{o.acts.length > 0 ? ` · ${o.acts.length} ${o.acts.length === 1 ? 'atto nominato' : 'atti nominati'}` : ''}
              </span>
            </div>
            <div class="amount">
              <span class="figure">{o.range ? atLeast(o.range) : declared(o)}</span>
              <span class="meta" class:warn={o.doubtful}>{o.doubtful ? 'cifra anomala per gli addetti dichiarati' : measure(o)}</span>
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
  .caveat {
    max-width: 820px;
    margin-bottom: 28px;
    padding: 14px 18px 16px;
    border-left: 3px solid var(--accent);
    background: var(--paper-deep);
  }
  .caveat ul {
    margin: 10px 0 0;
    padding: 0;
    list-style: none;
  }
  .caveat li {
    font-size: 0.95rem;
    line-height: 1.4;
  }
  .caveat li + li {
    margin-top: 6px;
  }
  .caveat p {
    margin-top: 10px;
    font-family: var(--font-data);
    font-size: 0.7rem;
    letter-spacing: 0.03em;
  }
  .act {
    margin-bottom: 14px;
    max-width: var(--measure);
    font-size: 0.93rem;
    color: var(--ink-2);
  }
  .controls {
    display: grid;
    grid-template-columns: minmax(0, 2fr) repeat(3, minmax(0, 1fr));
    gap: 12px;
    margin-bottom: 14px;
  }
  .controls.one {
    grid-template-columns: minmax(0, 1fr);
    max-width: 460px;
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
  .meta.warn {
    color: var(--accent-ink);
  }
  .amount {
    max-width: 15em;
    text-align: right;
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
    .controls {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
  @media (max-width: 640px) {
    .controls {
      grid-template-columns: minmax(0, 1fr);
    }
    .amount {
      max-width: 9em;
    }
  }
</style>
