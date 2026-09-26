/**
 * Edge Function create-checkout : prépare le paiement CinetPay de l'offre Premium choisie.
 * Réservée aux comptes e-mail (un invité doit d'abord créer son compte). Le montant, l'offre et
 * l'utilisateur sont fixés ici et enregistrés (payment_intents) avant d'ouvrir la page CinetPay.
 * Corps : { action: 'offers' } → pays et prix disponibles ;
 * { offer, country_code, first_name, last_name, phone } → { url }.
 */

import {
  COUNTRIES,
  type Currency,
  isOffer,
  newMerchantTransactionId,
  type Offer,
  OFFERS,
  type PaymentInit,
  type PaymentInput,
  priceLabel,
  toE164,
} from '../_shared/cinetpay.ts';

/** Prix par devise ; une devise sans prix rend ses pays indisponibles. */
export type Prices = Partial<Record<Currency, Record<Offer, number>>>;

export type Intent = {
  merchantTransactionId: string;
  userId: string;
  offer: Offer;
  amount: number;
  currency: Currency;
  country: string;
};

export type Deps = {
  getUser: (token: string) => Promise<{ id: string; email: string | null; isAnonymous: boolean } | null>;
  /** Pays dont le compte CinetPay est configuré (clé et mot de passe présents). */
  enabledCountries: string[];
  prices: Prices;
  /** Adresse publique de la fonction cinetpay-webhook (notification et pages de retour). */
  webhookUrl: string;
  saveIntent: (intent: Intent) => Promise<void>;
  attachIntent: (merchantTransactionId: string, init: PaymentInit) => Promise<void>;
  createPayment: (country: string, input: PaymentInput) => Promise<PaymentInit>;
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

/** Pays proposés : compte configuré et prix défini pour sa devise, dans l'ordre de COUNTRIES. */
export function availableCountries(deps: Pick<Deps, 'enabledCountries' | 'prices'>) {
  return Object.entries(COUNTRIES)
    .filter(([code, c]) => deps.enabledCountries.includes(code) && deps.prices[c.currency])
    .map(([code, c]) => {
      const price = deps.prices[c.currency]!;
      return {
        code,
        name: c.name,
        currency: c.currency,
        calling_code: c.callingCode,
        offers: OFFERS.map((offer) => ({ offer, amount: price[offer], label: priceLabel(price[offer], c.currency, offer) })),
      };
    });
}

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

    const countries = availableCountries(deps);
    if (body.action === 'offers') return json(200, { countries });

    if (user.isAnonymous || !user.email) {
      return fail(403, 'account_required', 'Crée ton compte avec ton e-mail avant de passer Premium.');
    }
    if (!isOffer(body.offer)) return fail(400, 'bad_request', 'Offre inconnue.');
    const offer = body.offer;
    const country = countries.find((c) => c.code === (typeof body.country_code === 'string' ? body.country_code.trim().toUpperCase() : ''));
    if (!country) return fail(400, 'country_unavailable', "Le paiement n'est pas encore disponible dans ce pays.");

    const firstName = clean(body.first_name, 60);
    const lastName = clean(body.last_name, 60);
    if (firstName.length < 2 || lastName.length < 2) return fail(400, 'bad_request', 'Indique ton prénom et ton nom (2 lettres au moins).');
    const phone = typeof body.phone === 'string' ? toE164(body.phone, country.calling_code) : null;
    if (!phone) return fail(400, 'bad_request', `Numéro de téléphone invalide pour ce pays (indicatif +${country.calling_code}).`);

    const amount = country.offers.find((o) => o.offer === offer)!.amount;
    const intent: Intent = {
      merchantTransactionId: newMerchantTransactionId(),
      userId: user.id,
      offer,
      amount,
      currency: country.currency,
      country: country.code,
    };

    try {
      // Enregistré avant l'appel : la notification ne peut concerner qu'un paiement préparé ici.
      await deps.saveIntent(intent);
      const init = await deps.createPayment(country.code, {
        currency: country.currency,
        merchantTransactionId: intent.merchantTransactionId,
        amount,
        successUrl: `${deps.webhookUrl}?page=success`,
        failedUrl: `${deps.webhookUrl}?page=failed`,
        notifyUrl: deps.webhookUrl,
        designation: offer === 'monthly' ? 'Calbasse Premium 1 mois' : 'Calbasse Premium 1 an',
        firstName,
        lastName,
        email: user.email,
        phoneE164: phone,
      });
      await deps.attachIntent(intent.merchantTransactionId, init);
      deps.log('paiement créé', { userId: user.id, offer, country: country.code, merchantTransactionId: intent.merchantTransactionId });
      return json(200, { url: init.paymentUrl });
    } catch (e) {
      deps.log('création du paiement impossible', { userId: user.id, offer, country: country.code, error: String(e) });
      return fail(502, 'checkout_failed', "Le paiement n'a pas pu être préparé. Réessaie dans un instant.");
    }
  };
}
