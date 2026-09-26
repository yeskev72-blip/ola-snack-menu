import { FunctionsHttpError } from '@supabase/supabase-js';

import { t } from '@/i18n';
import { supabase } from '@/lib/supabase';

export type Offer = 'monthly' | 'yearly';
export type OfferInfo = { offer: Offer; label: string | null; available: boolean };

export type CheckoutForm = {
  offer: Offer;
  firstName: string;
  lastName: string;
  phone: string;
  countryCode: string;
  discountCode?: string;
};

/** Message français renvoyé par la fonction, sinon message générique. */
async function functionError(error: unknown, fallback: string): Promise<Error> {
  if (error instanceof FunctionsHttpError) {
    const payload = (await (error.context as Response).json().catch(() => null)) as { message?: string } | null;
    if (payload?.message) return new Error(payload.message);
  }
  return new Error(fallback);
}

/** Offres Premium et prix affichés (réglés côté serveur, modifiables sans nouvel APK). */
export async function fetchOffers(): Promise<OfferInfo[]> {
  const { data, error } = await supabase.functions.invoke<{ offers: OfferInfo[] }>('create-checkout', {
    body: { action: 'offers' },
    timeout: 20_000,
  });
  if (error || !data) throw await functionError(error, t('premium.offersError'));
  return data.offers;
}

/** Prépare le paiement Chariow et renvoie le lien de la page de paiement. */
export async function startCheckout(form: CheckoutForm): Promise<string> {
  const { data, error } = await supabase.functions.invoke<{ url: string }>('create-checkout', {
    body: {
      offer: form.offer,
      first_name: form.firstName,
      last_name: form.lastName,
      phone: form.phone,
      country_code: form.countryCode,
      ...(form.discountCode?.trim() ? { discount_code: form.discountCode.trim() } : {}),
    },
    timeout: 30_000,
  });
  if (error || !data?.url) throw await functionError(error, t('premium.checkoutError'));
  return data.url;
}
