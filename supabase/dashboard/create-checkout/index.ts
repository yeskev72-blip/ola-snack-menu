// Edge Function create-checkout : version en un seul fichier pour l'éditeur du tableau de bord Supabase.
// GÉNÉRÉ par scripts/build-dashboard-files.sh depuis supabase/functions/create-checkout. Ne pas modifier à la main.
// Réglage requis : « Verify JWT » désactivé (le jeton est vérifié dans le code).
// supabase/functions/create-checkout/index.ts
import { createClient } from "npm:@supabase/supabase-js@2";

// supabase/functions/_shared/cinetpay.ts
var CINETPAY_BASE_URLS = {
  sandbox: "https://api.cinetpay.net",
  production: "https://api.cinetpay.co"
};
var OFFERS = [
  "monthly",
  "yearly"
];
var isOffer = (v) => typeof v === "string" && OFFERS.includes(v);
var COUNTRIES = {
  BJ: {
    name: "B\xE9nin",
    currency: "XOF",
    callingCode: "229"
  },
  BF: {
    name: "Burkina Faso",
    currency: "XOF",
    callingCode: "226"
  },
  CI: {
    name: "C\xF4te d'Ivoire",
    currency: "XOF",
    callingCode: "225"
  },
  ML: {
    name: "Mali",
    currency: "XOF",
    callingCode: "223"
  },
  NE: {
    name: "Niger",
    currency: "XOF",
    callingCode: "227"
  },
  SN: {
    name: "S\xE9n\xE9gal",
    currency: "XOF",
    callingCode: "221"
  },
  TG: {
    name: "Togo",
    currency: "XOF",
    callingCode: "228"
  },
  CM: {
    name: "Cameroun",
    currency: "XAF",
    callingCode: "237"
  },
  CF: {
    name: "Centrafrique",
    currency: "XAF",
    callingCode: "236"
  },
  CG: {
    name: "Congo",
    currency: "XAF",
    callingCode: "242"
  },
  GA: {
    name: "Gabon",
    currency: "XAF",
    callingCode: "241"
  },
  GQ: {
    name: "Guin\xE9e \xE9quatoriale",
    currency: "XAF",
    callingCode: "240"
  },
  TD: {
    name: "Tchad",
    currency: "XAF",
    callingCode: "235"
  },
  GN: {
    name: "Guin\xE9e",
    currency: "GNF",
    callingCode: "224"
  },
  CD: {
    name: "RD Congo",
    currency: "CDF",
    callingCode: "243"
  }
};
var CURRENCY_LABEL = {
  XOF: "FCFA",
  XAF: "FCFA",
  GNF: "GNF",
  CDF: "CDF"
};
function priceLabel(amount, currency, offer) {
  const digits = String(Math.round(amount)).replace(/\B(?=(\d{3})+(?!\d))/g, "\u202F");
  return `${digits} ${CURRENCY_LABEL[currency]} / ${offer === "monthly" ? "mois" : "an"}`;
}
function toE164(input, callingCode) {
  let digits = input.replace(/\D/g, "");
  if (input.trim().startsWith("00")) digits = digits.slice(2);
  else if (!input.trim().startsWith("+") && !digits.startsWith(callingCode)) digits = callingCode + digits;
  if (!digits.startsWith(callingCode)) return null;
  const e164 = `+${digits}`;
  return /^\+[1-9]\d{7,14}$/.test(e164) ? e164 : null;
}
function newMerchantTransactionId() {
  const random = crypto.getRandomValues(new Uint8Array(8));
  return `CB${Date.now().toString(36).toUpperCase()}${Array.from(random, (b) => b.toString(16).padStart(2, "0")).join("").toUpperCase()}`.slice(0, 30);
}
var isObj = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
var str = (o, k) => typeof o[k] === "string" ? o[k] : "";
var CinetPayError = class extends Error {
  httpStatus;
  apiStatus;
  constructor(message, httpStatus, apiStatus) {
    super(message);
    this.name = "CinetPayError";
    this.httpStatus = httpStatus;
    this.apiStatus = apiStatus;
  }
};
async function call(config, method, path, body, token, fetchImpl) {
  const response = await fetchImpl(`${config.baseUrl}${path}`, {
    method,
    headers: {
      Accept: "application/json",
      ...body === void 0 ? {} : {
        "Content-Type": "application/json"
      },
      ...token ? {
        Authorization: `Bearer ${token}`
      } : {}
    },
    body: body === void 0 ? void 0 : JSON.stringify(body),
    signal: AbortSignal.timeout(config.timeoutMs ?? 15e3)
  });
  const json2 = await response.json().catch(() => null);
  const data = isObj(json2) ? json2 : {};
  const apiStatus = str(data, "status") || null;
  if (!response.ok || apiStatus === "INVALID_CREDENTIALS" || apiStatus === "INVALID_TOKEN" || apiStatus === "EXPIRED_TOKEN") {
    const detail = str(data, "description") || str(data, "message") || apiStatus || response.statusText;
    throw new CinetPayError(`CinetPay HTTP ${response.status} : ${detail}`.slice(0, 500), response.status, apiStatus);
  }
  return data;
}
async function login(config, fetchImpl = fetch) {
  const data = await call(config, "POST", "/v1/oauth/login", {
    api_key: config.apiKey,
    api_password: config.apiPassword
  }, null, fetchImpl);
  const nested = isObj(data.data) ? data.data : {};
  const token = str(data, "access_token") || str(nested, "token") || str(nested, "access_token");
  if (!token) throw new CinetPayError("CinetPay : jeton absent de la r\xE9ponse de connexion", 200, str(data, "status") || null);
  return token;
}
async function createPayment(config, input, fetchImpl = fetch) {
  const token = await login(config, fetchImpl);
  const data = await call(config, "POST", "/v1/payment", {
    currency: input.currency,
    merchant_transaction_id: input.merchantTransactionId,
    amount: input.amount,
    success_url: input.successUrl,
    failed_url: input.failedUrl,
    notify_url: input.notifyUrl,
    lang: "fr",
    designation: input.designation,
    client_first_name: input.firstName,
    client_last_name: input.lastName,
    client_email: input.email,
    client_phone_number: input.phoneE164,
    direct_pay: false
  }, token, fetchImpl);
  const paymentUrl = str(data, "payment_url");
  const notifyToken = str(data, "notify_token");
  if (!paymentUrl || !notifyToken) {
    const details = isObj(data.details) ? str(data.details, "message") : "";
    throw new CinetPayError(`CinetPay : paiement non cr\xE9\xE9 (${str(data, "status") || "statut inconnu"}${details ? ` : ${details}` : ""})`, 200, str(data, "status") || null);
  }
  return {
    paymentUrl,
    notifyToken,
    transactionId: str(data, "transaction_id")
  };
}

