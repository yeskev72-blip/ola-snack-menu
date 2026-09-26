import { FunctionsHttpError } from '@supabase/supabase-js';

import { t } from '@/i18n';
import { supabase } from '@/lib/supabase';

export type Offer = 'monthly' | 'yearly';

/** Pays où le paiement CinetPay est configuré, avec les prix dans sa devise (réglés côté serveur). */
export type PaymentCountry = {
  code: string;
  name: string;
  currency: string;
  calling_code: string;
  offers: { offer: Offer; amount: number; label: string }[];
};

export type CheckoutForm = { offer: Offer; countryCode: string; firstName: string; lastName: string; phone: string };

/** Message français renvoyé par la fonction, sinon message générique. */
async function functionError(error: unknown, fallback: string): Promise<Error> {
  if (error instanceof FunctionsHttpError) {
    const payload = (await (error.context as Response).json().catch(() => null)) as { message?: string } | null;
    if (payload?.message) return new Error(payload.message);
  }
  return new Error(fallback);
}

/** Pays et prix disponibles (modifiables sans nouvel APK). */
export async function fetchPaymentCountries(): Promise<PaymentCountry[]> {
  const { data, error } = await supabase.functions.invoke<{ countries: PaymentCountry[] }>('create-checkout', {
    body: { action: 'offers' },
    timeout: 20_000,
  });
  if (error || !data) throw await functionError(error, t('premium.offersError'));
  return data.countries;
}

/** Prépare le paiement CinetPay et renvoie le lien de la page de paiement. */
export async function startCheckout(form: CheckoutForm): Promise<string> {
  const { data, error } = await supabase.functions.invoke<{ url: string }>('create-checkout', {
    body: {
      offer: form.offer,
      country_code: form.countryCode,
      first_name: form.firstName,
      last_name: form.lastName,
      phone: form.phone,
    },
    timeout: 30_000,
  });
  if (error || !data?.url) throw await functionError(error, t('premium.checkoutError'));
  return data.url;
}
