import { matchesQuery } from './search';

export interface ProjectBucket {
  key: string;
  label: string;
  /** Finanziamento pubblico totale, in euro. */
  cost: number;
  paid: number;
  projects: number;
}

export interface CycleSummary {
  cost: number;
  paid: number;
  projects: number;
  themes: ProjectBucket[];
  natures: ProjectBucket[];
  states: ProjectBucket[];
  regions: ProjectBucket[];
}

export interface Project {
  /** Codice locale del progetto: identifica anche la sua scheda su OpenCoesione. */
  id: string;
  title: string;
  cycle: string;
  theme: string;
  state: string;
  cost: number;
  paid: number;
  /** Primo soggetto con ruolo di beneficiario o attuatore. */
  beneficiary: string;
  /** Chiavi delle regioni interessate (stesse di `CycleSummary.regions`). */
  regions: string[];
}

/** Progetti delle politiche di coesione in Italia (OpenCoesione). */
export interface Projects {
  /** Data di aggiornamento dichiarata dalla fonte (AAAAMMGG). */
  asOf: string;
  cycles: Record<string, CycleSummary>;
  projects: Project[];
}

export const CYCLES: readonly { id: string; label: string }[] = [
  { id: '2021_2027', label: '2021–2027' },
  { id: '2014_2020', label: '2014–2020' },
];

export function projectUrl(id: string): string {
  return `https://opencoesione.gov.it/it/progetti/${encodeURIComponent(id.toLowerCase())}/`;
}

export interface ProjectFilter {
  cycle: string;
  region?: string;
  theme?: string;
  /** Testo libero cercato in titolo e beneficiario. */
  query?: string;
}


/** Progetti che rispettano i filtri, dal più costoso. */
export function filterProjects(projects: readonly Project[], filter: ProjectFilter): Project[] {
  const query = filter.query ?? '';
  return projects
    .filter(
      (p) =>
        p.cycle === filter.cycle &&
        (!filter.region || p.regions.includes(filter.region)) &&
        (!filter.theme || p.theme === filter.theme) &&
        matchesQuery(`${p.title} ${p.beneficiary}`, query),
    )
    .sort((a, b) => b.cost - a.cost);
}

/** "CAMPANIA" → "Campania", "VALLE D'AOSTA" → "Valle d'Aosta". */
export function titleCase(text: string): string {
  return text
    .toLocaleLowerCase('it')
    .replace(/(^|[\s\-/'’])(\p{L})/gu, (_, sep: string, letter: string) => sep + letter.toLocaleUpperCase('it'))
    // La preposizione elisa resta minuscola: "Valle d'Aosta", non "Valle D'Aosta".
    .replace(/(?<=\s)D(?=['’])/g, 'd');
}
