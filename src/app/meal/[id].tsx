import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { useConfirm } from '@/components/ConfirmProvider';
import { Icon } from '@/components/Icon';
import { Macros } from '@/components/Macros';
import { Screen } from '@/components/Screen';
import { dateLocale, t } from '@/i18n';
import { DEFAULT_OIL, type OilLevel } from '@/lib/cookingOil';
import { sourceText, sourceTone, type SourceTone } from '@/lib/foodSource';
import { type LocalFood, useFoods } from '@/lib/foods';
import { formatNumber } from '@/lib/format';
import { deleteMeal, type SavedItem, useMeal } from '@/lib/meals';
import { mealTypeLabel } from '@/lib/mealTypes';
import { useScanDraft } from '@/state/scanDraft';
import { useSession } from '@/state/session';
import { colors, radius, shadow, spacing } from '@/theme';

/** Pastille et phrase de repli associées à chaque provenance. */
const TONES = {
  table: { badge: 'verified', label: 'result.verified', fallback: 'mealDetail.sourceTable' },
  unverified: { badge: 'estimated', label: 'result.unverified', fallback: 'mealDetail.sourceUnverified' },
  ai: { badge: 'estimated', label: 'result.estimated', fallback: 'mealDetail.sourceAi' },
} as const satisfies Record<SourceTone, { badge: 'verified' | 'estimated'; label: string; fallback: string }>;

export default function MealDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useSession();
  const confirm = useConfirm();
  const meal = useMeal(user?.id ?? null, id);
  const { byKey } = useFoods();
  const draft = useScanDraft();

  if (meal === undefined) return null;
  if (meal === null) {
    return (
      <Screen back="back">
        <AppText variant="muted">{t('mealDetail.notFound')}</AppText>
      </Screen>
    );
  }

  const confirmDelete = async () => {
    if (!user) return;
    const ok = await confirm({
      title: t('mealDetail.deleteTitle'),
      body: t('mealDetail.deleteBody'),
      confirmLabel: t('mealDetail.delete'),
      destructive: true,
    });
    if (!ok) return;
    await deleteMeal(user.id, meal.id);
    router.back();
  };

  // Refaire un repas ne rappelle pas l'IA : on recharge les aliments dans le brouillon et on
  // ouvre l'écran de validation, où les quantités et le type de repas restent modifiables.
  const repeat = () => {
    draft.repeatMeal(meal);
    router.push('/result');
  };

  const mealLabel = meal.items.map((it) => it.label).join(', ') || t(mealTypeLabel(meal.type_repas));
  const date = new Date(meal.eaten_at);
  const when = `${date.toLocaleDateString(dateLocale(), { weekday: 'short', day: 'numeric', month: 'short' })} · ${date.toLocaleTimeString(dateLocale(), { hour: '2-digit', minute: '2-digit' })}`;

  return (
    <Screen
      back="back"
      footer={
        <>
          <Button label={t('mealDetail.repeat')} icon="plus" onPress={repeat} />
          <Button label={t('mealDetail.delete')} variant="danger" icon="trash" onPress={confirmDelete} />
        </>
      }>
      <View style={styles.titles}>
        <AppText style={styles.type}>
          {t(mealTypeLabel(meal.type_repas))} · {when}
        </AppText>
        <AppText style={styles.title} accessibilityRole="header">
          {mealLabel}
        </AppText>
      </View>

      <View style={styles.kcalRow}>
        <AppText style={styles.kcal}>{formatNumber(meal.total.kcal)}</AppText>
        <AppText style={styles.kcalUnit}>{t('common.kcal')}</AppText>
      </View>

      <Macros values={meal.total} />

      <AppText style={styles.section}>{t('mealDetail.sources')}</AppText>
      <View style={styles.list}>
        {meal.items.map((item, i) => (
          <ItemSource
            key={`${item.label}-${i}`}
            item={item}
            food={item.food_key ? byKey.get(item.food_key) : undefined}
            mealId={meal.id}
            huile={meal.huile}
            first={i === 0}
          />
        ))}
      </View>

      {/* Le niveau d'huile a déjà modifié les chiffres ci-dessus : sans cette ligne, deux repas
          identiques affichés côte à côte sembleraient se contredire. */}
      <View style={styles.oil}>
        <Icon name="info" size={16} color={colors.textMuted} />
        <AppText variant="small" style={styles.flex}>
          {t(`mealDetail.oil_${meal.huile}`)}
        </AppText>
      </View>

      {/* Chaque aliment a déjà son lien de signalement ; celui-ci vise le repas entier, pour
          le doute qui ne porte sur aucune ligne en particulier. */}
      <View style={styles.report}>
        <AppText style={styles.reportTitle}>{t('mealDetail.reportTitle')}</AppText>
        <AppText variant="small">{t('mealDetail.reportBody')}</AppText>
        <Button
          label={t('mealDetail.report')}
          variant="secondary"
          small
          onPress={() => router.push({ pathname: '/report', params: { meal: meal.id, label: mealLabel } })}
        />
      </View>

      {!meal.synced ? (
        <View style={styles.pending}>
          <Icon name="clock" size={16} color={colors.textMuted} />
          <AppText variant="small">{t('mealDetail.pending')}</AppText>
        </View>
      ) : null}
    </Screen>
  );
}

