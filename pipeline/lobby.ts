import { XMLParser } from 'fast-xml-parser';
import { z } from 'zod';
import { compileActs, matchActs, type Act } from '../src/lib/acts';
import { countryByEnglishName } from '../src/lib/countries';
import { entityKey, INDIVIDUALS, isDoubtful, type LobbyActSummary, type LobbyBucket, type LobbyKind, type LobbyOrg, type LobbyRange, type LobbySummary } from '../src/lib/lobby';

/** Una sovvenzione annua sopra il miliardo è un errore di battitura (centesimi al posto di euro): si scarta. */
const GRANT_CEILING = 1e9;
const OPEN = '<interestRepresentative>';
const CLOSE = '</interestRepresentative>';
const UNKNOWN = 'N/D';

/**
 * Spezza l'estrazione del Registro in schede, una per iscritto, man mano che il file arriva:
 * supera i cento megabyte e non va tenuto in memoria per intero.
 */
export async function* splitRecords(chunks: AsyncIterable<string>): AsyncGenerator<string> {
  let buffer = '';
  for await (const chunk of chunks) {
    buffer += chunk;
    for (;;) {
      const start = buffer.indexOf(OPEN);
      const end = start === -1 ? -1 : buffer.indexOf(CLOSE, start);
      if (end === -1) break;
      yield buffer.slice(start, end + CLOSE.length);
      buffer = buffer.slice(end + CLOSE.length);
    }
    // Senza una scheda aperta basta la coda: il prossimo pezzo potrebbe completare il tag d'apertura.
    if (!buffer.includes(OPEN)) buffer = buffer.slice(-OPEN.length);
  }
}

/** Data dell'estrazione e numero di iscritti dichiarati in testa al file. */
export function registerMeta(head: string): { exportDate: string; declared: number } {
  const exportDate = /<exportDate>(\d{4}-\d{2}-\d{2})/.exec(head)?.[1];
  const declared = /<numberOfIR>(\d+)<\/numberOfIR>/.exec(head)?.[1];
  if (!exportDate || !declared) throw new Error('Registro: intestazione senza data o numero di iscritti');
  return { exportDate, declared: Number(declared) };
}

// I tag vuoti (<grants/>) arrivano come stringa vuota: valgono quanto un oggetto senza campi.
const node = <T extends z.ZodRawShape>(shape: T) => z.preprocess((v) => (v !== null && typeof v === 'object' ? v : {}), z.object(shape));
const text = z.preprocess((v) => (v === undefined || v === null ? '' : String(v)), z.string());
// Gli importi sono autodichiarati: qualcuno registra una restituzione come sovvenzione negativa. Vale zero.
const amount = z.preprocess((v) => (v === undefined || v === '' ? null : Math.max(0, Number(v))), z.number().nullable());
const range = node({ range: node({ min: amount, max: amount }) });

const Client = node({ proposal: text });
const Grant = node({ amount: node({ absoluteCost: amount }) });

export const RegisterRecord = z.object({
  identificationCode: z.string().min(1),
  name: node({ originalName: text }),
  registrationCategory: text,
  headOffice: node({ country: text }),
  EULegislativeProposals: text,
  members: node({ membersFTE: amount }),
  EPAccreditedNumber: amount,
  interestRepresented: text,
  financialData: node({
    closedYear: node({
      costs: range,
      totalAnnualRevenue: range,
      clients: node({ client: z.array(Client).default([]) }),
      grants: node({ grant: z.array(Grant).default([]) }),
    }),
  }),
});
export type RegisterRecord = z.infer<typeof RegisterRecord>;

const parser = new XMLParser({
  ignoreAttributes: true,
  // I valori restano testo: un numero di iscrizione o un nome fatto di cifre non deve diventare un numero.
  parseTagValue: false,
  isArray: (name) => name === 'client' || name === 'grant',
});

