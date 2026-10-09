import { describe, expect, it } from 'vitest';
import { areaName, countryByEnglishName, COUNTRIES, normalizeArea, TILE_COLS, TILE_ROWS } from './countries';
import { toCsv } from './csv';
import { buildFlows, countryStats, filterRows, groupBy, OTHER_AREA, rankOf, ratio, totals, type CubeRow } from './cube';
import { eur, lowerFirst, monthIt, ordinal, pct, perHead } from './format';
import { countrySeries } from './historic';

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
  it('protegge separatori, virgolette e formule', () => {
    expect(toCsv({ columns: ['a', 'b'], rows: [['x;y', 2], ['say "hi"', -3], ['=SUM(A1)', 1]] })).toBe(
      'a;b\n"x;y";2\n"say ""hi""";-3\n\'=SUM(A1);1',
    );
  });
});
