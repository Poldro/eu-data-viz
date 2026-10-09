<script lang="ts">
  import { hierarchy, treemap, treemapSquarify, type HierarchyRectangularNode } from 'd3';
  import { eur, pct } from '../../lib/format';
  import { hideTip, showTip } from '../../lib/tooltip.svelte';

  export interface TreeLeaf {
    key: string;
    label: string;
    planned: number;
    spent: number;
  }

  export interface TreeGroup {
    key: string;
    label: string;
    planned: number;
    leaves: TreeLeaf[];
  }

  interface Props {
    groups: TreeGroup[];
    selected: string;
    onPick: (key: string) => void;
  }

  const { groups, selected, onPick }: Props = $props();

  interface Datum {
    key: string;
    label: string;
    planned: number;
    spent: number;
    group?: string;
    children?: Datum[];
  }

  const HEADER = 20;
  /** Soglie della quota spesa: una tinta sola, dal chiaro (fermo) allo scuro (avanzato). */
  const BINS = [0.1, 0.2, 0.3, 0.45, 0.6];
  const STEPS = ['--seq-1', '--seq-2', '--seq-3', '--seq-4', '--seq-5', '--seq-6'];
  const FIRST_DARK_STEP = 3;

  let width = $state(960);
  const height = $derived(width < 640 ? 560 : 520);

  const total = $derived(groups.reduce((s, g) => s + g.planned, 0));

  const layout = $derived.by(() => {
    const root = hierarchy<Datum>({
      key: 'root',
      label: '',
      planned: 0,
      spent: 0,
      children: groups.map((g) => ({
        key: g.key,
        label: g.label,
        planned: g.planned,
        spent: 0,
        children: g.leaves.map((l) => ({ ...l, group: g.key })),
      })),
    }).sum((d) => (d.children ? 0 : Math.max(0, d.planned)));
    return treemap<Datum>().tile(treemapSquarify.ratio(1.3)).size([width, height]).paddingOuter(0).paddingTop(HEADER).paddingInner(2).round(true)(root);
  });

  const groupNodes = $derived(layout.children ?? []);
  const leafNodes = $derived(layout.leaves());

  function step(leaf: Datum): number {
    const share = leaf.planned > 0 ? leaf.spent / leaf.planned : 0;
    const index = BINS.findIndex((limit) => share < limit);
    return index === -1 ? STEPS.length - 1 : index;
  }

  const boxW = (n: HierarchyRectangularNode<Datum>) => n.x1 - n.x0;
  const boxH = (n: HierarchyRectangularNode<Datum>) => n.y1 - n.y0;

  /** Tronca l'etichetta alla larghezza della cella (stima a larghezza fissa del monospaziato). */
  function fit(text: string, pixels: number, charWidth = 6.3): string {
    const chars = Math.floor(pixels / charWidth);
    if (chars < 4) return '';
    return text.length <= chars ? text : `${text.slice(0, chars - 1)}…`;
  }
</script>

<div class="treemap" bind:clientWidth={width}>
  {#if total <= 0}
    <p class="empty">Nessun importo per questa combinazione di filtri.</p>
  {:else}
    <svg {width} {height} role="group" aria-label="Mappa ad albero: ogni rettangolo è una voce di spesa, l’area è l’importo pianificato">
      {#each leafNodes as leaf (`${leaf.data.group}/${leaf.data.key}`)}
        {@const s = step(leaf.data)}
        <g
          class="leaf"
          class:dim={selected !== '' && leaf.data.group !== selected}
          transform="translate({leaf.x0},{leaf.y0})"
          role="presentation"
          onmousemove={(e) =>
            showTip(e, leaf.data.label, [
              ['Pianificato', eur(leaf.data.planned)],
              ['Quota del totale', pct(leaf.data.planned / total, 1)],
              ['Speso', pct(leaf.data.planned > 0 ? leaf.data.spent / leaf.data.planned : 0)],
            ])}
          onmouseleave={hideTip}
          onclick={() => onPick(leaf.data.group ?? '')}
        >
          <rect width={boxW(leaf)} height={boxH(leaf)} fill="var({STEPS[s]})" />
          {#if boxH(leaf) >= 30 && boxW(leaf) >= 60}
            <text class:light={s >= FIRST_DARK_STEP} x="5" y="14">{fit(leaf.data.label, boxW(leaf) - 10)}</text>
            <text class="value" class:light={s >= FIRST_DARK_STEP} x="5" y="27">{eur(leaf.data.planned)}</text>
          {/if}
        </g>
      {/each}

      {#each groupNodes as group (group.data.key)}
        <g
          class="group"
          class:selected={group.data.key === selected}
          class:dim={selected !== '' && group.data.key !== selected}
          transform="translate({group.x0},{group.y0})"
          role="button"
          tabindex="0"
          aria-pressed={group.data.key === selected}
          aria-label="{group.data.label}: {eur(group.value ?? 0)}"
          onclick={() => onPick(group.data.key)}
          onkeydown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onPick(group.data.key);
            }
          }}
        >
          <rect class="header" width={boxW(group)} height={HEADER - 2} />
          <line x2={boxW(group)} />
          <text x="0" y="13">{fit(`${group.data.label} · ${pct((group.value ?? 0) / total)}`, boxW(group), 6.6)}</text>
        </g>
      {/each}
    </svg>

    <div class="legend" aria-hidden="true">
      <span class="kicker">Quota già spesa</span>
      <div class="swatches">
        {#each STEPS as stepVar, i (stepVar)}
          <span class="bin">
            <span class="swatch" style:background="var({stepVar})"></span>
            <span class="figure">{i === 0 ? '0%' : pct(BINS[i - 1])}</span>
          </span>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .treemap {
    width: 100%;
    min-width: 0;
  }
  svg {
    display: block;
  }
  .leaf,
  .group {
    cursor: pointer;
    transition: opacity 0.2s;
  }
  .dim {
    opacity: 0.3;
  }
  .leaf:hover rect {
    stroke: var(--ink);
    stroke-width: 2px;
  }
  .leaf text {
    font-size: 10.5px;
    fill: var(--ink);
    pointer-events: none;
  }
  .leaf .value {
    fill: var(--ink-2);
  }
  .leaf text.light {
    fill: var(--paper);
  }
  .group .header {
    fill: var(--paper);
  }
  .group line {
    stroke: var(--rule);
    stroke-width: 2px;
  }
  .group text {
    font-size: 11px;
    font-weight: 500;
    fill: var(--ink);
  }
  .group.selected line {
    stroke: var(--accent);
    stroke-width: 4px;
  }
  .group:focus-visible {
    outline: none;
  }
  .group:focus-visible text,
  .group:hover text {
    text-decoration: underline;
  }
  .legend {
    max-width: 420px;
    margin-top: 12px;
  }
  .swatches {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 2px;
    margin-top: 5px;
  }
  .swatch {
    display: block;
    height: 8px;
  }
  .bin .figure {
    font-size: 0.62rem;
    color: var(--ink-2);
  }
  .empty {
    padding: 48px 0;
    color: var(--ink-2);
    font-style: italic;
  }
</style>
