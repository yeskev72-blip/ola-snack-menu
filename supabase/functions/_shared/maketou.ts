/**
 * Maketou (vente du Premium) : API publique v1 (https://docs-api.maketou.com).
 *   POST /api/v1/stores/cart/checkout   crée un panier pour un produit → { cart, redirectUrl }
 *   GET  /api/v1/stores/cart/{cartId}   statut du panier (completed = payé)
 * Authentification : « Authorization: Bearer <clé API> ». Pas de webhook public : le paiement est
 * confirmé en relisant le panier. Sans dépendance : `fetch` est injectable.
 */

export const MAKETOU_BASE_URL = 'https://api.maketou.net';

export const OFFERS = ['monthly', 'yearly'] as const;
export type Offer = (typeof OFFERS)[number];

/** Jours de Premium crédités par offre. */
export const OFFER_DAYS: Record<Offer, number> = { monthly: 30, yearly: 365 };

export const isOffer = (v: unknown): v is Offer => typeof v === 'string' && (OFFERS as readonly string[]).includes(v);

export const isUuid = (v: unknown): v is string =>
  typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

export type CartStatus = 'waiting_payment' | 'completed' | 'abandoned' | 'payment_failed';

/** « 2 000 FCFA / mois » (espace insécable entre les milliers). */
export function priceLabel(amount: number, currencyLabel: string, offer: Offer): string {
  const digits = String(Math.round(amount)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${digits} ${currencyLabel} / ${offer === 'monthly' ? 'mois' : 'an'}`;
}

export type MaketouConfig = { apiKey: string; baseUrl?: string; timeoutMs?: number };

export class MaketouError extends Error {
  readonly httpStatus: number;
  readonly code: string | null;
  constructor(message: string, httpStatus: number, code: string | null) {
    super(message);
    this.name = 'MaketouError';
    this.httpStatus = httpStatus;
    this.code = code;
  }
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (o: Obj, k: string) => (typeof o[k] === 'string' ? (o[k] as string) : '');

async function call(config: MaketouConfig, method: 'GET' | 'POST', path: string, body: unknown, fetchImpl: typeof fetch): Promise<Obj> {
  const response = await fetchImpl(`${(config.baseUrl ?? MAKETOU_BASE_URL).replace(/\/$/, '')}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(config.timeoutMs ?? 15_000),
  });
  const json = (await response.json().catch(() => null)) as unknown;
  const data: Obj = isObj(json) ? json : {};
  if (!response.ok) {
    const code = str(data, 'code') || null;
    const detail = str(data, 'message') || code || response.statusText;
    throw new MaketouError(`Maketou HTTP ${response.status} : ${detail}`.slice(0, 500), response.status, code);
  }
  return data;
}

export type CartInput = {
  productDocumentId: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  redirectURL: string;
  meta: Record<string, string>;
};

export type CartCheckout = { cartId: string; redirectUrl: string };

/** Crée le panier et renvoie la page de paiement Maketou (mobile money ou carte). */
export async function createCart(config: MaketouConfig, input: CartInput, fetchImpl: typeof fetch = fetch): Promise<CartCheckout> {
  const data = await call(config, 'POST', '/api/v1/stores/cart/checkout', input, fetchImpl);
  const cart = isObj(data.cart) ? data.cart : {};
  const cartId = str(cart, 'id');
  const redirectUrl = str(data, 'redirectUrl');
  if (!isUuid(cartId) || !/^https:\/\//.test(redirectUrl)) {
    throw new MaketouError('Maketou : réponse de création de panier incomplète', 200, null);
  }
  return { cartId, redirectUrl };
}

export type CartState = { id: string; status: string; paymentId: string | null; meta: Record<string, string> };

/** Statut d'un panier ; null s'il n'existe pas. */
export async function getCart(config: MaketouConfig, cartId: string, fetchImpl: typeof fetch = fetch): Promise<CartState | null> {
  let data: Obj;
  try {
    data = await call(config, 'GET', `/api/v1/stores/cart/${encodeURIComponent(cartId)}`, undefined, fetchImpl);
  } catch (e) {
    if (e instanceof MaketouError && e.httpStatus === 404) return null;
    throw e;
  }
  const meta: Record<string, string> = {};
  if (isObj(data.meta)) for (const [k, v] of Object.entries(data.meta)) if (typeof v === 'string') meta[k] = v;
  return { id: str(data, 'id'), status: str(data, 'status'), paymentId: str(data, 'paymentId') || null, meta };
}
