import { Pressable, StyleSheet } from 'react-native';

import { AppText } from '@/components/AppText';
import { colors, radius, spacing } from '@/theme';

/** Petite option en pilule (type de repas, repère de portion, réponse, pays) : noire quand elle est choisie. */
export function Chip({ label, selected, onPress, tone = 'default' }: { label: string; selected: boolean; onPress: () => void; tone?: 'default' | 'onSoft' }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, tone === 'onSoft' && styles.onSoft, selected && styles.selected, pressed && !selected && styles.pressed]}>
      <AppText style={[styles.label, selected && styles.labelSelected]}>{label}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  onSoft: { borderColor: colors.surface },
  selected: { borderColor: colors.primary, backgroundColor: colors.primary },
  pressed: { backgroundColor: colors.surfaceAlt },
  label: { fontWeight: '600', fontSize: 15 },
  labelSelected: { color: colors.onPrimary },
});
