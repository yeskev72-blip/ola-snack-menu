import type Tabs from 'expo-router/js-tabs';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Icon, type IconName } from '@/components/Icon';
import { t, type MessageKey } from '@/i18n';
import { colors } from '@/theme';

/** Onglets latéraux ; le scanner est le gros bouton rond central. */
export const SIDE_TABS: Record<string, { icon: IconName; label: MessageKey }> = {
  index: { icon: 'journal', label: 'tabs.journal' },
  history: { icon: 'chart', label: 'tabs.history' },
  foods: { icon: 'search', label: 'tabs.foods' },
  profile: { icon: 'user', label: 'tabs.profile' },
};
const ORDER = ['index', 'history', 'scan', 'foods', 'profile'];

type BottomTabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

/** Barre d'onglets blanche, ombrée, avec le bouton « Scanner un plat » flottant au centre. */
export function TabBar({ state, navigation, insets }: BottomTabBarProps) {
  const current = state.routes[state.index]?.name;
  const go = (name: string) => {
    const route = state.routes.find((r) => r.name === name);
    if (!route) return;
    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (current !== name && !event.defaultPrevented) navigation.navigate(name);
  };

  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom, height: 76 + insets.bottom }]}>
      {ORDER.map((name) =>
        name === 'scan' ? (
          <View key={name} style={styles.cell}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('tabs.scan')}
              accessibilityState={{ selected: current === 'scan' }}
              onPress={() => go('scan')}
              style={({ pressed }) => [styles.scan, pressed && styles.scanPressed]}>
              <Icon name="camera" size={26} color={colors.onPrimary} />
            </Pressable>
          </View>
        ) : (
          <Pressable
            key={name}
            accessibilityRole="tab"
            accessibilityState={{ selected: current === name }}
            onPress={() => go(name)}
            style={styles.cell}>
            <Icon name={SIDE_TABS[name]!.icon} size={22} color={current === name ? colors.text : colors.textMuted} strokeWidth={current === name ? 2.2 : 2} />
            <AppText style={[styles.label, current === name && styles.labelActive]}>{t(SIDE_TABS[name]!.label)}</AppText>
          </Pressable>
        ),
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: 6,
    shadowColor: '#3C230F',
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -4 },
    elevation: 12,
  },
  cell: { flex: 1, height: 56, alignItems: 'center', justifyContent: 'center', gap: 4 },
  label: { fontSize: 12, lineHeight: 16, color: colors.textMuted, fontWeight: '600' },
  labelActive: { color: colors.text, fontWeight: '800' },
  scan: {
    width: 64,
    height: 64,
    marginTop: -32,
    borderRadius: 32,
    backgroundColor: colors.accent,
    borderWidth: 4,
    borderColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.accent,
    shadowOpacity: 0.35,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  scanPressed: { backgroundColor: '#7A3814' },
});
