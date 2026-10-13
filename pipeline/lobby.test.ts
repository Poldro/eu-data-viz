import { describe, expect, it } from 'vitest';
import { ACTS } from '../src/lib/acts';
import { entityKey } from '../src/lib/lobby';
import { aggregateLobby, parseRecord, registerMeta, splitRecords, type LobbyOptions, type RegisterOrg } from './lobby';

const range = (min?: number, max?: number) => `<range>${min === undefined ? '' : `<min>${min}</min>`}${max === undefined ? '' : `<max>${max}</max>`}</range>`;

/** Una scheda del Registro nella forma dell'estrazione ufficiale. */
function record(over: { id?: string; name?: string; category?: string; country?: string; represents?: string; dossiers?: string; fte?: string; year?: string } = {}): string {
  return `<interestRepresentative>
    <identificationCode>${over.id ?? '123456789-01'}</identificationCode>
    <name><originalName>${over.name ?? 'ACME  S.p.A.'}</originalName></name>
    <registrationCategory>${over.category ?? 'Companies &amp; groups'}</registrationCategory>
    <headOffice><address>Via Roma 1</address><country>${over.country ?? 'ITALY'}</country></headOffice>
    <EULegislativeProposals>${over.dossiers ?? 'AI Act'}</EULegislativeProposals>
    <members><members>3.0</members><membersFTE>${over.fte ?? '2.5'}</membersFTE></members>
    <EPAccreditedNumber>4</EPAccreditedNumber>
    <interestRepresented>${over.represents ?? 'Promotes their own interests or the collective interests of their members'}</interestRepresented>
    <financialData>
      <newOrganisation>false</newOrganisation>
      ${over.year ?? `<closedYear type="ClosedYearIntermediaryFinancialInformation"><costs type="CostRange" currency="€">${range(100000, 199999)}</costs><grants/></closedYear>`}
    </financialData>
  </interestRepresentative>`;
}

async function* chunked(text: string, size: number): AsyncGenerator<string> {
  for (let i = 0; i < text.length; i += size) yield text.slice(i, i + size);
}

async function collect(text: string, size: number): Promise<string[]> {
  const out: string[] = [];
  for await (const item of splitRecords(chunked(text, size))) out.push(item);
  return out;
}

describe('lettura dell’estrazione del Registro', () => {
  const file = `<?xml version='1.1'?><ListOfIRPublicDetail><metaData><exportDate>2026-10-13T20:00:00.070+00:00</exportDate><numberOfIR>2</numberOfIR></metaData><resultList>${record({ id: 'A' })}\n${record({ id: 'B' })}</resultList></ListOfIRPublicDetail>`;

  it('legge data e numero di iscritti dall’intestazione', () => {
    expect(registerMeta(file.slice(0, 300))).toEqual({ exportDate: '2026-10-13', declared: 2 });
    expect(() => registerMeta('<ListOfIRPublicDetail>')).toThrow('intestazione');
  });

  it('restituisce le stesse schede comunque sia spezzato il file', async () => {
    const whole = await collect(file, file.length);
    expect(whole).toHaveLength(2);
    for (const size of [1, 7, 23, 500]) expect(await collect(file, size)).toEqual(whole);
    expect(whole.map((xml) => parseRecord(xml).id)).toEqual(['A', 'B']);
  });

  it('scarta una scheda rimasta a metà', async () => {
    expect(await collect(file.slice(0, file.lastIndexOf('<financialData>')), 50)).toHaveLength(1);
  });
});

