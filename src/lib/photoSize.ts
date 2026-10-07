/**
 * Calculs de taille pour la préparation d'une photo. Module sans dépendance, donc testable.
 *
 * Les proportions d'une photo ne doivent jamais changer : un plat aplati n'est plus le même
 * plat, ni pour l'œil ni pour le modèle qui l'analyse.
 */

/** Dimensions ramenées sous `maxSide`, proportions gardées. Une petite photo n'est pas agrandie. */
export function fitWithin(width: number, height: number, maxSide: number): { width: number; height: number } {
  const side = Math.max(width, height);
  if (!Number.isFinite(side) || side <= 0) return { width: 0, height: 0 };
  const ratio = Math.min(1, maxSide / side);
  return { width: Math.max(1, Math.round(width * ratio)), height: Math.max(1, Math.round(height * ratio)) };
}

/**
 * Options de redimensionnement pour createImageBitmap.
 *
 * Une seule dimension est fournie, jamais les deux : le navigateur calcule alors l'autre en
 * gardant les proportions. Fournir les deux étire l'image jusqu'à remplir le cadre demandé —
 * c'est ainsi que toutes les photos se retrouvaient carrées.
 *
 * Rien n'est demandé quand les dimensions d'origine sont inconnues ou déjà assez petites :
 * l'image est alors décodée telle quelle, quitte à la réduire ensuite au dessin.
 */
export function resizeOptions(
  width: number,
  height: number,
  maxSide: number,
): { resizeWidth?: number; resizeHeight?: number; resizeQuality?: 'high' } {
  const side = Math.max(width, height);
  if (!Number.isFinite(side) || side <= maxSide) return {};
  return width >= height
    ? { resizeWidth: maxSide, resizeQuality: 'high' }
    : { resizeHeight: maxSide, resizeQuality: 'high' };
}
