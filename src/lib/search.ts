/** Sotto questa lunghezza la ricerca non filtra: una lettera sola non restringe nulla. */
export const MIN_QUERY = 2;

/** Chiave di confronto senza maiuscole né accenti: "Università" trova "UNIVERSITA". */
export function searchKey(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleUpperCase('it')
    .trim();
}

/** Vero se la ricerca è troppo corta per filtrare o se il testo la contiene. */
export function matchesQuery(text: string, query: string): boolean {
  const needle = searchKey(query);
  return needle.length < MIN_QUERY || searchKey(text).includes(needle);
}
