<script lang="ts">
  export interface Kpi {
    label: string;
    value: string;
    detail?: string;
    /** Quota 0–1 da mostrare come barra sotto la cifra. */
    share?: number;
  }

  const { items }: { items: Kpi[] } = $props();
</script>

<dl class="kpis">
  {#each items as item, i (item.label)}
    <div class="kpi rise" style:--i={i}>
      <dt class="kicker">{item.label}</dt>
      <dd>
        <span class="value figure">{item.value}</span>
        {#if item.share !== undefined}
          <span class="meter" aria-hidden="true"><span style:width="{Math.min(item.share, 1) * 100}%"></span></span>
        {/if}
        {#if item.detail}<span class="detail">{item.detail}</span>{/if}
      </dd>
    </div>
  {/each}
</dl>

<style>
  .kpis {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
    margin: 0;
    border-top: 1px solid var(--rule);
    border-bottom: 1px solid var(--rule);
  }
  .kpi {
    padding: 14px 16px 16px 0;
  }
  .kpi + .kpi {
    padding-left: 16px;
    border-left: 1px solid var(--rule-soft);
  }
  dd {
    margin: 6px 0 0;
  }
  .value {
    display: block;
    font-size: clamp(1.5rem, 3vw, 2.15rem);
    font-weight: 500;
    line-height: 1.05;
    white-space: nowrap;
  }
  .meter {
    display: block;
    height: 4px;
    margin-top: 8px;
    background: var(--rule-soft);
  }
  .meter span {
    display: block;
    height: 100%;
    background: var(--ink);
    transition: width 0.5s cubic-bezier(0.2, 0.7, 0.2, 1);
  }
  .detail {
    display: block;
    margin-top: 6px;
    font-size: 0.84rem;
    line-height: 1.3;
    color: var(--ink-2);
  }
  @media (max-width: 420px) {
    .kpis {
      grid-template-columns: 1fr 1fr;
    }
    .kpi:nth-child(odd) {
      padding-left: 0;
      border-left: 0;
    }
    .kpi:nth-child(n + 3) {
      border-top: 1px solid var(--rule-soft);
    }
  }
</style>
