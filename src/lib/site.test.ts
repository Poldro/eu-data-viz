import { describe, expect, it } from 'vitest';
import { cubeFor, cubeSource, isPeriod, meta, PERIODS, source } from './data';
import { dateIt, eurShort, int, perHead } from './format';
import { categoryLabel, ftsProgrammeLabel, ftsTypeLabel, fundLong, fundShort, objectiveLabel } from './labels';
import { neighbours, sectionForPath, sectionNumber, SECTIONS } from './sections';
import { staticTeasers } from './teasers';

describe('sezioni', () => {
  it('numera le sezioni nell’ordine del registro', () => {
    expect(sectionNumber('panoramica')).toBe('01');
    expect(sectionNumber(SECTIONS[SECTIONS.length - 1].id)).toBe(String(SECTIONS.length).padStart(2, '0'));
  });

  it('riconosce la sezione dal percorso, comprese le pagine figlie', () => {
    expect(sectionForPath('/')?.id).toBe('panoramica');
    expect(sectionForPath('/paesi/it/')?.id).toBe('paesi');
    expect(sectionForPath('/progetti')?.id).toBe('progetti');
    expect(sectionForPath('/inesistente/')).toBeUndefined();
  });

  it('trova precedente e successiva', () => {
    expect(neighbours('panoramica')).toEqual({ previous: undefined, next: SECTIONS[1] });
    expect(neighbours('temi').previous?.id).toBe('panoramica');
    expect(neighbours(SECTIONS[SECTIONS.length - 1].id).next).toBeUndefined();
    expect(neighbours('inesistente')).toEqual({});
  });

  it('ha indirizzi unici', () => {
    expect(new Set(SECTIONS.map((s) => s.href)).size).toBe(SECTIONS.length);
    expect(new Set(SECTIONS.map((s) => s.id)).size).toBe(SECTIONS.length);
  });
});

describe('dati e fonti', () => {
  it('espone un cubo e una fonte per ogni periodo', () => {
    for (const period of PERIODS) {
      expect(cubeFor(period.id).rows.length).toBeGreaterThan(0);
      expect(cubeSource(period.id).url).toMatch(/^https:\/\//);
    }
  });

  it('riconosce solo i periodi noti', () => {
    expect(isPeriod('2127')).toBe(true);
    expect(isPeriod('1999')).toBe(false);
    expect(isPeriod(null)).toBe(false);
  });

  it('rifiuta le fonti sconosciute invece di restituire un vuoto', () => {
    expect(() => source('inesistente')).toThrow('Fonte sconosciuta');
    expect(meta.sources.length).toBeGreaterThan(0);
  });
});

describe('anticipazioni della prima pagina', () => {
  it('danno un titolo e una serie per ogni sezione che esiste', () => {
    const teasers = staticTeasers();
    for (const [id, teaser] of Object.entries(teasers)) {
      expect(SECTIONS.some((s) => s.id === id)).toBe(true);
      expect(teaser.headline.length).toBeGreaterThan(10);
      expect(teaser.values.length).toBeGreaterThan(1);
      expect(teaser.values.every(Number.isFinite)).toBe(true);
      expect(teaser.highlight).toBeLessThan(teaser.values.length);
    }
    expect(Object.keys(teasers)).toEqual(expect.arrayContaining(['regioni', 'progetti', 'pnrr', 'beneficiari', 'lobby']));
  });
});

describe('etichette', () => {
  const cube = cubeFor('2127');

  it('usa le sigle italiane dei fondi e lascia intatte quelle ignote', () => {
    expect(fundShort('ERDF')).toBe('FESR');
    expect(fundLong('ERDF')).toBe('Fondo europeo di sviluppo regionale');
    expect(fundShort('XYZ')).toBe('XYZ');
    expect(fundLong('XYZ')).toBe('XYZ');
  });

  it('traduce obiettivi e voci, ripiegando sulla chiave', () => {
    expect(objectiveLabel(cube, 'PO2 Greener Europe')).toBe('Ambiente e clima');
    expect(objectiveLabel(cube, 'ignoto')).toBe('ignoto');
    expect(categoryLabel(cube, 'ignoto')).toBe('ignoto');
  });

  it('traduce tipi e programmi FTS noti', () => {
    expect(ftsTypeLabel('Private Companies')).toBe('Imprese private');
    expect(ftsTypeLabel('Altro')).toBe('Altro');
    expect(ftsProgrammeLabel('Humanitarian Aid (HUMA)')).toBe('Aiuti umanitari');
    expect(ftsProgrammeLabel('Horizon Europe')).toBe('Horizon Europe');
  });
});

describe('altri formati', () => {
  it('scrive importi senza simbolo, interi, euro per abitante e date', () => {
    expect(eurShort(2_500_000_000)).toBe('2,5 mld');
    expect(int(1234)).toBe('1.234');
    expect(perHead(1234.4)).toBe('1.234 €');
    expect(dateIt('2026-10-09T10:00:00Z')).toBe('9 ottobre 2026');
  });
});
