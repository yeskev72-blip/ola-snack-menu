import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { MACROS } from '@/components/Macros';
import { Notice } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { t, type MessageKey } from '@/i18n';
import { isOnline } from '@/lib/analyze';
import { macroTargets } from '@/lib/calories';
import { formatNumber } from '@/lib/format';
import { pendingCount, syncMeals } from '@/lib/meals';
import { daysLeft, formatDate, planStatus } from '@/lib/plan';
import { ACTIVITIES, activityFromFactor, GOALS } from '@/lib/profileOptions';
import { useAction } from '@/lib/useAction';
import { useSession } from '@/state/session';
import { colors, radius, shadow, spacing } from '@/theme';

export default function Profile() {
  const { user, profile, signOut, deleteAccount, updateProfile } = useSession();
  const isGuest = user?.isAnonymous ?? false;
  const [error, setError] = useState<string | null>(null);
  const toggleSharing = useAction((value: boolean) => updateProfile({ partage_photos: value }));
  const remove = useAction(deleteAccount);

  const confirmSignOut = async () => {
    if (!user) return;
    if (isGuest) {
      // Un invité déconnecté ne peut plus retrouver son compte.
      return Alert.alert(t('profile.signOutGuestTitle'), t('profile.signOutGuestBody'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('profile.signOut'), style: 'destructive', onPress: () => void signOut() },
      ]);
    }
    // Dernière tentative d'envoi ; s'il reste des repas locaux, on prévient avant de les effacer.
    await syncMeals(user.id);
    const pending = await pendingCount(user.id);
    if (pending === 0) return void signOut();
    Alert.alert(t('profile.signOutPendingTitle'), t('profile.signOutPendingBody', { count: pending }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('profile.signOutAnyway'), style: 'destructive', onPress: () => void signOut() },
    ]);
  };

  const confirmDelete = async () => {
    setError(null);
    if (!(await isOnline())) return setError(t('profile.deleteOffline'));
    Alert.alert(t('profile.deleteTitle'), t('profile.deleteBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('profile.deleteConfirm'),
        style: 'destructive',
        onPress: () => {
          void remove.run().then((ok) => {
            if (!ok) setError(t('profile.deleteError'));
          });
        },
      },
    ]);
  };

  const goal = GOALS.find((g) => g.value === profile?.objectif);
  const activity = profile?.niveau_activite ? ACTIVITIES.find((a) => a.value === activityFromFactor(profile.niveau_activite)) : undefined;
  const plan = planStatus(profile?.plan, profile?.premium_until);
  const remaining = plan.kind === 'premium' && plan.until ? daysLeft(plan.until) : null;
  const target = profile?.calories_cible ?? null;
  const macros = target ? macroTargets(target) : null;
  const name = profile?.prenom || (isGuest ? t('profile.guestAccount') : t('profile.title'));
  const edit = () => router.push('/profile-edit');
  const short = (key: MessageKey) => t(key).split(' (')[0]!;

  return (
    <Screen edges={['top']}>
      <AppText style={styles.pageTitle} accessibilityRole="header">
        {t('profile.title')}
      </AppText>

      <View style={styles.identity}>
        <View style={styles.avatar}>
          <AppText style={styles.avatarText}>{name.charAt(0).toUpperCase()}</AppText>
        </View>
        <View style={styles.flex}>
          <AppText style={styles.name}>{name}</AppText>
          <AppText variant="muted" numberOfLines={1}>
            {isGuest ? t('profile.guestShort') : user?.email}
          </AppText>
        </View>
      </View>

      {isGuest ? (
        <Card>
          <AppText style={styles.bold}>{t('profile.guestAccount')}</AppText>
          <AppText variant="muted">{t('profile.guestWarning')}</AppText>
          <Button label={t('profile.createAccount')} onPress={() => router.push('/link-account')} />
        </Card>
      ) : null}

      <Card tone="soft" style={styles.plan}>
        <View style={styles.planHead}>
          <AppText style={styles.planLabel}>{t('premium.cardTitle')}</AppText>
          <View style={[styles.planBadge, plan.kind === 'free' && styles.planBadgeFree]}>
            <AppText style={[styles.planBadgeText, plan.kind === 'free' && styles.planBadgeTextFree]}>
              {plan.kind === 'premium' ? 'Premium' : t('profile.planFree')}
            </AppText>
          </View>
        </View>
        <View>
          <AppText style={styles.planTitle}>
            {plan.kind === 'free'
              ? t('profile.planFreeTitle')
              : plan.until
                ? t('profile.planUntil', { date: formatDate(plan.until) })
                : t('profile.planPermanent')}
          </AppText>
          <AppText style={styles.planSub}>
            {plan.kind === 'free'
              ? t('profile.planFreeSub')
              : remaining !== null
                ? t('profile.planDaysLeft', { count: remaining })
                : t('profile.planPremiumSub')}
          </AppText>
        </View>
        {plan.kind === 'premium' && !plan.until ? null : (
          <Button
            label={plan.kind === 'premium' ? t('profile.extendShort') : t('premium.upgrade')}
            variant={plan.kind === 'premium' ? 'secondary' : 'primary'}
            small
            style={styles.planButton}
            onPress={() => router.push('/premium')}
          />
        )}
      </Card>

      <AppText variant="label" style={styles.section}>
        {t('profile.body')}
      </AppText>
      <View style={styles.group}>
        <Row label={t('onboarding.sex')} value={profile?.sexe ? t(profile.sexe === 'femme' ? 'onboarding.female' : 'onboarding.male') : '–'} onPress={edit} />
        <Row label={t('profile.age')} value={profile?.age ? t('profile.years', { count: profile.age }) : '–'} onPress={edit} />
        <Row label={t('profile.height')} value={profile?.taille_cm ? `${formatNumber(profile.taille_cm / 100)} m` : '–'} onPress={edit} />
        <Row label={t('profile.weight')} value={profile?.poids_kg ? `${formatNumber(profile.poids_kg)} kg` : '–'} onPress={edit} />
        <Row label={t('profile.activity')} value={activity ? short(activity.label) : '–'} onPress={edit} last />
      </View>

      <AppText variant="label" style={styles.section}>
        {t('profile.goalAndTarget')}
      </AppText>
      <View style={styles.group}>
        <Row label={t('profile.goal')} value={goal ? t(goal.label) : '–'} onPress={edit} />
        <Row label={t('profile.target')} value={target ? t('common.kcalPerDay', { kcal: formatNumber(target) }) : '–'} onPress={edit} />
        <Pressable accessibilityRole="button" onPress={edit} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
          <AppText>{t('profile.macros')}</AppText>
          {macros ? (
            <View style={styles.macros}>
              {MACROS.map((m) => (
                <View key={m.key} style={styles.macro}>
                  <View style={[styles.dot, { backgroundColor: m.color }]} />
                  <AppText style={styles.macroText}>{formatNumber(macros[m.key])} g</AppText>
                </View>
              ))}
            </View>
          ) : (
            <AppText style={styles.bold}>–</AppText>
          )}
        </Pressable>
      </View>

      <AppText variant="label" style={styles.section}>
        {t('profile.preferences')}
      </AppText>
      <View style={styles.group}>
        {!isGuest ? (
          <View style={[styles.switchRow, styles.border]}>
            <View style={styles.flex}>
              <AppText style={styles.bold}>{t('profile.photoSharing')}</AppText>
              <AppText variant="small">{t('profile.photoSharingHint')}</AppText>
              <Notice message={toggleSharing.error ? t('profile.saveError') : null} />
            </View>
            <Switch
              value={profile?.partage_photos ?? false}
              disabled={toggleSharing.loading}
              onValueChange={(value) => void toggleSharing.run(value)}
              trackColor={{ true: colors.accent, false: colors.border }}
              thumbColor={colors.surface}
              accessibilityLabel={t('profile.photoSharing')}
            />
          </View>
        ) : null}
        <View style={styles.row}>
          <AppText>{t('profile.language')}</AppText>
          <AppText style={styles.bold}>{t('profile.languageName')}</AppText>
        </View>
      </View>

      <Pressable accessibilityRole="button" onPress={() => void confirmSignOut()} style={({ pressed }) => [styles.signOut, pressed && styles.pressed]}>
        <Icon name="logout" size={20} />
        <AppText style={styles.bold}>{t('profile.signOut')}</AppText>
      </Pressable>

      <View style={styles.danger}>
        <AppText style={styles.dangerLabel}>{t('profile.dangerZone')}</AppText>
        <AppText style={styles.dangerText}>{t('profile.dangerText')}</AppText>
        <Pressable
          accessibilityRole="button"
          disabled={remove.loading}
          onPress={() => void confirmDelete()}
          style={({ pressed }) => [styles.dangerButton, pressed && styles.dangerPressed, remove.loading && styles.disabled]}>
          <AppText style={styles.dangerButtonText}>{t('profile.deleteShort')}</AppText>
        </Pressable>
        <Notice message={error} />
      </View>

      <AppText variant="small" style={styles.version}>
        {t('profile.version', { version: Constants.expoConfig?.version ?? '?' })}
      </AppText>
    </Screen>
  );
}

