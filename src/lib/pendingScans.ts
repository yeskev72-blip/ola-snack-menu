/**
 * File d'attente des photos prises sans réseau.
 *
 * Le réseau tombe souvent : dans un maquis, en brousse, dans un sous-sol. Jusqu'ici l'analyse
 * était refusée et la photo perdue. Elle est maintenant gardée sur le téléphone, et proposée
 * à l'analyse dès que la connexion revient.
 *
 * La photo est conservée en base64 plutôt qu'en fichier : c'est déjà ce que l'analyse envoie,
 * et cela évite d'ajouter une dépendance native, qui obligerait à reconstruire l'APK au lieu
 * d'une simple mise à jour à distance.
 *
 * Module pur, sans dépendance React Native : testé avec `node --test`. Le stockage est dans
 * src/lib/pendingScansStore.ts.
 */

export type PendingScan = {
  id: string;
  /** JPEG encodé, tel qu'il sera envoyé à l'analyse. */
  base64: string;
  hint: string | null;
  createdAt: string;
};

/**
 * Au-delà, les plus anciennes sont abandonnées : une photo de la semaine dernière n'intéresse
 * plus personne, et la file ne doit pas grossir sans fin sur un téléphone peu équipé.
 */
export const MAX_PENDING = 5;

/** Affichable par <Image> sans écrire de fichier. */
export const pendingPhotoUri = (scan: PendingScan): string => `data:image/jpeg;base64,${scan.base64}`;

/** Ajoute en gardant les plus récentes, de la plus ancienne à la plus récente. */
export function addPending(list: PendingScan[], scan: PendingScan, max = MAX_PENDING): PendingScan[] {
  return [...list.filter((s) => s.id !== scan.id), scan].slice(-max);
}

export function removePending(list: PendingScan[], id: string): PendingScan[] {
  return list.filter((s) => s.id !== id);
}

/**
 * Relit le contenu du stockage sans jamais lever : une entrée abîmée est ignorée plutôt que
 * d'empêcher l'app de démarrer. Une photo perdue est un désagrément, pas une panne.
 */
export function parsePending(raw: string | null | undefined): PendingScan[] {
  if (!raw) return [];
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  const scans: PendingScan[] = [];
  for (const entry of data) {
    if (typeof entry !== 'object' || entry === null) continue;
    const { id, base64, hint, createdAt } = entry as Record<string, unknown>;
    if (typeof id !== 'string' || !id) continue;
    if (typeof base64 !== 'string' || !base64) continue;
    if (typeof createdAt !== 'string' || !createdAt) continue;
    scans.push({ id, base64, hint: typeof hint === 'string' && hint ? hint : null, createdAt });
  }
  return scans.slice(-MAX_PENDING);
}
