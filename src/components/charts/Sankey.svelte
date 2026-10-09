<script lang="ts">
  import { sankey, sankeyLinkHorizontal, type SankeyLink, type SankeyNode } from 'd3-sankey';
  import { areaName, HOME_COUNTRY } from '../../lib/countries';
  import { OTHER_AREA, type Cube, type Flows } from '../../lib/cube';
  import { eur, pct } from '../../lib/format';
  import { fundLong, fundShort, objectiveLabel } from '../../lib/labels';
  import { hideTip, showTip } from '../../lib/tooltip.svelte';

  interface Props {
    flows: Flows;
    cube: Cube;
    total: number;
    selectedFund: string;
    selectedArea: string;
    onPickFund: (fund: string) => void;
    onPickArea: (area: string) => void;
  }

  const { flows, cube, total, selectedFund, selectedArea, onPickFund, onPickArea }: Props = $props();

  type NodeDatum = Flows['nodes'][number];
  type Node = SankeyNode<NodeDatum, object>;
  type Link = SankeyLink<NodeDatum, object>;

  const NODE_WIDTH = 10;
  const MIN_LABEL_HEIGHT = 11;
  const COLUMN_TITLES = ['Da quale fondo', 'Per fare cosa', 'A chi va'];

  let width = $state(960);
  const narrow = $derived(width < 640);
  const height = $derived(narrow ? 620 : 560);

  const graph = $derived.by(() => {
    if (flows.links.length === 0) return { nodes: [] as Node[], links: [] as Link[] };
    const layout = sankey<NodeDatum, object>()
      .nodeId((d) => d.id)
      .nodeWidth(NODE_WIDTH)
      .nodePadding(narrow ? 7 : 9)
      .nodeAlign((node) => (node as Node).column ?? 0)
      // "Altri" resta in fondo alla colonna, il resto in ordine di grandezza.
      .nodeSort((a, b) => Number(a.key === OTHER_AREA) - Number(b.key === OTHER_AREA) || (b.value ?? 0) - (a.value ?? 0))
      .extent([
        [0, 22],
        [width, height],
      ]);
    // d3-sankey modifica gli oggetti che riceve: gli si passano copie.
    return layout({ nodes: flows.nodes.map((n) => ({ ...n })), links: flows.links.map((l) => ({ ...l })) });
  });

  const path = sankeyLinkHorizontal<NodeDatum, object>();
  let hovered = $state('');

  function label(node: Node): string {
    if (node.column === 0) return fundShort(node.key);
    if (node.column === 1) return objectiveLabel(cube, node.key);
    return node.key === OTHER_AREA ? 'Altri paesi e Interreg' : areaName(node.key);
  }

  const CHAR_WIDTH = 6.7;
  const SIDE_LABEL_ROOM = 44;

  /** Su schermi stretti le etichette centrali passano a sinistra del nodo e si accorciano allo spazio tra le colonne. */
  function shownLabel(node: Node): string {
    const text = label(node);
    if (!narrow || node.column !== 1) return text;
    const chars = Math.floor(((node.x0 ?? 0) - NODE_WIDTH - SIDE_LABEL_ROOM) / CHAR_WIDTH);
    return text.length <= chars ? text : `${text.slice(0, Math.max(3, chars - 1))}…`;
  }

  function longLabel(node: Node): string {
    return node.column === 0 ? fundLong(node.key) : label(node);
  }

  function isAccent(node: Node): boolean {
    const focus = selectedArea || HOME_COUNTRY;
    return (node.column === 2 && node.key === focus) || (node.column === 0 && node.key === selectedFund);
  }

  function linkAccent(link: Link): boolean {
    return isAccent(link.target as Node) || (hovered !== '' && ((link.source as Node).id === hovered || (link.target as Node).id === hovered));
  }

  function pick(node: Node): void {
    if (node.column === 0) onPickFund(node.key);
    if (node.column === 2 && node.key !== OTHER_AREA) onPickArea(node.key);
  }

  function isClickable(node: Node): boolean {
    return node.column === 0 || (node.column === 2 && node.key !== OTHER_AREA);
  }

  function describe(event: MouseEvent | FocusEvent, node: Node): void {
    hovered = node.id;
    showTip(event, longLabel(node), [
      ['Pianificato', eur(node.value ?? 0)],
      ['Quota del totale', pct((node.value ?? 0) / total, 1)],
    ]);
  }

  function leave(): void {
    hovered = '';
    hideTip();
  }
