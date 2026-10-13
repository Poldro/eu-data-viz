/**
 * Atti legislativi dell'Unione approvati dal 2019, scelti a mano tra i più discussi.
 * Numero e data vengono dal catalogo dell'Ufficio delle pubblicazioni (Cellar); i nomi brevi sono
 * quelli dell'uso corrente, non i titoli giuridici. L'elenco va aggiornato a mano.
 */
export type ActTheme = 'digitale' | 'clima' | 'energia' | 'industria' | 'finanza' | 'lavoro' | 'agricoltura';

export interface Act {
  id: string;
  /** Nome con cui l'atto è conosciuto. */
  name: string;
  /** Identificativo CELEX: 3 + anno + R (regolamento) o L (direttiva) + numero. */
  celex: string;
  /** Data dell'atto (ISO 8601). */
  date: string;
  theme: ActTheme;
  /** Denominazioni per esteso, cercate senza distinguere maiuscole, accenti e trattini. */
  phrases: readonly string[];
  /** Sigle, cercate rispettando le maiuscole: "DMA" non deve trovare "dma". */
  acronyms?: readonly string[];
}

export const ACT_THEMES: Readonly<Record<ActTheme, string>> = {
  digitale: 'Digitale',
  clima: 'Clima e ambiente',
  energia: 'Energia e trasporti',
  industria: 'Industria e prodotti',
  finanza: 'Finanza',
  lavoro: 'Lavoro e diritti',
  agricoltura: 'Agricoltura',
};

