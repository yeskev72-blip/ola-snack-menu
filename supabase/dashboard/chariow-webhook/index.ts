// Edge Function chariow-webhook : version en un seul fichier pour l'éditeur du tableau de bord Supabase.
// GÉNÉRÉ par scripts/build-dashboard-files.sh depuis supabase/functions/chariow-webhook. Ne pas modifier à la main.
// Réglage requis : « Verify JWT » désactivé (le jeton est vérifié dans le code).
// supabase/functions/chariow-webhook/index.ts
import { createClient } from "npm:@supabase/supabase-js@2";

// supabase/functions/_shared/chariow.ts
var CHARIOW_API_BASE = "https://api.chariow.com/v1";
var OFFER_DAYS = {
  monthly: 30,
  yearly: 365
};
var PAID_STATUSES = [
  "completed",
  "settled"
];
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
function findSaleId(payload) {
  const str = (v) => typeof v === "string" && v.trim() !== "" ? v.trim() : null;
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
var num = (v) => typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : null;
function readSale(response, saleId) {
  const root = isObj(response) && isObj(response.data) ? response.data : isObj(response) ? response : {};
  const sale = isObj(root.sale) ? root.sale : root;
  const rawMeta = isObj(sale.custom_metadata) ? sale.custom_metadata : isObj(sale.metadata) ? sale.metadata : {};
  const metadata = {};
  for (const [k, v] of Object.entries(rawMeta)) if (typeof v === "string" || typeof v === "number") metadata[k] = String(v);
  const product = isObj(sale.product) ? sale.product : null;
  const amountObj = isObj(sale.amount) ? sale.amount : null;
  return {
    id: typeof sale.id === "string" ? sale.id : saleId,
    status: typeof sale.status === "string" ? sale.status.toLowerCase() : null,
    productId: typeof product?.id === "string" ? product.id : typeof sale.product_id === "string" ? sale.product_id : null,
    productSlug: typeof product?.slug === "string" ? product.slug : typeof sale.product_slug === "string" ? sale.product_slug : null,
    metadata,
    amount: amountObj ? num(amountObj.value ?? amountObj.amount) : num(sale.amount),
    currency: typeof amountObj?.currency === "string" ? amountObj.currency : typeof sale.currency === "string" ? sale.currency : null
  };
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
async function fetchSale(config, saleId, fetchImpl = fetch) {
  const res = await request(config, "GET", `/sales/${encodeURIComponent(saleId)}`, void 0, fetchImpl);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(chariowError(res.status, res.json));
  return readSale(res.json, saleId);
}
async function fetchProductSlug(config, productId, fetchImpl = fetch) {
  const res = await request(config, "GET", `/products/${encodeURIComponent(productId)}`, void 0, fetchImpl);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(chariowError(res.status, res.json));
  const root = isObj(res.json) && isObj(res.json.data) ? res.json.data : isObj(res.json) ? res.json : {};
  const product = isObj(root.product) ? root.product : root;
  return typeof product.slug === "string" ? product.slug : null;
}
var toHex = (buf) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
function safeEqual(a, b) {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  let diff = ea.length ^ eb.length;
  for (let i = 0; i < Math.max(ea.length, eb.length); i++) diff |= (ea[i] ?? 0) ^ (eb[i] ?? 0);
  return diff === 0;
}
async function verifySignature(rawBody, header, secret) {
  if (!header || !secret) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), {
    name: "HMAC",
    hash: "SHA-256"
  }, false, [
    "sign"
  ]);
  const expected = `sha256=${toHex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody)))}`;
  const given = header.trim().toLowerCase().startsWith("sha256=") ? header.trim().toLowerCase() : `sha256=${header.trim().toLowerCase()}`;
  return safeEqual(given, expected);
}

