import Storage from 'expo-sqlite/kv-store';
import { useEffect, useMemo, useState } from 'react';

import type { Food } from '@/lib/database.types';
import { unitsFor } from '@/lib/portions';
import { supabase } from '@/lib/supabase';

/**
 * Table des plats gardée en cache sur le téléphone : le calcul des calories et la saisie
 * manuelle fonctionnent hors ligne. Rafraîchie au plus une fois par jour quand le réseau est là.
 */

export type LocalFood = Pick<
  Food,
  'food_key' | 'label_fr' | 'aliases' | 'categorie' | 'kcal_100g' | 'proteines_100g' | 'glucides_100g' | 'lipides_100g' | 'portion_reperes' | 'verified'
>;

const CACHE_KEY = 'foods:v1';
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

type Cache = { fetchedAt: number; foods: LocalFood[] };

let memory: LocalFood[] | null = null;
let pending: Promise<LocalFood[]> | null = null;
const listeners = new Set<(foods: LocalFood[]) => void>();

async function readCache(): Promise<Cache | null> {
  try {
    const raw = await Storage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as Cache) : null;
  } catch {
    return null;
  }
}

async function fetchRemote(): Promise<LocalFood[] | null> {
  const { data, error } = await supabase
    .from('foods')
    .select('food_key, label_fr, aliases, categorie, kcal_100g, proteines_100g, glucides_100g, lipides_100g, portion_reperes, verified')
    .order('label_fr');
  if (error || !data) return null;
  await Storage.setItem(CACHE_KEY, JSON.stringify({ fetchedAt: Date.now(), foods: data } satisfies Cache));
  return data;
}

function publish(foods: LocalFood[]) {
  memory = foods;
  for (const listener of listeners) listener(foods);
}

/** Charge la table (mémoire → cache local → serveur si le cache a plus d'un jour). */
export function loadFoods(force = false): Promise<LocalFood[]> {
  if (memory && !force) return Promise.resolve(memory);
  pending ??= (async () => {
    try {
      const cache = await readCache();
      if (cache) publish(cache.foods);
      if (force || !cache || Date.now() - cache.fetchedAt > MAX_AGE_MS) {
        const fresh = await fetchRemote().catch(() => null);
        if (fresh) publish(fresh);
      }
      return memory ?? [];
    } finally {
      pending = null;
    }
  })();
  return pending;
}

/** Table des plats pour les écrans, indexée par food_key. */
export function useFoods() {
  const [foods, setFoods] = useState<LocalFood[]>(memory ?? []);

  useEffect(() => {
    listeners.add(setFoods);
    void loadFoods().then(setFoods);
    return () => {
      listeners.delete(setFoods);
    };
  }, []);

  const byKey = useMemo(() => new Map(foods.map((f) => [f.food_key, f])), [foods]);
  return { foods, byKey, loaded: foods.length > 0 };
}

/** Recherche tolérante (accents, casse) sur le libellé et les autres noms. */
export function searchFoods(foods: LocalFood[], query: string): LocalFood[] {
  // Sans accents ni majuscules (repli sans normalize si le moteur JS ne la fournit pas).
  const normalize = (s: string) => {
    const lower = s.toLowerCase();
    try {
      return lower.normalize('NFD').replace(/[̀-ͯ]/g, '');
    } catch {
      return lower;
    }
  };
  const q = normalize(query.trim());
  if (!q) return foods;
  return foods.filter((f) => [f.label_fr, ...f.aliases].some((name) => normalize(name).includes(q)));
}

/** Portion proposée à l'ajout : le repère le plus courant de l'aliment, sinon 100 g. */
export function defaultGrams(food: Pick<LocalFood, 'portion_reperes'>): number {
  const preferred = ['assiette', 'boule', 'louche', 'unite', 'morceau', 'bol', 'verre', 'cuillere'];
  const reperes = food.portion_reperes ?? {};
  for (const name of preferred) {
    const grams = reperes[name];
    if (grams) return grams;
  }
  return unitsFor(reperes)[0]?.grams ?? 100;
}
