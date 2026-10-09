import { COUNTRIES, isMemberState } from './countries';

/** [area, fondo, obiettivo, categoria, pianificato, deciso, speso, clima] — importi UE in euro. */
export type CubeRow = [string, string, string, string, number, number, number, number];

export interface Cube {
  period: string;
  /** Data di riferimento dei dati alla fonte. */
  asOf: string;
  objectives: Record<string, string>;
  categories: Record<string, string>;
  rows: CubeRow[];
}

export type Dimension = 'area' | 'fund' | 'objective' | 'category';
const DIM_INDEX: Record<Dimension, 0 | 1 | 2 | 3> = { area: 0, fund: 1, objective: 2, category: 3 };

export interface CubeFilter {
  fund?: string;
  area?: string;
  objective?: string;
}

export interface Totals {
  planned: number;
  decided: number;
  spent: number;
  climate: number;
}

export interface Group extends Totals {
  key: string;
}

export function filterRows(rows: readonly CubeRow[], filter: CubeFilter): CubeRow[] {
  return rows.filter(
    (r) =>
      (!filter.area || r[0] === filter.area) &&
      (!filter.fund || r[1] === filter.fund) &&
      (!filter.objective || r[2] === filter.objective),
  );
}

export function totals(rows: readonly CubeRow[]): Totals {
  let planned = 0;
  let decided = 0;
  let spent = 0;
  let climate = 0;
  for (const r of rows) {
    planned += r[4];
    decided += r[5];
    spent += r[6];
    climate += r[7];
  }
  return { planned, decided, spent, climate };
}

/** Raggruppa per una dimensione, in ordine decrescente di pianificato. */
export function groupBy(rows: readonly CubeRow[], dim: Dimension): Group[] {
  const index = DIM_INDEX[dim];
  const buckets = new Map<string, CubeRow[]>();
  for (const r of rows) {
    const bucket = buckets.get(r[index]);
    if (bucket) bucket.push(r);
    else buckets.set(r[index], [r]);
  }
  return [...buckets]
    .map(([key, bucket]) => ({ key, ...totals(bucket) }))
    .sort((a, b) => b.planned - a.planned);
}

export function ratio(part: number, whole: number): number {
  return whole > 0 ? part / whole : 0;
}

export interface CountryStat extends Totals {
  code: string;
  name: string;
  perCapita: number;
  absorption: number;
}

/** Una riga per ciascuno dei 27 Stati membri, anche quando il filtro li azzera. */
export function countryStats(rows: readonly CubeRow[]): CountryStat[] {
  const byArea = new Map(groupBy(rows, 'area').map((g) => [g.key, g]));
  return COUNTRIES.map((c) => {
    const g = byArea.get(c.code) ?? { planned: 0, decided: 0, spent: 0, climate: 0 };
    return {
      code: c.code,
      name: c.name,
      planned: g.planned,
      decided: g.decided,
      spent: g.spent,
      climate: g.climate,
      perCapita: g.planned / (c.population * 1e6),
      absorption: ratio(g.spent, g.planned),
    };
  });
}

/** Posizione in classifica (1 = primo) su un indicatore, tra i paesi con dati. */
export function rankOf(stats: readonly CountryStat[], code: string, metric: 'planned' | 'perCapita' | 'absorption'): number {
  const sorted = stats.filter((s) => s.planned > 0).sort((a, b) => b[metric] - a[metric]);
  return sorted.findIndex((s) => s.code === code) + 1;
}

export interface FlowLink {
  source: string;
  target: string;
  value: number;
}

export interface Flows {
  nodes: { id: string; column: 0 | 1 | 2; key: string }[];
  links: FlowLink[];
}

const OTHER = '__other__';

/**
 * Flussi fondo → obiettivo → destinazione per il diagramma di Sankey.
 * Le destinazioni oltre le prime `maxAreas` confluiscono in "altri".
 */
export function buildFlows(rows: readonly CubeRow[], maxAreas = 9): Flows {
  const memberAreas = groupBy(rows, 'area').filter((g) => isMemberState(g.key));
  const keep = new Set(memberAreas.slice(0, maxAreas).map((g) => g.key));
  const links = new Map<string, FlowLink>();
  const add = (source: string, target: string, value: number) => {
    if (value <= 0) return;
    const id = `${source}→${target}`;
    const prev = links.get(id);
    links.set(id, { source, target, value: (prev?.value ?? 0) + value });
  };
  for (const r of rows) {
    const area = keep.has(r[0]) ? r[0] : OTHER;
    add(`f:${r[1]}`, `o:${r[2]}`, r[4]);
    add(`o:${r[2]}`, `a:${area}`, r[4]);
  }
  const ids = new Set<string>();
  for (const l of links.values()) {
    ids.add(l.source);
    ids.add(l.target);
  }
  const column = (id: string): 0 | 1 | 2 => (id.startsWith('f:') ? 0 : id.startsWith('o:') ? 1 : 2);
  return {
    nodes: [...ids].map((id) => ({ id, column: column(id), key: id.slice(2) })),
    links: [...links.values()],
  };
}

export const OTHER_AREA = OTHER;
