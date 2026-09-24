import { Tabs } from 'expo-router/js-tabs';

import { TabIcon, type TabIconName } from '@/components/TabIcon';
import { t, type MessageKey } from '@/i18n';
import { colors, font } from '@/theme';

const TABS: { name: string; icon: TabIconName; label: MessageKey }[] = [
  { name: 'index', icon: 'journal', label: 'tabs.journal' },
  { name: 'scan', icon: 'scan', label: 'tabs.scan' },
  { name: 'history', icon: 'history', label: 'tabs.history' },
  { name: 'profile', icon: 'profile', label: 'tabs.profile' },
];

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border, height: 64 },
        tabBarLabelStyle: { fontSize: font.small, fontWeight: '600' },
      }}>
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: t(tab.label),
            tabBarIcon: ({ color }) => <TabIcon name={tab.icon} color={color} />,
          }}
        />
      ))}
    </Tabs>
  );
}
