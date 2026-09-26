import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { spacing } from '@/theme';

/** Grand titre d'écran (auth, onboarding, formulaires) avec son texte d'accompagnement. */
export function Heading({ title, body, icon }: { title: string; body?: ReactNode; icon?: ReactNode }) {
  return (
    <View style={styles.wrap}>
      {icon}
      <AppText style={styles.title} accessibilityRole="header">
        {title}
      </AppText>
      {body ? (
        <AppText variant="muted" style={styles.body}>
          {body}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm, marginBottom: spacing.sm },
  title: { fontSize: 28, lineHeight: 34, fontWeight: '800', letterSpacing: -0.5 },
  body: { fontSize: 17, lineHeight: 25 },
});
