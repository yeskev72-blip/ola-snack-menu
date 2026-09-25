import { randomUUID } from 'expo-crypto';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, ToastAndroid, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { Macros } from '@/components/Macros';
import { Notice } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { t } from '@/i18n';
import { formatNumber } from '@/lib/format';
import { analyzeMeal, isOnline } from '@/lib/analyze';
import { buildCorrection } from '@/lib/corrections';
import { useFoods } from '@/lib/foods';
import { MEAL_TYPES } from '@/lib/mealTypes';
import { saveMeal } from '@/lib/meals';
import { mealNutrition } from '@/lib/nutrition';
import { gramsHint } from '@/lib/portionLabels';
import { unitsFor } from '@/lib/portions';
import { useAction } from '@/lib/useAction';
import { useScanDraft } from '@/state/scanDraft';
import { useSession } from '@/state/session';
import { colors, font, radius, spacing } from '@/theme';

export default function Result() {
  const draft = useScanDraft();
  const { user } = useSession();
  const { byKey } = useFoods();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [refineError, setRefineError] = useState<string | null>(null);
  const [refining, setRefining] = useState(false);

  // Calories calculées avec la table foods ; l'IA ne fournit que les éléments et les grammes.
  const nutrition = useMemo(() => mealNutrition(draft.items, byKey), [draft.items, byKey]);

  const questions = draft.scan?.followUpAllowed ? draft.scan.questions : [];
  const allAnswered = questions.length > 0 && questions.every((q) => answers[q.id]);

  const refine = async () => {
    if (!draft.photo || !draft.scan) return;
    setRefining(true);
    setRefineError(null);
    const result = await analyzeMeal({
      photo: draft.photo,
      hint: draft.hint,
      followUp: {
        scanId: draft.scan.scanId,
        answers: questions.map((q) => ({ question: q.text, answer: answers[q.id] ?? '' })),
      },
    });
    setRefining(false);
    if (!result.ok) return setRefineError(result.error.message);
    draft.applyAnalysis(result.data);
    setAnswers({});
  };

  const save = useAction(async () => {
    if (!user) return;
    const items = draft.items.map((item, i) => ({
      food_key: item.food_key,
      label: item.label,
      grams: item.grams,
      ...nutrition.items[i]!,
    }));
    const correction = draft.scan ? buildCorrection(draft.scan.predicted, draft.items) : null;
    await saveMeal({
      id: randomUUID(),
      user_id: user.id,
      eaten_at: new Date().toISOString(),
      type_repas: draft.typeRepas,
      items,
      total: nutrition.total,
      confidence: draft.scan ? nutrition.confidence : null,
      photo_path: draft.scan?.photoPath ?? null,
      correction: correction ? { id: randomUUID(), ...correction, photo_path: draft.scan?.photoPath ?? null } : null,
    });
    ToastAndroid.show((await isOnline()) ? t('result.saved') : t('result.savedOffline'), ToastAndroid.SHORT);
    draft.reset();
    router.dismissTo('/');
  });

  const kcalText = nutrition.range
    ? t('result.rangeValue', { low: nutrition.range.low, high: nutrition.range.high })
    : formatNumber(nutrition.total.kcal);

  return (
    <Screen
      edges={['bottom']}
      footer={
        <Button label={t('result.save')} loading={save.loading} disabled={draft.items.length === 0 || refining} onPress={() => save.run()} />
      }>
      {draft.photo ? <Image source={{ uri: draft.photo.uri }} style={styles.photo} resizeMode="cover" /> : null}

      <Card style={styles.summary}>
        <AppText variant="small">{nutrition.range ? t('result.estimate') : ' '}</AppText>
        <AppText variant="display" style={styles.kcal}>
          {kcalText}
        </AppText>
        <AppText variant="muted">{t('common.kcal')}</AppText>
        <Macros values={nutrition.total} />
      </Card>
      {nutrition.range ? <Notice tone="info" message={t('result.lowConfidence')} /> : null}

      {questions.length > 0 ? (
        <Card>
          <AppText variant="large">{t('result.questionsTitle')}</AppText>
          {questions.map((q) => (
            <View key={q.id} style={styles.question}>
              <AppText>{q.text}</AppText>
              <View style={styles.wrap}>
                {q.options.map((option) => (
                  <Chip
                    key={option}
                    label={option}
                    selected={answers[q.id] === option}
                    onPress={() => setAnswers((a) => ({ ...a, [q.id]: option }))}
                  />
                ))}
              </View>
            </View>
          ))}
          <Button label={refining ? t('result.refining') : t('result.refine')} variant="secondary" disabled={!allAnswered} loading={refining} onPress={refine} />
          <Notice message={refineError} />
        </Card>
      ) : null}

      <AppText variant="large">{t('result.items')}</AppText>
      {draft.items.length === 0 ? <AppText variant="muted">{t('result.empty')}</AppText> : null}
      {draft.items.map((item, i) => {
        const food = item.food_key ? byKey.get(item.food_key) : undefined;
        const hint = gramsHint(item.grams, unitsFor(food?.portion_reperes));
        const n = nutrition.items[i]!;
        return (
          <Pressable
            key={item.key}
            accessibilityRole="button"
            accessibilityHint={t('result.edit')}
            onPress={() => router.push({ pathname: '/item-editor', params: { key: item.key } })}
            style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}>
            <View style={styles.itemText}>
              <AppText style={styles.itemLabel}>{item.label}</AppText>
              <AppText variant="small">
                {formatNumber(item.grams)} {t('common.grams')}
                {hint ? ` · ${hint}` : ''}
              </AppText>
            </View>
            <View style={styles.itemKcal}>
              <AppText variant="large">{formatNumber(n.kcal)}</AppText>
              <AppText variant="small">
                {t('common.kcal')}
                {n.estimated ? ` · ${t('result.estimated')}` : ''}
              </AppText>
            </View>
          </Pressable>
        );
      })}
      <Button label={t('result.addItem')} variant="ghost" onPress={() => router.push('/food-picker')} />

      <AppText variant="large">{t('result.mealType')}</AppText>
      <View style={styles.wrap}>
        {MEAL_TYPES.map((m) => (
          <Chip key={m.value} label={t(m.label)} selected={draft.typeRepas === m.value} onPress={() => draft.setTypeRepas(m.value)} />
        ))}
      </View>

      <Notice message={save.error} />
      <AppText variant="small">{t('result.disclaimer')}</AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  photo: { width: '100%', aspectRatio: 16 / 9, borderRadius: radius.md },
  summary: { alignItems: 'center', paddingVertical: spacing.lg },
  kcal: { color: colors.primary, textAlign: 'center' },
  question: { gap: spacing.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 64,
    padding: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  itemPressed: { backgroundColor: colors.surfaceAlt },
  itemText: { flex: 1, gap: 2 },
  itemLabel: { fontWeight: '600', fontSize: font.large },
  itemKcal: { alignItems: 'flex-end' },
});