/**
 * Un aliment du repas et la provenance de son chiffre.
 *
 * La valeur de référence affichée est celle de la table, pas celle qu'on pourrait recalculer
 * depuis la portion : la portion porte déjà l'ajustement d'huile, et la montrer comme « base »
 * ferait passer un chiffre dérivé pour la source. Un élément hors table n'a pas de base à
 * montrer, seulement ce que le modèle a estimé ce jour-là.
 */
function ItemSource({ item, food, mealId, huile, first }: { item: SavedItem; food: LocalFood | undefined; mealId: string; huile: OilLevel; first: boolean }) {
  const tone = sourceTone(food, item.estimated);
  const { badge, label, fallback } = TONES[tone];
  const source = sourceText(food);

  return (
    <View style={[styles.item, !first && styles.itemBorder]}>
      <View style={styles.itemHead}>
        <AppText style={styles.label}>{item.label}</AppText>
        <Badge label={t(label)} tone={badge} />
      </View>

      <AppText variant="small">
        {t('mealDetail.portion', {
          grams: formatNumber(item.grams),
          kcal: formatNumber(item.kcal),
          prot: formatNumber(item.proteines),
        })}
      </AppText>

      {/* Sans la mention du réglage, la portion ne retombe pas sur la valeur de référence
          multipliée par les grammes, et l'écran perd exactement la confiance qu'il vise. */}
      {food ? (
        <AppText variant="small">
          {t(huile === DEFAULT_OIL ? 'mealDetail.per100' : 'mealDetail.per100Oil', {
            kcal: formatNumber(food.kcal_100g),
            prot: formatNumber(food.proteines_100g),
          })}
        </AppText>
      ) : null}

      <AppText variant="small" style={styles.source}>
        {source ?? t(fallback)}
      </AppText>

      <Pressable
        accessibilityRole="button"
        hitSlop={8}
        onPress={() => router.push({ pathname: '/report', params: { meal: mealId, label: item.label, food: item.food_key ?? '' } })}>
        <AppText style={styles.reportLink}>{t('mealDetail.reportItem')}</AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  titles: { gap: 2 },
  type: { fontSize: 13, lineHeight: 18, fontWeight: '700', color: colors.accent, textTransform: 'uppercase', letterSpacing: 0.6 },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '800' },
  kcalRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  kcal: { fontSize: 44, lineHeight: 50, fontWeight: '800', letterSpacing: -1 },
  kcalUnit: { fontSize: 18, fontWeight: '700' },
  section: { marginTop: spacing.xs, fontSize: 17, lineHeight: 24, fontWeight: '800' },
  list: { borderRadius: radius.card, backgroundColor: colors.surface, ...shadow.card },
  item: { gap: 3, paddingVertical: 14, paddingHorizontal: spacing.md },
  itemBorder: { borderTopWidth: 1, borderTopColor: colors.surfaceAlt },
  itemHead: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
  label: { fontWeight: '700', flexShrink: 1 },
  source: { marginTop: 4, fontStyle: 'italic' },
  reportLink: { marginTop: 6, fontSize: 14, fontWeight: '700', color: colors.accent, textDecorationLine: 'underline' },
  oil: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  flex: { flex: 1 },
  report: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.card, backgroundColor: colors.accentSoft },
  reportTitle: { fontSize: 16, lineHeight: 22, fontWeight: '800' },
  pending: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
