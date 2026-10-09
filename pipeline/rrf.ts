import { isMemberState } from '../src/lib/countries';
import type { Rrf, RrfCountry, RrfSplit } from '../src/lib/rrf';
import type { Observation } from './eurostat';

export const DATASET_RECEIVED = 'gov_rrf_fa';
export const DATASET_USES = 'gov_rrf_use';
const EU = 'EU27_2020';
const MILLION = 1e6;

const TYPES = { GRNT: 'grants', LOAN: 'loans' } as const;
type FinType = keyof typeof TYPES;
const isFinType = (code: string): code is FinType => code in TYPES;

/** Fondi ricevuti: transazioni dell'anno (TRN), posizione netta. */
const isReceived = (o: Observation) => o.na_item === 'F2R_F4R' && o.finpos === 'NET' && o.stk_flow === 'TRN';
/** Dotazione: si ricava dallo stock cumulato e dalla sua quota percentuale dell'allocazione. */
const isReceivedStock = (o: Observation) => o.na_item === 'F2R_F4R' && o.finpos === 'NET' && o.stk_flow === 'STK' && o.fin_typ === 'TOTAL';
const isSpent = (o: Observation) => o.na_item === 'TOTAL';

function split(observations: readonly Observation[], geo: string, firstYear: number, span: number): RrfSplit {
  const result: RrfSplit = { grants: new Array<number>(span).fill(0), loans: new Array<number>(span).fill(0) };
  for (const o of observations) {
    if (o.geo !== geo || o.unit !== 'MIO_EUR' || !isFinType(o.fin_typ)) continue;
    result[TYPES[o.fin_typ]][Number(o.time) - firstYear] = Math.round(o.value * MILLION);
  }
  return result;
}

function allocation(stock: readonly Observation[], geo: string): number {
  // Si usa l'anno con la quota più alta: l'arrotondamento a un decimale pesa meno.
  const byYear = new Map<string, { amount?: number; share?: number }>();
  for (const o of stock) {
    if (o.geo !== geo) continue;
    const entry = byYear.get(o.time) ?? {};
    byYear.set(o.time, o.unit === 'MIO_EUR' ? { ...entry, amount: o.value } : o.unit === 'PC_ALLOC' ? { ...entry, share: o.value } : entry);
  }
  const best = [...byYear.values()]
    .filter((e): e is { amount: number; share: number } => e.amount !== undefined && e.share !== undefined && e.share > 0)
    .sort((a, b) => b.share - a.share)[0];
  return best ? Math.round((best.amount / (best.share / 100)) * MILLION) : 0;
}

export function buildRrf(receivedData: readonly Observation[], usesData: readonly Observation[]): Rrf {
  const received = receivedData.filter(isReceived);
  const stock = receivedData.filter(isReceivedStock);
  const spent = usesData.filter(isSpent);
  const years = [...received, ...spent].map((o) => Number(o.time)).filter(Number.isFinite);
  if (years.length === 0) throw new Error('RRF: nessuna osservazione utilizzabile');
  const firstYear = Math.min(...years);
  const lastYear = Math.max(...years);
  const span = lastYear - firstYear + 1;

  const country = (geo: string): RrfCountry => ({
    allocation: allocation(stock, geo),
    received: split(received, geo, firstYear, span),
    spent: split(spent, geo, firstYear, span),
  });

  const geos = [...new Set(received.map((o) => o.geo))].filter(isMemberState);
  const countries = Object.fromEntries(geos.map((geo) => [geo, country(geo)]).filter(([, c]) => (c as RrfCountry).allocation > 0));
  if (Object.keys(countries).length < 20) throw new Error(`RRF: solo ${Object.keys(countries).length} paesi con dati`);
  return { firstYear, lastYear, countries, eu: country(EU) };
}
