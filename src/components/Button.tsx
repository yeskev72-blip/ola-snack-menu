import { ActivityIndicator, Pressable, StyleSheet, View, type PressableProps } from 'react-native';

import { AppText } from '@/components/AppText';
import { Icon, type IconName } from '@/components/Icon';
import { colors, font, radius, spacing, touchTarget } from '@/theme';

/** primary : noir plein ; accent : brun calebasse (scanner) ; secondary : blanc bordé ; ghost : texte ; danger : texte rouge. */
type Variant = 'primary' | 'accent' | 'secondary' | 'ghost' | 'danger';

type Props = Omit<PressableProps, 'children'> & {
  label: string;
  variant?: Variant;
  loading?: boolean;
  icon?: IconName;
  /** Bouton compact (40 dp), pour les cartes. */
  small?: boolean;
};

const FILLED: Variant[] = ['primary', 'accent'];

export function Button({ label, variant = 'primary', loading, disabled, icon, small, style, ...rest }: Props) {
  const isDisabled = disabled || loading;
  const filled = FILLED.includes(variant);
  const textColor = isDisabled && filled ? '#8A7B6D' : filled ? colors.onPrimary : variant === 'secondary' ? colors.text : variant === 'danger' ? colors.danger : colors.accent;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      disabled={isDisabled}
      style={(state) => [
        styles.base,
        small && styles.small,
        styles[variant],
        state.pressed && variant === 'primary' && styles.primaryPressed,
        state.pressed && variant === 'accent' && styles.accentPressed,
        state.pressed && !filled && styles.softPressed,
        isDisabled && (filled ? styles.disabledFilled : styles.disabled),
        typeof style === 'function' ? style(state) : style,
      ]}
      {...rest}>
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <View style={styles.row}>
          {icon ? <Icon name={icon} size={small ? 18 : 22} color={textColor} /> : null}
          <AppText style={[styles.label, small && styles.labelSmall, { color: textColor }]}>{label}</AppText>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: touchTarget,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  small: { minHeight: 44, paddingHorizontal: spacing.md + 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  primary: { backgroundColor: colors.primary },
  primaryPressed: { backgroundColor: colors.primaryPressed },
  accent: { backgroundColor: colors.accent },
  accentPressed: { backgroundColor: '#7A3814' },
  secondary: { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border },
  ghost: { backgroundColor: 'transparent', minHeight: 48 },
  danger: { backgroundColor: 'transparent', minHeight: 48 },
  softPressed: { backgroundColor: colors.surfaceAlt },
  disabledFilled: { backgroundColor: colors.border },
  disabled: { opacity: 0.5 },
  label: { fontSize: 17, fontWeight: '700' },
  labelSmall: { fontSize: font.small + 1 },
});
