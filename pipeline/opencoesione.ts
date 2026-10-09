/**
 * OpenCoesione: aggregati e progetti più grandi delle politiche di coesione in Italia.
 * L'API limita in modo severo la frequenza delle richieste: le chiamate sono in sequenza,
 * distanziate, e ripetute dopo l'attesa indicata dal server.
 */
import { z } from 'zod';
import type { CycleSummary, Project, ProjectBucket, Projects } from '../src/lib/projects';

const BASE = 'https://opencoesione.gov.it/it/api';
export const SITE = 'https://opencoesione.gov.it/';
const SPACING_MS = 6_000;
const MAX_RETRIES = 3;
const TIMEOUT_MS = 45_000;
const RETRY_PAUSE_MS = 30_000;

/** "4363566537,13" → 4363566537.13; valori vuoti o non numerici → 0. */
export function parseAmount(raw: unknown): number {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : 0;
  if (typeof raw !== 'string') return 0;
  const value = Number(raw.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(value) ? value : 0;
}

const money = z.unknown().transform(parseAmount);

const Totals = z.object({ costo_pubblico: money, pagamenti: money, progetti: money });
const Labelled = z.object({ label: z.string(), totali: Totals });
const Aggregates = z.object({
  data_aggiornamento: z.string(),
  aggregati: z.object({
    totali: Totals,
    stati_progetti: z.record(z.string(), Labelled),
    temi: z.record(z.string(), Labelled),
    nature: z.record(z.string(), Labelled),
    territori: z.object({ regioni: z.record(z.string(), Labelled) }),
  }),
});
export type Aggregates = z.infer<typeof Aggregates>;

const RawProject = z.object({
  cod_locale_progetto: z.string(),
  oc_titolo_progetto: z.string().nullish(),
  oc_tema_sintetico: z.string().nullish(),
  oc_stato_progetto: z.string().nullish(),
  oc_finanz_tot_pub_netto: money,
  tot_pagamenti: money,
  soggetti: z.array(z.object({ denominazione: z.string().nullish(), ruoli: z.array(z.string()).default([]) })).default([]),
  territori: z.array(z.string()).default([]),
});
export type RawProject = z.infer<typeof RawProject>;
const ProjectPage = z.object({ results: z.array(RawProject) });

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
let lastCall = 0;

async function get(path: string, params: Record<string, string>): Promise<unknown> {
  const url = `${BASE}/${path}/?${new URLSearchParams({ format: 'json', ...params })}`;
  let lastError = '';
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    await sleep(Math.max(0, lastCall + SPACING_MS - Date.now()));
    lastCall = Date.now();
    let res: Response;
    try {
      res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch (error: unknown) {
      // Timeout o rete: il server a volte impiega più di un minuto sulle classifiche regionali.
      lastError = error instanceof Error ? error.message : String(error);
      await sleep(RETRY_PAUSE_MS);
      continue;
    }
    if (res.status === 429 || res.status >= 500) {
      lastError = `HTTP ${res.status}`;
      await sleep((Number(res.headers.get('retry-after')) || RETRY_PAUSE_MS / 1000) * 1000 + 1000);
      continue;
    }
    if (!res.ok) throw new Error(`OpenCoesione ${path}: HTTP ${res.status}`);
    return res.json();
  }
  throw new Error(`OpenCoesione ${path}: nessuna risposta dopo ${MAX_RETRIES + 1} tentativi (${lastError})`);
}

function buckets(group: Record<string, z.infer<typeof Labelled>>): ProjectBucket[] {
  return Object.entries(group)
    .map(([key, entry]) => ({
      key,
      label: entry.label,
      cost: Math.round(entry.totali.costo_pubblico),
      paid: Math.round(entry.totali.pagamenti),
      projects: Math.round(entry.totali.progetti),
    }))
    .filter((b) => b.projects > 0)
    .sort((a, b) => b.cost - a.cost);
}

export function toSummary(data: Aggregates): CycleSummary {
  const { totali, temi, nature, stati_progetti, territori } = data.aggregati;
  return {
    cost: Math.round(totali.costo_pubblico),
    paid: Math.round(totali.pagamenti),
    projects: Math.round(totali.progetti),
    themes: buckets(temi),
    natures: buckets(nature),
    states: buckets(stati_progetti),
    regions: buckets(territori.regioni),
  };
}

const BENEFICIARY_ROLES = ['Beneficiario', 'Attuatore'];

export function toProject(raw: RawProject, cycle: string): Project {
  const named = raw.soggetti.filter((s) => s.denominazione);
  const beneficiary = named.find((s) => s.ruoli.some((role) => BENEFICIARY_ROLES.includes(role))) ?? named[0];
  return {
    id: raw.cod_locale_progetto,
    title: (raw.oc_titolo_progetto ?? '').replace(/\s+/g, ' ').trim() || raw.cod_locale_progetto,
    cycle,
    theme: raw.oc_tema_sintetico ?? 'Non classificato',
    state: raw.oc_stato_progetto ?? 'Non determinabile',
    cost: Math.round(raw.oc_finanz_tot_pub_netto),
    paid: Math.round(raw.tot_pagamenti),
    beneficiary: beneficiary?.denominazione?.replace(/\s+/g, ' ').trim() ?? '',
    regions: raw.territori.filter((t) => t.endsWith('-regione')),
  };
}

/**
 * Unisce più elenchi eliminando i doppioni: lo stesso progetto compare nella classifica nazionale
 * e in quelle regionali, e di ciascuna copia si conservano le regioni.
 */
export function mergeProjects(lists: readonly Project[][]): Project[] {
  const byId = new Map<string, Project>();
  for (const project of lists.flat()) {
    const key = `${project.cycle}|${project.id}`;
    const known = byId.get(key);
    byId.set(key, known ? { ...known, regions: [...new Set([...known.regions, ...project.regions])] } : project);
  }
  return [...byId.values()].sort((a, b) => b.cost - a.cost);
}

/**
 * La fonte indica spesso solo il comune o la provincia del progetto: la regione si ricava
 * dalla classifica regionale in cui il progetto è stato trovato.
 */
export function withRegion(project: Project, region: string): Project {
  return project.regions.includes(region) ? project : { ...project, regions: [...project.regions, region] };
}

async function topProjects(cycle: string, size: number, territory?: string): Promise<Project[]> {
  const params = { ciclo_programmazione: cycle, order_by: '-costo', page_size: String(size), ...(territory ? { territorio: territory } : {}) };
  const page = ProjectPage.parse(await get('progetti', params));
  const projects = page.results.map((raw) => toProject(raw, cycle));
  return territory ? projects.map((project) => withRegion(project, territory)) : projects;
}

export interface ProjectsOptions {
  /** Cicli di cui scaricare gli aggregati. */
  cycles: readonly string[];
  /**
   * Cicli di cui scaricare anche le classifiche dei progetti. Per il 2014-2020 (quasi un milione
   * di progetti) l'API non riesce a ordinare per costo e non risponde: lì ci si ferma agli aggregati.
   */
  rankedCycles: readonly string[];
  topNational: number;
  topPerRegion: number;
  onProgress?: (message: string) => void;
}

export async function fetchProjects(options: ProjectsOptions): Promise<Projects> {
  const cycles: Record<string, CycleSummary> = {};
  const lists: Project[][] = [];
  let asOf = '';
  for (const cycle of options.cycles) {
    const aggregates = Aggregates.parse(await get('aggregati', { ciclo_programmazione: cycle }));
    asOf = aggregates.data_aggiornamento;
    const summary = toSummary(aggregates);
    if (summary.projects < 1000) throw new Error(`OpenCoesione ${cycle}: solo ${summary.projects} progetti`);
    cycles[cycle] = summary;
    if (!options.rankedCycles.includes(cycle)) continue;
    lists.push(await topProjects(cycle, options.topNational));
    for (const region of summary.regions) {
      options.onProgress?.(`${cycle} · ${region.label}`);
      lists.push(await topProjects(cycle, options.topPerRegion, region.key));
    }
  }
  const projects = mergeProjects(lists);
  if (options.rankedCycles.length > 0 && projects.length < options.topNational) {
    throw new Error(`OpenCoesione: solo ${projects.length} progetti in elenco`);
  }
  return { asOf, cycles, projects };
}
