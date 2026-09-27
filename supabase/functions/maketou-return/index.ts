/**
 * Edge Function maketou-return (Deno). Branche les vraies dépendances sur handler.ts.
 * Secrets Maketou : voir ../_shared/maketou-env.ts. Fournis par Supabase : SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 * Réglage requis : « Verify JWT » désactivé (le navigateur n'envoie pas de jeton Supabase).
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

import { maketouSettings } from '../_shared/maketou-env.ts';
import { supabaseSettleDeps } from '../_shared/settle-supabase.ts';
import { createHandler } from './handler.ts';

const url = Deno.env.get('SUPABASE_URL');
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if (!url || !serviceKey) throw new Error('SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis');

const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const log = (message: string, extra?: Record<string, unknown>) => console.log(JSON.stringify({ message, ...extra }));

Deno.serve(
  createHandler({
    ...supabaseSettleDeps(admin, maketouSettings().config, log),
    async loadIntent(id) {
      const { data, error } = await admin
        .from('payment_intents')
        .select('id, cart_id, user_id, offer, amount, currency, status')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        id: data.id,
        cartId: data.cart_id,
        userId: data.user_id,
        offer: data.offer,
        amount: data.amount,
        currency: data.currency,
        status: data.status,
      };
    },
  }),
);
