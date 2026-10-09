import { describe, expect, it } from 'vitest';
import { buildCube1420, buildCube2127, cleanCategoryLabel, cubePlannedTotal, Raw1420, Raw2127 } from './cohesion';
import { aggregateFts, cleanProgramme, FtsRow } from './fts';
import { buildHistoric, RawRegional, RawYearly } from './historic';
import { normalizeRegion, populationFor } from './regions';

const row2127 = (over: Record<string, string>) =>
  Raw2127.parse({
    ms: 'IT',
    fund: 'ERDF',
    fund_family: 'Cohesion',
    pol_obj_short_name: 'PO2 Greener Europe',
    category_code: '045',
    category_short_title: '045 Energy efficiency',
    planned: '100',
    decided: '60',
    spent: '20',
    climate: '100',
    ...over,
  });

describe('cubo 2021-2027', () => {
  it('converte le stringhe di Socrata in numeri e azzera i campi mancanti', () => {
    const parsed = Raw2127.parse({ ms: 'IT', fund: 'ERDF', planned: '12.5' });
    expect(parsed.planned).toBe(12.5);
    expect(parsed.spent).toBe(0);
  });

  it('unifica i codici paese e somma le righe che collassano', () => {
    const cube = buildCube2127([row2127({ ms: 'CH' }), row2127({ ms: 'NO' }), row2127({ ms: 'GR' })], '2026-08');
    expect(cube.rows).toContainEqual(['OT', 'ERDF', 'PO2 Greener Europe', 'IF045', 200, 120, 40, 200]);
    expect(cube.rows).toContainEqual(['EL', 'ERDF', 'PO2 Greener Europe', 'IF045', 100, 60, 20, 100]);
    expect(cubePlannedTotal(cube)).toBe(300);
  });

  it('tiene distinti i codici riusati dai fondi fuori dalla coesione', () => {
    const cube = buildCube2127(
      [
        row2127({ fund: 'AMIF', fund_family: 'HOME', category_code: '001', category_short_title: 'SO1.001 Reception conditions' }),
        row2127({ fund: 'BMVI', fund_family: 'HOME', category_code: '001', category_short_title: 'SO1.001 ICT systems' }),
      ],
      '2026-08',
    );
    expect(Object.values(cube.categories).sort()).toEqual(['ICT systems', 'Reception conditions']);
  });

  it('scarta le righe senza importi', () => {
    const cube = buildCube2127([row2127({ planned: '0', decided: '0', spent: '0' })], '2026-08');
    expect(cube.rows).toHaveLength(0);
  });

  it('ripulisce le etichette dai codici', () => {
    expect(cleanCategoryLabel('021 SME business development')).toBe('SME business development');
    expect(cleanCategoryLabel('SO2.008 Equipment')).toBe('Equipment');
    expect(cleanCategoryLabel('TOI 11 Data collection')).toBe('Data collection');
  });
});

describe('cubo 2014-2020', () => {
  const raw = (over: Record<string, string>) =>
    Raw1420.parse({ ms: 'IT', fund: 'ESF', to: '8', to_short: 'Employment', eu_amount: '50', total_amount: '100', ...over });

  it('stima la quota UE con il tasso di cofinanziamento', () => {
    const cube = buildCube1420([raw({ total_eligible_cost: '80', total_eligible_expenditure: '40' })], '2023');
    expect(cube.rows[0]).toEqual(['IT', 'ESF', 'TO8', '', 50, 40, 20, 0]);
  });

  it('non lascia superare il pianificato in caso di overbooking', () => {
    const cube = buildCube1420([raw({ total_eligible_cost: '150', total_eligible_expenditure: '130' })], '2023');
    expect(cube.rows[0].slice(4, 7)).toEqual([50, 50, 50]);
  });

  it('non divide per zero', () => {
    const cube = buildCube1420([raw({ total_amount: '0', total_eligible_expenditure: '10' })], '2023');
    expect(cube.rows[0][6]).toBe(0);
  });
});

