/**
 * Chargement de la police sur les plateformes natives : rien à faire.
 *
 * Plus Jakarta Sans est gravée dans l'APK par le plugin expo-font (voir app.config.ts), donc
 * elle est déjà disponible au premier rendu. La version web, elle, n'a pas d'APK où graver quoi
 * que ce soit : son implémentation est dans appFonts.web.ts.
 */
export function useAppFonts(): boolean {
  return true;
}
