/**
 * Bornes d'un signalement de valeur, partagées par l'écran et par la base.
 *
 * Les mêmes limites sont écrites dans la contrainte CHECK de `public.food_reports` : un message
 * refusé ici ne doit jamais partir, et un message accepté ici ne doit jamais être refusé par le
 * serveur après coup, une fois l'utilisateur hors ligne et le signalement perdu.
 *
 * Module pur, sans dépendance : testé avec `node --test`.
 */

export const REPORT_MAX = 1000;

/** Le message tel qu'il partira : espaces de bord retirés, longueur bornée. */
export function cleanReport(message: string): string {
  return message.trim().slice(0, REPORT_MAX);
}

/** Un signalement vide n'apprend rien à personne : le bouton reste inactif. */
export function isSendableReport(message: string): boolean {
  return cleanReport(message).length > 0;
}
