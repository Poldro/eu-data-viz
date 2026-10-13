# Conto Europa

Dashboard di data journalism sui fondi europei: da quale fondo partono, che cosa finanziano,
in quali paesi e regioni arrivano, quanti ne sono stati spesi e chi li incassa.

Undici sezioni: Panoramica, Cosa finanziano, Chi spende, Cosa si perde, Paesi, Regioni, Progetti (Italia),
PNRR, Beneficiari, Lobby, Metodo. L'elenco vive in `src/lib/sections.ts` e alimenta testata,
indice in prima pagina e rimandi a fine pagina.

Sito statico in Astro + Svelte 5, grafici in D3. Nessun server: i dati vengono scaricati e
aggregati da una pipeline e salvati in `src/data/`.

## Comandi

| Comando | Cosa fa |
|---|---|
| `pnpm dev` | Server di sviluppo (`astro dev --background` per tenerlo in background) |
| `pnpm data` | Riscarica tutte le fonti e rigenera `src/data/*.json` |
| `pnpm data --only=rrf` | Rigenera un solo passo: `cohesion`, `historic`, `rrf`, `fts`, `projects`, `lobby` |
| `pnpm data --skip-projects` | Tutto tranne un passo (anche `--skip-fts`, ecc.) |
| `pnpm test` | Test unitari (Vitest) |
| `pnpm coverage` | Test unitari con copertura di `pipeline/` e `src/lib/` |
| `pnpm test:e2e` | Test end-to-end (Playwright) sul sito costruito, desktop e mobile |
| `pnpm check` | Controllo dei tipi su file Astro e Svelte |
| `pnpm build` | Genera il sito in `dist/` |

## Struttura

- `pipeline/` — scarica, valida (zod) e aggrega i dati. Ogni errore interrompe l'esecuzione:
  il sito non viene mai costruito su dati parziali.
- `src/data/` — aggregati generati, versionati: il build non richiede rete.
- `src/lib/` — logica pura condivisa (cubo dei dati, formati, etichette, filtri).
- `src/components/charts/` — grafici; `src/components/pages/` — un'isola Svelte per sezione.
- `src/pages/` — le pagine Astro; `/metodo` documenta fonti, definizioni e limiti.

## Fonti

| Passo | Fonte | File prodotti |
|---|---|---|
| `cohesion` | Cohesion Open Data (Commissione europea) | `cube-2127.json`, `cube-1420.json` |
| `historic` | Pagamenti storici regionali, geometrie GISCO NUTS 2, popolazione Eurostat | `historic.json`, `nuts2.json` |
| `rrf` | Eurostat `gov_rrf_fa` e `gov_rrf_use` | `rrf.json` |
| `fts` | Financial Transparency System | `fts.json` |
| `projects` | API OpenCoesione (solo Italia) | `projects.json` |
| `lobby` | Registro per la trasparenza (estrazione XML completa) | `lobby.json` |

I tassi di errore della Corte dei conti europea (`src/lib/audit.ts`) escono una volta l'anno in PDF
e vanno aggiornati a mano.

L'elenco degli atti legislativi che la sezione Lobby cerca tra i dossier dichiarati (`src/lib/acts.ts`)
è curato a mano: numero CELEX e data vanno verificati su EUR-Lex quando se ne aggiunge uno.

Il passo `lobby` scarica un file di oltre cento megabyte e lo legge a pezzi; l'estrazione resta in
`.cache/lobby/` per la giornata.

Il passo `projects` è lento (una decina di minuti): l'API limita le richieste e impone pause
di 30 secondi. Per il ciclo 2014-2020 non restituisce la classifica per costo, quindi di quel
ciclo si scaricano solo gli aggregati.

## Aggiornare i dati

`pnpm data && pnpm build`. Le fonti di coesione si aggiornano più volte l'anno; il file
FTS esce una volta l'anno (l'anno è la costante `FTS_YEAR` in `pipeline/run.ts`).

Il workflow `.github/workflows/data.yml` lo fa ogni lunedì (o a mano da *Actions*): riscarica,
esegue i test, costruisce e fa il commit di `src/data/` solo se i dati sono cambiati. Se una
fonte non risponde il job fallisce e il sito resta quello di prima.

## Pubblicazione

Il sito è statico (`dist/`). Su Vercel basta collegare la repo: il preset Astro viene
riconosciuto da solo e ogni push su `main` ridistribuisce. Con un dominio proprio impostare
la variabile `SITE_URL` (serve a sitemap, canonical e Open Graph); altrimenti viene usato
l'indirizzo di produzione fornito da Vercel.
