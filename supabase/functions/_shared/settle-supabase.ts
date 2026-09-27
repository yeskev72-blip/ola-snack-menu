/** Dépendances réelles (Supabase + Maketou) de la confirmation des paiements, communes aux deux fonctions. */

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

import { getCart, type MaketouConfig } from './maketou.ts';
import type { SettleDeps } from './settle.ts';

export function supabaseSettleDeps(admin: SupabaseClient, config: MaketouConfig | null, log: SettleDeps['log']): SettleDeps {
  return {
    getCart: (cartId) => {
      if (!config) throw new Error('MAKETOU_API_KEY manquant');
      return getCart(config, cartId);
    },
    async grantPremium({ userId, saleId, offer, days, amount, currency }) {
      const { data, error } = await admin
        .rpc('grant_premium', { p_user_id: userId, p_sale_id: saleId, p_offer: offer, p_days: days, p_amount: amount, p_currency: currency })
        .single();
      if (error) throw error;
      const row = data as { granted: boolean; premium_until: string | null };
      return { granted: row.granted, premiumUntil: row.premium_until };
    },
    async markPaid(intentId) {
      const { error } = await admin
        .from('payment_intents')
        .update({ status: 'paid', completed_at: new Date().toISOString() })
        .eq('id', intentId);
      if (error) throw error;
    },
    log,
  };
}
