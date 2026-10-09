/**
 * Anticipazioni delle sezioni che non dipendono dai filtri. Si calcolano a build time,
 * così la prima pagina non deve scaricare i loro dati per intero.
 */
import ftsJson from '../data/fts.json';
import { HOME_COUNTRY, isMemberState } from './countries';
import { eur } from './format';
import type { FtsSummary } from './fts';

export interface Teaser {
  headline: string;
  values: number[];
  /** Indice della barra da evidenziare, -1 per nessuna. */
  highlight: number;
  chartLabel: string;
}

function beneficiaries(): Teaser {
  const fts = ftsJson as FtsSummary;
  const members = fts.byCountry.filter((b) => isMemberState(b.key));
  const home = members.find((b) => b.key === HOME_COUNTRY);
  return {
    headline: `${eur(fts.total)} impegnati nel ${fts.year}${home ? `, ${eur(home.amount)} in Italia` : ''}`,
    values: members.map((b) => b.amount),
    highlight: members.findIndex((b) => b.key === HOME_COUNTRY),
    chartLabel: 'Impegni per paese del beneficiario, Italia evidenziata',
  };
}

export function staticTeasers(): Record<string, Teaser> {
  return { beneficiari: beneficiaries() };
}
