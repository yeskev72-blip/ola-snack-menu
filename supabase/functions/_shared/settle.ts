/**
 * Confirmation d'un paiement Maketou préparé par create-checkout (payment_intents).
 * Le panier est relu chez Maketou : seul « completed » crédite le Premium, une seule fois par panier
 * (grant_premium, idempotent sur sale_id). Partagé par create-checkout (action « confirm ») et
 * maketou-return (retour du navigateur).
 */

import { type CartState, OFFER_DAYS, type Offer } from './maketou.ts';

export type StoredIntent = {
  id: string;
  cartId: string | null;
  userId: string;
  offer: Offer;
  amount: number;
  currency: string;
  status: 'pending' | 'paid';
};

export type SettleDeps = {
  getCart: (cartId: string) => Promise<CartState | null>;
  grantPremium: (
    input: { userId: string; saleId: string; offer: Offer; days: number; amount: number; currency: string },
  ) => Promise<{ granted: boolean; premiumUntil: string | null }>;
  markPaid: (intentId: string) => Promise<void>;
  log: (message: string, extra?: Record<string, unknown>) => void;
};

export type SettleResult = 'paid' | 'already_paid' | 'waiting' | 'not_paid' | 'unknown' | 'mismatch';

export async function settleIntent(deps: SettleDeps, intent: StoredIntent): Promise<SettleResult> {
  if (intent.status === 'paid') return 'already_paid';
  if (!intent.cartId) return 'unknown';

  const cart = await deps.getCart(intent.cartId);
  if (!cart) return 'unknown';
  // Le panier doit être celui préparé pour cet utilisateur (métadonnées posées à la création).
  if ((cart.id && cart.id !== intent.cartId) || (cart.meta.intentId && cart.meta.intentId !== intent.id) || (cart.meta.userId && cart.meta.userId !== intent.userId)) {
    deps.log('panier incohérent', { intentId: intent.id, cartId: intent.cartId });
    return 'mismatch';
  }
  if (cart.status === 'waiting_payment') return 'waiting';
  if (cart.status !== 'completed') return 'not_paid';

  const result = await deps.grantPremium({
    userId: intent.userId,
    saleId: `maketou:${intent.cartId}`,
    offer: intent.offer,
    days: OFFER_DAYS[intent.offer],
    amount: intent.amount,
    currency: intent.currency,
  });
  await deps.markPaid(intent.id);
  deps.log(result.granted ? 'Premium crédité' : 'paiement déjà crédité', {
    intentId: intent.id,
    cartId: intent.cartId,
    userId: intent.userId,
    offer: intent.offer,
    until: result.premiumUntil,
  });
  return 'paid';
}
