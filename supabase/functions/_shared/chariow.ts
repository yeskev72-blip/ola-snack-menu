/**
 * Chariow (vente de l'abonnement Premium) : appels REST et lecture défensive des réponses.
 * API : https://api.chariow.com/v1, clé en « Authorization: Bearer », réponses { message, data, errors }.
 * Sans dépendance : `fetch` est injectable pour les tests.
 */

export const CHARIOW_API_BASE = 'https://api.chariow.com/v1';

export const OFFERS = ['monthly', 'yearly'] as const;
export type Offer = (typeof OFFERS)[number];

/** Jours de Premium crédités par offre. */
export const OFFER_DAYS: Record<Offer, number> = { monthly: 30, yearly: 365 };

/** Statuts d'une vente payée (les autres : initiated, awaiting_payment, abandoned, failed). */
export const PAID_STATUSES = ['completed', 'settled'];

export const isOffer = (v: unknown): v is Offer => typeof v === 'string' && (OFFERS as readonly string[]).includes(v);

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Parcours en largeur de tous les objets imbriqués (réponses dont la forme exacte peut varier). */
function* walk(value: unknown, maxDepth = 5): Generator<Obj> {
  let level: unknown[] = [value];
  for (let depth = 0; depth <= maxDepth && level.length; depth++) {
    const next: unknown[] = [];
    for (const v of level) {
      if (Array.isArray(v)) next.push(...v);
      else if (isObj(v)) {
        yield v;
        next.push(...Object.values(v));
      }
    }
    level = next;
  }
}

/** Lien de paiement dans la réponse de POST /checkout (le lien de retour que l'on a fourni est ignoré). */
export function findCheckoutUrl(response: unknown): string | null {
  const preferred = ['checkout_url', 'payment_url', 'url', 'link', 'payment_link'];
  const found = new Map<string, string>();
  for (const obj of walk(response)) {
    for (const [key, v] of Object.entries(obj)) {
      if (typeof v !== 'string' || !v.startsWith('https://') || key === 'redirect_url') continue;
      if (!found.has(key)) found.set(key, v);
    }
  }
  for (const key of preferred) if (found.has(key)) return found.get(key)!;
  for (const [key, v] of found) if (/url|link/i.test(key)) return v;
  return null;
}

/** Identifiant de la vente dans une notification (Pulse). La vente est ensuite relue via l'API. */
export function findSaleId(payload: unknown): string | null {
  const str = (v: unknown) => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null);
  for (const obj of walk(payload)) {
    if (str(obj.sale_id)) return str(obj.sale_id);
    if (isObj(obj.sale) && str(obj.sale.id)) return str(obj.sale.id);
  }
  if (isObj(payload)) {
    if (isObj(payload.data) && str(payload.data.id)) return str(payload.data.id);
    if (str(payload.id)) return str(payload.id);
  }
  return null;
}

export type SaleInfo = {
  id: string;
  status: string | null;
  productId: string | null;
  metadata: Record<string, string>;
  amount: number | null;
  currency: string | null;
};

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : null);

/** Lecture d'une vente (GET /sales/{id}), quelle que soit l'enveloppe { data: … }. */
export function readSale(response: unknown, saleId: string): SaleInfo {
  const root = isObj(response) && isObj(response.data) ? response.data : isObj(response) ? response : {};
  const sale = isObj(root.sale) ? root.sale : root;
  const rawMeta = isObj(sale.custom_metadata) ? sale.custom_metadata : isObj(sale.metadata) ? sale.metadata : {};
  const metadata: Record<string, string> = {};
  for (const [k, v] of Object.entries(rawMeta)) if (typeof v === 'string' || typeof v === 'number') metadata[k] = String(v);

  const product = isObj(sale.product) ? sale.product : null;
  const amountObj = isObj(sale.amount) ? sale.amount : null;
  return {
    id: typeof sale.id === 'string' ? sale.id : saleId,
    status: typeof sale.status === 'string' ? sale.status.toLowerCase() : null,
    productId: typeof product?.id === 'string' ? product.id : typeof sale.product_id === 'string' ? sale.product_id : null,
    metadata,
    amount: amountObj ? num(amountObj.value ?? amountObj.amount) : num(sale.amount),
    currency: typeof amountObj?.currency === 'string' ? amountObj.currency : typeof sale.currency === 'string' ? sale.currency : null,
  };
}

/** Message d'erreur lisible d'une réponse Chariow { message, errors }. */
export function chariowError(status: number, body: unknown): string {
  const message = isObj(body) && typeof body.message === 'string' ? body.message : '';
  const errors = isObj(body) && body.errors ? JSON.stringify(body.errors).slice(0, 300) : '';
  return `Chariow HTTP ${status}${message ? ` : ${message}` : ''}${errors && errors !== '[]' && errors !== '{}' ? ` ${errors}` : ''}`;
}

export type ChariowConfig = { apiKey: string; apiBase?: string };

async function request(config: ChariowConfig, method: string, path: string, body: unknown, fetchImpl: typeof fetch) {
  const response = await fetchImpl(`${config.apiBase ?? CHARIOW_API_BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
  const json = await response.json().catch(() => null);
  return { status: response.status, ok: response.ok, json };
}

export type CheckoutInput = {
  productId: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  countryCode: string;
  metadata: Record<string, string>;
  redirectUrl?: string | null;
};

/** Crée une page de paiement Chariow et renvoie son lien. */
export async function createCheckout(config: ChariowConfig, input: CheckoutInput, fetchImpl: typeof fetch = fetch): Promise<string> {
  const res = await request(
    config,
    'POST',
    '/checkout',
    {
      product_id: input.productId,
      email: input.email,
      first_name: input.firstName,
      last_name: input.lastName,
      phone: { number: input.phone, country_code: input.countryCode },
      custom_metadata: input.metadata,
      ...(input.redirectUrl ? { redirect_url: input.redirectUrl } : {}),
    },
    fetchImpl,
  );
  if (!res.ok) throw new Error(chariowError(res.status, res.json));
  const url = findCheckoutUrl(res.json);
  if (!url) throw new Error(`Chariow : lien de paiement absent de la réponse ${JSON.stringify(res.json).slice(0, 300)}`);
  return url;
}

/** Relit une vente auprès de Chariow ; null si elle n'existe pas. */
export async function fetchSale(config: ChariowConfig, saleId: string, fetchImpl: typeof fetch = fetch): Promise<SaleInfo | null> {
  const res = await request(config, 'GET', `/sales/${encodeURIComponent(saleId)}`, undefined, fetchImpl);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(chariowError(res.status, res.json));
  return readSale(res.json, saleId);
}

const toHex = (buf: ArrayBuffer) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');

/** Comparaison en temps constant de deux chaînes. */
export function safeEqual(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  let diff = ea.length ^ eb.length;
  for (let i = 0; i < Math.max(ea.length, eb.length); i++) diff |= (ea[i] ?? 0) ^ (eb[i] ?? 0);
  return diff === 0;
}

/** En-tête x-chariow-signature : « sha256= » + HMAC-SHA256 hexadécimal du corps brut, clé = secret complet. */
export async function verifySignature(rawBody: string, header: string | null, secret: string): Promise<boolean> {
  if (!header || !secret) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const expected = `sha256=${toHex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody)))}`;
  const given = header.trim().toLowerCase().startsWith('sha256=') ? header.trim().toLowerCase() : `sha256=${header.trim().toLowerCase()}`;
  return safeEqual(given, expected);
}
