import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { colors, radius, spacing } from '@/theme';

/** Message d'erreur ou d'information affiché dans un formulaire. */
export function Notice({ message, tone = 'error' }: { message: string | null | undefined; tone?: 'error' | 'info' }) {
  if (!message) return null;
  return (
    <View accessibilityLiveRegion="polite" style={[styles.box, tone === 'error' ? styles.error : styles.info]}>
      <AppText style={tone === 'error' ? styles.errorText : undefined}>{message}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: radius.sm, padding: spacing.md, borderWidth: 1 },
  error: { backgroundColor: '#FBEAE8', borderColor: colors.danger },
  info: { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
  errorText: { color: colors.danger, fontWeight: '600' },
});
