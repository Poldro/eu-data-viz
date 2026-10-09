import { describe, expect, it } from 'vitest';
import { AUDIT_SOURCE, AUDIT_YEARS, latestAudit, MATERIALITY } from './audit';
import type { CubeRow } from './cube';
import { cubeFor } from './data';
import { countryLeakage, isTechnicalAssistance, leakage, perHundred } from './leakage';

const row = (area: string, objective: string, planned: number, spent: number): CubeRow => [area, 'ERDF', objective, '', planned, planned, spent, 0];

describe('gestione e fondi non spesi', () => {
  const rows = [row('IT', 'PO2 Greener Europe', 900, 500), row('IT', 'POTA Technical Assistance', 100, 40), row('DE', 'TO1', 200, 200), row('DE', 'TOTA', 0, 0)];

  it('riconosce l’assistenza tecnica dei due cicli', () => {
    expect(['POTA Technical Assistance', 'POTA36(4) Technical assistance', 'TOTA', 'TOIPA-TA'].every(isTechnicalAssistance)).toBe(true);
    expect(['PO1 Smarter Europe', 'TO1', 'TOMULTI'].some(isTechnicalAssistance)).toBe(false);
  });

  it('divide il pianificato in progetti, gestione e non speso senza perdere un euro', () => {
    const italy = leakage(rows.filter((r) => r[0] === 'IT'));
    expect(italy).toEqual({ planned: 1000, projects: 500, management: 40, unspent: 460, managementPlanned: 100 });
    expect(italy.projects + italy.management + italy.unspent).toBe(italy.planned);
    expect(perHundred(italy)).toEqual({ projects: 50, management: 4, unspent: 46 });
  });

  it('non segna un non speso negativo quando la spesa supera il pianificato', () => {
    expect(leakage([row('IT', 'TO1', 100, 130)]).unspent).toBe(0);
  });

  it('regge l’assenza di dati', () => {
    expect(perHundred(leakage([]))).toEqual({ projects: 0, management: 0, unspent: 0 });
  });

  it('dà una riga per paese con le quote', () => {
    const byCode = Object.fromEntries(countryLeakage(rows).map((c) => [c.code, c]));
    expect(Object.keys(byCode).sort()).toEqual(['DE', 'IT']);
    expect(byCode.IT.managementShare).toBe(0.1);
    expect(byCode.IT.unspentShare).toBe(0.46);
    expect(byCode.DE).toMatchObject({ managementShare: 0, unspentShare: 0 });
  });

  it('sui dati veri la gestione resta una piccola parte e i conti tornano', () => {
    for (const period of ['2127', '1420'] as const) {
      const eu = leakage(cubeFor(period).rows);
      expect(eu.managementPlanned / eu.planned).toBeGreaterThan(0.01);
      expect(eu.managementPlanned / eu.planned).toBeLessThan(0.08);
      expect(eu.projects + eu.management + eu.unspent).toBeCloseTo(eu.planned, 0);
    }
  });
});

describe('errori rilevati dalla Corte dei conti', () => {
  it('ha anni consecutivi e percentuali plausibili', () => {
    AUDIT_YEARS.forEach((y, i) => {
      if (i > 0) expect(y.year).toBe(AUDIT_YEARS[i - 1].year + 1);
      expect(y.overall).toBeGreaterThan(0);
      expect(y.overall).toBeLessThan(15);
      if (y.cohesion !== null) expect(y.cohesion).toBeGreaterThanOrEqual(y.overall);
    });
    expect(latestAudit().year).toBe(Number(AUDIT_SOURCE.asOf));
    expect(MATERIALITY).toBe(2);
  });
});
