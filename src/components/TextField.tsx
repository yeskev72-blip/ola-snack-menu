import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { AppText } from '@/components/AppText';
import { colors, font, radius, spacing, touchTarget } from '@/theme';

type Props = TextInputProps & {
  label: string;
  hint?: string;
  error?: string | null;
};

export function TextField({ label, hint, error, style, ...rest }: Props) {
  return (
    <View style={styles.wrap}>
      <AppText style={styles.label}>{label}</AppText>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.textMuted}
        style={[styles.input, error ? styles.inputError : null, style]}
        {...rest}
      />
      {error ? (
        <AppText style={styles.error}>{error}</AppText>
      ) : hint ? (
        <AppText variant="small">{hint}</AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  label: { fontWeight: '600' },
  input: {
    minHeight: touchTarget,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    fontSize: font.large,
    color: colors.text,
  },
  inputError: { borderColor: colors.danger },
  error: { color: colors.danger, fontSize: font.small },
});
