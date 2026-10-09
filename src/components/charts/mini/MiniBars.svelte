<script lang="ts">
  interface Props {
    /** Valori già ordinati come devono apparire, da sinistra a destra. */
    values: number[];
    /** Indice della barra da evidenziare (l'Italia, la voce scelta…). */
    highlight?: number;
    label: string;
  }

  const { values, highlight = -1, label }: Props = $props();

  const WIDTH = 240;
  const HEIGHT = 56;
  const GAP = 2;
  const max = $derived(Math.max(0, ...values));
  const step = $derived(values.length > 0 ? WIDTH / values.length : WIDTH);
</script>

<svg viewBox="0 0 {WIDTH} {HEIGHT}" preserveAspectRatio="none" role="img" aria-label={label}>
  {#each values as value, i (i)}
    {@const h = max > 0 ? Math.max(1, (value / max) * (HEIGHT - 2)) : 1}
    <rect class:accent={i === highlight} x={i * step} y={HEIGHT - h} width={Math.max(1, step - GAP)} height={h} />
  {/each}
  <line x2={WIDTH} y1={HEIGHT} y2={HEIGHT} />
</svg>

<style>
  svg {
    display: block;
    width: 100%;
    height: 56px;
  }
  rect {
    fill: var(--seq-4);
  }
  rect.accent {
    fill: var(--accent);
  }
  line {
    stroke: var(--rule);
    stroke-width: 1px;
    vector-effect: non-scaling-stroke;
  }
</style>
