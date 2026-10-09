export interface FtsBeneficiary {
  name: string;
  /** Codice dello Stato membro, oppure il nome inglese del paese terzo. */
  country: string;
  type: string;
  /** Programma da cui arriva la quota maggiore. */
  programme: string;
  amount: number;
  commitments: number;
}

export interface FtsBucket {
  key: string;
  amount: number;
  commitments: number;
}

/** Aggregati del Financial Transparency System per un anno di bilancio, in euro. */
export interface FtsSummary {
  year: number;
  total: number;
  commitments: number;
  beneficiaries: number;
  byCountry: FtsBucket[];
  byProgramme: FtsBucket[];
  byType: FtsBucket[];
  top: FtsBeneficiary[];
}
