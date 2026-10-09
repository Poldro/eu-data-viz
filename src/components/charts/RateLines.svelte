<script lang="ts">
  import { line, max, scaleLinear } from 'd3';
  import { hideTip, showTip } from '../../lib/tooltip.svelte';

  export interface RateSeries {
    key: string;
    label: string;
    color: string;
    /** Un valore per anno; null dove il dato manca. */
    values: (number | null)[];
  }

  interface Props {
    years: number[];
    series: RateSeries[];
    /** Soglia di riferimento, disegnata come linea tratteggiata. */
    threshold: number;
    thresholdLabel: string;
    format: (value: number) => string;
    label: string;
  }

  const { years, series, threshold, thresholdLabel, format, label }: Props = $props();

  const MARGIN = { top: 16, right: 92, bottom: 26, left: 34 };
  let width = $state(720);
  const height = $derived(width < 560 ? 260 : 320);

  const x = $derived(
    scaleLinear()
      .domain([years[0] ?? 0, years.at(-1) ?? 1])
      .range([MARGIN.left, width - MARGIN.right]),
  );
  const top = $derived(max(series.flatMap((s) => s.values.filter((v): v is number => v !== null))) ?? 1);
  const y = $derived(
    scaleLinear()
      .domain([0, top])
      .nice(4)
      .range([height - MARGIN.bottom, MARGIN.top]),
  );
  const path = $derived(
    line<number | null>()
      .defined((v) => v !== null)
      .x((_, i) => x(years[i]))
      .y((v) => y(v ?? 0)),
  );

  let active = $state<number | null>(null);

  function track(event: MouseEvent): void {
    const box = (event.currentTarget as SVGSVGElement).getBoundingClientRect();
    const year = Math.round(x.invert(event.clientX - box.left));
    const index = years.indexOf(Math.min(Math.max(year, years[0]), years[years.length - 1]));
    if (index === -1) return;
    active = index;
    showTip(
      event,
      String(years[index]),
      series.filter((s) => s.values[index] !== null).map((s): [string, string] => [s.label, format(s.values[index] as number)]),
    );
  }

  function leave(): void {
    active = null;
    hideTip();
  }

  const last = (values: (number | null)[]): number => values.findLast((v): v is number => v !== null) ?? 0;
</script>

<div class="chart" bind:clientWidth={width}>
  <svg {width} {height} role="img" aria-label={label} onmousemove={track} onmouseleave={leave}>
    {#each y.ticks(4) as tick (tick)}
      <line class="grid" x1={MARGIN.left} x2={width - MARGIN.right} y1={y(tick)} y2={y(tick)} />
      <text class="tick" x={MARGIN.left - 6} y={y(tick)} dy="0.32em" text-anchor="end">{tick}%</text>
    {/each}
    {#each years as year (year)}
      <text class="tick" x={x(year)} y={height - 8} text-anchor="middle">{year}</text>
    {/each}

    <line class="threshold" x1={MARGIN.left} x2={width - MARGIN.right} y1={y(threshold)} y2={y(threshold)} />
    <text class="direct muted" x={width - MARGIN.right + 8} y={y(threshold)} dy="0.32em">{thresholdLabel}</text>

    {#if active !== null}
      <line class="cursor" x1={x(years[active])} x2={x(years[active])} y1={MARGIN.top} y2={height - MARGIN.bottom} />
    {/if}

    {#each series as s (s.key)}
      <path d={path(s.values)} fill="none" stroke="var({s.color})" stroke-width="2" stroke-linejoin="round" />
      {#each s.values as value, i (i)}
        {#if value !== null}
          <!-- l'anello color carta stacca il punto dalla linea che lo attraversa -->
          <circle cx={x(years[i])} cy={y(value)} r={active === i ? 5.5 : 4} fill="var({s.color})" stroke="var(--paper)" stroke-width="2" />
        {/if}
      {/each}
      <text class="direct" x={width - MARGIN.right + 8} y={y(last(s.values))} dy="0.32em">{s.label}</text>
    {/each}
    <line class="base" x1={MARGIN.left} x2={width - MARGIN.right} y1={y(0)} y2={y(0)} />
  </svg>
</div>

<style>
  .chart {
    width: 100%;
    min-width: 0;
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
  .threshold {
    stroke: var(--ink-3);
    stroke-dasharray: 4 4;
  }
  .cursor {
    stroke: var(--ink);
    stroke-dasharray: 2 3;
  }
  .tick {
    font-family: var(--font-data);
    font-size: 10px;
    fill: var(--ink-3);
  }
  .direct {
    font-family: var(--font-data);
    font-size: 10.5px;
    fill: var(--ink);
  }
  .direct.muted {
    fill: var(--ink-3);
  }
</style>
