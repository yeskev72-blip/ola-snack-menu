/**
 * Message bref de confirmation, affiché puis effacé tout seul.
 *
 * ToastAndroid de React Native n'existe pas sur le web : l'appel y lève une erreur. Posé après
 * une action réussie — un repas enregistré, un profil modifié —, il faisait échouer la suite,
 * et l'écran annonçait une erreur alors que l'enregistrement avait eu lieu.
 *
 * Une seule implémentation pour les deux plateformes, plutôt qu'un message système d'un côté et
 * autre chose de l'autre : l'app doit se ressembler partout. L'affichage est dans Toaster.
 */

export type ToastDuration = 'short' | 'long';

export const TOAST_MS: Record<ToastDuration, number> = { short: 2200, long: 3800 };

export type Toast = { id: number; message: string; duration: ToastDuration };

let next = 1;
const listeners = new Set<(toast: Toast) => void>();

export function showToast(message: string, duration: ToastDuration = 'short'): void {
  const toast = { id: next++, message, duration };
  for (const listener of listeners) listener(toast);
}

export function subscribeToast(listener: (toast: Toast) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
