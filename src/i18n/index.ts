import { en } from './en';
import { fr, type Messages } from './fr';
import { DEFAULT_LOCALE, deviceLanguages, pickLocale } from './pickLocale';

export const locales = { fr, en } satisfies Record<string, Messages>;
export type Locale = keyof typeof locales;

const availableLocales = Object.keys(locales) as Locale[];

/**
 * L'app suit la langue du téléphone, et retombe sur le français — le marché visé est
 * francophone — quand cette langue n'est pas traduite. Résolu une fois au chargement : la
 * langue du système ne change pas sans redémarrage de l'app.
 */
let current: Locale = pickLocale(deviceLanguages(), availableLocales, DEFAULT_LOCALE as Locale);

export function setLocale(locale: Locale) {
  current = locale;
}

export function getLocale(): Locale {
  return current;
}

type Leaves<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];

export type MessageKey = Leaves<Messages>;

/** t('journal.target', { kcal: 2100 }) → « Cible : 2100 kcal » */
export function t(key: MessageKey, vars?: Record<string, string | number>): string {
  let node: unknown = locales[current];
  for (const part of key.split('.')) {
    node = (node as Record<string, unknown>)[part];
  }
  let text = typeof node === 'string' ? node : key;
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.replaceAll(`{${name}}`, String(value));
    }
  }
  return text;
}
