// Edge Function create-checkout : version en un seul fichier pour l'éditeur du tableau de bord Supabase.
// GÉNÉRÉ par scripts/build-dashboard-files.sh depuis supabase/functions/create-checkout. Ne pas modifier à la main.
// Réglage requis : « Verify JWT » désactivé (le jeton est vérifié dans le code).
// supabase/functions/create-checkout/index.ts
import { createClient } from "npm:@supabase/supabase-js@2";

// supabase/functions/_shared/chariow.ts
var CHARIOW_API_BASE = "https://api.chariow.com/v1";
var OFFERS = [
  "monthly",
  "yearly"
];
var isOffer = (v) => typeof v === "string" && OFFERS.includes(v);
var isObj = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
function* walk(value, maxDepth = 5) {
  let level = [
    value
  ];
  for (let depth = 0; depth <= maxDepth && level.length; depth++) {
    const next = [];
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
function findCheckoutUrl(response) {
  const preferred = [
    "checkout_url",
    "payment_url",
    "url",
    "link",
    "payment_link"
  ];
  const found = /* @__PURE__ */ new Map();
  for (const obj of walk(response)) {
    for (const [key, v] of Object.entries(obj)) {
      if (typeof v !== "string" || !v.startsWith("https://") || key === "redirect_url") continue;
      if (!found.has(key)) found.set(key, v);
    }
  }
  for (const key of preferred) if (found.has(key)) return found.get(key);
  for (const [key, v] of found) if (/url|link/i.test(key)) return v;
  return null;
}
function chariowError(status, body) {
  const message = isObj(body) && typeof body.message === "string" ? body.message : "";
  const errors = isObj(body) && body.errors ? JSON.stringify(body.errors).slice(0, 300) : "";
  return `Chariow HTTP ${status}${message ? ` : ${message}` : ""}${errors && errors !== "[]" && errors !== "{}" ? ` ${errors}` : ""}`;
}
async function request(config, method, path, body, fetchImpl) {
  const response = await fetchImpl(`${config.apiBase ?? CHARIOW_API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: body === void 0 ? void 0 : JSON.stringify(body),
    signal: AbortSignal.timeout(2e4)
  });
  const json2 = await response.json().catch(() => null);
  return {
    status: response.status,
    ok: response.ok,
    json: json2
  };
}
var AlreadyPurchasedError = class extends Error {
  constructor() {
    super("Chariow : produit d\xE9j\xE0 achet\xE9 par ce client (already_purchased)");
    this.name = "AlreadyPurchasedError";
  }
};
async function createCheckout(config, input, fetchImpl = fetch) {
  const res = await request(config, "POST", "/checkout", {
    product_id: input.productId,
    email: input.email,
    first_name: input.firstName,
    last_name: input.lastName,
    phone: {
      number: input.phone,
      country_code: input.countryCode
    },
    custom_metadata: input.metadata,
    ...input.redirectUrl ? {
      redirect_url: input.redirectUrl
    } : {},
    ...input.discountCode ? {
      discount_code: input.discountCode
    } : {}
  }, fetchImpl);
  if (!res.ok) throw new Error(chariowError(res.status, res.json));
  const step = isObj(res.json) && isObj(res.json.data) ? res.json.data.step : void 0;
  if (step === "already_purchased") throw new AlreadyPurchasedError();
  const url2 = findCheckoutUrl(res.json);
  if (!url2) throw new Error(`Chariow : lien de paiement absent de la r\xE9ponse ${JSON.stringify(res.json).slice(0, 300)}`);
  return url2;
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
    if (body.action === "offers") {
      return json(200, {
        offers: OFFERS.map((offer) => ({
          offer,
          label: deps.offers[offer].label,
          available: deps.offers[offer].productId !== null
        }))
      });
    }
    if (user.isAnonymous || !user.email) {
      return fail(403, "account_required", "Cr\xE9e ton compte avec ton e-mail avant de passer Premium.");
    }
    if (!isOffer(body.offer)) return fail(400, "bad_request", "Offre inconnue.");
    const productId = deps.offers[body.offer].productId;
    if (!productId) return fail(503, "offer_unavailable", "Cette offre n'est pas encore disponible.");
    const firstName = clean(body.first_name, 50);
    const lastName = clean(body.last_name, 50);
    const phone = typeof body.phone === "string" ? body.phone.replace(/\D/g, "") : "";
    const countryCode = typeof body.country_code === "string" ? body.country_code.trim().toUpperCase() : "";
    if (!firstName || !lastName) return fail(400, "bad_request", "Indique ton pr\xE9nom et ton nom.");
    if (phone.length < 6 || phone.length > 15) return fail(400, "bad_request", "Num\xE9ro de t\xE9l\xE9phone invalide.");
    if (!/^[A-Z]{2}$/.test(countryCode)) return fail(400, "bad_request", "Pays invalide.");
    const discountCode = typeof body.discount_code === "string" ? body.discount_code.trim().slice(0, 100) : "";
    try {
      const url2 = await deps.createCheckout({
        productId,
        email: user.email,
        firstName,
        lastName,
        phone,
        countryCode,
        metadata: {
          user_id: user.id,
          offer: body.offer
        },
        redirectUrl: deps.redirectUrl,
        discountCode: discountCode || null
      });
      deps.log("paiement cr\xE9\xE9", {
        userId: user.id,
        offer: body.offer
      });
      return json(200, {
        url: url2
      });
    } catch (e) {
      deps.log("cr\xE9ation du paiement impossible", {
        userId: user.id,
        offer: body.offer,
        error: String(e)
      });
      if (e instanceof AlreadyPurchasedError) {
        return fail(409, "already_purchased", "Chariow indique que ton adresse e-mail a d\xE9j\xE0 achet\xE9 cette offre. Contacte-nous pour prolonger ton Premium.");
      }
      if (discountCode && /discount|coupon|promo|code/i.test(String(e))) {
        return fail(400, "invalid_discount", "Ce code promo n\u2019est pas valable pour cette offre.");
      }
      return fail(502, "checkout_failed", "Le paiement n'a pas pu \xEAtre pr\xE9par\xE9. R\xE9essaie dans un instant.");
    }
  };
}

// supabase/functions/create-checkout/index.ts
var opt = (name) => Deno.env.get(name)?.trim() || null;
var url = Deno.env.get("SUPABASE_URL");
var serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
var apiKey = opt("CHARIOW_API_KEY");
if (!url || !serviceKey) throw new Error("SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis");
if (!apiKey) throw new Error("Variable d'environnement manquante : CHARIOW_API_KEY");
var admin = createClient(url, serviceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});
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
  offers: {
    monthly: {
      productId: opt("CHARIOW_PRODUCT_MONTHLY"),
      label: opt("CHARIOW_LABEL_MONTHLY")
    },
    yearly: {
      productId: opt("CHARIOW_PRODUCT_YEARLY"),
      label: opt("CHARIOW_LABEL_YEARLY")
    }
  },
  redirectUrl: opt("CHARIOW_REDIRECT_URL"),
  createCheckout: (input) => createCheckout({
    apiKey
  }, input),
  log: (message, extra) => console.log(JSON.stringify({
    message,
    ...extra
  }))
}));
