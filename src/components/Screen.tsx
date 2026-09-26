import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Icon } from '@/components/Icon';
import { t } from '@/i18n';
import { colors, shadow, spacing } from '@/theme';

type Props = {
  children: ReactNode;
  /** Contenu fixé en bas de l'écran (bouton principal), hors défilement. */
  footer?: ReactNode;
  scroll?: boolean;
  edges?: Edge[];
  /** En-tête : bouton rond (retour ou fermer) et titre. */
  title?: string;
  back?: 'back' | 'close' | false;
  onBack?: () => void;
  /** Élément à droite de l'en-tête. */
  headerRight?: ReactNode;
  /** En-tête personnalisé (remplace bouton rond et titre). */
  header?: ReactNode;
};

/** Bouton rond blanc de l'en-tête (retour, fermer). */
export function RoundButton({ icon, label, onPress, dark }: { icon: 'back' | 'close' | 'refresh'; label: string; onPress: () => void; dark?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={4}
      onPress={onPress}
      style={({ pressed }) => [styles.round, dark && styles.roundDark, pressed && styles.roundPressed]}>
      <Icon name={icon} size={22} color={dark ? colors.onPrimary : colors.text} />
    </Pressable>
  );
}

export function Screen({ children, footer, scroll = true, edges = ['top', 'bottom'], title, back = false, onBack, headerRight, header: custom }: Props) {
  const header = custom ? (
    <View style={styles.header}>{custom}</View>
  ) : title !== undefined || back || headerRight ? (
      <View style={styles.header}>
        {back ? (
          <RoundButton icon={back} label={back === 'close' ? t('common.close') : t('common.back')} onPress={onBack ?? (() => router.back())} />
        ) : null}
        <AppText variant="large" style={styles.headerTitle} numberOfLines={1} accessibilityRole="header">
          {title ?? ''}
        </AppText>
        {headerRight}
      </View>
    ) : null;
  return (
    <SafeAreaView style={styles.safe} edges={edges}>
      {header}
      {scroll ? (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.content, styles.fill]}>{children}</View>
      )}
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  fill: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.xs, minHeight: 60 },
  headerTitle: { flex: 1, fontWeight: '800' },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  footer: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.md, gap: spacing.sm },
  round: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', ...shadow.card },
  roundDark: { backgroundColor: 'rgba(27,21,17,0.55)', shadowOpacity: 0, elevation: 0 },
  roundPressed: { backgroundColor: colors.surfaceAlt },
});
