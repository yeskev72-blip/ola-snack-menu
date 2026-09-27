/**
 * Edge Function create-checkout : paiement Maketou de l'offre Premium choisie.
 * Réservée aux comptes e-mail (un invité doit d'abord créer son compte). L'offre, le montant et
 * l'utilisateur sont fixés ici et enregistrés (payment_intents) avant d'ouvrir la page Maketou.
 * Corps :
 *   { action: 'offers' }   → offres disponibles et prix
 *   { action: 'confirm' }  → relit chez Maketou les paiements en attente de l'utilisateur et crédite les payés
 *   { offer, first_name, last_name, phone? } → { url } de la page de paiement
 */

import { type CartCheckout, type CartInput, isOffer, MaketouError, type Offer, OFFERS, priceLabel } from '../_shared/maketou.ts';
import { type OfferConfig } from '../_shared/maketou-env.ts';
import { type SettleDeps, settleIntent, type StoredIntent } from '../_shared/settle.ts';

export type NewIntent = { id: string; userId: string; offer: Offer; amount: number; currency: string };

export type Deps = SettleDeps & {
  getUser: (token: string) => Promise<{ id: string; email: string | null; isAnonymous: boolean } | null>;
  offers: Partial<Record<Offer, OfferConfig>>;
  currency: string;
  currencyLabel: string;
  /** Adresse publique de la fonction maketou-return (retour du navigateur après paiement). */
  returnUrl: string;
  newId: () => string;
  saveIntent: (intent: NewIntent) => Promise<void>;
  attachCart: (intentId: string, cartId: string) => Promise<void>;
  /** Paiements en attente récents de l'utilisateur. */
  pendingIntents: (userId: string) => Promise<StoredIntent[]>;
  createCart: (input: CartInput) => Promise<CartCheckout>;
};

const HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: HEADERS });
const fail = (status: number, error: string, message: string) => json(status, { error, message });

/**
 * Code court joint au message d'erreur pour le support : « 400/INVALID_PRODUCT » (refus de Maketou),
 * « db/42P01 » (table absente, migration oubliée). Jamais de secret ni de texte libre.
 */
export function errorCode(e: unknown): string {
  if (e instanceof MaketouError) return `${e.httpStatus}${e.code ? `/${e.code}` : ''}`;
  if (typeof e === 'object' && e !== null) {
    const code = (e as { code?: unknown }).code;
    if (typeof code === 'string' && /^[A-Za-z0-9_]{1,40}$/.test(code)) return `db/${code}`;
  }
  if (e instanceof Error && /abort|timeout/i.test(e.message)) return 'timeout';
  return 'inconnu';
}

const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, max) : '');

/** Numéro facultatif : chiffres et « + » initial, 8 à 15 chiffres ; sinon ignoré (Maketou le redemandera). */
function cleanPhone(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const digits = v.replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 15) return undefined;
  return v.trim().startsWith('+') || v.trim().startsWith('00') ? `+${digits.replace(/^00/, '')}` : digits;
}

export function createHandler(deps: Deps) {
  const available = () =>
    OFFERS.filter((o) => deps.offers[o]).map((offer) => ({
      offer,
      amount: deps.offers[offer]!.amount,
      label: priceLabel(deps.offers[offer]!.amount, deps.currencyLabel, offer),
    }));

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

    if (body.action === 'offers') return json(200, { offers: available(), currency: deps.currency });

    if (body.action === 'confirm') {
      let paid = 0;
      try {
        for (const intent of await deps.pendingIntents(user.id)) {
          const result = await settleIntent(deps, intent).catch((e) => {
            deps.log('vérification du paiement impossible', { intentId: intent.id, error: String(e) });
            return 'unknown' as const;
          });
          if (result === 'paid') paid++;
        }
      } catch (e) {
        deps.log('lecture des paiements en attente impossible', { userId: user.id, error: String(e) });
        return fail(502, 'confirm_failed', 'Vérification impossible pour le moment. Réessaie dans un instant.');
      }
      return json(200, { paid });
    }

    if (user.isAnonymous || !user.email) {
      return fail(403, 'account_required', 'Crée ton compte avec ton e-mail avant de passer Premium.');
    }
    if (!isOffer(body.offer)) return fail(400, 'bad_request', 'Offre inconnue.');
    const offer = body.offer;
    const config = deps.offers[offer];
    if (!config) return fail(400, 'offer_unavailable', "Le paiement n'est pas encore disponible.");

    const firstName = clean(body.first_name, 60);
    const lastName = clean(body.last_name, 60);
    if (firstName.length < 2 || lastName.length < 2) return fail(400, 'bad_request', 'Indique ton prénom et ton nom (2 lettres au moins).');

    const intent: NewIntent = { id: deps.newId(), userId: user.id, offer, amount: config.amount, currency: deps.currency };
    try {
      // Enregistré avant l'appel : seul un paiement préparé ici peut créditer le Premium.
      await deps.saveIntent(intent);
      const checkout = await deps.createCart({
        productDocumentId: config.productId,
        email: user.email,
        firstName,
        lastName,
        phone: cleanPhone(body.phone),
        redirectURL: `${deps.returnUrl}?intent=${intent.id}`,
        meta: { intentId: intent.id, userId: user.id, offer },
      });
      await deps.attachCart(intent.id, checkout.cartId);
      deps.log('panier créé', { userId: user.id, offer, intentId: intent.id, cartId: checkout.cartId });
      return json(200, { url: checkout.redirectUrl });
    } catch (e) {
      const code = errorCode(e);
      deps.log('création du paiement impossible', { userId: user.id, offer, code, error: String(e) });
      return fail(502, 'checkout_failed', `Le paiement n'a pas pu être préparé. Réessaie dans un instant. (code : ${code})`);
    }
  };
}
