import { COUNTRIES } from './countries';
import { ratio, type CubeRow } from './cube';

/**
 * Obiettivi che finanziano la gestione dei fondi stessi ("assistenza tecnica"): uffici,
 * controlli, consulenze, sistemi informativi. Valgono per entrambi i cicli.
 */
const TECHNICAL_ASSISTANCE = /^(POTA|TOTA|TOIPA)/;

export function isTechnicalAssistance(objective: string): boolean {
  return TECHNICAL_ASSISTANCE.test(objective);
}

/** Che fine fa il pianificato: le tre parti sommate danno sempre `planned`. */
export interface Leakage {
  planned: number;
  /** Speso per progetti, al netto della gestione. */
  projects: number;
  /** Speso per la gestione dei fondi (assistenza tecnica). */
  management: number;
  /** Non speso: definitivo solo a ciclo chiuso, altrimenti "non ancora". */
  unspent: number;
  /** Quanto del pianificato è riservato alla gestione, a prescindere da quanto è stato speso. */
  managementPlanned: number;
}

export function leakage(rows: readonly CubeRow[]): Leakage {
  let planned = 0;
  let spent = 0;
  let management = 0;
  let managementPlanned = 0;
  for (const row of rows) {
    planned += row[4];
    spent += row[6];
    if (isTechnicalAssistance(row[2])) {
      managementPlanned += row[4];
      management += row[6];
    }
  }
  return { planned, projects: spent - management, management, unspent: Math.max(planned - spent, 0), managementPlanned };
}

export interface CountryLeakage extends Leakage {
  code: string;
  name: string;
  /** Quota del pianificato riservata alla gestione. */
  managementShare: number;
  unspentShare: number;
}

/** Una riga per ogni Stato membro con risorse pianificate. */
export function countryLeakage(rows: readonly CubeRow[]): CountryLeakage[] {
  return COUNTRIES.map((country) => {
    const own = leakage(rows.filter((row) => row[0] === country.code));
    return {
      ...own,
      code: country.code,
      name: country.name,
      managementShare: ratio(own.managementPlanned, own.planned),
      unspentShare: ratio(own.unspent, own.planned),
    };
  }).filter((c) => c.planned > 0);
}

/** Le tre parti riportate a 100 euro pianificati. */
export function perHundred(value: Leakage): { projects: number; management: number; unspent: number } {
  const scale = (part: number): number => ratio(part, value.planned) * 100;
  return { projects: scale(value.projects), management: scale(value.management), unspent: scale(value.unspent) };
}
