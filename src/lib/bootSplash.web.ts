/**
 * Retire l'écran de démarrage du web, écrit en dur dans +html.tsx.
 *
 * Il est dans le document lui-même, donc il s'affiche dès la première image rendue par le
 * navigateur, avant même que le code de l'application soit chargé. C'est justement l'intervalle
 * qui paraissait long : page blanche, puis apparition brutale.
 *
 * Il disparaît en fondu plutôt que d'un coup : l'app semble se poser dessus au lieu de le
 * remplacer.
 */
const ID = 'demarrage';
const FONDU_MS = 320;

export function hideBootSplash(): void {
  const node = document.getElementById(ID);
  if (!node) return;
  node.style.transition = `opacity ${FONDU_MS}ms ease-out`;
  node.style.opacity = '0';
  node.style.pointerEvents = 'none';
  // Retiré du document une fois le fondu fini : laissé en place, il garderait le lecteur
  // d'écran sur un contenu qui n'existe plus à l'image.
  setTimeout(() => node.remove(), FONDU_MS);
}
