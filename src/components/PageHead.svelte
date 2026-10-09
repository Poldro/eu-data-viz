<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    kicker: string;
    title: string;
    children?: Snippet;
  }

  const { kicker, title, children }: Props = $props();
</script>

<header class="head">
  <p class="kicker rise">{kicker}</p>
  <h1 class="display rise" style:--i={1}>{title}</h1>
  {#if children}<p class="standfirst rise" style:--i={2}>{@render children()}</p>{/if}
</header>

<style>
  .head {
    padding: 8px 0 24px;
  }
  h1 {
    margin: 10px 0 14px;
    font-size: clamp(2rem, 5vw, 3.8rem);
    max-width: 20ch;
  }
</style>
