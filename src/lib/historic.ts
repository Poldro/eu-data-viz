export interface HistoricRegion {
  id: string;
  name: string;
  total: number;
  byPeriod: Record<string, number>;
  /** Abitanti (Eurostat), null se i confini della regione non sono più ricostruibili. */
  population: number | null;
}

/** Pagamenti UE annuali 1986-2022 (dataset "Historic EU payments"), in euro. */
export interface Historic {
  firstYear: number;
  lastYear: number;
  funds: string[];
  /** paese → fondo → un valore per anno a partire da `firstYear`. */
  byCountry: Record<string, Record<string, number[]>>;
  regions: Record<string, HistoricRegion[]>;
}

export interface YearPoint {
  year: number;
  values: Record<string, number>;
  total: number;
}

export function countrySeries(historic: Historic, code: string): YearPoint[] {
  const series = historic.byCountry[code] ?? {};
  const span = historic.lastYear - historic.firstYear + 1;
  return Array.from({ length: span }, (_, i) => {
    const values = Object.fromEntries(historic.funds.map((f) => [f, series[f]?.[i] ?? 0]));
    const total = Object.values(values).reduce((a, b) => a + b, 0);
    return { year: historic.firstYear + i, values, total };
  });
}

export interface RegionValue extends HistoricRegion {
  country: string;
  /** Importo del periodo scelto (o totale), in euro. */
  amount: number;
  perCapita: number | null;
}

/** Tutte le regioni con l'importo di un periodo di programmazione; `period` vuoto = intera serie. */
export function regionValues(historic: Historic, period: string): RegionValue[] {
  return Object.entries(historic.regions).flatMap(([country, regions]) =>
    regions.map((region) => {
      const amount = period ? (region.byPeriod[period] ?? 0) : region.total;
      return { ...region, country, amount, perCapita: region.population ? amount / region.population : null };
    }),
  );
}

export function programmingPeriods(historic: Historic): string[] {
  const periods = new Set(Object.values(historic.regions).flatMap((regions) => regions.flatMap((r) => Object.keys(r.byPeriod))));
  return [...periods].sort();
}
