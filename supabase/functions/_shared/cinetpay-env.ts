/**
 * Réglages CinetPay lus dans les secrets Supabase (Edge Functions > Secrets), communs aux deux fonctions.
 *   CINETPAY_ENV                    « sandbox » (défaut, tests) ou « production »
 *   CINETPAY_<PAYS>_API_KEY         clé du compte marchand du pays (ex. CINETPAY_BJ_API_KEY)
 *   CINETPAY_<PAYS>_API_PASSWORD    mot de passe API du même compte
 *   PREMIUM_PRICE_<OFFRE>_<DEVISE>  prix entier, ex. PREMIUM_PRICE_MONTHLY_XOF=2000
 *                                   défauts : XOF et XAF 2000 / 20000 ; GNF et CDF sans prix (pays masqués)
 * Un pays n'est proposé que si sa clé, son mot de passe et le prix de sa devise existent.
 */

import { CINETPAY_BASE_URLS, type CinetPayConfig, type CinetPayEnvironment, COUNTRIES, type Currency, OFFERS } from './cinetpay.ts';

const opt = (name: string) => Deno.env.get(name)?.trim() || null;

export function cinetpayEnvironment(): CinetPayEnvironment {
  const value = (opt('CINETPAY_ENV') ?? 'sandbox').toLowerCase();
  if (value !== 'sandbox' && value !== 'production') throw new Error('CINETPAY_ENV doit valoir « sandbox » ou « production »');
  return value;
}

/** Comptes configurés, par code pays. */
export function cinetpayAccounts(): Record<string, CinetPayConfig> {
  const baseUrl = CINETPAY_BASE_URLS[cinetpayEnvironment()];
  const accounts: Record<string, CinetPayConfig> = {};
  for (const code of Object.keys(COUNTRIES)) {
    const apiKey = opt(`CINETPAY_${code}_API_KEY`);
    const apiPassword = opt(`CINETPAY_${code}_API_PASSWORD`);
    if (apiKey && apiPassword) accounts[code] = { apiKey, apiPassword, baseUrl };
  }
  return accounts;
}

const DEFAULT_PRICES: Partial<Record<Currency, Record<(typeof OFFERS)[number], number>>> = {
  XOF: { monthly: 2000, yearly: 20000 },
  XAF: { monthly: 2000, yearly: 20000 },
};

export function premiumPrices() {
  const prices: Partial<Record<Currency, Record<(typeof OFFERS)[number], number>>> = {};
  for (const currency of ['XOF', 'XAF', 'GNF', 'CDF'] as Currency[]) {
    const read = (offer: string) => {
      const raw = opt(`PREMIUM_PRICE_${offer.toUpperCase()}_${currency}`);
      if (raw === null) return DEFAULT_PRICES[currency]?.[offer as 'monthly' | 'yearly'] ?? null;
      const value = Number(raw);
      if (!Number.isInteger(value) || value <= 0) throw new Error(`PREMIUM_PRICE_${offer.toUpperCase()}_${currency} invalide`);
      return value;
    };
    const monthly = read('monthly');
    const yearly = read('yearly');
    if (monthly && yearly) prices[currency] = { monthly, yearly };
  }
  return prices;
}
