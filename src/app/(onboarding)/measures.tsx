import { router } from 'expo-router';
import { StyleSheet } from 'react-native';

import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import { Heading } from '@/components/Heading';
import { OnboardingScreen } from '@/components/OnboardingScreen';
import { Stepper } from '@/components/Stepper';
import { t } from '@/i18n';
import { useOnboardingDraft } from '@/state/onboardingDraft';

export default function MeasuresScreen() {
  const { draft, update } = useOnboardingDraft();
  const height = draft.taille_cm ?? (draft.sexe === 'femme' ? 162 : 172);
  const weight = draft.poids_kg ?? (draft.sexe === 'femme' ? 65 : 72);

  const next = () => {
    update({ taille_cm: height, poids_kg: weight });
    router.push('/activity');
  };

  return (
    <OnboardingScreen step={3} cta={{ label: t('common.continue'), onPress: next }}>
      <Heading title={t('onboarding.measuresTitle')} body={t('onboarding.measuresBody')} />
      <Card style={styles.card}>
        <AppText style={styles.label}>{t('profile.height')}</AppText>
        <Stepper label={t('profile.height')} value={height} onChange={(v) => update({ taille_cm: v })} step={1} min={100} max={250} unit="cm" size="medium" />
      </Card>
      <Card style={styles.card}>
        <AppText style={styles.label}>{t('profile.weight')}</AppText>
        <Stepper label={t('profile.weight')} value={weight} onChange={(v) => update({ poids_kg: v })} step={0.1} min={25} max={350} unit="kg" size="medium" />
      </Card>
      <AppText variant="small" style={styles.center}>
        {t('onboarding.measuresHint')}
      </AppText>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 24, gap: 12 },
  label: { fontSize: 15, fontWeight: '700' },
  center: { textAlign: 'center' },
});
