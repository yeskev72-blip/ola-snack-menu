import { Pressable, StyleSheet } from 'react-native';

import { AppText } from '@/components/AppText';
import { colors, radius, spacing, touchTarget } from '@/theme';

type Props = {
  label: string;
  selected: boolean;
  onPress: () => void;
};

/** Option sélectionnable (bouton radio en grand format). */
export function Choice({ label, selected, onPress }: Props) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.base, selected && styles.selected, pressed && !selected && styles.pressed]}>
      <AppText style={[styles.label, selected && styles.labelSelected]}>{label}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: touchTarget,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  selected: { borderColor: colors.primary, backgroundColor: colors.surfaceAlt },
  pressed: { backgroundColor: colors.surfaceAlt },
  label: { fontWeight: '500' },
  labelSelected: { color: colors.primary, fontWeight: '700' },
});
