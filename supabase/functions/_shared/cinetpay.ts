/**
 * CinetPay (vente du Premium) : API REST v1, d'après le SDK PHP officiel (cinetpay/cinetpay-php-sdk).
 *   POST /v1/oauth/login        { api_key, api_password } → access_token (Bearer)
 *   POST /v1/payment            création → payment_url, notify_token, transaction_id
 *   GET  /v1/payment/{merchant_transaction_id}   statut canonique (SUCCESS = payé)
 * Un compte marchand = un pays (devise et indicatif imposés). Sans dépendance : `fetch` est injectable.
 */

export const CINETPAY_BASE_URLS = {
  sandbox: 'https://api.cinetpay.net',
  production: 'https://api.cinetpay.co',
} as const;
export type CinetPayEnvironment = keyof typeof CINETPAY_BASE_URLS;

export const OFFERS = ['monthly', 'yearly'] as const;
export type Offer = (typeof OFFERS)[number];

/** Jours de Premium crédités par offre. */
export const OFFER_DAYS: Record<Offer, number> = { monthly: 30, yearly: 365 };

export const isOffer = (v: unknown): v is Offer => typeof v === 'string' && (OFFERS as readonly string[]).includes(v);

export type Currency = 'XOF' | 'XAF' | 'GNF' | 'CDF';

/** Pays pris en charge par CinetPay : devise et indicatif imposés par le compte du pays. */
export const COUNTRIES: Record<string, { name: string; currency: Currency; callingCode: string }> = {
  BJ: { name: 'Bénin', currency: 'XOF', callingCode: '229' },
  BF: { name: 'Burkina Faso', currency: 'XOF', callingCode: '226' },
  CI: { name: "Côte d'Ivoire", currency: 'XOF', callingCode: '225' },
  ML: { name: 'Mali', currency: 'XOF', callingCode: '223' },
  NE: { name: 'Niger', currency: 'XOF', callingCode: '227' },
  SN: { name: 'Sénégal', currency: 'XOF', callingCode: '221' },
  TG: { name: 'Togo', currency: 'XOF', callingCode: '228' },
  CM: { name: 'Cameroun', currency: 'XAF', callingCode: '237' },
  CF: { name: 'Centrafrique', currency: 'XAF', callingCode: '236' },
  CG: { name: 'Congo', currency: 'XAF', callingCode: '242' },
  GA: { name: 'Gabon', currency: 'XAF', callingCode: '241' },
  GQ: { name: 'Guinée équatoriale', currency: 'XAF', callingCode: '240' },
  TD: { name: 'Tchad', currency: 'XAF', callingCode: '235' },
  GN: { name: 'Guinée', currency: 'GNF', callingCode: '224' },
  CD: { name: 'RD Congo', currency: 'CDF', callingCode: '243' },
};

const CURRENCY_LABEL: Record<Currency, string> = { XOF: 'FCFA', XAF: 'FCFA', GNF: 'GNF', CDF: 'CDF' };

/** « 2 000 FCFA / mois » (espace insécable entre les milliers). */
export function priceLabel(amount: number, currency: Currency, offer: Offer): string {
  const digits = String(Math.round(amount)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${digits} ${CURRENCY_LABEL[currency]} / ${offer === 'monthly' ? 'mois' : 'an'}`;
}

/**
 * Numéro saisi (local ou international) → E.164 avec l'indicatif du pays du compte.
 * « 01 97 00 00 00 » (BJ) → « +2290197000000 » ; « +229 … » ou « 00229 … » gardent l'indicatif. null si invalide.
 */
export function toE164(input: string, callingCode: string): string | null {
  let digits = input.replace(/\D/g, '');
  if (input.trim().startsWith('00')) digits = digits.slice(2);
  // Le 0 initial fait partie du numéro dans plusieurs pays (Bénin « 01… », Côte d'Ivoire « 07… ») : on le garde.
  else if (!input.trim().startsWith('+') && !digits.startsWith(callingCode)) digits = callingCode + digits;
  if (!digits.startsWith(callingCode)) return null;
  const e164 = `+${digits}`;
  return /^\+[1-9]\d{7,14}$/.test(e164) ? e164 : null;
}

/** Identifiant marchand unique (1 à 30 caractères). */
export function newMerchantTransactionId(): string {
  const random = crypto.getRandomValues(new Uint8Array(8));
  return `CB${Date.now().toString(36).toUpperCase()}${Array.from(random, (b) => b.toString(16).padStart(2, '0')).join('').toUpperCase()}`.slice(0, 30);
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (o: Obj, k: string) => (typeof o[k] === 'string' ? (o[k] as string) : '');

export type CinetPayAccount = { apiKey: string; apiPassword: string };
export type CinetPayConfig = CinetPayAccount & { baseUrl: string; timeoutMs?: number };

export class CinetPayError extends Error {
  readonly httpStatus: number;
  readonly apiStatus: string | null;
  constructor(message: string, httpStatus: number, apiStatus: string | null) {
    super(message);
    this.name = 'CinetPayError';
    this.httpStatus = httpStatus;
    this.apiStatus = apiStatus;
  }
}

async function call(config: CinetPayConfig, method: string, path: string, body: unknown, token: string | null, fetchImpl: typeof fetch) {
  const response = await fetchImpl(`${config.baseUrl}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(config.timeoutMs ?? 15_000),
  });
  const json = (await response.json().catch(() => null)) as unknown;
  const data: Obj = isObj(json) ? json : {};
  const apiStatus = str(data, 'status') || null;
  if (!response.ok || apiStatus === 'INVALID_CREDENTIALS' || apiStatus === 'INVALID_TOKEN' || apiStatus === 'EXPIRED_TOKEN') {
    const detail = str(data, 'description') || str(data, 'message') || apiStatus || response.statusText;
    throw new CinetPayError(`CinetPay HTTP ${response.status} : ${detail}`.slice(0, 500), response.status, apiStatus);
  }
  return data;
}

