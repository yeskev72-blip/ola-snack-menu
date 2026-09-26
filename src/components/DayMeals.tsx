import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Rect } from 'react-native-svg';

import { AppText } from '@/components/AppText';
import { Icon } from '@/components/Icon';
import { MACROS } from '@/components/Macros';
import { t } from '@/i18n';
import { formatNumber } from '@/lib/format';
import type { LocalMeal } from '@/lib/meals';
import { MEAL_TYPES, mealTypeLabel } from '@/lib/mealTypes';
import { colors, radius, shadow, spacing } from '@/theme';

const time = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/** Vignette du repas : une assiette vue de dessus (les photos ne sont pas gardées sur le téléphone). */
function Plate({ tint }: { tint: string }) {
  return (
    <Svg width={72} height={72} viewBox="0 0 120 120">
      <Rect width={120} height={120} fill={colors.accentSoft} />
      <Circle cx={60} cy={60} r={44} fill={colors.surface} />
      <Circle cx={60} cy={60} r={32} fill={tint} opacity={0.9} />
      <Circle cx={50} cy={52} r={10} fill={colors.surface} opacity={0.35} />
    </Svg>
  );
}

const TINTS: Record<string, string> = { petit_dejeuner: '#EAD6A6', dejeuner: '#D9A55B', en_cas: '#F3D9A4', diner: '#C98A5B' };

/** Carte d'un repas : vignette, type et heure, aliments, calories et macros ; ouvre le détail. */
export function MealCard({ meal }: { meal: LocalMeal }) {
  const name = meal.items.map((it) => it.label).join(', ') || t(mealTypeLabel(meal.type_repas));
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${t(mealTypeLabel(meal.type_repas))}, ${time(meal.eaten_at)}, ${name}, ${formatNumber(meal.total.kcal)} ${t('common.kcal')}`}
      onPress={() => router.push({ pathname: '/meal/[id]', params: { id: meal.id } })}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.thumb}>
        <Plate tint={TINTS[meal.type_repas] ?? '#EAD6A6'} />
      </View>
      <View style={styles.body}>
        <AppText style={styles.type} numberOfLines={1}>
          {t(mealTypeLabel(meal.type_repas))} · {time(meal.eaten_at)}
        </AppText>
        <AppText style={styles.name} numberOfLines={1}>
          {name}
        </AppText>
        <View style={styles.meta}>
          <AppText style={styles.kcal}>
            {formatNumber(meal.total.kcal)} {t('common.kcal')}
          </AppText>
          {MACROS.map((m) => (
            <View key={m.key} style={styles.macro}>
              <View style={[styles.dot, { backgroundColor: m.color }]} />
              <AppText style={styles.macroText}>
                {formatNumber(meal.total[m.key])} {t('common.grams')}
              </AppText>
            </View>
          ))}
        </View>
      </View>
      {!meal.synced ? <Icon name="clock" size={16} color={colors.textMuted} /> : null}
    </Pressable>
  );
}

/** Emplacement vide d'un repas principal pas encore saisi (journée en cours). */
function AddMeal({ label, hint }: { label: string; hint: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={hint}
      onPress={() => router.navigate('/scan')}
      style={({ pressed }) => [styles.add, pressed && styles.addPressed]}>
      <View style={styles.addIcon}>
        <Icon name="plus" size={18} strokeWidth={2.4} />
      </View>
      <View>
        <AppText style={styles.addTitle}>{label}</AppText>
        <AppText variant="small">{hint}</AppText>
      </View>
    </Pressable>
  );
}

const MAIN_TYPES = ['petit_dejeuner', 'dejeuner', 'diner'] as const;

/**
 * Repas d'une journée dans l'ordre de l'heure. Pour la journée en cours (`suggestMissing`), les repas
 * principaux pas encore saisis apparaissent en pointillés, jusqu'à ce qu'on en ait saisi un plus tard.
 */
export function DayMeals({ meals, suggestMissing = false }: { meals: LocalMeal[]; suggestMissing?: boolean }) {
  const lastIndex = Math.max(-1, ...meals.map((m) => MEAL_TYPES.findIndex((x) => x.value === m.type_repas)));
  const missing = suggestMissing
    ? MAIN_TYPES.filter((type) => MEAL_TYPES.findIndex((x) => x.value === type) > lastIndex && !meals.some((m) => m.type_repas === type))
    : [];
  return (
    <>
      {meals.map((meal) => (
        <MealCard key={meal.id} meal={meal} />
      ))}
      {missing.map((type) => (
        <AddMeal key={type} label={t(mealTypeLabel(type))} hint={t('journal.addMeal', { meal: t(mealTypeLabel(type)).toLowerCase() })} />
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    ...shadow.card,
  },
  pressed: { backgroundColor: colors.surfaceAlt },
  thumb: { width: 72, height: 72, borderRadius: 14, overflow: 'hidden' },
  body: { flex: 1, gap: 3, minWidth: 0 },
  type: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: colors.accent, textTransform: 'uppercase', letterSpacing: 0.6 },
  name: { fontWeight: '700' },
  meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 10, rowGap: 2 },
  kcal: { fontSize: 14, lineHeight: 20, fontWeight: '800' },
  macro: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  macroText: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: '#5A4A3C' },
  add: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: spacing.md,
    borderRadius: radius.card,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#D9CBB8',
  },
  addPressed: { backgroundColor: colors.surfaceAlt },
  addIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  addTitle: { fontSize: 15, lineHeight: 20, fontWeight: '700' },
});
