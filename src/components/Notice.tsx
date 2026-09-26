import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Icon } from '@/components/Icon';
import { colors, radius, spacing } from '@/theme';

/** Bandeau d'erreur ou d'information, avec icône. */
export function Notice({ message, tone = 'error' }: { message: string | null | undefined; tone?: 'error' | 'info' }) {
  if (!message) return null;
  const error = tone === 'error';
  return (
    <View accessibilityLiveRegion="polite" style={[styles.box, error ? styles.error : styles.info]}>
      <Icon name={error ? 'warning' : 'info'} size={20} color={error ? colors.danger : colors.textMuted} />
      <AppText style={[styles.text, error && styles.errorText]}>{message}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: radius.md, padding: spacing.md },
  error: { backgroundColor: '#FDECEA' },
  info: { backgroundColor: colors.surfaceAlt },
  text: { flex: 1, fontSize: 15, lineHeight: 22 },
  errorText: { color: colors.danger, fontWeight: '600' },
});
