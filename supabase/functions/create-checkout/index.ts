/**
 * Edge Function create-checkout (Deno). Branche les vraies dépendances sur handler.ts.
 *
 * Secrets (Edge Functions > Secrets) :
 *   CHARIOW_API_KEY          obligatoire (Chariow > Développeurs), ne quitte jamais le serveur
 *   CHARIOW_PRODUCT_MONTHLY  produit « Premium mensuel » : identifiant (prd_…) ou nom court (ex. calbasse-1-mois)
 *   CHARIOW_PRODUCT_YEARLY   produit « Premium annuel » : identifiant ou nom court
 *   CHARIOW_LABEL_MONTHLY    facultatif, prix affiché dans l'app (ex. « 1 000 FCFA / mois »)
 *   CHARIOW_LABEL_YEARLY     facultatif (ex. « 10 000 FCFA / an »)
 *   CHARIOW_REDIRECT_URL     facultatif, page affichée après le paiement
 * Fournis automatiquement par Supabase : SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

import { createCheckout } from '../_shared/chariow.ts';
import { createHandler } from './handler.ts';

const opt = (name: string) => Deno.env.get(name)?.trim() || null;
const url = Deno.env.get('SUPABASE_URL');
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const apiKey = opt('CHARIOW_API_KEY');
if (!url || !serviceKey) throw new Error('SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis');
if (!apiKey) throw new Error('Variable d\'environnement manquante : CHARIOW_API_KEY');

const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

Deno.serve(
  createHandler({
    async getUser(token) {
      const { data, error } = await admin.auth.getUser(token);
      if (error || !data.user) return null;
      return { id: data.user.id, email: data.user.email || null, isAnonymous: data.user.is_anonymous ?? false };
    },
    offers: {
      monthly: { productId: opt('CHARIOW_PRODUCT_MONTHLY'), label: opt('CHARIOW_LABEL_MONTHLY') },
      yearly: { productId: opt('CHARIOW_PRODUCT_YEARLY'), label: opt('CHARIOW_LABEL_YEARLY') },
    },
    redirectUrl: opt('CHARIOW_REDIRECT_URL'),
    createCheckout: (input) => createCheckout({ apiKey }, input),
    log: (message, extra) => console.log(JSON.stringify({ message, ...extra })),
  }),
);
