/**
 * Le regioni dello storico dei pagamenti sono codificate, quasi tutte, nella classificazione NUTS 2010.
 * Qui si riportano a quella versione i pochi codici più recenti, si prepara la geometria corrispondente
 * e si aggancia la popolazione, che Eurostat pubblica solo con i codici attuali.
 */
import type { FeatureCollection } from 'geojson';
import { feature } from 'topojson-client';
import { topology } from 'topojson-server';
import type { GeometryCollection, Topology } from 'topojson-specification';
import { isMemberState, normalizeArea } from '../src/lib/countries';
import type { Observation } from './eurostat';

export const GEOMETRY_URL = 'https://gisco-services.ec.europa.eu/distribution/v2/nuts/topojson/NUTS_RG_20M_2010_4326_LEVL_2.json';
export const GEOMETRY_PAGE = 'https://ec.europa.eu/eurostat/web/gisco/geodata/statistical-units/territorial-units-statistics';
export const POPULATION_DATASET = 'demo_r_d2jan';
export const POPULATION_YEAR = '2023';
const QUANTIZATION = 1e4;

/** Codici successivi al 2010 presenti nello storico → regione NUTS 2010 che li contiene. */
const RECODE_TO_2010: Readonly<Record<string, string>> = {
  EL51: 'EL11', EL52: 'EL12', EL53: 'EL13', EL61: 'EL14', EL54: 'EL21', EL62: 'EL22', EL63: 'EL23', EL64: 'EL24', EL65: 'EL25',
  SI03: 'SI01', SI04: 'SI02',
  // La Croazia continentale è stata divisa in tre nel 2021.
  HR02: 'HR04', HR05: 'HR04', HR06: 'HR04',
};

/** Regione NUTS 2010 → codici attuali di cui sommare la popolazione (ricodifiche e suddivisioni). */
const POPULATION_CODES: Readonly<Record<string, readonly string[]>> = {
  FR21: ['FRF2'], FR22: ['FRE2'], FR23: ['FRD2'], FR24: ['FRB0'], FR25: ['FRD1'], FR26: ['FRC1'], FR30: ['FRE1'],
  FR41: ['FRF3'], FR42: ['FRF1'], FR43: ['FRC2'], FR51: ['FRG0'], FR52: ['FRH0'], FR53: ['FRI3'], FR61: ['FRI1'],
  FR62: ['FRJ2'], FR63: ['FRI2'], FR71: ['FRK2'], FR72: ['FRK1'], FR81: ['FRJ1'], FR82: ['FRL0'], FR83: ['FRM0'],
  FR91: ['FRY1'], FR92: ['FRY2'], FR93: ['FRY3'], FR94: ['FRY4'],
  EL11: ['EL51'], EL12: ['EL52'], EL13: ['EL53'], EL14: ['EL61'], EL21: ['EL54'], EL22: ['EL62'], EL23: ['EL63'],
  EL24: ['EL64'], EL25: ['EL65'],
  PL11: ['PL71'], PL12: ['PL91', 'PL92'], PL31: ['PL81'], PL32: ['PL82'], PL33: ['PL72'], PL34: ['PL84'],
  HU10: ['HU11', 'HU12'], LT00: ['LT01', 'LT02'], SI01: ['SI03'], SI02: ['SI04'], HR04: ['HR02', 'HR05', 'HR06'],
};

export function normalizeRegion(id: string): string {
  const code = id.trim().toUpperCase().replace(/^GR/, 'EL');
  return RECODE_TO_2010[code] ?? code;
}

export function populationByCode(observations: readonly Observation[]): Map<string, number> {
  return new Map(observations.filter((o) => o.value > 0).map((o) => [o.geo, o.value]));
}

/** Abitanti della regione, oppure null quando i confini sono cambiati in modo non ricostruibile (es. Irlanda). */
export function populationFor(id: string, population: ReadonlyMap<string, number>): number | null {
  const codes = POPULATION_CODES[id] ?? [id];
  const values = codes.map((code) => population.get(code));
  return values.every((v): v is number => v !== undefined) ? values.reduce((a, b) => a + b, 0) : null;
}

interface RegionProperties {
  NUTS_ID: string;
  CNTR_CODE: string;
  NAME_LATN: string;
}

export interface RegionGeometry {
  topology: Topology;
  /** Nome della regione in caratteri latini, per codice. */
  names: Map<string, string>;
}

/** Tiene solo le regioni degli Stati membri e ricostruisce la topologia senza gli archi rimasti orfani. */
export function prepareGeometry(source: Topology): RegionGeometry {
  const key = Object.keys(source.objects)[0];
  const collection = feature(source, source.objects[key] as GeometryCollection<RegionProperties>);
  const features = collection.features
    .filter((f) => isMemberState(normalizeArea(f.properties.CNTR_CODE)))
    .map((f) => ({ ...f, id: f.properties.NUTS_ID, properties: { name: f.properties.NAME_LATN } }));
  if (features.length < 200) throw new Error(`Geometria NUTS2: solo ${features.length} regioni`);
  return {
    topology: topology({ regions: { type: 'FeatureCollection', features } as FeatureCollection }, QUANTIZATION) as unknown as Topology,
    names: new Map(features.map((f) => [String(f.id), f.properties.name])),
  };
}

export async function fetchGeometry(): Promise<Topology> {
  const res = await fetch(GEOMETRY_URL, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`GISCO NUTS2: HTTP ${res.status}`);
  const data = (await res.json()) as Topology;
  if (data?.type !== 'Topology' || !data.objects) throw new Error('GISCO NUTS2: non è un TopoJSON');
  return data;
}
