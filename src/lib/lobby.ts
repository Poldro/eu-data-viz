import { eur, int } from './format';
import type { FtsBeneficiary } from './fts';

/**
 * Che cosa dichiara un iscritto, secondo chi rappresenta:
 * `own` i costi dell'attività di lobbying, `clients` i ricavi dai clienti, `budget` il bilancio complessivo.
 */
export type LobbyKind = 'own' | 'clients' | 'budget';

/** Fascia dichiarata in euro. `max` nullo indica una fascia aperta verso l'alto. */
export interface LobbyRange {
  min: number;
  max: number | null;
}

export interface LobbyOrg {
  /** Numero di iscrizione al Registro per la trasparenza. */
  id: string;
  name: string;
  /** Codice dello Stato membro della sede, oppure il nome inglese del paese terzo. */
  country: string;
  category: string;
  kind: LobbyKind;
  /** Costi (`own`) o ricavi dai clienti (`clients`) dell'ultimo esercizio chiuso; nullo se non dichiarati. */
  range: LobbyRange | null;
  /** Vero se i costi dichiarati sono sproporzionati rispetto agli addetti: vedi `isDoubtful`. */
  doubtful: boolean;
  /** Addetti al lobbying in equivalenti a tempo pieno. */
  fte: number;
  /** Persone con accesso accreditato al Parlamento europeo. */
  passes: number;
  /** Sovvenzioni dell'Unione dichiarate per l'ultimo esercizio chiuso, in euro; zero se assenti o implausibili. */
  grants: number;
  /** Atti dell'elenco in `acts.ts` nominati tra i dossier seguiti. */
  acts: string[];
}

export interface LobbyBucket {
  key: string;
  organisations: number;
  /** Somma delle fasce di costo dichiarate da chi rappresenta interessi propri. */
  min: number;
  max: number;
}

export interface LobbyActSummary {
  id: string;
  organisations: number;
  min: number;
  max: number;
  byCategory: { key: string; organisations: number }[];
  /** Gli iscritti con la fascia di costo più alta tra quelli che nominano l'atto. */
  top: Pick<LobbyOrg, 'id' | 'name' | 'country' | 'category' | 'range'>[];
}

export interface LobbySummary {
  /** Data dell'estrazione dichiarata dal Registro (ISO 8601). */
  exportDate: string;
  organisations: number;
  /** Iscritti che dichiarano una fascia di costo. */
  withCosts: number;
  min: number;
  max: number;
  fte: number;
  passes: number;
  /** Iscritti con costi dichiarati fuori scala rispetto agli addetti, esclusi dalle classifiche. */
  doubtful: number;
  /** Iscritti che dichiarano sovvenzioni dell'Unione. */
  grantees: number;
  /** Iscritti che nominano almeno uno degli atti in elenco. */
  matched: number;
  byCategory: LobbyBucket[];
  byCountry: LobbyBucket[];
  acts: LobbyActSummary[];
  top: LobbyOrg[];
}

/** Le persone fisiche restano nei totali ma non vengono mai elencate per nome. */
export const INDIVIDUALS = 'Self-employed individuals';

const CATEGORIES: Readonly<Record<string, string>> = {
  'Companies & groups': 'Imprese e gruppi',
  'Trade and business associations': 'Associazioni di imprese',
  'Trade unions and professional associations': 'Sindacati e ordini professionali',
  'Non-governmental organisations, platforms and networks and similar': 'ONG e reti',
  'Professional consultancies': 'Società di consulenza',
  'Law firms': 'Studi legali',
  [INDIVIDUALS]: 'Consulenti individuali',
  'Think tanks and research institutions': 'Centri studi e istituti di ricerca',
  'Academic institutions': 'Università',
  'Other organisations, public or mixed entities': 'Enti pubblici o misti',
  'Associations and networks of public authorities': 'Reti di enti pubblici',
  'Organisations representing churches and religious communities': 'Chiese e comunità religiose',
  'Entities, offices or networks established by third countries': 'Uffici di paesi terzi',
};

export function lobbyCategoryLabel(category: string): string {
  return CATEGORIES[category] ?? category;
}

/** Quattro famiglie per i confronti a colpo d'occhio: tredici categorie non stanno in una barra. */
export type LobbyGroup = 'business' | 'advisers' | 'civil' | 'other';

export const LOBBY_GROUPS: readonly { key: LobbyGroup; label: string }[] = [
  { key: 'business', label: 'Imprese e loro associazioni' },
  { key: 'advisers', label: 'Consulenti e studi legali' },
  { key: 'civil', label: 'ONG e sindacati' },
  { key: 'other', label: 'Ricerca ed enti pubblici' },
];

const GROUPS: Readonly<Record<string, LobbyGroup>> = {
  'Companies & groups': 'business',
  'Trade and business associations': 'business',
  'Professional consultancies': 'advisers',
  'Law firms': 'advisers',
  [INDIVIDUALS]: 'advisers',
  'Non-governmental organisations, platforms and networks and similar': 'civil',
  'Trade unions and professional associations': 'civil',
};

export function lobbyGroup(category: string): LobbyGroup {
  return GROUPS[category] ?? 'other';
}

/** Oltre questa spesa per addetto la cifra è quasi sempre il bilancio dell'intera organizzazione, non il costo del lobbying. */
export const MAX_COST_PER_FTE = 1_500_000;
/** Sotto un quarto di addetto il rapporto esploderebbe anche per cifre modeste. */
const MIN_FTE = 0.25;

export function isDoubtful(range: LobbyRange | null, fte: number): boolean {
  return range !== null && range.min / Math.max(fte, MIN_FTE) > MAX_COST_PER_FTE;
}

/** La fascia come la dichiara il Registro: mai un numero puntuale. */
export function rangeLabel(range: LobbyRange | null): string {
  if (!range) return 'non dichiarato';
  if (range.max === null) return `oltre ${int(range.min)} €`;
  if (range.min === 0) return `fino a ${int(range.max)} €`;
  return `${int(range.min)} – ${int(range.max)} €`;
}

/** L'estremo inferiore della fascia in forma breve, per le righe strette: "almeno 9,0 mln €". */
export function atLeast(range: LobbyRange): string {
  return range.min === 0 ? rangeLabel(range) : `almeno ${eur(range.min)}`;
}

/** Chiave per riconoscere lo stesso soggetto in due archivi: senza accenti, punteggiatura né maiuscole. */
export function entityKey(name: string, country: string): string {
  const folded = name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();
  return `${folded}|${country}`;
}

/**
 * Gli impegni registrati nel Financial Transparency System per gli iscritti dati, per numero di iscrizione.
 * L'abbinamento è per nome identico e stesso paese: prudente, perde le varianti di scrittura.
 */
export function matchBeneficiaries(orgs: readonly LobbyOrg[], beneficiaries: readonly FtsBeneficiary[]): Map<string, number> {
  const amounts = new Map<string, number>();
  for (const b of beneficiaries) {
    const key = entityKey(b.name, b.country);
    amounts.set(key, (amounts.get(key) ?? 0) + b.amount);
  }
  const found = new Map<string, number>();
  for (const org of orgs) {
    const amount = amounts.get(entityKey(org.name, org.country));
    if (amount !== undefined) found.set(org.id, amount);
  }
  return found;
}
