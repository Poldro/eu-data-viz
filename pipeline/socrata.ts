/** Client minimale per l'API SoQL della piattaforma Cohesion Open Data. */
const BASE = 'https://cohesiondata.ec.europa.eu/resource';
const PAGE_LIMIT = 50_000;
const TIMEOUT_MS = 60_000;

export interface SoqlQuery {
  select: string;
  where?: string;
  group?: string;
}

export function datasetUrl(id: string): string {
  return `https://cohesiondata.ec.europa.eu/d/${id}`;
}

export async function soql(id: string, query: SoqlQuery): Promise<unknown[]> {
  const params = new URLSearchParams({ $select: query.select, $limit: String(PAGE_LIMIT) });
  if (query.where) params.set('$where', query.where);
  if (query.group) params.set('$group', query.group);

  const url = `${BASE}/${id}.json?${params}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) {
    throw new Error(`Socrata ${id}: HTTP ${res.status} — ${(await res.text()).slice(0, 300)}`);
  }
  const rows: unknown = await res.json();
  if (!Array.isArray(rows)) throw new Error(`Socrata ${id}: risposta inattesa`);
  // Una pagina piena significa risultato troncato: meglio fermarsi che pubblicare totali parziali.
  if (rows.length >= PAGE_LIMIT) {
    throw new Error(`Socrata ${id}: ${rows.length} righe, risultato probabilmente troncato`);
  }
  return rows;
}
