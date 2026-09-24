import { fr, type Messages } from './fr';

export const locales = { fr } satisfies Record<string, Messages>;
export type Locale = keyof typeof locales;

let current: Locale = 'fr';

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
