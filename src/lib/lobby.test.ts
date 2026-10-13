import { describe, expect, it } from 'vitest';
import { actById, actKind, actNumber, ACTS, compileActs, eurlexUrl, matchActs } from './acts';
import type { FtsBeneficiary } from './fts';
import { atLeast, entityKey, isDoubtful, lobbyCategoryLabel, lobbyGroup, matchBeneficiaries, rangeLabel, type LobbyOrg } from './lobby';

const matchers = compileActs(ACTS);
const found = (text: string) => matchActs(text, matchers);

describe('elenco degli atti', () => {
  it('ha identificativi unici e numeri CELEX ben formati', () => {
    expect(new Set(ACTS.map((a) => a.id)).size).toBe(ACTS.length);
    expect(new Set(ACTS.map((a) => a.celex)).size).toBe(ACTS.length);
    for (const act of ACTS) {
      expect(act.celex).toMatch(/^3(2019|202\d)[RL]\d{4}$/);
      expect(act.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(act.phrases.length).toBeGreaterThan(0);
    }
  });

  it('ricava numero, tipo e indirizzo dal CELEX', () => {
    expect(actNumber('32024R1689')).toBe('2024/1689');
    expect(actNumber('32025R0040')).toBe('2025/40');
    expect(actKind('32022L2464')).toBe('Direttiva');
    expect(actKind('32024R1689')).toBe('Regolamento');
    expect(eurlexUrl('32024R1689')).toBe('https://eur-lex.europa.eu/legal-content/IT/TXT/?uri=CELEX:32024R1689');
    expect(actById('dsa')?.celex).toBe('32022R2065');
    expect(actById('inesistente')).toBeUndefined();
  });
});

describe('riconoscimento degli atti nei dossier dichiarati', () => {
  it('trova un atto per nome, senza badare a maiuscole, trattini e a capo', () => {
    expect(found('We follow the artificial intelligence act closely')).toEqual(['ai-act']);
    expect(found('Net Zero\nIndustry Act')).toEqual(['nzia']);
    expect(found('net-zero industry act')).toEqual(['nzia']);
  });

  it('trova un atto per sigla solo se scritta in maiuscolo e isolata', () => {
    expect(found('DSA; DMA')).toEqual(['dsa', 'dma']);
    expect(found('dma')).toEqual([]);
    expect(found('PYJAMAS and CODSAL')).toEqual([]);
  });

  it('trova un atto per numero, in qualunque lingua', () => {
    expect(found('Règlement (UE) 2024/1689')).toEqual(['ai-act']);
    expect(found('Verordnung 2025/40')).toEqual(['ppwr']);
    // 2025/401 è un altro atto: il numero deve finire lì.
    expect(found('Regulation 2025/401')).toEqual([]);
  });

  it('non scambia una parola più lunga per il nome di un atto', () => {
    expect(found('Database Act')).toEqual([]);
    expect(found('pre-taxonomy')).toEqual(['taxonomy']);
    expect(found('taxonomyish')).toEqual([]);
    expect(found('')).toEqual([]);
  });

  it('ignora gli accenti nei nomi in altre lingue', () => {
    expect(found('La Politica Agricola Común y la política agrícola común')).toEqual(['cap']);
  });
});

describe('fasce e anomalie', () => {
  it('scrive la fascia come è dichiarata', () => {
    expect(rangeLabel(null)).toBe('non dichiarato');
    expect(rangeLabel({ min: 50_000, max: 99_999 })).toBe('50.000 – 99.999 €');
    expect(rangeLabel({ min: 0, max: 9_999 })).toBe('fino a 9.999 €');
    expect(rangeLabel({ min: 10_000_000, max: null })).toBe('oltre 10.000.000 €');
    expect(atLeast({ min: 9_000_000, max: 9_999_999 })).toBe('almeno 9,0 mln €');
    expect(atLeast({ min: 0, max: 9_999 })).toBe('fino a 9.999 €');
  });

  it('segnala i costi sproporzionati rispetto agli addetti', () => {
    expect(isDoubtful({ min: 10_000_000, max: null }, 1)).toBe(true);
    expect(isDoubtful({ min: 10_000_000, max: null }, 17)).toBe(false);
    // Senza addetti dichiarati si ragiona su un quarto di persona: una cifra modesta non è un'anomalia.
    expect(isDoubtful({ min: 100_000, max: 199_999 }, 0)).toBe(false);
    expect(isDoubtful({ min: 500_000, max: 599_999 }, 0)).toBe(true);
    expect(isDoubtful(null, 0)).toBe(false);
  });

  it('traduce le categorie e le raggruppa in famiglie', () => {
    expect(lobbyCategoryLabel('Companies & groups')).toBe('Imprese e gruppi');
    expect(lobbyCategoryLabel('Nuova categoria')).toBe('Nuova categoria');
    expect(lobbyGroup('Trade and business associations')).toBe('business');
    expect(lobbyGroup('Law firms')).toBe('advisers');
    expect(lobbyGroup('Academic institutions')).toBe('other');
  });
});

describe('confronto con i beneficiari dei fondi', () => {
  const org = (over: Partial<LobbyOrg>): LobbyOrg => ({
    id: '1',
    name: 'Università di Bologna',
    country: 'IT',
    category: 'Academic institutions',
    kind: 'budget',
    range: null,
    doubtful: false,
    fte: 1,
    passes: 0,
    grants: 0,
    acts: [],
    ...over,
  });
  const beneficiary = (over: Partial<FtsBeneficiary>): FtsBeneficiary => ({
    name: 'UNIVERSITA DI BOLOGNA',
    country: 'IT',
    type: 'Public Bodies',
    programme: 'Horizon Europe',
    amount: 100,
    commitments: 1,
    ...over,
  });

  it('riconosce lo stesso nome con accenti, maiuscole e punteggiatura diversi', () => {
    expect(entityKey('Robert Bosch GmbH.', 'DE')).toBe(entityKey('ROBERT  BOSCH, GMBH', 'DE'));
    expect(matchBeneficiaries([org({})], [beneficiary({})])).toEqual(new Map([['1', 100]]));
  });

  it('non unisce omonimi di paesi diversi e somma le righe dello stesso beneficiario', () => {
    const found = matchBeneficiaries([org({}), org({ id: '2', country: 'ES' })], [beneficiary({}), beneficiary({ amount: 50 })]);
    expect(found).toEqual(new Map([['1', 150]]));
  });
});
