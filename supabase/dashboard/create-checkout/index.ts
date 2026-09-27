// Edge Function create-checkout : version en un seul fichier pour l'éditeur du tableau de bord Supabase.
// GÉNÉRÉ par scripts/build-dashboard-files.sh depuis supabase/functions/create-checkout. Ne pas modifier à la main.
// Réglage requis : « Verify JWT » désactivé (le jeton est vérifié dans le code).
// supabase/functions/create-checkout/index.ts
import { createClient } from "npm:@supabase/supabase-js@2";

// supabase/functions/_shared/maketou.ts
var MAKETOU_BASE_URL = "https://api.maketou.net";
var OFFERS = [
  "monthly",
  "yearly"
];
var OFFER_DAYS = {
  monthly: 30,
  yearly: 365
};
var isOffer = (v) => typeof v === "string" && OFFERS.includes(v);
var isUuid = (v) => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
function priceLabel(amount, currencyLabel2, offer) {
  const digits = String(Math.round(amount)).replace(/\B(?=(\d{3})+(?!\d))/g, "\xA0");
  return `${digits} ${currencyLabel2} / ${offer === "monthly" ? "mois" : "an"}`;
}
var MaketouError = class extends Error {
  httpStatus;
  code;
  constructor(message, httpStatus, code) {
    super(message);
    this.name = "MaketouError";
    this.httpStatus = httpStatus;
    this.code = code;
  }
};
var isObj = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
var str = (o, k) => typeof o[k] === "string" ? o[k] : "";
async function call(config, method, path, body, fetchImpl) {
  const response = await fetchImpl(`${(config.baseUrl ?? MAKETOU_BASE_URL).replace(/\/$/, "")}${path}`, {
    method,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${config.apiKey}`,
      ...body === void 0 ? {} : {
        "Content-Type": "application/json"
      }
    },
    body: body === void 0 ? void 0 : JSON.stringify(body),
    signal: AbortSignal.timeout(config.timeoutMs ?? 15e3)
  });
  const json2 = await response.json().catch(() => null);
  const data = isObj(json2) ? json2 : {};
  if (!response.ok) {
    const code = str(data, "code") || null;
    const detail = str(data, "message") || code || response.statusText;
    throw new MaketouError(`Maketou HTTP ${response.status} : ${detail}`.slice(0, 500), response.status, code);
  }
  return data;
}
async function createCart(config, input, fetchImpl = fetch) {
  const data = await call(config, "POST", "/api/v1/stores/cart/checkout", input, fetchImpl);
  const cart = isObj(data.cart) ? data.cart : {};
  const cartId = str(cart, "id");
  const redirectUrl = str(data, "redirectUrl");
  if (!isUuid(cartId) || !/^https:\/\//.test(redirectUrl)) {
    throw new MaketouError("Maketou : r\xE9ponse de cr\xE9ation de panier incompl\xE8te", 200, null);
  }
  return {
    cartId,
    redirectUrl
  };
}
async function getCart(config, cartId, fetchImpl = fetch) {
  let data;
  try {
    data = await call(config, "GET", `/api/v1/stores/cart/${encodeURIComponent(cartId)}`, void 0, fetchImpl);
  } catch (e) {
    if (e instanceof MaketouError && e.httpStatus === 404) return null;
    throw e;
  }
  const meta = {};
  if (isObj(data.meta)) {
    for (const [k, v] of Object.entries(data.meta)) if (typeof v === "string") meta[k] = v;
  }
  return {
    id: str(data, "id"),
    status: str(data, "status"),
    paymentId: str(data, "paymentId") || null,
    meta
  };
}

// supabase/functions/_shared/maketou-env.ts
var opt = (name) => Deno.env.get(name)?.trim() || null;
var DEFAULT_PRICES = {
  monthly: 2e3,
  yearly: 2e4
};
function maketouSettings() {
  const apiKey = opt("MAKETOU_API_KEY");
  const offers = {};
  for (const offer of OFFERS) {
    const productId = opt(`MAKETOU_PRODUCT_${offer.toUpperCase()}`);
    const raw = opt(`PREMIUM_PRICE_${offer.toUpperCase()}`);
    const amount = raw === null ? DEFAULT_PRICES[offer] : Number(raw);
    if (!Number.isInteger(amount) || amount <= 0) throw new Error(`PREMIUM_PRICE_${offer.toUpperCase()} invalide`);
    if (apiKey && productId) offers[offer] = {
      productId,
      amount
    };
  }
  return {
    config: apiKey ? {
      apiKey
    } : null,
    offers,
    currency: (opt("PREMIUM_CURRENCY") ?? "XOF").toUpperCase()
  };
}
var currencyLabel = (currency) => currency === "XOF" || currency === "XAF" ? "FCFA" : currency;

// supabase/functions/_shared/settle-supabase.ts
function supabaseSettleDeps(admin2, config, log2) {
  return {
    getCart: (cartId) => {
      if (!config) throw new Error("MAKETOU_API_KEY manquant");
      return getCart(config, cartId);
    },
    async grantPremium({ userId, saleId, offer, days, amount, currency }) {
      const { data, error } = await admin2.rpc("grant_premium", {
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
    async markPaid(intentId) {
      const { error } = await admin2.from("payment_intents").update({
        status: "paid",
        completed_at: (/* @__PURE__ */ new Date()).toISOString()
      }).eq("id", intentId);
      if (error) throw error;
    },
    log: log2
  };
}

// supabase/functions/_shared/settle.ts
async function settleIntent(deps, intent) {
  if (intent.status === "paid") return "already_paid";
  if (!intent.cartId) return "unknown";
  const cart = await deps.getCart(intent.cartId);
  if (!cart) return "unknown";
  if (cart.id && cart.id !== intent.cartId || cart.meta.intentId && cart.meta.intentId !== intent.id || cart.meta.userId && cart.meta.userId !== intent.userId) {
    deps.log("panier incoh\xE9rent", {
      intentId: intent.id,
      cartId: intent.cartId
    });
    return "mismatch";
  }
  if (cart.status === "waiting_payment") return "waiting";
  if (cart.status !== "completed") return "not_paid";
  const result = await deps.grantPremium({
    userId: intent.userId,
    saleId: `maketou:${intent.cartId}`,
    offer: intent.offer,
    days: OFFER_DAYS[intent.offer],
    amount: intent.amount,
    currency: intent.currency
  });
  await deps.markPaid(intent.id);
  deps.log(result.granted ? "Premium cr\xE9dit\xE9" : "paiement d\xE9j\xE0 cr\xE9dit\xE9", {
    intentId: intent.id,
    cartId: intent.cartId,
    userId: intent.userId,
    offer: intent.offer,
    until: result.premiumUntil
  });
  return "paid";
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
function errorCode(e, productId) {
  if (e instanceof MaketouError) {
    if (e.httpStatus === 422 && productId !== void 0 && !isUuid(productId)) return "422/produit-non-uuid";
    return `${e.httpStatus}${e.code ? `/${e.code}` : ""}`;
  }
  if (typeof e === "object" && e !== null) {
    const code = e.code;
    if (typeof code === "string" && /^[A-Za-z0-9_]{1,40}$/.test(code)) return `db/${code}`;
  }
  if (e instanceof Error && /abort|timeout/i.test(e.message)) return "timeout";
  return "inconnu";
}
var clean = (v, max) => typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, max) : "";
function cleanPhone(v) {
  if (typeof v !== "string") return void 0;
  const trimmed = v.trim();
  if (!trimmed.startsWith("+") && !trimmed.startsWith("00")) return void 0;
  const digits = trimmed.replace(/\D/g, "").replace(/^00/, "");
  return /^[1-9]\d{7,14}$/.test(digits) ? `+${digits}` : void 0;
}
function createHandler(deps) {
  const available = () => OFFERS.filter((o) => deps.offers[o]).map((offer) => ({
    offer,
    amount: deps.offers[offer].amount,
    label: priceLabel(deps.offers[offer].amount, deps.currencyLabel, offer)
  }));
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
    if (body.action === "offers") return json(200, {
      offers: available(),
      currency: deps.currency
    });
    if (body.action === "confirm") {
      let paid = 0;
      try {
        for (const intent2 of await deps.pendingIntents(user.id)) {
          const result = await settleIntent(deps, intent2).catch((e) => {
            deps.log("v\xE9rification du paiement impossible", {
              intentId: intent2.id,
              error: String(e)
            });
            return "unknown";
          });
          if (result === "paid") paid++;
        }
      } catch (e) {
        deps.log("lecture des paiements en attente impossible", {
          userId: user.id,
          error: String(e)
        });
        return fail(502, "confirm_failed", "V\xE9rification impossible pour le moment. R\xE9essaie dans un instant.");
      }
      return json(200, {
        paid
      });
    }
    if (user.isAnonymous || !user.email) {
      return fail(403, "account_required", "Cr\xE9e ton compte avec ton e-mail avant de passer Premium.");
    }
    if (!isOffer(body.offer)) return fail(400, "bad_request", "Offre inconnue.");
    const offer = body.offer;
    const config = deps.offers[offer];
    if (!config) return fail(400, "offer_unavailable", "Le paiement n'est pas encore disponible.");
    const firstName = clean(body.first_name, 60);
    const lastName = clean(body.last_name, 60);
    if (firstName.length < 2 || lastName.length < 2) return fail(400, "bad_request", "Indique ton pr\xE9nom et ton nom (2 lettres au moins).");
    const intent = {
      id: deps.newId(),
      userId: user.id,
      offer,
      amount: config.amount,
      currency: deps.currency
    };
    try {
      await deps.saveIntent(intent);
      const checkout = await deps.createCart({
        productDocumentId: config.productId,
        email: user.email,
        firstName,
        lastName,
        phone: cleanPhone(body.phone),
        redirectURL: `${deps.returnUrl}?intent=${intent.id}`,
        meta: {
          intentId: intent.id,
          userId: user.id,
          offer
        }
      });
      await deps.attachCart(intent.id, checkout.cartId);
      deps.log("panier cr\xE9\xE9", {
        userId: user.id,
        offer,
        intentId: intent.id,
        cartId: checkout.cartId
      });
      return json(200, {
        url: checkout.redirectUrl
      });
    } catch (e) {
      const code = errorCode(e, config.productId);
      deps.log("cr\xE9ation du paiement impossible", {
        userId: user.id,
        offer,
        code,
        error: String(e)
      });
      return fail(502, "checkout_failed", `Le paiement n'a pas pu \xEAtre pr\xE9par\xE9. R\xE9essaie dans un instant. (code : ${code})`);
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
var settings = maketouSettings();
var log = (message, extra) => console.log(JSON.stringify({
  message,
  ...extra
}));
Deno.serve(createHandler({
  ...supabaseSettleDeps(admin, settings.config, log),
  async getUser(token) {
    const { data, error } = await admin.auth.getUser(token);
    if (error || !data.user) return null;
    return {
      id: data.user.id,
      email: data.user.email || null,
      isAnonymous: data.user.is_anonymous ?? false
    };
  },
  offers: settings.offers,
  currency: settings.currency,
  currencyLabel: currencyLabel(settings.currency),
  returnUrl: `${url}/functions/v1/maketou-return`,
  newId: () => crypto.randomUUID(),
  async saveIntent(intent) {
    const { error } = await admin.from("payment_intents").insert({
      id: intent.id,
      user_id: intent.userId,
      offer: intent.offer,
      amount: intent.amount,
      currency: intent.currency
    });
    if (error) throw error;
  },
  async attachCart(intentId, cartId) {
    const { error } = await admin.from("payment_intents").update({
      cart_id: cartId
    }).eq("id", intentId);
    if (error) throw error;
  },
  async pendingIntents(userId) {
    const since = new Date(Date.now() - 30 * 864e5).toISOString();
    const { data, error } = await admin.from("payment_intents").select("id, cart_id, user_id, offer, amount, currency, status").eq("user_id", userId).eq("status", "pending").not("cart_id", "is", null).gte("created_at", since).order("created_at", {
      ascending: false
    }).limit(10);
    if (error) throw error;
    return (data ?? []).map((r) => ({
      id: r.id,
      cartId: r.cart_id,
      userId: r.user_id,
      offer: r.offer,
      amount: r.amount,
      currency: r.currency,
      status: r.status
    }));
  },
  createCart: (input) => {
    if (!settings.config) throw new Error("MAKETOU_API_KEY manquant");
    return createCart(settings.config, input);
  },
  log
}));
