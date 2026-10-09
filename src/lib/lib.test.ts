import { describe, expect, it } from 'vitest';
import cube2127 from '../data/cube-2127.json';
import { categoryLabel } from './labels';
import { translateCategory } from './labels-categories';
import type { Cube } from './cube';
import { areaName, countryByEnglishName, COUNTRIES, normalizeArea, TILE_COLS, TILE_ROWS } from './countries';
import { toCsv } from './csv';
import { buildFlows, countryStats, filterRows, groupBy, OTHER_AREA, rankOf, ratio, totals, type CubeRow } from './cube';
import { eur, lowerFirst, monthIt, ordinal, pct, perHead } from './format';
import { matchesQuery, searchKey } from './search';
import { countrySeries, programmingPeriods, regionValues, type Historic } from './historic';

const rows: CubeRow[] = [
  ['IT', 'ERDF', 'green', 'c1', 100, 60, 20, 50],
  ['IT', 'ESF+', 'social', 'c2', 50, 50, 25, 0],
  ['PL', 'ERDF', 'green', 'c1', 300, 200, 150, 100],
  ['TC', 'ERDF', 'green', 'c3', 40, 10, 0, 0],
];

describe('formati', () => {
  it('scala gli importi e raggruppa sempre le migliaia', () => {
    expect(eur(44_600_000_000)).toBe('44,6 mld €');
    expect(eur(320_000_000)).toBe('320 mln €');
    expect(eur(12_400_000)).toBe('12,4 mln €');
    expect(eur(2867)).toBe('2.867 €');
    expect(perHead(2867.4)).toBe('2.867 €');
  });
  it('formatta quote, mesi e ordinali', () => {
    expect(pct(0.238)).toBe('24%');
    expect(pct(0.238, 1)).toBe('23,8%');
    expect(monthIt('2026-08')).toBe('agosto 2026');
    expect(monthIt('2023')).toBe('2023');
    expect(ordinal(3)).toBe('3º');
    expect(lowerFirst('Ambiente e clima')).toBe('ambiente e clima');
    expect(lowerFirst('FESR è primo')).toBe('FESR è primo');
  });
});

describe('paesi', () => {
  it('ha 27 Stati con tessere uniche dentro la griglia', () => {
    expect(COUNTRIES).toHaveLength(27);
    expect(new Set(COUNTRIES.map((c) => c.tile.join())).size).toBe(27);
    expect(COUNTRIES.every((c) => c.tile[0] < TILE_COLS && c.tile[1] < TILE_ROWS)).toBe(true);
  });
  it('normalizza codici e nomi delle fonti', () => {
    expect(normalizeArea('gr')).toBe('EL');
    expect(normalizeArea('NO')).toBe('OT');
    expect(normalizeArea('TC')).toBe('TC');
    expect(countryByEnglishName('Czech Republic')?.code).toBe('CZ');
    expect(countryByEnglishName('Kenya')).toBeUndefined();
    expect(areaName('TC')).toContain('Interreg');
  });
});

describe('cubo', () => {
  it('filtra e somma', () => {
    expect(totals(filterRows(rows, { area: 'IT' }))).toEqual({ planned: 150, decided: 110, spent: 45, climate: 50 });
    expect(filterRows(rows, { fund: 'ERDF', area: 'IT' })).toHaveLength(1);
    expect(filterRows(rows, {})).toHaveLength(4);
  });
  it('raggruppa in ordine decrescente', () => {
    expect(groupBy(rows, 'fund').map((g) => [g.key, g.planned])).toEqual([['ERDF', 440], ['ESF+', 50]]);
  });
  it('protegge i rapporti dallo zero', () => {
    expect(ratio(1, 0)).toBe(0);
  });
  it('calcola statistiche e classifiche per tutti i 27 paesi', () => {
    const stats = countryStats(rows);
    expect(stats).toHaveLength(27);
    const it = stats.find((s) => s.code === 'IT');
    expect(it?.perCapita).toBeCloseTo(150 / 59e6);
    expect(it?.absorption).toBeCloseTo(0.3);
    expect(rankOf(stats, 'PL', 'planned')).toBe(1);
    expect(rankOf(stats, 'IT', 'absorption')).toBe(2);
    expect(rankOf(stats, 'FR', 'planned')).toBe(0);
  });
  it('costruisce flussi che conservano il totale e accorpano il resto', () => {
    const flows = buildFlows(rows, 1);
    const into = (prefix: string) => flows.links.filter((l) => l.target.startsWith(prefix)).reduce((s, l) => s + l.value, 0);
    expect(into('o:')).toBe(490);
    expect(into('a:')).toBe(490);
    expect(flows.nodes.filter((n) => n.column === 2).map((n) => n.key).sort()).toEqual(['PL', OTHER_AREA].sort());
  });
});

