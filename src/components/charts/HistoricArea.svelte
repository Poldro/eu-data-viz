<script lang="ts">
  import { area, max, scaleLinear, stack } from 'd3';
  import { eur, eurShort } from '../../lib/format';
  import type { YearPoint } from '../../lib/historic';
  import { hideTip, showTip } from '../../lib/tooltip.svelte';

  export interface Series {
    key: string;
    label: string;
    /** Variabile CSS del colore: l'ordine delle serie è fisso, non dipende dai valori. */
    color: string;
  }

  interface Props {
    points: YearPoint[];
    series: Series[];
  }

  const { points, series }: Props = $props();

  const MARGIN = { top: 12, right: 8, bottom: 26, left: 58 };
  let width = $state(960);
  const height = $derived(width < 640 ? 300 : 360);

  const x = $derived(
    scaleLinear()
      .domain([points[0]?.year ?? 0, points.at(-1)?.year ?? 1])
      .range([MARGIN.left, width - MARGIN.right]),
  );
  const y = $derived(
    scaleLinear()
      .domain([0, max(points, (p) => p.total) ?? 1])
      .nice(4)
      .range([height - MARGIN.bottom, MARGIN.top]),
  );
  const layers = $derived(
    stack<YearPoint>()
      .keys(series.map((s) => s.key))
      .value((p, key) => p.values[key] ?? 0)(points),
  );
  const shape = $derived(
    area<[number, number] & { data: YearPoint }>()
      .x((d) => x(d.data.year))
      .y0((d) => y(d[0]))
      .y1((d) => y(d[1])),
  );
  // Le serie brevi (PNRR: sei anni) mostrano ogni anno; quelle lunghe uno ogni cinque o dieci.
  const tickStep = $derived(points.length <= 10 ? 1 : width < 640 ? 10 : 5);
  const yearTicks = $derived(points.filter((p) => p.year % tickStep === 0).map((p) => p.year));

  let active = $state<YearPoint | null>(null);

  function track(event: MouseEvent): void {
    const box = (event.currentTarget as SVGElement).getBoundingClientRect();
    const year = Math.round(x.invert(event.clientX - box.left));
    const point = points.find((p) => p.year === year);
    if (!point) return;
    active = point;
    showTip(event, String(point.year), [
      ...series.filter((s) => (point.values[s.key] ?? 0) > 0).map((s): [string, string] => [s.label, eur(point.values[s.key])]),
      ['Totale', eur(point.total)],
    ]);
  }

  function leave(): void {
    active = null;
    hideTip();
  }
</script>

<div class="chart" bind:clientWidth={width}>
  <ul class="legend">
    {#each series as s (s.key)}
      <li><i style:background="var({s.color})"></i>{s.label}</li>
    {/each}
  </ul>

  <svg {width} {height} role="img" aria-label="Pagamenti annuali dell’UE per fondo" onmousemove={track} onmouseleave={leave}>
    {#each y.ticks(4) as tick (tick)}
      <line class="grid" x1={MARGIN.left} x2={width - MARGIN.right} y1={y(tick)} y2={y(tick)} />
      <text class="tick" x={MARGIN.left - 6} y={y(tick)} dy="0.32em" text-anchor="end">{tick === 0 ? '0' : eurShort(tick)}</text>
    {/each}
    {#each yearTicks as year (year)}
      <text class="tick" x={x(year)} y={height - 8} text-anchor="middle">{year}</text>
    {/each}

    {#each layers as layer, i (layer.key)}
      <!-- il bordo color carta separa le fasce impilate senza affidarsi al solo colore -->
      <path d={shape(layer as never)} fill="var({series[i].color})" stroke="var(--paper)" stroke-width="1.5" />
    {/each}

    {#if active}
      <line class="cursor" x1={x(active.year)} x2={x(active.year)} y1={MARGIN.top} y2={height - MARGIN.bottom} />
    {/if}
    <line class="base" x1={MARGIN.left} x2={width - MARGIN.right} y1={y(0)} y2={y(0)} />
  </svg>
</div>

<style>
  .chart {
    width: 100%;
    min-width: 0;
  }
  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 18px;
    margin: 0 0 10px;
    padding: 0;
    list-style: none;
    font-family: var(--font-data);
    font-size: 0.66rem;
    letter-spacing: 0.04em;
    color: var(--ink-2);
  }
  .legend li {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .legend i {
    width: 12px;
    height: 12px;
  }
  svg {
    display: block;
  }
  .grid {
    stroke: var(--rule-soft);
  }
  .base {
    stroke: var(--rule);
  }
  .cursor {
    stroke: var(--ink);
    stroke-dasharray: 2 3;
  }
  .tick {
    font-size: 10px;
    fill: var(--ink-3);
  }
</style>
