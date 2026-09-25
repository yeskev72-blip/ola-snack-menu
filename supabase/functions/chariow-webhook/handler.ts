/**
 * Edge Function chariow-webhook : reçoit les notifications de vente de Chariow (Pulse « successful_sale »)
 * et crédite le Premium. Rien n'est cru sur parole : la vente est relue auprès de l'API Chariow avec la clé
 * secrète (statut payé, produit, métadonnées), puis créditée une seule fois (grant_premium, idempotent).
 * Authentification de l'appel : jeton secret dans l'URL (?token=…) ou signature x-chariow-signature.
 */

import { findSaleId, OFFER_DAYS, type Offer, PAID_STATUSES, safeEqual, type SaleInfo, verifySignature } from '../_shared/chariow.ts';

export type Deps = {
  /** Jeton attendu dans l'URL de la notification ; null si non utilisé. */
  webhookToken: string | null;
  /** Secret de signature de la notification (whsec_…) ; null si non utilisé. */
  signingSecret: string | null;
  /** Produit Chariow → offre, pour ne pas dépendre des seules métadonnées. */
  productOffers: Record<string, Offer>;
  fetchSale: (saleId: string) => Promise<SaleInfo | null>;
  grantPremium: (
    input: { userId: string; saleId: string; offer: Offer; days: number; amount: number | null; currency: string | null },
  ) => Promise<{ granted: boolean; premiumUntil: string | null }>;
  log: (message: string, extra?: Record<string, unknown>) => void;
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function createHandler(deps: Deps) {
  return async function handle(req: Request): Promise<Response> {
    if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });
    if (!deps.webhookToken && !deps.signingSecret) {
      deps.log('notification refusée : ni CHARIOW_WEBHOOK_TOKEN ni CHARIOW_WEBHOOK_SECRET configuré');
      return json(500, { error: 'not_configured' });
    }

    const raw = await req.text();
    const token = new URL(req.url).searchParams.get('token');
    const tokenOk = deps.webhookToken !== null && token !== null && safeEqual(token, deps.webhookToken);
    const signatureOk = !tokenOk && deps.signingSecret !== null &&
      (await verifySignature(raw, req.headers.get('x-chariow-signature'), deps.signingSecret));
    if (!tokenOk && !signatureOk) {
      deps.log('notification refusée : jeton ou signature invalide');
      return json(401, { error: 'unauthorized' });
    }

    let payload: unknown;
    try {
      payload = JSON.parse(raw);
    } catch {
      return json(400, { error: 'bad_request' });
    }

    // Réponses 200 « ignored » : la notification est bien reçue, il n'y a rien à créditer (pas de nouvel envoi).
    const saleId = findSaleId(payload);
    if (!saleId) {
      deps.log('notification sans vente', { payload: JSON.stringify(payload).slice(0, 500) });
      return json(200, { ignored: 'no_sale' });
    }

    let sale: SaleInfo | null;
    try {
      sale = await deps.fetchSale(saleId);
    } catch (e) {
      // Erreur temporaire : 502 pour que Chariow renvoie la notification plus tard.
      deps.log('lecture de la vente impossible', { saleId, error: String(e) });
      return json(502, { error: 'sale_unavailable' });
    }
    if (!sale) return json(200, { ignored: 'unknown_sale' });
    if (!sale.status || !PAID_STATUSES.includes(sale.status)) {
      deps.log('vente non payée', { saleId, status: sale.status });
      return json(200, { ignored: 'not_paid' });
    }

    // Seul le produit vendu fait foi (jamais les métadonnées) : une vente d'un autre produit,
    // même moins cher, ne peut pas créditer de Premium.
    const offer = sale.productId ? deps.productOffers[sale.productId] : undefined;
    if (!offer) {
      deps.log('vente d’un autre produit', { saleId, productId: sale.productId });
      return json(200, { ignored: 'other_product' });
    }
    const userId = sale.metadata.user_id;
    if (!userId || !UUID.test(userId)) {
      deps.log('vente sans utilisateur Calbasse', { saleId });
      return json(200, { ignored: 'no_user' });
    }

    try {
      const result = await deps.grantPremium({
        userId,
        saleId: sale.id,
        offer,
        days: OFFER_DAYS[offer],
        amount: sale.amount,
        currency: sale.currency,
      });
      deps.log(result.granted ? 'Premium crédité' : 'vente déjà créditée', { saleId, userId, offer, until: result.premiumUntil });
      return json(200, { granted: result.granted, premium_until: result.premiumUntil });
    } catch (e) {
      deps.log('crédit du Premium impossible', { saleId, userId, error: String(e) });
      return json(500, { error: 'grant_failed' });
    }
  };
}
