// Edge Function maketou-return : version en un seul fichier pour l'éditeur du tableau de bord Supabase.
// GÉNÉRÉ par scripts/build-dashboard-files.sh depuis supabase/functions/maketou-return. Ne pas modifier à la main.
// Réglage requis : « Verify JWT » désactivé (le jeton est vérifié dans le code).
// supabase/functions/maketou-return/index.ts
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
var isUuid = (v) => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
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
  const json = await response.json().catch(() => null);
  const data = isObj(json) ? json : {};
  if (!response.ok) {
    const code = str(data, "code") || null;
    const detail = str(data, "message") || code || response.statusText;
    throw new MaketouError(`Maketou HTTP ${response.status} : ${detail}`.slice(0, 500), response.status, code);
  }
  return data;
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

// supabase/functions/maketou-return/handler.ts
var PAGES = {
  paid: "Paiement re\xE7u, merci ! Retourne dans l\u2019application Calbasse : ton Premium est actif.",
  waiting: "Paiement en cours de validation. Retourne dans l\u2019application Calbasse et touche \xAB J\u2019ai pay\xE9 : actualiser \xBB dans quelques instants.",
  failed: "Le paiement n\u2019a pas abouti. Retourne dans l\u2019application Calbasse pour r\xE9essayer."
};
var text = (body) => new Response(body, {
  status: 200,
  headers: {
    "Content-Type": "text/plain; charset=utf-8"
  }
});
function createHandler(deps) {
  return async function handle(req) {
    if (req.method !== "GET") return new Response("method_not_allowed", {
      status: 405
    });
    const id = new URL(req.url).searchParams.get("intent");
    if (!isUuid(id)) return text(PAGES.waiting);
    try {
      const intent = await deps.loadIntent(id);
      if (!intent) return text(PAGES.waiting);
      const result = await settleIntent(deps, intent);
      if (result === "paid" || result === "already_paid") return text(PAGES.paid);
      if (result === "not_paid") return text(PAGES.failed);
      return text(PAGES.waiting);
    } catch (e) {
      deps.log("v\xE9rification au retour impossible", {
        intentId: id,
        error: String(e)
      });
      return text(PAGES.waiting);
    }
  };
}

// supabase/functions/maketou-return/index.ts
var url = Deno.env.get("SUPABASE_URL");
var serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
if (!url || !serviceKey) throw new Error("SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis");
var admin = createClient(url, serviceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});
var log = (message, extra) => console.log(JSON.stringify({
  message,
  ...extra
}));
Deno.serve(createHandler({
  ...supabaseSettleDeps(admin, maketouSettings().config, log),
  async loadIntent(id) {
    const { data, error } = await admin.from("payment_intents").select("id, cart_id, user_id, offer, amount, currency, status").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return {
      id: data.id,
      cartId: data.cart_id,
      userId: data.user_id,
      offer: data.offer,
      amount: data.amount,
      currency: data.currency,
      status: data.status
    };
  }
}));
