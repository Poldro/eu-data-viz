import { cubeFor, isPeriod, type PeriodId } from './data';

interface Filters {
  period: PeriodId;
  /** Codice del fondo; stringa vuota = tutti. */
  fund: string;
  /** Codice dello Stato membro; stringa vuota = tutta l'UE. */
  area: string;
}

const DEFAULTS: Filters = { period: '2127', fund: '', area: '' };

/** Stato condiviso tra i grafici di una pagina, specchiato nella query string. */
export const filters = $state<Filters>({ ...DEFAULTS });

function fundExists(period: PeriodId, fund: string): boolean {
  return cubeFor(period).rows.some((r) => r[1] === fund);
}

export function setPeriod(period: PeriodId): void {
  filters.period = period;
  // I fondi cambiano nome tra un ciclo e l'altro (FSE → FSE+): un filtro orfano svuoterebbe la pagina.
  if (filters.fund && !fundExists(period, filters.fund)) filters.fund = '';
}

export function toggleFund(fund: string): void {
  filters.fund = filters.fund === fund ? '' : fund;
}

export function toggleArea(area: string): void {
  filters.area = filters.area === area ? '' : area;
}

export function resetFilters(): void {
  Object.assign(filters, DEFAULTS);
}

export function hasActiveFilters(): boolean {
  return filters.fund !== '' || filters.area !== '' || filters.period !== DEFAULTS.period;
}

export function filtersQuery(): string {
  const params = new URLSearchParams();
  if (filters.period !== DEFAULTS.period) params.set('periodo', filters.period);
  if (filters.fund) params.set('fondo', filters.fund);
  if (filters.area) params.set('paese', filters.area);
  const query = params.toString();
  return query ? `?${query}` : '';
}

/** Da chiamare dopo l'idratazione: prima il markup deve coincidere con quello statico. */
export function readFiltersFromUrl(): void {
  const params = new URLSearchParams(window.location.search);
  const period = params.get('periodo');
  filters.period = isPeriod(period) ? period : DEFAULTS.period;
  const fund = params.get('fondo') ?? '';
  filters.fund = fund && fundExists(filters.period, fund) ? fund : '';
  const area = params.get('paese') ?? '';
  filters.area = /^[A-Z]{2}$/.test(area) ? area : '';
}

/** Aggiorna l'indirizzo e i link di navigazione, così i filtri seguono il lettore tra le sezioni. */
export function writeFiltersToUrl(): void {
  const query = filtersQuery();
  window.history.replaceState(null, '', `${window.location.pathname}${query}${window.location.hash}`);
  for (const link of document.querySelectorAll<HTMLAnchorElement>('a[data-keep-filters]')) {
    link.href = `${link.pathname}${query}`;
  }
}
