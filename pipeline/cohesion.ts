import { z } from 'zod';
import { normalizeArea } from '../src/lib/countries';
import type { Cube, CubeRow } from '../src/lib/cube';

const amount = z.coerce.number().default(0);

export const Raw2127 = z.object({
  ms: z.string(),
  fund: z.string(),
  fund_family: z.string().default(''),
  pol_obj_short_name: z.string().default('ND'),
  category_code: z.string().default(''),
  category_short_title: z.string().default(''),
  planned: amount,
  decided: amount,
  spent: amount,
  climate: amount,
});
export type Raw2127 = z.infer<typeof Raw2127>;

export const Raw1420 = z.object({
  ms: z.string(),
  fund: z.string(),
  to: z.string().default('VOID'),
  to_short: z.string().default('VOID'),
  eu_amount: amount,
  total_amount: amount,
  total_eligible_cost: amount,
  total_eligible_expenditure: amount,
});
export type Raw1420 = z.infer<typeof Raw1420>;

export const QUERY_2127 = {
  select:
    'ms,fund,fund_family,pol_obj_short_name,category_code,category_short_title,' +
    'sum(eu_amount) as planned,' +
    'sum(eueligible_costs_decided_selectednotional) as decided,' +
    'sum(euspendshare_eligexpendituredeclarednotional) as spent,' +
    'sum(eu_climate_amount) as climate',
  // I cicli di rilevazione sono cumulativi: sommarli gonfia i totali di molte volte.
  where: "is_latest_tod_cycle='Y'",
  group: 'ms,fund,fund_family,pol_obj_short_name,category_code,category_short_title',
};

export const QUERY_1420 = {
  select:
    'ms,fund,to,to_short,sum(eu_amount) as eu_amount,sum(total_amount) as total_amount,' +
    'sum(total_eligible_cost) as total_eligible_cost,' +
    'sum(total_eligible_expenditure) as total_eligible_expenditure',
  where: "latest_period='Y'",
  group: 'ms,fund,to,to_short',
};

/** "021 SME business development" → "SME business development" */
export function cleanCategoryLabel(title: string): string {
  return title.replace(/^(SO\d+\.\d+|TOI\s*\d+|\d+)\s+/, '').trim();
}

function categoryKey(row: Raw2127): string {
  if (!row.category_code) return '';
  // I codici dei campi d'intervento sono univoci solo dentro la politica di coesione:
  // i fondi Affari interni e la pesca riusano gli stessi numeri per voci diverse.
  return row.fund_family === 'Cohesion'
    ? `IF${row.category_code}`
    : `${row.fund}:${row.category_short_title}`;
}

function mergeRows(rows: CubeRow[]): CubeRow[] {
  const merged = new Map<string, CubeRow>();
  for (const row of rows) {
    const key = row.slice(0, 4).join('\u0000');
    const prev = merged.get(key);
    merged.set(
      key,
      prev
        ? [row[0], row[1], row[2], row[3], prev[4] + row[4], prev[5] + row[5], prev[6] + row[6], prev[7] + row[7]]
        : row,
    );
  }
  return [...merged.values()]
    .map((r): CubeRow => [r[0], r[1], r[2], r[3], Math.round(r[4]), Math.round(r[5]), Math.round(r[6]), Math.round(r[7])])
    .filter((r) => r[4] !== 0 || r[5] !== 0 || r[6] !== 0);
}

export function buildCube2127(raw: readonly Raw2127[], asOf: string): Cube {
  const objectives: Record<string, string> = {};
  const categories: Record<string, string> = {};
  const rows = raw.map((r): CubeRow => {
    const cat = categoryKey(r);
    objectives[r.pol_obj_short_name] = r.pol_obj_short_name;
    if (cat) categories[cat] = cleanCategoryLabel(r.category_short_title);
    return [normalizeArea(r.ms), r.fund, r.pol_obj_short_name, cat, r.planned, r.decided, r.spent, r.climate];
  });
  return { period: '2021-2027', asOf, objectives, categories, rows: mergeRows(rows) };
}

/**
 * Il dataset 2014-2020 riporta costi e spesa totali (UE + nazionale). La quota UE è
 * stimata con il tasso di cofinanziamento del gruppo e non può superare il pianificato:
 * i programmi dichiarano spesso più spesa del necessario, ma l'UE non paga oltre il tetto.
 */
export function buildCube1420(raw: readonly Raw1420[], asOf: string): Cube {
  const objectives: Record<string, string> = {};
  const rows = raw.map((r): CubeRow => {
    const obj = `TO${r.to}`;
    objectives[obj] = r.to_short;
    const euShare = r.total_amount > 0 ? r.eu_amount / r.total_amount : 0;
    const cap = (total: number) => Math.min(total * euShare, r.eu_amount);
    return [
      normalizeArea(r.ms),
      r.fund,
      obj,
      '',
      r.eu_amount,
      cap(r.total_eligible_cost),
      cap(r.total_eligible_expenditure),
      0,
    ];
  });
  return { period: '2014-2020', asOf, objectives, categories: {}, rows: mergeRows(rows) };
}

export function cubePlannedTotal(cube: Cube): number {
  return cube.rows.reduce((sum, r) => sum + r[4], 0);
}
