import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking, StyleSheet, ToastAndroid, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { Notice } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { t } from '@/i18n';
import { isOnline } from '@/lib/analyze';
import { formatDate, planStatus } from '@/lib/plan';
import { fetchPaymentCountries, type Offer, type PaymentCountry, startCheckout } from '@/lib/premium';
import { useSession } from '@/state/session';
import { spacing } from '@/theme';

/** Achat du Premium : pays, offre, coordonnées de paiement, page CinetPay dans le navigateur. */
export default function Premium() {
  const { user, profile, refreshProfile } = useSession();
  const isGuest = user?.isAnonymous ?? true;
  const status = planStatus(profile?.plan, profile?.premium_until);

  const [countries, setCountries] = useState<PaymentCountry[] | null>(null);
  const [offer, setOffer] = useState<Offer>('monthly');
  const [firstName, setFirstName] = useState(profile?.prenom ?? '');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [countryCode, setCountryCode] = useState<string | null>(null);
  const [busy, setBusy] = useState<'pay' | 'refresh' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(false);
  const untilBefore = useRef(profile?.premium_until ?? null);

  useFocusEffect(
    useCallback(() => {
      if (isGuest) return;
      fetchPaymentCountries()
        .then((list) => {
          setCountries(list);
          // Premier pays par défaut ; le choix de l'utilisateur est gardé s'il reste disponible.
          setCountryCode((current) => (list.some((c) => c.code === current) ? current : (list[0]?.code ?? null)));
        })
        .catch((e: Error) => setError(e.message));
    }, [isGuest]),
  );

  // Retour du navigateur après le paiement : on relit le profil (le Premium est crédité par le serveur).
  useEffect(() => {
    if (!waiting) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refreshProfile();
    });
    return () => sub.remove();
  }, [waiting, refreshProfile]);

  // Premium crédité (nouvelle date de fin ou passage en permanent) : confirmation.
  useEffect(() => {
    if (!waiting) return;
    if (status.kind === 'premium' && (profile?.premium_until ?? null) !== untilBefore.current) {
      setWaiting(false);
      ToastAndroid.show(t('premium.activated'), ToastAndroid.LONG);
    }
  }, [waiting, status.kind, profile?.premium_until]);

  const country = countries?.find((c) => c.code === countryCode) ?? null;
  const selected = country?.offers.find((o) => o.offer === offer) ?? null;

  const pay = async () => {
    setError(null);
    if (!country) return setError(t('premium.noCountry'));
    if (firstName.trim().length < 2 || lastName.trim().length < 2 || phone.replace(/\D/g, '').length < 6) return setError(t('premium.fillAll'));
    if (!(await isOnline())) return setError(t('premium.offline'));
    setBusy('pay');
    try {
      const url = await startCheckout({ offer, countryCode: country.code, firstName: firstName.trim(), lastName: lastName.trim(), phone });
      untilBefore.current = profile?.premium_until ?? null;
      setWaiting(true);
      await Linking.openURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('premium.checkoutError'));
    } finally {
      setBusy(null);
    }
  };

  const refresh = async () => {
    setBusy('refresh');
    await refreshProfile().catch(() => undefined);
    setBusy(null);
  };

  const statusText =
    status.kind === 'free'
      ? t('premium.free')
      : status.until
        ? t('premium.activeUntil', { date: formatDate(status.until) })
        : t('premium.permanent');

  if (isGuest) {
    return (
      <Screen>
        <AppText variant="title">{t('premium.title')}</AppText>
        <AppText>{t('premium.pitch')}</AppText>
        <Notice tone="info" message={t('premium.guestOnly')} />
        <Button label={t('profile.createAccount')} onPress={() => router.replace('/link-account')} />
      </Screen>
    );
  }

  return (
    <Screen
      footer={
        <>
          <Button
            label={selected ? t('premium.pay', { label: selected.label }) : t('premium.payNoPrice')}
            loading={busy === 'pay'}
            disabled={!selected || busy !== null}
            onPress={() => void pay()}
          />
          {waiting ? (
            <Button label={t('premium.refresh')} variant="secondary" loading={busy === 'refresh'} onPress={() => void refresh()} />
          ) : null}
        </>
      }>
      <AppText variant="title">{t('premium.title')}</AppText>
      <Card>
        <AppText variant="large">{statusText}</AppText>
        <AppText>{t('premium.pitch')}</AppText>
      </Card>

      {countries && countries.length === 0 ? <Notice tone="info" message={t('premium.noCountry')} /> : null}

      <AppText variant="muted">{t('premium.country')}</AppText>
      <View style={styles.chips} accessibilityRole="radiogroup">
        {(countries ?? []).map((c) => (
          <Chip key={c.code} label={c.name} selected={countryCode === c.code} onPress={() => setCountryCode(c.code)} />
        ))}
      </View>

      <View style={styles.chips} accessibilityRole="radiogroup">
        {(['monthly', 'yearly'] as const).map((o) => {
          const price = country?.offers.find((x) => x.offer === o)?.label;
          return (
            <Chip
              key={o}
              label={`${t(o === 'monthly' ? 'premium.monthly' : 'premium.yearly')}${price ? ` · ${price}` : ''}`}
              selected={offer === o}
              onPress={() => setOffer(o)}
            />
          );
        })}
      </View>

      <TextField label={t('premium.firstName')} value={firstName} onChangeText={setFirstName} autoComplete="given-name" maxLength={60} />
      <TextField label={t('premium.lastName')} value={lastName} onChangeText={setLastName} autoComplete="family-name" maxLength={60} />
      <TextField
        label={country ? t('premium.phoneWithCode', { code: country.calling_code }) : t('premium.phone')}
        value={phone}
        onChangeText={(text) => setPhone(text.replace(/[^\d +]/g, ''))}
        keyboardType="phone-pad"
        autoComplete="tel"
        maxLength={22}
      />

      {waiting ? <Notice tone="info" message={t('premium.opening')} /> : null}
      <Notice message={error} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
