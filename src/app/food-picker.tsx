import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { TextField } from '@/components/TextField';
import { t } from '@/i18n';
import { formatNumber } from '@/lib/format';
import { type LocalFood, searchFoods, useFoods } from '@/lib/foods';
import { unitsFor } from '@/lib/portions';
import { useScanDraft } from '@/state/scanDraft';
import { colors, spacing } from '@/theme';

/** Portion proposée à l'ajout : le repère le plus courant de l'aliment, sinon 100 g. */
function defaultGrams(food: LocalFood): number {
  const preferred = ['assiette', 'boule', 'louche', 'unite', 'morceau', 'bol', 'verre', 'cuillere'];
  const reperes = food.portion_reperes ?? {};
  for (const name of preferred) {
    const grams = reperes[name];
    if (grams) return grams;
  }
  return unitsFor(reperes)[0]?.grams ?? 100;
}

export default function FoodPicker() {
  /** replace = clé de l'élément dont on change l'aliment ; sinon on ajoute un élément. */
  const { replace } = useLocalSearchParams<{ replace?: string }>();
  const draft = useScanDraft();
  const { foods, loaded } = useFoods();
  const [query, setQuery] = useState('');
  const results = useMemo(() => searchFoods(foods, query), [foods, query]);

  const choose = (food: LocalFood) => {
    if (replace) {
      draft.updateItem(replace, { food_key: food.food_key, label: food.label_fr, estimate_100g: null });
      router.back();
      return;
    }
    const key = draft.addItem({
      food_key: food.food_key,
      label: food.label_fr,
      grams: defaultGrams(food),
      confidence: null,
      estimate_100g: null,
    });
    router.replace({ pathname: '/item-editor', params: { key } });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.search}>
        <TextField label={t('picker.search')} value={query} onChangeText={setQuery} autoFocus autoCorrect={false} />
      </View>
      <FlatList
        data={results}
        keyExtractor={(f) => f.food_key}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={15}
        ListEmptyComponent={<AppText variant="muted" style={styles.empty}>{loaded ? t('picker.none') : t('picker.loading')}</AppText>}
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            onPress={() => choose(item)}
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
            <AppText style={styles.label}>{item.label_fr}</AppText>
            <AppText variant="small">{t('picker.per100', { kcal: formatNumber(item.kcal_100g) })}</AppText>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  search: { padding: spacing.md },
  row: {
    minHeight: 60,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  rowPressed: { backgroundColor: colors.surfaceAlt },
  label: { fontWeight: '600' },
  empty: { padding: spacing.md },
});