describe('storico e csv', () => {
  it('riempie gli anni mancanti con zero', () => {
    const series = countrySeries({ firstYear: 2000, lastYear: 2001, funds: ['A', 'B'], byCountry: { IT: { A: [1, 2] } }, regions: {} }, 'IT');
    expect(series).toEqual([
      { year: 2000, values: { A: 1, B: 0 }, total: 1 },
      { year: 2001, values: { A: 2, B: 0 }, total: 2 },
    ]);
  });
  it('calcola importi e valori per abitante delle regioni per periodo', () => {
    const historic: Historic = {
      firstYear: 2000,
      lastYear: 2001,
      funds: [],
      byCountry: {},
      regions: {
        IT: [{ id: 'ITF3', name: 'Campania', total: 30, byPeriod: { '2007-2013': 10, '2014-2020': 20 }, population: 5 }],
        IE: [{ id: 'IE01', name: 'Border', total: 8, byPeriod: { '2014-2020': 8 }, population: null }],
      },
    };
    expect(programmingPeriods(historic)).toEqual(['2007-2013', '2014-2020']);
    const period = regionValues(historic, '2014-2020');
    expect(period.find((r) => r.id === 'ITF3')).toMatchObject({ country: 'IT', amount: 20, perCapita: 4 });
    expect(period.find((r) => r.id === 'IE01')).toMatchObject({ amount: 8, perCapita: null });
    expect(regionValues(historic, '')[0]).toMatchObject({ amount: 30, perCapita: 6 });
    expect(regionValues(historic, '2000-2006')[0].amount).toBe(0);
  });

  it('protegge separatori, virgolette e formule', () => {
    expect(toCsv({ columns: ['a', 'b'], rows: [['x;y', 2], ['say "hi"', -3], ['=SUM(A1)', 1]] })).toBe(
      'a;b\n"x;y";2\n"say ""hi""";-3\n\'=SUM(A1);1',
    );
  });
});

describe('voci di dettaglio in italiano', () => {
  const cube = cube2127 as unknown as Cube;

  it('traduce i campi d’intervento e le voci degli altri fondi', () => {
    expect(translateCategory('IF065', 'Waste water collection and treatment')).toBe('Fognature e depurazione');
    expect(translateCategory('AMIF:SO1.001 Reception conditions', 'Reception conditions')).toBe('Condizioni di accoglienza');
    expect(translateCategory('ISF:TA', 'TA.36(5).004 Capacity building')).toBe('Assistenza tecnica: rafforzamento delle capacità');
    expect(translateCategory('IF000', 'Unknown')).toBeUndefined();
  });

  it('ripiega sulla dicitura della fonte quando manca la traduzione', () => {
    const tiny: Cube = { period: '', asOf: '', objectives: {}, categories: { IF000: 'New field' }, rows: [] };
    expect(categoryLabel(tiny, 'IF000')).toBe('New field');
    expect(categoryLabel(tiny, 'missing')).toBe('missing');
  });

  // Se la Commissione aggiunge voci, questo test le elenca: vanno tradotte in labels-categories.ts.
  it('copre tutte le voci presenti nei dati', () => {
    const missing = Object.entries(cube.categories).filter(([key, label]) => translateCategory(key, label) === undefined);
    expect(missing).toEqual([]);
  });
});

describe('ricerca', () => {
  it('ignora maiuscole e accenti', () => {
    expect(searchKey(' Università ')).toBe('UNIVERSITA');
    expect(matchesQuery('UNIVERSITA DEGLI STUDI DI BOLOGNA', 'università')).toBe(true);
    expect(matchesQuery('Università di Pisa', 'UNIVERSITA')).toBe(true);
    expect(matchesQuery('Comune di Roma', 'università')).toBe(false);
  });

  it('non filtra con meno di due caratteri', () => {
    expect(matchesQuery('Comune di Roma', '')).toBe(true);
    expect(matchesQuery('Comune di Roma', 'x')).toBe(true);
  });
});
