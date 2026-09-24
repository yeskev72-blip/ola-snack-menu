import NetInfo from '@react-native-community/netinfo';
import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import type { Json, TypeRepas } from '@/lib/database.types';
import { dayKey, lastDays, parseDayKey, totalsByDay, type DayTotals } from '@/lib/days';
import type { Nutrients } from '@/lib/nutrition';
import { supabase } from '@/lib/supabase';

/**
 * Journal local-first : chaque repas est d'abord écrit dans SQLite sur le téléphone
 * (le journal marche sans réseau), puis synchronisé vers Supabase dès que possible.
 * - Envoi idempotent (identifiants générés par l'app) : rejouer la synchro ne crée pas de doublon.
 * - Suppression : le repas est masqué tout de suite, puis supprimé sur le serveur à la synchro.
 * - Récupération : les repas du serveur (autre téléphone, réinstallation) sont rapatriés,
 *   sans jamais écraser un repas local en attente d'envoi.
 */

export type SavedItem = {
  food_key: string | null;
  label: string;
  grams: number;
  estimated: boolean;
} & Nutrients;

export type Correction = { predicted: unknown; corrected: unknown; photo_path: string | null };

export type LocalMeal = {
  id: string;
  user_id: string;
  eaten_at: string;
  type_repas: TypeRepas;
  items: SavedItem[];
  total: Nutrients;
  confidence: number | null;
  photo_path: string | null;
  /** Correction à envoyer (prédiction de l'IA vs saisie finale) ; null si rien n'a changé. */
  correction: (Correction & { id: string }) | null;
  synced: boolean;
};

type Row = {
  id: string;
  user_id: string;
  eaten_at: string;
  type_repas: TypeRepas;
  items_json: string;
  total_json: string;
  confidence: number | null;
  photo_path: string | null;
  correction_json: string | null;
  synced: number;
  deleted: number;
};

/** Période rapatriée depuis le serveur (couvre l'historique sur 30 jours). */
const PULL_DAYS = 35;
/** Délai minimal entre deux récupérations automatiques. */
const PULL_INTERVAL_MS = 5 * 60 * 1000;

// ---------------------------------------------------------------------------
// Base locale et migrations (PRAGMA user_version)
// ---------------------------------------------------------------------------

const MIGRATIONS = [
  // v1 : table des repas (phase 4)
  `CREATE TABLE IF NOT EXISTS meals (
     id TEXT PRIMARY KEY NOT NULL,
     user_id TEXT NOT NULL,
     eaten_at TEXT NOT NULL,
     type_repas TEXT NOT NULL,
     items_json TEXT NOT NULL,
     total_json TEXT NOT NULL,
     confidence REAL,
     photo_path TEXT,
     correction_json TEXT,
     synced INTEGER NOT NULL DEFAULT 0
   );
   CREATE INDEX IF NOT EXISTS meals_user_eaten ON meals (user_id, eaten_at);`,
  // v2 : suppression différée (synchronisée au retour du réseau)
  `ALTER TABLE meals ADD COLUMN deleted INTEGER NOT NULL DEFAULT 0;`,
];

let database: SQLiteDatabase | null = null;

/** Base locale ouverte à la première utilisation, migrée jusqu'à la dernière version. */
function db(): SQLiteDatabase {
  if (database) return database;
  const opened = openDatabaseSync('calbasse.db');
  opened.execSync('PRAGMA journal_mode = WAL;');
  const version = opened.getFirstSync<{ user_version: number }>('PRAGMA user_version')?.user_version ?? 0;
  // Les installations de la phase 4 ont déjà la table sans user_version : v1 est idempotente.
  for (let v = version; v < MIGRATIONS.length; v++) {
    opened.withTransactionSync(() => {
      opened.execSync(MIGRATIONS[v]!);
      opened.execSync(`PRAGMA user_version = ${v + 1}`);
    });
  }
  database = opened;
  return opened;
}

