export interface HistoricRegion {
  id: string;
  name: string;
  total: number;
  byPeriod: Record<string, number>;
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
