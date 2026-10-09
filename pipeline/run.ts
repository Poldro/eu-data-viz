/**
 * Scarica i dati dalle fonti ufficiali, li valida e scrive gli aggregati in src/data/.
 * Qualsiasi errore interrompe l'esecuzione: il sito non viene mai costruito su dati parziali.
 *
 *   pnpm data             tutte le fonti
 *   pnpm data --skip-fts  solo la politica di coesione (più rapido)
 */
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { z } from 'zod';
import xlsx from 'xlsx';
import { buildCube1420, buildCube2127, cubePlannedTotal, QUERY_1420, QUERY_2127, Raw1420, Raw2127 } from './cohesion';
import { eurostatUrl, fetchEurostat } from './eurostat';
import { aggregateFts, FtsRow } from './fts';
import { buildHistoric, QUERY_REGIONAL, QUERY_YEARLY, RawRegional, RawYearly } from './historic';
import { buildRrf, DATASET_RECEIVED, DATASET_USES } from './rrf';
import { datasetUrl, soql } from './socrata';
import type { Meta } from '../src/lib/meta';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'src/data');
const CACHE_DIR = path.join(ROOT, '.cache/fts');

const DATASET_2127 = '3git-md5z';
const DATASET_1420 = '99js-gm52';
const DATASET_HISTORIC = 'tc55-7ysv';
const FTS_YEAR = 2025;
const FTS_URL = `https://ec.europa.eu/budget/financial-transparency-system/download/${FTS_YEAR}_FTS_dataset_en.xlsx`;
const FTS_PAGE = 'https://ec.europa.eu/budget/financial-transparency-system/';

/** Intervalli plausibili del totale pianificato (euro): fuori da qui c'è un doppio conteggio o un buco. */
const SANITY: Record<string, [number, number]> = {
  '2021-2027': [330e9, 460e9],
  '2014-2020': [480e9, 640e9],
};

function parseAll<T extends z.ZodType>(schema: T, rows: readonly unknown[], label: string): z.infer<T>[] {
  return rows.map((row, i) => {
    const parsed = schema.safeParse(row);
    if (!parsed.success) throw new Error(`${label}, riga ${i}: ${parsed.error.message}`);
    return parsed.data;
  });
}

function assertPlausible(period: string, total: number): void {
  const [min, max] = SANITY[period];
  if (total < min || total > max) {
    throw new Error(`${period}: totale pianificato ${(total / 1e9).toFixed(1)} mld fuori dall'intervallo atteso`);
  }
}

async function writeJson(name: string, data: unknown): Promise<void> {
  await writeFile(path.join(OUT_DIR, name), JSON.stringify(data));
}

async function singleValue(id: string, select: string, where?: string): Promise<string> {
  const [row] = (await soql(id, { select: `${select} as v`, where })) as { v?: string }[];
  if (!row?.v) throw new Error(`${id}: impossibile leggere ${select}`);
  return row.v;
}

async function cohesion(): Promise<Meta['sources']> {
  const [raw2127, cycle, raw1420, year1420] = await Promise.all([
    soql(DATASET_2127, QUERY_2127),
    singleValue(DATASET_2127, 'max(tod_cycle)', "is_latest_tod_cycle='Y'"),
    soql(DATASET_1420, QUERY_1420),
    singleValue(DATASET_1420, 'max(year)', "latest_period='Y'"),
  ]);
  const asOf2127 = `${cycle.slice(0, 4)}-${cycle.slice(4, 6)}`;
  const cube2127 = buildCube2127(parseAll(Raw2127, raw2127, DATASET_2127), asOf2127);
  const cube1420 = buildCube1420(parseAll(Raw1420, raw1420, DATASET_1420), year1420);
  assertPlausible(cube2127.period, cubePlannedTotal(cube2127));
  assertPlausible(cube1420.period, cubePlannedTotal(cube1420));
  await Promise.all([writeJson('cube-2127.json', cube2127), writeJson('cube-1420.json', cube1420)]);
  return [
    { id: 'cube-2127', name: '2021-2027 Finances Detailed Planned vs Implemented', url: datasetUrl(DATASET_2127), asOf: asOf2127 },
    { id: 'cube-1420', name: 'ESIF 2014-2020 Finance Implementation Details', url: datasetUrl(DATASET_1420), asOf: year1420 },
  ];
}

