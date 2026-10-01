/**
 * Rappels quotidiens de saisie des repas.
 *
 * Une app de suivi alimentaire vit sur l'habitude : qui oublie de noter son déjeuner arrête en
 * quelques jours. Un rappel à l'heure des repas est le levier de rétention le mieux établi de
 * cette catégorie.
 *
 * Les rappels tombent APRÈS le repas, pas avant : on note ce qu'on a mangé, pas ce qu'on va
 * manger. Les heures suivent les habitudes d'Afrique de l'Ouest.
 *
 * Module pur, sans dépendance React Native : testé avec `node --test`. La programmation réelle
 * est dans src/lib/remindersStore.ts.
 */

import type { MessageKey } from '@/i18n';

export type Reminder = {
  /** Sert d'identifiant de notification : reprogrammer remplace au lieu d'empiler. */
  id: string;
  hour: number;
  minute: number;
  bodyKey: MessageKey;
};

export const REMINDERS: readonly Reminder[] = [
  { id: 'calbasse-petit-dejeuner', hour: 9, minute: 30, bodyKey: 'reminders.breakfast' },
  { id: 'calbasse-dejeuner', hour: 14, minute: 30, bodyKey: 'reminders.lunch' },
  { id: 'calbasse-diner', hour: 21, minute: 0, bodyKey: 'reminders.dinner' },
] as const;

/**
 * Vérifie qu'une liste de rappels est programmable : heures valides, dans l'ordre, sans doublon
 * d'identifiant ni d'horaire. Deux rappels à la même minute n'en feraient qu'un sur le téléphone.
 */
export function remindersAreValid(reminders: readonly Reminder[]): boolean {
  if (reminders.length === 0) return false;
  const ids = new Set<string>();
  const times = new Set<number>();
  let previous = -1;
  for (const { id, hour, minute } of reminders) {
    if (!Number.isInteger(hour) || hour < 0 || hour > 23) return false;
    if (!Number.isInteger(minute) || minute < 0 || minute > 59) return false;
    const time = hour * 60 + minute;
    if (time <= previous) return false;
    if (ids.has(id) || times.has(time)) return false;
    ids.add(id);
    times.add(time);
    previous = time;
  }
  return true;
}
