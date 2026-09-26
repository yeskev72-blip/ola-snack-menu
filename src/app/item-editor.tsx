import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { Icon } from '@/components/Icon';
import { MACROS } from '@/components/Macros';
import { Notice } from '@/components/Notice';
import { Segmented } from '@/components/Segmented';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { t } from '@/i18n';
import { formatInput, formatNumber, round1 } from '@/lib/format';
import { useFoods } from '@/lib/foods';
import { itemNutrition } from '@/lib/nutrition';
import { gramsHint, unitLabel } from '@/lib/portionLabels';
import { unitsFor } from '@/lib/portions';
import { parseNumber } from '@/lib/validation';
import { useScanDraft } from '@/state/scanDraft';
import { colors, fontFamily, radius, shadow, spacing } from '@/theme';

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
  const [gramsText, setGramsText] = useState(item ? formatInput(item.grams) : '');
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
      setGramsText(formatInput(Math.max(10, current + delta * 10)));
    } else {
      setCount((c) => Math.max(0.5, c + delta * 0.5));
    }
  };

  const chooseUnit = (name: string) => {
    if (name !== GRAMS && unit === GRAMS) setCount(1);
    if (name === GRAMS && grams) setGramsText(formatInput(grams));
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

  const per100 = itemNutrition({ ...item, grams: 100 }, byKey);
  const hint = unit === GRAMS && grams ? gramsHint(grams, units) : null;
  const qtySub = unit === GRAMS ? (hint ? t('item.about', { text: hint }) : t('item.grams')) : grams ? `${formatNumber(grams)} ${t('common.grams')}` : '';

  return (
    <Screen
      edges={['top', 'bottom']}
      title={t('item.title')}
      back="close"
      footer={
        <>
          <Button label={t('item.done')} onPress={done} />
          <Button label={t('item.remove')} variant="danger" onPress={remove} />
        </>
      }>
      <TextField label={t('item.name')} value={label} onChangeText={setLabel} maxLength={120} style={styles.name} />

      <Pressable
        accessibilityRole="button"
        accessibilityHint={t('item.changeFood')}
        onPress={() => router.push({ pathname: '/food-picker', params: { replace: item.key } })}
        style={({ pressed }) => [styles.food, pressed && styles.foodPressed]}>
        <View style={styles.flex}>
          <AppText variant="small">{t('item.food')}</AppText>
          <AppText style={styles.foodName} numberOfLines={2}>
            {food ? food.label_fr : t('item.notInTable')}
          </AppText>
        </View>
        <AppText style={styles.change}>{t('item.changeFood')}</AppText>
      </Pressable>

      {units.length > 0 ? (
        <Segmented
          options={[
            { value: 'local', label: t('item.localUnits') },
            { value: 'grams', label: t('item.grams') },
          ]}
          value={unit === GRAMS ? 'grams' : 'local'}
          onChange={(v) => chooseUnit(v === 'grams' ? GRAMS : unit !== GRAMS ? unit : units[0]!.name)}
        />
      ) : null}

      {unit !== GRAMS ? (
        <View style={styles.wrap}>
          {units.map((u) => (
            <Chip key={u.name} label={`${unitLabel(u.name, 1)} · ${formatNumber(u.grams)} g`} selected={unit === u.name} onPress={() => chooseUnit(u.name)} />
          ))}
        </View>
      ) : null}

      <View style={styles.qtyCard}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('common.less')} onPress={() => step(-1)} style={({ pressed }) => [styles.stepMinus, pressed && styles.stepMinusPressed]}>
          <Icon name="minus" size={24} />
        </Pressable>
        <View style={styles.qtyCenter}>
          {unit === GRAMS ? (
            <TextInput
              accessibilityLabel={t('item.grams')}
              value={gramsText}
              onChangeText={setGramsText}
              keyboardType="decimal-pad"
              maxLength={6}
              selectTextOnFocus
              style={styles.qtyInput}
            />
          ) : (
            <AppText style={styles.qtyMain}>{unitLabel(unit, count)}</AppText>
          )}
          <AppText variant="muted" style={styles.qtySub}>
            {qtySub}
          </AppText>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={t('common.more')} onPress={() => step(1)} style={({ pressed }) => [styles.stepPlus, pressed && styles.stepPlusPressed]}>
          <Icon name="plus" size={24} color={colors.onPrimary} />
        </Pressable>
      </View>

      <View style={styles.kcalCard} accessible accessibilityLiveRegion="polite">
        <View style={styles.kcalTop}>
          <View style={styles.kcalRow}>
            <AppText style={styles.kcalBig}>{preview ? formatNumber(preview.kcal) : '–'}</AppText>
            <AppText style={styles.kcalUnit}>{t('common.kcal')}</AppText>
          </View>
          <AppText style={styles.per100}>{t('item.per100', { kcal: formatNumber(per100.kcal) })}</AppText>
        </View>
        {preview?.estimated ? <AppText style={styles.per100}>{t('item.notInTable')}</AppText> : null}
        <View style={styles.kcalMacros}>
          {MACROS.map((m) => (
            <View key={m.key} style={styles.kcalMacro}>
              <View style={styles.kcalMacroLabel}>
                <View style={[styles.dot, { backgroundColor: DARK_MACRO[m.key] }]} />
                <AppText style={styles.per100}>{t(m.label)}</AppText>
              </View>
              <AppText style={styles.kcalMacroValue}>
                {preview ? formatNumber(preview[m.key]) : '–'} {t('common.grams')}
              </AppText>
            </View>
          ))}
        </View>
      </View>

      <Notice message={error} />
    </Screen>
  );
}

/** Couleurs des macros éclaircies pour la carte sombre. */
const DARK_MACRO = { proteines: '#F06A6A', glucides: '#F2BC3F', lipides: '#6D9BF5' } as const;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  name: { fontSize: 17, fontFamily: fontFamily('700') },
  food: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.card, backgroundColor: colors.surface, ...shadow.card },
  foodPressed: { backgroundColor: colors.surfaceAlt },
  foodName: { fontWeight: '700' },
  change: { fontWeight: '700', color: colors.accent },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  qtyCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surface, ...shadow.card },
  stepMinus: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  stepMinusPressed: { backgroundColor: colors.border },
  stepPlus: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  stepPlusPressed: { backgroundColor: colors.primaryPressed },
  qtyCenter: { flex: 1, alignItems: 'center' },
  qtyMain: { fontSize: 32, lineHeight: 40, fontWeight: '800', letterSpacing: -1, textAlign: 'center' },
  qtyInput: { minWidth: 120, fontSize: 40, lineHeight: 46, fontFamily: fontFamily('800'), color: colors.text, textAlign: 'center', padding: 0 },
  qtySub: { fontSize: 15, fontWeight: '600', textAlign: 'center' },
  kcalCard: { backgroundColor: colors.primary, borderRadius: radius.lg, padding: 18, gap: 14 },
  kcalTop: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: spacing.sm },
  kcalRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  kcalBig: { fontSize: 40, lineHeight: 44, fontWeight: '800', letterSpacing: -1, color: '#F7F0E6' },
  kcalUnit: { fontSize: 17, fontWeight: '700', color: '#F7F0E6' },
  per100: { fontSize: 13, lineHeight: 18, fontWeight: '600', color: '#D8CBBB' },
  kcalMacros: { flexDirection: 'row', gap: spacing.sm },
  kcalMacro: { flex: 1, gap: 2 },
  kcalMacroLabel: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  kcalMacroValue: { fontSize: 17, lineHeight: 22, fontWeight: '800', color: '#F7F0E6' },
});
