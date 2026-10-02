import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { AppText } from '@/components/AppText';
import { Icon } from '@/components/Icon';
import { t } from '@/i18n';
import { colors, font, fontFamily, radius, spacing } from '@/theme';

type Props = TextInputProps & {
  label: string;
  hint?: string;
  error?: string | null;
};

/**
 * Champ de saisie : bord fin, bord noir épais au focus, rouge avec icône en cas d'erreur.
 *
 * Un champ masqué (secureTextEntry) reçoit d'office un bouton pour afficher ce qui est tapé.
 * Sans lui, on choisit son mot de passe à l'aveugle au clavier d'un téléphone, et la faute de
 * frappe ne se découvre qu'à la connexion suivante — quand il est trop tard pour la corriger.
 */
export function TextField({ label, hint, error, style, onFocus, onBlur, secureTextEntry, ...rest }: Props) {
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const maskable = secureTextEntry === true;

  return (
    <View style={styles.wrap}>
      <AppText style={styles.label}>{label}</AppText>
      <View>
        <TextInput
          accessibilityLabel={label}
          placeholderTextColor="#8A7B6D"
          secureTextEntry={maskable && !revealed}
          style={[
            styles.input,
            maskable && styles.inputWithButton,
            focused && styles.inputFocused,
            error ? styles.inputError : null,
            style,
          ]}
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
        {maskable ? (
          <Pressable
            style={styles.reveal}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t(revealed ? 'auth.hidePassword' : 'auth.showPassword')}
            onPress={() => setRevealed((on) => !on)}>
            <Icon name={revealed ? 'eyeOff' : 'eye'} size={22} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>
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

/** Place laissée au bouton pour que le texte ne passe jamais dessous. */
const BUTTON_WIDTH = 52;

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
  inputWithButton: { paddingRight: BUTTON_WIDTH },
  inputFocused: { borderWidth: 2, borderColor: colors.primary },
  inputError: { borderWidth: 2, borderColor: colors.danger },
  reveal: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: BUTTON_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  error: { color: colors.danger, fontSize: font.small, fontWeight: '600' },
});