const KINDS: Readonly<Record<string, LobbyKind>> = {
  'Advances interests of their clients': 'clients',
  'Does not represent commercial interests': 'budget',
};

/** "UNITED STATES" → "United States": i paesi terzi restano con il nome inglese della fonte. */
function countryKey(raw: string): string {
  const name = raw.trim();
  if (!name) return UNKNOWN;
  return countryByEnglishName(name)?.code ?? name.toLowerCase().replace(/(^|[\s-])\p{L}/gu, (letter) => letter.toUpperCase());
}

function toRange(raw: { min: number | null; max: number | null }): LobbyRange | null {
  if (raw.min === null && raw.max === null) return null;
  return { min: raw.min ?? 0, max: raw.max };
}

/** Un iscritto con il testo dei dossier che dichiara di seguire, ancora da confrontare con gli atti. */
export type RegisterOrg = Omit<LobbyOrg, 'acts'> & { dossiers: string };

export function parseRecord(xml: string): RegisterOrg {
  const raw: unknown = (parser.parse(xml) as { interestRepresentative?: unknown }).interestRepresentative;
  const parsed = RegisterRecord.safeParse(raw);
  if (!parsed.success) throw new Error(`Registro: scheda non valida (${parsed.error.message})`);
  const record = parsed.data;
  const year = record.financialData.closedYear;
  const kind = KINDS[record.interestRepresented.trim()] ?? 'own';
  // Chi non rappresenta interessi commerciali dichiara il bilancio complessivo, che non misura il lobbying.
  const range = kind === 'budget' ? null : toRange((kind === 'clients' ? year.totalAnnualRevenue : year.costs).range);
  const fte = Math.round((record.members.membersFTE ?? 0) * 10) / 10;
  const grants = Math.round(year.grants.grant.reduce((sum, grant) => sum + (grant.amount.absoluteCost ?? 0), 0));
  return {
    id: record.identificationCode,
    name: record.name.originalName.replace(/\s+/g, ' ').trim(),
    country: countryKey(record.headOffice.country),
    category: record.registrationCategory.trim() || UNKNOWN,
    kind,
    range,
    doubtful: kind === 'own' && isDoubtful(range, fte),
    fte,
    passes: record.EPAccreditedNumber ?? 0,
    grants: grants > GRANT_CEILING ? 0 : grants,
    // I consulenti dichiarano i dossier cliente per cliente: contano quanto quelli generali.
    dossiers: [record.EULegislativeProposals, ...year.clients.client.map((client) => client.proposal)].join('\n'),
  };
}

export interface LobbyOptions {
  /** Iscritti elencati per ciascun tipo di dichiarazione: costi, ricavi dai clienti, nessuna cifra. */
  topPerKind: number;
  /** Iscritti garantiti per ciascuno Stato membro, oltre ai primi in assoluto. */
  topPerCountry: number;
  /** Chiavi (`entityKey`) dei soggetti da elencare comunque, perché compaiono in un altro archivio del sito. */
  keep: ReadonlySet<string>;
  /** Iscritti riportati per ciascun atto. */
  topPerAct: number;
}

/** Estremo superiore di una fascia; quelle aperte valgono il loro minimo, per non inventare un tetto. */
const upper = (r: LobbyRange): number => r.max ?? r.min;
// A parità di fascia (i consulenti si fermano tutti a "oltre un milione") decide il numero di addetti.
const bySize = (a: LobbyOrg, b: LobbyOrg): number => (b.range?.min ?? 0) - (a.range?.min ?? 0) || b.fte - a.fte || a.name.localeCompare(b.name, 'en');

function bump(map: Map<string, LobbyBucket>, key: string, costs: LobbyRange | null): void {
  const prev = map.get(key) ?? { key, organisations: 0, min: 0, max: 0 };
  map.set(key, {
    key,
    organisations: prev.organisations + 1,
    min: prev.min + (costs?.min ?? 0),
    max: prev.max + (costs ? upper(costs) : 0),
  });
}

