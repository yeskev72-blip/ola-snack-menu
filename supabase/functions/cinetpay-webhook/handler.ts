/**
 * Edge Function cinetpay-webhook : notification de paiement CinetPay et pages de retour.
 * La notification n'est qu'un signal : elle doit porter le notify_token de la transaction, préparée par
 * create-checkout (payment_intents), puis le statut est relu auprès de CinetPay. Seul SUCCESS crédite
 * le Premium, une seule fois par transaction (grant_premium, idempotent).
 * GET ou POST avec ?page=success|failed : page affichée au client après le paiement.
 */

import { type Currency, OFFER_DAYS, type Offer, parseNotification, type PaymentState, safeEqual } from '../_shared/cinetpay.ts';

export type StoredIntent = {
  merchantTransactionId: string;
  userId: string;
  offer: Offer;
  amount: number;
  currency: Currency;
  country: string;
  notifyToken: string | null;
  status: 'pending' | 'paid' | 'failed';
};

export type Deps = {
  loadIntent: (merchantTransactionId: string) => Promise<StoredIntent | null>;
  findPayment: (country: string, merchantTransactionId: string) => Promise<PaymentState | null>;
  grantPremium: (
    input: { userId: string; saleId: string; offer: Offer; days: number; amount: number; currency: Currency },
  ) => Promise<{ granted: boolean; premiumUntil: string | null }>;
  markIntent: (merchantTransactionId: string, status: 'paid' | 'failed') => Promise<void>;
  log: (message: string, extra?: Record<string, unknown>) => void;
};

/** Statuts définitifs sans paiement (d'après l'API CinetPay). */
const FAILED_STATUSES = ['FAILED', 'EXPIRED', 'INSUFFICIENT_BALANCE', 'NOT_ALLOWED', 'USER_IS_BLOCKED'];

const PAGES = {
  success: 'Paiement reçu, merci ! Retourne dans l’application Calbasse : ton Premium s’active dans quelques secondes.',
  failed: 'Le paiement n’a pas abouti. Retourne dans l’application Calbasse pour réessayer.',
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
const text = (body: string) => new Response(body, { status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });

export function createHandler(deps: Deps) {
  async function processNotification(raw: string, contentType: string | null): Promise<{ status: number; body: Record<string, unknown> }> {
    const notification = parseNotification(raw, contentType);
    if (!notification) return { status: 400, body: { error: 'bad_request' } };
    const { merchantTransactionId } = notification;

    const intent = await deps.loadIntent(merchantTransactionId);
    if (!intent) {
      deps.log('notification pour une transaction inconnue', { merchantTransactionId });
      return { status: 200, body: { ignored: 'unknown_transaction' } };
    }
    if (!intent.notifyToken) {
      // Paiement en cours de préparation : CinetPay renverra la notification.
      return { status: 503, body: { error: 'not_ready' } };
    }
    if (!safeEqual(notification.notifyToken, intent.notifyToken)) {
      deps.log('notification refusée : notify_token invalide', { merchantTransactionId });
      return { status: 401, body: { error: 'unauthorized' } };
    }
    if (intent.status === 'paid') return { status: 200, body: { granted: false, already: true } };

    let payment: PaymentState | null;
    try {
      payment = await deps.findPayment(intent.country, merchantTransactionId);
    } catch (e) {
      deps.log('lecture du paiement impossible', { merchantTransactionId, error: String(e) });
      return { status: 502, body: { error: 'payment_unavailable' } };
    }
    if (!payment) return { status: 200, body: { ignored: 'unknown_payment' } };
    if (
      (payment.merchantTransactionId && payment.merchantTransactionId !== merchantTransactionId) ||
      (payment.transactionId && notification.transactionId && payment.transactionId !== notification.transactionId)
    ) {
      deps.log('notification refusée : identifiants incohérents', { merchantTransactionId });
      return { status: 400, body: { error: 'mismatch' } };
    }

    if (payment.status !== 'SUCCESS') {
      if (FAILED_STATUSES.includes(payment.status)) await deps.markIntent(merchantTransactionId, 'failed').catch(() => undefined);
      deps.log('paiement non abouti', { merchantTransactionId, status: payment.status });
      return { status: 200, body: { ignored: 'not_paid', status: payment.status } };
    }

    try {
      const result = await deps.grantPremium({
        userId: intent.userId,
        saleId: merchantTransactionId,
        offer: intent.offer,
        days: OFFER_DAYS[intent.offer],
        amount: intent.amount,
        currency: intent.currency,
      });
      await deps.markIntent(merchantTransactionId, 'paid');
      deps.log(result.granted ? 'Premium crédité' : 'paiement déjà crédité', {
        merchantTransactionId,
        userId: intent.userId,
        offer: intent.offer,
        until: result.premiumUntil,
      });
      return { status: 200, body: { granted: result.granted, premium_until: result.premiumUntil } };
    } catch (e) {
      deps.log('crédit du Premium impossible', { merchantTransactionId, error: String(e) });
      return { status: 500, body: { error: 'grant_failed' } };
    }
  }

  return async function handle(req: Request): Promise<Response> {
    const page = new URL(req.url).searchParams.get('page');
    const pageText = page === 'success' || page === 'failed' ? PAGES[page] : null;

    if (req.method === 'GET') return pageText ? text(pageText) : text('ok');
    if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

    const raw = await req.text();
    // Retour du navigateur (page de succès ou d'échec) : on traite la notification si elle est jointe.
    if (pageText) {
      if (raw.trim()) await processNotification(raw, req.headers.get('content-type')).catch(() => undefined);
      return text(pageText);
    }
    const result = await processNotification(raw, req.headers.get('content-type'));
    return json(result.status, result.body);
  };
}
