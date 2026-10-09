import { describe, expect, it } from 'vitest';
import { rrfTotals } from '../src/lib/rrf';
import { JsonStat, parseJsonStat, type Observation } from './eurostat';
import { buildRrf } from './rrf';

describe('JSON-stat', () => {
  const doc = JsonStat.parse({
    id: ['geo', 'time'],
    size: [2, 3],
    value: { '0': 1, '2': 3, '4': null, '5': 6 },
    dimension: {
      geo: { category: { index: { IT: 0, FR: 1 } } },
      time: { category: { index: { '2021': 0, '2022': 1, '2023': 2 } } },
    },
  });

  it('ricostruisce le coordinate dall’indice piatto e salta i valori mancanti', () => {
    expect(parseJsonStat(doc)).toEqual([
      { geo: 'IT', time: '2021', value: 1 },
      { geo: 'IT', time: '2023', value: 3 },
      { geo: 'FR', time: '2023', value: 6 },
    ]);
  });

  it('rifiuta un documento incoerente', () => {
    expect(() => parseJsonStat({ ...doc, size: [2] })).toThrow();
  });
});

describe('PNRR', () => {
  const MEMBERS = ['IT', 'FR', 'DE', 'ES', 'PL', 'PT', 'EL', 'RO', 'NL', 'BE', 'AT', 'SE', 'DK', 'FI', 'IE', 'CZ', 'HU', 'SK', 'SI', 'HR'];
  const obs = (over: Record<string, string | number>): Observation => ({ geo: 'IT', time: '2021', unit: 'MIO_EUR', fin_typ: 'GRNT', value: 0, ...over }) as unknown as Observation;
  const received = (geo: string): Observation[] => [
    obs({ geo, na_item: 'F2R_F4R', finpos: 'NET', stk_flow: 'TRN', fin_typ: 'GRNT', time: '2021', value: 100 }),
    obs({ geo, na_item: 'F2R_F4R', finpos: 'NET', stk_flow: 'TRN', fin_typ: 'LOAN', time: '2022', value: 50 }),
    obs({ geo, na_item: 'F2R_F4R', finpos: 'NET', stk_flow: 'TRN', fin_typ: 'TOTAL', time: '2022', value: 50 }),
    obs({ geo, na_item: 'F2R_F4R', finpos: 'NET', stk_flow: 'STK', fin_typ: 'TOTAL', time: '2022', unit: 'MIO_EUR', value: 150 }),
    obs({ geo, na_item: 'F2R_F4R', finpos: 'NET', stk_flow: 'STK', fin_typ: 'TOTAL', time: '2022', unit: 'PC_ALLOC', value: 50 }),
    obs({ geo, na_item: 'F2', finpos: 'NET', stk_flow: 'TRN', fin_typ: 'GRNT', time: '2021', value: 999 }),
  ];
  const uses = (geo: string): Observation[] => [
    obs({ geo, na_item: 'TOTAL', fin_typ: 'GRNT', time: '2022', value: 30 }),
    obs({ geo, na_item: 'CAP', fin_typ: 'GRNT', time: '2022', value: 20 }),
    obs({ geo, na_item: 'TOTAL', fin_typ: 'GRNT', time: '2022', unit: 'PC_GDP', value: 7 }),
  ];
  const all = [...MEMBERS, 'EU27_2020', 'XX'];
  const rrf = buildRrf(all.flatMap(received), all.flatMap(uses));

  it('separa sovvenzioni e prestiti per anno e ricava la dotazione', () => {
    expect([rrf.firstYear, rrf.lastYear]).toEqual([2021, 2022]);
    expect(rrf.countries.IT).toEqual({
      allocation: 300e6,
      received: { grants: [100e6, 0], loans: [0, 50e6] },
      spent: { grants: [0, 30e6], loans: [0, 0] },
    });
  });

  it('tiene solo gli Stati membri e l’aggregato UE a parte', () => {
    expect(Object.keys(rrf.countries)).toHaveLength(MEMBERS.length);
    expect(rrf.countries.XX).toBeUndefined();
    expect(rrf.eu.allocation).toBe(300e6);
  });

  it('calcola le quote sul totale della dotazione', () => {
    expect(rrfTotals(rrf.countries.IT)).toEqual({ allocation: 300e6, received: 150e6, spent: 30e6, loansReceived: 50e6, receivedShare: 0.5, spentShare: 0.1 });
    expect(rrfTotals({ allocation: 0, received: { grants: [1], loans: [] }, spent: { grants: [], loans: [] } }).receivedShare).toBe(0);
  });

  it('fallisce se i dati sono vuoti o coprono troppi pochi paesi', () => {
    expect(() => buildRrf([], [])).toThrow();
    expect(() => buildRrf(received('IT'), uses('IT'))).toThrow(/paesi/);
  });
});
