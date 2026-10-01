/**
 * État de confiance des valeurs nutritionnelles d'un plat.
 * Module pur, sans dépendance React Native : testable avec `node --test`.
 */

/**
 * Un plat dont les valeurs n'ont pas encore été confrontées à la table de composition des
 * aliments d'Afrique de l'Ouest (FAO/INFOODS, 2019). Voir docs/FOODS_TODO.md. L'app doit le
 * dire : ce sont des estimations de départ, pas une référence.
 */
export const isUnverified = (food: { verified: boolean } | null | undefined): boolean => food?.verified === false;
