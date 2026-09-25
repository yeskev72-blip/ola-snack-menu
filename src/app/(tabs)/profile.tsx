import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Switch, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Notice } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { t } from '@/i18n';
import { isOnline } from '@/lib/analyze';
import { pendingCount, syncMeals } from '@/lib/meals';
import { formatDate, planStatus } from '@/lib/plan';
import { GOALS } from '@/lib/profileOptions';
import { useAction } from '@/lib/useAction';
import { useSession } from '@/state/session';
import { colors, spacing } from '@/theme';

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
  const plan = planStatus(profile?.plan, profile?.premium_until);
  const planText =
    plan.kind === 'free'
      ? t('premium.free')
      : plan.until
        ? t('premium.activeUntil', { date: formatDate(plan.until) })
        : t('premium.permanent');

  return (
    <Screen edges={['top']}>
      <AppText variant="title">{profile?.prenom || t('profile.title')}</AppText>

      {isGuest ? (
        <Card>
          <AppText variant="large">{t('profile.guestAccount')}</AppText>
          <AppText>{t('profile.guestWarning')}</AppText>
          <Button label={t('profile.createAccount')} onPress={() => router.push('/link-account')} />
        </Card>
      ) : (
        <AppText variant="muted">{user?.email}</AppText>
      )}

      <Card>
        <AppText variant="large">{t('profile.info')}</AppText>
        {profile?.age && profile.taille_cm && profile.poids_kg ? (
          <AppText>{t('profile.bodySummary', { age: profile.age, height: profile.taille_cm, weight: profile.poids_kg })}</AppText>
        ) : null}
        {goal ? (
          <AppText>
            {t('profile.goal')} : {t(goal.label)}
          </AppText>
        ) : null}
        {profile?.calories_cible ? (
          <AppText>
            {t('profile.dailyTarget')} : {t('common.kcalPerDay', { kcal: profile.calories_cible })}
          </AppText>
        ) : null}
        <Button label={t('profile.editProfile')} variant="secondary" onPress={() => router.push('/profile-edit')} />
      </Card>

      <Card>
        <AppText variant="large">{t('premium.cardTitle')}</AppText>
        <AppText>{planText}</AppText>
        {plan.kind === 'premium' && !plan.until ? null : (
          <Button
            label={plan.kind === 'premium' ? t('premium.extend') : t('premium.upgrade')}
            variant={plan.kind === 'premium' ? 'secondary' : 'primary'}
            onPress={() => router.push('/premium')}
          />
        )}
      </Card>

      {!isGuest ? (
        <Card>
          <View style={styles.row}>
            <AppText style={styles.flex}>{t('profile.photoSharing')}</AppText>
            <Switch
              value={profile?.partage_photos ?? false}
              disabled={toggleSharing.loading}
              onValueChange={(value) => void toggleSharing.run(value)}
              trackColor={{ true: colors.primary, false: colors.border }}
              thumbColor={colors.surface}
              accessibilityLabel={t('profile.photoSharing')}
            />
          </View>
          <AppText variant="small">{t('profile.photoSharingHint')}</AppText>
          <Notice message={toggleSharing.error ? t('profile.saveError') : null} />
        </Card>
      ) : null}

      <Card>
        <AppText variant="muted">{t('profile.language')}</AppText>
        <AppText variant="large">{t('profile.languageName')}</AppText>
        <AppText variant="small">{t('profile.languageSoon')}</AppText>
      </Card>

      <Button label={t('profile.signOut')} variant="secondary" onPress={() => void confirmSignOut()} />
      <Button label={t('profile.deleteAccount')} variant="ghost" loading={remove.loading} onPress={() => void confirmDelete()} />
      <Notice message={error} />
      <AppText variant="small" style={styles.version}>
        {t('profile.version', { version: Constants.expoConfig?.version ?? '?' })}
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
  version: { textAlign: 'center' },
});
