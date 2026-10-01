import * as Notifications from 'expo-notifications';
import Storage from 'expo-sqlite/kv-store';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { t } from '@/i18n';
import { REMINDERS, remindersAreValid } from '@/lib/reminders';

/**
 * Programmation des rappels quotidiens. Les horaires sont dans reminders.ts, module pur et
 * testé ; ce fichier parle au système et au stockage.
 *
 * Tout est local : aucune notification ne vient d'un serveur, donc ni compte Firebase, ni
 * jeton d'appareil, ni donnée envoyée à qui que ce soit.
 */

const KEY = 'reminders:enabled:v1';
const CHANNEL = 'rappels';

let memory: boolean | null = null;
const listeners = new Set<(on: boolean) => void>();

function publish(on: boolean): void {
  memory = on;
  for (const listener of listeners) listener(on);
}

export async function loadRemindersEnabled(): Promise<boolean> {
  if (memory !== null) return memory;
  let raw: string | null = null;
  try {
    raw = await Storage.getItem(KEY);
  } catch {
    // Stockage indisponible : les rappels sont simplement considérés comme éteints.
  }
  const on = raw === '1';
  publish(on);
  return on;
}

/**
 * Android groupe les notifications par canal, et c'est le canal qui porte l'importance : sans
 * lui, le rappel arriverait silencieux et passerait inaperçu.
 */
async function ensureChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL, {
    name: t('reminders.channel'),
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

async function cancelAll(): Promise<void> {
  await Promise.all(REMINDERS.map((r) => Notifications.cancelScheduledNotificationAsync(r.id).catch(() => undefined)));
}

/**
 * Reprogramme les trois rappels. Chaque notification porte son identifiant fixe, donc rappeler
 * cette fonction remplace les rappels existants au lieu de les empiler.
 */
async function schedule(): Promise<void> {
  if (!remindersAreValid(REMINDERS)) return;
  await ensureChannel();
  await cancelAll();
  for (const reminder of REMINDERS) {
    await Notifications.scheduleNotificationAsync({
      identifier: reminder.id,
      content: { title: t('reminders.title'), body: t(reminder.bodyKey) },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        channelId: CHANNEL,
        hour: reminder.hour,
        minute: reminder.minute,
      },
    });
  }
}

/**
 * Active ou coupe les rappels. Renvoie l'état réellement obtenu : l'utilisateur peut refuser
 * l'autorisation système, auquel cas l'interrupteur doit revenir sur « éteint » plutôt que de
 * prétendre que des rappels arriveront.
 */
export async function setRemindersEnabled(on: boolean): Promise<boolean> {
  let active = false;
  if (on) {
    const { granted, canAskAgain } = await Notifications.getPermissionsAsync();
    const allowed = granted || (canAskAgain && (await Notifications.requestPermissionsAsync()).granted);
    if (allowed) {
      await schedule();
      active = true;
    }
  } else {
    await cancelAll();
  }
  publish(active);
  try {
    await Storage.setItem(KEY, active ? '1' : '0');
  } catch {
    // Préférence non conservée : les rappels restent actifs pour cette installation.
  }
  return active;
}

/**
 * Remet les rappels en place au démarrage. Android efface les notifications programmées après
 * une mise à jour de l'app ou un redémarrage du téléphone : sans cela, les rappels
 * disparaîtraient en silence et l'utilisateur croirait les avoir encore.
 */
export async function restoreReminders(): Promise<void> {
  if (!(await loadRemindersEnabled())) return;
  const { granted } = await Notifications.getPermissionsAsync();
  if (granted) await schedule();
  else await setRemindersEnabled(false);
}

export function useRemindersEnabled(): boolean {
  const [on, setOn] = useState(memory ?? false);
  useEffect(() => {
    listeners.add(setOn);
    void loadRemindersEnabled();
    return () => {
      listeners.delete(setOn);
    };
  }, []);
  return on;
}