</script>

<div class="sankey" bind:clientWidth={width}>
  {#if graph.nodes.length === 0}
    <p class="empty">Nessun importo per questa combinazione di filtri.</p>
  {:else}
    <svg {width} {height} role="img" aria-label="Flussi dei fondi: dal fondo all’obiettivo al paese di destinazione">
      {#each COLUMN_TITLES as title, i (title)}
        <text class="column-title" x={i === 0 ? 0 : i === 1 ? width / 2 : width} y="10" text-anchor={i === 0 ? 'start' : i === 1 ? 'middle' : 'end'}>
          {title}
        </text>
      {/each}

      <g fill="none">
        {#each graph.links as link (`${(link.source as Node).id}→${(link.target as Node).id}`)}
          <path
            d={path(link)}
            class="link"
            class:accent={linkAccent(link)}
            stroke-width={Math.max(1, link.width ?? 1)}
            role="presentation"
            onmousemove={(e) =>
              showTip(e, `${label(link.source as Node)} → ${label(link.target as Node)}`, [['Pianificato', eur(link.value)]])}
            onmouseleave={hideTip}
          />
        {/each}
      </g>

      {#each graph.nodes as node (node.id)}
        {@const h = (node.y1 ?? 0) - (node.y0 ?? 0)}
        {@const left = node.column === 0 || (node.column === 1 && !narrow)}
        <g
          class="node"
          class:clickable={isClickable(node)}
          class:accent={isAccent(node)}
          role="button"
          aria-disabled={!isClickable(node)}
          tabindex="0"
          aria-label="{longLabel(node)}: {eur(node.value ?? 0)}"
          onmousemove={(e) => describe(e, node)}
          onmouseleave={leave}
          onfocus={(e) => describe(e, node)}
          onblur={leave}
          onclick={() => pick(node)}
          onkeydown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              pick(node);
            }
          }}
        >
          <rect x={node.x0} y={node.y0} width={NODE_WIDTH} height={Math.max(1, h)} />
          <!-- area di aggancio più larga del segno -->
          <rect class="hit" x={(node.x0 ?? 0) - 8} y={node.y0} width={NODE_WIDTH + 16} height={Math.max(1, h)} />
          {#if h >= MIN_LABEL_HEIGHT}
            <text
              x={left ? (node.x1 ?? 0) + 6 : (node.x0 ?? 0) - 6}
              y={((node.y0 ?? 0) + (node.y1 ?? 0)) / 2}
              dy="0.35em"
              text-anchor={left ? 'start' : 'end'}
            >
              {shownLabel(node)}
              {#if h >= 26 && !narrow}<tspan class="value" dx="6">{eur(node.value ?? 0)}</tspan>{/if}
            </text>
          {/if}
        </g>
      {/each}
    </svg>
  {/if}
</div>

<style>
  .sankey {
    width: 100%;
    min-width: 0;
  }
  svg {
    display: block;
    overflow: visible;
  }
  .column-title {
    font-size: 10px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    fill: var(--ink-3);
  }
  .link {
    stroke: var(--flow);
    stroke-opacity: 0.3;
    transition: stroke 0.2s, stroke-opacity 0.2s;
  }
  .link:hover {
    stroke-opacity: 0.6;
  }
  .link.accent {
    stroke: var(--accent);
    stroke-opacity: 0.5;
  }
  .node rect {
    fill: var(--ink);
  }
  .node.accent rect:not(.hit) {
    fill: var(--accent);
  }
  .node .hit {
    fill: transparent;
  }
  .node text {
    font-size: 11px;
    fill: var(--ink);
    paint-order: stroke;
    stroke: var(--paper);
    stroke-width: 3px;
    stroke-linejoin: round;
  }
  .node .value {
    fill: var(--ink-3);
  }
  .clickable {
    cursor: pointer;
  }
  .clickable:hover text,
  .clickable:focus-visible text {
    text-decoration: underline;
  }
  .node:focus-visible {
    outline: none;
  }
  .node:focus-visible rect:not(.hit) {
    stroke: var(--accent);
    stroke-width: 3px;
  }
  .empty {
    padding: 48px 0;
    color: var(--ink-2);
    font-style: italic;
  }
</style>
