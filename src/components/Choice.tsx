import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Icon, type IconName } from '@/components/Icon';
import { colors, radius, shadow, spacing } from '@/theme';

type Props = {
  label: string;
  selected: boolean;
  onPress: () => void;
  icon?: IconName;
  description?: string;
};

/** Grande carte d'option (onboarding) : icône dans une pastille, coche ronde quand elle est choisie. */
export function Choice({ label, selected, onPress, icon, description }: Props) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.base, selected && styles.selected, pressed && !selected && styles.pressed]}>
      {icon ? (
        <View style={[styles.iconWrap, selected && styles.iconWrapSelected]}>
          <Icon name={icon} size={20} color={colors.accent} />
        </View>
      ) : null}
      <View style={styles.texts}>
        <AppText style={styles.label}>{label}</AppText>
        {description ? <AppText variant="small">{description}</AppText> : null}
      </View>
      {selected ? (
        <View style={styles.check}>
          <Icon name="check" size={14} color={colors.onPrimary} strokeWidth={3} />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderRadius: radius.card,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: colors.surface,
    ...shadow.card,
  },
  selected: { borderColor: colors.primary, backgroundColor: colors.accentSoft },
  pressed: { backgroundColor: colors.surfaceAlt },
  iconWrap: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  iconWrapSelected: { backgroundColor: colors.surface },
  texts: { flex: 1, gap: 2 },
  label: { fontWeight: '700' },
  check: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
});
