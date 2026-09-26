import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking, Pressable, StyleSheet, ToastAndroid, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { Icon } from '@/components/Icon';
import { Notice } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { t } from '@/i18n';
import { isOnline } from '@/lib/analyze';
import { formatNumber } from '@/lib/format';
import { formatDate, planStatus } from '@/lib/plan';
import { fetchPaymentCountries, type Offer, type PaymentCountry, startCheckout } from '@/lib/premium';
import { useSession } from '@/state/session';
import { colors, radius, spacing } from '@/theme';

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
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
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
      setCheckoutUrl(url);
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

  const monthly = country?.offers.find((o) => o.offer === 'monthly') ?? null;
  const yearly = country?.offers.find((o) => o.offer === 'yearly') ?? null;
  const freeMonths = monthly && yearly && monthly.amount > 0 ? Math.round(12 - yearly.amount / monthly.amount) : 0;

  if (isGuest) {
    return (
      <Screen back="close" footer={<Button label={t('profile.createAccount')} onPress={() => router.replace('/link-account')} />}>
        <Hero />
        <Notice tone="info" message={t('premium.guestOnly')} />
      </Screen>
    );
  }

  if (waiting && selected && country) {
    return (
      <Screen
        back="close"
        onBack={() => setWaiting(false)}
        footer={
          <>
            <Button label={t('premium.refresh')} icon="refresh" loading={busy === 'refresh'} onPress={() => void refresh()} />
            {checkoutUrl ? <Button label={t('premium.reopen')} variant="ghost" onPress={() => void Linking.openURL(checkoutUrl)} /> : null}
          </>
        }>
        <View style={styles.waitTop}>
          <View style={styles.waitIcon}>
            <Icon name="phone" size={44} color={colors.accent} strokeWidth={1.8} />
          </View>
          <AppText style={styles.waitTitle} accessibilityRole="header">
            {t('premium.waitTitle')}
          </AppText>
          <AppText variant="muted" style={styles.waitBody}>
            {t('premium.waitBody')}
          </AppText>
        </View>
        <Card>
          <Recap label={t('premium.recapOffer')} value={t(offer === 'monthly' ? 'premium.monthlyShort' : 'premium.yearlyShort')} />
          <Recap label={t('premium.recapAmount')} value={selected.label.split(' / ')[0]!} />
          <Recap label={t('premium.recapPhone')} value={maskPhone(phone, country.calling_code)} />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen
      back="close"
      footer={
        <>
          <Button
            label={selected ? t('premium.pay', { label: selected.label }) : t('premium.payNoPrice')}
            loading={busy === 'pay'}
            disabled={!selected || busy !== null}
            onPress={() => void pay()}
          />
          <View style={styles.secure}>
            <Icon name="lock" size={16} color="#5A4A3C" />
            <AppText style={styles.secureText}>{t('premium.secure')}</AppText>
          </View>
        </>
      }>
      <Hero />

      {status.kind === 'premium' ? (
        <Card tone="soft">
          <AppText style={styles.bold}>{status.until ? t('profile.planUntil', { date: formatDate(status.until) }) : t('profile.planPermanent')}</AppText>
          <AppText variant="small">{t('premium.extendHint')}</AppText>
        </Card>
      ) : null}

      {countries && countries.length === 0 ? <Notice tone="info" message={t('premium.noCountry')} /> : null}

      <View style={styles.offers} accessibilityRole="radiogroup">
        {yearly ? (
          <OfferCard
            title={t('premium.yearlyShort')}
            sub={monthly ? t('premium.perMonth', { price: priceOnly(Math.round(yearly.amount / 12), yearly.label) }) : ''}
            price={yearly.label}
            badge={freeMonths > 0 ? t('premium.freeMonths', { count: freeMonths }) : undefined}
            selected={offer === 'yearly'}
            onPress={() => setOffer('yearly')}
          />
        ) : null}
        {monthly ? (
          <OfferCard
            title={t('premium.monthlyShort')}
            sub={t('premium.noCommitment')}
            price={monthly.label}
            selected={offer === 'monthly'}
            onPress={() => setOffer('monthly')}
          />
        ) : null}
      </View>

      <AppText style={styles.bold}>{t('premium.country')}</AppText>
      <View style={styles.countries} accessibilityRole="radiogroup">
        {(countries ?? []).map((c) => (
          <View key={c.code} style={styles.countryCell}>
            <Chip label={c.name} selected={countryCode === c.code} onPress={() => setCountryCode(c.code)} />
          </View>
        ))}
      </View>

      <View style={styles.names}>
        <View style={styles.flex}>
          <TextField label={t('premium.firstName')} value={firstName} onChangeText={setFirstName} autoComplete="given-name" maxLength={60} />
        </View>
        <View style={styles.flex}>
          <TextField label={t('premium.lastName')} value={lastName} onChangeText={setLastName} autoComplete="family-name" maxLength={60} />
        </View>
      </View>
      <View style={styles.phoneRow}>
        {country ? (
          <View style={styles.dial}>
            <AppText style={styles.bold}>+{country.calling_code}</AppText>
          </View>
        ) : null}
        <View style={styles.flex}>
          <TextField
            label={t('premium.phone')}
            value={phone}
            onChangeText={(text) => setPhone(text.replace(/[^\d +]/g, ''))}
            keyboardType="phone-pad"
            autoComplete="tel"
            maxLength={22}
          />
        </View>
      </View>

      <Notice message={error} />
    </Screen>
  );
}

