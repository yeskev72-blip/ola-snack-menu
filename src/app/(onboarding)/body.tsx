import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Choice } from '@/components/Choice';
import { Notice } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { t, type MessageKey } from '@/i18n';
import type { ActivityLevel } from '@/lib/calories';
import { parseNumber } from '@/lib/validation';
import { useOnboardingDraft } from '@/state/onboardingDraft';
import { spacing } from '@/theme';

const ACTIVITIES: { value: ActivityLevel; label: MessageKey }[] = [
  { value: 'sedentaire', label: 'onboarding.activitySedentaire' },
  { value: 'leger', label: 'onboarding.activityLeger' },
  { value: 'modere', label: 'onboarding.activityModere' },
  { value: 'actif', label: 'onboarding.activityActif' },
  { value: 'tres_actif', label: 'onboarding.activityTresActif' },
];

const inRange = (v: number | null, min: number, max: number) => v !== null && v >= min && v <= max;

export default function BodyScreen() {
  const { draft, update } = useOnboardingDraft();
  const [age, setAge] = useState(draft.age?.toString() ?? '');
  const [height, setHeight] = useState(draft.taille_cm?.toString() ?? '');
  const [weight, setWeight] = useState(draft.poids_kg?.toString() ?? '');
  const [error, setError] = useState<string | null>(null);

  const next = () => {
    const values = { age: parseNumber(age), taille_cm: parseNumber(height), poids_kg: parseNumber(weight) };
    if (!draft.sexe) return setError(t('onboarding.pickSex'));
    if (
      !inRange(values.age, 13, 110) ||
      !inRange(values.taille_cm, 100, 250) ||
      !inRange(values.poids_kg, 25, 350) ||
      !Number.isInteger(values.age)
    ) {
      return setError(t('onboarding.invalidBody'));
    }
    setError(null);
    update(values);
    router.push('/target');
  };

  return (
    <Screen footer={<Button label={t('common.continue')} onPress={next} />}>
      <AppText variant="small">{t('onboarding.step', { current: 2, total: 3 })}</AppText>
      <AppText variant="title">{t('onboarding.bodyTitle')}</AppText>

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

      <View style={styles.row}>
        <View style={styles.flex}>
          <TextField label={t('onboarding.age')} value={age} onChangeText={setAge} keyboardType="number-pad" maxLength={3} />
        </View>
        <View style={styles.flex}>
          <TextField label={t('onboarding.height')} value={height} onChangeText={setHeight} keyboardType="decimal-pad" maxLength={5} />
        </View>
        <View style={styles.flex}>
          <TextField label={t('onboarding.weight')} value={weight} onChangeText={setWeight} keyboardType="decimal-pad" maxLength={5} />
        </View>
      </View>

      <AppText style={styles.label}>{t('onboarding.activity')}</AppText>
      {ACTIVITIES.map((a) => (
        <Choice key={a.value} label={t(a.label)} selected={draft.activite === a.value} onPress={() => update({ activite: a.value })} />
      ))}

      <Notice message={error} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { fontWeight: '600' },
  row: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
});