async function historic(): Promise<Meta['sources']> {
  const [yearly, regional] = await Promise.all([
    soql(DATASET_HISTORIC, QUERY_YEARLY),
    soql(DATASET_HISTORIC, QUERY_REGIONAL),
  ]);
  const data = buildHistoric(
    parseAll(RawYearly, yearly, `${DATASET_HISTORIC} annuale`),
    parseAll(RawRegional, regional, `${DATASET_HISTORIC} regionale`),
  );
  await writeJson('historic.json', data);
  return [
    { id: 'historic', name: 'Historic EU payments — regionalised and modelled', url: datasetUrl(DATASET_HISTORIC), asOf: String(data.lastYear) },
  ];
}

async function rrf(): Promise<Meta['sources']> {
  const [received, uses] = await Promise.all([fetchEurostat(DATASET_RECEIVED), fetchEurostat(DATASET_USES)]);
  const data = buildRrf(received, uses);
  await writeJson('rrf.json', data);
  return [
    { id: 'rrf-received', name: 'Eurostat — RRF financial flows (gov_rrf_fa)', url: eurostatUrl(DATASET_RECEIVED), asOf: String(data.lastYear) },
    { id: 'rrf-uses', name: 'Eurostat — RRF uses (gov_rrf_use)', url: eurostatUrl(DATASET_USES), asOf: String(data.lastYear) },
  ];
}

async function fts(): Promise<Meta['sources']> {
  const file = path.join(CACHE_DIR, `${FTS_YEAR}.xlsx`);
  if (!existsSync(file)) {
    await mkdir(CACHE_DIR, { recursive: true });
    const res = await fetch(FTS_URL, { signal: AbortSignal.timeout(600_000) });
    if (!res.ok) throw new Error(`FTS ${FTS_YEAR}: HTTP ${res.status}`);
    await writeFile(file, Buffer.from(await res.arrayBuffer()));
  }
  const workbook = xlsx.readFile(file, { dense: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = parseAll(FtsRow, xlsx.utils.sheet_to_json(sheet, { defval: null }), `FTS ${FTS_YEAR}`);
  if (rows.length < 10_000) throw new Error(`FTS ${FTS_YEAR}: solo ${rows.length} righe, file sospetto`);
  await writeJson('fts.json', aggregateFts(rows, FTS_YEAR, { topGlobal: 800, topPerCountry: 60 }));
  return [{ id: 'fts', name: `Financial Transparency System ${FTS_YEAR}`, url: FTS_PAGE, asOf: String(FTS_YEAR) }];
}

async function main(): Promise<void> {
  const skipFts = process.argv.includes('--skip-fts');
  await mkdir(OUT_DIR, { recursive: true });
  const steps = [cohesion(), historic(), rrf(), ...(skipFts ? [] : [fts()])];
  const sources = (await Promise.all(steps)).flat();
  // Con --skip-fts il file esistente resta valido: se ne conserva la voce nei metadati.
  const metaPath = path.join(OUT_DIR, 'meta.json');
  const previous: Meta | null = existsSync(metaPath) ? (await import(metaPath, { with: { type: 'json' } })).default : null;
  const kept = (previous?.sources ?? []).filter((s) => !sources.some((n) => n.id === s.id));
  const meta: Meta = { generatedAt: new Date().toISOString(), sources: [...sources, ...kept] };
  await writeJson('meta.json', meta);
  process.stdout.write(`Dati aggiornati: ${meta.sources.map((s) => `${s.id} (${s.asOf})`).join(', ')}\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`Pipeline fallita: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
