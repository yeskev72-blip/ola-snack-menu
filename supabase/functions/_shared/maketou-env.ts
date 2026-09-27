/**
 * Réglages Maketou lus dans les secrets Supabase (Edge Functions > Secrets), communs aux deux fonctions.
 *   MAKETOU_API_KEY            clé API de la boutique Maketou
 *   MAKETOU_PRODUCT_MONTHLY    identifiant public (productDocumentId) du produit « Premium 1 mois »
 *   MAKETOU_PRODUCT_YEARLY     identifiant public du produit « Premium 1 an »
 *   PREMIUM_PRICE_MONTHLY      prix affiché dans l'app, défaut 2000 (doit être celui du produit Maketou)
 *   PREMIUM_PRICE_YEARLY       défaut 20000
 *   PREMIUM_CURRENCY           code enregistré avec le paiement, défaut XOF (affiché « FCFA »)
 * Sans clé ou sans produit, l'offre correspondante n'est pas proposée.
 */

import { type MaketouConfig, type Offer, OFFERS } from './maketou.ts';

const opt = (name: string) => Deno.env.get(name)?.trim() || null;

export type OfferConfig = { productId: string; amount: number };

export type MaketouSettings = {
  config: MaketouConfig | null;
  offers: Partial<Record<Offer, OfferConfig>>;
  currency: string;
};

const DEFAULT_PRICES: Record<Offer, number> = { monthly: 2000, yearly: 20000 };

export function maketouSettings(): MaketouSettings {
  const apiKey = opt('MAKETOU_API_KEY');
  const offers: Partial<Record<Offer, OfferConfig>> = {};
  for (const offer of OFFERS) {
    const productId = opt(`MAKETOU_PRODUCT_${offer.toUpperCase()}`);
    const raw = opt(`PREMIUM_PRICE_${offer.toUpperCase()}`);
    const amount = raw === null ? DEFAULT_PRICES[offer] : Number(raw);
    if (!Number.isInteger(amount) || amount <= 0) throw new Error(`PREMIUM_PRICE_${offer.toUpperCase()} invalide`);
    if (apiKey && productId) offers[offer] = { productId, amount };
  }
  return { config: apiKey ? { apiKey } : null, offers, currency: (opt('PREMIUM_CURRENCY') ?? 'XOF').toUpperCase() };
}

/** Libellé affiché pour une devise (XOF et XAF → FCFA). */
export const currencyLabel = (currency: string) => (currency === 'XOF' || currency === 'XAF' ? 'FCFA' : currency);
