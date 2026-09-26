/**
 * Edge Function cinetpay-webhook (Deno). Branche les vraies dépendances sur handler.ts.
 * Secrets CinetPay : voir ../_shared/cinetpay-env.ts. Fournis par Supabase : SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 * Réglage requis : « Verify JWT » désactivé (CinetPay n'envoie pas de jeton Supabase).
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

import { findPayment } from '../_shared/cinetpay.ts';
import { cinetpayAccounts } from '../_shared/cinetpay-env.ts';
import { createHandler, type StoredIntent } from './handler.ts';

const url = Deno.env.get('SUPABASE_URL');
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if (!url || !serviceKey) throw new Error('SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis');

const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const accounts = cinetpayAccounts();

Deno.serve(
  createHandler({
    async loadIntent(merchantTransactionId) {
      const { data, error } = await admin
        .from('payment_intents')
        .select('merchant_transaction_id, user_id, offer, amount, currency, country, notify_token, status')
        .eq('merchant_transaction_id', merchantTransactionId)
        .maybeSingle();
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
        status: data.status,
      } as StoredIntent;
    },
    async findPayment(country, merchantTransactionId) {
      const account = accounts[country];
      if (!account) throw new Error(`Compte CinetPay absent pour le pays ${country}`);
      return await findPayment(account, merchantTransactionId);
    },
    async grantPremium({ userId, saleId, offer, days, amount, currency }) {
      const { data, error } = await admin
        .rpc('grant_premium', { p_user_id: userId, p_sale_id: saleId, p_offer: offer, p_days: days, p_amount: amount, p_currency: currency })
        .single();
      if (error) throw error;
      const row = data as { granted: boolean; premium_until: string | null };
      return { granted: row.granted, premiumUntil: row.premium_until };
    },
    async markIntent(merchantTransactionId, status) {
      const { error } = await admin
        .from('payment_intents')
        .update({ status, completed_at: new Date().toISOString() })
        .eq('merchant_transaction_id', merchantTransactionId);
      if (error) throw error;
    },
    log: (message, extra) => console.log(JSON.stringify({ message, ...extra })),
  }),
);
