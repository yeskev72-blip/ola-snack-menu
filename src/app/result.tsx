import { randomUUID } from 'expo-crypto';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, ToastAndroid, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { Macros } from '@/components/Macros';
import { Notice } from '@/components/Notice';
import { Icon } from '@/components/Icon';
import { RoundButton } from '@/components/Screen';
import { t } from '@/i18n';
import { formatNumber } from '@/lib/format';
import { analyzeMeal, isOnline } from '@/lib/analyze';
import { buildCorrection } from '@/lib/corrections';
import { useFoods } from '@/lib/foods';
import { MEAL_TYPES, mealTypeLabel } from '@/lib/mealTypes';
import { saveMeal } from '@/lib/meals';
import { mealNutrition } from '@/lib/nutrition';
import { gramsHint } from '@/lib/portionLabels';
import { unitsFor } from '@/lib/portions';
import { useAction } from '@/lib/useAction';
import { useScanDraft } from '@/state/scanDraft';
import { useSession } from '@/state/session';
import { colors, radius, shadow, spacing } from '@/theme';

export default function Result() {
  const draft = useScanDraft();
  const { user } = useSession();
  const { byKey } = useFoods();
  const insets = useSafeAreaInsets();
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
    ? t('result.rangeValue', { low: formatNumber(nutrition.range.low), high: formatNumber(nutrition.range.high) })
    : formatNumber(nutrition.total.kcal);
  const title = draft.items.map((it) => it.label).join(', ') || t('result.title');
  const close = () => (router.canGoBack() ? router.back() : router.navigate('/'));

  return (
    <SafeAreaView style={styles.safe} edges={draft.photo ? ['bottom'] : ['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {draft.photo ? (
          <View style={styles.hero}>
            <Image source={{ uri: draft.photo.uri }} style={styles.heroImage} resizeMode="cover" accessibilityIgnoresInvertColors />
            <View style={[styles.heroBar, { top: insets.top + spacing.sm }]}>
              <RoundButton icon="close" label={t('common.close')} onPress={close} />
            </View>
          </View>
        ) : (
          <View style={styles.plainBar}>
            <RoundButton icon="close" label={t('common.close')} onPress={close} />
          </View>
        )}

        <View style={[styles.sheet, draft.photo ? styles.sheetOverlap : null]}>
          <View style={styles.titles}>
            <AppText style={styles.type}>{t(mealTypeLabel(draft.typeRepas))}</AppText>
            <AppText style={styles.title} accessibilityRole="header">
              {title}
            </AppText>
          </View>

          <View style={styles.kcalBlock}>
            <View style={styles.kcalRow}>
              <AppText style={styles.kcal}>{kcalText}</AppText>
              <AppText style={styles.kcalUnit}>{t('common.kcal')}</AppText>
            </View>
            {nutrition.range ? (
              <View style={styles.rangeRow}>
                <Icon name="info" size={16} color={colors.textMuted} />
                <AppText variant="small" style={styles.rangeText}>
                  {questions.length > 0 ? t('result.rangeAnswer') : t('result.lowConfidence')}
                </AppText>
              </View>
            ) : null}
          </View>

          <Macros values={nutrition.total} />

          {questions.length > 0 ? (
            <View style={styles.questions}>
              {questions.map((q) => (
                <View key={q.id} style={styles.question}>
                  <AppText style={styles.questionText}>{q.text}</AppText>
                  <View style={styles.wrap}>
                    {[...q.options, t('result.dontKnow')].map((option) => (
                      <Chip
                        key={option}
                        label={option}
                        tone="onSoft"
                        selected={answers[q.id] === option}
                        onPress={() => setAnswers((a) => ({ ...a, [q.id]: option }))}
                      />
                    ))}
                  </View>
                </View>
              ))}
              <Button
                label={refining ? t('result.refining') : t('result.refine')}
                variant="accent"
                small
                disabled={!allAnswered}
                loading={refining}
                onPress={refine}
              />
              <Notice message={refineError} />
            </View>
          ) : null}

          <AppText style={styles.section}>{t('result.items')}</AppText>
          {draft.items.length === 0 ? <AppText variant="muted">{t('result.empty')}</AppText> : null}
          {draft.items.length > 0 ? (
            <View style={styles.list}>
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
                    style={({ pressed }) => [styles.item, i > 0 && styles.itemBorder, pressed && styles.itemPressed]}>
                    <View style={styles.itemText}>
                      <View style={styles.itemTitle}>
                        <AppText style={styles.itemLabel} numberOfLines={2}>
                          {item.label}
                        </AppText>
                        {n.estimated ? (
                          <View style={styles.badge}>
                            <AppText style={styles.badgeText}>{t('result.estimated')}</AppText>
                          </View>
                        ) : null}
                      </View>
                      <AppText variant="small">
                        {hint ? `${hint} · ` : ''}
                        {formatNumber(item.grams)} {t('common.grams')}
                      </AppText>
                    </View>
                    <AppText style={styles.itemKcal}>
                      {formatNumber(n.kcal)} {t('common.kcal')}
                    </AppText>
                    <Icon name="chevron" size={18} color={colors.textMuted} />
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          <AppText style={styles.section}>{t('result.mealType')}</AppText>
          <View style={styles.wrap}>
            {MEAL_TYPES.map((m) => (
              <Chip key={m.value} label={t(m.label)} selected={draft.typeRepas === m.value} onPress={() => draft.setTypeRepas(m.value)} />
            ))}
          </View>

          <Notice message={save.error} />
          <AppText variant="small">{t('result.disclaimer')}</AppText>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button label={t('result.addItem')} variant="secondary" icon="plus" style={styles.footerAdd} onPress={() => router.push('/food-picker')} />
        <Button
          label={t('result.save')}
          style={styles.footerSave}
          loading={save.loading}
          disabled={draft.items.length === 0 || refining}
          onPress={() => save.run()}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingBottom: spacing.lg },
  hero: { height: 220, backgroundColor: colors.surfaceAlt },
  heroImage: { width: '100%', height: '100%' },
  heroBar: { position: 'absolute', left: spacing.md, right: spacing.md, flexDirection: 'row', justifyContent: 'space-between' },
  plainBar: { paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  sheet: { paddingHorizontal: spacing.md, paddingTop: 20, gap: 14, backgroundColor: colors.background },
  sheetOverlap: { marginTop: -28, borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  titles: { gap: 2 },
  type: { fontSize: 13, lineHeight: 18, fontWeight: '700', color: colors.accent, textTransform: 'uppercase', letterSpacing: 0.6 },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '800' },
  kcalBlock: { gap: 6 },
  kcalRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', columnGap: spacing.sm },
  kcal: { fontSize: 36, lineHeight: 42, fontWeight: '800', letterSpacing: -1 },
  kcalUnit: { fontSize: 18, lineHeight: 24, fontWeight: '700' },
  rangeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rangeText: { flex: 1, fontSize: 14, fontWeight: '600' },
  questions: { gap: 12, padding: 14, borderRadius: radius.card, backgroundColor: colors.accentSoft },
  question: { gap: 10 },
  questionText: { fontWeight: '700' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  section: { marginTop: spacing.xs, fontSize: 17, lineHeight: 24, fontWeight: '800' },
  list: { borderRadius: radius.card, backgroundColor: colors.surface, ...shadow.card },
  item: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: spacing.sm, paddingHorizontal: 14 },
  itemBorder: { borderTopWidth: 1, borderTopColor: colors.surfaceAlt },
  itemPressed: { backgroundColor: colors.surfaceAlt },
  itemText: { flex: 1, gap: 2 },
  itemTitle: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
  itemLabel: { fontWeight: '700', flexShrink: 1 },
  itemKcal: { fontWeight: '700' },
  badge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: '#FBEBC4' },
  badgeText: { fontSize: 11, lineHeight: 14, fontWeight: '700', color: '#7A5200' },
  footer: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: spacing.md,
    paddingTop: 12,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
    shadowColor: '#3C230F',
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
  },
  footerAdd: { flex: 1 },
  footerSave: { flex: 1.3 },
});
