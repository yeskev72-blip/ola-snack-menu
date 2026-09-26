import { StyleSheet, Text, type TextProps, type TextStyle } from 'react-native';

import { colors, font, fontFamily, lineHeight } from '@/theme';

type Variant = 'body' | 'muted' | 'title' | 'large' | 'display' | 'small' | 'label';

/** Texte de l'app : la graisse demandée choisit la bonne famille de Plus Jakarta Sans. */
export function AppText({ variant = 'body', style, ...rest }: TextProps & { variant?: Variant }) {
  const flat: TextStyle = StyleSheet.flatten([styles.base, styles[variant], style]);
  const { fontWeight, ...others } = flat;
  return <Text style={[others, { fontFamily: fontFamily(fontWeight) }]} {...rest} />;
}

const styles = StyleSheet.create({
  base: { color: colors.text, fontSize: font.body, lineHeight: lineHeight.body, fontWeight: '400' },
  body: {},
  muted: { color: colors.textMuted },
  small: { fontSize: font.small, lineHeight: lineHeight.small, color: colors.textMuted, fontWeight: '500' },
  /** Titre de section en capitales (« MON CORPS »). */
  label: { fontSize: 12, lineHeight: 16, color: colors.textMuted, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  large: { fontSize: font.large, lineHeight: lineHeight.large, fontWeight: '600' },
  title: { fontSize: font.title, lineHeight: lineHeight.title, fontWeight: '700', letterSpacing: -0.3 },
  display: { fontSize: font.display, lineHeight: lineHeight.display, fontWeight: '800', letterSpacing: -1 },
});
