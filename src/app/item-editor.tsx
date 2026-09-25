import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { Notice } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { t } from '@/i18n';
import { formatNumber, round1 } from '@/lib/format';
import { useFoods } from '@/lib/foods';
import { itemNutrition } from '@/lib/nutrition';
import { gramsHint, unitLabel } from '@/lib/portionLabels';
import { unitsFor } from '@/lib/portions';
import { parseNumber } from '@/lib/validation';
import { useScanDraft } from '@/state/scanDraft';
import { colors, font, spacing } from '@/theme';

const GRAMS = 'g';

export default function ItemEditor() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const draft = useScanDraft();
  const { byKey } = useFoods();
  const item = draft.items.find((it) => it.key === key);
  const food = item?.food_key ? byKey.get(item.food_key) : undefined;
  const units = unitsFor(food?.portion_reperes);

  // Nom saisi, rattaché à l'aliment affiché : si l'aliment change via le sélecteur,
  // le nom repart de celui du nouvel aliment.
  const [labelEdit, setLabelEdit] = useState({ foodKey: item?.food_key ?? null, value: item?.label ?? '' });
  const [unit, setUnit] = useState<string>(GRAMS);
  const [count, setCount] = useState(1);
  const [gramsText, setGramsText] = useState(item ? formatNumber(item.grams) : '');
  const [error, setError] = useState<string | null>(null);

  if (!item) return null;

  const label = labelEdit.foodKey === item.food_key ? labelEdit.value : item.label;
  const setLabel = (value: string) => setLabelEdit({ foodKey: item.food_key, value });

  const unitGrams = units.find((u) => u.name === unit)?.grams;
  const grams = unit === GRAMS || !unitGrams ? parseNumber(gramsText) : round1(count * unitGrams);
  const preview = grams ? itemNutrition({ ...item, grams }, byKey) : null;

  const step = (delta: number) => {
    if (unit === GRAMS) {
      const current = parseNumber(gramsText) ?? 0;
      setGramsText(formatNumber(Math.max(10, current + delta * 10)));
    } else {
      setCount((c) => Math.max(0.5, c + delta * 0.5));
    }
  };

  const chooseUnit = (name: string) => {
    if (name !== GRAMS && unit === GRAMS) setCount(1);
    if (name === GRAMS && grams) setGramsText(formatNumber(grams));
    setUnit(name);
  };

  const done = () => {
    if (!grams || grams < 1 || grams > 5000) return setError(t('item.invalidGrams'));
    draft.updateItem(item.key, { label: label.trim() || item.label, grams });
    router.back();
  };

  const remove = () => {
    draft.removeItem(item.key);
    router.back();
  };

  return (
    <Screen
      edges={['bottom']}
      footer={
        <>
          <Button label={t('item.done')} onPress={done} />
          <Button label={t('item.remove')} variant="ghost" onPress={remove} />
        </>
      }>
      <TextField label={t('item.name')} value={label} onChangeText={setLabel} maxLength={120} />

      <Card>
        <AppText variant="small">{t('item.food')}</AppText>
        <View style={styles.row}>
          <AppText style={styles.flex}>{food ? food.label_fr : t('item.notInTable')}</AppText>
          <Button
            label={t('item.changeFood')}
            variant="secondary"
            onPress={() => router.push({ pathname: '/food-picker', params: { replace: item.key } })}
          />
        </View>
      </Card>

      <AppText style={styles.label}>{t('item.quantity')}</AppText>
      <View style={styles.wrap}>
        <Chip label={t('item.grams')} selected={unit === GRAMS} onPress={() => chooseUnit(GRAMS)} />
        {units.map((u) => (
          <Chip key={u.name} label={`${unitLabel(u.name, 1)} (${u.grams} g)`} selected={unit === u.name} onPress={() => chooseUnit(u.name)} />
        ))}
      </View>

      <View style={styles.stepper}>
        <Button label="−" variant="secondary" style={styles.stepButton} onPress={() => step(-1)} accessibilityLabel={t('common.less')} />
        <View style={styles.flex}>
          {unit === GRAMS ? (
            <TextField label={t('item.grams')} value={gramsText} onChangeText={setGramsText} keyboardType="decimal-pad" maxLength={5} />
          ) : (
            <AppText style={styles.count}>{unitLabel(unit, count)}</AppText>
          )}
        </View>
        <Button label="+" variant="secondary" style={styles.stepButton} onPress={() => step(1)} accessibilityLabel={t('common.more')} />
      </View>

      {grams ? (
        <AppText variant="muted" style={styles.center}>
          {grams} {t('common.grams')}
          {unit === GRAMS ? (gramsHint(grams, units) ? ` · ${gramsHint(grams, units)}` : '') : ''}
          {preview ? ` · ${formatNumber(preview.kcal)} ${t('common.kcal')}${preview.estimated ? ` (${t('result.estimated')})` : ''}` : ''}
        </AppText>
      ) : null}

      <Notice message={error} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  label: { fontWeight: '600' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stepButton: { width: 64, paddingHorizontal: 0 },
  count: { fontSize: font.title, fontWeight: '700', textAlign: 'center', color: colors.text },
  center: { textAlign: 'center' },
});