export const ACTS: readonly Act[] = [
  { id: 'ai-act', name: 'Regolamento sull’intelligenza artificiale (AI Act)', celex: '32024R1689', date: '2024-06-13', theme: 'digitale', phrases: ['AI Act', 'Artificial Intelligence Act'] },
  { id: 'dsa', name: 'Regolamento sui servizi digitali (DSA)', celex: '32022R2065', date: '2022-10-19', theme: 'digitale', phrases: ['Digital Services Act'], acronyms: ['DSA'] },
  { id: 'dma', name: 'Regolamento sui mercati digitali (DMA)', celex: '32022R1925', date: '2022-09-14', theme: 'digitale', phrases: ['Digital Markets Act'], acronyms: ['DMA'] },
  { id: 'data-act', name: 'Regolamento sui dati (Data Act)', celex: '32023R2854', date: '2023-12-13', theme: 'digitale', phrases: ['Data Act'] },
  { id: 'dga', name: 'Regolamento sulla governance dei dati', celex: '32022R0868', date: '2022-05-30', theme: 'digitale', phrases: ['Data Governance Act'], acronyms: ['DGA'] },
  { id: 'cra', name: 'Regolamento sulla ciberresilienza', celex: '32024R2847', date: '2024-10-23', theme: 'digitale', phrases: ['Cyber Resilience Act', 'Cyberresilience Act'] },
  { id: 'nis2', name: 'Direttiva sulla cibersicurezza (NIS 2)', celex: '32022L2555', date: '2022-12-14', theme: 'digitale', phrases: ['NIS2', 'NIS 2'] },
  { id: 'eidas', name: 'Identità digitale europea (eIDAS 2)', celex: '32024R1183', date: '2024-04-11', theme: 'digitale', phrases: ['eIDAS', 'European Digital Identity'] },
  { id: 'ehds', name: 'Spazio europeo dei dati sanitari', celex: '32025R0327', date: '2025-02-11', theme: 'digitale', phrases: ['European Health Data Space'], acronyms: ['EHDS'] },
  { id: 'emfa', name: 'Regolamento sulla libertà dei media', celex: '32024R1083', date: '2024-04-11', theme: 'digitale', phrases: ['Media Freedom Act'], acronyms: ['EMFA'] },
  { id: 'copyright', name: 'Direttiva sul diritto d’autore', celex: '32019L0790', date: '2019-04-17', theme: 'digitale', phrases: ['Copyright Directive', 'Copyright in the Digital Single Market', 'DSM Directive'] },
  { id: 'gigabit', name: 'Regolamento sulle reti Gigabit', celex: '32024R1309', date: '2024-04-29', theme: 'digitale', phrases: ['Gigabit Infrastructure Act'] },
  { id: 'chips-act', name: 'Regolamento sui semiconduttori (Chips Act)', celex: '32023R1781', date: '2023-09-13', theme: 'digitale', phrases: ['Chips Act'] },

  { id: 'climate-law', name: 'Legge europea sul clima', celex: '32021R1119', date: '2021-06-30', theme: 'clima', phrases: ['Climate Law'] },
  { id: 'ets', name: 'Riforma del mercato delle emissioni (ETS)', celex: '32023L0959', date: '2023-05-10', theme: 'clima', phrases: ['Emissions Trading System', 'Emission Trading System', 'Emissions Trading Scheme'], acronyms: ['ETS'] },
  { id: 'cbam', name: 'Dazio sul carbonio alle frontiere (CBAM)', celex: '32023R0956', date: '2023-05-10', theme: 'clima', phrases: ['Carbon Border Adjustment'], acronyms: ['CBAM'] },
  { id: 'nature-restoration', name: 'Regolamento sul ripristino della natura', celex: '32024R1991', date: '2024-06-24', theme: 'clima', phrases: ['Nature Restoration'] },
  { id: 'eudr', name: 'Regolamento sulla deforestazione', celex: '32023R1115', date: '2023-05-31', theme: 'clima', phrases: ['Deforestation Regulation', 'deforestation-free'], acronyms: ['EUDR'] },
  { id: 'ppwr', name: 'Regolamento sugli imballaggi', celex: '32025R0040', date: '2024-12-19', theme: 'clima', phrases: ['Packaging and Packaging Waste'], acronyms: ['PPWR'] },
  { id: 'sup', name: 'Direttiva sulla plastica monouso', celex: '32019L0904', date: '2019-06-05', theme: 'clima', phrases: ['Single-Use Plastics', 'Single-Use Plastic'] },
  { id: 'f-gas', name: 'Regolamento sui gas fluorurati', celex: '32024R0573', date: '2024-02-07', theme: 'clima', phrases: ['F-gas', 'F-gases', 'fluorinated greenhouse gases'] },
  { id: 'methane', name: 'Regolamento sulle emissioni di metano', celex: '32024R1787', date: '2024-06-13', theme: 'clima', phrases: ['Methane Regulation', 'methane emissions'] },
  { id: 'ied', name: 'Direttiva sulle emissioni industriali', celex: '32024L1785', date: '2024-04-24', theme: 'clima', phrases: ['Industrial Emissions Directive'], acronyms: ['IED'] },

  { id: 'red3', name: 'Direttiva sulle energie rinnovabili (RED III)', celex: '32023L2413', date: '2023-10-18', theme: 'energia', phrases: ['Renewable Energy Directive', 'RED III', 'RED 3'] },
  { id: 'eed', name: 'Direttiva sull’efficienza energetica', celex: '32023L1791', date: '2023-09-13', theme: 'energia', phrases: ['Energy Efficiency Directive'] },
  { id: 'epbd', name: 'Direttiva sulle case green (EPBD)', celex: '32024L1275', date: '2024-04-24', theme: 'energia', phrases: ['Energy Performance of Buildings'], acronyms: ['EPBD'] },
  { id: 'electricity-market', name: 'Riforma del mercato elettrico', celex: '32024R1747', date: '2024-06-13', theme: 'energia', phrases: ['Electricity Market Design', 'Electricity Market Reform'] },
  { id: 'co2-cars', name: 'Emissioni di CO₂ di auto e furgoni', celex: '32023R0851', date: '2023-04-19', theme: 'energia', phrases: ['CO2 standards for cars', 'CO2 emission standards for cars', 'CO2 emission performance standards for cars', 'CO2 emission performance standards for new passenger cars'] },
  { id: 'euro7', name: 'Norma Euro 7', celex: '32024R1257', date: '2024-04-24', theme: 'energia', phrases: ['Euro 7', 'Euro7'] },
  { id: 'afir', name: 'Infrastrutture per i combustibili alternativi', celex: '32023R1804', date: '2023-09-13', theme: 'energia', phrases: ['Alternative Fuels Infrastructure'], acronyms: ['AFIR'] },
  { id: 'refueleu', name: 'Carburanti sostenibili per l’aviazione (ReFuelEU)', celex: '32023R2405', date: '2023-10-18', theme: 'energia', phrases: ['ReFuelEU', 'ReFuel EU'] },
  { id: 'fueleu', name: 'Carburanti per il trasporto marittimo (FuelEU)', celex: '32023R1805', date: '2023-09-13', theme: 'energia', phrases: ['FuelEU Maritime', 'Fuel EU Maritime'] },

  { id: 'nzia', name: 'Regolamento sull’industria a zero emissioni', celex: '32024R1735', date: '2024-06-13', theme: 'industria', phrases: ['Net-Zero Industry Act'], acronyms: ['NZIA'] },
  { id: 'crma', name: 'Regolamento sulle materie prime critiche', celex: '32024R1252', date: '2024-04-11', theme: 'industria', phrases: ['Critical Raw Materials Act'], acronyms: ['CRMA'] },
  { id: 'batteries', name: 'Regolamento sulle batterie', celex: '32023R1542', date: '2023-07-12', theme: 'industria', phrases: ['Batteries Regulation', 'Battery Regulation'] },
  { id: 'espr', name: 'Progettazione ecocompatibile dei prodotti', celex: '32024R1781', date: '2024-06-13', theme: 'industria', phrases: ['Ecodesign for Sustainable Products'], acronyms: ['ESPR'] },
  { id: 'right-to-repair', name: 'Direttiva sul diritto alla riparazione', celex: '32024L1799', date: '2024-06-13', theme: 'industria', phrases: ['Right to Repair'] },
  { id: 'gpsr', name: 'Sicurezza generale dei prodotti', celex: '32023R0988', date: '2023-05-10', theme: 'industria', phrases: ['General Product Safety'], acronyms: ['GPSR'] },
  { id: 'machinery', name: 'Regolamento sulle macchine', celex: '32023R1230', date: '2023-06-14', theme: 'industria', phrases: ['Machinery Regulation'] },

  { id: 'taxonomy', name: 'Tassonomia degli investimenti sostenibili', celex: '32020R0852', date: '2020-06-18', theme: 'finanza', phrases: ['Taxonomy'] },
  { id: 'sfdr', name: 'Informativa sulla finanza sostenibile (SFDR)', celex: '32019R2088', date: '2019-11-27', theme: 'finanza', phrases: ['Sustainable Finance Disclosure'], acronyms: ['SFDR'] },
  { id: 'csrd', name: 'Rendicontazione di sostenibilità (CSRD)', celex: '32022L2464', date: '2022-12-14', theme: 'finanza', phrases: ['Corporate Sustainability Reporting'], acronyms: ['CSRD'] },
  { id: 'csddd', name: 'Dovere di diligenza delle imprese (CSDDD)', celex: '32024L1760', date: '2024-06-13', theme: 'finanza', phrases: ['Corporate Sustainability Due Diligence', 'Due Diligence Directive'], acronyms: ['CSDDD', 'CS3D'] },
  { id: 'mica', name: 'Regolamento sulle cripto-attività (MiCA)', celex: '32023R1114', date: '2023-05-31', theme: 'finanza', phrases: ['Markets in Crypto-Assets', 'Markets in Crypto Assets'], acronyms: ['MiCA', 'MiCAR', 'MICA'] },
  { id: 'dora', name: 'Resilienza digitale della finanza (DORA)', celex: '32022R2554', date: '2022-12-14', theme: 'finanza', phrases: ['Digital Operational Resilience'], acronyms: ['DORA'] },
  { id: 'amlr', name: 'Regolamento antiriciclaggio', celex: '32024R1624', date: '2024-05-31', theme: 'finanza', phrases: ['Anti-Money Laundering Regulation', 'AML Regulation', 'AML package'], acronyms: ['AMLR'] },

  { id: 'platform-work', name: 'Direttiva sul lavoro tramite piattaforme', celex: '32024L2831', date: '2024-10-23', theme: 'lavoro', phrases: ['Platform Work'] },
  { id: 'minimum-wage', name: 'Direttiva sul salario minimo', celex: '32022L2041', date: '2022-10-19', theme: 'lavoro', phrases: ['Minimum Wage', 'Minimum Wages'] },
  { id: 'pay-transparency', name: 'Direttiva sulla trasparenza retributiva', celex: '32023L0970', date: '2023-05-10', theme: 'lavoro', phrases: ['Pay Transparency'] },
  { id: 'forced-labour', name: 'Divieto dei prodotti del lavoro forzato', celex: '32024R3015', date: '2024-11-27', theme: 'lavoro', phrases: ['Forced Labour', 'Forced Labor'] },

  { id: 'cap', name: 'Politica agricola comune 2023–2027', celex: '32021R2115', date: '2021-12-02', theme: 'agricoltura', phrases: ['Common Agricultural Policy', 'Politique agricole commune', 'Politica agricola comune', 'Gemeinsame Agrarpolitik', 'Política Agrícola Común', 'CAP Strategic Plans'] },
];

