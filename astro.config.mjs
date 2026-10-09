// @ts-check
import { defineConfig } from 'astro/config';

import sitemap from '@astrojs/sitemap';
import svelte from '@astrojs/svelte';
import tailwindcss from '@tailwindcss/vite';

// Indirizzo pubblico del sito: serve a sitemap, link canonici e anteprime social.
// Su Vercel arriva dall'ambiente di build; SITE_URL permette di imporre un dominio proprio.
const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL;
const site = process.env.SITE_URL ?? (vercelHost ? `https://${vercelHost}` : 'http://localhost:4321');

// https://astro.build/config
export default defineConfig({
  site,
  integrations: [svelte(), sitemap()],

  vite: {
    plugins: [tailwindcss()],
    // Le librerie dei grafici sono importate solo dentro le isole Svelte: senza questa lista
    // il server di sviluppo le scopre pagina per pagina e le isole già caricate smettono di idratarsi.
    optimizeDeps: { include: ['d3', 'd3-sankey', 'topojson-client'] },
  },
});
