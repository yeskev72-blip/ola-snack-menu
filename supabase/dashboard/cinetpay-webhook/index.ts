// Edge Function cinetpay-webhook : version en un seul fichier pour l'éditeur du tableau de bord Supabase.
// GÉNÉRÉ par scripts/build-dashboard-files.sh depuis supabase/functions/cinetpay-webhook. Ne pas modifier à la main.
// Réglage requis : « Verify JWT » désactivé (le jeton est vérifié dans le code).
// supabase/functions/cinetpay-webhook/index.ts
import { createClient } from "npm:@supabase/supabase-js@2";

// supabase/functions/_shared/cinetpay.ts
var CINETPAY_BASE_URLS = {
  sandbox: "https://api.cinetpay.net",
  production: "https://api.cinetpay.co"
};
var OFFER_DAYS = {
  monthly: 30,
  yearly: 365
};
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
async function findPayment(config, merchantTransactionId, fetchImpl = fetch) {
  const token = await login(config, fetchImpl);
  let data;
  try {
    data = await call(config, "GET", `/v1/payment/${encodeURIComponent(merchantTransactionId)}`, void 0, token, fetchImpl);
  } catch (e) {
    if (e instanceof CinetPayError && e.httpStatus === 404) return null;
    throw e;
  }
  if (str(data, "status") === "NOT_FOUND") return null;
  return {
    status: str(data, "status"),
    merchantTransactionId: str(data, "merchant_transaction_id"),
    transactionId: str(data, "transaction_id")
  };
}
function parseNotification(raw, contentType) {
  let fields = {};
  if (contentType?.includes("application/x-www-form-urlencoded")) {
    fields = Object.fromEntries(new URLSearchParams(raw));
  } else {
    try {
      const parsed = JSON.parse(raw);
      if (isObj(parsed)) fields = isObj(parsed.data) && !parsed.notify_token ? parsed.data : parsed;
    } catch {
      fields = Object.fromEntries(new URLSearchParams(raw));
    }
  }
  const notifyToken = str(fields, "notify_token");
  const merchantTransactionId = str(fields, "merchant_transaction_id");
  if (!notifyToken || !merchantTransactionId) return null;
  return {
    notifyToken,
    merchantTransactionId,
    transactionId: str(fields, "transaction_id")
  };
}
function safeEqual(a, b) {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  let diff = ea.length ^ eb.length;
  for (let i = 0; i < Math.max(ea.length, eb.length); i++) diff |= (ea[i] ?? 0) ^ (eb[i] ?? 0);
  return diff === 0;
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

// supabase/functions/cinetpay-webhook/handler.ts
var FAILED_STATUSES = [
  "FAILED",
  "EXPIRED",
  "INSUFFICIENT_BALANCE",
  "NOT_ALLOWED",
  "USER_IS_BLOCKED"
];
var PAGES = {
  success: "Paiement re\xE7u, merci ! Retourne dans l\u2019application Calbasse : ton Premium s\u2019active dans quelques secondes.",
  failed: "Le paiement n\u2019a pas abouti. Retourne dans l\u2019application Calbasse pour r\xE9essayer."
};
var json = (status, body) => new Response(JSON.stringify(body), {
  status,
  headers: {
    "Content-Type": "application/json; charset=utf-8"
  }
});
var text = (body) => new Response(body, {
  status: 200,
  headers: {
    "Content-Type": "text/plain; charset=utf-8"
  }
});
function createHandler(deps) {
  async function processNotification(raw, contentType) {
    const notification = parseNotification(raw, contentType);
    if (!notification) return {
      status: 400,
      body: {
        error: "bad_request"
      }
    };
    const { merchantTransactionId } = notification;
    const intent = await deps.loadIntent(merchantTransactionId);
    if (!intent) {
      deps.log("notification pour une transaction inconnue", {
        merchantTransactionId
      });
      return {
        status: 200,
        body: {
          ignored: "unknown_transaction"
        }
      };
    }
    if (!intent.notifyToken) {
      return {
        status: 503,
        body: {
          error: "not_ready"
        }
      };
    }
    if (!safeEqual(notification.notifyToken, intent.notifyToken)) {
      deps.log("notification refus\xE9e : notify_token invalide", {
        merchantTransactionId
      });
      return {
        status: 401,
        body: {
          error: "unauthorized"
        }
      };
    }
    if (intent.status === "paid") return {
      status: 200,
      body: {
        granted: false,
        already: true
      }
    };
    let payment;
    try {
      payment = await deps.findPayment(intent.country, merchantTransactionId);
    } catch (e) {
      deps.log("lecture du paiement impossible", {
        merchantTransactionId,
        error: String(e)
      });
      return {
        status: 502,
        body: {
          error: "payment_unavailable"
        }
      };
    }
    if (!payment) return {
      status: 200,
      body: {
        ignored: "unknown_payment"
      }
    };
    if (payment.merchantTransactionId && payment.merchantTransactionId !== merchantTransactionId || payment.transactionId && notification.transactionId && payment.transactionId !== notification.transactionId) {
      deps.log("notification refus\xE9e : identifiants incoh\xE9rents", {
        merchantTransactionId
      });
      return {
        status: 400,
        body: {
          error: "mismatch"
        }
      };
    }
    if (payment.status !== "SUCCESS") {
      if (FAILED_STATUSES.includes(payment.status)) await deps.markIntent(merchantTransactionId, "failed").catch(() => void 0);
      deps.log("paiement non abouti", {
        merchantTransactionId,
        status: payment.status
      });
      return {
        status: 200,
        body: {
          ignored: "not_paid",
          status: payment.status
        }
      };
    }
    try {
      const result = await deps.grantPremium({
        userId: intent.userId,
        saleId: merchantTransactionId,
        offer: intent.offer,
        days: OFFER_DAYS[intent.offer],
        amount: intent.amount,
        currency: intent.currency
      });
      await deps.markIntent(merchantTransactionId, "paid");
      deps.log(result.granted ? "Premium cr\xE9dit\xE9" : "paiement d\xE9j\xE0 cr\xE9dit\xE9", {
        merchantTransactionId,
        userId: intent.userId,
        offer: intent.offer,
        until: result.premiumUntil
      });
      return {
        status: 200,
        body: {
          granted: result.granted,
          premium_until: result.premiumUntil
        }
      };
    } catch (e) {
      deps.log("cr\xE9dit du Premium impossible", {
        merchantTransactionId,
        error: String(e)
      });
      return {
        status: 500,
        body: {
          error: "grant_failed"
        }
      };
    }
  }
  return async function handle(req) {
    const page = new URL(req.url).searchParams.get("page");
    const pageText = page === "success" || page === "failed" ? PAGES[page] : null;
    if (req.method === "GET") return pageText ? text(pageText) : text("ok");
    if (req.method !== "POST") return json(405, {
      error: "method_not_allowed"
    });
    const raw = await req.text();
    if (pageText) {
      if (raw.trim()) await processNotification(raw, req.headers.get("content-type")).catch(() => void 0);
      return text(pageText);
    }
    const result = await processNotification(raw, req.headers.get("content-type"));
    return json(result.status, result.body);
  };
}

// supabase/functions/cinetpay-webhook/index.ts
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
  async loadIntent(merchantTransactionId) {
    const { data, error } = await admin.from("payment_intents").select("merchant_transaction_id, user_id, offer, amount, currency, country, notify_token, status").eq("merchant_transaction_id", merchantTransactionId).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return {
      merchantTransactionId: data.merchant_transaction_id,
      userId: data.user_id,
      offer: data.offer,
      amount: data.amount,
      currency: data.currency,
      country: data.country,
      notifyToken: data.notify_token,
      status: data.status
    };
  },
  async findPayment(country, merchantTransactionId) {
    const account = accounts[country];
    if (!account) throw new Error(`Compte CinetPay absent pour le pays ${country}`);
    return await findPayment(account, merchantTransactionId);
  },
  async grantPremium({ userId, saleId, offer, days, amount, currency }) {
    const { data, error } = await admin.rpc("grant_premium", {
      p_user_id: userId,
      p_sale_id: saleId,
      p_offer: offer,
      p_days: days,
      p_amount: amount,
      p_currency: currency
    }).single();
    if (error) throw error;
    const row = data;
    return {
      granted: row.granted,
      premiumUntil: row.premium_until
    };
  },
  async markIntent(merchantTransactionId, status) {
    const { error } = await admin.from("payment_intents").update({
      status,
      completed_at: (/* @__PURE__ */ new Date()).toISOString()
    }).eq("merchant_transaction_id", merchantTransactionId);
    if (error) throw error;
  },
  log: (message, extra) => console.log(JSON.stringify({
    message,
    ...extra
  }))
}));
