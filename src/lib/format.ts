const number = (digits: number) =>
  // useGrouping 'always': in italiano le migliaia a quattro cifre resterebbero senza punto (2867).
  new Intl.NumberFormat('it-IT', { minimumFractionDigits: digits, maximumFractionDigits: digits, useGrouping: 'always' });

const INT = number(0);
const ONE = number(1);

/** Importo in euro in forma leggibile: "44,6 mld €", "320 mln €", "12.400 €". */
export function eur(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1e9) return `${ONE.format(value / 1e9)} mld €`;
  if (abs >= 1e6) return `${(abs >= 1e8 ? INT : ONE).format(value / 1e6)} mln €`;
  return `${INT.format(value)} €`;
}

/** Come `eur`, ma senza simbolo: per assi e celle strette. */
export function eurShort(value: number): string {
  return eur(value).replace(' €', '');
}

export function pct(share: number, digits: 0 | 1 = 0): string {
  return `${(digits ? ONE : INT).format(share * 100)}%`;
}

export function int(value: number): string {
  return INT.format(value);
}

/** Euro per abitante, arrotondati all'unità. */
export function perHead(value: number): string {
  return `${INT.format(value)} €`;
}

export function dateIt(iso: string): string {
  return new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Rome' }).format(
    new Date(iso),
  );
}

const MONTHS = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

/** "2026-08" → "agosto 2026"; valori in altro formato tornano invariati. */
export function monthIt(yearMonth: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(yearMonth);
  if (!match) return yearMonth;
  return `${MONTHS[Number(match[2]) - 1] ?? match[2]} ${match[1]}`;
}

/** Posizione in classifica con l'ordinale italiano: 1 → "1º". */
export function ordinal(rank: number): string {
  return `${rank}º`;
}

/** Minuscola iniziale per inserire un'etichetta a metà frase, senza toccare le sigle (REACT-EU, PMI). */
export function lowerFirst(text: string): string {
  return /^[A-ZÀ-Ý][a-zà-ÿ]/.test(text) ? text[0].toLowerCase() + text.slice(1) : text;
}
