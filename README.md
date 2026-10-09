# Conto Europa

Dashboard di data journalism sui fondi europei: da quale fondo partono, che cosa finanziano,
in quali paesi arrivano, quanti ne sono stati spesi e chi li incassa.

Sito statico in Astro + Svelte 5, grafici in D3. Nessun server: i dati vengono scaricati e
aggregati da una pipeline e salvati in `src/data/`.

## Comandi

| Comando | Cosa fa |
|---|---|
| `pnpm dev` | Server di sviluppo (`astro dev --background` per tenerlo in background) |
| `pnpm data` | Riscarica tutte le fonti e rigenera `src/data/*.json` |
| `pnpm data --skip-fts` | Come sopra, senza il file dei beneficiari (più rapido) |
| `pnpm test` | Test unitari (Vitest) |
| `pnpm check` | Controllo dei tipi su file Astro e Svelte |
| `pnpm build` | Genera il sito in `dist/` |

## Struttura

- `pipeline/` — scarica, valida (zod) e aggrega i dati. Ogni errore interrompe l'esecuzione:
  il sito non viene mai costruito su dati parziali.
- `src/data/` — aggregati generati, versionati: il build non richiede rete.
- `src/lib/` — logica pura condivisa (cubo dei dati, formati, etichette, filtri).
- `src/components/charts/` — grafici; `src/components/pages/` — un'isola Svelte per sezione.
- `src/pages/` — le pagine Astro; `/metodo` documenta fonti, definizioni e limiti.

## Aggiornare i dati

`pnpm data && pnpm build`. Le fonti di coesione si aggiornano più volte l'anno; il file
FTS esce una volta l'anno (l'anno è la costante `FTS_YEAR` in `pipeline/run.ts`).
