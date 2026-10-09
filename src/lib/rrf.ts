/** Sovvenzioni e prestiti, un valore per anno a partire da `Rrf.firstYear`, in euro. */
export interface RrfSplit {
  grants: number[];
  loans: number[];
}

export interface RrfCountry {
  /** Dotazione complessiva del piano, ricavata dal rapporto tra ricevuto e quota dell'allocazione. */
  allocation: number;
  /** Fondi versati dalla Commissione allo Stato. */
  received: RrfSplit;
  /** Spesa effettivamente sostenuta dallo Stato con quei fondi. */
  spent: RrfSplit;
}

/** Dispositivo per la ripresa e la resilienza (dati Eurostat), per Stato membro. */
export interface Rrf {
  firstYear: number;
  lastYear: number;
  countries: Record<string, RrfCountry>;
  eu: RrfCountry;
}

export interface RrfTotals {
  allocation: number;
  received: number;
  spent: number;
  loansReceived: number;
  receivedShare: number;
  spentShare: number;
}

const sum = (values: readonly number[]) => values.reduce((a, b) => a + b, 0);

export function rrfTotals(country: RrfCountry): RrfTotals {
  const loansReceived = sum(country.received.loans);
  const received = sum(country.received.grants) + loansReceived;
  const spent = sum(country.spent.grants) + sum(country.spent.loans);
  const share = (part: number) => (country.allocation > 0 ? part / country.allocation : 0);
  return { allocation: country.allocation, received, spent, loansReceived, receivedShare: share(received), spentShare: share(spent) };
}