describe('storico dei pagamenti', () => {
  const yearly = [
    { country: 'IT', fund: 'ERDF', year: '2000', paid: '10' },
    { country: 'IT', fund: 'ERDF', year: '2002', paid: '30' },
    { country: 'GR', fund: 'ESF', year: '2001', paid: '5' },
    { country: 'UK', fund: 'ESF', year: '1990', paid: '99' },
  ].map((r) => RawYearly.parse(r));
  const regional = [
    { country: 'IT', nuts2_id: 'ITF3', nuts2_name: 'Campania', programming_period: '2000-2006', paid: '7' },
    { country: 'IT', nuts2_id: 'ITF3', nuts2_name: 'Campania', programming_period: '2007-2013', paid: '5' },
    { country: 'IT', nuts2_id: 'ITC1', nuts2_name: 'Piemonte', programming_period: '2000-2006', paid: '3' },
    { country: 'IT', nuts2_id: 'ITZZ', nuts2_name: 'Extra', programming_period: '2000-2006', paid: '0' },
  ].map((r) => RawRegional.parse(r));

  it('allinea le serie sugli anni dei soli Stati membri', () => {
    const h = buildHistoric(yearly, regional);
    expect([h.firstYear, h.lastYear]).toEqual([2000, 2002]);
    expect(h.byCountry.IT.ERDF).toEqual([10, 0, 30]);
    expect(h.byCountry.EL.ESF).toEqual([0, 5, 0]);
    expect(h.byCountry.UK).toBeUndefined();
  });

  it('ordina le regioni per totale e somma i periodi', () => {
    const h = buildHistoric(yearly, regional);
    expect(h.regions.IT.map((r) => r.id)).toEqual(['ITF3', 'ITC1']);
    expect(h.regions.IT[0]).toMatchObject({ total: 12, byPeriod: { '2000-2006': 7, '2007-2013': 5 }, population: null });
  });

  it('fallisce se non arrivano dati', () => {
    expect(() => buildHistoric([], [])).toThrow();
  });

  it('riporta i codici recenti alla regione 2010 e somma gli importi', () => {
    const rows = [
      { country: 'HR', nuts2_id: 'HR05', nuts2_name: 'Grad Zagreb', programming_period: '2014-2020', paid: '4' },
      { country: 'HR', nuts2_id: 'HR06', nuts2_name: 'Sjeverna', programming_period: '2014-2020', paid: '6' },
      { country: 'GR', nuts2_id: 'GR51', nuts2_name: 'Thraki', programming_period: '2014-2020', paid: '2' },
    ].map((r) => RawRegional.parse(r));
    const context = {
      names: new Map([['HR04', 'Kontinentalna Hrvatska']]),
      population: new Map([['HR02', 1], ['HR05', 2], ['HR06', 3], ['EL51', 10]]),
    };
    const h = buildHistoric(yearly, rows, context);
    expect(h.regions.HR).toEqual([
      { id: 'HR04', name: 'Kontinentalna Hrvatska', total: 10, byPeriod: { '2014-2020': 10 }, population: 6 },
    ]);
    expect(h.regions.EL[0]).toMatchObject({ id: 'EL11', name: 'Thraki', population: 10 });
  });
});

describe('beneficiari FTS', () => {
  const AMOUNT = 'Beneficiary’s estimated contracted amount (EUR)';
  const row = (name: string, country: string, value: number, extra: Record<string, unknown> = {}) =>
    FtsRow.parse({
      'Name of beneficiary': name,
      'Beneficiary country': country,
      [AMOUNT]: value,
      'Programme name': '1.0.11 - Horizon Europe',
      'Beneficiary type': 'Private Companies',
      ...extra,
    });
  const options = { topGlobal: 2, topPerCountry: 1 };

  it('somma gli impegni dello stesso beneficiario e sceglie il programma prevalente', () => {
    const summary = aggregateFts(
      [
        row('ACME', 'Italy', 10, { 'VAT number of beneficiary': 'IT1' }),
        row('Acme  S.p.A.', 'Italy', 30, { 'VAT number of beneficiary': 'IT1', 'Programme name': '2.2.32 - Erasmus+' }),
      ],
      2025,
      options,
    );
    expect(summary.top).toEqual([
      { name: 'ACME', country: 'IT', type: 'Private Companies', programme: 'Erasmus+', amount: 40, commitments: 2 },
    ]);
    expect(summary).toMatchObject({ total: 40, commitments: 2, beneficiaries: 1 });
  });

  it('non elenca mai le persone fisiche ma le conta nei totali', () => {
    const summary = aggregateFts([row('Mario Rossi', 'Italy', 50, { 'Beneficiary type': 'Private Persons' })], 2025, options);
    expect(summary.top).toHaveLength(0);
    expect(summary.total).toBe(50);
    expect(summary.byType[0]).toMatchObject({ key: 'Private Persons', amount: 50 });
  });

  it('garantisce una quota per Stato membro oltre i primi globali', () => {
    const summary = aggregateFts(
      [row('A', 'Belgium', 100), row('B', 'Belgium', 90), row('C', 'Belgium', 80), row('D', 'Italy', 1), row('E', 'Kenya', 2)],
      2025,
      options,
    );
    expect(summary.top.map((b) => b.name)).toEqual(['A', 'B', 'D']);
    expect(summary.byCountry.map((b) => b.key)).toEqual(['BE', 'Kenya', 'IT']);
  });

  it('tollera importi mancanti o non divulgati e paesi mancanti', () => {
    const summary = aggregateFts(
      [row('X', 'Italy', 5, { [AMOUNT]: null, 'Beneficiary country': null }), row('Y', 'Italy', 5, { [AMOUNT]: 'Undisclosed' })],
      2025,
      options,
    );
    expect(summary.total).toBe(0);
    expect(summary.byCountry[0].key).toBe('N/D');
  });

  it('ripulisce i nomi dei programmi', () => {
    expect(cleanProgramme('1.0.11 - Horizon Europe')).toBe('Horizon Europe');
    expect(cleanProgramme('O.0.4 - Ukraine Facility')).toBe('Ukraine Facility');
    expect(cleanProgramme('DA/JU/EUI - Decentralised Agencies')).toBe('DA/JU/EUI - Decentralised Agencies');
    expect(cleanProgramme('')).toBe('N/D');
  });
});

describe('regioni', () => {
  const population = new Map([['ITC1', 4_000_000], ['PL91', 3], ['PL92', 2]]);

  it('lascia invariati i codici già nella versione 2010', () => {
    expect(normalizeRegion(' itc1 ')).toBe('ITC1');
    expect(normalizeRegion('SI04')).toBe('SI02');
  });

  it('somma la popolazione delle regioni nate da una suddivisione', () => {
    expect(populationFor('ITC1', population)).toBe(4_000_000);
    expect(populationFor('PL12', population)).toBe(5);
  });

  it('restituisce null quando manca anche una sola parte', () => {
    expect(populationFor('HU10', population)).toBeNull();
    expect(populationFor('IE01', population)).toBeNull();
  });
});