const sorted = (map: Map<string, LobbyBucket>): LobbyBucket[] => [...map.values()].sort((a, b) => b.min - a.min || b.organisations - a.organisations);

export function aggregateLobby(register: readonly RegisterOrg[], acts: readonly Act[], exportDate: string, options: LobbyOptions): LobbySummary {
  const matchers = compileActs(acts);
  const orgs: LobbyOrg[] = register.map(({ dossiers, ...org }) => ({ ...org, acts: matchActs(dossiers, matchers) }));
  // Solo i costi di chi rappresenta interessi propri si possono sommare: i ricavi dei consulenti
  // sono già nei costi dei loro clienti e i bilanci delle ONG non misurano il lobbying.
  const costs = (org: LobbyOrg): LobbyRange | null => (org.kind === 'own' ? org.range : null);
  const named = orgs.filter((org) => org.category !== INDIVIDUALS && org.name);

  const byCategory = new Map<string, LobbyBucket>();
  const byCountry = new Map<string, LobbyBucket>();
  for (const org of orgs) {
    bump(byCategory, org.category, costs(org));
    bump(byCountry, org.country, costs(org));
  }

  const actSummaries: LobbyActSummary[] = acts
    .map((act) => {
      const followers = orgs.filter((org) => org.acts.includes(act.id));
      const categories = new Map<string, LobbyBucket>();
      for (const org of followers) bump(categories, org.category, costs(org));
      const spenders = followers.filter((org) => org.kind === 'own' && org.range && !org.doubtful && org.category !== INDIVIDUALS && org.name).sort(bySize);
      return {
        id: act.id,
        organisations: followers.length,
        min: followers.reduce((sum, org) => sum + (costs(org)?.min ?? 0), 0),
        max: followers.reduce((sum, org) => sum + (costs(org) ? upper(costs(org)!) : 0), 0),
        byCategory: [...categories.values()].map((b) => ({ key: b.key, organisations: b.organisations })).sort((a, b) => b.organisations - a.organisations),
        top: spenders.slice(0, options.topPerAct).map(({ id, name, country, category, range }) => ({ id, name, country, category, range })),
      };
    })
    .sort((a, b) => b.organisations - a.organisations);

  const listed = new Map<string, LobbyOrg>();
  const keep = (list: readonly LobbyOrg[]): void => list.forEach((org) => listed.set(org.id, org));
  for (const kind of ['own', 'clients', 'budget'] as const) {
    keep(named.filter((org) => org.kind === kind).sort(bySize).slice(0, options.topPerKind));
  }
  const perCountry = new Map<string, number>();
  for (const org of named.filter((o) => o.kind === 'own' && o.range).sort(bySize)) {
    const seen = perCountry.get(org.country) ?? 0;
    if (org.country.length !== 2 || seen >= options.topPerCountry) continue;
    perCountry.set(org.country, seen + 1);
    listed.set(org.id, org);
  }
  keep(named.filter((org) => options.keep.has(entityKey(org.name, org.country))));

  const withCosts = orgs.filter((org) => costs(org));
  const grantees = orgs.filter((org) => org.grants > 0);
  return {
    exportDate,
    organisations: orgs.length,
    withCosts: withCosts.length,
    min: withCosts.reduce((sum, org) => sum + costs(org)!.min, 0),
    max: withCosts.reduce((sum, org) => sum + upper(costs(org)!), 0),
    fte: Math.round(orgs.reduce((sum, org) => sum + org.fte, 0)),
    passes: orgs.reduce((sum, org) => sum + org.passes, 0),
    doubtful: orgs.filter((org) => org.doubtful).length,
    grantees: grantees.length,
    matched: orgs.filter((org) => org.acts.length > 0).length,
    byCategory: sorted(byCategory),
    byCountry: sorted(byCountry),
    acts: actSummaries,
    top: [...listed.values()].sort(bySize),
  };
}
