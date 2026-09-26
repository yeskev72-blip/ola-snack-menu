import { useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { AppText } from '@/components/AppText';
import { Icon } from '@/components/Icon';
import { colors, font, fontFamily, radius, spacing } from '@/theme';

type Props = TextInputProps & {
  label: string;
  hint?: string;
  error?: string | null;
};

/** Champ de saisie : bord fin, bord noir épais au focus, rouge avec icône en cas d'erreur. */
export function TextField({ label, hint, error, style, onFocus, onBlur, ...rest }: Props) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.wrap}>
      <AppText style={styles.label}>{label}</AppText>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor="#8A7B6D"
        style={[styles.input, focused && styles.inputFocused, error ? styles.inputError : null, style]}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        {...rest}
      />
      {error ? (
        <View style={styles.errorRow}>
          <Icon name="alert" size={16} color={colors.danger} />
          <AppText style={styles.error}>{error}</AppText>
        </View>
      ) : hint ? (
        <AppText variant="small">{hint}</AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { fontWeight: '600', fontSize: 14 },
  input: {
    minHeight: 56,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: font.body,
    fontFamily: fontFamily('500'),
    color: colors.text,
    backgroundColor: colors.surface,
  },
  inputFocused: { borderWidth: 2, borderColor: colors.primary },
  inputError: { borderWidth: 2, borderColor: colors.danger },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  error: { color: colors.danger, fontSize: font.small, fontWeight: '600' },
});
