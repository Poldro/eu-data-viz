import type { Cube } from './cube';

/** Sigle italiane dei fondi (FESR, FSE+…) con il nome esteso. */
const FUNDS: Readonly<Record<string, [short: string, long: string]>> = {
  ERDF: ['FESR', 'Fondo europeo di sviluppo regionale'],
  'ESF+': ['FSE+', 'Fondo sociale europeo Plus'],
  ESF: ['FSE', 'Fondo sociale europeo'],
  CF: ['Coesione', 'Fondo di coesione'],
  JTF: ['JTF', 'Fondo per una transizione giusta'],
  'Interreg Funds': ['Interreg', 'Cooperazione territoriale europea'],
  AMIF: ['FAMI', 'Fondo asilo, migrazione e integrazione'],
  BMVI: ['BMVI', 'Strumento per la gestione delle frontiere e i visti'],
  ISF: ['ISF', 'Fondo sicurezza interna'],
  EMFAF: ['FEAMPA', 'Fondo per gli affari marittimi, la pesca e l’acquacoltura'],
  EMFF: ['FEAMP', 'Fondo per gli affari marittimi e la pesca'],
  EAFRD: ['FEASR', 'Fondo europeo agricolo per lo sviluppo rurale'],
  YEI: ['IOG', 'Iniziativa per l’occupazione giovanile'],
  IPAE: ['IPA', 'Strumento di preadesione (cooperazione transfrontaliera)'],
  FEAD: ['FEAD', 'Fondo di aiuti europei agli indigenti'],
};

const OBJECTIVES: Readonly<Record<string, string>> = {
  'PO1 Smarter Europe': 'Innovazione e imprese',
  'PO2 Greener Europe': 'Ambiente e clima',
  'PO3 Connected Europe': 'Trasporti e reti',
  'PO4 Social Europe': 'Lavoro, scuola e inclusione',
  'PO5 Europe closer to citizens': 'Sviluppo dei territori',
  'PO6 Interreg: Cooperation Governance': 'Cooperazione tra amministrazioni',
  'PO7 Interreg: Safer and more secure Europe': 'Sicurezza alle frontiere (Interreg)',
  'PO8 JTF specific objective': 'Uscita dal carbone',
  'PO1 Asylum and migration': 'Asilo e migrazione',
  'PO1 Borders and visa': 'Frontiere e visti',
  'PO1 Security': 'Sicurezza interna',
  'POTA Technical Assistance': 'Assistenza tecnica',
  'POTA36(4) Technical assistance pursuant to Article 36(4) CPR': 'Assistenza tecnica',
  TO1: 'Ricerca e innovazione',
  TO2: 'Digitale',
  TO3: 'Competitività delle PMI',
  TO4: 'Economia a basse emissioni',
  TO5: 'Adattamento al clima e rischi',
  TO6: 'Ambiente e uso delle risorse',
  TO7: 'Reti di trasporto ed energia',
  TO8: 'Occupazione',
  TO9: 'Inclusione sociale',
  TO10: 'Istruzione e formazione',
  TO11: 'Pubblica amministrazione',
  TO12: 'Regioni ultraperiferiche',
  TO13: 'Risposta alla crisi (REACT-EU)',
  TOTA: 'Assistenza tecnica',
  'TOIPA-TA': 'Assistenza tecnica',
  TOMULTI: 'Più obiettivi insieme',
  TODM: 'Misure dismesse',
  TOVOID: 'Non classificato',
};

const FTS_TYPES: Readonly<Record<string, string>> = {
  'Private Companies': 'Imprese private',
  'Other public bodies': 'Enti pubblici',
  'International Organisations': 'Organizzazioni internazionali',
  'Third States': 'Stati terzi',
  'Member States': 'Stati membri',
  'EU Joint Undertakings and PPP': 'Imprese comuni UE',
  'EU decentralised agencies': 'Agenzie UE',
  'EIB - European Investment Bank': 'Banca europea per gli investimenti',
  'EU Institution & Bodies': 'Istituzioni UE',
  'EU executive agencies': 'Agenzie esecutive UE',
  'Regions-Provinces Member States': 'Regioni e province',
  'EC entities not consolidated': 'Entità della Commissione',
  'Ministries - Member States': 'Ministeri',
  'EFTA Countries': 'Paesi EFTA',
  'Private Persons': 'Persone fisiche',
  'Ministries - Third States': 'Ministeri di Stati terzi',
  'Regions-Provinces Third States': 'Regioni di Stati terzi',
};

const FTS_PROGRAMMES: Readonly<Record<string, string>> = {
  'DA/JU/EUI - Decentralised Agencies, Joint Undertakings, EU institutions': 'Agenzie, imprese comuni e istituzioni UE',
  'Neighbourhood, Development and International Cooperation Instrument - Global Europe ( NDICI - Global Europe )':
    'Global Europe (vicinato e cooperazione)',
  'Humanitarian Aid (HUMA)': 'Aiuti umanitari',
  'Single Market Programme (incl. SMEs)': 'Programma per il mercato unico',
  'Programme for Environment and Climate Action (LIFE)': 'LIFE (ambiente e clima)',
  'Information and communication technology': 'Informatica della Commissione',
};

export function fundShort(fund: string): string {
  return FUNDS[fund]?.[0] ?? fund;
}

export function fundLong(fund: string): string {
  return FUNDS[fund]?.[1] ?? fund;
}

export function objectiveLabel(cube: Cube, key: string): string {
  return OBJECTIVES[key] ?? cube.objectives[key] ?? key;
}

/** Le voci di dettaglio restano nella dicitura ufficiale inglese della Commissione. */
export function categoryLabel(cube: Cube, key: string): string {
  return cube.categories[key] ?? key;
}

export function ftsTypeLabel(type: string): string {
  return FTS_TYPES[type] ?? type;
}

export function ftsProgrammeLabel(programme: string): string {
  return FTS_PROGRAMMES[programme] ?? programme;
}
