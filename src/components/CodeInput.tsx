import { useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { colors, radius } from '@/theme';

type Props = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  label: string;
  /** Nombre de cases affichées au départ ; on en ajoute si le code est plus long. */
  minLength: number;
  maxLength: number;
};

/** Code reçu par e-mail : une case par chiffre, saisie dans un champ unique invisible (collage et remplissage auto). */
export function CodeInput({ value, onChange, onSubmit, label, minLength, maxLength }: Props) {
  const input = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);
  const boxes = Math.min(maxLength, Math.max(minLength, value.length + (value.length >= minLength && value.length < maxLength ? 1 : 0)));
  return (
    <Pressable onPress={() => input.current?.focus()} accessible={false}>
      <View style={styles.row}>
        {Array.from({ length: boxes }, (_, i) => {
          const digit = value[i];
          const active = focused && (i === value.length || (i === boxes - 1 && value.length === boxes));
          return (
            <View key={i} style={[styles.box, !digit && !active && styles.empty, active && styles.active]}>
              {digit ? <AppText style={styles.digit}>{digit}</AppText> : active ? <View style={styles.caret} /> : null}
            </View>
          );
        })}
      </View>
      <TextInput
        ref={input}
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        onSubmitEditing={onSubmit}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        maxLength={maxLength}
        autoFocus
        caretHidden
        style={styles.hidden}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  box: { flex: 1, height: 60, borderRadius: 14, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  empty: { borderColor: colors.surfaceAlt, backgroundColor: colors.surfaceAlt },
  active: { borderWidth: 2, borderColor: colors.primary, backgroundColor: colors.surface },
  digit: { fontSize: 26, lineHeight: 32, fontWeight: '800' },
  caret: { width: 2, height: 28, backgroundColor: colors.accent },
  hidden: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0, borderRadius: radius.sm },
});
