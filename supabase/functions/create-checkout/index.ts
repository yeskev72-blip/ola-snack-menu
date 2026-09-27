/**
 * Edge Function create-checkout (Deno). Branche les vraies dépendances sur handler.ts.
 * Secrets Maketou : voir ../_shared/maketou-env.ts. Fournis par Supabase : SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 * Réglage requis : « Verify JWT » désactivé (le jeton est vérifié dans le code).
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

import { createCart } from '../_shared/maketou.ts';
import { currencyLabel, maketouSettings } from '../_shared/maketou-env.ts';
import { supabaseSettleDeps } from '../_shared/settle-supabase.ts';
import { createHandler } from './handler.ts';

const url = Deno.env.get('SUPABASE_URL');
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if (!url || !serviceKey) throw new Error('SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis');

const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const settings = maketouSettings();
const log = (message: string, extra?: Record<string, unknown>) => console.log(JSON.stringify({ message, ...extra }));

Deno.serve(
  createHandler({
    ...supabaseSettleDeps(admin, settings.config, log),
    async getUser(token) {
      const { data, error } = await admin.auth.getUser(token);
      if (error || !data.user) return null;
      return { id: data.user.id, email: data.user.email || null, isAnonymous: data.user.is_anonymous ?? false };
    },
    offers: settings.offers,
    currency: settings.currency,
    currencyLabel: currencyLabel(settings.currency),
    returnUrl: `${url}/functions/v1/maketou-return`,
    newId: () => crypto.randomUUID(),
    async saveIntent(intent) {
      const { error } = await admin.from('payment_intents').insert({
        id: intent.id,
        user_id: intent.userId,
        offer: intent.offer,
        amount: intent.amount,
        currency: intent.currency,
      });
      if (error) throw error;
    },
    async attachCart(intentId, cartId) {
      const { error } = await admin.from('payment_intents').update({ cart_id: cartId }).eq('id', intentId);
      if (error) throw error;
    },
    async pendingIntents(userId) {
      const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
      const { data, error } = await admin
        .from('payment_intents')
        .select('id, cart_id, user_id, offer, amount, currency, status')
        .eq('user_id', userId)
        .eq('status', 'pending')
        .not('cart_id', 'is', null)
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data ?? []).map((r) => ({
        id: r.id,
        cartId: r.cart_id,
        userId: r.user_id,
        offer: r.offer,
        amount: r.amount,
        currency: r.currency,
        status: r.status,
      }));
    },
    createCart: (input) => {
      if (!settings.config) throw new Error('MAKETOU_API_KEY manquant');
      return createCart(settings.config, input);
    },
    log,
  }),
);
