import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Chip } from '@/components/Chip';
import { Icon } from '@/components/Icon';
import { t } from '@/i18n';
import { formatNumber } from '@/lib/format';
import { type LocalFood, searchFoods, useFoods } from '@/lib/foods';
import { unitLabel } from '@/lib/portionLabels';
import { unitsFor } from '@/lib/portions';
import { colors, fontFamily, radius, shadow, spacing } from '@/theme';

/** Filtres par catégorie de la table des plats. */
const FILTERS = [
  { key: 'all', label: 'picker.filterAll', match: () => true },
  { key: 'plats', label: 'picker.filterDishes', match: (f: LocalFood) => f.categorie === 'plat_complet' || f.categorie === 'feculent' },
  { key: 'sauces', label: 'picker.filterSauces', match: (f: LocalFood) => f.categorie === 'sauce' },
  { key: 'proteines', label: 'picker.filterProteins', match: (f: LocalFood) => f.categorie === 'proteine' },
  { key: 'autres', label: 'picker.filterOther', match: (f: LocalFood) => !['plat_complet', 'feculent', 'sauce', 'proteine'].includes(f.categorie) },
] as const;

/** « 1 boule ≈ 200 g » : premier repère de portion de l'aliment. */
function portionHint(food: LocalFood): string | null {
  const unit = unitsFor(food.portion_reperes)[0];
  return unit ? `${unitLabel(unit.name, 1)} ≈ ${formatNumber(unit.grams)} g` : null;
}

/** Recherche + filtres + liste des plats locaux (kcal pour 100 g, bouton « + »). */
export function FoodList({ onChoose, autoFocus }: { onChoose: (food: LocalFood) => void; autoFocus?: boolean }) {
  const { foods, loaded } = useFoods();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['key']>('all');
  const results = useMemo(() => {
    const match = FILTERS.find((f) => f.key === filter)!.match;
    return searchFoods(foods, query).filter(match);
  }, [foods, query, filter]);

  return (
    <View style={styles.wrap}>
      <View style={styles.search}>
        <Icon name="search" size={20} color={colors.textMuted} />
        <TextInput
          accessibilityLabel={t('picker.search')}
          placeholder={t('picker.search')}
          placeholderTextColor="#8A7B6D"
          value={query}
          onChangeText={setQuery}
          autoFocus={autoFocus}
          autoCorrect={false}
          style={styles.searchInput}
        />
      </View>
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {FILTERS.map((f) => (
            <Chip key={f.key} label={t(f.label)} selected={filter === f.key} onPress={() => setFilter(f.key)} />
          ))}
        </ScrollView>
      </View>
      <FlatList
        data={results}
        keyExtractor={(f) => f.food_key}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={15}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          results.length ? (
            <View style={styles.header}>
              <AppText variant="small">{t('picker.headerFood')}</AppText>
              <AppText variant="small">{t('picker.headerKcal')}</AppText>
            </View>
          ) : null
        }
        ListEmptyComponent={<AppText variant="muted" style={styles.empty}>{loaded ? t('picker.none') : t('picker.loading')}</AppText>}
        renderItem={({ item, index }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${item.label_fr}, ${t('picker.per100', { kcal: formatNumber(item.kcal_100g) })}`}
            onPress={() => onChoose(item)}
            style={({ pressed }) => [styles.row, index === 0 && styles.rowFirst, index === results.length - 1 && styles.rowLast, pressed && styles.rowPressed]}>
            <View style={styles.rowText}>
              <AppText style={styles.name}>{item.label_fr}</AppText>
              {portionHint(item) ? <AppText variant="small">{portionHint(item)}</AppText> : null}
            </View>
            <AppText style={styles.kcal}>{formatNumber(item.kcal_100g)}</AppText>
            <View style={styles.add}>
              <Icon name="plus" size={18} color={colors.text} strokeWidth={2.4} />
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, gap: 12 },
  search: {
    marginHorizontal: spacing.md,
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    ...shadow.card,
  },
  searchInput: { flex: 1, fontSize: 16, fontFamily: fontFamily('500'), color: colors.text, paddingVertical: 10 },
  filters: { paddingHorizontal: spacing.md, gap: spacing.sm },
  listContent: { paddingHorizontal: spacing.md, paddingBottom: 120 },
  header: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.xs, paddingBottom: spacing.sm },
  row: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowFirst: { borderTopLeftRadius: radius.card, borderTopRightRadius: radius.card },
  rowLast: { borderBottomLeftRadius: radius.card, borderBottomRightRadius: radius.card, borderBottomWidth: 0 },
  rowPressed: { backgroundColor: colors.surfaceAlt },
  rowText: { flex: 1, gap: 2 },
  name: { fontWeight: '700' },
  kcal: { fontWeight: '800' },
  add: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  empty: { padding: spacing.md },
});
