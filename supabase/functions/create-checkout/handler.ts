/**
 * Edge Function create-checkout : crée la page de paiement Chariow de l'offre Premium choisie.
 * Réservée aux comptes e-mail (un invité doit d'abord créer son compte). L'identifiant de
 * l'utilisateur part dans les métadonnées de la vente : c'est lui que la notification créditera.
 * Corps : { action: 'offers' } → offres affichables ;
 * { offer, first_name, last_name, phone, country_code, discount_code? } → { url }.
 */

import { type CheckoutInput, isOffer, type Offer, OFFERS } from '../_shared/chariow.ts';

export type OfferConfig = { productId: string | null; label: string | null };

export type Deps = {
  getUser: (token: string) => Promise<{ id: string; email: string | null; isAnonymous: boolean } | null>;
  offers: Record<Offer, OfferConfig>;
  redirectUrl: string | null;
  createCheckout: (input: CheckoutInput) => Promise<string>;
  log: (message: string, extra?: Record<string, unknown>) => void;
};

const HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: HEADERS });
const fail = (status: number, error: string, message: string) => json(status, { error, message });

const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, max) : '');

export function createHandler(deps: Deps) {
  return async function handle(req: Request): Promise<Response> {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: HEADERS });
    if (req.method !== 'POST') return fail(405, 'method_not_allowed', 'Utilise POST.');

    const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '').trim();
    const user = token ? await deps.getUser(token).catch(() => null) : null;
    if (!user) return fail(401, 'unauthorized', 'Connexion requise.');

    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return fail(400, 'bad_request', 'Corps JSON invalide.');
    }

    if (body.action === 'offers') {
      return json(200, {
        offers: OFFERS.map((offer) => ({ offer, label: deps.offers[offer].label, available: deps.offers[offer].productId !== null })),
      });
    }

    if (user.isAnonymous || !user.email) {
      return fail(403, 'account_required', 'Crée ton compte avec ton e-mail avant de passer Premium.');
    }
    if (!isOffer(body.offer)) return fail(400, 'bad_request', 'Offre inconnue.');
    const productId = deps.offers[body.offer].productId;
    if (!productId) return fail(503, 'offer_unavailable', "Cette offre n'est pas encore disponible.");

    const firstName = clean(body.first_name, 50);
    const lastName = clean(body.last_name, 50);
    const phone = typeof body.phone === 'string' ? body.phone.replace(/\D/g, '') : '';
    const countryCode = typeof body.country_code === 'string' ? body.country_code.trim().toUpperCase() : '';
    if (!firstName || !lastName) return fail(400, 'bad_request', 'Indique ton prénom et ton nom.');
    if (phone.length < 6 || phone.length > 15) return fail(400, 'bad_request', 'Numéro de téléphone invalide.');
    if (!/^[A-Z]{2}$/.test(countryCode)) return fail(400, 'bad_request', 'Pays invalide.');
    const discountCode = typeof body.discount_code === 'string' ? body.discount_code.trim().slice(0, 100) : '';

    try {
      const url = await deps.createCheckout({
        productId,
        email: user.email,
        firstName,
        lastName,
        phone,
        countryCode,
        metadata: { user_id: user.id, offer: body.offer },
        redirectUrl: deps.redirectUrl,
        discountCode: discountCode || null,
      });
      deps.log('paiement créé', { userId: user.id, offer: body.offer });
      return json(200, { url });
    } catch (e) {
      deps.log('création du paiement impossible', { userId: user.id, offer: body.offer, error: String(e) });
      // Code promo refusé par Chariow : message dédié plutôt qu'une panne générique.
      if (discountCode && /discount|coupon|promo|code/i.test(String(e))) {
        return fail(400, 'invalid_discount', 'Ce code promo n’est pas valable pour cette offre.');
      }
      return fail(502, 'checkout_failed', "Le paiement n'a pas pu être préparé. Réessaie dans un instant.");
    }
  };
}
