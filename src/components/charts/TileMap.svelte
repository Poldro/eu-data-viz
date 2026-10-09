<script lang="ts">
  import { scaleQuantile } from 'd3';
  import { COUNTRIES, HOME_COUNTRY, TILE_COLS, TILE_ROWS } from '../../lib/countries';
  import type { CountryStat } from '../../lib/cube';
  import { eur, int, pct, perHead } from '../../lib/format';
  import { hideTip, showTip } from '../../lib/tooltip.svelte';

  interface Props {
    stats: CountryStat[];
    selected: string;
    onPick: (code: string) => void;
  }

  const { stats, selected, onPick }: Props = $props();

  const TILE = 64;
  const GAP = 3;
  const STEPS = ['--seq-1', '--seq-2', '--seq-3', '--seq-4', '--seq-5', '--seq-6'];
  // Dal quarto gradino in su il fondo è abbastanza scuro da richiedere testo chiaro.
  const FIRST_DARK_STEP = 3;

  const byCode = $derived(new Map(stats.map((s) => [s.code, s])));
  const withData = $derived(stats.filter((s) => s.planned > 0));
  const scale = $derived(
    scaleQuantile<number>()
      .domain(withData.map((s) => s.perCapita))
      .range(STEPS.map((_, i) => i)),
  );
  const legend = $derived.by(() => {
    if (withData.length === 0) return [];
    const cuts = [Math.min(...withData.map((s) => s.perCapita)), ...scale.quantiles(), Math.max(...withData.map((s) => s.perCapita))];
    return STEPS.map((step, i) => ({ step, from: cuts[i], to: cuts[i + 1] }));
  });

  function describe(event: MouseEvent | FocusEvent, stat: CountryStat): void {
    showTip(event, stat.name, [
      ['Per abitante', perHead(stat.perCapita)],
      ['Pianificato', eur(stat.planned)],
      ['Speso', `${eur(stat.spent)} (${pct(stat.absorption)})`],
    ]);
  }
</script>

<div class="map">
  <svg viewBox="0 0 {TILE_COLS * TILE} {TILE_ROWS * TILE}" role="group" aria-label="Mappa a tessere degli Stati membri: euro pianificati per abitante">
    {#each COUNTRIES as country (country.code)}
      {@const stat = byCode.get(country.code)}
      {#if stat}
        {@const step = stat.planned > 0 ? scale(stat.perCapita) : -1}
        <g
          class="tile"
          class:home={country.code === HOME_COUNTRY}
          class:selected={country.code === selected}
          class:dim={selected !== '' && country.code !== selected}
          transform="translate({country.tile[0] * TILE},{country.tile[1] * TILE})"
          role="button"
          tabindex="0"
          aria-pressed={country.code === selected}
          aria-label="{stat.name}: {perHead(stat.perCapita)} per abitante"
          onmousemove={(e) => describe(e, stat)}
          onmouseleave={hideTip}
          onfocus={(e) => describe(e, stat)}
          onblur={hideTip}
          onclick={() => onPick(country.code)}
          onkeydown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onPick(country.code);
            }
          }}
        >
          <rect width={TILE - GAP} height={TILE - GAP} fill={step < 0 ? 'var(--paper-deep)' : `var(${STEPS[step]})`} />
          <text class="code" class:light={step >= FIRST_DARK_STEP} x="7" y="17">{country.code}</text>
          <text class="value" class:light={step >= FIRST_DARK_STEP} x="7" y={TILE - GAP - 9}>
            {step < 0 ? '—' : int(stat.perCapita)}
          </text>
        </g>
      {/if}
    {/each}
  </svg>

  <div class="legend" aria-hidden="true">
    <span class="kicker">€ per abitante</span>
    <div class="swatches">
      {#each legend as bin (bin.step)}
        <span class="bin">
          <span class="swatch" style:background="var({bin.step})"></span>
          <span class="figure">{int(bin.from)}</span>
        </span>
      {/each}
    </div>
  </div>
</div>

<style>
  .map {
    max-width: 520px;
  }
  svg {
    display: block;
    width: 100%;
    height: auto;
    overflow: visible;
  }
  .tile {
    cursor: pointer;
    transition: opacity 0.2s;
  }
  .tile.dim {
    opacity: 0.45;
  }
  .tile:hover rect,
  .tile:focus-visible rect {
    stroke: var(--ink);
    stroke-width: 2px;
  }
  .tile:focus-visible {
    outline: none;
  }
  .tile.home rect,
  .tile.selected rect {
    stroke: var(--accent);
    stroke-width: 3px;
  }
  .code {
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.06em;
    fill: var(--ink);
  }
  .value {
    font-size: 13px;
    fill: var(--ink);
  }
  .light {
    fill: var(--paper);
  }
  .legend {
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
</style>
