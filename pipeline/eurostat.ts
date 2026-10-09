/** Lettura dei dataset Eurostat nel formato JSON-stat 2.0. */
import { z } from 'zod';

const BASE = 'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data';
const TIMEOUT_MS = 60_000;

export const JsonStat = z.object({
  id: z.array(z.string()),
  size: z.array(z.number().int().positive()),
  value: z.record(z.string(), z.number().nullable()),
  dimension: z.record(z.string(), z.object({ category: z.object({ index: z.record(z.string(), z.number().int()) }) })),
});
export type JsonStat = z.infer<typeof JsonStat>;

/** Una osservazione: il codice di ogni dimensione più il valore. */
export type Observation = Record<string, string> & { value: number };

export function eurostatUrl(code: string): string {
  return `https://ec.europa.eu/eurostat/databrowser/view/${code}/default/table`;
}

/** I valori arrivano in un array piatto, indicizzato in ordine riga-maggiore sulle dimensioni. */
export function parseJsonStat(doc: JsonStat): Observation[] {
  if (doc.id.length !== doc.size.length) throw new Error('JSON-stat: dimensioni e misure non coincidono');
  const codes = doc.id.map((dim) => {
    const index = doc.dimension[dim]?.category.index;
    if (!index) throw new Error(`JSON-stat: dimensione ${dim} assente`);
    return Object.entries(index)
      .sort((a, b) => a[1] - b[1])
      .map(([code]) => code);
  });
  const observations: Observation[] = [];
  for (const [key, value] of Object.entries(doc.value)) {
    if (value === null) continue;
    let rest = Number(key);
    const entry: Record<string, string> = {};
    for (let d = doc.id.length - 1; d >= 0; d -= 1) {
      entry[doc.id[d]] = codes[d][rest % doc.size[d]];
      rest = Math.floor(rest / doc.size[d]);
    }
    observations.push({ ...entry, value } as Observation);
  }
  return observations;
}

export async function fetchEurostat(code: string, params: Record<string, string> = {}): Promise<Observation[]> {
  const query = new URLSearchParams({ format: 'JSON', lang: 'EN', ...params });
  const res = await fetch(`${BASE}/${code}?${query}`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`Eurostat ${code}: HTTP ${res.status}`);
  const parsed = JsonStat.safeParse(await res.json());
  if (!parsed.success) throw new Error(`Eurostat ${code}: formato inatteso — ${parsed.error.message}`);
  return parseJsonStat(parsed.data);
}