function Row({ label, value, onPress, last }: { label: string; value: string; onPress: () => void; last?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label} : ${value}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, !last && styles.border, pressed && styles.pressed]}>
      <AppText>{label}</AppText>
      <AppText style={styles.bold}>{value}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bold: { fontWeight: '700' },
  pageTitle: { fontSize: 26, lineHeight: 32, fontWeight: '800', letterSpacing: -0.5, marginTop: spacing.xs },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 24, lineHeight: 30, fontWeight: '800', color: '#7A3814' },
  name: { fontSize: 19, lineHeight: 24, fontWeight: '800' },
  plan: { borderRadius: radius.lg, gap: 12 },
  planHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  planLabel: { fontSize: 13, lineHeight: 18, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase', color: '#7A3814' },
  planBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: colors.primary },
  planBadgeFree: { backgroundColor: colors.surface },
  planBadgeText: { fontSize: 12, lineHeight: 16, fontWeight: '800', color: '#E7B24A' },
  planBadgeTextFree: { color: colors.text },
  planTitle: { fontSize: 18, lineHeight: 24, fontWeight: '800' },
  planSub: { fontSize: 14, lineHeight: 20, color: '#5A4A3C' },
  planButton: { alignSelf: 'flex-start' },
  section: { marginTop: spacing.sm },
  group: { borderRadius: radius.card, backgroundColor: colors.surface, ...shadow.card },
  row: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, paddingHorizontal: spacing.md },
  border: { borderBottomWidth: 1, borderBottomColor: colors.surfaceAlt },
  pressed: { backgroundColor: colors.surfaceAlt },
  switchRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: spacing.md },
  macros: { flexDirection: 'row', gap: 10 },
  macro: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  macroText: { fontSize: 15, fontWeight: '700' },
  signOut: { minHeight: 52, marginTop: spacing.xs, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: spacing.md, borderRadius: radius.card, backgroundColor: colors.surface, ...shadow.card },
  danger: { marginTop: spacing.sm, gap: spacing.sm, paddingVertical: 14, paddingHorizontal: spacing.md, borderRadius: radius.card, borderWidth: 1.5, borderColor: '#F2C4BE' },
  dangerLabel: { fontSize: 13, lineHeight: 18, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase', color: colors.danger },
  dangerText: { fontSize: 14, lineHeight: 20, color: '#5A4A3C' },
  dangerButton: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: colors.danger },
  dangerPressed: { backgroundColor: '#8F1C13' },
  disabled: { opacity: 0.6 },
  dangerButtonText: { fontSize: 15, fontWeight: '700', color: colors.onPrimary },
  version: { textAlign: 'center' },
});
