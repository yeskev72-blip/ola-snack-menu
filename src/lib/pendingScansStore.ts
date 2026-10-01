import Storage from 'expo-sqlite/kv-store';
import { useEffect, useState } from 'react';

import { addPending, parsePending, type PendingScan, removePending } from '@/lib/pendingScans';

/**
 * Stockage des photos prises hors ligne. La logique de file est dans pendingScans.ts, module
 * pur et testé ; ce fichier ne fait que lire, écrire et prévenir les écrans.
 */

const KEY = 'pendingScans:v1';

let memory: PendingScan[] | null = null;
const listeners = new Set<(scans: PendingScan[]) => void>();

function publish(scans: PendingScan[]): void {
  memory = scans;
  for (const listener of listeners) listener(scans);
}

export async function loadPendingScans(): Promise<PendingScan[]> {
  if (memory) return memory;
  let raw: string | null = null;
  try {
    raw = await Storage.getItem(KEY);
  } catch {
    // Stockage indisponible : on repart d'une file vide plutôt que d'empêcher le scan.
  }
  const scans = parsePending(raw);
  publish(scans);
  return scans;
}

async function write(scans: PendingScan[]): Promise<void> {
  publish(scans);
  try {
    await Storage.setItem(KEY, JSON.stringify(scans));
  } catch {
    // Écriture impossible (stockage plein) : la file reste en mémoire pour cette session.
  }
}

/** Garde une photo pour plus tard. Renvoie la file à jour. */
export async function keepForLater(scan: PendingScan): Promise<PendingScan[]> {
  const scans = addPending(await loadPendingScans(), scan);
  await write(scans);
  return scans;
}

/** Retire une photo analysée, ou abandonnée par l'utilisateur. */
export async function dropPendingScan(id: string): Promise<PendingScan[]> {
  const scans = removePending(await loadPendingScans(), id);
  await write(scans);
  return scans;
}

/** File d'attente courante, tenue à jour après chaque ajout ou retrait. */
export function usePendingScans(): PendingScan[] {
  const [scans, setScans] = useState<PendingScan[]>(memory ?? []);
  useEffect(() => {
    listeners.add(setScans);
    void loadPendingScans();
    return () => {
      listeners.delete(setScans);
    };
  }, []);
  return scans;
}

/** Vide la file : à appeler à la déconnexion, les photos appartiennent à un compte. */
export const clearPendingScans = (): Promise<void> => write([]);