function Hero() {
  return (
    <>
      <View style={styles.heroTitles}>
        <AppText style={styles.kicker}>Calbasse Premium</AppText>
        <AppText style={styles.heroTitle} accessibilityRole="header">
          {t('premium.heroTitle')}
        </AppText>
      </View>
      <View style={styles.compare}>
        <View style={styles.compareCol}>
          <AppText style={styles.compareFree}>2</AppText>
          <AppText style={styles.compareFreeLabel}>{t('profile.planFree')}</AppText>
        </View>
        <Icon name="arrowRight" size={24} color="#B9AB9C" />
        <View style={styles.compareCol}>
          <AppText style={styles.comparePremium}>30</AppText>
          <AppText style={styles.comparePremiumLabel}>{t('premium.scansPerDay')}</AppText>
        </View>
      </View>
    </>
  );
}

function OfferCard({ title, sub, price, badge, selected, onPress }: { title: string; sub: string; price: string; badge?: string; selected: boolean; onPress: () => void }) {
  const [amount, unit] = price.split(' / ');
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${title}, ${price}${badge ? `, ${badge}` : ''}`}
      onPress={onPress}
      style={({ pressed }) => [styles.offer, selected && styles.offerSelected, pressed && !selected && styles.offerPressed]}>
      {badge ? (
        <View style={styles.offerBadge}>
          <AppText style={styles.offerBadgeText}>{badge}</AppText>
        </View>
      ) : null}
      <View style={[styles.radio, selected && styles.radioSelected]}>{selected ? <View style={styles.radioDot} /> : null}</View>
      <View style={styles.flex}>
        <AppText style={styles.offerTitle}>{title}</AppText>
        {sub ? <AppText variant="small">{sub}</AppText> : null}
      </View>
      <AppText style={styles.offerPrice}>
        {amount}
        {unit ? <AppText style={styles.offerUnit}> / {unit}</AppText> : null}
      </AppText>
    </Pressable>
  );
}

function Recap({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.recap}>
      <AppText variant="muted">{label}</AppText>
      <AppText style={styles.bold}>{value}</AppText>
    </View>
  );
}

/** « 2 000 FCFA / mois » + montant → « 1 667 FCFA » (même devise). */
function priceOnly(amount: number, label: string): string {
  const currency = label.split(' / ')[0]!.replace(/^[\d\s\u00a0\u202f]+/, '');
  return `${formatNumber(amount)} ${currency}`;
}

/** Numéro masqué pour le récapitulatif : « +229 01 97 •• •• 12 ». */
function maskPhone(phone: string, callingCode: string): string {
  const digits = phone.replace(/\D/g, '').replace(new RegExp(`^(00)?${callingCode}`), '');
  if (digits.length < 6) return `+${callingCode} ${digits}`;
  return `+${callingCode} ${digits.slice(0, 4)} •• •• ${digits.slice(-2)}`;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bold: { fontWeight: '700' },
  heroTitles: { gap: spacing.sm },
  kicker: { fontSize: 13, lineHeight: 18, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase', color: colors.accent },
  heroTitle: { fontSize: 28, lineHeight: 34, fontWeight: '800', letterSpacing: -0.5 },
  compare: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', padding: 18, borderRadius: radius.lg, backgroundColor: colors.primary },
  compareCol: { alignItems: 'center' },
  compareFree: { fontSize: 36, lineHeight: 42, fontWeight: '800', color: '#B9AB9C', textDecorationLine: 'line-through' },
  compareFreeLabel: { fontSize: 13, lineHeight: 18, fontWeight: '600', color: '#D8CBBB' },
  comparePremium: { fontSize: 52, lineHeight: 58, fontWeight: '800', letterSpacing: -1.5, color: '#F7F0E6' },
  comparePremiumLabel: { fontSize: 13, lineHeight: 18, fontWeight: '700', color: '#E7B24A' },
  offers: { gap: 10 },
  offer: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    borderRadius: radius.card,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  offerSelected: { borderColor: colors.primary },
  offerPressed: { backgroundColor: colors.surfaceAlt },
  offerBadge: { position: 'absolute', top: -11, right: spacing.md, paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: colors.highlight },
  offerBadgeText: { fontSize: 12, lineHeight: 16, fontWeight: '800', color: colors.text },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  radioSelected: { borderColor: colors.primary },
  radioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.primary },
  offerTitle: { fontSize: 17, lineHeight: 22, fontWeight: '800' },
  offerPrice: { fontSize: 17, lineHeight: 22, fontWeight: '800' },
  offerUnit: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  countries: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 },
  countryCell: { width: '50%', padding: 4 },
  names: { flexDirection: 'row', gap: 10 },
  phoneRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  dial: { height: 56, paddingHorizontal: 14, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, justifyContent: 'center' },
  secure: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  secureText: { flex: 1, fontSize: 13, lineHeight: 19, color: '#5A4A3C' },
  waitTop: { alignItems: 'center', gap: spacing.md, paddingTop: 12 },
  waitIcon: { width: 120, height: 120, borderRadius: 60, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  waitTitle: { fontSize: 26, lineHeight: 32, fontWeight: '800', letterSpacing: -0.5, textAlign: 'center' },
  waitBody: { fontSize: 17, lineHeight: 25, textAlign: 'center' },
  recap: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
});
