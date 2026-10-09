import type { Source } from './meta';

/**
 * Livello di errore stimato dalla Corte dei conti europea nelle relazioni annuali: la quota di
 * spesa che, a giudizio dei revisori, non rispettava le regole. Non misura frodi né sprechi.
 * Sono cifre pubblicate una volta l'anno in PDF: vanno aggiornate a mano a ogni nuova relazione.
 */
export interface AuditYear {
  year: number;
  /** Intero bilancio dell'Unione, in percentuale. */
  overall: number;
  /** Rubrica "Coesione", in percentuale; null dove non verificato alla fonte. */
  cohesion: number | null;
}

export const AUDIT_YEARS: readonly AuditYear[] = [
  { year: 2019, overall: 2.7, cohesion: null },
  { year: 2020, overall: 2.7, cohesion: null },
  { year: 2021, overall: 3.0, cohesion: 3.6 },
  { year: 2022, overall: 4.2, cohesion: 6.4 },
  { year: 2023, overall: 5.6, cohesion: 9.3 },
  { year: 2024, overall: 3.6, cohesion: 5.7 },
];

/** Sopra questa soglia la Corte considera l'errore "rilevante". */
export const MATERIALITY = 2;

export const AUDIT_SOURCE: Source = {
  id: 'eca',
  name: 'Corte dei conti europea — relazioni annuali',
  url: 'https://www.eca.europa.eu/en/annual-reports',
  asOf: String(AUDIT_YEARS[AUDIT_YEARS.length - 1].year),
};

export function latestAudit(): AuditYear {
  return AUDIT_YEARS[AUDIT_YEARS.length - 1];
}
