import brand from './brand.json';

/**
 * Nom affiché de l'application. Il se change uniquement dans src/brand.json,
 * que app.config.ts relit aussi pour le nom de l'APK.
 */
export const APP_NAME: string = brand.appName;

/** Compression appliquée à la photo avant envoi. */
export const PHOTO = {
  maxSide: 1024,
  jpegQuality: 0.7,
} as const;
