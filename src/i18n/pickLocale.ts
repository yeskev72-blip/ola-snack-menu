/**
 * Choix de la langue d'après celle du téléphone.
 *
 * Module pur, sans dépendance React Native : testé avec `node --test`. La lecture de la langue
 * du système passe par Intl, présent dans Hermes, plutôt que par expo-localization — un module
 * natif imposerait de reconstruire l'APK au lieu d'une mise à jour à distance.
 */

/** Langue servie quand celle du téléphone n'est pas couverte : le marché visé est francophone. */
export const DEFAULT_LOCALE = 'fr';

/**
 * Première langue du téléphone que l'app sait parler. Seule la partie avant le tiret compte :
 * « fr-CI », « fr-BE » et « fr » donnent tous le français. Un téléphone peut annoncer plusieurs
 * langues par ordre de préférence, d'où la liste.
 */
export function pickLocale<L extends string>(preferred: readonly string[], available: readonly L[], fallback: L): L {
  for (const tag of preferred) {
    if (typeof tag !== 'string') continue;
    const base = tag.toLowerCase().split(/[-_]/)[0];
    if (!base) continue;
    const match = available.find((l) => l.toLowerCase() === base);
    if (match) return match;
  }
  return fallback;
}

/**
 * Langues du téléphone, de la plus souhaitée à la moins. Renvoie une liste vide si Intl n'est
 * pas disponible : on retombe alors sur la langue par défaut plutôt que d'échouer.
 */
export function deviceLanguages(): string[] {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale;
    return typeof locale === 'string' && locale ? [locale] : [];
  } catch {
    return [];
  }
}