// supabase/functions/chariow-webhook/handler.ts
var json = (status, body) => new Response(JSON.stringify(body), {
  status,
  headers: {
    "Content-Type": "application/json; charset=utf-8"
  }
});
var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function createHandler(deps) {
  return async function handle(req) {
    if (req.method !== "POST") return json(405, {
      error: "method_not_allowed"
    });
    if (!deps.webhookToken && !deps.signingSecret) {
      deps.log("notification refus\xE9e : ni CHARIOW_WEBHOOK_TOKEN ni CHARIOW_WEBHOOK_SECRET configur\xE9");
      return json(500, {
        error: "not_configured"
      });
    }
    const raw = await req.text();
    const token = new URL(req.url).searchParams.get("token");
    const tokenOk = deps.webhookToken !== null && token !== null && safeEqual(token, deps.webhookToken);
    const signatureOk = !tokenOk && deps.signingSecret !== null && await verifySignature(raw, req.headers.get("x-chariow-signature"), deps.signingSecret);
    if (!tokenOk && !signatureOk) {
      deps.log("notification refus\xE9e : jeton ou signature invalide");
      return json(401, {
        error: "unauthorized"
      });
    }
    let payload;
    try {
      payload = JSON.parse(raw);
    } catch {
      return json(400, {
        error: "bad_request"
      });
    }
    const saleId = findSaleId(payload);
    if (!saleId) {
      deps.log("notification sans vente", {
        payload: JSON.stringify(payload).slice(0, 500)
      });
      return json(200, {
        ignored: "no_sale"
      });
    }
    let sale;
    try {
      sale = await deps.fetchSale(saleId);
    } catch (e) {
      deps.log("lecture de la vente impossible", {
        saleId,
        error: String(e)
      });
      return json(502, {
        error: "sale_unavailable"
      });
    }
    if (!sale) return json(200, {
      ignored: "unknown_sale"
    });
    if (!sale.status || !PAID_STATUSES.includes(sale.status)) {
      deps.log("vente non pay\xE9e", {
        saleId,
        status: sale.status
      });
      return json(200, {
        ignored: "not_paid"
      });
    }
    let offer = (sale.productId ? deps.productOffers[sale.productId] : void 0) ?? (sale.productSlug ? deps.productOffers[sale.productSlug] : void 0);
    if (!offer && sale.productId && !sale.productSlug) {
      const slug = await deps.fetchProductSlug(sale.productId).catch((e) => {
        deps.log("lecture du produit impossible", {
          saleId,
          productId: sale.productId,
          error: String(e)
        });
        return null;
      });
      if (slug) offer = deps.productOffers[slug];
    }
    if (!offer) {
      deps.log("vente d\u2019un autre produit", {
        saleId,
        productId: sale.productId,
        productSlug: sale.productSlug
      });
      return json(200, {
        ignored: "other_product"
      });
    }
    const userId = sale.metadata.user_id;
    if (!userId || !UUID.test(userId)) {
      deps.log("vente sans utilisateur Calbasse", {
        saleId
      });
      return json(200, {
        ignored: "no_user"
      });
    }
    try {
      const result = await deps.grantPremium({
        userId,
        saleId: sale.id,
        offer,
        days: OFFER_DAYS[offer],
        amount: sale.amount,
        currency: sale.currency
      });
      deps.log(result.granted ? "Premium cr\xE9dit\xE9" : "vente d\xE9j\xE0 cr\xE9dit\xE9e", {
        saleId,
        userId,
        offer,
        until: result.premiumUntil
      });
      return json(200, {
        granted: result.granted,
        premium_until: result.premiumUntil
      });
    } catch (e) {
      deps.log("cr\xE9dit du Premium impossible", {
        saleId,
        userId,
        error: String(e)
      });
      return json(500, {
        error: "grant_failed"
      });
    }
  };
}

// supabase/functions/chariow-webhook/index.ts
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
var productOffers = {};
var monthly = opt("CHARIOW_PRODUCT_MONTHLY");
var yearly = opt("CHARIOW_PRODUCT_YEARLY");
if (monthly) productOffers[monthly] = "monthly";
if (yearly) productOffers[yearly] = "yearly";
Deno.serve(createHandler({
  webhookToken: opt("CHARIOW_WEBHOOK_TOKEN"),
  signingSecret: opt("CHARIOW_WEBHOOK_SECRET"),
  productOffers,
  fetchSale: (saleId) => fetchSale({
    apiKey
  }, saleId),
  fetchProductSlug: (productId) => fetchProductSlug({
    apiKey
  }, productId),
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
  log: (message, extra) => console.log(JSON.stringify({
    message,
    ...extra
  }))
}));
