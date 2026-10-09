import { describe, expect, it } from 'vitest';
import { filterProjects, projectUrl, titleCase, type Project } from '../src/lib/projects';
import { mergeProjects, parseAmount, toProject, toSummary, withRegion, type Aggregates, type RawProject } from './opencoesione';

describe('importi OpenCoesione', () => {
  it('legge la virgola decimale e i separatori delle migliaia', () => {
    expect(parseAmount('4363566537,13')).toBe(4363566537.13);
    expect(parseAmount('1.250,5')).toBe(1250.5);
    expect(parseAmount(12)).toBe(12);
  });
  it('azzera i valori assenti o illeggibili', () => {
    expect(parseAmount(null)).toBe(0);
    expect(parseAmount('n.d.')).toBe(0);
    expect(parseAmount(Number.NaN)).toBe(0);
  });
});

describe('progetti', () => {
  const raw: RawProject = {
    cod_locale_progetto: '1MISE-ABC',
    oc_titolo_progetto: '  Completamento   depuratore ',
    oc_tema_sintetico: 'Ambiente',
    oc_stato_progetto: 'In corso',
    oc_finanz_tot_pub_netto: 100.4,
    tot_pagamenti: 40.6,
    soggetti: [
      { denominazione: 'MINISTERO', ruoli: ['Programmatore'] },
      { denominazione: 'COMUNE DI  CATANIA', ruoli: ['Attuatore'] },
    ],
    territori: ['sicilia-regione', 'catania-provincia'],
  };

  it('sceglie il beneficiario, ripulisce il titolo e tiene solo le regioni', () => {
    expect(toProject(raw, '2021_2027')).toEqual({
      id: '1MISE-ABC',
      title: 'Completamento depuratore',
      cycle: '2021_2027',
      theme: 'Ambiente',
      state: 'In corso',
      cost: 100,
      paid: 41,
      beneficiary: 'COMUNE DI CATANIA',
      regions: ['sicilia-regione'],
    });
  });

  it('regge i campi mancanti', () => {
    const bare = toProject({ ...raw, oc_titolo_progetto: null, oc_tema_sintetico: null, oc_stato_progetto: null, soggetti: [], territori: [] }, 'x');
    expect(bare).toMatchObject({ title: '1MISE-ABC', theme: 'Non classificato', beneficiary: '', regions: [] });
  });

  const project = (over: Partial<Project>): Project => ({ ...toProject(raw, '2021_2027'), ...over });

  it('elimina i doppioni tra classifica nazionale e regionali e ordina per costo', () => {
    const merged = mergeProjects([[project({ id: 'A', cost: 1 }), project({ id: 'B', cost: 9 })], [project({ id: 'A', cost: 1 })], [project({ id: 'A', cycle: '2014_2020', cost: 5 })]]);
    expect(merged.map((p) => `${p.cycle}:${p.id}`)).toEqual(['2021_2027:B', '2014_2020:A', '2021_2027:A']);
  });

  it('conserva le regioni di tutte le copie dello stesso progetto', () => {
    const national = project({ id: 'A', regions: [] });
    const merged = mergeProjects([[national], [withRegion(national, 'sicilia-regione')], [withRegion(national, 'calabria-regione')]]);
    expect(merged).toHaveLength(1);
    expect(merged[0].regions).toEqual(['sicilia-regione', 'calabria-regione']);
    expect(national.regions).toEqual([]);
    expect(withRegion(merged[0], 'sicilia-regione')).toBe(merged[0]);
  });

  it('filtra per ciclo, regione, tema e testo', () => {
    const list = [
      project({ id: 'A', cost: 5 }),
      project({ id: 'B', cost: 9, title: 'Raddoppio ferroviario', beneficiary: 'RFI', regions: ['campania-regione'], theme: 'Trasporti' }),
      project({ id: 'C', cycle: '2014_2020' }),
    ];
    expect(filterProjects(list, { cycle: '2021_2027' }).map((p) => p.id)).toEqual(['B', 'A']);
    expect(filterProjects(list, { cycle: '2021_2027', region: 'sicilia-regione' }).map((p) => p.id)).toEqual(['A']);
    expect(filterProjects(list, { cycle: '2021_2027', theme: 'Trasporti' }).map((p) => p.id)).toEqual(['B']);
    expect(filterProjects(list, { cycle: '2021_2027', query: 'catania' }).map((p) => p.id)).toEqual(['A']);
    expect(filterProjects(list, { cycle: '2021_2027', query: 'r' })).toHaveLength(2);
  });

  it('riassume gli aggregati scartando le voci vuote', () => {
    const totals = (cost: number, projects: number) => ({ costo_pubblico: cost, pagamenti: cost / 2, progetti: projects });
    const data: Aggregates = {
      data_aggiornamento: '20260630',
      aggregati: {
        totali: totals(100, 10),
        stati_progetti: { concluso: { label: 'Concluso', totali: totals(60, 6) } },
        temi: { energia: { label: 'Energia', totali: totals(30, 3) }, trasporti: { label: 'Trasporti', totali: totals(70, 7) }, vuoto: { label: 'Vuoto', totali: totals(0, 0) } },
        nature: {},
        territori: { regioni: { 'campania-regione': { label: 'CAMPANIA', totali: totals(40, 4) } } },
      },
    };
    const summary = toSummary(data);
    expect(summary).toMatchObject({ cost: 100, paid: 50, projects: 10 });
    expect(summary.themes.map((t) => t.key)).toEqual(['trasporti', 'energia']);
    expect(summary.regions[0]).toEqual({ key: 'campania-regione', label: 'CAMPANIA', cost: 40, paid: 20, projects: 4 });
  });

  it('costruisce il link alla scheda e normalizza i nomi delle regioni', () => {
    expect(projectUrl('1MISE-ABC')).toBe('https://opencoesione.gov.it/it/progetti/1mise-abc/');
    expect(titleCase('FRIULI-VENEZIA GIULIA')).toBe('Friuli-Venezia Giulia');
    expect(titleCase("VALLE D'AOSTA/VALLÉE D'AOSTE")).toBe("Valle d'Aosta/Vallée d'Aoste");
  });
});
