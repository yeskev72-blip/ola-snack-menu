import { Redirect } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Notice } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { t } from '@/i18n';
import { ACTIVITY_LEVELS, clampTarget, dailyTarget } from '@/lib/calories';
import { useAction } from '@/lib/useAction';
import { useOnboardingDraft } from '@/state/onboardingDraft';
import { useSession } from '@/state/session';
import { colors, spacing } from '@/theme';

export default function TargetScreen() {
  const { draft } = useOnboardingDraft();
  const { updateProfile } = useSession();
  const { objectif, sexe, age, taille_cm, poids_kg, activite, prenom } = draft;

  const computed = useMemo(
    () =>
      objectif && sexe && age && taille_cm && poids_kg
        ? dailyTarget({ sexe, age, taille_cm, poids_kg }, ACTIVITY_LEVELS[activite], objectif)
        : null,
    [objectif, sexe, age, taille_cm, poids_kg, activite],
  );
  const [adjustment, setAdjustment] = useState(0);

  // La sauvegarde bascule hasProfile : la navigation passe seule au journal.
  const save = useAction(async () => {
    if (computed === null) return;
    await updateProfile({
      prenom: prenom.trim() || null,
      sexe,
      age,
      taille_cm,
      poids_kg,
      niveau_activite: ACTIVITY_LEVELS[activite],
      objectif,
      calories_cible: clampTarget(computed + adjustment),
    });
  });

  // Arrivée directe sur cet écran (ex. rechargement) : on reprend au début.
  if (computed === null) return <Redirect href="/goal" />;
  const target = clampTarget(computed + adjustment);

  return (
    <Screen footer={<Button label={t('onboarding.start')} loading={save.loading} onPress={() => save.run()} />}>
      <AppText variant="small">{t('onboarding.step', { current: 3, total: 3 })}</AppText>
      <AppText variant="title">{t('onboarding.targetTitle')}</AppText>
      <AppText variant="muted">{t('onboarding.targetBody')}</AppText>

      <Card style={styles.card}>
        <AppText variant="display" style={styles.value}>
          {target}
        </AppText>
        <AppText variant="large">{t('common.kcalPerDayUnit')}</AppText>
        <View style={styles.row}>
          <Button label={t('onboarding.targetLess')} variant="secondary" style={styles.flex} onPress={() => setAdjustment((a) => a - 50)} />
          <Button label={t('onboarding.targetMore')} variant="secondary" style={styles.flex} onPress={() => setAdjustment((a) => a + 50)} />
        </View>
      </Card>

      <AppText variant="small">{t('onboarding.targetNote')}</AppText>
      <Notice message={save.error} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { alignItems: 'center', paddingVertical: spacing.lg },
  value: { color: colors.primary },
  row: { flexDirection: 'row', gap: spacing.sm, alignSelf: 'stretch', marginTop: spacing.md },
  flex: { flex: 1 },
});
