/**
 * Edge Function create-checkout (Deno). Branche les vraies dépendances sur handler.ts.
 * Secrets CinetPay : voir ../_shared/cinetpay-env.ts. Fournis par Supabase : SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 * Réglage requis : « Verify JWT » désactivé (le jeton est vérifié dans le code).
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

import { createPayment } from '../_shared/cinetpay.ts';
import { cinetpayAccounts, premiumPrices } from '../_shared/cinetpay-env.ts';
import { createHandler } from './handler.ts';

const url = Deno.env.get('SUPABASE_URL');
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if (!url || !serviceKey) throw new Error('SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis');

const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const accounts = cinetpayAccounts();

Deno.serve(
  createHandler({
    async getUser(token) {
      const { data, error } = await admin.auth.getUser(token);
      if (error || !data.user) return null;
      return { id: data.user.id, email: data.user.email || null, isAnonymous: data.user.is_anonymous ?? false };
    },
    enabledCountries: Object.keys(accounts),
    prices: premiumPrices(),
    webhookUrl: `${url}/functions/v1/cinetpay-webhook`,
    async saveIntent(intent) {
      const { error } = await admin.from('payment_intents').insert({
        merchant_transaction_id: intent.merchantTransactionId,
        user_id: intent.userId,
        offer: intent.offer,
        amount: intent.amount,
        currency: intent.currency,
        country: intent.country,
      });
      if (error) throw error;
    },
    async attachIntent(merchantTransactionId, init) {
      const { error } = await admin
        .from('payment_intents')
        .update({ notify_token: init.notifyToken, transaction_id: init.transactionId || null })
        .eq('merchant_transaction_id', merchantTransactionId);
      if (error) throw error;
    },
    createPayment: (country, input) => createPayment(accounts[country]!, input),
    log: (message, extra) => console.log(JSON.stringify({ message, ...extra })),
  }),
);
