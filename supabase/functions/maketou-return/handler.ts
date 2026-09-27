/**
 * Edge Function maketou-return : page de retour du navigateur après le paiement Maketou.
 * GET ?intent=<id> : le paiement préparé par create-checkout est relu chez Maketou et, s'il est payé,
 * le Premium est crédité aussitôt. L'identifiant seul ne donne aucun droit : seul le statut
 * « completed » lu chez Maketou avec la clé API crédite, une fois par panier.
 */

import { isUuid } from '../_shared/maketou.ts';
import { type SettleDeps, settleIntent, type StoredIntent } from '../_shared/settle.ts';

export type Deps = SettleDeps & {
  loadIntent: (id: string) => Promise<StoredIntent | null>;
};

export const PAGES = {
  paid: 'Paiement reçu, merci ! Retourne dans l’application Calbasse : ton Premium est actif.',
  waiting: 'Paiement en cours de validation. Retourne dans l’application Calbasse et touche « J’ai payé : actualiser » dans quelques instants.',
  failed: 'Le paiement n’a pas abouti. Retourne dans l’application Calbasse pour réessayer.',
};

const text = (body: string) => new Response(body, { status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });

export function createHandler(deps: Deps) {
  return async function handle(req: Request): Promise<Response> {
    if (req.method !== 'GET') return new Response('method_not_allowed', { status: 405 });
    const id = new URL(req.url).searchParams.get('intent');
    if (!isUuid(id)) return text(PAGES.waiting);

    try {
      const intent = await deps.loadIntent(id);
      if (!intent) return text(PAGES.waiting);
      const result = await settleIntent(deps, intent);
      if (result === 'paid' || result === 'already_paid') return text(PAGES.paid);
      if (result === 'not_paid') return text(PAGES.failed);
      return text(PAGES.waiting);
    } catch (e) {
      deps.log('vérification au retour impossible', { intentId: id, error: String(e) });
      return text(PAGES.waiting);
    }
  };
}
