import { z } from 'zod';
import { countryByEnglishName } from '../src/lib/countries';
import type { FtsBeneficiary, FtsBucket, FtsSummary } from '../src/lib/fts';

/** Colonne del file XLSX usate dalla pipeline (le intestazioni usano l'apostrofo tipografico). */
export const FtsRow = z.object({
  'Name of beneficiary': z.coerce.string().default(''),
  'VAT number of beneficiary': z.coerce.string().nullish(),
  'Beneficiary country': z.coerce.string().nullish(),
  // Gli importi non divulgati (art. 38 del regolamento finanziario) arrivano come testo.
  'Beneficiary’s estimated contracted amount (EUR)': z.unknown().transform((v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)),
  'Programme name': z.coerce.string().nullish(),
  'Beneficiary type': z.coerce.string().nullish(),
});
export type FtsRow = z.infer<typeof FtsRow>;

export interface FtsOptions {
  topGlobal: number;
  /** Beneficiari garantiti per ciascuno Stato membro, oltre ai primi globali. */
  topPerCountry: number;
}

const UNKNOWN = 'N/D';
// Le persone fisiche restano nei totali ma non vengono mai elencate per nome.
const PRIVATE_PERSONS = 'Private Persons';

/** "1.0.11 - Horizon Europe" → "Horizon Europe"; "O.0.4 - Ukraine Facility" → "Ukraine Facility" */
export function cleanProgramme(name: string): string {
  return name.replace(/^[A-Z\d]+(\.\d+)+\s*-\s*/, '').replace(/\s+/g, ' ').trim() || UNKNOWN;
}

function countryKey(raw: string | null | undefined): string {
  if (!raw) return UNKNOWN;
  return countryByEnglishName(raw)?.code ?? raw.trim();
}

function bump(map: Map<string, FtsBucket>, key: string, value: number): void {
  const prev = map.get(key) ?? { key, amount: 0, commitments: 0 };
  map.set(key, { key, amount: prev.amount + value, commitments: prev.commitments + 1 });
}

function sorted(map: Map<string, FtsBucket>): FtsBucket[] {
  return [...map.values()]
    .map((b) => ({ ...b, amount: Math.round(b.amount) }))
    .sort((a, b) => b.amount - a.amount);
}

interface Accumulator {
  name: string;
  country: string;
  type: string;
  amount: number;
  commitments: number;
  programmes: Map<string, number>;
}

export function aggregateFts(rows: readonly FtsRow[], year: number, options: FtsOptions): FtsSummary {
  const byCountry = new Map<string, FtsBucket>();
  const byProgramme = new Map<string, FtsBucket>();
  const byType = new Map<string, FtsBucket>();
  const people = new Map<string, Accumulator>();
  let total = 0;

  for (const row of rows) {
    const value = row['Beneficiary’s estimated contracted amount (EUR)'];
    const country = countryKey(row['Beneficiary country']);
    const programme = cleanProgramme(row['Programme name'] ?? '');
    const type = row['Beneficiary type']?.trim() || UNKNOWN;
    const name = row['Name of beneficiary'].replace(/\s+/g, ' ').trim();

    total += value;
    bump(byCountry, country, value);
    bump(byProgramme, programme, value);
    bump(byType, type, value);

    if (!name || type === PRIVATE_PERSONS) continue;
    // La partita IVA distingue omonimi; in sua assenza si ripiega su nome + paese.
    const id = row['VAT number of beneficiary']?.trim() || `${name.toUpperCase()}|${country}`;
    const acc = people.get(id) ?? { name, country, type, amount: 0, commitments: 0, programmes: new Map() };
    acc.amount += value;
    acc.commitments += 1;
    acc.programmes.set(programme, (acc.programmes.get(programme) ?? 0) + value);
    people.set(id, acc);
  }

  const ranked = [...people.values()].sort((a, b) => b.amount - a.amount);
  const perCountry = new Map<string, number>();
  const top: FtsBeneficiary[] = [];
  ranked.forEach((acc, index) => {
    const seen = perCountry.get(acc.country) ?? 0;
    perCountry.set(acc.country, seen + 1);
    const isMember = acc.country.length === 2;
    if (index >= options.topGlobal && !(isMember && seen < options.topPerCountry)) return;
    const [programme] = [...acc.programmes].sort((a, b) => b[1] - a[1])[0] ?? [UNKNOWN];
    top.push({
      name: acc.name,
      country: acc.country,
      type: acc.type,
      programme,
      amount: Math.round(acc.amount),
      commitments: acc.commitments,
    });
  });

  return {
    year,
    total: Math.round(total),
    commitments: rows.length,
    beneficiaries: people.size,
    byCountry: sorted(byCountry),
    byProgramme: sorted(byProgramme),
    byType: sorted(byType),
    top,
  };
}
