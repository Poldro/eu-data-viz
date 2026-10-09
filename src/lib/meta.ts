export interface Source {
  id: string;
  name: string;
  url: string;
  /** Periodo di riferimento dichiarato dalla fonte. */
  asOf: string;
}

export interface Meta {
  /** Quando la pipeline ha scaricato i dati (ISO 8601). */
  generatedAt: string;
  sources: Source[];
}
