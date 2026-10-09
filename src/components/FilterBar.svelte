<script lang="ts">
  import { onMount } from 'svelte';
  import { COUNTRIES } from '../lib/countries';
  import { groupBy } from '../lib/cube';
  import { cubeFor, PERIODS } from '../lib/data';
  import { filters, hasActiveFilters, readFiltersFromUrl, resetFilters, setPeriod, toggleFund, writeFiltersToUrl } from '../lib/filters.svelte';
  import { fundLong, fundShort } from '../lib/labels';

  interface Props {
    /** Le pagine paese fissano l'area: lì il selettore non serve. */
    showArea?: boolean;
  }

  const { showArea = true }: Props = $props();

  const funds = $derived(groupBy(cubeFor(filters.period).rows, 'fund').map((g) => g.key));
  const countries = [...COUNTRIES].sort((a, b) => a.name.localeCompare(b.name, 'it'));
  let ready = $state(false);

  onMount(() => {
    readFiltersFromUrl();
    ready = true;
  });

  $effect(() => {
    // Legge i tre filtri per registrarli come dipendenze prima di scrivere l'URL.
    void [filters.period, filters.fund, filters.area];
    if (ready) writeFiltersToUrl();
  });
</script>

<div class="bar" role="group" aria-label="Filtri">
  <div class="group">
    <span class="kicker">Ciclo</span>
    <div class="segmented">
      {#each PERIODS as period (period.id)}
        <button type="button" class="btn" aria-pressed={filters.period === period.id} onclick={() => setPeriod(period.id)}>
          {period.label}
        </button>
      {/each}
    </div>
  </div>

  <div class="group grow">
    <span class="kicker">Fondo</span>
    <div class="chips">
      <button type="button" class="btn" aria-pressed={filters.fund === ''} onclick={() => (filters.fund = '')}>Tutti</button>
      {#each funds as fund (fund)}
        <button type="button" class="btn" title={fundLong(fund)} aria-pressed={filters.fund === fund} onclick={() => toggleFund(fund)}>
          {fundShort(fund)}
        </button>
      {/each}
    </div>
  </div>

  {#if showArea}
    <label class="group">
      <span class="kicker">Paese</span>
      <select bind:value={filters.area}>
        <option value="">Tutta l’UE</option>
        {#each countries as country (country.code)}
          <option value={country.code}>{country.name}</option>
        {/each}
      </select>
    </label>
  {/if}

  {#if hasActiveFilters()}
    <button type="button" class="reset" onclick={resetFilters}>Azzera ×</button>
  {/if}
</div>

<style>
  .bar {
    position: sticky;
    top: 0;
    z-index: 20;
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 10px 22px;
    padding: 10px 0;
    background: var(--paper);
    border-bottom: 1px solid var(--rule);
  }
  .group {
    display: flex;
    flex-direction: column;
    gap: 5px;
    min-width: 0;
  }
  .grow {
    flex: 1 1 320px;
  }
  .segmented,
  .chips {
    display: flex;
    gap: 0;
  }
  .chips {
    overflow-x: auto;
    scrollbar-width: none;
  }
  .segmented .btn + .btn,
  .chips .btn + .btn {
    border-left: 0;
  }
  .btn {
    white-space: nowrap;
  }
  select {
    min-height: 32px;
    padding: 0 28px 0 10px;
    border: 1px solid var(--rule);
    border-radius: 0;
    background: var(--paper)
      url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%231b1a17'/%3E%3C/svg%3E")
      no-repeat right 10px center;
    appearance: none;
    font-family: var(--font-data);
    font-size: 0.72rem;
    letter-spacing: 0.04em;
    color: var(--ink);
  }
  .reset {
    min-height: 32px;
    border: 0;
    background: none;
    font-family: var(--font-data);
    font-size: 0.68rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--accent-ink);
    cursor: pointer;
  }
  .reset:hover {
    text-decoration: underline;
  }
  /* Su schermi stretti la barra occupa tre righe: fissarla in alto coprirebbe i grafici. */
  @media (max-width: 760px) {
    .bar {
      position: static;
    }
  }
</style>