describe('scheda di un iscritto', () => {
  it('normalizza nome, paese e fascia di costo di chi rappresenta interessi propri', () => {
    expect(parseRecord(record())).toEqual({
      id: '123456789-01',
      name: 'ACME S.p.A.',
      country: 'IT',
      category: 'Companies & groups',
      kind: 'own',
      range: { min: 100000, max: 199999 },
      doubtful: false,
      fte: 2.5,
      passes: 4,
      grants: 0,
      dossiers: 'AI Act',
    });
  });

  it('lascia ai paesi terzi il nome inglese, con le sole iniziali maiuscole', () => {
    expect(parseRecord(record({ country: 'UNITED STATES' })).country).toBe('United States');
    expect(parseRecord(record({ country: '' })).country).toBe('N/D');
  });

  it('non trasforma in numero un nome o un codice fatti di cifre', () => {
    const org = parseRecord(record({ id: '0042', name: '2050' }));
    expect(org.id).toBe('0042');
    expect(org.name).toBe('2050');
  });

  it('per i consulenti usa i ricavi e i dossier dichiarati cliente per cliente', () => {
    const org = parseRecord(
      record({
        represents: 'Advances interests of their clients',
        dossiers: 'Varie',
        year: `<closedYear><clients><client><name>Cliente</name><revenue>${range(10000, 24999)}</revenue><proposal>Digital Markets Act</proposal></client></clients><totalAnnualRevenue>${range(1000000)}</totalAnnualRevenue><grants/></closedYear>`,
      }),
    );
    expect(org.kind).toBe('clients');
    expect(org.range).toEqual({ min: 1000000, max: null });
    expect(org.dossiers).toContain('Digital Markets Act');
  });

  it('non attribuisce una spesa a chi dichiara solo il bilancio complessivo', () => {
    const org = parseRecord(
      record({ represents: 'Does not represent commercial interests', year: '<closedYear><totalBudget><absoluteCost>5000000</absoluteCost></totalBudget><grants/></closedYear>' }),
    );
    expect(org.kind).toBe('budget');
    expect(org.range).toBeNull();
  });

  it('accetta un iscritto nuovo, senza esercizio chiuso, e una fascia senza minimo', () => {
    expect(parseRecord(record({ year: '<currentYear><grants/></currentYear>' })).range).toBeNull();
    expect(parseRecord(record({ year: `<closedYear><costs>${range(undefined, 9999)}</costs></closedYear>` })).range).toEqual({ min: 0, max: 9999 });
  });

  it('somma le sovvenzioni, azzera quelle negative e scarta i totali impossibili', () => {
    const grants = (...amounts: number[]) =>
      `<closedYear><costs>${range(10000, 24999)}</costs><grants>${amounts.map((a) => `<grant><source>Horizon</source><amount><absoluteCost>${a}</absoluteCost></amount></grant>`).join('')}</grants></closedYear>`;
    expect(parseRecord(record({ year: grants(1000, 250.4, -300) })).grants).toBe(1250);
    expect(parseRecord(record({ year: grants(547_284_330_800) })).grants).toBe(0);
  });

  it('segnala chi dichiara milioni con una frazione di addetto', () => {
    expect(parseRecord(record({ fte: '0.2', year: `<closedYear><costs>${range(3500000, 3999999)}</costs></closedYear>` })).doubtful).toBe(true);
  });

  it('rifiuta una scheda senza numero di iscrizione', () => {
    expect(() => parseRecord('<interestRepresentative><name><originalName>X</originalName></name></interestRepresentative>')).toThrow('scheda non valida');
  });
});