/** Jeton d'accès (valable quelques minutes : un par appel de fonction suffit). */
export async function login(config: CinetPayConfig, fetchImpl: typeof fetch = fetch): Promise<string> {
  const data = await call(config, 'POST', '/v1/oauth/login', { api_key: config.apiKey, api_password: config.apiPassword }, null, fetchImpl);
  const nested = isObj(data.data) ? data.data : {};
  const token = str(data, 'access_token') || str(nested, 'token') || str(nested, 'access_token');
  if (!token) throw new CinetPayError('CinetPay : jeton absent de la réponse de connexion', 200, str(data, 'status') || null);
  return token;
}

export type PaymentInput = {
  currency: Currency;
  merchantTransactionId: string;
  amount: number;
  successUrl: string;
  failedUrl: string;
  notifyUrl: string;
  designation: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneE164: string;
};

export type PaymentInit = { paymentUrl: string; notifyToken: string; transactionId: string };

/** Crée le paiement et renvoie le lien de la page CinetPay (mobile money ou carte, au choix du client). */
export async function createPayment(config: CinetPayConfig, input: PaymentInput, fetchImpl: typeof fetch = fetch): Promise<PaymentInit> {
  const token = await login(config, fetchImpl);
  const data = await call(
    config,
    'POST',
    '/v1/payment',
    {
      currency: input.currency,
      merchant_transaction_id: input.merchantTransactionId,
      amount: input.amount,
      success_url: input.successUrl,
      failed_url: input.failedUrl,
      notify_url: input.notifyUrl,
      lang: 'fr',
      designation: input.designation,
      client_first_name: input.firstName,
      client_last_name: input.lastName,
      client_email: input.email,
      client_phone_number: input.phoneE164,
      direct_pay: false,
    },
    token,
    fetchImpl,
  );
  const paymentUrl = str(data, 'payment_url');
  const notifyToken = str(data, 'notify_token');
  if (!paymentUrl || !notifyToken) {
    const details = isObj(data.details) ? str(data.details, 'message') : '';
    throw new CinetPayError(
      `CinetPay : paiement non créé (${str(data, 'status') || 'statut inconnu'}${details ? ` : ${details}` : ''})`,
      200,
      str(data, 'status') || null,
    );
  }
  return { paymentUrl, notifyToken, transactionId: str(data, 'transaction_id') };
}

export type PaymentState = { status: string; merchantTransactionId: string; transactionId: string };

/** Statut canonique d'un paiement (jamais celui de la notification). null s'il est inconnu. */
export async function findPayment(config: CinetPayConfig, merchantTransactionId: string, fetchImpl: typeof fetch = fetch): Promise<PaymentState | null> {
  const token = await login(config, fetchImpl);
  let data: Obj;
  try {
    data = await call(config, 'GET', `/v1/payment/${encodeURIComponent(merchantTransactionId)}`, undefined, token, fetchImpl);
  } catch (e) {
    if (e instanceof CinetPayError && e.httpStatus === 404) return null;
    throw e;
  }
  if (str(data, 'status') === 'NOT_FOUND') return null;
  return { status: str(data, 'status'), merchantTransactionId: str(data, 'merchant_transaction_id'), transactionId: str(data, 'transaction_id') };
}

/** Champs utiles d'une notification (JSON ou formulaire), non fiables tant que le paiement n'est pas revérifié. */
export function parseNotification(raw: string, contentType: string | null): { notifyToken: string; merchantTransactionId: string; transactionId: string } | null {
  let fields: Obj = {};
  if (contentType?.includes('application/x-www-form-urlencoded')) {
    fields = Object.fromEntries(new URLSearchParams(raw));
  } else {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (isObj(parsed)) fields = isObj(parsed.data) && !parsed.notify_token ? parsed.data : parsed;
    } catch {
      fields = Object.fromEntries(new URLSearchParams(raw));
    }
  }
  const notifyToken = str(fields, 'notify_token');
  const merchantTransactionId = str(fields, 'merchant_transaction_id');
  if (!notifyToken || !merchantTransactionId) return null;
  return { notifyToken, merchantTransactionId, transactionId: str(fields, 'transaction_id') };
}

/** Comparaison en temps constant de deux chaînes. */
export function safeEqual(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  let diff = ea.length ^ eb.length;
  for (let i = 0; i < Math.max(ea.length, eb.length); i++) diff |= (ea[i] ?? 0) ^ (eb[i] ?? 0);
  return diff === 0;
}
