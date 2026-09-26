import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Icon } from '@/components/Icon';
import { t } from '@/i18n';
import { formatNumber, round1 } from '@/lib/format';
import { colors } from '@/theme';

type Props = {
  value: number;
  onChange: (value: number) => void;
  step: number;
  min: number;
  max: number;
  unit: string;
  label: string;
  size?: 'large' | 'medium';
};

/** Valeur réglée avec − / + (appui long : défilement rapide). Gros chiffre au centre. */
export function Stepper({ value, onChange, step, min, max, unit, label, size = 'large' }: Props) {
  // Valeur à jour pour le défilement rapide (l'intervalle garde sa propre copie entre deux rendus).
  const current = useRef(value);
  useEffect(() => {
    current.current = value;
  }, [value]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const bump = (dir: 1 | -1) => {
    const next = round1(Math.min(max, Math.max(min, current.current + dir * step)));
    current.current = next;
    onChange(next);
  };
  const stop = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  };
  const repeat = (dir: 1 | -1) => {
    stop();
    timer.current = setInterval(() => bump(dir), 80);
  };
  useEffect(() => stop, []);

  return (
    <View
      style={styles.row}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ text: `${formatNumber(value)} ${unit}` }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => bump(e.nativeEvent.actionName === 'increment' ? 1 : -1)}>
      <Pressable
        accessibilityLabel={t('common.less')}
        disabled={value <= min}
        onPress={() => bump(-1)}
        onLongPress={() => repeat(-1)}
        onPressOut={stop}
        style={({ pressed }) => [styles.minus, pressed && styles.minusPressed, value <= min && styles.disabled]}>
        <Icon name="minus" size={24} />
      </Pressable>
      <View style={styles.value}>
        <AppText style={size === 'large' ? styles.big : styles.medium}>{formatNumber(value)}</AppText>
        <AppText style={styles.unit}>{unit}</AppText>
      </View>
      <Pressable
        accessibilityLabel={t('common.more')}
        disabled={value >= max}
        onPress={() => bump(1)}
        onLongPress={() => repeat(1)}
        onPressOut={stop}
        style={({ pressed }) => [styles.plus, pressed && styles.plusPressed, value >= max && styles.disabled]}>
        <Icon name="plus" size={24} color={colors.onPrimary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  minus: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  minusPressed: { backgroundColor: colors.border },
  plus: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  plusPressed: { backgroundColor: colors.primaryPressed },
  disabled: { opacity: 0.4 },
  value: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  big: { fontSize: 52, lineHeight: 58, fontWeight: '800', letterSpacing: -1.5 },
  medium: { fontSize: 44, lineHeight: 50, fontWeight: '800', letterSpacing: -1 },
  unit: { fontSize: 18, fontWeight: '600', color: colors.textMuted },
});
