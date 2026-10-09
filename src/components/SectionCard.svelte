<script lang="ts">
  import type { Snippet } from 'svelte';
  import { sectionNumber, type Section } from '../lib/sections';

  interface Props {
    section: Section;
    /** La notizia della sezione, ricavata dai dati. */
    headline: string;
    query?: string;
    children?: Snippet;
  }

  const { section, headline, query = '', children }: Props = $props();
</script>

<a class="card" href="{section.href}{query}" data-keep-filters>
  <span class="kicker"><span class="num">{sectionNumber(section.id)}</span> {section.label}</span>
  <span class="headline">{headline}</span>
  {#if children}<span class="mini">{@render children()}</span>{/if}
  <span class="blurb">{section.blurb}</span>
  <span class="open">Apri la sezione →</span>
</a>

<style>
  .card {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 14px 16px 16px;
    border-top: 3px solid var(--rule);
    background: var(--paper-deep);
    text-decoration: none;
    color: var(--ink);
    transition: background 0.15s, border-color 0.15s, transform 0.15s;
  }
  .card:hover {
    background: var(--accent-wash);
    border-top-color: var(--accent);
    color: var(--ink);
    transform: translateY(-2px);
  }
  .num {
    color: var(--accent-ink);
  }
  .headline {
    font-size: 1.22rem;
    min-height: 3.3em;
  }
  .mini {
    display: block;
    margin-top: auto;
  }
  .blurb {
    font-size: 0.86rem;
    line-height: 1.3;
    color: var(--ink-2);
  }
  .open {
    font-family: var(--font-data);
    font-size: 0.66rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }
  .card:hover .open {
    color: var(--accent-ink);
  }
</style>
