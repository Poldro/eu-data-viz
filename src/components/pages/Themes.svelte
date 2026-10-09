<script lang="ts">
  import { areaName } from '../../lib/countries';
  import { filterRows, groupBy, ratio, totals } from '../../lib/cube';
  import { cubeFor, cubeSource, PERIODS } from '../../lib/data';
  import { filters } from '../../lib/filters.svelte';
  import { eur, lowerFirst, monthIt, pct } from '../../lib/format';
  import { categoryLabel, fundLong, fundShort, objectiveLabel } from '../../lib/labels';
  import ChartFrame from '../ChartFrame.svelte';
  import FilterBar from '../FilterBar.svelte';
  import PageHead from '../PageHead.svelte';
  import Tooltip from '../Tooltip.svelte';
  import RankBars, { type RankItem } from '../charts/RankBars.svelte';
  import Treemap, { type TreeGroup } from '../charts/Treemap.svelte';

  const TOP_ITEMS = 15;

  const cube = $derived(cubeFor(filters.period));
  const source = $derived(cubeSource(filters.period));
  const rows = $derived(filterRows(cube.rows, { fund: filters.fund, area: filters.area }));
  const sum = $derived(totals(rows));
  // Solo il ciclo 2021-2027 scende al dettaglio dei campi d'intervento; prima ci si ferma al fondo.
  const hasCategories = $derived(Object.keys(cube.categories).length > 0);
  const leafLabel = (key: string) => (hasCategories ? categoryLabel(cube, key) || 'Non classificato' : fundLong(key));

  let picked = $state('');
  // Cambiando filtri l'obiettivo scelto può sparire: in quel caso la selezione decade.
  const selected = $derived(rows.some((r) => r[2] === picked) ? picked : '');

  const groups = $derived<TreeGroup[]>(
    groupBy(rows, 'objective').map((g) => ({
      key: g.key,
      label: objectiveLabel(cube, g.key),
      planned: g.planned,
      leaves: groupBy(filterRows(rows, { objective: g.key }), hasCategories ? 'category' : 'fund').map((leaf) => ({
        key: leaf.key,
        label: leafLabel(leaf.key),
        planned: leaf.planned,
        spent: leaf.spent,
      })),
    })),
  );

  const detailRows = $derived(selected ? filterRows(rows, { objective: selected }) : rows);
  const detailTotal = $derived(totals(detailRows).planned);
  const items = $derived<RankItem[]>(
    groupBy(detailRows, hasCategories ? 'category' : 'fund')
      .slice(0, TOP_ITEMS)
      .map((g) => ({
        key: g.key,
        label: leafLabel(g.key),
        value: g.planned,
        detail: `${pct(ratio(g.planned, detailTotal), 1)} del totale · speso ${pct(ratio(g.spent, g.planned))}`,
        tip: [['Speso', eur(g.spent)]],
      })),
  );

  const scope = $derived(
    [filters.area ? areaName(filters.area) : 'Unione europea', filters.fund ? fundShort(filters.fund) : null, PERIODS.find((p) => p.id === filters.period)?.label]
      .filter(Boolean)
      .join(' · '),
  );
  const treeTitle = $derived(
    groups.length >= 2
      ? `${groups[0].label} e ${lowerFirst(groups[1].label)} assorbono ${pct(ratio(groups[0].planned + groups[1].planned, sum.planned))} delle risorse`
      : groups.length === 1
        ? `Tutto su una voce: ${lowerFirst(groups[0].label)}`
        : 'Nessun importo con questi filtri',
  );
  const treeTable = $derived({
    columns: ['Obiettivo', 'Voce', 'Pianificato (€)', 'Speso (€)'],
    rows: groups.flatMap((g) => g.leaves.map((l) => [g.label, l.label, l.planned, l.spent])),
  });
  const listTitle = $derived(
    items.length > 0 ? `La voce più finanziata vale ${eur(items[0].value)}` : 'Nessun importo con questi filtri',
  );
</script>

<Tooltip />

<PageHead kicker="{scope} · dati a {monthIt(source.asOf)}" title="Che cosa finanziano i fondi europei">
  Dietro le sigle ci sono scelte concrete: efficienza energetica degli edifici pubblici, formazione, ferrovie, depuratori, aiuti alle
  piccole imprese. Ogni rettangolo è una voce di spesa; il colore dice quanta parte è già stata spesa davvero.
</PageHead>

<FilterBar />

<section class="block">
  <ChartFrame
    kicker="La mappa della spesa"
    title={treeTitle}
    note="L’area di ogni rettangolo è proporzionale alla quota UE pianificata. Clicca un obiettivo per isolarlo e vederne il dettaglio qui sotto."
    {source}
    table={treeTable}
    filename="temi-{filters.period}"
  >
    <Treemap {groups} {selected} onPick={(key) => (picked = picked === key ? '' : key)} />
  </ChartFrame>
</section>

<section class="block narrow">
  <ChartFrame
    kicker={selected ? `Dettaglio · ${objectiveLabel(cube, selected)}` : hasCategories ? 'Le quindici voci più finanziate' : 'I fondi che finanziano queste voci'}
    title={listTitle}
    note={hasCategories
      ? 'Le voci di dettaglio sono i “campi d’intervento” del regolamento europeo, riportati nella dicitura ufficiale inglese.'
      : 'Per il ciclo 2014–2020 la fonte non scende sotto il livello dell’obiettivo tematico: il dettaglio mostra i fondi.'}
    {source}
    table={{ columns: ['Voce', 'Pianificato (€)'], rows: items.map((i) => [i.label, i.value]) }}
    filename="voci-{filters.period}"
  >
    {#if selected}
      <p class="chip"><button type="button" class="btn" onclick={() => (picked = '')}>Tutti gli obiettivi ×</button></p>
    {/if}
    <RankBars {items} format={eur} valueLabel="Pianificato" numbered />
  </ChartFrame>
</section>

<style>
  .block {
    margin-top: 40px;
  }
  .narrow {
    max-width: 820px;
  }
  .chip {
    margin-bottom: 10px;
  }
</style>
