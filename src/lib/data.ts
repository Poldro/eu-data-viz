import cube1420 from '../data/cube-1420.json';
import cube2127 from '../data/cube-2127.json';
import metaJson from '../data/meta.json';
import type { Cube } from './cube';
import type { Meta, Source } from './meta';

export type PeriodId = '2127' | '1420';

export const PERIODS: readonly { id: PeriodId; label: string }[] = [
  { id: '2127', label: '2021–2027' },
  { id: '1420', label: '2014–2020' },
];

const CUBES: Record<PeriodId, Cube> = {
  '2127': cube2127 as unknown as Cube,
  '1420': cube1420 as unknown as Cube,
};

export const meta: Meta = metaJson;

export function cubeFor(period: PeriodId): Cube {
  return CUBES[period];
}

export function isPeriod(value: string | null): value is PeriodId {
  return value === '2127' || value === '1420';
}

export function source(id: string): Source {
  const found = meta.sources.find((s) => s.id === id);
  if (!found) throw new Error(`Fonte sconosciuta: ${id}`);
  return found;
}

export function cubeSource(period: PeriodId): Source {
  return source(`cube-${period}`);
}
