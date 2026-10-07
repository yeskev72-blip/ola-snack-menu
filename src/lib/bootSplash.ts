/**
 * Écran de démarrage du web : rien à faire sur mobile.
 *
 * Sur Android, expo-splash-screen couvre déjà le temps de chargement. L'implémentation web est
 * dans bootSplash.web.ts.
 */
export function hideBootSplash(): void {
  // Sans effet : l'écran de démarrage natif est géré par expo-splash-screen.
}
