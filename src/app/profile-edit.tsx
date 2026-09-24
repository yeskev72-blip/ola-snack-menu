import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, ToastAndroid, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Choice } from '@/components/Choice';
import { Notice } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { t } from '@/i18n';
import { ACTIVITY_LEVELS, type ActivityLevel, dailyTarget, type Goal, type Sex, TARGET_BOUNDS } from '@/lib/calories';
import { ACTIVITIES, activityFromFactor, GOALS } from '@/lib/profileOptions';
import { useAction } from '@/lib/useAction';
import { parseNumber } from '@/lib/validation';
import { useSession } from '@/state/session';
import { spacing } from '@/theme';

const inRange = (v: number | null, min: number, max: number): v is number => v !== null && v >= min && v <= max;

export default function ProfileEdit() {
  const { profile, updateProfile } = useSession();
  const [prenom, setPrenom] = useState(profile?.prenom ?? '');
  const [sexe, setSexe] = useState<Sex | null>(profile?.sexe ?? null);
  const [age, setAge] = useState(profile?.age?.toString() ?? '');
  const [height, setHeight] = useState(profile?.taille_cm?.toString() ?? '');
  const [weight, setWeight] = useState(profile?.poids_kg?.toString() ?? '');
  const [activity, setActivity] = useState<ActivityLevel>(activityFromFactor(profile?.niveau_activite ?? null));
  const [goal, setGoal] = useState<Goal>(profile?.objectif ?? 'maintien');
  const [targetText, setTargetText] = useState(profile?.calories_cible?.toString() ?? '');
  const [error, setError] = useState<string | null>(null);

  const values = { age: parseNumber(age), taille_cm: parseNumber(height), poids_kg: parseNumber(weight) };
  const bodyValid =
    sexe !== null &&
    inRange(values.age, 13, 110) &&
    Number.isInteger(values.age) &&
    inRange(values.taille_cm, 100, 250) &&
    inRange(values.poids_kg, 25, 350);
  const suggested = bodyValid
    ? dailyTarget({ sexe, age: values.age!, taille_cm: values.taille_cm!, poids_kg: values.poids_kg! }, ACTIVITY_LEVELS[activity], goal)
    : null;

  const save = useAction(async () => {
    await updateProfile({
      prenom: prenom.trim() || null,
      sexe,
      age: values.age,
      taille_cm: values.taille_cm,
      poids_kg: values.poids_kg,
      niveau_activite: ACTIVITY_LEVELS[activity],
      objectif: goal,
      calories_cible: parseNumber(targetText),
    });
    ToastAndroid.show(t('profileEdit.saved'), ToastAndroid.SHORT);
    router.back();
  });

  const submit = () => {
    if (!sexe) return setError(t('onboarding.pickSex'));
    if (!bodyValid) return setError(t('onboarding.invalidBody'));
    const target = parseNumber(targetText);
    if (!inRange(target, TARGET_BOUNDS.min, TARGET_BOUNDS.max) || !Number.isInteger(target)) {
      return setError(t('profileEdit.invalidTarget'));
    }
    setError(null);
    void save.run();
  };

  return (
    <Screen edges={['bottom']} footer={<Button label={t('common.save')} loading={save.loading} onPress={submit} />}>
      <TextField label={t('onboarding.firstName')} value={prenom} onChangeText={setPrenom} maxLength={60} />

      <AppText style={styles.label}>{t('onboarding.sex')}</AppText>
      <View style={styles.row}>
        <View style={styles.flex}>
          <Choice label={t('onboarding.female')} selected={sexe === 'femme'} onPress={() => setSexe('femme')} />
        </View>
        <View style={styles.flex}>
          <Choice label={t('onboarding.male')} selected={sexe === 'homme'} onPress={() => setSexe('homme')} />
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

      <AppText style={styles.label}>{t('onboarding.goalTitle')}</AppText>
      {GOALS.map((g) => (
        <Choice key={g.value} label={t(g.label)} selected={goal === g.value} onPress={() => setGoal(g.value)} />
      ))}

      <AppText style={styles.label}>{t('onboarding.activity')}</AppText>
      {ACTIVITIES.map((a) => (
        <Choice key={a.value} label={t(a.label)} selected={activity === a.value} onPress={() => setActivity(a.value)} />
      ))}

      <Card>
        <TextField label={t('profileEdit.target')} value={targetText} onChangeText={setTargetText} keyboardType="number-pad" maxLength={4} />
        {suggested ? (
          <>
            <AppText variant="muted">{t('profileEdit.suggested', { kcal: suggested })}</AppText>
            {String(suggested) !== targetText ? (
              <Button label={t('profileEdit.useSuggested')} variant="secondary" onPress={() => setTargetText(String(suggested))} />
            ) : null}
          </>
        ) : null}
        <AppText variant="small">{t('onboarding.targetNote')}</AppText>
      </Card>

      <Notice message={error ?? save.error} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { fontWeight: '600' },
  row: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
});
