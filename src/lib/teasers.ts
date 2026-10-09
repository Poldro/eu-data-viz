/**
 * Anticipazioni delle sezioni che non dipendono dai filtri. Si calcolano a build time,
 * così la prima pagina non deve scaricare i loro dati per intero.
 */
import ftsJson from '../data/fts.json';
import historicJson from '../data/historic.json';
import rrfJson from '../data/rrf.json';
import { HOME_COUNTRY, isMemberState } from './countries';
import { eur, pct, perHead } from './format';
import type { FtsSummary } from './fts';
import { regionValues, type Historic } from './historic';
import { rrfTotals, type Rrf } from './rrf';

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

const REGION_PERIOD = '2014-2020';
const REGION_BARS = 40;

function regions(): Teaser {
  const ranked = regionValues(historicJson as unknown as Historic, REGION_PERIOD)
    .filter((r) => r.perCapita !== null && r.amount > 0)
    .sort((a, b) => (b.perCapita ?? 0) - (a.perCapita ?? 0));
  const home = ranked.findIndex((r) => r.country === HOME_COUNTRY);
  return {
    headline: home >= 0 ? `${ranked[home].name}: ${perHead(ranked[home].perCapita ?? 0)} per abitante, prima in Italia` : 'I pagamenti regione per regione',
    values: ranked.slice(0, REGION_BARS).map((r) => r.perCapita ?? 0),
    highlight: home < REGION_BARS ? home : -1,
    chartLabel: 'Le regioni che ricevono di più per abitante',
  };
}

function recovery(): Teaser {
  const rrf = rrfJson as Rrf;
  const ranked = Object.entries(rrf.countries)
    .map(([code, country]) => ({ code, ...rrfTotals(country) }))
    .sort((a, b) => b.spentShare - a.spentShare);
  const home = ranked.find((c) => c.code === HOME_COUNTRY);
  return {
    headline: home ? `Italia: ricevuto il ${pct(home.receivedShare)} del piano, speso il ${pct(home.spentShare)}` : `Dati al ${rrf.lastYear}`,
    values: ranked.map((c) => c.spentShare),
    highlight: ranked.findIndex((c) => c.code === HOME_COUNTRY),
    chartLabel: 'Quota del piano già spesa, per paese',
  };
}

export function staticTeasers(): Record<string, Teaser> {
  return { regioni: regions(), beneficiari: beneficiaries(), pnrr: recovery() };
}
