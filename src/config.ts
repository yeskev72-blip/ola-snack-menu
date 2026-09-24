import brand from './brand.json';

/**
 * Nom affiché de l'application. Il se change uniquement dans src/brand.json,
 * que app.config.ts relit aussi pour le nom de l'APK.
 */
export const APP_NAME: string = brand.appName;

/** Fuseau de référence pour le « jour » du journal et du quota de scans. */
export const APP_TIMEZONE = 'Africa/Porto-Novo';

/** Scans IA autorisés par jour, vérifiés côté serveur (Edge Function). */
export const DAILY_SCAN_QUOTA = {
  guest: 1,
  free: 3,
} as const;

/** Compression appliquée à la photo avant envoi. */
export const PHOTO = {
  maxSide: 1024,
  jpegQuality: 0.7,
} as const;
