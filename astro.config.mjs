// @ts-check
import { defineConfig } from 'astro/config';

import svelte from '@astrojs/svelte';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  integrations: [svelte()],

  vite: {
    plugins: [tailwindcss()],
    // Le librerie dei grafici sono importate solo dentro le isole Svelte: senza questa lista
    // il server di sviluppo le scopre pagina per pagina e le isole già caricate smettono di idratarsi.
    optimizeDeps: { include: ['d3', 'd3-sankey'] },
  },
});
