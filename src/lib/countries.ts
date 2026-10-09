/** I 27 Stati membri: anagrafica condivisa tra pipeline e interfaccia. */
export interface Country {
  /** Codice Eurostat (la Grecia è EL, non GR). */
  code: string;
  name: string;
  /** Nome inglese, come compare nei dataset della Commissione. */
  en: string;
  /** Popolazione in milioni di abitanti (Eurostat, 2023). */
  population: number;
  /** Posizione nella mappa a tessere: [colonna, riga]. */
  tile: [number, number];
}

export const COUNTRIES: readonly Country[] = [
  { code: 'AT', name: 'Austria', en: 'Austria', population: 9.1, tile: [3, 5] },
  { code: 'BE', name: 'Belgio', en: 'Belgium', population: 11.6, tile: [1, 4] },
  { code: 'BG', name: 'Bulgaria', en: 'Bulgaria', population: 6.5, tile: [5, 6] },
  { code: 'CY', name: 'Cipro', en: 'Cyprus', population: 1.2, tile: [6, 7] },
  { code: 'CZ', name: 'Cechia', en: 'Czechia', population: 10.9, tile: [3, 4] },
  { code: 'DE', name: 'Germania', en: 'Germany', population: 83.2, tile: [3, 3] },
  { code: 'DK', name: 'Danimarca', en: 'Denmark', population: 5.9, tile: [3, 2] },
  { code: 'EE', name: 'Estonia', en: 'Estonia', population: 1.3, tile: [5, 1] },
  { code: 'EL', name: 'Grecia', en: 'Greece', population: 10.4, tile: [5, 7] },
  { code: 'ES', name: 'Spagna', en: 'Spain', population: 47.4, tile: [1, 6] },
  { code: 'FI', name: 'Finlandia', en: 'Finland', population: 5.5, tile: [5, 0] },
  { code: 'FR', name: 'Francia', en: 'France', population: 68.0, tile: [1, 5] },
  { code: 'HR', name: 'Croazia', en: 'Croatia', population: 3.9, tile: [4, 6] },
  { code: 'HU', name: 'Ungheria', en: 'Hungary', population: 9.7, tile: [4, 5] },
  { code: 'IE', name: 'Irlanda', en: 'Ireland', population: 5.1, tile: [0, 2] },
  { code: 'IT', name: 'Italia', en: 'Italy', population: 59.0, tile: [2, 6] },
  { code: 'LT', name: 'Lituania', en: 'Lithuania', population: 2.8, tile: [5, 3] },
  { code: 'LU', name: 'Lussemburgo', en: 'Luxembourg', population: 0.7, tile: [2, 4] },
  { code: 'LV', name: 'Lettonia', en: 'Latvia', population: 1.8, tile: [5, 2] },
  { code: 'MT', name: 'Malta', en: 'Malta', population: 0.5, tile: [2, 7] },
  { code: 'NL', name: 'Paesi Bassi', en: 'Netherlands', population: 17.9, tile: [2, 3] },
  { code: 'PL', name: 'Polonia', en: 'Poland', population: 37.7, tile: [4, 3] },
  { code: 'PT', name: 'Portogallo', en: 'Portugal', population: 10.3, tile: [0, 6] },
  { code: 'RO', name: 'Romania', en: 'Romania', population: 19.0, tile: [5, 5] },
  { code: 'SE', name: 'Svezia', en: 'Sweden', population: 10.5, tile: [4, 1] },
  { code: 'SI', name: 'Slovenia', en: 'Slovenia', population: 2.1, tile: [3, 6] },
  { code: 'SK', name: 'Slovacchia', en: 'Slovakia', population: 5.5, tile: [4, 4] },
];

export const HOME_COUNTRY = 'IT';
export const TILE_COLS = 7;
export const TILE_ROWS = 8;

/** Voci che non sono Stati membri ma compaiono nei dati. */
export const EXTRA_AREAS: Readonly<Record<string, string>> = {
  TC: 'Cooperazione territoriale (Interreg)',
  UK: 'Regno Unito',
  OT: 'Altri',
};

const BY_CODE = new Map(COUNTRIES.map((c) => [c.code, c]));
const BY_EN = new Map(COUNTRIES.map((c) => [c.en.toLowerCase(), c]));
// Il Financial Transparency System usa ancora il nome lungo.
const EN_ALIASES: Readonly<Record<string, string>> = { 'czech republic': 'CZ' };

export function countryByCode(code: string): Country | undefined {
  return BY_CODE.get(code);
}

export function countryByEnglishName(name: string): Country | undefined {
  const key = name.trim().toLowerCase();
  return BY_EN.get(key) ?? BY_CODE.get(EN_ALIASES[key] ?? '');
}

export function isMemberState(code: string): boolean {
  return BY_CODE.has(code);
}

export function areaName(code: string): string {
  return BY_CODE.get(code)?.name ?? EXTRA_AREAS[code] ?? code;
}

/** Riporta i codici dei dataset (GR, CH, NO…) all'insieme usato dal sito. */
export function normalizeArea(raw: string): string {
  const code = raw.trim().toUpperCase();
  if (code === 'GR') return 'EL';
  if (BY_CODE.has(code) || code === 'TC' || code === 'UK') return code;
  return 'OT';
}
