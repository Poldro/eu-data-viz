/** Registro unico delle sezioni: alimenta la barra in testata, l'indice in prima pagina e i rimandi a fine pagina. */
export interface Section {
  id: string;
  href: string;
  label: string;
  /** Una riga che dice che cosa si trova nella sezione. */
  blurb: string;
}

export const SECTIONS: readonly Section[] = [
  { id: 'panoramica', href: '/', label: 'Panoramica', blurb: 'Il quadro d’insieme: quanto, da dove, verso chi.' },
  { id: 'temi', href: '/temi/', label: 'Cosa finanziano', blurb: 'Le voci di spesa, dall’energia alla scuola.' },
  { id: 'assorbimento', href: '/assorbimento/', label: 'Chi spende', blurb: 'La classifica di chi usa i fondi e chi li lascia fermi.' },
  { id: 'dispersione', href: '/dispersione/', label: 'Cosa si perde', blurb: 'Gestione, fondi non spesi, errori: quanto resta per strada.' },
  { id: 'paesi', href: '/paesi/', label: 'Paesi', blurb: 'Una scheda per ciascuno dei 27 Stati membri.' },
  { id: 'regioni', href: '/regioni/', label: 'Regioni', blurb: 'La mappa dei pagamenti, regione per regione, dal 1989.' },
  { id: 'progetti', href: '/progetti/', label: 'Progetti', blurb: 'I cantieri e gli interventi finanziati in Italia, uno per uno.' },
  { id: 'pnrr', href: '/pnrr/', label: 'PNRR', blurb: 'Il piano di ripresa: quanto è arrivato e quanto è stato speso.' },
  { id: 'beneficiari', href: '/beneficiari/', label: 'Beneficiari', blurb: 'Chi incassa i fondi gestiti direttamente da Bruxelles.' },
  { id: 'lobby', href: '/lobby/', label: 'Lobby', blurb: 'Chi dichiara di fare pressione a Bruxelles, quanto spende e su quali leggi.' },
  { id: 'metodo', href: '/metodo/', label: 'Metodo', blurb: 'Fonti, definizioni e limiti dei numeri.' },
];

export function sectionNumber(id: string): string {
  return String(SECTIONS.findIndex((s) => s.id === id) + 1).padStart(2, '0');
}

/** La sezione a cui appartiene un percorso: le pagine figlie (/paesi/it/) ereditano quella del genitore. */
export function sectionForPath(pathname: string): Section | undefined {
  const path = pathname.endsWith('/') ? pathname : `${pathname}/`;
  return SECTIONS.find((s) => (s.href === '/' ? path === '/' : path.startsWith(s.href)));
}

export function neighbours(id: string): { previous?: Section; next?: Section } {
  const index = SECTIONS.findIndex((s) => s.id === id);
  if (index === -1) return {};
  return { previous: SECTIONS[index - 1], next: SECTIONS[index + 1] };
}
