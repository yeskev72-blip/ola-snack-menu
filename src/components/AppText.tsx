import { StyleSheet, Text, type TextProps } from 'react-native';

import { colors, font } from '@/theme';

type Variant = 'body' | 'muted' | 'title' | 'large' | 'display' | 'small';

export function AppText({ variant = 'body', style, ...rest }: TextProps & { variant?: Variant }) {
  return <Text style={[styles.base, styles[variant], style]} {...rest} />;
}

const styles = StyleSheet.create({
  base: { color: colors.text, fontSize: font.body },
  body: {},
  muted: { color: colors.textMuted },
  small: { fontSize: font.small, color: colors.textMuted },
  large: { fontSize: font.large, fontWeight: '600' },
  title: { fontSize: font.title, fontWeight: '700' },
  display: { fontSize: font.display, fontWeight: '800' },
});
