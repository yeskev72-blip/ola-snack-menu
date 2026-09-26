/**
 * Edge Function chariow-webhook (Deno). Branche les vraies dépendances sur handler.ts.
 * Réglage requis : « Verify JWT » désactivé (Chariow n'envoie pas de jeton Supabase).
 *
 * Secrets (Edge Functions > Secrets) :
 *   CHARIOW_API_KEY          obligatoire, pour relire chaque vente auprès de Chariow
 *   CHARIOW_PRODUCT_MONTHLY  produit « Premium mensuel » : identifiant (prd_…) ou nom court (ex. calbasse-1-mois)
 *   CHARIOW_PRODUCT_YEARLY   produit « Premium annuel » : identifiant ou nom court
 *   CHARIOW_WEBHOOK_TOKEN    jeton secret ajouté à l'URL du Pulse (…/chariow-webhook?token=…)
 *   CHARIOW_WEBHOOK_SECRET   facultatif, secret de signature du Pulse (whsec_…) si Chariow en fournit un
 * Fournis automatiquement par Supabase : SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

import { fetchProductSlug, fetchSale, type Offer } from '../_shared/chariow.ts';
import { createHandler } from './handler.ts';

const opt = (name: string) => Deno.env.get(name)?.trim() || null;
const url = Deno.env.get('SUPABASE_URL');
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const apiKey = opt('CHARIOW_API_KEY');
if (!url || !serviceKey) throw new Error('SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis');
if (!apiKey) throw new Error('Variable d\'environnement manquante : CHARIOW_API_KEY');

const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

const productOffers: Record<string, Offer> = {};
const monthly = opt('CHARIOW_PRODUCT_MONTHLY');
const yearly = opt('CHARIOW_PRODUCT_YEARLY');
if (monthly) productOffers[monthly] = 'monthly';
if (yearly) productOffers[yearly] = 'yearly';

Deno.serve(
  createHandler({
    webhookToken: opt('CHARIOW_WEBHOOK_TOKEN'),
    signingSecret: opt('CHARIOW_WEBHOOK_SECRET'),
    productOffers,
    fetchSale: (saleId) => fetchSale({ apiKey }, saleId),
    fetchProductSlug: (productId) => fetchProductSlug({ apiKey }, productId),
    async grantPremium({ userId, saleId, offer, days, amount, currency }) {
      const { data, error } = await admin
        .rpc('grant_premium', { p_user_id: userId, p_sale_id: saleId, p_offer: offer, p_days: days, p_amount: amount, p_currency: currency })
        .single();
      if (error) throw error;
      const row = data as { granted: boolean; premium_until: string | null };
      return { granted: row.granted, premiumUntil: row.premium_until };
    },
    log: (message, extra) => console.log(JSON.stringify({ message, ...extra })),
  }),
);
