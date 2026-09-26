import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import { Choice } from '@/components/Choice';
import { Heading } from '@/components/Heading';
import { Notice } from '@/components/Notice';
import { OnboardingScreen } from '@/components/OnboardingScreen';
import { Stepper } from '@/components/Stepper';
import { TextField } from '@/components/TextField';
import { t } from '@/i18n';
import { useOnboardingDraft } from '@/state/onboardingDraft';
import { spacing } from '@/theme';

export default function BodyScreen() {
  const { draft, update } = useOnboardingDraft();
  const [error, setError] = useState<string | null>(null);
  const age = draft.age ?? 30;

  const next = () => {
    if (!draft.sexe) return setError(t('onboarding.pickSex'));
    setError(null);
    update({ age });
    router.push('/measures');
  };

  return (
    <OnboardingScreen step={2} cta={{ label: t('common.continue'), onPress: next }}>
      <Heading title={t('onboarding.bodyTitle')} body={t('onboarding.bodyBody')} />

      <TextField
        label={t('onboarding.firstName')}
        value={draft.prenom}
        onChangeText={(prenom) => update({ prenom })}
        autoComplete="given-name"
        maxLength={60}
      />

      <AppText style={styles.label}>{t('onboarding.sex')}</AppText>
      <View style={styles.row}>
        <View style={styles.flex}>
          <Choice label={t('onboarding.female')} selected={draft.sexe === 'femme'} onPress={() => update({ sexe: 'femme' })} />
        </View>
        <View style={styles.flex}>
          <Choice label={t('onboarding.male')} selected={draft.sexe === 'homme'} onPress={() => update({ sexe: 'homme' })} />
        </View>
      </View>

      <AppText style={styles.label}>{t('profile.age')}</AppText>
      <Card style={styles.card}>
        <Stepper label={t('profile.age')} value={age} onChange={(v) => update({ age: v })} step={1} min={13} max={110} unit={t('onboarding.years')} />
      </Card>

      <Notice message={error} />
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 15, fontWeight: '700' },
  row: { flexDirection: 'row', gap: 12 },
  flex: { flex: 1 },
  card: { borderRadius: 24, paddingVertical: 20, paddingHorizontal: spacing.md },
});
