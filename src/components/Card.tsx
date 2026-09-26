import { StyleSheet, View, type ViewProps } from 'react-native';

import { colors, radius, shadow, spacing } from '@/theme';

/** Carte blanche très arrondie, ombre douce, sans bordure. tone="soft" : fond crème accentué (Premium). */
export function Card({ style, tone = 'default', ...rest }: ViewProps & { tone?: 'default' | 'soft' | 'dark' }) {
  return <View style={[styles.card, tone === 'soft' && styles.soft, tone === 'dark' && styles.dark, style]} {...rest} />;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: spacing.md,
    gap: spacing.sm,
    ...shadow.card,
  },
  soft: { backgroundColor: colors.accentSoft, shadowOpacity: 0, elevation: 0 },
  dark: { backgroundColor: colors.primary },
});