describe('aggregati del Registro', () => {
  const org = (over: Partial<RegisterOrg>): RegisterOrg => ({
    id: 'x',
    name: 'X',
    country: 'IT',
    category: 'Companies & groups',
    kind: 'own',
    range: { min: 100_000, max: 199_999 },
    doubtful: false,
    fte: 2,
    passes: 1,
    grants: 0,
    dossiers: '',
    ...over,
  });
  const options: LobbyOptions = { topPerKind: 10, topPerCountry: 10, topPerAct: 2, keep: new Set() };
  const register = [
    org({ id: 'big', name: 'Big', range: { min: 1_000_000, max: 1_249_999 }, dossiers: 'AI Act, DSA', country: 'DE' }),
    org({ id: 'small', name: 'Small', dossiers: 'AI Act', grants: 500 }),
    org({ id: 'open', name: 'Open', range: { min: 10_000_000, max: null }, dossiers: 'AI Act', fte: 20, country: 'United States' }),
    org({ id: 'odd', name: 'Odd', range: { min: 9_000_000, max: 9_999_999 }, doubtful: true, dossiers: 'AI Act' }),
    org({ id: 'agency', name: 'Agency', kind: 'clients', category: 'Professional consultancies', range: { min: 1_000_000, max: null }, dossiers: 'DSA', country: 'BE' }),
    org({ id: 'ngo', name: 'Ngo', kind: 'budget', category: 'Non-governmental organisations, platforms and networks and similar', range: null, dossiers: 'Nature Restoration' }),
    org({ id: 'person', name: 'Mario Rossi', category: 'Self-employed individuals', range: { min: 25_000, max: 49_999 }, dossiers: 'AI Act' }),
  ];
  const data = aggregateLobby(register, ACTS, '2026-10-13', options);

  it('somma solo i costi di chi rappresenta interessi propri, e le fasce aperte al loro minimo', () => {
    expect(data.organisations).toBe(7);
    expect(data.withCosts).toBe(5);
    expect(data.min).toBe(1_000_000 + 100_000 + 10_000_000 + 9_000_000 + 25_000);
    expect(data.max).toBe(1_249_999 + 199_999 + 10_000_000 + 9_999_999 + 49_999);
    expect(data.fte).toBe(32);
    expect(data.passes).toBe(7);
    expect(data.grantees).toBe(1);
    expect(data.doubtful).toBe(1);
    expect(data.matched).toBe(7);
  });

  it('raggruppa per categoria e paese, in ordine di spesa', () => {
    expect(data.byCategory[0]).toEqual({ key: 'Companies & groups', organisations: 4, min: 20_100_000, max: 21_449_997 });
    expect(data.byCategory.find((b) => b.key === 'Professional consultancies')).toEqual({ key: 'Professional consultancies', organisations: 1, min: 0, max: 0 });
    expect(data.byCountry.map((b) => b.key)).toEqual(['United States', 'IT', 'DE', 'BE']);
  });

  it('conta per ogni atto chi lo nomina e riporta i primi per spesa, senza anomalie né persone', () => {
    const ai = data.acts.find((a) => a.id === 'ai-act');
    expect(data.acts[0].id).toBe('ai-act');
    expect(ai?.organisations).toBe(5);
    expect(ai?.top.map((o) => o.id)).toEqual(['open', 'big']);
    expect(ai?.byCategory).toEqual([
      { key: 'Companies & groups', organisations: 4 },
      { key: 'Self-employed individuals', organisations: 1 },
    ]);
    const dsa = data.acts.find((a) => a.id === 'dsa');
    expect(dsa?.organisations).toBe(2);
    // I ricavi del consulente non entrano nella somma: sarebbero contati due volte.
    expect(dsa?.min).toBe(1_000_000);
    expect(data.acts.find((a) => a.id === 'mica')?.organisations).toBe(0);
    expect(data.acts).toHaveLength(ACTS.length);
  });

  it('elenca gli iscritti per nome ma mai le persone fisiche', () => {
    expect(data.top.map((o) => o.id)).toEqual(['open', 'odd', 'agency', 'big', 'small', 'ngo']);
    expect(data.top.find((o) => o.id === 'big')?.acts).toEqual(['ai-act', 'dsa']);
    expect(data.top.every((o) => !('dossiers' in o))).toBe(true);
  });

  it('rispetta i tetti dell’elenco e tiene comunque chi serve al confronto con altri archivi', () => {
    const tight = { ...options, topPerKind: 1, topPerCountry: 0 };
    expect(aggregateLobby(register, ACTS, '2026-10-13', tight).top.map((o) => o.id)).toEqual(['open', 'agency', 'ngo']);
    const kept = aggregateLobby(register, ACTS, '2026-10-13', { ...tight, keep: new Set([entityKey('SMALL', 'IT'), entityKey('Mario Rossi', 'IT')]) });
    expect(kept.top.map((o) => o.id)).toEqual(['open', 'agency', 'small', 'ngo']);
    expect(aggregateLobby(register, ACTS, '2026-10-13', { ...tight, topPerCountry: 1 }).top.map((o) => o.id)).toEqual(['open', 'odd', 'agency', 'big', 'ngo']);
  });
});
