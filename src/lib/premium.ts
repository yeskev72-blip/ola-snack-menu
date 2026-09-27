import { FunctionsHttpError } from '@supabase/supabase-js';

import { t } from '@/i18n';
import { supabase } from '@/lib/supabase';

export type Offer = 'monthly' | 'yearly';

/** Offre Premium vendue sur Maketou, avec son prix (réglé côté serveur). */
export type PremiumOffer = { offer: Offer; amount: number; label: string };

export type CheckoutForm = { offer: Offer; firstName: string; lastName: string; phone: string };

/** Message français renvoyé par la fonction, sinon message générique. */
async function functionError(error: unknown, fallback: string): Promise<Error> {
  if (error instanceof FunctionsHttpError) {
    const payload = (await (error.context as Response).json().catch(() => null)) as { message?: string } | null;
    if (payload?.message) return new Error(payload.message);
  }
  return new Error(fallback);
}

/** Offres et prix disponibles (modifiables sans nouvel APK). */
export async function fetchOffers(): Promise<PremiumOffer[]> {
  const { data, error } = await supabase.functions.invoke<{ offers: PremiumOffer[] }>('create-checkout', {
    body: { action: 'offers' },
    timeout: 20_000,
  });
  if (error || !data) throw await functionError(error, t('premium.offersError'));
  return data.offers;
}

/** Prépare le paiement Maketou et renvoie le lien de la page de paiement. */
export async function startCheckout(form: CheckoutForm): Promise<string> {
  const { data, error } = await supabase.functions.invoke<{ url: string }>('create-checkout', {
    body: { offer: form.offer, first_name: form.firstName, last_name: form.lastName, phone: form.phone || undefined },
    timeout: 30_000,
  });
  if (error || !data?.url) throw await functionError(error, t('premium.checkoutError'));
  return data.url;
}

/**
 * Fait relire au serveur les paiements en attente (Maketou n'envoie pas de notification) :
 * un paiement abouti crédite le Premium. Renvoie le nombre de paiements crédités.
 */
export async function confirmPayments(): Promise<number> {
  const { data, error } = await supabase.functions.invoke<{ paid: number }>('create-checkout', {
    body: { action: 'confirm' },
    timeout: 30_000,
  });
  if (error || !data) throw await functionError(error, t('premium.confirmError'));
  return data.paid;
}
