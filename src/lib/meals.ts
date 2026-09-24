import NetInfo from '@react-native-community/netinfo';
import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';
import { useEffect, useState } from 'react';

import type { Json, TypeRepas } from '@/lib/database.types';
import type { Nutrients } from '@/lib/nutrition';
import { supabase } from '@/lib/supabase';

/**
 * Journal local-first : chaque repas est d'abord écrit dans SQLite sur le téléphone
 * (le journal marche sans réseau), puis synchronisé vers Supabase dès que possible.
 * La synchro est idempotente (identifiants générés par l'app) : la relancer ne crée pas de doublon.
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
};

let database: SQLiteDatabase | null = null;

/** Base locale ouverte à la première utilisation (schéma créé si besoin). */
function db(): SQLiteDatabase {
  if (database) return database;
  const opened = openDatabaseSync('calebasse.db');
  opened.execSync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS meals (
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
    CREATE INDEX IF NOT EXISTS meals_user_eaten ON meals (user_id, eaten_at);
  `);
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
// Notifications de changement (le journal se met à jour après un enregistrement)
// ---------------------------------------------------------------------------

const listeners = new Set<() => unknown>();
function notify() {
  for (const listener of listeners) listener();
}

// ---------------------------------------------------------------------------
// Écriture et lecture locales
// ---------------------------------------------------------------------------

export async function saveMeal(meal: Omit<LocalMeal, 'synced'>): Promise<void> {
  await db().runAsync(
    `INSERT OR REPLACE INTO meals (id, user_id, eaten_at, type_repas, items_json, total_json, confidence, photo_path, correction_json, synced)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
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

/** Bornes (ISO) d'une journée locale du téléphone. */
export function dayBounds(date: Date): { start: string; end: string } {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

export async function mealsBetween(userId: string, start: string, end: string): Promise<LocalMeal[]> {
  const rows = await db().getAllAsync<Row>(
    'SELECT * FROM meals WHERE user_id = ? AND eaten_at >= ? AND eaten_at < ? ORDER BY eaten_at',
    userId,
    start,
    end,
  );
  return rows.map(fromRow);
}

export async function pendingCount(userId: string): Promise<number> {
  const row = await db().getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM meals WHERE user_id = ? AND synced = 0', userId);
  return row?.n ?? 0;
}

/** Repas d'une journée, rechargés automatiquement après chaque enregistrement ou synchro. */
export function useMealsOfDay(userId: string | null, date: Date) {
  const [meals, setMeals] = useState<LocalMeal[]>([]);
  const dayKey = date.toDateString();

  useEffect(() => {
    if (!userId) return;
    let active = true;
    const load = async () => {
      const { start, end } = dayBounds(new Date(dayKey));
      const rows = await mealsBetween(userId, start, end);
      if (active) setMeals(rows);
    };
    void load();
    listeners.add(load);
    return () => {
      active = false;
      listeners.delete(load);
    };
  }, [userId, dayKey]);

  return userId ? meals : [];
}

// ---------------------------------------------------------------------------
// Synchronisation vers Supabase
// ---------------------------------------------------------------------------

let syncing: Promise<void> | null = null;

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

/** Envoie les repas en attente. Sans réseau, ne fait rien : ils restent en file. */
export function syncMeals(userId: string): Promise<void> {
  syncing ??= (async () => {
    try {
      const state = await NetInfo.fetch();
      if (state.isConnected === false) return;
      const rows = await db().getAllAsync<Row>('SELECT * FROM meals WHERE user_id = ? AND synced = 0 ORDER BY eaten_at', userId);
      for (const row of rows) {
        try {
          await pushMeal(fromRow(row));
          await db().runAsync('UPDATE meals SET synced = 1 WHERE id = ?', row.id);
        } catch {
          // Réseau coupé ou erreur serveur : on réessaiera à la prochaine occasion.
          break;
        }
      }
      if (rows.length > 0) notify();
    } finally {
      syncing = null;
    }
  })();
  return syncing;
}

/** Relance la synchro au retour du réseau. À appeler une fois pour l'utilisateur connecté. */
export function startAutoSync(userId: string): () => void {
  void syncMeals(userId);
  return NetInfo.addEventListener((state) => {
    if (state.isConnected) void syncMeals(userId);
  });
}