// supabase/functions/_shared/cinetpay-env.ts
var opt = (name) => Deno.env.get(name)?.trim() || null;
function cinetpayEnvironment() {
  const value = (opt("CINETPAY_ENV") ?? "sandbox").toLowerCase();
  if (value !== "sandbox" && value !== "production") throw new Error("CINETPAY_ENV doit valoir \xAB sandbox \xBB ou \xAB production \xBB");
  return value;
}
function cinetpayAccounts() {
  const baseUrl = CINETPAY_BASE_URLS[cinetpayEnvironment()];
  const accounts2 = {};
  for (const code of Object.keys(COUNTRIES)) {
    const apiKey = opt(`CINETPAY_${code}_API_KEY`);
    const apiPassword = opt(`CINETPAY_${code}_API_PASSWORD`);
    if (apiKey && apiPassword) accounts2[code] = {
      apiKey,
      apiPassword,
      baseUrl
    };
  }
  return accounts2;
}
var DEFAULT_PRICES = {
  XOF: {
    monthly: 2e3,
    yearly: 2e4
  },
  XAF: {
    monthly: 2e3,
    yearly: 2e4
  }
};
function premiumPrices() {
  const prices = {};
  for (const currency of [
    "XOF",
    "XAF",
    "GNF",
    "CDF"
  ]) {
    const read = (offer) => {
      const raw = opt(`PREMIUM_PRICE_${offer.toUpperCase()}_${currency}`);
      if (raw === null) return DEFAULT_PRICES[currency]?.[offer] ?? null;
      const value = Number(raw);
      if (!Number.isInteger(value) || value <= 0) throw new Error(`PREMIUM_PRICE_${offer.toUpperCase()}_${currency} invalide`);
      return value;
    };
    const monthly = read("monthly");
    const yearly = read("yearly");
    if (monthly && yearly) prices[currency] = {
      monthly,
      yearly
    };
  }
  return prices;
}

