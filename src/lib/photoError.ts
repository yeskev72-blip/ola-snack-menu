/**
 * Échec de la préparation d'une photo, avec un message déjà écrit pour l'utilisateur.
 *
 * Les étapes qui peuvent échouer savent chacune pourquoi : format illisible, image trop lourde,
 * fichier inaccessible. Ce type permet à l'écran d'afficher cette raison telle quelle, au lieu
 * de la cacher derrière un « Réessaie » qui ne mène nulle part.
 */
export class PhotoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PhotoError';
  }
}
