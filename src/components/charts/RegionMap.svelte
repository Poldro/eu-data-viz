<script lang="ts">
  import { geoConicConformal, geoPath, scaleQuantile } from 'd3';
  import type { Feature, FeatureCollection, Geometry } from 'geojson';
  import { feature, mesh } from 'topojson-client';
  import type { GeometryCollection, Topology } from 'topojson-specification';
  import nuts2Json from '../../data/nuts2.json';
  import { hideTip, showTip } from '../../lib/tooltip.svelte';

  export interface RegionDatum {
    id: string;
    name: string;
    country: string;
    /** Valore da colorare; null = dato non disponibile. */
    value: number | null;
    tip: [string, string][];
  }

  interface Props {
    regions: RegionDatum[];
    /** Codice del paese su cui stringere l'inquadratura; vuoto = tutta l'Unione. */
    focus?: string;
    /** Paese da contornare in vermiglio. */
    highlight?: string;
    legendLabel: string;
    format: (value: number) => string;
  }

  const { regions, focus = '', highlight = '', legendLabel, format }: Props = $props();

  type RegionFeature = Feature<Geometry, { name: string }>;

  const STEPS = ['--seq-1', '--seq-2', '--seq-3', '--seq-4', '--seq-5', '--seq-6'];
  /** Riquadro dell'Europa continentale: le regioni ultraperiferiche restano fuori dall'inquadratura. */
  const MAINLAND = { west: -11, east: 35, south: 34, north: 71 };

  const topology = nuts2Json as unknown as Topology;
  const object = topology.objects.regions as GeometryCollection<{ name: string }>;
  const all = (feature(topology, object) as FeatureCollection<Geometry, { name: string }>).features;
  const countryOf = (f: RegionFeature) => String(f.id).slice(0, 2);
  // Confini tra paesi diversi: un tratto più marcato aiuta a orientarsi.
  const codeOf = (geometry: { id?: string | number }) => String(geometry.id).slice(0, 2);
  const borders = mesh(topology, object, (a, b) => codeOf(a) !== codeOf(b));

  let width = $state(960);
  const height = $derived(Math.round(Math.min(width * (focus ? 0.95 : 1.02), 720)));

  const byId = $derived(new Map(regions.map((r) => [r.id, r])));
  const inFrame = (f: RegionFeature): boolean => {
    const [lon, lat] = geoPath().centroid(f);
    return lon > MAINLAND.west && lon < MAINLAND.east && lat > MAINLAND.south && lat < MAINLAND.north;
  };
  // Le regioni fuori dal riquadro non si disegnano: finirebbero come frammenti ai margini.
  const mainland = all.filter(inFrame);
  const framed = $derived(mainland.filter((f) => !focus || countryOf(f) === focus));

  const projection = $derived(
    geoConicConformal()
      .rotate([-12, 0])
      .parallels([40, 60])
      .fitSize([width, height], { type: 'FeatureCollection', features: framed.length > 0 ? framed : mainland }),
  );
  const path = $derived(geoPath(projection));
  // Contorno del paese evidenziato: i tratti che lo separano dai vicini più le sue coste (a === b).
  const outline = $derived(
    highlight ? mesh(topology, object, (a, b) => (codeOf(a) === highlight) !== (codeOf(b) === highlight) || (a === b && codeOf(a) === highlight)) : null,
  );

  const values = $derived(regions.filter((r) => !focus || r.country === focus).flatMap((r) => (r.value !== null && r.value > 0 ? [r.value] : [])));
  const scale = $derived(scaleQuantile<number>().domain(values).range(STEPS.map((_, i) => i)));
  const legend = $derived(values.length > 0 ? [Math.min(...values), ...scale.quantiles()] : []);

  function fill(f: RegionFeature): string {
    const datum = byId.get(String(f.id));
    if (!datum || datum.value === null || datum.value <= 0 || values.length === 0) return 'var(--paper-deep)';
    return `var(${STEPS[scale(datum.value)]})`;
  }

  function describe(event: MouseEvent, f: RegionFeature): void {
    const datum = byId.get(String(f.id));
    showTip(event, datum?.name ?? f.properties.name, datum?.tip ?? [['Dato', 'non disponibile']]);
  }
</script>

<div class="map" bind:clientWidth={width}>
  <svg {width} {height} role="img" aria-label="Mappa delle regioni europee colorate per {legendLabel}">
    <!-- inquadrando un paese, i vicini non hanno dati da mostrare: si disegna solo quello -->
    {#each focus ? framed : mainland as f (f.id)}
      <path
        class="region"
        d={path(f)}
        fill={fill(f)}
        role="presentation"
        onmousemove={(e) => describe(e, f)}
        onmouseleave={hideTip}
      />
    {/each}
    {#if !focus}<path class="borders" d={path(borders)} />{/if}
    {#if outline}<path class="highlight" d={path(outline)} />{/if}
  </svg>

  {#if legend.length > 0}
    <div class="legend" aria-hidden="true">
      <span class="kicker">{legendLabel}</span>
      <div class="swatches">
        {#each STEPS as step, i (step)}
          <span class="bin">
            <span class="swatch" style:background="var({step})"></span>
            <span class="figure">{format(legend[i] ?? 0)}</span>
          </span>
        {/each}
        <span class="bin missing">
          <span class="swatch"></span>
          <span class="figure">n.d.</span>
        </span>
      </div>
    </div>
  {/if}
</div>

<style>
  .map {
    width: 100%;
    min-width: 0;
  }
  svg {
    display: block;
  }
  .region {
    stroke: var(--paper);
    stroke-width: 0.6px;
    transition: opacity 0.2s;
  }
  .region:hover {
    stroke: var(--ink);
    stroke-width: 1.6px;
  }
  .borders {
    fill: none;
    stroke: var(--ink);
    stroke-width: 0.7px;
    stroke-opacity: 0.55;
    pointer-events: none;
  }
  .highlight {
    fill: none;
    stroke: var(--accent);
    stroke-width: 2px;
    stroke-linejoin: round;
    pointer-events: none;
  }
  .legend {
    max-width: 520px;
    margin-top: 12px;
  }
  .swatches {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 2px;
    margin-top: 5px;
  }
  .swatch {
    display: block;
    height: 8px;
  }
  .missing .swatch {
    background: var(--paper-deep);
    box-shadow: inset 0 0 0 1px var(--rule-soft);
  }
  .bin .figure {
    font-size: 0.62rem;
    color: var(--ink-2);
  }
</style>