const BY_ID = new Map(ACTS.map((act) => [act.id, act]));

export function actById(id: string): Act | undefined {
  return BY_ID.get(id);
}

/** "32024R1689" → "2024/1689": la forma con cui l'atto è citato nei testi. */
export function actNumber(celex: string): string {
  return `${celex.slice(1, 5)}/${Number(celex.slice(6))}`;
}

export function actKind(celex: string): 'Regolamento' | 'Direttiva' {
  return celex[5] === 'L' ? 'Direttiva' : 'Regolamento';
}

export function eurlexUrl(celex: string): string {
  return `https://eur-lex.europa.eu/legal-content/IT/TXT/?uri=CELEX:${celex}`;
}

const fold = (text: string): string => text.normalize('NFD').replace(/\p{Diacritic}/gu, '');
const escape = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const EDGE_BEFORE = '(?<![\\p{L}\\p{N}])';
const EDGE_AFTER = '(?![\\p{L}\\p{N}])';

function phrasePattern(phrase: string): string {
  // "Net-Zero Industry Act" deve trovare anche "Net Zero Industry Act" e gli a capo in mezzo.
  return fold(phrase).split(/[\s-]+/).map(escape).join('[\\s-]+');
}

export interface ActMatcher {
  id: string;
  test: (foldedText: string) => boolean;
}

export function compileActs(acts: readonly Act[]): ActMatcher[] {
  return acts.map((act) => {
    const loose = new RegExp(`${EDGE_BEFORE}(?:${act.phrases.map(phrasePattern).join('|')})${EDGE_AFTER}`, 'iu');
    const strict = [...(act.acronyms ?? []).map(escape), `(?<!\\d)${escape(actNumber(act.celex))}(?!\\d)`];
    const exact = new RegExp(`${EDGE_BEFORE}(?:${strict.join('|')})${EDGE_AFTER}`, 'u');
    return { id: act.id, test: (text) => loose.test(text) || exact.test(text) };
  });
}

/** Gli atti nominati in un testo libero, per nome, sigla o numero. */
export function matchActs(text: string, matchers: readonly ActMatcher[]): string[] {
  const folded = fold(text);
  return matchers.filter((m) => m.test(folded)).map((m) => m.id);
}
