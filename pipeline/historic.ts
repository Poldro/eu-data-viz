import { z } from 'zod';
import { isMemberState, normalizeArea } from '../src/lib/countries';
import type { Historic, HistoricRegion } from '../src/lib/historic';
import { normalizeRegion, populationFor } from './regions';

const amount = z.coerce.number().default(0);

export const RawYearly = z.object({
  country: z.string(),
  fund: z.string(),
  year: z.coerce.number().int(),
  paid: amount,
});
export type RawYearly = z.infer<typeof RawYearly>;

export const RawRegional = z.object({
  country: z.string(),
  nuts2_id: z.string(),
  nuts2_name: z.string().default(''),
  programming_period: z.string(),
  paid: amount,
});
export type RawRegional = z.infer<typeof RawRegional>;

export const QUERY_YEARLY = {
  select: 'country,fund,year,sum(eu_payment_annual) as paid',
  group: 'country,fund,year',
};

export const QUERY_REGIONAL = {
  select: 'country,nuts2_id,nuts2_name,programming_period,sum(eu_payment_annual) as paid',
  group: 'country,nuts2_id,nuts2_name,programming_period',
};

export interface RegionContext {
  /** Nomi ufficiali per codice regione, dalla geometria. */
  names: ReadonlyMap<string, string>;
  population: ReadonlyMap<string, number>;
}

const NO_CONTEXT: RegionContext = { names: new Map(), population: new Map() };

export function buildHistoric(yearly: readonly RawYearly[], regional: readonly RawRegional[], context: RegionContext = NO_CONTEXT): Historic {
  const member = yearly
    .map((r) => ({ ...r, country: normalizeArea(r.country) }))
    .filter((r) => isMemberState(r.country));
  if (member.length === 0) throw new Error('Storico: nessuna riga per gli Stati membri');

  const years = member.map((r) => r.year);
  const firstYear = Math.min(...years);
  const lastYear = Math.max(...years);
  const span = lastYear - firstYear + 1;
  const funds = [...new Set(member.map((r) => r.fund))].sort();

  const byCountry: Historic['byCountry'] = {};
  for (const r of member) {
    const series = (byCountry[r.country] ??= {});
    const values = (series[r.fund] ??= new Array<number>(span).fill(0));
    values[r.year - firstYear] += Math.round(r.paid);
  }

  const regionMap = new Map<string, HistoricRegion & { country: string }>();
  for (const r of regional) {
    const country = normalizeArea(r.country);
    // Le righe "xxZZ" raccolgono i pagamenti non attribuibili a una regione.
    if (!isMemberState(country) || r.paid <= 0) continue;
    // Più codici recenti possono confluire nella stessa regione 2010: gli importi si sommano.
    const id = normalizeRegion(r.nuts2_id);
    const prev = regionMap.get(id) ?? {
      id,
      name: context.names.get(id) ?? r.nuts2_name,
      total: 0,
      byPeriod: {},
      population: populationFor(id, context.population),
      country,
    };
    regionMap.set(id, {
      ...prev,
      total: prev.total + Math.round(r.paid),
      byPeriod: {
        ...prev.byPeriod,
        [r.programming_period]: (prev.byPeriod[r.programming_period] ?? 0) + Math.round(r.paid),
      },
    });
  }

  const regions: Historic['regions'] = {};
  for (const { country, ...region } of regionMap.values()) {
    (regions[country] ??= []).push(region);
  }
  for (const list of Object.values(regions)) list.sort((a, b) => b.total - a.total);

  return { firstYear, lastYear, funds, byCountry, regions };
}