// supabase/functions/create-checkout/handler.ts
var HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};
var json = (status, body) => new Response(JSON.stringify(body), {
  status,
  headers: HEADERS
});
var fail = (status, error, message) => json(status, {
  error,
  message
});
var clean = (v, max) => typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, max) : "";
function availableCountries(deps) {
  return Object.entries(COUNTRIES).filter(([code, c]) => deps.enabledCountries.includes(code) && deps.prices[c.currency]).map(([code, c]) => {
    const price = deps.prices[c.currency];
    return {
      code,
      name: c.name,
      currency: c.currency,
      calling_code: c.callingCode,
      offers: OFFERS.map((offer) => ({
        offer,
        amount: price[offer],
        label: priceLabel(price[offer], c.currency, offer)
      }))
    };
  });
}
function createHandler(deps) {
  return async function handle(req) {
    if (req.method === "OPTIONS") return new Response(null, {
      status: 204,
      headers: HEADERS
    });
    if (req.method !== "POST") return fail(405, "method_not_allowed", "Utilise POST.");
    const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "").trim();
    const user = token ? await deps.getUser(token).catch(() => null) : null;
    if (!user) return fail(401, "unauthorized", "Connexion requise.");
    let body;
    try {
      body = await req.json();
    } catch {
      return fail(400, "bad_request", "Corps JSON invalide.");
    }
    const countries = availableCountries(deps);
    if (body.action === "offers") return json(200, {
      countries
    });
    if (user.isAnonymous || !user.email) {
      return fail(403, "account_required", "Cr\xE9e ton compte avec ton e-mail avant de passer Premium.");
    }
    if (!isOffer(body.offer)) return fail(400, "bad_request", "Offre inconnue.");
    const offer = body.offer;
    const country = countries.find((c) => c.code === (typeof body.country_code === "string" ? body.country_code.trim().toUpperCase() : ""));
    if (!country) return fail(400, "country_unavailable", "Le paiement n'est pas encore disponible dans ce pays.");
    const firstName = clean(body.first_name, 60);
    const lastName = clean(body.last_name, 60);
    if (firstName.length < 2 || lastName.length < 2) return fail(400, "bad_request", "Indique ton pr\xE9nom et ton nom (2 lettres au moins).");
    const phone = typeof body.phone === "string" ? toE164(body.phone, country.calling_code) : null;
    if (!phone) return fail(400, "bad_request", `Num\xE9ro de t\xE9l\xE9phone invalide pour ce pays (indicatif +${country.calling_code}).`);
    const amount = country.offers.find((o) => o.offer === offer).amount;
    const intent = {
      merchantTransactionId: newMerchantTransactionId(),
      userId: user.id,
      offer,
      amount,
      currency: country.currency,
      country: country.code
    };
    try {
      await deps.saveIntent(intent);
      const init = await deps.createPayment(country.code, {
        currency: country.currency,
        merchantTransactionId: intent.merchantTransactionId,
        amount,
        successUrl: `${deps.webhookUrl}?page=success`,
        failedUrl: `${deps.webhookUrl}?page=failed`,
        notifyUrl: deps.webhookUrl,
        designation: offer === "monthly" ? "Calbasse Premium 1 mois" : "Calbasse Premium 1 an",
        firstName,
        lastName,
        email: user.email,
        phoneE164: phone
      });
      await deps.attachIntent(intent.merchantTransactionId, init);
      deps.log("paiement cr\xE9\xE9", {
        userId: user.id,
        offer,
        country: country.code,
        merchantTransactionId: intent.merchantTransactionId
      });
      return json(200, {
        url: init.paymentUrl
      });
    } catch (e) {
      deps.log("cr\xE9ation du paiement impossible", {
        userId: user.id,
        offer,
        country: country.code,
        error: String(e)
      });
      return fail(502, "checkout_failed", "Le paiement n'a pas pu \xEAtre pr\xE9par\xE9. R\xE9essaie dans un instant.");
    }
  };
}

// supabase/functions/create-checkout/index.ts
var url = Deno.env.get("SUPABASE_URL");
var serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
if (!url || !serviceKey) throw new Error("SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis");
var admin = createClient(url, serviceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});
var accounts = cinetpayAccounts();
Deno.serve(createHandler({
  async getUser(token) {
    const { data, error } = await admin.auth.getUser(token);
    if (error || !data.user) return null;
    return {
      id: data.user.id,
      email: data.user.email || null,
      isAnonymous: data.user.is_anonymous ?? false
    };
  },
  enabledCountries: Object.keys(accounts),
  prices: premiumPrices(),
  webhookUrl: `${url}/functions/v1/cinetpay-webhook`,
  async saveIntent(intent) {
    const { error } = await admin.from("payment_intents").insert({
      merchant_transaction_id: intent.merchantTransactionId,
      user_id: intent.userId,
      offer: intent.offer,
      amount: intent.amount,
      currency: intent.currency,
      country: intent.country
    });
    if (error) throw error;
  },
  async attachIntent(merchantTransactionId, init) {
    const { error } = await admin.from("payment_intents").update({
      notify_token: init.notifyToken,
      transaction_id: init.transactionId || null
    }).eq("merchant_transaction_id", merchantTransactionId);
    if (error) throw error;
  },
  createPayment: (country, input) => createPayment(accounts[country], input),
  log: (message, extra) => console.log(JSON.stringify({
    message,
    ...extra
  }))
}));