function fromRow(row: Row): LocalMeal {
  return {
    id: row.id,
    user_id: row.user_id,
    eaten_at: row.eaten_at,
    type_repas: row.type_repas,
    items: JSON.parse(row.items_json) as SavedItem[],
    total: JSON.parse(row.total_json) as Nutrients,
    confidence: row.confidence,
    photo_path: row.photo_path,
    correction: row.correction_json ? (JSON.parse(row.correction_json) as LocalMeal['correction']) : null,
    synced: row.synced === 1,
  };
}

// ---------------------------------------------------------------------------
// Notifications de changement (les écrans se mettent à jour après chaque écriture)
// ---------------------------------------------------------------------------

const listeners = new Set<() => unknown>();
function notify() {
  for (const listener of listeners) listener();
}

/** Recharge `load` maintenant puis à chaque changement du journal local. */
function useLocalQuery<T>(load: (() => Promise<T>) | null, initial: T, deps: unknown[]): T {
  const [value, setValue] = useState<T>(initial);
  useEffect(() => {
    if (!load) return;
    let active = true;
    const run = async () => {
      const result = await load();
      if (active) setValue(result);
    };
    void run();
    listeners.add(run);
    return () => {
      active = false;
      listeners.delete(run);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dépendances fournies par l'appelant
  }, deps);
  return load ? value : initial;
}

// ---------------------------------------------------------------------------
// Écriture et lecture locales
// ---------------------------------------------------------------------------

export async function saveMeal(meal: Omit<LocalMeal, 'synced'>): Promise<void> {
  await db().runAsync(
    `INSERT OR REPLACE INTO meals (id, user_id, eaten_at, type_repas, items_json, total_json, confidence, photo_path, correction_json, synced, deleted)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0)`,
    meal.id,
    meal.user_id,
    meal.eaten_at,
    meal.type_repas,
    JSON.stringify(meal.items),
    JSON.stringify(meal.total),
    meal.confidence,
    meal.photo_path,
    meal.correction ? JSON.stringify(meal.correction) : null,
  );
  notify();
  void syncMeals(meal.user_id);
}

/** Masque le repas tout de suite ; la suppression part au serveur à la prochaine synchro. */
export async function deleteMeal(userId: string, id: string): Promise<void> {
  await db().runAsync('UPDATE meals SET deleted = 1, synced = 0 WHERE id = ? AND user_id = ?', id, userId);
  notify();
  void syncMeals(userId);
}

/** Bornes (ISO) d'une journée locale du téléphone. */
export function dayBounds(date: Date): { start: string; end: string } {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

export async function mealsBetween(userId: string, start: string, end: string): Promise<LocalMeal[]> {
  const rows = await db().getAllAsync<Row>(
    'SELECT * FROM meals WHERE user_id = ? AND deleted = 0 AND eaten_at >= ? AND eaten_at < ? ORDER BY eaten_at',
    userId,
    start,
    end,
  );
  return rows.map(fromRow);
}

export async function getMeal(userId: string, id: string): Promise<LocalMeal | null> {
  const row = await db().getFirstAsync<Row>('SELECT * FROM meals WHERE id = ? AND user_id = ? AND deleted = 0', id, userId);
  return row ? fromRow(row) : null;
}

export async function pendingCount(userId: string): Promise<number> {
  const row = await db().getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM meals WHERE user_id = ? AND synced = 0', userId);
  return row?.n ?? 0;
}

/** Repas d'une journée (clé « AAAA-MM-JJ »), à jour après chaque écriture ou synchro. */
export function useMealsOfDay(userId: string | null, day: string): LocalMeal[] {
  return useLocalQuery(
    userId
      ? () => {
          const { start, end } = dayBounds(parseDayKey(day));
          return mealsBetween(userId, start, end);
        }
      : null,
    [],
    [userId, day],
  );
}

/** Un repas, ou null s'il n'existe pas (ou plus). */
export function useMeal(userId: string | null, id: string): LocalMeal | null | undefined {
  return useLocalQuery<LocalMeal | null | undefined>(userId ? () => getMeal(userId, id) : null, undefined, [userId, id]);
}

/** Totaux quotidiens des n derniers jours (aujourd'hui inclus). */
export function useDailyTotals(userId: string | null, days: number, today: string): DayTotals[] {
  return useLocalQuery(
    userId
      ? async () => {
          const keys = lastDays(days, parseDayKey(today));
          const start = dayBounds(parseDayKey(keys[0]!)).start;
          const end = dayBounds(parseDayKey(today)).end;
          return totalsByDay(await mealsBetween(userId, start, end), keys);
        }
      : null,
    [],
    [userId, days, today],
  );
}

/** Nombre de repas en attente d'envoi (affiché dans le journal et avant la déconnexion). */
export function usePendingCount(userId: string | null): number {
  return useLocalQuery(userId ? () => pendingCount(userId) : null, 0, [userId]);
}

/** Efface les données locales d'un utilisateur (déconnexion, suppression du compte). */
export async function clearLocalData(userId: string): Promise<void> {
  await db().runAsync('DELETE FROM meals WHERE user_id = ?', userId);
  lastPull.delete(userId);
  notify();
}

// ---------------------------------------------------------------------------
// Synchronisation avec Supabase
// ---------------------------------------------------------------------------

let syncing: Promise<void> | null = null;
const lastPull = new Map<string, number>();

async function isConnected(): Promise<boolean> {
  const state = await NetInfo.fetch();
  return state.isConnected !== false;
}

async function pushMeal(meal: LocalMeal): Promise<void> {
  const { error: mealError } = await supabase.from('meals').upsert({
    id: meal.id,
    user_id: meal.user_id,
    eaten_at: meal.eaten_at,
    type_repas: meal.type_repas,
    photo_path: meal.photo_path,
    total_kcal: meal.total.kcal,
    total_proteines: meal.total.proteines,
    total_glucides: meal.total.glucides,
    total_lipides: meal.total.lipides,
    confidence_globale: meal.confidence,
  });
  if (mealError) throw mealError;

  // Remplace les éléments du repas (idempotent si la synchro est rejouée).
  const { error: deleteError } = await supabase.from('meal_items').delete().eq('meal_id', meal.id);
  if (deleteError) throw deleteError;
  if (meal.items.length > 0) {
    const { error: itemsError } = await supabase.from('meal_items').insert(
      meal.items.map((item, position) => ({
        meal_id: meal.id,
        position,
        food_key: item.food_key,
        label: item.label,
        grams: item.grams,
        kcal: item.kcal,
        proteines: item.proteines,
        glucides: item.glucides,
        lipides: item.lipides,
        estimated: item.estimated,
      })),
    );
    if (itemsError) throw itemsError;
  }

  if (meal.correction) {
    const { error: correctionError } = await supabase.from('corrections').upsert(
      {
        id: meal.correction.id,
        user_id: meal.user_id,
        meal_id: meal.id,
        predicted: meal.correction.predicted as Json,
        corrected: meal.correction.corrected as Json,
        photo_path: meal.correction.photo_path,
      },
      { ignoreDuplicates: true },
    );
    if (correctionError) throw correctionError;
  }
}

async function pushPending(userId: string): Promise<boolean> {
  const rows = await db().getAllAsync<Row>('SELECT * FROM meals WHERE user_id = ? AND synced = 0 ORDER BY eaten_at', userId);
  for (const row of rows) {
    try {
      if (row.deleted) {
        // Supprime aussi les éléments et corrections (cascade côté serveur).
        const { error } = await supabase.from('meals').delete().eq('id', row.id);
        if (error) throw error;
        await db().runAsync('DELETE FROM meals WHERE id = ?', row.id);
      } else {
        await pushMeal(fromRow(row));
        await db().runAsync('UPDATE meals SET synced = 1 WHERE id = ? AND synced = 0', row.id);
      }
    } catch {
      // Réseau coupé ou erreur serveur : on réessaiera à la prochaine occasion.
      return rows.length > 0;
    }
  }
  return rows.length > 0;
}

/** Rapatrie les repas récents du serveur (sans toucher aux repas locaux en attente). */
async function pullRecent(userId: string): Promise<boolean> {
  const since = new Date();
  since.setDate(since.getDate() - PULL_DAYS);
  const { data: meals, error } = await supabase
    .from('meals')
    .select('*')
    .eq('user_id', userId)
    .gte('eaten_at', since.toISOString())
    .order('eaten_at');
  if (error || !meals) return false;

  const ids = meals.map((m) => m.id);
  const items = new Map<string, SavedItem[]>();
  if (ids.length > 0) {
    const { data: rows, error: itemsError } = await supabase.from('meal_items').select('*').in('meal_id', ids).order('position');
    if (itemsError || !rows) return false;
    for (const it of rows) {
      const list = items.get(it.meal_id) ?? [];
      list.push({
        food_key: it.food_key,
        label: it.label,
        grams: Number(it.grams),
        estimated: it.estimated,
        kcal: Number(it.kcal),
        proteines: Number(it.proteines),
        glucides: Number(it.glucides),
        lipides: Number(it.lipides),
      });
      items.set(it.meal_id, list);
    }
  }

  const local = db();
  await local.withTransactionAsync(async () => {
    for (const m of meals) {
      // INSERT OR IGNORE puis mise à jour seulement si la ligne locale est déjà synchronisée.
      await local.runAsync(
        `INSERT OR IGNORE INTO meals (id, user_id, eaten_at, type_repas, items_json, total_json, confidence, photo_path, correction_json, synced, deleted)
         VALUES (?, ?, ?, ?, '[]', '{}', NULL, NULL, NULL, 1, 0)`,
        m.id,
        m.user_id,
        m.eaten_at,
        m.type_repas,
      );
      await local.runAsync(
        `UPDATE meals SET eaten_at = ?, type_repas = ?, items_json = ?, total_json = ?, confidence = ?, photo_path = ?
         WHERE id = ? AND synced = 1`,
        new Date(m.eaten_at).toISOString(),
        m.type_repas,
        JSON.stringify(items.get(m.id) ?? []),
        JSON.stringify({
          kcal: Number(m.total_kcal),
          proteines: Number(m.total_proteines),
          glucides: Number(m.total_glucides),
          lipides: Number(m.total_lipides),
        } satisfies Nutrients),
        m.confidence_globale === null ? null : Number(m.confidence_globale),
        m.photo_path,
        m.id,
      );
    }
    // Repas supprimés depuis un autre appareil : absents du serveur mais synchronisés ici.
    const placeholders = ids.map(() => '?').join(',');
    await local.runAsync(
      `DELETE FROM meals WHERE user_id = ? AND synced = 1 AND eaten_at >= ?${ids.length ? ` AND id NOT IN (${placeholders})` : ''}`,
      userId,
      since.toISOString(),
      ...ids,
    );
  });
  lastPull.set(userId, Date.now());
  return true;
}

/**
 * Envoie les repas en attente puis, au plus toutes les 5 minutes (ou si `pull` est forcé),
 * récupère les repas du serveur. Sans réseau, ne fait rien : tout reste en file.
 */
export function syncMeals(userId: string, options: { pull?: boolean } = {}): Promise<void> {
  syncing ??= (async () => {
    try {
      if (!(await isConnected())) return;
      let changed = await pushPending(userId);
      const due = options.pull || Date.now() - (lastPull.get(userId) ?? 0) > PULL_INTERVAL_MS;
      if (due && (await pendingCount(userId)) === 0) {
        changed = (await pullRecent(userId).catch(() => false)) || changed;
      }
      if (changed) notify();
    } finally {
      syncing = null;
    }
  })();
  return syncing;
}

/** Synchro au démarrage, au retour du réseau et au retour de l'app au premier plan. */
export function startAutoSync(userId: string): () => void {
  void syncMeals(userId, { pull: true });
  const net = NetInfo.addEventListener((state) => {
    if (state.isConnected) void syncMeals(userId);
  });
  const app = AppState.addEventListener('change', (state) => {
    if (state === 'active') void syncMeals(userId);
  });
  return () => {
    net();
    app.remove();
  };
}

/** Clé de la journée courante (se met à jour quand l'écran revient au premier plan). */
export const todayKey = () => dayKey(new Date());
