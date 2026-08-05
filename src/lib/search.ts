/**
 * Accent- and case-insensitive text search helpers.
 *
 * Postgres `ilike` is case-insensitive but not accent-insensitive, so every
 * search filter in the app (server routes and client-side comboboxes) goes
 * through these helpers instead: "angela" matches "Ángela", "nunez" matches
 * "Núñez", and vice versa.
 */

// Unicode combining diacritical marks (U+0300–U+036F), left over after NFD.
const DIACRITICS = /[\u0300-\u036f]/g;

/** Lowercase and strip diacritics: "Ángela" → "angela". */
export function normalizeText(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(DIACRITICS, '')
    .toLowerCase()
    .trim();
}

/** True when `term` is contained in any of `fields`, ignoring case and accents. */
export function matchesTerm(term: string, ...fields: (string | null | undefined)[]): boolean {
  const needle = normalizeText(term);
  if (!needle) return true;
  return fields.some((f) => normalizeText(f).includes(needle));
}
